import { useMemo } from 'react';
import Opslagmeter from './Opslagmeter.jsx';
import { BACKUP_HERINNERING_DAGEN, DEFAULT_APPS } from '../config.js';
import { appStatus } from '../appStatus.js';
import { opslagStatus, laatsteBackup, formatMB, formatDatum, formatProcent } from '../storage.js';

// Lijniconen voor de standaard-apps (alleen zolang het icoon niet zelf is aangepast).
const svg = (pad) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {pad}
  </svg>
);
const APP_ICONEN = {
  huishoudboekje: svg(
    <>
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </>
  ),
  vermogen: svg(
    <>
      <path d="M22 7 13.5 15.5 8.5 10.5 2 17" />
      <path d="M16 7h6v6" />
    </>
  ),
  onderhoud: svg(
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  )
};
const standaardIcoon = (a) => {
  const std = DEFAULT_APPS.find((d) => d.id === a.id);
  return std && std.icoon === a.icoon ? APP_ICONEN[a.id] : null;
};

const Pijl = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const PERSIST_TEKST = {
  ja: { label: 'Beschermd', uitleg: 'Je browser bewaart je gegevens en ruimt ze niet zelf op.', klasse: 'goed' },
  nee: {
    label: 'Niet beschermd',
    uitleg:
      'Je browser mag je gegevens wissen als de schijf vol raakt of als je de hub lang niet opent. Installeer de hub eerst als app en vraag het daarna opnieuw aan; dan staat de browser het meestal wel toe.',
    klasse: 'let-op'
  },
  'niet-ondersteund': {
    label: 'Niet beschikbaar',
    uitleg: 'Je browser kan je gegevens niet extra beschermen. Maak daarom regelmatig een back-up.',
    klasse: 'let-op'
  },
  onbekend: { label: 'Onbekend', uitleg: 'De status wordt opgehaald…', klasse: '' }
};

const INSTALLEER_TEKST = {
  geinstalleerd: { label: 'Geïnstalleerd', uitleg: 'Je opent de hub als losse app.', klasse: 'goed' },
  kan: {
    label: 'Nog niet',
    uitleg: 'Dan open je de hub met één klik of tik, zonder adresbalk, en werkt hij ook zonder internet.',
    klasse: ''
  },
  ios: {
    label: 'Nog niet',
    uitleg: 'Tik in Safari op de deelknop (vierkantje met pijl) en kies "Zet op beginscherm".',
    klasse: ''
  },
  menu: {
    label: 'Nog niet',
    uitleg: 'Kies in het menu van je browser "App installeren" of "Toevoegen aan startscherm".',
    klasse: ''
  }
};

