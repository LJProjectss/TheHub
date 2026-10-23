// Synchroniseren tussen apparaten via één versleuteld bestand in Google Drive.
//
// Werking: het bestand heeft een volgnummer (rev). Elk apparaat onthoudt welke rev het het laatst
// heeft gezien en een vingerafdruk (hash) van zijn gegevens op dat moment.
// - Cloud ongewijzigd, hier gewijzigd   -> uploaden (rev + 1).
// - Cloud gewijzigd, hier ongewijzigd   -> cloudversie overnemen.
// - Beide gewijzigd                     -> u kiest: deze versie, de cloudversie of samenvoegen.
import { useCallback, useEffect, useRef, useState } from "react";
import { applyData, dataPayload, markBackedUp, mergeBackup, normalizeBackup } from "./backup";
import { decryptJson, deriveKey, encryptJson, fromB64, randomBytes, sha256, toB64 } from "./crypto";
import { idbDelete, idbGet, idbSet } from "./idb";
import {
  DriveError,
  download,
  findFile,
  forgetToken,
  getClientId,
  getMeta,
  getToken,
  startLogin,
  takeTokenFromUrl,
  upload,
} from "./gdrive";

const STATE_KEY = "huishoudboekje-sync";
const KEY_ID = "sync-key";
const AUTO_DELAY = 4000;
const INTERVAL = 5 * 60 * 1000;

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY)) || {};
  } catch {
    return {};
  }
}
function saveState(state) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // opslag niet beschikbaar
  }
}

export function deviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows-computer";
  if (/Macintosh/.test(ua)) return "Mac";
  return "ander apparaat";
}

const hashOf = (payload) => sha256(JSON.stringify(payload));

