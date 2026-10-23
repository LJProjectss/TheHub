import { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { fmtMoney, yearOf } from '../utils.js';
import { TypeIcon } from './ui.jsx';

export default function CostsView({ navigate }) {
  const { state, t, settings } = useStore();
  const [filter, setFilter] = useState('all');

  const items = state.items
    .filter((i) => filter === 'all' || i.type === filter)
    .sort((a, b) => a.name.localeCompare(b.name));

  const years = useMemo(
    () => [...new Set(state.logs.map((l) => yearOf(l.date)))].filter(Boolean).sort((a, b) => b - a),
    [state.logs]
  );

  const sum = (itemId, year) =>
    state.logs
      .filter((l) => l.itemId === itemId && (year == null || yearOf(l.date) === year))
      .reduce((s, l) => s + (l.cost || 0), 0);

  const rows = items.map((i) => {
    const perYear = years.map((y) => sum(i.id, y));
    const total = sum(i.id, null);
    const activeYears = perYear.filter((v) => v > 0).length;
    return { item: i, perYear, total, avg: activeYears ? total / activeYears : 0 };
  });
  const colTotals = years.map((_, idx) => rows.reduce((s, r) => s + r.perYear[idx], 0));
  const grand = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{t('costsTitle')}</h1>
          <p className="muted">{t('costsIntro')}</p>
        </div>
      </header>
      <div className="chips">
        {['all', 'auto', 'huis', 'apparaat'].map((f) => (
          <button key={f} className={'chip' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)}>
            {f === 'all' ? t('all') : t('typePlural_' + f)}
          </button>
        ))}
      </div>
      {!years.length || !rows.length ? (
        <p className="empty card">{t('noCosts')}</p>
      ) : (
        <div className="card table-wrap">
          <table className="cost-table">
            <thead>
              <tr>
                <th>{t('item')}</th>
                {years.map((y) => <th key={y} className="num">{y}</th>)}
                <th className="num">{t('total')}</th>
                <th className="num">{t('average')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.item.id}>
                  <td>
                    <button className="link" onClick={() => navigate('#/items/' + r.item.id)}>
                      <TypeIcon type={r.item.type} size={14} /> {r.item.name}
                    </button>
                  </td>
                  {r.perYear.map((v, idx) => (
                    <td key={idx} className={'num' + (v ? '' : ' muted')}>{v ? fmtMoney(v, settings) : '–'}</td>
                  ))}
                  <td className="num strong">{fmtMoney(r.total, settings)}</td>
                  <td className="num muted">{r.avg ? fmtMoney(r.avg, settings) : '–'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>{t('total')}</td>
                {colTotals.map((v, idx) => <td key={idx} className="num">{fmtMoney(v, settings)}</td>)}
                <td className="num">{fmtMoney(grand, settings)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
