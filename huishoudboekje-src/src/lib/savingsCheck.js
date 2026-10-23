// Controle: lijkt een categorie die als spaarrekening is ingesteld eigenlijk een gewone
// uitgaven- of inkomstencategorie? Bijvoorbeeld Boodschappen als spaarrekening gekozen:
// dan telt elke boodschap als "gespaard". De app waarschuwt alleen; ze verandert niets zelf.
import { useState } from "react";
import { partyName, pattern } from "./patterns";
import { savingsCategoriesOf } from "./subscriptions";

export { partyName };

const DISMISS_KEY = "huishoudboekje-savings-check-ok";
// Pas bij zoveel uitgaande betalingen aan zoveel verschillende partijen is het verdacht.
const MIN_PAYMENTS = 8;
const MIN_PARTIES = 5;
// Gaat zoveel van de betalingen naar eigen rekeningen, dan is het gewoon sparen.
const OWN_SHARE = 0.8;

const round = (n) => Math.round(n * 100) / 100;

// Geeft per verdachte spaarcategorie { category, usedBy, reasons, signature }.
// reasons: { key: "fixed" } | { key: "inflow", incoming, outgoing } | { key: "parties", count, examples }
export function checkSavingsCategories(data) {
  const { transactions = [], fixedCategories = [], accounts = [], savingsCategory = "", savingsGoals = [] } = data;
  const own = new Set(accounts.map((a) => a.iban));
  const result = [];
  for (const category of savingsCategoriesOf(data)) {
    const txs = transactions.filter((t) => !t.expected && t.category === category);
    if (txs.length === 0) continue;
    const reasons = [];

    if (fixedCategories.includes(category)) reasons.push({ key: "fixed" });

    // Per saldo komt er meer binnen dan er naartoe gaat: dat is een inkomstencategorie,
    // geen spaarrekening (op een spaarrekening zet u per saldo geld).
    const outgoing = round(txs.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0));
    const incoming = round(txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0));
    if (incoming > outgoing + 0.005) reasons.push({ key: "inflow", incoming, outgoing });

    // Veel betalingen aan veel verschillende partijen: winkels, geen overboekingen naar uzelf.
    const payments = txs.filter((t) => t.amount < 0);
    const toOwn = txs.filter((t) => t.counter && own.has(t.counter)).length;
    if (payments.length >= MIN_PAYMENTS && toOwn / txs.length < OWN_SHARE) {
      const parties = new Map();
      for (const t of payments) {
        const name = partyName(t.description) || pattern(t.description);
        const key = name.toLowerCase();
        if (key && !parties.has(key)) parties.set(key, name);
      }
      if (parties.size >= MIN_PARTIES)
        reasons.push({ key: "parties", count: parties.size, payments: payments.length, examples: [...parties.values()].slice(0, 3) });
    }

    if (reasons.length === 0) continue;
    const usedBy = [
      ...(category === savingsCategory ? [{ kind: "default" }] : []),
      ...savingsGoals.filter((g) => g.category === category).map((g) => ({ kind: "goal", id: g.id, name: g.name })),
    ];
    result.push({ category, usedBy, reasons, signature: reasons.map((r) => r.key).join(",") });
  }
  return result;
}

function readDismissed() {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY)) || {};
  } catch {
    return {};
  }
}

// Waarschuwingen minus de categorieën waarvan u heeft gezegd dat het klopt. Komt er later een
// nieuwe reden bij, dan verschijnt de waarschuwing opnieuw.
export function useSavingsCheck(data) {
  const [dismissed, setDismissed] = useState(readDismissed);
  const warnings = checkSavingsCategories(data).filter((w) => dismissed[w.category] !== w.signature);
  const dismiss = (warning) => {
    const next = { ...readDismissed(), [warning.category]: warning.signature };
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {
      // opslag niet beschikbaar
    }
    setDismissed(next);
  };
  return { warnings, dismiss };
}
