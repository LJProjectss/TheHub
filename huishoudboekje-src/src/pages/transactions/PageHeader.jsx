import { useState } from "react";
import { Download, Ellipsis, FileUp, Plus, Repeat, Tag } from "lucide-react";
import { P } from "../../theme";
import { Button } from "../../components/ui";

// Titel met de knoppen Importeren, + Transactie en het "⋯"-menu.
export default function PageHeader({ openImport, onAdd, onAutoCategorize, onToggleRules, onExportVisible, visibleCount }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuItem = (Icon, label, onClick, disabled = false) => (
    <button
      onClick={() => {
        setMenuOpen(false);
        onClick();
      }}
      disabled={disabled}
      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left hover:bg-black/5 disabled:opacity-40"
      style={{ color: P.text }}
    >
      <Icon size={15} style={{ color: P.muted }} />
      {label}
    </button>
  );
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <h1 className="text-2xl font-bold tracking-tight" style={{ color: P.heading }}>
        Transacties
      </h1>
      <div className="flex gap-2">
        <Button variant="secondary" icon={FileUp} onClick={openImport}>
          <span className="hidden sm:inline">CSV importeren</span>
          <span className="sm:hidden">Importeren</span>
        </Button>
        <Button variant="primary" icon={Plus} onClick={onAdd}>
          Transactie
        </Button>
        <div className="relative">
          <Button variant="secondary" icon={Ellipsis} onClick={() => setMenuOpen((v) => !v)}>
            <span className="sr-only">Meer acties</span>
          </Button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div
                className="absolute right-0 top-full mt-1 z-20 w-64 rounded-lg border py-1 shadow-lg"
                style={{ borderColor: P.border, backgroundColor: P.surface }}
              >
                {menuItem(Tag, "Automatisch categoriseren", onAutoCategorize)}
                {menuItem(Repeat, "Herhalende transacties", onToggleRules)}
                {menuItem(
                  Download,
                  `Zichtbare exporteren als CSV (${visibleCount})`,
                  onExportVisible,
                  visibleCount === 0,
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
