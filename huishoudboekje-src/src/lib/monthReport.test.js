import { describe, expect, it } from "vitest";
import { monthReport, reportMonths } from "./monthReport";

const t = (date, amount, category = "", extra = {}) => ({ id: `${date}${amount}${category}`, date, amount, category, description: category || "x", ...extra });

const data = {
  transactions: [
    t("2026-09-25", 2500, "Salaris"),
    t("2026-09-10", -300, "Boodschappen"),
    t("2026-10-25", 2500, "Salaris"),
    t("2026-10-02", -350, "Boodschappen"),
    t("2026-10-03", -80, "Uit eten"),
    t("2026-10-04", -500, "Sparen"),
    t("2026-10-05", -20),
    t("2026-10-28", -999, "Boodschappen", { expected: true }),
  ],
  budgets: { Boodschappen: 400, Kleding: 100 },
  excludedCategories: ["Sparen"],
  savingsCategory: "Sparen",
};

describe("monthReport", () => {
  const r = monthReport(data, 2026, 9);

  it("telt de maand zonder verwachte transacties en zet de vorige maand ernaast", () => {
    expect(r.totals).toMatchObject({ income: 2500, expenses: 450, balance: 2050, saved: 500 });
    expect(r.previous).toMatchObject({ income: 2500, expenses: 300 });
    expect(r.categories[0]).toMatchObject({ naam: "Boodschappen", bedrag: 350, vorige: 300, verschil: 50, budget: 400 });
  });

  it("toont alle budgetten, ook zonder uitgaven", () => {
    expect(r.budgetRows.map((b) => b.naam)).toEqual(["Boodschappen", "Kleding"]);
    expect(r.budgetTotal).toEqual({ budget: 500, bedrag: 350 });
  });

  it("grootste uitgaven zonder uitgesloten categorieën, en telt wat geen categorie heeft", () => {
    expect(r.largest.map((x) => x.amount)).toEqual([-350, -80, -20]);
    expect(r.uncategorized).toBe(1);
  });

  it("geeft de maanden met transacties, nieuwste eerst", () => {
    expect(reportMonths(data.transactions)).toEqual([
      { year: 2026, month: 9 },
      { year: 2026, month: 8 },
    ]);
  });
});
