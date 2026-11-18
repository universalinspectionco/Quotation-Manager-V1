import { Quotation, Settings } from '../types/quotation';
import { getAssetImage, getImageFormat } from '../data/assets';
import { calculateTotals, formatCurrency, formatDateUK, parseSerialNumbers, sanitizeFilename } from '../utils/formatters';
import { hasNonLatin, isRtlText, measureCanvasTextHeight, renderTextSnippetToCanvas } from '../utils/canvasText';

declare global {
  interface Window {
    jspdf: any;
  }
}

export class PdfGeneratorService {
  /**
   * Generates a jsPDF document for the given quotation and settings.
   */
  public static createQuotePdf(q: Quotation, settings: Settings): any {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('jsPDF library is not loaded. Please verify your connection.');
    }

    const V = q.type === 'valve';
    const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
    const W = 612;
    const H = 792;
    const M = 36;
    const CW = W - 2 * M;
    const TOP = 96;
    const BOT = 712;
    const done = new Set<number>();
    const totals = calculateTotals(q);

    const lh = settings.lh || 'band';
    const ACC = [30, 58, 138];    // Corporate Dark Navy Blue #1E3A8A
    const INK = [31, 41, 55];     // Slate #1F2937
    const LINE = [203, 213, 225]; // Border #CBD5E1
    const TOT = [239, 246, 255];  // Subtotal fill Soft Blue #EFF6FF
    const ZEB = [248, 250, 252];  // Alternating row fill #F8FAFC

    const getDim = (imgUrl: string) => {
      try {
        const props = doc.getImageProperties(imgUrl);
        return props.height / props.width;
      } catch {
        return 0.15;
      }
    };

    const headerImg = getAssetImage('hdr', settings);
    const footerImg = getAssetImage('ftr', settings);
    const watermarkImg = getAssetImage('wm', settings);

    // Page decoration callback (runs on every page)
    const decor = () => {
      const pageNum = doc.internal.getCurrentPageInfo().pageNumber;
      if (done.has(pageNum)) return;
      done.add(pageNum);

      // 1. Watermark logo in center
      if (lh !== 'none' && watermarkImg) {
        try {
          const GState = doc.GState;
          doc.setGState(new GState({ opacity: 0.08 }));
          const wmDim = getDim(watermarkImg);
          doc.addImage(
            watermarkImg,
            getImageFormat(watermarkImg),
            W / 2 - 150,
            H / 2 - 150 * wmDim,
            300,
            300 * wmDim
          );
          doc.setGState(new GState({ opacity: 1 }));
        } catch (e) {
          console.warn('Failed to draw watermark on PDF:', e);
        }
      }

      // 2. Header banner - Full Corporate Dark Navy Blue
      if (lh !== 'none' && headerImg) {
        try {
          const hDim = getDim(headerImg);
          if (lh === 'orig') {
            doc.addImage(headerImg, getImageFormat(headerImg), M, 16, CW, CW * hDim);
          } else {
            // Modern Dark Navy Blue Band Header (guaranteed solid dark blue base + banner)
            doc.setFillColor(ACC[0], ACC[1], ACC[2]);
            doc.rect(0, 0, W, W * hDim, 'F');
            doc.addImage(headerImg, getImageFormat(headerImg), 0, 0, W, W * hDim);
          }
        } catch (e) {
          console.warn('Failed to draw header banner on PDF:', e);
        }
      }

      // 3. Footer band - Full Corporate Dark Navy Blue
      if (lh !== 'none' && footerImg) {
        try {
          const fDim = getDim(footerImg);
          if (lh === 'orig') {
            doc.addImage(footerImg, getImageFormat(footerImg), M, H - 14 - CW * fDim, CW, CW * fDim);
          } else {
            // Modern Dark Navy Blue Band Footer (guaranteed solid dark blue base + banner)
            doc.setFillColor(ACC[0], ACC[1], ACC[2]);
            doc.rect(0, H - W * fDim, W, W * fDim, 'F');
            doc.addImage(footerImg, getImageFormat(footerImg), 0, H - W * fDim, W, W * fDim);
          }
        } catch (e) {
          console.warn('Failed to draw footer banner on PDF:', e);
        }
      }
    };

    let y = TOP;

    const checkPageBreak = (neededHeight: number) => {
      if (y + neededHeight > BOT) {
        doc.addPage();
        decor();
        y = TOP;
      }
    };

