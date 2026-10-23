import { describe, expect, it } from "vitest";
import { TRANSFER_CATEGORY, accountLabel, addAccountsFrom, formatIban, markTransfers, normalizeIban } from "./accounts";

const RABO = "NL55RABO0123456789";
const ASN = "NL11ASNB0123456789";
const t = (extra) => ({ id: Math.random().toString(36), date: "2026-09-01", amount: -50, description: "x", category: "", ...extra });

describe("rekeningnummers", () => {
  it("normaliseert IBAN en oude rekeningnummers", () => {
    expect(normalizeIban("nl91 abna 0417 1643 00")).toBe("NL91ABNA0417164300");
    expect(normalizeIban("123456789")).toBe("123456789");
    expect(normalizeIban("Albert Heijn")).toBe("");
    expect(normalizeIban("")).toBe("");
  });

  it("formatIban en accountLabel", () => {
    expect(formatIban("NL91ABNA0417164300")).toBe("NL91 ABNA 0417 1643 00");
    expect(accountLabel([{ iban: RABO, name: "Betaal" }], RABO)).toBe("Betaal");
    expect(accountLabel([], RABO)).toBe("…6789");
    expect(accountLabel([], "")).toBe("");
  });

  it("addAccountsFrom voegt alleen nieuwe rekeningen toe", () => {
    const existing = [{ iban: RABO, name: "Betaal", kind: "betaal" }];
    expect(addAccountsFrom(existing, [t({ account: RABO })], "Rabobank")).toBe(existing);
    expect(addAccountsFrom(existing, [t({ account: ASN }), t({ account: ASN })], "ASN")).toEqual([
      ...existing,
      { iban: ASN, name: "ASN …6789", kind: "betaal" },
    ]);
  });
});

describe("markTransfers (overboekingen tussen eigen rekeningen)", () => {
  const accounts = [
    { iban: RABO, name: "Betaal", kind: "betaal" },
    { iban: ASN, name: "Gezamenlijk", kind: "betaal" },
  ];

  it("zet een overboeking naar een eigen betaalrekening op de overboekingscategorie", () => {
    const { list, count } = markTransfers([t({ account: RABO, counter: ASN }), t({ account: RABO, counter: "NL12INGB0001234567" })], accounts, "T");
    expect(count).toBe(1);
    expect(list[0]).toMatchObject({ category: TRANSFER_CATEGORY, autoCategorized: "T" });
    expect(list[1].category).toBe("");
  });

  it("laat stortingen naar een spaarrekening, ingevulde categorieën en verwachte rijen staan", () => {
    const spaar = accounts.map((a) => (a.iban === ASN ? { ...a, kind: "spaar" } : a));
    expect(markTransfers([t({ account: RABO, counter: ASN })], spaar).count).toBe(0);
    expect(markTransfers([t({ account: RABO, counter: ASN, category: "Sparen" })], accounts).count).toBe(0);
    expect(markTransfers([t({ account: RABO, counter: ASN, expected: true })], accounts).count).toBe(0);
  });
});
