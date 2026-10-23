import { CircleAlert } from "lucide-react";
import { P } from "../theme";
import { Money } from "./ui";

// Waar de categorie als spaarrekening wordt gebruikt, in gewone taal.
export function usedByText(usedBy) {
  const parts = usedBy.map((u) => (u.kind === "default" ? "als uw spaarrekening" : `bij spaardoel "${u.name}"`));
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} en ${parts.at(-1)}` : parts[0] || "";
}

function Reason({ reason }) {
  if (reason.key === "fixed") return <li>staat bij Categorieën gemarkeerd als vaste last;</li>;
  if (reason.key === "inflow")
    return (
      <li>
        er kwam meer geld binnen (<Money value={reason.incoming} />) dan er naartoe ging (<Money value={reason.outgoing} />),
        terwijl je op een spaarrekening juist geld zet;
      </li>
    );
  return (
    <li>
      {reason.payments} betalingen aan {reason.count} verschillende partijen, zoals {reason.examples.join(", ")}: dat lijken
      aankopen, geen overboekingen naar je spaarrekening;
    </li>
  );
}

// Waarschuwing op de pagina Spaardoelen.
export default function SavingsWarning({ warning, onDismiss }) {
  const { category, usedBy, reasons } = warning;
  const isDefault = usedBy.some((u) => u.kind === "default");
  const goals = usedBy.filter((u) => u.kind === "goal");
  return (
    <div className="flex items-start gap-2.5 p-3.5 rounded-md mb-5 text-sm" style={{ backgroundColor: P.warnBg, color: P.warn }} role="alert">
      <CircleAlert size={17} className="mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold">
          Klopt het dat "{category}" {usedByText(usedBy)} is ingesteld?
        </p>
        <p className="mt-1">Deze categorie lijkt geen spaarrekening:</p>
        <ul className="list-disc pl-5 mt-1 space-y-0.5">
          {reasons.map((r) => (
            <Reason key={r.key} reason={r} />
          ))}
        </ul>
        <p className="mt-2">
          Gevolg: alles in {category} telt mee als "gespaard" (op het Overzicht en in het Jaaroverzicht) en wordt niet
          bekeken bij Abonnementen.{" "}
          {isDefault && "Kies hierboven de categorie waarmee je geld naar je spaarrekening overboekt, bijvoorbeeld Sparen. "}
          {goals.length > 0 &&
            `Pas bij ${goals.length === 1 ? `het doel "${goals[0].name}"` : "de doelen hieronder"} de categorie aan. `}
          Er gaan geen transacties of doelen verloren.
        </p>
        <button onClick={onDismiss} className="mt-2 text-xs font-semibold underline" style={{ color: P.warn }}>
          Dit klopt, niet meer melden
        </button>
      </div>
    </div>
  );
}
