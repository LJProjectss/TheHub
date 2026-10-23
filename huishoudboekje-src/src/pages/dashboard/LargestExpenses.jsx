import { P } from "../../theme";
import { UNCATEGORIZED, formatDate } from "../../lib/format";
import { Amount } from "../../components/ui";
import { CategoryLink, card } from "./parts";

// De grootste uitgaven van de periode: tabel op de computer, lijst op de telefoon.
export default function LargestExpenses({ list, onCategory }) {
  return (
    <div className="rounded-2xl border hb-card overflow-hidden" style={card()}>
      <table className="w-full hidden sm:table">
        <tbody>
          {list.map((t, i) => (
            <tr key={t.id} style={{ borderTop: i > 0 ? `1px solid ${P.border}` : "none" }}>
              <td className="py-2.5 pl-5 pr-3 text-sm whitespace-nowrap" style={{ color: P.muted }}>
                {formatDate(t.date)}
              </td>
              <td className="py-2.5 pr-3 text-sm" style={{ color: P.text }}>
                {t.description}
                {t.note && (
                  <span className="ml-2 text-xs italic" style={{ color: P.muted }}>
                    ({t.note})
                  </span>
                )}
              </td>
              <td className="py-2.5 pr-3 text-xs whitespace-nowrap">
                <CategoryLink naam={t.category || UNCATEGORIZED} onClick={onCategory} muted />
              </td>
              <td className="py-2.5 pr-5 text-right">
                <Amount value={t.amount} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="sm:hidden">
        {list.map((t, i) => (
          <div
            key={t.id}
            className="flex items-start justify-between gap-3 px-5 py-3"
            style={{ borderTop: i > 0 ? `1px solid ${P.border}` : "none" }}
          >
            <div className="min-w-0">
              <div className="text-sm" style={{ color: P.text }}>
                {t.description}
              </div>
              <div className="flex items-center gap-2 text-xs mt-0.5" style={{ color: P.muted }}>
                <span>{formatDate(t.date)}</span>
                <span>·</span>
                <CategoryLink naam={t.category || UNCATEGORIZED} onClick={onCategory} muted />
              </div>
            </div>
            <Amount value={t.amount} className="flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
