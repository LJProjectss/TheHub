// Transacties: filteren, zoeken, bewerken en categoriseren. Dit bestand houdt de filters en
// panelen bij en zet de onderdelen op volgorde; die staan in pages/transactions/, het filteren
// en sorteren in lib/transactionList.js.
import { useEffect, useMemo, useState } from "react";
import { ListChecks, Users } from "lucide-react";
import { P } from "../theme";
import { toIsoDate } from "../lib/format";
import { downloadCsv, transactionsToCsv } from "../lib/csv";
import {
  EMPTY_FILTERS,
  FIRST_DIR,
  filterTransactions,
  groupByMonth,
  periodPresets,
  sumTotals,
} from "../lib/transactionList";
import { clearAutoFlag } from "../lib/patterns";
import { groupNames } from "../lib/categories";
import { accountLabel, formatIban } from "../lib/accounts";
import { EmptyState } from "../components/ui";
import AddTransactionForm from "../components/AddTransactionForm";
import RecurringRulesPanel from "../components/RecurringRulesPanel";
import PartyCategorizer from "../components/PartyCategorizer";
import CategorizeMode from "../components/CategorizeMode";
import { VIEW_KEY, initialView, useIsMobile } from "./transactions/parts";
import PageHeader from "./transactions/PageHeader";
import FilterBar from "./transactions/FilterBar";
import SelectionBar from "./transactions/SelectionBar";
import CategorySuggestion from "./transactions/CategorySuggestion";
import TransactionList from "./transactions/TransactionList";
import { useTransactionActions } from "./transactions/useTransactionActions";
import { useSelection } from "./transactions/useSelection";

