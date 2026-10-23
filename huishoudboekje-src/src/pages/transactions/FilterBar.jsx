import { Repeat, Search, SlidersHorizontal, Tag, X } from "lucide-react";
import { P } from "../../theme";
import { UNCATEGORIZED } from "../../lib/format";
import { GROUP_PREFIX } from "../../lib/categories";
import { TYPE_OPTIONS } from "../../lib/transactionList";
import { Select } from "../../components/ui";
import { Chip, FilterField } from "./parts";

// Zoeken, categorie, "Meer filters", snelkeuzes voor de periode en de statusfilters.
// accountFilter: { show, options, valueFor(iban), ibanFor(label) } voor het rekeningfilter.
export default function FilterBar({
  filters,
  setFilter,
  setPeriod,
  clearFilters,
  anyFilter,
  extraFilterCount,
  showMoreFilters,
  setShowMoreFilters,
  presets,
  activePreset,
  customDates,
  categories,
  groupList,
  allTags,
  accountFilter,
  autoCount,
  expectedCount,
}) {
  const field = { borderColor: P.border };
  return (
    <>
      <div className="flex flex-wrap gap-3 mb-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: P.muted }} />
          <input
            type="text"
            placeholder="Zoek op omschrijving, notitie of bedrag..."
            value={filters.search}
            onChange={(e) => setFilter("search")(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-lg border text-sm"
            style={field}
          />
          {filters.search && (
            <button
              onClick={() => setFilter("search")("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-black/5"
              style={{ color: P.muted }}
              aria-label="Zoekterm wissen"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="w-full sm:w-52">
          <Select
            value={filters.category}
            onChange={setFilter("category")}
            options={[UNCATEGORIZED, ...groupList.map((g) => GROUP_PREFIX + g), ...categories]}
            placeholder="Alle categorieën"
          />
        </div>
        <button
          onClick={() => setShowMoreFilters((v) => !v)}
          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border"
          style={{
            borderColor: extraFilterCount > 0 ? P.blue : P.border,
            color: extraFilterCount > 0 ? P.blue : P.text,
            backgroundColor: showMoreFilters ? P.paleBlue : "transparent",
          }}
        >
          <SlidersHorizontal size={14} />
          Meer filters
          {extraFilterCount > 0 && (
            <span
              className="text-xs font-semibold px-1.5 rounded-full"
              style={{ backgroundColor: P.blue, color: P.onBlue }}
            >
              {extraFilterCount}
            </span>
          )}
        </button>
        {anyFilter && (
          <button
            onClick={clearFilters}
            className="text-xs font-medium px-3 py-2 rounded-md hover:bg-black/5"
            style={{ color: P.expense }}
          >
            Wis alle filters
          </button>
        )}
      </div>

      {/* Snelkeuze periode en statusfilters; scrolt zijwaarts op smalle schermen. */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1 -mx-1 px-1">
        <Chip active={!filters.dateFrom && !filters.dateTo} onClick={() => setPeriod("", "")}>
          Alles
        </Chip>
        {presets.map((p) => (
          <Chip
            key={p.label}
            active={activePreset === p}
            onClick={() => (activePreset === p ? setPeriod("", "") : setPeriod(p.from, p.to))}
          >
            {p.label}
          </Chip>
        ))}
        {customDates && (
          <Chip active onClick={() => setShowMoreFilters(true)} title="Eigen periode, aan te passen onder Meer filters">
            Eigen periode
          </Chip>
        )}
        {(autoCount > 0 || expectedCount > 0) && <span className="w-px flex-shrink-0" style={{ backgroundColor: P.border }} />}
        {autoCount > 0 && (
          <Chip
            active={filters.onlyAuto}
            onClick={() => setFilter("onlyAuto")(!filters.onlyAuto)}
            color={P.income}
            activeBg={P.successBg}
            title="Toon alleen transacties waarvan de categorie automatisch is toegewezen en nog niet is gecontroleerd"
          >
            <Tag size={12} />
            Automatisch toegewezen ({autoCount})
          </Chip>
        )}
        {expectedCount > 0 && (
          <Chip
            active={filters.onlyExpected}
            onClick={() => setFilter("onlyExpected")(!filters.onlyExpected)}
            title="Toon alleen verwachte transacties uit herhalende regels die nog niet zijn geboekt"
          >
            <Repeat size={12} />
            Verwacht ({expectedCount})
          </Chip>
        )}
      </div>

      {showMoreFilters && (
        <div
          className="flex flex-wrap items-end gap-3 mb-3 p-3.5 rounded-md"
          style={{ backgroundColor: P.bg, border: `1px solid ${P.border}` }}
        >
          <FilterField label="Datum van">
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilter("dateFrom")(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border text-sm"
              style={field}
            />
          </FilterField>
          <FilterField label="Datum tot en met">
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilter("dateTo")(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border text-sm"
              style={field}
            />
          </FilterField>
          <FilterField label="Soort">
            <div className="w-44">
              <Select
                value={Object.keys(TYPE_OPTIONS).find((k) => TYPE_OPTIONS[k] === filters.type) || ""}
                onChange={(label) => setFilter("type")(TYPE_OPTIONS[label] || "")}
                options={Object.keys(TYPE_OPTIONS)}
                placeholder="Inkomsten en uitgaven"
              />
            </div>
          </FilterField>
          {allTags.length > 0 && (
            <FilterField label="Label">
              <div className="w-44">
                <Select value={filters.tag} onChange={setFilter("tag")} options={allTags} placeholder="Alle labels" />
              </div>
            </FilterField>
          )}
          {accountFilter.show && (
            <FilterField label="Rekening">
              <div className="w-60">
                <Select
                  value={accountFilter.valueFor(filters.account)}
                  onChange={(label) => setFilter("account")(accountFilter.ibanFor(label))}
                  options={accountFilter.options}
                  placeholder="Alle rekeningen"
                />
              </div>
            </FilterField>
          )}
          <FilterField label="Bedrag vanaf (€)">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={filters.amountMin}
              onChange={(e) => setFilter("amountMin")(e.target.value)}
              className="w-24 px-2.5 py-1.5 rounded-lg border text-sm tabular-nums"
              style={field}
            />
          </FilterField>
          <FilterField label="Bedrag tot (€)">
            <input
              type="text"
              inputMode="decimal"
              placeholder="geen max"
              value={filters.amountMax}
              onChange={(e) => setFilter("amountMax")(e.target.value)}
              className="w-28 px-2.5 py-1.5 rounded-lg border text-sm tabular-nums"
              style={field}
            />
          </FilterField>
          {filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo && (
            <p className="text-xs w-full" style={{ color: P.expense }}>
              De begindatum ligt na de einddatum, dus er valt niets binnen deze periode.
            </p>
          )}
        </div>
      )}
    </>
  );
}
