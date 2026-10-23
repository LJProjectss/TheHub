import { useState } from "react";
import { ChevronDown, Wallet } from "lucide-react";
import { P } from "../theme";
import { formatEuro } from "../lib/format";

// Class voor alles wat in de privacymodus vervaagd moet worden (zie index.css).
export const MONEY_CLASS = "hb-money";

// Een eurobedrag; vervaagt in de privacymodus.
export function Money({ value, className = "" }) {
  return <span className={`${MONEY_CLASS} ${className}`}>{formatEuro(value)}</span>;
}

// Bedrag met teken, groen voor inkomsten en rood voor uitgaven.
export function Amount({ value, className = "" }) {
  const positive = value >= 0;
  return (
    <span
      className={`${MONEY_CLASS} tabular-nums font-semibold ${className}`}
      style={{ color: positive ? P.income : P.expense }}
    >
      {positive ? "+" : "-"}
      {formatEuro(Math.abs(value))}
    </span>
  );
}

const BUTTON_BASE =
  "hb-btn inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";
const BUTTON_VARIANTS = {
  primary: "hb-btn-primary",
  secondary: "border hb-btn-secondary",
  ghost: "hover:bg-black/5",
  danger: "text-white",
};

export function Button({
  children,
  onClick,
  variant = "primary",
  icon: Icon,
  className = "",
  type = "button",
  disabled,
}) {
  const style =
    variant === "primary"
      ? { backgroundColor: P.blue, color: P.onBlue }
      : variant === "danger"
        ? { backgroundColor: P.expense }
        : variant === "secondary"
          ? { borderColor: P.border, color: P.text, backgroundColor: P.surface }
          : { color: P.text };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`}
      style={style}
    >
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}

export function Select({ value, onChange, options, placeholder }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none w-full pl-3 pr-8 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
        style={{ borderColor: P.border, color: P.text, backgroundColor: P.surface, "--tw-ring-color": P.blueLight }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
        style={{ color: P.muted }}
      />
    </div>
  );
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
        style={{ backgroundColor: P.paleBlue, boxShadow: `0 0 0 8px ${P.paleBlue}66` }}
      >
        <Wallet size={24} style={{ color: P.blue }} />
      </div>
      <h3 className="text-base font-semibold mb-1.5" style={{ color: P.heading }}>
        {title}
      </h3>
      <p className="text-sm max-w-sm" style={{ color: P.muted }}>
        {text}
      </p>
      {action}
    </div>
  );
}

// Standaard tooltip-stijl voor de grafieken.
export const tooltipStyle = () => ({
  borderRadius: 12,
  boxShadow: "0 12px 32px -10px rgba(13, 26, 48, 0.28)",
  padding: "10px 12px",
  borderColor: P.border,
  fontSize: 13,
  backgroundColor: P.surface,
  color: P.text,
});

// Korte inleiding onder een paginatitel; de volledige uitleg klapt open. De keuze wordt per pagina onthouden.
export function Intro({ id, summary, children }) {
  const key = `huishoudboekje-intro-${id}`;
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(key) === "open";
    } catch {
      return false;
    }
  });
  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(key, o ? "closed" : "open");
      } catch {
        // opslag niet beschikbaar
      }
      return !o;
    });
  };
  return (
    <div className="text-sm mb-5 max-w-3xl" style={{ color: P.muted }}>
      <p>
        {summary}{" "}
        <button
          onClick={toggle}
          aria-expanded={open}
          className="inline-flex items-center gap-0.5 font-medium whitespace-nowrap"
          style={{ color: P.blue }}
        >
          {open ? "Minder uitleg" : "Meer uitleg"}
          <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
        </button>
      </p>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
