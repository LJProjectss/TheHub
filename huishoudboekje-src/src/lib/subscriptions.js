// Herkenning van abonnementen en vaste lasten uit terugkerende betalingen.
//
// Werkwijze per omschrijvingspatroon (zie patterns.js):
// 1. Betalingen splitsen op exact bedrag (zo worden twee diensten bij dezelfde partij,
//    bv. iCloud en Apple Music, niet op één hoop gegooid).
// 2. Een reeks telt alleen als het ritme past bij wekelijks/maandelijks/kwartaal/
//    halfjaarlijks/jaarlijks, minstens ~80% van de tussenpozen in dat ritme valt en er
//    hooguit een enkele extra betaling tussen zit. Dagelijkse betalingen met wisselend
//    bedrag (bedrijfsrestaurant, supermarkt) vallen daardoor af.
// 3. Een latere reeks met een ander bedrag die precies aansluit in hetzelfde ritme, is
//    dezelfde dienst met een prijswijziging.
// 4. Geen vast bedrag gevonden? Dan een reeks met beperkt wisselend bedrag: voor vaste lasten
//    (categorie met "Vaste last") ±50% (energie, telefoon), voor abonnementen ±25% met hooguit
//    af en toe een prijswijziging (jaarabonnement dat elk jaar duurder wordt).
// 5. Een partij die veel vaker afrekent dan het ritme (bedrijfsrestaurant, supermarkt) levert
//    nooit een abonnement op, ook niet als één bedrag toevallig regelmatig terugkomt.
import { pattern, patternRaw } from "./patterns";

export const FREQUENCIES = [
  { key: "weekly", label: "wekelijks", days: 7, min: 5, max: 9, perYear: 52, addMonths: 0, minCount: 4, grace: 7 },
  {
    key: "monthly",
    label: "maandelijks",
    days: 30.44,
    min: 25,
    max: 36,
    perYear: 12,
    addMonths: 1,
    minCount: 3,
    grace: 15,
  },
  {
    key: "quarterly",
    label: "per kwartaal",
    days: 91.3,
    min: 80,
    max: 102,
    perYear: 4,
    addMonths: 3,
    minCount: 2,
    grace: 30,
  },
  {
    key: "halfyearly",
    label: "halfjaarlijks",
    days: 182.6,
    min: 165,
    max: 200,
    perYear: 2,
    addMonths: 6,
    minCount: 2,
    grace: 45,
  },
  {
    key: "yearly",
    label: "jaarlijks",
    days: 365.25,
    min: 340,
    max: 390,
    perYear: 1,
    addMonths: 12,
    minCount: 2,
    grace: 60,
  },
];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const round = (n) => Math.round(n * 100) / 100;
export const dayNumber = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 864e5;
};
const isoFromUTCDay = (n) => new Date(n * 864e5).toISOString().slice(0, 10); // UTC-dag -> datum, geen tijdzone-effect
const median = (values) => {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  return n === 0 ? 0 : n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};

// Past een reeks (gesorteerde) datums bij een abonnementsritme? Geeft de frequentie of null.
export function detectRhythm(dates) {
  if (dates.length < 2) return null;
  const days = dates.map(dayNumber);
  const gaps = days.slice(1).map((d, i) => d - days[i]);
  const freq = FREQUENCIES.find((f) => {
    const m = median(gaps);
    return m >= f.min && m <= f.max;
  });
  if (!freq || dates.length < freq.minCount) return null;
  let fitting = 0;
  let short = 0;
  let missed = 0;
  for (const g of gaps) {
    if (g < freq.min) {
      short++;
      continue;
    }
    // Een overgeslagen periode (gat van 2 of 3 perioden) breekt het ritme niet.
    const k = Math.round(g / freq.days);
    if (k >= 1 && k <= 3 && g >= freq.min * k - (k - 1) * 2 && g <= freq.max * k) {
      fitting++;
      missed += k - 1;
    }
  }
  if (fitting / gaps.length < 0.8) return null;
  if (short > Math.max(1, Math.floor(gaps.length * 0.1))) return null;
  return { ...freq, missed };
}

const cents = (t) => Math.round(-t.amount * 100);