export default function Transactions({
  transactions,
  categories,
  setTransactions,
  recurringRules,
  setRecurringRules,
  categoryRules,
  setCategoryRules,
  categoryGroups = {},
  accounts = [],
  openImport,
  notify,
  // Filter om mee te openen, bv. vanuit het Overzicht: { category, dateFrom, dateTo, onlyAuto, byParty }.
  initialFilter,
}) {
  const [initial] = useState(() => initialView(initialFilter));
  const [filters, setFilters] = useState(initial.filters);
  const [sort, setSort] = useState(initial.sort);
  const [showAdd, setShowAdd] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showParty, setShowParty] = useState(!!initialFilter?.byParty);
  const [showQuick, setShowQuick] = useState(!!initialFilter?.quick);
  const uncategorizedCount = useMemo(() => transactions.filter((t) => !t.category && !t.expected).length, [transactions]);
  const isMobile = useIsMobile();

  const presets = useMemo(() => periodPresets(), []);
  const activePreset = presets.find((p) => p.from === filters.dateFrom && p.to === filters.dateTo);
  const customDates = !!(filters.dateFrom || filters.dateTo) && !activePreset;
  const extraFilterCount = [
    customDates,
    filters.amountMin,
    filters.amountMax,
    filters.type,
    filters.tag,
    filters.account,
  ].filter(Boolean).length;
  const [showMoreFilters, setShowMoreFilters] = useState(extraFilterCount > 0);
  const anyFilter =
    extraFilterCount > 0 ||
    !!(filters.dateFrom || filters.dateTo || filters.search || filters.category) ||
    filters.onlyAuto ||
    filters.onlyExpected;

  const setFilter = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));
  const setPeriod = (from, to) => setFilters((f) => ({ ...f, dateFrom: from, dateTo: to }));
  const clearFilters = () => setFilters(EMPTY_FILTERS);

  useEffect(() => {
    try {
      sessionStorage.setItem(VIEW_KEY, JSON.stringify({ filters, sort }));
    } catch {
      // opslag niet beschikbaar
    }
  }, [filters, sort]);

  const autoCount = useMemo(() => transactions.filter((t) => t.autoCategorized && t.category).length, [transactions]);
  const expectedCount = useMemo(() => transactions.filter((t) => t.expected).length, [transactions]);
  useEffect(() => {
    if (autoCount === 0 && filters.onlyAuto) setFilters((f) => ({ ...f, onlyAuto: false }));
    if (expectedCount === 0 && filters.onlyExpected) setFilters((f) => ({ ...f, onlyExpected: false }));
  }, [autoCount, expectedCount]);

  const groupList = groupNames(categoryGroups);
  const allTags = useMemo(
    () => [...new Set(transactions.flatMap((t) => t.tags || []))].sort((a, b) => a.localeCompare(b, "nl")),
    [transactions],
  );
  // Rekeningen pas tonen als er meer dan één in gebruik is.
  const usedAccounts = useMemo(() => [...new Set(transactions.map((t) => t.account).filter(Boolean))], [transactions]);
  const showAccounts = usedAccounts.length > 1;
  const accountOptions = usedAccounts.map((iban) => `${accountLabel(accounts, iban)} (${formatIban(iban)})`);
  const accountFilter = {
    show: showAccounts,
    options: accountOptions,
    valueFor: (iban) => accountOptions[usedAccounts.indexOf(iban)] || "",
    ibanFor: (label) => usedAccounts[accountOptions.indexOf(label)] || "",
  };

  const visible = useMemo(
    () => filterTransactions(transactions, filters, sort, categoryGroups),
    [transactions, filters, sort, categoryGroups],
  );
  const totals = useMemo(() => sumTotals(visible), [visible]);
  const groups = useMemo(
    () => (sort.key === "date" ? groupByMonth(visible) : [{ key: "all", items: visible }]),
    [visible, sort.key],
  );
  const onSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: FIRST_DIR[key] }));

  const actions = useTransactionActions({ transactions, setTransactions, categories, categoryRules, setCategoryRules, notify });
  const sel = useSelection({ visible, setTransactions, removeWithUndo: actions.removeWithUndo });

  // Alle zichtbare automatische toewijzingen goedkeuren (label weg, categorie blijft).
  const approveVisibleAuto = () => {
    const ids = new Set(visible.map((t) => t.id));
    setTransactions((list) => list.map((t) => (ids.has(t.id) ? clearAutoFlag(t) : t)));
  };
  const exportCsv = (list, name) => downloadCsv(`transacties-${name}-${toIsoDate(new Date())}.csv`, transactionsToCsv(list));

  const rowProps = (t) => ({
    t,
    categories,
    onUpdate: actions.updateTransaction,
    onCategoryChange: actions.changeCategory,
    onDelete: actions.deleteTransaction,
    selected: sel.selected.has(t.id),
    onToggleSelect: () => sel.toggleSelect(t.id),
    accountName: showAccounts ? accountLabel(accounts, t.account) : "",
    onTagClick: (tag) => {
      setFilter("tag")(tag);
      setShowMoreFilters(true);
    },
  });

  return (
    <div>
      <datalist id="hb-tags">
        {allTags.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
      <PageHeader
        openImport={openImport}
        onAdd={() => setShowAdd((v) => !v)}
        onAutoCategorize={actions.autoCategorize}
        onToggleRules={() => setShowRules((v) => !v)}
        onExportVisible={() => exportCsv(visible, "overzicht")}
        visibleCount={visible.length}
      />

      {showQuick && (
        <CategorizeMode
          transactions={transactions}
          categories={categories}
          categoryRules={categoryRules}
          setTransactions={setTransactions}
          notify={notify}
          onClose={() => setShowQuick(false)}
        />
      )}
      {showParty && (
        <PartyCategorizer
          transactions={transactions}
          categories={categories}
          categoryRules={categoryRules}
          setTransactions={setTransactions}
          setCategoryRules={setCategoryRules}
          notify={notify}
          onClose={() => setShowParty(false)}
        />
      )}
      {showRules && (
        <RecurringRulesPanel
          categories={categories}
          recurringRules={recurringRules}
          setRecurringRules={setRecurringRules}
          onClose={() => setShowRules(false)}
        />
      )}
      {showAdd && (
        <AddTransactionForm categories={categories} onAdd={actions.addTransaction} onClose={() => setShowAdd(false)} />
      )}

      <FilterBar
        filters={filters}
        setFilter={setFilter}
        setPeriod={setPeriod}
        clearFilters={clearFilters}
        anyFilter={anyFilter}
        extraFilterCount={extraFilterCount}
        showMoreFilters={showMoreFilters}
        setShowMoreFilters={setShowMoreFilters}
        presets={presets}
        activePreset={activePreset}
        customDates={customDates}
        categories={categories}
        groupList={groupList}
        allTags={allTags}
        accountFilter={accountFilter}
        autoCount={autoCount}
        expectedCount={expectedCount}
      />

      {(sel.visibleUncategorized.length > 0 || uncategorizedCount > 0 || (filters.onlyAuto && visible.length > 0)) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {uncategorizedCount > 0 && (
            <button
              onClick={() => setShowQuick(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-md"
              style={{ backgroundColor: P.blue, color: P.onBlue }}
            >
              <ListChecks size={13} />
              Eén voor één ({uncategorizedCount})
            </button>
          )}
          {uncategorizedCount > 0 && !showParty && (
            <button
              onClick={() => setShowParty(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-md border"
              style={{ borderColor: P.border, color: P.blue, backgroundColor: P.surface }}
            >
              <Users size={13} />
              Per partij
            </button>
          )}
          {sel.visibleUncategorized.length > 0 && (
            <button
              onClick={sel.selectUncategorized}
              className="text-xs font-medium px-2 py-1 rounded-md hover:bg-black/5"
              style={{ color: P.blue }}
            >
              Selecteer ongecategoriseerde ({sel.visibleUncategorized.length})
            </button>
          )}
          {filters.onlyAuto && visible.length > 0 && (
            <button
              onClick={approveVisibleAuto}
              className="text-xs font-medium px-2 py-1 rounded-md hover:bg-black/5"
              style={{ color: P.income }}
            >
              Alle {visible.length} goedkeuren
            </button>
          )}
        </div>
      )}

      {sel.selected.size > 0 && (
        <SelectionBar
          count={sel.selected.size}
          categories={categories}
          bulkCategory={sel.bulkCategory}
          setBulkCategory={sel.setBulkCategory}
          onAssignCategory={sel.assignBulkCategory}
          bulkInput={sel.bulkInput}
          setBulkInput={sel.setBulkInput}
          onToggleBulkInput={sel.toggleBulkInput}
          onSaveBulkInput={sel.saveBulkInput}
          selectedTags={sel.selectedTags}
          onRemoveTag={sel.removeTagFromSelected}
          expectedCount={sel.selectedExpected}
          onConfirmExpected={sel.confirmSelectedExpected}
          onExport={() => exportCsv(sel.selectedList, "selectie")}
          onDelete={sel.deleteSelected}
          onClear={sel.clearSelection}
        />
      )}

      {actions.suggestion && (
        <CategorySuggestion
          suggestion={actions.suggestion}
          onApply={actions.applySuggestion}
          onMakeRule={actions.createRuleFromSuggestion}
          onClose={() => actions.setSuggestion(null)}
        />
      )}

      {transactions.length === 0 ? (
        <EmptyState
          title="Nog geen transacties"
          text="Importeer een CSV-bestand van je bank, of voeg er hierboven zelf een toe."
        />
      ) : (
        <TransactionList
          isMobile={isMobile}
          groups={groups}
          visibleCount={visible.length}
          totalCount={transactions.length}
          totals={totals}
          sort={sort}
          setSort={setSort}
          onSort={onSort}
          allSelected={sel.allSelected}
          onToggleSelectAll={sel.toggleSelectAll}
          rowProps={rowProps}
        />
      )}
    </div>
  );
}
