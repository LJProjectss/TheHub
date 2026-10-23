import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { P } from "../theme";
import { MONTHS_SHORT, UNCATEGORIZED } from "../lib/format";
import { expenseCategories, monthEnd, monthStart, savedIn, summarize } from "../lib/overview";
import { savingsCategoriesOf } from "../lib/subscriptions";
import { GROUP_PREFIX, groupOf } from "../lib/categories";
import { Amount, Button, EmptyState, Money, Select } from "../components/ui";

const round = (n) => Math.round(n * 100) / 100;
const sum = (list) => round(list.reduce((s, v) => s + v, 0));

// Jaaroverzicht: per maand en per categorie (of groep), plus labels. Bedoeld om te bewaren,
// te printen (of als pdf op te slaan) en bijvoorbeeld voor de belastingaangifte.
export default function YearReport({ data, navigate }) {
  const { transactions, excludedCategories, fixedCategories, categoryGroups } = data;
  const years = useMemo(
    () =>
      [...new Set(transactions.filter((t) => !t.expected).map((t) => Number(String(t.date).slice(0, 4))))]
        .filter(Boolean)
        .sort((a, b) => b - a),
    [transactions],
  );
  const [year, setYear] = useState(() => years[0] || new Date().getFullYear());
  const hasGroups = Object.values(categoryGroups || {}).some(Boolean);
  const [byGroup, setByGroup] = useState(false);
  const expenseCats = useMemo(() => expenseCategories(transactions), [transactions]);

  const report = useMemo(() => {
    const opts = { excludedCategories, fixedCategories, expenseCats };
    const excluded = new Set(excludedCategories);
    const months = Array.from({ length: 12 }, (_, m) =>
      summarize(transactions, { from: monthStart(year, m), to: monthEnd(year, m) }, opts),
    );
    // Uitgaven per categorie of groep per maand (terugbetalingen verrekend, zoals op het Overzicht).
    const expenseRows = new Map();
    months.forEach((s, m) =>
      s.categories.forEach((c) => {
        const g = byGroup && c.naam !== UNCATEGORIZED ? groupOf(categoryGroups, c.naam) : "";
        const key = g || c.naam;
        const row = expenseRows.get(key) || { naam: key, filter: g ? GROUP_PREFIX + g : c.naam, months: Array(12).fill(0) };
        row.months[m] = round(row.months[m] + c.bedrag);
        expenseRows.set(key, row);
      }),
    );
    // Inkomsten per categorie (positieve bedragen buiten de uitgavencategorieën).
    const incomeRows = new Map();
    transactions.forEach((t) => {
      if (t.amount <= 0 || excluded.has(t.category) || (t.category && expenseCats.has(t.category))) return;
      if (!String(t.date).startsWith(`${year}-`)) return;
      const m = Number(t.date.slice(5, 7)) - 1;
      const naam = t.category || UNCATEGORIZED;
      const row = incomeRows.get(naam) || { naam, filter: naam, months: Array(12).fill(0) };
      row.months[m] = round(row.months[m] + t.amount);
      incomeRows.set(naam, row);
    });
    const withTotal = (rows) =>
      [...rows.values()].map((r) => ({ ...r, total: sum(r.months) })).sort((a, b) => b.total - a.total);

    // Labels: netto bedrag in dit jaar.
    const tags = new Map();
    transactions.forEach((t) => {
      if (t.expected || !String(t.date).startsWith(`${year}-`)) return;
      (t.tags || []).forEach((tag) => {
        const row = tags.get(tag) || { tag, count: 0, total: 0 };
        row.count++;
        row.total = round(row.total + t.amount);
        tags.set(tag, row);
      });
    });

    const now = new Date();
    const monthCount = year === now.getFullYear() ? now.getMonth() + 1 : year > now.getFullYear() ? 0 : 12;
    return {
      months,
      expenseRows: withTotal(expenseRows),
      incomeRows: withTotal(incomeRows),
      income: months.map((s) => s.income),
      expenses: months.map((s) => s.expenses),
      balance: months.map((s) => s.balance),
      tags: [...tags.values()].sort((a, b) => a.total - b.total),
      saved: savedIn(transactions, { from: `${year}-01-01`, to: `${year}-12-31` }, savingsCategoriesOf(data)),
      monthCount,
    };
  }, [transactions, year, byGroup, excludedCategories, fixedCategories, expenseCats, categoryGroups]);

  if (years.length === 0)
    return <EmptyState title="Nog geen transacties" text="Importeer transacties om een jaaroverzicht te maken." />;

  const totalIncome = sum(report.income);
  const totalExpenses = sum(report.expenses);
  const open = (filter) =>
    navigate("transactions", { category: filter, dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` });
  const avg = (total) => (report.monthCount > 0 ? round(total / report.monthCount) : 0);

  const cell = "py-1.5 px-2 text-right tabular-nums whitespace-nowrap";
  const head = "py-2 px-2 text-right font-medium whitespace-nowrap";
  const tableRows = (rows, sign) =>
    rows.map((r) => (
      <tr key={r.naam} className="border-t" style={{ borderColor: P.border }}>
        <td className="py-1.5 pl-3 pr-2 whitespace-nowrap sticky left-0" style={{ backgroundColor: P.surface }}>
          <button onClick={() => open(r.filter)} className="hover:underline text-left" style={{ color: P.text }}>
            {r.naam}
          </button>
        </td>
        {r.months.map((v, m) => (
          <td key={m} className={cell} style={{ color: v ? P.text : P.muted }}>
            {v ? <Money value={sign * v} /> : "–"}
          </td>
        ))}
        <td className={`${cell} font-semibold`} style={{ color: P.heading }}>
          <Money value={sign * r.total} />
        </td>
        <td className={cell} style={{ color: P.muted }}>
          <Money value={sign * avg(r.total)} />
        </td>
      </tr>
    ));
  const totalRow = (label, values, color) => (
    <tr className="border-t-2 font-semibold" style={{ borderColor: P.border }}>
      <td className="py-2 pl-3 pr-2 sticky left-0" style={{ backgroundColor: P.bg, color: P.heading }}>
        {label}
      </td>
      {values.map((v, m) => (
        <td key={m} className={cell} style={{ backgroundColor: P.bg, color }}>
          <Money value={v} />
        </td>
      ))}
      <td className={cell} style={{ backgroundColor: P.bg, color }}>
        <Money value={sum(values)} />
      </td>
      <td className={cell} style={{ backgroundColor: P.bg, color: P.muted }}>
        <Money value={avg(sum(values))} />
      </td>
    </tr>
  );
  const sectionHead = (label) => (
    <tr>
      <td
        colSpan={15}
        className="pt-4 pb-1.5 pl-3 text-xs font-semibold uppercase tracking-wide sticky left-0"
        style={{ color: P.muted }}
      >
        {label}
      </td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: P.heading }}>
          Jaaroverzicht {year}
        </h1>
        <div className="flex flex-wrap items-center gap-2 no-print">
          <div className="w-28">
            <Select value={String(year)} onChange={(v) => setYear(Number(v))} options={years.map(String)} />
          </div>
          {hasGroups && (
            <div className="flex rounded-lg border overflow-hidden text-xs" style={{ borderColor: P.border }}>
              {[
                [false, "Per categorie"],
                [true, "Per groep"],
              ].map(([value, label]) => (
                <button
                  key={label}
                  onClick={() => setByGroup(value)}
                  className="px-2.5 py-2"
                  style={{
                    backgroundColor: byGroup === value ? P.paleBlue : P.surface,
                    color: byGroup === value ? P.blue : P.muted,
                  }}
                  aria-pressed={byGroup === value}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
            Printen / pdf
          </Button>
        </div>
      </div>

      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-2xl border hb-card overflow-hidden"
        style={{ borderColor: P.border, backgroundColor: P.border }}
      >
        {[
          ["Inkomsten", totalIncome, P.income],
          ["Uitgaven", totalExpenses, P.expense],
          ["Saldo", round(totalIncome - totalExpenses), totalIncome - totalExpenses >= 0 ? P.income : P.expense],
          ["Naar sparen", report.saved, P.heading],
        ].map(([label, value, color]) => (
          <div key={label} className="p-4" style={{ backgroundColor: P.surface }}>
            <div className="text-xs mb-1" style={{ color: P.muted }}>
              {label}
            </div>
            <div className="text-lg font-bold tabular-nums" style={{ color }}>
              <Money value={value} />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border hb-card overflow-x-auto hb-print-table" style={{ borderColor: P.border, backgroundColor: P.surface }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ backgroundColor: P.bg, color: P.muted }}>
              <th className="py-2 pl-3 pr-2 text-left font-medium sticky left-0" style={{ backgroundColor: P.bg }}>
                {byGroup ? "Groep / categorie" : "Categorie"}
              </th>
              {MONTHS_SHORT.map((m) => (
                <th key={m} className={head}>
                  {m}
                </th>
              ))}
              <th className={head}>Totaal</th>
              <th className={head} title={`Gemiddeld per maand over ${report.monthCount} maand(en)`}>
                Gem./mnd
              </th>
            </tr>
          </thead>
          <tbody>
            {sectionHead("Inkomsten")}
            {tableRows(report.incomeRows, 1)}
            {totalRow("Totaal inkomsten", report.income, P.income)}
            {sectionHead("Uitgaven")}
            {tableRows(report.expenseRows, 1)}
            {totalRow("Totaal uitgaven", report.expenses, P.expense)}
            {totalRow("Saldo", report.balance, P.heading)}
          </tbody>
        </table>
      </div>
      <p className="text-xs -mt-3" style={{ color: P.muted }}>
        Uitgaven zijn na aftrek van terugbetalingen.
        {excludedCategories.length > 0 && ` ${excludedCategories.join(", ")} telt hier niet mee (ingesteld bij Categorieën).`}{" "}
        Klik op een naam om de transacties van dat jaar te zien.
      </p>

      {report.tags.length > 0 && (
        <div className="rounded-2xl border hb-card overflow-hidden" style={{ borderColor: P.border, backgroundColor: P.surface }}>
          <div className="px-4 py-2.5 text-sm font-semibold border-b" style={{ borderColor: P.border, color: P.heading }}>
            Labels in {year}
          </div>
          {report.tags.map((r, i) => (
            <div
              key={r.tag}
              className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
              style={{ borderTop: i > 0 ? `1px solid ${P.border}` : "none" }}
            >
              <span style={{ color: P.text }}>
                #{r.tag}{" "}
                <span className="text-xs" style={{ color: P.muted }}>
                  · {r.count} transactie{r.count !== 1 ? "s" : ""}
                </span>
              </span>
              <Amount value={r.total} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
