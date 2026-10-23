import { describe, expect, it } from "vitest";
import {
  budgetRows,
  categoryTrend,
  comparisonRange,
  forecastMonth,
  overviewSeries,
  spendingCategories,
  cumulativeExpenses,
  defaultPeriod,
  elapsedFraction,
  expenseCategories,
  monthsIn,
  periodRange,
  savedIn,
  shiftPeriod,
  summarize,
} from "./overview";

const t = (date, amount, category = "") => ({ id: `${date}${amount}${category}`, date, amount, category, description: "x" });

describe("perioden", () => {
  it("periodRange voor een maand, een jaar en een eigen periode", () => {
    expect(periodRange({ kind: "month", year: 2026, month: 1 })).toEqual({ from: "2026-02-01", to: "2026-02-28", label: "februari 2026" });
    expect(periodRange({ kind: "month", year: 2024, month: 1 }).to).toBe("2024-02-29");
    expect(periodRange({ kind: "year", year: 2025 })).toEqual({ from: "2025-01-01", to: "2025-12-31", label: "2025" });
    expect(periodRange({ kind: "custom", from: "2026-03-10", to: "2026-03-01" })).toMatchObject({ from: "2026-03-10", to: "2026-03-10" });
  });

  it("shiftPeriod gaat over de jaargrens heen", () => {
    expect(shiftPeriod({ kind: "month", year: 2026, month: 0 }, -1)).toMatchObject({ year: 2025, month: 11 });
    expect(shiftPeriod({ kind: "custom", from: "2026-09-01", to: "2026-09-10" }, 1)).toMatchObject({ from: "2026-09-11", to: "2026-09-20" });
  });

  it("comparisonRange vergelijkt een lopende maand met dezelfde dagen van de vorige maand", () => {
    expect(comparisonRange({ kind: "month", year: 2026, month: 8 }, "2026-09-15")).toMatchObject({ from: "2026-08-01", to: "2026-08-15" });
    expect(comparisonRange({ kind: "month", year: 2026, month: 7 }, "2026-09-15")).toMatchObject({ from: "2026-07-01", to: "2026-07-31" });
    // 31 maart vergelijken met februari: niet verder dan de laatste dag van februari.
    expect(comparisonRange({ kind: "month", year: 2026, month: 2 }, "2026-03-30").to).toBe("2026-02-28");
  });

  it("defaultPeriod: maand van de laatste transactie, vroeg in de maand de vorige", () => {
    const list = [t("2026-09-20", -5)];
    expect(defaultPeriod(list, new Date(2026, 8, 25))).toEqual({ kind: "month", year: 2026, month: 8 });
    expect(defaultPeriod([t("2026-10-02", -5)], new Date(2026, 9, 3))).toEqual({ kind: "month", year: 2026, month: 8 });
    expect(defaultPeriod([t("2026-01-02", -5)], new Date(2026, 0, 3))).toEqual({ kind: "month", year: 2025, month: 11 });
  });

  it("monthsIn en elapsedFraction rekenen op dagen", () => {
    expect(monthsIn({ from: "2026-09-01", to: "2026-09-30" })).toBe(1);
    expect(monthsIn({ from: "2026-09-01", to: "2026-09-15" })).toBe(0.5);
    expect(monthsIn({ from: "2026-01-01", to: "2026-12-31" })).toBeCloseTo(12);
    expect(elapsedFraction({ from: "2026-09-01", to: "2026-09-30" }, "2026-09-15")).toBe(0.5);
    expect(elapsedFraction({ from: "2026-09-01", to: "2026-09-30" }, "2026-10-01")).toBe(1);
    expect(elapsedFraction({ from: "2026-09-01", to: "2026-09-30" }, "2026-08-01")).toBe(0);
  });
});

describe("summarize", () => {
  const list = [
    t("2026-09-01", 2500, "Salaris"),
    t("2026-09-02", -100, "Boodschappen"),
    t("2026-09-03", -50, "Kleding"),
    t("2026-09-04", 20, "Kleding"), // retour
    t("2026-09-05", -300, "Sparen"),
    t("2026-08-31", -999, "Boodschappen"), // buiten de periode
  ];
  const opts = { excludedCategories: ["Sparen"], fixedCategories: ["Boodschappen"], expenseCats: expenseCategories(list) };
  const s = summarize(list, { from: "2026-09-01", to: "2026-09-30" }, opts);

  it("telt inkomsten, uitgaven en verrekent terugbetalingen", () => {
    expect(s.income).toBe(2500);
    expect(s.expenses).toBe(130);
    expect(s.refunds).toBe(20);
    expect(s.balance).toBe(2370);
  });

  it("laat categorieën met 'Niet als uitgave' helemaal weg", () => {
    expect(s.categories.map((c) => c.naam)).not.toContain("Sparen");
  });

  it("geeft uitgaven per categorie netto en gesorteerd, met vaste lasten apart opgeteld", () => {
    expect(s.categories).toEqual([
      { naam: "Boodschappen", bedrag: 100 },
      { naam: "Kleding", bedrag: 30 },
    ]);
    expect(s.fixed).toBe(100);
  });

  it("expenseCategories: alleen categorieën die per saldo uitgaven zijn", () => {
    expect([...expenseCategories(list)].sort()).toEqual(["Boodschappen", "Kleding", "Sparen"]);
  });
});

