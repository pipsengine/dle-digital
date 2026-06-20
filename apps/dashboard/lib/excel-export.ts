export type ExcelCell = string | number | boolean | null | undefined | Date;

export type ExcelWorksheetInput = {
  title: string;
  sheetName?: string;
  columns: string[];
  rows: ExcelCell[][];
  generatedAt?: string;
  subtitle?: string;
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const safeSheetName = (value: string | undefined) =>
  escapeHtml((value || 'Export').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));

const cellText = (value: ExcelCell) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return value ?? '';
};

export const buildExcelHtml = ({ title, sheetName, columns, rows, generatedAt, subtitle }: ExcelWorksheetInput) => {
  const columnCount = Math.max(columns.length, 1);
  const generated = generatedAt || new Date().toISOString();
  const metadataRows = [
    `<tr><td colspan="${columnCount}" class="report-title">${escapeHtml(title)}</td></tr>`,
    subtitle ? `<tr><td colspan="${columnCount}" class="report-subtitle">${escapeHtml(subtitle)}</td></tr>` : '',
    `<tr><td colspan="${columnCount}" class="report-meta">Generated: ${escapeHtml(new Date(generated).toLocaleString('en-GB'))}</td></tr>`,
    `<tr><td colspan="${columnCount}" class="blank"></td></tr>`,
  ].join('');

  const header = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('');
  const body = rows
    .map((row, index) => {
      const cells = columns.map((_, cellIndex) => {
        const value = cellText(row[cellIndex]);
        const type = typeof value === 'number' ? 'number' : 'text';
        return `<td class="${type}">${escapeHtml(value)}</td>`;
      });
      return `<tr class="${index % 2 ? 'alt' : ''}">${cells.join('')}</tr>`;
    })
    .join('');

  return `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${safeSheetName(sheetName || title)}</x:Name><x:WorksheetOptions><x:FreezePanes/><x:FrozenNoSplit/><x:SplitHorizontal>5</x:SplitHorizontal><x:TopRowBottomPane>5</x:TopRowBottomPane></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
  <style>
    body { font-family: Arial, sans-serif; color: #0f172a; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #0f4c81; color: #ffffff; font-weight: 700; border: 1px solid #0b3a63; padding: 8px; text-align: left; white-space: nowrap; }
    td { border: 1px solid #cbd5e1; padding: 7px; vertical-align: top; mso-number-format:"\\@"; }
    td.number { text-align: right; mso-number-format:"#,##0.00"; }
    tr.alt td { background: #f8fafc; }
    .report-title { background: #082f49; color: #ffffff; font-size: 18px; font-weight: 800; padding: 12px; border: 1px solid #082f49; }
    .report-subtitle { background: #e0f2fe; color: #075985; font-weight: 700; padding: 8px 12px; border: 1px solid #bae6fd; }
    .report-meta { background: #f1f5f9; color: #475569; font-weight: 700; padding: 8px 12px; border: 1px solid #cbd5e1; }
    .blank { height: 10px; border: 0; }
  </style>
</head>
<body>
  <table>
    ${metadataRows}
    <tr>${header}</tr>
    ${body}
  </table>
</body>
</html>`;
};

export const excelMimeType = 'application/vnd.ms-excel;charset=utf-8';

export const downloadExcelFile = (input: ExcelWorksheetInput & { fileName: string }) => {
  const blob = new Blob([buildExcelHtml(input)], { type: excelMimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = input.fileName.endsWith('.xls') ? input.fileName : `${input.fileName}.xls`;
  link.click();
  URL.revokeObjectURL(url);
};
