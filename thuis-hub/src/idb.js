// Kleine sleutel-waardeopslag in IndexedDB, voor de gekozen back-upmap
// (een maphandle kan niet in localStorage).

function open(dbNaam, store) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbNaam, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function doe(db, store, modus, actie) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, modus);
    const req = actie(tx.objectStore(store));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

const HUB_DB = 'thuis-hub';
const HUB_STORE = 'kv';

export async function hubGet(sleutel) {
  try {
    const db = await open(HUB_DB, HUB_STORE);
    const v = await doe(db, HUB_STORE, 'readonly', (s) => s.get(sleutel));
    db.close();
    return v;
  } catch {
    return undefined;
  }
}

export async function hubSet(sleutel, waarde) {
  const db = await open(HUB_DB, HUB_STORE);
  await doe(db, HUB_STORE, 'readwrite', (s) => s.put(waarde, sleutel));
  db.close();
}

export async function hubDelete(sleutel) {
  try {
    const db = await open(HUB_DB, HUB_STORE);
    await doe(db, HUB_STORE, 'readwrite', (s) => s.delete(sleutel));
    db.close();
  } catch {
    /* niets te verwijderen */
  }
}
