import { useMemo, useState } from "react";
import { Check, CircleAlert, RotateCcw, Tag, TrendingDown, TrendingUp, X } from "lucide-react";
import { P } from "../theme";
import { MONTHS_SHORT, UNCATEGORIZED, formatDate, toIsoDate } from "../lib/format";
import { clearAutoFlag } from "../lib/patterns";
import { daysFromToday, detectRecurring, ignoredPatterns, recurringOptions } from "../lib/subscriptions";
import { Button, EmptyState, Intro, Money, Select } from "../components/ui";

const RENEWAL_WINDOW_DAYS = 45;
const monthYear = (iso) => `${MONTHS_SHORT[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

function Badge({ color, bg, children, title }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
      style={{ color, backgroundColor: bg }}
      title={title}
    >
      {children}
    </span>
  );
}

function LinkButton({ onClick, color, children, active }) {
  return (
    <button
      onClick={onClick}
      className="text-xs font-medium px-2 py-1 rounded hover:bg-black/5"
      style={{ color: color || P.blue, backgroundColor: active ? P.paleBlue : "transparent" }}
    >
      {children}
    </button>
  );
}

// Laatste prijswijziging als die binnen een jaar voor de referentiedatum valt.
function recentChange(item, referenceDate) {
  const c = item.priceChanges[item.priceChanges.length - 1];
  if (!c || !referenceDate) return null;
  const [y, m, d] = referenceDate.split("-").map(Number);
  const yearAgo = toIsoDate(new Date(y - 1, m - 1, d));
  return c.date >= yearAgo ? c : null;
}

function RecurringRow({ item, status, referenceDate, categories, onStatus, onIgnore, onCategorize, isFixed }) {
  const [picking, setPicking] = useState(false);
  const [category, setCategory] = useState("");
  const change = recentChange(item, referenceDate);
  const up = change && change.to > change.from;
  const yearlyDelta = change ? (change.to - change.from) * item.frequency.perYear : 0;

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1 basis-56">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium" style={{ color: P.text }}>
              {item.name}
            </span>
            {status === "wanted" && (
              <Badge color={P.income} bg={P.successBg}>
                <Check size={10} /> Gewenst
              </Badge>
            )}
            {status === "cancel" && (
              <Badge color={P.expense} bg={P.errorBg}>
                Opzeggen
              </Badge>
            )}
            {change && (
              <Badge
                color={up ? P.warn : P.income}
                bg={up ? P.warnBg : P.successBg}
                title={`Prijs gewijzigd op ${formatDate(change.date)}`}
              >
                {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                <Money value={change.from} /> → <Money value={change.to} /> ({monthYear(change.date)})
              </Badge>
            )}
          </div>
          <div className="text-xs mt-0.5" style={{ color: P.muted }}>
            {item.category || UNCATEGORIZED} · {item.frequency.label} · {item.count}× sinds {monthYear(item.firstDate)}{" "}
            · laatst {formatDate(item.lastDate)}
            {item.active && <> · volgende rond {formatDate(item.nextExpected)}</>}
            {item.missed > 0 && (
              <>
                {" "}
                · {item.missed} {item.missed === 1 ? "periode" : "perioden"} overgeslagen
              </>
            )}
          </div>
          {change && up && (
            <div className="text-xs mt-0.5" style={{ color: P.warn }}>
              Prijsverhoging: <Money value={yearlyDelta} /> per jaar extra.
            </div>
          )}
        </div>
        <div className="sm:text-right flex-shrink-0">
          <div className="text-sm font-semibold tabular-nums" style={{ color: P.expense }}>
            {item.variable && <span className="text-xs font-normal">gem. </span>}
            <Money value={item.amount} />
            <span className="text-xs font-normal" style={{ color: P.muted }}>
              {" "}
              per keer
            </span>
          </div>
          <div className="text-xs tabular-nums" style={{ color: P.muted }}>
            <Money value={item.perMonth} /> p/m · <Money value={item.perYear} /> p/j
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 mt-1.5 -ml-2">
        <LinkButton
          onClick={() => onStatus(status === "wanted" ? null : "wanted")}
          color={P.income}
          active={status === "wanted"}
        >
          {status === "wanted" ? "Gewenst ✓" : "Gewenst"}
        </LinkButton>
        <LinkButton
          onClick={() => onStatus(status === "cancel" ? null : "cancel")}
          color={P.expense}
          active={status === "cancel"}
        >
          {status === "cancel" ? "Op opzeglijst ✓" : "Opzeggen"}
        </LinkButton>
        <LinkButton onClick={onIgnore} color={P.muted}>
          {isFixed ? "Verbergen" : "Geen abonnement"}
        </LinkButton>
        <LinkButton onClick={() => setPicking((v) => !v)}>Categorie geven…</LinkButton>
      </div>
      {picking && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <div className="w-52">
            <Select value={category} onChange={setCategory} options={categories} placeholder="Kies categorie..." />
          </div>
          <Button
            variant="primary"
            icon={Tag}
            disabled={!category}
            onClick={() => {
              if (onCategorize(category)) {
                setPicking(false);
                setCategory("");
              }
            }}
          >
            Toepassen op {item.count} betalingen
          </Button>
          <Button variant="ghost" onClick={() => setPicking(false)}>
            Annuleren
          </Button>
        </div>
      )}
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold mb-1" style={{ color: P.heading }}>
        {title}
      </h2>
      {subtitle && (
        <p className="text-xs mb-2" style={{ color: P.muted }}>
          {subtitle}
        </p>
      )}
      <div className="rounded-2xl border hb-card overflow-hidden" style={{ borderColor: P.border, backgroundColor: P.surface }}>
        {children}
      </div>
    </div>
  );
}

// Rijen met een scheidingslijn ertussen.
function Rows({ children }) {
  const list = Array.isArray(children) ? children.filter(Boolean) : [children];
  return list.map((child, i) => (
    <div key={child.key ?? i} style={{ borderTop: i > 0 ? `1px solid ${P.border}` : "none" }}>
      {child}
    </div>
  ));
}

function Empty({ text }) {
  return (
    <p className="px-4 py-3 text-sm" style={{ color: P.muted }}>
      {text}
    </p>
  );
}

function Collapsible({ label, open, onToggle, children }) {
  return (
    <div className="mt-2 mb-4">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-xs font-medium underline"
        style={{ color: P.blue }}
      >
        {open && <X size={12} />}
        {open ? "Verberg" : "Toon"} {label}
      </button>
      {open && (
        <div
          className="rounded-2xl border hb-card overflow-hidden mt-2"
          style={{ borderColor: P.border, backgroundColor: P.surface }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default function Subscriptions({
  transactions,
  setTransactions,
  categories,
  fixedCategories,
  excludedCategories,
  savingsCategory,
  savingsGoals,
  savingsSettings,
  dismissedSubscriptions,
  setDismissedSubscriptions,
  subscriptionStatus,
  setSubscriptionStatus,
}) {
  const [showStopped, setShowStopped] = useState(false);
  const [showIgnored, setShowIgnored] = useState(false);

  const { items, referenceDate } = useMemo(
    () =>
      detectRecurring(
        transactions,
        recurringOptions({ fixedCategories, excludedCategories, savingsCategory, savingsGoals, savingsSettings }),
      ),
    [transactions, fixedCategories, excludedCategories, savingsCategory, savingsGoals, savingsSettings],
  );
  const ignored = useMemo(() => ignoredPatterns(dismissedSubscriptions), [dismissedSubscriptions]);
  const visible = items.filter((i) => !ignored.has(i.pattern));
  const statusOf = (item) => subscriptionStatus[item.key]?.status || null;
  const activeSubs = visible.filter((i) => i.active && i.kind === "subscription");
  const activeFixed = visible.filter((i) => i.active && i.kind === "fixed");
  const stopped = visible.filter((i) => !i.active && statusOf(i) !== "cancel");
  const toCancel = visible.filter((i) => statusOf(i) === "cancel");
  const renewals = visible.filter(
    (i) =>
      i.active &&
      (i.frequency.key === "yearly" || i.frequency.key === "halfyearly") &&
      daysFromToday(i.nextExpected) >= 0 &&
      daysFromToday(i.nextExpected) <= RENEWAL_WINDOW_DAYS,
  );
  const ignoredGroups = [...new Map(items.filter((i) => ignored.has(i.pattern)).map((i) => [i.pattern, i])).values()];
  const sum = (list, field) => Math.round(list.reduce((s, i) => s + i[field], 0) * 100) / 100;

  const setStatus = (item, status) =>
    setSubscriptionStatus((all) => {
      const next = { ...all };
      if (status) next[item.key] = { ...(all[item.key] || {}), status, since: toIsoDate(new Date()) };
      else delete next[item.key];
      return next;
    });
  const setNote = (item, note) =>
    setSubscriptionStatus((all) => ({ ...all, [item.key]: { ...(all[item.key] || {}), note } }));
  const ignore = (item) => setDismissedSubscriptions((list) => [...new Set([...list, item.pattern])]);
  const restore = (pattern) =>
    setDismissedSubscriptions((list) => list.filter((k) => !ignoredPatterns([k]).has(pattern)));
  const categorize = (item, category) => {
    if (
      !window.confirm(
        `Alle ${item.count} betalingen van "${item.name}" in de categorie "${category}" zetten? Een bestaande categorie wordt overschreven.`,
      )
    )
      return false;
    const ids = new Set(item.txIds);
    setTransactions((list) => list.map((t) => (ids.has(t.id) ? { ...clearAutoFlag(t), category } : t)));
    return true;
  };

  const row = (item, isFixed) => (
    <RecurringRow
      key={item.key}
      item={item}
      status={statusOf(item)}
      referenceDate={referenceDate}
      categories={categories}
      isFixed={isFixed}
      onStatus={(s) => setStatus(item, s)}
      onIgnore={() => ignore(item)}
      onCategorize={(c) => categorize(item, c)}
    />
  );

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: P.heading }}>
        Abonnementen en vaste lasten
      </h1>
      <Intro id="abonnementen" summary="Betalingen die in een vast ritme terugkomen, en wat ze per jaar kosten.">
        Herkend aan betalingen die in een vast ritme terugkomen (wekelijks, maandelijks, per kwartaal, halfjaarlijks of
        jaarlijks) met een vast bedrag; een prijswijziging mag. Betalingen die veel vaker voorkomen of steeds een ander
        bedrag hebben (zoals het bedrijfsrestaurant of de supermarkt) tellen niet mee, net als je spaaroverboekingen.
        Vaste lasten zijn de categorieën die je bij Categorieën als "Vaste last" hebt aangevinkt.
      </Intro>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {[
          { label: "Abonnementen", list: activeSubs },
          { label: "Vaste lasten", list: activeFixed },
        ].map(({ label, list }) => (
          <div
            key={label}
            className="rounded-2xl border hb-card p-4"
            style={{ borderColor: P.border, backgroundColor: P.surface }}
          >
            <div className="text-xs mb-1" style={{ color: P.muted }}>
              {label} ({list.length} lopend)
            </div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: P.heading }}>
              <Money value={sum(list, "perMonth")} />
              <span className="text-sm font-normal" style={{ color: P.muted }}>
                {" "}
                per maand
              </span>
            </div>
            <div className="text-xs tabular-nums" style={{ color: P.muted }}>
              <Money value={sum(list, "perYear")} /> per jaar
            </div>
          </div>
        ))}
      </div>

      {toCancel.length > 0 && (
        <Section
          title="Op te zeggen"
          subtitle="Zodra de betalingen stoppen, zie je hier dat het opzeggen gelukt lijkt."
        >
          <Rows>
            {toCancel.map((item) => (
              <div key={item.key} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium" style={{ color: P.text }}>
                      {item.name}{" "}
                      <span className="text-xs font-normal" style={{ color: P.muted }}>
                        <Money value={item.amount} /> {item.frequency.label}
                      </span>
                    </div>
                    {item.active ? (
                      <div className="text-xs" style={{ color: P.warn }}>
                        Nog actief - volgende afschrijving verwacht rond {formatDate(item.nextExpected)}.
                      </div>
                    ) : (
                      <div className="text-xs" style={{ color: P.income }}>
                        ✓ Geen betalingen meer sinds {formatDate(item.lastDate)} - het opzeggen lijkt gelukt.
                      </div>
                    )}
                  </div>
                  <LinkButton onClick={() => setStatus(item, null)} color={item.active ? P.muted : P.income}>
                    {item.active ? "Van opzeglijst halen" : "Klaar"}
                  </LinkButton>
                </div>
                <input
                  type="text"
                  placeholder="Notitie, bv. opzeggen via Mijn account, opzegtermijn 1 maand..."
                  defaultValue={subscriptionStatus[item.key]?.note || ""}
                  onBlur={(e) => setNote(item, e.target.value.trim())}
                  className="w-full mt-2 px-2.5 py-1.5 rounded-lg border text-xs"
                  style={{ borderColor: P.border }}
                />
              </div>
            ))}
          </Rows>
        </Section>
      )}

      {renewals.length > 0 && (
        <div
          className="flex items-start gap-2 p-3 rounded-md mb-6 text-sm"
          style={{ backgroundColor: P.warnBg, color: P.warn }}
        >
          <CircleAlert size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold mb-0.5">Binnenkort verlengd</div>
            {renewals.map((i) => (
              <div key={i.key}>
                {i.name} (<Money value={i.amount} />, {i.frequency.label}) rond {formatDate(i.nextExpected)} - over{" "}
                {daysFromToday(i.nextExpected)} dagen.
                {statusOf(i) !== "cancel" && (
                  <button className="ml-2 underline font-medium" onClick={() => setStatus(i, "cancel")}>
                    Op opzeglijst zetten
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="Nog geen terugkerende betalingen gevonden"
          text="Zodra er betalingen zijn die in een vast ritme met een vast bedrag terugkomen, verschijnen ze hier. Importeer daarvoor een paar maanden aan transacties."
        />
      ) : (
        <>
          <Section title={`Abonnementen (${activeSubs.length})`}>
            {activeSubs.length ? (
              <Rows>{activeSubs.map((i) => row(i, false))}</Rows>
            ) : (
              <Empty text="Geen lopende abonnementen gevonden." />
            )}
          </Section>
          <Section title={`Vaste lasten (${activeFixed.length})`}>
            {activeFixed.length ? (
              <Rows>{activeFixed.map((i) => row(i, true))}</Rows>
            ) : (
              <Empty text='Geen vaste lasten gevonden. Vink bij Categorieën "Vaste last" aan voor bv. huur, energie en verzekeringen.' />
            )}
          </Section>
        </>
      )}

      {stopped.length > 0 && (
        <Collapsible
          label={`gestopt / mogelijk opgezegd (${stopped.length})`}
          open={showStopped}
          onToggle={() => setShowStopped((v) => !v)}
        >
          <p className="text-xs px-4 pt-3 pb-1" style={{ color: P.muted }}>
            Hier is de verwachte betaling uitgebleven, gerekend vanaf je meest recente transactie (
            {formatDate(referenceDate)}).
          </p>
          <Rows>
            {stopped.map((i) => (
              <div key={i.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <div className="text-sm" style={{ color: P.text }}>
                  {i.name}{" "}
                  <span className="text-xs" style={{ color: P.muted }}>
                    <Money value={i.amount} /> {i.frequency.label} · laatste betaling {formatDate(i.lastDate)}
                  </span>
                </div>
                <LinkButton onClick={() => ignore(i)} color={P.muted}>
                  Verbergen
                </LinkButton>
              </div>
            ))}
          </Rows>
        </Collapsible>
      )}

      {ignoredGroups.length > 0 && (
        <Collapsible
          label={`als "geen abonnement" of verborgen gemarkeerd (${ignoredGroups.length})`}
          open={showIgnored}
          onToggle={() => setShowIgnored((v) => !v)}
        >
          <Rows>
            {ignoredGroups.map((i) => (
              <div key={i.pattern} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="text-sm" style={{ color: P.muted }}>
                  {i.name}
                </div>
                <button
                  onClick={() => restore(i.pattern)}
                  className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded hover:bg-black/5"
                  style={{ color: P.blue }}
                >
                  <RotateCcw size={13} /> Toch tonen
                </button>
              </div>
            ))}
          </Rows>
        </Collapsible>
      )}
    </div>
  );
}
