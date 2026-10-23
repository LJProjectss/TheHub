import { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import {
  computeUpcoming, fmtDate, fmtMoney, fmtNumber, dueText, todayISO, yearOf, relDays, parseIntSafe
} from '../utils.js';
import { Icon, TypeIcon } from './ui.jsx';
import ItemForm from './ItemForm.jsx';
import LogForm from './LogForm.jsx';
import PlanRow from './PlanRow.jsx';
import usePlanActions from './usePlanActions.jsx';

const TYPES = ['auto', 'huis', 'apparaat'];

function subtitle(item, t) {
  const f = item.fields || {};
  if (item.type === 'auto') return [f.licensePlate?.toUpperCase(), [f.brand, f.model].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
  if (item.type === 'huis') return f.address || '';
  return [f.brand, f.modelNumber].filter(Boolean).join(' ');
}

export default function ItemsView({ selectedId, navigate }) {
  const { state, t } = useStore();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);

  const upcoming = useMemo(() => computeUpcoming(state), [state]);
  const alertByItem = useMemo(() => {
    const m = {};
    for (const u of upcoming) {
      if (u.status === 'ok') continue;
      const cur = m[u.item.id];
      if (!cur || u.status === 'overdue') m[u.item.id] = u.status;
    }
    return m;
  }, [upcoming]);

  const list = state.items
    .filter((i) => filter === 'all' || i.type === filter)
    .filter((i) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (i.name + ' ' + subtitle(i, t)).toLowerCase().includes(q);
    })
    .sort((a, b) => TYPES.indexOf(a.type) - TYPES.indexOf(b.type) || a.name.localeCompare(b.name));

  const selected = state.items.find((i) => i.id === selectedId);

  return (
    <div className={'items-layout' + (selected ? ' has-selection' : '')}>
      <aside className="item-list">
        <div className="list-tools">
          <div className="chips">
            {['all', ...TYPES].map((f) => (
              <button key={f} className={'chip' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)}>
                {f === 'all' ? t('all') : t('typePlural_' + f)}
                <span className="chip-count">
                  {f === 'all' ? state.items.length : state.items.filter((i) => i.type === f).length}
                </span>
              </button>
            ))}
          </div>
          <div className="list-search">
            <input type="search" placeholder={t('search')} value={query} onChange={(e) => setQuery(e.target.value)} />
            <button
              className="btn btn-primary"
              onClick={() => setModal(<ItemForm onClose={() => setModal(null)} onSaved={(it) => navigate('#/items/' + it.id)} />)}
            >
              <Icon name="plus" size={16} /> {t('newItem')}
            </button>
          </div>
        </div>
        <ul className="list">
          {list.map((i) => (
            <li key={i.id}>
              <button className={'list-entry' + (i.id === selectedId ? ' active' : '')} onClick={() => navigate('#/items/' + i.id)}>
                <TypeIcon type={i.type} />
                <span className="list-text">
                  <span className="list-name">{i.name}</span>
                  <span className="list-sub">{subtitle(i, t) || t('type_' + i.type)}</span>
                </span>
                {alertByItem[i.id] && <span className={'dot dot-' + alertByItem[i.id]} title={t('status_' + alertByItem[i.id])} />}
              </button>
            </li>
          ))}
        </ul>
        {!list.length && <p className="empty">{state.items.length ? t('noItemsFilter') : t('noItems')}</p>}
      </aside>

      <section className="item-detail">
        {selected ? (
          <ItemDetail key={selected.id} item={selected} upcoming={upcoming} navigate={navigate} />
        ) : (
          state.items.length ? (
            <Summary upcoming={upcoming} navigate={navigate} />
          ) : (
            <div className="empty-detail">
              <span className="icon-circle"><Icon name="wrench" size={22} /></span>
              <p>{t('noItems')}</p>
            </div>
          )
        )}
      </section>
      {modal}
    </div>
  );
}

