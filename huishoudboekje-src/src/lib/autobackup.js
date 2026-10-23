// Automatische back-up naar een zelfgekozen map op de computer (Chrome en Edge; niet op iPhone).
// Na een wijziging wordt binnen een halve minuut het back-upbestand van vandaag bijgewerkt;
// de laatste 30 dagbestanden blijven bewaard.
import { useEffect, useRef, useState } from "react";
import { backupJson, dataPayload, markBackedUp } from "./backup";
import { sha256 } from "./crypto";
import { toIsoDate } from "./format";
import { idbDelete, idbGet, idbSet } from "./idb";

const HANDLE_KEY = "backup-dir";
const LAST_KEY = "huishoudboekje-autobackup-last";
const FILE_PATTERN = /^huishoudboekje-auto-\d{4}-\d{2}-\d{2}\.json$/;
const KEEP = 30;
const DELAY = 30000;

export const autoBackupSupported = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

async function writeBackup(dir, data) {
  const name = `huishoudboekje-auto-${toIsoDate(new Date())}.json`;
  const file = await dir.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(backupJson(data));
  await writable.close();
  // Oudste dagbestanden opruimen.
  const names = [];
  for await (const entry of dir.values()) if (entry.kind === "file" && FILE_PATTERN.test(entry.name)) names.push(entry.name);
  names.sort();
  for (const old of names.slice(0, Math.max(0, names.length - KEEP))) await dir.removeEntry(old);
  return name;
}

export function useAutoBackup(data) {
  const supported = autoBackupSupported();
  const [dir, setDir] = useState(null);
  // status: off | ok | permission | error
  const [status, setStatus] = useState("off");
  const [error, setError] = useState("");
  const [last, setLast] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LAST_KEY)) || null;
    } catch {
      return null;
    }
  });
  const dataRef = useRef(data);
  dataRef.current = data;
  const lastHash = useRef(null);

  useEffect(() => {
    if (!supported) return;
    idbGet(HANDLE_KEY).then(async (handle) => {
      if (!handle) return;
      setDir(handle);
      setStatus((await handle.queryPermission({ mode: "readwrite" })) === "granted" ? "ok" : "permission");
    });
  }, []);

  const save = async (handle = dir) => {
    if (!handle) return;
    try {
      const hash = await sha256(JSON.stringify(dataPayload(dataRef.current)));
      if (hash === lastHash.current) return;
      const name = await writeBackup(handle, dataRef.current);
      lastHash.current = hash;
      const info = { name, at: Date.now() };
      setLast(info);
      localStorage.setItem(LAST_KEY, JSON.stringify(info));
      markBackedUp();
      setStatus("ok");
      setError("");
    } catch (e) {
      if (e?.name === "NotAllowedError") setStatus("permission");
      else {
        setStatus("error");
        setError(e?.message || "Schrijven naar de map is mislukt.");
      }
    }
  };

  // Kort na wijzigingen opslaan, als er toestemming is.
  const payloadDeps = Object.values(dataPayload(data));
  useEffect(() => {
    if (status !== "ok") return;
    const t = setTimeout(() => save(), DELAY);
    return () => clearTimeout(t);
  }, [status, ...payloadDeps]);

  const chooseFolder = async () => {
    try {
      const handle = await window.showDirectoryPicker({ id: "huishoudboekje", mode: "readwrite" });
      await idbSet(HANDLE_KEY, handle);
      setDir(handle);
      lastHash.current = null;
      await save(handle);
    } catch (e) {
      if (e?.name !== "AbortError") {
        setStatus("error");
        setError(e?.message || "Kon de map niet gebruiken.");
      }
    }
  };

  // Na het herstarten van de browser vraagt die opnieuw om toestemming (alleen na een klik).
  const grant = async () => {
    if (!dir) return;
    if ((await dir.requestPermission({ mode: "readwrite" })) === "granted") {
      setStatus("ok");
      lastHash.current = null;
      await save(dir);
    }
  };

  const turnOff = async () => {
    await idbDelete(HANDLE_KEY);
    setDir(null);
    setStatus("off");
  };

  return {
    supported,
    status,
    error,
    last,
    folderName: dir?.name || "",
    chooseFolder,
    grant,
    turnOff,
    saveNow: () => {
      lastHash.current = null;
      return save();
    },
  };
}
