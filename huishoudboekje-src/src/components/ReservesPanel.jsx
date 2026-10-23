import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { P } from "../theme";
import { parseInputAmount } from "../lib/csv";
import { currentMonth, reserveList } from "../lib/reserves";
import { Amount, Button, Money, Select } from "./ui";

// Potjes voor onregelmatige kosten beheren (op de pagina Categorieën).
export default function ReservesPanel({ data }) {
  const { categories, transactions, reserves, setReserves } = data;
  const [category, setCategory] = useState("");
  const [perYear, setPerYear] = useState("");
  const [since, setSince] = useState(currentMonth());
  const [start, setStart] = useState("");
  const [error, setError] = useState("");
  const list = reserveList(transactions, reserves);
  const free = categories.filter((c) => !reserves[c]);

  const add = () => {
    const amount = parseInputAmount(perYear);
    const startAmount = start.trim() === "" ? 0 : parseInputAmount(start);
    if (!category || !amount || amount <= 0 || !/^\d{4}-\d{2}$/.test(since) || startAmount === null) {
      setError("Kies een categorie, een bedrag per jaar en een startmaand.");
      return;
    }
    setReserves((r) => ({ ...r, [category]: { perYear: Math.round(amount * 100) / 100, since, start: startAmount } }));
    setCategory("");
    setPerYear("");
    setStart("");
    setError("");
  };
  const update = (name, changes) => setReserves((r) => ({ ...r, [name]: { ...r[name], ...changes } }));
  const remove = (name) => {
    if (!window.confirm(`Potje voor "${name}" verwijderen? De transacties blijven gewoon staan.`)) return;
    setReserves((r) => {
      const next = { ...r };
      delete next[name];
      return next;
    });
  };
  const totalPerMonth = list.reduce((s, r) => s + r.perMonth, 0);

  const field = { borderColor: P.border };
  return (
    <div className="rounded-2xl border hb-card p-4 mt-6" style={{ borderColor: P.border, backgroundColor: P.surface }}>
      <h2 className="text-sm font-semibold mb-1" style={{ color: P.heading }}>
        Potjes voor onregelmatige kosten
      </h2>
      <p className="text-xs mb-3" style={{ color: P.muted }}>
        Voor kosten die niet elke maand terugkomen, zoals vakantie, een jaarverzekering of onderhoud aan de auto. Je geeft
        aan hoeveel er per jaar ongeveer nodig is; de app rekent uit hoeveel je daarvoor elke maand opzij moet zetten en
        houdt bij hoeveel er in het potje zit (opgebouwd sinds de startmaand, min wat er in die categorie is uitgegeven).
      </p>

      {list.length > 0 && (
        <div className="rounded-lg border overflow-hidden mb-3" style={{ borderColor: P.border }}>
          {list.map((r, i) => (
            <div
              key={r.category}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5"
              style={{ borderTop: i > 0 ? `1px solid ${P.border}` : "none" }}
            >
              <div className="flex-1 min-w-[140px]">
                <div className="text-sm font-medium" style={{ color: P.text }}>
                  {r.category}
                  {!categories.includes(r.category) && (
                    <span className="ml-2 text-xs font-normal" style={{ color: P.expense }}>
                      (categorie bestaat niet meer)
                    </span>
                  )}
                </div>
                <div className="text-xs" style={{ color: P.muted }}>
                  <Money value={r.perMonth} /> per maand opzij · opgebouwd <Money value={r.reserved} /> · uitgegeven{" "}
                  <Money value={r.spent} />
                </div>
              </div>
              <label className="text-xs flex items-center gap-1.5" style={{ color: P.muted }}>
                Per jaar €
                <input
                  type="text"
                  inputMode="decimal"
                  defaultValue={String(r.perYear).replace(".", ",")}
                  onBlur={(e) => {
                    const v = parseInputAmount(e.target.value);
                    if (v && v > 0) update(r.category, { perYear: Math.round(v * 100) / 100 });
                  }}
                  className="hb-money w-20 px-2 py-1 rounded-lg border text-sm text-right tabular-nums"
                  style={field}
                />
              </label>
              <label className="text-xs flex items-center gap-1.5" style={{ color: P.muted }}>
                Sinds
                <input
                  type="month"
                  value={r.since}
                  onChange={(e) => e.target.value && update(r.category, { since: e.target.value })}
                  className="px-2 py-1 rounded-lg border text-sm"
                  style={field}
                />
              </label>
              <div className="w-28 text-right">
                <div className="text-xs" style={{ color: P.muted }}>
                  In het potje
                </div>
                <Amount value={r.balance} />
              </div>
              <button
                onClick={() => remove(r.category)}
                className="p-1.5 rounded hover:bg-black/5"
                style={{ color: P.muted }}
                aria-label={`Potje ${r.category} verwijderen`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div className="px-3 py-2 text-xs border-t" style={{ borderColor: P.border, color: P.muted, backgroundColor: P.bg }}>
            Samen <Money value={Math.round(totalPerMonth * 100) / 100} /> per maand opzij zetten.
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-end">
        <div className="w-52">
          <Select value={category} onChange={setCategory} options={free} placeholder="Kies categorie..." />
        </div>
        <input
          type="text"
          inputMode="decimal"
          placeholder="Bedrag per jaar"
          value={perYear}
          onChange={(e) => setPerYear(e.target.value)}
          className="w-36 px-3 py-2 rounded-lg border text-sm tabular-nums"
          style={field}
        />
        <label className="text-xs flex flex-col gap-1" style={{ color: P.muted }}>
          Startmaand
          <input
            type="month"
            value={since}
            onChange={(e) => setSince(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border text-sm"
            style={field}
          />
        </label>
        <input
          type="text"
          inputMode="decimal"
          placeholder="Al in het potje (optioneel)"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="w-48 px-3 py-2 rounded-lg border text-sm tabular-nums"
          style={field}
        />
        <Button variant="primary" icon={Plus} onClick={add}>
          Potje toevoegen
        </Button>
      </div>
      {error && (
        <p className="text-xs mt-2" style={{ color: P.expense }}>
          {error}
        </p>
      )}
    </div>
  );
}
