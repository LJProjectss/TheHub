import { useEffect, useState } from "react";
import { DEFAULT_CATEGORIES, sortNl, toIsoDate } from "./format";

export const STORAGE_KEY = "huishoudboekje-data";
const DATE_FIX_KEY = "huishoudboekje-datefix-v1";

export function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Oudere versies sloegen gegenereerde "verwacht"-rijen een dag te vroeg op (UTC). Die
// schuiven we een dag op en ontdubbelen we tot één per regel per maand.
// Eigen en geïmporteerde transacties blijven ongemoeid.
export function shiftOldPlaceholders(transactions) {
  const seen = new Set();
  return transactions
    .map((t) => {
      if (!t.expected || !t.ruleId || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) return t;
      const [y, m, d] = t.date.split("-").map(Number);
      return { ...t, date: toIsoDate(new Date(y, m - 1, d + 1)) };
    })
    .filter((t) => {
      if (!t.expected || !t.ruleId) return true;
      const key = t.ruleId + "|" + t.date.slice(0, 7);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

// Eenmalig bij de eerste start van deze versie.
function fixPlaceholderDates(transactions) {
  try {
    if (localStorage.getItem(DATE_FIX_KEY)) return transactions;
  } catch {
    return transactions;
  }
  return shiftOldPlaceholders(transactions);
}

function useStoredState(read) {
  return useState(() => read(loadStored()));
}

const arrayOr = (value, fallback) => (Array.isArray(value) ? value : fallback);
const objectOr = (value) => (value && typeof value == "object" ? value : {});

// Alle app-gegevens, bewaard in localStorage.
export function useHuishoudboekje() {
  const [categories, setCategories] = useStoredState((b) => sortNl(arrayOr(b?.categories, DEFAULT_CATEGORIES)));
  const [transactions, setTransactions] = useStoredState((b) =>
    Array.isArray(b?.transactions) ? fixPlaceholderDates(b.transactions) : [],
  );
  const [budgets, setBudgets] = useStoredState((b) => objectOr(b?.budgets));
  const [fixedCategories, setFixedCategories] = useStoredState((b) => arrayOr(b?.fixedCategories, []));
  const [savingsGoals, setSavingsGoals] = useStoredState((b) => arrayOr(b?.savingsGoals, []));
  const [savingsCategory, setSavingsCategory] = useStoredState((b) =>
    typeof b?.savingsCategory == "string" ? b.savingsCategory : "",
  );
  const [csvFormats, setCsvFormats] = useStoredState((b) => objectOr(b?.csvFormats));
  const [recurringRules, setRecurringRules] = useStoredState((b) => arrayOr(b?.recurringRules, []));
  const [excludedCategories, setExcludedCategories] = useStoredState((b) => arrayOr(b?.excludedCategories, []));
  const [dismissedSubscriptions, setDismissedSubscriptions] = useStoredState((b) =>
    arrayOr(b?.dismissedSubscriptions, []),
  );
  // Eigen regels: { id, contains, category } - "omschrijving bevat ... → categorie".
  const [categoryRules, setCategoryRules] = useStoredState((b) => arrayOr(b?.categoryRules, []));
  // Per spaarcategorie: verdeelwijze en correctie op het banksaldo (zie lib/savings.js).
  const [savingsSettings, setSavingsSettings] = useStoredState((b) => objectOr(b?.savingsSettings));
  // Per abonnement (sleutel uit lib/subscriptions.js): { status: "wanted" | "cancel", note, since }.
  const [subscriptionStatus, setSubscriptionStatus] = useStoredState((b) => objectOr(b?.subscriptionStatus));
  // Groep (hoofdcategorie) per categorie: { [categorie]: "Wonen" }.
  const [categoryGroups, setCategoryGroups] = useStoredState((b) => objectOr(b?.categoryGroups));
  // Potjes voor onregelmatige kosten: { [categorie]: { perYear, since: "YYYY-MM", start } } (zie lib/reserves.js).
  const [reserves, setReserves] = useStoredState((b) => objectOr(b?.reserves));
  // Eigen rekeningen: [{ iban, name, kind: "betaal" | "spaar" }] (zie lib/accounts.js).
  const [accounts, setAccounts] = useStoredState((b) => arrayOr(b?.accounts, []));
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(DATE_FIX_KEY, "1");
    } catch {
      // opslag niet beschikbaar
    }
    // Vraag de browser de gegevens niet automatisch op te ruimen (o.a. Safari wist
    // anders na een periode zonder gebruik). Weigert de browser, dan verandert er niets.
    navigator.storage
      ?.persisted?.()
      .then((persisted) => persisted || navigator.storage.persist?.())
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          categories,
          transactions,
          budgets,
          fixedCategories,
          savingsGoals,
          savingsCategory,
          csvFormats,
          recurringRules,
          excludedCategories,
          dismissedSubscriptions,
          categoryRules,
          savingsSettings,
          subscriptionStatus,
          categoryGroups,
          reserves,
          accounts,
        }),
      );
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, [
    categories,
    transactions,
    budgets,
    fixedCategories,
    savingsGoals,
    savingsCategory,
    csvFormats,
    recurringRules,
    excludedCategories,
    dismissedSubscriptions,
    categoryRules,
    savingsSettings,
    subscriptionStatus,
    categoryGroups,
    reserves,
    accounts,
  ]);

  return {
    categories,
    setCategories,
    transactions,
    setTransactions,
    budgets,
    setBudgets,
    fixedCategories,
    setFixedCategories,
    savingsGoals,
    setSavingsGoals,
    savingsCategory,
    setSavingsCategory,
    csvFormats,
    setCsvFormats,
    recurringRules,
    setRecurringRules,
    excludedCategories,
    setExcludedCategories,
    dismissedSubscriptions,
    setDismissedSubscriptions,
    categoryRules,
    setCategoryRules,
    savingsSettings,
    setSavingsSettings,
    subscriptionStatus,
    setSubscriptionStatus,
    categoryGroups,
    setCategoryGroups,
    reserves,
    setReserves,
    accounts,
    setAccounts,
    saveError,
  };
}
