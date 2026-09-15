/**
 * Procedural Realistic Paper Texture and 3:4 Comic Typesetting Canvas Renderer
 */

import { ComicPanel, TypesetSettings } from '../types/comic';

// Cache generated paper texture canvas for performance
const paperCache = new Map<string, HTMLCanvasElement>();

/**
 * Procedurally generate or get a realistic paper texture canvas
 */
export function getPaperTextureCanvas(
  width: number,
  height: number,
  style: TypesetSettings['paperStyle'],
  intensity: number = 50,
  customImageUrl?: string
): HTMLCanvasElement {
  const cacheKey = `${width}x${height}_${style}_${intensity}_${customImageUrl || ''}`;
  if (paperCache.has(cacheKey)) {
    return paperCache.get(cacheKey)!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Base background color
  let baseColor = '#f3ede2'; // Warm cream (matches Attachment 2 & 3)
  let secondaryColor = '#ede2d3';
  let creaseColor = 'rgba(160, 140, 120, 0.08)';

  if (style === 'vintage_newsprint') {
    baseColor = '#eee5d5';
    secondaryColor = '#e5d7c3';
    creaseColor = 'rgba(140, 120, 100, 0.12)';
  } else if (style === 'parchment') {
    baseColor = '#f2e8d5';
    secondaryColor = '#e8d8c0';
    creaseColor = 'rgba(150, 125, 95, 0.14)';
  } else if (style === 'clean_white') {
    baseColor = '#faf9f6';
    secondaryColor = '#f4f2ee';
    creaseColor = 'rgba(180, 180, 180, 0.04)';
  }

  // Draw subtle gradient
  const grad = ctx.createRadialGradient(
    width * 0.48, height * 0.45, width * 0.1,
    width * 0.5, height * 0.5, width * 0.8
  );
  grad.addColorStop(0, baseColor);
  grad.addColorStop(1, secondaryColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Apply procedural fine paper fibers and organic grain
  if (intensity > 0) {
    const alphaFactor = (intensity / 100);

    // Subtle organic blotches / paper creases
    const blotchCount = Math.round(18 * alphaFactor);
    for (let i = 0; i < blotchCount; i++) {
      const bx = (Math.sin(i * 997) * 0.5 + 0.5) * width;
      const by = (Math.cos(i * 613) * 0.5 + 0.5) * height;
      const br = (Math.sin(i * 331) * 0.5 + 0.5) * (width * 0.35) + width * 0.1;

      const blotchGrad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      blotchGrad.addColorStop(0, creaseColor);
      blotchGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = blotchGrad;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }

    // High-frequency subtle paper grain (using small canvas pattern)
    const grainCanvas = document.createElement('canvas');
    grainCanvas.width = 160;
    grainCanvas.height = 160;
    const gCtx = grainCanvas.getContext('2d');
    if (gCtx) {
      const gImgData = gCtx.createImageData(160, 160);
      const gData = gImgData.data;
      for (let p = 0; p < gData.length; p += 4) {
        const n = (Math.random() - 0.5) * 32 * alphaFactor;
        gData[p] = Math.max(0, Math.min(255, 128 + n));
        gData[p + 1] = Math.max(0, Math.min(255, 120 + n));
        gData[p + 2] = Math.max(0, Math.min(255, 110 + n));
        gData[p + 3] = Math.round(18 * alphaFactor);
      }
      gCtx.putImageData(gImgData, 0, 0);

      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = ctx.createPattern(grainCanvas, 'repeat') || '#000';
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    // Diagonal subtle paper fold creases (characteristic of vintage book/magazine scans)
    ctx.save();
    ctx.globalAlpha = 0.04 * alphaFactor;
    ctx.strokeStyle = '#5a4632';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.15);
    ctx.bezierCurveTo(width * 0.4, height * 0.18, width * 0.6, height * 0.12, width, height * 0.16);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, height * 0.82);
    ctx.bezierCurveTo(width * 0.35, height * 0.80, width * 0.7, height * 0.84, width, height * 0.79);
    ctx.stroke();
    ctx.restore();
  }

  // Cache up to 10 entries
  if (paperCache.size > 10) {
    const firstKey = paperCache.keys().next().value;
    if (firstKey) paperCache.delete(firstKey);
  }
  paperCache.set(cacheKey, canvas);

  return canvas;
}

// In-memory cache for loaded comic images to ensure instant re-renders without flickering
const comicImageCache = new Map<string, HTMLImageElement>();

export function getCachedComicImage(url: string, onLoaded?: () => void): HTMLImageElement | null {
  if (!url) return null;
  let img = comicImageCache.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    comicImageCache.set(url, img);
  }
  if (onLoaded && !img.complete) {
    img.addEventListener('load', onLoaded, { once: true });
  }
  return img;
}

