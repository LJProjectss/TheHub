import { describe, expect, it } from "vitest";
import { budgetAlerts } from "./budgetAlerts";

const t = (date, amount, category, extra = {}) => ({ id: `${date}${amount}${category}`, date, amount, category, ...extra });

describe("budgetAlerts", () => {
  const budgets = { Boodschappen: 400, Uit: 100, Kleding: 200 };
  const transactions = [
    t("2026-10-03", -250, "Boodschappen"),
    t("2026-10-12", -90, "Boodschappen"),
    t("2026-10-05", -120, "Uit"),
    t("2026-10-06", -100, "Kleding"),
    t("2026-09-28", -300, "Kleding"),
    t("2026-10-25", -500, "Kleding", { expected: true }),
  ];

  it("meldt budgetten vanaf 80% in de lopende maand, hoogste eerst", () => {
    const r = budgetAlerts({ transactions, budgets }, "2026-10-15");
    expect(r.map((x) => x.naam)).toEqual(["Uit", "Boodschappen"]);
    expect(r[1].pct).toBeCloseTo(0.85);
    expect(r[0].daysLeft).toBe(16);
    expect(r[0].month).toBe("2026-10");
  });

  it("telt terugbetalingen mee en negeert verwachte transacties", () => {
    const r = budgetAlerts(
      { transactions: [...transactions, t("2026-10-13", 50, "Boodschappen")], budgets },
      "2026-10-15",
    );
    expect(r.map((x) => x.naam)).toEqual(["Uit"]);
  });

  it("niets zonder budgetten", () => {
    expect(budgetAlerts({ transactions, budgets: {} }, "2026-10-15")).toEqual([]);
  });
});
