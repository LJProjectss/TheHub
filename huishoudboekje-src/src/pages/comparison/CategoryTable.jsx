import { ChevronDown, ChevronRight } from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { P } from "../../theme";
import { Money } from "../../components/ui";
import { COLOR_A, DiffCell, DiffText, MobileRow, card } from "./parts";

// Per categorie: A, B en verschil; klik op een categorie voor het verloop per maand en
// snelkoppelingen naar de transacties van beide perioden.
export default function CategoryTable({
  rows,
  hideSmall,
  setHideSmall,
  openCategory,
  toggleCategory,
  categoryMonths,
  tooltip,
  labelA,
  labelB,
  onShowA,
  onShowB,
}) {
  // Naam (met pijltje en label) en de uitgeklapte details van een categorie; gedeeld door
  // de tabel (computer) en de kaartjes (mobiel).
  const categoryName = (r, open) => (
    <span className="inline-flex items-center gap-1">
      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      {r.naam}
      {r.status && (
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full ml-1"
          style={{
            backgroundColor: r.status === "nieuw" ? P.warnBg : P.successBg,
            color: r.status === "nieuw" ? P.warn : P.income,
          }}
        >
          {r.status}
        </span>
      )}
    </span>
  );
  const categoryDetail = (r) => (
    <>
      <div className="text-xs mb-2" style={{ color: P.muted }}>
        {r.naam} per maand (blauw = periode A, lichtblauw = periode B)
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={categoryMonths}>
          <XAxis dataKey="x" tick={{ fontSize: 10, fill: P.muted }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: P.muted }} axisLine={false} tickLine={false} width={44} />
          <Tooltip {...tooltip} />
          <Bar dataKey="bedrag" name={r.naam} radius={[3, 3, 0, 0]}>
            {categoryMonths.map((m) => (
              <Cell key={m.x} fill={m.in === "A" ? P.blue : m.in === "B" ? P.blueLight : P.border} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        <button
          onClick={() => onShowA(r.naam)}
          className="text-xs font-semibold underline text-left"
          style={{ color: P.blue }}
        >
          Transacties in {labelA}
        </button>
        <button
          onClick={() => onShowB(r.naam)}
          className="text-xs font-semibold underline text-left"
          style={{ color: P.blue }}
        >
          Transacties in {labelB}
        </button>
      </div>
    </>
  );

  return (
    <div className="rounded-2xl border hb-card overflow-hidden" style={card()}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-2">
        <h2 className="text-sm font-semibold" style={{ color: P.heading }}>
          Per categorie
        </h2>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: P.muted }}>
          <input type="checkbox" checked={hideSmall} onChange={(e) => setHideSmall(e.target.checked)} />
          Verschillen onder € 10 verbergen
        </label>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 pb-4 text-sm" style={{ color: P.muted }}>
          Geen (grote) verschillen per categorie.
        </p>
      ) : (
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="text-left text-xs" style={{ color: P.muted, borderTop: `1px solid ${P.border}` }}>
                <th className="py-2 px-5 font-medium">Categorie</th>
                <th className="py-2 px-3 font-medium text-right" style={{ color: COLOR_A() }}>
                  A
                </th>
                <th className="py-2 px-3 font-medium text-right">B</th>
                <th className="py-2 px-3 font-medium text-right">Verschil</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const open = openCategory === r.naam;
                return [
                  <tr
                    key={r.naam}
                    onClick={() => toggleCategory(r.naam)}
                    className="cursor-pointer hover:bg-black/5"
                    style={{ borderTop: `1px solid ${P.border}` }}
                  >
                    <td className="py-2 px-5 text-sm" style={{ color: P.text }}>
                      {categoryName(r, open)}
                    </td>
                    <td className="py-2 px-3 text-right text-sm tabular-nums" style={{ color: P.text }}>
                      <Money value={r.a} />
                    </td>
                    <td className="py-2 px-3 text-right text-sm tabular-nums" style={{ color: P.text }}>
                      <Money value={r.b} />
                    </td>
                    <DiffCell a={r.a} b={r.b} goodWhenUp={false} />
                  </tr>,
                  open && (
                    <tr key={`${r.naam}-detail`} style={{ backgroundColor: P.bg }}>
                      <td colSpan={4} className="px-5 py-3">
                        {categoryDetail(r)}
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 0 && (
        <div className="sm:hidden">
          {rows.map((r) => {
            const open = openCategory === r.naam;
            return (
              <div key={r.naam} style={{ borderTop: `1px solid ${P.border}` }}>
                <MobileRow
                  label={categoryName(r, open)}
                  a={<Money value={r.a} />}
                  b={<Money value={r.b} />}
                  onClick={() => toggleCategory(r.naam)}
                >
                  <DiffText a={r.a} b={r.b} goodWhenUp={false} />
                </MobileRow>
                {open && (
                  <div className="px-4 pb-3" style={{ backgroundColor: P.bg }}>
                    <div className="pt-3">{categoryDetail(r)}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