export interface CardLayoutInfo {
  comicBounds: { x: number; y: number; width: number; height: number };
  textBounds: { x: number; y: number; width: number; height: number };
  paperSize: { width: number; height: number };
  scale: number;
}

/**
 * Computes the decoupled bounding box of the comic preserving natural aspect ratio
 */
export function computeComicBounds(
  panel: ComicPanel,
  W: number,
  H: number,
  scale: number,
  comicImg?: HTMLImageElement | null
): { x: number; y: number; width: number; height: number } {
  const marginX = Math.round(W * 0.075);
  const maxComicW = W - marginX * 2; // ~918px
  const maxComicH = Math.round(H * 0.60); // ~864px

  // True aspect ratio: prefer actual image naturalWidth / naturalHeight
  let aspect = 1.0;
  if (comicImg && comicImg.complete && comicImg.naturalWidth > 0 && comicImg.naturalHeight > 0) {
    aspect = comicImg.naturalWidth / comicImg.naturalHeight;
  } else if (panel.cachedAspect && panel.cachedAspect > 0) {
    aspect = panel.cachedAspect;
  } else if (panel.quad) {
    const q = panel.quad;
    const topW = Math.hypot(q.topRight.x - q.topLeft.x, q.topRight.y - q.topLeft.y);
    const botW = Math.hypot(q.bottomRight.x - q.bottomLeft.x, q.bottomRight.y - q.bottomLeft.y);
    const leftH = Math.hypot(q.bottomLeft.x - q.topLeft.x, q.bottomLeft.y - q.topLeft.y);
    const rightH = Math.hypot(q.bottomRight.x - q.topRight.x, q.bottomRight.y - q.topRight.y);
    const avgW = (topW + botW) / 2;
    const avgH = (leftH + rightH) / 2;
    if (avgH > 0 && avgW > 0) {
      aspect = avgW / avgH;
    }
  }

  // Fit natural aspect into safe bounding envelope (scaled to 90% of bounding space)
  const defaultScale = 0.90;
  let baseW: number;
  let baseH: number;
  if (aspect >= maxComicW / maxComicH) {
    baseW = Math.round(maxComicW * defaultScale);
    baseH = Math.round((maxComicW * defaultScale) / aspect);
  } else {
    baseH = Math.round(maxComicH * defaultScale);
    baseW = Math.round((maxComicH * defaultScale) * aspect);
  }

  // Uniform proportional scale (affects width and height equally)
  const userScale = panel.comicScale !== undefined && panel.comicScale > 0 ? panel.comicScale : 1.0;
  const drawW = Math.round(baseW * userScale);
  const drawH = Math.round(baseH * userScale);

  // Independent center position decoupled completely from translation text (default shifted upward 90px)
  // Comic artwork is always strictly horizontally centered on paper
  const defaultCenterX = W / 2;
  const defaultCenterY = Math.round(H * 0.58) - Math.round(90 * scale);
  const comicCenterX = defaultCenterX;
  const comicCenterY = defaultCenterY + ((panel.comicOffsetY || 0) * scale);

  const drawX = Math.round(comicCenterX - drawW / 2);
  const drawY = Math.round(comicCenterY - drawH / 2);

  return { x: drawX, y: drawY, width: drawW, height: drawH };
}

let measureCanvas: HTMLCanvasElement | null = null;
let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (!measureCtx && typeof document !== 'undefined') {
    measureCanvas = document.createElement('canvas');
    measureCtx = measureCanvas.getContext('2d');
  }
  return measureCtx;
}

export interface FormattedTextLine {
  text: string;
  x: number;
  y: number;
  align: CanvasTextAlign;
}

export interface TranslationLayout {
  lines: FormattedTextLine[];
  bounds: { x: number; y: number; width: number; height: number };
  yStart: number;
  totalHeight: number;
}

