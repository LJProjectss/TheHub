import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import {
  cleanAbnDescription,
  detectBank,
  detectHeaderlessBank,
  guessMapping,
  parseAmount,
  parseDate,
  parseInputAmount,
  rowsToTransactions,
  transactionsToCsv,
} from "./csv";
import { toIsoDate } from "./format";

const parse = (text) => Papa.parse(text.trim(), { delimiter: "", skipEmptyLines: true }).data;
const strip = (list) => list.map(({ id, ...rest }) => rest);

describe("parseAmount (bedragen uit een bankbestand)", () => {
  it.each([
    ["€ -1.234,56", -1234.56],
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["(12.50)", -12.5],
    ["-12,50", -12.5],
    ["12.5", 12.5],
    ["1234", 1234],
    ["0,00", 0],
  ])("%s -> %s", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it("geeft null bij lege of onleesbare waarden", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });

  it('leest "3,5" in een CSV als duizendtal-scheiding (zo werkt de bankimport al jaren)', () => {
    expect(parseAmount("3,5")).toBe(35);
  });
});

describe("parseInputAmount (zelf ingetypte bedragen)", () => {
  it.each([
    ["12,5", 12.5],
    ["€ 12,5", 12.5],
    ["-3,5", -3.5],
    ["12,50", 12.5],
    ["1.234,56", 1234.56],
    ["1234", 1234],
  ])("%s -> %s", (input, expected) => {
    expect(parseInputAmount(input)).toBe(expected);
  });
});

describe("parseDate", () => {
  it.each([
    ["20260915", "2026-09-15"],
    ["2026-09-15", "2026-09-15"],
    ["15-09-2026", "2026-09-15"],
    ["5/9/2026", "2026-09-05"],
  ])("%s -> %s", (input, iso) => {
    expect(toIsoDate(parseDate(input))).toBe(iso);
  });

  it("geeft null bij iets wat geen datum is", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("hallo")).toBeNull();
    expect(parseDate("12,50")).toBeNull();
  });
});

describe("banken met kopregel", () => {
  it("herkent ING en leest Af/Bij, omschrijving en rekeningen", () => {
    const rows = parse(`"Datum";"Naam / Omschrijving";"Rekening";"Tegenrekening";"Code";"Af Bij";"Bedrag (EUR)";"Mutatiesoort";"Mededelingen"
"20260915";"Albert Heijn 1234";"NL91INGB0001234567";"";"BA";"Af";"12,34";"Betaalautomaat";"Pasvolgnr 001"
"20260916";"Werkgever BV";"NL91INGB0001234567";"NL55RABO0123456789";"OV";"Bij";"2.500,00";"Overschrijving";"Salaris september"`);
    const bank = detectBank(rows[0]);
    expect(bank.profile.naam).toBe("ING");
    expect(strip(rowsToTransactions(rows[0], rows.slice(1), bank.mapping))).toEqual([
      {
        date: "2026-09-15",
        description: "Albert Heijn 1234 - Pasvolgnr 001",
        category: "",
        amount: -12.34,
        account: "NL91INGB0001234567",
      },
      {
        date: "2026-09-16",
        description: "Werkgever BV - Salaris september",
        category: "",
        amount: 2500,
        account: "NL91INGB0001234567",
        counter: "NL55RABO0123456789",
      },
    ]);
  });

  it("herkent Rabobank, inclusief eigen rekening en tegenrekening", () => {
    const rows = parse(`"IBAN/BBAN","Munt","BIC","Volgnr","Datum","Rentedatum","Bedrag","Saldo na trn","Tegenrekening IBAN/BBAN","Naam tegenpartij","Naam uiteindelijke partij","Naam initiërende partij","BIC tegenpartij","Code","Batch ID","Transactiereferentie","Machtigingskenmerk","Incassant ID","Betalingskenmerk","Omschrijving-1"
"NL55RABO0123456789","EUR","RABONL2U","1","2026-09-15","2026-09-15","-50,00","100,00","NL11ASNB0123456789","Mijzelf","","","","tb","","","","","","Naar ASN"`);
    const bank = detectBank(rows[0]);
    expect(bank.profile.naam).toBe("Rabobank");
    const [t] = rowsToTransactions(rows[0], rows.slice(1), bank.mapping);
    expect(t).toMatchObject({
      date: "2026-09-15",
      amount: -50,
      description: "Mijzelf - Naar ASN",
      account: "NL55RABO0123456789",
      counter: "NL11ASNB0123456789",
    });
  });
});

