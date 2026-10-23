// Kleine bouwstenen van de Transacties-pagina en het bewaren van filters en sortering.
import { useEffect, useState } from "react";
import { P } from "../../theme";
import { DEFAULT_SORT, EMPTY_FILTERS } from "../../lib/transactionList";

// Filters en sortering blijven bewaard zolang de app open is (ook als u even naar een andere pagina gaat).
export const VIEW_KEY = "huishoudboekje-transacties-weergave";

// Een filter vanuit een andere pagina (bv. het Overzicht) gaat voor wat er bewaard was.
export function initialView(initialFilter) {
  if (initialFilter) {
    return {
      filters: {
        ...EMPTY_FILTERS,
        category: initialFilter.category || "",
        dateFrom: initialFilter.dateFrom || "",
        dateTo: initialFilter.dateTo || "",
        onlyAuto: !!initialFilter.onlyAuto,
      },
      sort: DEFAULT_SORT,
    };
  }
  try {
    const saved = JSON.parse(sessionStorage.getItem(VIEW_KEY));
    if (saved?.filters) return { filters: { ...EMPTY_FILTERS, ...saved.filters }, sort: { ...DEFAULT_SORT, ...saved.sort } };
  } catch {
    // opslag niet beschikbaar
  }
  return { filters: EMPTY_FILTERS, sort: DEFAULT_SORT };
}

export function useIsMobile() {
  const query = "(max-width: 639px)";
  const [mobile, setMobile] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

export function FilterField({ label, children }) {
  return (
    <div>
      <label className="text-xs block mb-1" style={{ color: P.muted }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function Chip({ active, onClick, color = P.blue, activeBg = P.paleBlue, title, children }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border whitespace-nowrap flex-shrink-0"
      style={{
        borderColor: active ? color : P.border,
        color: active ? color : P.text,
        backgroundColor: active ? activeBg : P.surface,
      }}
      title={title}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
