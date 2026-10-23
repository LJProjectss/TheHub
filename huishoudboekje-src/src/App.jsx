// De schil van de app: navigatie, meldingsbalken, de gekozen pagina en de vensters (import,
// back-up terugzetten, synchronisatieconflict). De onderdelen staan in src/app/.
import { Suspense, useEffect, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { P } from "./theme";
import { newId } from "./lib/format";
import { useHuishoudboekje } from "./lib/useHuishoudboekje";
import { useBackup, useBackupReminder } from "./lib/backup";
import { usePrivacy } from "./lib/privacy";
import { autoDistribute } from "./lib/savings";
import { addExpectedTransactions } from "./lib/recurring";
import { useCloudSync } from "./lib/sync";
import { useAutoBackup } from "./lib/autobackup";
import RestoreDialog from "./components/RestoreDialog";
import SyncConflictDialog from "./components/SyncConflictDialog";
import { MONEY_CLASS } from "./components/ui";
import { ImportDialog } from "./app/pages";
import { useBudgetAlerts, useNotify, useRenewals, useTheme } from "./app/useAppState";
import { useImport } from "./app/useImport";
import { MobileTabBar, MobileTopBar, Sidebar } from "./app/Navigation";
import Banners from "./app/Banners";
import PageContent from "./app/PageContent";

export default function App() {
  const data = useHuishoudboekje();
  const { transactions, setTransactions, savingsSettings, setSavingsGoals, recurringRules, saveError } = data;

  const [page, setPage] = useState("dashboard");
  const [importOpen, setImportOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { dark, setDark, darkShown } = useTheme();
  const privacy = usePrivacy();
  const privacyToggleLabel = privacy.enabled ? "Privacymodus: aan" : "Privacymodus: uit";
  const revealLabel = privacy.hidden ? "Bedragen tonen" : "Bedragen verbergen";
  const toggleReveal = () => privacy.setRevealed(privacy.hidden);
  // Tik op een vervaagd bedrag = alle bedragen tonen.
  const revealOnAmountClick = (e) => {
    if (privacy.hidden && e.target.closest?.(`.${MONEY_CLASS}`)) privacy.setRevealed(true);
  };

  const messages = useNotify(setTransactions);
  const { notify } = messages;
  const renewals = useRenewals(data);
  const budgetAlerts = useBudgetAlerts(data);
  const imports = useImport(data, notify);

  // Naar een pagina gaan, eventueel met een filter voor Transacties (bv. vanuit het Overzicht).
  // Elk nieuw filter krijgt een eigen sleutel, zodat de pagina er vers mee opent.
  const [txFilter, setTxFilter] = useState(null);
  const navigate = (target, filter = null) => {
    setTxFilter(filter ? { ...filter, key: newId() } : null);
    setPage(target);
  };

  const backup = useBackup(data, notify);
  const reminder = useBackupReminder(transactions.length);
  const sync = useCloudSync(data, notify);
  const autoBackup = useAutoBackup(data);

  // Spaardoelen met een automatische verdeelwijze volgen het spaarsaldo (ook na een CSV-import).
  useEffect(() => {
    setSavingsGoals((goals) => autoDistribute(goals, transactions, savingsSettings));
  }, [transactions, savingsSettings, data.savingsGoals]);

  useEffect(() => {
    if (recurringRules.length === 0) return;
    setTransactions((list) => addExpectedTransactions(list, recurringRules));
  }, [recurringRules]);

  // Knoppen die zowel in de zijbalk als in de bovenbalk (telefoon) staan.
  const actions = {
    privacy,
    toggleReveal,
    revealLabel,
    privacyToggleLabel,
    dark,
    toggleDark: () => setDark((d) => !d),
    backup,
  };

  return (
    <div
      className={`hb-app h-screen flex ${darkShown ? "dark" : ""}`}
      data-privacy={privacy.hidden ? "hidden" : "shown"}
      onClickCapture={revealOnAmountClick}
      style={{
        height: "100dvh",
        backgroundColor: P.bg,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        "--field-bg": P.surface,
        "--field-text": P.text,
        "--field-placeholder": P.muted,
        "--field-accent": P.blue,
      }}
    >
      <Sidebar page={page} navigate={navigate} sync={sync} actions={actions} />

      <div className="flex-1 flex flex-col min-w-0">
        <MobileTopBar navigate={navigate} sync={sync} actions={actions} />

        <Banners
          saveError={saveError}
          reminder={reminder}
          showReminder={reminder.shouldShow && !(sync.enabled && ["idle", "syncing"].includes(sync.status))}
          exportJson={backup.exportJson}
          messages={messages}
          renewals={renewals}
          budgetAlerts={budgetAlerts}
          goToDashboard={() => navigate("dashboard")}
          imports={imports}
          goToSubscriptions={() => navigate("subscriptions")}
        />

        <main className="hb-main flex-1 overflow-y-auto p-4 sm:p-8 lg:px-10 pb-28 sm:pb-10">
          <PageContent
            page={page}
            data={data}
            navigate={navigate}
            txFilter={txFilter}
            notify={notify}
            openImport={() => setImportOpen(true)}
            sync={sync}
            autoBackup={autoBackup}
          />
        </main>

        <MobileTabBar
          page={page}
          navigate={navigate}
          moreOpen={moreOpen}
          setMoreOpen={setMoreOpen}
          actions={actions}
        />
      </div>

      <input {...backup.fileInputProps} />
      {importOpen && (
        <Suspense fallback={null}>
          <ImportDialog
            open={importOpen}
            onClose={() => setImportOpen(false)}
            onImport={imports.handleImport}
            transactions={transactions}
            csvFormats={data.csvFormats}
            setCsvFormats={data.setCsvFormats}
            accounts={data.accounts}
          />
        </Suspense>
      )}
      <SyncConflictDialog conflict={sync.conflict} localCount={transactions.length} onChoose={sync.resolveConflict} />
      <RestoreDialog
        pending={backup.pendingRestore}
        currentCount={transactions.length}
        onReplace={backup.replaceWithBackup}
        onMerge={backup.mergeIntoCurrent}
        onCancel={backup.cancelRestore}
      />

      {/* Waas voor de appkiezer; zichtbaar via :root[data-shield="on"] (zie lib/privacy.js). */}
      <div
        className="hb-shield fixed inset-0 z-[100] flex-col items-center justify-center gap-3"
        style={{
          backgroundColor: dark ? "rgba(7,13,26,0.72)" : "rgba(12,24,48,0.6)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}
        aria-hidden="true"
      >
        <ArrowRightLeft size={36} color="#FFFFFF" />
        <span className="text-white font-semibold">Huishoudboekje</span>
      </div>
    </div>
  );
}
