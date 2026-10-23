const normalize = (text) =>
  String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
const cents = (amount) => Math.round(amount * 100);

function shiftDay(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Splitst te importeren rijen in nieuwe rijen en rijen die al in het overzicht staan
// (zelfde omschrijving en bedrag, datum gelijk of 1 dag ernaast). Elke bestaande transactie
// telt maar één keer mee, zodat twee identieke betalingen op één dag allebei blijven kloppen.
// De ±1 dag vangt transacties op die vóór de datumcorrectie een dag te vroeg zijn opgeslagen.
// Verwachte (nog niet bevestigde) rijen doen niet mee: die worden bij het importeren vervangen.
export function splitDuplicates(existing, rows) {
  const pool = new Map();
  existing.forEach((t) => {
    if (t.expected || !/^\d{4}-\d{2}-\d{2}$/.test(t.date || "")) return;
    const key = `${t.date}|${cents(t.amount)}|${normalize(t.description)}`;
    pool.set(key, (pool.get(key) || 0) + 1);
  });
  const take = (key) => {
    const n = pool.get(key) || 0;
    if (n === 0) return false;
    pool.set(key, n - 1);
    return true;
  };

  const fresh = [];
  const duplicates = [];
  // Eerst exacte datums, daarna pas ±1 dag, zodat een exacte match nooit wordt "weggekaapt".
  const pending = rows.map((row) => ({ row, rest: `|${cents(row.amount)}|${normalize(row.description)}` }));
  const unmatched = pending.filter(({ row, rest }) => !take(row.date + rest));
  const matchedExact = new Set(pending.filter((p) => !unmatched.includes(p)));
  const matchedNear = new Set(
    unmatched.filter(({ row, rest }) => take(shiftDay(row.date, -1) + rest) || take(shiftDay(row.date, 1) + rest)),
  );
  pending.forEach((p) => (matchedExact.has(p) || matchedNear.has(p) ? duplicates : fresh).push(p.row));
  return { fresh, duplicates };
}
