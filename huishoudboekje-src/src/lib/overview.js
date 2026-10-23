// Rekenwerk voor het Overzicht: perioden, samenvattingen, budgetten en "nog over deze maand".
// Datums zijn "YYYY-MM-DD"-teksten en worden als tekst vergeleken (geen tijdzone-gedoe).
import { MONTHS, MONTHS_SHORT, UNCATEGORIZED, sortNl, toIsoDate } from "./format";

const pad = (n) => String(n).padStart(2, "0");
const round = (n) => Math.round(n * 100) / 100;
export const monthStart = (y, m) => `${y}-${pad(m + 1)}-01`;
export const monthEnd = (y, m) => `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`;
const daysBetween = (from, to) => {
  const [a, b] = [from, to].map((s) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d) / 864e5;
  });
  return b - a + 1;
};
const addDays = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  return toIsoDate(new Date(y, m - 1, d + n));
};
export const todayIso = () => toIsoDate(new Date());

export const PERIOD_KINDS = [
  { value: "month", label: "Maand" },
  { value: "ytd", label: "Jaar tot nu" },
  { value: "year", label: "Heel jaar" },
  { value: "custom", label: "Eigen periode" },
];

// Standaardperiode: de maand van de laatste transactie (= laatste import). Staat die in de
// huidige maand en is het nog vroeg in de maand, dan de maand ervoor - bedoeld om terug te kijken.
export function defaultPeriod(transactions, now = new Date()) {
  const latest = transactions.reduce((max, t) => (!t.expected && t.date > max ? t.date : max), "");
  let y = now.getFullYear();
  let m = now.getMonth();
  if (latest) {
    const [ly, lm] = latest.split("-").map(Number);
    y = ly;
    m = lm - 1;
  }
  if (y === now.getFullYear() && m === now.getMonth() && now.getDate() <= 7) {
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  return { kind: "month", year: y, month: m };
}

// Begin, eind en omschrijving van een periode.
export function periodRange(period) {
  const { kind, year, month } = period;
  if (kind === "month")
    return {
      from: monthStart(year, month),
      to: monthEnd(year, month),
      label: `${MONTHS[month].toLowerCase()} ${year}`,
    };
  if (kind === "ytd") {
    const now = new Date();
    const to = year === now.getFullYear() ? todayIso() : `${year}-12-31`;
    return { from: `${year}-01-01`, to, label: `${year} tot en met ${formatShort(to)}` };
  }
  if (kind === "year") return { from: `${year}-01-01`, to: `${year}-12-31`, label: String(year) };
  const from = period.from || todayIso();
  const to = period.to && period.to >= from ? period.to : from;
  return { from, to, label: `${formatShort(from)} - ${formatShort(to)}` };
}
const formatShort = (iso) => `${Number(iso.slice(8))} ${MONTHS_SHORT[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

// Periode één stap vooruit of terug (maand of jaar; eigen periode schuift met zijn lengte).
export function shiftPeriod(period, dir) {
  if (period.kind === "month") {
    const d = new Date(period.year, period.month + dir, 1);
    return { ...period, year: d.getFullYear(), month: d.getMonth() };
  }
  if (period.kind === "custom") {
    const { from, to } = periodRange(period);
    const len = daysBetween(from, to);
    return { ...period, from: addDays(from, dir * len), to: addDays(to, dir * len) };
  }
  return { ...period, year: period.year + dir };
}

// Vergelijkingsperiode: vorige maand, zelfde stuk vorig jaar, vorig jaar, of de periode ervoor.
// Loopt de gekozen maand nog, dan vergelijken we met dezelfde dagen van de vorige maand
// (1 t/m vandaag), anders zou een halve maand tegen een hele maand worden afgezet.
export function comparisonRange(period, today = todayIso()) {
  if (period.kind === "month") {
    const prev = periodRange(shiftPeriod(period, -1));
    const cur = periodRange(period);
    if (today >= cur.from && today < cur.to) {
      const day = Math.min(Number(today.slice(8)), Number(prev.to.slice(8)));
      return { from: prev.from, to: `${prev.from.slice(0, 8)}${pad(day)}`, label: `1-${day} ${prev.label}` };
    }
    return prev;
  }
  if (period.kind === "custom") return periodRange(shiftPeriod(period, -1));
  const { from, to } = periodRange(period);
  const back = (iso) => `${Number(iso.slice(0, 4)) - 1}${iso.slice(4)}`.replace("-02-29", "-02-28");
  return {
    from: back(from),
    to: back(to),
    label: period.kind === "ytd" ? `zelfde periode ${period.year - 1}` : String(period.year - 1),
  };
}

// Categorieën die per saldo uitgaven zijn (over alle tijd). Een positief bedrag daarin is een
// terugbetaling (retour, vergoeding) en verlaagt de uitgaven, in plaats van als inkomen te tellen.
export function expenseCategories(transactions) {
  const net = new Map();
  transactions.forEach((t) => {
    if (!t.category) return;
    net.set(t.category, (net.get(t.category) || 0) + t.amount);
  });
  return new Set([...net].filter(([, v]) => v < 0).map(([c]) => c));
}

// Samenvatting van een periode. Categorieën met "Niet als uitgave" (bv. Sparen) tellen
// in geen van beide richtingen mee.
export function summarize(transactions, { from, to }, { excludedCategories = [], fixedCategories = [], expenseCats }) {
  const excluded = new Set(excludedCategories);
  let income = 0;
  let spent = 0;
  let refunds = 0;
  const byCategory = new Map();
  const tx = [];
  for (const t of transactions) {
    if (t.date < from || t.date > to) continue;
    const cat = t.category || UNCATEGORIZED;
    if (excluded.has(t.category)) continue;
    tx.push(t);
    if (t.amount < 0) {
      spent -= t.amount;
      byCategory.set(cat, (byCategory.get(cat) || 0) - t.amount);
    } else if (t.category && expenseCats.has(t.category)) {
      refunds += t.amount;
      byCategory.set(cat, (byCategory.get(cat) || 0) - t.amount);
    } else {
      income += t.amount;
    }
  }
  const expenses = round(spent - refunds);
  const categories = [...byCategory]
    .map(([naam, v]) => ({ naam, bedrag: round(v) }))
    .filter((c) => c.bedrag > 0)
    .sort((a, b) => b.bedrag - a.bedrag);
  const fixed = round(categories.filter((c) => fixedCategories.includes(c.naam)).reduce((s, c) => s + c.bedrag, 0));
  return {
    income: round(income),
    expenses,
    refunds: round(refunds),
    balance: round(income - expenses),
    fixed,
    categories,
    tx,
  };
}

// Relatieve verandering t.o.v. een vorige waarde (null als niet zinvol).
export const change = (now, before) => (before > 0.005 ? (now - before) / before : null);

// Hoeveel van de periode is verstreken (1 = helemaal).
export function elapsedFraction({ from, to }, today = todayIso()) {
  if (today >= to) return 1;
  if (today < from) return 0;
  return daysBetween(from, today) / daysBetween(from, to);
}

// Aantal maanden in een periode (voor maandbudgetten), op dagen nauwkeurig.
export function monthsIn({ from, to }) {
  let months = 0;
  let [y, m] = from.split("-").map(Number);
  m -= 1;
  while (monthStart(y, m) <= to) {
    const s = monthStart(y, m) < from ? from : monthStart(y, m);
    const e = monthEnd(y, m) > to ? to : monthEnd(y, m);
    months += daysBetween(s, e) / daysBetween(monthStart(y, m), monthEnd(y, m));
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return months;
}

// Budgetten voor een periode. Bij "jaar tot nu" en een lopende periode tellen alleen de
// verstreken maanden mee, zodat u niet ten onrechte ruim binnen budget lijkt. Terugbetalingen
// zijn al verrekend (summary.categories is netto). Voor een lopende periode ook een verwachting.
export function budgetRows(budgets, summary, range, today = todayIso()) {
  const fraction = elapsedFraction(range, today);
  const running = fraction < 1 && fraction > 0;
  const months = monthsIn({ from: range.from, to: running ? today : range.to });
  const fullMonths = monthsIn(range);
  const spentBy = new Map(summary.categories.map((c) => [c.naam, c.bedrag]));
  const rows = Object.entries(budgets)
    .filter(([, v]) => v > 0)
    .map(([naam, monthly]) => {
      const budget = round(monthly * months);
      const besteed = round(spentBy.get(naam) || 0);
      const periodBudget = round(monthly * fullMonths);
      const projected = running ? round(besteed / fraction) : null;
      return {
        naam,
        budget,
        besteed,
        pct: budget > 0 ? besteed / budget : 0,
        periodBudget,
        projected,
        projectedOver: projected !== null ? round(projected - periodBudget) : null,
      };
    })
    .sort((a, b) => b.pct - a.pct);
  const total = rows.reduce((t, r) => ({ budget: t.budget + r.budget, besteed: t.besteed + r.besteed }), {
    budget: 0,
    besteed: 0,
  });
  return { rows, total: { budget: round(total.budget), besteed: round(total.besteed) }, running, fraction };
}

// Vaste lasten en abonnementen die in de lopende maand nog verwacht worden (nog niet betaald).
export function stillExpected(recurringItems, range, today = todayIso()) {
  return recurringItems
    .filter((i) => i.active && i.nextExpected >= range.from && i.nextExpected <= range.to && i.lastDate < range.from)
    .map((i) => ({ name: i.name, amount: i.amount, date: i.nextExpected, late: i.nextExpected < today }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// Opvallende verschuivingen per categorie. Bij een maand: t.o.v. het gemiddelde van de 6 maanden
// ervoor; anders t.o.v. de vergelijkingsperiode. Alleen als het verschil minstens €25 én 25% is
// (of een categorie nieuw is met minstens €50). Hooguit 3, grootste verschil eerst.
export function categoryShifts(transactions, period, range, compareRange, opts) {
  const cur = summarize(transactions, range, opts);
  let baseline;
  let baselineLabel;
  if (period.kind === "month") {
    const totals = new Map();
    for (let i = 1; i <= 6; i++) {
      const d = new Date(period.year, period.month - i, 1);
      summarize(
        transactions,
        { from: monthStart(d.getFullYear(), d.getMonth()), to: monthEnd(d.getFullYear(), d.getMonth()) },
        opts,
      ).categories.forEach((c) => totals.set(c.naam, (totals.get(c.naam) || 0) + c.bedrag));
    }
    baseline = new Map([...totals].map(([k, v]) => [k, v / 6]));
    baselineLabel = "gemiddeld per maand (6 mnd)";
  } else {
    baseline = new Map(summarize(transactions, compareRange, opts).categories.map((c) => [c.naam, c.bedrag]));
    baselineLabel = compareRange.label;
  }
  const names = new Set([...cur.categories.map((c) => c.naam), ...baseline.keys()]);
  const nowBy = new Map(cur.categories.map((c) => [c.naam, c.bedrag]));
  const shifts = [];
  for (const naam of names) {
    const now = nowBy.get(naam) || 0;
    const before = baseline.get(naam) || 0;
    const diff = now - before;
    if (before < 0.005) {
      if (now >= 50) shifts.push({ naam, now: round(now), before: 0, diff: round(diff), pct: null });
      continue;
    }
    if (Math.abs(diff) >= 25 && Math.abs(diff) / before >= 0.25)
      shifts.push({ naam, now: round(now), before: round(before), diff: round(diff), pct: diff / before });
  }
  shifts.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  return { shifts: shifts.slice(0, 3), baselineLabel };
}

// Staan er (echte) transacties in deze periode?
export const hasDataIn = (transactions, { from, to }) =>
  transactions.some((t) => !t.expected && t.date >= from && t.date <= to);

// Loopt periode A nog (vandaag valt erin), dan periode B inkorten tot hetzelfde aantal dagen,
// zodat een halve maand niet tegen een hele maand wordt afgezet.
export function alignRange(rangeA, rangeB, today = todayIso()) {
  if (!(today >= rangeA.from && today < rangeA.to)) return { range: rangeB, aligned: false };
  const days = daysBetween(rangeA.from, today);
  const to = addDays(rangeB.from, days - 1);
  if (to >= rangeB.to) return { range: rangeB, aligned: false };
  return { range: { ...rangeB, to }, aligned: true, days };
}

// Opgeteld verloop van de uitgaven (terugbetalingen verrekend) per dag of per maand vanaf het
// begin van de periode. Geeft een lijst met cumulatieve bedragen.
export function cumulativeExpenses(transactions, { from, to }, { excludedCategories = [], expenseCats }, byDay) {
  const excluded = new Set(excludedCategories);
  const steps = byDay ? daysBetween(from, to) : Math.round(monthsIn({ from, to }) + 0.49);
  const buckets = new Array(Math.max(1, steps)).fill(0);
  for (const t of transactions) {
    if (t.date < from || t.date > to || excluded.has(t.category)) continue;
    let value = 0;
    if (t.amount < 0) value = -t.amount;
    else if (t.category && expenseCats.has(t.category)) value = -t.amount;
    else continue;
    const idx = byDay
      ? daysBetween(from, t.date) - 1
      : (Number(t.date.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
        Number(t.date.slice(5, 7)) -
        Number(from.slice(5, 7));
    if (idx >= 0 && idx < buckets.length) buckets[idx] += value;
  }
  let sum = 0;
  return buckets.map((v) => (sum = round(sum + v)));
}

// Netto naar de spaarrekening(en) overgemaakt in een periode.
export function savedIn(transactions, { from, to }, savingsCategories) {
  const cats = new Set(savingsCategories);
  return round(
    transactions
      .filter((t) => cats.has(t.category) && t.date >= from && t.date <= to)
      .reduce((s, t) => s - t.amount, 0),
  );
}

// Verwachting voor het einde van de lopende maand (vanaf ongeveer de 5e, eerder is het te grillig).
// Inkomsten: wat er al is, of het gemiddelde van de 3 maanden ervoor als dat hoger is (salaris
// nog niet binnen). Uitgaven: tot nu + nog verwachte vaste betalingen + de overige uitgaven
// doorgetrokken naar de hele maand. Geeft null als er (nog) geen verwachting te geven is.
export function forecastMonth(transactions, { period, cur, expectedSum, fraction, running }, opts) {
  if (!running || fraction < 0.13) return null;
  const incomes = [1, 2, 3]
    .map((i) => {
      const d = new Date(period.year, period.month - i, 1);
      const r = { from: monthStart(d.getFullYear(), d.getMonth()), to: monthEnd(d.getFullYear(), d.getMonth()) };
      return summarize(transactions, r, opts).income;
    })
    .filter((v) => v > 0);
  const typical = incomes.length > 0 ? incomes.reduce((a, b) => a + b, 0) / incomes.length : 0;
  const income = Math.max(cur.income, typical);
  const variable = Math.max(0, cur.expenses - cur.fixed);
  const expenses = cur.expenses + expectedSum + (variable / fraction - variable);
  return { income: round(income), expenses: round(expenses), balance: round(income - expenses), incomeAssumed: typical > cur.income };
}

// Grafiekreeks voor het Overzicht: 12 maanden t/m de gekozen maand, of de maanden van het gekozen
// jaar / de eigen periode (hooguit 24), met opgebouwd saldo en de uitgaven van een jaar eerder.
export function overviewSeries(transactions, period, range, opts) {
  const [ey, em] = range.to.split("-").map(Number);
  const [fy, fm] = range.from.split("-").map(Number);
  let start;
  let count;
  if (period.kind === "month") {
    const d = new Date(ey, em - 1 - 11, 1);
    start = [d.getFullYear(), d.getMonth()];
    count = 12;
  } else {
    start = [fy, fm - 1];
    count = Math.min(24, (ey - fy) * 12 + (em - fm) + 1);
  }
  const rows = monthlySeries(transactions, start, count, opts);
  const lastYear = monthlySeries(transactions, [start[0] - 1, start[1]], count, opts);
  let running = 0;
  return rows.map((r, i) => {
    running += r.Inkomsten - r.Uitgaven;
    return { ...r, "Opgebouwd saldo": running, "Uitgaven jaar eerder": lastYear[i].Uitgaven };
  });
}

// Categorieën met uitgaven (over alle tijd), alfabetisch: de keuzelijst bij "Trend per categorie".
export function spendingCategories(transactions) {
  const names = new Set();
  transactions.filter((t) => t.amount < 0).forEach((t) => names.add(t.category || UNCATEGORIZED));
  return sortNl([...names]);
}

// Uitgaven van één categorie per maand, van de eerste tot de laatste maand met transacties.
export function categoryTrend(transactions, category) {
  if (!category || transactions.length === 0) return [];
  const dates = transactions
    .map((t) => t.date)
    .filter(Boolean)
    .sort();
  if (dates.length === 0) return [];
  const [fy, fm] = dates[0].split("-").map(Number);
  const [ly, lm] = dates[dates.length - 1].split("-").map(Number);
  const rows = [];
  for (let y = fy, m = fm - 1; y * 12 + m <= ly * 12 + lm - 1; m++) {
    if (m > 11) {
      m = 0;
      y++;
    }
    const key = `${y}-${pad(m + 1)}`;
    const total = transactions
      .filter((t) => t.amount < 0 && (t.category || UNCATEGORIZED) === category && t.date.startsWith(key))
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    rows.push({ label: `${MONTHS_SHORT[m]} '${String(y).slice(2)}`, Uitgaven: round(total) });
  }
  return rows;
}

// Inkomsten en uitgaven per maand over een reeks maanden (voor de grafiek).
export function monthlySeries(transactions, fromMonth, count, opts) {
  const rows = [];
  let [y, m] = fromMonth;
  for (let i = 0; i < count; i++) {
    const s = summarize(transactions, { from: monthStart(y, m), to: monthEnd(y, m) }, opts);
    rows.push({
      key: `${y}-${pad(m + 1)}`,
      naam: `${MONTHS_SHORT[m]} '${String(y).slice(2)}`,
      Inkomsten: Math.round(s.income),
      Uitgaven: Math.round(s.expenses),
    });
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return rows;
}
