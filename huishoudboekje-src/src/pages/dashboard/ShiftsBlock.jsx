import { P } from "../../theme";
import { Money } from "../../components/ui";
import { Card, CategoryLink } from "./parts";

// Opvallende verschuivingen per categorie t.o.v. eerdere maanden of de vergelijkingsperiode.
export default function ShiftsBlock({ shifts, periodKind, prevLabel, onCategory }) {
  return (
    <Card>
      <div className="space-y-2">
        {shifts.shifts.map((s) => (
          <div key={s.naam} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-sm">
            <span style={{ color: P.text }}>
              <CategoryLink naam={s.naam} onClick={onCategory} />{" "}
              {s.pct === null ? (
                <span style={{ color: P.muted }}>
                  {periodKind === "month" ? "niets in de 6 maanden ervoor" : `niets in ${prevLabel}`}
                </span>
              ) : (
                <span style={{ color: s.diff > 0 ? P.expense : P.income }}>
                  {s.diff > 0 ? "▲" : "▼"} {Math.round(Math.abs(s.pct) * 100)}% {s.diff > 0 ? "hoger" : "lager"}
                </span>
              )}
            </span>
            <span className="tabular-nums text-xs" style={{ color: P.muted }}>
              <Money value={s.now} />
              {s.pct !== null && (
                <>
                  {" "}
                  · {shifts.baselineLabel}: <Money value={s.before} />
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
