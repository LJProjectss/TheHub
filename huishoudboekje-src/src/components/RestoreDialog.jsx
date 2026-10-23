import { CircleAlert, X } from "lucide-react";
import { P } from "../theme";
import { formatDate } from "../lib/format";
import { Button } from "./ui";

// Keuze bij het importeren van een JSON-back-up: alles vervangen of samenvoegen.
export default function RestoreDialog({ pending, currentCount, onReplace, onMerge, onCancel }) {
  if (!pending) return null;
  const { backup, fileName } = pending;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(15,31,56,0.45)" }}
    >
      <div className="w-full max-w-lg rounded-2xl hb-dialog" style={{ backgroundColor: P.surface }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: P.border }}>
          <h2 className="font-semibold" style={{ color: P.heading }}>
            Back-up importeren
          </h2>
          <button
            onClick={onCancel}
            className="p-1 rounded hover:bg-black/5"
            style={{ color: P.muted }}
            aria-label="Sluiten"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm" style={{ color: P.text }}>
            <strong>{fileName}</strong>
            {backup.exportedAt && <> (gemaakt op {formatDate(backup.exportedAt)})</>} bevat {backup.transactions.length}{" "}
            transactie(s). Er staan nu {currentCount} transactie(s) in de app.
          </p>

          <div className="rounded-2xl border hb-card p-4" style={{ borderColor: P.border }}>
            <div className="text-sm font-semibold mb-1" style={{ color: P.heading }}>
              Samenvoegen
            </div>
            <p className="text-xs mb-3" style={{ color: P.muted }}>
              Voegt alleen toe wat nog ontbreekt. Transacties die al aanwezig zijn worden overgeslagen, en herhalende
              regels die je al hebt worden niet dubbel toegevoegd. Je huidige gegevens blijven staan.
            </p>
            <Button variant="primary" onClick={onMerge}>
              Samenvoegen
            </Button>
          </div>

          <div className="rounded-2xl border hb-card p-4" style={{ borderColor: P.border }}>
            <div className="text-sm font-semibold mb-1" style={{ color: P.heading }}>
              Alles vervangen
            </div>
            <p className="text-xs mb-3 flex items-start gap-1.5" style={{ color: P.expense }}>
              <CircleAlert size={14} className="mt-0.5 flex-shrink-0" />
              De app wordt precies zoals in de back-up. Alles wat nu in de app staat ({currentCount} transactie(s),
              categorieën, budgetten, regels en spaardoelen) wordt overschreven. Maak eventueel eerst een export.
            </p>
            <Button variant="danger" onClick={onReplace}>
              Alles vervangen door back-up
            </Button>
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" onClick={onCancel}>
              Annuleren
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
