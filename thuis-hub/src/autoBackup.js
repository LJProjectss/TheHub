// Automatische back-up van alle apps naar een zelfgekozen map (Chrome en Edge op de computer).
// De hub schrijft elke keer dat hij open is en er iets veranderd is het bestand van vandaag bij;
// de laatste 30 dagbestanden blijven bewaard. Apps in een ander tabblad tellen ook mee.
import { useCallback, useEffect, useRef, useState } from 'react';
import { hubDelete, hubGet, hubSet } from './idb.js';
import { maakBackup, markeerBackupGemaakt } from './storage.js';
import { HUB_PREFIX } from './config.js';

const HANDLE_KEY = 'backup-map';
const LAATSTE_KEY = `${HUB_PREFIX}autoBackup`;
const PATROON = /^thuis-auto-\d{4}-\d{2}-\d{2}\.json$/;
const BEWAREN = 30;
const WACHTTIJD = 20_000;

export const autoBackupMogelijk = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

const p2 = (n) => String(n).padStart(2, '0');
const vandaag = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

// Inhoud zonder tijdstempel, om te zien of er sinds de vorige keer iets veranderd is.
const vingerafdruk = (b) => JSON.stringify(b.apps);

async function schrijf(map, backup) {
  const naam = `thuis-auto-${vandaag()}.json`;
  const bestand = await map.getFileHandle(naam, { create: true });
  const w = await bestand.createWritable();
  await w.write(JSON.stringify(backup, null, 2));
  await w.close();
  const namen = [];
  for await (const e of map.values()) if (e.kind === 'file' && PATROON.test(e.name)) namen.push(e.name);
  namen.sort();
  for (const oud of namen.slice(0, Math.max(0, namen.length - BEWAREN))) await map.removeEntry(oud);
  return naam;
}

function leesLaatste() {
  try {
    return JSON.parse(localStorage.getItem(LAATSTE_KEY)) || null;
  } catch {
    return null;
  }
}

export function useAutoBackup(apps, versie, ververs) {
  const mogelijk = autoBackupMogelijk();
  const [map, setMap] = useState(null);
  // status: uit | aan | toestemming | fout
  const [status, setStatus] = useState('uit');
  const [fout, setFout] = useState('');
  const [laatste, setLaatste] = useState(leesLaatste);
  const vorige = useRef(laatste?.afdruk ?? null);

  useEffect(() => {
    if (!mogelijk) return;
    hubGet(HANDLE_KEY).then(async (h) => {
      if (!h) return;
      setMap(h);
      setStatus((await h.queryPermission({ mode: 'readwrite' })) === 'granted' ? 'aan' : 'toestemming');
    });
  }, [mogelijk]);

  const bewaar = useCallback(
    async (h = map, { altijd = false } = {}) => {
      if (!h) return;
      try {
        const backup = maakBackup(apps);
        const afdruk = vingerafdruk(backup);
        if (!altijd && afdruk === vorige.current && laatste?.naam === `thuis-auto-${vandaag()}.json`) return;
        const naam = await schrijf(h, backup);
        vorige.current = afdruk;
        const info = { naam, op: new Date().toISOString(), afdruk };
        localStorage.setItem(LAATSTE_KEY, JSON.stringify(info));
        setLaatste(info);
        markeerBackupGemaakt();
        setStatus('aan');
        setFout('');
        ververs?.();
      } catch (e) {
        if (e?.name === 'NotAllowedError') setStatus('toestemming');
        else {
          setStatus('fout');
          setFout(e?.message || 'Schrijven naar de map is mislukt.');
        }
      }
    },
    [map, apps, laatste, ververs]
  );

  // Kort na het openen en na elke wijziging (ook vanuit een app in een ander tabblad).
  useEffect(() => {
    if (status !== 'aan') return;
    const t = setTimeout(() => bewaar(), WACHTTIJD);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, versie]);

  const kiesMap = async () => {
    try {
      const h = await window.showDirectoryPicker({ id: 'thuis-backup', mode: 'readwrite' });
      await hubSet(HANDLE_KEY, h);
      setMap(h);
      await bewaar(h, { altijd: true });
    } catch (e) {
      if (e?.name !== 'AbortError') {
        setStatus('fout');
        setFout(e?.message || 'Kon de map niet gebruiken.');
      }
    }
  };

  // Na een herstart van de browser vraagt die opnieuw om toestemming; dat kan alleen na een klik.
  const geefToestemming = async () => {
    if (!map) return;
    if ((await map.requestPermission({ mode: 'readwrite' })) === 'granted') {
      setStatus('aan');
      await bewaar(map, { altijd: true });
    }
  };

  const zetUit = async () => {
    await hubDelete(HANDLE_KEY);
    localStorage.removeItem(LAATSTE_KEY);
    setMap(null);
    setLaatste(null);
    setStatus('uit');
  };

  return {
    mogelijk,
    status,
    fout,
    laatste,
    mapNaam: map?.name || '',
    kiesMap,
    geefToestemming,
    zetUit,
    nu: () => bewaar(map, { altijd: true })
  };
}