// Reeksen met vast bedrag (met eventuele prijswijzigingen) binnen één patroon.
function exactStreams(txs) {
  const byAmount = new Map();
  txs.forEach((t) => {
    const c = cents(t);
    if (!byAmount.has(c)) byAmount.set(c, []);
    byAmount.get(c).push(t);
  });
  const clusters = [...byAmount.values()].sort((a, b) => (a[0].date < b[0].date ? -1 : 1));
  const used = new Set();
  const streams = [];
  for (const cluster of clusters) {
    if (used.has(cluster)) continue;
    let rhythm = detectRhythm(cluster.map((t) => t.date));
    if (!rhythm) continue;
    used.add(cluster);
    let chain = [...cluster];
    const changes = [];
    for (let extended = true; extended;) {
      extended = false;
      const lastDay = dayNumber(chain[chain.length - 1].date);
      for (const next of clusters) {
        if (used.has(next)) continue;
        const gap = dayNumber(next[0].date) - lastDay;
        if (gap < rhythm.min || gap > rhythm.max * 2) continue;
        const r = detectRhythm([...chain, ...next].map((t) => t.date));
        if (r && r.key === rhythm.key) {
          changes.push({ from: -chain[chain.length - 1].amount, to: -next[0].amount, date: next[0].date });
          chain = [...chain, ...next];
          used.add(next);
          rhythm = r;
          extended = true;
          break;
        }
      }
    }
    streams.push({ txs: chain, rhythm, changes, variable: false });
  }
  return streams;
}

// Reeks met een niet-vast bedrag:
// - vaste lasten (fixed): bedrag mag schommelen (energie, telefoon) binnen ±50%;
// - abonnementen: bedrag binnen ±25% en het verandert maar zelden (bv. jaarabonnement dat
//   elk jaar iets duurder wordt). Een kapper met elke keer een ander bedrag valt zo af.
// Uitschieters (bv. een losse jaarafrekening) worden eerst apart gezet, anders breken ze het ritme.
function variableStream(txs, fixed) {
  const tolerance = fixed ? 0.5 : 0.25;
  const mid = median(txs.map((t) => -t.amount));
  const kept = txs.filter((t) => Math.abs(-t.amount - mid) <= mid * tolerance);
  if (kept.length < 2 || kept.length / txs.length < 0.7) return null;
  const rhythm = detectRhythm(kept.map((t) => t.date));
  if (!rhythm) return null;
  const changes = [];
  for (let i = 1; i < kept.length; i++)
    if (cents(kept[i]) !== cents(kept[i - 1]))
      changes.push({ from: -kept[i - 1].amount, to: -kept[i].amount, date: kept[i].date });
  if (!fixed && changes.length > Math.max(1, Math.floor(kept.length / 3))) return null;
  return { txs: kept, rhythm, changes: fixed ? [] : changes, variable: fixed };
}

// Extra controles op een gevonden reeks:
// - niet te veel overgeslagen perioden;
// - de partij zelf rekent niet veel vaker af dan het ritme (bedrijfsrestaurant dat dagelijks
//   afschrijft: ook als één bedrag toevallig wekelijks terugkomt, is het geen abonnement).
function plausible(stream, groupTxs) {
  const { txs, rhythm } = stream;
  if (rhythm.missed > Math.max(1, Math.floor(txs.length * 0.25))) return false;
  const from = dayNumber(txs[0].date);
  const to = dayNumber(txs[txs.length - 1].date);
  const periods = (to - from) / rhythm.days + 1;
  const inSpan = groupTxs.filter((t) => {
    const d = dayNumber(t.date);
    return d >= from && d <= to;
  }).length;
  return inSpan / periods <= 3;
}

