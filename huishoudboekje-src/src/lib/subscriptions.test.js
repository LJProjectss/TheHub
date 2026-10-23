import { describe, expect, it } from "vitest";
import { detectRecurring, detectRhythm, diffRecurring, ignoredPatterns, savingsCategoriesOf } from "./subscriptions";

const pay = (date, amount, description, category = "") => ({ id: `${date}${description}${amount}`, date, amount: -amount, description, category });
const monthly = (description, amount, months, day = 5, category = "") =>
  months.map((m) => pay(`2026-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`, amount, description, category));

describe("detectRhythm", () => {
  it("herkent maandelijks, ook met een overgeslagen maand", () => {
    expect(detectRhythm(["2026-01-05", "2026-02-05", "2026-03-05", "2026-04-05"]).key).toBe("monthly");
    expect(detectRhythm(["2026-01-05", "2026-02-05", "2026-04-05", "2026-05-05"])).toMatchObject({ key: "monthly", missed: 1 });
  });

  it("herkent jaarlijks en wekelijks", () => {
    expect(detectRhythm(["2024-03-01", "2025-03-01", "2026-03-02"]).key).toBe("yearly");
    expect(detectRhythm(["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22"]).key).toBe("weekly");
  });

  it("geeft null bij onregelmatige datums of te weinig betalingen", () => {
    expect(detectRhythm(["2026-01-05", "2026-01-09", "2026-03-20", "2026-03-22"])).toBeNull();
    expect(detectRhythm(["2026-01-05", "2026-02-05"])).toBeNull();
  });
});

describe("detectRecurring", () => {
  it("vindt een abonnement met prijswijziging", () => {
    const list = [...monthly("Netflix 12345", 12.99, [1, 2, 3, 4]), ...monthly("Netflix 12345", 13.99, [5, 6, 7])];
    const { items } = detectRecurring(list);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: "Netflix",
      kind: "subscription",
      amount: 13.99,
      count: 7,
      perYear: 167.88,
      nextExpected: "2026-08-05",
    });
    expect(items[0].priceChanges).toEqual([{ from: 12.99, to: 13.99, date: "2026-05-05" }]);
  });

  it("markeert vaste lasten en accepteert daar een wisselend bedrag", () => {
    const list = [40, 55, 48, 61, 52].map((amount, i) => pay(`2026-0${i + 1}-20`, amount, "Vattenfall klantnr 99999", "Energie"));
    const { items } = detectRecurring(list, { fixedCategories: ["Energie"] });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "fixed", variable: true, amount: 52 });
  });

  it("ziet de supermarkt niet als abonnement", () => {
    const list = [];
    for (let d = 1; d <= 28; d += 2) list.push(pay(`2026-09-${String(d).padStart(2, "0")}`, 10 + (d % 7) * 3.15, "Albert Heijn 1234"));
    expect(detectRecurring(list).items).toHaveLength(0);
  });

  it("zet een abonnement op gestopt als de betalingen lang uitblijven", () => {
    const list = [...monthly("Spotify P123456", 10.99, [1, 2, 3]), pay("2026-09-01", 5, "Iets anders")];
    expect(detectRecurring(list).items[0].active).toBe(false);
  });

  it("slaat spaar- en 'niet als uitgave'-categorieën over", () => {
    const list = monthly("Naar spaarrekening", 100, [1, 2, 3, 4], 1, "Sparen");
    expect(detectRecurring(list, { savingsCategories: ["Sparen"] }).items).toHaveLength(0);
    expect(detectRecurring(list, { excludedCategories: ["Sparen"] }).items).toHaveLength(0);
  });

  it("diffRecurring meldt nieuwe abonnementen en nieuwe prijswijzigingen", () => {
    const before = detectRecurring(monthly("Netflix 12345", 12.99, [1, 2, 3, 4]));
    const after = detectRecurring([...monthly("Netflix 12345", 12.99, [1, 2, 3, 4]), ...monthly("Netflix 12345", 13.99, [5, 6]), ...monthly("Disney Plus", 9.99, [3, 4, 5, 6])]);
    const diff = diffRecurring(before, after);
    expect(diff.added.map((i) => i.name)).toEqual(["Disney Plus"]);
    expect(diff.priceChanges.map((p) => p.change.to)).toEqual([13.99]);
    expect(diffRecurring(before, after, ignoredPatterns(["Disney Plus|999"])).added).toHaveLength(0);
  });
});

describe("savingsCategoriesOf", () => {
  it("verzamelt standaard-spaarcategorie en doelen zonder dubbele", () => {
    expect(savingsCategoriesOf({ savingsCategory: "Sparen", savingsGoals: [{ category: "Buffer" }, { category: "Sparen" }] })).toEqual(["Sparen", "Buffer"]);
  });

  it("laat achtergebleven spaarinstellingen van een niet meer gekozen categorie weg", () => {
    expect(savingsCategoriesOf({ savingsCategory: "Sparen", savingsGoals: [], savingsSettings: { Boodschappen: { mode: "priority" } } })).toEqual(["Sparen"]);
  });
});
