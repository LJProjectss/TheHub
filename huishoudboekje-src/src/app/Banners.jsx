// Alle balken bovenaan de app: opslagprobleem, back-upherinnering, meldingen met "ongedaan
// maken", verlengingen van abonnementen, nieuwe abonnementen/prijswijzigingen na een import en
// afwijkende bedragen bij herhalende regels.
import { CircleAlert, Gauge, RadioTower, StickyNote, Tag, X } from "lucide-react";
import { P } from "../theme";
import { formatDate } from "../lib/format";
import { daysFromToday } from "../lib/subscriptions";
import { Money } from "../components/ui";

const MAX_NOTICE_BANNERS = 3;

function Banner({ bg, color, icon: Icon, children, actions, onClose, closeLabel }) {
  return (
    <div
      className="no-print flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2 text-xs"
      style={{ backgroundColor: bg, color }}
    >
      <span className="flex items-center gap-1.5 min-w-0 flex-1 basis-64">
        <Icon size={13} className="flex-shrink-0" />
        {/* Eén tekstblok, zodat tekst met bedragen (<Money>) gewoon doorloopt. */}
        <span className="min-w-0">{children}</span>
      </span>
      <div className="flex items-center gap-3 flex-shrink-0">
        {actions}
        <button onClick={onClose} className="p-0.5 rounded hover:bg-black/5" aria-label={closeLabel}>
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

export default function Banners({
  saveError,
  reminder,
  showReminder,
  exportJson,
  messages,
  renewals,
  budgetAlerts,
  imports,
  goToSubscriptions,
  goToDashboard,
}) {
  const { message, runUndo, close } = messages;
  const { recurringNotices, setRecurringNotices, ruleWarnings, dismissWarning, fixRuleAmount } = imports;
  return (
    <>
      {saveError && (
        <div className="no-print px-4 py-2 text-xs text-center" style={{ backgroundColor: P.errorBg, color: P.expense }}>
          Lokale opslag van de browser is niet beschikbaar (bv. privémodus of volle opslaglimiet) - gebruik
          "Exporteren" om gegevens niet kwijt te raken.
        </div>
      )}
      {showReminder && (
        <Banner
          bg={P.paleBlue}
          color={P.heading}
          icon={StickyNote}
          onClose={reminder.dismiss}
          closeLabel="Herinnering sluiten"
          actions={
            <>
              <button onClick={exportJson} className="font-semibold underline" style={{ color: P.blue }}>
                Nu exporteren
              </button>
              <a href="/#backup" className="font-semibold underline" style={{ color: P.blue }}>
                Alle apps via de hub
              </a>
            </>
          }
        >
          {reminder.daysSinceBackup === null
            ? "Je hebt nog geen back-up gemaakt van je gegevens - alles staat alleen lokaal in deze browser."
            : `Het is alweer ${reminder.daysSinceBackup} dagen geleden dat je een back-up hebt gemaakt.`}
        </Banner>
      )}
      {message && (
        <Banner
          bg={P.successBg}
          color={P.heading}
          icon={Tag}
          onClose={close}
          closeLabel="Melding sluiten"
          actions={
            message.undo.length > 0 && (
              <>
                {message.undo.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => runUndo(action)}
                    className="font-semibold underline"
                    style={{ color: P.blue }}
                  >
                    {action.label}
                  </button>
                ))}
              </>
            )
          }
        >
          {message.text}
        </Banner>
      )}
      {budgetAlerts.open.length > 0 && (
        <Banner
          bg={budgetAlerts.open.some((a) => a.pct >= 1) ? P.errorBg : P.warnBg}
          color={budgetAlerts.open.some((a) => a.pct >= 1) ? P.expense : P.warn}
          icon={Gauge}
          onClose={budgetAlerts.dismiss}
          closeLabel="Budgetmelding sluiten"
          actions={
            <button onClick={goToDashboard} className="font-semibold underline" style={{ color: "inherit" }}>
              Bekijken
            </button>
          }
        >
          {budgetAlerts.open.every((a) => a.pct >= 1) ? "Budget op" : "Budget bijna op"}:{" "}
          {budgetAlerts.open.map((a, i) => (
            <span key={a.naam}>
              {i > 0 && ", "}
              {a.naam} {Math.round(a.pct * 100)}% (<Money value={a.besteed} /> van <Money value={a.budget} />)
            </span>
          ))}
          {budgetAlerts.open[0].daysLeft > 0 && ` - nog ${budgetAlerts.open[0].daysLeft} dagen te gaan deze maand.`}
        </Banner>
      )}
      {renewals.upcoming.map((i) => (
        <Banner
          key={`renewal|${i.key}`}
          bg={P.warnBg}
          color={P.warn}
          icon={CircleAlert}
          onClose={() => renewals.dismiss(`${i.key}|${i.nextExpected}`)}
          closeLabel="Herinnering sluiten"
          actions={
            <button onClick={goToSubscriptions} className="font-semibold underline" style={{ color: P.warn }}>
              Bekijken
            </button>
          }
        >
          Verlenging binnenkort: {i.name} (<Money value={i.amount} />, {i.frequency.label}) rond{" "}
          {formatDate(i.nextExpected)} - nog {daysFromToday(i.nextExpected)} dagen om eventueel op te zeggen.
        </Banner>
      ))}
      {recurringNotices.slice(0, MAX_NOTICE_BANNERS).map((n) => (
        <Banner
          key={n.id}
          bg={P.paleBlue}
          color={P.heading}
          icon={RadioTower}
          onClose={() => setRecurringNotices((list) => list.filter((x) => x.id !== n.id))}
          closeLabel="Melding sluiten"
          actions={
            <button onClick={goToSubscriptions} className="font-semibold underline" style={{ color: P.blue }}>
              Bekijken
            </button>
          }
        >
          {n.kind === "new" ? (
            <>
              Nieuwe terugkerende betaling gevonden: {n.item.name} (<Money value={n.item.amount} />{" "}
              {n.item.frequency.label}
              {n.item.kind === "fixed" ? ", vaste last" : ""}).
            </>
          ) : (
            <>
              Prijswijziging: {n.item.name} <Money value={n.change.from} /> → <Money value={n.change.to} /> (
              {n.change.to > n.change.from ? "+" : "-"}
              <Money value={Math.abs(n.change.to - n.change.from) * n.item.frequency.perYear} /> per jaar).
            </>
          )}
        </Banner>
      ))}
      {recurringNotices.length > MAX_NOTICE_BANNERS && (
        <Banner
          bg={P.paleBlue}
          color={P.heading}
          icon={RadioTower}
          onClose={() => setRecurringNotices([])}
          closeLabel="Alle meldingen sluiten"
          actions={
            <button onClick={goToSubscriptions} className="font-semibold underline" style={{ color: P.blue }}>
              Bekijken
            </button>
          }
        >
          … en nog {recurringNotices.length - MAX_NOTICE_BANNERS} melding(en) over abonnementen.
        </Banner>
      )}
      {ruleWarnings.map((w) => (
        <Banner
          key={w.ruleId}
          bg={P.warnBg}
          color={P.warn}
          icon={CircleAlert}
          onClose={() => dismissWarning(w.ruleId)}
          closeLabel="Waarschuwing sluiten"
          actions={
            <button onClick={() => fixRuleAmount(w)} className="font-semibold underline" style={{ color: P.warn }}>
              Regel bijwerken naar <Money value={w.actual} />
            </button>
          }
        >
          Herhalende regel "{w.keyword}": verwacht <Money value={w.expected} />, maar geïmporteerd{" "}
          <Money value={w.actual} /> ({formatDate(w.date)}).
        </Banner>
      ))}
    </>
  );
}
