import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store.jsx';
import { fmtDate, parseNlDate } from '../utils.js';
import {
  Car, Home, WashingMachine, Plus, X, Pencil, Trash2, Check, CalendarDays, AlertCircle, ChevronLeft,
  Download, Upload, Gauge, List, Euro, Settings, Bell, Wrench, FileSpreadsheet, Sun, Moon, CalendarClock
} from 'lucide-react';

const ICONS = {
  auto: Car, huis: Home, thuis: Home, apparaat: WashingMachine, plus: Plus, close: X, edit: Pencil,
  trash: Trash2, check: Check, calendar: CalendarDays, alert: AlertCircle, back: ChevronLeft,
  download: Download, upload: Upload, gauge: Gauge, list: List, euro: Euro, settings: Settings,
  bell: Bell, wrench: Wrench, excel: FileSpreadsheet, sun: Sun, moon: Moon, planning: CalendarClock
};

/** Iconen uit lucide-react, dezelfde set als in het huishoudboekje */
export function Icon({ name, size = 18, ...rest }) {
  const C = ICONS[name];
  return C ? <C size={size} strokeWidth={1.9} aria-hidden="true" {...rest} /> : null;
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' modal-wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="close"><Icon name="close" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, error, hint, children, className = '' }) {
  return (
    <label className={'field ' + className}>
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

/**
 * Datuminvoer die altijd dd-mm-jjjj toont (onafhankelijk van de browsertaal),
 * met een knop voor de kalenderkiezer van de browser.
 */
export function DateInput({ value, onChange, invalid, ariaLabel }) {
  const { t } = useStore();
  const [text, setText] = useState(fmtDate(value));
  const pickerRef = useRef(null);

  useEffect(() => {
    if (parseNlDate(text) !== (value || null)) setText(fmtDate(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  };

  return (
    <div className={'date-input' + (invalid ? ' invalid' : '')}>
      <input
        type="text"
        inputMode="numeric"
        aria-label={ariaLabel}
        placeholder={t('dateFormatPlaceholder')}
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          if (v.trim() === '') onChange('');
          else {
            const iso = parseNlDate(v);
            if (iso) onChange(iso);
          }
        }}
        onBlur={() => {
          if (text.trim() === '') return;
          const iso = parseNlDate(text, true);
          if (iso) {
            onChange(iso);
            setText(fmtDate(iso));
          } else {
            setText(fmtDate(value));
          }
        }}
      />
      <button type="button" className="icon-btn" onClick={openPicker} title={t('openCalendar')} aria-label={t('openCalendar')}>
        <Icon name="calendar" size={16} />
      </button>
      <input
        ref={pickerRef}
        className="hidden-picker"
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function StatusBadge({ status }) {
  const { t } = useStore();
  return <span className={'badge badge-' + status}>{t('status_' + status)}</span>;
}

export function TypeIcon({ type, size = 18 }) {
  return (
    <span className={'type-icon type-' + type}>
      <Icon name={type} size={size} />
    </span>
  );
}
