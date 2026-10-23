import { useCallback, useEffect, useState } from 'react';
import Overzicht from './components/Overzicht.jsx';
import Backup from './components/Backup.jsx';
import Instellingen from './components/Instellingen.jsx';
import { useAutoBackup } from './autoBackup.js';
import { laadConfig, bewaarConfig, persistStatus, vraagPersist, persistAlGevraagd } from './storage.js';

const TABS = [
  { id: 'overzicht', label: 'Overzicht' },
  { id: 'backup', label: 'Back-up' },
  { id: 'instellingen', label: 'Instellingen' }
];

const KOPPEN = {
  backup: { titel: 'Back-up', tekst: 'Eén bestand met de gegevens van al je apps, en terugzetten per app.' },
  instellingen: { titel: 'Instellingen', tekst: 'Hoe je apps op het overzicht staan.' }
};

function begroeting(uur) {
  if (uur < 6) return 'Goedenacht';
  if (uur < 12) return 'Goedemorgen';
  if (uur < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

function Welkom({ tab }) {
  if (tab !== 'overzicht') {
    const k = KOPPEN[tab];
    return (
      <div className="welkom welkom-klein">
        <h1>{k.titel}</h1>
        <p>{k.tekst}</p>
      </div>
    );
  }
  const nu = new Date();
  const datum = nu.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div className="welkom">
      <h1>{begroeting(nu.getHours())}</h1>
      <p>
        {datum.charAt(0).toUpperCase() + datum.slice(1)} · al je geldzaken en onderhoud op één plek
      </p>
    </div>
  );
}

function tabUitHash() {
  const h = window.location.hash.replace('#', '');
  return TABS.some((t) => t.id === h) ? h : 'overzicht';
}

export default function App() {
  const [tab, setTab] = useState(tabUitHash);
  const [apps, setApps] = useState(laadConfig);
  const [versie, setVersie] = useState(0); // verhogen = opslag opnieuw meten
  const [persist, setPersist] = useState('onbekend');
  const [installPrompt, setInstallPrompt] = useState(null);
  const [geinstalleerd, setGeinstalleerd] = useState(
    () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
  );

  const ververs = useCallback(() => setVersie((v) => v + 1), []);
  const auto = useAutoBackup(apps, versie, ververs);

  useEffect(() => {
    const opHash = () => setTab(tabUitHash());
    window.addEventListener('hashchange', opHash);
    // Andere tabbladen (bijv. een app in een tweede venster) kunnen data wijzigen.
    window.addEventListener('storage', ververs);
    window.addEventListener('focus', ververs);
    return () => {
      window.removeEventListener('hashchange', opHash);
      window.removeEventListener('storage', ververs);
      window.removeEventListener('focus', ververs);
    };
  }, [ververs]);

  // Persistente opslag: status ophalen en de eerste keer automatisch aanvragen.
  useEffect(() => {
    (async () => {
      let s = await persistStatus();
      if (s === 'nee' && !persistAlGevraagd()) s = await vraagPersist();
      setPersist(s);
    })();
  }, []);

  // Installeren als app: Chrome en Edge geven een eigen installatievraag die we later kunnen tonen.
  useEffect(() => {
    const opPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const opInstall = () => {
      setGeinstalleerd(true);
      setInstallPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', opPrompt);
    window.addEventListener('appinstalled', opInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', opPrompt);
      window.removeEventListener('appinstalled', opInstall);
    };
  }, []);

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const installeer = geinstalleerd ? 'geinstalleerd' : installPrompt ? 'kan' : isIos ? 'ios' : 'menu';

  const installeerApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (outcome === 'accepted') {
      setGeinstalleerd(true);
      if (persist === 'nee') setPersist(await vraagPersist());
    }
  };

  const kiesTab = (id) => {
    window.location.hash = id;
    setTab(id);
  };

  const slaAppsOp = (nieuw) => {
    bewaarConfig(nieuw);
    setApps(nieuw);
    ververs();
  };

  const vraagPersistAan = async () => setPersist(await vraagPersist());

  return (
    <div className="shell">
      <header className="kop">
        <div className="merk">
          <img src="/icon.svg" alt="" width="32" height="32" />
          <span>Thuis</span>
        </div>
        <nav className="tabs" aria-label="Onderdelen">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'tab actief' : 'tab'}
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => kiesTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <Welkom tab={tab} />

      <main className="inhoud">
        {tab === 'overzicht' && (
          <Overzicht
            apps={apps}
            versie={versie}
            persist={persist}
            onPersist={vraagPersistAan}
            installeer={installeer}
            onInstalleer={installeerApp}
            auto={auto}
            naarBackup={() => kiesTab('backup')}
            naarInstellingen={() => kiesTab('instellingen')}
          />
        )}
        {tab === 'backup' && <Backup apps={apps} versie={versie} ververs={ververs} auto={auto} />}
        {tab === 'instellingen' && (
          <Instellingen apps={apps} versie={versie} onOpslaan={slaAppsOp} />
        )}
      </main>
    </div>
  );
}
