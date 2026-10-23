import { describe, expect, it } from "vitest";
import { canMakeRule, groupUncategorizedByParty, hasRule, partyKey, quickCategories } from "./partyGroups";
import { applyAutoCategories } from "./patterns";

let n = 0;
const t = (description, amount = -10, category = "", extra = {}) => ({ id: `t${n++}`, date: `2026-09-${String((n % 28) + 1).padStart(2, "0")}`, description, amount, category, ...extra });

describe("groupUncategorizedByParty", () => {
  const list = [
    t("Albert Heijn 1234 - AMSTERDAM"),
    t("Albert Heijn 5678 - UTRECHT"),
    t("ALBERT HEIJN 9999"),
    t("Netflix International B.V. - Abonnement", -13.99),
    t("Netflix International B.V. - Abonnement", -13.99),
    t("Shell 0012", -60),
    t("Jumbo 1111", -5, "Boodschappen"), // heeft al een categorie
    t("Huur", -800, "", { expected: true }), // verwacht, telt niet mee
  ];

  it("groepeert per partij, ongeacht filiaalnummer of hoofdletters, grootste groep eerst", () => {
    const groups = groupUncategorizedByParty(list);
    expect(groups.map((g) => [g.name, g.count, g.total])).toEqual([
      ["Albert Heijn", 3, -30],
      ["Netflix International B.V.", 2, -27.98],
      ["Shell", 1, -60],
    ]);
  });

  it("stelt een categorie voor uit eerdere keuzes voor dezelfde partij", () => {
    const withHistory = [...list, t("Shell 7777", -50, "Vervoer"), t("Shell 8888", -50, "Vervoer"), t("Shell 9999", -50, "Uitgaan")];
    const shell = groupUncategorizedByParty(withHistory).find((g) => g.name === "Shell");
    expect(shell).toMatchObject({ suggestion: "Vervoer", suggestionFrom: "eerder" });
  });

  it("een eigen regel gaat voor op eerdere keuzes; verdwenen categorieën tellen niet", () => {
    const rules = [{ contains: "netflix", category: "Abonnementen" }];
    const groups = groupUncategorizedByParty(list, { rules, categories: ["Abonnementen", "Boodschappen"] });
    expect(groups.find((g) => g.name.startsWith("Netflix"))).toMatchObject({ suggestion: "Abonnementen", suggestionFrom: "regel" });
    expect(groupUncategorizedByParty(list, { rules, categories: ["Boodschappen"] })[1].suggestion).toBe("");
  });

  it("een regel op de partijnaam vangt alle transacties van die groep", () => {
    const [ah] = groupUncategorizedByParty(list);
    const rules = [{ contains: ah.name, category: "Boodschappen" }];
    const r = applyAutoCategories(ah.items, {}, { rules });
    expect(r.count).toBe(3);
  });

  it("hulpfuncties", () => {
    expect(partyKey("Albert Heijn 1234 - X")).toBe("albert heijn");
    expect(hasRule([{ contains: " Albert Heijn " }], "albert heijn")).toBe(true);
    expect(canMakeRule("AH")).toBe(false);
    expect(canMakeRule("Jumbo")).toBe(true);
  });
});

describe("quickCategories", () => {
  const tx = (date, amount, category, description = "x") => ({ id: `${date}${amount}${category}${description}`, date, amount, category, description });
  const all = [
    tx("2026-09-01", -10, "Boodschappen", "Albert Heijn"),
    tx("2026-09-02", -12, "Boodschappen", "Jumbo"),
    tx("2026-09-03", -20, "Uit eten", "Albert Heijn"),
    tx("2026-09-04", -15, "Uit eten", "Albert Heijn"),
    tx("2026-09-05", 2000, "Salaris", "Werkgever"),
    tx("2025-01-05", -15, "Oud", "Oud"),
  ];
  const today = new Date(2026, 9, 15);

  it("zet het voorstel voor de partij vooraan en daarna de meest gebruikte", () => {
    const r = quickCategories(tx("2026-10-01", -8, "", "Albert Heijn"), all, { today });
    expect(r.suggestion).toBe("Uit eten");
    expect(r.list).toEqual(["Uit eten", "Boodschappen"]);
  });

  it("kiest bij een bijschrijving uit inkomstencategorieën en een eigen regel wint", () => {
    const r = quickCategories(tx("2026-10-01", 50, "", "Teruggave Belasting"), all, {
      today,
      rules: [{ contains: "belasting", category: "Toeslagen" }],
    });
    expect(r.list).toEqual(["Toeslagen", "Salaris"]);
  });
});