function addToDate(iso, freq) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!freq.addMonths) return isoFromUTCDay(dayNumber(iso) + freq.days);
  const target = new Date(Date.UTC(y, m - 1 + freq.addMonths, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

// Categorieën die als spaarrekening dienen (tellen nooit als abonnement): de gekozen spaarrekening
// en de categorieën van de spaardoelen. Achtergebleven spaarinstellingen van een categorie die niet
// meer als spaarrekening is gekozen tellen niet mee, anders blijft een verkeerde keuze (bv.
// Boodschappen) onzichtbaar doorwerken nadat u hem heeft gecorrigeerd.
export function savingsCategoriesOf({ savingsCategory, savingsGoals = [] }) {
  return [...new Set([savingsCategory, ...savingsGoals.map((g) => g.category)].filter(Boolean))];
}

// De opties voor detectRecurring, afgeleid uit de app-gegevens.
export function recurringOptions(data) {
  return {
    fixedCategories: data.fixedCategories || [],
    excludedCategories: data.excludedCategories || [],
    savingsCategories: savingsCategoriesOf(data),
  };
}

// Dagen van vandaag tot een datum (negatief = verstreken).
export const daysFromToday = (iso) => {
  const now = new Date();
  return dayNumber(iso) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 864e5;
};

// Hoofdfunctie. Geeft { items, referenceDate }.
// referenceDate = datum van de meest recente transactie: "gestopt" wordt daartegen afgezet,
// zodat abonnementen niet ten onrechte gestopt lijken als u een tijd niet heeft geïmporteerd.
export function detectRecurring(
  transactions,
  { fixedCategories = [], excludedCategories = [], savingsCategories = [] } = {},
) {
  const real = transactions.filter((t) => !t.expected && ISO.test(t.date || ""));
  const referenceDate = real.reduce((max, t) => (t.date > max ? t.date : max), "");
  const skip = new Set([...excludedCategories, ...savingsCategories]);
  const groups = new Map();
  real
    .filter((t) => t.amount < 0 && !skip.has(t.category))
    .forEach((t) => {
      const p = pattern(t.description);
      if (!p) return;
      if (!groups.has(p)) groups.set(p, []);
      groups.get(p).push(t);
    });

  const items = [];
  for (const [p, list] of groups) {
    if (list.length < 2) continue;
    const txs = [...list].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const latestCategory = txs[txs.length - 1].category || "";
    let streams = exactStreams(txs).filter((s) => plausible(s, txs));
    if (streams.length === 0) {
      const v = variableStream(txs, fixedCategories.includes(latestCategory));
      if (v && plausible(v, txs)) streams = [v];
    }
    for (const s of streams) {
      const last = s.txs[s.txs.length - 1];
      const category = last.category || "";
      const amount = s.variable ? round(median(s.txs.slice(-3).map((t) => -t.amount))) : -last.amount;
      const nextExpected = addToDate(last.date, s.rhythm);
      const stopped = referenceDate && dayNumber(referenceDate) > dayNumber(nextExpected) + s.rhythm.grace;
      items.push({
        key: `${p}|${s.variable ? "var" : cents(s.txs[0])}`,
        pattern: p,
        name: patternRaw(last.description),
        category,
        kind: fixedCategories.includes(category) ? "fixed" : "subscription",
        frequency: s.rhythm,
        amount,
        variable: s.variable,
        perMonth: round((amount * s.rhythm.perYear) / 12),
        perYear: round(amount * s.rhythm.perYear),
        count: s.txs.length,
        totalPaid: round(s.txs.reduce((sum, t) => sum - t.amount, 0)),
        firstDate: s.txs[0].date,
        lastDate: last.date,
        nextExpected,
        active: !stopped,
        missed: s.rhythm.missed,
        priceChanges: s.changes,
        txIds: s.txs.map((t) => t.id),
      });
    }
  }
  items.sort((a, b) => b.perMonth - a.perMonth);
  return { items, referenceDate };
}

// Patronen die als "geen abonnement" zijn gemarkeerd. Oudere sleutels ("omschrijving|centen")
// worden omgezet naar alleen het patroon, zodat een prijswijziging ze niet terugbrengt.
export function ignoredPatterns(dismissed = []) {
  return new Set(
    dismissed.map((k) => {
      const i = k.lastIndexOf("|");
      return pattern(i < 0 ? k : k.slice(0, i));
    }),
  );
}

// Verschil tussen twee detecties (voor meldingen na een import): nieuwe terugkerende betalingen
// en nieuwe prijswijzigingen.
export function diffRecurring(before, after, ignored = new Set()) {
  const beforeByKey = new Map(before.items.map((i) => [i.key, i]));
  const added = [];
  const priceChanges = [];
  for (const item of after.items) {
    if (!item.active || ignored.has(item.pattern)) continue;
    const prev = beforeByKey.get(item.key);
    if (!prev) {
      added.push(item);
      continue;
    }
    const known = new Set(prev.priceChanges.map((c) => c.date));
    item.priceChanges.filter((c) => !known.has(c.date)).forEach((c) => priceChanges.push({ item, change: c }));
  }
  return { added, priceChanges };
}
