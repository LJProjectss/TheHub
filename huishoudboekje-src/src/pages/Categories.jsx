import { useMemo, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { P } from "../theme";
import { UNCATEGORIZED, sortNl } from "../lib/format";
import { parseInputAmount } from "../lib/csv";
import { dataPayload } from "../lib/backup";
import {
  applyChanges,
  deleteCategory,
  deleteImpact,
  groupNames,
  groupOf,
  renameCategory,
  snapshotFor,
} from "../lib/categories";
import { Amount, Button, Intro } from "../components/ui";
import CategoryRulesPanel from "../components/CategoryRulesPanel";
import ReservesPanel from "../components/ReservesPanel";

function CheckBox({ checked, ...props }) {
  return (
    <span
      className="w-5 h-5 rounded flex items-center justify-center border transition-colors flex-shrink-0"
      style={{ borderColor: checked ? P.blue : P.border, backgroundColor: checked ? P.blue : "transparent" }}
      {...props}
    >
      {checked && <Check size={13} color="#FFFFFF" />}
    </span>
  );
}

function BudgetInput({ value, onChange, onCommit }) {
  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: P.muted }}>
        €
      </span>
      <input
        type="text"
        inputMode="decimal"
        placeholder="geen"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onCommit(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="hb-money w-full pl-5 pr-2 py-1.5 rounded-lg border text-sm text-right tabular-nums"
        style={{ borderColor: P.border }}
      />
    </div>
  );
}

// Groep kiezen of een nieuwe typen; opgeslagen bij verlaten van het veld.
function GroupInput({ value, onCommit }) {
  const [draft, setDraft] = useState(null);
  return (
    <input
      type="text"
      list="hb-category-groups"
      placeholder="geen groep"
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        const next = e.target.value.trim();
        if (next !== value) onCommit(next);
        setDraft(null);
      }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className="w-full px-2 py-1.5 rounded-lg border text-sm"
      style={{ borderColor: P.border }}
    />
  );
}

// Naam wijzigen; een bestaande naam kiezen = samenvoegen.
function RenameField({ name, categories, onRename, onCancel }) {
  const [value, setValue] = useState(name);
  const target = value.trim();
  const merging = target !== name && categories.includes(target);
  const submit = () => {
    if (!target || target === name) return onCancel();
    onRename(target);
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        type="text"
        list="hb-category-names"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          else if (e.key === "Escape") onCancel();
        }}
        className="flex-1 min-w-[140px] px-2 py-1.5 rounded-lg border text-sm"
        style={{ borderColor: merging ? P.warn : P.border }}
        aria-label={`Nieuwe naam voor ${name}`}
      />
      <button
        onClick={submit}
        className="px-2 py-1.5 rounded-md text-xs font-medium text-white"
        style={{ backgroundColor: merging ? P.warn : P.blue }}
      >
        {merging ? "Samenvoegen" : "Opslaan"}
      </button>
      <button onClick={onCancel} className="p-1.5 rounded hover:bg-black/5" style={{ color: P.muted }} aria-label="Annuleren">
        <X size={14} />
      </button>
      {merging && (
        <p className="w-full text-xs" style={{ color: P.warn }}>
          {target} bestaat al: alle transacties, regels en het budget van {name} gaan naar {target}.
        </p>
      )}
    </div>
  );
}

