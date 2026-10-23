// "Patroon" van een omschrijving: de woorden tot (niet inclusief) het eerste woord
// met 3+ cijfers. Referentienummers, betaalkenmerken en tijdstempels vallen zo weg.
// Levert niets op (omschrijving begint met zo'n woord), dan de volledige tekst.
export function patternRaw(description) {
  const text = String(description || "").trim();
  const words = [];
  for (const word of text.split(/\s+/)) {
    if ((word.match(/\d/g) || []).length >= 3) break;
    words.push(word);
  }
  return words.length ? words.join(" ") : text;
}

export function pattern(description) {
  return patternRaw(description).toLowerCase();
}

// Naam van de tegenpartij: de omschrijving tot " - " (zo zetten de banken naam en omschrijving
// achter elkaar), zonder kenmerken met cijfers en zonder losse leestekens aan het eind.
export function partyName(description) {
  return patternRaw(description)
    .split(" - ")[0]
    .replace(/(\s*[-,:;]|\.{2,})+$/, "")
    .trim();
}

// Abonnement-sleutel "omschrijving|centen" normaliseren naar "patroon|centen".
// Werkt ook voor oudere sleutels die nog de exacte omschrijving bevatten.
export function subscriptionKey(key) {
  const i = key.lastIndexOf("|");
  return i < 0 ? key : pattern(key.slice(0, i)) + "|" + key.slice(i + 1);
}

// patroon -> categorie, alleen als het patroon minstens 3x voorkwam en altijd
// dezelfde categorie kreeg. Verwachte (gegenereerde) rijen en nog niet gecontroleerde
// automatische toewijzingen tellen niet mee, zodat de app niet van zichzelf leert.
export function buildAutoCategoryModel(transactions, categories) {
  const stats = Object.create(null);
  transactions.forEach((t) => {
    if (!t.category || t.expected || t.autoCategorized) return;
    const p = pattern(t.description);
    if (!p) return;
    const s = stats[p] || (stats[p] = { category: t.category, count: 0, consistent: true });
    if (s.category !== t.category) s.consistent = false;
    s.count++;
  });
  const model = Object.create(null);
  for (const p in stats) {
    const s = stats[p];
    if (s.consistent && s.count >= 3 && (!categories || categories.includes(s.category))) model[p] = s.category;
  }
  return model;
}

// Eigen regel die bij de omschrijving past ("omschrijving bevat ..."); bij meerdere
// passende regels wint het langste (meest specifieke) trefwoord.
export function matchCategoryRule(description, rules, categories) {
  const text = String(description || "").toLowerCase();
  let best = null;
  for (const rule of rules || []) {
    const needle = (rule.contains || "").trim().toLowerCase();
    if (!needle || !text.includes(needle)) continue;
    if (categories && !categories.includes(rule.category)) continue;
    if (!best || needle.length > best.needle.length) best = { needle, category: rule.category };
  }
  return best ? best.category : null;
}

// Vult alleen lege categorieën in; overschrijft nooit. Eigen regels gaan voor het
// geleerde patroon. Toegewezen rijen krijgen `autoCategorized: tag`, zodat ze te
// herkennen, te filteren en per keer ongedaan te maken zijn.
export function applyAutoCategories(transactions, model, { rules = [], categories, tag = true } = {}) {
  let count = 0;
  let byRule = 0;
  const list = transactions.map((t) => {
    if (t.category) return t;
    const fromRule = matchCategoryRule(t.description, rules, categories);
    const category = fromRule || model[pattern(t.description)];
    if (!category) return t;
    count++;
    if (fromRule) byRule++;
    return { ...t, category, autoCategorized: tag };
  });
  return { list, count, byRule };
}

// Automatische toewijzing met een bepaald kenmerk terugdraaien (alleen waar die nog ongewijzigd is).
export function undoAutoCategories(transactions, tag) {
  return transactions.map((t) => {
    if (t.autoCategorized !== tag) return t;
    const { autoCategorized, ...rest } = t;
    return { ...rest, category: "" };
  });
}

// Het "auto"-label weghalen (goedgekeurd of handmatig aangepast).
export function clearAutoFlag(t) {
  if (!t.autoCategorized) return t;
  const { autoCategorized, ...rest } = t;
  return rest;
}

// Geïmporteerde rijen die het trefwoord van een actieve herhalende regel bevatten
// (en het juiste teken hebben) maar een ander bedrag. Per regel de meest recente.
export function findRuleMismatches(rows, rules) {
  const byRule = {};
  rules
    .filter((rule) => rule.active && (rule.keyword || "").trim())
    .forEach((rule) => {
      const keyword = rule.keyword.trim().toLowerCase();
      rows.forEach((row) => {
        if (!(row.description || "").toLowerCase().includes(keyword)) return;
        if (rule.type === "uitgave" ? row.amount >= 0 : row.amount <= 0) return;
        if (Math.round(Math.abs(row.amount) * 100) === Math.round(Math.abs(rule.amount) * 100)) return;
        const prev = byRule[rule.id];
        if (!prev || row.date > prev.date) {
          byRule[rule.id] = {
            ruleId: rule.id,
            keyword: rule.keyword,
            expected: Math.abs(rule.amount),
            actual: Math.abs(row.amount),
            date: row.date,
            txId: row.id,
          };
        }
      });
    });
  return Object.values(byRule);
}
