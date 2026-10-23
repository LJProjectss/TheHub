import { describe, expect, it } from "vitest";
import { buildPresets, categoryMonthsComparison, compareCategories, cumulativeComparison, monthByMonthComparison, rangeOf } from "./comparison";

const t = (date, amount, category) => ({ id: date + amount + category, date, amount, category, description: "x" });
const opts = { excludedCategories: [], fixedCategories: [], expenseCats: new Set(["A", "B"]) };

describe("Vergelijken", () => {
  it("buildPresets gaat uit van de laatste maand met gegevens", () => {
    const presets = buildPresets([t("2026-08-20", -10, "A")], new Date(2026, 8, 15));
    expect(presets.map((p) => p.key)).toEqual(["prev-month", "month-last-year", "ytd", "last-year"]);
    expect(rangeOf(presets[0].a)).toMatchObject({ from: "2026-08-01", to: "2026-08-31" });
    expect(rangeOf(presets[0].b)).toMatchObject({ from: "2026-07-01" });
    expect(rangeOf(presets[1].b)).toMatchObject({ from: "2025-08-01" });
    expect(rangeOf(presets[2].b).label).toBe("zelfde periode 2025");
  });

  it("compareCategories: verschil, nieuw en verdwenen, grootste verschil eerst, met schaal", () => {
    const rows = compareCategories(
      [{ naam: "A", bedrag: 100 }, { naam: "Nieuw", bedrag: 30 }],
      [{ naam: "A", bedrag: 40 }, { naam: "Weg", bedrag: 50 }],
    );
    expect(rows).toEqual([
      { naam: "A", a: 100, b: 40, diff: 60, status: null },
      { naam: "Weg", a: 0, b: 50, diff: -50, status: "verdwenen" },
      { naam: "Nieuw", a: 30, b: 0, diff: 30, status: "nieuw" },
    ]);
    expect(compareCategories([{ naam: "A", bedrag: 120 }], [{ naam: "A", bedrag: 30 }], 1 / 12, 1)[0]).toMatchObject({ a: 10, b: 30 });
  });

  it("cumulativeComparison per dag; A stopt bij vandaag", () => {
    const list = [t("2026-09-01", -10, "A"), t("2026-09-03", -5, "A"), t("2026-08-02", -7, "A")];
    const ranges = {
      rangeA: { from: "2026-09-01", to: "2026-09-04" },
      effectiveA: { from: "2026-09-01", to: "2026-09-02" },
      rawB: { from: "2026-08-01", to: "2026-08-04" },
    };
    expect(cumulativeComparison(list, ranges, opts, true)).toEqual([
      { x: "dag 1", A: 10, B: 0 },
      { x: "dag 2", A: 10, B: 7 },
      { x: "dag 3", A: null, B: 7 },
      { x: "dag 4", A: null, B: 7 },
    ]);
  });

  it("monthByMonthComparison en categoryMonthsComparison", () => {
    const list = [t("2026-01-10", -100, "A"), t("2026-02-10", -50, "A"), t("2025-01-10", -80, "A")];
    const ranges = {
      rangeA: { from: "2026-01-01", to: "2026-02-28" },
      effectiveA: { from: "2026-01-01", to: "2026-02-28" },
      rawB: { from: "2025-01-01", to: "2025-02-28" },
    };
    expect(monthByMonthComparison(list, ranges, opts)).toEqual([
      { x: "jan", A: 100, B: 80 },
      { x: "feb", A: 50, B: 0 },
    ]);
    const months = categoryMonthsComparison(list, "A", ranges, opts);
    expect(months[0]).toEqual({ x: "jan '25", bedrag: 80, in: "B" });
    expect(months.at(-1)).toEqual({ x: "feb '26", bedrag: 50, in: "A" });
    expect(months).toHaveLength(14);
  });
});
