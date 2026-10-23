// Een CSV-import verwerken: automatisch categoriseren, rekeningen en overboekingen herkennen,
// verwachte transacties vervangen, en melden wat er is gebeurd (met "Import ongedaan maken").
// Daarna: waarschuwingen bij afwijkende bedragen van herhalende regels en meldingen over nieuwe
// abonnementen of prijswijzigingen.
import { useState } from "react";
import { newId } from "../lib/format";
import { applyAutoCategories, buildAutoCategoryModel, findRuleMismatches } from "../lib/patterns";
import { applyRuleAmountFix, mergeImportedRows, revertImport } from "../lib/recurring";
import { addAccountsFrom, ensureTransferCategory, markTransfers } from "../lib/accounts";
import { detectRecurring, diffRecurring, ignoredPatterns, recurringOptions } from "../lib/subscriptions";

export function useImport(data, notify) {
  const { transactions, setTransactions, categories, categoryRules, recurringRules, setRecurringRules, dismissedSubscriptions } = data;
  const [ruleWarnings, setRuleWarnings] = useState([]);
  const [recurringNotices, setRecurringNotices] = useState([]);

  const handleImport = (rows, skipped = 0, bankName = null) => {
    const tag = newId();
    const auto = applyAutoCategories(rows, buildAutoCategoryModel(transactions, categories), {
      rules: categoryRules,
      categories,
      tag,
    });
    const imported = auto.list;
    // Nieuwe eigen rekeningen onthouden; daarna overboekingen tussen eigen rekeningen herkennen
    // (ook in eerder geïmporteerde rijen, als die rekening nu pas bekend is).
    const nextAccounts = addAccountsFrom(data.accounts, imported, bankName);
    if (nextAccounts !== data.accounts) data.setAccounts(nextAccounts);
    const transfers = markTransfers(mergeImportedRows(transactions, imported), nextAccounts, tag);
    const parts = [`${imported.length} transactie(s) geïmporteerd.`];
    if (skipped > 0) parts.push(`${skipped} dubbele transactie(s) overgeslagen omdat ze al in je overzicht stonden.`);
    if (auto.count > 0)
      parts.push(
        `${auto.count} van ${imported.length} geïmporteerde transactie(s) automatisch gecategoriseerd${
          auto.byRule > 0 ? ` (waarvan ${auto.byRule} via je eigen regels)` : " op basis van eerdere keuzes"
        }.`,
      );
    if (transfers.count > 0) {
      ensureTransferCategory(data);
      parts.push(`${transfers.count} overboeking(en) tussen eigen rekeningen herkend.`);
    }
    if (nextAccounts.length > data.accounts.length)
      parts.push("Nieuwe rekening toegevoegd; geef die een naam bij Instellingen.");
    const merged = transfers.list;
    // Ongedaan maken haalt de hele import weg (inclusief de automatische categorieën ervan) en
    // zet vervangen verwachte rijen en nieuw toegevoegde rekeningen terug.
    const before = transactions;
    const accountsBefore = data.accounts;
    notify(parts.join(" "), [
      auto.count > 0 || transfers.count > 0 ? tag : null,
      {
        label: "Import ongedaan maken",
        run: () => {
          setTransactions((list) => revertImport(list, before, merged));
          if (nextAccounts !== accountsBefore) {
            const known = new Set(accountsBefore.map((a) => a.iban));
            const addedIbans = new Set(nextAccounts.filter((a) => !known.has(a.iban)).map((a) => a.iban));
            data.setAccounts((list) => list.filter((a) => !addedIbans.has(a.iban)));
          }
          setRuleWarnings([]);
          setRecurringNotices([]);
          return `Import ongedaan gemaakt: ${imported.length} transactie(s) verwijderd.`;
        },
      },
    ]);
    setRuleWarnings(findRuleMismatches(imported, recurringRules));
    setTransactions(merged);
    // Nieuwe terugkerende betalingen en prijswijzigingen door deze import melden.
    const options = recurringOptions(data);
    const { added, priceChanges } = diffRecurring(
      detectRecurring(transactions, options),
      detectRecurring(merged, options),
      ignoredPatterns(dismissedSubscriptions),
    );
    setRecurringNotices([
      ...added.map((item) => ({ id: `new|${item.key}`, kind: "new", item })),
      ...priceChanges.map(({ item, change }) => ({
        id: `price|${item.key}|${change.date}`,
        kind: "price",
        item,
        change,
      })),
    ]);
  };

  const dismissWarning = (ruleId) => setRuleWarnings((list) => list.filter((w) => w.ruleId !== ruleId));
  const fixRuleAmount = (warning) => {
    setRecurringRules((rules) => rules.map((r) => (r.id === warning.ruleId ? { ...r, amount: warning.actual } : r)));
    setTransactions((list) => applyRuleAmountFix(list, warning));
    dismissWarning(warning.ruleId);
  };

  return { handleImport, ruleWarnings, dismissWarning, fixRuleAmount, recurringNotices, setRecurringNotices };
}
