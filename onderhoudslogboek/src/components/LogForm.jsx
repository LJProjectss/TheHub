import { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import {
  uid, todayISO, parseAmount, parseIntSafe, addMonths, amountToInput, fmtNumber, dueText
} from '../utils.js';
import { Modal, Field, DateInput } from './ui.jsx';

/**
 * Formulier voor een logregel.
 * - log: bestaande logregel (bewerken) of undefined (nieuw)
 * - completing: gepland onderhoud dat wordt afgevinkt (vult het formulier voor)
 */
export default function LogForm({ item, log, completing, onClose }) {
  const { t, dispatch, settings, state } = useStore();
  const isAuto = item.type === 'auto';
  const editing = !!log;

  const [date, setDate] = useState(log?.date || todayISO());
  const [name, setName] = useState(log?.name || completing?.name || '');
  const [description, setDescription] = useState(log?.description ?? completing?.description ?? '');
  const [cost, setCost] = useState(log?.cost != null ? amountToInput(log.cost, settings) : '');
  const [km, setKm] = useState(log?.km != null ? String(log.km) : '');

  // Volgend onderhoud
  const [planOn, setPlanOn] = useState(!!completing && !!(completing.intervalMonths || completing.intervalKm));
  const [timeMode, setTimeMode] = useState(
    completing?.intervalMonths ? 'interval' : completing?.dueDate ? 'date' : 'none'
  );
  const [nextDate, setNextDate] = useState('');
  const [months, setMonths] = useState(completing?.intervalMonths ? String(completing.intervalMonths) : '12');
  const [kmMode, setKmMode] = useState(
    isAuto && completing?.intervalKm ? 'interval' : isAuto && completing?.dueKm != null ? 'km' : 'none'
  );
  const [nextKm, setNextKm] = useState('');
  const [kmInterval, setKmInterval] = useState(completing?.intervalKm ? String(completing.intervalKm) : '15000');
  const [notifyDays, setNotifyDays] = useState(completing?.notifyDays != null ? String(completing.notifyDays) : '');
  const [notifyKm, setNotifyKm] = useState(completing?.notifyKm != null ? String(completing.notifyKm) : '');
  const [errors, setErrors] = useState({});

  // Suggesties voor de naam: eerder gebruikte namen bij dit item
  const suggestions = useMemo(
    () => [...new Set(state.logs.filter((l) => l.itemId === item.id).map((l) => l.name))].sort(),
    [state.logs, item.id]
  );

  const kmNum = parseIntSafe(km);

  const computed = useMemo(() => {
    if (!planOn) return null;
    const mo = parseIntSafe(months);
    const ki = parseIntSafe(kmInterval);
    let dueDate = null, intervalMonths = null, dueKm = null, intervalKm = null;
    if (timeMode === 'date') dueDate = nextDate || null;
    if (timeMode === 'interval' && mo) {
      intervalMonths = mo;
      dueDate = date ? addMonths(date, mo) : null;
    }
    if (isAuto && kmMode === 'km') dueKm = parseIntSafe(nextKm);
    if (isAuto && kmMode === 'interval' && ki) {
      intervalKm = ki;
      dueKm = kmNum != null ? kmNum + ki : null;
    }
    return { dueDate, intervalMonths, dueKm, intervalKm };
  }, [planOn, timeMode, nextDate, months, date, isAuto, kmMode, nextKm, kmInterval, kmNum]);

  const save = (e) => {
    e?.preventDefault();
    const errs = {};
    if (!date) errs.date = t('invalidDate');
    if (!name.trim()) errs.name = t('required');
    if (planOn && computed) {
      if (timeMode === 'date' && !nextDate) errs.nextDate = t('required');
      if (kmMode === 'km' && computed.dueKm == null) errs.nextKm = t('required');
      if (kmMode === 'interval' && kmNum == null) errs.km = t('kmNeededForInterval');
      if (!computed.dueDate && computed.dueKm == null && !errs.km && !errs.nextDate && !errs.nextKm)
        errs.plan = t('planNextHint');
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;

    let plan = null;
    if (!editing && planOn && computed) {
      plan = {
        id: completing?.id || uid(),
        itemId: item.id,
        name: name.trim(),
        description: description.trim(),
        ...computed,
        notifyDays: notifyDays === '' ? null : parseIntSafe(notifyDays),
        notifyKm: notifyKm === '' ? null : parseIntSafe(notifyKm),
        createdAt: completing?.createdAt || new Date().toISOString()
      };
    }

    const entry = {
      id: log?.id || uid(),
      itemId: item.id,
      date,
      name: name.trim(),
      description: description.trim(),
      cost: parseAmount(cost),
      km: isAuto ? kmNum : null,
      planId: plan ? plan.id : log?.planId ?? completing?.id ?? null,
      nextDate: editing ? log.nextDate ?? null : plan?.dueDate ?? null,
      nextKm: editing ? log.nextKm ?? null : plan?.dueKm ?? null
    };
    dispatch({ type: 'SAVE_LOG', log: entry, plan, closePlanId: !plan && completing ? completing.id : null });
    onClose();
  };

  const nextPreview = computed && (computed.dueDate || computed.dueKm != null)
    ? dueText(computed, t, settings) + (computed.dueDate && computed.dueKm != null ? ` (${t('whicheverFirst')})` : '')
    : '';

  return (
    <Modal
      title={editing ? t('editLog') : completing ? `${t('markDone')}: ${completing.name}` : t('addLog')}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>{t('cancel')}</button>
          <button className="btn btn-primary" onClick={save}>{t('save')}</button>
        </>
      }
    >
      <form className="form" onSubmit={save}>
        {completing && <p className="note">{t('completingPlan', { name: completing.name })}</p>}
        <div className="grid-2">
          <Field label={t('date')} error={errors.date}>
            <DateInput value={date} onChange={setDate} invalid={!!errors.date} ariaLabel={t('date')} />
          </Field>
          {isAuto && (
            <Field label={t('km')} error={errors.km} hint={t('kmUpdatesItem')}>
              <input
                inputMode="numeric"
                value={km}
                placeholder={item.currentKm != null ? fmtNumber(item.currentKm, settings) : ''}
                onChange={(e) => setKm(e.target.value.replace(/[^\d]/g, ''))}
              />
            </Field>
          )}
          <Field label={t('name')} error={errors.name} className={isAuto ? 'span-2' : ''}>
            <input
              autoFocus={!completing}
              list="log-name-suggestions"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <datalist id="log-name-suggestions">
              {suggestions.map((s) => <option key={s} value={s} />)}
            </datalist>
          </Field>
          <Field label={`${t('cost')} (${settings.currency === 'USD' ? '$' : '€'})`}>
            <input inputMode="decimal" value={cost} placeholder="0,00" onChange={(e) => setCost(e.target.value)} />
          </Field>
          <Field label={t('description')} className="span-2">
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>

        {!editing && (
          <fieldset className="next-box">
            <label className="check">
              <input type="checkbox" checked={planOn} onChange={(e) => setPlanOn(e.target.checked)} />
              <strong>{t('planNext')}</strong> <span className="muted">({t('optional')})</span>
            </label>
            {planOn && (
              <>
                <p className="field-hint">{t('planNextHint')}</p>
                <div className="grid-2">
                  <div>
                    <div className="field-label">{t('byTime')}</div>
                    <div className="seg">
                      {['none', 'date', 'interval'].map((m) => (
                        <button type="button" key={m} className={timeMode === m ? 'active' : ''} onClick={() => setTimeMode(m)}>
                          {t(m === 'none' ? 'none' : m === 'date' ? 'fixedDate' : 'intervalMonths')}
                        </button>
                      ))}
                    </div>
                    {timeMode === 'date' && (
                      <Field label={t('fixedDate')} error={errors.nextDate}>
                        <DateInput value={nextDate} onChange={setNextDate} invalid={!!errors.nextDate} ariaLabel={t('fixedDate')} />
                      </Field>
                    )}
                    {timeMode === 'interval' && (
                      <Field label={t('intervalMonths')}>
                        <div className="input-suffix">
                          <input inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value.replace(/[^\d]/g, ''))} />
                          <span>{t('months')}</span>
                        </div>
                      </Field>
                    )}
                  </div>
                  {isAuto && (
                    <div>
                      <div className="field-label">{t('byKm')}</div>
                      <div className="seg">
                        {['none', 'km', 'interval'].map((m) => (
                          <button type="button" key={m} className={kmMode === m ? 'active' : ''} onClick={() => setKmMode(m)}>
                            {t(m === 'none' ? 'none' : m === 'km' ? 'fixedKm' : 'intervalKm')}
                          </button>
                        ))}
                      </div>
                      {kmMode === 'km' && (
                        <Field label={t('fixedKm')} error={errors.nextKm}>
                          <input inputMode="numeric" value={nextKm} onChange={(e) => setNextKm(e.target.value.replace(/[^\d]/g, ''))} />
                        </Field>
                      )}
                      {kmMode === 'interval' && (
                        <Field label={t('intervalKm')}>
                          <div className="input-suffix">
                            <input inputMode="numeric" value={kmInterval} onChange={(e) => setKmInterval(e.target.value.replace(/[^\d]/g, ''))} />
                            <span>km</span>
                          </div>
                        </Field>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid-2">
                  <Field label={`${t('notifyBefore')} (${t('notifyDaysBefore')})`}>
                    <input inputMode="numeric" value={notifyDays} placeholder={t('useDefault', { n: settings.notifyDays })} onChange={(e) => setNotifyDays(e.target.value.replace(/[^\d]/g, ''))} />
                  </Field>
                  {isAuto && kmMode !== 'none' && (
                    <Field label={`${t('notifyBefore')} (${t('notifyKmBefore')})`}>
                      <input inputMode="numeric" value={notifyKm} placeholder={t('useDefault', { n: fmtNumber(settings.notifyKm, settings) })} onChange={(e) => setNotifyKm(e.target.value.replace(/[^\d]/g, ''))} />
                    </Field>
                  )}
                </div>
                {nextPreview && <p className="preview">{t('computedNext', { text: nextPreview })}</p>}
                {errors.plan && <p className="field-error">{errors.plan}</p>}
              </>
            )}
          </fieldset>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
