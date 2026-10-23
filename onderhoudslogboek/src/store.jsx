import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { makeT } from './i18n.js';
import { uid, todayISO, addMonths } from './utils.js';
import { emptyMeta, normalizeMeta, stampChanges } from './sync/stamps.js';

const STORAGE_KEY = 'onderhoudslogboek-v1';
export const DATA_VERSION = 1;

export const defaultSettings = {
  lang: 'nl',
  currency: 'EUR',
  notifyDays: 14,
  notifyKm: 1000,
  browserNotifications: false
};

export const emptyState = {
  version: DATA_VERSION,
  items: [],
  logs: [],
  plans: [],
  settings: defaultSettings,
  ui: { bannerDismissedKey: null },
  notified: {},
  // Tijdstempels per record voor synchroniseren via Google Drive (zie sync/stamps.js).
  meta: emptyMeta()
};

function upsert(list, obj) {
  const i = list.findIndex((x) => x.id === obj.id);
  if (i === -1) return [...list, obj];
  const copy = list.slice();
  copy[i] = obj;
  return copy;
}

/** Controleert en normaliseert een (geïmporteerde) dataset */
export function normalizeState(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('invalid');
  if (!Array.isArray(raw.items) || !Array.isArray(raw.logs) || !Array.isArray(raw.plans))
    throw new Error('invalid');
  const validTypes = ['auto', 'huis', 'apparaat'];
  const items = raw.items
    .filter((i) => i && i.id && i.name && validTypes.includes(i.type))
    .map((i) => ({ fields: {}, notes: '', currentKm: null, ...i }));
  const ids = new Set(items.map((i) => i.id));
  return {
    ...emptyState,
    version: DATA_VERSION,
    items,
    logs: raw.logs.filter((l) => l && l.id && ids.has(l.itemId) && l.date),
    plans: raw.plans.filter((p) => p && p.id && ids.has(p.itemId)),
    settings: { ...defaultSettings, ...(raw.settings || {}) },
    ui: { ...emptyState.ui, ...(raw.ui || {}) },
    notified: raw.notified && typeof raw.notified === 'object' ? raw.notified : {},
    meta: normalizeMeta(raw.meta)
  };
}

function load() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return emptyState;
    return normalizeState(JSON.parse(s));
  } catch {
    return emptyState;
  }
}

function reducer(state, a) {
  switch (a.type) {
    case 'SAVE_ITEM':
      return { ...state, items: upsert(state.items, a.item) };
    case 'DELETE_ITEM':
      return {
        ...state,
        items: state.items.filter((i) => i.id !== a.id),
        logs: state.logs.filter((l) => l.itemId !== a.id),
        plans: state.plans.filter((p) => p.itemId !== a.id)
      };
    case 'SET_KM':
      return {
        ...state,
        items: state.items.map((i) => (i.id === a.id ? { ...i, currentKm: a.km } : i))
      };
    case 'SAVE_LOG': {
      const { log, plan, closePlanId } = a;
      let plans = state.plans;
      if (plan) plans = upsert(plans, plan);
      else if (closePlanId) plans = plans.filter((p) => p.id !== closePlanId);
      let items = state.items;
      if (log.km != null) {
        items = items.map((i) =>
          i.id === log.itemId && i.type === 'auto' && (i.currentKm == null || log.km > i.currentKm)
            ? { ...i, currentKm: log.km }
            : i
        );
      }
      return { ...state, logs: upsert(state.logs, log), plans, items };
    }
    case 'DELETE_LOG':
      return { ...state, logs: state.logs.filter((l) => l.id !== a.id) };
    case 'SAVE_PLAN':
      return { ...state, plans: upsert(state.plans, a.plan) };
    case 'DELETE_PLAN':
      return { ...state, plans: state.plans.filter((p) => p.id !== a.id) };
    case 'SETTINGS':
      return { ...state, settings: { ...state.settings, ...a.settings } };
    case 'DISMISS_BANNER':
      return { ...state, ui: { ...state.ui, bannerDismissedKey: a.key } };
    case 'NOTIFIED':
      return { ...state, notified: { ...state.notified, ...a.map } };
    case 'REPLACE':
      return a.state;
    case 'SYNC_REPLACE':
      return typeof a.state === 'function' ? a.state(state) : a.state;
    default:
      return state;
  }
}

// Elke wijziging krijgt tijdstempels, behalve wat de synchronisatie zelf binnenhaalt.
function stampedReducer(state, a) {
  const next = reducer(state, a);
  return a.type === 'SYNC_REPLACE' ? next : stampChanges(state, next);
}

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(stampedReducer, undefined, load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Opslaan mislukt', e);
    }
  }, [state]);

  useEffect(() => {
    document.documentElement.lang = state.settings.lang;
    document.title = makeT(state.settings.lang)('appName');
  }, [state.settings.lang]);

  const value = useMemo(
    () => ({ state, dispatch, t: makeT(state.settings.lang), settings: state.settings }),
    [state]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);

