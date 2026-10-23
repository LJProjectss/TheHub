import { describe, expect, it } from "vitest";
import {
  applyAutoCategories,
  buildAutoCategoryModel,
  clearAutoFlag,
  findRuleMismatches,
  matchCategoryRule,
  partyName,
  pattern,
  patternRaw,
  subscriptionKey,
  undoAutoCategories,
} from "./patterns";

const t = (description, category = "", extra = {}) => ({ id: description + category + Math.random(), description, category, amount: -10, date: "2026-09-01", ...extra });

describe("patroon van een omschrijving", () => {
  it("stopt bij het eerste woord met 3 of meer cijfers", () => {
    expect(patternRaw("Albert Heijn 1234 AMSTERDAM")).toBe("Albert Heijn");
    expect(pattern("NETFLIX.COM ref 20260915")).toBe("netflix.com ref");
    expect(patternRaw("12345 Bol.com")).toBe("12345 Bol.com");
  });

  it("partyName geeft de naam van de tegenpartij", () => {
    expect(partyName("Albert Heijn 1234 AMSTERDAM")).toBe("Albert Heijn");
    expect(partyName("Netflix International B.V. - Abonnement september")).toBe("Netflix International B.V.");
    expect(partyName("Rabobank Zeeuws-Vlaanderen.. - Kosten")).toBe("Rabobank Zeeuws-Vlaanderen");
  });

  it("subscriptionKey zet oude sleutels om", () => {
    expect(subscriptionKey("Spotify P1234567|1099")).toBe("spotify|1099");
  });
});

describe("automatisch categoriseren", () => {
  const history = [t("Albert Heijn 1001", "Boodschappen"), t("Albert Heijn 1002", "Boodschappen"), t("Albert Heijn 1003", "Boodschappen"), t("Shell 001", "Vervoer")];

  it("leert een patroon pas na 3 consistente keuzes", () => {
    expect(buildAutoCategoryModel(history)).toEqual({ "albert heijn": "Boodschappen" });
  });

  it("leert niet van wisselende keuzes, verwachte rijen of eigen automatische keuzes", () => {
    expect(buildAutoCategoryModel([...history, t("Albert Heijn 9999", "Uitgaan")])).toEqual({});
    const auto = [1, 2, 3].map((i) => t(`Jumbo ${i}000`, "Boodschappen", { autoCategorized: "x" }));
    expect(buildAutoCategoryModel(auto)).toEqual({});
  });

  it("vult alleen lege categorieën, eigen regels gaan voor", () => {
    const list = [t("Albert Heijn 5555"), t("Albert Heijn 6666", "Uitgaan"), t("Tikkie van Sanne"), t("Onbekend")];
    const rules = [{ contains: "tikkie", category: "Uitgaan" }];
    const r = applyAutoCategories(list, buildAutoCategoryModel(history), { rules, tag: "T1" });
    expect(r.list.map((x) => x.category)).toEqual(["Boodschappen", "Uitgaan", "Uitgaan", ""]);
    expect(r.count).toBe(2);
    expect(r.byRule).toBe(1);
    expect(r.list[1].autoCategorized).toBeUndefined();
    expect(r.list[0].autoCategorized).toBe("T1");
  });

  it("bij meerdere regels wint het langste trefwoord, en verdwenen categorieën tellen niet", () => {
    const rules = [{ contains: "albert", category: "A" }, { contains: "albert heijn to go", category: "B" }, { contains: "heijn", category: "Weg" }];
    expect(matchCategoryRule("Albert Heijn To Go 12", rules, ["A", "B"])).toBe("B");
    expect(matchCategoryRule("Heijn", rules, ["A", "B"])).toBeNull();
  });

  it("undoAutoCategories draait alleen het juiste kenmerk terug", () => {
    const list = [t("a", "X", { autoCategorized: "T1" }), t("b", "Y", { autoCategorized: "T2" }), t("c", "Z")];
    expect(undoAutoCategories(list, "T1").map((x) => x.category)).toEqual(["", "Y", "Z"]);
  });

  it("clearAutoFlag haalt alleen het label weg", () => {
    const x = t("a", "X", { autoCategorized: "T1" });
    expect(clearAutoFlag(x)).not.toHaveProperty("autoCategorized");
    expect(clearAutoFlag(x).category).toBe("X");
  });
});

describe("findRuleMismatches", () => {
  it("meldt een afwijkend bedrag bij een herhalende regel (meest recente per regel)", () => {
    const rules = [{ id: "r", active: true, keyword: "Huur", type: "uitgave", amount: 800 }];
    const rows = [
      { id: "1", description: "HUUR aug", amount: -810, date: "2026-08-25" },
      { id: "2", description: "HUUR sep", amount: -825, date: "2026-09-25" },
      { id: "3", description: "HUUR terug", amount: 50, date: "2026-09-26" },
      { id: "4", description: "HUUR ok", amount: -800, date: "2026-09-27" },
    ];
    expect(findRuleMismatches(rows, rules)).toEqual([
      { ruleId: "r", keyword: "Huur", expected: 800, actual: 825, date: "2026-09-25", txId: "2" },
    ]);
  });
});
