// Categorieën hernoemen, samenvoegen en verwijderen. Een categorienaam komt op veel plekken
// voor (transacties, budgetten, regels, spaardoelen, groepen, potjes...); deze functies
// passen ze allemaal tegelijk aan. Ze werken op de gegevens van dataPayload() en geven
// alleen de gewijzigde velden terug.
import { FIELDS } from "./backup";
import { sortNl } from "./format";

const round = (n) => Math.round(n * 100) / 100;

// Alleen de meegegeven velden zetten.
export const applyChanges = (data, changes) =>
  FIELDS.forEach(([key, setter]) => key in changes && data[setter](changes[key]));

// Voor ongedaan maken: de huidige waarde van dezelfde velden. Transacties alleen als
// id -> oude categorie, zodat latere wijzigingen aan transacties niet verloren gaan.
export function snapshotFor(data, changes) {
  const before = {};
  for (const key of Object.keys(changes)) if (key !== "transactions") before[key] = data[key];
  const changedIds = new Set();
  if (changes.transactions) {
    const oldById = new Map(data.transactions.map((t) => [t.id, t.category]));
    changes.transactions.forEach((t) => {
      if (oldById.get(t.id) !== t.category) changedIds.add(t.id);
    });
  }
  const oldCategories = new Map(data.transactions.filter((t) => changedIds.has(t.id)).map((t) => [t.id, t.category]));
  return () => {
    applyChanges(data, before);
    if (oldCategories.size > 0)
      data.setTransactions((list) =>
        list.map((t) => (oldCategories.has(t.id) ? { ...t, category: oldCategories.get(t.id) } : t)),
      );
  };
}

function moveKey(obj, from, to, combine) {
  if (!obj || !(from in obj)) return obj;
  const next = { ...obj };
  next[to] = to in next ? combine(next[to], next[from]) : next[from];
  delete next[from];
  return next;
}

// Hernoemen; bestaat `to` al, dan samenvoegen. Bij samenvoegen houdt de doelcategorie haar eigen
// instellingen (vaste last, niet als uitgave, groep, spaarinstellingen); groep en spaarinstellingen
// van de oude categorie worden alleen overgenomen als de doelcategorie die nog niet had.
// Budgetten en potjes worden bij elkaar opgeteld.
export function renameCategory(d, from, to) {
  const merge = d.categories.includes(to);
  const swap = (c) => (c === from ? to : c);
  const keepOrSwap = (list) =>
    merge ? list.filter((c) => c !== from) : list.map(swap);
  return {
    categories: sortNl([...new Set(d.categories.map(swap))]),
    transactions: d.transactions.map((t) => (t.category === from ? { ...t, category: to } : t)),
    budgets: moveKey(d.budgets, from, to, (a, b) => round(a + b)),
    fixedCategories: keepOrSwap(d.fixedCategories),
    excludedCategories: keepOrSwap(d.excludedCategories),
    categoryRules: d.categoryRules.map((r) => (r.category === from ? { ...r, category: to } : r)),
    recurringRules: d.recurringRules.map((r) => (r.category === from ? { ...r, category: to } : r)),
    savingsGoals: d.savingsGoals.map((g) => (g.category === from ? { ...g, category: to } : g)),
    savingsCategory: swap(d.savingsCategory),
    savingsSettings: moveKey(d.savingsSettings, from, to, (a) => a),
    categoryGroups: moveKey(d.categoryGroups, from, to, (a) => a),
    reserves: moveKey(d.reserves, from, to, (a, b) => ({
      perYear: round((a.perYear || 0) + (b.perYear || 0)),
      since: a.since < b.since ? a.since : b.since,
      start: round((a.start || 0) + (b.start || 0)),
    })),
  };
}

// Verwijderen: transacties worden "niet gecategoriseerd", alle instellingen van de categorie vervallen.
export function deleteCategory(d, name) {
  const without = (obj) => {
    const next = { ...obj };
    delete next[name];
    return next;
  };
  return {
    categories: d.categories.filter((c) => c !== name),
    transactions: d.transactions.map((t) => (t.category === name ? { ...t, category: "" } : t)),
    budgets: without(d.budgets),
    fixedCategories: d.fixedCategories.filter((c) => c !== name),
    excludedCategories: d.excludedCategories.filter((c) => c !== name),
    categoryRules: d.categoryRules.filter((r) => r.category !== name),
    categoryGroups: without(d.categoryGroups),
    reserves: without(d.reserves),
  };
}

// Wat er verloren gaat bij verwijderen, voor de bevestigingsvraag.
export function deleteImpact(d, name) {
  const parts = [];
  const count = d.transactions.filter((t) => t.category === name).length;
  if (count > 0) parts.push(`${count} transactie(s) worden "niet gecategoriseerd"`);
  if (d.budgets[name]) parts.push("het maandbudget vervalt");
  const rules = d.categoryRules.filter((r) => r.category === name).length;
  if (rules > 0) parts.push(`${rules} categorieregel(s) vervallen`);
  if (d.reserves?.[name]) parts.push("het potje vervalt");
  return parts;
}

// Groepen (hoofdcategorieën).
export const groupOf = (groups, category) => (groups && groups[category]) || "";
export const groupNames = (groups) => sortNl([...new Set(Object.values(groups || {}).filter(Boolean))]);
export const categoriesInGroup = (groups, group) =>
  Object.keys(groups || {}).filter((c) => groups[c] === group);

// Waarde van het categoriefilter op de Transacties-pagina voor een hele groep.
export const GROUP_PREFIX = "Groep: ";

// Uitgaven per categorie (uit summarize) samenvoegen per groep; categorieën zonder groep blijven
// los staan. filter = waarde om de transacties van de regel te tonen. Grootste eerst.
export function groupCategoryTotals(categories, groups) {
  const totals = new Map();
  for (const c of categories) {
    const g = groupOf(groups, c.naam);
    const key = g ? `g:${g}` : `c:${c.naam}`;
    const row = totals.get(key) || { naam: g || c.naam, bedrag: 0, filter: g ? GROUP_PREFIX + g : c.naam, isGroup: !!g, parts: [] };
    row.bedrag = Math.round((row.bedrag + c.bedrag) * 100) / 100;
    row.parts.push(c.naam);
    totals.set(key, row);
  }
  return [...totals.values()].sort((a, b) => b.bedrag - a.bedrag);
}
