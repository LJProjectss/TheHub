import { useMemo } from "react";
import { P } from "../../theme";
import { formatDate } from "../../lib/format";
import { todayIso } from "../../lib/overview";
import { daysFromToday } from "../../lib/subscriptions";
import { useSavingsCheck } from "../../lib/savingsCheck";
import { usedByText } from "../../components/SavingsWarning";
import { Money } from "../../components/ui";
import { card } from "./parts";

// Punten die aandacht vragen, elk met een snelkoppeling naar de juiste plek.
// Verkeerd ingestelde spaarrekening (bv. Boodschappen) staat bovenaan.
export function useAttentionItems({ data, budget, recurring, range, navigate }) {
  const { transactions } = data;
  const activeRecurring = recurring.filter((i) => i.active);
  const attention = useMemo(() => {
    const items = [];
    const open = transactions.filter((t) => !t.expected && !t.category);
    if (open.length > 0)
      items.push({
        key: "uncategorized",
        tone: "warn",
        text: (
          <>
            {open.length} transactie{open.length !== 1 ? "s" : ""} zonder categorie (
            <Money value={Math.round(open.reduce((s, t) => s + Math.abs(t.amount), 0) * 100) / 100} />)
          </>
        ),
        action: "Categoriseren",
        // Op de telefoon één voor één (grote knoppen), op een groter scherm per partij.
        onClick: () =>
          navigate("transactions", window.matchMedia?.("(max-width: 639px)").matches ? { quick: true } : { byParty: true }),
      });
    const auto = transactions.filter((t) => t.autoCategorized && t.category).length;
    if (auto > 0)
      items.push({
        key: "auto",
        tone: "info",
        text: `${auto} automatisch toegewezen categorie${auto !== 1 ? "ën" : ""} nog niet gecontroleerd`,
        action: "Controleren",
        onClick: () => navigate("transactions", { onlyAuto: true }),
      });
    const over = budget.rows.filter((r) => r.pct > 1);
    const near = budget.rows.filter((r) => r.pct >= 0.8 && r.pct <= 1);
    if (over.length > 0)
      items.push({
        key: "over",
        tone: "bad",
        text: `Boven budget in ${range.label}: ${over.map((r) => `${r.naam} (${Math.round(r.pct * 100)}%)`).join(", ")}`,
      });
    if (near.length > 0)
      items.push({
        key: "near",
        tone: "warn",
        text: `Bijna aan budget: ${near.map((r) => `${r.naam} (${Math.round(r.pct * 100)}%)`).join(", ")}`,
      });
    const ref = recurring.reduce((max, i) => (i.lastDate > max ? i.lastDate : max), "");
    const [ry, rm, rd] = (ref || todayIso()).split("-").map(Number);
    const since = new Date(ry, rm - 1, rd - 60);
    const sinceIso = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-${String(since.getDate()).padStart(2, "0")}`;
    activeRecurring.forEach((i) => {
      const c = i.priceChanges[i.priceChanges.length - 1];
      if (c && c.to > c.from && c.date >= sinceIso)
        items.push({
          key: `price|${i.key}`,
          tone: "warn",
          text: (
            <>
              Prijsverhoging {i.name}: <Money value={c.from} /> → <Money value={c.to} />
            </>
          ),
          action: "Bekijken",
          onClick: () => navigate("subscriptions"),
        });
      const days = daysFromToday(i.nextExpected);
      if ((i.frequency.key === "yearly" || i.frequency.key === "halfyearly") && days >= 0 && days <= 45)
        items.push({
          key: `renewal|${i.key}`,
          tone: "warn",
          text: (
            <>
              {i.name} verlengt rond {formatDate(i.nextExpected)} (<Money value={i.amount} />)
            </>
          ),
          action: "Bekijken",
          onClick: () => navigate("subscriptions"),
        });
      if (data.subscriptionStatus?.[i.key]?.status === "cancel")
        items.push({
          key: `cancel|${i.key}`,
          tone: "info",
          text: `Nog op te zeggen: ${i.name}`,
          action: "Bekijken",
          onClick: () => navigate("subscriptions"),
        });
    });
    return items;
  }, [transactions, budget, recurring, data.subscriptionStatus, range.label]);

  const savingsCheck = useSavingsCheck(data);
  return [
    ...savingsCheck.warnings.map((w) => ({
      key: `savings|${w.category}`,
      tone: "warn",
      text: `"${w.category}" staat ${usedByText(w.usedBy)} ingesteld, maar lijkt geen spaarrekening: alles daarin telt als gespaard`,
      action: "Bekijken",
      onClick: () => navigate("savings"),
    })),
    ...attention,
  ];
}

export default function AttentionBlock({ items }) {
  if (items.length === 0)
    return (
      <div className="rounded-2xl border hb-card px-5 py-3 text-sm" style={{ ...card(), color: P.income }}>
        ✓ Alles op orde: geen openstaande punten.
      </div>
    );
  return (
    <div className="rounded-2xl border hb-card overflow-hidden" style={card()}>
      <h2 className="text-sm font-semibold px-5 pt-4 pb-2" style={{ color: P.heading }}>
        Aandacht nodig
      </h2>
      {items.map((item, i) => (
        <div
          key={item.key}
          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 py-2.5 text-sm"
          style={{ borderTop: i > 0 ? `1px solid ${P.border}` : "none" }}
        >
          <span className="flex items-center gap-2 min-w-0" style={{ color: P.text }}>
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.tone === "bad" ? P.expense : item.tone === "warn" ? "#C99A3E" : P.blue }}
            />
            <span className="min-w-0">{item.text}</span>
          </span>
          {item.action && (
            <button
              onClick={item.onClick}
              className="text-xs font-semibold underline flex-shrink-0"
              style={{ color: P.blue }}
            >
              {item.action}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