describe("budgetRows", () => {
  const summary = { categories: [{ naam: "Boodschappen", bedrag: 300 }] };

  it("vergelijkt uitgaven met het budget voor een afgesloten maand", () => {
    const b = budgetRows({ Boodschappen: 400, Kleding: 0 }, summary, { from: "2026-08-01", to: "2026-08-31" }, "2026-09-15");
    expect(b.rows).toHaveLength(1);
    expect(b.rows[0]).toMatchObject({ naam: "Boodschappen", budget: 400, besteed: 300, pct: 0.75, projected: null });
    expect(b.running).toBe(false);
  });

  it("rekent in een lopende maand alleen het verstreken deel en geeft een verwachting", () => {
    const b = budgetRows({ Boodschappen: 400 }, summary, { from: "2026-09-01", to: "2026-09-30" }, "2026-09-15");
    expect(b.running).toBe(true);
    expect(b.rows[0].budget).toBe(200);
    expect(b.rows[0].projected).toBe(600);
    expect(b.rows[0].projectedOver).toBe(200);
  });
});

describe("forecastMonth (verwachting eind van de maand)", () => {
  const opts = { excludedCategories: [], fixedCategories: ["Huur"], expenseCats: new Set(["Huur", "Boodschappen"]) };
  const history = [t("2026-06-25", 3000, "Salaris"), t("2026-07-25", 3000, "Salaris"), t("2026-08-25", 3000, "Salaris")];
  const period = { kind: "month", year: 2026, month: 8 };

  it("neemt het gemiddelde inkomen als het salaris nog niet binnen is en trekt variabele uitgaven door", () => {
    const cur = { income: 0, expenses: 1100, fixed: 800 };
    const f = forecastMonth(history, { period, cur, expectedSum: 50, fraction: 0.5, running: true }, opts);
    // Uitgaven: 1100 tot nu + 50 nog verwacht + 300 variabel nog eens = 1450.
    expect(f).toEqual({ income: 3000, expenses: 1450, balance: 1550, incomeAssumed: true });
  });

  it("geen verwachting buiten een lopende maand of in de eerste dagen", () => {
    const cur = { income: 0, expenses: 10, fixed: 0 };
    expect(forecastMonth(history, { period, cur, expectedSum: 0, fraction: 0.1, running: true }, opts)).toBeNull();
    expect(forecastMonth(history, { period, cur, expectedSum: 0, fraction: 0.5, running: false }, opts)).toBeNull();
  });
});

describe("grafiekreeksen", () => {
  const opts = { excludedCategories: [], fixedCategories: [], expenseCats: new Set(["A"]) };
  const list = [t("2026-08-10", 1000, "Salaris"), t("2026-08-12", -400, "A"), t("2026-09-05", -100, "A"), t("2025-09-05", -70, "A")];

  it("overviewSeries: 12 maanden met opgebouwd saldo en de uitgaven van een jaar eerder", () => {
    const period = { kind: "month", year: 2026, month: 8 };
    const rows = overviewSeries(list, period, periodRange(period), opts);
    expect(rows).toHaveLength(12);
    expect(rows.at(-2)).toMatchObject({ naam: "aug '26", Inkomsten: 1000, Uitgaven: 400, "Opgebouwd saldo": 600 });
    expect(rows.at(-1)).toMatchObject({ naam: "sep '26", Uitgaven: 100, "Opgebouwd saldo": 500, "Uitgaven jaar eerder": 70 });
  });

  it("spendingCategories en categoryTrend", () => {
    expect(spendingCategories([...list, t("2026-09-01", -5, "")])).toEqual(["A", "Niet gecategoriseerd"]);
    const trend = categoryTrend(list, "A");
    expect(trend[0]).toEqual({ label: "sep '25", Uitgaven: 70 });
    expect(trend.at(-1)).toEqual({ label: "sep '26", Uitgaven: 100 });
    expect(trend).toHaveLength(13);
    expect(categoryTrend(list, "")).toEqual([]);
  });
});

describe("cumulativeExpenses en savedIn", () => {
  const list = [t("2026-09-01", -10, "A"), t("2026-09-03", -5, "A"), t("2026-09-03", -100, "Sparen"), t("2026-09-04", 50, "Sparen")];

  it("telt uitgaven per dag op", () => {
    const opts = { excludedCategories: ["Sparen"], expenseCats: new Set(["A"]) };
    expect(cumulativeExpenses(list, { from: "2026-09-01", to: "2026-09-04" }, opts, true)).toEqual([10, 10, 15, 15]);
  });

  it("savedIn: netto naar de spaarcategorie", () => {
    expect(savedIn(list, { from: "2026-09-01", to: "2026-09-30" }, ["Sparen"])).toBe(50);
  });
});
