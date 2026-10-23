// Grafieken van het Overzicht. Apart bestand, zodat de grafiekbibliotheek pas laadt
// nadat de cijfers al op het scherm staan.
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { P } from "../theme";
import { formatEuro } from "../lib/format";
import { tooltipStyle } from "./ui";

export function IncomeExpenseChart({ series, compareLastYear }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={series} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke={P.border} vertical={false} />
        <XAxis dataKey="naam" tick={{ fontSize: 11, fill: P.muted }} axisLine={{ stroke: P.border }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: P.muted }} axisLine={false} tickLine={false} width={52} />
        {/* Opgebouwd saldo loopt veel hoger op dan de maandbedragen: eigen as rechts. */}
        <YAxis
          yAxisId="saldo"
          orientation="right"
          tick={{ fontSize: 11, fill: P.income }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip formatter={(v) => formatEuro(v)} contentStyle={tooltipStyle()} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Inkomsten" fill={P.blueLight} radius={[3, 3, 0, 0]} />
        <Bar dataKey="Uitgaven" fill={P.heading} radius={[3, 3, 0, 0]} />
        <Line yAxisId="saldo" type="monotone" dataKey="Opgebouwd saldo" stroke={P.income} strokeWidth={2.5} dot={false} />
        {compareLastYear && (
          <Line
            type="monotone"
            dataKey="Uitgaven jaar eerder"
            stroke={P.expense}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function TrendChart({ trend }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={trend}>
        <CartesianGrid strokeDasharray="3 3" stroke={P.border} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: P.muted }} axisLine={{ stroke: P.border }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: P.muted }} axisLine={false} tickLine={false} width={44} />
        <Tooltip formatter={(v) => formatEuro(v)} contentStyle={tooltipStyle()} />
        <Line
          type="monotone"
          dataKey="Uitgaven"
          stroke={P.blue}
          strokeWidth={2.5}
          dot={{ r: 3, fill: P.blue }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
