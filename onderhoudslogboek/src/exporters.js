// Export: JSON-back-up, Excel en agenda (.ics)
import { downloadBlob, fileStamp, parseISO, yearOf, dueText, repeatText, fmtDate, planStatus } from './utils.js';
import { makeT } from './i18n.js';

/* ---------- JSON ---------- */

export function exportJson(state) {
  const data = { app: 'onderhoudslogboek', exportedAt: new Date().toISOString(), ...state };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `onderhoudslogboek-backup-${fileStamp()}.json`);
}

/* ---------- ICS ---------- */

function icsEscape(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Regels langer dan 75 bytes worden gevouwen (RFC 5545)
function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '';
  let curBytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // vervolgregels beginnen met een spatie
    if (curBytes + b > limit) {
      out.push(cur);
      cur = '';
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const icsDate = (iso) => iso.replace(/-/g, '');

function nextDay(iso) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/** Geeft {count, skipped} terug; downloadt alleen als er iets te exporteren is */
export function exportIcs(state, planIds = null) {
  const { settings } = state;
  const t = makeT(settings.lang);
  const itemsById = Object.fromEntries(state.items.map((i) => [i.id, i]));
  const plans = state.plans.filter(
    (p) => itemsById[p.itemId] && (!planIds || planIds.includes(p.id))
  );
  const withDate = plans.filter((p) => p.dueDate);
  const skipped = plans.length - withDate.length;
  if (!withDate.length) return { count: 0, skipped };

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Onderhoudslogboek//NL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(t('appName'))}`
  ];
  for (const p of withDate) {
    const item = itemsById[p.itemId];
    const notifyDays = p.notifyDays ?? settings.notifyDays;
    const descParts = [
      `${t('type_' + item.type)}: ${item.name}`,
      p.description,
      `${t('due')}: ${dueText(p, t, settings)}`,
      repeatText(p, t, settings)
    ].filter(Boolean);
    const summary = `${item.name}: ${p.name}`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${p.id}@onderhoudslogboek`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(p.dueDate)}`,
      `DTEND;VALUE=DATE:${nextDay(p.dueDate)}`,
      `SUMMARY:${icsEscape(summary)}`,
      `DESCRIPTION:${icsEscape(descParts.join('\n'))}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsEscape(summary)}`,
      // Herinnering om 09:00 uur, het ingestelde aantal dagen van tevoren
      notifyDays > 0 ? `TRIGGER:-P${notifyDays - 1}DT15H` : 'TRIGGER:PT9H',
      'END:VALARM',
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  const text = lines.map(fold).join('\r\n') + '\r\n';
  downloadBlob(new Blob([text], { type: 'text/calendar;charset=utf-8' }), `onderhoud-agenda-${fileStamp()}.ics`);
  return { count: withDate.length, skipped };
}

/* ---------- Excel ---------- */

function itemDetails(item, t) {
  const f = item.fields || {};
  const pairs = [];
  const add = (key, val) => val && pairs.push(`${t(key)}: ${val}`);
  if (item.type === 'auto') {
    add('licensePlate', f.licensePlate); add('brand', f.brand); add('model', f.model); add('buildYear', f.buildYear);
  } else if (item.type === 'huis') {
    add('address', f.address); add('buildYear', f.buildYear);
  } else {
    add('brand', f.brand); add('modelNumber', f.modelNumber);
    add('purchaseDate', fmtDate(f.purchaseDate)); add('warrantyUntil', fmtDate(f.warrantyUntil));
  }
  return pairs.join(' · ');
}

const toDate = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)); // UTC voorkomt verschuiving in Excel
};

