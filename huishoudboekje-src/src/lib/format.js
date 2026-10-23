export const DEFAULT_CATEGORIES = [
  "Boodschappen",
  "Huur/Hypotheek",
  "Energie",
  "Water",
  "Internet & TV",
  "Telefoon",
  "Verzekeringen",
  "Zorgkosten",
  "Vervoer",
  "Abonnementen",
  "Uitgaan",
  "Kleding",
  "Cadeaus",
  "Vakantie",
  "Sparen",
  "Salaris",
  "Overige inkomsten",
];

export const UNCATEGORIZED = "Niet gecategoriseerd";

export const MONTHS = [
  "Januari",
  "Februari",
  "Maart",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Augustus",
  "September",
  "Oktober",
  "November",
  "December",
];

export const MONTHS_SHORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

export const sortNl = (list) => [...list].sort((a, b) => a.localeCompare(b, "nl", { sensitivity: "base" }));

export function formatEuro(value) {
  return (Number(value) || 0).toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
}

export function formatDate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Lokale kalenderdag als "YYYY-MM-DD" (niet toISOString: dat is UTC en verschuift NL-datums een dag).
export function toIsoDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