/**
 * Computes exact text layout attached to the comic panel:
 * Default position is directly above the comic, left-aligned with comicBounds.x,
 * with a 10px gap between translation bottom and comic top, adapting to all comic positions.
 */
export function computeTranslationLayout(
  panel: ComicPanel,
  comicBounds: { x: number; y: number; width: number; height: number },
  settings: TypesetSettings,
  scale: number,
  ctx?: CanvasRenderingContext2D | null
): TranslationLayout {
  const mCtx = ctx || getMeasureContext();
  const effectiveFontSize = panel.customFontSize !== undefined ? panel.customFontSize : settings.translationFontSize;
  const translationFontSize = Math.round(effectiveFontSize * scale);
  const lineHeight = translationFontSize * settings.translationLineHeight;
  const fontFamily = settings.translationFontFamily === 'sans'
    ? '"Noto Sans SC", system-ui, sans-serif'
    : '"Noto Serif SC", serif, system-ui';

  if (mCtx) {
    mCtx.font = `600 ${translationFontSize}px ${fontFamily}`;
  }

  // Default to 'left' alignment unless explicitly set to center / right / split
  const effectiveAlign = panel.customAlign && panel.customAlign !== 'auto' ? panel.customAlign : 'left';
  const bubbles = panel.speechBubbles && panel.speechBubbles.length > 0
    ? panel.speechBubbles.filter((b) => b.translatedText !== undefined && b.translatedText !== null && b.translatedText.trim().length > 0)
    : [];

  const textItems = bubbles.length > 0
    ? bubbles.map((b) => ({ text: b.translatedText, pos: b.positionHint }))
    : panel.translatedTextCombined !== undefined && panel.translatedTextCombined !== null && panel.translatedTextCombined.trim().length > 0
    ? [{ text: panel.translatedTextCombined, pos: 'left' as const }]
    : [];

  // Default gap is 10px scaled
  const gap = (panel.customGap !== undefined ? panel.customGap : (settings.spacingBetweenTextAndComic ?? 10)) * scale;

  if (textItems.length === 0 || panel.hasNoDialogue) {
    const yStart = comicBounds.y - gap + ((panel.customYOffset || 0) * scale);
    return {
      lines: [],
      bounds: {
        x: comicBounds.x + ((panel.customXOffset || 0) * scale),
        y: yStart,
        width: comicBounds.width,
        height: Math.max(30 * scale, lineHeight),
      },
      yStart,
      totalHeight: 0,
    };
  }

  // Helper: Wraps text supporting explicit newlines (\n / \r\n) as well as auto-wrapping at maxW
  const wrapTextWithLineBreaks = (rawText: string, maxW: number): string[] => {
    // Normalize newlines and split into paragraphs
    const paragraphs = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const resultLines: string[] = [];

    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const para = paragraphs[pIdx];
      // Preserve blank lines (e.g. consecutive newlines or trailing newline)
      if (para === '') {
        resultLines.push('');
        continue;
      }

      const chars = para.split('');
      let currentLine = '';
      for (let n = 0; n < chars.length; n++) {
        const testLine = currentLine + chars[n];
        const w = mCtx ? mCtx.measureText(testLine).width : testLine.length * translationFontSize * 0.9;
        if (w > maxW && currentLine.length > 0) {
          resultLines.push(currentLine);
          currentLine = chars[n];
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        resultLines.push(currentLine);
      }
    }

    return resultLines.length > 0 ? resultLines : [''];
  };

  // Handle Split mode: two dialogue bubbles
  if (effectiveAlign === 'split' && bubbles.length === 2) {
    const maxHalfW = Math.max(80 * scale, (comicBounds.width / 2) - 12 * scale);
    const leftLines = wrapTextWithLineBreaks(bubbles[0].translatedText, maxHalfW);
    const rightLines = wrapTextWithLineBreaks(bubbles[1].translatedText, maxHalfW);
    const lineCount = Math.max(leftLines.length, rightLines.length, 1);
    const totalHeight = lineCount * lineHeight;

    const defaultTextBottom = comicBounds.y - gap;
    const yStart = defaultTextBottom - totalHeight + ((panel.customYOffset || 0) * scale);

    const anchorLeftX = comicBounds.x + ((panel.customXOffset || 0) * scale);
    const anchorRightX = comicBounds.x + comicBounds.width + ((panel.customXOffset || 0) * scale);

    const formattedLines: FormattedTextLine[] = [];
    for (let i = 0; i < lineCount; i++) {
      const lineY = yStart + i * lineHeight;
      if (i < leftLines.length) {
        formattedLines.push({ text: leftLines[i], x: anchorLeftX, y: lineY, align: 'left' });
      }
      if (i < rightLines.length) {
        formattedLines.push({ text: rightLines[i], x: anchorRightX, y: lineY, align: 'right' });
      }
    }

    return {
      lines: formattedLines,
      bounds: {
        x: anchorLeftX,
        y: yStart,
        width: comicBounds.width,
        height: totalHeight,
      },
      yStart,
      totalHeight,
    };
  }

  // Standard modes: Left (default), Center, Right
  const maxTextW = comicBounds.width;
  const itemLineGroups: string[][] = [];

  for (const item of textItems) {
    const lines = wrapTextWithLineBreaks(item.text, maxTextW);
    itemLineGroups.push(lines);
  }

  let totalHeight = 0;
  itemLineGroups.forEach((group, idx) => {
    totalHeight += group.length * lineHeight;
    if (idx < itemLineGroups.length - 1) {
      totalHeight += 4 * scale;
    }
  });

  const defaultTextBottom = comicBounds.y - gap;
  const yStart = defaultTextBottom - totalHeight + ((panel.customYOffset || 0) * scale);

  const formattedLines: FormattedTextLine[] = [];
  let curY = yStart;

  itemLineGroups.forEach((groupLines, itemIdx) => {
    let alignMode: CanvasTextAlign = 'left';
    if (effectiveAlign === 'center') {
      alignMode = 'center';
    } else if (effectiveAlign === 'right') {
      alignMode = 'right';
    } else {
      alignMode = 'left';
    }

    const anchorX = alignMode === 'center'
      ? comicBounds.x + comicBounds.width / 2 + ((panel.customXOffset || 0) * scale)
      : alignMode === 'right'
      ? comicBounds.x + comicBounds.width + ((panel.customXOffset || 0) * scale)
      : comicBounds.x + ((panel.customXOffset || 0) * scale);

    groupLines.forEach((l) => {
      formattedLines.push({ text: l, x: anchorX, y: curY, align: alignMode });
      curY += lineHeight;
    });

    if (itemIdx < itemLineGroups.length - 1) {
      curY += 4 * scale;
    }
  });

  return {
    lines: formattedLines,
    bounds: {
      x: comicBounds.x + ((panel.customXOffset || 0) * scale),
      y: yStart,
      width: comicBounds.width,
      height: Math.max(30 * scale, totalHeight),
    },
    yStart,
    totalHeight,
  };
}

