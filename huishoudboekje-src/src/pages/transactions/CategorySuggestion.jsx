import { X } from "lucide-react";
import { P } from "../../theme";

// Voorstel na het handmatig kiezen van een categorie: vergelijkbare transacties meenemen
// en/of er een eigen regel van maken. suggestion: { label, category, ids, canRule }.
export default function CategorySuggestion({ suggestion, onApply, onMakeRule, onClose }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3 px-3.5 py-2.5 rounded-md text-xs"
      style={{ backgroundColor: P.successBg, color: P.heading }}
    >
      <span className="flex-1 basis-64">
        {suggestion.ids.length > 0
          ? `Nog ${suggestion.ids.length} andere transactie(s) met "${suggestion.label}" hebben een andere categorie dan ${suggestion.category}.`
          : `Voortaan "${suggestion.label}" automatisch op ${suggestion.category} zetten?`}
      </span>
      {suggestion.ids.length > 0 && (
        <button onClick={onApply} className="font-semibold underline" style={{ color: P.blue }}>
          Ook op {suggestion.category} zetten
        </button>
      )}
      {suggestion.canRule && (
        <button onClick={onMakeRule} className="font-semibold underline" style={{ color: P.blue }}>
          Regel maken
        </button>
      )}
      <button onClick={onClose} className="p-0.5 rounded hover:bg-black/5" aria-label="Voorstel sluiten">
        <X size={13} />
      </button>
    </div>
  );
}
