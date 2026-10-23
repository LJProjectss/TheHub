// Versleuteling voor het synchronisatiebestand: AES-GCM 256 met een sleutel die met PBKDF2
// (SHA-256, 600.000 rondes) uit uw wachtwoord wordt afgeleid. Het wachtwoord zelf wordt nergens
// bewaard; alleen de afgeleide sleutel, als niet-uitleesbaar object in IndexedDB.
const enc = new TextEncoder();
const dec = new TextDecoder();
const ITERATIONS = 600000;
export const FILE_FORMAT = "huishoudboekje-sync";

export function toB64(buffer) {
  const bytes = new Uint8Array(buffer);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
export const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

export async function deriveKey(password, salt) {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptJson(key, salt, value) {
  const iv = randomBytes(12);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(value)));
  return { format: FILE_FORMAT, version: 1, salt: toB64(salt), iv: toB64(iv), data: toB64(data) };
}

// Gooit een fout bij een verkeerd wachtwoord (de controle van AES-GCM faalt dan).
export async function decryptJson(key, file) {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(file.iv) }, key, fromB64(file.data));
  return JSON.parse(dec.decode(plain));
}

export async function sha256(text) {
  return toB64(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}
