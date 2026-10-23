import { describe, expect, it } from "vitest";
import { currentMonth, monthsSince, reserveList, reserveStatus } from "./reserves";

const NOW = new Date(2026, 9, 1); // oktober 2026

describe("potjes", () => {
  it("monthsSince telt de huidige maand mee", () => {
    expect(monthsSince("2026-01", NOW)).toBe(10);
    expect(monthsSince("2026-10", NOW)).toBe(1);
    expect(monthsSince("2026-12", NOW)).toBe(0);
    expect(monthsSince("onzin", NOW)).toBe(0);
    expect(currentMonth(NOW)).toBe("2026-10");
  });

  it("bouwt op per maand en trekt uitgaven sinds de start af", () => {
    const list = [
      { category: "Vakantie", amount: -500, date: "2026-07-10" },
      { category: "Vakantie", amount: 50, date: "2026-07-20" }, // terugbetaling
      { category: "Vakantie", amount: -999, date: "2025-12-01" }, // vóór de start
      { category: "Vakantie", amount: -100, date: "2026-08-01", expected: true }, // nog niet geboekt
      { category: "Anders", amount: -100, date: "2026-08-01" },
    ];
    expect(reserveStatus(list, "Vakantie", { perYear: 1200, since: "2026-01", start: 25 }, NOW)).toEqual({
      perMonth: 100,
      months: 10,
      reserved: 1025,
      spent: 450,
      balance: 575,
    });
  });

  it("reserveList slaat onvolledige potjes over en sorteert op naam", () => {
    const list = reserveList([], { Zorg: { perYear: 600, since: "2026-01" }, Auto: { perYear: 1200, since: "2026-09" }, Leeg: { perYear: 0, since: "2026-01" } }, NOW);
    expect(list.map((r) => [r.category, r.balance])).toEqual([
      ["Auto", 200],
      ["Zorg", 500],
    ]);
  });
});
