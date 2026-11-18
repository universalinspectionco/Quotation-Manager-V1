/**
 * Canvas-based text renderer utility for jsPDF.
 * Renders multilingual text (Chinese, Japanese, Arabic, Korean, etc.) with high DPI,
 * overcoming jsPDF's built-in 8-bit Latin-1 WinAnsi encoding limitation.
 */

export function hasNonLatin(str: string): boolean {
  if (!str) return false;
  // Match any character outside standard ASCII and Latin-1 supplement / common symbols
  // Covers CJK (\u4E00-\u9FFF), Hiragana/Katakana (\u3040-\u30FF), Arabic (\u0600-\u06FF, \u0750-\u077F, \uFB50-\uFDFF, \uFE70-\uFEFF),
  // Cyrillic (\u0400-\u04FF), Hangul (\uAC00-\uD7AF), Thai (\u0E00-\u0E7F), Devangari, etc.
  return /[^\u0000-\u024F\u2000-\u206F\u20A0-\u20CF]/.test(str);
}

export function isRtlText(str: string): boolean {
  if (!str) return false;
  // Matches Arabic, Hebrew, Persian, Urdu
  return /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(str);
}

const SYSTEM_FONT_FAMILY =
  '"Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Meiryo", "Arial Unicode MS", "Noto Sans", "Noto Sans Arabic", "Apple Color Emoji", sans-serif';

interface WrapOptions {
  fontSizePt: number;
  isBold?: boolean;
}

/**
 * Wraps text into lines using a real canvas 2D context.
 * Correctly handles character-level breaking for CJK and word-level breaking for space-delimited text.
 */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidthPx: number
): string[] {
  const result: string[] = [];
  const paragraphs = String(text ?? '').split('\n');

  for (const para of paragraphs) {
    if (!para) {
      result.push('');
      continue;
    }

    let current = '';
    let lastSpace = -1;

    for (let i = 0; i < para.length; i++) {
      const char = para[i];
      const candidate = current + char;
      const metrics = ctx.measureText(candidate);

      if (metrics.width > maxWidthPx && current.length > 0) {
        if (lastSpace > 0 && lastSpace < current.length - 1) {
          result.push(current.slice(0, lastSpace));
          current = current.slice(lastSpace + 1) + char;
          lastSpace = current.lastIndexOf(' ');
        } else {
          result.push(current);
          current = char;
          lastSpace = char === ' ' ? 0 : -1;
        }
      } else {
        if (char === ' ') lastSpace = current.length;
        current = candidate;
      }
    }

    if (current) {
      result.push(current);
    }
  }

  return result.length ? result : [''];
}

let measureCanvas: HTMLCanvasElement | null = null;
let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!measureCanvas) {
    measureCanvas = document.createElement('canvas');
    measureCanvas.width = 100;
    measureCanvas.height = 100;
    measureCtx = measureCanvas.getContext('2d');
  }
  return measureCtx;
}

/**
 * Calculates the rendered height in PDF points for a multilingual text snippet.
 */
export function measureCanvasTextHeight(
  text: string,
  maxWidthPt: number,
  fontSizePt: number,
  isBold = false
): number {
  const ctx = getMeasureCtx();
  if (!ctx || !text) return fontSizePt * 1.35;

  const font = `${isBold ? 'bold' : 'normal'} ${fontSizePt}px ${SYSTEM_FONT_FAMILY}`;
  ctx.font = font;

  const lines = wrapLines(ctx, text, Math.max(10, maxWidthPt));
  const lineHeightPt = fontSizePt * 1.35;
  return Math.max(lineHeightPt, lines.length * lineHeightPt);
}

export interface RenderTextResult {
  dataUrl: string;
  widthPt: number;
  heightPt: number;
}

/**
 * Renders a multilingual text string to a crisp high-DPI transparent PNG data URL for jsPDF insertion.
 */
export function renderTextSnippetToCanvas(
  text: string,
  maxWidthPt: number,
  options: {
    fontSizePt?: number;
    isBold?: boolean;
    textColor?: [number, number, number] | number[];
    halign?: 'left' | 'center' | 'right';
    scale?: number;
    backgroundColor?: [number, number, number] | null;
  } = {}
): RenderTextResult {
  const fontSizePt = options.fontSizePt || 10;
  const isBold = options.isBold || false;
  const textColor = options.textColor || [31, 41, 55];
  const halign = options.halign || 'left';
  const scale = options.scale || 3; // 3x scale produces crisp 216 DPI output for PDF letterhead
  const rtl = isRtlText(text);

  if (typeof document === 'undefined') {
    return { dataUrl: '', widthPt: maxWidthPt, heightPt: fontSizePt * 1.35 };
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { dataUrl: '', widthPt: maxWidthPt, heightPt: fontSizePt * 1.35 };
  }

  const maxWidthPx = Math.max(10, maxWidthPt * scale);
  const fontSizePx = fontSizePt * scale;
  const lineHeightPx = fontSizePx * 1.35;

  ctx.font = `${isBold ? 'bold ' : ''}${fontSizePx}px ${SYSTEM_FONT_FAMILY}`;
  const lines = wrapLines(ctx, text, maxWidthPx);

  const totalHeightPx = Math.max(lineHeightPx, lines.length * lineHeightPx + 4 * scale);
  canvas.width = Math.ceil(maxWidthPx);
  canvas.height = Math.ceil(totalHeightPx);

  // Set context state again after resize
  if (options.backgroundColor) {
    ctx.fillStyle = `rgb(${options.backgroundColor[0]}, ${options.backgroundColor[1]}, ${options.backgroundColor[2]})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  ctx.font = `${isBold ? 'bold ' : ''}${fontSizePx}px ${SYSTEM_FONT_FAMILY}`;
  ctx.fillStyle = `rgb(${textColor[0]}, ${textColor[1]}, ${textColor[2]})`;
  ctx.textBaseline = 'alphabetic';
  ctx.direction = rtl ? 'rtl' : 'ltr';

  lines.forEach((line, idx) => {
    if (!line) return;
    const yPos = idx * lineHeightPx + fontSizePx * 0.9;
    let xPos = 0;

    if (halign === 'center') {
      const metrics = ctx.measureText(line);
      xPos = (maxWidthPx - metrics.width) / 2;
    } else if (halign === 'right' || rtl) {
      const metrics = ctx.measureText(line);
      xPos = maxWidthPx - metrics.width;
    } else {
      xPos = 0;
    }

    ctx.fillText(line, Math.max(0, xPos), yPos);
  });

  const widthPt = maxWidthPt;
  const heightPt = totalHeightPx / scale;

  return {
    dataUrl: canvas.toDataURL('image/png'),
    widthPt,
    heightPt,
  };
}
