import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { Check, CircleAlert, Upload, X } from "lucide-react";
import { P } from "../theme";
import { formatDate } from "../lib/format";
import { detectBank, detectHeaderlessBank, guessMapping, parseAmount, parseDate, rowsToTransactions } from "../lib/csv";
import { splitDuplicates } from "../lib/duplicates";
import { accountLabel, formatIban } from "../lib/accounts";
import { Amount, Button, Select } from "./ui";

const EMPTY_MAPPING = { date: -1, amount: -1, amount2: -1, desc: [], signCol: -1, account: -1, counter: -1 };

// Sleutel waaronder een bevestigde kolomindeling wordt onthouden.
const headerKey = (headers) => headers.map((h) => String(h).trim().toLowerCase()).join("|");

// Stappen: 1 = bestand kiezen / plakken, 2 = kolommen toewijzen, 3 = voorbeeld.
export default function ImportDialog({
  open,
  onClose,
  onImport,
  transactions,
  csvFormats,
  setCsvFormats,
  accounts = [],
}) {
  const [step, setStep] = useState(1);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState(EMPTY_MAPPING);
  const [bankName, setBankName] = useState(null);
  const [remembered, setRemembered] = useState(false);
  const [error, setError] = useState("");
  const [pasted, setPasted] = useState("");
  // Eigen rekening voor alle rijen, als het bestand zelf geen rekeningkolom heeft.
  const [manualAccount, setManualAccount] = useState("");
  const fileInput = useRef(null);
  const preview = useMemo(() => {
    if (step !== 3) return [];
    const list = rowsToTransactions(headers, rows, mapping);
    return manualAccount && !(mapping.account > -1) ? list.map((t) => ({ ...t, account: manualAccount })) : list;
  }, [step, headers, rows, mapping, manualAccount]);
  const detectedAccounts = [...new Set(preview.map((t) => t.account).filter(Boolean))];
  const accountOptions = accounts.map((a) => `${a.name} (${formatIban(a.iban)})`);
  const { fresh, duplicates } = useMemo(() => splitDuplicates(transactions, preview), [transactions, preview]);

  if (!open) return null;

  const reset = () => {
    setStep(1);
    setHeaders([]);
    setRows([]);
    setError("");
    setPasted("");
    setMapping(EMPTY_MAPPING);
    setBankName(null);
    setRemembered(false);
    setManualAccount("");
  };

  const parseText = (text) => {
    const parsed = Papa.parse(text.trim(), { delimiter: "", skipEmptyLines: true });
    if (!parsed.data || parsed.data.length < 1 || (parsed.data.length < 2 && !detectHeaderlessBank(parsed.data))) {
      setError("Kon geen tabel met gegevens herkennen in dit bestand.");
      return;
    }
    setError("");
    // Banken zonder kopregel (ABN AMRO, SNS/ASN/RegioBank, Triodos) eerst, anders zou de eerste
    // transactie als kopregel worden gezien.
    const headerless = detectHeaderlessBank(parsed.data);
    if (headerless) {
      const width = Math.max(...parsed.data.slice(0, 20).map((r) => r.length));
      setHeaders(Array.from({ length: width }, (_, i) => `Kolom ${i + 1}`));
      setRows(parsed.data);
      setBankName(headerless.profile.naam);
      setRemembered(false);
      setMapping(headerless.mapping);
      setStep(2);
      return;
    }
    const first = parsed.data[0];
    // Een kopregel bevat minstens één cel die geen bedrag en geen datum is.
    const hasHeader = first.some((cell) => parseAmount(cell) === null && !parseDate(cell));
    const cols = hasHeader ? first.map((c) => String(c || "").trim()) : first.map((_, i) => `Kolom ${i + 1}`);
    const dataRows = hasHeader ? parsed.data.slice(1) : parsed.data;
    setHeaders(cols);
    setRows(dataRows);

    const bank = detectBank(cols);
    if (bank) {
      setBankName(bank.profile.naam);
      setRemembered(false);
      setMapping(bank.mapping);
    } else {
      const saved = csvFormats[headerKey(cols)];
      setBankName(null);
      if (saved) {
        setRemembered(true);
        setMapping(saved);
      } else {
        setRemembered(false);
        setMapping(guessMapping(cols, dataRows));
      }
    }
    setStep(2);
  };

  const readFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => parseText(String(e.target.result || ""));
    reader.onerror = () => setError("Kon het bestand niet lezen.");
    reader.readAsText(file);
  };

  const roleOf = (idx) =>
    idx === mapping.date
      ? "Datum"
      : idx === mapping.amount
        ? mapping.signCol > -1
          ? "Bedrag"
          : mapping.amount2 > -1
            ? "Bedrag af (uitgaven)"
            : "Bedrag"
        : idx === mapping.amount2
          ? "Bedrag bij (inkomsten)"
          : idx === mapping.signCol
            ? "Af / Bij"
            : (mapping.desc || []).includes(idx)
              ? "Omschrijving"
              : idx === mapping.account
                ? "Eigen rekening"
                : idx === mapping.counter
                  ? "Tegenrekening"
                  : "Negeren";

  const setRole = (idx, role) => {
    setMapping((m) => {
      const next = { ...m, desc: [...(m.desc || [])] };
      for (const key of ["date", "amount", "amount2", "signCol", "account", "counter"]) if (next[key] === idx) next[key] = -1;
      next.desc = next.desc.filter((d) => d !== idx);
      if (role === "Datum") next.date = idx;
      else if (role === "Bedrag" || role === "Bedrag af (uitgaven)") next.amount = idx;
      else if (role === "Bedrag bij (inkomsten)") next.amount2 = idx;
      else if (role === "Af / Bij") next.signCol = idx;
      else if (role === "Omschrijving") next.desc.push(idx);
      else if (role === "Eigen rekening") next.account = idx;
      else if (role === "Tegenrekening") next.counter = idx;
      return next;
    });
  };

  const doImport = () => {
    onImport(fresh, duplicates.length, bankName);
    reset();
    onClose();
  };

  const roles = [
    "Negeren",
    "Datum",
    mapping.amount2 > -1 || mapping.signCol > -1 ? "Bedrag af (uitgaven)" : "Bedrag",
    "Bedrag bij (inkomsten)",
    "Af / Bij",
    "Omschrijving",
    "Eigen rekening",
    "Tegenrekening",
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(15,31,56,0.45)" }}
    >
      <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl hb-dialog" style={{ backgroundColor: P.surface }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: P.border }}>
          <h2 className="font-semibold" style={{ color: P.heading }}>
            CSV importeren
          </h2>
          <button
            onClick={() => {
              reset();
              onClose();
            }}
            className="p-1 rounded hover:bg-black/5"
            style={{ color: P.muted }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">
          {error && (
            <div
              className="flex items-start gap-2 p-3 rounded-md mb-4 text-sm"
              style={{ backgroundColor: P.errorBg, color: P.expense }}
            >
              <CircleAlert size={16} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm" style={{ color: P.muted }}>
                Upload een CSV-export van je bank, of plak de inhoud hieronder. Werkt met Rabobank, ING, ABN AMRO (TXT),
                SNS, ASN Bank, RegioBank, Triodos, Knab, bunq en de meeste andere banken - de kolommen worden automatisch
                herkend.
              </p>
              <div
                onClick={() => fileInput.current?.click()}
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer"
                style={{ borderColor: P.border }}
              >
                <Upload size={22} className="mx-auto mb-2" style={{ color: P.blue }} />
                <p className="text-sm font-medium" style={{ color: P.text }}>
                  Klik om een CSV-bestand te kiezen
                </p>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".csv,.txt,.tab,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => readFile(e.target.files?.[0])}
                />
              </div>
              <div className="text-xs text-center" style={{ color: P.muted }}>
                of plak de tekst hieronder
              </div>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder="Plak hier de inhoud van je CSV-bestand..."
                rows={5}
                className="w-full px-3 py-2 rounded-lg border text-xs font-mono"
                style={{ borderColor: P.border }}
              />
              <div className="flex justify-end">
                <Button variant="primary" onClick={() => parseText(pasted)} disabled={!pasted.trim()}>
                  Volgende
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div
                className="flex items-center gap-2 text-sm p-3 rounded-md"
                style={{ backgroundColor: P.paleBlue, color: P.heading }}
              >
                <Check size={16} style={{ color: P.income }} />
                {remembered ? (
                  <span>
                    Dit indelingspatroon is <strong>onthouden</strong> van een eerdere import - kolommen zijn
                    automatisch toegewezen zoals je ze eerder bevestigde.
                  </span>
                ) : bankName ? (
                  <span>
                    <strong>{bankName}</strong>-formaat herkend - kolommen zijn automatisch toegewezen.
                  </span>
                ) : (
                  <span>
                    Formaat niet direct herkend - kolommen zijn zo goed mogelijk automatisch gegokt. Controleer ze
                    hieronder.
                  </span>
                )}
              </div>
              {remembered && (
                <button
                  onClick={() => {
                    setCsvFormats((f) => {
                      const next = { ...f };
                      delete next[headerKey(headers)];
                      return next;
                    });
                    setRemembered(false);
                    setMapping(guessMapping(headers, rows));
                  }}
                  className="text-xs font-medium underline"
                  style={{ color: P.expense }}
                >
                  Klopt dit niet? Vergeet deze onthouden indeling en gok opnieuw
                </button>
              )}
              <p className="text-sm" style={{ color: P.muted }}>
                Klopt de toewijzing? Pas aan waar nodig.
              </p>
              <div className="overflow-x-auto rounded-2xl border hb-card" style={{ borderColor: P.border }}>
                <table className="w-full text-xs min-w-[600px]">
                  <thead>
                    <tr style={{ backgroundColor: P.bg }}>
                      {headers.map((h, i) => (
                        <th key={i} className="p-2 text-left border-b" style={{ borderColor: P.border }}>
                          <div
                            className="font-semibold mb-1 truncate max-w-[140px]"
                            style={{ color: P.text }}
                            title={h}
                          >
                            {h}
                          </div>
                          <select
                            value={roleOf(i)}
                            onChange={(e) => setRole(i, e.target.value)}
                            className="w-full text-xs border rounded px-1 py-1"
                            style={{ borderColor: P.border }}
                          >
                            {roles.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 4).map((row, r) => (
                      <tr key={r} className="border-b last:border-0" style={{ borderColor: P.border }}>
                        {headers.map((_, c) => (
                          <td key={c} className="p-2 truncate max-w-[140px]" style={{ color: P.muted }}>
                            {String(row[c] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={reset}>
                  Terug
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setCsvFormats((f) => ({ ...f, [headerKey(headers)]: mapping }));
                    setStep(3);
                  }}
                  disabled={mapping.date === -1 || mapping.amount === -1}
                >
                  Voorbeeld bekijken
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm" style={{ color: P.muted }}>
                {preview.length === rows.length ? (
                  <span>
                    Alle {rows.length} rijen konden worden gelezen. Categorie wijs je later toe in het
                    transactieoverzicht.
                  </span>
                ) : (
                  <span>
                    {preview.length} van de {rows.length} rijen konden worden gelezen (de rest miste een geldige datum
                    of bedrag in de gekozen kolommen). Categorie wijs je later toe in het transactieoverzicht.
                  </span>
                )}
              </p>
              {mapping.account > -1 ? (
                detectedAccounts.length > 0 && (
                  <p className="text-sm" style={{ color: P.muted }}>
                    Rekening:{" "}
                    {detectedAccounts
                      .map((iban) => `${accountLabel(accounts, iban)} (${formatIban(iban)})`)
                      .join(", ")}
                    {detectedAccounts.some((iban) => !accounts.some((a) => a.iban === iban)) &&
                      " - nieuwe rekeningen worden toegevoegd onder Instellingen, waar je ze een naam kunt geven."}
                  </p>
                )
              ) : (
                accounts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: P.muted }}>
                    Van welke rekening is dit bestand?
                    <div className="w-72">
                      <Select
                        value={accountOptions[accounts.findIndex((a) => a.iban === manualAccount)] || ""}
                        onChange={(label) => setManualAccount(accounts[accountOptions.indexOf(label)]?.iban || "")}
                        options={accountOptions}
                        placeholder="Niet vastleggen"
                      />
                    </div>
                  </div>
                )
              )}
              {duplicates.length > 0 && (
                <div
                  className="flex items-start gap-2 p-3 rounded-md text-sm"
                  style={{ backgroundColor: P.warnBg, color: P.warn }}
                >
                  <CircleAlert size={16} className="mt-0.5 flex-shrink-0" />
                  <span>
                    {fresh.length === 0
                      ? `Alle ${duplicates.length} rijen staan al in je overzicht - er valt niets nieuws te importeren.`
                      : `${duplicates.length} ${duplicates.length === 1 ? "rij staat" : "rijen staan"} al in je overzicht (zelfde datum, omschrijving en bedrag) en ${duplicates.length === 1 ? "wordt" : "worden"} overgeslagen.`}
                  </span>
                </div>
              )}
              {fresh.length > 0 && (
                <div className="rounded-2xl border hb-card overflow-hidden" style={{ borderColor: P.border }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-left" style={{ backgroundColor: P.bg, color: P.muted }}>
                        <th className="p-2.5">Datum</th>
                        <th className="p-2.5">Omschrijving</th>
                        <th className="p-2.5 text-right">Bedrag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fresh.slice(0, 8).map((t) => (
                        <tr key={t.id} className="border-t" style={{ borderColor: P.border }}>
                          <td className="p-2.5 whitespace-nowrap" style={{ color: P.muted }}>
                            {formatDate(t.date)}
                          </td>
                          <td className="p-2.5 truncate max-w-[280px]" style={{ color: P.text }}>
                            {t.description}
                          </td>
                          <td className="p-2.5 text-right">
                            <Amount value={t.amount} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {fresh.length > 8 && (
                    <div className="px-3 py-2 text-xs border-t" style={{ borderColor: P.border, color: P.muted }}>
                      + nog {fresh.length - 8} andere rijen
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(2)}>
                  Terug
                </Button>
                <Button variant="primary" icon={Check} onClick={doImport} disabled={fresh.length === 0}>
                  {fresh.length} {fresh.length === 1 ? "transactie" : "transacties"} importeren
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
