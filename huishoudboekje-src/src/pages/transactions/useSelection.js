// Selectie van transacties en de acties voor alle geselecteerde tegelijk.
import { useEffect, useState } from "react";
import { clearAutoFlag } from "../../lib/patterns";
import { parseTags } from "../../components/TransactionRow";

export function useSelection({ visible, setTransactions, removeWithUndo }) {
  const [selected, setSelected] = useState(() => new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  // Tekstveld voor alle geselecteerde: { kind: "note" | "tag", value }.
  const [bulkInput, setBulkInput] = useState(null);

  // Selectie beperken tot wat zichtbaar is.
  useEffect(() => {
    const ids = new Set(visible.map((t) => t.id));
    setSelected((sel) => new Set([...sel].filter((id) => ids.has(id))));
  }, [visible]);

  const toggleSelect = (id) =>
    setSelected((sel) => {
      const next = new Set(sel);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = visible.length > 0 && visible.every((t) => selected.has(t.id));
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(visible.map((t) => t.id)));
  const visibleUncategorized = visible.filter((t) => !t.category);
  const selectUncategorized = () => setSelected(new Set(visibleUncategorized.map((t) => t.id)));
  const clearSelection = () => {
    setSelected(new Set());
    setBulkInput(null);
  };
  const selectedList = visible.filter((t) => selected.has(t.id));
  const selectedExpected = selectedList.filter((t) => t.expected).length;
  const updateSelected = (change) => {
    setTransactions((list) => list.map((t) => (selected.has(t.id) ? change(t) : t)));
    clearSelection();
  };
  const assignBulkCategory = () => {
    if (!bulkCategory || selected.size === 0) return;
    updateSelected((t) => ({ ...clearAutoFlag(t), category: bulkCategory }));
    setBulkCategory("");
  };
  const toggleBulkInput = (kind) => setBulkInput((b) => (b?.kind === kind ? null : { kind, value: "" }));
  const saveBulkInput = () => {
    const { kind, value } = bulkInput;
    if (kind === "note") updateSelected((t) => ({ ...t, note: value.trim() }));
    else {
      const add = parseTags(value);
      if (add.length === 0) return;
      updateSelected((t) => ({ ...t, tags: parseTags([...(t.tags || []), ...add].join(",")) }));
    }
  };
  const removeTagFromSelected = (tag) =>
    updateSelected((t) => ({ ...t, tags: (t.tags || []).filter((x) => x.toLowerCase() !== tag.toLowerCase()) }));
  const selectedTags = [...new Set(visible.filter((t) => selected.has(t.id)).flatMap((t) => t.tags || []))];
  const confirmSelectedExpected = () => updateSelected((t) => (t.expected ? { ...t, expected: false } : t));
  const deleteSelected = () => {
    if (selected.size === 0) return;
    if (!window.confirm(`${selected.size} transactie(s) verwijderen?`)) return;
    removeWithUndo(new Set(selected), (removed) => `${removed.length} transactie(s) verwijderd.`);
    clearSelection();
  };

  return {
    selected,
    toggleSelect,
    allSelected,
    toggleSelectAll,
    visibleUncategorized,
    selectUncategorized,
    clearSelection,
    selectedList,
    selectedExpected,
    bulkCategory,
    setBulkCategory,
    assignBulkCategory,
    bulkInput,
    setBulkInput,
    toggleBulkInput,
    saveBulkInput,
    selectedTags,
    removeTagFromSelected,
    confirmSelectedExpected,
    deleteSelected,
  };
}
