// Bouwstenen van Vergelijken: verschil-cel/-tekst en de mobiele rij met A, B en verschil.
import { P } from "../../theme";
import { Money } from "../../components/ui";

export const card = () => ({ borderColor: P.border, backgroundColor: P.surface });
export const COLOR_A = () => P.blue;
export const COLOR_B = () => P.muted;

// Verschil-cel: goodWhenUp bepaalt of een stijging groen (goed) of rood is.
export function DiffCell(props) {
  return (
    <td className="py-2 px-3 text-right text-sm tabular-nums whitespace-nowrap">
      <DiffText {...props} />
    </td>
  );
}

export function DiffText({ a, b, goodWhenUp, percentPoints }) {
  const diff = a - b;
  if (Math.abs(diff) < (percentPoints ? 0.0005 : 0.005)) return <span style={{ color: P.muted }}>-</span>;
  const good = goodWhenUp ? diff > 0 : diff < 0;
  const color = goodWhenUp === null ? P.text : good ? P.income : P.expense;
  const pct = !percentPoints && Math.abs(b) > 0.005 ? diff / Math.abs(b) : null;
  return (
    <span className="tabular-nums whitespace-nowrap" style={{ color }}>
      {percentPoints ? (
        // Verschil van de getoonde (afgeronde) percentages, zodat 40% vs 46% ook -6 geeft.
        `${diff > 0 ? "+" : ""}${Math.round(a * 100) - Math.round(b * 100)} %-punt`
      ) : (
        <>
          {diff > 0 ? "+" : "-"}
          <Money value={Math.abs(diff)} />
          {pct !== null && (
            <span className="text-xs ml-1">
              ({diff > 0 ? "+" : ""}
              {Math.round(pct * 100)}%)
            </span>
          )}
        </>
      )}
    </span>
  );
}

// Mobiel: één rij als kaartje met A, B en verschil onder elkaar in drie kolommen.
export function MobileRow({ label, a, b, children, onClick, strong, sub }) {
  return (
    <div className="px-4 py-2.5" onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <div
        className={`text-sm mb-1 ${strong ? "font-semibold" : ""} ${sub ? "pl-3" : ""}`}
        style={{ color: sub ? P.muted : P.text }}
      >
        {label}
      </div>
      <div className={`grid grid-cols-3 gap-2 text-xs ${sub ? "pl-3" : ""}`}>
        <div>
          <div style={{ color: P.blue }}>A</div>
          <div className="tabular-nums" style={{ color: P.text }}>
            {a}
          </div>
        </div>
        <div>
          <div style={{ color: P.muted }}>B</div>
          <div className="tabular-nums" style={{ color: P.text }}>
            {b}
          </div>
        </div>
        <div>
          <div style={{ color: P.muted }}>Verschil</div>
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}