export async function exportExcel(state) {
  const { default: ExcelJS } = await import('exceljs');
  const { settings } = state;
  const t = makeT(settings.lang);
  const money = settings.currency === 'USD' ? '"$"#,##0.00' : '"€" #,##0.00';
  const dateFmt = 'dd-mm-yyyy';
  const kmFmt = '#,##0';
  const itemsById = Object.fromEntries(state.items.map((i) => [i.id, i]));

  const wb = new ExcelJS.Workbook();
  wb.creator = t('appName');
  wb.created = new Date();

  const style = (ws) => {
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF155E75' } };
    header.alignment = { vertical: 'middle' };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    if (ws.rowCount > 1) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  };

  // Items
  const wsI = wb.addWorksheet(t('xlsItems'));
  wsI.columns = [
    { header: t('name'), key: 'name', width: 28 },
    { header: t('type'), key: 'type', width: 12 },
    { header: t('details'), key: 'details', width: 60 },
    { header: t('currentKm'), key: 'km', width: 18, style: { numFmt: kmFmt } },
    { header: t('totalCosts'), key: 'total', width: 16, style: { numFmt: money } },
    { header: t('notes'), key: 'notes', width: 40 }
  ];
  for (const i of state.items) {
    const total = state.logs.filter((l) => l.itemId === i.id).reduce((s, l) => s + (l.cost || 0), 0);
    wsI.addRow({ name: i.name, type: t('type_' + i.type), details: itemDetails(i, t), km: i.currentKm ?? null, total, notes: i.notes || '' });
  }
  style(wsI);

  // Logboek
  const wsL = wb.addWorksheet(t('xlsLog'));
  wsL.columns = [
    { header: t('item'), key: 'item', width: 26 },
    { header: t('type'), key: 'type', width: 12 },
    { header: t('date'), key: 'date', width: 13, style: { numFmt: dateFmt } },
    { header: t('name'), key: 'name', width: 28 },
    { header: t('description'), key: 'desc', width: 44 },
    { header: t('km'), key: 'km', width: 12, style: { numFmt: kmFmt } },
    { header: t('cost'), key: 'cost', width: 14, style: { numFmt: money } },
    { header: t('nextMaintenance'), key: 'next', width: 26 }
  ];
  const logs = state.logs
    .filter((l) => itemsById[l.itemId])
    .slice()
    .sort((a, b) => (itemsById[a.itemId].name.localeCompare(itemsById[b.itemId].name)) || a.date.localeCompare(b.date));
  for (const l of logs) {
    const item = itemsById[l.itemId];
    wsL.addRow({
      item: item.name, type: t('type_' + item.type), date: toDate(l.date), name: l.name,
      desc: l.description || '', km: l.km ?? null, cost: l.cost ?? null,
      next: dueText({ dueDate: l.nextDate, dueKm: l.nextKm }, t, settings)
    });
  }
  style(wsL);

  // Planning
  const wsP = wb.addWorksheet(t('xlsPlanning'));
  wsP.columns = [
    { header: t('item'), key: 'item', width: 26 },
    { header: t('task'), key: 'name', width: 28 },
    { header: t('description'), key: 'desc', width: 36 },
    { header: t('date'), key: 'date', width: 13, style: { numFmt: dateFmt } },
    { header: t('fixedKm'), key: 'km', width: 14, style: { numFmt: kmFmt } },
    { header: t('intervalMonths'), key: 'im', width: 16 },
    { header: t('intervalKm'), key: 'ik', width: 14, style: { numFmt: kmFmt } },
    { header: `${t('notifyBefore')} (${t('notifyDaysBefore')})`, key: 'nd', width: 26 },
    { header: t('status'), key: 'status', width: 14 }
  ];
  for (const p of state.plans) {
    const item = itemsById[p.itemId];
    if (!item) continue;
    const st = planStatus(p, item, settings);
    wsP.addRow({
      item: item.name, name: p.name, desc: p.description || '', date: toDate(p.dueDate), km: p.dueKm ?? null,
      im: p.intervalMonths || null, ik: p.intervalKm || null, nd: st.notifyDays, status: t('status_' + st.status)
    });
  }
  style(wsP);

  // Kosten per jaar (item x jaar)
  const years = [...new Set(state.logs.map((l) => yearOf(l.date)))].filter(Boolean).sort();
  const wsK = wb.addWorksheet(t('xlsCosts'));
  wsK.columns = [
    { header: t('item'), key: 'item', width: 26 },
    ...years.map((y) => ({ header: String(y), key: 'y' + y, width: 13, style: { numFmt: money } })),
    { header: t('total'), key: 'total', width: 15, style: { numFmt: money } }
  ];
  const totals = {};
  for (const i of state.items) {
    const row = { item: i.name };
    let tot = 0;
    for (const y of years) {
      const s = state.logs.filter((l) => l.itemId === i.id && yearOf(l.date) === y).reduce((a, l) => a + (l.cost || 0), 0);
      row['y' + y] = s;
      totals['y' + y] = (totals['y' + y] || 0) + s;
      tot += s;
    }
    row.total = tot;
    totals.total = (totals.total || 0) + tot;
    wsK.addRow(row);
  }
  const totRow = wsK.addRow({ item: t('total'), ...totals });
  totRow.font = { bold: true };
  style(wsK);

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `onderhoudslogboek-${fileStamp()}.xlsx`
  );
}
