import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { P } from "../../theme";
import { Money } from "../../components/ui";
import { COLOR_A, COLOR_B, card } from "./parts";

// Opgeteld verloop van de uitgaven (A tegenover B), met een zin over voor- of achterstand.
export function CumulativeChart({ data, lastA, gap, byDay, labelA, labelB, tooltip }) {
  return (
    <div className="rounded-2xl border hb-card p-5" style={card()}>
      <h2 className="text-sm font-semibold mb-1" style={{ color: P.heading }}>
        Opgeteld verloop van de uitgaven
      </h2>
      <p className="text-xs mb-3" style={{ color: P.muted }}>
        {gap !== null && Math.abs(gap) >= 0.005 ? (
          <>
            Op {data[lastA].x} lag {labelA} <Money value={Math.abs(gap)} />{" "}
            <span style={{ color: gap > 0 ? P.expense : P.income }}>{gap > 0 ? "hoger" : "lager"}</span> dan {labelB}.
          </>
        ) : (
          `Per ${byDay ? "dag" : "maand"} opgeteld: ligt ${labelA} voor of achter op ${labelB}?`
        )}
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={P.border} vertical={false} />
          <XAxis
            dataKey="x"
            tick={{ fontSize: 11, fill: P.muted }}
            axisLine={{ stroke: P.border }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis tick={{ fontSize: 11, fill: P.muted }} axisLine={false} tickLine={false} width={52} />
          <Tooltip {...tooltip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="A"
            name={`A · ${labelA}`}
            stroke={COLOR_A()}
            strokeWidth={2.5}
            dot={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="B"
            name={`B · ${labelB}`}
            stroke={COLOR_B()}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Uitgaven maand naast maand.
export function MonthByMonthChart({ data, labelA, labelB, tooltip }) {
  return (
    <div className="rounded-2xl border hb-card p-5" style={card()}>
      <h2 className="text-sm font-semibold mb-3" style={{ color: P.heading }}>
        Uitgaven maand naast maand
      </h2>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke={P.border} vertical={false} />
          <XAxis dataKey="x" tick={{ fontSize: 11, fill: P.muted }} axisLine={{ stroke: P.border }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: P.muted }} axisLine={false} tickLine={false} width={52} />
          <Tooltip {...tooltip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="A" name={`A · ${labelA}`} fill={COLOR_A()} radius={[3, 3, 0, 0]} />
          <Bar dataKey="B" name={`B · ${labelB}`} fill={P.blueLight} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// De grootste categorieën naast elkaar (liggende balken).
export function TopCategoriesChart({ data, labelA, labelB, tooltip }) {
  return (
    <div className="rounded-2xl border hb-card p-5" style={card()}>
      <h2 className="text-sm font-semibold mb-3" style={{ color: P.heading }}>
        Grootste categorieën naast elkaar
      </h2>
      <ResponsiveContainer width="100%" height={Math.max(160, data.length * 44)}>
        <BarChart data={data} layout="vertical" barGap={2} margin={{ left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={P.border} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: P.muted }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="naam"
            tick={{ fontSize: 11, fill: P.text }}
            axisLine={false}
            tickLine={false}
            width={110}
          />
          <Tooltip {...tooltip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="A" name={`A · ${labelA}`} fill={COLOR_A()} radius={[0, 3, 3, 0]} />
          <Bar dataKey="B" name={`B · ${labelB}`} fill={P.blueLight} radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
