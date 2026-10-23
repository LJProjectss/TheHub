import { useState } from 'react';
import { useStore } from '../store.jsx';
import { uid, parseIntSafe, fmtNumber } from '../utils.js';
import { Modal, Field, DateInput, Icon } from './ui.jsx';

const TYPES = ['auto', 'huis', 'apparaat'];

export default function ItemForm({ item, onClose, onSaved }) {
  const { t, dispatch, settings } = useStore();
  const [type, setType] = useState(item?.type || 'auto');
  const [name, setName] = useState(item?.name || '');
  const [fields, setFields] = useState(item?.fields || {});
  const [km, setKm] = useState(item?.currentKm != null ? fmtNumber(item.currentKm, settings) : '');
  const [notes, setNotes] = useState(item?.notes || '');
  const [error, setError] = useState(null);

  const setF = (k) => (e) => setFields((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const save = (e) => {
    e?.preventDefault();
    if (!name.trim()) return setError(t('required'));
    const obj = {
      id: item?.id || uid(),
      type,
      name: name.trim(),
      fields,
      currentKm: type === 'auto' ? parseIntSafe(km) : null,
      notes: notes.trim(),
      createdAt: item?.createdAt || new Date().toISOString()
    };
    dispatch({ type: 'SAVE_ITEM', item: obj });
    onSaved?.(obj);
    onClose();
  };

  return (
    <Modal
      title={item ? t('editItem') : t('newItem')}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>{t('cancel')}</button>
          <button className="btn btn-primary" onClick={save}>{t('save')}</button>
        </>
      }
    >
      <form onSubmit={save} className="form">
        {!item && (
          <div className="type-picker" role="radiogroup" aria-label={t('type')}>
            {TYPES.map((ty) => (
              <button
                type="button"
                key={ty}
                role="radio"
                aria-checked={type === ty}
                className={'type-option' + (type === ty ? ' active' : '')}
                onClick={() => setType(ty)}
              >
                <Icon name={ty} size={22} />
                <span>{t('type_' + ty)}</span>
              </button>
            ))}
          </div>
        )}

        <Field label={t('name')} error={error}>
          <input
            autoFocus
            value={name}
            placeholder={t('namePlaceholder_' + type)}
            onChange={(e) => { setName(e.target.value); setError(null); }}
          />
        </Field>

        {type === 'auto' && (
          <div className="grid-2">
            <Field label={t('licensePlate')}>
              <input value={fields.licensePlate || ''} onChange={setF('licensePlate')} style={{ textTransform: 'uppercase' }} />
            </Field>
            <Field label={t('currentKm')}>
              <input inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} />
            </Field>
            <Field label={t('brand')}><input value={fields.brand || ''} onChange={setF('brand')} /></Field>
            <Field label={t('model')}><input value={fields.model || ''} onChange={setF('model')} /></Field>
            <Field label={t('buildYear')}><input inputMode="numeric" maxLength={4} value={fields.buildYear || ''} onChange={setF('buildYear')} /></Field>
          </div>
        )}

        {type === 'huis' && (
          <div className="grid-2">
            <Field label={t('address')} className="span-2"><input value={fields.address || ''} onChange={setF('address')} /></Field>
            <Field label={t('buildYear')}><input inputMode="numeric" maxLength={4} value={fields.buildYear || ''} onChange={setF('buildYear')} /></Field>
          </div>
        )}

        {type === 'apparaat' && (
          <div className="grid-2">
            <Field label={t('brand')}><input value={fields.brand || ''} onChange={setF('brand')} /></Field>
            <Field label={t('modelNumber')}><input value={fields.modelNumber || ''} onChange={setF('modelNumber')} /></Field>
            <Field label={t('purchaseDate')}><DateInput value={fields.purchaseDate || ''} onChange={setF('purchaseDate')} ariaLabel={t('purchaseDate')} /></Field>
            <Field label={t('warrantyUntil')}><DateInput value={fields.warrantyUntil || ''} onChange={setF('warrantyUntil')} ariaLabel={t('warrantyUntil')} /></Field>
          </div>
        )}

        <Field label={`${t('notes')} (${t('optional')})`}>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
