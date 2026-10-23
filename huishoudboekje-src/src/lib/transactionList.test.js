import { describe, expect, it } from "vitest";
import {
  DEFAULT_SORT,
  EMPTY_FILTERS,
  filterTransactions,
  groupByMonth,
  matchesSearch,
  periodPresets,
  searchAmount,
  sumTotals,
} from "./transactionList";

describe("filterTransactions", () => {
  const list = [
    { id: "a", date: "2026-09-01", description: "Albert Heijn", amount: -20, category: "Boodschappen", tags: ["Feest"] },
    { id: "b", date: "2026-09-03", description: "Salaris", amount: 2500, category: "Salaris", account: "NL1" },
    { id: "c", date: "2026-08-15", description: "Bol.com", amount: -150, category: "" },
    { id: "d", date: "2026-09-02", description: "Huur", amount: -800, category: "Huur", expected: true },
    { id: "e", date: "2026-09-02", description: "Jumbo", amount: -20, category: "Boodschappen", autoCategorized: "T" },
  ];
  const run = (changes = {}, sort = DEFAULT_SORT, groups = {}) =>
    filterTransactions(list, { ...EMPTY_FILTERS, ...changes }, sort, groups).map((t) => t.id);

  it("zonder filters alles, nieuwste eerst", () => {
    expect(run()).toEqual(["b", "d", "e", "a", "c"]);
  });

  it("filtert op categorie, groep, 'niet gecategoriseerd', label en rekening", () => {
    expect(run({ category: "Boodschappen" })).toEqual(["e", "a"]);
    expect(run({ category: "Groep: Wonen" }, DEFAULT_SORT, { Huur: "Wonen" })).toEqual(["d"]);
    expect(run({ category: "Niet gecategoriseerd" })).toEqual(["c"]);
    expect(run({ tag: "feest" })).toEqual(["a"]);
    expect(run({ account: "NL1" })).toEqual(["b"]);
  });

  it("filtert op periode, soort, bedrag, zoekterm en status", () => {
    expect(run({ dateFrom: "2026-09-01", dateTo: "2026-09-02" })).toEqual(["d", "e", "a"]);
    expect(run({ type: "inkomst" })).toEqual(["b"]);
    expect(run({ amountMin: "100", amountMax: "1000" })).toEqual(["d", "c"]);
    expect(run({ search: "heijn" })).toEqual(["a"]);
    expect(run({ onlyExpected: true })).toEqual(["d"]);
    expect(run({ onlyAuto: true })).toEqual(["e"]);
  });

  it("sorteert op bedrag en omschrijving; bij gelijke waarde de nieuwste eerst", () => {
    expect(run({}, { key: "amount", dir: "asc" })).toEqual(["d", "c", "e", "a", "b"]);
    expect(run({}, { key: "description", dir: "asc" })).toEqual(["a", "c", "d", "e", "b"]);
  });
});

describe("zoeken", () => {
  it("searchAmount herkent bedragen", () => {
    expect(searchAmount("12,50")).toEqual({ cents: 1250 });
    expect(searchAmount("12.5")).toEqual({ cents: 1250 });
    expect(searchAmount("€ 12")).toEqual({ euros: 12 });
    expect(searchAmount("1.250")).toEqual({ euros: 1250 });
    expect(searchAmount("1.250,75")).toEqual({ cents: 125075 });
    expect(searchAmount("albert")).toBeNull();
  });

  it("matchesSearch zoekt in omschrijving, notitie, categorie, labels en bedrag", () => {
    const t = { description: "Albert Heijn", note: "voor feestje", category: "Boodschappen", tags: ["Vakantie 2026"], amount: -12.5 };
    const find = (q) => matchesSearch(t, q, searchAmount(q));
    expect(find("heijn")).toBe(true);
    expect(find("feest")).toBe(true);
    expect(find("boodsch")).toBe(true);
    expect(find("vakantie")).toBe(true);
    expect(find("12,50")).toBe(true);
    expect(find("12")).toBe(true);
    expect(find("12,51")).toBe(false);
    expect(find("jumbo")).toBe(false);
  });
});

describe("totalen en maanden", () => {
  const list = [
    { date: "2026-09-20", amount: 1000 },
    { date: "2026-09-10", amount: -250.1 },
    { date: "2026-09-05", amount: -800, expected: true },
    { date: "2026-08-30", amount: -49.9 },
  ];

  it("sumTotals laat verwachte rijen weg", () => {
    expect(sumTotals(list)).toEqual({ income: 1000, expense: -300, balance: 700, expected: 1 });
  });

  it("groupByMonth maakt een groep per maand met eigen totalen", () => {
    const groups = groupByMonth(list);
    expect(groups.map((g) => [g.label, g.items.length, g.totals.balance])).toEqual([
      ["September 2026", 3, 749.9],
      ["Augustus 2026", 1, -49.9],
    ]);
  });

  it("periodPresets rond de jaargrens", () => {
    const [deze, vorige, drie, ditJaar, vorigJaar] = periodPresets(new Date(2026, 0, 15));
    expect(deze).toMatchObject({ from: "2026-01-01", to: "2026-01-31" });
    expect(vorige).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
    expect(drie).toMatchObject({ from: "2025-11-01", to: "2026-01-31" });
    expect(ditJaar).toMatchObject({ from: "2026-01-01", to: "2026-12-31" });
    expect(vorigJaar).toMatchObject({ from: "2025-01-01", to: "2025-12-31" });
  });
});
