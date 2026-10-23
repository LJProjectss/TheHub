import {
  DEFAULT_APPS,
  HUB_PREFIX,
  LIMIET_TEKENS,
  BACKUP_FORMAAT,
  BACKUP_VERSIE
} from './config.js';

const CONFIG_KEY = `${HUB_PREFIX}config`;
const LAATSTE_BACKUP_KEY = `${HUB_PREFIX}laatsteBackup`;
const PERSIST_GEVRAAGD_KEY = `${HUB_PREFIX}persistGevraagd`;
export const OVERIG_ID = '_overig';

const ls = () => globalThis.localStorage;

/* ---------- Configuratie ---------- */

export function standaardApps() {
  return JSON.parse(JSON.stringify(DEFAULT_APPS));
}

export function laadConfig() {
  try {
    const ruw = ls().getItem(CONFIG_KEY);
    if (!ruw) return standaardApps();
    const apps = JSON.parse(ruw);
    if (!Array.isArray(apps)) return standaardApps();
    return apps.map((a) => ({ ...a, sleutels: Array.isArray(a.sleutels) ? a.sleutels : [] }));
  } catch {
    return standaardApps();
  }
}

export function bewaarConfig(apps) {
  ls().setItem(CONFIG_KEY, JSON.stringify(apps));
}

/* ---------- Sleutels en verdeling ---------- */

export function alleSleutels() {
  const uit = [];
  for (let i = 0; i < ls().length; i++) {
    const k = ls().key(i);
    if (k !== null) uit.push(k);
  }
  return uit.sort((a, b) => a.localeCompare(b));
}

export function pastBijPatroon(sleutel, patroon) {
  const p = patroon.trim();
  if (!p) return false;
  return p.endsWith('*') ? sleutel.startsWith(p.slice(0, -1)) : sleutel === p;
}

// Patronen die met "!" beginnen sluiten een sleutel uit van de back-up
// (bijv. inlogtokens of tijdelijke caches). Zo'n sleutel telt wel mee in de opslagmeter.
const isUitsluiting = (p) => p.trim().startsWith('!');

export function pastBijApp(sleutel, app) {
  return app.sleutels.some((p) => !isUitsluiting(p) && pastBijPatroon(sleutel, p));
}

export function uitgeslotenVanBackup(sleutel, app) {
  return app.sleutels.some((p) => isUitsluiting(p) && pastBijPatroon(sleutel, p.trim().slice(1)));
}

/** Verdeelt alle sleutels over de apps. Een sleutel hoort bij de eerste app die erop past. */
export function verdeelSleutels(apps) {
  const perApp = Object.fromEntries(apps.map((a) => [a.id, []]));
  const hub = [];
  const overig = [];
  for (const k of alleSleutels()) {
    if (k.startsWith(HUB_PREFIX)) {
      hub.push(k);
      continue;
    }
    const app = apps.find((a) => pastBijApp(k, a));
    if (app) perApp[app.id].push(k);
    else overig.push(k);
  }
  return { perApp, hub, overig };
}

/* ---------- Opslagmeting ---------- */

export function tekensVan(sleutel) {
  const v = ls().getItem(sleutel) ?? '';
  return sleutel.length + v.length;
}

const som = (sleutels) => sleutels.reduce((t, k) => t + tekensVan(k), 0);

export function opslagStatus(apps) {
  const { perApp, hub, overig } = verdeelSleutels(apps);
  const appStatus = Object.fromEntries(
    Object.entries(perApp).map(([id, ks]) => [id, { tekens: som(ks), aantal: ks.length }])
  );
  const hubTekens = som(hub);
  const overigTekens = som(overig);
  const totaal =
    Object.values(appStatus).reduce((t, s) => t + s.tekens, 0) + hubTekens + overigTekens;
  return {
    perApp: appStatus,
    hub: { tekens: hubTekens, aantal: hub.length },
    overig: { tekens: overigTekens, aantal: overig.length, sleutels: overig },
    totaal,
    limiet: LIMIET_TEKENS,
    fractie: totaal / LIMIET_TEKENS
  };
}

/* ---------- Persistente opslag ---------- */

export async function persistStatus() {
  if (!globalThis.navigator?.storage?.persisted) return 'niet-ondersteund';
  try {
    return (await navigator.storage.persisted()) ? 'ja' : 'nee';
  } catch {
    return 'onbekend';
  }
}

export async function vraagPersist() {
  if (!globalThis.navigator?.storage?.persist) return 'niet-ondersteund';
  try {
    ls().setItem(PERSIST_GEVRAAGD_KEY, new Date().toISOString());
    return (await navigator.storage.persist()) ? 'ja' : 'nee';
  } catch {
    return 'onbekend';
  }
}

export function persistAlGevraagd() {
  return ls().getItem(PERSIST_GEVRAAGD_KEY) !== null;
}

/* ---------- Back-up maken ---------- */

