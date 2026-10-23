import { P } from "../../theme";
import { Money } from "../../components/ui";
import { COLOR_A, DiffCell, DiffText, MobileRow, card } from "./parts";

// Samenvatting: één zin over het verschil in uitgaven en een tabel met de hoofdcijfers.
// rows: { label, a, b, goodWhenUp, strong?, sub?, percent? }; drivers = grootste oorzaken.
export default function SummaryBlock({ rows, expenseDiff, drivers, labelA, labelB, perMonthShown }) {
  return (
    <div className="rounded-2xl border hb-card p-5" style={card()}>
      {Math.abs(expenseDiff) >= 0.005 && (
        <p className="text-sm mb-4" style={{ color: P.text }}>
          In <strong>{labelA}</strong> gaf je <Money value={Math.abs(expenseDiff)} />{" "}
          <strong style={{ color: expenseDiff > 0 ? P.expense : P.income }}>{expenseDiff > 0 ? "meer" : "minder"}</strong>{" "}
          uit dan in {labelB}
          {perMonthShown ? " (gemiddeld per maand)" : ""}
          {drivers.length > 0 && (
            <>
              , vooral door{" "}
              {drivers.map((d, i) => (
                <span key={d.naam}>
                  {i > 0 && " en "}
                  {d.naam} ({d.diff > 0 ? "+" : "-"}
                  <Money value={Math.abs(d.diff)} />)
                </span>
              ))}
            </>
          )}
          .
        </p>
      )}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full min-w-[520px]">
          <thead>
            <tr className="text-left text-xs" style={{ color: P.muted }}>
              <th className="py-2 pr-3 font-medium" />
              <th className="py-2 px-3 font-medium text-right" style={{ color: COLOR_A() }}>
                A · {labelA}
              </th>
              <th className="py-2 px-3 font-medium text-right">B · {labelB}</th>
              <th className="py-2 px-3 font-medium text-right">Verschil</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} style={{ borderTop: `1px solid ${P.border}` }}>
                <td
                  className={`py-2 pr-3 text-sm ${r.sub ? "pl-4" : ""} ${r.strong ? "font-semibold" : ""}`}
                  style={{ color: r.sub ? P.muted : P.text }}
                >
                  {r.label}
                </td>
                <td className="py-2 px-3 text-right text-sm tabular-nums" style={{ color: P.text }}>
                  {r.percent ? `${Math.round(r.a * 100)}%` : <Money value={r.a} />}
                </td>
                <td className="py-2 px-3 text-right text-sm tabular-nums" style={{ color: P.text }}>
                  {r.percent ? `${Math.round(r.b * 100)}%` : <Money value={r.b} />}
                </td>
                <DiffCell a={r.a} b={r.b} goodWhenUp={r.goodWhenUp} percentPoints={r.percent} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sm:hidden -mx-5">
        <p className="text-xs px-4 pb-1" style={{ color: P.muted }}>
          <span style={{ color: COLOR_A() }}>A = {labelA}</span> · B = {labelB}
        </p>
        {rows.map((r) => (
          <div key={r.label} style={{ borderTop: `1px solid ${P.border}` }}>
            <MobileRow
              label={r.label}
              strong={r.strong}
              sub={r.sub}
              a={r.percent ? `${Math.round(r.a * 100)}%` : <Money value={r.a} />}
              b={r.percent ? `${Math.round(r.b * 100)}%` : <Money value={r.b} />}
            >
              <DiffText a={r.a} b={r.b} goodWhenUp={r.goodWhenUp} percentPoints={r.percent} />
            </MobileRow>
          </div>
        ))}
      </div>
    </div>
  );
}
