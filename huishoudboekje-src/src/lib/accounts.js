// Eigen rekeningen: [{ iban, name, kind: "betaal" | "spaar" }]. Transacties kunnen een
// `account` (eigen rekening) en `counter` (tegenrekening) hebben, beide als genormaliseerd IBAN.
import { sortNl } from "./format";

export const TRANSFER_CATEGORY = "Eigen rekeningen";

// De categorie voor overboekingen bestaat en telt niet mee als inkomsten of uitgaven.
export function ensureTransferCategory(data) {
  data.setCategories((list) => (list.includes(TRANSFER_CATEGORY) ? list : sortNl([...list, TRANSFER_CATEGORY])));
  data.setExcludedCategories((list) => (list.includes(TRANSFER_CATEGORY) ? list : [...list, TRANSFER_CATEGORY]));
}

// "nl91 abna 0417 1643 00" -> "NL91ABNA0417164300"; geen rekeningnummer -> "".
export function normalizeIban(value) {
  const s = String(value || "")
    .replace(/[\s.-]/g, "")
    .toUpperCase();
  return /^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(s) || /^\d{7,10}$/.test(s) ? s : "";
}

// "NL91ABNA0417164300" -> "NL91 ABNA 0417 1643 00"
export const formatIban = (iban) => String(iban || "").replace(/(.{4})(?=.)/g, "$1 ");

export function accountLabel(accounts, iban) {
  if (!iban) return "";
  const a = (accounts || []).find((x) => x.iban === iban);
  return a?.name || `…${iban.slice(-4)}`;
}

// Nieuwe eigen rekeningen uit geïmporteerde rijen toevoegen (met een voorlopige naam).
export function addAccountsFrom(accounts, rows, bankName) {
  const known = new Set(accounts.map((a) => a.iban));
  const added = [];
  for (const t of rows) {
    if (!t.account || known.has(t.account)) continue;
    known.add(t.account);
    added.push({ iban: t.account, name: `${bankName ? `${bankName} ` : ""}…${t.account.slice(-4)}`, kind: "betaal" });
  }
  return added.length > 0 ? [...accounts, ...added] : accounts;
}

// Overboekingen tussen eigen betaalrekeningen: de tegenrekening is een eigen rekening die niet
// als spaarrekening is gemarkeerd. Alleen lege categorieën worden ingevuld (nooit overschreven),
// zodat bijvoorbeeld "Sparen" blijft staan.
export function markTransfers(transactions, accounts, tag = true) {
  const own = new Set(accounts.filter((a) => a.kind !== "spaar").map((a) => a.iban));
  let count = 0;
  const list = transactions.map((t) => {
    if (t.category || t.expected || !t.counter || !own.has(t.counter) || t.counter === t.account) return t;
    count++;
    return { ...t, category: TRANSFER_CATEGORY, autoCategorized: tag };
  });
  return { list, count };
}