export default function Categories({ data, notify }) {
  const {
    categories,
    setCategories,
    transactions,
    budgets,
    setBudgets,
    fixedCategories,
    setFixedCategories,
    excludedCategories,
    setExcludedCategories,
    categoryRules,
    setCategoryRules,
    categoryGroups,
    setCategoryGroups,
  } = data;
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState(null);
  // Budgetvelden die nog bewerkt worden (tekst), per categorie.
  const [budgetDrafts, setBudgetDrafts] = useState({});
  const groups = groupNames(categoryGroups);

  const stats = useMemo(() => {
    const s = {};
    transactions.forEach((t) => {
      const c = t.category || UNCATEGORIZED;
      if (!s[c]) s[c] = { count: 0, total: 0 };
      s[c].count++;
      s[c].total += t.amount;
    });
    return s;
  }, [transactions]);

  const addCategory = () => {
    const name = newName.trim();
    if (!name || categories.includes(name)) return;
    setCategories((list) => sortNl([...list, name]));
    setNewName("");
  };

  // Wijziging op alle plekken tegelijk doorvoeren, met "ongedaan maken" in de melding.
  const applyWithUndo = (changes, text, undoText) => {
    const undo = snapshotFor(data, changes);
    applyChanges(data, changes);
    notify?.(text, {
      label: "Ongedaan maken",
      run: () => {
        undo();
        return undoText;
      },
    });
  };

  const removeCategory = (name) => {
    const impact = deleteImpact(data, name);
    const question = `Categorie "${name}" verwijderen?${impact.length > 0 ? `\n\nGevolg: ${impact.join(", ")}.` : ""}`;
    if (!window.confirm(question)) return;
    applyWithUndo(deleteCategory(dataPayload(data), name), `Categorie "${name}" verwijderd.`, "Verwijderen ongedaan gemaakt.");
  };

  const rename = (from, to) => {
    const merging = categories.includes(to);
    if (merging && !window.confirm(`"${from}" samenvoegen met "${to}"? Daarna bestaat alleen "${to}" nog.`)) return;
    applyWithUndo(
      renameCategory(dataPayload(data), from, to),
      merging ? `"${from}" samengevoegd met "${to}".` : `"${from}" hernoemd naar "${to}".`,
      merging ? "Samenvoegen ongedaan gemaakt." : "Hernoemen ongedaan gemaakt.",
    );
    setRenaming(null);
  };

  const setGroup = (name, group) =>
    setCategoryGroups((g) => {
      const next = { ...g };
      if (group) next[name] = group;
      else delete next[name];
      return next;
    });

  const commitBudget = (name, text) => {
    const value = parseInputAmount(text);
    setBudgets((b) => {
      const next = { ...b };
      if (value === null || value <= 0) delete next[name];
      else next[name] = Math.round(value * 100) / 100;
      return next;
    });
    setBudgetDrafts((d) => {
      const next = { ...d };
      delete next[name];
      return next;
    });
  };

  const toggleIn = (setter, name) =>
    setter((list) => (list.includes(name) ? list.filter((c) => c !== name) : [...list, name]));

  const rowData = (name) => {
    const draft = budgetDrafts[name];
    return {
      stat: stats[name] || { count: 0, total: 0 },
      budgetText: draft !== undefined ? draft : budgets[name] ? String(budgets[name]).replace(".", ",") : "",
      isFixed: fixedCategories.includes(name),
      isExcluded: excludedCategories.includes(name),
    };
  };
  const setDraft = (name) => (value) => setBudgetDrafts((d) => ({ ...d, [name]: value }));

  const nameCell = (name, stat) =>
    renaming === name ? (
      <RenameField
        name={name}
        categories={categories}
        onRename={(to) => rename(name, to)}
        onCancel={() => setRenaming(null)}
      />
    ) : (
      <>
        <div className="text-sm font-medium truncate" style={{ color: P.text }}>
          {name}
        </div>
        <div className="text-xs" style={{ color: P.muted }}>
          {stat.count} transactie{stat.count !== 1 ? "s" : ""}
        </div>
      </>
    );
  const actions = (name) => (
    <div className="flex flex-shrink-0">
      <button
        onClick={() => setRenaming(name)}
        className="p-1.5 rounded hover:bg-black/5"
        style={{ color: P.muted }}
        aria-label={`${name} hernoemen of samenvoegen`}
        title="Hernoemen of samenvoegen"
      >
        <Pencil size={15} />
      </button>
      <button
        onClick={() => removeCategory(name)}
        className="p-1.5 rounded hover:bg-black/5"
        style={{ color: P.muted }}
        aria-label={`${name} verwijderen`}
        title="Verwijderen"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );

  return (
    <div>
      <datalist id="hb-category-groups">
        {groups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      <datalist id="hb-category-names">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: P.heading }}>
        Categorieën
      </h1>
      <Intro id="categorieen" summary="Groep, maandbudget en soort per categorie.">
        Stel per categorie optioneel een groep en een maandbudget in, en markeer welke categorieën vaste lasten zijn. Vink
        "Niet als uitgave" aan voor categorieën als Sparen die je niet in je uitgaventotalen en -grafieken wilt meetellen,
        ook al staan ze als negatief bedrag geboekt. Met het potlood hernoem je een categorie; kies je daarbij een
        bestaande naam, dan worden de twee samengevoegd.
      </Intro>      <div className="flex gap-2 mb-5 max-w-md">
        <input
          type="text"
          placeholder="Nieuwe categorie..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCategory()}
          className="flex-1 px-3 py-2 rounded-lg border text-sm"
          style={{ borderColor: P.border }}
        />
        <Button variant="primary" icon={Plus} onClick={addCategory}>
          Toevoegen
        </Button>
      </div>

      <CategoryRulesPanel
        categories={categories}
        categoryRules={categoryRules}
        setCategoryRules={setCategoryRules}
        transactions={transactions}
      />

      {categories.length === 0 ? (
        <div
          className="rounded-2xl border hb-card overflow-hidden"
          style={{ borderColor: P.border, backgroundColor: P.surface }}
        >
          <p className="p-5 text-sm" style={{ color: P.muted }}>
            Nog geen categorieën toegevoegd.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: tabel */}
          <div
            className="hidden sm:block rounded-2xl border hb-card overflow-hidden overflow-x-auto"
            style={{ borderColor: P.border, backgroundColor: P.surface }}
          >
            <div
              className="flex items-center px-4 py-2 text-xs min-w-[860px]"
              style={{ borderBottom: `1px solid ${P.border}`, color: P.muted, backgroundColor: P.bg }}
            >
              <div className="flex-1">Categorie</div>
              <div className="w-36 pr-3">Groep</div>
              <div className="w-20 text-center">Vaste last</div>
              <div className="w-24 text-center">
                Niet als
                <br />
                uitgave
              </div>
              <div className="w-32 text-right pr-4">Maandbudget</div>
              <div className="w-28 text-right pr-4">Besteed totaal</div>
              <div className="w-16" />
            </div>
            {categories.map((name, i) => {
              const { stat, budgetText, isFixed, isExcluded } = rowData(name);
              return (
                <div
                  key={name}
                  className="flex items-center px-4 py-3 min-w-[860px]"
                  style={{ borderTop: i > 0 ? `1px solid ${P.border}` : "none" }}
                >
                  <div className="flex-1 min-w-0 pr-3">{nameCell(name, stat)}</div>
                  <div className="w-36 pr-3">
                    <GroupInput value={groupOf(categoryGroups, name)} onCommit={(g) => setGroup(name, g)} />
                  </div>
                  <div className="w-20 flex justify-center">
                    <button
                      onClick={() => toggleIn(setFixedCategories, name)}
                      aria-label={isFixed ? `${name} is een vaste last` : `${name} is geen vaste last`}
                    >
                      <CheckBox checked={isFixed} />
                    </button>
                  </div>
                  <div className="w-24 flex justify-center">
                    <button
                      onClick={() => toggleIn(setExcludedCategories, name)}
                      aria-label={isExcluded ? `${name} telt niet mee als uitgave` : `${name} telt mee als uitgave`}
                    >
                      <CheckBox checked={isExcluded} />
                    </button>
                  </div>
                  <div className="w-32 pr-4">
                    <BudgetInput value={budgetText} onChange={setDraft(name)} onCommit={(v) => commitBudget(name, v)} />
                  </div>
                  <div className="w-28 text-right pr-4">
                    <Amount value={stat.total} />
                  </div>
                  <div className="w-16 flex justify-end">{actions(name)}</div>
                </div>
              );
            })}
          </div>

          {/* Mobiel: kaarten */}
          <div className="sm:hidden space-y-3">
            {categories.map((name) => {
              const { stat, budgetText, isFixed, isExcluded } = rowData(name);
              return (
                <div
                  key={name}
                  className="rounded-2xl border hb-card p-4"
                  style={{ borderColor: P.border, backgroundColor: P.surface }}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">{nameCell(name, stat)}</div>
                    {renaming !== name && actions(name)}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
                    <button onClick={() => toggleIn(setFixedCategories, name)} className="flex items-center gap-2">
                      <CheckBox checked={isFixed} aria-hidden="true" />
                      <span className="text-xs" style={{ color: P.muted }}>
                        Vaste last
                      </span>
                    </button>
                    <button onClick={() => toggleIn(setExcludedCategories, name)} className="flex items-center gap-2">
                      <CheckBox checked={isExcluded} aria-hidden="true" />
                      <span className="text-xs" style={{ color: P.muted }}>
                        Niet als uitgave
                      </span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs block mb-1" style={{ color: P.muted }}>
                        Groep
                      </label>
                      <GroupInput value={groupOf(categoryGroups, name)} onCommit={(g) => setGroup(name, g)} />
                    </div>
                    <div>
                      <label className="text-xs block mb-1" style={{ color: P.muted }}>
                        Maandbudget
                      </label>
                      <BudgetInput
                        value={budgetText}
                        onChange={setDraft(name)}
                        onCommit={(v) => commitBudget(name, v)}
                      />
                    </div>
                    <div>
                      <label className="text-xs block mb-1" style={{ color: P.muted }}>
                        Besteed totaal
                      </label>
                      <div
                        className="w-full px-2.5 py-1.5 rounded-lg border text-sm text-right leading-tight"
                        style={{ borderColor: P.border, backgroundColor: P.bg }}
                      >
                        <Amount value={stat.total} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <ReservesPanel data={data} />
    </div>
  );
}