describe("banken zonder kopregel", () => {
  it("ABN AMRO (TXT): pinbetaling, SEPA-overboeking en incasso", () => {
    const rows = parse(
      [
        "123456789\tEUR\t20260915\t1250,00\t1215,44\t20260915\t-34,56\tBEA   NR:XXXX 15.09.26/12.34 ALBERT HEIJN 1234,PAS123",
        "123456789\tEUR\t20260916\t1215,44\t1715,44\t20260916\t500,00\t/TRTP/SEPA OVERBOEKING/IBAN/NL12INGB0001234567/BIC/INGBNL2A/NAME/J JANSEN/REMI/Terugbetaling etentje/EREF/NOTPROVIDED",
        "123456789\tEUR\t20260917\t1715,44\t1700,44\t20260917\t-15,00\tSEPA Incasso algemeen doorlopend Incassant: NL00ZZZ Naam: NETFLIX INTERNATIONAL B.V. Machtiging: 123 Omschrijving: Netflix abonnement IBAN: NL55RABO0123456789",
      ].join("\n"),
    );
    const bank = detectHeaderlessBank(rows);
    expect(bank.profile.naam).toBe("ABN AMRO");
    const list = rowsToTransactions([], rows, bank.mapping);
    expect(list.map((t) => [t.date, t.amount, t.description, t.counter])).toEqual([
      ["2026-09-15", -34.56, "ALBERT HEIJN 1234", undefined],
      ["2026-09-16", 500, "J JANSEN - Terugbetaling etentje", "NL12INGB0001234567"],
      ["2026-09-17", -15, "NETFLIX INTERNATIONAL B.V. - Netflix abonnement", "NL55RABO0123456789"],
    ]);
    expect(list.every((t) => t.account === "123456789")).toBe(true);
  });

  it("SNS / ASN / RegioBank", () => {
    const rows = parse(
      `15-09-2026,NL11ASNB0123456789,NL22INGB0007654321,"J Jansen",,,,EUR,1000.00,EUR,-25.50,15-09-2026,15-09-2026,8810,OVB,12345,,'Cadeau verjaardag',1`,
    );
    const bank = detectHeaderlessBank(rows);
    expect(bank.profile.naam).toBe("SNS / ASN / RegioBank");
    expect(strip(rowsToTransactions([], rows, bank.mapping))).toEqual([
      {
        date: "2026-09-15",
        description: "J Jansen - Cadeau verjaardag",
        category: "",
        amount: -25.5,
        account: "NL11ASNB0123456789",
        counter: "NL22INGB0007654321",
      },
    ]);
  });

  it("Triodos (Debet = uitgave)", () => {
    const rows = parse(
      `"15-09-2026","NL33TRIO0123456789","1.234,56","Debet","Verhuurder BV","NL44ABNA0123456789","IC","Huur september"
"16-09-2026","NL33TRIO0123456789","20,00","Credit","Vriend","NL44ABNA0999999999","IC","Terug"`,
    );
    const bank = detectHeaderlessBank(rows);
    expect(bank.profile.naam).toBe("Triodos");
    expect(rowsToTransactions([], rows, bank.mapping).map((t) => [t.amount, t.description])).toEqual([
      [-1234.56, "Verhuurder BV - Huur september"],
      [20, "Vriend - Terug"],
    ]);
  });

  it("ziet een bestand met kopregel niet aan voor een bank zonder kopregel", () => {
    expect(detectHeaderlessBank(parse(`Datum;Omschrijving;Bedrag\n2026-09-01;Test;-1,00`))).toBeNull();
  });
});

describe("cleanAbnDescription", () => {
  it("laat een gewone omschrijving ongemoeid (op spaties na)", () => {
    expect(cleanAbnDescription("  Rente   en kosten ")).toBe("Rente en kosten");
  });
});

describe("guessMapping (onbekend formaat)", () => {
  it("vindt datum, bedrag, omschrijving en de rekeningkolommen", () => {
    const rows = parse(`Datum;Van;Naar;Bedrag;Omschrijving
2026-09-01;NL55RABO0123456789;NL12INGB0001234567;-10,00;Een
2026-09-02;NL55RABO0123456789;NL98ABNA0123456789;-20,00;Twee
2026-09-03;NL55RABO0123456789;NL77TRIO0123456789;-30,00;Drie`);
    expect(guessMapping(rows[0], rows.slice(1))).toMatchObject({
      date: 0,
      amount: 3,
      account: 1,
      counter: 2,
      desc: [4],
    });
  });
});

describe("rowsToTransactions", () => {
  it("rekent aparte Af- en Bij-kolommen om naar één bedrag", () => {
    const mapping = { date: 0, amount: 1, amount2: 2, desc: [3], signCol: -1 };
    const list = rowsToTransactions([], [["2026-09-01", "10,00", "", "Uit"], ["2026-09-02", "", "5,00", "In"]], mapping);
    expect(list.map((t) => t.amount)).toEqual([-10, 5]);
  });

  it("slaat rijen zonder geldige datum of bedrag over", () => {
    const mapping = { date: 0, amount: 1, amount2: -1, desc: [2], signCol: -1 };
    const list = rowsToTransactions([], [["geen datum", "1,00", "x"], ["2026-09-01", "", "y"], ["2026-09-02", "2,00", ""]], mapping);
    expect(list).toHaveLength(1);
    expect(list[0].description).toBe("(geen omschrijving)");
  });
});

describe("transactionsToCsv", () => {
  it("gebruikt puntkomma's en decimale komma's, met aanhalingstekens waar nodig", () => {
    const csv = transactionsToCsv([
      { date: "2026-09-12", description: "Albert Heijn; filiaal", category: "Boodschappen", amount: -12.5, note: 'zei "hoi"', tags: ["Vakantie", "Italië"] },
    ]);
    expect(csv.split("\r\n")).toEqual([
      "Datum;Omschrijving;Categorie;Bedrag;Notitie;Labels",
      `2026-09-12;"Albert Heijn; filiaal";Boodschappen;-12,50;"zei ""hoi""";Vakantie, Italië`,
    ]);
  });

  it("voorkomt dat Excel tekst als formule uitvoert", () => {
    const csv = transactionsToCsv([{ date: "2026-09-25", description: "=HYPERLINK(x)", category: "", amount: 2500 }]);
    expect(csv.split("\r\n")[1]).toBe("2026-09-25;'=HYPERLINK(x);;2500,00;;");
  });
});
