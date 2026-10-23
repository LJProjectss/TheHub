import { useRef, useState } from 'react';
import { useStore, normalizeState } from '../store.jsx';
import { exportJson, exportExcel } from '../exporters.js';

/** Export/import-acties die zowel in de zijbalk als bij Instellingen staan */
export default function useBackup() {
  const { state, t, dispatch } = useStore();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = normalizeState(JSON.parse(await file.text()));
      if (!window.confirm(t('importConfirm', { items: state.items.length, logs: state.logs.length }))) return;
      dispatch({ type: 'REPLACE', state: data });
      setMsg(t('importOk'));
    } catch {
      setMsg(t('importError'));
    }
  };

  return {
    msg,
    setMsg,
    busy,
    exportData: () => exportJson(state),
    exportExcel: async () => {
      setBusy(true);
      try { await exportExcel(state); } finally { setBusy(false); }
    },
    triggerImport: () => fileRef.current?.click(),
    ImportInput: <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
  };
}
