// Navigatie: zijbalk (computer), bovenbalk en tabbalk met "Meer"-menu (telefoon) en de
// synchronisatieknop. `actions` bevat de gedeelde knoppen (privacy, thema, export, import).
import {
  ArrowRightLeft,
  Cloud,
  CloudAlert,
  CloudOff,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  FileSpreadsheet,
  House,
  Moon,
  RefreshCw,
  Shield,
  ShieldOff,
  Sun,
  Upload,
  X,
} from "lucide-react";
import { P } from "../theme";
import { formatDate } from "../lib/format";
import { MORE_PAGES, PAGES, SIDEBAR_TEXT, TAB_PAGES } from "./pages";

// Status van het synchroniseren; klikken = nu synchroniseren, inloggen of naar Instellingen.
export function SyncButton({ sync, navigate, compact }) {
  const info = !sync.enabled
    ? null
    : {
        idle: { icon: Cloud, label: "Gesynchroniseerd", color: SIDEBAR_TEXT },
        syncing: { icon: RefreshCw, label: "Synchroniseren...", color: SIDEBAR_TEXT, spin: true },
        login: { icon: CloudOff, label: "Synchroniseren (inloggen)", color: "#E3B45C" },
        password: { icon: CloudAlert, label: "Wachtwoord nodig", color: "#E3B45C" },
        conflict: { icon: CloudAlert, label: "Keuze nodig", color: "#E3B45C" },
        error: { icon: CloudAlert, label: "Synchroniseren mislukt", color: "#E0776B" },
        off: null,
      }[sync.status];
  if (!info) return null;
  const onClick = () => {
    if (sync.status === "login") sync.login();
    else if (sync.status === "idle" || sync.status === "error") sync.syncNow();
    else navigate("settings");
  };
  return (
    <button
      onClick={onClick}
      className={compact ? "p-2 rounded-md" : "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm"}
      style={{ color: info.color }}
      aria-label={info.label}
      title={sync.lastSync ? `${info.label} · laatst ${formatDate(new Date(sync.lastSync))}` : info.label}
    >
      <info.icon size={16} className={info.spin ? "animate-spin" : ""} />
      {!compact && info.label}
    </button>
  );
}

export function Sidebar({ page, navigate, sync, actions }) {
  const { privacy, toggleReveal, revealLabel, privacyToggleLabel, dark, toggleDark, backup } = actions;
  const navButton = (p) => (
    <button
      key={p.key}
      onClick={() => navigate(p.key)}
      aria-current={page === p.key ? "page" : undefined}
      className="hb-nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
      style={{
        backgroundColor: page === p.key ? "rgba(255,255,255,0.1)" : "transparent",
        color: page === p.key ? "#FFFFFF" : SIDEBAR_TEXT,
        fontWeight: page === p.key ? 600 : 500,
      }}
    >
      <p.icon size={16} />
      {p.label}
    </button>
  );
  const sideAction = (onClick, Icon, label) => (
    <button
      onClick={onClick}
      className="hb-nav-item w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px]"
      style={{ color: SIDEBAR_TEXT }}
    >
      <Icon size={15} />
      {label}
    </button>
  );
  return (
    <aside
      className="hidden sm:flex w-60 flex-col flex-shrink-0"
      style={{ background: `linear-gradient(180deg, ${P.navyLight} 0%, ${P.navy} 42%)` }}
    >
      <a
        href="/"
        className="mx-3 mt-4 self-start flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors hover:bg-white/10"
        style={{ color: SIDEBAR_TEXT, border: "1px solid rgba(255,255,255,0.1)" }}
        title="Terug naar Thuis"
      >
        <House size={13} />
        Thuis
      </a>
      <div className="px-5 pt-5 pb-6 flex items-center gap-2.5">
        <span
          className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(145deg, #5B8FE6, #2B64C8)", boxShadow: "0 6px 14px -6px rgba(43,100,200,0.9)" }}
        >
          <ArrowRightLeft size={16} color="#FFFFFF" />
        </span>
        <span className="font-semibold text-white text-[15px] tracking-tight">Huishoudboekje</span>
      </div>
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">{PAGES.map(navButton)}</nav>
      <div className="mx-3 mb-5 pt-3 space-y-0.5 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <SyncButton sync={sync} navigate={navigate} />
        {privacy.enabled && sideAction(toggleReveal, privacy.hidden ? Eye : EyeOff, revealLabel)}
        {sideAction(privacy.toggleEnabled, privacy.enabled ? Shield : ShieldOff, privacyToggleLabel)}
        {sideAction(toggleDark, dark ? Sun : Moon, dark ? "Lichte modus" : "Donkere modus")}
        {sideAction(backup.exportJson, Download, "Exporteren (JSON)")}
        {sideAction(backup.exportExcel, FileSpreadsheet, "Exporteren als Excel")}
        {sideAction(backup.triggerImport, Upload, "Importeren")}
      </div>
    </aside>
  );
}

// Bovenbalk op de telefoon: alleen de knoppen die je vaak gebruikt; exporteren en importeren
// staan onder "Meer" in de tabbalk.
export function MobileTopBar({ navigate, sync, actions }) {
  const { privacy, toggleReveal, revealLabel, dark, toggleDark } = actions;
  const topAction = (onClick, Icon, label) => (
    <button onClick={onClick} className="p-2 rounded-lg" style={{ color: SIDEBAR_TEXT }} aria-label={label}>
      <Icon size={18} />
    </button>
  );
  return (
    <div
      className="no-print sm:hidden flex items-center justify-between px-4 py-2.5"
      style={{
        background: `linear-gradient(135deg, ${P.navyLight} 0%, ${P.navy} 70%)`,
        paddingTop: "calc(0.625rem + env(safe-area-inset-top))",
      }}
    >
      <div className="flex items-center gap-2.5">
        <a href="/" className="p-1.5 -ml-1.5 rounded-lg" style={{ color: SIDEBAR_TEXT }} aria-label="Terug naar Thuis">
          <House size={18} />
        </a>
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: "linear-gradient(145deg, #5B8FE6, #2B64C8)" }}
        >
          <ArrowRightLeft size={14} color="#FFFFFF" />
        </span>
        <span className="font-semibold text-white text-[15px] tracking-tight">Huishoudboekje</span>
      </div>
      <div className="flex gap-0.5">
        <SyncButton sync={sync} navigate={navigate} compact />
        {privacy.enabled && topAction(toggleReveal, privacy.hidden ? Eye : EyeOff, revealLabel)}
        {topAction(toggleDark, dark ? Sun : Moon, "Thema wisselen")}
      </div>
    </div>
  );
}

