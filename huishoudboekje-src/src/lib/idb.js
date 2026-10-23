// Kleine sleutel-waardeopslag in IndexedDB, voor dingen die niet in localStorage kunnen:
// de versleutelingssleutel (niet uitleesbaar CryptoKey-object) en de gekozen back-upmap.
const DB_NAME = "huishoudboekje";
const STORE = "kv";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run(mode, action) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = action(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

export const idbGet = (key) => run("readonly", (s) => s.get(key)).catch(() => undefined);
export const idbSet = (key, value) => run("readwrite", (s) => s.put(value, key));
export const idbDelete = (key) => run("readwrite", (s) => s.delete(key)).catch(() => undefined);
