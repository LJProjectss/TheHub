// Acties op transacties: wijzigen, toevoegen, verwijderen (met ongedaan maken), categorie kiezen
// met een voorstel voor vergelijkbare transacties, en automatisch categoriseren.
import { useState } from "react";
import { newId } from "../../lib/format";
import { applyAutoCategories, buildAutoCategoryModel, clearAutoFlag, pattern, patternRaw } from "../../lib/patterns";

export function useTransactionActions({ transactions, setTransactions, categories, categoryRules, setCategoryRules, notify }) {
  // Voorstel na het handmatig kiezen van een categorie: { label, category, ids, canRule }.
  const [suggestion, setSuggestion] = useState(null);

  // Verwijderde transacties terugzetten (alleen als ze er niet intussen weer zijn).
  const restore = (removed) => () => {
    setTransactions((list) => {
      const ids = new Set(list.map((t) => t.id));
      return [...removed.filter((t) => !ids.has(t.id)), ...list];
    });
    return "Verwijderen ongedaan gemaakt.";
  };
  const removeWithUndo = (ids, text) => {
    const removed = transactions.filter((t) => ids.has(t.id));
    if (removed.length === 0) return;
    setTransactions((list) => list.filter((t) => !ids.has(t.id)));
    notify?.(text(removed), { label: "Ongedaan maken", run: restore(removed) });
  };

  const updateTransaction = (id, changes) =>
    setTransactions((list) => list.map((t) => (t.id === id ? { ...t, ...changes } : t)));
  const deleteTransaction = (id) =>
    removeWithUndo(new Set([id]), ([t]) => `Transactie "${t.description}" verwijderd.`);
  const addTransaction = (t) => setTransactions((list) => [t, ...list]);

  // Handmatig een categorie kiezen; daarna voorstellen om vergelijkbare transacties mee te nemen
  // of er een eigen regel van te maken.
  const changeCategory = (t, category) => {
    updateTransaction(t.id, { category, autoCategorized: undefined });
    if (!category || t.expected) {
      setSuggestion(null);
      return;
    }
    const p = pattern(t.description);
    const label = patternRaw(t.description);
    const ids = transactions
      .filter((o) => o.id !== t.id && !o.expected && pattern(o.description) === p && o.category !== category)
      .map((o) => o.id);
    const canRule =
      label.length >= 3 && !categoryRules.some((r) => r.contains.trim().toLowerCase() === label.toLowerCase());
    setSuggestion(ids.length > 0 || canRule ? { label, category, ids, canRule } : null);
  };
  const applySuggestion = () => {
    const ids = new Set(suggestion.ids);
    const before = new Map(transactions.filter((t) => ids.has(t.id)).map((t) => [t.id, t]));
    setTransactions((list) =>
      list.map((t) => (ids.has(t.id) ? { ...clearAutoFlag(t), category: suggestion.category } : t)),
    );
    notify?.(`${ids.size} transactie(s) met "${suggestion.label}" op ${suggestion.category} gezet.`, {
      label: "Ongedaan maken",
      run: () => {
        setTransactions((list) =>
          list.map((t) => {
            const prev = before.get(t.id);
            return prev ? { ...t, category: prev.category, autoCategorized: prev.autoCategorized } : t;
          }),
        );
        return "Categorieën teruggezet.";
      },
    });
    setSuggestion((s) => (s.canRule ? { ...s, ids: [] } : null));
  };
  const createRuleFromSuggestion = () => {
    setCategoryRules((rules) => [...rules, { id: newId(), contains: suggestion.label, category: suggestion.category }]);
    notify?.(
      `Regel toegevoegd: omschrijving bevat "${suggestion.label}" → ${suggestion.category}. Te beheren onder Categorieën.`,
    );
    setSuggestion((s) => (s.ids.length > 0 ? { ...s, canRule: false } : null));
  };

  // Met terugwerkende kracht: alleen lege categorieën invullen (eigen regels + geleerde patronen).
  const autoCategorize = () => {
    const tag = newId();
    const options = { rules: categoryRules, categories, tag };
    const result = applyAutoCategories(transactions, buildAutoCategoryModel(transactions, categories), options);
    if (result.count > 0)
      setTransactions((list) => applyAutoCategories(list, buildAutoCategoryModel(list, categories), options).list);
    notify?.(
      result.count > 0
        ? `${result.count} bestaande transactie(s) automatisch gecategoriseerd${
            result.byRule > 0 ? ` (waarvan ${result.byRule} via je eigen regels)` : " op basis van eerdere keuzes"
          }. Ze zijn gemarkeerd met "auto".`
        : "Geen ongecategoriseerde transacties gevonden die bij een eigen regel passen of waarvan de omschrijving minstens 3 keer eerder consistent dezelfde categorie kreeg.",
      result.count > 0 ? tag : null,
    );
  };

  return {
    removeWithUndo,
    updateTransaction,
    deleteTransaction,
    addTransaction,
    changeCategory,
    suggestion,
    setSuggestion,
    applySuggestion,
    createRuleFromSuggestion,
    autoCategorize,
  };
}
