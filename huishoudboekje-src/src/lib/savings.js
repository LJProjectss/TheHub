// Spaardoelen rond één (of meer) spaarrekening(en), elk herkend aan een categorie.
//
// Saldo van een spaarcategorie = alles wat ernaartoe is overgeboekt minus wat terugkwam
// (in de betaalrekening-CSV staat sparen als negatief bedrag), plus een correctie die u
// instelt door het saldo uit uw bankapp in te vullen (startsaldo, rente).
//
// Instellingen per categorie (savingsSettings[categorie]):
//   mode:       "manual" | "priority" | "proportional"
//   adjustment: correctie t.o.v. de transacties
//   adjustedAt: wanneer het banksaldo voor het laatst is ingevuld

const round = (n) => Math.round(n * 100) / 100;
const monthIndex = (y, m) => y * 12 + m;

export const DISTRIBUTION_MODES = [
  { value: "manual", label: "Zelf verdelen" },
  { value: "priority", label: "Automatisch, op volgorde van prioriteit" },
  { value: "proportional", label: "Automatisch, naar verhouding van de doelbedragen" },
];

export const isActive = (goal) => goal.status !== "completed";
export const settingsFor = (settings, category) => ({ mode: "manual", adjustment: 0, ...(settings?.[category] || {}) });

// Saldo op basis van alleen de transacties.
export function transactionBalance(transactions, category) {
  if (!category) return 0;
  return round(transactions.filter((t) => t.category === category).reduce((s, t) => s - t.amount, 0));
}

export function categoryBalance(transactions, category, settings) {
  if (!category) return 0;
  return round(transactionBalance(transactions, category) + (settingsFor(settings, category).adjustment || 0));
}

// Actieve doelen van een categorie, in volgorde van prioriteit (= volgorde in de lijst).
export const goalsIn = (goals, category) => goals.filter((g) => isActive(g) && g.category && g.category === category);

export const allocatedIn = (goals, category) =>
  round(goalsIn(goals, category).reduce((s, g) => s + (g.allocated || 0), 0));

// Categorieën die door actieve doelen worden gebruikt, met de standaard-spaarcategorie voorop.
export function savingsCategoriesInUse(goals, defaultCategory) {
  const used = [
    ...new Set(
      goals
        .filter(isActive)
        .map((g) => g.category)
        .filter(Boolean),
    ),
  ];
  if (defaultCategory && !used.includes(defaultCategory)) used.unshift(defaultCategory);
  return defaultCategory ? [defaultCategory, ...used.filter((c) => c !== defaultCategory)] : used;
}

// Toewijzingen die bij een automatische modus horen, volledig opnieuw berekend uit het saldo
// (zo kloppen ze ook na een opname). Nooit meer dan het doelbedrag per doel.
function computeAllocations(goals, balance, mode) {
  const result = new Map(goals.map((g) => [g.id, 0]));
  let left = Math.max(0, balance);
  if (mode === "priority") {
    for (const g of goals) {
      const give = Math.min(Math.max(0, g.target || 0), left);
      result.set(g.id, round(give));
      left = round(left - give);
    }
  } else if (mode === "proportional") {
    // Waterniveau: verdeel naar verhouding van het doelbedrag; wat een vol doel niet nodig
    // heeft, gaat naar verhouding naar de rest.
    let open = goals.filter((g) => (g.target || 0) > 0);
    while (open.length > 0 && left > 0.004) {
      const totalTarget = open.reduce((s, g) => s + g.target, 0);
      const nextOpen = [];
      let spent = 0;
      for (const g of open) {
        const room = g.target - result.get(g.id);
        const share = (left * g.target) / totalTarget;
        const give = Math.min(room, share);
        result.set(g.id, result.get(g.id) + give);
        spent += give;
        if (room - give > 0.004) nextOpen.push(g);
      }
      left -= spent;
      if (nextOpen.length === open.length) break;
      open = nextOpen;
    }
    // Afronden op centen zonder meer te verdelen dan er is; de restcenten gaan naar het
    // eerste doel met ruimte, zodat er geen "€ 0,02 nog te verdelen" blijft staan.
    for (const g of goals) result.set(g.id, Math.floor(result.get(g.id) * 100 + 1e-6) / 100);
    let cents = Math.round(
      (Math.min(
        Math.max(0, balance),
        goals.reduce((s, g) => s + Math.max(0, g.target || 0), 0),
      ) -
        goals.reduce((s, g) => s + result.get(g.id), 0)) *
        100,
    );
    for (const g of goals) {
      if (cents <= 0) break;
      const room = Math.round(((g.target || 0) - result.get(g.id)) * 100);
      const give = Math.min(room, cents);
      if (give > 0) {
        result.set(g.id, round(result.get(g.id) + give / 100));
        cents -= give;
      }
    }
  }
  return result;
}

// Past de automatische modi toe. Geeft dezelfde array terug als er niets verandert.
export function autoDistribute(goals, transactions, settings) {
  let changed = false;
  const next = goals.map((g) => ({ ...g }));
  const categories = [
    ...new Set(
      next
        .filter(isActive)
        .map((g) => g.category)
        .filter(Boolean),
    ),
  ];
  for (const category of categories) {
    const { mode } = settingsFor(settings, category);
    if (mode === "manual") continue;
    const inCat = goalsIn(next, category);
    const alloc = computeAllocations(inCat, categoryBalance(transactions, category, settings), mode);
    for (const g of inCat) {
      if (Math.abs((g.allocated || 0) - alloc.get(g.id)) > 0.004) {
        g.allocated = alloc.get(g.id);
        changed = true;
      }
    }
  }
  return changed ? next : goals;
}

