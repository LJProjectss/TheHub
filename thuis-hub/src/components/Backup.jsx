import { useMemo, useState } from 'react';
import {
  OVERIG_ID,
  opslagStatus,
  maakBackup,
  downloadJson,
  backupBestandsnaam,
  markeerBackupGemaakt,
  laatsteBackup,
  leesBackupBestand,
  herstelBackup,
  formatMB,
  formatDatumTijd
} from '../storage.js';

function AutoBackup({ auto }) {
  if (!auto.mogelijk) {
    return (
      <section className="kaart">
        <h2>Automatische back-up</h2>
        <p className="zacht">
          Dit kan alleen in Chrome of Edge op de computer. Maak op dit apparaat zelf af en toe een back-up hieronder.
        </p>
      </section>
    );
  }
  const label = { aan: ['Aan', 'goed'], toestemming: ['Wacht op toestemming', 'let-op'], fout: ['Fout', 'let-op'], uit: ['Uit', ''] }[
    auto.status
  ];
  return (
    <section className="kaart">
      <div className="kaart-kop">
        <h2>
          Automatische back-up <span className={`label ${label[1]}`}>{label[0]}</span>
        </h2>
      </div>
      <p className="zacht">
        De hub zet de gegevens van al je apps in een map op je computer, bijvoorbeeld in OneDrive of Dropbox. Elke
        keer dat je de hub opent en er iets veranderd is, wordt het bestand van vandaag bijgewerkt. De laatste 30
        dagen blijven bewaard.
      </p>
      {auto.status !== 'uit' && (
        <p className="zacht">
          Map: <strong>{auto.mapNaam}</strong>
          {auto.laatste && (
            <>
              {' '}
              · laatst bijgewerkt {formatDatumTijd(new Date(auto.laatste.op))} ({auto.laatste.naam})
            </>
          )}
        </p>
      )}
      {auto.status === 'toestemming' && (
        <p className="melding melding-waarschuwing">
          Je browser vraagt na een herstart opnieuw om toestemming voor de map. Klik op "Toestemming geven".
        </p>
      )}
      {auto.status === 'fout' && <p className="melding melding-kritiek">{auto.fout}</p>}
      <div className="knoppenrij">
        {auto.status === 'uit' && (
          <button className="knop primair" onClick={auto.kiesMap}>
            Map kiezen…
          </button>
        )}
        {auto.status === 'toestemming' && (
          <button className="knop primair" onClick={auto.geefToestemming}>
            Toestemming geven
          </button>
        )}
        {auto.status === 'aan' && (
          <button className="knop" onClick={auto.nu}>
            Nu bijwerken
          </button>
        )}
        {auto.status !== 'uit' && (
          <>
            <button className="knop" onClick={auto.kiesMap}>
              Andere map
            </button>
            <button className="knop" onClick={auto.zetUit}>
              Uitzetten
            </button>
          </>
        )}
      </div>
    </section>
  );
}

