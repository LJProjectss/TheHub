// Gedeelde bouwstenen van het Overzicht: kaart, sectie die in- en uitklapt, cijferrij,
// verschil t.o.v. de vorige periode en een klikbare categorienaam.
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { P } from "../../theme";
import { change } from "../../lib/overview";
import { Money } from "../../components/ui";

export const card = () => ({ borderColor: P.border, backgroundColor: P.surface });

export function Card({ children }) {
  return (
    <div className="rounded-2xl border hb-card p-5" style={card()}>
      {children}
    </div>
  );
}

export function CategoryLink({ naam, onClick, muted }) {
  return (
    <button
      onClick={() => onClick(naam)}
      className="text-left hover:underline"
      style={{ color: muted ? P.muted : P.text }}
      title={`Transacties van ${naam} in deze periode`}
    >
      {naam}
    </button>
  );
}

// Verschil t.o.v. de vergelijkingsperiode. goodWhenUp: meer is goed (inkomsten), anders slecht (uitgaven).
export function Delta({ now, before, label, goodWhenUp }) {
  const c = change(now, before);
  if (c === null || Math.abs(c) < 0.005) return null;
  const good = goodWhenUp ? c > 0 : c < 0;
  return (
    <div className="text-xs mt-1" style={{ color: good ? P.income : P.expense }}>
      {c > 0 ? "▲" : "▼"} {Math.abs(Math.round(c * 100))}% t.o.v. {label}
    </div>
  );
}

export function StatRow({ items }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 rounded-2xl border hb-card overflow-hidden" style={card()}>
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`p-5 ${i > 0 ? "border-t sm:border-t-0 sm:border-l" : ""}`}
          style={{ borderColor: P.border }}
        >
          <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: P.muted }}>
            <item.icon size={13} />
            {item.label}
          </div>
          <div className="text-2xl font-bold tabular-nums" style={{ color: item.color }}>
            <Money value={item.value} />
          </div>
          {item.note}
          {item.delta}
        </div>
      ))}
    </div>
  );
}

// Sectie met een kop die in- en uitklapt.
export function Section({ title, collapsed, onToggle, extra, children }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 text-sm font-semibold"
          style={{ color: P.heading }}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
          {title}
        </button>
        {!collapsed && extra}
      </div>
      {!collapsed && children}
    </div>
  );
}

// Welke secties zijn ingeklapt (onthouden in deze browser).
const COLLAPSED_KEY = "huishoudboekje-overview-collapsed";
export function useCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(COLLAPSED_KEY)) || [];
    } catch {
      return [];
    }
  });
  const toggle = (id) =>
    setCollapsed((list) => {
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        // opslag niet beschikbaar
      }
      return next;
    });
  return [collapsed, toggle];
}

// Keuze "Per categorie" / "Per groep" (Overzicht en Jaaroverzicht).
export function GroupToggle({ byGroup, setByGroup, buttonClass = "px-2.5 py-1" }) {
  return (
    <div className="flex rounded-lg border overflow-hidden text-xs" style={{ borderColor: P.border }}>
      {[
        [false, "Per categorie"],
        [true, "Per groep"],
      ].map(([value, label]) => (
        <button
          key={label}
          onClick={() => setByGroup(value)}
          className={buttonClass}
          style={{
            backgroundColor: byGroup === value ? P.paleBlue : P.surface,
            color: byGroup === value ? P.blue : P.muted,
          }}
          aria-pressed={byGroup === value}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
