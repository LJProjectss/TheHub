import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from './store.jsx';
import { computeUpcoming, dueText, relDays, relKm, todayISO } from './utils.js';
import { notifyDue } from './notifications.js';
import { Icon, TypeIcon } from './components/ui.jsx';
import ItemsView from './components/ItemsView.jsx';
import PlanningView from './components/PlanningView.jsx';
import CostsView from './components/CostsView.jsx';
import SettingsView from './components/SettingsView.jsx';
import useBackup from './components/useBackup.jsx';
import { useSync } from './sync/useSync.js';
import { syncT } from './sync/texts.js';
import { Cloud, CloudAlert } from 'lucide-react';

function useHash() {
  const [hash, setHash] = useState(window.location.hash || '#/items');
  useEffect(() => {
    const f = () => setHash(window.location.hash || '#/items');
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return hash;
}

const navigate = (h) => {
  if (window.location.hash !== h) window.location.hash = h;
  window.scrollTo(0, 0);
};

const THEME_KEY = 'onderhoudslogboek-theme';

/** Licht/donker, net als in het huishoudboekje handmatig te wisselen */
function useTheme() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) === 'dark'; } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', dark ? '#070D1A' : '#0C1830');
    try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch { /* negeren */ }
  }, [dark]);
  return [dark, () => setDark((v) => !v)];
}

