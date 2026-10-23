import { newId, toIsoDate } from "./format";

const sameMonth = (dateStr, year, month) => {
  const d = new Date(dateStr);
  return d.getFullYear() === year && d.getMonth() === month;
};

// "Verwachte" transacties aanmaken voor actieve herhalende regels, voor de afgelopen
// 24 maanden, voor zover de datum gepasseerd is en er die maand nog niets voor de regel staat.
export function addExpectedTransactions(transactions, rules, now = new Date()) {
  const added = [];
  rules
    .filter((rule) => rule.active)
    .forEach((rule) => {
      for (let back = 23; back >= 0; back--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - back, 1);
        const year = monthStart.getFullYear();
        const month = monthStart.getMonth();
        const lastDay = new Date(year, month + 1, 0).getDate();
        const date = new Date(year, month, Math.min(rule.dayOfMonth, lastDay));
        if (date > now) continue;
        const covered = (t) => t.ruleId === rule.id && sameMonth(t.date, year, month);
        if (transactions.some(covered) || added.some(covered)) continue;
        added.push({
          id: newId(),
          date: toIsoDate(date),
          description: rule.keyword,
          category: rule.category,
          amount: rule.type === "uitgave" ? -Math.abs(rule.amount) : Math.abs(rule.amount),
          note: "",
          expected: true,
          ruleId: rule.id,
        });
      }
    });
  return added.length > 0 ? [...added, ...transactions] : transactions;
}

// Geïmporteerde rijen toevoegen. Een rij die past bij een verwachte transactie (zelfde teken,
// exact bedrag, datum binnen 5 dagen, omschrijving bevat de naam) vervangt die in plaats van
// er een dubbele bij te zetten.
export function mergeImportedRows(transactions, rows) {
  const list = [...transactions];
  const fresh = [];
  rows.forEach((row) => {
    const idx = list.findIndex((t) => {
      if (!t.expected) return false;
      const sameSign = t.amount >= 0 === row.amount >= 0;
      const sameAmount = Math.round(Math.abs(t.amount) * 100) === Math.round(Math.abs(row.amount) * 100);
      if (!sameSign || !sameAmount || Math.abs((new Date(row.date) - new Date(t.date)) / 864e5) > 5) return false;
      const name = (t.description || "").trim().toLowerCase();
      return name.length > 0 && (row.description || "").toLowerCase().includes(name);
    });
    if (idx > -1) {
      const keepOwnCategory = !!list[idx].category;
      list[idx] = {
        ...list[idx],
        date: row.date,
        description: row.description,
        amount: row.amount,
        category: keepOwnCategory ? list[idx].category : row.category,
        expected: false,
      };
      if (!keepOwnCategory && row.autoCategorized) list[idx].autoCategorized = row.autoCategorized;
    } else {
      fresh.push(row);
    }
  });
  return [...fresh, ...list];
}

// Een import terugdraaien. before = de lijst vóór de import, after = direct erna.
// Nieuw toegevoegde rijen gaan eruit; bestaande rijen die door de import zijn veranderd (een
// verwachte rij die door de echte betaling is vervangen, een herkende overboeking) krijgen hun
// oude versie terug. Wat u na de import aan andere transacties heeft veranderd, blijft staan.
export function revertImport(current, before, after) {
  const prevById = new Map(before.map((t) => [t.id, t]));
  const added = new Set(after.filter((t) => !prevById.has(t.id)).map((t) => t.id));
  const changed = new Set(after.filter((t) => prevById.has(t.id) && prevById.get(t.id) !== t).map((t) => t.id));
  return current.filter((t) => !added.has(t.id)).map((t) => (changed.has(t.id) ? prevById.get(t.id) : t));
}

// Regelbedrag bijwerken na een bedrag-mismatch: de geïmporteerde rij neemt de maand over
// (verwachte rij van die maand vervalt) en overige verwachte rijen krijgen het nieuwe bedrag.
export function applyRuleAmountFix(transactions, warning) {
  const d = new Date(warning.date);
  return transactions
    .filter((t) => !(t.expected && t.ruleId === warning.ruleId && sameMonth(t.date, d.getFullYear(), d.getMonth())))
    .map((t) =>
      t.id === warning.txId && !t.ruleId
        ? { ...t, ruleId: warning.ruleId }
        : t.expected && t.ruleId === warning.ruleId
          ? { ...t, amount: t.amount < 0 ? -warning.actual : warning.actual }
          : t,
    );
}
