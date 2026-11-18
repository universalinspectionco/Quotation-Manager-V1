import { Quotation, Settings } from '../types/quotation';
import { getAssetImage } from '../data/assets';
import { calculateTotals, formatCurrency, formatDateUK, parseSerialNumbers, sanitizeFilename } from '../utils/formatters';

declare global {
  interface Window {
    JSZip: any;
    jspdf: any;
  }
}

const WC = '1E3A8A'; // Corporate Dark Navy Blue brand color
const E = (s: any) =>
  String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] || c));

const b64Data = (u: string) => String(u || '').split(',')[1] || '';

export class WordGeneratorService {
  private static makeParagraph(
    text: any,
    options: {
      b?: boolean;
      s?: number;
      col?: string;
      c?: boolean;
      r?: boolean;
      g?: number;
    } = {}
  ): string {
    const align = options.c ? 'center' : options.r ? 'right' : 'left';
    const spacing = options.g ?? 80;
    const lines = String(text ?? '').split('\n');

    return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:after="${spacing}"/></w:pPr>${lines
      .map(
        (l, i) =>
          `<w:r><w:rPr><w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI" w:cs="Segoe UI"/>${
            options.b ? '<w:b/>' : ''
          }${options.col ? `<w:color w:val="${options.col}"/>` : ''}<w:sz w:val="${
            options.s || 20
          }"/></w:rPr>${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${E(l)}</w:t></w:r>`
      )
      .join('')}</w:p>`;
  }

  private static makeTable(rows: any[][], widths: number[], alignments?: ('l' | 'c' | 'r')[]): string {
    const totalWidth = widths.reduce((a, b) => a + b, 0);
    return `<w:tbl><w:tblPr><w:tblW w:w="${totalWidth}" w:type="dxa"/><w:tblBorders>${[
      'top',
      'left',
      'bottom',
      'right',
      'insideH',
      'insideV',
    ]
      .map((b) => `<w:${b} w:val="single" w:sz="4" w:color="C6D6D4"/>`)
      .join('')}</w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${widths
      .map((x) => `<w:gridCol w:w="${x}"/>`)
      .join('')}</w:tblGrid>${rows
      .map(
        (r, ri) =>
          `<w:tr>${r
            .map((c, ci) => {
              const obj = c !== null && typeof c === 'object' ? c : { t: c };
              const isHead = ri === 0 && !obj.nh;
              const align = obj.al || (alignments && alignments[ci]);
              const cellWidth = widths
                .slice(ci, ci + (obj.span || 1))
                .reduce((acc: number, val: number) => acc + val, 0);

              return `<w:tc><w:tcPr><w:tcW w:w="${cellWidth}" w:type="dxa"/>${
                obj.span ? `<w:gridSpan w:val="${obj.span}"/>` : ''
              }${isHead ? `<w:shd w:val="clear" w:fill="${WC}"/>` : obj.fill ? `<w:shd w:val="clear" w:fill="${obj.fill}"/>` : ''}<w:vAlign w:val="center"/></w:tcPr>${this.makeParagraph(
                obj.t,
                {
                  b: isHead || obj.b,
                  col: isHead ? 'FFFFFF' : obj.col,
                  s: 19,
                  g: 40,
                  r: align === 'r',
                  c: align === 'c',
                }
              )}</w:tc>`;
            })
            .join('')}</w:tr>`
      )
      .join('')}</w:tbl>`;
  }

  /**
   * Generates a complete .docx Word file for a quotation.
   */
  public static async generateQuoteWord(q: Quotation, settings: Settings): Promise<Blob> {
    if (!window.JSZip) {
      throw new Error('JSZip library is not loaded.');
    }

    const zip = new window.JSZip();
    const V = q.type === 'valve';
    const RM = !V && q.showRm;
    const totals = calculateTotals(q);
    const dateFormatted = formatDateUK(q.date);

    const lh = settings.lh || 'band';
    const headerImg = lh === 'none' ? null : getAssetImage('hdr', settings);
    const footerImg = lh === 'none' ? null : getAssetImage('ftr', settings);

    const docPrNamespaces =
      'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

    const CX = 6286500;
    const makePictureXml = (imgUrl: string, id: number) => {
      let cy = 900000;
      if (window.jspdf && window.jspdf.jsPDF) {
        try {
          const doc = new window.jspdf.jsPDF();
          const p = doc.getImageProperties(imgUrl);
          cy = Math.round((CX * p.height) / p.width);
        } catch {}
      }
      return `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${CX}" cy="${cy}"/><wp:docPr id="${id}" name="Picture ${id}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="img${id}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${CX}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    };

    const makeRelsXml = (type: string, file: string) =>
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${type}" Target="${file}"/></Relationships>`;
    const IMG_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';

    const getExt = (u: string) => (/png/i.test(String(u).slice(0, 30)) ? 'png' : 'jpg');

    zip.file(
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        (headerImg ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : '') +
        (footerImg ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : '') +
        '</Types>'
    );

    zip.file(
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    );

    zip.file(
      'word/_rels/document.xml.rels',
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        (headerImg ? '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' : '') +
        (footerImg ? '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' : '') +
        '</Relationships>'
    );

    if (headerImg) {
      zip.file(
        'word/header1.xml',
        `<?xml version="1.0" encoding="UTF-8"?><w:hdr ${docPrNamespaces}>${makePictureXml(headerImg, 1)}</w:hdr>`
      );
      zip.file('word/_rels/header1.xml.rels', makeRelsXml(IMG_REL_TYPE, `media/hdr.${getExt(headerImg)}`));
      zip.file(`word/media/hdr.${getExt(headerImg)}`, b64Data(headerImg), { base64: true });
    }

    if (footerImg) {
      zip.file(
        'word/footer1.xml',
        `<?xml version="1.0" encoding="UTF-8"?><w:ftr ${docPrNamespaces}>${makePictureXml(footerImg, 2)}</w:ftr>`
      );
      zip.file('word/_rels/footer1.xml.rels', makeRelsXml(IMG_REL_TYPE, `media/ftr.${getExt(footerImg)}`));
      zip.file(`word/media/ftr.${getExt(footerImg)}`, b64Data(footerImg), { base64: true });
    }

    // Build Table Body
    const formatSerials = (item: any) => {
      const serials = parseSerialNumbers(item.sns);
      if (!serials.length) return '';
      if (serials.length <= 8) return `\nS/N: ${serials.join(', ')}`;
      return `\nSerial nos.: ${serials.length} units (see Annexure)`;
    };

    const rateNoteSuffix = q.rateNote ? `\n${q.rateNote}` : '';

    const tableHeaders = V
      ? [
          'S No',
          'Description',
          'Size (Inch)',
          'Class Rating',
          'Qty',
          `Unit Rate in SR${rateNoteSuffix}`,
          `Amount in SR${rateNoteSuffix}`,
          'Remarks',
        ]
      : ['S No', 'Description', 'Qty', 'Unit Rate (SAR)', 'Amount (SAR)', ...(RM ? ['Remarks'] : [])];

    const widths = V
      ? [600, 2500, 900, 1100, 700, 1350, 1350, 1400]
      : RM
      ? [700, 3300, 800, 1600, 1700, 1800]
      : [800, 4700, 900, 1750, 1750];

    const alignments: ('l' | 'c' | 'r')[] = V
      ? ['c', 'l', 'c', 'c', 'c', 'r', 'r', 'l']
      : ['c', 'l', 'c', 'r', 'r', 'l'];

    const tableRows: any[][] = [
      tableHeaders,
      ...q.items.map((item, idx) =>
        V
          ? [
              idx + 1,
              item.d,
              item.sz || '',
              item.cl || '',
              item.q,
              formatCurrency(item.r),
              formatCurrency(item.q * item.r),
              item.rm || '',
            ]
          : [
              idx + 1,
              item.d + formatSerials(item),
              String(item.q).padStart(2, '0'),
              formatCurrency(item.r),
              formatCurrency(item.q * item.r),
              ...(RM ? [item.rm || ''] : []),
            ]
      ),
    ];

    let bodyXml =
      this.makeParagraph(
        (V && q.revised ? 'REVISED ' : '') + String(q.title || 'QUOTATION').toUpperCase(),
        { b: true, s: 26, c: true, col: WC, g: 160 }
      ) +
      this.makeParagraph(`Ref.: ${q.ref}      Date: ${dateFormatted}`, { r: true, b: true }) +
      this.makeParagraph(`Attn To: ${q.attn || ''}`, { b: true, col: WC, g: 20 }) +
      this.makeParagraph(q.client || '', { b: true, g: 20 }) +
      this.makeParagraph(`Location: ${q.location || ''}`, { b: true });

    if (V && q.sub) {
      bodyXml += this.makeParagraph(`Sub: ${q.sub}`, { b: true });
    }

    bodyXml += this.makeParagraph(q.intro, { b: true });
    if (q.delivery) bodyXml += this.makeParagraph(`Delivery Terms: ${q.delivery}`, { b: true });
    if (q.service) bodyXml += this.makeParagraph(`Service Beginning Terms: ${q.service}`, { b: true });

    bodyXml += this.makeTable(tableRows, widths, alignments);
    bodyXml += this.makeParagraph('', { g: 40 });

    if (!V || q.showTot) {
      bodyXml += this.makeParagraph(`Total Amount:   SAR ${formatCurrency(totals.subtotal)}`, { r: true, b: true });
      bodyXml += this.makeParagraph(`VAT ${q.vat}%:   SAR ${formatCurrency(totals.vatAmount)}`, { r: true, b: true });
      bodyXml += this.makeParagraph(`Net Total Amount:   SAR ${formatCurrency(totals.netTotal)}`, {
        r: true,
        b: true,
        col: WC,
      });
    }

    if (V && q.vatNote) {
      bodyXml += this.makeParagraph(q.vatNote, { c: true, col: 'C81E1E', b: true });
    }

    // Terms & conditions
    String(q.tc || '')
      .split('\n')
      .forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        bodyXml += /^[A-Za-z&' ]{3,40}:$/.test(trimmed)
          ? this.makeParagraph(trimmed, { b: true, col: WC, s: 22, g: 60 })
          : this.makeParagraph(line, { s: 19, g: 50 });
      });

