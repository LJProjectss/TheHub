// Wijzigingen bijhouden en twee versies samenvoegen (voor synchronisatie tussen apparaten).
//
// Elk item, elke logregel en elk gepland onderhoud is een los "record" met een tijdstip van
// laatste wijziging (meta.rec, sleutel 'i:<id>', 'l:<id>' of 'p:<id>'). Verwijderen laat een
// grafsteen achter (meta.del), zodat een verwijdering ook op andere apparaten doorkomt.
// Samenvoegen gebeurt per record; alleen als een record op beide apparaten is gewijzigd sinds
// de vorige synchronisatie is er een echt conflict. Dan wint de nieuwste versie.

// Instellingen die meereizen; meldingen aan/uit en wat al gemeld is blijven per apparaat.
export const SYNCED_SETTINGS = ['lang', 'currency', 'notifyDays', 'notifyKm'];
export const COLLECTIONS = [
  ['items', 'i'],
  ['logs', 'l'],
  ['plans', 'p'],
];

export const emptyMeta = () => ({ rec: {}, del: {}, set: 0 });

export function normalizeMeta(raw) {
  const m = raw && typeof raw === 'object' ? raw : {};
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  return { rec: obj(m.rec), del: obj(m.del), set: Number(m.set) || 0 };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const syncedSettings = (s) => Object.fromEntries(SYNCED_SETTINGS.map((k) => [k, s?.[k] ?? null]));

// Vergelijkt prev en next en zet tijdstempels voor alles wat veranderd is.
export function stampChanges(prev, next, now = Date.now()) {
  if (prev === next) return next;
  const meta = structuredClone(prev.meta || emptyMeta());
  let changed = false;
  for (const [coll, pre] of COLLECTIONS) {
    if (prev[coll] === next[coll]) continue;
    const before = new Map(prev[coll].map((r) => [r.id, r]));
    const after = new Map(next[coll].map((r) => [r.id, r]));
    for (const [id, r] of after) {
      if (before.get(id) === r || (before.has(id) && same(before.get(id), r))) continue;
      meta.rec[`${pre}:${id}`] = now;
      delete meta.del[`${pre}:${id}`];
      changed = true;
    }
    for (const id of before.keys()) {
      if (after.has(id)) continue;
      meta.del[`${pre}:${id}`] = now;
      delete meta.rec[`${pre}:${id}`];
      changed = true;
    }
  }
  if (prev.settings !== next.settings && !same(syncedSettings(prev.settings), syncedSettings(next.settings))) {
    meta.set = now;
    changed = true;
  }
  return changed ? { ...next, meta } : { ...next, meta: prev.meta || next.meta };
}

// Vingerafdruk van alles wat gesynchroniseerd wordt.
export function fingerprint(state) {
  return JSON.stringify([state.items, state.logs, state.plans, syncedSettings(state.settings), state.meta]);
}

function version(state, coll, pre, id) {
  const key = `${pre}:${id}`;
  const rec = state[coll].find((r) => r.id === id);
  if (rec) return { rec, t: state.meta.rec[key] || 0, deleted: false };
  if (state.meta.del[key]) return { rec: undefined, t: state.meta.del[key], deleted: true };
  return null;
}

const baseTime = (base, key) => (base ? Math.max(base.rec?.[key] || 0, base.del?.[key] || 0) : 0);

// Voegt local en remote samen. base = meta van de laatst gesynchroniseerde versie (of null).
// Geeft { state, conflicts } terug; conflicts = records die op beide kanten anders zijn gewijzigd.
export function mergeStates(local, remote, base) {
  local = { ...local, meta: normalizeMeta(local.meta) };
  remote = { ...remote, meta: normalizeMeta(remote.meta) };
  const meta = emptyMeta();
  const conflicts = [];
  const result = {};

  for (const [coll, pre] of COLLECTIONS) {
    const ids = [];
    const seen = new Set();
    const add = (id) => !seen.has(id) && (seen.add(id), ids.push(id));
    local[coll].forEach((r) => add(r.id));
    remote[coll].forEach((r) => add(r.id));
    for (const s of [local, remote])
      Object.keys(s.meta.del)
        .filter((k) => k.startsWith(`${pre}:`))
        .forEach((k) => add(k.slice(2)));

    const kept = [];
    for (const id of ids) {
      const key = `${pre}:${id}`;
      const L = version(local, coll, pre, id);
      const R = version(remote, coll, pre, id);
      let win;
      if (!L || !R) win = L || R;
      else if (same(L.rec, R.rec)) win = L.t >= R.t ? L : R;
      else {
        const bt = baseTime(base, key);
        const lChanged = L.t > bt;
        const rChanged = R.t > bt;
        if (lChanged && !rChanged) win = L;
        else if (rChanged && !lChanged) win = R;
        else {
          win = R.t > L.t ? R : L;
          conflicts.push({ coll, id, local: L.rec, remote: R.rec, localTime: L.t, remoteTime: R.t, chosen: win === L ? 'local' : 'remote' });
        }
      }
      if (!win) continue;
      if (win.deleted) meta.del[key] = win.t;
      else {
        if (win.t) meta.rec[key] = win.t;
        kept.push(win.rec);
      }
    }
    result[coll] = kept;
  }

  // Logboek en planning zonder bijbehorend item vervallen (item op het andere apparaat verwijderd).
  const itemIds = new Set(result.items.map((i) => i.id));
  result.logs = result.logs.filter((l) => itemIds.has(l.itemId));
  result.plans = result.plans.filter((p) => itemIds.has(p.itemId));

  const setSrc = remote.meta.set > local.meta.set ? remote : local;
  const settings = { ...local.settings };
  for (const k of SYNCED_SETTINGS) if (setSrc.settings?.[k] !== undefined) settings[k] = setSrc.settings[k];
  meta.set = Math.max(local.meta.set, remote.meta.set);

  return { state: { ...local, ...result, settings, meta }, conflicts };
}

// Kiest bij een conflict alsnog de andere versie (wordt daarna als nieuwe wijziging gestempeld).
export function applyConflictChoice(state, conflict, choice) {
  const rec = choice === 'local' ? conflict.local : conflict.remote;
  const list = state[conflict.coll];
  const exists = list.some((r) => r.id === conflict.id);
  let next;
  if (!rec) next = list.filter((r) => r.id !== conflict.id);
  else if (exists) next = list.map((r) => (r.id === conflict.id ? rec : r));
  else next = [...list, rec];
  return { ...state, [conflict.coll]: next };
}
