import { DREMPEL_WAARSCHUWING, DREMPEL_KRITIEK } from '../config.js';
import { formatMB, formatProcent } from '../storage.js';

export default function Opslagmeter({ apps, status }) {
  const niveau =
    status.fractie >= DREMPEL_KRITIEK ? 'kritiek' : status.fractie >= DREMPEL_WAARSCHUWING ? 'waarschuwing' : 'ok';

  const segmenten = [
    ...apps.map((a) => ({
      id: a.id,
      naam: a.naam,
      kleur: a.kleur || 'var(--accent)',
      tekens: status.perApp[a.id]?.tekens ?? 0
    })),
    { id: '_overig', naam: 'Niet toegewezen', kleur: 'var(--grijs)', tekens: status.overig.tekens },
    { id: '_hub', naam: 'Hub zelf', kleur: 'var(--grijs-licht)', tekens: status.hub.tekens }
  ];

  return (
    <div className="meter">
      <div className="meter-kop">
        <span className="meter-getal">{formatProcent(status.fractie)}</span>
        <span className="zacht">
          {formatMB(status.totaal)} van ~{formatMB(status.limiet)}
        </span>
      </div>

      <div
        className={`balk balk-${niveau}`}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(status.fractie * 100)}
        aria-label="Gebruikte opslag"
      >
        {segmenten.map((s) =>
          s.tekens > 0 ? (
            <span
              key={s.id}
              className="segment"
              title={`${s.naam}: ${formatMB(s.tekens)}`}
              style={{
                width: `${Math.max((s.tekens / status.limiet) * 100, 0.6)}%`,
                background: s.kleur
              }}
            />
          ) : null
        )}
      </div>

      {niveau !== 'ok' && (
        <p className={`melding melding-${niveau}`}>
          {niveau === 'kritiek'
            ? 'De opslag is bijna vol. Maak nu een back-up en ruim oude gegevens op, of stap over op IndexedDB.'
            : 'De opslag raakt voller. Houd het in de gaten en maak regelmatig een back-up.'}
        </p>
      )}

      <ul className="legenda">
        {segmenten
          .filter((s) => s.tekens > 0 || !s.id.startsWith('_'))
          .map((s) => (
            <li key={s.id}>
              <span className="stip" style={{ background: s.kleur }} />
              <span className="legenda-naam">{s.naam}</span>
              <span className="zacht">{formatMB(s.tekens)}</span>
            </li>
          ))}
      </ul>
      <p className="voetnoot">
        Browsers rekenen localStorage in tekens: 1 MB hier ≈ 1 miljoen tekens. De limiet is per adres
        en geldt voor alle apps samen.
      </p>
    </div>
  );
}
