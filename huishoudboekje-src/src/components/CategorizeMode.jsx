import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, SkipForward, X } from "lucide-react";
import { P } from "../theme";
import { formatDate } from "../lib/format";
import { clearAutoFlag } from "../lib/patterns";
import { partyKey, quickCategories } from "../lib/partyGroups";
import { Amount, Select } from "./ui";

// Transacties zonder categorie één voor één, met grote knoppen voor het voorstel en de meest
// gebruikte categorieën: met één tik door een import heen, vooral handig op de telefoon.
// Een keuze geldt standaard ook voor de andere open transacties van dezelfde partij.
export default function CategorizeMode({ transactions, categories, categoryRules, setTransactions, notify, onClose }) {
  // De wachtrij ligt vast bij het openen (nieuwste eerst); wat intussen een categorie kreeg, slaan we over.
  const [queue] = useState(() =>
    transactions
      .filter((t) => !t.category && !t.expected)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((t) => t.id),
  );
  const byId = useMemo(() => new Map(transactions.map((t) => [t.id, t])), [transactions]);
  const [history, setHistory] = useState([]); // [{ ids, skipped }]
  const [skipped, setSkipped] = useState(() => new Set());
  const [samePartyToo, setSamePartyToo] = useState(true);

  const openIds = queue.filter((id) => byId.get(id) && !byId.get(id).category && !skipped.has(id));
  const current = byId.get(openIds[0]);
  const position = queue.length - openIds.length + 1;

  const sameParty = useMemo(() => {
    if (!current) return [];
    const key = partyKey(current.description);
    return key ? openIds.slice(1).filter((id) => partyKey(byId.get(id).description) === key) : [];
  }, [current?.id, openIds.length]);

  const quick = useMemo(
    () => (current ? quickCategories(current, transactions, { rules: categoryRules, categories }) : { list: [] }),
    [current?.id],
  );

  const choose = (category) => {
    if (!category || !current) return;
    const ids = new Set([current.id, ...(samePartyToo ? sameParty : [])]);
    setTransactions((list) => list.map((t) => (ids.has(t.id) ? { ...clearAutoFlag(t), category } : t)));
    setHistory((h) => [...h, { ids: [...ids], category }]);
  };
  const skip = () => {
    if (!current) return;
    setSkipped((s) => new Set(s).add(current.id));
    setHistory((h) => [...h, { ids: [current.id], skipped: true }]);
  };
  // Terug = de vorige stap ongedaan maken (categorie weer leeg).
  const back = () => {
    const last = history.at(-1);
    if (!last) return;
    if (last.skipped)
      setSkipped((s) => {
        const next = new Set(s);
        next.delete(last.ids[0]);
        return next;
      });
    else {
      const ids = new Set(last.ids);
      setTransactions((list) => list.map((t) => (ids.has(t.id) && t.category === last.category ? { ...t, category: "" } : t)));
    }
    setHistory((h) => h.slice(0, -1));
  };
  const close = () => {
    const count = history.filter((h) => !h.skipped).reduce((s, h) => s + h.ids.length, 0);
    if (count > 0) notify?.(`${count} transactie(s) gecategoriseerd.`);
    onClose();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const others = categories.filter((c) => !quick.list.includes(c));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6"
      style={{ backgroundColor: "rgba(12,24,48,0.45)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Categoriseren"
    >
      <div
        className="hb-categorize w-full sm:max-w-md flex flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl"
        style={{ backgroundColor: P.surface, maxHeight: "100dvh" }}
      >
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <button
            onClick={back}
            disabled={history.length === 0}
            className="p-2 -ml-1 rounded-full hover:bg-black/5 disabled:opacity-30"
            aria-label="Vorige"
            style={{ color: P.text }}
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 text-center text-sm font-semibold" style={{ color: P.heading }}>
            {current ? `Categoriseren · ${position} van ${queue.length}` : "Categoriseren"}
          </div>
          <button onClick={close} className="p-2 -mr-1 rounded-full hover:bg-black/5" aria-label="Sluiten" style={{ color: P.text }}>
            <X size={20} />
          </button>
        </div>
        <div className="h-1 mx-4 rounded-full overflow-hidden" style={{ backgroundColor: P.border }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${(Math.min(position - 1, queue.length) / Math.max(queue.length, 1)) * 100}%`, backgroundColor: P.blue }}
          />
        </div>

        {current ? (
          <div className="flex-1 overflow-y-auto px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="text-center mb-5">
              <div className="text-xs mb-1" style={{ color: P.muted }}>
                {formatDate(current.date)}
              </div>
              <div className="text-base font-semibold leading-snug break-words" style={{ color: P.heading }}>
                {current.description || "(geen omschrijving)"}
              </div>
              <div className="text-3xl mt-2 tracking-tight">
                <Amount value={current.amount} />
              </div>
              {current.notes && (
                <div className="text-xs mt-2" style={{ color: P.muted }}>
                  {current.notes}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {quick.list.map((c) => (
                <button
                  key={c}
                  onClick={() => choose(c)}
                  className="min-h-[56px] px-3 py-3 rounded-2xl border text-sm font-semibold text-left leading-tight transition active:scale-[0.98]"
                  style={
                    c === quick.suggestion
                      ? { backgroundColor: P.blue, color: P.onBlue, borderColor: P.blue }
                      : { backgroundColor: P.surface, color: P.text, borderColor: P.border }
                  }
                >
                  {c === quick.suggestion && <Check size={14} className="inline -mt-0.5 mr-1" />}
                  {c}
                </button>
              ))}
            </div>

            {others.length > 0 && (
              <div className="mt-3">
                <Select value="" onChange={choose} options={others} placeholder="Andere categorie…" />
              </div>
            )}

            {sameParty.length > 0 && (
              <label className="flex items-center gap-2.5 mt-4 text-sm" style={{ color: P.text }}>
                <input type="checkbox" checked={samePartyToo} onChange={(e) => setSamePartyToo(e.target.checked)} />
                Ook de {sameParty.length} andere van deze partij
              </label>
            )}

            <button
              onClick={skip}
              className="w-full flex items-center justify-center gap-2 mt-4 py-3 rounded-2xl text-sm font-medium hover:bg-black/5"
              style={{ color: P.muted }}
            >
              <SkipForward size={15} /> Overslaan
            </button>
          </div>
        ) : (
          <div className="px-5 py-10 text-center">
            <div
              className="w-12 h-12 mx-auto mb-3 rounded-full grid place-items-center"
              style={{ backgroundColor: P.successBg, color: P.income }}
            >
              <Check size={24} />
            </div>
            <div className="font-semibold" style={{ color: P.heading }}>
              {skipped.size > 0 ? `Klaar, ${skipped.size} overgeslagen` : "Alles heeft een categorie"}
            </div>
            <button
              onClick={close}
              className="mt-5 px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: P.blue, color: P.onBlue }}
            >
              Sluiten
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
