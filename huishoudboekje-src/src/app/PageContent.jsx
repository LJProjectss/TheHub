// De inhoud van de gekozen pagina, met de gegevens die elke pagina nodig heeft.
import { Suspense } from "react";
import {
  Categories,
  Comparison,
  Dashboard,
  MonthReport,
  PageLoading,
  Savings,
  Settings,
  Subscriptions,
  Transactions,
  YearReport,
} from "./pages";

export default function PageContent({ page, data, navigate, txFilter, notify, openImport, sync, autoBackup }) {
  return (
    <Suspense fallback={<PageLoading />}>
      {page === "dashboard" && <Dashboard data={data} navigate={navigate} />}
      {page === "transactions" && (
        <Transactions
          key={txFilter?.key || "transactions"}
          initialFilter={txFilter}
          transactions={data.transactions}
          categories={data.categories}
          setTransactions={data.setTransactions}
          recurringRules={data.recurringRules}
          setRecurringRules={data.setRecurringRules}
          openImport={openImport}
          categoryRules={data.categoryRules}
          setCategoryRules={data.setCategoryRules}
          categoryGroups={data.categoryGroups}
          accounts={data.accounts}
          notify={notify}
        />
      )}
      {page === "categories" && <Categories data={data} notify={notify} />}
      {page === "year" && <YearReport data={data} navigate={navigate} />}
      {page === "monthreport" && (
        <MonthReport key={txFilter?.key || "monthreport"} data={data} navigate={navigate} initialMonth={txFilter?.month} />
      )}
      {page === "settings" && <Settings data={data} notify={notify} sync={sync} autoBackup={autoBackup} />}
      {page === "savings" && (
        <Savings
          categories={data.categories}
          transactions={data.transactions}
          savingsGoals={data.savingsGoals}
          setSavingsGoals={data.setSavingsGoals}
          savingsCategory={data.savingsCategory}
          setSavingsCategory={data.setSavingsCategory}
          savingsSettings={data.savingsSettings}
          setSavingsSettings={data.setSavingsSettings}
          fixedCategories={data.fixedCategories}
          accounts={data.accounts}
        />
      )}
      {page === "comparison" && <Comparison data={data} navigate={navigate} />}
      {page === "subscriptions" && (
        <Subscriptions
          transactions={data.transactions}
          setTransactions={data.setTransactions}
          categories={data.categories}
          fixedCategories={data.fixedCategories}
          excludedCategories={data.excludedCategories}
          savingsCategory={data.savingsCategory}
          savingsGoals={data.savingsGoals}
          savingsSettings={data.savingsSettings}
          dismissedSubscriptions={data.dismissedSubscriptions}
          setDismissedSubscriptions={data.setDismissedSubscriptions}
          subscriptionStatus={data.subscriptionStatus}
          setSubscriptionStatus={data.setSubscriptionStatus}
        />
      )}
    </Suspense>
  );
}
