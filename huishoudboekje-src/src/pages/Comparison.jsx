// Vergelijken: twee periodes naast elkaar. Dit bestand bepaalt de periodes en rekent de cijfers
// uit; de onderdelen staan in pages/comparison/, het rekenwerk in lib/comparison.js.
import { useMemo, useState } from "react";
import { P } from "../theme";
import { formatEuro } from "../lib/format";
import { alignRange, expenseCategories, hasDataIn, monthsIn, savedIn, summarize, todayIso } from "../lib/overview";
import {
  buildPresets,
  categoryMonthsComparison,
  compareCategories,
  cumulativeComparison,
  monthByMonthComparison,
  rangeOf,
} from "../lib/comparison";
import { savingsCategoriesOf } from "../lib/subscriptions";
import { EmptyState, tooltipStyle } from "../components/ui";
import PresetPicker from "./comparison/PresetPicker";
import SummaryBlock from "./comparison/SummaryBlock";
import { CumulativeChart, MonthByMonthChart, TopCategoriesChart } from "./comparison/ComparisonCharts";
import CategoryTable from "./comparison/CategoryTable";

const round = (n) => Math.round(n * 100) / 100;

export default function Comparison({ data, navigate }) {
  const { transactions, excludedCategories, fixedCategories } = data;
  const presets = useMemo(() => buildPresets(transactions), [transactions]);
  const available = (p) => hasDataIn(transactions, rangeOf(p.a)) && hasDataIn(transactions, rangeOf(p.b));
  const [presetKey, setPresetKey] = useState(() => {
    const byKey = Object.fromEntries(presets.map((p) => [p.key, p]));
    return available(byKey["month-last-year"]) ? "month-last-year" : "prev-month";
  });
  const preset = presets.find((p) => p.key === presetKey);
  const [customA, setCustomA] = useState(() => presets[0].a);
  const [customB, setCustomB] = useState(() => presets[0].b);
  const [fullPeriod, setFullPeriod] = useState(false);
  const [perMonth, setPerMonth] = useState(false);
  const [hideSmall, setHideSmall] = useState(true);
  const [openCategory, setOpenCategory] = useState(null);

  const periodA = preset ? preset.a : customA;
  const periodB = preset ? preset.b : customB;
  const rangeA = rangeOf(periodA);
  const rawB = rangeOf(periodB);
  const alignment = fullPeriod ? { range: rawB, aligned: false } : alignRange(rangeA, rawB);
  const rangeB = alignment.range;
  const today = todayIso();
  const effectiveA = { ...rangeA, to: rangeA.to > today ? today : rangeA.to };

  const expenseCats = useMemo(() => expenseCategories(transactions), [transactions]);
  const opts = { excludedCategories, fixedCategories, expenseCats };
  const sumA = useMemo(
    () => summarize(transactions, effectiveA, opts),
    [transactions, effectiveA.from, effectiveA.to, opts.excludedCategories, fixedCategories, expenseCats],
  );
  const sumB = useMemo(
    () => summarize(transactions, rangeB, opts),
    [transactions, rangeB.from, rangeB.to, opts.excludedCategories, fixedCategories, expenseCats],
  );
  const savingsCats = savingsCategoriesOf(data);

  // Gemiddeld per maand: alleen zinvol als de perioden verschillend lang zijn.
  const monthsA = monthsIn(effectiveA);
  const monthsB = monthsIn(rangeB);
  const lengthsDiffer = Math.abs(monthsA - monthsB) > 0.05;
  const scaleA = perMonth && lengthsDiffer ? 1 / Math.max(monthsA, 0.01) : 1;
  const scaleB = perMonth && lengthsDiffer ? 1 / Math.max(monthsB, 0.01) : 1;
  const sA = (v) => round(v * scaleA);
  const sB = (v) => round(v * scaleB);

  const rows = [
    { label: "Inkomsten", a: sA(sumA.income), b: sB(sumB.income), goodWhenUp: true },
    { label: "Uitgaven", a: sA(sumA.expenses), b: sB(sumB.expenses), goodWhenUp: false, strong: true },
    { label: "waarvan vaste lasten", a: sA(sumA.fixed), b: sB(sumB.fixed), goodWhenUp: false, sub: true },
    {
      label: "waarvan variabel",
      a: sA(sumA.expenses - sumA.fixed),
      b: sB(sumB.expenses - sumB.fixed),
      goodWhenUp: false,
      sub: true,
    },
    { label: "Overgehouden", a: sA(sumA.balance), b: sB(sumB.balance), goodWhenUp: true, strong: true },
    {
      label: "Spaarquote",
      a: sumA.income > 0 ? sumA.balance / sumA.income : 0,
      b: sumB.income > 0 ? sumB.balance / sumB.income : 0,
      goodWhenUp: true,
      percent: true,
    },
    ...(savingsCats.length
      ? [
          {
            label: "Naar spaarrekening",
            a: sA(savedIn(transactions, effectiveA, savingsCats)),
            b: sB(savedIn(transactions, rangeB, savingsCats)),
            goodWhenUp: true,
          },
        ]
      : []),
  ];

  // Categorieën: verschil, nieuw/verdwenen, kleine verschillen verbergen.
  const categoryRows = useMemo(
    () => compareCategories(sumA.categories, sumB.categories, scaleA, scaleB),
    [sumA, sumB, scaleA, scaleB],
  );
  const shownCategories = categoryRows.filter((r) => !hideSmall || Math.abs(r.diff) >= 10);

  // Samenvattende zin: hoeveel meer/minder uitgegeven en de grootste oorzaken.
  const expenseDiff = rows[1].a - rows[1].b;
  const drivers = categoryRows.filter((r) => (expenseDiff > 0 ? r.diff > 0 : r.diff < 0)).slice(0, 2);

  // Opgeteld verloop - per dag bij korte perioden, anders per maand.
  const byDay = Math.max(monthsIn(rangeA), monthsIn(rawB)) <= 2.05;
  const cumulative = useMemo(
    () => cumulativeComparison(transactions, { rangeA, effectiveA, rawB }, opts, byDay),
    [transactions, effectiveA.from, effectiveA.to, rangeA.to, rawB.from, rawB.to, byDay, expenseCats, opts.excludedCategories],
  );
  const lastA = cumulative.reduce((idx, r, i) => (r.A !== null ? i : idx), -1);
  const cumulativeGap =
    lastA >= 0 && cumulative[lastA].B !== null ? round(cumulative[lastA].A - cumulative[lastA].B) : null;

  // Maand naast maand (alleen bij perioden van meerdere maanden).
  const monthByMonth = useMemo(
    () => (byDay ? [] : monthByMonthComparison(transactions, { rangeA, effectiveA, rawB }, opts)),
    [transactions, rangeA.from, rawB.from, rawB.to, effectiveA.to, byDay, expenseCats],
  );

  // Grootste categorieën naast elkaar.
  const categoryChart = categoryRows
    .slice()
    .sort((x, y) => Math.max(y.a, y.b) - Math.max(x.a, x.b))
    .slice(0, 8)
    .map((r) => ({ naam: r.naam, A: Math.round(r.a), B: Math.round(r.b) }));

  // Verloop per maand van één categorie over beide perioden heen.
  const categoryMonths = useMemo(
    () => (openCategory ? categoryMonthsComparison(transactions, openCategory, { rangeA, rawB }, opts) : []),
    [openCategory, transactions, rangeA.from, rangeA.to, rawB.from, rawB.to, expenseCats],
  );

  if (transactions.length === 0)
    return (
      <EmptyState
        title="Nog geen transacties"
        text="Importeer transacties om periodes met elkaar te kunnen vergelijken."
      />
    );

  const labelA = rangeA.label + (effectiveA.to !== rangeA.to ? " (tot nu)" : "");
  const labelB = rangeB.label + (alignment.aligned ? ` (1e ${alignment.days} dagen)` : "");
  const noDataB = !hasDataIn(transactions, rangeB);
  const tooltip = { formatter: (v) => formatEuro(v), contentStyle: tooltipStyle() };
  const toggleCategory = (naam) => setOpenCategory((cur) => (cur === naam ? null : naam));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: P.heading }}>
          Vergelijken
        </h1>
        <p className="text-sm" style={{ color: P.muted }}>
          Zet twee periodes naast elkaar. Terugbetalingen zijn verrekend en sparen telt niet mee als uitgave of inkomen
          - net als op het Overzicht.
        </p>
      </div>

      <PresetPicker
        presets={presets}
        presetKey={presetKey}
        setPresetKey={setPresetKey}
        available={available}
        customA={customA}
        setCustomA={setCustomA}
        customB={customB}
        setCustomB={setCustomB}
        rangeA={rangeA}
        rawB={rawB}
        transactions={transactions}
      />

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs" style={{ color: P.muted }}>
        {(alignment.aligned || fullPeriod) && (
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={fullPeriod} onChange={(e) => setFullPeriod(e.target.checked)} />
            Hele periode B vergelijken (niet alleen hetzelfde aantal dagen)
          </label>
        )}
        {lengthsDiffer && (
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={perMonth} onChange={(e) => setPerMonth(e.target.checked)} />
            Gemiddeld per maand tonen (periodes zijn verschillend lang)
          </label>
        )}
      </div>

      {noDataB && (
        <p className="text-sm" style={{ color: P.warn }}>
          Er staan nog geen transacties in {rangeB.label}; kies een andere vergelijking.
        </p>
      )}

      <SummaryBlock
        rows={rows}
        expenseDiff={expenseDiff}
        drivers={drivers}
        labelA={labelA}
        labelB={labelB}
        perMonthShown={perMonth && lengthsDiffer}
      />

      <CumulativeChart
        data={cumulative}
        lastA={lastA}
        gap={cumulativeGap}
        byDay={byDay}
        labelA={rangeA.label}
        labelB={rawB.label}
        tooltip={tooltip}
      />

      {monthByMonth.length > 1 && (
        <MonthByMonthChart data={monthByMonth} labelA={rangeA.label} labelB={rawB.label} tooltip={tooltip} />
      )}

      {categoryChart.length > 0 && (
        <TopCategoriesChart data={categoryChart} labelA={labelA} labelB={labelB} tooltip={tooltip} />
      )}

      <CategoryTable
        rows={shownCategories}
        hideSmall={hideSmall}
        setHideSmall={setHideSmall}
        openCategory={openCategory}
        toggleCategory={toggleCategory}
        categoryMonths={categoryMonths}
        tooltip={tooltip}
        labelA={labelA}
        labelB={labelB}
        onShowA={(naam) => navigate("transactions", { category: naam, dateFrom: rangeA.from, dateTo: effectiveA.to })}
        onShowB={(naam) => navigate("transactions", { category: naam, dateFrom: rangeB.from, dateTo: rangeB.to })}
      />

      {excludedCategories.length > 0 && (
        <p className="text-xs" style={{ color: P.muted }}>
          {excludedCategories.join(", ")} {excludedCategories.length === 1 ? "telt" : "tellen"} niet mee (ingesteld bij
          Categorieën).
        </p>
      )}
    </div>
  );
}
