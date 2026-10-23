import { useState } from "react";
import { Check, ChevronDown, Pencil, StickyNote, Trash2, X } from "lucide-react";
import { P } from "../theme";
import { UNCATEGORIZED, formatDate } from "../lib/format";
import { parseInputAmount } from "../lib/csv";
import { Amount, Select } from "./ui";

const FIELD_NAMES = { date: "een datum", description: "een omschrijving", amount: "een bedrag (niet 0)" };

// Ontbrekende of ongeldige velden van een nieuwe/bewerkte transactie; null als alles klopt.
export function transactionErrors({ date, description, amount }) {
  const errors = { date: !date, description: !description.trim(), amount: amount === null || amount === 0 };
  return Object.values(errors).some(Boolean) ? errors : null;
}

export function ErrorText({ errors, className = "" }) {
  const missing = Object.keys(FIELD_NAMES).filter((k) => errors?.[k]);
  if (missing.length === 0) return null;
  return (
    <p className={`text-xs ${className}`} style={{ color: P.expense }}>
      Vul nog {missing.map((k) => FIELD_NAMES[k]).join(", ")} in.
    </p>
  );
}

export const fieldBorder = (error) => ({ borderColor: error ? P.expense : P.border });

// "Vakantie, Italië 2026" -> ["Vakantie", "Italië 2026"] (zonder dubbele, ongeacht hoofdletters).
export function parseTags(text) {
  const seen = new Set();
  return String(text || "")
    .split(",")
    .map((s) => s.trim().replace(/^#/, ""))
    .filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
}

// Bewerken van één transactie, gedeeld door de tabelrij (desktop) en de kaart (mobiel).
function useTransactionEdit(t, onUpdate) {
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState(null);

  const startEdit = () => {
    setDraft({
      date: t.date,
      description: t.description,
      // Altijd twee decimalen: "12,5" zou als 125 gelezen kunnen worden.
      amount: Math.abs(t.amount).toFixed(2).replace(".", ","),
      type: t.amount >= 0 ? "inkomst" : "uitgave",
      note: t.note || "",
      tags: (t.tags || []).join(", "),
    });
    setErrors(null);
  };
  const cancel = () => {
    setDraft(null);
    setErrors(null);
  };
  const save = () => {
    const amount = parseInputAmount(draft.amount);
    const found = transactionErrors({ ...draft, amount });
    if (found) {
      setErrors(found);
      return;
    }
    onUpdate(t.id, {
      date: draft.date,
      description: draft.description.trim(),
      amount: draft.type === "uitgave" ? -Math.abs(amount) : Math.abs(amount),
      note: draft.note.trim(),
      tags: parseTags(draft.tags),
    });
    cancel();
  };
  const set = (field) => (e) => {
    const value = e.target.value;
    setDraft((d) => ({ ...d, [field]: value }));
    setErrors((er) => er && { ...er, [field]: false });
  };
  const onKeyDown = (e) => {
    if (e.key === "Enter") save();
    else if (e.key === "Escape") cancel();
  };
  return { editing: draft !== null, draft, errors, startEdit, cancel, save, set, onKeyDown };
}

function CategorySelect({ t, onCategoryChange, categories }) {
  return (
    <Select
      value={t.category || ""}
      onChange={(v) => onCategoryChange(t, v)}
      options={categories}
      placeholder={UNCATEGORIZED}
    />
  );
}

function IconButton({ onClick, color, label, title, children }) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded hover:bg-black/5"
      style={{ color: color || P.muted }}
      aria-label={label}
      title={title}
    >
      {children}
    </button>
  );
}

function Badges({ t, onUpdate, accountName, onTagClick }) {
  return (
    <>
      {accountName && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0" style={{ borderColor: P.border, color: P.muted }}>
          {accountName}
        </span>
      )}
      {(t.tags || []).map((tag) => (
        <Badge key={tag} color={P.blue} title={`Alle transacties met label "${tag}"`} onClick={() => onTagClick?.(tag)} neutral>
          #{tag}
        </Badge>
      ))}
      {t.expected && <Badge color={P.blue}>Verwacht</Badge>}
      {t.autoCategorized && t.category && (
        <Badge
          color={P.income}
          title="Categorie automatisch toegewezen. Klik om goed te keuren, of kies zelf een andere categorie."
          onClick={() => onUpdate(t.id, { autoCategorized: undefined })}
        >
          auto ✓
        </Badge>
      )}
    </>
  );
}

