import { Fragment } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { P } from "../../theme";
import { SORT_OPTIONS } from "../../lib/transactionList";
import { Amount, Select } from "../../components/ui";
import TransactionRow, { TransactionCard } from "../../components/TransactionRow";

function SortHeader({ label, sortKey, sort, onSort, align = "left" }) {
  const active = sort.key === sortKey;
  const Icon = sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={`py-2.5 px-3 font-medium ${align === "right" ? "text-right" : ""}`}>
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:underline ${align === "right" ? "flex-row-reverse" : ""}`}
        style={{ color: active ? P.heading : P.muted }}
      >
        {label}
        {active && <Icon size={12} />}
      </button>
    </th>
  );
}

function Totals({ totals, compact = false }) {
  if (compact) return <Amount value={totals.balance} className="text-xs" />;
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
      <span>
        In <Amount value={totals.income} />
      </span>
      <span>
        Uit <Amount value={totals.expense} />
      </span>
    </span>
  );
}

// De transacties: kaarten op de telefoon, een tabel op de computer; bij sorteren op datum
// per maand gegroepeerd. Onderaan het aantal en de totalen van wat zichtbaar is.
// rowProps(t) geeft de eigenschappen voor één rij of kaart.
export default function TransactionList({
  isMobile,
  groups,
  visibleCount,
  totalCount,
  totals,
  sort,
  setSort,
  onSort,
  allSelected,
  onToggleSelectAll,
  rowProps,
}) {
  return (
    <div className="rounded-2xl border hb-card overflow-hidden" style={{ borderColor: P.border, backgroundColor: P.surface }}>
      {isMobile ? (
        <>
          <div
            className="flex items-center gap-3 px-3.5 py-2.5 border-b"
            style={{ borderColor: P.border, backgroundColor: P.bg }}
          >
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleSelectAll}
              className="rounded"
              aria-label="Alles selecteren"
            />
            <div className="flex-1 min-w-0">
              <Select
                value={SORT_OPTIONS.find((o) => o.key === sort.key && o.dir === sort.dir)?.label}
                onChange={(label) => {
                  const o = SORT_OPTIONS.find((x) => x.label === label);
                  setSort({ key: o.key, dir: o.dir });
                }}
                options={SORT_OPTIONS.map((o) => o.label)}
              />
            </div>
          </div>
          {groups.map((g) => (
            <Fragment key={g.key}>
              {g.label && (
                <div
                  className="flex items-center justify-between gap-2 px-3.5 py-2 text-xs font-semibold border-b"
                  style={{ borderColor: P.border, backgroundColor: P.bg, color: P.heading }}
                >
                  <span>
                    {g.label}{" "}
                    <span className="font-normal" style={{ color: P.muted }}>
                      · {g.items.length}
                    </span>
                  </span>
                  <Totals totals={g.totals} compact />
                </div>
              )}
              {g.items.map((t, i) => (
                <div key={t.id} style={{ borderTop: i > 0 ? `1px solid ${P.border}` : "none" }}>
                  <TransactionCard {...rowProps(t)} />
                </div>
              ))}
            </Fragment>
          ))}
        </>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b text-left text-xs" style={{ borderColor: P.border, color: P.muted }}>
                <th className="py-2.5 pl-4 pr-2 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleSelectAll}
                    className="rounded"
                    aria-label="Alles selecteren"
                  />
                </th>
                <SortHeader label="Datum" sortKey="date" sort={sort} onSort={onSort} />
                <SortHeader label="Omschrijving" sortKey="description" sort={sort} onSort={onSort} />
                <th className="py-2.5 px-3 font-medium">Categorie</th>
                <SortHeader label="Bedrag" sortKey="amount" sort={sort} onSort={onSort} align="right" />
                <th className="py-2.5 px-4" />
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.key}>
                {g.label && (
                  <tr className="border-b" style={{ borderColor: P.border, backgroundColor: P.bg }}>
                    <td colSpan={4} className="py-2 pl-4 pr-3 text-xs font-semibold" style={{ color: P.heading }}>
                      {g.label}{" "}
                      <span className="font-normal" style={{ color: P.muted }}>
                        · {g.items.length} transactie{g.items.length !== 1 ? "s" : ""}
                      </span>
                    </td>
                    <td colSpan={2} className="py-2 pr-4" style={{ color: P.muted }}>
                      <div className="flex justify-end">
                        <Totals totals={g.totals} />
                      </div>
                    </td>
                  </tr>
                )}
                {g.items.map((t) => (
                  <TransactionRow key={t.id} {...rowProps(t)} />
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
      {visibleCount === 0 && (
        <p className="px-4 py-8 text-sm text-center" style={{ color: P.muted }}>
          Geen transacties die aan deze filters voldoen.
        </p>
      )}
      <div
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-2.5 text-xs border-t"
        style={{ borderColor: P.border, color: P.muted }}
      >
        <span>
          {visibleCount} van {totalCount} transacties
          {totals.expected > 0 && ` (totalen zonder ${totals.expected} verwacht)`}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <Totals totals={totals} />
          <span className="font-semibold" style={{ color: P.heading }}>
            Saldo <Amount value={totals.balance} />
          </span>
        </span>
      </div>
    </div>
  );
}
