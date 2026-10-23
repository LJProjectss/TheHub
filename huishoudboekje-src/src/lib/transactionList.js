// Rekenwerk voor de lijst op de Transacties-pagina: snelkeuzes voor de periode, zoeken
// (ook op bedrag), filteren en sorteren, totalen en groeperen per maand.
import { MONTHS, UNCATEGORIZED, toIsoDate } from "./format";
import { parseInputAmount } from "./csv";
import { GROUP_PREFIX, groupOf } from "./categories";

export const EMPTY_FILTERS = {
  search: "",
  category: "",
  dateFrom: "",
  dateTo: "",
  amountMin: "",
  amountMax: "",
  type: "",
  tag: "",
  account: "",
  onlyAuto: false,
  onlyExpected: false,
};
export const DEFAULT_SORT = { key: "date", dir: "desc" };
// Richting bij de eerste klik op een kolom: datum nieuwste eerst, bedrag grootste uitgaven eerst.
export const FIRST_DIR = { date: "desc", description: "asc", amount: "asc" };
export const SORT_OPTIONS = [
  { label: "Nieuwste eerst", key: "date", dir: "desc" },
  { label: "Oudste eerst", key: "date", dir: "asc" },
  { label: "Grootste uitgaven eerst", key: "amount", dir: "asc" },
  { label: "Grootste inkomsten eerst", key: "amount", dir: "desc" },
  { label: "Omschrijving A-Z", key: "description", dir: "asc" },
  { label: "Omschrijving Z-A", key: "description", dir: "desc" },
];
export const TYPE_OPTIONS = { Inkomsten: "inkomst", Uitgaven: "uitgave" };

// Alle filters toepassen en sorteren. Bij gelijke waarde komt de nieuwste transactie eerst.
// Het categoriefilter kan ook een hele groep zijn ("Groep: Wonen").
export function filterTransactions(transactions, filters, sort, categoryGroups = {}) {
  const f = filters;
  const q = f.search.trim().toLowerCase();
  const qAmount = q ? searchAmount(q) : null;
  const minAmount = f.amountMin === "" ? null : parseInputAmount(f.amountMin);
  const maxAmount = f.amountMax === "" ? null : parseInputAmount(f.amountMax);
  const dir = sort.dir === "asc" ? 1 : -1;
  const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const compare = {
    date: byDate,
    description: (a, b) => a.description.localeCompare(b.description, "nl", { sensitivity: "base" }),
    amount: (a, b) => a.amount - b.amount,
  }[sort.key];
  const group = f.category.startsWith(GROUP_PREFIX) ? f.category.slice(GROUP_PREFIX.length) : null;
  const tag = f.tag.toLowerCase();
  return transactions
    .filter((t) => !f.onlyAuto || (t.autoCategorized && t.category))
    .filter((t) => !f.onlyExpected || t.expected)
    .filter((t) => !q || matchesSearch(t, q, qAmount))
    .filter((t) =>
      !f.category
        ? true
        : group !== null
          ? !!t.category && groupOf(categoryGroups, t.category) === group
          : (t.category || UNCATEGORIZED) === f.category,
    )
    .filter((t) => !tag || (t.tags || []).some((x) => x.toLowerCase() === tag))
    .filter((t) => !f.account || t.account === f.account)
    .filter((t) => !f.dateFrom || t.date >= f.dateFrom)
    .filter((t) => !f.dateTo || t.date <= f.dateTo)
    .filter((t) => !f.type || (f.type === "inkomst" ? t.amount >= 0 : t.amount < 0))
    .filter((t) => minAmount === null || Math.abs(t.amount) >= Math.abs(minAmount))
    .filter((t) => maxAmount === null || Math.abs(t.amount) <= Math.abs(maxAmount))
    .sort((a, b) => dir * compare(a, b) || byDate(b, a));
}

export function periodPresets(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const preset = (label, from, to) => ({ label, from: toIsoDate(from), to: toIsoDate(to) });
  return [
    preset("Deze maand", new Date(y, m, 1), new Date(y, m + 1, 0)),
    preset("Vorige maand", new Date(y, m - 1, 1), new Date(y, m, 0)),
    preset("Laatste 3 maanden", new Date(y, m - 2, 1), new Date(y, m + 1, 0)),
    preset("Dit jaar", new Date(y, 0, 1), new Date(y, 11, 31)),
    preset("Vorig jaar", new Date(y - 1, 0, 1), new Date(y - 1, 11, 31)),
  ];
}

// Een zoekterm die op een bedrag lijkt ("12", "12,50", "1.250"): met decimalen exact op de cent,
// zonder decimalen alle bedragen met dat aantal hele euro's. Anders null.
export function searchAmount(query) {
  const s = query.replace(/[€\s+-]/g, "");
  let m = s.match(/^(\d+)([.,](\d{1,2}))?$/);
  if (!m) {
    m = s.match(/^(\d{1,3}(?:\.\d{3})+)(,(\d{1,2}))?$/);
    if (!m) return null;
    m[1] = m[1].replace(/\./g, "");
  }
  return m[3] !== undefined ? { cents: Math.round(Number(`${m[1]}.${m[3]}`) * 100) } : { euros: Number(m[1]) };
}

// q = zoekterm in kleine letters, amount = searchAmount(q).
export function matchesSearch(t, q, amount) {
  if (
    t.description.toLowerCase().includes(q) ||
    (t.note || "").toLowerCase().includes(q) ||
    (t.category || "").toLowerCase().includes(q) ||
    (t.tags || []).some((tag) => tag.toLowerCase().includes(q))
  )
    return true;
  if (!amount) return false;
  const abs = Math.abs(t.amount);
  return amount.cents !== undefined ? Math.round(abs * 100) === amount.cents : Math.floor(abs) === amount.euros;
}

// Totalen zonder verwachte (nog niet echt geboekte) transacties, net als op het Overzicht.
export function sumTotals(list) {
  let income = 0;
  let expense = 0;
  let expected = 0;
  for (const t of list) {
    if (t.expected) expected++;
    else if (t.amount >= 0) income += t.amount;
    else expense += t.amount;
  }
  const r = (v) => Math.round(v * 100) / 100;
  return { income: r(income), expense: r(expense), balance: r(income + expense), expected };
}

// Op datum gesorteerde lijst opdelen in maanden, elk met eigen totalen.
export function groupByMonth(list) {
  const groups = [];
  for (const t of list) {
    const key = t.date.slice(0, 7);
    if (groups.at(-1)?.key !== key) {
      const [y, m] = key.split("-").map(Number);
      groups.push({ key, label: m ? `${MONTHS[m - 1]} ${y}` : "Zonder datum", items: [] });
    }
    groups.at(-1).items.push(t);
  }
  return groups.map((g) => ({ ...g, totals: sumTotals(g.items) }));
}
