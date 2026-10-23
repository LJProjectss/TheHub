import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, CircleAlert, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { P } from "../theme";
import { MONTHS_SHORT, formatDate, formatEuro, newId, toIsoDate } from "../lib/format";
import { parseAmount } from "../lib/csv";
import {
  DISTRIBUTION_MODES,
  allocatedIn,
  averageMonthlySaving,
  balanceHistory,
  categoryBalance,
  distributeRemainder,
  forecastGoal,
  goalsIn,
  isActive,
  monthsUntil,
  savingsCategoriesInUse,
  settingsFor,
  transactionBalance,
} from "../lib/savings";
import { useSavingsCheck } from "../lib/savingsCheck";
import { Button, EmptyState, Money, Select, tooltipStyle } from "../components/ui";
import SavingsWarning from "../components/SavingsWarning";

const round = (n) => Math.round(n * 100) / 100;
const monthLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1]} ${y}`;
};
const toText = (n) => (n ? String(n).replace(".", ",") : "");

function EuroInput({ value, onChange, onCommit, disabled, placeholder }) {
  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: P.muted }}>
        €
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onCommit(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="hb-money w-full pl-5 pr-2 py-1.5 rounded-lg border text-sm tabular-nums disabled:opacity-60"
        style={{ borderColor: P.border }}
      />
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <label className="text-xs block mb-1" style={{ color: P.muted }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function IconButton({ onClick, label, disabled, children, color }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 rounded hover:bg-black/5 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
      style={{ color: color || P.muted }}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

// Eén spaarrekening (categorie): saldo, afstemmen met de bank, verdeelwijze en verloop.
function SavingsAccountCard({ category, transactions, goals, settings, setSettings, setGoals }) {
  const [bankText, setBankText] = useState("");
  const s = settingsFor(settings, category);
  const balance = categoryBalance(transactions, category, settings);
  const allocated = allocatedIn(goals, category);
  const free = round(balance - allocated);
  const { average, months } = averageMonthlySaving(transactions, category);
  const history = useMemo(
    () => balanceHistory(transactions, category, settings).map((r) => ({ ...r, label: monthLabel(r.key) })),
    [transactions, category, settings],
  );
  const update = (changes) =>
    setSettings((all) => ({ ...all, [category]: { ...settingsFor(all, category), ...changes } }));

  const alignWithBank = () => {
    const value = parseAmount(bankText);
    if (value === null) return;
    update({
      adjustment: round(value - transactionBalance(transactions, category)),
      adjustedAt: toIsoDate(new Date()),
    });
    setBankText("");
  };

  return (
    <div className="rounded-2xl border hb-card p-4 sm:p-5 mb-6" style={{ borderColor: P.border, backgroundColor: P.surface }}>
      <h2 className="text-sm font-semibold mb-3" style={{ color: P.heading }}>
        Spaarrekening · {category}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Saldo", value: balance, color: P.heading },
          { label: "Toegewezen aan doelen", value: allocated, color: P.blue },
          { label: "Nog vrij", value: free, color: free < 0 ? P.expense : P.income },
          {
            label: months ? `Gem. inleg per maand (${months} mnd)` : "Gem. inleg per maand",
            value: average,
            color: P.text,
          },
        ].map((item) => (
          <div key={item.label}>
            <div className="text-xs mb-1" style={{ color: P.muted }}>
              {item.label}
            </div>
            <div className="text-lg font-bold tabular-nums" style={{ color: item.color }}>
              <Money value={item.value} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-xs block mb-1" style={{ color: P.muted }}>
            Saldo volgens je bank
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <EuroInput value={bankText} onChange={setBankText} onCommit={() => {}} placeholder="bv. 4.250,00" />
            </div>
            <Button variant="secondary" onClick={alignWithBank} disabled={parseAmount(bankText) === null}>
              Afstemmen
            </Button>
          </div>
          <p className="text-xs mt-1" style={{ color: P.muted }}>
            {s.adjustedAt ? (
              <>
                Afgestemd op {formatDate(s.adjustedAt)}. Het verschil met je transacties (startsaldo, rente) van{" "}
                <Money value={s.adjustment || 0} /> telt mee. Stem opnieuw af als het saldo afwijkt.
              </>
            ) : (
              "Nog niet afgestemd: het saldo is nu alleen berekend uit je geïmporteerde overboekingen. Vul het saldo uit je bankapp in om een startsaldo en rente mee te tellen."
            )}
          </p>
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: P.muted }}>
            Verdelen over doelen
          </label>
          <Select
            value={DISTRIBUTION_MODES.find((m) => m.value === s.mode)?.label || DISTRIBUTION_MODES[0].label}
            onChange={(label) => update({ mode: DISTRIBUTION_MODES.find((m) => m.label === label)?.value || "manual" })}
            options={DISTRIBUTION_MODES.map((m) => m.label)}
          />
          <p className="text-xs mt-1" style={{ color: P.muted }}>
            {s.mode === "priority"
              ? "Het saldo gaat van boven naar beneden naar je doelen, tot elk doelbedrag vol is. Verander de volgorde met de pijltjes."
              : s.mode === "proportional"
                ? "Het saldo wordt verdeeld naar verhouding van de doelbedragen; alle doelen groeien even hard."
                : "Je wijst zelf per doel een bedrag toe. Met de knop hieronder verdeel je in één keer wat nog vrij is."}{" "}
            {s.mode !== "manual" && "De toewijzingen worden automatisch bijgewerkt, ook na een import of opname."}
          </p>
        </div>
      </div>

      {s.mode === "manual" && Math.abs(free) > 0.004 && goalsIn(goals, category).length > 0 && (
        <div className="mb-4">
          <Button
            variant="secondary"
            icon={free > 0 ? Plus : ArrowDown}
            onClick={() => setGoals((list) => distributeRemainder(list, transactions, category, settings))}
          >
            {free > 0 ? (
              <>
                <Money value={free} /> verdelen op volgorde van prioriteit
              </>
            ) : (
              <>
                Toewijzingen verlagen met <Money value={-free} />
              </>
            )}
          </Button>
        </div>
      )}

      {history.some((r) => r.Saldo !== 0 || r.Inleg !== 0) && (
        <>
          <div className="text-xs mb-2" style={{ color: P.muted }}>
            Saldo (lijn) en inleg (staven) per maand, laatste 12 maanden
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke={P.border} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: P.muted }}
                axisLine={{ stroke: P.border }}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: P.muted }} axisLine={false} tickLine={false} width={48} />
              <Tooltip formatter={(v) => formatEuro(v)} contentStyle={tooltipStyle()} />
              <Bar dataKey="Inleg" fill={P.blueLight} radius={[3, 3, 0, 0]} />
              <Line
                type="monotone"
                dataKey="Saldo"
                stroke={P.heading}
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: P.heading }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}

function GoalCard({
  goal,
  rank,
  rankCount,
  categories,
  auto,
  free,
  forecast,
  average,
  onMove,
  onChange,
  onComplete,
  onDelete,
}) {
  const [drafts, setDrafts] = useState({});
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(goal.name);
  const [confirmComplete, setConfirmComplete] = useState(false);

  const allocated = goal.allocated || 0;
  const target = goal.target || 0;
  const progress = target > 0 ? allocated / target : 0;
  const reached = target > 0 && allocated >= target;
  const need = round(Math.max(0, target - allocated));
  const monthsLeft = monthsUntil(goal.targetDate);
  const fieldText = (field) => (drafts[field] !== undefined ? drafts[field] : toText(goal[field]));
  const setDraft = (field) => (value) => setDrafts((d) => ({ ...d, [field]: value }));
  const commit = (field) => (text) => {
    const value = parseAmount(text);
    onChange({ [field]: value === null || value < 0 ? 0 : round(value) });
    setDrafts((d) => {
      const next = { ...d };
      delete next[field];
      return next;
    });
  };
  const saveName = () => {
    if (name.trim()) onChange({ name: name.trim() });
    else setName(goal.name);
    setRenaming(false);
  };

  // Verwachting t.o.v. de streefdatum.
  let forecastLine = null;
  if (goal.category && target > 0 && !reached) {
    if (forecast?.reachable) {
      forecastLine = (
        <span style={{ color: P.income }}>
          Er staat genoeg vrij op de spaarrekening om dit doel nu te halen - verdeel het restant.
        </span>
      );
    } else if (forecast?.month) {
      const late = goal.targetDate ? monthsUntil(forecast.month) - monthsUntil(goal.targetDate) : 0;
      forecastLine = (
        <>
          Bij je gemiddelde inleg van <Money value={average} /> per maand bereikt rond{" "}
          <strong>{monthLabel(forecast.month)}</strong>
          {goal.targetDate &&
            (late <= 0 ? (
              <span style={{ color: P.income }}> - op schema</span>
            ) : (
              <span style={{ color: P.warn }}>
                {" "}
                - ongeveer {late} maand{late !== 1 ? "en" : ""} na de streefdatum
              </span>
            ))}
          .
        </>
      );
    } else {
      forecastLine = "Nog geen verwachting: er is de afgelopen maanden netto niets gespaard.";
    }
  }

  return (
    <div className="rounded-2xl border hb-card p-4" style={{ borderColor: P.border, backgroundColor: P.surface }}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1 basis-44">
          {rankCount > 1 && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: P.paleBlue, color: P.blue }}
              title="Prioriteit binnen deze spaarrekening"
            >
              #{rank}
            </span>
          )}
          {renaming ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") {
                  setName(goal.name);
                  setRenaming(false);
                }
              }}
              className="px-2 py-1 rounded-lg border text-sm font-semibold min-w-0"
              style={{ borderColor: P.border }}
            />
          ) : (
            <span className="text-sm font-semibold truncate" style={{ color: P.text }}>
              {goal.name}
            </span>
          )}
          {reached && (
            <span
              className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: P.successBg, color: P.income }}
            >
              Behaald! 🎉
            </span>
          )}
        </div>
        <div className="flex items-center flex-shrink-0">
          {rankCount > 1 && (
            <>
              <IconButton onClick={() => onMove(-1)} disabled={rank === 1} label="Hogere prioriteit">
                <ArrowUp size={15} />
              </IconButton>
              <IconButton onClick={() => onMove(1)} disabled={rank === rankCount} label="Lagere prioriteit">
                <ArrowDown size={15} />
              </IconButton>
            </>
          )}
          <IconButton onClick={() => setRenaming(true)} label="Naam wijzigen">
            <Pencil size={15} />
          </IconButton>
          <IconButton onClick={() => setConfirmComplete(true)} label="Doel afronden" color={P.income}>
            <Check size={15} />
          </IconButton>
          <IconButton onClick={onDelete} label="Doel verwijderen">
            <Trash2 size={15} />
          </IconButton>
        </div>
      </div>

      {confirmComplete && (
        <div className="rounded-md p-3 mb-3 text-sm" style={{ backgroundColor: P.paleBlue, color: P.heading }}>
          <p className="mb-2">
            Doel <strong>{goal.name}</strong> afronden? De toewijzing van <Money value={allocated} /> komt vrij,
            bijvoorbeeld omdat je het geld hebt opgenomen of uitgegeven. Het doel gaat naar "Afgeronde doelen" en kan
            worden teruggezet.
          </p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              icon={Check}
              onClick={() => {
                setConfirmComplete(false);
                onComplete();
              }}
            >
              Afronden
            </Button>
            <Button variant="ghost" onClick={() => setConfirmComplete(false)}>
              Annuleren
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <Field label="Spaarcategorie">
          <Select
            value={goal.category || ""}
            onChange={(category) => onChange({ category, allocated: 0 })}
            options={categories}
            placeholder="Kies..."
          />
        </Field>
        <Field label="Doelbedrag">
          <EuroInput value={fieldText("target")} onChange={setDraft("target")} onCommit={commit("target")} />
        </Field>
        <Field label={auto ? "Toegewezen (automatisch)" : "Toegewezen"}>
          <EuroInput
            value={auto || !goal.category ? toText(allocated) : fieldText("allocated")}
            onChange={setDraft("allocated")}
            onCommit={commit("allocated")}
            disabled={auto || !goal.category}
          />
        </Field>
        <Field label="Streefdatum (optioneel)">
          <input
            type="month"
            value={goal.targetDate || ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || /^\d{4}-\d{2}$/.test(v)) onChange({ targetDate: v || undefined });
            }}
            placeholder="jjjj-mm"
            className="w-full px-2 py-1.5 rounded-lg border text-sm"
            style={{ borderColor: P.border }}
          />
        </Field>
      </div>

      <div className="text-xs space-y-1 mb-2" style={{ color: P.muted }}>
        {!goal.category ? (
          <p style={{ color: P.warn }}>Kies een spaarcategorie om geld aan dit doel toe te wijzen.</p>
        ) : (
          !auto &&
          Math.abs(free) > 0.004 && (
            <p>
              <Money value={free} /> nog vrij op de spaarrekening ({goal.category}), gedeeld met je andere doelen.
            </p>
          )
        )}
        {target > 0 && !reached && (
          <p>
            Nog <Money value={need} /> nodig
            {goal.targetDate &&
              (monthsLeft > 0 ? (
                <>
                  {" "}
                  · <Money value={round(need / monthsLeft)} /> per maand tot en met {monthLabel(goal.targetDate)}
                </>
              ) : (
                <span style={{ color: P.expense }}> · streefdatum ({monthLabel(goal.targetDate)}) is verstreken</span>
              ))}
          </p>
        )}
        {forecastLine && <p>{forecastLine}</p>}
      </div>

      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: P.muted }}>
          <Money value={allocated} /> van <Money value={target} />
        </span>
        <span className="font-medium" style={{ color: P.muted }}>
          {Math.round(progress * 100)}%
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: P.bg }}>
        <div
          className="h-2 rounded-full"
          style={{ width: `${Math.min(progress, 1) * 100}%`, backgroundColor: reached ? P.income : P.blue }}
        />
      </div>
    </div>
  );
}

export default function Savings({
  categories,
  transactions,
  savingsGoals,
  setSavingsGoals,
  savingsCategory,
  setSavingsCategory,
  savingsSettings,
  setSavingsSettings,
  fixedCategories = [],
  accounts = [],
}) {
  const [newName, setNewName] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const savingsCheck = useSavingsCheck({ transactions, fixedCategories, accounts, savingsCategory, savingsGoals });

  const active = savingsGoals.filter(isActive);
  const completed = savingsGoals.filter((g) => !isActive(g));
  // Standaard-spaarrekening: de ingestelde, anders de categorie die de doelen al gebruiken.
  const defaultCategory = savingsCategory || active.find((g) => g.category)?.category || "";
  const accountCategories = savingsCategoriesInUse(savingsGoals, defaultCategory);
  const overAllocated = accountCategories.filter(
    (c) => categoryBalance(transactions, c, savingsSettings) - allocatedIn(savingsGoals, c) < -0.004,
  );

  const addGoal = () => {
    const name = newName.trim();
    if (!name) return;
    setSavingsGoals((list) => [
      ...list,
      { id: newId(), name, target: 0, allocated: 0, category: defaultCategory, status: "active" },
    ]);
    setNewName("");
  };
  const updateGoal = (id, changes) =>
    setSavingsGoals((list) => list.map((g) => (g.id === id ? { ...g, ...changes } : g)));
  const deleteGoal = (goal) => {
    if (!window.confirm(`Spaardoel "${goal.name}" verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;
    setSavingsGoals((list) => list.filter((g) => g.id !== goal.id));
  };
  const completeGoal = (goal) =>
    updateGoal(goal.id, {
      status: "completed",
      completedAt: toIsoDate(new Date()),
      allocatedAtCompletion: goal.allocated || 0,
      allocated: 0,
    });
  const restoreGoal = (goal) => {
    const { completedAt, allocatedAtCompletion, ...rest } = goal;
    const auto = settingsFor(savingsSettings, goal.category).mode !== "manual";
    setSavingsGoals((list) => [
      ...list.filter((g) => g.id !== goal.id && isActive(g)),
      { ...rest, status: "active", allocated: auto ? 0 : allocatedAtCompletion || 0 },
      ...list.filter((g) => g.id !== goal.id && !isActive(g)),
    ]);
  };
  // Prioriteit = volgorde; verplaatsen binnen de doelen van dezelfde spaarrekening.
  const moveGoal = (goal, dir) =>
    setSavingsGoals((list) => {
      const same = goalsIn(list, goal.category);
      const idx = same.findIndex((g) => g.id === goal.id);
      const other = same[idx + dir];
      if (!other) return list;
      const a = list.findIndex((g) => g.id === goal.id);
      const b = list.findIndex((g) => g.id === other.id);
      const next = [...list];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: P.heading }}>
        Spaardoelen
      </h1>
      <p className="text-sm mb-5" style={{ color: P.muted }}>
        Verdeel het geld op je spaarrekening over je doelen. Kies welke categorie je spaarrekening is, stem het saldo af
        met je bank, en laat de app het geld automatisch verdelen - of wijs het zelf toe.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <span className="text-sm" style={{ color: P.text }}>
          Categorie van je spaarrekening:
        </span>
        <div className="w-56">
          <Select
            value={defaultCategory}
            onChange={setSavingsCategory}
            options={categories}
            placeholder="Kies categorie..."
          />
        </div>
      </div>

      {savingsCheck.warnings.map((w) => (
        <SavingsWarning key={w.category} warning={w} onDismiss={() => savingsCheck.dismiss(w)} />
      ))}

      {accountCategories.map((c) => (
        <SavingsAccountCard
          key={c}
          category={c}
          transactions={transactions}
          goals={savingsGoals}
          settings={savingsSettings}
          setSettings={setSavingsSettings}
          setGoals={setSavingsGoals}
        />
      ))}

      {overAllocated.length > 0 && (
        <div
          className="flex items-start gap-2 p-3 rounded-md mb-5 text-sm"
          style={{ backgroundColor: P.errorBg, color: P.expense }}
        >
          <CircleAlert size={16} className="mt-0.5 flex-shrink-0" />
          <span>
            Er is meer toegewezen dan er op de spaarrekening staat ({overAllocated.join(", ")}). Heb je geld opgenomen
            voor een doel? Rond dat doel dan af, of verlaag de toewijzingen met de knop hierboven.
          </span>
        </div>
      )}

      <div className="flex gap-2 mb-5 max-w-md">
        <input
          type="text"
          placeholder="Nieuw spaardoel, bv. Vakantie..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addGoal()}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border text-sm"
          style={{ borderColor: P.border }}
        />
        <Button variant="primary" icon={Plus} onClick={addGoal}>
          Doel toevoegen
        </Button>
      </div>

      {active.length === 0 ? (
        <EmptyState title="Nog geen spaardoelen" text="Voeg hierboven je eerste spaardoel toe." />
      ) : (
        <div className="space-y-4">
          {active.map((goal) => {
            const same = goalsIn(savingsGoals, goal.category);
            const settings = settingsFor(savingsSettings, goal.category);
            return (
              <GoalCard
                key={goal.id}
                goal={goal}
                rank={goal.category ? same.findIndex((g) => g.id === goal.id) + 1 : 1}
                rankCount={goal.category ? same.length : 1}
                categories={categories}
                auto={!!goal.category && settings.mode !== "manual"}
                free={round(
                  categoryBalance(transactions, goal.category, savingsSettings) -
                    allocatedIn(savingsGoals, goal.category),
                )}
                forecast={forecastGoal(goal, savingsGoals, transactions, savingsSettings)}
                average={averageMonthlySaving(transactions, goal.category).average}
                onMove={(dir) => moveGoal(goal, dir)}
                onChange={(changes) => updateGoal(goal.id, changes)}
                onComplete={() => completeGoal(goal)}
                onDelete={() => deleteGoal(goal)}
              />
            );
          })}
        </div>
      )}

      {completed.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="text-xs font-medium underline"
            style={{ color: P.blue }}
          >
            {showCompleted ? "Verberg" : "Toon"} afgeronde doelen ({completed.length})
          </button>
          {showCompleted && (
            <div
              className="rounded-2xl border hb-card overflow-hidden mt-3"
              style={{ borderColor: P.border, backgroundColor: P.surface }}
            >
              {completed.map((goal, i) => (
                <div
                  key={goal.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                  style={{ borderTop: i > 0 ? `1px solid ${P.border}` : "none" }}
                >
                  <div className="text-sm min-w-0" style={{ color: P.text }}>
                    <span className="font-medium">{goal.name}</span>
                    <span className="text-xs ml-2" style={{ color: P.muted }}>
                      doel <Money value={goal.target || 0} />
                      {goal.allocatedAtCompletion > 0 && (
                        <>
                          {" "}
                          · had <Money value={goal.allocatedAtCompletion} />
                        </>
                      )}
                      {goal.completedAt && <> · afgerond op {formatDate(goal.completedAt)}</>}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <button
                      onClick={() => restoreGoal(goal)}
                      className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded hover:bg-black/5"
                      style={{ color: P.blue }}
                    >
                      <RotateCcw size={13} /> Terugzetten
                    </button>
                    <IconButton onClick={() => deleteGoal(goal)} label="Doel verwijderen">
                      <X size={15} />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