    const addParagraph = (text: string, options: { b?: boolean; g?: number } = {}) => {
      const lines = String(text || '').split('\n');
      lines.forEach((l) => {
        if (!l.trim()) {
          y += 4;
          return;
        }
        if (hasNonLatin(l)) {
          const snip = renderTextSnippetToCanvas(l, CW, {
            fontSizePt: 10,
            isBold: options.b,
            textColor: INK,
            halign: isRtlText(l) ? 'right' : 'left',
          });
          checkPageBreak(snip.heightPt + 4);
          doc.addImage(snip.dataUrl, 'PNG', M, y, snip.widthPt, snip.heightPt);
          y += snip.heightPt + (options.g ?? 3);
        } else {
          doc.setFont('helvetica', options.b ? 'bold' : 'normal');
          doc.setFontSize(10);
          doc.setTextColor(INK[0], INK[1], INK[2]);
          const wrapped = doc.splitTextToSize(l || ' ', CW);
          wrapped.forEach((w: string) => {
            checkPageBreak(14);
            doc.text(w, M, y + 10);
            y += 13;
          });
          y += options.g ?? 3;
        }
      });
    };

    const addSectionHeader = (title: string) => {
      checkPageBreak(30);
      y += 6;
      if (hasNonLatin(title)) {
        const snip = renderTextSnippetToCanvas(title, CW, {
          fontSizePt: 11,
          isBold: true,
          textColor: ACC,
          halign: isRtlText(title) ? 'right' : 'left',
        });
        doc.addImage(snip.dataUrl, 'PNG', M, y, snip.widthPt, snip.heightPt);
        y += snip.heightPt + 2;
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(ACC[0], ACC[1], ACC[2]);
        doc.text(title, M, y + 10);
        y += 12;
      }
      doc.setDrawColor(ACC[0], ACC[1], ACC[2]);
      doc.setLineWidth(0.8);
      doc.line(M, y + 0.5, M + CW, y + 0.5);
      doc.setDrawColor(0);
      doc.setLineWidth(0.2);
      y += 9;
    };

    // Draw first page decoration
    decor();

    // 1. Title Banner Box
    doc.setFillColor(ACC[0], ACC[1], ACC[2]);
    doc.rect(M, y, CW, 22, 'F');
    const titleText = (V && q.revised ? 'REVISED ' : '') + String(q.title || 'QUOTATION').toUpperCase();
    if (hasNonLatin(titleText)) {
      const snip = renderTextSnippetToCanvas(titleText, CW - 20, {
        fontSizePt: 11.5,
        isBold: true,
        textColor: [255, 255, 255],
        halign: 'center',
      });
      doc.addImage(snip.dataUrl, 'PNG', M + 10, y + (22 - snip.heightPt) / 2, snip.widthPt, snip.heightPt);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(255, 255, 255);
      doc.text(titleText, W / 2, y + 15, { align: 'center' });
    }
    y += 40;

    // 2. Metadata Block (Attn, Ref, Client, Date, Location)
    const formattedDate = formatDateUK(q.date);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(ACC[0], ACC[1], ACC[2]);
    doc.text('Attn To:', M, y);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    if (hasNonLatin(q.attn || '')) {
      const snip = renderTextSnippetToCanvas(q.attn || '', 240, { fontSizePt: 10.5, isBold: true, textColor: INK });
      doc.addImage(snip.dataUrl, 'PNG', M + doc.getTextWidth('Attn To:') + 5, y - 9, snip.widthPt, snip.heightPt);
    } else {
      doc.text(q.attn || '', M + doc.getTextWidth('Attn To:') + 5, y);
    }
    doc.text(`Ref.: ${q.ref}`, W - M, y, { align: 'right' });
    y += 16;

    if (hasNonLatin(q.client || '')) {
      const snip = renderTextSnippetToCanvas(q.client || '', 280, { fontSizePt: 10.5, isBold: true, textColor: INK });
      doc.addImage(snip.dataUrl, 'PNG', M, y - 9, snip.widthPt, snip.heightPt);
    } else {
      doc.text(q.client || '', M, y);
    }
    doc.text(`Date :   ${formattedDate}`, W - M, y, { align: 'right' });
    y += 16;

    if (hasNonLatin(q.location || '')) {
      doc.text('Location: ', M, y);
      const snip = renderTextSnippetToCanvas(q.location || '', 280, { fontSizePt: 10.5, isBold: true, textColor: INK });
      doc.addImage(snip.dataUrl, 'PNG', M + doc.getTextWidth('Location: '), y - 9, snip.widthPt, snip.heightPt);
    } else {
      doc.text(`Location: ${q.location || ''}`, M, y);
    }
    y += 22;

