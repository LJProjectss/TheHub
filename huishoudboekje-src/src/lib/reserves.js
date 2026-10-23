// Potjes voor onregelmatige kosten (vakantie, jaarverzekeringen, auto...). Per categorie zet u
// elke maand een vast deel van het jaarbedrag opzij; wat in die categorie wordt uitgegeven gaat
// eraf. reserves[categorie] = { perYear, since: "YYYY-MM", start } met start = beginsaldo.
const round = (n) => Math.round(n * 100) / 100;

export const currentMonth = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

// Aantal maanden vanaf `since` tot en met de huidige maand (0 als het potje nog moet beginnen).
export function monthsSince(since, now = new Date()) {
  const [y, m] = String(since || "").split("-").map(Number);
  if (!y || !m) return 0;
  return Math.max(0, (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m) + 1);
}

export function reserveStatus(transactions, category, reserve, now = new Date()) {
  const perMonth = round((reserve.perYear || 0) / 12);
  const months = monthsSince(reserve.since, now);
  const reserved = round(months * ((reserve.perYear || 0) / 12) + (reserve.start || 0));
  const from = `${reserve.since}-01`;
  // Uitgaven min terugbetalingen in de categorie sinds de start; verwachte rijen tellen niet mee.
  const spent = round(
    transactions
      .filter((t) => !t.expected && t.category === category && t.date >= from)
      .reduce((s, t) => s - t.amount, 0),
  );
  return { perMonth, months, reserved, spent, balance: round(reserved - spent) };
}

export function reserveList(transactions, reserves, now = new Date()) {
  return Object.entries(reserves || {})
    .filter(([, r]) => r && r.perYear > 0 && r.since)
    .map(([category, r]) => ({ category, ...r, ...reserveStatus(transactions, category, r, now) }))
    .sort((a, b) => a.category.localeCompare(b.category, "nl"));
}
