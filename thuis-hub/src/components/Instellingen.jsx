import { useEffect, useMemo, useState } from 'react';
import { HUB_PREFIX } from '../config.js';
import { alleSleutels, pastBijApp, uitgeslotenVanBackup, tekensVan, standaardApps, formatMB } from '../storage.js';

const naarTekst = (sleutels) => sleutels.join('\n');
const naarLijst = (tekst) =>
  tekst
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

function maakId(naam, bestaande) {
  const basis =
    naam
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'app';
  let id = basis;
  let n = 2;
  while (bestaande.includes(id)) id = `${basis}-${n++}`;
  return id;
}

export default function Instellingen({ apps, versie, onOpslaan }) {
  // Concept: de sleutels als tekst, zodat je vrij kunt typen.
  const [concept, setConcept] = useState(() => apps.map((a) => ({ ...a, sleutelTekst: naarTekst(a.sleutels) })));
  const [melding, setMelding] = useState('');

  useEffect(() => {
    setConcept(apps.map((a) => ({ ...a, sleutelTekst: naarTekst(a.sleutels) })));
  }, [apps]);

  const conceptApps = concept.map(({ sleutelTekst, ...a }) => ({ ...a, sleutels: naarLijst(sleutelTekst) }));
  const gewijzigd = JSON.stringify(conceptApps) !== JSON.stringify(apps);

  const gevonden = useMemo(
    () =>
      alleSleutels()
        .filter((k) => !k.startsWith(HUB_PREFIX))
        .map((k) => ({ sleutel: k, tekens: tekensVan(k), app: conceptApps.find((a) => pastBijApp(k, a)) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [versie, JSON.stringify(conceptApps)]
  );

  const wijzig = (i, veld, waarde) =>
    setConcept((c) => c.map((a, j) => (j === i ? { ...a, [veld]: waarde } : a)));

  const voegSleutelToe = (appId, patroon) =>
    setConcept((c) =>
      c.map((a) =>
        a.id === appId
          ? { ...a, sleutelTekst: [...naarLijst(a.sleutelTekst), patroon].join('\n') }
          : a
      )
    );

  const verwijderApp = (i) => {
    if (!window.confirm(`"${concept[i].naam}" uit de hub verwijderen? De gegevens van de app zelf blijven staan.`))
      return;
    setConcept((c) => c.filter((_, j) => j !== i));
  };

  const nieuweApp = () =>
    setConcept((c) => [
      ...c,
      {
        id: maakId('nieuwe app', c.map((a) => a.id)),
        naam: 'Nieuwe app',
        pad: '/nieuwe-app/',
        icoon: '📦',
        kleur: '#2e8b57',
        omschrijving: '',
        sleutelTekst: ''
      }
    ]);

  const opslaan = () => {
    const fouten = [];
    conceptApps.forEach((a) => {
      if (!a.naam.trim()) fouten.push('Elke app heeft een naam nodig.');
      if (!a.pad.startsWith('/')) fouten.push(`Het pad van "${a.naam}" moet met / beginnen.`);
    });
    if (fouten.length) {
      setMelding(fouten[0]);
      return;
    }
    onOpslaan(conceptApps);
    setMelding('Opgeslagen.');
  };

  const herstelStandaard = () => {
    if (!window.confirm('Alle app-instellingen terugzetten naar de standaard? Je ingevulde sleutels gaan verloren.'))
      return;
    onOpslaan(standaardApps());
    setMelding('Standaardinstellingen teruggezet.');
  };

  return (
    <>
      <section className="kaart">
        <h2>Apps</h2>
        <p className="zacht">
          Naam, icoon en kleur van de tegels op het overzicht. Onder "Geavanceerd" staat per app welke opgeslagen
          gegevens erbij horen; dat hoef je normaal niet aan te passen.
        </p>

        {concept.map((a, i) => (
          <fieldset key={a.id} className="app-instelling" style={{ '--app-kleur': a.kleur }}>
            <legend>
              {a.icoon} {a.naam || 'Naamloos'}
            </legend>
            <div className="velden">
              <label>
                Naam
                <input value={a.naam} onChange={(e) => wijzig(i, 'naam', e.target.value)} />
              </label>
              <label className="smal">
                Icoon
                <input value={a.icoon} onChange={(e) => wijzig(i, 'icoon', e.target.value)} maxLength={4} />
              </label>
              <label className="smal">
                Kleur
                <input type="color" value={a.kleur} onChange={(e) => wijzig(i, 'kleur', e.target.value)} />
              </label>
              <label className="breed">
                Omschrijving
                <input value={a.omschrijving} onChange={(e) => wijzig(i, 'omschrijving', e.target.value)} />
              </label>
            </div>
            <details className="geavanceerd" open={a.sleutelTekst.trim() === ''}>
              <summary>Geavanceerd</summary>
              <p className="zacht">
                Opgeslagen gegevens (localStorage-sleutels) van deze app, één per regel. Een <code>*</code> aan het
                eind telt voor alle sleutels met hetzelfde begin, bijvoorbeeld <code>huishoudboekje-*</code>. Een
                regel die met <code>!</code> begint hoort wel bij de app, maar gaat niet mee in de back-up (zoals
                inlogtokens).
              </p>
              <div className="velden">
                <label>
                  Pad
                  <input value={a.pad} onChange={(e) => wijzig(i, 'pad', e.target.value)} placeholder="/map/" />
                </label>
                <label className="breed">
                  Sleutels
                  <textarea
                    rows={3}
                    value={a.sleutelTekst}
                    onChange={(e) => wijzig(i, 'sleutelTekst', e.target.value)}
                    placeholder={'bijv.\nmijnapp-*\n!mijnapp-token'}
                    spellCheck={false}
                  />
                </label>
              </div>
            </details>
            <button className="knop klein gevaar" onClick={() => verwijderApp(i)}>
              App verwijderen uit hub
            </button>
          </fieldset>
        ))}

        <div className="knoppenrij">
          <button className="knop primair" onClick={opslaan} disabled={!gewijzigd}>
            Opslaan
          </button>
          <button className="knop" onClick={nieuweApp}>
            App toevoegen
          </button>
          <button className="knop" onClick={herstelStandaard}>
            Standaard herstellen
          </button>
        </div>
        {gewijzigd && <p className="melding melding-waarschuwing">Je hebt niet-opgeslagen wijzigingen.</p>}
        {melding && !gewijzigd && <p className="melding melding-ok">{melding}</p>}
      </section>

      <details className="kaart geavanceerd-kaart" open={gevonden.some((g) => !g.app)}>
        <summary>
          <h2>Gevonden sleutels</h2>
          {gevonden.some((g) => !g.app) && <span className="label let-op">Niet alles gekoppeld</span>}
        </summary>
        <p className="zacht">
          Alle localStorage-sleutels op dit adres (behalve die van de hub zelf). Dit werkt pas als de apps op hetzelfde
          adres draaien als de hub en je ze minstens één keer hebt geopend.
        </p>
        {gevonden.length === 0 ? (
          <p className="leeg">Nog geen sleutels gevonden.</p>
        ) : (
          <div className="tabel-wrap">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Sleutel</th>
                  <th className="rechts">Grootte</th>
                  <th>Hoort bij</th>
                </tr>
              </thead>
              <tbody>
                {gevonden.map((g) => (
                  <tr key={g.sleutel}>
                    <td>
                      <code>{g.sleutel}</code>
                    </td>
                    <td className="rechts zacht">{formatMB(g.tekens)}</td>
                    <td>
                      {g.app ? (
                        <>
                          <span className="label" style={{ '--app-kleur': g.app.kleur }}>
                            {g.app.naam}
                          </span>
                          {uitgeslotenVanBackup(g.sleutel, g.app) && (
                            <span className="zacht klein-tekst"> · niet in back-up</span>
                          )}
                        </>
                      ) : (
                        <select
                          defaultValue=""
                          onChange={(e) => e.target.value && voegSleutelToe(e.target.value, g.sleutel)}
                          aria-label={`Koppel ${g.sleutel} aan een app`}
                        >
                          <option value="">Niet toegewezen – kies…</option>
                          {concept.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.naam}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="voetnoot">Na het koppelen nog op "Opslaan" drukken.</p>
      </details>
    </>
  );
}
