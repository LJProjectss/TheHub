// Kleine stukjes toestand van de app-schil: thema (licht/donker, en licht tijdens printen),
// meldingen met "ongedaan maken" en de herinneringen aan verlengingen van abonnementen.
import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { applyTheme } from "../theme";
import { undoAutoCategories } from "../lib/patterns";
import { daysFromToday, detectRecurring, ignoredPatterns, recurringOptions } from "../lib/subscriptions";
import { budgetAlerts } from "../lib/budgetAlerts";

const THEME_KEY = "huishoudboekje-theme";
const RENEWALS_SEEN_KEY = "huishoudboekje-renewals-seen";
const BUDGET_SEEN_KEY = "huishoudboekje-budget-alerts-seen";

export function useTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem(THEME_KEY) === "dark");
  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    } catch {
      // opslag niet beschikbaar
    }
  }, [dark]);
  // Tijdens het printen altijd het lichte thema (donkere achtergronden printen slecht).
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
  const darkShown = dark && !printing;
  applyTheme(darkShown);
  return { dark, setDark, darkShown };
}

// Meldingsbalk: import/categorisatie/back-up/verwijderen ({ text, undo }). `undo` is een
// categorisatie-kenmerk (tag), een { label, run } of een lijst daarvan (meerdere knoppen);
// run() mag een vervolgmelding teruggeven.
export function useNotify(setTransactions) {
  const [message, setMessage] = useState(null);
  const undoAuto = (tag) => {
    setTransactions((list) => undoAutoCategories(list, tag));
    return "Automatische categorisatie ongedaan gemaakt.";
  };
  const toAction = (undo) =>
    typeof undo === "object" ? undo : { label: "Categorisatie ongedaan maken", run: () => undoAuto(undo) };
  const notify = (text, undo = null) =>
    setMessage(text ? { text, undo: [undo].flat().filter(Boolean).map(toAction) } : null);
  const runUndo = (action) => {
    const text = action.run();
    setMessage(text ? { text, undo: [] } : null);
  };
  return { message, notify, runUndo, close: () => setMessage(null) };
}

// Verlengingen van jaar- en halfjaarabonnementen binnen 30 dagen (per verlenging één keer weg te klikken).
export function useRenewals(data) {
  const { transactions, dismissedSubscriptions, fixedCategories, excludedCategories } = data;
  const [seenRenewals, setSeenRenewals] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(RENEWALS_SEEN_KEY)) || [];
    } catch {
      return [];
    }
  });
  const dismiss = (id) => {
    const next = [...seenRenewals, id];
    setSeenRenewals(next);
    try {
      localStorage.setItem(RENEWALS_SEEN_KEY, JSON.stringify(next.slice(-100)));
    } catch {
      // opslag niet beschikbaar
    }
  };
  const upcoming = useMemo(() => {
    const ignored = ignoredPatterns(dismissedSubscriptions);
    return detectRecurring(transactions, recurringOptions(data)).items.filter(
      (i) =>
        i.active &&
        !ignored.has(i.pattern) &&
        (i.frequency.key === "yearly" || i.frequency.key === "halfyearly") &&
        daysFromToday(i.nextExpected) >= 0 &&
        daysFromToday(i.nextExpected) <= 30 &&
        !seenRenewals.includes(`${i.key}|${i.nextExpected}`),
    );
  }, [
    transactions,
    dismissedSubscriptions,
    fixedCategories,
    excludedCategories,
    data.savingsCategory,
    data.savingsGoals,
    data.savingsSettings,
    seenRenewals,
  ]);
  return { upcoming, dismiss };
}

// Budgetten die deze maand voor 80% of meer op zijn. Wegklikken geldt per budget en per maand;
// gaat een budget daarna over de 100%, dan volgt nog één seintje.
export function useBudgetAlerts(data) {
  const { transactions, budgets, excludedCategories, fixedCategories } = data;
  const [seen, setSeen] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(BUDGET_SEEN_KEY)) || [];
    } catch {
      return [];
    }
  });
  const keyOf = (a) => `${a.month}|${a.naam}|${a.pct >= 1 ? "over" : "near"}`;
  const alerts = useMemo(
    () => budgetAlerts({ transactions, budgets, excludedCategories, fixedCategories }),
    [transactions, budgets, excludedCategories, fixedCategories],
  );
  const open = alerts.filter((a) => !seen.includes(keyOf(a)));
  const dismiss = () => {
    const next = [...seen, ...open.map(keyOf)];
    setSeen(next);
    try {
      localStorage.setItem(BUDGET_SEEN_KEY, JSON.stringify(next.slice(-60)));
    } catch {
      // opslag niet beschikbaar
    }
  };
  return { alerts, open, dismiss };
}
