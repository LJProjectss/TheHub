import { MONTH_NAMES, currentMonth } from '../lib/format.js';

// Maandkeuze met Nederlandse maandnamen. Het standaard maandveld van de browser toont
// de maand in de taal van het systeem (vaak Engels) en ziet er per browser anders uit.
// Met allowEmpty kan de keuze ook leeg zijn (waarde ''), met min ('JJJJ-MM') niet eerder dan die maand.
export default function MonthPicker({ value, onChange, fromYear, toYear, allowEmpty = false, emptyLabel = 'Geen', min }) {
  const empty = !value;
  const nowYear = +currentMonth().slice(0, 4);
  const [minY, minM] = min ? min.split('-').map(Number) : [null, null];
  const [y, m] = empty ? [minY ?? nowYear, 0] : value.split('-').map(Number);
  const first = Math.min(minY ?? fromYear ?? nowYear - 10, y);
  const last = Math.max(toYear ?? nowYear + 1, y);
  const years = [];
  for (let j = last; j >= first; j--) years.push(j);
  const set = (year, month) => {
    if (!month) return onChange('');
    if (min && (year < minY || (year === minY && month < minM))) [year, month] = [minY, minM];
    onChange(`${year}-${String(month).padStart(2, '0')}`);
  };
  return (
    <span className="month-picker">
      <select value={m} onChange={(e) => set(y, +e.target.value)} aria-label="Maand">
        {allowEmpty && <option value={0}>{emptyLabel}</option>}
        {MONTH_NAMES.map((naam, i) => (
          <option key={naam} value={i + 1} disabled={min && y === minY && i + 1 < minM}>{naam}</option>
        ))}
      </select>
      {!empty && (
        <select value={y} onChange={(e) => set(+e.target.value, m)} aria-label="Jaar">
          {years.map((j) => (
            <option key={j} value={j}>{j}</option>
          ))}
        </select>
      )}
    </span>
  );
}
