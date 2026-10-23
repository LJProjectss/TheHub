import { Check, Download, Hash, StickyNote, Trash2, X } from "lucide-react";
import { P } from "../../theme";
import { Button, Select } from "../../components/ui";

// Balk met acties voor de geselecteerde transacties: categorie, notitie, label, verwachte
// bevestigen, exporteren en verwijderen. bulkInput = open tekstveld { kind: "note" | "tag", value }.
export default function SelectionBar({
  count,
  categories,
  bulkCategory,
  setBulkCategory,
  onAssignCategory,
  bulkInput,
  setBulkInput,
  onToggleBulkInput,
  onSaveBulkInput,
  selectedTags,
  onRemoveTag,
  expectedCount,
  onConfirmExpected,
  onExport,
  onDelete,
  onClear,
}) {
  return (
    <div className="mb-3 px-3.5 py-2.5 rounded-md" style={{ backgroundColor: P.paleBlue }}>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-xs font-medium" style={{ color: P.heading }}>
          {count} geselecteerd
        </span>
        <div className="w-48">
          <Select value={bulkCategory} onChange={setBulkCategory} options={categories} placeholder="Kies categorie..." />
        </div>
        <Button variant="primary" icon={Check} onClick={onAssignCategory} disabled={!bulkCategory}>
          Toewijzen
        </Button>
        <Button variant="secondary" icon={StickyNote} onClick={() => onToggleBulkInput("note")}>
          Notitie
        </Button>
        <Button variant="secondary" icon={Hash} onClick={() => onToggleBulkInput("tag")}>
          Label
        </Button>
        {expectedCount > 0 && (
          <Button variant="secondary" icon={Check} onClick={onConfirmExpected}>
            {expectedCount} verwacht bevestigen
          </Button>
        )}
        <Button variant="secondary" icon={Download} onClick={onExport}>
          Exporteren
        </Button>
        <Button variant="secondary" icon={Trash2} onClick={onDelete}>
          Verwijderen
        </Button>
        <button
          onClick={onClear}
          className="text-xs px-2 py-1.5 rounded hover:bg-black/5 ml-auto"
          style={{ color: P.muted }}
        >
          Deselecteren
        </button>
      </div>
      {bulkInput && (
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          <input
            key={bulkInput.kind}
            type="text"
            autoFocus
            list={bulkInput.kind === "tag" ? "hb-tags" : undefined}
            placeholder={
              bulkInput.kind === "note"
                ? "Notitie voor alle geselecteerde (leeg = notities wissen)"
                : "Label(s) toevoegen aan alle geselecteerde, bv. Vakantie 2026"
            }
            value={bulkInput.value}
            onChange={(e) => setBulkInput({ ...bulkInput, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveBulkInput();
              else if (e.key === "Escape") setBulkInput(null);
            }}
            className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border text-sm"
            style={{ borderColor: P.border }}
          />
          <Button variant="primary" icon={Check} onClick={onSaveBulkInput}>
            {bulkInput.kind === "note" ? "Notitie opslaan" : "Label toevoegen"}
          </Button>
          {bulkInput.kind === "tag" && selectedTags.length > 0 && (
            <span className="flex flex-wrap items-center gap-1.5 w-full text-xs" style={{ color: P.muted }}>
              Label weghalen:
              {selectedTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => onRemoveTag(tag)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full border"
                  style={{ borderColor: P.border, color: P.text }}
                >
                  #{tag} <X size={11} />
                </button>
              ))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
