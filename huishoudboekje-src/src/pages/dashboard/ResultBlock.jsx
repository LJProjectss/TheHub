import { useState } from "react";
import { PiggyBank, Wallet } from "lucide-react";
import { P } from "../../theme";
import { formatDate } from "../../lib/format";
import { todayIso } from "../../lib/overview";
import { Money } from "../../components/ui";
import { card } from "./parts";

// Terugblik (afgesloten periode) of wat er nog over is (lopende maand), met verwachting.
export default function ResultBlock({ cur, prev, prevLabel, running, expected, expectedSum, forecast, range }) {
  const [showExpected, setShowExpected] = useState(false);
  if (running) {
    const free = Math.round((cur.balance - expectedSum) * 100) / 100;
    // Lopende maand: resterende dagen inclusief vandaag.
    const daysLeft = Math.max(1, Number(range.to.slice(8)) - Number(todayIso().slice(8)) + 1);
    return (
      <div className="rounded-2xl border hb-card p-5" style={card()}>
        <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: P.muted }}>
          <Wallet size={13} /> Nog vrij te besteden deze maand
        </div>
        <div className="text-3xl font-bold tabular-nums" style={{ color: free >= 0 ? P.income : P.expense }}>
          <Money value={free} />
        </div>
        <div className="text-sm mt-1" style={{ color: P.muted }}>
          {free > 0 ? (
            <>
              Ongeveer <Money value={Math.round((free / daysLeft) * 100) / 100} /> per dag voor de resterende {daysLeft}{" "}
              {daysLeft === 1 ? "dag" : "dagen"}.
            </>
          ) : (
            "Je geeft deze maand meer uit dan er binnenkomt."
          )}
        </div>
        <div className="text-xs mt-3" style={{ color: P.muted }}>
          Inkomsten tot nu <Money value={cur.income} /> − uitgaven tot nu <Money value={cur.expenses} />
          {expectedSum > 0 && (
            <>
              {" "}
              − nog verwacht <Money value={expectedSum} />{" "}
              <button onClick={() => setShowExpected((v) => !v)} className="underline" style={{ color: P.blue }}>
                ({expected.length} {showExpected ? "verbergen" : "tonen"})
              </button>
            </>
          )}
          . Inkomsten die nog moeten komen (zoals salaris) tellen pas mee als ze binnen zijn.
        </div>
        {showExpected && (
          <div className="mt-2 text-xs space-y-0.5" style={{ color: P.text }}>
            {expected.map((e) => (
              <div key={e.name + e.date} className="flex justify-between gap-3 max-w-md">
                <span>
                  {e.name}{" "}
                  <span style={{ color: e.late ? P.warn : P.muted }}>
                    {e.late ? `verwacht sinds ${formatDate(e.date)}` : `rond ${formatDate(e.date)}`}
                  </span>
                </span>
                <Money value={e.amount} />
              </div>
            ))}
          </div>
        )}
        {forecast && (
          <div className="mt-4 pt-3 border-t" style={{ borderColor: P.border }}>
            <div className="text-sm" style={{ color: P.text }}>
              Verwachting eind {range.label.split(" ")[0]}: ongeveer{" "}
              <span className="font-semibold" style={{ color: forecast.balance >= 0 ? P.income : P.expense }}>
                <Money value={Math.abs(forecast.balance)} /> {forecast.balance >= 0 ? "over" : "tekort"}
              </span>
            </div>
            <div className="text-xs mt-1" style={{ color: P.muted }}>
              Schatting: inkomsten <Money value={forecast.income} />
              {forecast.incomeAssumed && " (gemiddelde van de vorige maanden, omdat er nog inkomsten lijken te komen)"} −
              uitgaven <Money value={forecast.expenses} /> (tot nu, plus nog verwachte vaste betalingen, plus de overige
              uitgaven doorgetrokken in het huidige tempo).
            </div>
          </div>
        )}
      </div>
    );
  }
  const kept = cur.balance;
  const rate = cur.income > 0 ? kept / cur.income : null;
  return (
    <div className="rounded-2xl border hb-card p-5" style={card()}>
      <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: P.muted }}>
        <PiggyBank size={13} /> {kept >= 0 ? "Overgehouden" : "Tekort"} in {range.label}
      </div>
      <div className="text-3xl font-bold tabular-nums" style={{ color: kept >= 0 ? P.income : P.expense }}>
        <Money value={Math.abs(kept)} />
      </div>
      <div className="text-sm mt-1" style={{ color: P.muted }}>
        {rate !== null && (
          <>
            {Math.round(Math.abs(rate) * 100)}% van je inkomsten {kept >= 0 ? "overgehouden" : "te veel uitgegeven"}
            .{" "}
          </>
        )}
        {prev.income > 0 || prev.expenses > 0 ? (
          <>
            In {prevLabel}: {prev.balance >= 0 ? "overgehouden" : "tekort"} <Money value={Math.abs(prev.balance)} />.
          </>
        ) : null}
      </div>
    </div>
  );
}
