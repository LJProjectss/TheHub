import { CHART_COLORS, P } from "../../theme";
import { Money } from "../../components/ui";
import { Card, CategoryLink } from "./parts";

// Uitgaven en aandeel per categorie (of per groep) met een balkje per regel.
// rows: { naam, bedrag, filter, isGroup?, parts? }; total = som van de uitgaven per categorie.
export default function CategoryShare({ rows, total, empty, byGroup, onCategory }) {
  return (
    <Card>
      {empty ? (
        <p className="text-sm" style={{ color: P.muted }}>
          Geen uitgaven in deze periode.
        </p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((c, i) => (
            <div key={c.filter}>
              <div className="flex justify-between gap-3 text-xs mb-1">
                <span className="min-w-0">
                  <CategoryLink naam={c.naam} onClick={() => onCategory(c.filter)} />
                  {c.isGroup && (
                    <span className="ml-1.5" style={{ color: P.muted }}>
                      ({c.parts.join(", ")})
                    </span>
                  )}
                </span>
                <span className="tabular-nums whitespace-nowrap" style={{ color: P.text }}>
                  <span className="font-medium">
                    <Money value={c.bedrag} />
                  </span>
                  <span className="ml-1.5" style={{ color: P.muted }}>
                    ({total ? Math.round((c.bedrag / total) * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="h-1.5 rounded-full" style={{ backgroundColor: P.bg }}>
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${(c.bedrag / rows[0].bedrag) * 100}%`,
                    backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                  }}
                />
              </div>
            </div>
          ))}
          <p className="text-xs pt-1" style={{ color: P.muted }}>
            Klik op een {byGroup ? "groep of " : ""}categorie om de transacties van deze periode te zien.
          </p>
        </div>
      )}
    </Card>
  );
}