/** Voorbeeldgegevens, datums relatief aan vandaag zodat de planning iets laat zien */
export function demoState(settings) {
  const today = todayISO();
  const ago = (m) => addMonths(today, -m);
  const ahead = (m) => addMonths(today, m);
  const addDays = (iso, n) => {
    const [y, mo, d] = iso.split('-').map(Number);
    const dt = new Date(y, mo - 1, d + n);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };

  const car = {
    id: uid(), type: 'auto', name: 'Volkswagen Golf', currentKm: 148600, notes: '',
    fields: { licensePlate: 'AB-123-C', brand: 'Volkswagen', model: 'Golf 1.5 TSI', buildYear: '2019' }
  };
  const house = {
    id: uid(), type: 'huis', name: 'Woning', currentKm: null, notes: '',
    fields: { address: 'Dorpsstraat 1, 1234 AB Voorbeeld', buildYear: '1998' }
  };
  const wm = {
    id: uid(), type: 'apparaat', name: 'Wasmachine', currentKm: null, notes: '',
    fields: { brand: 'Miele', modelNumber: 'WWD 120', purchaseDate: ago(20), warrantyUntil: ahead(40) }
  };
  const cv = {
    id: uid(), type: 'apparaat', name: 'CV-ketel', currentKm: null, notes: 'Onderhoudscontract bij installateur',
    fields: { brand: 'Remeha', modelNumber: 'Calenta Ace 28c', purchaseDate: ago(60), warrantyUntil: ago(12) }
  };

  const pService = { id: uid(), itemId: car.id, name: 'Kleine beurt', description: 'Olie + filter', intervalMonths: 12, intervalKm: 15000, dueDate: ahead(5), dueKm: 149000, notifyDays: null, notifyKm: null };
  const pApk = { id: uid(), itemId: car.id, name: 'APK', description: '', intervalMonths: 12, intervalKm: null, dueDate: addDays(today, 9), dueKm: null, notifyDays: 30, notifyKm: null };
  const pGutter = { id: uid(), itemId: house.id, name: 'Dakgoten schoonmaken', description: '', intervalMonths: 12, intervalKm: null, dueDate: addDays(today, -4), dueKm: null, notifyDays: null, notifyKm: null };
  const pCv = { id: uid(), itemId: cv.id, name: 'Onderhoud CV-ketel', description: 'Jaarlijkse controle', intervalMonths: 12, intervalKm: null, dueDate: ahead(3), dueKm: null, notifyDays: 21, notifyKm: null };
  const pWm = { id: uid(), itemId: wm.id, name: 'Ontkalken + filter reinigen', description: '', intervalMonths: 3, intervalKm: null, dueDate: addDays(today, 30), dueKm: null, notifyDays: 7, notifyKm: null };

  const logs = [
    { id: uid(), itemId: car.id, date: ago(19), name: 'Grote beurt', description: 'Incl. bougies en luchtfilter', cost: 489.5, km: 119500, planId: null, nextDate: null, nextKm: null },
    { id: uid(), itemId: car.id, date: ago(12), name: 'APK', description: 'Goedgekeurd', cost: 45, km: 131200, planId: pApk.id, nextDate: pApk.dueDate, nextKm: null },
    { id: uid(), itemId: car.id, date: ago(7), name: 'Kleine beurt', description: 'Olie + filter', cost: 219, km: 134000, planId: pService.id, nextDate: pService.dueDate, nextKm: pService.dueKm },
    { id: uid(), itemId: car.id, date: ago(2), name: 'Winterbanden', description: '4x Michelin Alpin', cost: 612, km: 146100, planId: null, nextDate: null, nextKm: null },
    { id: uid(), itemId: house.id, date: ago(24), name: 'Kozijnen schilderen', description: 'Voorgevel', cost: 1850, km: null, planId: null, nextDate: null, nextKm: null },
    { id: uid(), itemId: house.id, date: ago(12), name: 'Dakgoten schoonmaken', description: '', cost: 0, km: null, planId: pGutter.id, nextDate: pGutter.dueDate, nextKm: null },
    { id: uid(), itemId: house.id, date: ago(5), name: 'Kitranden badkamer', description: 'Oude kit verwijderd, nieuw aangebracht', cost: 38.95, km: null, planId: null, nextDate: null, nextKm: null },
    { id: uid(), itemId: cv.id, date: ago(9), name: 'Onderhoud CV-ketel', description: 'Jaarlijkse controle', cost: 135, km: null, planId: pCv.id, nextDate: pCv.dueDate, nextKm: null },
    { id: uid(), itemId: wm.id, date: ago(2), name: 'Ontkalken + filter reinigen', description: '', cost: 6.99, km: null, planId: pWm.id, nextDate: null, nextKm: null }
  ];

  return {
    ...emptyState,
    items: [car, house, cv, wm],
    logs,
    plans: [pService, pApk, pGutter, pCv, pWm],
    settings: settings || defaultSettings
  };
}