// Tabbalk onderaan met het "Meer"-menu dat van onderen opschuift.
export function MobileTabBar({ page, navigate, moreOpen, setMoreOpen, actions }) {
  const { privacy, privacyToggleLabel, backup } = actions;
  const tab = (active, Icon, label) => (
    <>
      <span className="hb-tab-icon" style={{ backgroundColor: active ? P.paleBlue : "transparent" }}>
        <Icon size={19} />
      </span>
      <span style={{ fontWeight: active ? 600 : 500 }}>{label}</span>
    </>
  );
  const sheetAction = (onClick, Icon, label) => (
    <button
      onClick={() => {
        setMoreOpen(false);
        onClick();
      }}
      className="w-full flex items-center gap-3 px-4 py-3 text-sm"
      style={{ color: P.text }}
    >
      <Icon size={18} style={{ color: P.muted }} />
      {label}
    </button>
  );
  return (
    <>
      <div
        className="hb-tabbar no-print sm:hidden fixed bottom-0 inset-x-0 flex border-t px-1"
        style={{
          backgroundColor: `${P.surface}D9`,
          borderColor: P.border,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {TAB_PAGES.map((p) => (
          <button
            key={p.key}
            onClick={() => {
              navigate(p.key);
              setMoreOpen(false);
            }}
            className="flex-1 flex flex-col items-center gap-1 pt-2 pb-2.5 text-[11px]"
            style={{ color: page === p.key ? P.blue : P.muted }}
            aria-current={page === p.key ? "page" : undefined}
          >
            {tab(page === p.key, p.icon, p.label)}
          </button>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex-1 flex flex-col items-center gap-1 pt-2 pb-2.5 text-[11px]"
          style={{ color: MORE_PAGES.some((p) => p.key === page) ? P.blue : P.muted }}
          aria-haspopup="true"
          aria-expanded={moreOpen}
        >
          {tab(MORE_PAGES.some((p) => p.key === page), Ellipsis, "Meer")}
        </button>
      </div>

      {moreOpen && (
        <div
          className="sm:hidden fixed inset-0 z-50 flex items-end"
          style={{ backgroundColor: "rgba(8,16,32,0.45)", backdropFilter: "blur(2px)" }}
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="hb-dialog w-full rounded-t-2xl border-t overflow-hidden"
            style={{
              backgroundColor: P.surface,
              borderColor: P.border,
              marginBottom: "calc(3.75rem + env(safe-area-inset-bottom))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: P.border }}>
              <span className="text-sm font-semibold" style={{ color: P.heading }}>
                Meer
              </span>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1.5 rounded hover:bg-black/5"
                style={{ color: P.muted }}
                aria-label="Sluiten"
              >
                <X size={16} />
              </button>
            </div>
            <div className="py-1">
              {MORE_PAGES.map((p) => (
                <button
                  key={p.key}
                  onClick={() => {
                    navigate(p.key);
                    setMoreOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm"
                  style={{
                    color: page === p.key ? P.blue : P.text,
                    backgroundColor: page === p.key ? P.paleBlue : "transparent",
                  }}
                >
                  <p.icon size={18} />
                  {p.label}
                </button>
              ))}
              <button
                onClick={privacy.toggleEnabled}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm border-t"
                style={{ color: P.text, borderColor: P.border }}
              >
                {privacy.enabled ? <Shield size={18} /> : <ShieldOff size={18} />}
                {privacyToggleLabel}
                <span className="ml-auto text-xs" style={{ color: P.muted }}>
                  bedragen vervagen
                </span>
              </button>
              <div className="border-t" style={{ borderColor: P.border }}>
                {sheetAction(backup.exportExcel, FileSpreadsheet, "Exporteren als Excel")}
                {sheetAction(backup.exportJson, Download, "Exporteren (JSON)")}
                {sheetAction(backup.triggerImport, Upload, "Importeren")}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
