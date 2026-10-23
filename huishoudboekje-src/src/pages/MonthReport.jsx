import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import { P } from "../theme";
import { MONTHS, UNCATEGORIZED, formatDate } from "../lib/format";
import { monthReport, reportMonths } from "../lib/monthReport";
import { Button, EmptyState, Money } from "../components/ui";

const pctText = (p) => `${Math.round(p * 100)}%`;

// Maandrapport: één A4 met de cijfers van een maand naast de vorige maand, budgetten, uitgaven
// per categorie en de grootste uitgaven. "Opslaan als pdf" opent het printvenster van de browser.
export default function MonthReport({ data, navigate, initialMonth }) {
  const months = useMemo(() => reportMonths(data.transactions), [data.transactions]);
  const [index, setIndex] = useState(() => {
    const i = initialMonth
      ? months.findIndex((m) => m.year === initialMonth.year && m.month === initialMonth.month)
      : -1;
    return i >= 0 ? i : 0;
  });
  const current = months[index];
  const report = useMemo(
    () => (current ? monthReport(data, current.year, current.month) : null),
    [data.transactions, data.budgets, data.excludedCategories, data.fixedCategories, current?.year, current?.month],
  );

  // De naam van het pdf-bestand volgt de titel van de pagina.
  const title = current ? `Maandrapport ${current.year}-${String(current.month + 1).padStart(2, "0")}` : "";
  useEffect(() => {
    if (!title) return;
    const before = () => {
      document.documentElement.dataset.prevTitle = document.title;
      document.title = title;
    };
    const after = () => {
      document.title = document.documentElement.dataset.prevTitle || document.title;
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [title]);

  if (!current)
    return <EmptyState title="Nog geen transacties" text="Importeer transacties om een maandrapport te maken." />;

  const monthName = `${MONTHS[current.month].toLowerCase()} ${current.year}`;
  const prev = new Date(current.year, current.month - 1, 1);
  const prevName = MONTHS[prev.getMonth()].toLowerCase();
  const { totals, previous } = report;
  const open = (category) => navigate("transactions", { category, dateFrom: report.range.from, dateTo: report.range.to });

  const card = "rounded-2xl border hb-card hb-report-block";
  const cardStyle = { borderColor: P.border, backgroundColor: P.surface };
  const th = "py-2 px-3 font-medium text-right whitespace-nowrap";
  const td = "py-1.5 px-3 text-right tabular-nums whitespace-nowrap";

  const delta = (now, before, goodWhenLower) => {
    if (!report.hasPrevious) return null;
    const d = Math.round((now - before) * 100) / 100;
    if (Math.abs(d) < 0.5) return <span style={{ color: P.muted }}>gelijk aan {prevName}</span>;
    const good = goodWhenLower ? d < 0 : d > 0;
    return (
      <span style={{ color: good ? P.income : P.expense }}>
        {d > 0 ? "+" : "-"}
        <Money value={Math.abs(d)} /> t.o.v. {prevName}
      </span>
    );
  };

  return (
    <div className="hb-month-report space-y-5 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: P.heading }}>
            Maandrapport {monthName}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: P.muted }}>
            {report.count} transacties · gemaakt op {formatDate(new Date().toISOString().slice(0, 10))}
          </p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <div className="flex items-center rounded-lg border" style={{ borderColor: P.border, backgroundColor: P.surface }}>
            <button
              onClick={() => setIndex((i) => Math.min(i + 1, months.length - 1))}
              disabled={index >= months.length - 1}
              className="p-2 disabled:opacity-30"
              aria-label="Vorige maand"
              style={{ color: P.text }}
            >
              <ChevronLeft size={16} />
            </button>
            <select
              value={index}
              onChange={(e) => setIndex(Number(e.target.value))}
              className="appearance-none bg-transparent text-sm px-1 py-2 focus:outline-none"
              style={{ color: P.text }}
              aria-label="Maand"
            >
              {months.map((m, i) => (
                <option key={`${m.year}-${m.month}`} value={i}>
                  {MONTHS[m.month]} {m.year}
                </option>
              ))}
            </select>
            <button
              onClick={() => setIndex((i) => Math.max(i - 1, 0))}
              disabled={index === 0}
              className="p-2 disabled:opacity-30"
              aria-label="Volgende maand"
              style={{ color: P.text }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <Button icon={FileDown} onClick={() => window.print()}>
            Opslaan als pdf
          </Button>
        </div>
      </div>

      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-2xl border hb-card overflow-hidden hb-report-block"
        style={{ borderColor: P.border, backgroundColor: P.border }}
      >
        {[
          ["Inkomsten", totals.income, previous.income, P.income, false],
          ["Uitgaven", totals.expenses, previous.expenses, P.expense, true],
          ["Saldo", totals.balance, previous.balance, totals.balance >= 0 ? P.income : P.expense, false],
          ["Naar sparen", totals.saved, previous.saved, P.heading, false],
        ].map(([label, value, before, color, lowerIsBetter]) => (
          <div key={label} className="p-4" style={{ backgroundColor: P.surface }}>
            <div className="text-xs mb-1" style={{ color: P.muted }}>
              {label}
            </div>
            <div className="text-lg font-bold tabular-nums" style={{ color }}>
              <Money value={value} />
            </div>
            <div className="text-[11px] mt-0.5">{delta(value, before, lowerIsBetter)}</div>
          </div>
        ))}
      </div>

      {report.budgetRows.length > 0 && (
        <div className={card} style={cardStyle}>
          <h2 className="text-sm font-semibold px-4 pt-3.5 pb-2" style={{ color: P.heading }}>
            Budgetten
          </h2>
          <div className="px-4 pb-3 space-y-2.5">
            {report.budgetRows.map((r) => {
              const over = r.pct > 1;
              const near = r.pct >= 0.8 && !over;
              const color = over ? P.expense : near ? "#C99A3E" : P.income;
              return (
                <div key={r.naam} className="text-sm">
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <span style={{ color: P.text }}>{r.naam}</span>
                    <span className="tabular-nums text-xs" style={{ color: P.muted }}>
                      <Money value={r.bedrag} /> van <Money value={r.budget} />{" "}
                      <span className="font-semibold" style={{ color }}>
                        {pctText(r.pct)}
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: P.border }}>
                    <div
                      className="h-full rounded-full hb-print-color"
                      style={{ width: `${Math.min(r.pct, 1) * 100}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="flex justify-between pt-1 text-xs border-t" style={{ borderColor: P.border, color: P.muted }}>
              <span className="pt-2">Totaal met budget</span>
              <span className="pt-2 tabular-nums">
                <Money value={report.budgetTotal.bedrag} /> van <Money value={report.budgetTotal.budget} />
              </span>
            </div>
          </div>
        </div>
      )}

      <div className={`${card} overflow-hidden hb-print-table`} style={cardStyle}>
        <h2 className="text-sm font-semibold px-4 pt-3.5 pb-2" style={{ color: P.heading }}>
          Uitgaven per categorie
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ backgroundColor: P.bg, color: P.muted }}>
                <th className="py-2 px-3 font-medium text-left">Categorie</th>
                <th className={th}>{MONTHS[current.month]}</th>
                {report.hasPrevious && <th className={th}>{MONTHS[prev.getMonth()]}</th>}
                {report.hasPrevious && <th className={th}>Verschil</th>}
                <th className={`${th} hidden sm:table-cell`}>Aandeel</th>
              </tr>
            </thead>
            <tbody>
              {report.categories.map((c) => (
                <tr key={c.naam} className="border-t" style={{ borderColor: P.border }}>
                  <td className="py-1.5 px-3">
                    <button
                      onClick={() => open(c.naam === UNCATEGORIZED ? "" : c.naam)}
                      className="hover:underline text-left"
                      style={{ color: P.text }}
                    >
                      {c.naam}
                    </button>
                  </td>
                  <td className={`${td} font-semibold`} style={{ color: P.heading }}>
                    {c.bedrag ? <Money value={c.bedrag} /> : "–"}
                  </td>
                  {report.hasPrevious && (
                    <td className={td} style={{ color: P.muted }}>
                      {c.vorige ? <Money value={c.vorige} /> : "–"}
                    </td>
                  )}
                  {report.hasPrevious && (
                    <td
                      className={td}
                      style={{ color: Math.abs(c.verschil) < 0.5 ? P.muted : c.verschil > 0 ? P.expense : P.income }}
                    >
                      {Math.abs(c.verschil) < 0.5 ? (
                        "–"
                      ) : (
                        <>
                          {c.verschil > 0 ? "+" : "-"}
                          <Money value={Math.abs(c.verschil)} />
                        </>
                      )}
                    </td>
                  )}
                  <td className={`${td} hidden sm:table-cell`} style={{ color: P.muted }}>
                    {totals.expenses > 0 && c.bedrag > 0 ? pctText(c.bedrag / totals.expenses) : "–"}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 font-semibold" style={{ borderColor: P.border, backgroundColor: P.bg }}>
                <td className="py-2 px-3" style={{ color: P.heading }}>
                  Totaal
                </td>
                <td className={td} style={{ color: P.expense }}>
                  <Money value={totals.expenses} />
                </td>
                {report.hasPrevious && (
                  <td className={td} style={{ color: P.muted }}>
                    <Money value={previous.expenses} />
                  </td>
                )}
                {report.hasPrevious && (
                  <td className={td} style={{ color: totals.expenses > previous.expenses ? P.expense : P.income }}>
                    {totals.expenses > previous.expenses ? "+" : "-"}
                    <Money value={Math.abs(Math.round((totals.expenses - previous.expenses) * 100) / 100)} />
                  </td>
                )}
                <td className={`${td} hidden sm:table-cell`} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {report.largest.length > 0 && (
        <div className={`${card} overflow-hidden`} style={cardStyle}>
          <h2 className="text-sm font-semibold px-4 pt-3.5 pb-2" style={{ color: P.heading }}>
            Grootste uitgaven
          </h2>
          {report.largest.map((t, i) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 px-4 py-2 text-xs"
              style={{ borderTop: `1px solid ${P.border}` }}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate" style={{ color: P.text }}>
                  {i + 1}. {t.description || "(geen omschrijving)"}
                </span>
                <span style={{ color: P.muted }}>
                  {formatDate(t.date)} · {t.category || "zonder categorie"}
                </span>
              </span>
              <span className="tabular-nums font-semibold" style={{ color: P.expense }}>
                -<Money value={Math.abs(t.amount)} />
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs" style={{ color: P.muted }}>
        Uitgaven zijn na aftrek van terugbetalingen. Verwachte (nog niet afgeschreven) transacties tellen niet mee.
        {data.excludedCategories.length > 0 && ` ${data.excludedCategories.join(", ")} telt niet als uitgave.`}
        {report.uncategorized > 0 && ` Nog ${report.uncategorized} transactie(s) zonder categorie.`}
      </p>
    </div>
  );
}
