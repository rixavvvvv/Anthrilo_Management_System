import type { SalesActivityRow } from '@/components/reports/SizeWiseReportTable';

// ── Grouping helpers ──────────────────────────────────────────────

export function generateSizeWiseReport(items: SalesActivityRow[]) {
  const map: Record<string, {
    item_sku_code: string; item_type_name: string; size: string;
    total_sale_qty: number; cancel_qty: number; return_qty: number; net_sale: number;
    stock_good: number; stock_virtual: number;
  }> = {};
  for (const r of items) {
    const key = `${r.item_sku_code}||${r.size}`;
    if (!map[key]) {
      map[key] = {
        item_sku_code: r.item_sku_code, item_type_name: r.item_type_name, size: r.size,
        total_sale_qty: 0, cancel_qty: 0, return_qty: 0, net_sale: 0,
        stock_good: r.stock_good, stock_virtual: r.stock_virtual,
      };
    }
    map[key].total_sale_qty += r.total_sale_qty;
    map[key].cancel_qty += r.cancel_qty;
    map[key].return_qty += r.return_qty;
    map[key].net_sale += r.net_sale;
    if (!map[key].item_type_name && r.item_type_name) map[key].item_type_name = r.item_type_name;
  }
  return Object.values(map).sort((a, b) => a.item_sku_code.localeCompare(b.item_sku_code));
}

export function generateItemWiseReport(items: SalesActivityRow[]) {
  const map: Record<string, {
    item_type_name: string;
    total_sale_qty: number; cancel_qty: number; return_qty: number; net_sale: number;
    stock_good: number; stock_virtual: number;
  }> = {};
  const seenSkus: Record<string, Set<string>> = {};
  for (const r of items) {
    const key = r.item_type_name || '(unknown)';
    if (!map[key]) {
      map[key] = {
        item_type_name: key,
        total_sale_qty: 0, cancel_qty: 0, return_qty: 0, net_sale: 0,
        stock_good: 0, stock_virtual: 0,
      };
      seenSkus[key] = new Set();
    }
    map[key].total_sale_qty += r.total_sale_qty;
    map[key].cancel_qty += r.cancel_qty;
    map[key].return_qty += r.return_qty;
    map[key].net_sale += r.net_sale;
    // Only count inventory once per unique SKU (same SKU appears in multiple channels)
    if (r.item_sku_code && !seenSkus[key].has(r.item_sku_code)) {
      seenSkus[key].add(r.item_sku_code);
      map[key].stock_good += r.stock_good;
      map[key].stock_virtual += r.stock_virtual;
    }
  }
  return Object.values(map).sort((a, b) => a.item_type_name.localeCompare(b.item_type_name));
}

export function generateChannelWiseDetailed(items: SalesActivityRow[]) {
  return [...items].sort((a, b) =>
    a.item_sku_code.localeCompare(b.item_sku_code) || a.size.localeCompare(b.size) || a.channel.localeCompare(b.channel)
  );
}

export function generateChannelWiseSummary(items: SalesActivityRow[]) {
  const map: Record<string, {
    item_type_name: string; channel: string;
    total_sale_qty: number; cancel_qty: number; return_qty: number; net_sale: number;
    stock_good: number; stock_virtual: number;
  }> = {};
  for (const r of items) {
    const key = `${r.item_type_name || '(unknown)'}||${r.channel}`;
    if (!map[key]) {
      map[key] = {
        item_type_name: r.item_type_name || '(unknown)', channel: r.channel,
        total_sale_qty: 0, cancel_qty: 0, return_qty: 0, net_sale: 0,
        stock_good: 0, stock_virtual: 0,
      };
    }
    map[key].total_sale_qty += r.total_sale_qty;
    map[key].cancel_qty += r.cancel_qty;
    map[key].return_qty += r.return_qty;
    map[key].net_sale += r.net_sale;
    map[key].stock_good += r.stock_good;
    map[key].stock_virtual += r.stock_virtual;
  }
  return Object.values(map).sort((a, b) => a.item_type_name.localeCompare(b.item_type_name) || a.channel.localeCompare(b.channel));
}