    // 3. Subject (if valve quote)
    if (V && q.sub) {
      addParagraph(`Sub: ${q.sub}`, { b: true, g: 8 });
    }

    // 4. Intro & Terms
    addParagraph(q.intro, { b: true, g: 4 });
    if (q.delivery) addParagraph(`Delivery Terms: ${q.delivery}`, { b: true });
    if (q.service) addParagraph(`Service Beginning Terms: ${q.service}`, { b: true });
    y += 6;

    // 5. Build Columns & Rows
    const RM = !V && q.showRm;
    const formatSerials = (item: any) => {
      const serials = parseSerialNumbers(item.sns);
      if (!serials.length) return '';
      if (serials.length <= 8) return `\nS/N: ${serials.join(', ')}`;
      return `\nSerial nos.: ${serials.length} units (see Annexure)`;
    };

    const rateNoteSuffix = q.rateNote ? `\n${q.rateNote}` : '';

    interface ColumnDef {
      header: string;
      align: 'left' | 'center' | 'right';
      width?: number;
    }

    const columns: ColumnDef[] = V
      ? [
          { header: 'S No', align: 'center', width: 34 },
          { header: 'Description', align: 'left' },
          { header: 'Size (Inch)', align: 'center', width: 54 },
          { header: 'Class Rating', align: 'center', width: 62 },
          { header: 'Qty', align: 'center', width: 34 },
          { header: `Unit Rate in SR${rateNoteSuffix}`, align: 'right', width: 76 },
          { header: `Amount in SR${rateNoteSuffix}`, align: 'right', width: 76 },
          { header: 'Remarks', align: 'left', width: 72 },
        ]
      : [
          { header: 'S No', align: 'center', width: 42 },
          { header: 'Description', align: 'left' },
          { header: 'Qty', align: 'center', width: 40 },
          { header: 'Unit Rate (SAR)', align: 'right', width: 90 },
          { header: 'Amount (SAR)', align: 'right', width: 90 },
          ...(RM ? [{ header: 'Remarks', align: 'left' as const, width: 92 }] : []),
        ];

    const columnStyles: Record<number, any> = {};
    columns.forEach((col, idx) => {
      columnStyles[idx] = { halign: col.align };
      if (col.width) columnStyles[idx].cellWidth = col.width;
    });

    const qtyColIndex = V ? 4 : 2;
    const amountColIndex = V ? 6 : 4;
    const totalColsCount = columns.length;

    const tableRows = q.items.map((item, idx) => {
      if (V) {
        return [
          idx + 1,
          item.d,
          item.sz || '',
          item.cl || '',
          String(item.q),
          formatCurrency(item.r),
          formatCurrency(item.q * item.r),
          item.rm || '',
        ];
      } else {
        const descWithSerials = item.d + formatSerials(item);
        const row = [
          idx + 1,
          descWithSerials,
          String(item.q).padStart(2, '0'),
          formatCurrency(item.r),
          formatCurrency(item.q * item.r),
        ];
        if (RM) row.push(item.rm || '');
        return row;
      }
    });

    // "REQUESTED TOTAL QUANTITIES" row for Standard services
    if (!V) {
      const summaryRow: any[] = [
        {
          content: 'REQUESTED TOTAL QUANTITIES',
          colSpan: qtyColIndex,
          styles: { halign: 'right', textColor: ACC, fontStyle: 'bold' },
        },
        {
          content: String(totals.totalQty),
          styles: { textColor: INK, fontStyle: 'bold', halign: 'center' },
        },
      ];
      while (summaryRow.length + (qtyColIndex - 1) < totalColsCount) {
        summaryRow.push('');
      }
      tableRows.push(summaryRow);
    }

    const tableMargin = { left: M, right: M, top: TOP, bottom: H - BOT };

