// De pagina's van de app: lijst voor de navigatie en het uitgesteld laden van elke pagina.
import { lazy } from "react";
import {
  CalendarRange,
  FileText,
  GitCompare,
  LayoutDashboard,
  List,
  PiggyBank,
  RadioTower,
  Settings as SettingsIcon,
  Tag,
} from "lucide-react";
import { P } from "../theme";

export const PAGES = [
  { key: "dashboard", label: "Overzicht", icon: LayoutDashboard },
  { key: "transactions", label: "Transacties", icon: List },
  { key: "categories", label: "Categorieën", icon: Tag },
  { key: "savings", label: "Spaardoelen", icon: PiggyBank },
  { key: "comparison", label: "Vergelijken", icon: GitCompare },
  { key: "subscriptions", label: "Abonnementen", icon: RadioTower },
  { key: "monthreport", label: "Maandrapport", icon: FileText },
  { key: "year", label: "Jaaroverzicht", icon: CalendarRange },
  { key: "settings", label: "Instellingen", icon: SettingsIcon },
];
// Op de telefoon: de eerste drie in de tabbalk, de rest onder "Meer".
export const TAB_PAGES = PAGES.slice(0, 3);
export const MORE_PAGES = PAGES.slice(3);

export const SIDEBAR_TEXT = "#B7C4DB";

// Pagina's en het importvenster pas laden als ze nodig zijn: de app start zo sneller.
// Offline werkt alles nog, want de service worker bewaart alle onderdelen vooraf.
// Lukt het laden niet (bv. een oud venster na een update, waarvan het bestand niet meer bestaat),
// dan één keer de app herladen in plaats van een leeg scherm te tonen.
const RELOAD_KEY = "huishoudboekje-chunk-reload";
const lazyPage = (load) =>
  lazy(() =>
    load().then(
      (mod) => {
        sessionStorage.removeItem(RELOAD_KEY);
        return mod;
      },
      (err) => {
        if (!sessionStorage.getItem(RELOAD_KEY)) {
          sessionStorage.setItem(RELOAD_KEY, "1");
          window.location.reload();
          return new Promise(() => {});
        }
        throw err;
      },
    ),
  );
export const Dashboard = lazyPage(() => import("../pages/Dashboard"));
export const Transactions = lazyPage(() => import("../pages/Transactions"));
export const Categories = lazyPage(() => import("../pages/Categories"));
export const Savings = lazyPage(() => import("../pages/Savings"));
export const Comparison = lazyPage(() => import("../pages/Comparison"));
export const Subscriptions = lazyPage(() => import("../pages/Subscriptions"));
export const YearReport = lazyPage(() => import("../pages/YearReport"));
export const MonthReport = lazyPage(() => import("../pages/MonthReport"));
export const Settings = lazyPage(() => import("../pages/Settings"));
export const ImportDialog = lazyPage(() => import("../components/ImportDialog"));

export function PageLoading() {
  return (
    <div className="py-24 text-center text-sm" style={{ color: P.muted }}>
      Laden...
    </div>
  );
}