function RowActions({ t, onUpdate, onDelete, startEdit }) {
  return (
    <div className="flex gap-1 justify-end">
      {t.expected && (
        <IconButton
          onClick={() => onUpdate(t.id, { expected: false })}
          color={P.income}
          label="Bevestigen"
          title="Bevestigen zoals hij is (zonder CSV-import)"
        >
          <Check size={15} />
        </IconButton>
      )}
      <IconButton onClick={startEdit} label="Bewerken">
        <Pencil size={15} />
      </IconButton>
      <IconButton onClick={() => onDelete(t.id)} label="Verwijderen">
        <Trash2 size={15} />
      </IconButton>
    </div>
  );
}

function TypeSelect({ value, onChange, className }) {
  return (
    <select value={value} onChange={onChange} className={`rounded-lg border ${className}`} style={{ borderColor: P.border }}>
      <option value="uitgave">Uitgave</option>
      <option value="inkomst">Inkomst</option>
    </select>
  );
}

// Tabelrij (desktop) met inline bewerken.
export default function TransactionRow({
  t,
  categories,
  onUpdate,
  onCategoryChange,
  onDelete,
  selected,
  onToggleSelect,
  accountName,
  onTagClick,
}) {
  const { editing, draft, errors, startEdit, cancel, save, set, onKeyDown } = useTransactionEdit(t, onUpdate);
  const categorySelect = <CategorySelect t={t} onCategoryChange={onCategoryChange} categories={categories} />;

  if (editing) {
    return (
      <>
        <tr className="border-b-0" style={{ backgroundColor: P.paleBlue }}>
          <td className="py-2 pl-4 pr-2">
            <input type="checkbox" checked={selected} onChange={onToggleSelect} className="rounded" />
          </td>
          <td className="py-2 pr-3">
            <input
              type="date"
              value={draft.date}
              onChange={set("date")}
              onKeyDown={onKeyDown}
              className="w-full px-2 py-1.5 rounded-lg border text-sm"
              style={fieldBorder(errors?.date)}
            />
          </td>
          <td className="py-2 pr-3">
            <input
              type="text"
              value={draft.description}
              onChange={set("description")}
              onKeyDown={onKeyDown}
              autoFocus
              className="w-full px-2 py-1.5 rounded-lg border text-sm"
              style={fieldBorder(errors?.description)}
            />
          </td>
          <td className="py-2 pr-3">{categorySelect}</td>
          <td className="py-2 pr-3">
            <div className="flex gap-1.5 justify-end">
              <TypeSelect value={draft.type} onChange={set("type")} className="px-1.5 py-1.5 text-xs" />
              <input
                type="text"
                inputMode="decimal"
                value={draft.amount}
                onChange={set("amount")}
                onKeyDown={onKeyDown}
                className="hb-money w-20 px-2 py-1.5 rounded-lg border text-sm text-right tabular-nums"
                style={fieldBorder(errors?.amount)}
              />
            </div>
          </td>
          <td className="py-2 text-right">
            <div className="flex gap-1 justify-end">
              <IconButton onClick={save} color={P.income} label="Opslaan" title="Opslaan (Enter)">
                <Check size={15} />
              </IconButton>
              <IconButton onClick={cancel} label="Annuleren" title="Annuleren (Esc)">
                <X size={15} />
              </IconButton>
            </div>
          </td>
        </tr>
        <tr className="border-b last:border-0" style={{ borderColor: P.border, backgroundColor: P.paleBlue }}>
          <td />
          <td colSpan={5} className="pb-2.5 pr-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Notitie (optioneel), bv. 'terugbetaling van Sanne'..."
                value={draft.note}
                onChange={set("note")}
                onKeyDown={onKeyDown}
                className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border text-sm"
                style={{ borderColor: P.border }}
              />
              <input
                type="text"
                list="hb-tags"
                placeholder="Labels, bv. Vakantie 2026"
                value={draft.tags}
                onChange={set("tags")}
                onKeyDown={onKeyDown}
                className="w-56 px-2 py-1.5 rounded-lg border text-sm"
                style={{ borderColor: P.border }}
                title="Meerdere labels scheiden met een komma"
              />
            </div>
            <ErrorText errors={errors} className="mt-1.5" />
          </td>
        </tr>
      </>
    );
  }

  return (
    <tr
      className="border-b last:border-0"
      style={{
        borderColor: P.border,
        backgroundColor: selected ? P.paleBlue : "transparent",
        opacity: t.expected ? 0.7 : 1,
      }}
    >
      <td className="py-2.5 pl-4 pr-2">
        <input type="checkbox" checked={selected} onChange={onToggleSelect} className="rounded" />
      </td>
      <td className="py-2.5 pr-3 text-sm whitespace-nowrap" style={{ color: P.muted }}>
        {formatDate(t.date)}
      </td>
      <td
        className="py-2.5 pr-3 text-sm"
        style={{
          color: P.text,
          borderLeft: t.expected ? `2px dashed ${P.blueLight}` : "none",
          paddingLeft: t.expected ? 8 : 0,
        }}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {t.description}
          <Badges t={t} onUpdate={onUpdate} accountName={accountName} onTagClick={onTagClick} />
        </div>
        {t.note && (
          <div className="flex items-center gap-1 mt-0.5 text-xs italic" style={{ color: P.muted }}>
            <StickyNote size={11} className="flex-shrink-0" />
            <span className="truncate">{t.note}</span>
          </div>
        )}
      </td>
      <td className="py-2.5 pr-3">{categorySelect}</td>
      <td className="py-2.5 pr-3 text-right">
        <Amount value={t.amount} />
      </td>
      <td className="py-2.5 text-right">
        <RowActions t={t} onUpdate={onUpdate} onDelete={onDelete} startEdit={startEdit} />
      </td>
    </tr>
  );
}