// ── Excel export ──────────────────────────────────────────────

export type ReportType = 'size-wise' | 'item-wise' | 'channel-detailed' | 'channel-summary';

export async function generateSalesActivityExcel(
  items: SalesActivityRow[],
  fromDate: string,
  toDate: string,
  reportType: ReportType,
) {
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Anthrilo ERP';
  wb.created = new Date();

  const REPORT_LABELS: Record<ReportType, string> = {
    'size-wise': 'Size Wise',
    'item-wise': 'Item Wise',
    'channel-detailed': 'Channel Wise',
    'channel-summary': 'Channel Wise Summary',
  };

  const ws = wb.addWorksheet(REPORT_LABELS[reportType]);

  // ── Styles ──
  const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF4472C4' } };
  const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  const sectionFont = { bold: true, size: 13, color: { argb: 'FF1F2937' } };
  const metaFont = { size: 11, color: { argb: 'FF374151' } };
  const totalFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE5E7EB' } };
  const totalFont = { bold: true, size: 11 };

  const applyHeaderRow = (row: any) => {
    row.eachCell((cell: any) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFB0B0B0' } },
      };
    });
    row.height = 24;
  };

  const applyTotalRow = (row: any) => {
    row.eachCell((cell: any) => {
      cell.fill = totalFill;
      cell.font = totalFont;
    });
  };

  let rowNum = 1;

  // ── Selection In Reports ──
  const titleRow = ws.getRow(rowNum);
  titleRow.getCell(1).value = 'Selection In Reports';
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF111827' } };
  rowNum += 2;

  const selectionItems = [
    `Date Range: ${fromDate} to ${toDate}`,
    `Report: ${REPORT_LABELS[reportType]}`,
  ];
  for (let i = 0; i < selectionItems.length; i++) {
    const r = ws.getRow(rowNum);
    r.getCell(1).value = i + 1;
    r.getCell(1).font = metaFont;
    r.getCell(2).value = selectionItems[i];
    r.getCell(2).font = metaFont;
    rowNum++;
  }
  rowNum += 2;

  // ── Only generate the selected report type ──

  if (reportType === 'size-wise') {
  // ── SIZE WISE ──
  const sizeData = generateSizeWiseReport(items);
  const sizeRow = ws.getRow(rowNum);
  sizeRow.getCell(1).value = 'Size Wise →';
  sizeRow.getCell(1).font = sectionFont;
  rowNum++;

  const sizeHeaders = ['Item SKU Code', 'Item Type Name', 'Size', 'Total Sale Qty', 'Cancel', 'Return', 'Net Sale', 'Stock in Hand (Good)', 'Stock in Hand (Virtual)'];
  const sizeHdrRow = ws.getRow(rowNum);
  sizeHeaders.forEach((h, i) => { sizeHdrRow.getCell(i + 1).value = h; });
  applyHeaderRow(sizeHdrRow);
  rowNum++;

  let sizeTotals = { sale: 0, cancel: 0, ret: 0, net: 0 };
  for (const d of sizeData) {
    const r = ws.getRow(rowNum);
    r.getCell(1).value = d.item_sku_code;
    r.getCell(2).value = d.item_type_name;
    r.getCell(3).value = d.size;
    r.getCell(4).value = d.total_sale_qty;
    r.getCell(5).value = d.cancel_qty;
    r.getCell(6).value = d.return_qty;
    r.getCell(7).value = d.net_sale;
    r.getCell(8).value = d.stock_good;
    r.getCell(9).value = d.stock_virtual;
    // Right-align numbers
    for (let c = 4; c <= 9; c++) r.getCell(c).alignment = { horizontal: 'right' };
    sizeTotals.sale += d.total_sale_qty;
    sizeTotals.cancel += d.cancel_qty;
    sizeTotals.ret += d.return_qty;
    sizeTotals.net += d.net_sale;
    rowNum++;
  }
  const sizeTotalRow = ws.getRow(rowNum);
  sizeTotalRow.getCell(1).value = 'Total';
  sizeTotalRow.getCell(4).value = sizeTotals.sale;
  sizeTotalRow.getCell(5).value = sizeTotals.cancel;
  sizeTotalRow.getCell(6).value = sizeTotals.ret;
  sizeTotalRow.getCell(7).value = sizeTotals.net;
  applyTotalRow(sizeTotalRow);
  for (let c = 4; c <= 9; c++) sizeTotalRow.getCell(c).alignment = { horizontal: 'right' };
  } // end size-wise

  if (reportType === 'item-wise') {
  // ── ITEM WISE ──
  const itemData = generateItemWiseReport(items);
  const itemSectionRow = ws.getRow(rowNum);
  itemSectionRow.getCell(1).value = 'Item Wise →';
  itemSectionRow.getCell(1).font = sectionFont;
  rowNum++;

  const itemHeaders = ['Item Type Name', 'Total Sale Qty', 'Cancel', 'Return', 'Net Sale', 'Stock in Hand (Good)', 'Stock in Hand (Virtual)'];
  const itemHdrRow = ws.getRow(rowNum);
  itemHeaders.forEach((h, i) => { itemHdrRow.getCell(i + 1).value = h; });
  applyHeaderRow(itemHdrRow);
  rowNum++;

  let itemTotals = { sale: 0, cancel: 0, ret: 0, net: 0 };
  for (const d of itemData) {
    const r = ws.getRow(rowNum);
    r.getCell(1).value = d.item_type_name;
    r.getCell(2).value = d.total_sale_qty;
    r.getCell(3).value = d.cancel_qty;
    r.getCell(4).value = d.return_qty;
    r.getCell(5).value = d.net_sale;
    r.getCell(6).value = d.stock_good;
    r.getCell(7).value = d.stock_virtual;
    for (let c = 2; c <= 7; c++) r.getCell(c).alignment = { horizontal: 'right' };
    itemTotals.sale += d.total_sale_qty;
    itemTotals.cancel += d.cancel_qty;
    itemTotals.ret += d.return_qty;
    itemTotals.net += d.net_sale;
    rowNum++;
  }
  const itemTotalRow = ws.getRow(rowNum);
  itemTotalRow.getCell(1).value = 'Total';
  itemTotalRow.getCell(2).value = itemTotals.sale;
  itemTotalRow.getCell(3).value = itemTotals.cancel;
  itemTotalRow.getCell(4).value = itemTotals.ret;
  itemTotalRow.getCell(5).value = itemTotals.net;
  applyTotalRow(itemTotalRow);
  for (let c = 2; c <= 7; c++) itemTotalRow.getCell(c).alignment = { horizontal: 'right' };
  } // end item-wise

  if (reportType === 'channel-detailed') {
  // ── CHANNEL WISE (DETAILED) ──
  const chData = generateChannelWiseDetailed(items);
  const chSectionRow = ws.getRow(rowNum);
  chSectionRow.getCell(1).value = 'Channel Wise →';
  chSectionRow.getCell(1).font = sectionFont;
  rowNum++;

  const chHeaders = ['Item SKU Code', 'Item Type Name', 'Size', 'Channel', 'Total Sale Qty', 'Cancel', 'Return', 'Net Sale', 'Stock in Hand (Good)', 'Stock in Hand (Virtual)'];
  const chHdrRow = ws.getRow(rowNum);
  chHeaders.forEach((h, i) => { chHdrRow.getCell(i + 1).value = h; });
  applyHeaderRow(chHdrRow);
  rowNum++;

  let chTotals = { sale: 0, cancel: 0, ret: 0, net: 0 };
  for (const d of chData) {
    const r = ws.getRow(rowNum);
    r.getCell(1).value = d.item_sku_code;
    r.getCell(2).value = d.item_type_name;
    r.getCell(3).value = d.size;
    r.getCell(4).value = d.channel;
    r.getCell(5).value = d.total_sale_qty;
    r.getCell(6).value = d.cancel_qty;
    r.getCell(7).value = d.return_qty;
    r.getCell(8).value = d.net_sale;
    r.getCell(9).value = d.stock_good;
    r.getCell(10).value = d.stock_virtual;
    for (let c = 5; c <= 10; c++) r.getCell(c).alignment = { horizontal: 'right' };
    chTotals.sale += d.total_sale_qty;
    chTotals.cancel += d.cancel_qty;
    chTotals.ret += d.return_qty;
    chTotals.net += d.net_sale;
    rowNum++;
  }
  const chTotalRow = ws.getRow(rowNum);
  chTotalRow.getCell(1).value = 'Total';
  chTotalRow.getCell(5).value = chTotals.sale;
  chTotalRow.getCell(6).value = chTotals.cancel;
  chTotalRow.getCell(7).value = chTotals.ret;
  chTotalRow.getCell(8).value = chTotals.net;
  applyTotalRow(chTotalRow);
  for (let c = 5; c <= 10; c++) chTotalRow.getCell(c).alignment = { horizontal: 'right' };
  } // end channel-detailed

  if (reportType === 'channel-summary') {
  // ── CHANNEL WISE (SUMMARY) ──
  const csData = generateChannelWiseSummary(items);
  const csSectionRow = ws.getRow(rowNum);
  csSectionRow.getCell(1).value = 'Channel Wise Summary →';
  csSectionRow.getCell(1).font = sectionFont;
  rowNum++;

  const csHeaders = ['Item Type Name', 'Channel', 'Total Sale Qty', 'Cancel', 'Return', 'Net Sale', 'Stock in Hand (Good)', 'Stock in Hand (Virtual)'];
  const csHdrRow = ws.getRow(rowNum);
  csHeaders.forEach((h, i) => { csHdrRow.getCell(i + 1).value = h; });
  applyHeaderRow(csHdrRow);
  rowNum++;

  let csTotals = { sale: 0, cancel: 0, ret: 0, net: 0 };
  for (const d of csData) {
    const r = ws.getRow(rowNum);
    r.getCell(1).value = d.item_type_name;
    r.getCell(2).value = d.channel;
    r.getCell(3).value = d.total_sale_qty;
    r.getCell(4).value = d.cancel_qty;
    r.getCell(5).value = d.return_qty;
    r.getCell(6).value = d.net_sale;
    r.getCell(7).value = d.stock_good;
    r.getCell(8).value = d.stock_virtual;
    for (let c = 3; c <= 8; c++) r.getCell(c).alignment = { horizontal: 'right' };
    csTotals.sale += d.total_sale_qty;
    csTotals.cancel += d.cancel_qty;
    csTotals.ret += d.return_qty;
    csTotals.net += d.net_sale;
    rowNum++;
  }
  const csTotalRow = ws.getRow(rowNum);
  csTotalRow.getCell(1).value = 'Total';
  csTotalRow.getCell(3).value = csTotals.sale;
  csTotalRow.getCell(4).value = csTotals.cancel;
  csTotalRow.getCell(5).value = csTotals.ret;
  csTotalRow.getCell(6).value = csTotals.net;
  applyTotalRow(csTotalRow);
  for (let c = 3; c <= 8; c++) csTotalRow.getCell(c).alignment = { horizontal: 'right' };
  } // end channel-summary

  // ── Auto-width columns ──
  ws.columns.forEach((col) => {
    let maxLen = 12;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? '').length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 3, 35);
  });

  // ── Download ──
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Sales_Activity_${fromDate}_to_${toDate}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
