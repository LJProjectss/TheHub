import { describe, expect, it } from "vitest";
import { FILE_FORMAT, decryptJson, deriveKey, encryptJson, fromB64, randomBytes, sha256, toB64 } from "./crypto";

describe("versleuteling van het synchronisatiebestand", () => {
  it("versleutelt en ontsleutelt met hetzelfde wachtwoord", async () => {
    const salt = randomBytes(16);
    const key = await deriveKey("correct paard batterij", salt);
    const file = await encryptJson(key, salt, { transactions: [{ description: "Geheime winkel", amount: -12.5 }] });
    expect(file).toMatchObject({ format: FILE_FORMAT, version: 1 });
    expect(JSON.stringify(file)).not.toContain("Geheime winkel");
    expect(await decryptJson(key, file)).toEqual({ transactions: [{ description: "Geheime winkel", amount: -12.5 }] });
  });

  it("weigert een verkeerd wachtwoord", async () => {
    const salt = randomBytes(16);
    const file = await encryptJson(await deriveKey("goed", salt), salt, { a: 1 });
    await expect(decryptJson(await deriveKey("fout", salt), file)).rejects.toThrow();
  });

  it("gebruikt elke keer een nieuwe iv (zelfde inhoud geeft andere versleuteling)", async () => {
    const salt = randomBytes(16);
    const key = await deriveKey("x", salt);
    const a = await encryptJson(key, salt, { a: 1 });
    const b = await encryptJson(key, salt, { a: 1 });
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });

  it("base64 heen en terug, ook voor grote bestanden", () => {
    const bytes = Uint8Array.from({ length: 100000 }, (_, i) => (i * 31) % 256);
    expect(fromB64(toB64(bytes))).toEqual(bytes);
  });

  it("sha256 is stabiel", async () => {
    expect(await sha256("abc")).toBe("ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=");
  });
});
