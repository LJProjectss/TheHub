import { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { computeUpcoming, parseIntSafe, fmtNumber } from '../utils.js';
import { exportIcs } from '../exporters.js';
import { Icon } from './ui.jsx';
import PlanRow from './PlanRow.jsx';
import usePlanActions from './usePlanActions.jsx';

export default function PlanningView({ navigate }) {
  const { state, t, settings, dispatch } = useStore();
  const [filter, setFilter] = useState('all');
  const [msg, setMsg] = useState(null);
  const actions = usePlanActions();
  const upcoming = useMemo(() => computeUpcoming(state), [state]);
  const shown = upcoming.filter((u) => filter === 'all' || u.item.type === filter);

  const groups = [
    ['overdue', t('groupOverdue')],
    ['soon', t('groupSoon')],
    ['ok', t('groupLater')]
  ];

  const doIcs = () => {
    const ids = shown.map((u) => u.plan.id);
    const r = exportIcs(state, ids);
    if (!r.count) setMsg(t('icsNone'));
    else setMsg(r.skipped ? t('icsSkipped', { n: r.skipped }) : null);
  };

  const setDefault = (key) => (e) => {
    const n = parseIntSafe(e.target.value);
    dispatch({ type: 'SETTINGS', settings: { [key]: n ?? 0 } });
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{t('planningTitle')}</h1>
          <p className="muted">{t('planningIntro')}</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={doIcs} title={t('exportIcsHint')}>
            <Icon name="calendar" size={16} /> {t('exportIcs')}
          </button>
          <button className="btn btn-primary" onClick={() => actions.onAdd()} disabled={!state.items.length}>
            <Icon name="plus" size={16} /> {t('addPlan')}
          </button>
        </div>
      </header>
      {msg && <p className="note">{msg}</p>}

      <section className="card defaults">
        <div className="defaults-row">
          <span className="defaults-title"><Icon name="bell" size={16} /> {t('defaultNotify')}</span>
          <label className="inline-field">
            <input type="number" min="0" value={settings.notifyDays} onChange={setDefault('notifyDays')} />
            <span>{t('notifyDaysBefore')}</span>
          </label>
          <label className="inline-field">
            <input type="number" min="0" step="100" value={settings.notifyKm} onChange={setDefault('notifyKm')} />
            <span>{t('notifyKmBefore')}</span>
          </label>
        </div>
        <p className="field-hint">{t('exportIcsHint')}</p>
      </section>

      <div className="chips">
        {['all', 'auto', 'huis', 'apparaat'].map((f) => (
          <button key={f} className={'chip' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)}>
            {f === 'all' ? t('all') : t('typePlural_' + f)}
          </button>
        ))}
      </div>

      {!shown.length && <p className="empty card">{t('noPlans')}</p>}

      {groups.map(([key, label]) => {
        const rows = shown.filter((u) => u.status === key);
        if (!rows.length) return null;
        return (
          <section key={key} className={'plan-group group-' + key}>
            <h2>{label} <span className="count">{rows.length}</span></h2>
            <div className="plan-list">
              {rows.map((e) => (
                <PlanRow
                  key={e.plan.id}
                  entry={e}
                  showItem
                  onOpenItem={(it) => navigate('#/items/' + it.id)}
                  onDone={actions.onDone}
                  onEdit={actions.onEdit}
                  onDelete={actions.onDelete}
                />
              ))}
            </div>
          </section>
        );
      })}
      {actions.modal}
    </div>
  );
}
