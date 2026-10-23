import { describe, expect, it } from "vitest";
import { FIELDS, dataPayload, mergeBackup, normalizeBackup } from "./backup";

describe("normalizeBackup", () => {
  it("weigert iets wat geen back-up is", () => {
    expect(normalizeBackup(null)).toBeNull();
    expect(normalizeBackup({ foo: 1 })).toBeNull();
  });

  it("vult ontbrekende onderdelen aan, ook die van nieuwere versies", () => {
    const b = normalizeBackup({ transactions: [] });
    expect(b.categories.length).toBeGreaterThan(5);
    expect(b).toMatchObject({ budgets: {}, accounts: [], categoryGroups: {}, reserves: {}, savingsCategory: "" });
    for (const [key] of FIELDS) expect(b).toHaveProperty(key);
  });

  it("dataPayload bevat precies alle velden", () => {
    const data = Object.fromEntries(FIELDS.map(([key]) => [key, key]));
    expect(Object.keys(dataPayload({ ...data, extra: 1 }))).toEqual(FIELDS.map(([key]) => key));
  });
});

describe("mergeBackup", () => {
  const current = normalizeBackup({
    categories: ["A"],
    transactions: [{ id: "1", date: "2026-09-01", amount: -10, description: "Winkel" }],
    accounts: [{ iban: "X1", name: "Een" }],
    categoryGroups: { A: "G" },
    budgets: { A: 100 },
  });

  it("voegt nieuwe transacties toe zonder dubbele (zelfde id of zelfde inhoud)", () => {
    const backup = normalizeBackup({
      transactions: [
        { id: "1", date: "2026-09-01", amount: -10, description: "Winkel" },
        { id: "anders", date: "2026-09-01", amount: -10, description: "winkel" },
        { id: "2", date: "2026-09-02", amount: -20, description: "Nieuw" },
      ],
    });
    const { next, summary } = mergeBackup(current, backup);
    expect(next.transactions.map((t) => t.id).sort()).toEqual(["1", "2"]);
    expect(summary).toMatchObject({ transactionsAdded: 1, transactionsSkipped: 2 });
  });

  it("combineert instellingen; bij een conflict wint de huidige waarde", () => {
    const backup = normalizeBackup({
      transactions: [],
      categories: ["B"],
      accounts: [{ iban: "X1", name: "Ander" }, { iban: "X2", name: "Twee" }],
      reserves: { B: { perYear: 1, since: "2026-01" } },
      budgets: { A: 999, B: 50 },
    });
    const { next } = mergeBackup(current, backup);
    expect(next.categories).toEqual(["A", "B"]);
    expect(next.accounts.map((a) => a.name)).toEqual(["Een", "Twee"]);
    expect(next.budgets).toEqual({ A: 100, B: 50 });
    expect(next.categoryGroups).toEqual({ A: "G" });
    expect(next.reserves).toHaveProperty("B");
  });

  it("koppelt verwachte rijen aan een bestaande regel met dezelfde inhoud", () => {
    const cur = normalizeBackup({ transactions: [], recurringRules: [{ id: "mine", keyword: "Huur", amount: 800, dayOfMonth: 1, type: "uitgave" }] });
    const backup = normalizeBackup({
      recurringRules: [{ id: "theirs", keyword: "huur", amount: 800, dayOfMonth: 1, type: "uitgave" }],
      transactions: [{ id: "e", date: "2026-09-01", amount: -800, description: "Huur", expected: true, ruleId: "theirs" }],
    });
    const { next, summary } = mergeBackup(cur, backup);
    expect(next.recurringRules).toHaveLength(1);
    expect(next.transactions[0].ruleId).toBe("mine");
    expect(summary.rulesAdded).toBe(0);
  });
});
