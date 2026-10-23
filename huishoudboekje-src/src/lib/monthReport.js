// Maandrapport: alles wat in één maand gebeurde, met de vorige maand ernaast. Bedoeld om als
// pdf te bewaren of samen door te nemen, zonder de app te hoeven openen.
import { expenseCategories, monthEnd, monthStart, savedIn, summarize } from "./overview";
import { savingsCategoriesOf } from "./subscriptions";

const round = (n) => Math.round(n * 100) / 100;

// Maanden met echte transacties, nieuwste eerst, als { year, month }.
export function reportMonths(transactions) {
  const keys = new Set(transactions.filter((t) => !t.expected && t.date).map((t) => t.date.slice(0, 7)));
  return [...keys]
    .sort()
    .reverse()
    .map((k) => ({ year: Number(k.slice(0, 4)), month: Number(k.slice(5, 7)) - 1 }));
}

export function monthReport(data, year, month) {
  const { transactions, budgets = {}, excludedCategories = [], fixedCategories = [] } = data;
  const real = transactions.filter((t) => !t.expected);
  const opts = { excludedCategories, fixedCategories, expenseCats: expenseCategories(transactions) };
  const range = { from: monthStart(year, month), to: monthEnd(year, month) };
  const prev = new Date(year, month - 1, 1);
  const prevRange = { from: monthStart(prev.getFullYear(), prev.getMonth()), to: monthEnd(prev.getFullYear(), prev.getMonth()) };
  const cur = summarize(real, range, opts);
  const before = summarize(real, prevRange, opts);
  const savingsCats = savingsCategoriesOf(data);

  const prevBy = new Map(before.categories.map((c) => [c.naam, c.bedrag]));
  const names = new Set([...cur.categories.map((c) => c.naam), ...before.categories.map((c) => c.naam)]);
  const curBy = new Map(cur.categories.map((c) => [c.naam, c.bedrag]));
  const categories = [...names]
    .map((naam) => {
      const bedrag = curBy.get(naam) || 0;
      const vorige = prevBy.get(naam) || 0;
      const budget = Number(budgets[naam]) > 0 ? Number(budgets[naam]) : null;
      return { naam, bedrag, vorige, verschil: round(bedrag - vorige), budget, pct: budget ? bedrag / budget : null };
    })
    .filter((c) => c.bedrag > 0 || c.vorige > 0)
    .sort((a, b) => b.bedrag - a.bedrag || b.vorige - a.vorige);

  const budgetRows = categories.filter((c) => c.budget);
  for (const [naam, b] of Object.entries(budgets))
    if (Number(b) > 0 && !budgetRows.some((r) => r.naam === naam))
      budgetRows.push({ naam, bedrag: 0, vorige: prevBy.get(naam) || 0, budget: Number(b), pct: 0 });
  budgetRows.sort((a, b) => b.pct - a.pct);

  const excluded = new Set(excludedCategories);
  const largest = cur.tx
    .filter((t) => t.amount < 0 && !excluded.has(t.category))
    .sort((a, b) => a.amount - b.amount)
    .slice(0, 10);

  return {
    range,
    prevRange,
    totals: {
      income: cur.income,
      expenses: cur.expenses,
      balance: cur.balance,
      saved: savedIn(real, range, savingsCats),
      fixed: cur.fixed,
    },
    previous: {
      income: before.income,
      expenses: before.expenses,
      balance: before.balance,
      saved: savedIn(real, prevRange, savingsCats),
    },
    categories,
    budgetRows,
    budgetTotal: budgetRows.reduce(
      (t, r) => ({ budget: round(t.budget + r.budget), bedrag: round(t.bedrag + r.bedrag) }),
      { budget: 0, bedrag: 0 },
    ),
    largest,
    uncategorized: cur.tx.filter((t) => !t.category).length,
    count: cur.tx.length,
    hasPrevious: before.tx.length > 0,
  };
}
