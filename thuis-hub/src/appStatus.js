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
    if (t.expected || uitgesloten.has(t.category) || !(t.category in budgets)) continue;
    besteed[t.category] = (besteed[t.category] || 0) - Number(t.amount || 0);
  }

  const metBudget = Object.entries(budgets).filter(([, b]) => Number(b) > 0);
  if (metBudget.length) {
    const over = metBudget.filter(([c, b]) => (besteed[c] || 0) > Number(b) + 0.005);
    const bijna = metBudget.filter(([c, b]) => {
      const v = besteed[c] || 0;
      return v >= Number(b) * 0.8 && v <= Number(b) + 0.005;
    });
    if (over.length)
      regels.push({ tekst: `${over.length} ${over.length === 1 ? 'budget' : 'budgetten'} overschreden`, soort: 'kritiek' });
    if (bijna.length)
      regels.push({ tekst: `Bijna op: ${bijna.map(([c]) => c).join(', ')}`, soort: 'let-op' });
    if (!over.length && !bijna.length) regels.push({ tekst: `Binnen budget in ${maandNaam(nu)}`, soort: 'goed' });
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
  if (!laatste) return regels;
  const privacy = !!data.settings?.privacy;
  const waarden = data.months[laatste].values || {};
  let netto = 0;
  for (const a of data.accounts) {
    const v = Number(waarden[a.id]);
    if (!Number.isFinite(v)) continue;
    netto += SCHULD_TYPES.has(a.type) ? -v : v;
  }
  if (!privacy) {
    const [j, m] = laatste.split('-').map(Number);
    const wanneer = new Date(j, m - 1, 1).toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' });
    regels.push({ tekst: `Netto ${euro(netto)} (${wanneer})`, soort: '' });
  }

  // Voortgang naar het vermogensdoel (Analyse). Met privacy aan alleen het percentage.
  const doel = Number(data.settings?.goal?.amount);
  if (doel > 0) {
    const pct = Math.max(0, Math.floor((netto / doel) * 100));
    const datum = data.settings.goal.date;
    const tegen = /^\d{4}-\d{2}$/.test(datum || '')
      ? ` (doel ${new Date(+datum.slice(0, 4), +datum.slice(5) - 1, 1).toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })})`
      : '';
    regels.push(
      pct >= 100
        ? { tekst: privacy ? 'Doel bereikt' : `Doel van ${euro(doel)} bereikt`, soort: 'goed' }
        : { tekst: privacy ? `${pct}% van je doel${tegen}` : `${pct}% van ${euro(doel)}${tegen}`, soort: '', voortgang: pct / 100 }
    );
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

/* ---------- Maandafsluiting ---------- */

// Vaste klusjes van elke maand. "klaar" is true/false als de hub het zelf kan zien,
// en null als je het zelf moet afvinken.
export function maandTaken(nu = new Date()) {
  const taken = [];
  const vorigeMaand = new Date(nu.getFullYear(), nu.getMonth() - 1, 1);
  const vorige = maandSleutel(vorigeMaand);
  const deze = maandSleutel(nu);
  const laatsteDagVorige = new Date(nu.getFullYear(), nu.getMonth(), 0);
  const weekVoorEinde = isoDatum(new Date(laatsteDagVorige.getFullYear(), laatsteDagVorige.getMonth(), laatsteDagVorige.getDate() - 6));

  const hb = leesJson('huishoudboekje-data');
  if (hb && Array.isArray(hb.transactions)) {
    const echt = hb.transactions.filter((t) => t && typeof t.date === 'string' && !t.expected);
    taken.push({
      id: 'import',
      app: 'huishoudboekje',
      tekst: `Bankafschrift van ${maandNaam(vorigeMaand)} geïmporteerd`,
      klaar: echt.some((t) => t.date >= weekVoorEinde && t.date.startsWith(vorige))
    });
    const open = echt.filter((t) => !t.category && (t.date.startsWith(vorige) || t.date.startsWith(deze))).length;
    taken.push({
      id: 'categorie',
      app: 'huishoudboekje',
      tekst: open ? `Transacties een categorie geven (nog ${open})` : 'Alle transacties hebben een categorie',
      klaar: open === 0
    });
  }

  if (ls().getItem('vermogensoverzicht.v1.locked') !== null) {
    taken.push({ id: 'vermogen', app: 'vermogen', tekst: `${cap(maandNaam(nu))} ingevuld in het vermogensoverzicht`, klaar: null });
  } else {
    const vo = leesJson('vermogensoverzicht.v1');
    if (vo && Array.isArray(vo.accounts) && vo.accounts.some((a) => a && !a.archived))
      taken.push({
        id: 'vermogen',
        app: 'vermogen',
        tekst: `${cap(maandNaam(nu))} ingevuld in het vermogensoverzicht`,
        klaar: !!vo.months?.[deze]
      });
  }

  const ond = leesJson('onderhoudslogboek-v1');
  if (ond && Array.isArray(ond.items)) {
    const autos = ond.items.filter((i) => i && i.type === 'auto');
    if (autos.length)
      taken.push({
        id: 'km',
        app: 'onderhoud',
        tekst: `Km-stand bijgewerkt (${autos.map((a) => a.name).join(', ')})`,
        klaar: null
      });
    const teLaat = onderhoudStatus(nu).find((r) => r.soort === 'kritiek');
    if (Array.isArray(ond.plans) && ond.plans.length)
      taken.push({
        id: 'onderhoud',
        app: 'onderhoud',
        tekst: teLaat ? `Achterstallig onderhoud afhandelen (${teLaat.tekst})` : 'Geen achterstallig onderhoud',
        klaar: !teLaat
      });
  }

  let laatsteBackup = null;
  try {
    laatsteBackup = ls().getItem('hub_laatsteBackup');
  } catch {
    /* geen opslag */
  }
  const backupDatum = laatsteBackup ? new Date(laatsteBackup) : null;
  taken.push({
    id: 'backup',
    app: null,
    tekst: 'Back-up gemaakt deze maand',
    klaar: !!backupDatum && maandSleutel(backupDatum) === deze
  });
  return taken;
}
