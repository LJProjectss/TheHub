// Seintje als een maandbudget voor 80% of meer op is, voor de lopende maand.
// Alleen wat al afgeschreven is telt (verwachte transacties in de toekomst niet).
import { expenseCategories, monthEnd, monthStart, summarize, todayIso } from "./overview";

export const ALERT_FROM = 0.8;

export function budgetAlerts(
  { transactions, budgets = {}, excludedCategories = [], fixedCategories = [] },
  today = todayIso(),
) {
  const active = Object.entries(budgets || {}).filter(([, v]) => Number(v) > 0);
  if (active.length === 0) return [];
  const [y, m] = today.split("-").map(Number);
  const from = monthStart(y, m - 1);
  const end = monthEnd(y, m - 1);
  const summary = summarize(
    transactions.filter((t) => !t.expected),
    { from, to: today < end ? today : end },
    { excludedCategories, fixedCategories, expenseCats: expenseCategories(transactions) },
  );
  const spent = new Map(summary.categories.map((c) => [c.naam, c.bedrag]));
  const daysLeft = Number(end.slice(8)) - Number(today.slice(8));
  return active
    .map(([naam, budget]) => {
      const besteed = spent.get(naam) || 0;
      return { naam, budget: Number(budget), besteed, pct: besteed / Number(budget), month: from.slice(0, 7), daysLeft };
    })
    .filter((r) => r.pct >= ALERT_FROM)
    .sort((a, b) => b.pct - a.pct);
}
