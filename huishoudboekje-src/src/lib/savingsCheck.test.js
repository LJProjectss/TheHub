import { describe, expect, it } from "vitest";
import { checkSavingsCategories, partyName } from "./savingsCheck";

const t = (category, amount, description, extra = {}) => ({ id: Math.random().toString(36), date: "2026-09-01", category, amount, description, ...extra });
const SHOPS = ["Albert Heijn 1234", "Jumbo 2345", "Lidl 3456", "Aldi 4567", "Plus 5678", "Dirk 6789", "Albert Heijn 9999", "Jumbo 1111"];
const groceries = SHOPS.map((d) => t("Boodschappen", -25, d));
const transfers = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => t("Sparen", -100, `Naar Oranje Spaarrekening ${i}00000`));

describe("checkSavingsCategories", () => {
  it("waarschuwt als Boodschappen als spaarrekening is gekozen", () => {
    const [w, ...rest] = checkSavingsCategories({ transactions: [...groceries, ...transfers], savingsCategory: "Boodschappen", savingsGoals: [] });
    expect(rest).toHaveLength(0);
    expect(w.category).toBe("Boodschappen");
    expect(w.usedBy).toEqual([{ kind: "default" }]);
    expect(w.reasons).toEqual([{ key: "parties", count: 6, payments: 8, examples: ["Albert Heijn", "Jumbo", "Lidl"] }]);
  });

  it("waarschuwt niet bij een gewone spaarcategorie (ook niet met opnames)", () => {
    const list = [...transfers, t("Sparen", 250, "Van Oranje Spaarrekening 123456")];
    expect(checkSavingsCategories({ transactions: list, savingsCategory: "Sparen" })).toEqual([]);
  });

  it("waarschuwt bij een inkomstencategorie die aan een spaardoel hangt", () => {
    const income = [t("Overige inkomsten", 300, "Marktplaats verkoop"), t("Overige inkomsten", -20, "Marktplaats kosten")];
    const [w] = checkSavingsCategories({
      transactions: income,
      savingsCategory: "Sparen",
      savingsGoals: [{ id: "g1", name: "Vakantie", category: "Overige inkomsten" }],
    });
    expect(w.usedBy).toEqual([{ kind: "goal", id: "g1", name: "Vakantie" }]);
    expect(w.reasons).toEqual([{ key: "inflow", incoming: 300, outgoing: 20 }]);
  });

  it("waarschuwt bij een vaste last als spaarrekening", () => {
    const [w] = checkSavingsCategories({ transactions: [t("Huur", -800, "Woonstichting")], savingsCategory: "Huur", fixedCategories: ["Huur"] });
    expect(w.reasons).toEqual([{ key: "fixed" }]);
    expect(w.signature).toBe("fixed");
  });

  it("veel verschillende omschrijvingen is geen probleem als het geld naar een eigen rekening gaat", () => {
    const own = "NL11ASNB0123456789";
    const list = SHOPS.map((d) => t("Sparen", -50, d, { counter: own }));
    expect(checkSavingsCategories({ transactions: list, savingsCategory: "Sparen", accounts: [{ iban: own }] })).toEqual([]);
  });

  it("partyName toont alleen de naam van de tegenpartij", () => {
    expect(partyName("Rabobank Zeeuws-Vlaanderen.. - Kosten 123456")).toBe("Rabobank Zeeuws-Vlaanderen");
    expect(partyName("ODIDO NETHERLANDS B.V. - Mobiel abonnement")).toBe("ODIDO NETHERLANDS B.V.");
    expect(partyName("Amazon EU SARL - 1234567890")).toBe("Amazon EU SARL");
    expect(partyName("Albert Heijn 1234")).toBe("Albert Heijn");
  });

  it("telt dezelfde partij met verschillende omschrijvingen één keer", () => {
    const list = ["Kosten", "Rente", "Pas", "Toeslag", "Overig", "Extra", "Nog iets", "Laatste"].map((d) => t("Bank", -1, `Rabobank - ${d}`));
    expect(checkSavingsCategories({ transactions: list, savingsCategory: "Bank" })).toEqual([]);
  });

  it("negeert verwachte rijen en categorieën zonder transacties", () => {
    const expected = SHOPS.map((d) => t("Boodschappen", -25, d, { expected: true }));
    expect(checkSavingsCategories({ transactions: expected, savingsCategory: "Boodschappen" })).toEqual([]);
  });
});
