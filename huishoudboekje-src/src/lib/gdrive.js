// Google Drive: inloggen (OAuth 2.0 voor webapps, via doorsturen - dat werkt ook in een app op het
// beginscherm van een iPhone, waar pop-ups lastig zijn) en één bestand lezen en schrijven.
// Met de rechten "drive.file" ziet de app alleen bestanden die zij zelf heeft gemaakt.
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const TOKEN_KEY = "huishoudboekje-gdrive-token";
const STATE_KEY = "huishoudboekje-gdrive-state";
const CLIENT_KEY = "huishoudboekje-gdrive-client";
export const FILE_NAME = "huishoudboekje-sync.json";
const API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";

export class DriveError extends Error {
  constructor(kind, status) {
    super(kind === "auth" ? "Opnieuw inloggen bij Google nodig" : `Google Drive gaf een fout (${status || kind})`);
    this.kind = kind;
    this.status = status;
  }
}

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // opslag niet beschikbaar
  }
};

// Client-ID uit de build (.env: VITE_GOOGLE_CLIENT_ID) of zelf ingevuld bij Instellingen.
export const getClientId = () => import.meta.env.VITE_GOOGLE_CLIENT_ID || read(CLIENT_KEY) || "";
export const setClientId = (id) => write(CLIENT_KEY, id.trim() || null);
// Na inloggen terug naar de app zelf (die staat in een submap, bijv. /huishoudboekje/).
export const redirectUri = () => `${window.location.origin}${import.meta.env.BASE_URL}`;

export function startLogin({ selectAccount = false } = {}) {
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  write(STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: redirectUri(),
    response_type: "token",
    scope: SCOPE,
    include_granted_scopes: "true",
    state,
  });
  if (selectAccount) params.set("prompt", "select_account consent");
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

// Na terugkomst van Google staat het toegangsbewijs in het adres (#access_token=...).
// Haalt het eruit, bewaart het en maakt het adres weer schoon.
export function takeTokenFromUrl() {
  const hash = window.location.hash || "";
  if (!/[#&](access_token|error)=/.test(hash)) return null;
  const p = new URLSearchParams(hash.slice(1));
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  const expected = read(STATE_KEY);
  write(STATE_KEY, null);
  if (p.get("error")) return { error: p.get("error") };
  if (!expected || p.get("state") !== expected) return { error: "state" };
  const expires = Date.now() + ((Number(p.get("expires_in")) || 3600) - 60) * 1000;
  write(TOKEN_KEY, JSON.stringify({ token: p.get("access_token"), expires }));
  return { ok: true };
}

export function getToken() {
  try {
    const t = JSON.parse(read(TOKEN_KEY));
    return t && t.expires > Date.now() ? t.token : null;
  } catch {
    return null;
  }
}
export const forgetToken = () => write(TOKEN_KEY, null);

async function api(token, url, options = {}) {
  let res;
  try {
    res = await fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } });
  } catch {
    throw new DriveError("offline");
  }
  if (res.status === 401) {
    forgetToken();
    throw new DriveError("auth", 401);
  }
  if (!res.ok) throw new DriveError("http", res.status);
  return res;
}

const META_FIELDS = "id,appProperties,modifiedTime,trashed";

export async function findFile(token) {
  const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
  const res = await api(token, `${API}?q=${q}&spaces=drive&orderBy=modifiedTime desc&fields=files(${META_FIELDS})`);
  return (await res.json()).files?.[0] || null;
}

export async function getMeta(token, id) {
  try {
    const meta = await (await api(token, `${API}/${id}?fields=${META_FIELDS}`)).json();
    return meta.trashed ? null : meta;
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

export async function download(token, id) {
  return (await api(token, `${API}/${id}?alt=media`)).json();
}

// Nieuw bestand (zonder id) of bestaand bestand overschrijven; rev staat in de eigenschappen,
// zodat we kunnen zien of er iets veranderd is zonder het hele bestand op te halen.
export async function upload(token, id, content, rev) {
  const boundary = `hb${Math.random().toString(36).slice(2)}`;
  const meta = id
    ? { appProperties: { rev: String(rev) } }
    : { name: FILE_NAME, mimeType: "application/json", appProperties: { rev: String(rev) } };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(content)}\r\n--${boundary}--`;
  const url = `${UPLOAD}${id ? `/${id}` : ""}?uploadType=multipart&fields=${META_FIELDS}`;
  const res = await api(token, url, {
    method: id ? "PATCH" : "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return res.json();
}
