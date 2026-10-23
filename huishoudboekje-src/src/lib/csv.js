import { newId, toIsoDate } from "./format";
import { normalizeIban } from "./accounts";

// Datum uit een CSV-cel: 20260915, 2026-09-15, 15-09-2026 / 15/09/2026, of iets wat Date begrijpt.
export function parseDate(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{8}$/.test(s)) {
    const d = new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00`);
    if (!isNaN(d.getTime())) return d;
  }
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}T00:00:00`);
    if (!isNaN(d.getTime())) return d;
  }
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    const d = new Date(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}T00:00:00`);
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(s);
  return !isNaN(d.getTime()) && s.length >= 6 ? d : null;
}

// Bedrag uit tekst: "€ -1.234,56", "(12.50)", "+3,5", "1,234.56" ...
export function parseAmount(value) {
  if (value == null) return null;
  let s = String(value).trim();
  if (!s) return null;
  s = s.replace(/[€$\s]/g, "");
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  if (s.startsWith("+")) s = s.slice(1);
  if (!/[0-9]/.test(s)) return null;
  const comma = s.lastIndexOf(",");
  const dot = s.lastIndexOf(".");
  if (comma > -1 && dot > -1) {
    s = comma > dot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (comma > -1) {
    s = s.length - comma - 1 === 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : negative ? -n : n;
}

// Zelf ingetypt bedrag: als parseAmount, maar "12,5" is 12,50 (en niet 125 zoals bij een CSV-cel).
export function parseInputAmount(value) {
  const s = String(value ?? "").trim();
  return /^[+-]?\d+,\d$/.test(s.replace(/[€\s]/g, "")) ? parseAmount(s + "0") : parseAmount(s);
}

// Transacties als CSV (puntkomma, decimale komma), zodat Excel en de eigen import het lezen.
export function transactionsToCsv(list) {
  // Tekst die met = + - @ begint niet als formule laten uitvoeren in Excel.
  const text = (v) => {
    const s = String(v ?? "");
    return /^[=+\-@]/.test(s) ? `'${s}` : s;
  };
  const cell = (s) => (/[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows = list.map((t) => [
    t.date,
    text(t.description),
    text(t.category),
    t.amount.toFixed(2).replace(".", ","),
    text(t.note),
    text((t.tags || []).join(", ")),
  ]);
  return [["Datum", "Omschrijving", "Categorie", "Bedrag", "Notitie", "Labels"], ...rows]
    .map((r) => r.map(cell).join(";"))
    .join("\r\n");
}

export function downloadCsv(filename, csv) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Bekende bankformaten, herkend aan hun kolomkoppen. account = eigen rekening, counter = tegenrekening.
const BANK_PROFILES = [
  {
    naam: "Rabobank",
    match: (h) => h.includes("Rentedatum") && h.includes("Bedrag") && h.includes("Naam tegenpartij"),
    map: (h) => ({
      date: h.indexOf("Datum") > -1 ? h.indexOf("Datum") : h.indexOf("Rentedatum"),
      amount: h.indexOf("Bedrag"),
      amount2: -1,
      desc: [h.indexOf("Naam tegenpartij"), h.indexOf("Omschrijving-1")].filter((i) => i > -1),
      signCol: -1,
      account: h.indexOf("IBAN/BBAN"),
      counter: h.indexOf("Tegenrekening IBAN/BBAN"),
    }),
  },
  {
    naam: "ING",
    match: (h) => h.includes("Naam / Omschrijving") && h.includes("Af Bij"),
    map: (h) => ({
      date: h.indexOf("Datum"),
      amount: h.findIndex((c) => /^Bedrag/i.test(c)),
      amount2: -1,
      desc: [h.indexOf("Naam / Omschrijving"), h.indexOf("Mededelingen")].filter((i) => i > -1),
      signCol: h.indexOf("Af Bij"),
      account: h.indexOf("Rekening"),
      counter: h.indexOf("Tegenrekening"),
    }),
  },
  {
    naam: "Knab",
    match: (h) => h.includes("Transactiedatum") && h.includes("Tegenrekeningnummer"),
    map: (h) => ({
      date: h.indexOf("Transactiedatum"),
      amount: h.indexOf("Bedrag"),
      amount2: -1,
      desc: [h.indexOf("Naam tegenpartij"), h.indexOf("Omschrijving")].filter((i) => i > -1),
      signCol: -1,
      account: h.indexOf("Rekeningnummer"),
      counter: h.indexOf("Tegenrekeningnummer"),
    }),
  },
  {
    naam: "bunq",
    match: (h) =>
      h.includes("Naam tegenpartij") && h.includes("Datum") && h.includes("Omschrijving") && !h.includes("Rentedatum"),
    map: (h) => ({
      date: h.indexOf("Datum"),
      amount: h.indexOf("Bedrag"),
      amount2: -1,
      desc: [h.indexOf("Naam tegenpartij"), h.indexOf("Omschrijving")].filter((i) => i > -1),
      signCol: -1,
      account: h.indexOf("Rekening"),
      counter: h.indexOf("Tegenrekening"),
    }),
  },
];

const DMY = /^\d{1,2}-\d{1,2}-\d{4}$/;
const cellOf = (row, i) => String(row?.[i] ?? "").trim();

// Bankformaten zonder kopregel, herkend aan de vorm van de eerste rij.
const HEADERLESS_PROFILES = [
  {
    // ABN AMRO "TXT": rekening, EUR, transactiedatum, beginsaldo, eindsaldo, rentedatum, bedrag, omschrijving.
    naam: "ABN AMRO",
    match: (r) =>
      r.length >= 8 && cellOf(r, 1) === "EUR" && /^\d{8}$/.test(cellOf(r, 2)) && /^\d{8}$/.test(cellOf(r, 5)),
    mapping: { date: 2, amount: 6, amount2: -1, desc: [7], signCol: -1, account: 0, counter: -1, clean: "abn" },
  },
  {
    // De Volksbank (SNS, ASN Bank, RegioBank): boekingsdatum, eigen rekening, tegenrekening, naam,
    // adres, postcode, plaats, valuta, saldo, valuta, bedrag, ... omschrijving (kolom 18).
    naam: "SNS / ASN / RegioBank",
    match: (r) => r.length >= 18 && DMY.test(cellOf(r, 0)) && cellOf(r, 7) === "EUR" && cellOf(r, 9) === "EUR",
    mapping: { date: 0, amount: 10, amount2: -1, desc: [3, 17], signCol: -1, account: 1, counter: 2 },
  },
  {
    // Triodos: datum, eigen rekening, bedrag, Debet/Credit, naam, tegenrekening, code, omschrijving.
    naam: "Triodos",
    match: (r) => r.length >= 8 && DMY.test(cellOf(r, 0)) && /^(debet|credit)$/i.test(cellOf(r, 3)),
    mapping: { date: 0, amount: 2, amount2: -1, desc: [4, 7], signCol: 3, account: 1, counter: 5 },
  },
];

export function detectHeaderlessBank(rows) {
  const first = rows?.[0];
  if (!first) return null;
  const profile = HEADERLESS_PROFILES.find((p) => p.match(first));
  return profile ? { profile, mapping: { ...profile.mapping } } : null;
}

// ABN AMRO-omschrijvingen zijn lang en technisch; haal er naam en omschrijving uit.
export function cleanAbnDescription(text) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  const sepaName = s.match(/\/NAME\/([^/]*)/);
  if (sepaName) {
    const remi = s.match(/\/REMI\/([^/]*)/);
    return [sepaName[1].trim(), remi?.[1]?.trim()].filter(Boolean).join(" - ") || s;
  }
  const naam = s.match(/Naam: (.*?)(?= Omschrijving:| Kenmerk:| Machtiging:| IBAN:| BIC:|$)/);
  if (naam) {
    const oms = s.match(/Omschrijving: (.*?)(?= Kenmerk:| IBAN:| BIC:| Machtiging:|$)/);
    return [naam[1].trim(), oms?.[1]?.trim()].filter(Boolean).join(" - ");
  }
  // Pinbetaling: "BEA NR:XXXX 15.09.26/12.34 ALBERT HEIJN 1234,PAS123"
  const pin = s.match(/^(?:BEA|GEA)\b.*?\d{2}\.\d{2}\.\d{2}\/\d{2}[.:]\d{2} (.*?)(?:,\s*PAS\s*\d+)?$/i);
  if (pin) return pin[1].trim();
  return s;
}

