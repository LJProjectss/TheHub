import { useEffect, useState } from 'react';
import { Cloud, CloudAlert, CloudOff, RefreshCw } from 'lucide-react';
import { useStore } from '../store.jsx';
import { fmtDate } from '../utils.js';
import { FOLDER_MIME, googleConfigured, pick, preloadGoogle, signIn, storedToken } from './gdrive.js';
import { SYNC_FILE_NAME, connectNew, finishExisting, openExisting } from './sync.js';
import { applyConflictChoice } from './stamps.js';
import { syncT } from './texts.js';

const STATUS_ICON = { idle: Cloud, syncing: RefreshCw, pending: CloudOff, 'needs-auth': CloudAlert, error: CloudAlert };
const STATUS_CLS = { idle: 'ok', pending: 'warn', 'needs-auth': 'warn', error: 'error' };

const fmtTime = (t, lang) =>
  t ? new Date(t).toLocaleString(lang === 'en' ? 'en-GB' : 'nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

// Koppelen met één versleuteld bestand in Google Drive, net als in het vermogensoverzicht.
export default function SyncPanel({ sync }) {
  const { state, settings, dispatch } = useStore();
  const st = syncT(settings.lang);
  const [step, setStep] = useState(null); // null | {kind:'new'} | {kind:'existing'} | {kind:'merge', ...}
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => preloadGoogle(), []);

  if (!googleConfigured()) {
    return (
      <section className="card">
        <h2>{st('title')}</h2>
        <p className="muted">{st('notConfigured')}</p>
      </section>
    );
  }

  const reset = () => { setStep(null); setPw(''); setPw2(''); setBusy(false); };
  const fail = (e) => { setMsg({ type: 'error', text: e.message || String(e) }); setBusy(false); };

  const start = async () => {
    setMsg(null);
    try {
      if (!storedToken()) await signIn(sync.cfg?.email);
      const picked = await pick();
      if (!picked) return;
      if (picked.mimeType === FOLDER_MIME) setStep({ kind: 'new', folderId: picked.id, folderName: picked.name });
      else setStep({ kind: 'existing', fileId: picked.id, fileName: picked.name });
    } catch (e) {
      fail(e);
    }
  };
  const startInRoot = async () => {
    setMsg(null);
    try {
      if (!storedToken()) await signIn();
      setStep({ kind: 'new', folderId: null, folderName: st('myDrive') });
    } catch (e) {
      fail(e);
    }
  };

  const createNew = async (e) => {
    e.preventDefault();
    if (pw.length < 8) return setMsg({ type: 'error', text: st('tooShort') });
    if (pw !== pw2) return setMsg({ type: 'error', text: st('notEqual') });
    setBusy(true);
    setMsg(null);
    try {
      const cfg = await connectNew({ folderId: step.folderId, folderName: step.folderName, password: pw, state });
      sync.connected(cfg);
      setMsg({ type: 'ok', text: st('connectedNew', { file: `“${cfg.fileName}”`, folder: cfg.folderName }) });
      reset();
    } catch (err) {
      fail(err);
    }
  };

  const finish = async (s, mode) => {
    setBusy(true);
    try {
      const res = await finishExisting({ fileId: s.fileId, fileName: s.fileName, key: s.key, kdf: s.kdf, remote: s.remote, local: state, mode });
      dispatch({ type: 'SYNC_REPLACE', state: res.state });
      sync.connected(res.cfg);
      if (res.conflicts.length) sync.setConflicts(res.conflicts);
      setMsg({ type: 'ok', text: st('connectedExisting', { file: `“${res.cfg.fileName}”` }) });
      reset();
    } catch (err) {
      fail(err);
    }
  };

  const openFile = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const opened = await openExisting({ fileId: step.fileId, password: pw });
      if (state.items.length > 0) {
        setStep({ kind: 'merge', fileId: step.fileId, fileName: step.fileName, ...opened });
        setBusy(false);
      } else {
        await finish({ fileId: step.fileId, fileName: step.fileName, ...opened }, 'replace');
      }
    } catch (err) {
      fail(err);
    }
  };

  const disconnect = async () => {
    if (!window.confirm(st('confirmDisconnect'))) return;
    await sync.disconnect();
    setMsg({ type: 'ok', text: st('disconnected') });
  };

  const StatusIcon = STATUS_ICON[sync.status];

  return (
    <section className="card sync-panel">
      <h2>{st('title')}</h2>
      <p className="muted">{st('intro')}</p>

      {msg && <p className={msg.type === 'error' ? 'field-error sync-msg' : 'note sync-msg'} role="status">{msg.text}</p>}

      {sync.cfg ? (
        <>
          <dl className="sync-kv">
            <dt>{st('status')}</dt>
            <dd className={STATUS_CLS[sync.status] || ''}>
              {StatusIcon && <StatusIcon size={14} className={sync.status === 'syncing' ? 'spin' : ''} aria-hidden="true" />}{' '}
              {st(`st_${sync.status}`)}
              {sync.status === 'idle' && sync.dirty && st('waiting')}
            </dd>
            {sync.error && (<><dt>{st('message')}</dt><dd className="error">{sync.error}</dd></>)}
            <dt>{st('file')}</dt>
            <dd>{sync.cfg.fileName}{sync.cfg.folderName ? ` ${st('inFolder', { folder: sync.cfg.folderName })}` : ''}</dd>
            <dt>{st('account')}</dt>
            <dd>{sync.cfg.email || '—'}</dd>
            <dt>{st('lastSync')}</dt>
            <dd>{fmtTime(sync.cfg.lastSyncAt, settings.lang)}</dd>
          </dl>
          <div className="button-grid">
            {sync.status === 'needs-auth' ? (
              <button className="btn btn-primary" onClick={sync.reauth}>{st('reauth')}</button>
            ) : (
              <button className="btn" onClick={sync.syncNow} disabled={sync.status === 'syncing'}>
                <RefreshCw size={15} aria-hidden="true" /> {st('syncNow')}
              </button>
            )}
            <button className="btn btn-ghost" onClick={disconnect}>{st('disconnect')}</button>
          </div>
          <Conflicts sync={sync} st={st} lang={settings.lang} />
        </>
      ) : !step ? (
        <>
          <ol className="sync-steps muted small">
            <li>{st('step1', { file: SYNC_FILE_NAME })}</li>
            <li>{st('step2')}</li>
          </ol>
          <div className="button-grid">
            <button className="btn btn-primary" onClick={start}><Cloud size={16} aria-hidden="true" /> {st('connect')}</button>
            <button className="btn btn-ghost" onClick={startInRoot}>{st('newInRoot')}</button>
          </div>
        </>
      ) : step.kind === 'new' ? (
        <form className="form" onSubmit={createNew}>
          <p className="muted">{st('newFile', { file: SYNC_FILE_NAME, folder: step.folderName })}</p>
          <p className="field-hint">{st('keepPassword')}</p>
          <div className="grid-2">
            <label className="field"><span className="field-label">{st('passwordMin')}</span><input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
            <label className="field"><span className="field-label">{st('passwordAgain')}</span><input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
          </div>
          <div className="button-grid">
            <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? st('busy') : st('create')}</button>
            <button className="btn btn-ghost" type="button" onClick={reset}>{st('cancel')}</button>
          </div>
        </form>
      ) : step.kind === 'existing' ? (
        <form className="form" onSubmit={openFile}>
          <p className="muted">{st('existing', { file: `“${step.fileName}”` })}</p>
          <label className="field"><span className="field-label">{st('password')}</span><input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /></label>
          <div className="button-grid">
            <button className="btn btn-primary" type="submit" disabled={busy || !pw}>{busy ? st('opening') : st('open')}</button>
            <button className="btn btn-ghost" type="button" onClick={reset}>{st('cancel')}</button>
          </div>
        </form>
      ) : (
        <div className="form">
          <p>{st('mergeQuestion', { ritems: step.remote.items.length, rlogs: step.remote.logs.length, litems: state.items.length, llogs: state.logs.length })}</p>
          <div className="button-grid">
            <button className="btn btn-primary" disabled={busy} onClick={() => finish(step, 'merge')}>{st('merge')}</button>
            <button className="btn" disabled={busy} onClick={() => finish(step, 'replace')}>{st('useRemote')}</button>
            <button className="btn btn-ghost" disabled={busy} onClick={reset}>{st('cancel')}</button>
          </div>
          <p className="field-hint">{st('mergeHint')}</p>
        </div>
      )}
    </section>
  );
}

