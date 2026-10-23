import { describe, expect, it } from "vitest";
import {
  autoDistribute,
  averageMonthlySaving,
  categoryBalance,
  distributeRemainder,
  forecastGoal,
  monthsUntil,
  savingsCategoriesInUse,
  transactionBalance,
} from "./savings";

// Sparen staat op de betaalrekening als negatief bedrag (geld gaat eraf).
const save = (date, amount) => ({ id: date + amount, date, amount: -amount, category: "Sparen" });
const goal = (id, target, extra = {}) => ({ id, name: id, target, category: "Sparen", allocated: 0, ...extra });

describe("saldo van een spaarcategorie", () => {
  const list = [save("2026-07-01", 300), save("2026-08-01", 300), save("2026-08-15", -100)];

  it("telt stortingen op en trekt opnames af", () => {
    expect(transactionBalance(list, "Sparen")).toBe(500);
  });

  it("past de correctie uit de bankapp toe", () => {
    expect(categoryBalance(list, "Sparen", { Sparen: { adjustment: 1000 } })).toBe(1500);
  });
});

describe("autoDistribute", () => {
  const list = [save("2026-08-01", 250)];

  it("op volgorde van prioriteit", () => {
    const goals = [goal("A", 100), goal("B", 200)];
    const next = autoDistribute(goals, list, { Sparen: { mode: "priority" } });
    expect(next.map((g) => g.allocated)).toEqual([100, 150]);
  });

  it("naar verhouding van de doelbedragen, zonder centen te verliezen", () => {
    const goals = [goal("A", 100), goal("B", 300)];
    expect(autoDistribute(goals, [save("2026-08-01", 200)], { Sparen: { mode: "proportional" } }).map((g) => g.allocated)).toEqual([50, 150]);
    const three = [goal("A", 100), goal("B", 100), goal("C", 100)];
    const r = autoDistribute(three, [save("2026-08-01", 100)], { Sparen: { mode: "proportional" } });
    expect(r.reduce((s, g) => s + g.allocated, 0)).toBeCloseTo(100, 2);
  });

  it("vult alle doelen even snel en nooit boven het doelbedrag", () => {
    const goals = [goal("A", 50), goal("B", 1000)];
    const mode = { Sparen: { mode: "proportional" } };
    expect(autoDistribute(goals, [save("2026-08-01", 525)], mode).map((g) => g.allocated)).toEqual([25, 500]);
    expect(autoDistribute(goals, [save("2026-08-01", 2000)], mode).map((g) => g.allocated)).toEqual([50, 1000]);
  });

  it("verandert niets bij handmatige verdeling (zelfde array)", () => {
    const goals = [goal("A", 100)];
    expect(autoDistribute(goals, list, {})).toBe(goals);
  });
});

describe("distributeRemainder (handmatig)", () => {
  it("vult doelen op volgorde aan", () => {
    const goals = [goal("A", 100, { allocated: 40 }), goal("B", 200)];
    expect(distributeRemainder(goals, [save("2026-08-01", 250)], "Sparen", {}).map((g) => g.allocated)).toEqual([100, 150]);
  });

  it("verlaagt na een opname eerst het doel met de laagste prioriteit", () => {
    const goals = [goal("A", 100, { allocated: 100 }), goal("B", 200, { allocated: 100 })];
    expect(distributeRemainder(goals, [save("2026-08-01", 150)], "Sparen", {}).map((g) => g.allocated)).toEqual([100, 50]);
  });
});

describe("verwachtingen", () => {
  const now = new Date(2026, 9, 1);
  const list = [save("2026-07-05", 100), save("2026-08-05", 200), save("2026-09-05", 300)];

  it("averageMonthlySaving over de volledige maanden sinds de eerste storting", () => {
    expect(averageMonthlySaving(list, "Sparen", now)).toEqual({ average: 200, months: 3 });
  });

  it("forecastGoal geeft de maand waarin een doel bereikt wordt", () => {
    const goals = [goal("A", 1000, { allocated: 600 })];
    // Saldo 600 is helemaal toegewezen; nog 400 nodig bij 200 per maand = 2 maanden.
    expect(forecastGoal(goals[0], goals, list, {}, now)).toEqual({ month: "2026-12" });
    expect(forecastGoal(goal("B", 500, { allocated: 500 }), goals, list, {}, now)).toEqual({ reached: true });
  });

  it("monthsUntil telt de huidige maand mee", () => {
    expect(monthsUntil("2026-12", now)).toBe(3);
    expect(monthsUntil("onzin", now)).toBeNull();
  });

  it("savingsCategoriesInUse zet de standaardcategorie voorop", () => {
    expect(savingsCategoriesInUse([goal("A", 1, { category: "Buffer" })], "Sparen")).toEqual(["Sparen", "Buffer"]);
  });
});
