import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Users, X } from "lucide-react";
import { P } from "../theme";
import { formatDate, newId } from "../lib/format";
import { clearAutoFlag } from "../lib/patterns";
import { canMakeRule, groupUncategorizedByParty, hasRule } from "../lib/partyGroups";
import { Amount, Button, Select } from "./ui";

const PAGE = 15;

// Categoriseren per partij: alle transacties zonder categorie per tegenpartij, met per groep
// één keuze en desgewenst een eigen regel, zodat de app het de volgende keer zelf doet.
export default function PartyCategorizer({
  transactions,
  categories,
  categoryRules,
  setTransactions,
  setCategoryRules,
  notify,
  onClose,
}) {
  const groups = useMemo(
    () => groupUncategorizedByParty(transactions, { rules: categoryRules, categories }),
    [transactions, categoryRules, categories],
  );
  // Keuzes per groep (sleutel = partij): { category, rule }. Zonder eigen keuze geldt het voorstel.
  const [choices, setChoices] = useState({});
  const [open, setOpen] = useState(null);
  const [skipped, setSkipped] = useState(() => new Set());
  const [limit, setLimit] = useState(PAGE);

  const visible = groups.filter((g) => !skipped.has(g.key));
  const shown = visible.slice(0, limit);
  const totalOpen = groups.reduce((s, g) => s + g.count, 0);
  const ruleAllowed = (g) => canMakeRule(g.name) && !hasRule(categoryRules, g.name);
  const choiceOf = (g) => ({
    category: choices[g.key]?.category ?? g.suggestion,
    rule: choices[g.key]?.rule ?? (g.count >= 2 && ruleAllowed(g)),
  });
  const setChoice = (g, changes) => setChoices((c) => ({ ...c, [g.key]: { ...choiceOf(g), ...changes } }));

  // Categorie toewijzen aan een of meer groepen, met ongedaan maken.
  const assign = (list) => {
    const byId = new Map();
    const newRules = [];
    for (const g of list) {
      const { category, rule } = choiceOf(g);
      if (!category) continue;
      g.items.forEach((t) => byId.set(t.id, category));
      if (rule && ruleAllowed(g) && !newRules.some((r) => r.contains.toLowerCase() === g.name.toLowerCase()))
        newRules.push({ id: newId(), contains: g.name, category });
    }
    if (byId.size === 0) return;
    setTransactions((all) => all.map((t) => (byId.has(t.id) ? { ...clearAutoFlag(t), category: byId.get(t.id) } : t)));
    if (newRules.length > 0) setCategoryRules((rules) => [...rules, ...newRules]);
    const ruleIds = new Set(newRules.map((r) => r.id));
    const what = list.length === 1 ? `"${list[0].name}"` : `${list.length} partijen`;
    notify?.(
      `${byId.size} transactie(s) van ${what} gecategoriseerd${
        newRules.length > 0 ? `, ${newRules.length} regel(s) gemaakt voor de volgende keer` : ""
      }.`,
      {
        label: "Ongedaan maken",
        run: () => {
          setTransactions((all) => all.map((t) => (byId.has(t.id) && t.category === byId.get(t.id) ? { ...t, category: "" } : t)));
          if (ruleIds.size > 0) setCategoryRules((rules) => rules.filter((r) => !ruleIds.has(r.id)));
          return "Categoriseren ongedaan gemaakt.";
        },
      },
    );
  };
  const withChoice = shown.filter((g) => choiceOf(g).category);

  return (
    <div className="rounded-2xl border hb-card mb-4 overflow-hidden" style={{ borderColor: P.border, backgroundColor: P.surface }}>
      <div className="flex items-start gap-3 px-4 py-3 border-b" style={{ borderColor: P.border, backgroundColor: P.paleBlue }}>
        <div className="flex-1 min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: P.heading }}>
            <Users size={15} /> Categoriseren per partij
          </h2>
          <p className="text-xs mt-0.5" style={{ color: P.muted }}>
            {groups.length === 0
              ? "Alle transacties hebben een categorie."
              : `${totalOpen} transactie(s) zonder categorie bij ${groups.length} partij(en). Kies per partij een categorie; met "voortaan automatisch" maakt de app er een regel van, zodat nieuwe transacties van die partij bij het importeren meteen goed staan.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 flex-shrink-0">
          {withChoice.length > 1 && (
            <Button variant="primary" icon={Check} onClick={() => assign(withChoice)}>
              {withChoice.length} keuzes toepassen
            </Button>
          )}
          <button onClick={onClose} className="p-1.5 rounded hover:bg-black/5" style={{ color: P.muted }} aria-label="Sluiten">
            <X size={16} />
          </button>
        </div>
      </div>

      {shown.map((g, i) => {
        const choice = choiceOf(g);
        const expanded = open === g.key;
        return (
          <div key={g.key} style={{ borderTop: i > 0 ? `1px solid ${P.border}` : "none" }}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <button
                onClick={() => setOpen(expanded ? null : g.key)}
                className="flex items-start gap-1.5 flex-1 min-w-[200px] text-left"
                aria-expanded={expanded}
              >
                {expanded ? <ChevronDown size={15} className="mt-0.5 flex-shrink-0" style={{ color: P.muted }} /> : <ChevronRight size={15} className="mt-0.5 flex-shrink-0" style={{ color: P.muted }} />}
                <span className="min-w-0">
                  <span className="block text-sm font-medium break-words" style={{ color: P.text }}>
                    {g.name}
                  </span>
                  <span className="block text-xs" style={{ color: P.muted }}>
                    {g.count} transactie{g.count !== 1 ? "s" : ""} ·{" "}
                    {g.from === g.to ? formatDate(g.from) : `${formatDate(g.from)} t/m ${formatDate(g.to)}`} · totaal{" "}
                    <Amount value={g.total} className="text-xs whitespace-nowrap" />
                  </span>
                </span>
              </button>
              <div className="w-full sm:w-48">
                <Select value={choice.category} onChange={(category) => setChoice(g, { category })} options={categories} placeholder="Kies categorie..." />
                {g.suggestion && choice.category === g.suggestion && (
                  <span className="block text-[11px] mt-0.5" style={{ color: P.muted }}>
                    voorstel {g.suggestionFrom === "regel" ? "uit je eigen regel" : "uit eerdere keuzes"}
                  </span>
                )}
              </div>
              {ruleAllowed(g) && (
                <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: P.text }} title={`Regel: omschrijving bevat "${g.name}"`}>
                  <input type="checkbox" checked={choice.rule} onChange={(e) => setChoice(g, { rule: e.target.checked })} />
                  voortaan automatisch
                </label>
              )}
              <div className="flex items-center gap-1 ml-auto">
                <Button variant="primary" icon={Check} onClick={() => assign([g])} disabled={!choice.category}>
                  Toewijzen
                </Button>
                <button
                  onClick={() => setSkipped((s) => new Set(s).add(g.key))}
                  className="text-xs px-2 py-1.5 rounded hover:bg-black/5"
                  style={{ color: P.muted }}
                  title="Deze partij nu overslaan"
                >
                  Overslaan
                </button>
              </div>
            </div>
            {expanded && (
              <div className="px-4 pb-3 pl-10 space-y-1">
                {g.items.slice(0, 20).map((t) => (
                  <div key={t.id} className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="min-w-0" style={{ color: P.text }}>
                      <span style={{ color: P.muted }}>{formatDate(t.date)}</span> {t.description}
                    </span>
                    <Amount value={t.amount} className="text-xs whitespace-nowrap" />
                  </div>
                ))}
                {g.items.length > 20 && (
                  <p className="text-xs" style={{ color: P.muted }}>
                    … en nog {g.items.length - 20}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {(visible.length > limit || skipped.size > 0) && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-t text-xs" style={{ borderColor: P.border, color: P.muted }}>
          {visible.length > limit && (
            <button onClick={() => setLimit((l) => l + PAGE)} className="font-medium underline" style={{ color: P.blue }}>
              Toon meer partijen ({visible.length - limit})
            </button>
          )}
          {skipped.size > 0 && (
            <button onClick={() => setSkipped(new Set())} className="underline">
              {skipped.size} overgeslagen partij(en) weer tonen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