    bodyXml += this.makeParagraph(q.closing || '', { g: 60 });
    bodyXml += this.makeParagraph('Thanks & Best Regards,', { b: true });

    // Annexure for serial numbers
    const annexureItems = V
      ? []
      : q.items
          .map((item, idx) => ({ idx, item, serials: parseSerialNumbers(item.sns) }))
          .filter((obj) => obj.serials.length > 8);

    if (annexureItems.length) {
      bodyXml += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      bodyXml += this.makeParagraph('ANNEXURE – SERIAL NUMBERS', { b: true, s: 24, col: WC });

      annexureItems.forEach((obj) => {
        const annexureRows: any[][] = [
          [{ t: `Item ${obj.idx + 1} – ${obj.item.d}  (${obj.serials.length} serial numbers)`, span: 4 }],
        ];

        for (let a = 0; a < obj.serials.length; a += 4) {
          const cells = [0, 1, 2, 3].map((j) =>
            obj.serials[a + j] !== undefined
              ? { t: `${a + j + 1}.  ${obj.serials[a + j]}`, nh: true }
              : { t: '', nh: true }
          );
          annexureRows.push(cells);
        }

        bodyXml += this.makeTable(annexureRows, [2476, 2476, 2476, 2476]);
        bodyXml += this.makeParagraph('', { g: 80 });
      });
    }