/** Houdt 'vandaag' actueel als de app lang openstaat */
function useToday() {
  const [today, setToday] = useState(todayISO());
  useEffect(() => {
    const id = setInterval(() => setToday(todayISO()), 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return today;
}

function Banner({ upcoming }) {
  const { t, settings, state, dispatch } = useStore();
  const alerts = upcoming.filter((u) => u.status !== 'ok');
  // De sleutel verandert als er iets nieuws binnenkomt; dan verschijnt de balk opnieuw
  const key = alerts.map((u) => `${u.plan.id}:${u.status}`).sort().join('|');
  if (!alerts.length || state.ui.bannerDismissedKey === key) return null;
  const overdue = alerts.filter((u) => u.status === 'overdue').length;
  const soon = alerts.length - overdue;

  return (
    <div className={'banner banner-mobiel' + (overdue ? ' banner-overdue' : ' banner-soon')} role="region" aria-label={t('bannerTitle')}>
      <div className="banner-inner">
        <div className="banner-head">
          <Icon name="alert" size={18} />
          <strong>{t('bannerTitle')}</strong>
          <span className="banner-counts">
            {overdue > 0 && <span className="badge badge-overdue">{t('bannerOverdue', { n: overdue })}</span>}
            {soon > 0 && <span className="badge badge-soon">{t('bannerSoon', { n: soon })}</span>}
          </span>
          <span className="spacer" />
          <button className="btn btn-sm btn-ghost" onClick={() => navigate('#/planning')}>{t('bannerShowAll')}</button>
          <button className="icon-btn" onClick={() => dispatch({ type: 'DISMISS_BANNER', key })} title={t('bannerClose')} aria-label={t('bannerClose')}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <ul className="banner-list">
          {alerts.slice(0, 6).map((u) => (
            <li key={u.plan.id}>
              <button className="banner-entry" onClick={() => navigate('#/items/' + u.item.id)}>
                <span className={'dot dot-' + u.status} />
                <TypeIcon type={u.item.type} size={14} />
                <span className="strong">{u.item.name}</span>
                <span>{u.plan.name}</span>
                <span className="muted">
                  {dueText(u.plan, t, settings)} · {[relDays(u.daysLeft, t), relKm(u.kmLeft, t, settings)].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
          {alerts.length > 6 && <li className="muted">+ {alerts.length - 6}</li>}
        </ul>
      </div>
    </div>
  );
}

export default function App() {
  const { state, t, settings, dispatch } = useStore();
  const hash = useHash();
  const today = useToday();
  const upcoming = useMemo(() => computeUpcoming(state, today), [state, today]);

  // Systeemmeldingen bij openen / wijzigingen (max. 1x per dag per onderhoud)
  useEffect(() => {
    if (!settings.browserNotifications) return;
    let cancelled = false;
    notifyDue(upcoming, state.notified, t, settings).then((updates) => {
      if (!cancelled && Object.keys(updates).length) dispatch({ type: 'NOTIFIED', map: updates });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcoming, settings.browserNotifications]);

  const [dark, toggleTheme] = useTheme();
  const backup = useBackup();
  const setStateRaw = useCallback((s) => dispatch({ type: 'SYNC_REPLACE', state: s }), [dispatch]);
  const sync = useSync(state, setStateRaw);
  const syncProblem = sync.cfg && ['needs-auth', 'error'].includes(sync.status);
  const [, route, param] = hash.split('/');
  const current = route || 'items';
  const alertCount = upcoming.filter((u) => u.status !== 'ok').length;

  const nav = [
    ['items', 'list', t('navItems')],
    ['planning', 'planning', t('navPlanning')],
    ['kosten', 'euro', t('navCosts')],
    ['instellingen', 'settings', t('navSettings')]
  ];

  let view;
  if (route === 'planning') view = <PlanningView navigate={navigate} />;
  else if (route === 'kosten') view = <CostsView navigate={navigate} />;
  else if (route === 'instellingen') view = <SettingsView backup={backup} sync={sync} />;
  else view = <ItemsView selectedId={param} navigate={navigate} />;

  const count = (r) => r === 'planning' && alertCount > 0 && <span className="nav-count">{alertCount}</span>;

  return (
    <div className="app">
      {/* Zijbalk (desktop) */}
      <aside className="sidebar">
        <a href="/" className="side-link home-link" title={t('backHomeLabel')}>
          <Icon name="thuis" size={14} />{t('backHome')}
        </a>
        <div className="sidebar-brand">
          <span className="brand-mark"><Icon name="wrench" size={16} /></span>
          <span>{t('appName')}</span>
        </div>
        <nav className="sidebar-nav">
          {nav.map(([r, icon, label]) => (
            <a key={r} href={'#/' + r} className={'side-link' + (current === r ? ' active' : '')} aria-current={current === r ? 'page' : undefined}>
              <Icon name={icon} size={16} />
              <span className="side-label">{label}</span>
              {count(r)}
            </a>
          ))}
        </nav>
        <div className="sidebar-foot">
          {sync.cfg && (
            <a href="#/instellingen" className={'side-link sync-state' + (syncProblem ? ' problem' : '')}>
              {syncProblem ? <CloudAlert size={16} aria-hidden="true" /> : <Cloud size={16} aria-hidden="true" />}
              {syncT(settings.lang)(syncProblem ? 'sideProblem' : 'sideSynced')}
            </a>
          )}
          <button className="side-link" onClick={toggleTheme}>
            <Icon name={dark ? 'sun' : 'moon'} size={16} />{dark ? t('lightMode') : t('darkMode')}
          </button>
          <button className="side-link" onClick={backup.exportData}>
            <Icon name="download" size={16} />{t('exportJsonShort')}
          </button>
          <button className="side-link" onClick={backup.exportExcel} disabled={backup.busy}>
            <Icon name="excel" size={16} />{backup.busy ? t('exporting') : t('exportExcelShort')}
          </button>
          <button className="side-link" onClick={backup.triggerImport}>
            <Icon name="upload" size={16} />{t('importShort')}
          </button>
        </div>
      </aside>

      <div className="content">
        {/* Bovenbalk (mobiel) */}
        <div className="mobile-top">
          <div className="sidebar-brand">
            <a href="/" className="home-btn" aria-label={t('backHomeLabel')}><Icon name="thuis" size={16} /></a>
            <span className="brand-mark sm"><Icon name="wrench" size={14} /></span>
            <span>{t('appName')}</span>
          </div>
          <div className="mobile-actions">
            {/* Exporteren en importeren staan op de telefoon onder Instellingen */}
            {syncProblem && (
              <a href="#/instellingen" className="sync-alert" aria-label={syncT(settings.lang)('sideProblem')}><CloudAlert size={16} /></a>
            )}
            <button onClick={toggleTheme} aria-label={t('toggleTheme')}><Icon name={dark ? 'sun' : 'moon'} size={16} /></button>
          </div>
        </div>
        {backup.ImportInput}
        {backup.msg && (
          <div className="flash" role="status">
            <span>{backup.msg}</span>
            <button onClick={() => backup.setMsg(null)} aria-label={t('bannerClose')}><Icon name="close" size={13} /></button>
          </div>
        )}
        {/* Alleen op de startpagina van de telefoon: op de computer staat dezelfde lijst al in het overzicht,
            en Planning toont hem uitgebreider */}
        {current === 'items' && !param && <Banner upcoming={upcoming} />}
        <main className="main">{view}</main>

        {/* Onderbalk (mobiel) */}
        <nav className="bottom-nav">
          {nav.map(([r, icon, label]) => (
            <a key={r} href={'#/' + r} className={'bottom-link' + (current === r ? ' active' : '')} aria-current={current === r ? 'page' : undefined}>
              <span className="bottom-icon"><Icon name={icon} size={18} />{count(r)}</span>
              {label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
