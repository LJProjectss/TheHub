// Rekenwerk voor de pagina Vergelijken: snelkeuzes, verschillen per categorie en de reeksen
// voor de grafieken (opgeteld verloop, maand naast maand, één categorie per maand).
import { MONTHS_SHORT } from "./format";
import { cumulativeExpenses, defaultPeriod, monthEnd, monthStart, monthsIn, periodRange, shiftPeriod, summarize } from "./overview";

const round = (n) => Math.round(n * 100) / 100;
const back = (iso) => `${Number(iso.slice(0, 4)) - 1}${iso.slice(4)}`.replace("-02-29", "-02-28");

// Bereik van een periode; een eigen label (bv. "zelfde periode 2025") gaat voor.
export const rangeOf = (period) => {
  const r = periodRange(period);
  return period.label ? { ...r, label: period.label } : r;
};

// Snelkeuzes, afgeleid van de laatste maand met gegevens (= laatste import).
export function buildPresets(transactions, now = new Date()) {
  const last = defaultPeriod(transactions, now);
  const lastLabel = periodRange(last).label;
  const y = now.getFullYear();
  const ytd = periodRange({ kind: "ytd", year: y });
  return [
    {
      key: "prev-month",
      title: "Laatste maand vs. de maand ervoor",
      a: last,
      b: shiftPeriod(last, -1),
    },
    {
      key: "month-last-year",
      title: "Laatste maand vs. dezelfde maand vorig jaar",
      a: last,
      b: { kind: "month", year: last.year - 1, month: last.month },
    },
    {
      key: "ytd",
      title: "Dit jaar tot nu vs. vorig jaar tot nu",
      a: { kind: "ytd", year: y },
      b: { kind: "custom", from: back(ytd.from), to: back(ytd.to), label: `zelfde periode ${y - 1}` },
    },
    {
      key: "last-year",
      title: "Vorig jaar vs. het jaar daarvoor",
      a: { kind: "year", year: y - 1 },
      b: { kind: "year", year: y - 2 },
    },
  ].map((p) => ({ ...p, lastLabel }));
}

// Uitgaven per categorie in A en B (eventueel per maand geschaald), met verschil en of een
// categorie nieuw of verdwenen is; grootste verschil eerst.
export function compareCategories(categoriesA, categoriesB, scaleA = 1, scaleB = 1) {
  const aBy = new Map(categoriesA.map((c) => [c.naam, c.bedrag]));
  const bBy = new Map(categoriesB.map((c) => [c.naam, c.bedrag]));
  return [...new Set([...aBy.keys(), ...bBy.keys()])]
    .map((naam) => {
      const a = round((aBy.get(naam) || 0) * scaleA);
      const b = round((bBy.get(naam) || 0) * scaleB);
      return { naam, a, b, diff: round(a - b), status: b === 0 ? "nieuw" : a === 0 ? "verdwenen" : null };
    })
    .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
}

// Opgeteld verloop van de uitgaven van A en B, per dag of per maand vanaf het begin.
// A loopt tot vandaag (effectiveA); de lengte is die van de volledige periode A of B.
export function cumulativeComparison(transactions, { rangeA, effectiveA, rawB }, opts, byDay) {
  const a = cumulativeExpenses(transactions, effectiveA, opts, byDay);
  const aFull = cumulativeExpenses(transactions, rangeA, opts, byDay).length;
  const b = cumulativeExpenses(transactions, rawB, opts, byDay);
  const length = Math.max(aFull, b.length);
  const [ay, am] = rangeA.from.split("-").map(Number);
  return Array.from({ length }, (_, i) => ({
    x: byDay
      ? `dag ${i + 1}`
      : MONTHS_SHORT[(am - 1 + i) % 12] +
        (i === 0 || (am - 1 + i) % 12 === 0 ? ` '${String(ay + Math.floor((am - 1 + i) / 12)).slice(2)}` : ""),
    A: i < a.length ? a[i] : null,
    B: i < b.length ? b[i] : null,
  }));
}

// Uitgaven maand naast maand (alleen zinvol bij perioden van meerdere maanden), hooguit 24.
export function monthByMonthComparison(transactions, { rangeA, effectiveA, rawB }, opts) {
  const count = Math.round(Math.max(monthsIn(rangeA), monthsIn(rawB)) + 0.49);
  const [ay, am] = rangeA.from.split("-").map(Number);
  const [by, bm] = rawB.from.split("-").map(Number);
  return Array.from({ length: Math.min(count, 24) }, (_, i) => {
    const da = new Date(ay, am - 1 + i, 1);
    const db = new Date(by, bm - 1 + i, 1);
    const ra = { from: monthStart(da.getFullYear(), da.getMonth()), to: monthEnd(da.getFullYear(), da.getMonth()) };
    const rb = { from: monthStart(db.getFullYear(), db.getMonth()), to: monthEnd(db.getFullYear(), db.getMonth()) };
    return {
      x: MONTHS_SHORT[da.getMonth()],
      A: ra.from <= effectiveA.to ? Math.round(summarize(transactions, ra, opts).expenses) : null,
      B: rb.from <= rawB.to ? Math.round(summarize(transactions, rb, opts).expenses) : null,
    };
  });
}

// Verloop per maand van één categorie over beide perioden heen; in = "A", "B" of "".
export function categoryMonthsComparison(transactions, category, { rangeA, rawB }, opts) {
  const start = rangeA.from < rawB.from ? rangeA.from : rawB.from;
  const end = rangeA.to > rawB.to ? rangeA.to : rawB.to;
  const out = [];
  let [y, m] = start.split("-").map(Number);
  m -= 1;
  while (monthStart(y, m) <= end && out.length < 24) {
    const r = { from: monthStart(y, m), to: monthEnd(y, m) };
    const c = summarize(transactions, r, opts).categories.find((x) => x.naam === category);
    const inA = r.to >= rangeA.from && r.from <= rangeA.to;
    const inB = r.to >= rawB.from && r.from <= rawB.to;
    out.push({
      x: `${MONTHS_SHORT[m]} '${String(y).slice(2)}`,
      bedrag: Math.round(c?.bedrag || 0),
      in: inA ? "A" : inB ? "B" : "",
    });
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return out;
}
