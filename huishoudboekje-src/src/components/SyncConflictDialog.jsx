import { CloudAlert } from "lucide-react";
import { P } from "../theme";
import { formatDate } from "../lib/format";
import { Button } from "./ui";

// Keuze als er zowel op dit apparaat als in Google Drive iets is gewijzigd.
export default function SyncConflictDialog({ conflict, localCount, onChoose }) {
  if (!conflict) return null;
  const { remote } = conflict;
  const remoteCount = remote?.data?.transactions?.length ?? 0;
  const when = remote?.savedAt ? new Date(remote.savedAt) : null;
  const option = (choice, title, text, variant = "secondary") => (
    <div className="flex flex-col gap-1.5 p-3 rounded-lg border" style={{ borderColor: P.border }}>
      <Button variant={variant} onClick={() => onChoose(choice)}>
        {title}
      </Button>
      <p className="text-xs" style={{ color: P.muted }}>
        {text}
      </p>
    </div>
  );
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(15,31,56,0.45)" }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl hb-dialog p-5" style={{ backgroundColor: P.surface }}>
        <div className="flex items-center gap-2 mb-2">
          <CloudAlert size={18} style={{ color: P.warn }} />
          <h2 className="font-semibold" style={{ color: P.heading }}>
            Welke gegevens wil je houden?
          </h2>
        </div>
        <p className="text-sm mb-4" style={{ color: P.text }}>
          Zowel op dit apparaat als in Google Drive is iets gewijzigd sinds de laatste synchronisatie. In Google Drive staat
          de versie van {remote?.device || "een ander apparaat"}
          {when ? ` van ${formatDate(when)} ${when.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}` : ""}{" "}
          met {remoteCount} transacties; hier staan er {localCount}.
        </p>
        <div className="space-y-2">
          {option(
            "merge",
            "Samenvoegen (aanbevolen)",
            "Transacties en instellingen van beide kanten worden gecombineerd, zonder dubbele. Verwijderingen aan één kant komen dan wel terug.",
            "primary",
          )}
          {option("remote", "Versie uit Google Drive gebruiken", "Wijzigingen op dit apparaat sinds de laatste synchronisatie vervallen.")}
          {option("local", "Versie van dit apparaat gebruiken", "Het bestand in Google Drive wordt overschreven; wijzigingen van het andere apparaat vervallen.")}
        </div>
      </div>
    </div>
  );
}
