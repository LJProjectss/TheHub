import { useState } from 'react';
import { useStore, demoState, emptyState } from '../store.jsx';
import { exportIcs } from '../exporters.js';
import { notificationsSupported, requestPermission, showNotification } from '../notifications.js';
import { parseIntSafe } from '../utils.js';
import { Icon } from './ui.jsx';
import SyncPanel from '../sync/SyncPanel.jsx';

export default function SettingsView({ backup, sync }) {
  const { state, t, settings, dispatch } = useStore();
  const [msg, setMsg] = useState(null);
  const set = (s) => dispatch({ type: 'SETTINGS', settings: s });

  const permission = notificationsSupported() ? Notification.permission : 'unsupported';

  const toggleNotifications = async (on) => {
    if (!on) return set({ browserNotifications: false });
    const p = await requestPermission();
    if (p === 'granted') set({ browserNotifications: true });
    else setMsg(p === 'unsupported' ? t('notificationsUnsupported') : t('notificationsBlocked'));
  };

  const doIcs = () => {
    const r = exportIcs(state);
    setMsg(!r.count ? t('icsNone') : r.skipped ? t('icsSkipped', { n: r.skipped }) : null);
  };

  return (
    <div className="page settings">
      <header className="page-head"><h1>{t('settingsTitle')}</h1></header>
      {msg && <p className="note" role="status">{msg}</p>}

      <section className="card">
        <h2>{t('language')} &amp; {t('currency').toLowerCase()}</h2>
        <div className="grid-2">
          <label className="field">
            <span className="field-label">{t('language')}</span>
            <select value={settings.lang} onChange={(e) => set({ lang: e.target.value })}>
              <option value="nl">Nederlands</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">{t('currency')}</span>
            <select value={settings.currency} onChange={(e) => set({ currency: e.target.value })}>
              <option value="EUR">Euro (€)</option>
              <option value="USD">Dollar ($)</option>
            </select>
          </label>
        </div>
        <p className="field-hint">{t('dateFormatNote')}</p>
      </section>

      <section className="card">
        <h2>{t('notifications')}</h2>
        <div className="grid-2">
          <label className="field">
            <span className="field-label">{t('defaultNotifyDays')}</span>
            <input type="number" min="0" value={settings.notifyDays} onChange={(e) => set({ notifyDays: parseIntSafe(e.target.value) ?? 0 })} />
          </label>
          <label className="field">
            <span className="field-label">{t('defaultNotifyKm')}</span>
            <input type="number" min="0" step="100" value={settings.notifyKm} onChange={(e) => set({ notifyKm: parseIntSafe(e.target.value) ?? 0 })} />
          </label>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.browserNotifications && permission === 'granted'}
            disabled={permission === 'unsupported'}
            onChange={(e) => toggleNotifications(e.target.checked)}
          />
          {t('browserNotifications')}
        </label>
        <p className="field-hint">{t('browserNotificationsHint')}</p>
        {permission === 'denied' && <p className="field-error">{t('notificationsBlocked')}</p>}
        {settings.browserNotifications && permission === 'granted' && (
          <button className="btn btn-sm" onClick={() => showNotification(t('appName'), t('testNotificationBody'), 'test')}>
            <Icon name="bell" size={15} /> {t('testNotification')}
          </button>
        )}
      </section>

      <SyncPanel sync={sync} />

      <section className="card">
        <h2>{t('data')}</h2>
        <p className="muted">{t('dataHint')}</p>
        <p className="muted small">{t('storageInfo', { items: state.items.length, logs: state.logs.length, plans: state.plans.length })}</p>
        <div className="button-grid">
          <button className="btn" onClick={backup.exportData}><Icon name="download" size={16} /> {t('exportJson')}</button>
          <button className="btn" onClick={backup.triggerImport}><Icon name="upload" size={16} /> {t('importJson')}</button>
          <button className="btn" onClick={backup.exportExcel} disabled={backup.busy}><Icon name="excel" size={16} /> {backup.busy ? t('exporting') : t('exportExcel')}</button>
          <button className="btn" onClick={doIcs}><Icon name="calendar" size={16} /> {t('exportIcs')}</button>
        </div>
        <div className="button-grid danger-zone">
          <button className="btn" onClick={() => window.confirm(t('confirmLoadDemo')) && dispatch({ type: 'REPLACE', state: demoState(settings) })}>
            {t('loadDemo')}
          </button>
          <button className="btn btn-danger" onClick={() => window.confirm(t('confirmDeleteAll')) && dispatch({ type: 'REPLACE', state: { ...emptyState, settings } })}>
            <Icon name="trash" size={16} /> {t('deleteAll')}
          </button>
        </div>
      </section>
    </div>
  );
}