/**
 * Computes layout dimensions for both comic and text blocks
 */
export function computeCardLayoutInfo(
  panel: ComicPanel,
  _totalPanelsCount: number,
  settings: TypesetSettings,
  targetWidth?: number,
  targetHeight?: number
): CardLayoutInfo {
  const W = targetWidth || settings.resolution.width;
  const H = targetHeight || settings.resolution.height;
  const scale = W / 1080;

  let comicImg: HTMLImageElement | null = null;
  if (panel.cachedCroppedUrl) {
    comicImg = getCachedComicImage(panel.cachedCroppedUrl);
  }

  const comicBounds = computeComicBounds(panel, W, H, scale, comicImg);
  const layout = computeTranslationLayout(panel, comicBounds, settings, scale);

  return {
    comicBounds,
    textBounds: layout.bounds,
    paperSize: { width: W, height: H },
    scale,
  };
}

/**
 * Render color-adjusted comic artwork and blend with the paper background
 */
export function drawBlendedComic(
  ctx: CanvasRenderingContext2D,
  comicImg: HTMLImageElement | HTMLCanvasElement,
  bounds: { x: number; y: number; width: number; height: number },
  colorAdjustments: { brightness: number; contrast: number; saturation: number } | undefined,
  blendMode: 'normal' | 'multiply' | 'plus-darker' = 'plus-darker'
) {
  const { x, y, width: w, height: h } = bounds;
  const roundX = Math.round(x);
  const roundY = Math.round(y);
  const roundW = Math.round(w);
  const roundH = Math.round(h);
  if (roundW <= 0 || roundH <= 0) return;

  // 1. Prepare color-adjusted comic canvas buffer
  const bufferCanvas = document.createElement('canvas');
  bufferCanvas.width = roundW;
  bufferCanvas.height = roundH;
  const bCtx = bufferCanvas.getContext('2d');
  if (!bCtx) return;

  const brightness = colorAdjustments?.brightness ?? 100;
  const contrast = colorAdjustments?.contrast ?? 100;
  const saturation = colorAdjustments?.saturation ?? 100;

  // Apply CSS filter for brightness/contrast/saturation
  bCtx.save();
  bCtx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
  bCtx.imageSmoothingEnabled = true;
  bCtx.imageSmoothingQuality = 'high';
  bCtx.drawImage(comicImg, 0, 0, roundW, roundH);
  bCtx.restore();

  // 2. Blend with underlying paper background
  const effectiveMode = blendMode || 'plus-darker';

  if (effectiveMode === 'normal') {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(bufferCanvas, roundX, roundY, roundW, roundH);
    ctx.restore();
    return;
  }

  if (effectiveMode === 'multiply') {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(bufferCanvas, roundX, roundY, roundW, roundH);
    ctx.restore();
    return;
  }

  // 3. Plus darker mode:
  // First check if browser natively supports 'plus-darker'
  ctx.save();
  try {
    (ctx as any).globalCompositeOperation = 'plus-darker';
  } catch {
    // Ignore unsupported error
  }
  const isPlusDarkerSupported = (ctx as any).globalCompositeOperation === 'plus-darker';

  if (isPlusDarkerSupported) {
    ctx.drawImage(bufferCanvas, roundX, roundY, roundW, roundH);
    ctx.restore();
  } else {
    // Exact mathematical pixel synthesis:
    // W3C / Figma Plus-darker formula: B(Cb, Cs) = max(0, Cb + Cs - 255)
    ctx.restore(); // restore to source-over
    try {
      const backdropImgData = ctx.getImageData(roundX, roundY, roundW, roundH);
      const bData = backdropImgData.data;
      const sData = bCtx.getImageData(0, 0, roundW, roundH).data;

      for (let i = 0; i < bData.length; i += 4) {
        const sa = sData[i + 3] / 255;
        if (sa <= 0) continue; // transparent pixel in source

        const sr = sData[i];
        const sg = sData[i + 1];
        const sb = sData[i + 2];

        const br = bData[i];
        const bg = bData[i + 1];
        const bb = bData[i + 2];

        // Plus darker formula
        const resR = Math.max(0, br + sr - 255);
        const resG = Math.max(0, bg + sg - 255);
        const resB = Math.max(0, bb + sb - 255);

        // Alpha blend with backdrop
        bData[i] = Math.round(resR * sa + br * (1 - sa));
        bData[i + 1] = Math.round(resG * sa + bg * (1 - sa));
        bData[i + 2] = Math.round(resB * sa + bb * (1 - sa));
      }
      ctx.putImageData(backdropImgData, roundX, roundY);
    } catch {
      // Fallback: draw directly
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(bufferCanvas, roundX, roundY, roundW, roundH);
      ctx.restore();
    }
  }
}

