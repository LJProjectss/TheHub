import { useRef, useState } from "react";
import { DEFAULT_CATEGORIES, UNCATEGORIZED, newId, sortNl, toIsoDate } from "./format";
import { splitDuplicates } from "./duplicates";

const LAST_BACKUP_KEY = "huishoudboekje-last-backup";
const SNOOZE_KEY = "huishoudboekje-backup-snooze";
const REMIND_AFTER_DAYS = 14;
const SNOOZE_DAYS = 3;
const MIN_TRANSACTIONS = 5;

export function markBackedUp() {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
  } catch {
    // opslag niet beschikbaar
  }
}

function readTimestamp(key) {
  try {
    const v = localStorage.getItem(key);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

const arrayOr = (value, fallback = []) => (Array.isArray(value) ? value : fallback);
const objectOr = (value) => (value && typeof value == "object" && !Array.isArray(value) ? value : {});
const cents = (amount) => Math.round(Math.abs(Number(amount) || 0) * 100);
const monthKey = (ruleId, date) => `${ruleId}|${String(date).slice(0, 7)}`;

// Verwachte rijen uit back-ups van vóór de datumcorrectie staan een dag te vroeg. Alleen
// rijen waarvan datum+1 precies de dag van hun regel is, worden verschoven; daarna één per
// regel per maand. Zo blijven back-ups die al goede datums hebben ongemoeid.
function repairPlaceholders(transactions, rules) {
  const byId = new Map(rules.map((r) => [r.id, r]));
  const intendedDay = (rule, y, m) => Math.min(rule.dayOfMonth, new Date(y, m + 1, 0).getDate());
  const seen = new Set();
  return transactions
    .map((t) => {
      const rule = t.expected && t.ruleId && byId.get(t.ruleId);
      if (!rule || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) return t;
      const [y, m, d] = t.date.split("-").map(Number);
      const next = new Date(y, m - 1, d + 1);
      const target = intendedDay(rule, next.getFullYear(), next.getMonth());
      return next.getDate() === target && d !== intendedDay(rule, y, m - 1) ? { ...t, date: toIsoDate(next) } : t;
    })
    .filter((t) => {
      if (!t.expected || !t.ruleId) return true;
      const key = monthKey(t.ruleId, t.date);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

// Back-upbestand controleren en in dezelfde vorm brengen als de opgeslagen gegevens.
export function normalizeBackup(raw) {
  if (!raw || typeof raw != "object" || (!Array.isArray(raw.transactions) && !Array.isArray(raw.categories)))
    return null;
  const recurringRules = arrayOr(raw.recurringRules);
  return {
    categories: sortNl(arrayOr(raw.categories, DEFAULT_CATEGORIES)),
    transactions: repairPlaceholders(arrayOr(raw.transactions), recurringRules),
    budgets: objectOr(raw.budgets),
    fixedCategories: arrayOr(raw.fixedCategories),
    savingsGoals: arrayOr(raw.savingsGoals),
    savingsCategory: typeof raw.savingsCategory == "string" ? raw.savingsCategory : "",
    csvFormats: objectOr(raw.csvFormats),
    recurringRules,
    excludedCategories: arrayOr(raw.excludedCategories),
    dismissedSubscriptions: arrayOr(raw.dismissedSubscriptions),
    categoryRules: arrayOr(raw.categoryRules),
    savingsSettings: objectOr(raw.savingsSettings),
    subscriptionStatus: objectOr(raw.subscriptionStatus),
    categoryGroups: objectOr(raw.categoryGroups),
    reserves: objectOr(raw.reserves),
    accounts: arrayOr(raw.accounts),
    exportedAt: typeof raw.exportedAt == "string" ? raw.exportedAt : null,
  };
}

const sameRule = (a, b) =>
  (a.keyword || "").trim().toLowerCase() === (b.keyword || "").trim().toLowerCase() &&
  cents(a.amount) === cents(b.amount) &&
  a.dayOfMonth === b.dayOfMonth &&
  a.type === b.type;

// Back-up samenvoegen met de huidige gegevens zonder iets dubbel toe te voegen.
// Geeft de nieuwe gegevens terug plus een telling voor de melding.
export function mergeBackup(current, backup) {
  // Herhalende regels: bestaande (zelfde id of zelfde inhoud) hergebruiken, zodat
  // verwachte rijen uit de back-up aan de juiste regel gekoppeld blijven.
  const rules = [...current.recurringRules];
  const ruleIdMap = {};
  let rulesAdded = 0;
  backup.recurringRules.forEach((r) => {
    const match = rules.find((x) => x.id === r.id) || rules.find((x) => sameRule(x, r));
    if (match) {
      ruleIdMap[r.id] = match.id;
    } else {
      const id = r.id && !rules.some((x) => x.id === r.id) ? r.id : newId();
      rules.push({ ...r, id });
      ruleIdMap[r.id] = id;
      rulesAdded++;
    }
  });

  const existingIds = new Set(current.transactions.map((t) => t.id));
  const incoming = backup.transactions
    .filter((t) => !existingIds.has(t.id))
    .map((t) => ({ ...t, id: t.id || newId(), ruleId: t.ruleId ? (ruleIdMap[t.ruleId] ?? null) : null }));
  const { fresh } = splitDuplicates(
    current.transactions,
    incoming.filter((t) => !t.expected),
  );
  // Verwachte rijen alleen als hun regel die maand nog niets heeft; losse (zonder regel) niet.
  const covered = new Set(current.transactions.filter((t) => t.ruleId).map((t) => monthKey(t.ruleId, t.date)));
  const placeholders = incoming.filter((t) => {
    if (!t.expected || !t.ruleId) return false;
    const key = monthKey(t.ruleId, t.date);
    if (covered.has(key)) return false;
    covered.add(key);
    return true;
  });
  const added = [...fresh, ...placeholders];

  const goalNames = new Set(current.savingsGoals.map((g) => (g.name || "").trim().toLowerCase()));
  const goalIds = new Set(current.savingsGoals.map((g) => g.id));
  const newGoals = backup.savingsGoals.filter(
    (g) => !goalIds.has(g.id) && !goalNames.has((g.name || "").trim().toLowerCase()),
  );
  const ruleTexts = new Set(current.categoryRules.map((r) => (r.contains || "").trim().toLowerCase()));
  const newCategoryRules = backup.categoryRules.filter((r) => !ruleTexts.has((r.contains || "").trim().toLowerCase()));

  return {
    next: {
      categories: sortNl([...new Set([...current.categories, ...backup.categories])]),
      transactions: [...added, ...current.transactions],
      budgets: { ...backup.budgets, ...current.budgets },
      fixedCategories: [...new Set([...current.fixedCategories, ...backup.fixedCategories])],
      savingsGoals: [...current.savingsGoals, ...newGoals],
      savingsCategory: current.savingsCategory || backup.savingsCategory,
      csvFormats: { ...backup.csvFormats, ...current.csvFormats },
      recurringRules: rules,
      excludedCategories: [...new Set([...current.excludedCategories, ...backup.excludedCategories])],
      dismissedSubscriptions: [...new Set([...current.dismissedSubscriptions, ...backup.dismissedSubscriptions])],
      categoryRules: [...current.categoryRules, ...newCategoryRules],
      savingsSettings: { ...backup.savingsSettings, ...current.savingsSettings },
      subscriptionStatus: { ...backup.subscriptionStatus, ...current.subscriptionStatus },
      categoryGroups: { ...backup.categoryGroups, ...current.categoryGroups },
      reserves: { ...backup.reserves, ...current.reserves },
      accounts: [
        ...current.accounts,
        ...backup.accounts.filter((a) => !current.accounts.some((c) => c.iban === a.iban)),
      ],
    },
    summary: {
      transactionsAdded: added.length,
      transactionsSkipped: backup.transactions.length - added.length,
      rulesAdded,
    },
  };
}

export const FIELDS = [
  ["categories", "setCategories"],
  ["transactions", "setTransactions"],
  ["budgets", "setBudgets"],
  ["fixedCategories", "setFixedCategories"],
  ["savingsGoals", "setSavingsGoals"],
  ["savingsCategory", "setSavingsCategory"],
  ["csvFormats", "setCsvFormats"],
  ["recurringRules", "setRecurringRules"],
  ["excludedCategories", "setExcludedCategories"],
  ["dismissedSubscriptions", "setDismissedSubscriptions"],
  ["categoryRules", "setCategoryRules"],
  ["savingsSettings", "setSavingsSettings"],
  ["subscriptionStatus", "setSubscriptionStatus"],
  ["categoryGroups", "setCategoryGroups"],
  ["reserves", "setReserves"],
  ["accounts", "setAccounts"],
];

// Alle gegevens als één object (voor export, automatische back-up en synchroniseren).
export const dataPayload = (data) => Object.fromEntries(FIELDS.map(([key]) => [key, data[key]]));

// Alle gegevens in één keer vervangen (back-up terugzetten, cloudversie overnemen).
export const applyData = (data, values) => FIELDS.forEach(([key, setter]) => data[setter](values[key]));

export const backupJson = (data) =>
  JSON.stringify({ ...dataPayload(data), exportedAt: new Date().toISOString() }, null, 2);

// Export (JSON/Excel) en terugzetten van een JSON-back-up (vervangen of samenvoegen).
export function useBackup(data, notify) {
  const fileInput = useRef(null);
  const [pending, setPending] = useState(null);

  const exportJson = () => {
    const blob = new Blob([backupJson(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `huishoudboekje-${toIsoDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    markBackedUp();
  };

  const exportExcel = async () => {
    // Het Excel-onderdeel is groot; pas laden als het nodig is.
    let XLSX;
    try {
      XLSX = await import("xlsx");
    } catch {
      window.alert("Het Excel-onderdeel kon niet worden geladen. Controleer de internetverbinding en probeer het opnieuw.");
      return;
    }
    const rows = [...data.transactions]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map((t) => ({
        Datum: new Date(t.date),
        Omschrijving: t.description,
        Categorie: t.category || UNCATEGORIZED,
        Bedrag: t.amount,
        Labels: (t.tags || []).join(", "),
        Notitie: t.note || "",
        Rekening: t.account || "",
      }));
    const txSheet = XLSX.utils.json_to_sheet(rows, { cellDates: true });
    txSheet["!cols"] = [{ wch: 12 }, { wch: 42 }, { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 30 }, { wch: 22 }];
    const range = XLSX.utils.decode_range(txSheet["!ref"]);
    for (let r = 1; r <= range.e.r; r++) {
      const dateCell = txSheet[XLSX.utils.encode_cell({ r, c: 0 })];
      if (dateCell) dateCell.z = "dd-mm-yyyy";
      const amountCell = txSheet[XLSX.utils.encode_cell({ r, c: 3 })];
      if (amountCell) amountCell.z = "#,##0.00;-#,##0.00";
    }
    const catSheet = XLSX.utils.json_to_sheet(
      data.categories.map((c) => ({
        Categorie: c,
        Groep: data.categoryGroups?.[c] || "",
        "Maandbudget (€)": data.budgets[c] || "",
        "Vaste last": data.fixedCategories.includes(c) ? "Ja" : "Nee",
      })),
    );
    catSheet["!cols"] = [{ wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 12 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, txSheet, "Transacties");
    XLSX.utils.book_append_sheet(book, catSheet, "Categorieën");
    XLSX.writeFile(book, `huishoudboekje-${toIsoDate(new Date())}.xlsx`);
    markBackedUp();
  };

  const importFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      let backup = null;
      try {
        backup = normalizeBackup(JSON.parse(String(e.target.result || "{}")));
      } catch {
        backup = null;
      }
      if (!backup) {
        window.alert("Dit bestand kon niet worden gelezen als huishoudboekje-back-up.");
        return;
      }
      setPending({ backup, fileName: file.name });
    };
    reader.readAsText(file);
  };

  const applyAll = (values) => applyData(data, values);

  const replaceWithBackup = () => {
    const { backup } = pending;
    applyAll(backup);
    setPending(null);
    notify?.(
      `Back-up teruggezet: ${backup.transactions.length} transactie(s) en ${backup.recurringRules.length} herhalende regel(s). Je vorige gegevens zijn vervangen.`,
    );
  };

  const mergeIntoCurrent = () => {
    const { next, summary } = mergeBackup(dataPayload(data), pending.backup);
    applyAll(next);
    setPending(null);
    notify?.(
      `Back-up samengevoegd: ${summary.transactionsAdded} transactie(s) toegevoegd` +
        (summary.transactionsSkipped > 0
          ? `, ${summary.transactionsSkipped} overgeslagen omdat ze al aanwezig waren`
          : "") +
        (summary.rulesAdded > 0 ? `, ${summary.rulesAdded} herhalende regel(s) toegevoegd` : "") +
        ".",
    );
  };

  return {
    exportJson,
    exportExcel,
    triggerImport: () => fileInput.current?.click(),
    fileInputProps: {
      ref: fileInput,
      type: "file",
      accept: ".json,application/json",
      className: "hidden",
      onChange: (e) => {
        importFile(e.target.files?.[0]);
        e.target.value = "";
      },
    },
    pendingRestore: pending,
    replaceWithBackup,
    mergeIntoCurrent,
    cancelRestore: () => setPending(null),
  };
}

// Een back-up via de Thuis-hub (zelfde adres, ISO-datum) bevat ook dit huishoudboekje en telt dus mee.
const HUB_BACKUP_KEY = "hub_laatsteBackup";

function latestBackup() {
  const own = readTimestamp(LAST_BACKUP_KEY);
  let hub = null;
  try {
    const v = localStorage.getItem(HUB_BACKUP_KEY);
    hub = v ? Date.parse(v) || null : null;
  } catch {
    // opslag niet beschikbaar
  }
  return own === null && hub === null ? null : Math.max(own ?? 0, hub ?? 0);
}

// Herinnering om een back-up te maken: vanaf 5 transacties, als de laatste back-up
// 14+ dagen oud is (of er nooit een was), en niet binnen 3 dagen na "later".
export function useBackupReminder(transactionCount) {
  const [, rerender] = useState(0);
  const lastBackup = latestBackup();
  const snoozedAt = readTimestamp(SNOOZE_KEY);
  const daysSinceBackup = lastBackup ? (Date.now() - lastBackup) / 864e5 : null;
  const daysSinceSnooze = snoozedAt ? (Date.now() - snoozedAt) / 864e5 : Infinity;
  const shouldShow =
    transactionCount >= MIN_TRANSACTIONS &&
    (lastBackup === null || daysSinceBackup >= REMIND_AFTER_DAYS) &&
    daysSinceSnooze >= SNOOZE_DAYS;
  const dismiss = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {
      // opslag niet beschikbaar
    }
    rerender((n) => n + 1);
  };
  return { shouldShow, daysSinceBackup: daysSinceBackup === null ? null : Math.floor(daysSinceBackup), dismiss };
}
