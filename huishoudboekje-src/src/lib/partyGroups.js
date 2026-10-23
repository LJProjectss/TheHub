// Categoriseren per partij: alle transacties zonder categorie, gegroepeerd per tegenpartij
// (Albert Heijn, Netflix, ...), zodat u per groep in één keer een categorie kiest.
import { matchCategoryRule, partyName, pattern } from "./patterns";

const round = (n) => Math.round(n * 100) / 100;

export const partyKey = (description) => (partyName(description) || pattern(description)).toLowerCase();

// Groepen, grootste eerst (meeste transacties, dan hoogste totaalbedrag).
// Elke groep: { key, name, items, count, total, from, to, suggestion, suggestionFrom }
// suggestion komt uit een eigen regel ("regel") of uit eerdere keuzes voor dezelfde partij ("eerder").
export function groupUncategorizedByParty(transactions, { rules = [], categories } = {}) {
  // Wat is er eerder gekozen voor dezelfde partij?
  const history = new Map();
  for (const t of transactions) {
    if (!t.category || t.expected || (categories && !categories.includes(t.category))) continue;
    const key = partyKey(t.description);
    if (!key) continue;
    const counts = history.get(key) || new Map();
    counts.set(t.category, (counts.get(t.category) || 0) + 1);
    history.set(key, counts);
  }

  const groups = new Map();
  for (const t of transactions) {
    if (t.category || t.expected) continue;
    const key = partyKey(t.description) || "(geen omschrijving)";
    const g = groups.get(key) || { key, name: partyName(t.description) || t.description || key, items: [] };
    g.items.push(t);
    groups.set(key, g);
  }

  return [...groups.values()]
    .map((g) => {
      const dates = g.items.map((t) => t.date).sort();
      const fromRule = matchCategoryRule(g.items[0].description, rules, categories);
      const earlier = history.get(g.key);
      const fromHistory = earlier ? [...earlier].sort((a, b) => b[1] - a[1])[0][0] : null;
      return {
        ...g,
        items: [...g.items].sort((a, b) => (a.date < b.date ? 1 : -1)),
        count: g.items.length,
        total: round(g.items.reduce((s, t) => s + t.amount, 0)),
        from: dates[0],
        to: dates.at(-1),
        suggestion: fromRule || fromHistory || "",
        suggestionFrom: fromRule ? "regel" : fromHistory ? "eerder" : null,
      };
    })
    .sort((a, b) => b.count - a.count || Math.abs(b.total) - Math.abs(a.total));
}

// Bestaat er al een eigen regel met dit trefwoord?
export const hasRule = (rules, text) =>
  rules.some((r) => (r.contains || "").trim().toLowerCase() === String(text).trim().toLowerCase());

// Een regel op de naam van de partij heeft alleen zin met een herkenbare naam.
export const canMakeRule = (name) => String(name || "").trim().length >= 3;

// Snelkeuze voor het categoriseren één voor één: het voorstel (eigen regel of eerdere keuze voor
// dezelfde partij) en daarna de meest gebruikte categorieën van het afgelopen halfjaar met
// hetzelfde teken (uitgaven bij een afschrijving, inkomsten bij een bijschrijving).
export function quickCategories(t, transactions, { rules = [], categories, count = 8, today = new Date() } = {}) {
  const since = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate()).toISOString().slice(0, 10);
  const key = partyKey(t.description);
  const usage = new Map();
  const party = new Map();
  for (const o of transactions) {
    if (!o.category || o.expected || (categories && !categories.includes(o.category))) continue;
    if (key && partyKey(o.description) === key) party.set(o.category, (party.get(o.category) || 0) + 1);
    if (o.date < since || Math.sign(o.amount) !== Math.sign(t.amount)) continue;
    usage.set(o.category, (usage.get(o.category) || 0) + 1);
  }
  const fromParty = [...party].sort((a, b) => b[1] - a[1])[0]?.[0];
  const suggestion = matchCategoryRule(t.description, rules, categories) || fromParty || "";
  const top = [...usage].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "nl")).map(([c]) => c);
  const list = [suggestion, ...top].filter((c, i, all) => c && all.indexOf(c) === i).slice(0, count);
  return { suggestion, list };
}
