import { describe, expect, it } from "vitest";
import { addExpectedTransactions, applyRuleAmountFix, mergeImportedRows, revertImport } from "./recurring";

const rule = { id: "r1", active: true, dayOfMonth: 25, keyword: "Huur", category: "Huur/Hypotheek", amount: 800, type: "uitgave" };
const NOW = new Date(2026, 9, 1); // 1 oktober 2026

describe("addExpectedTransactions (herhalende regels)", () => {
  it("maakt een verwachte rij per verstreken maand (laatste 24 maanden)", () => {
    const list = addExpectedTransactions([], [rule], NOW);
    // November 2024 t/m september 2026; 25 oktober 2026 is nog niet geweest.
    expect(list).toHaveLength(23);
    expect(list.every((t) => t.expected && t.ruleId === "r1" && t.amount === -800)).toBe(true);
    expect(list.map((t) => t.date).sort()[0]).toBe("2024-11-25");
    expect(list.map((t) => t.date).sort().at(-1)).toBe("2026-09-25");
  });

  it("slaat maanden over waarin al iets voor de regel staat", () => {
    const existing = [{ id: "x", date: "2026-09-24", ruleId: "r1", amount: -800, description: "Huur sept" }];
    expect(addExpectedTransactions(existing, [rule], NOW)).toHaveLength(23); // 1 bestaand + 22 nieuw
  });

  it("gebruikt de laatste dag van korte maanden", () => {
    const list = addExpectedTransactions([], [{ ...rule, dayOfMonth: 31 }], NOW);
    expect(list.some((t) => t.date === "2026-02-28")).toBe(true);
    expect(list.some((t) => t.date === "2026-04-30")).toBe(true);
  });

  it("doet niets voor inactieve regels en geeft dan dezelfde lijst terug", () => {
    const existing = [];
    expect(addExpectedTransactions(existing, [{ ...rule, active: false }], NOW)).toBe(existing);
  });

  it("maakt inkomsten positief", () => {
    const [t] = addExpectedTransactions([], [{ ...rule, type: "inkomst" }], new Date(2026, 8, 30));
    expect(t.amount).toBe(800);
  });
});

describe("mergeImportedRows", () => {
  const expected = { id: "e1", date: "2026-09-25", description: "Huur", amount: -800, category: "Huur/Hypotheek", expected: true, ruleId: "r1" };

  it("vervangt een verwachte rij door de echte betaling (binnen 5 dagen, zelfde bedrag)", () => {
    const row = { id: "n1", date: "2026-09-27", description: "HUUR WONING SEPT", amount: -800, category: "" };
    const list = mergeImportedRows([expected], [row]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: "e1", date: "2026-09-27", description: "HUUR WONING SEPT", expected: false, category: "Huur/Hypotheek" });
  });

  it("voegt de rij los toe als het bedrag of de datum niet past", () => {
    expect(mergeImportedRows([expected], [{ id: "n", date: "2026-09-27", description: "Huur", amount: -801 }])).toHaveLength(2);
    expect(mergeImportedRows([expected], [{ id: "n", date: "2026-10-05", description: "Huur", amount: -800 }])).toHaveLength(2);
  });
});

describe("revertImport (import ongedaan maken)", () => {
  it("haalt nieuwe rijen weg, zet vervangen rijen terug en laat latere wijzigingen staan", () => {
    const expected = { id: "e1", date: "2026-09-25", description: "Huur", amount: -800, category: "Huur", expected: true, ruleId: "r1" };
    const old = { id: "o1", date: "2026-09-01", description: "Oud", amount: -5, category: "" };
    const before = [expected, old];
    const rows = [
      { id: "n1", date: "2026-09-26", description: "HUUR SEPT", amount: -800, category: "" },
      { id: "n2", date: "2026-09-27", description: "Albert Heijn", amount: -20, category: "" },
    ];
    const after = mergeImportedRows(before, rows);
    expect(after).toHaveLength(3); // n1 vervangt de verwachte rij
    // Na de import zelf nog een categorie gegeven aan de oude transactie.
    const current = after.map((t) => (t.id === "o1" ? { ...t, category: "Uitgaan" } : t));
    const reverted = revertImport(current, before, after);
    expect(reverted.map((t) => t.id).sort()).toEqual(["e1", "o1"]);
    expect(reverted.find((t) => t.id === "e1")).toBe(expected);
    expect(reverted.find((t) => t.id === "o1").category).toBe("Uitgaan");
  });
});

describe("applyRuleAmountFix", () => {
  it("laat de geïmporteerde rij de maand overnemen en past de overige verwachte rijen aan", () => {
    const list = [
      { id: "e-sep", date: "2026-09-25", amount: -800, expected: true, ruleId: "r1" },
      { id: "e-aug", date: "2026-08-25", amount: -800, expected: true, ruleId: "r1" },
      { id: "real", date: "2026-09-26", amount: -825, description: "Huur" },
    ];
    const fixed = applyRuleAmountFix(list, { ruleId: "r1", actual: 825, date: "2026-09-26", txId: "real" });
    expect(fixed.map((t) => t.id)).toEqual(["e-aug", "real"]);
    expect(fixed[0].amount).toBe(-825);
    expect(fixed[1].ruleId).toBe("r1");
  });
});
