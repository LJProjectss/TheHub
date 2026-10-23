import { P } from "../../theme";
import { rangeOf } from "../../lib/comparison";
import PeriodPicker from "../../components/PeriodPicker";
import { card } from "./parts";

// Snelkeuzes voor de vergelijking, plus "Zelf kiezen" met twee periodekiezers.
export default function PresetPicker({
  presets,
  presetKey,
  setPresetKey,
  available,
  customA,
  setCustomA,
  customB,
  setCustomB,
  rangeA,
  rawB,
  transactions,
}) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => {
          const ok = available(p);
          const active = presetKey === p.key;
          return (
            <button
              key={p.key}
              onClick={() => ok && setPresetKey(p.key)}
              disabled={!ok}
              className="text-left rounded-2xl border hb-card px-3 py-2 text-sm disabled:cursor-not-allowed"
              style={{
                borderColor: active ? P.blue : P.border,
                backgroundColor: active ? P.paleBlue : P.surface,
                color: ok ? P.text : P.muted,
                opacity: ok ? 1 : 0.6,
              }}
              title={ok ? "" : "Nog geen gegevens voor een van beide periodes"}
            >
              <div className="font-medium">{p.title}</div>
              <div className="text-xs" style={{ color: P.muted }}>
                {ok ? `${rangeOf(p.a).label} vs. ${rangeOf(p.b).label}` : "nog geen gegevens"}
              </div>
            </button>
          );
        })}
        <button
          onClick={() => setPresetKey("custom")}
          className="text-left rounded-2xl border hb-card px-3 py-2 text-sm"
          style={{
            borderColor: presetKey === "custom" ? P.blue : P.border,
            backgroundColor: presetKey === "custom" ? P.paleBlue : P.surface,
            color: P.text,
          }}
        >
          <div className="font-medium">Zelf kiezen</div>
          <div className="text-xs" style={{ color: P.muted }}>
            twee willekeurige periodes
          </div>
        </button>
      </div>

      {presetKey === "custom" && (
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            ["A", customA, setCustomA, rangeA],
            ["B", customB, setCustomB, rawB],
          ].map(([name, period, setPeriod, range]) => (
            <div key={name} className="rounded-2xl border hb-card p-3" style={card()}>
              <div className="text-xs font-semibold mb-2" style={{ color: name === "A" ? P.blue : P.muted }}>
                Periode {name}
              </div>
              <PeriodPicker
                period={period}
                setPeriod={setPeriod}
                range={range}
                transactions={transactions}
                labelSuffix={` ${name}`}
                showThisMonth={false}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
