import { describe, expect, it, vi } from "vitest";
import { applyChanges, deleteCategory, deleteImpact, groupCategoryTotals, groupNames, renameCategory, snapshotFor } from "./categories";
import { FIELDS } from "./backup";

const base = () => ({
  categories: ["Boodschappen", "Supermarkt", "Vakantie"],
  transactions: [
    { id: "1", category: "Supermarkt", amount: -10 },
    { id: "2", category: "Boodschappen", amount: -20 },
    { id: "3", category: "Vakantie", amount: -30 },
  ],
  budgets: { Supermarkt: 100, Boodschappen: 200 },
  fixedCategories: ["Supermarkt"],
  excludedCategories: [],
  categoryRules: [{ id: "r", contains: "AH", category: "Supermarkt" }],
  recurringRules: [{ id: "rr", category: "Supermarkt" }],
  savingsGoals: [{ id: "g", category: "Vakantie" }],
  savingsCategory: "",
  savingsSettings: { Vakantie: { mode: "manual" } },
  categoryGroups: { Supermarkt: "Dagelijks" },
  reserves: { Vakantie: { perYear: 1200, since: "2026-01", start: 0 }, Supermarkt: { perYear: 120, since: "2025-06", start: 10 }, Boodschappen: { perYear: 240, since: "2026-03", start: 5 } },
});

describe("renameCategory", () => {
  it("hernoemt op alle plekken", () => {
    const r = renameCategory(base(), "Vakantie", "Reizen");
    expect(r.categories).toEqual(["Boodschappen", "Reizen", "Supermarkt"]);
    expect(r.transactions[2].category).toBe("Reizen");
    expect(r.savingsGoals[0].category).toBe("Reizen");
    expect(Object.keys(r.savingsSettings)).toEqual(["Reizen"]);
    expect(r.reserves.Reizen.perYear).toBe(1200);
    expect(r.reserves).not.toHaveProperty("Vakantie");
  });

  it("neemt groep, vaste last, regels en herhalende regels mee", () => {
    const r = renameCategory(base(), "Supermarkt", "Winkel");
    expect(r.categoryGroups).toEqual({ Winkel: "Dagelijks" });
    expect(r.fixedCategories).toEqual(["Winkel"]);
    expect(r.categoryRules[0].category).toBe("Winkel");
    expect(r.recurringRules[0].category).toBe("Winkel");
  });

  it("voegt samen als de nieuwe naam al bestaat: budgetten en potjes opgeteld", () => {
    const r = renameCategory(base(), "Supermarkt", "Boodschappen");
    expect(r.categories).toEqual(["Boodschappen", "Vakantie"]);
    expect(r.transactions.filter((t) => t.category === "Boodschappen")).toHaveLength(2);
    expect(r.budgets).toEqual({ Boodschappen: 300 });
    expect(r.reserves.Boodschappen).toEqual({ perYear: 360, since: "2025-06", start: 15 });
    // De doelcategorie houdt haar eigen vaste-last-instelling (Boodschappen was geen vaste last).
    expect(r.fixedCategories).toEqual([]);
    // Had de doelcategorie nog geen groep, dan neemt ze die van de samengevoegde categorie over.
    expect(r.categoryGroups).toEqual({ Boodschappen: "Dagelijks" });
    const withGroup = renameCategory({ ...base(), categoryGroups: { Supermarkt: "Dagelijks", Boodschappen: "Eten" } }, "Supermarkt", "Boodschappen");
    expect(withGroup.categoryGroups).toEqual({ Boodschappen: "Eten" });
  });
});

describe("deleteCategory en deleteImpact", () => {
  it("maakt transacties ongecategoriseerd en ruimt instellingen op", () => {
    const r = deleteCategory(base(), "Supermarkt");
    expect(r.categories).not.toContain("Supermarkt");
    expect(r.transactions[0].category).toBe("");
    expect(r.budgets).toEqual({ Boodschappen: 200 });
    expect(r.categoryRules).toEqual([]);
    expect(r.categoryGroups).toEqual({});
    expect(r.reserves).not.toHaveProperty("Supermarkt");
  });

  it("beschrijft wat er verloren gaat", () => {
    expect(deleteImpact(base(), "Supermarkt")).toEqual([
      '1 transactie(s) worden "niet gecategoriseerd"',
      "het maandbudget vervalt",
      "1 categorieregel(s) vervallen",
      "het potje vervalt",
    ]);
    expect(deleteImpact({ ...base(), reserves: {} }, "Leeg")).toEqual([]);
  });
});

describe("ongedaan maken (snapshotFor + applyChanges)", () => {
  // Nagebootste app-gegevens: elke setter werkt het object bij.
  function fakeData(values) {
    const data = { ...values };
    for (const [key, setter] of FIELDS) {
      data[setter] = vi.fn((v) => {
        data[key] = typeof v === "function" ? v(data[key]) : v;
      });
    }
    return data;
  }

  it("zet alles terug, maar houdt latere wijzigingen aan andere transactievelden", () => {
    const data = fakeData(base());
    const changes = renameCategory(data, "Supermarkt", "Boodschappen");
    const undo = snapshotFor(data, changes);
    applyChanges(data, changes);
    expect(data.categories).toEqual(["Boodschappen", "Vakantie"]);
    // Ondertussen een notitie toegevoegd aan transactie 1.
    data.transactions = data.transactions.map((t) => (t.id === "1" ? { ...t, note: "later" } : t));
    undo();
    expect(data.categories).toEqual(["Boodschappen", "Supermarkt", "Vakantie"]);
    expect(data.budgets).toEqual({ Supermarkt: 100, Boodschappen: 200 });
    expect(data.transactions[0]).toMatchObject({ id: "1", category: "Supermarkt", note: "later" });
    expect(data.setSavingsGoals).toHaveBeenCalled();
  });
});

describe("groepen", () => {
  it("groupNames geeft unieke, gesorteerde groepen", () => {
    expect(groupNames({ a: "Wonen", b: "auto", c: "Wonen", d: "" })).toEqual(["auto", "Wonen"]);
  });

  it("groupCategoryTotals telt per groep op; categorieën zonder groep blijven los", () => {
    const rows = groupCategoryTotals(
      [{ naam: "Huur", bedrag: 800 }, { naam: "Energie", bedrag: 120.1 }, { naam: "Uitgaan", bedrag: 900 }],
      { Huur: "Wonen", Energie: "Wonen" },
    );
    expect(rows).toEqual([
      { naam: "Wonen", bedrag: 920.1, filter: "Groep: Wonen", isGroup: true, parts: ["Huur", "Energie"] },
      { naam: "Uitgaan", bedrag: 900, filter: "Uitgaan", isGroup: false, parts: ["Uitgaan"] },
    ]);
  });
});