// Kaart (mobiel) met dezelfde mogelijkheden als de tabelrij.
export function TransactionCard({
  t,
  categories,
  onUpdate,
  onCategoryChange,
  onDelete,
  selected,
  onToggleSelect,
  accountName,
  onTagClick,
}) {
  const { editing, draft, errors, startEdit, cancel, save, set, onKeyDown } = useTransactionEdit(t, onUpdate);
  const [open, setOpen] = useState(false);

  if (editing) {
    const input = "w-full px-2.5 py-2 rounded-lg border text-sm";
    return (
      <div className="px-3.5 py-3 space-y-2" style={{ backgroundColor: P.paleBlue }}>
        <input
          type="text"
          value={draft.description}
          onChange={set("description")}
          onKeyDown={onKeyDown}
          placeholder="Omschrijving"
          className={input}
          style={fieldBorder(errors?.description)}
        />
        <div className="flex gap-2">
          <input
            type="date"
            value={draft.date}
            onChange={set("date")}
            onKeyDown={onKeyDown}
            className={`${input} flex-1 min-w-0`}
            style={fieldBorder(errors?.date)}
          />
          <TypeSelect value={draft.type} onChange={set("type")} className="px-1.5 py-2 text-sm" />
          <input
            type="text"
            inputMode="decimal"
            value={draft.amount}
            onChange={set("amount")}
            onKeyDown={onKeyDown}
            className="hb-money w-24 px-2.5 py-2 rounded-lg border text-sm text-right tabular-nums"
            style={fieldBorder(errors?.amount)}
          />
        </div>
        <input
          type="text"
          placeholder="Notitie (optioneel)"
          value={draft.note}
          onChange={set("note")}
          onKeyDown={onKeyDown}
          className={input}
          style={{ borderColor: P.border }}
        />
        <input
          type="text"
          list="hb-tags"
          placeholder="Labels, gescheiden door komma's"
          value={draft.tags}
          onChange={set("tags")}
          onKeyDown={onKeyDown}
          className={input}
          style={{ borderColor: P.border }}
        />
        <CategorySelect t={t} onCategoryChange={onCategoryChange} categories={categories} />
        <ErrorText errors={errors} />
        <div className="flex justify-end gap-2">
          <button onClick={cancel} className="px-3 py-1.5 rounded-md text-sm" style={{ color: P.text }}>
            Annuleren
          </button>
          <button
            onClick={save}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white"
            style={{ backgroundColor: P.blue, color: P.onBlue }}
          >
            <Check size={15} />
            Opslaan
          </button>
        </div>
      </div>
    );
  }

  // Compact: tik op de categorie om die te kiezen, tik op de regel voor bewerken en verwijderen.
  const onRowClick = (e) => {
    if (e.target.closest("button, a, input, select, label")) return;
    setOpen((o) => !o);
  };
  return (
    <div
      className="px-3.5 py-2.5"
      style={{
        backgroundColor: selected || open ? P.paleBlue : "transparent",
        opacity: t.expected ? 0.7 : 1,
        borderLeft: t.expected ? `2px dashed ${P.blueLight}` : "2px solid transparent",
      }}
    >
      <div className="flex gap-3 items-start">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="rounded mt-1 flex-shrink-0"
          aria-label={`Selecteer ${t.description}`}
        />
        <div
          className="flex-1 min-w-0 cursor-pointer"
          role="button"
          tabIndex={0}
          aria-expanded={open}
          onClick={onRowClick}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget && (e.preventDefault(), setOpen((o) => !o))}
        >
          <div className="flex items-baseline justify-between gap-2">
            <div className="min-w-0 text-sm truncate font-medium" style={{ color: P.text }}>
              {t.description}
            </div>
            <Amount value={t.amount} className="text-sm whitespace-nowrap flex-shrink-0" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs" style={{ color: P.muted }}>
            <CategoryChip t={t} onCategoryChange={onCategoryChange} categories={categories} />
            <span>{formatDate(t.date)}</span>
            <Badges t={t} onUpdate={onUpdate} accountName={accountName} onTagClick={onTagClick} />
          </div>
          {t.note && (
            <div className="flex items-center gap-1 mt-1 text-xs italic" style={{ color: P.muted }}>
              <StickyNote size={11} className="flex-shrink-0" />
              <span className="truncate">{t.note}</span>
            </div>
          )}
        </div>
      </div>
      {open && (
        <div className="flex justify-end gap-2 mt-2 pl-7">
          {t.expected && (
            <CardAction onClick={() => onUpdate(t.id, { expected: false })} color={P.income}>
              <Check size={14} /> Bevestigen
            </CardAction>
          )}
          <CardAction onClick={() => (setOpen(false), startEdit())}>
            <Pencil size={14} /> Bewerken
          </CardAction>
          <CardAction onClick={() => onDelete(t.id)} color={P.expense}>
            <Trash2 size={14} /> Verwijderen
          </CardAction>
        </div>
      )}
    </div>
  );
}