    const attachMultilingualCellHooks = (customColumns?: ColumnDef[]) => ({
      didParseCell: (data: any) => {
        if (data.section === 'head' && customColumns) {
          data.cell.styles.halign = customColumns[data.column.index]?.align || 'center';
        }
        const raw = typeof data.cell.raw === 'string' ? data.cell.raw : String(data.cell.text?.join('\n') || '');
        if (hasNonLatin(raw)) {
          data.cell._hasNonLatin = true;
          data.cell._rawText = raw;
          const fontPt = data.cell.styles.fontSize || (V ? 9.5 : 10);
          const isBold = data.cell.styles.fontStyle === 'bold';
          const padL = typeof data.cell.padding === 'function' ? data.cell.padding('left') : 6;
          const padR = typeof data.cell.padding === 'function' ? data.cell.padding('right') : 6;
          const padT = typeof data.cell.padding === 'function' ? data.cell.padding('top') : 4.5;
          const padB = typeof data.cell.padding === 'function' ? data.cell.padding('bottom') : 4.5;
          const colWidth = (data.column.width || 120) - (padL + padR);
          const textHeight = measureCanvasTextHeight(raw, colWidth, fontPt, isBold);
          const minHeight = textHeight + padT + padB;
          if (minHeight > (data.cell.styles.minCellHeight || 0)) {
            data.cell.styles.minCellHeight = minHeight;
          }
        }
      },
      willDrawCell: (data: any) => {
        if (data.cell._hasNonLatin) {
          data.cell.text = [];
        }
      },
      didDrawCell: (data: any) => {
        if (data.cell._hasNonLatin && data.cell._rawText) {
          const padL = typeof data.cell.padding === 'function' ? data.cell.padding('left') : 6;
          const padR = typeof data.cell.padding === 'function' ? data.cell.padding('right') : 6;
          const padT = typeof data.cell.padding === 'function' ? data.cell.padding('top') : 4.5;
          const availW = data.cell.width - (padL + padR);
          const fontPt = data.cell.styles.fontSize || (V ? 9.5 : 10);
          const isBold = data.cell.styles.fontStyle === 'bold';
          const rawTextColor = data.cell.styles.textColor || INK;
          const textColor = Array.isArray(rawTextColor) ? rawTextColor : INK;
          const halign = data.cell.styles.halign || 'left';

          const res = renderTextSnippetToCanvas(data.cell._rawText, availW, {
            fontSizePt: fontPt,
            isBold,
            textColor,
            halign: isRtlText(data.cell._rawText) ? 'right' : (halign as any),
          });

          if (res.dataUrl) {
            doc.addImage(res.dataUrl, 'PNG', data.cell.x + padL, data.cell.y + padT, res.widthPt, res.heightPt);
          }
        }
      },
    });

    doc.autoTable({
      startY: y,
      margin: tableMargin,
      theme: 'grid',
      head: [columns.map((c) => c.header)],
      body: tableRows,
      styles: {
        font: 'helvetica',
        fontSize: V ? 9.5 : 10,
        textColor: INK,
        cellPadding: { top: 4.5, bottom: 4.5, left: 6, right: 6 },
        valign: 'middle',
        lineColor: LINE,
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: ACC,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: V ? 9 : 9.5,
      },
      alternateRowStyles: { fillColor: ZEB },
      columnStyles,
      ...attachMultilingualCellHooks(columns),
      willDrawPage: decor,
    });

    // Subtotal, VAT, Net Total Rows
    const makeSummaryRow = (label: string, value: string, textColor?: number[], bgColor?: number[]) => {
      const row: any[] = [
        {
          content: label,
          colSpan: amountColIndex,
          styles: {
            halign: 'right',
            textColor: textColor || INK,
            fillColor: bgColor || TOT,
          },
        },
        {
          content: value,
          styles: {
            halign: 'right',
            textColor: textColor || INK,
            fillColor: bgColor || TOT,
          },
        },
      ];
      if (totalColsCount > amountColIndex + 1) {
        row.push({ content: '', styles: { fillColor: bgColor || TOT } });
      }
      return row;
    };

    if (!V || q.showTot) {
      doc.autoTable({
        startY: doc.lastAutoTable.finalY,
        margin: tableMargin,
        theme: 'grid',
        body: [
          makeSummaryRow('Total Amount', formatCurrency(totals.subtotal)),
          makeSummaryRow(`Vat Amount ${q.vat}%`, formatCurrency(totals.vatAmount)),
          makeSummaryRow('Net Total Amount', formatCurrency(totals.netTotal), [255, 255, 255], ACC),
        ],
        styles: {
          font: 'helvetica',
          fontSize: 10.5,
          fontStyle: 'bold',
          cellPadding: { top: 4.5, bottom: 4.5, left: 6, right: 6 },
          lineColor: LINE,
          lineWidth: 0.5,
        },
        columnStyles,
        willDrawPage: decor,
      });
    }

    // Optional VAT note for valve quote
    if (V && q.vatNote) {
      doc.autoTable({
        startY: doc.lastAutoTable.finalY,
        margin: tableMargin,
        theme: 'grid',
        body: [
          [
            {
              content: q.vatNote,
              colSpan: totalColsCount,
              styles: { halign: 'center', textColor: [200, 30, 30] },
            },
          ],
        ],
        styles: {
          font: 'helvetica',
          fontSize: 9.5,
          cellPadding: 4.5,
          lineColor: LINE,
          lineWidth: 0.5,
        },
        willDrawPage: decor,
      });
    }