/**
 * Render complete 3:4 typesetting card onto canvas
 */
export function renderTypesetCard(
  panel: ComicPanel,
  totalPanelsCount: number,
  settings: TypesetSettings,
  targetWidth?: number,
  targetHeight?: number,
  onImageReady?: () => void
): HTMLCanvasElement {
  const W = targetWidth || settings.resolution.width; // e.g. 1080 or 2160
  const H = targetHeight || settings.resolution.height; // e.g. 1440 or 2880
  const scale = W / 1080; // normalized scale factor based on 1080 standard

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // 1. Draw paper background (includes texture, fibers, and organic grain)
  const paper = getPaperTextureCanvas(
    W,
    H,
    settings.paperStyle,
    settings.paperTextureIntensity,
    settings.customBackgroundUrl
  );
  ctx.drawImage(paper, 0, 0);

  // 2. Compute Comic Panel bounds first (NATURAL RATIO & TRANSFORM)
  let comicImg: HTMLImageElement | null = null;
  if (panel.cachedCroppedUrl) {
    comicImg = getCachedComicImage(panel.cachedCroppedUrl, onImageReady);
  }

  const comicBounds = computeComicBounds(panel, W, H, scale, comicImg);

  // 3. Draw Comic Panel: color adjustment + blend with paper background
  // Default blend mode is 'plus-darker' as per specification
  const effectiveBlendMode = panel.blendMode || 'plus-darker';
  const effectiveColorAdjustments = panel.colorAdjustments || { brightness: 100, contrast: 100, saturation: 100 };

  if (comicImg && comicImg.complete && comicImg.naturalWidth > 0) {
    drawBlendedComic(ctx, comicImg, comicBounds, effectiveColorAdjustments, effectiveBlendMode);
  } else {
    // Placeholder while image decodes
    ctx.save();
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 3 * scale;
    ctx.strokeRect(comicBounds.x, comicBounds.y, comicBounds.width, comicBounds.height);
    ctx.fillStyle = 'rgba(0,0,0,0.02)';
    ctx.fillRect(comicBounds.x, comicBounds.y, comicBounds.width, comicBounds.height);
    ctx.fillStyle = '#666';
    ctx.font = `500 ${22 * scale}px "Noto Sans SC"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('漫画格待渲染', W / 2, comicBounds.y + comicBounds.height / 2);
    ctx.restore();
  }

  // 4. Signature / Credit at top (e.g. "@有个框艺术商店") - pristine, not blended
  const signatureY = 54 * scale;
  const rawSigText = (settings.signatureText || '').trim();
  const effectiveSigText = rawSigText === '@有个框商店' ? '@有个框艺术商店' : rawSigText;
  if (settings.showSignature && effectiveSigText) {
    ctx.save();
    const effectiveSize = settings.signatureSize && settings.signatureSize > 22 ? settings.signatureSize : 28;
    ctx.font = `500 ${Math.round(effectiveSize * scale)}px "Noto Sans SC", system-ui, sans-serif`;
    ctx.fillStyle = settings.signatureColor || 'rgba(125, 105, 90, 0.58)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(effectiveSigText, W / 2, signatureY);
    ctx.restore();
  }

  // 5. Page number at bottom (e.g. "1/6", "5/6") - pristine, not blended
  let pageText = `${panel.index}/${totalPanelsCount}`;
  if (panel.isTitleBanner) {
    pageText = '封面';
  } else if (settings.pageNumberFormat === 'index_only') {
    pageText = `${panel.index}`;
  } else if (settings.pageNumberFormat === 'page_index') {
    pageText = `Page ${panel.index}`;
  }

  const pageNumberY = H - (105 * scale);
  if (settings.showPageNumber) {
    ctx.save();
    // Default page number size: upgraded from 42px to 64px for clearer legibility on card previews and prints
    const effectivePageNumberSize =
      settings.pageNumberSize && settings.pageNumberSize !== 42
        ? settings.pageNumberSize
        : 64;
    ctx.font = `700 ${Math.round(effectivePageNumberSize * scale)}px "Caveat", "Noto Sans SC", cursive, sans-serif`;
    ctx.fillStyle = settings.pageNumberColor || '#222222';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pageText, W / 2, pageNumberY);
    ctx.restore();
  }

  // 6. Typeset translation text: default position attached 10px above comic, left-aligned with comic, adapting to all comic positions
  // Only rendered if translated text exists; no placeholder text if empty
  const effectiveFontSize = panel.customFontSize !== undefined ? panel.customFontSize : settings.translationFontSize;
  const translationFontSize = Math.round(effectiveFontSize * scale);
  const translationColor = settings.translationColor || '#8f3e2e';
  const fontFamily = settings.translationFontFamily === 'sans'
    ? '"Noto Sans SC", system-ui, sans-serif'
    : '"Noto Serif SC", serif, system-ui';

  ctx.save();
  ctx.font = `600 ${translationFontSize}px ${fontFamily}`;
  ctx.fillStyle = translationColor;
  ctx.textBaseline = 'top';

  const layout = computeTranslationLayout(panel, comicBounds, settings, scale, ctx);
  for (const line of layout.lines) {
    ctx.textAlign = line.align;
    ctx.fillText(line.text, line.x, line.y);
  }
  ctx.restore();

  return canvas;
}
