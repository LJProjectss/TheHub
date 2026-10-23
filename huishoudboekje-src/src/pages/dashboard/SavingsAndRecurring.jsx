import { List, PiggyBank } from "lucide-react";
import { P } from "../../theme";
import { Money } from "../../components/ui";
import { card } from "./parts";

// Sparen (met doelen) en abonnementen/vaste lasten in één oogopslag.
export default function SavingsAndRecurring({
  saved,
  savedBefore,
  prevLabel,
  income,
  goals,
  hasSavings,
  subs,
  fixed,
  navigate,
  rangeLabel,
}) {
  const rate = income > 0 ? saved / income : null;
  const perMonth = (list) => Math.round(list.reduce((s, i) => s + i.perMonth, 0) * 100) / 100;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="rounded-2xl border hb-card p-5" style={card()}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: P.muted }}>
            <PiggyBank size={13} /> Gespaard · {rangeLabel}
          </div>
          <button
            onClick={() => navigate("savings")}
            className="text-xs font-semibold underline"
            style={{ color: P.blue }}
          >
            Spaardoelen
          </button>
        </div>
        {hasSavings ? (
          <>
            <div className="text-2xl font-bold tabular-nums" style={{ color: saved >= 0 ? P.income : P.expense }}>
              <Money value={saved} />
            </div>
            <div className="text-xs mt-1" style={{ color: P.muted }}>
              {rate !== null && <>Spaarquote {Math.round(rate * 100)}% van je inkomsten. </>}
              {Math.abs(savedBefore) > 0.005 && (
                <>
                  In {prevLabel}: <Money value={savedBefore} />.
                </>
              )}
            </div>
            {goals.length > 0 && (
              <div className="space-y-2 mt-4">
                {goals.slice(0, 4).map((g) => {
                  const pct = g.target > 0 ? Math.min(1, (g.allocated || 0) / g.target) : 0;
                  return (
                    <div key={g.id}>
                      <div className="flex justify-between text-xs mb-0.5" style={{ color: P.text }}>
                        <span className="truncate">{g.name}</span>
                        <span style={{ color: P.muted }}>{Math.round(pct * 100)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ backgroundColor: P.bg }}>
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${pct * 100}%`, backgroundColor: pct >= 1 ? P.income : P.blue }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm" style={{ color: P.muted }}>
            Kies bij Spaardoelen welke categorie je spaarrekening is, dan zie je hier hoeveel je spaart.
          </p>
        )}
      </div>
      <div className="rounded-2xl border hb-card p-5" style={card()}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: P.muted }}>
            <List size={13} /> Terugkerende kosten per maand
          </div>
          <button
            onClick={() => navigate("subscriptions")}
            className="text-xs font-semibold underline"
            style={{ color: P.blue }}
          >
            Abonnementen
          </button>
        </div>
        <div className="space-y-3">
          {[
            { label: "Abonnementen", list: subs },
            { label: "Vaste lasten", list: fixed },
          ].map(({ label, list }) => (
            <div key={label}>
              <div className="text-xs" style={{ color: P.muted }}>
                {label} ({list.length})
              </div>
              <div className="text-xl font-bold tabular-nums" style={{ color: P.heading }}>
                <Money value={perMonth(list)} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