// Categorie als compacte pil; de onzichtbare keuzelijst erover opent de keuze van het toestel zelf.
function CategoryChip({ t, onCategoryChange, categories }) {
  const empty = !t.category;
  return (
    <span
      className="relative inline-flex items-center gap-1 max-w-[60%] px-2 py-0.5 rounded-full border font-medium"
      style={{
        borderColor: empty ? P.warn : P.border,
        color: empty ? P.warn : P.text,
        backgroundColor: P.surface,
      }}
    >
      <span className="truncate">{t.category || "Kies categorie"}</span>
      <ChevronDown size={12} className="flex-shrink-0" style={{ color: P.muted }} />
      <select
        value={t.category || ""}
        onChange={(e) => onCategoryChange(t, e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        aria-label={`Categorie van ${t.description}`}
      >
        <option value="">{UNCATEGORIZED}</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </span>
  );
}

function CardAction({ onClick, color, children }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium"
      style={{ borderColor: P.border, color: color || P.text, backgroundColor: P.surface }}
    >
      {children}
    </button>
  );
}

export function Badge({ color, title, onClick, neutral, children }) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: onClick && !neutral ? P.successBg : P.paleBlue, color }}
      title={title}
      onClick={onClick}
    >
      {children}
    </Tag>
  );
}
