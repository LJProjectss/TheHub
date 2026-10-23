import { P } from "../../theme";
import { Amount, Money } from "../../components/ui";
import { Card, CategoryLink } from "./parts";

// Potjes voor onregelmatige kosten: per potje het opgebouwde bedrag t.o.v. het jaarbedrag.
export default function ReservesBlock({ rows, onCategory, navigate }) {
  return (
    <Card>
      <div className="space-y-3">
        {rows.map((r) => {
          const pct = r.perYear > 0 ? Math.max(0, Math.min(1, r.balance / r.perYear)) : 0;
          return (
            <div key={r.category}>
              <div className="flex flex-wrap justify-between gap-x-3 text-xs mb-1">
                <span>
                  <CategoryLink naam={r.category} onClick={onCategory} />
                  <span className="ml-1.5" style={{ color: P.muted }}>
                    <Money value={r.perMonth} /> per maand
                  </span>
                </span>
                <span>
                  <Amount value={r.balance} /> <span style={{ color: P.muted }}>in het potje</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full" style={{ backgroundColor: P.bg }}>
                <div
                  className="h-1.5 rounded-full"
                  style={{ width: `${pct * 100}%`, backgroundColor: r.balance >= 0 ? P.income : P.expense }}
                />
              </div>
            </div>
          );
        })}
        <p className="text-xs pt-1" style={{ color: P.muted }}>
          Opgebouwd sinds de startmaand min wat er in de categorie is uitgegeven. De balk toont het potje ten opzichte
          van het jaarbedrag. Potjes beheer je bij{" "}
          <button onClick={() => navigate("categories")} className="underline" style={{ color: P.blue }}>
            Categorieën
          </button>
          .
        </p>
      </div>
    </Card>
  );
}
