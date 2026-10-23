import { useStore } from '../store.jsx';
import { dueText, relDays, relKm, repeatText, fmtNumber } from '../utils.js';
import { Icon, StatusBadge, TypeIcon } from './ui.jsx';

/** Eén regel gepland onderhoud, met status en acties */
export default function PlanRow({ entry, showItem, onDone, onEdit, onDelete, onOpenItem }) {
  const { t, settings } = useStore();
  const { plan, item, status, daysLeft, kmLeft, notifyDays, notifyKm } = entry;
  const rel = [relDays(daysLeft, t), relKm(kmLeft, t, settings)].filter(Boolean).join(' · ');
  const repeat = repeatText(plan, t, settings);

  return (
    <div className={'plan-row status-' + status}>
      <div className="plan-main">
        {showItem && (
          <button className="plan-item link" onClick={() => onOpenItem?.(item)}>
            <TypeIcon type={item.type} size={14} /> {item.name}
          </button>
        )}
        <div className="plan-name">{plan.name}</div>
        {plan.description && <div className="plan-desc muted">{plan.description}</div>}
        <div className="plan-meta">
          <span><Icon name="calendar" size={14} /> {dueText(plan, t, settings)}</span>
          {repeat && <span className="muted">{repeat}</span>}
          <span className="muted" title={t('notifyBefore')}>
            <Icon name="bell" size={14} /> {notifyDays} {t('notifyDaysBefore')}
            {plan.dueKm != null && ` · ${fmtNumber(notifyKm, settings)} ${t('notifyKmBefore')}`}
          </span>
        </div>
      </div>
      <div className="plan-side">
        <StatusBadge status={status} />
        {rel && <div className={'plan-rel rel-' + status}>{rel}</div>}
        <div className="plan-actions">
          {/* Alleen bij achterstallig onderhoud valt de knop op */}
          <button className={'btn btn-sm' + (status === 'overdue' ? ' btn-primary' : '')} onClick={() => onDone(entry)}>
            <Icon name="check" size={15} /> {t('markDone')}
          </button>
          <button className="icon-btn" onClick={() => onEdit(entry)} title={t('edit')} aria-label={t('edit')}>
            <Icon name="edit" size={16} />
          </button>
          <button className="icon-btn danger" onClick={() => onDelete(entry)} title={t('delete')} aria-label={t('delete')}>
            <Icon name="trash" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