export default function Backup({ apps, versie, ververs, auto }) {
  const status = useMemo(() => opslagStatus(apps), [apps, versie]);
  const laatste = useMemo(() => laatsteBackup(), [versie]);

  /* ----- Export ----- */
  const [exportIds, setExportIds] = useState(() => apps.map((a) => a.id));
  const [metOverig, setMetOverig] = useState(false);
  const [exportMelding, setExportMelding] = useState('');

  const wisselExport = (id) =>
    setExportIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const exporteer = () => {
    const backup = maakBackup(apps, { appIds: exportIds, inclusiefOverig: metOverig });
    const aantal = Object.values(backup.apps).reduce((t, a) => t + Object.keys(a.sleutels).length, 0);
    downloadJson(backup, backupBestandsnaam());
    markeerBackupGemaakt();
    setExportMelding(`Back-up gedownload met ${aantal} sleutels.`);
    ververs();
  };

  /* ----- Import ----- */
  const [backup, setBackup] = useState(null);
  const [bestandsnaam, setBestandsnaam] = useState('');
  const [importIds, setImportIds] = useState([]);
  const [vervang, setVervang] = useState(true);
  const [eerstVeiligstellen, setEerstVeiligstellen] = useState(true);
  const [importFout, setImportFout] = useState('');
  const [importMelding, setImportMelding] = useState('');

  const kiesBestand = async (e) => {
    const bestand = e.target.files?.[0];
    e.target.value = '';
    setImportFout('');
    setImportMelding('');
    setBackup(null);
    if (!bestand) return;
    try {
      const b = await leesBackupBestand(bestand);
      setBackup(b);
      setBestandsnaam(bestand.name);
      setImportIds(Object.keys(b.apps));
    } catch (fout) {
      setImportFout(fout.message);
    }
  };

  const wisselImport = (id) =>
    setImportIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const naamVan = (id) =>
    apps.find((a) => a.id === id)?.naam ?? backup?.apps[id]?.naam ?? id;

  const herstel = () => {
    if (!backup || importIds.length === 0) return;
    const namen = importIds.map(naamVan).join(', ');
    const ok = window.confirm(
      `Gegevens terugzetten voor: ${namen}?\n\n` +
        (vervang
          ? 'De huidige gegevens van deze apps worden vervangen door die uit de back-up.'
          : 'Sleutels uit de back-up overschrijven bestaande sleutels met dezelfde naam; overige gegevens blijven staan.')
    );
    if (!ok) return;

    if (eerstVeiligstellen) {
      const huidig = maakBackup(apps, { inclusiefOverig: true });
      downloadJson(huidig, backupBestandsnaam().replace('.json', '-voor-herstel.json'));
    }

    try {
      const r = herstelBackup(backup, apps, importIds, { vervang });
      setImportMelding(
        `Klaar: ${r.geplaatst} sleutels teruggezet` +
          (r.verwijderd ? `, ${r.verwijderd} oude sleutels verwijderd` : '') +
          '. Open de apps om te controleren of alles klopt.'
      );
      setImportFout('');
      setBackup(null);
      ververs();
    } catch (fout) {
      setImportFout(fout.message);
    }
  };

  const onbekendeIds = backup
    ? Object.keys(backup.apps).filter((id) => id !== OVERIG_ID && !apps.some((a) => a.id === id))
    : [];

  return (
    <>
      <AutoBackup auto={auto} />

      <section className="kaart">
        <h2>Back-up maken</h2>
        <p className="zacht">
          Eén JSON-bestand met de gegevens van de gekozen apps.{' '}
          {laatste ? `Laatste back-up: ${formatDatumTijd(laatste)}.` : 'Je hebt nog geen back-up gemaakt.'}
        </p>

        <ul className="keuzelijst">
          {apps.map((a) => {
            const s = status.perApp[a.id];
            const leeg = a.sleutels.length === 0;
            return (
              <li key={a.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={exportIds.includes(a.id)}
                    onChange={() => wisselExport(a.id)}
                  />
                  <span className="keuze-naam">
                    {a.icoon} {a.naam}
                  </span>
                  <span className="zacht">
                    {leeg ? 'geen sleutels ingesteld' : `${s.aantal} ${s.aantal === 1 ? "sleutel" : "sleutels"} · ${formatMB(s.tekens)}`}
                  </span>
                </label>
              </li>
            );
          })}
          {status.overig.aantal > 0 && (
            <li>
              <label>
                <input type="checkbox" checked={metOverig} onChange={(e) => setMetOverig(e.target.checked)} />
                <span className="keuze-naam">Niet-toegewezen sleutels</span>
                <span className="zacht">
                  {status.overig.aantal} {status.overig.aantal === 1 ? "sleutel" : "sleutels"} · {formatMB(status.overig.tekens)}
                </span>
              </label>
            </li>
          )}
        </ul>

        <button
          className="knop primair"
          onClick={exporteer}
          disabled={exportIds.length === 0 && !metOverig}
        >
          Back-up downloaden
        </button>
        {exportMelding && <p className="melding melding-ok">{exportMelding}</p>}
      </section>

      <section className="kaart">
        <h2>Back-up terugzetten</h2>
        <p className="zacht">Kies een back-upbestand van de hub. Je ziet eerst wat erin zit.</p>

        <label className="knop bestandsknop">
          Bestand kiezen…
          <input type="file" accept="application/json,.json" onChange={kiesBestand} />
        </label>

        {importFout && <p className="melding melding-kritiek">{importFout}</p>}
        {importMelding && <p className="melding melding-ok">{importMelding}</p>}

        {backup && (
          <div className="importvoorbeeld">
            <p>
              <strong>{bestandsnaam}</strong>
              <br />
              <span className="zacht">Gemaakt op {formatDatumTijd(new Date(backup.gemaakt))}</span>
            </p>

            <ul className="keuzelijst">
              {Object.entries(backup.apps).map(([id, deel]) => {
                const tekens = Object.entries(deel.sleutels).reduce((t, [k, v]) => t + k.length + v.length, 0);
                return (
                  <li key={id}>
                    <label>
                      <input type="checkbox" checked={importIds.includes(id)} onChange={() => wisselImport(id)} />
                      <span className="keuze-naam">{naamVan(id)}</span>
                      <span className="zacht">
                        {Object.keys(deel.sleutels).length} sleutels · {formatMB(tekens)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            {onbekendeIds.length > 0 && (
              <p className="melding melding-waarschuwing">
                {onbekendeIds.map(naamVan).join(', ')} staat niet (meer) in je instellingen. Die gegevens worden
                wel teruggezet, maar bestaande gegevens van die app worden niet eerst verwijderd.
              </p>
            )}

            <label className="optie">
              <input type="checkbox" checked={vervang} onChange={(e) => setVervang(e.target.checked)} />
              <span>
                Huidige gegevens van deze apps eerst verwijderen
                <span className="zacht blok">Aanbevolen: zo blijven er geen oude restjes achter.</span>
              </span>
            </label>
            <label className="optie">
              <input
                type="checkbox"
                checked={eerstVeiligstellen}
                onChange={(e) => setEerstVeiligstellen(e.target.checked)}
              />
              <span>
                Eerst een back-up van de huidige situatie downloaden
                <span className="zacht blok">Zo kun je altijd terug als je het verkeerde bestand kiest.</span>
              </span>
            </label>

            <div className="knoppenrij">
              <button className="knop primair" onClick={herstel} disabled={importIds.length === 0}>
                Terugzetten
              </button>
              <button className="knop" onClick={() => setBackup(null)}>
                Annuleren
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
