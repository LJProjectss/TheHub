import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { P } from "../theme";
import { newId } from "../lib/format";
import { Button, Select } from "./ui";

// Eigen regels: "omschrijving bevat ... → categorie". Werken vanaf de eerste keer, bij elke
// CSV-import en via "Automatisch categoriseren"; ze overschrijven nooit een bestaande categorie.
export default function CategoryRulesPanel({ categories, categoryRules, setCategoryRules, transactions }) {
  const [contains, setContains] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");

  const addRule = () => {
    const text = contains.trim();
    if (!text || !category) return;
    if (categoryRules.some((r) => r.contains.trim().toLowerCase() === text.toLowerCase())) {
      setError(`Er is al een regel voor "${text}".`);
      return;
    }
    setCategoryRules((rules) => [...rules, { id: newId(), contains: text, category }]);
    setContains("");
    setCategory("");
    setError("");
  };
  const removeRule = (id) => setCategoryRules((rules) => rules.filter((r) => r.id !== id));

  // Hoeveel ongecategoriseerde transacties een regel nu zou oppakken.
  const openMatches = (rule) => {
    const needle = rule.contains.toLowerCase();
    return transactions.filter((t) => !t.category && (t.description || "").toLowerCase().includes(needle)).length;
  };

  const field = { borderColor: P.border };
  return (
    <div className="rounded-2xl border hb-card p-4 mb-6" style={{ borderColor: P.border, backgroundColor: P.surface }}>
      <h2 className="text-sm font-semibold mb-1" style={{ color: P.heading }}>
        Eigen categorieregels
      </h2>
      <p className="text-xs mb-3" style={{ color: P.muted }}>
        Bijvoorbeeld: omschrijving bevat <em>Tikkie</em> → Uitgaan. Regels werken meteen vanaf de eerste keer, bij elke
        CSV-import en via "Automatisch categoriseren" op de Transacties-pagina. Ze gaan voor de automatisch geleerde
        patronen en overschrijven nooit een categorie die al is ingevuld. Passen er meerdere regels, dan wint de langste
        (meest specifieke) tekst.
      </p>
      {categoryRules.length > 0 && (
        <div className="rounded-lg border overflow-hidden mb-3" style={{ borderColor: P.border }}>
          {categoryRules.map((rule, i) => {
            const open = openMatches(rule);
            return (
              <div
                key={rule.id}
                className="flex items-center gap-3 px-3 py-2"
                style={{ borderTop: i > 0 ? `1px solid ${P.border}` : "none" }}
              >
                <div className="flex-1 min-w-0 text-sm" style={{ color: P.text }}>
                  <span style={{ color: P.muted }}>bevat</span> <strong>{rule.contains}</strong>{" "}
                  <span style={{ color: P.muted }}>→</span> {rule.category}
                  {!categories.includes(rule.category) && (
                    <span className="ml-2 text-xs" style={{ color: P.expense }}>
                      (categorie bestaat niet meer)
                    </span>
                  )}
                  {open > 0 && (
                    <span className="ml-2 text-xs" style={{ color: P.muted }}>
                      · past op {open} ongecategoriseerde transactie{open !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removeRule(rule.id)}
                  className="p-1.5 rounded hover:bg-black/5 flex-shrink-0"
                  style={{ color: P.muted }}
                  aria-label={`Regel "${rule.contains}" verwijderen`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Omschrijving bevat, bv. Tikkie"
          value={contains}
          onChange={(e) => {
            setContains(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && addRule()}
          className="flex-1 min-w-[180px] px-3 py-2 rounded-lg border text-sm"
          style={field}
        />
        <div className="w-52">
          <Select value={category} onChange={setCategory} options={categories} placeholder="Kies categorie..." />
        </div>
        <Button variant="primary" icon={Plus} onClick={addRule} disabled={!contains.trim() || !category}>
          Regel toevoegen
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
