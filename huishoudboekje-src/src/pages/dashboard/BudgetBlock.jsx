import { P } from "../../theme";
import { Money } from "../../components/ui";
import { CategoryLink } from "./parts";

// Budgetten voor de gekozen periode.
export default function BudgetBlock({ budget, periodKind, onCategory }) {
  if (budget.rows.length === 0)
    return (
      <p className="text-sm" style={{ color: P.muted }}>
        Nog geen budget ingesteld. Doe dat bij Categorieën.
      </p>
    );
  const totalPct = budget.total.budget > 0 ? budget.total.besteed / budget.total.budget : 0;
  const colorFor = (pct) => (pct > 1 ? P.expense : pct > 0.8 ? "#C99A3E" : P.income);
  return (
    <>
      <div className="mb-4">
        <div className="flex justify-between items-baseline text-xs mb-1">
          <span className="font-semibold" style={{ color: P.text }}>
            Totaal
          </span>
          <span className="tabular-nums" style={{ color: totalPct > 1 ? P.expense : P.muted }}>
            <Money value={budget.total.besteed} /> van <Money value={budget.total.budget} /> (
            {Math.round(totalPct * 100)}
            %)
          </span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: P.bg }}>
          <div
            className="h-2.5 rounded-full"
            style={{ width: `${Math.min(totalPct, 1) * 100}%`, backgroundColor: colorFor(totalPct) }}
          />
        </div>
      </div>
      <div className="space-y-4">
        {budget.rows.map((row) => {
          const over = row.pct > 1;
          return (
            <div key={row.naam}>
              <div className="flex justify-between items-baseline text-xs mb-1 gap-3">
                <span className="font-medium">
                  {onCategory ? <CategoryLink naam={row.naam} onClick={onCategory} /> : row.naam}
                </span>
                <span className="tabular-nums text-right" style={{ color: over ? P.expense : P.muted }}>
                  <Money value={row.besteed} />{" "}
                  <span style={{ color: P.muted }}>
                    van <Money value={row.budget} />
                  </span>
                  {over && <span className="ml-1.5 font-semibold">over budget</span>}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: P.bg }}>
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${Math.min(row.pct, 1) * 100}%`, backgroundColor: colorFor(row.pct) }}
                />
              </div>
              {budget.running && row.projectedOver > 0.5 && (
                <div className="text-xs mt-1" style={{ color: P.warn }}>
                  Bij dit tempo kom je op <Money value={row.projected} />: <Money value={row.projectedOver} /> over het{" "}
                  {periodKind === "month" ? "maand" : "jaar"}budget.
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs mt-4" style={{ color: P.muted }}>
        {budget.running
          ? `De periode loopt nog: het budget telt alleen het verstreken deel mee (${Math.round(budget.fraction * 100)}%). `
          : ""}
        Terugbetalingen (bv. retouren) zijn al van de uitgaven afgetrokken.
      </p>
    </>
  );
}