export function useCloudSync(data, notify) {
  const [state, setStateRaw] = useState(loadState);
  // status: off | idle | syncing | login | password | conflict | error
  const [status, setStatus] = useState(state.enabled ? "idle" : "off");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(null);
  // Wachtwoordstap: "new" (nog geen bestand in de cloud) of "existing".
  const [passwordMode, setPasswordMode] = useState(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const stateRef = useRef(state);
  const conflictRef = useRef(null);
  const running = useRef(false);
  const again = useRef(false);
  const showConflict = (c) => {
    conflictRef.current = c;
    setConflict(c);
  };

  const setState = (changes) => {
    // Elke geslaagde synchronisatie betekent: de gegevens staan ook (versleuteld) in Google Drive.
    // Dat telt als back-up, dus dan geen herinnering om te exporteren.
    if (changes.lastSync) markBackedUp();
    const next = { ...stateRef.current, ...changes };
    stateRef.current = next;
    saveState(next);
    setStateRaw(next);
  };

  const loadKey = () => idbGet(KEY_ID);

  // Gegevens van een ander apparaat overnemen.
  const applyRemote = async (remoteData) => {
    const normalized = normalizeBackup(remoteData);
    if (!normalized) throw new Error("Het bestand in Google Drive bevat geen geldige gegevens.");
    applyData(dataRef.current, normalized);
    return hashOf(dataPayload(normalized));
  };

  const push = async (token, stored, fileId, rev, payload) => {
    const content = await encryptJson(stored.key, fromB64(stored.salt), {
      rev,
      savedAt: new Date().toISOString(),
      device: deviceName(),
      data: payload,
    });
    const meta = await upload(token, fileId, content, rev);
    setState({ fileId: meta.id, rev, hash: await hashOf(payload), lastSync: Date.now() });
  };

  const fail = (e) => {
    if (e instanceof DriveError && e.kind === "auth") {
      setStatus("login");
      return;
    }
    setError(
      e instanceof DriveError && e.kind === "offline"
        ? "Geen verbinding met internet. Er wordt later opnieuw gesynchroniseerd."
        : e?.message || "Onbekende fout bij synchroniseren.",
    );
    setStatus("error");
  };

  const sync = useCallback(async () => {
    // Tijdens een openstaande keuze niet opnieuw beginnen.
    if (!stateRef.current.enabled || conflictRef.current) return;
    if (running.current) {
      again.current = true;
      return;
    }
    const token = getToken();
    if (!token) {
      setStatus("login");
      return;
    }
    const stored = await loadKey();
    if (!stored) {
      setStatus("password");
      return;
    }
    running.current = true;
    setStatus("syncing");
    setError("");
    try {
      const s = stateRef.current;
      const payload = dataPayload(dataRef.current);
      const localHash = await hashOf(payload);
      const localChanged = s.hash !== localHash;
      const meta = s.fileId ? await getMeta(token, s.fileId) : await findFile(token);
      if (!meta) {
        // Nog geen bestand (of het is weggegooid): deze gegevens worden de cloudversie.
        await push(token, stored, null, 1, payload);
      } else {
        const remoteRev = Number(meta.appProperties?.rev || 0);
        if (meta.id === s.fileId && remoteRev === s.rev) {
          if (localChanged) await push(token, stored, meta.id, remoteRev + 1, payload);
          else setState({ lastSync: Date.now() });
        } else {
          const file = await download(token, meta.id);
          if (file.salt !== stored.salt) {
            // Er is op een ander apparaat opnieuw begonnen met een ander wachtwoord.
            await idbDelete(KEY_ID);
            setPasswordMode("existing");
            setStatus("password");
            setError("Het wachtwoord van het bestand in Google Drive is gewijzigd. Voer het nieuwe wachtwoord in.");
            return;
          }
          let remote;
          try {
            remote = await decryptJson(stored.key, file);
          } catch {
            await idbDelete(KEY_ID);
            setPasswordMode("existing");
            setStatus("password");
            setError("Het wachtwoord past niet (meer) bij het bestand in Google Drive. Voer het opnieuw in.");
            return;
          }
          const nothingHere = !dataRef.current.transactions?.length;
          if ((!localChanged && s.rev != null) || nothingHere) {
            const hash = await applyRemote(remote.data);
            setState({ fileId: meta.id, rev: remoteRev, hash, lastSync: Date.now() });
            notifyRef.current?.(`Gegevens bijgewerkt met de versie van ${remote.device || "een ander apparaat"}.`);
          } else {
            showConflict({ fileId: meta.id, rev: remoteRev, remote });
            setStatus("conflict");
            return;
          }
        }
      }
      setStatus("idle");
    } catch (e) {
      fail(e);
    } finally {
      running.current = false;
      if (again.current) {
        again.current = false;
        setTimeout(() => sync(), 0);
      }
    }
  }, []);

  // Keuze bij een conflict.
  const resolveConflict = async (choice) => {
    const c = conflictRef.current;
    showConflict(null);
    const token = getToken();
    const stored = await loadKey();
    if (!c || !token || !stored) return sync();
    setStatus("syncing");
    try {
      if (choice === "remote") {
        const hash = await applyRemote(c.remote.data);
        setState({ fileId: c.fileId, rev: c.rev, hash, lastSync: Date.now() });
      } else {
        let payload = dataPayload(dataRef.current);
        if (choice === "merge") {
          const remote = normalizeBackup(c.remote.data);
          if (remote) {
            payload = mergeBackup(payload, remote).next;
            applyData(dataRef.current, payload);
          }
        }
        await push(token, stored, c.fileId, c.rev + 1, payload);
      }
      setStatus("idle");
    } catch (e) {
      fail(e);
    }
  };

  // Wachtwoord instellen of invoeren. reset = opnieuw beginnen met een nieuw wachtwoord;
  // de cloudversie wordt dan overschreven met de gegevens van dit apparaat.
  const setPassword = async (password, { reset = false } = {}) => {
    const token = getToken();
    if (!token) return setStatus("login");
    setStatus("syncing");
    setError("");
    try {
      const meta = await findFile(token);
      const file = meta && !reset ? await download(token, meta.id) : null;
      const salt = file ? fromB64(file.salt) : randomBytes(16);
      const key = await deriveKey(password, salt);
      if (file) {
        try {
          await decryptJson(key, file);
        } catch {
          setStatus("password");
          setError("Dit wachtwoord klopt niet bij het bestand in Google Drive.");
          return;
        }
      }
      await idbSet(KEY_ID, { key, salt: toB64(salt) });
      setPasswordMode(null);
      if (reset && meta) {
        // Overschrijven met dit apparaat als nieuwe basis.
        const payload = dataPayload(dataRef.current);
        await push(token, { key, salt: toB64(salt) }, meta.id, Number(meta.appProperties?.rev || 0) + 1, payload);
        setStatus("idle");
        return;
      }
      // Bij een bestaand bestand opnieuw vergelijken alsof dit apparaat nog niets heeft gezien.
      setState({ fileId: meta?.id || null, rev: null, hash: null });
      setStatus("idle");
      await sync();
    } catch (e) {
      fail(e);
    }
  };

  const connect = () => {
    setState({ enabled: true });
    if (!getToken()) startLogin();
    else prepare();
  };

  // Na inloggen: is er al een bestand (wachtwoord invoeren) of niet (wachtwoord kiezen)?
  const prepare = async () => {
    if (await loadKey()) return sync();
    const token = getToken();
    if (!token) return setStatus("login");
    try {
      setStatus("syncing");
      const meta = await findFile(token);
      setPasswordMode(meta ? "existing" : "new");
      setStatus("password");
    } catch (e) {
      fail(e);
    }
  };

  const disconnect = async () => {
    forgetToken();
    await idbDelete(KEY_ID);
    setState({ enabled: false, fileId: null, rev: null, hash: null });
    showConflict(null);
    setPasswordMode(null);
    setError("");
    setStatus("off");
  };

  // Terug van Google: toegangsbewijs verwerken en verder gaan.
  useEffect(() => {
    const result = takeTokenFromUrl();
    if (!stateRef.current.enabled) return;
    if (result?.error) {
      setError(
        result.error === "access_denied"
          ? "Je hebt Google geen toegang gegeven. Synchroniseren staat nog uit."
          : "Inloggen bij Google is niet gelukt. Probeer het opnieuw.",
      );
      setStatus("error");
      return;
    }
    prepare();
  }, []);

  // Automatisch: kort na een wijziging, bij terugkeren naar de app en elke 5 minuten.
  const timer = useRef(null);
  const payloadDeps = Object.values(dataPayload(data));
  useEffect(() => {
    if (!stateRef.current.enabled || !getToken()) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => sync(), AUTO_DELAY);
    return () => clearTimeout(timer.current);
  }, payloadDeps);
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && stateRef.current.enabled && getToken() && sync();
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(() => stateRef.current.enabled && getToken() && sync(), INTERVAL);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, [sync]);

  return {
    enabled: !!state.enabled,
    status,
    error,
    lastSync: state.lastSync || null,
    conflict,
    passwordMode,
    hasClientId: !!getClientId(),
    connect,
    login: () => startLogin(),
    disconnect,
    setPassword,
    resolveConflict,
    syncNow: () => (getToken() ? sync() : startLogin()),
  };
}
