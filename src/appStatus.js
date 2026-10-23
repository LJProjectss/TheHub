// Korte status per app voor de tegels op het overzicht.
// De hub leest hiervoor de opgeslagen gegevens van de apps (alleen lezen, nooit schrijven).
// Elke functie geeft een lijst regels terug: { tekst, soort: 'goed' | 'let-op' | 'kritiek' | '' }.
// Lukt het lezen niet (ander formaat, versleuteld), dan volgt een lege lijst en toont de tegel niets extra's.

const ls = () => globalThis.localStorage;

function leesJson(sleutel) {
  try {
    const ruw = ls().getItem(sleutel);
    return ruw ? JSON.parse(ruw) : null;
  } catch {
    return null;
  }
}

const p2 = (n) => String(n).padStart(2, '0');
const isoDatum = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const maandSleutel = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
const maandNaam = (d) => d.toLocaleDateString('nl-NL', { month: 'long' });

const euro = (n) =>
  n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

/* ---------- Huishoudboekje ---------- */

// Uitgaven per categorie in de lopende maand, tegen het maandbudget.
// Zelfde regels als het dashboard van de app: categorieën met "Niet als uitgave" tellen niet mee,
// en een bijschrijving in een categorie met een budget telt als terugbetaling.
export function huishoudboekjeStatus(nu = new Date()) {
  const data = leesJson('huishoudboekje-data');
  if (!data || !Array.isArray(data.transactions)) return [];
  const regels = [];

  const budgets = data.budgets && typeof data.budgets === 'object' ? data.budgets : {};
  const uitgesloten = new Set(Array.isArray(data.excludedCategories) ? data.excludedCategories : []);
  const maand = maandSleutel(nu);
  const besteed = {};
  let zonderCategorie = 0;
  for (const t of data.transactions) {
    if (!t || typeof t.date !== 'string' || !t.date.startsWith(maand)) continue;
    if (!t.category && !t.expected) zonderCategorie++;
    if (uitgesloten.has(t.category) || !(t.category in budgets)) continue;
    besteed[t.category] = (besteed[t.category] || 0) - Number(t.amount || 0);
  }

  const metBudget = Object.entries(budgets).filter(([, b]) => Number(b) > 0);
  if (metBudget.length) {
    const over = metBudget.filter(([c, b]) => (besteed[c] || 0) > Number(b) + 0.005);
    regels.push(
      over.length
        ? { tekst: `${over.length} ${over.length === 1 ? 'budget' : 'budgetten'} overschreden`, soort: 'kritiek' }
        : { tekst: `Binnen budget in ${maandNaam(nu)}`, soort: 'goed' }
    );
  }
  if (zonderCategorie > 0)
    regels.push({
      tekst: `${zonderCategorie} ${zonderCategorie === 1 ? 'transactie' : 'transacties'} zonder categorie`,
      soort: 'let-op'
    });
  return regels;
}

/* ---------- Vermogensoverzicht ---------- */

const SCHULD_TYPES = new Set(['hypotheek', 'studieschuld', 'lening', 'schuld_overig']);

export function vermogenStatus(nu = new Date()) {
  if (ls().getItem('vermogensoverzicht.v1.locked') !== null)
    return [{ tekst: 'Vergrendeld met pincode', soort: '' }];
  const data = leesJson('vermogensoverzicht.v1');
  if (!data || !Array.isArray(data.accounts) || !data.months) return [];
  const regels = [];

  const maanden = Object.keys(data.months).filter((m) => /^\d{4}-\d{2}$/.test(m)).sort();
  const actief = data.accounts.some((a) => a && !a.archived);
  if (actief && !data.months[maandSleutel(nu)])
    regels.push({ tekst: `${cap(maandNaam(nu))} nog niet ingevuld`, soort: 'let-op' });

  const laatste = maanden[maanden.length - 1];
  if (laatste && !data.settings?.privacy) {
    const waarden = data.months[laatste].values || {};
    let netto = 0;
    for (const a of data.accounts) {
      const v = Number(waarden[a.id]);
      if (!Number.isFinite(v)) continue;
      netto += SCHULD_TYPES.has(a.type) ? -v : v;
    }
    const [j, m] = laatste.split('-').map(Number);
    const wanneer = new Date(j, m - 1, 1).toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' });
    regels.push({ tekst: `Netto ${euro(netto)} (${wanneer})`, soort: '' });
  }
  return regels;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- Onderhoudslogboek ---------- */

// Zelfde regel als de app: tijd en km tellen allebei, wat het eerst komt telt.
export function onderhoudStatus(nu = new Date()) {
  const data = leesJson('onderhoudslogboek-v1');
  if (!data || !Array.isArray(data.items) || !Array.isArray(data.plans)) return [];
  const instellingen = { notifyDays: 14, notifyKm: 1000, ...(data.settings || {}) };
  const items = Object.fromEntries(data.items.filter((i) => i && i.id).map((i) => [i.id, i]));
  const vandaag = isoDatum(nu);
  const dagenTot = (iso) => {
    const [j, m, d] = iso.split('-').map(Number);
    const [vj, vm, vd] = vandaag.split('-').map(Number);
    return Math.round((new Date(j, m - 1, d) - new Date(vj, vm - 1, vd)) / 86_400_000);
  };

  let teLaat = 0;
  let binnenkort = 0;
  for (const plan of data.plans) {
    const item = plan && items[plan.itemId];
    if (!item || plan.active === false) continue;
    const dagen = plan.dueDate ? dagenTot(plan.dueDate) : null;
    const km = plan.dueKm != null && item.currentKm != null ? plan.dueKm - item.currentKm : null;
    const meldDagen = plan.notifyDays ?? instellingen.notifyDays;
    const meldKm = plan.notifyKm ?? instellingen.notifyKm;
    if ((dagen !== null && dagen < 0) || (km !== null && km <= 0)) teLaat++;
    else if ((dagen !== null && dagen <= meldDagen) || (km !== null && km <= meldKm)) binnenkort++;
  }

  const regels = [];
  if (teLaat) regels.push({ tekst: `${teLaat} te laat`, soort: 'kritiek' });
  if (binnenkort) regels.push({ tekst: `${binnenkort} binnenkort`, soort: 'let-op' });
  if (!teLaat && !binnenkort && data.plans.length) regels.push({ tekst: 'Alles bijgewerkt', soort: 'goed' });
  return regels;
}

const PER_APP = {
  huishoudboekje: huishoudboekjeStatus,
  vermogen: vermogenStatus,
  onderhoud: onderhoudStatus
};

export function appStatus(appId, nu = new Date()) {
  const f = PER_APP[appId];
  if (!f) return [];
  try {
    return f(nu);
  } catch {
    return [];
  }
}