// Tegenrekening in een ABN AMRO-omschrijving ("/IBAN/NL..." of "IBAN: NL...").
const ibanInText = (text) => normalizeIban(String(text || "").match(/IBAN[/:\s]+([A-Z]{2}\d{2}[A-Z0-9]{8,30})/i)?.[1]);

export function detectBank(headers) {
  for (const profile of BANK_PROFILES) {
    try {
      if (profile.match(headers)) return { profile, mapping: profile.map(headers) };
    } catch {
      // onbekend formaat: volgende proberen
    }
  }
  return null;
}

// Kolomtoewijzing raden op basis van de inhoud van de eerste 30 rijen.
export function guessMapping(headers, rows) {
  const sample = rows.slice(0, 30);
  const cols = headers.map((header, idx) => {
    let dates = 0;
    let amounts = 0;
    let totalLen = 0;
    let nonEmpty = 0;
    const distinctValues = new Set();
    sample.forEach((row) => {
      const v = row[idx];
      if (v == null || String(v).trim() === "") return;
      nonEmpty++;
      distinctValues.add(String(v).trim().toLowerCase());
      if (parseDate(v)) dates++;
      if (parseAmount(v) !== null) amounts++;
      totalLen += String(v).length;
    });
    return {
      idx,
      header,
      nonEmpty,
      dateScore: nonEmpty ? dates / nonEmpty : 0,
      amountScore: nonEmpty ? amounts / nonEmpty : 0,
      avgLen: nonEmpty ? totalLen / nonEmpty : 0,
      distinctValues,
    };
  });

  const dateCol = cols.filter((c) => c.dateScore > 0.6).sort((a, b) => b.dateScore - a.dateScore)[0];
  const signCol = cols.find((c) => {
    if (c.idx === dateCol?.idx) return false;
    const values = [...c.distinctValues];
    return values.length === 0 || values.length > 3
      ? false
      : values.every((v) => /^(af|bij|debit|credit|d|c|debet|credet|-|\+)$/i.test(v));
  });
  const amountCols = cols
    .filter((c) => c.amountScore > 0.6 && c.idx !== dateCol?.idx && c.idx !== signCol?.idx)
    .sort((a, b) => b.amountScore - a.amountScore);
  // Kolommen met rekeningnummers: steeds hetzelfde = eigen rekening, wisselend = tegenrekening.
  const ibanCols = cols.filter(
    (c) =>
      c.nonEmpty > 0 &&
      c.idx !== dateCol?.idx &&
      sample.filter((row) => normalizeIban(row[c.idx]).length > 9).length / c.nonEmpty > 0.6,
  );
  const accountCol = ibanCols.find((c) => c.distinctValues.size === 1);
  const counterCol = ibanCols.find((c) => c !== accountCol && c.distinctValues.size > 1);
  const used = new Set([
    dateCol?.idx,
    signCol?.idx,
    accountCol?.idx,
    counterCol?.idx,
    ...amountCols.slice(0, 2).map((c) => c.idx),
  ]);
  const descCols = cols
    .filter((c) => !used.has(c.idx) && c.nonEmpty > 0)
    .sort((a, b) => b.avgLen - a.avgLen)
    .slice(0, 2)
    .map((c) => c.idx);

  let amount = -1;
  let amount2 = -1;
  if (amountCols.length >= 2) {
    const out = amountCols.findIndex((c) => /af|debet|uit|withdraw/i.test(c.header));
    const inc = amountCols.findIndex((c) => /bij|credit|in|deposit/i.test(c.header));
    if (out > -1 && inc > -1) {
      amount = amountCols[out].idx;
      amount2 = amountCols[inc].idx;
    } else {
      amount = amountCols[0].idx;
      amount2 = amountCols[1].idx;
    }
  } else if (amountCols.length === 1) {
    amount = amountCols[0].idx;
  }

  return {
    date: dateCol ? dateCol.idx : -1,
    amount,
    amount2,
    desc: descCols,
    signCol: signCol ? signCol.idx : -1,
    account: accountCol ? accountCol.idx : -1,
    counter: counterCol ? counterCol.idx : -1,
  };
}