/** Samenvatting zolang er geen item gekozen is (alleen zichtbaar op brede schermen) */
function Summary({ upcoming, navigate }) {
  const { state, t, settings } = useStore();
  const thisYear = yearOf(todayISO());
  const costYear = state.logs.filter((l) => yearOf(l.date) === thisYear).reduce((s, l) => s + (l.cost || 0), 0);
  const overdue = upcoming.filter((u) => u.status === 'overdue').length;
  const soon = upcoming.filter((u) => u.status === 'soon').length;
  const next = upcoming.slice(0, 5);

  return (
    <div className="detail summary">
      <h1>{t('overviewTitle')}</h1>
      <div className="stats">
        <div className="stat"><span className="stat-label">{t('overviewItems')}</span><span className="stat-value">{state.items.length}</span></div>
        <div className={'stat' + (overdue ? ' stat-overdue' : '')}><span className="stat-label">{t('overviewOverdue')}</span><span className="stat-value">{overdue}</span></div>
        <div className={'stat' + (soon ? ' stat-soon' : '')}><span className="stat-label">{t('overviewSoon')}</span><span className="stat-value">{soon}</span></div>
        <div className="stat"><span className="stat-label">{t('costsThisYear', { year: thisYear })}</span><span className="stat-value">{fmtMoney(costYear, settings)}</span></div>
      </div>
      <section className="card">
        <div className="card-head">
          <h2>{t('overviewUpcoming')}</h2>
          <button className="btn btn-sm btn-ghost" onClick={() => navigate('#/planning')}>{t('bannerShowAll')}</button>
        </div>
        {next.length ? (
          <ul className="summary-list">
            {next.map((u) => (
              <li key={u.plan.id}>
                <button className="banner-entry" onClick={() => navigate('#/items/' + u.item.id)}>
                  <span className={'dot dot-' + u.status} />
                  <TypeIcon type={u.item.type} size={14} />
                  <span className="strong">{u.item.name}</span>
                  <span>{u.plan.name}</span>
                  <span className="muted">{dueText(u.plan, t, settings)}{u.daysLeft != null ? ' · ' + relDays(u.daysLeft, t) : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">{t('overviewNothingPlanned')}</p>
        )}
      </section>
      <p className="muted summary-hint">{t('selectItem')}</p>
    </div>
  );
}

function ItemDetail({ item, upcoming, navigate }) {
  const { state, t, settings, dispatch } = useStore();
  const [modal, setModal] = useState(null);
  const planActions = usePlanActions();
  const close = () => setModal(null);

  const logs = state.logs
    .filter((l) => l.itemId === item.id)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.km ?? 0) - (a.km ?? 0));
  const plans = upcoming.filter((u) => u.item.id === item.id);
  const thisYear = yearOf(todayISO());
  const total = logs.reduce((s, l) => s + (l.cost || 0), 0);
  const totalYear = logs.filter((l) => yearOf(l.date) === thisYear).reduce((s, l) => s + (l.cost || 0), 0);
  const perYear = useMemo(() => {
    const m = {};
    for (const l of logs) m[yearOf(l.date)] = (m[yearOf(l.date)] || 0) + (l.cost || 0);
    return Object.entries(m).sort((a, b) => b[0] - a[0]);
  }, [logs]);
  const isAuto = item.type === 'auto';
  const f = item.fields || {};
  const next = plans[0];

  const facts = [];
  if (isAuto) {
    if (f.licensePlate) facts.push([t('licensePlate'), <span className="plate">{f.licensePlate.toUpperCase()}</span>]);
    if (f.brand || f.model) facts.push([`${t('brand')} / ${t('model')}`, [f.brand, f.model].filter(Boolean).join(' ')]);
    if (f.buildYear) facts.push([t('buildYear'), f.buildYear]);
    facts.push([t('currentKm'), item.currentKm != null ? `${fmtNumber(item.currentKm, settings)} km` : '–']);
  } else if (item.type === 'huis') {
    if (f.address) facts.push([t('address'), f.address]);
    if (f.buildYear) facts.push([t('buildYear'), f.buildYear]);
  } else {
    if (f.brand) facts.push([t('brand'), f.brand]);
    if (f.modelNumber) facts.push([t('modelNumber'), f.modelNumber]);
    if (f.purchaseDate) facts.push([t('purchaseDate'), fmtDate(f.purchaseDate)]);
    if (f.warrantyUntil) {
      const expired = f.warrantyUntil < todayISO();
      facts.push([t('warrantyUntil'), <span className={expired ? 'text-overdue' : 'text-ok'}>{fmtDate(f.warrantyUntil)}{expired ? ` (${t('warrantyExpired')})` : ''}</span>]);
    }
  }

  const deleteItem = () => {
    if (window.confirm(t('confirmDeleteItem', { name: item.name }))) {
      dispatch({ type: 'DELETE_ITEM', id: item.id });
      navigate('#/items');
    }
  };

  const updateKm = () => {
    const v = window.prompt(t('kmPrompt'), item.currentKm != null ? String(item.currentKm) : '');
    if (v === null) return;
    const n = parseIntSafe(v);
    if (n != null) dispatch({ type: 'SET_KM', id: item.id, km: n });
  };

  return (
    <div className="detail">
      <button className="btn btn-ghost back-btn" onClick={() => navigate('#/items')}>
        <Icon name="back" size={16} /> {t('back')}
      </button>
      <header className="detail-head">
        <TypeIcon type={item.type} size={26} />
        <div className="detail-title">
          <span className="eyebrow">{t('type_' + item.type)}</span>
          <h1>{item.name}</h1>
        </div>
        <div className="detail-actions">
          {isAuto && (
            <button className="btn" onClick={updateKm}><Icon name="gauge" size={16} /> {t('updateKm')}</button>
          )}
          <button className="icon-btn" title={t('editItem')} aria-label={t('editItem')} onClick={() => setModal(<ItemForm item={item} onClose={close} />)}>
            <Icon name="edit" />
          </button>
          <button className="icon-btn danger" title={t('deleteItem')} aria-label={t('deleteItem')} onClick={deleteItem}>
            <Icon name="trash" />
          </button>
        </div>
      </header>

      {facts.length > 0 && (
        <dl className="facts">
          {facts.map(([k, v], idx) => (
            <div key={idx}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      )}
      {item.notes && <p className="notes muted">{item.notes}</p>}

      <div className="stats">
        <div className="stat"><span className="stat-label">{t('totalCosts')}</span><span className="stat-value">{fmtMoney(total, settings)}</span></div>
        <div className="stat"><span className="stat-label">{t('costsThisYear', { year: thisYear })}</span><span className="stat-value">{fmtMoney(totalYear, settings)}</span></div>
        <div className="stat"><span className="stat-label">{t('entries')}</span><span className="stat-value">{logs.length}</span></div>
        <div className={'stat' + (next ? ' stat-' + next.status : '')}>
          <span className="stat-label">{t('nextDue')}</span>
          <span className="stat-value stat-small">
            {next ? <>{next.plan.name}<br /><span className="muted">{dueText(next.plan, t, settings)}{next.daysLeft !== null ? ` · ${relDays(next.daysLeft, t)}` : ''}</span></> : t('nothingPlanned')}
          </span>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>{t('planned')}</h2>
          <button className="btn btn-sm" onClick={() => planActions.onAdd(item.id)}><Icon name="plus" size={15} /> {t('addPlan')}</button>
        </div>
        {plans.length ? (
          <div className="plan-list">
            {plans.map((e) => (
              <PlanRow key={e.plan.id} entry={e} onDone={planActions.onDone} onEdit={planActions.onEdit} onDelete={planActions.onDelete} />
            ))}
          </div>
        ) : (
          <p className="empty">{t('noPlans')}</p>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>{t('logbook')}</h2>
          <button className="btn btn-primary btn-sm" onClick={() => setModal(<LogForm item={item} onClose={close} />)}>
            <Icon name="plus" size={15} /> {t('addLog')}
          </button>
        </div>
        {logs.length ? (
          <div className="table-wrap">
            <table className="log-table">
              <thead>
                <tr>
                  <th>{t('date')}</th>
                  <th>{t('name')}</th>
                  <th>{t('description')}</th>
                  {isAuto && <th className="num">{t('km')}</th>}
                  <th className="num">{t('cost')}</th>
                  <th>{t('nextMaintenance')}</th>
                  <th aria-label={t('actions')} />
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td data-label={t('date')} className="nowrap">{fmtDate(l.date)}</td>
                    <td data-label={t('name')} className="strong">{l.name}</td>
                    <td data-label={t('description')} className="muted">{l.description}</td>
                    {isAuto && <td data-label={t('km')} className="num">{l.km != null ? fmtNumber(l.km, settings) : ''}</td>}
                    <td data-label={t('cost')} className="num">{l.cost != null ? fmtMoney(l.cost, settings) : ''}</td>
                    <td data-label={t('nextMaintenance')}>{dueText({ dueDate: l.nextDate, dueKm: l.nextKm }, t, settings)}</td>
                    <td className="row-actions">
                      <button className="icon-btn" title={t('edit')} aria-label={t('edit')} onClick={() => setModal(<LogForm item={item} log={l} onClose={close} />)}>
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        className="icon-btn danger"
                        title={t('delete')}
                        aria-label={t('delete')}
                        onClick={() => window.confirm(t('confirmDeleteLog')) && dispatch({ type: 'DELETE_LOG', id: l.id })}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">{t('noLogs')}</p>
        )}
      </section>

      {perYear.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>{t('costsPerYear')}</h2></div>
          <table className="year-table">
            <tbody>
              {perYear.map(([y, s]) => (
                <tr key={y}><td>{y}</td><td className="num">{fmtMoney(s, settings)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {modal}
      {planActions.modal}
    </div>
  );
}
