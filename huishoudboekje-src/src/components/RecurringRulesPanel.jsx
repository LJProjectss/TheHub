import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { P } from "../theme";
import { UNCATEGORIZED, newId } from "../lib/format";
import { parseAmount } from "../lib/csv";
import { Button, Select, Money } from "./ui";

export default function RecurringRulesPanel({ categories, recurringRules, setRecurringRules, onClose }) {
  const [keyword, setKeyword] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("1");
  const [type, setType] = useState("uitgave");
  const [category, setCategory] = useState("");

  const addRule = () => {
    const value = parseAmount(amount);
    const dayOfMonth = Math.min(31, Math.max(1, Number(day) || 1));
    if (!keyword.trim() || value === null || value <= 0) return;
    setRecurringRules((rules) => [
      ...rules,
      { id: newId(), keyword: keyword.trim(), amount: Math.abs(value), dayOfMonth, type, category, active: true },
    ]);
    setKeyword("");
    setAmount("");
    setDay("1");
    setCategory("");
  };
  const removeRule = (id) => setRecurringRules((rules) => rules.filter((r) => r.id !== id));
  const toggleRule = (id) =>
    setRecurringRules((rules) => rules.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));

  const field = { borderColor: P.border };
  return (
    <div className="rounded-2xl border hb-card p-4 mb-4" style={{ borderColor: P.border, backgroundColor: P.paleBlue }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: P.heading }}>
          Herhalende transacties
        </h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-black/5" style={{ color: P.muted }}>
          <X size={15} />
        </button>
      </div>
      <p className="text-xs mb-3" style={{ color: P.muted }}>
        Voor vaste posten die niet uit je bankexport komen. De app vult ze automatisch in zodra de datum is gepasseerd
        (als "verwacht", herkenbaar aan de gestippelde rand) - zodra je een CSV importeert met een overeenkomende
        transactie (bedrag exact, datum ongeveer, omschrijving bevat de naam), wordt de verwachte transactie automatisch
        bijgewerkt met de echte gegevens in plaats van dat er een dubbele bijkomt.
      </p>
      {recurringRules.length > 0 && (
        <div
          className="rounded-lg border overflow-hidden mb-4"
          style={{ borderColor: P.border, backgroundColor: P.surface }}
        >
          {recurringRules.map((rule, i) => (
            <div
              key={rule.id}
              className="flex items-center gap-3 px-3 py-2.5"
              style={{ borderTop: i > 0 ? `1px solid ${P.border}` : "none" }}
            >
              <input
                type="checkbox"
                checked={rule.active}
                onChange={() => toggleRule(rule.id)}
                className="rounded flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: rule.active ? P.text : P.muted }}>
                  {rule.keyword}
                </div>
                <div className="text-xs" style={{ color: P.muted }}>
                  {rule.type === "uitgave" ? "Uitgave" : "Inkomst"} · <Money value={rule.amount} /> · dag{" "}
                  {rule.dayOfMonth} v/d maand · {rule.category || UNCATEGORIZED}
                </div>
              </div>
              <button
                onClick={() => removeRule(rule.id)}
                className="p-1.5 rounded hover:bg-black/5 flex-shrink-0"
                style={{ color: P.muted }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="grid sm:grid-cols-6 gap-2.5">
        <input
          type="text"
          placeholder="Naam, bv. Huur"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm sm:col-span-2"
          style={field}
        />
        <input
          type="text"
          inputMode="decimal"
          placeholder="Bedrag"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm tabular-nums"
          style={field}
        />
        <input
          type="number"
          min={1}
          max={31}
          placeholder="Dag"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm"
          style={field}
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="px-2 py-2 rounded-lg border text-sm"
          style={field}
        >
          <option value="uitgave">Uitgave</option>
          <option value="inkomst">Inkomst</option>
        </select>
        <Select value={category} onChange={setCategory} options={categories} placeholder={UNCATEGORIZED} />
      </div>
      <div className="flex justify-end mt-3">
        <Button variant="primary" icon={Plus} onClick={addRule}>
          Regel toevoegen
        </Button>
      </div>
    </div>
  );
}
