import { useState } from 'react';
import { useStore } from '../store.jsx';
import { uid, parseIntSafe, fmtNumber } from '../utils.js';
import { Modal, Field, DateInput } from './ui.jsx';

/** Gepland onderhoud toevoegen of bewerken, los van een logregel */
export default function PlanForm({ plan, itemId, onClose }) {
  const { t, dispatch, settings, state } = useStore();
  const [selItem, setSelItem] = useState(plan?.itemId || itemId || state.items[0]?.id || '');
  const item = state.items.find((i) => i.id === selItem);
  const isAuto = item?.type === 'auto';

  const [name, setName] = useState(plan?.name || '');
  const [description, setDescription] = useState(plan?.description || '');
  const [dueDate, setDueDate] = useState(plan?.dueDate || '');
  const [intervalMonths, setIntervalMonths] = useState(plan?.intervalMonths ? String(plan.intervalMonths) : '');
  const [dueKm, setDueKm] = useState(plan?.dueKm != null ? String(plan.dueKm) : '');
  const [intervalKm, setIntervalKm] = useState(plan?.intervalKm ? String(plan.intervalKm) : '');
  const [notifyDays, setNotifyDays] = useState(plan?.notifyDays != null ? String(plan.notifyDays) : '');
  const [notifyKm, setNotifyKm] = useState(plan?.notifyKm != null ? String(plan.notifyKm) : '');
  const [errors, setErrors] = useState({});

  const digits = (setter) => (e) => setter(e.target.value.replace(/[^\d]/g, ''));

  const save = (e) => {
    e?.preventDefault();
    const errs = {};
    if (!item) errs.item = t('required');
    if (!name.trim()) errs.name = t('required');
    const dk = isAuto ? parseIntSafe(dueKm) : null;
    if (!dueDate && dk == null) errs.due = t('planNextHint');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    dispatch({
      type: 'SAVE_PLAN',
      plan: {
        id: plan?.id || uid(),
        itemId: item.id,
        name: name.trim(),
        description: description.trim(),
        dueDate: dueDate || null,
        intervalMonths: parseIntSafe(intervalMonths) || null,
        dueKm: dk,
        intervalKm: isAuto ? parseIntSafe(intervalKm) || null : null,
        notifyDays: notifyDays === '' ? null : parseIntSafe(notifyDays),
        notifyKm: notifyKm === '' ? null : parseIntSafe(notifyKm),
        createdAt: plan?.createdAt || new Date().toISOString()
      }
    });
    onClose();
  };

  return (
    <Modal
      title={plan ? t('editPlan') : t('addPlan')}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>{t('cancel')}</button>
          <button className="btn btn-primary" onClick={save}>{t('save')}</button>
        </>
      }
    >
      <form className="form" onSubmit={save}>
        {!itemId && !plan && (
          <Field label={t('item')} error={errors.item}>
            <select value={selItem} onChange={(e) => setSelItem(e.target.value)}>
              {!state.items.length && <option value="">{t('chooseItem')}</option>}
              {state.items.map((i) => (
                <option key={i.id} value={i.id}>{t('type_' + i.type)} · {i.name}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label={t('task')} error={errors.name}>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={`${t('description')} (${t('optional')})`}>
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid-2">
          <Field label={t('date')}>
            <DateInput value={dueDate} onChange={setDueDate} ariaLabel={t('date')} />
          </Field>
          <Field label={`${t('intervalMonths')} (${t('optional')})`}>
            <div className="input-suffix">
              <input inputMode="numeric" value={intervalMonths} onChange={digits(setIntervalMonths)} />
              <span>{t('months')}</span>
            </div>
          </Field>
          {isAuto && (
            <>
              <Field label={t('fixedKm')}>
                <input inputMode="numeric" value={dueKm} onChange={digits(setDueKm)} />
              </Field>
              <Field label={`${t('intervalKm')} (${t('optional')})`}>
                <div className="input-suffix">
                  <input inputMode="numeric" value={intervalKm} onChange={digits(setIntervalKm)} />
                  <span>km</span>
                </div>
              </Field>
            </>
          )}
          <Field label={`${t('notifyBefore')} (${t('notifyDaysBefore')})`}>
            <input inputMode="numeric" value={notifyDays} placeholder={t('useDefault', { n: settings.notifyDays })} onChange={digits(setNotifyDays)} />
          </Field>
          {isAuto && (
            <Field label={`${t('notifyBefore')} (${t('notifyKmBefore')})`}>
              <input inputMode="numeric" value={notifyKm} placeholder={t('useDefault', { n: fmtNumber(settings.notifyKm, settings) })} onChange={digits(setNotifyKm)} />
            </Field>
          )}
        </div>
        {errors.due ? <p className="field-error">{errors.due}</p> : <p className="field-hint">{t('planNextHint')}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