// CSV-rijen omzetten naar transacties volgens de kolomtoewijzing.
// amount2 = aparte "bij"-kolom (amount is dan "af"); signCol = kolom met Af/Bij.
export function rowsToTransactions(headers, rows, mapping) {
  const result = [];
  for (const row of rows) {
    const date = parseDate(mapping.date > -1 ? row[mapping.date] : null);
    if (!date) continue;

    let amount = null;
    if (mapping.signCol > -1 && mapping.amount > -1) {
      const abs = Math.abs(parseAmount(row[mapping.amount]) ?? NaN);
      const sign = String(row[mapping.signCol] || "")
        .trim()
        .toLowerCase();
      const isDebit = /^(af|debit|d|debet|-)$/i.test(sign);
      if (!isNaN(abs)) amount = isDebit ? -abs : abs;
    } else if (mapping.amount > -1 && mapping.amount2 > -1) {
      const out = parseAmount(row[mapping.amount]);
      const inc = parseAmount(row[mapping.amount2]);
      amount = (inc !== null ? Math.abs(inc) : 0) - (out !== null ? Math.abs(out) : 0);
    } else if (mapping.amount > -1) {
      amount = parseAmount(row[mapping.amount]);
    }
    if (amount === null || isNaN(amount)) continue;

    const rawDesc = (mapping.desc || [])
      .map((i) => (i > -1 ? String(row[i] || "").trim().replace(/^'(.*)'$/, "$1").trim() : ""))
      .filter(Boolean)
      .join(" - ");
    const description = (mapping.clean === "abn" ? cleanAbnDescription(rawDesc) : rawDesc) || "(geen omschrijving)";

    const tx = {
      id: newId(),
      date: toIsoDate(date),
      description,
      category: "",
      amount: Math.round(amount * 100) / 100,
    };
    const account = mapping.account > -1 ? normalizeIban(row[mapping.account]) : "";
    const counter =
      mapping.counter > -1 ? normalizeIban(row[mapping.counter]) : mapping.clean === "abn" ? ibanInText(rawDesc) : "";
    if (account) tx.account = account;
    if (counter) tx.counter = counter;
    result.push(tx);
  }
  return result;
}