export default function Overzicht({ apps, versie, persist, onPersist, installeer, onInstalleer, naarBackup, naarInstellingen }) {
  const status = useMemo(() => opslagStatus(apps), [apps, versie]);
  const laatste = useMemo(() => laatsteBackup(), [versie]);
  const dagenGeleden = laatste ? Math.floor((Date.now() - laatste.getTime()) / 86_400_000) : null;
  const backupNodig = laatste === null || dagenGeleden >= BACKUP_HERINNERING_DAGEN;
  const p = PERSIST_TEKST[persist] ?? PERSIST_TEKST.onbekend;
  const inst = INSTALLEER_TEKST[installeer] ?? INSTALLEER_TEKST.menu;
  const zonderSleutels = apps.filter((a) => a.sleutels.length === 0);
  const statusPerApp = useMemo(() => Object.fromEntries(apps.map((a) => [a.id, appStatus(a.id)])), [apps, versie]);

  return (
    <>
      <section className="tegels" aria-label="Apps">
        {apps.map((a) => {
          const s = status.perApp[a.id] ?? { tekens: 0, aantal: 0 };
          const regels = statusPerApp[a.id] ?? [];
          return (
            <a key={a.id} className="tegel" href={a.pad} style={{ '--app-kleur': a.kleur }}>
              <span className="tegel-icoon" aria-hidden="true">
                {standaardIcoon(a) ?? a.icoon}
              </span>
              <span className="tegel-tekst">
                <span className="tegel-naam">{a.naam}</span>
                <span className="zacht">{a.omschrijving}</span>
              </span>
              <span className="tegel-pijl" aria-hidden="true">
                <Pijl />
              </span>
              {regels.length > 0 && (
                <span className="tegel-status">
                  {regels.map((r) => (
                    <span key={r.tekst} className={`status-chip ${r.soort}`}>
                      {r.tekst}
                    </span>
                  ))}
                </span>
              )}
              <span className="tegel-meta zacht">
                <span className="stip" />
                {a.sleutels.length ? `${formatMB(s.tekens)} aan gegevens` : 'nog niet gekoppeld aan de back-up'}
              </span>
            </a>
          );
        })}
      </section>

      {backupNodig && (
        <div className="banner">
          <div>
            <strong>{laatste ? `Laatste back-up ${dagenGeleden} dagen geleden` : 'Nog geen back-up gemaakt'}</strong>
            <p>Eén bestand met de gegevens van al je apps.</p>
          </div>
          <button className="knop primair" onClick={naarBackup}>
            Back-up maken
          </button>
        </div>
      )}

      {zonderSleutels.length > 0 && (
        <div className="banner banner-info">
          <div>
            <strong>Sleutels nog niet ingesteld</strong>
            <p>
              Voor {zonderSleutels.map((a) => a.naam).join(', ')} weet de hub nog niet welke gegevens erbij
              horen. Zonder sleutels gaan ze niet mee in de back-up.
            </p>
          </div>
          <button className="knop" onClick={naarInstellingen}>
            Instellen
          </button>
        </div>
      )}

      <section className="cijfers" aria-label="Samenvatting">
        <div className="cijfer">
          <span className="cijfer-label">Opslag gebruikt</span>
          <span className="cijfer-waarde">{formatProcent(status.fractie)}</span>
        </div>
        <div className="cijfer">
          <span className="cijfer-label">Laatste back-up</span>
          <span className={`cijfer-waarde ${backupNodig ? 'let-op' : 'goed'}`}>
            {laatste ? (dagenGeleden === 0 ? 'Vandaag' : `${dagenGeleden} ${dagenGeleden === 1 ? 'dag' : 'dagen'} geleden`) : 'Nog nooit'}
          </span>
        </div>
        <div className="cijfer">
          <span className="cijfer-label">Opslag beschermd</span>
          <span className={`cijfer-waarde ${p.klasse}`}>{p.label}</span>
        </div>
      </section>

      <section className="kaart">
        <h2>Opslag</h2>
        <Opslagmeter apps={apps} status={status} />
      </section>

      <section className="kaart">
        <h2>Bescherming en back-up</h2>
        <p className="zacht">
          Je gegevens staan alleen in deze browser op dit apparaat, niet op een server. Deze drie dingen zorgen dat
          je ze niet kwijtraakt.
        </p>
        <div className="rij">
          <div>
            <div className="rij-titel">
              Als app installeren <span className={`label ${inst.klasse}`}>{inst.label}</span>
            </div>
            <p className="zacht">{inst.uitleg}</p>
          </div>
          {installeer === 'kan' && (
            <button className="knop" onClick={onInstalleer}>
              Installeren
            </button>
          )}
        </div>
        <div className="rij">
          <div>
            <div className="rij-titel">
              Permanente opslag <span className={`label ${p.klasse}`}>{p.label}</span>
            </div>
            <p className="zacht">{p.uitleg}</p>
          </div>
          {persist === 'nee' && (
            <button className="knop" onClick={onPersist}>
              Opnieuw aanvragen
            </button>
          )}
        </div>
        <div className="rij">
          <div>
            <div className="rij-titel">Laatste back-up</div>
            <p className="zacht">{laatste ? formatDatum(laatste) : 'Nog nooit'}</p>
          </div>
          <button className="knop" onClick={naarBackup}>
            Naar back-up
          </button>
        </div>
      </section>
    </>
  );
}