    y = doc.lastAutoTable.finalY + 14;

    // 6. Terms & Conditions with styled section headers
    const tcLines = String(q.tc || '').split('\n');
    tcLines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        y += 3;
        return;
      }
      if (/^[A-Za-z&' ]{3,40}:$/.test(trimmed)) {
        addSectionHeader(trimmed);
      } else {
        addParagraph(line);
      }
    });

    // 7. Closing & Best Regards
    y += 8;
    addParagraph(q.closing || '');
    y += 4;
    addParagraph('Thanks & Best Regards,', { b: true });

    // 8. Signature & Stamp (if attached)
    const signatureImg = settings.sig;
    if (q.sign && signatureImg) {
      try {
        const ip = doc.getImageProperties(signatureImg);
        const sigW = Math.min(130, ip.width);
        const sigH = (sigW * ip.height) / ip.width;
        checkPageBreak(sigH + 52);
        doc.addImage(signatureImg, getImageFormat(signatureImg), M, y + 4, sigW, sigH);
        y += sigH + 12;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(INK[0], INK[1], INK[2]);

        const now = new Date();
        const pad2 = (v: number) => String(v).padStart(2, '0');
        const timestamp = `${now.getFullYear()}.${pad2(now.getMonth() + 1)}.${pad2(now.getDate())} ${pad2(
          now.getHours()
        )}:${pad2(now.getMinutes())}`;

        const signerLines = [settings.signer, settings.role, timestamp].filter(Boolean);
        signerLines.forEach((l) => {
          doc.text(l, M, y + 8);
          y += 11;
        });
      } catch (e) {
        console.warn('Failed to embed signature image:', e);
      }
    }

    // 9. Annexure Page(s) for items with > 8 serial numbers
    const annexureItems = V
      ? []
      : q.items
          .map((item, idx) => ({ idx, item, serials: parseSerialNumbers(item.sns) }))
          .filter((obj) => obj.serials.length > 8);

    if (annexureItems.length) {
      doc.addPage();
      decor();
      y = TOP;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(ACC[0], ACC[1], ACC[2]);
      doc.text('ANNEXURE – SERIAL NUMBERS', M, y + 10);
      y += 26;

      annexureItems.forEach((obj) => {
        if (y > BOT - 70) {
          doc.addPage();
          decor();
          y = TOP;
        }

        const gridRows: string[][] = [];
        for (let a = 0; a < obj.serials.length; a += 4) {
          const cells = [0, 1, 2, 3].map((j) =>
            obj.serials[a + j] !== undefined ? `${a + j + 1}.  ${obj.serials[a + j]}` : ''
          );
          gridRows.push(cells);
        }

        doc.autoTable({
          startY: y,
          margin: tableMargin,
          theme: 'grid',
          head: [
            [
              {
                content: `Item ${obj.idx + 1} – ${obj.item.d}  (${obj.serials.length} serial numbers)`,
                colSpan: 4,
                styles: { halign: 'left' },
              },
            ],
          ],
          body: gridRows,
          styles: {
            font: 'helvetica',
            fontSize: 9,
            textColor: INK,
            cellPadding: 3.5,
            lineColor: LINE,
            lineWidth: 0.5,
          },
          headStyles: {
            fillColor: ACC,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
          },
          ...attachMultilingualCellHooks(),
          willDrawPage: decor,
        });

        y = doc.lastAutoTable.finalY + 14;
      });
    }

    // 10. Dynamic Page Numbering across all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      if (lh === 'band') {
        doc.setTextColor(255, 255, 255);
        doc.text(`Page ${i} of ${totalPages}`, W / 2, H - 14, { align: 'center' });
      } else {
        doc.setTextColor(120, 120, 120);
        doc.text(`Page ${i} of ${totalPages}`, lh === 'orig' ? W - M : W / 2, lh === 'orig' ? H - 62 : H - 30, {
          align: lh === 'orig' ? 'right' : 'center',
        });
      }
    }

    return doc;
  }

  /**
   * Returns a Blob for the generated PDF
   */
  public static getQuotePdfBlob(q: Quotation, settings: Settings): Blob {
    const doc = this.createQuotePdf(q, settings);
    return doc.output('blob');
  }

  /**
   * Triggers download of the generated PDF
   */
  public static downloadQuotePdf(q: Quotation, settings: Settings): void {
    const blob = this.getQuotePdfBlob(q, settings);
    const filename = `${sanitizeFilename(q)}.pdf`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
