import { ChevronLeft, ChevronRight } from "lucide-react";
import { P } from "../theme";
import { PERIOD_KINDS, defaultPeriod, shiftPeriod } from "../lib/overview";
import { Select } from "./ui";

// Kiezen van een periode: soort (maand / jaar tot nu / heel jaar / eigen periode) plus bladeren.
// labelSuffix maakt de knoppen onderscheidbaar als er twee kiezers op één pagina staan.
export default function PeriodPicker({
  period,
  setPeriod,
  range,
  transactions,
  labelSuffix = "",
  showThisMonth = true,
}) {
  const now = new Date();
  const kindLabel = PERIOD_KINDS.find((k) => k.value === period.kind)?.label;
  const setKind = (label) => {
    const kind = PERIOD_KINDS.find((k) => k.label === label)?.value || "month";
    if (kind === "month") setPeriod(defaultPeriod(transactions));
    else if (kind === "custom") setPeriod({ kind, from: range.from, to: range.to });
    else setPeriod({ kind, year: period.year ?? Number(range.to.slice(0, 4)) });
  };
  const arrow = (dir, Icon, label) => (
    <button
      onClick={() => setPeriod(shiftPeriod(period, dir))}
      className="p-2 rounded-lg border hover:bg-black/5"
      style={{ borderColor: P.border, color: P.text, backgroundColor: P.surface }}
      aria-label={label + labelSuffix}
    >
      <Icon size={16} />
    </button>
  );
  const dateInput = (field) => (
    <input
      type="date"
      value={period[field] || ""}
      onChange={(e) => e.target.value && setPeriod({ ...period, [field]: e.target.value })}
      className="px-2.5 py-2 rounded-lg border text-sm"
      style={{ borderColor: P.border }}
    />
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-full sm:w-40">
        <Select value={kindLabel} onChange={setKind} options={PERIOD_KINDS.map((k) => k.label)} />
      </div>
      {period.kind === "custom" ? (
        <>
          {dateInput("from")}
          <span className="text-sm" style={{ color: P.muted }}>
            t/m
          </span>
          {dateInput("to")}
        </>
      ) : (
        <>
          {arrow(-1, ChevronLeft, "Vorige periode")}
          <span className="text-sm font-medium px-1 min-w-[9rem] text-center" style={{ color: P.heading }}>
            {range.label}
          </span>
          {arrow(1, ChevronRight, "Volgende periode")}
          {showThisMonth &&
            period.kind === "month" &&
            !(period.year === now.getFullYear() && period.month === now.getMonth()) && (
              <button
                onClick={() => setPeriod({ kind: "month", year: now.getFullYear(), month: now.getMonth() })}
                className="text-xs font-medium px-2 py-1 rounded hover:bg-black/5"
                style={{ color: P.blue }}
              >
                Deze maand
              </button>
            )}
        </>
      )}
    </div>
  );
}
