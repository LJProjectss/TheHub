import { describe, expect, it } from "vitest";
import { splitDuplicates } from "./duplicates";

const tx = (date, amount, description = "Albert Heijn", extra = {}) => ({ id: `${date}${amount}${description}`, date, amount, description, ...extra });

describe("splitDuplicates (dubbele transacties bij import)", () => {
  it("herkent een rij die er al staat (ook bij andere hoofdletters en spaties)", () => {
    const { fresh, duplicates } = splitDuplicates([tx("2026-09-01", -10, "Albert  Heijn")], [tx("2026-09-01", -10, "albert heijn"), tx("2026-09-02", -10)]);
    expect(duplicates).toHaveLength(1);
    expect(fresh.map((t) => t.date)).toEqual(["2026-09-02"]);
  });

  it("telt elke bestaande transactie maar één keer: twee gelijke betalingen op één dag", () => {
    const { fresh, duplicates } = splitDuplicates([tx("2026-09-01", -2.5, "Koffie")], [tx("2026-09-01", -2.5, "Koffie"), tx("2026-09-01", -2.5, "Koffie")]);
    expect(duplicates).toHaveLength(1);
    expect(fresh).toHaveLength(1);
  });

  it("vangt een datum die één dag verschoven is (oude opslagfout)", () => {
    expect(splitDuplicates([tx("2026-08-31", -10)], [tx("2026-09-01", -10)]).duplicates).toHaveLength(1);
    expect(splitDuplicates([tx("2026-08-30", -10)], [tx("2026-09-01", -10)]).duplicates).toHaveLength(0);
  });

  it("laat een exacte match voorgaan op een match van een dag ernaast", () => {
    const existing = [tx("2026-09-01", -10)];
    const { fresh, duplicates } = splitDuplicates(existing, [tx("2026-09-02", -10), tx("2026-09-01", -10)]);
    expect(duplicates.map((t) => t.date)).toEqual(["2026-09-01"]);
    expect(fresh.map((t) => t.date)).toEqual(["2026-09-02"]);
  });

  it("negeert verwachte (nog niet geboekte) rijen", () => {
    const { duplicates } = splitDuplicates([tx("2026-09-01", -800, "Huur", { expected: true })], [tx("2026-09-01", -800, "Huur")]);
    expect(duplicates).toHaveLength(0);
  });

  it("ziet een ander bedrag niet als dubbel", () => {
    expect(splitDuplicates([tx("2026-09-01", -10)], [tx("2026-09-01", -10.01)]).duplicates).toHaveLength(0);
  });
});
