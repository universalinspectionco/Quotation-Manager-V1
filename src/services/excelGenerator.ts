import { Quotation, Settings, LineItem } from '../types/quotation';
import { XT, WHITEJ, getAssetImage } from '../data/assets';
import { calculateTotals, cleanKey, extractRefAndClientFromFilename, formatCurrency, formatDateLong, parseFlexibleDate, parseNumber, parseSerialNumbers, sanitizeFilename } from '../utils/formatters';

declare global {
  interface Window {
    JSZip: any;
    XLSX: any;
  }
}

const BLUE = '1E3A8A'; // Official UIC Corporate Dark Navy Blue (#1E3A8A)
const LIGHT_BLUE = 'EFF6FF'; // Soft blue accent for totals background
const b64Data = (u: string) => String(u || '').split(',')[1] || '';

export class ExcelGeneratorService {
  /**
   * Generates a corporate styled Excel (.xlsx) quotation file matching the official UIC PDF design.
   */
  public static async generateQuoteExcel(q: Quotation, settings: Settings): Promise<Blob> {
    if (!window.JSZip) {
      throw new Error('JSZip library is not loaded.');
    }

    const V = q.type === 'valve';
    const RM = !V && q.showRm;
    const totals = calculateTotals(q);

    const zip = await window.JSZip.loadAsync(XT, { base64: true });
    const sheetPath = 'xl/worksheets/sheet1.xml';
    let sheetXml = await zip.file(sheetPath).async('string');

    // Customize styles.xml for Royal Blue branding & table header fills
    let stylesXml = await zip.file('xl/styles.xml').async('string');
    stylesXml = stylesXml
      .replace(/Calisto MT/g, 'Segoe UI')
      .replace(/FF002060/g, 'FF1F2937')
      .replace(/FFFF0000/g, 'FF' + BLUE);

    // 1. Extend Fonts
    const fontsMatch = stylesXml.match(/<fonts count="(\d+)"([^>]*)>([\s\S]*?)<\/fonts>/);
    let origFontCount = 14;
    if (fontsMatch) {
      origFontCount = parseInt(fontsMatch[1], 10);
      const fontsBody = fontsMatch[3];
      const newFonts =
        '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Segoe UI"/><family val="2"/></font>' + // [origFontCount + 0]: 11pt bold white
        '<font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Segoe UI"/><family val="2"/></font>' + // [origFontCount + 1]: 12pt bold white
        `<font><b/><sz val="11"/><color rgb="FF${BLUE}"/><name val="Segoe UI"/><family val="2"/></font>` + // [origFontCount + 2]: 11pt bold navy
        '<font><b/><sz val="11"/><color rgb="FF000000"/><name val="Segoe UI"/><family val="2"/></font>';   // [origFontCount + 3]: 11pt bold black
      stylesXml = stylesXml.replace(
        fontsMatch[0],
        `<fonts count="${origFontCount + 4}"${fontsMatch[2]}>${fontsBody}${newFonts}</fonts>`
      );
    }

    // 2. Extend Fills
    const fillsMatch = stylesXml.match(/<fills count="(\d+)">([\s\S]*?)<\/fills>/);
    let origFillCount = 4;
    if (fillsMatch) {
      origFillCount = parseInt(fillsMatch[1], 10);
      const fillsBody = fillsMatch[2];
      const newFills =
        `<fill><patternFill patternType="solid"><fgColor rgb="FF${BLUE}"/><bgColor indexed="64"/></patternFill></fill>` + // [origFillCount + 0]: solid Navy Blue
        `<fill><patternFill patternType="solid"><fgColor rgb="FF${LIGHT_BLUE}"/><bgColor indexed="64"/></patternFill></fill>`; // [origFillCount + 1]: solid Light Blue
      stylesXml = stylesXml.replace(
        fillsMatch[0],
        `<fills count="${origFillCount + 2}">${fillsBody}${newFills}</fills>`
      );
    }

    // 3. Extend CellXfs with exact styling indices
    const fontWhite11 = origFontCount + 0;
    const fontWhite12 = origFontCount + 1;
    const fontNavy11 = origFontCount + 2;
    const fontBlack11 = origFontCount + 3;

    const fillNavy = origFillCount + 0;
    const fillLightBlue = origFillCount + 1;

    let HD = 33;
    let TI = 34;
    let QTY_LBL = 35;
    let QTY_VAL = 36;
    let QTY_BLANK = 37;
    let NL = 38;
    let NV = 39;
    let CURR_CELL = 40;
    let TOT_LBL = 41;
    let TOT_VAL = 42;

    const cellXfsMatch = stylesXml.match(/<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/);
    if (cellXfsMatch) {
      const origXfCount = parseInt(cellXfsMatch[1], 10);
      const xfsBody = cellXfsMatch[2];

      HD = origXfCount + 0;
      TI = origXfCount + 1;
      QTY_LBL = origXfCount + 2;
      QTY_VAL = origXfCount + 3;
      QTY_BLANK = origXfCount + 4;
      NL = origXfCount + 5;
      NV = origXfCount + 6;
      CURR_CELL = origXfCount + 7;
      TOT_LBL = origXfCount + 8;
      TOT_VAL = origXfCount + 9;

      const newXfs = [
        // [origXfCount + 0] HD: Table Header - Navy Blue fill, bold white 11pt, center aligned, thin border
        `<xf numFmtId="0" fontId="${fontWhite11}" fillId="${fillNavy}" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>`,
        // [origXfCount + 1] TI: Title Banner - Navy Blue fill, bold white 12pt, center aligned, thin border
        `<xf numFmtId="0" fontId="${fontWhite12}" fillId="${fillNavy}" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>`,
        // [origXfCount + 2] QTY_LBL: Requested Total Quantities label - Light blue fill, bold navy 11pt, center aligned, thin border
        `<xf numFmtId="0" fontId="${fontNavy11}" fillId="${fillLightBlue}" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>`,
        // [origXfCount + 3] QTY_VAL: Requested Total Quantities value - Light blue fill, bold navy 11pt, center aligned, integer, thin border
        `<xf numFmtId="1" fontId="${fontNavy11}" fillId="${fillLightBlue}" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>`,
        // [origXfCount + 4] QTY_BLANK: Requested Total Quantities blank filler - Light blue fill, thin border
        `<xf numFmtId="0" fontId="0" fillId="${fillLightBlue}" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>`,
        // [origXfCount + 5] NL: Net Total Label - Navy Blue fill, bold white 12pt, right-aligned, thin border
        `<xf numFmtId="0" fontId="${fontWhite12}" fillId="${fillNavy}" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>`,
        // [origXfCount + 6] NV: Net Total Value - Navy Blue fill, bold white 11pt, right-aligned, currency 0.00, thin border
        `<xf numFmtId="2" fontId="${fontWhite11}" fillId="${fillNavy}" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>`,
        // [origXfCount + 7] CURR_CELL: Unit Rate and Amount cells - right-aligned currency 0.00, thin border
        `<xf numFmtId="2" fontId="2" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>`,
        // [origXfCount + 8] TOT_LBL: Total & VAT Amount labels - right-aligned bold, thin border
        `<xf numFmtId="0" fontId="${fontBlack11}" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>`,
        // [origXfCount + 9] TOT_VAL: Total & VAT Amount values - right-aligned bold currency 0.00, thin border
        `<xf numFmtId="2" fontId="${fontBlack11}" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>`,
      ];

      stylesXml = stylesXml.replace(
        cellXfsMatch[0],
        `<cellXfs count="${origXfCount + newXfs.length}">${xfsBody}${newXfs.join('')}</cellXfs>`
      );
      zip.file('xl/styles.xml', stylesXml);
    }

    const E = (s: any) =>
      String(s ?? '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const inlineStr = (r: string, s: number, v: any) =>
      `<c r="${r}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${E(v)}</t></is></c>`;
    const numCell = (r: string, s: number, v: any) => `<c r="${r}" s="${s}"><v>${v}</v></c>`;
    const formulaCell = (r: string, s: number, f: string, v: any) =>
      `<c r="${r}" s="${s}"><f>${f}</f><v>${v}</v></c>`;
    const blankCell = (r: string, s: number) => `<c r="${r}" s="${s}"/>`;

    const lineCount = (v: any, maxLen: number) =>
      Math.max(
        1,
        String(v)
          .split('\n')
          .reduce((acc, line) => acc + Math.ceil((line.length || 1) / maxLen), 0)
      );
    const round2 = (v: number) => Math.round(v * 100) / 100;

    // Column configurations matching official UIC standard inspection layout
    const D0 = V
      ? [
          ['sn', 7, 5],
          ['d', 34, 13],
          ['sz', 11, 14],
          ['cl', 13, 14],
          ['q', 8, 6],
          ['r', 16, CURR_CELL],
          ['a', 16, CURR_CELL],
          ['rm', 18, 13],
        ]
      : [
          ['sn', 7, 5],
          ['d', 42, 13],
          ['q', 10, 6],
          ['r', 20, CURR_CELL],
          ['a', 20, CURR_CELL],
          ...(RM ? [['rm', 24, 13]] : []),
        ];

    const C = D0.map((d, i) => ({ k: d[0] as string, w: d[1] as number, s: d[2] as number, L: String.fromCharCode(66 + i) }));
    const cl = (k: string) => C.find((c) => c.k === k)!;
    const LAST_COL = C[C.length - 1].L;
    const rows: string[] = [];
    const merges: string[] = [];

    const addRow = (n: number, cells: string[], h?: number) => {
      rows.push(`<row r="${n}"${h ? ` ht="${h}" customHeight="1"` : ''}>${cells.join('')}</row>`);
    };

    const addSpan = (n: number, styleId: number, text: string, h?: number) => {
      addRow(
        n,
        [inlineStr(`B${n}`, styleId, text), ...C.slice(1).map((c) => blankCell(`${c.L}${n}`, styleId))],
        h
      );
      merges.push(`B${n}:${LAST_COL}${n}`);
    };

    const rateCol = cl('r').L;
    const amountCol = cl('a').L;

    // Row 1: Document Title Banner (Deep Royal Blue bar, Bold White text, centered)
    const docTitle = String(
      q.title || (V ? 'QUOTATION FOR VALVE TESTING SERVICES' : 'QUOTATION FOR INSPECTION SERVICES')
    ).toUpperCase();
    const titleText = (V && q.revised ? 'REVISED ' : '') + docTitle;

    addRow(1, [
      inlineStr('B1', TI, titleText),
      ...C.slice(1).map((c) => blankCell(`${c.L}1`, TI)),
    ], 26);
    merges.push(`B1:${LAST_COL}1`);

    // Row 2-4: Metadata block exactly matching reference screenshot
    // Row 2: Attn To & Ref
    const attnDisplay = q.attn ? `Attn To: ${q.attn}` : (q.client ? `Attn To: ${q.client}` : 'Attn To:');
    addRow(2, [
      inlineStr('B2', 20, attnDisplay),
      inlineStr(`${rateCol}2`, 19, 'Ref.:'),
      inlineStr(`${amountCol}2`, 19, q.ref),
    ], 16.5);

    // Row 3: Client Name (bold) & Formatted Date String (e.g. 3 November 2026)
    addRow(
      3,
      [
        inlineStr('B3', 24, q.client || ''),
        inlineStr(`${rateCol}3`, 19, 'Date :'),
        inlineStr(`${amountCol}3`, 19, formatDateLong(q.date)),
      ],
      16.5
    );

    // Row 4: Location
    addRow(4, [inlineStr('B4', 20, `Location: ${q.location || ''}`)], 16.5);

    let r = 5;
    if (V && q.sub) {
      addRow(5, [inlineStr('B5', 20, `Sub: ${q.sub}`)], 16.5);
      r = 6;
    }
    addRow(r, [], 14);
    r++;

    // Intro & Delivery Terms (Bold paragraph exactly as in reference image)
    let intro = String(q.intro || '').trim();
    if (!intro) {
      intro =
        'Dear Sir, Thank you very much for your inquiry regarding our services.\n' +
        'We appreciate the opportunity to assist your esteemed organization and look forward to the possibility of serving your needs with the highest standards of quality and performance.';
    }
    if (q.delivery) intro += `\nDelivery Terms: ${q.delivery}`;
    if (q.service) intro += `\nService Beginning Terms: ${q.service}`;

    const introLines = lineCount(intro, 80);
    const introHeight = Math.max(40, Math.ceil(introLines * 16));

    addRow(r, [inlineStr(`B${r}`, 25, intro), ...C.slice(1).map((c) => blankCell(`${c.L}${r}`, 25))], introHeight);
    merges.push(`B${r}:${LAST_COL}${r}`);
    r++;
    addRow(r, [], 12);
    r++;

    // Table Header (Solid Royal Blue `#1E3A8A` background with Bold White text!)
    const rateNoteSuffix = q.rateNote ? `\n${q.rateNote}` : '';
    const headerTitles: Record<string, string> = {
      sn: 'S No',
      d: 'Description',
      q: V ? 'QTY' : 'Qty',
      sz: 'SIZE (Inch)',
      cl: 'Class Rating',
      r: V ? `Unit Rate (SAR)${rateNoteSuffix}` : 'Unit Rate (SAR)',
      a: V ? `Amount (SAR)${rateNoteSuffix}` : 'Amount (SAR)',
      rm: 'Remarks',
    };

    addRow(r, C.map((c) => inlineStr(`${c.L}${r}`, HD, headerTitles[c.k] || c.k)), 26);
    r++;

    const r0 = r;
    const minRows = Math.max(V ? 10 : 12, q.items.length);

    const formatSerialsText = (item: LineItem) => {
      const serials = parseSerialNumbers(item.sns);
      if (!serials.length) return '';
      if (serials.length <= 8) return `\nS/N: ${serials.join(', ')}`;
      return `\nSerial nos.: ${serials.length} units (see sheet "Serial Numbers")`;
    };

    for (let i = 0; i < minRows; i++) {
      const rr = r0 + i;
      const it = q.items[i];
      if (it) {
        const descText = V ? it.d : it.d + formatSerialsText(it);
        const lns = lineCount(descText, cl('d').w * 0.95);
        addRow(
          rr,
          C.map((c) => {
            const cellRef = `${c.L}${rr}`;
            const key = c.k;
            if (key === 'sn') return numCell(cellRef, c.s, i + 1);
            if (key === 'd') return inlineStr(cellRef, c.s, descText);
            if (key === 'q') return numCell(cellRef, c.s, Number(it.q) || 0);
            if (key === 'r') return numCell(cellRef, c.s, Number(it.r) || 0);
            if (key === 'a') return formulaCell(cellRef, c.s, `${rateCol}${rr}*${cl('q').L}${rr}`, round2(it.q * it.r));
            return (it as any)[key] ? inlineStr(cellRef, c.s, (it as any)[key]) : blankCell(cellRef, c.s);
          }),
          lns > 1 ? Math.max(22, 16 * lns) : 20
        );
      } else {
        // Render clean bordered empty cells matching the template table grid
        addRow(rr, C.map((c) => blankCell(`${c.L}${rr}`, c.s)), 18);
      }
    }

    r = r0 + minRows;
    const rl = r - 1;

    // Requested Total Quantities row (Light blue background, bold navy text, centered qty)
    if (!V) {
      addRow(
        r,
        [
          blankCell(`B${r}`, QTY_LBL),
          inlineStr(`C${r}`, QTY_LBL, 'REQUESTED TOTAL QUANTITIES'),
          formulaCell(`${cl('q').L}${r}`, QTY_VAL, `SUM(${cl('q').L}${r0}:${cl('q').L}${rl})`, totals.totalQty),
          ...C.filter((c) => c.k === 'r' || c.k === 'a' || c.k === 'rm').map((c) => blankCell(`${c.L}${r}`, QTY_BLANK)),
        ],
        22
      );
      merges.push(`B${r}:C${r}`);
      r++;
    }

    // Totals Rows
    if (!V || q.showTot) {
      const a0 = r;
      // Total Amount
      addRow(
        r,
        [
          ...C.filter((c) => c.L >= 'B' && c.L < rateCol).map((c) => blankCell(`${c.L}${r}`, 0)),
          inlineStr(`${rateCol}${r}`, TOT_LBL, 'Total Amount'),
          formulaCell(`${amountCol}${r}`, TOT_VAL, `SUM(${amountCol}${r0}:${amountCol}${rl})`, round2(totals.subtotal)),
        ],
        20
      );
      merges.push(`B${r}:${cl('q').L}${r}`);

      // Vat Amount 15%
      addRow(
        r + 1,
        [
          ...C.filter((c) => c.L >= 'B' && c.L < rateCol).map((c) => blankCell(`${c.L}${r + 1}`, 0)),
          inlineStr(`${rateCol}${r + 1}`, TOT_LBL, `Vat Amount ${q.vat}%`),
          formulaCell(`${amountCol}${r + 1}`, TOT_VAL, `${amountCol}${a0}*${(Number(q.vat) || 0) / 100}`, round2(totals.vatAmount)),
        ],
        20
      );
      merges.push(`B${r + 1}:${cl('q').L}${r + 1}`);

      // Net Total Amount (Full Navy Blue Banner with Bold White text!)
      addRow(
        r + 2,
        [
          ...C.filter((c) => c.L >= 'B' && c.L < rateCol).map((c) => blankCell(`${c.L}${r + 2}`, NL)),
          inlineStr(`${rateCol}${r + 2}`, NL, 'Net Total Amount'),
          formulaCell(`${amountCol}${r + 2}`, NV, `${amountCol}${a0 + 1}+${amountCol}${a0}`, round2(totals.netTotal)),
        ],
        24
      );
      merges.push(`B${r + 2}:${cl('q').L}${r + 2}`);
      r += 3;
    }

    if (V && q.vatNote) {
      addRow(r, [inlineStr(`B${r}`, 21, q.vatNote)], 20);
      merges.push(`B${r}:${LAST_COL}${r}`);
      r++;
    }

    addRow(r, [], 15.75);
    r++;

    // Terms & Conditions
    let firstTc = true;
    String(q.tc || '')
      .split('\n')
      .forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        if (/^[A-Za-z&' ]{3,40}:$/.test(trimmed)) {
          if (!firstTc) {
            addRow(r, [], 15.75);
            r++;
          }
          firstTc = false;
          addSpan(r, 32, trimmed + ' ', 15.75);
        } else {
          addSpan(r, 28, line, Math.max(15.75, 15 * lineCount(line, 92)));
        }
        r++;
      });

    // Replace Sheet XML content
    const colsXml = `<cols><col min="1" max="1" width="1.6" customWidth="1"/>${C.map(
      (c, i) => `<col min="${i + 2}" max="${i + 2}" width="${c.w}" customWidth="1"/>`
    ).join('')}</cols>`;

    const sheetDataStart = sheetXml.indexOf('<sheetData>') + 11;
    const sheetDataEnd = sheetXml.indexOf('</sheetData>');

    sheetXml =
      sheetXml
        .slice(0, sheetDataStart)
        .replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:${LAST_COL}${r}"/>`)
        .replace(/<cols>[\s\S]*?<\/cols>/, colsXml) +
      rows.join('') +
      sheetXml.slice(sheetDataEnd).replace(/<mergeCells[\s\S]*?<\/mergeCells>/, `<mergeCells count="${merges.length}">${merges
        .map((m) => `<mergeCell ref="${m}"/>`)
        .join('')}</mergeCells>`);

    zip.file(sheetPath, sheetXml);

    // Letterhead Images
    const lh = settings.lh || 'band';
    if (lh !== 'orig') {
      const headerData = lh === 'none' ? WHITEJ : b64Data(getAssetImage('hdr', settings));
      const footerData = lh === 'none' ? WHITEJ : b64Data(getAssetImage('ftr', settings));
      zip.file('xl/media/image2.jpeg', headerData, { base64: true });
      zip.file('xl/media/image1.jpeg', footerData, { base64: true });
    }

    // Optional Serial Numbers Sheet
    const allSerials = V
      ? []
      : q.items.flatMap((item, idx) => parseSerialNumbers(item.sns).map((s, j) => [idx + 1, item.d, j + 1, s]));

    if (allSerials.length) {
      const serialRows = [
        `<row r="1" ht="22" customHeight="1">${['Item #', 'Description', 'S No', 'Serial No.']
          .map((h, i) => inlineStr(`${String.fromCharCode(65 + i)}1`, HD, h))
          .join('')}</row>`,
        ...allSerials.map(
          (o, i) =>
            `<row r="${i + 2}">${inlineStr(`A${i + 2}`, 12, o[0])}${inlineStr(`B${i + 2}`, 13, o[1])}${inlineStr(
              `C${i + 2}`,
              12,
              o[2]
            )}${inlineStr(`D${i + 2}`, 13, o[3])}</row>`
        ),
      ];

      zip.file(
        'xl/worksheets/sheet2.xml',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="9" customWidth="1"/><col min="2" max="2" width="42" customWidth="1"/><col min="3" max="3" width="8" customWidth="1"/><col min="4" max="4" width="30" customWidth="1"/></cols><sheetData>${serialRows.join(
          ''
        )}</sheetData></worksheet>`
      );

      const wbRels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
      zip.file(
        'xl/_rels/workbook.xml.rels',
        wbRels.replace(
          '</Relationships>',
          '<Relationship Id="rIdSN" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>'
        )
      );

      const contentTypes = await zip.file('[Content_Types].xml').async('string');
      zip.file(
        '[Content_Types].xml',
        contentTypes.replace(
          '</Types>',
          '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'
        )
      );
    }

    const refClean = String(q.ref).split('/').pop()?.replace(/[\\\/?*\[\]:]/g, '').slice(0, 31) || 'Quotation';

    let workbookXml = await zip.file('xl/workbook.xml').async('string');
    workbookXml = workbookXml
      .replace('name="68598"', `name="${E(refClean)}"`)
      .replace(/<mc:AlternateContent[\s\S]*?<\/mc:AlternateContent>/, '')
      .replace('<calcPr calcId="191029"/>', '<calcPr calcId="191029" fullCalcOnLoad="1"/>');

    if (allSerials.length) {
      workbookXml = workbookXml.replace(
        /(<sheet [^>]*\/>)/,
        '$1<sheet name="Serial Numbers" sheetId="9" r:id="rIdSN"/>'
      );
    }
    zip.file('xl/workbook.xml', workbookXml);

    let appXml = await zip.file('docProps/app.xml').async('string');
    zip.file('docProps/app.xml', appXml.replace(/68598/g, E(refClean)));

    let coreXml = await zip.file('docProps/core.xml').async('string');
    coreXml = coreXml
      .replace(/<dc:creator>.*?<\/dc:creator>/, '<dc:creator>UIC Quotation Manager</dc:creator>')
      .replace(/<cp:lastModifiedBy>.*?<\/cp:lastModifiedBy>/, '<cp:lastModifiedBy>UIC Quotation Manager</cp:lastModifiedBy>');
    zip.file('docProps/core.xml', coreXml);

    zip.remove('xl/calcChain.xml');
    const wbRelsClean = (await zip.file('xl/_rels/workbook.xml.rels').async('string')).replace(
      /<Relationship [^>]*calcChain[^>]*\/>/,
      ''
    );
    zip.file('xl/_rels/workbook.xml.rels', wbRelsClean);

    const ctClean = (await zip.file('[Content_Types].xml').async('string')).replace(
      /<Override PartName="\/xl\/calcChain.xml"[^>]*\/>/,
      ''
    );
    zip.file('[Content_Types].xml', ctClean);

    return await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  /**
   * Generates the 14-column official Quotation Status Report workbook with COUNTIF/SUMIF formulas
   */
  public static async generateReportExcel(quotes: Quotation[]): Promise<Blob> {
    if (!window.JSZip) {
      throw new Error('JSZip library is not loaded.');
    }

    const sorted = [...quotes].sort((a, b) => {
      const da = parseFlexibleDate(a.date) || a.date || '';
      const db = parseFlexibleDate(b.date) || b.date || '';
      return da.localeCompare(db);
    });
    const zip = new window.JSZip();

    const E = (s: any) =>
      String(s ?? '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const statusStyleMap: Record<string, number> = {
      'Waiting For PO': 6,
      'Job Received': 7,
      'Under Process': 8,
      Completed: 9,
      Lost: 10,
      Draft: 11,
    };

    const inlineStr = (r: string, s: number, v: any) =>
      `<c r="${r}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${E(v)}</t></is></c>`;
    const numCell = (r: string, s: number, v: any) => `<c r="${r}" s="${s}"><v>${v}</v></c>`;
    const blankCell = (r: string, s: number) => `<c r="${r}" s="${s}"/>`;

    const headers = [
      'S.No',
      'Date',
      'Week',
      'Quotation',
      'Via',
      'Company Name',
      'Client Code',
      'Service Type',
      'Department',
      'Specific Dept',
      'Location',
      'Status',
      'Net Amount (SAR)',
      'Remarks',
    ];

    const headerStyles = [1, 1, 1, 1, 1, 15, 1, 1, 1, 1, 1, 1, 16, 15];
    const colWidths = [7, 12, 10, 13, 11, 44, 14, 16, 15, 16, 12, 18, 18, 28];
    const letters = 'ABCDEFGHIJKLMN';

    const xmlRows: string[] = [
      `<row r="1" ht="30" customHeight="1">${headers
        .map((h, i) => inlineStr(`${letters[i]}1`, headerStyles[i], h))
        .join('')}</row>`,
    ];

    sorted.forEach((q, i) => {
      const n = i + 2;
      const isoDate = parseFlexibleDate(q.date);
      const parts = isoDate ? isoDate.split('-').map(Number) : [];
      const hasValidDate =
        parts.length === 3 &&
        Number.isFinite(parts[0]) &&
        Number.isFinite(parts[1]) &&
        Number.isFinite(parts[2]);

      const dateCellXml = hasValidDate
        ? numCell(`B${n}`, 4, Math.round(Date.UTC(parts[0], parts[1] - 1, parts[2]) / 864e5 + 25569))
        : blankCell(`B${n}`, 4);
      const weekNum = hasValidDate ? `${Math.ceil(parts[2] / 7)}-Week` : '';
      const qn = String(q.ref || '').split('/').pop() || q.ref || '';
      const netAmount = Math.round(calculateTotals(q).netTotal * 100) / 100;

      xmlRows.push(
        `<row r="${n}" ht="24" customHeight="1">${numCell(`A${n}`, 2, i + 1)}${dateCellXml}${inlineStr(
          `C${n}`,
          2,
          weekNum
        )}${/^\d+$/.test(qn) ? numCell(`D${n}`, 2, qn) : inlineStr(`D${n}`, 2, qn)}${inlineStr(
          `E${n}`,
          2,
          q.via || ''
        )}${inlineStr(`F${n}`, 3, q.client || '')}${inlineStr(`G${n}`, 2, q.clientCode || '')}${inlineStr(
          `H${n}`,
          2,
          q.svc || ''
        )}${inlineStr(`I${n}`, 2, q.dept || '')}${inlineStr(`J${n}`, 2, q.spDept || '')}${inlineStr(
          `K${n}`,
          2,
          q.location || ''
        )}${inlineStr(`L${n}`, statusStyleMap[q.status] || 2, q.status)}${numCell(`M${n}`, 5, netAmount)}${inlineStr(
          `N${n}`,
          3,
          q.notes || ''
        )}</row>`
      );
    });

    const lastDataRow = sorted.length + 1;
    const summaryStartRow = lastDataRow + 2;

    xmlRows.push(`<row r="${summaryStartRow}">${inlineStr(`F${summaryStartRow}`, 12, 'Summary by status')}</row>`);

    const statuses = ['Waiting For PO', 'Job Received', 'Under Process', 'Completed', 'Lost'];
    statuses.forEach((statusName, i) => {
      const n = summaryStartRow + 1 + i;
      const filtered = sorted.filter((q) => q.status === statusName);
      const totalNet = Math.round(filtered.reduce((acc, q) => acc + calculateTotals(q).netTotal, 0) * 100) / 100;

      xmlRows.push(
        `<row r="${n}">${inlineStr(`F${n}`, 3, statusName)}<c r="G${n}" s="13"><f>COUNTIF($L$2:$L$${lastDataRow},F${n})</f><v>${
          filtered.length
        }</v></c><c r="H${n}" s="14"><f>SUMIF($L$2:$L$${lastDataRow},F${n},$M$2:$M$${lastDataRow})</f><v>${totalNet}</v></c></row>`
      );
    });

    const fontTag = (bold: boolean, hexColor: string) =>
      `<font>${bold ? '<b/>' : ''}<sz val="10.5"/><color rgb="FF${hexColor}"/><name val="Segoe UI"/><family val="2"/></font>`;
    const fonts = [
      fontTag(false, '1F2937'),
      fontTag(true, 'FFFFFF'),
      fontTag(true, BLUE),
      fontTag(true, '7A5B00'),
      fontTag(true, '1E6B3A'),
      fontTag(true, '1F4E8C'),
      fontTag(true, '374151'),
      fontTag(true, '842029'),
      fontTag(true, '1F2937'),
    ];

    const fillTag = (hexColor: string) =>
      `<fill><patternFill patternType="solid"><fgColor rgb="FF${hexColor}"/><bgColor indexed="64"/></patternFill></fill>`;
    const fills = [
      '<fill><patternFill patternType="none"/></fill>',
      '<fill><patternFill patternType="gray125"/></fill>',
      fillTag(BLUE),
      fillTag('FFF3CD'),
      fillTag('D9F2E3'),
      fillTag('DCEAFB'),
      fillTag('E5E7EB'),
      fillTag('F8D7DA'),
    ];

    const xfTag = (font: number, fill: number, al: string, nf?: number, border?: boolean) =>
      `<xf numFmtId="${nf || 0}" fontId="${font}" fillId="${fill}" borderId="${
        border ? 1 : 0
      }" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"${
        nf ? ' applyNumberFormat="1"' : ''
      }><alignment ${al}/></xf>`;

    const centerAl = 'horizontal="center" vertical="center"';
    const xfs = [
      xfTag(0, 0, 'vertical="center"'),
      xfTag(1, 2, centerAl + ' wrapText="1"', 0, true),
      xfTag(0, 0, centerAl, 0, true),
      xfTag(0, 0, 'horizontal="left" vertical="center" indent="1" wrapText="1"', 0, true),
      xfTag(0, 0, centerAl, 164, true),
      xfTag(0, 0, 'horizontal="right" vertical="center" indent="1"', 4, true),
      xfTag(3, 3, centerAl, 0, true),
      xfTag(4, 4, centerAl, 0, true),
      xfTag(5, 5, centerAl, 0, true),
      xfTag(6, 6, centerAl, 0, true),
      xfTag(7, 7, centerAl, 0, true),
      xfTag(8, 0, centerAl, 0, true),
      xfTag(2, 0, 'vertical="center"'),
      xfTag(2, 0, centerAl),
      xfTag(2, 0, 'horizontal="right" vertical="center"', 4),
      xfTag(1, 2, 'horizontal="left" vertical="center" indent="1" wrapText="1"', 0, true),
      xfTag(1, 2, 'horizontal="right" vertical="center" indent="1" wrapText="1"', 0, true),
    ];

    const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const SML_NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';

    zip.file(
      '[Content_Types].xml',
      XML_HEADER +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'
    );
    zip.file(
      '_rels/.rels',
      XML_HEADER +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    );
    zip.file(
      'xl/workbook.xml',
      XML_HEADER +
        `<workbook ${SML_NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Quotation Report" sheetId="1" r:id="rId1"/></sheets><calcPr fullCalcOnLoad="1"/></workbook>`
    );
    zip.file(
      'xl/_rels/workbook.xml.rels',
      XML_HEADER +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'
    );
    zip.file(
      'xl/styles.xml',
      XML_HEADER +
        `<styleSheet ${SML_NS}><numFmts count="1"><numFmt numFmtId="164" formatCode="dd\\-mmm\\-yy"/></numFmts><fonts count="${
          fonts.length
        }">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join(
          ''
        )}</fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFC6D6D4"/></left><right style="thin"><color rgb="FFC6D6D4"/></right><top style="thin"><color rgb="FFC6D6D4"/></top><bottom style="thin"><color rgb="FFC6D6D4"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${
          xfs.length
        }">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
    );
    zip.file(
      'xl/worksheets/sheet1.xml',
      XML_HEADER +
        `<worksheet ${SML_NS}><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${colWidths
          .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
          .join('')}</cols><sheetData>${xmlRows.join('')}</sheetData><autoFilter ref="A1:N${lastDataRow}"/><pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToHeight="0"/></worksheet>`
    );

    return await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  /**
   * Generates a downloadable blank template for importing items into a quote
   */
  public static generateImportTemplate(): Blob {
    if (!window.XLSX) {
      throw new Error('SheetJS (XLSX) library is not loaded.');
    }

    const ws = window.XLSX.utils.aoa_to_sheet([
      ['Client', 'AQ Energy'],
      ['Attn To', 'Mr Ali'],
      ['Location', 'Riyadh, KSA'],
      ['Reference', ''],
      [],
      ['S No', 'Description', 'Qty', 'Unit Rate (SAR)', 'Serial Numbers', 'Size (Inch)', 'Class Rating', 'Remarks'],
      [1, 'Electric Hoist', 3, 26, '0001, 125515, 5416161', '', '', ''],
      [2, 'Pressure Gauge (0-100 psi)', 5, 120, 'PG-01, PG-02, PG-03, PG-04, PG-05', '', '', 'ISO 17025 Certified'],
      [3, 'Safety Relief Valve', 2, 450, '', '2"', '300#', 'Pass or Fail'],
    ]);

    ws['!cols'] = [
      { wch: 8 },
      { wch: 45 },
      { wch: 10 },
      { wch: 18 },
      { wch: 30 },
      { wch: 14 },
      { wch: 14 },
      { wch: 25 },
    ];

    const instructionsSheet = window.XLSX.utils.aoa_to_sheet([
      ['How to fill this template for UIC Quotation Manager'],
      ['1. Rows 1-4 (optional): Client, Attn To, Location, Reference. Blank values preserve existing fields in quote.'],
      ['2. Header row must contain: Description, Qty, Unit Rate (SAR). Additional columns like Serial Numbers, Size, Class, and Remarks are supported.'],
      ['3. Qty must be numeric. Text like "Per Visit" defaults Qty to 1 and appends to description.'],
      ['4. Unit rates are in SAR (numbers only). Subtotal, 15% VAT, and Net Total are automatically calculated.'],
      ['5. Multiple serial numbers can be separated by commas or line breaks.'],
      ['6. Save as .xlsx and use "Import from Excel" in the quotation editor.'],
    ]);
    instructionsSheet['!cols'] = [{ wch: 110 }];

    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Quote items');
    window.XLSX.utils.book_append_sheet(wb, instructionsSheet, 'Instructions');

    const outData = window.XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    return new Blob([outData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /**
   * Parses an uploaded Excel or CSV file into line items and header metadata
   */
  public static async parseExcelQuote(file: File): Promise<{
    items: LineItem[];
    header: Record<string, string>;
    error?: string;
  }> {
    if (!window.XLSX) {
      throw new Error('SheetJS (XLSX) library is not loaded.');
    }

    const buffer = await file.arrayBuffer();
    const wb = window.XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
    const firstSheetName = wb.SheetNames[0];
    const ws = wb.Sheets[firstSheetName];
    const rows: any[][] = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    let headerRowIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (
        row.some((cell: any) => /desc|item|service|instrument/i.test(String(cell))) &&
        row.some((cell: any) => /rate|price|amount/i.test(String(cell)))
      ) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx < 0) {
      return {
        items: [],
        header: {},
        error: 'Could not find a header row containing "Description" and "Unit Rate" columns. Please verify format.',
      };
    }

    const headerRow = rows[headerRowIdx].map((c: any) => String(c).toLowerCase().trim());
    const findCol = (regex: RegExp) => headerRow.findIndex((c: string) => regex.test(c));

    const descCol = findCol(/desc|item|service|instrument/);
    const qtyCol = findCol(/qty|quant/);
    const rateCol = findCol(/rate|price/);
    const amountCol = findCol(/amount|total/);
    const serialCol = findCol(/serial|s\/n|sn/);
    const sizeCol = findCol(/^size|size\s*\(/);
    const classCol = findCol(/class/);
    const remarkCol = findCol(/remark|note/);

    const getVal = (r: any[], idx: number) => (idx >= 0 ? String(r[idx] ?? '').trim() : '');

    // Extract metadata from rows above the table header
    const extractedHeader: Record<string, string> = {};
    let attnRowIdx = -1;
    let attnColIdx = -1;
    let locationRowIdx = -1;

    for (let i = 0; i < headerRowIdx; i++) {
      const r = rows[i];
      for (let j = 0; j < r.length; j++) {
        const rawCell = r[j];
        if (rawCell instanceof Date && !extractedHeader.date) {
          const parsedD = parseFlexibleDate(rawCell);
          if (parsedD) extractedHeader.date = parsedD;
          continue;
        }

        const c = String(rawCell ?? '').trim();
        if (!c) continue;

        const isHeaderLabel = (val: string) =>
          /^(?:(?:Our\s*)?(?:Quotation|Quote|Ref(?:erence)?)\s*(?:No\.?|Number|#)?|(?:Quotation\s*|Quote\s*)?Date|Location|Attn\.?\s*To|Attention|Attn|Company\s*Name|Client\s*Name|Customer\s*Name|Client|Customer|Company|M\/s\.?|To)\s*[:.\-]?$/i.test(
            val
          );

        const nextRaw = () => {
          for (let k = j + 1; k < r.length; k++) {
            const v = r[k];
            if (v instanceof Date) return v;
            const s = String(v ?? '').trim();
            if (s) {
              if (isHeaderLabel(s)) return '';
              return s;
            }
          }
          return '';
        };
        const nextVal = () => {
          const v = nextRaw();
          return v instanceof Date ? parseFlexibleDate(v) : String(v ?? '').trim();
        };

        if (!extractedHeader.title && /^(?:REVISED\s+)?QUOTATION\s+FOR/i.test(c)) {
          extractedHeader.title = c;
          continue;
        }

        // Ref No.: require explicit separator OR exact Ref/Quote No label so titles never match
        const refMatch =
          c.match(/^(?:Our\s*)?(?:Quotation|Quote|Ref(?:erence)?)\s*(?:No\.?|Number|#)?\s*[:.\-]+\s*(.*)$/i) ||
          c.match(/^(?:Our\s*)?(?:Quotation\s*(?:No\.?|Number|#)|Quote\s*(?:No\.?|Number|#)|Ref(?:erence)?(?:\s*(?:No\.?|Number|#))?)\s*[:.\-]*$/i);
        if (refMatch && !extractedHeader.ref) {
          const inlineRef = (refMatch[1] || '').replace(/^[:.\-\s]+/, '').trim();
          const candidateRef = inlineRef || nextVal();
          if (candidateRef && !/^[:.\-]+$/.test(candidateRef) && !/^(date|client|company|for\b)$/i.test(candidateRef)) {
            extractedHeader.ref = candidateRef;
          }
        }

        // Date: supports "Date :" + next cell OR single-cell "Date : 3 November 2026"
        const dateMatch =
          c.match(/^(?:Quotation\s*|Quote\s*)?Date\s*[:.\-]+\s*(.*)$/i) ||
          c.match(/^(?:Quotation\s*|Quote\s*)?Date\s*[:.\-]*$/i);
        if (dateMatch && !extractedHeader.date) {
          const inlineDate = (dateMatch[1] || '').replace(/^[:.\-\s]+/, '').trim();
          const rawDate = inlineDate || nextRaw();
          const parsedD = parseFlexibleDate(rawDate);
          if (parsedD) extractedHeader.date = parsedD;
        }

        // Location: supports "Location: Jubail" OR "Location:" + next cell
        const locMatch =
          c.match(/^Location\s*[:.\-]+\s*(.*)$/i) ||
          c.match(/^Location\s*[:.\-]*$/i);
        if (locMatch) {
          locationRowIdx = i;
          if (!extractedHeader.location) {
            const locVal = (locMatch[1] || '').replace(/^[:.\-\s]+/, '').trim() || nextVal();
            if (locVal && !/^[:.\-]+$/.test(locVal)) extractedHeader.location = locVal;
          }
        }

        // Attn To: supports "Attn To: Mr. Ali" OR "Attn To:" + next cell
        const attnMatch =
          c.match(/^(?:Attn\.?\s*To|Attention|Attn)\s*[:.\-]+\s*(.*)$/i) ||
          c.match(/^(?:Attn\.?\s*To|Attention|Attn)\s*[:.\-]*$/i);
        if (attnMatch) {
          attnRowIdx = i;
          attnColIdx = j;
          if (!extractedHeader.attn) {
            const attnVal = (attnMatch[1] || '').replace(/^[:.\-\s]+/, '').trim() || nextVal();
            if (attnVal && !/^[:.\-]+$/.test(attnVal)) extractedHeader.attn = attnVal;
          }
        }

        // Explicit Client / Company / Customer / M/s / To:
        const clientMatch =
          c.match(/^(?:Company\s*Name|Client\s*Name|Customer\s*Name|Client|Customer|Company|M\/s\.?|To)\s*[:.\-]+\s*(.*)$/i) ||
          c.match(/^(?:Company\s*Name|Client\s*Name|Customer\s*Name|Client|Customer|Company|M\/s\.?|To)\s*[:.\-]*$/i);
        if (clientMatch && !extractedHeader.client) {
          const inlineClient = (clientMatch[1] || '').replace(/^[:.\-\s]+/, '').trim();
          const candidateClient = inlineClient || nextVal();
          if (candidateClient && !/^[:.\-]+$/.test(candidateClient) && !/^(client|company|n\/a)$/i.test(candidateClient)) {
            extractedHeader.client = candidateClient;
          }
        }
      }
    }

    // Standard UIC Excel template puts Company Name on the row directly below "Attn To:" in column B (or C)
    if (!extractedHeader.client && attnRowIdx >= 0) {
      for (let rIdx = attnRowIdx + 1; rIdx <= Math.min(attnRowIdx + 2, headerRowIdx - 1); rIdx++) {
        const row = rows[rIdx] || [];
        const maxLeftCol = Math.max(2, attnColIdx + 1);
        for (let cIdx = 0; cIdx <= maxLeftCol && cIdx < row.length; cIdx++) {
          const cellVal = String(row[cIdx] ?? '').trim();
          if (!cellVal) continue;
          if (/^(location|sub|subject|dear\s+sir|ref|date|quotation|delivery|service)/i.test(cellVal)) break;
          if (parseFlexibleDate(cellVal)) continue;
          extractedHeader.client = cellVal;
          break;
        }
        if (extractedHeader.client) break;
      }
    }

    // Fallback: look at row right above "Location:"
    if (!extractedHeader.client && locationRowIdx > 0) {
      const prevRow = rows[locationRowIdx - 1] || [];
      for (let cIdx = 0; cIdx <= 2 && cIdx < prevRow.length; cIdx++) {
        const cellVal = String(prevRow[cIdx] ?? '').trim();
        if (
          cellVal &&
          !/^(attn|attention|ref|date|quotation|location|dear\s+sir)/i.test(cellVal) &&
          !parseFlexibleDate(cellVal)
        ) {
          extractedHeader.client = cellVal;
          break;
        }
      }
    }

    // Fallback date scan across all header cells if still missing
    if (!extractedHeader.date) {
      for (let i = 0; i < headerRowIdx && !extractedHeader.date; i++) {
        for (const cell of rows[i] || []) {
          const parsedD = parseFlexibleDate(cell);
          if (parsedD) {
            extractedHeader.date = parsedD;
            break;
          }
        }
      }
    }

    // If Attn To had company name directly and no separate company row existed
    if (!extractedHeader.client && extractedHeader.attn) {
      extractedHeader.client = extractedHeader.attn;
    }

    // Filename fallback ONLY if ref or client is still empty
    const fromFilename = extractRefAndClientFromFilename(file.name);
    if (!extractedHeader.ref && fromFilename.ref) {
      extractedHeader.ref = fromFilename.ref;
    }
    if (!extractedHeader.client && fromFilename.client) {
      extractedHeader.client = fromFilename.client;
    }

    // Extract items
    const parsedItems: LineItem[] = [];
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      let d = String(r[descCol] ?? '').trim();
      if (!d || /^(total|vat|net|requested)/i.test(d)) continue;

      let q = qtyCol >= 0 ? parseFloat(String(r[qtyCol]).replace(/[,\s]/g, '')) : 1;
      if (isNaN(q) || q <= 0) {
        const rawQ = String(r[qtyCol] ?? '').trim();
        if (rawQ && isNaN(Number(rawQ))) {
          d += ` (${rawQ})`;
        }
        q = 1;
      }

      let rVal = rateCol >= 0 ? parseNumber(r[rateCol]) : 0;
      if (rVal === 0 && amountCol >= 0) {
        const amt = parseNumber(r[amountCol]);
        if (amt > 0) rVal = Math.round((amt / q) * 100) / 100;
      }

      parsedItems.push({
        d,
        q,
        r: rVal,
        sns: getVal(r, serialCol),
        sz: getVal(r, sizeCol),
        cl: getVal(r, classCol),
        rm: getVal(r, remarkCol),
      });
    }

    return {
      items: parsedItems,
      header: extractedHeader,
    };
  }
}
