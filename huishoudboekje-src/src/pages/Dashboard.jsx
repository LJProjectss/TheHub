// Overzicht: de cijfers van de gekozen periode. Dit bestand rekent de periode uit en zet de
// blokken op volgorde; de blokken zelf staan in pages/dashboard/, het rekenwerk in lib/overview.js.
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { FileText, List, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { P } from "../theme";
import {
  budgetRows,
  categoryShifts,
  categoryTrend,
  comparisonRange,
  defaultPeriod,
  elapsedFraction,
  expenseCategories,
  forecastMonth,
  overviewSeries,
  periodRange,
  savedIn,
  spendingCategories,
  stillExpected,
  summarize,
} from "../lib/overview";
import { detectRecurring, ignoredPatterns, recurringOptions, savingsCategoriesOf } from "../lib/subscriptions";
import { groupCategoryTotals } from "../lib/categories";
import { reserveList } from "../lib/reserves";
import { Button, EmptyState, Money, Select } from "../components/ui";
import PeriodPicker from "../components/PeriodPicker";
import { Card, Delta, GroupToggle, Section, StatRow, useCollapsed } from "./dashboard/parts";
import ResultBlock from "./dashboard/ResultBlock";
import AttentionBlock, { useAttentionItems } from "./dashboard/Attention";
import SavingsAndRecurring from "./dashboard/SavingsAndRecurring";
import BudgetBlock from "./dashboard/BudgetBlock";
import ReservesBlock from "./dashboard/ReservesBlock";
import ShiftsBlock from "./dashboard/ShiftsBlock";
import CategoryShare from "./dashboard/CategoryShare";
import LargestExpenses from "./dashboard/LargestExpenses";

// Grafieken laden apart, zodat de cijfers bovenaan meteen zichtbaar zijn.
const IncomeExpenseChart = lazy(() =>
  import("../components/DashboardCharts").then((m) => ({ default: m.IncomeExpenseChart })),
);
const TrendChart = lazy(() => import("../components/DashboardCharts").then((m) => ({ default: m.TrendChart })));
const ChartPlaceholder = ({ height }) => <div style={{ height }} aria-hidden="true" />;

export default function Dashboard({ data, navigate }) {
  const { transactions, budgets, fixedCategories, excludedCategories, dismissedSubscriptions } = data;
  const [period, setPeriod] = useState(() => defaultPeriod(transactions));
  const range = periodRange(period);
  const prevRange = comparisonRange(period);
  const expenseCats = useMemo(() => expenseCategories(transactions), [transactions]);
  const opts = { excludedCategories, fixedCategories, expenseCats };
  const cur = useMemo(
    () => summarize(transactions, range, opts),
    [transactions, range.from, range.to, excludedCategories, fixedCategories, expenseCats],
  );
  const prev = useMemo(
    () => summarize(transactions, prevRange, opts),
    [transactions, prevRange.from, prevRange.to, excludedCategories, fixedCategories, expenseCats],
  );
  const recurring = useMemo(() => {
    const ignored = ignoredPatterns(dismissedSubscriptions);
    return detectRecurring(transactions, recurringOptions(data)).items.filter((i) => !ignored.has(i.pattern));
  }, [
    transactions,
    dismissedSubscriptions,
    fixedCategories,
    excludedCategories,
    data.savingsCategory,
    data.savingsGoals,
    data.savingsSettings,
  ]);
  const fraction = elapsedFraction(range);
  const running = period.kind === "month" && fraction > 0 && fraction < 1;
  const expected = running ? stillExpected(recurring, range) : [];
  const expectedSum = Math.round(expected.reduce((s, e) => s + e.amount, 0) * 100) / 100;
  const budget = budgetRows(budgets, cur, range);
  const forecast = useMemo(
    () => forecastMonth(transactions, { period, cur, expectedSum, fraction, running }, opts),
    [running, fraction, cur, expectedSum, transactions, period.year, period.month],
  );

  // Uitgaven per groep (categorieën zonder groep staan er los in).
  const groups = data.categoryGroups || {};
  const hasGroups = Object.values(groups).some(Boolean);
  const [byGroup, setByGroup] = useState(false);
  const shownCategories = useMemo(
    () =>
      byGroup && hasGroups
        ? groupCategoryTotals(cur.categories, groups)
        : cur.categories.map((c) => ({ ...c, filter: c.naam })),
    [cur, byGroup, hasGroups, groups],
  );

  const reserveRows = useMemo(() => reserveList(transactions, data.reserves), [transactions, data.reserves]);

  // Sparen en terugkerende kosten.
  const savingsCats = savingsCategoriesOf(data);
  const saved = savedIn(transactions, range, savingsCats);
  const savedBefore = savedIn(transactions, prevRange, savingsCats);
  const activeGoals = (data.savingsGoals || []).filter((g) => g.status !== "completed" && g.target > 0);
  const activeRecurring = recurring.filter((i) => i.active);

  const attentionItems = useAttentionItems({ data, budget, recurring, range, navigate });

  // Grafiek met opgebouwd saldo en (optioneel) de uitgaven van een jaar eerder.
  const [compareLastYear, setCompareLastYear] = useState(false);
  const series = useMemo(
    () => overviewSeries(transactions, period, range, opts),
    [transactions, range.from, range.to, period.kind, excludedCategories, expenseCats],
  );
  const hasLastYear = series.some((r) => r["Uitgaven jaar eerder"] > 0);

  // Opvallende verschuivingen per categorie.
  const shifts = useMemo(
    () => categoryShifts(transactions, period, range, prevRange, opts),
    [
      transactions,
      range.from,
      range.to,
      prevRange.from,
      prevRange.to,
      excludedCategories,
      fixedCategories,
      expenseCats,
    ],
  );

  const perCategoryTotal = cur.categories.reduce((s, c) => s + c.bedrag, 0);
  const largest = useMemo(
    () =>
      cur.tx
        .filter((t) => t.amount < 0)
        .sort((a, b) => a.amount - b.amount)
        .slice(0, 10),
    [cur],
  );

  // Klik op een categorie = transacties van die categorie in de gekozen periode.
  const openCategory = (naam) => navigate("transactions", { category: naam, dateFrom: range.from, dateTo: range.to });
  // Inklapbare secties (onthouden in deze browser).
  const [collapsed, toggleSection] = useCollapsed();

  // Trend per categorie (over alle maanden en jaren).
  const trendCategories = useMemo(() => spendingCategories(transactions), [transactions]);
  const [trendCategory, setTrendCategory] = useState("");
  useEffect(() => {
    if (
      (!trendCategory && trendCategories.length > 0) ||
      (trendCategory && !trendCategories.includes(trendCategory) && trendCategories.length > 0)
    )
      setTrendCategory(trendCategories[0]);
  }, [trendCategories]);
  const trend = useMemo(() => categoryTrend(transactions, trendCategory), [transactions, trendCategory]);

  if (transactions.length === 0) {
    return (
      <EmptyState
        title="Nog geen transacties"
        text="Importeer een CSV-bestand van je bank of voeg handmatig een transactie toe om te beginnen."
      />
    );
  }

  const prevLabel = prevRange.label;
  const section = (id, title, children, extra) => (
    <Section id={id} title={title} collapsed={collapsed.includes(id)} onToggle={() => toggleSection(id)} extra={extra}>
      {children}
    </Section>
  );
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: P.heading }}>
          Overzicht
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker period={period} setPeriod={setPeriod} range={range} transactions={transactions} />
          {period.kind === "month" && (
            <Button
              variant="secondary"
              icon={FileText}
              onClick={() => navigate("monthreport", { month: { year: period.year, month: period.month } })}
            >
              <span className="hidden sm:inline">Maandrapport</span>
              <span className="sm:hidden">Rapport</span>
            </Button>
          )}
        </div>
      </div>

      <StatRow
        items={[
          {
            label: "Inkomsten",
            value: cur.income,
            icon: TrendingUp,
            color: P.income,
            delta: <Delta now={cur.income} before={prev.income} label={prevLabel} goodWhenUp />,
          },
          {
            label: "Uitgaven",
            value: cur.expenses,
            icon: TrendingDown,
            color: P.expense,
            note:
              cur.refunds > 0 ? (
                <div className="text-xs mt-1" style={{ color: P.muted }}>
                  na <Money value={cur.refunds} /> aan terugbetalingen
                </div>
              ) : null,
            delta: <Delta now={cur.expenses} before={prev.expenses} label={prevLabel} />,
          },
          {
            label: "Saldo",
            value: cur.balance,
            icon: Wallet,
            color: cur.balance >= 0 ? P.income : P.expense,
          },
        ]}
      />

      <ResultBlock
        cur={cur}
        prev={prev}
        prevLabel={prevLabel}
        running={running}
        expected={expected}
        expectedSum={expectedSum}
        forecast={forecast}
        range={range}
      />

      <AttentionBlock items={attentionItems} />

      <SavingsAndRecurring
        saved={saved}
        savedBefore={savedBefore}
        prevLabel={prevLabel}
        income={cur.income}
        goals={activeGoals}
        hasSavings={savingsCats.length > 0}
        subs={activeRecurring.filter((i) => i.kind === "subscription")}
        fixed={activeRecurring.filter((i) => i.kind === "fixed")}
        navigate={navigate}
        rangeLabel={range.label}
      />

      {fixedCategories.length > 0 &&
        section(
          "fixed",
          "Vaste lasten vs. vrij besteedbaar",
          <>
            <StatRow
              items={[
                { label: "Vaste lasten", value: -cur.fixed, icon: List, color: P.heading },
                { label: "Inkomsten", value: cur.income, icon: TrendingUp, color: P.income },
                {
                  label: "Vrij besteedbaar",
                  value: cur.income - cur.fixed,
                  icon: Wallet,
                  color: cur.income - cur.fixed >= 0 ? P.income : P.expense,
                },
              ]}
            />
            <p className="text-xs mt-2" style={{ color: P.muted }}>
              Vaste last = categorieën die je bij Categorieën hebt gemarkeerd. Vrij besteedbaar = inkomsten min vaste
              lasten, voor {range.label}.
            </p>
          </>,
        )}

      {Object.keys(budgets).length > 0 &&
        section(
          "budget",
          `Budget per categorie · ${range.label}`,
          <Card>
            <BudgetBlock budget={budget} periodKind={period.kind} onCategory={openCategory} />
          </Card>,
        )}

      {reserveRows.length > 0 &&
        section("reserves", "Potjes", <ReservesBlock rows={reserveRows} onCategory={openCategory} navigate={navigate} />)}

      {shifts.shifts.length > 0 &&
        section(
          "shifts",
          `Opvallend · ${range.label}`,
          <ShiftsBlock shifts={shifts} periodKind={period.kind} prevLabel={prevLabel} onCategory={openCategory} />,
        )}

      {section(
        "chart",
        "Inkomsten vs. uitgaven per maand",
        <Card>
          <Suspense fallback={<ChartPlaceholder height={260} />}>
            <IncomeExpenseChart series={series} compareLastYear={compareLastYear} />
          </Suspense>
          <p className="text-xs mt-2" style={{ color: P.muted }}>
            De groene lijn telt per maand op wat je overhoudt (inkomsten min uitgaven) over de getoonde maanden; de
            groene bedragen rechts horen bij die lijn.
          </p>
        </Card>,
        hasLastYear && (
          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: P.muted }}>
            <input type="checkbox" checked={compareLastYear} onChange={(e) => setCompareLastYear(e.target.checked)} />
            Vergelijk met een jaar eerder
          </label>
        ),
      )}

      {excludedCategories.length > 0 && (
        <p className="text-xs -mb-2" style={{ color: P.muted }}>
          {excludedCategories.join(", ")} {excludedCategories.length === 1 ? "telt" : "tellen"} nergens op deze pagina
          mee, niet als uitgave en niet als inkomsten (ingesteld bij Categorieën).
        </p>
      )}

      {section(
        "categories",
        `Uitgaven en aandeel per categorie · ${range.label}`,
        <CategoryShare
          rows={shownCategories}
          total={perCategoryTotal}
          empty={cur.categories.length === 0}
          byGroup={byGroup && hasGroups}
          onCategory={openCategory}
        />,
        hasGroups && <GroupToggle byGroup={byGroup} setByGroup={setByGroup} />,
      )}

      {largest.length > 0 &&
        section(
          "largest",
          `Grootste uitgaven · ${range.label}`,
          <LargestExpenses list={largest} onCategory={openCategory} />,
        )}

      {trendCategories.length > 0 &&
        section(
          "trend",
          "Trend per categorie",
          <Card>
            <Suspense fallback={<ChartPlaceholder height={240} />}>
              <TrendChart trend={trend} />
            </Suspense>
            <p className="text-xs mt-2" style={{ color: P.muted }}>
              Toont alle maanden waarin transacties voorkomen, over alle jaren heen - niet beperkt tot de gekozen
              periode.
            </p>
          </Card>,
          <div className="w-48">
            <Select value={trendCategory} onChange={setTrendCategory} options={trendCategories} />
          </div>,
        )}
    </div>
  );
}
