import { useMemo, useState } from 'react';
import { maandTaken } from '../appStatus.js';
import { HUB_PREFIX } from '../config.js';

const AFGEVINKT_KEY = `${HUB_PREFIX}maandafsluiting`;
const p2 = (n) => String(n).padStart(2, '0');

function leesAfgevinkt() {
  try {
    return JSON.parse(localStorage.getItem(AFGEVINKT_KEY)) || {};
  } catch {
    return {};
  }
}

// Lijstje met de vaste klusjes van deze maand. Wat de hub zelf kan zien, vinkt hij zelf af;
// de rest vink je hier af. Afvinkingen gelden per maand.
export default function Maandafsluiting({ apps, versie, naarBackup }) {
  const nu = new Date();
  const maand = `${nu.getFullYear()}-${p2(nu.getMonth() + 1)}`;
  const [afgevinkt, setAfgevinkt] = useState(leesAfgevinkt);
  const [open, setOpen] = useState(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const taken = useMemo(() => maandTaken(nu), [versie]);
  const hand = afgevinkt[maand] || [];
  const isKlaar = (t) => t.klaar === true || hand.includes(t.id);
  const aantal = taken.filter(isKlaar).length;
  const alles = aantal === taken.length;
  const uitgeklapt = open ?? !alles;

  const wissel = (id) => {
    const lijst = hand.includes(id) ? hand.filter((x) => x !== id) : [...hand, id];
    // Alleen de huidige en vorige maand bewaren.
    const volgende = Object.fromEntries(Object.entries({ ...afgevinkt, [maand]: lijst }).sort().slice(-2));
    localStorage.setItem(AFGEVINKT_KEY, JSON.stringify(volgende));
    setAfgevinkt(volgende);
  };

  const padVan = (appId) => apps.find((a) => a.id === appId)?.pad;
  const maandNaam = nu.toLocaleDateString('nl-NL', { month: 'long' });

  return (
    <section className="kaart afsluiting">
      <button className="afsluiting-kop" onClick={() => setOpen(!uitgeklapt)} aria-expanded={uitgeklapt}>
        <span>
          <h2>Maandafsluiting {maandNaam}</h2>
          <span className="zacht">{alles ? 'Alles gedaan voor deze maand.' : `${aantal} van ${taken.length} gedaan`}</span>
        </span>
        <span className="afsluiting-voortgang" style={{ '--p': `${(aantal / taken.length) * 100}%` }} aria-hidden="true" />
      </button>
      {uitgeklapt && (
        <ul className="taken">
          {taken.map((t) => {
            const klaar = isKlaar(t);
            const automatisch = t.klaar !== null;
            const pad = t.app ? padVan(t.app) : null;
            return (
              <li key={t.id} className={klaar ? 'klaar' : ''}>
                <label>
                  <input
                    type="checkbox"
                    checked={klaar}
                    disabled={t.klaar === true}
                    onChange={() => wissel(t.id)}
                  />
                  <span>
                    {t.tekst}
                    {automatisch && t.klaar === true && <span className="zacht klein-tekst"> · automatisch gezien</span>}
                  </span>
                </label>
                {!klaar && pad && (
                  <a className="knop klein" href={pad}>
                    Openen
                  </a>
                )}
                {!klaar && t.id === 'backup' && (
                  <button className="knop klein" onClick={naarBackup}>
                    Back-up maken
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
