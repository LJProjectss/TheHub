// Hulpfuncties: datums, bedragen, status van gepland onderhoud

export const uid = () =>
  (globalThis.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const todayISO = () => toISO(new Date());

export function parseISO(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** ISO (jjjj-mm-dd) -> dd-mm-jjjj */
export function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

/**
 * dd-mm-jjjj (ook d-m-jjjj, met / of .) -> ISO.
 * allowShortYear: accepteer ook dd-mm-jj (als 20jj) — alleen bij verlaten van het veld.
 */
export function parseNlDate(str, allowShortYear = false) {
  if (!str) return null;
  const m = str.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) {
    if (!allowShortYear) return null;
    y = '20' + y;
  }
  const dn = Number(d), mn = Number(mo), yn = Number(y);
  if (mn < 1 || mn > 12 || dn < 1) return null;
  const last = new Date(yn, mn, 0).getDate();
  if (dn > last) return null;
  return `${yn}-${String(mn).padStart(2, '0')}-${String(dn).padStart(2, '0')}`;
}

export function addMonths(iso, n) {
  const d = parseISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + Number(n));
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
}

export function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}

export function yearOf(iso) {
  return iso ? Number(iso.slice(0, 4)) : null;
}

/** Bedrag uit invoer: accepteert 12,50 / 12.50 / 1.234,56 / 1,234.56 */
export function parseAmount(input) {
  if (input === null || input === undefined) return null;
  let s = String(input).replace(/[^\d.,-]/g, '').trim();
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastComma > -1) {
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (lastDot > -1) {
    if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function parseIntSafe(input) {
  if (input === null || input === undefined || input === '') return null;
  const s = String(input).replace(/[^\d]/g, '');
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

export function locale(lang) {
  return lang === 'en' ? 'en-US' : 'nl-NL';
}

export function fmtMoney(amount, settings) {
  if (amount === null || amount === undefined || amount === '') return '';
  return new Intl.NumberFormat(locale(settings.lang), {
    style: 'currency',
    currency: settings.currency || 'EUR'
  }).format(amount);
}

export function fmtNumber(n, settings) {
  if (n === null || n === undefined || n === '') return '';
  return new Intl.NumberFormat(locale(settings.lang)).format(n);
}

/** Invoerweergave van een bedrag (zonder valutateken) */
export function amountToInput(n, settings) {
  if (n === null || n === undefined) return '';
  return new Intl.NumberFormat(locale(settings.lang), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false
  }).format(n);
}

/**
 * Status van gepland onderhoud: 'overdue' | 'soon' | 'ok'
 * Tijd en km worden allebei bekeken; wat het eerst komt, telt.
 */
export function planStatus(plan, item, settings, today = todayISO()) {
  const notifyDays = plan.notifyDays ?? settings.notifyDays;
  const notifyKm = plan.notifyKm ?? settings.notifyKm;
  const daysLeft = plan.dueDate ? daysBetween(today, plan.dueDate) : null;
  const kmLeft =
    plan.dueKm != null && item && item.currentKm != null ? plan.dueKm - item.currentKm : null;

  let status = 'ok';
  if ((daysLeft !== null && daysLeft < 0) || (kmLeft !== null && kmLeft <= 0)) status = 'overdue';
  else if ((daysLeft !== null && daysLeft <= notifyDays) || (kmLeft !== null && kmLeft <= notifyKm))
    status = 'soon';
  return { status, daysLeft, kmLeft, notifyDays, notifyKm };
}

const RANK = { overdue: 0, soon: 1, ok: 2 };

/** Alle actieve plannen met status, gesorteerd op urgentie */
export function computeUpcoming(state, today = todayISO()) {
  const itemsById = Object.fromEntries(state.items.map((i) => [i.id, i]));
  return state.plans
    .filter((p) => p.active !== false && itemsById[p.itemId])
    .map((p) => {
      const item = itemsById[p.itemId];
      return { plan: p, item, ...planStatus(p, item, state.settings, today) };
    })
    .sort((a, b) => {
      if (RANK[a.status] !== RANK[b.status]) return RANK[a.status] - RANK[b.status];
      const da = a.daysLeft ?? Number.POSITIVE_INFINITY;
      const db = b.daysLeft ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      const ka = a.kmLeft ?? Number.POSITIVE_INFINITY;
      const kb = b.kmLeft ?? Number.POSITIVE_INFINITY;
      return ka - kb;
    });
}

/** Tekst "over 12 dagen" / "3 dagen te laat" / "vandaag" */
export function relDays(daysLeft, t) {
  if (daysLeft === null) return '';
  if (daysLeft === 0) return t('today');
  if (daysLeft === 1) return t('inDay');
  if (daysLeft > 1) return t('inDays', { n: daysLeft });
  if (daysLeft === -1) return t('dayLate');
  return t('daysLate', { n: -daysLeft });
}

export function relKm(kmLeft, t, settings) {
  if (kmLeft === null) return '';
  if (kmLeft > 0) return t('kmLeft', { n: fmtNumber(kmLeft, settings) });
  return t('kmLate', { n: fmtNumber(-kmLeft, settings) });
}

/** "12-03-2027 of bij 150.000 km" */
export function dueText(plan, t, settings) {
  const parts = [];
  if (plan.dueDate) parts.push(fmtDate(plan.dueDate));
  if (plan.dueKm != null) parts.push(t('atKm', { n: fmtNumber(plan.dueKm, settings) }));
  return parts.join(settings.lang === 'en' ? ' or ' : ' of ');
}

export function repeatText(plan, t, settings) {
  const parts = [];
  if (plan.intervalMonths) parts.push(`${plan.intervalMonths} ${t('months')}`);
  if (plan.intervalKm) parts.push(`${fmtNumber(plan.intervalKm, settings)} km`);
  if (!parts.length) return '';
  return t('repeatEvery', { text: parts.join(settings.lang === 'en' ? ' or ' : ' of ') });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function fileStamp() {
  return todayISO();
}