export function maakBackup(apps, { appIds, inclusiefOverig = false } = {}) {
  const { perApp, overig } = verdeelSleutels(apps);
  const gekozen = appIds ?? apps.map((a) => a.id);
  const uit = {
    formaat: BACKUP_FORMAAT,
    versie: BACKUP_VERSIE,
    gemaakt: new Date().toISOString(),
    apps: {}
  };
  for (const app of apps) {
    if (!gekozen.includes(app.id)) continue;
    uit.apps[app.id] = {
      naam: app.naam,
      sleutels: Object.fromEntries(
        perApp[app.id].filter((k) => !uitgeslotenVanBackup(k, app)).map((k) => [k, ls().getItem(k)])
      )
    };
  }
  if (inclusiefOverig && overig.length) {
    uit.apps[OVERIG_ID] = {
      naam: 'Niet-toegewezen sleutels',
      sleutels: Object.fromEntries(overig.map((k) => [k, ls().getItem(k)]))
    };
  }
  return uit;
}

export function backupBestandsnaam(datum = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `thuis-backup-${datum.getFullYear()}-${p(datum.getMonth() + 1)}-${p(datum.getDate())}.json`;
}

export function downloadJson(obj, bestandsnaam) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = bestandsnaam;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function markeerBackupGemaakt() {
  ls().setItem(LAATSTE_BACKUP_KEY, new Date().toISOString());
}

export function laatsteBackup() {
  const v = ls().getItem(LAATSTE_BACKUP_KEY);
  return v ? new Date(v) : null;
}

/* ---------- Back-up terugzetten ---------- */

export function valideerBackup(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('Dit is geen geldig JSON-object.');
  if (obj.formaat !== BACKUP_FORMAAT)
    throw new Error('Dit bestand is geen back-up van de Thuis-hub.');
  if (typeof obj.versie !== 'number' || obj.versie > BACKUP_VERSIE)
    throw new Error('Deze back-up is gemaakt met een nieuwere versie van de hub.');
  if (!obj.apps || typeof obj.apps !== 'object') throw new Error('De back-up bevat geen apps.');
  for (const [id, app] of Object.entries(obj.apps)) {
    if (!app || typeof app.sleutels !== 'object')
      throw new Error(`Onderdeel "${id}" in de back-up is beschadigd.`);
    for (const [k, v] of Object.entries(app.sleutels)) {
      if (typeof v !== 'string') throw new Error(`Sleutel "${k}" heeft geen tekstwaarde.`);
    }
  }
  return obj;
}

export async function leesBackupBestand(bestand) {
  const tekst = await bestand.text();
  let obj;
  try {
    obj = JSON.parse(tekst);
  } catch {
    throw new Error('Het bestand is geen geldige JSON.');
  }
  return valideerBackup(obj);
}

/**
 * Zet de gekozen onderdelen van een back-up terug.
 * vervang = true: bestaande sleutels van die app (volgens de huidige instellingen)
 * worden eerst verwijderd, zodat er geen oude restjes blijven staan.
 * Lukt het niet (bijv. opslag vol), dan wordt alles teruggedraaid.
 */
export function herstelBackup(backup, apps, gekozenIds, { vervang = true } = {}) {
  const { perApp } = verdeelSleutels(apps);
  const tePlaatsen = [];
  const teVerwijderen = new Set();

  for (const id of gekozenIds) {
    const deel = backup.apps[id];
    if (!deel) continue;
    const app = apps.find((a) => a.id === id);
    if (vervang && perApp[id])
      perApp[id].filter((k) => !uitgeslotenVanBackup(k, app)).forEach((k) => teVerwijderen.add(k));
    for (const [k, v] of Object.entries(deel.sleutels)) {
      if (k.startsWith(HUB_PREFIX)) continue;
      tePlaatsen.push([k, v]);
      teVerwijderen.delete(k);
    }
  }

  // Momentopname van alles wat we gaan aanraken, om terug te kunnen draaien.
  const geraakt = new Set([...teVerwijderen, ...tePlaatsen.map(([k]) => k)]);
  const snapshot = new Map([...geraakt].map((k) => [k, ls().getItem(k)]));

  try {
    teVerwijderen.forEach((k) => ls().removeItem(k));
    tePlaatsen.forEach(([k, v]) => ls().setItem(k, v));
  } catch (fout) {
    for (const [k, v] of snapshot) {
      try {
        if (v === null) ls().removeItem(k);
        else ls().setItem(k, v);
      } catch {
        /* best effort */
      }
    }
    const vol = fout && (fout.name === 'QuotaExceededError' || fout.code === 22);
    throw new Error(
      vol
        ? 'De opslag is vol. Er is niets gewijzigd.'
        : `Terugzetten mislukt, er is niets gewijzigd (${fout?.message ?? fout}).`
    );
  }

  return { geplaatst: tePlaatsen.length, verwijderd: teVerwijderen.size };
}

/* ---------- Opmaak ---------- */

export function formatMB(tekens) {
  const mb = tekens / 1_000_000;
  return `${mb.toLocaleString('nl-NL', {
    minimumFractionDigits: mb < 0.1 ? 3 : 2,
    maximumFractionDigits: mb < 0.1 ? 3 : 2
  })} MB`;
}

export function formatProcent(fractie) {
  return `${(fractie * 100).toLocaleString('nl-NL', { maximumFractionDigits: 1 })}%`;
}

export function formatDatum(d) {
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDatumTijd(d) {
  return `${formatDatum(d)} ${d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
}