    const documentXml = `<?xml version="1.0" encoding="UTF-8"?><w:document ${docPrNamespaces}><w:body>${bodyXml}<w:sectPr>${
      headerImg ? '<w:headerReference w:type="default" r:id="rId1"/>' : ''
    }${
      footerImg ? '<w:footerReference w:type="default" r:id="rId2"/>' : ''
    }<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${headerImg ? 1700 : 1000}" w:right="1000" w:bottom="${
      footerImg ? 1200 : 1000
    }" w:left="1000" w:header="300" w:footer="300" w:gutter="0"/></w:sectPr></w:body></w:document>`;

    zip.file('word/document.xml', documentXml);

    return await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }

  /**
   * Generates a Word report summary document.
   */
  public static async generateReportWord(quotes: Quotation[]): Promise<Blob> {
    const sorted = [...quotes].sort((a, b) => a.date.localeCompare(b.date));
    const zip = new window.JSZip();

    let body =
      this.makeParagraph('Quotation Status Report', { b: true, s: 28, c: true, col: WC }) +
      this.makeParagraph(`Generated ${new Date().toISOString().slice(0, 10)} · ${sorted.length} quotes`, {
        c: true,
      });

    const tableRows = [
      ['Ref', 'Date', 'Client', 'Location', 'Net (SAR)', 'Status'],
      ...sorted.map((q) => [
        q.ref,
        q.date,
        q.client,
        q.location,
        formatCurrency(calculateTotals(q).netTotal),
        q.status,
      ]),
    ];

    body += this.makeTable(tableRows, [1500, 1200, 2700, 1900, 1400, 1200], ['l', 'c', 'l', 'l', 'r', 'c']);
    body += this.makeParagraph('', { g: 80 });

    const statuses = ['Waiting For PO', 'Job Received', 'Under Process', 'Completed', 'Lost', 'Draft'];
    statuses.forEach((s) => {
      const matching = sorted.filter((q) => q.status === s);
      const sum = matching.reduce((acc, q) => acc + calculateTotals(q).netTotal, 0);
      body += this.makeParagraph(`${s}: ${matching.length} quotes, SAR ${formatCurrency(sum)}`, { b: true });
    });

    zip.file(
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
    );
    zip.file(
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    );
    zip.file(
      'word/document.xml',
      `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000"/></w:sectPr></w:body></w:document>`
    );

    return await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }
}