// Handmatige modus: het nog vrije bedrag (positief of negatief) in één keer verwerken.
// Positief: doelen op volgorde aanvullen tot hun doelbedrag. Negatief (bv. na een opname):
// toewijzingen verlagen, te beginnen bij het doel met de laagste prioriteit.
export function distributeRemainder(goals, transactions, category, settings) {
  const free = round(categoryBalance(transactions, category, settings) - allocatedIn(goals, category));
  const ids = goalsIn(goals, category).map((g) => g.id);
  const next = goals.map((g) => ({ ...g }));
  const byId = new Map(next.map((g) => [g.id, g]));
  let left = Math.abs(free);
  const order = free > 0 ? ids : [...ids].reverse();
  for (const id of order) {
    if (left <= 0.004) break;
    const g = byId.get(id);
    const current = g.allocated || 0;
    const delta = free > 0 ? Math.min(Math.max(0, (g.target || 0) - current), left) : Math.min(current, left);
    g.allocated = round(free > 0 ? current + delta : current - delta);
    left = round(left - delta);
  }
  return next;
}

// Netto inleg per maand in een categorie.
function netByMonth(transactions, category) {
  const map = new Map();
  transactions
    .filter((t) => t.category === category && /^\d{4}-\d{2}/.test(t.date || ""))
    .forEach((t) => {
      const key = t.date.slice(0, 7);
      map.set(key, (map.get(key) || 0) - t.amount);
    });
  return map;
}
const keyOf = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;

// Gemiddelde maandelijkse inleg over de laatste (maximaal) 6 volledige maanden,
// gerekend vanaf de eerste maand met een spaartransactie.
export function averageMonthlySaving(transactions, category, now = new Date(), months = 6) {
  const net = netByMonth(transactions, category);
  if (net.size === 0) return { average: 0, months: 0 };
  const first = [...net.keys()].sort()[0];
  const [fy, fm] = first.split("-").map(Number);
  const firstIdx = monthIndex(fy, fm - 1);
  const lastIdx = monthIndex(now.getFullYear(), now.getMonth()) - 1; // vorige maand
  const count = Math.min(months, lastIdx - firstIdx + 1);
  if (count <= 0) return { average: 0, months: 0 };
  let sum = 0;
  for (let i = lastIdx - count + 1; i <= lastIdx; i++) sum += net.get(keyOf(Math.floor(i / 12), i % 12)) || 0;
  return { average: round(sum / count), months: count };
}

// Saldo aan het eind van elke maand plus de inleg in die maand (laatste 12 maanden).
export function balanceHistory(transactions, category, settings, now = new Date(), months = 12) {
  const net = netByMonth(transactions, category);
  const nowIdx = monthIndex(now.getFullYear(), now.getMonth());
  let balance = categoryBalance(transactions, category, settings);
  // Alles na de huidige maand (bv. al geboekte toekomstige transacties) eraf halen.
  for (const [key, value] of net) {
    const [y, m] = key.split("-").map(Number);
    if (monthIndex(y, m - 1) > nowIdx) balance -= value;
  }
  const rows = [];
  for (let i = nowIdx; i > nowIdx - months; i--) {
    const key = keyOf(Math.floor(i / 12), i % 12);
    const inleg = round(net.get(key) || 0);
    rows.unshift({ key, Saldo: round(balance), Inleg: inleg });
    balance -= inleg;
  }
  return rows;
}

// Maanden van nu (deze maand meegeteld als 1) tot en met de streefmaand "YYYY-MM".
export function monthsUntil(targetMonth, now = new Date()) {
  if (!/^\d{4}-\d{2}$/.test(targetMonth || "")) return null;
  const [y, m] = targetMonth.split("-").map(Number);
  return monthIndex(y, m - 1) - monthIndex(now.getFullYear(), now.getMonth()) + 1;
}

export function addMonths(now, n) {
  const d = new Date(now.getFullYear(), now.getMonth() + n, 1);
  return keyOf(d.getFullYear(), d.getMonth());
}

// Wanneer is een doel naar verwachting bereikt bij de gemiddelde inleg?
// Uitgangspunt: nieuw spaargeld gaat op volgorde van prioriteit naar de doelen
// (bij "naar verhouding" bereiken alle doelen hun bedrag tegelijk).
// Geeft { month: "YYYY-MM" } of { reached: true } of null (geen voorspelling mogelijk).
export function forecastGoal(goal, goals, transactions, settings, now = new Date()) {
  if (!goal.category || !(goal.target > 0)) return null;
  if ((goal.allocated || 0) >= goal.target) return { reached: true };
  const { mode } = settingsFor(settings, goal.category);
  const { average } = averageMonthlySaving(transactions, goal.category, now);
  const inCat = goalsIn(goals, goal.category);
  const balance = categoryBalance(transactions, goal.category, settings);
  let neededTotal;
  if (mode === "proportional") {
    neededTotal = inCat.reduce((s, g) => s + (g.target || 0), 0) - balance;
  } else if (mode === "priority") {
    const upTo = inCat.slice(0, inCat.findIndex((g) => g.id === goal.id) + 1);
    neededTotal = upTo.reduce((s, g) => s + (g.target || 0), 0) - balance;
  } else {
    const free = Math.max(0, balance - allocatedIn(goals, goal.category));
    const upTo = inCat.slice(0, inCat.findIndex((g) => g.id === goal.id) + 1);
    neededTotal = upTo.reduce((s, g) => s + Math.max(0, (g.target || 0) - (g.allocated || 0)), 0) - free;
  }
  if (neededTotal <= 0.004) return { reachable: true };
  if (average <= 0) return null;
  return { month: addMonths(now, Math.ceil(neededTotal / average)) };
}