function describe(c, rec) {
  if (!rec) return null;
  if (c.coll === 'logs') return `${rec.name || ''} · ${fmtDate(rec.date)}`;
  return rec.name || '';
}

function Conflicts({ sync, st, lang }) {
  const { state, dispatch } = useStore();
  if (!sync.conflicts.length) return null;
  const choose = (c, choice) => {
    if (choice !== c.chosen) dispatch({ type: 'REPLACE', state: applyConflictChoice(state, c, choice) });
    sync.setConflicts((list) => list.filter((x) => x !== c));
  };
  return (
    <div className="sync-conflicts">
      <h3>{st('conflicts', { n: sync.conflicts.length })}</h3>
      <p className="field-hint">{st('conflictsHint')}</p>
      {sync.conflicts.map((c, i) => (
        <div className="sync-conflict" key={`${c.coll}:${c.id}:${i}`}>
          <strong>{st(`kind_${c.coll}`)}: {describe(c, c.local || c.remote)}</strong>
          <button className={'btn btn-sm' + (c.chosen === 'local' ? ' btn-primary' : '')} onClick={() => choose(c, 'local')}>
            {st('thisDevice')} ({fmtTime(c.localTime, lang)}): {describe(c, c.local) ?? st('deleted')}
          </button>
          <button className={'btn btn-sm' + (c.chosen === 'remote' ? ' btn-primary' : '')} onClick={() => choose(c, 'remote')}>
            {st('otherDevice')} ({fmtTime(c.remoteTime, lang)}): {describe(c, c.remote) ?? st('deleted')}
          </button>
        </div>
      ))}
    </div>
  );
}
