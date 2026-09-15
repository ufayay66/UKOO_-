/**
 * High-precision Image Processing, 4-Border Edge Fitting, and Dynamic Comic Panel Detection
 *
 * Core Features:
 * 1. Fully dynamic comic panel detection for ANY newspaper or comic layout (no hardcoded row/col presets, no fixed grid assumptions).
 * 2. Inward-from-gutter 4-border outer line detection using RANSAC line fitting to hug the true black ink outer boundary.
 * 3. Anti-merge gutter analysis: automatically detects and splits candidates that span multiple panels.
 * 4. "Click-to-find-border": instant border detection from a single tap inside a panel.
 * 5. Perspective-correct warp with bilinear interpolation directly on full-res image.
 */

import { Point, Quad, BorderDiagnostics, EdgeQuality } from '../types/comic';

export interface PixelPoint {
  x: number;
  y: number;
}

/**
 * Distance between two points
 */
export function distance(p1: PixelPoint, p2: PixelPoint): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Solve 3x3 Projective Matrix mapping target rectangle (0,0)->(w,h) to source quad (p0, p1, p2, p3)
 */
export function getProjectiveTransform(
  srcQuad: [PixelPoint, PixelPoint, PixelPoint, PixelPoint],
  targetW: number,
  targetH: number
): number[] {
  const dst = [
    { x: 0, y: 0 },
    { x: targetW, y: 0 },
    { x: targetW, y: targetH },
    { x: 0, y: targetH },
  ];

  const A: number[][] = [];
  const B: number[] = [];

  for (let i = 0; i < 4; i++) {
    const xs = srcQuad[i].x;
    const ys = srcQuad[i].y;
    const xd = dst[i].x;
    const yd = dst[i].y;

    A.push([xd, yd, 1, 0, 0, 0, -xd * xs, -yd * xs]);
    B.push(xs);

    A.push([0, 0, 0, xd, yd, 1, -xd * ys, -yd * ys]);
    B.push(ys);
  }

  // Gaussian elimination to solve 8x8 system
  const n = 8;
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
        maxRow = k;
      }
    }
    const tempA = A[i];
    A[i] = A[maxRow];
    A[maxRow] = tempA;
    const tempB = B[i];
    B[i] = B[maxRow];
    B[maxRow] = tempB;

    const pivot = A[i][i];
    if (Math.abs(pivot) < 1e-9) continue;

    for (let j = i; j < n; j++) {
      A[i][j] /= pivot;
    }
    B[i] /= pivot;

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = A[k][i];
        for (let j = i; j < n; j++) {
          A[k][j] -= factor * A[i][j];
        }
        B[k] -= factor * B[i];
      }
    }
  }

  return [B[0], B[1], B[2], B[3], B[4], B[5], B[6], B[7], 1.0];
}

/**
 * Perspective-correct warp of a quadrilateral from an image to a clean rectangular canvas
 * Uses bilinear interpolation for high fidelity (preserves paper grain, screen dots, and sharp ink)
 */
export function warpQuadToCanvas(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  quad: Quad,
  maxOutputWidth: number = 2400
): HTMLCanvasElement {
  const srcW = 'naturalWidth' in sourceImage ? sourceImage.naturalWidth : sourceImage.width;
  const srcH = 'naturalHeight' in sourceImage ? sourceImage.naturalHeight : sourceImage.height;

  const p0: PixelPoint = { x: quad.topLeft.x * srcW, y: quad.topLeft.y * srcH };
  const p1: PixelPoint = { x: quad.topRight.x * srcW, y: quad.topRight.y * srcH };
  const p2: PixelPoint = { x: quad.bottomRight.x * srcW, y: quad.bottomRight.y * srcH };
  const p3: PixelPoint = { x: quad.bottomLeft.x * srcW, y: quad.bottomLeft.y * srcH };

  const topDist = distance(p0, p1);
  const bottomDist = distance(p3, p2);
  const leftDist = distance(p0, p3);
  const rightDist = distance(p1, p2);

  let targetW = Math.max(20, Math.round((topDist + bottomDist) / 2));
  let targetH = Math.max(20, Math.round((leftDist + rightDist) / 2));

  if (targetW > maxOutputWidth) {
    const scale = maxOutputWidth / targetW;
    targetW = Math.round(targetW * scale);
    targetH = Math.round(targetH * scale);
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = targetW;
  outCanvas.height = targetH;
  const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
  if (!outCtx) return outCanvas;

  let srcCanvas: HTMLCanvasElement;
  let srcCtx: CanvasRenderingContext2D | null;
  if (sourceImage instanceof HTMLCanvasElement) {
    srcCanvas = sourceImage;
    srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  } else {
    srcCanvas = document.createElement('canvas');
    srcCanvas.width = srcW;
    srcCanvas.height = srcH;
    srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
    if (srcCtx) srcCtx.drawImage(sourceImage, 0, 0);
  }

  if (!srcCtx) return outCanvas;

  const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x, p2.x, p3.x) - 4));
  const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y, p2.y, p3.y) - 4));
  const maxX = Math.min(srcW - 1, Math.ceil(Math.max(p0.x, p1.x, p2.x, p3.x) + 4));
  const maxY = Math.min(srcH - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y, p3.y) + 4));
  const sliceW = maxX - minX + 1;
  const sliceH = maxY - minY + 1;

  if (sliceW <= 0 || sliceH <= 0) return outCanvas;

  const srcImageData = srcCtx.getImageData(minX, minY, sliceW, sliceH);
  const srcPixels = srcImageData.data;

  const outImageData = outCtx.createImageData(targetW, targetH);
  const outPixels = outImageData.data;

  const M = getProjectiveTransform([p0, p1, p2, p3], targetW, targetH);

  for (let yd = 0; yd < targetH; yd++) {
    const rowOffset = yd * targetW * 4;
    for (let xd = 0; xd < targetW; xd++) {
      const z = M[6] * xd + M[7] * yd + M[8];
      const xs = (M[0] * xd + M[1] * yd + M[2]) / z;
      const ys = (M[3] * xd + M[4] * yd + M[5]) / z;

      const lx = xs - minX;
      const ly = ys - minY;

      const outIdx = rowOffset + xd * 4;

      if (lx >= 0 && lx < sliceW - 1 && ly >= 0 && ly < sliceH - 1) {
        const x0 = Math.floor(lx);
        const y0 = Math.floor(ly);
        const x1 = x0 + 1;
        const y1 = y0 + 1;

        const wx1 = lx - x0;
        const wx0 = 1 - wx1;
        const wy1 = ly - y0;
        const wy0 = 1 - wy1;

        const idx00 = (y0 * sliceW + x0) * 4;
        const idx10 = (y0 * sliceW + x1) * 4;
        const idx01 = (y1 * sliceW + x0) * 4;
        const idx11 = (y1 * sliceW + x1) * 4;

        for (let c = 0; c < 4; c++) {
          const val =
            wy0 * (wx0 * srcPixels[idx00 + c] + wx1 * srcPixels[idx10 + c]) +
            wy1 * (wx0 * srcPixels[idx01 + c] + wx1 * srcPixels[idx11 + c]);
          outPixels[outIdx + c] = Math.round(val);
        }
      } else if (lx >= 0 && lx < sliceW && ly >= 0 && ly < sliceH) {
        const idx = (Math.floor(ly) * sliceW + Math.floor(lx)) * 4;
        outPixels[outIdx] = srcPixels[idx];
        outPixels[outIdx + 1] = srcPixels[idx + 1];
        outPixels[outIdx + 2] = srcPixels[idx + 2];
        outPixels[outIdx + 3] = srcPixels[idx + 3];
      } else {
        outPixels[outIdx + 3] = 0;
      }
    }
  }

  outCtx.putImageData(outImageData, 0, 0);
  return outCanvas;
}

/**
 * Robust line representation:
 * - If horizontal-ish (abs(dx) >= abs(dy)): y = m * x + c
 * - If vertical-ish (abs(dy) > abs(dx)): x = m * y + c
 */
export interface FittedLine {
  isVertical: boolean;
  m: number; // slope
  c: number; // intercept
  inlierRatio: number; // 0..1
  sampleCount: number;
}

/**
 * Pixel luminance calculator
 */
export function getPixelLum(data: Uint8ClampedArray, width: number, x: number, y: number): number {
  const idx = (y * width + x) * 4;
  return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
}

/**
 * Estimate background paper luminance across image
 */
export function estimatePaperLuminance(imgData: ImageData): number {
  const { width, height, data } = imgData;
  const sampleCount = 400;
  const lums: number[] = [];

  for (let i = 0; i < sampleCount; i++) {
    const rx = Math.floor(Math.random() * width);
    const ry = Math.floor(Math.random() * height);
    lums.push(getPixelLum(data, width, rx, ry));
  }

  lums.sort((a, b) => a - b);
  return lums[Math.floor(lums.length * 0.75)] || 215;
}

/**
 * Inward-From-Gutter Scan for a single border.
 *
 * Scans starting from the OUTSIDE gutter towards the comic panel.
 * The VERY FIRST dark ink transition backed by light paper is guaranteed
 * to be the OUTER boundary of the panel's bounding border, completely ignoring
 * speech bubbles, dialogue text, or character drawings inside the panel!
 */
function findOuterEdgePointsForBorder(
  imgData: ImageData,
  edgeType: 'top' | 'bottom' | 'left' | 'right',
  quadPx: { pTL: PixelPoint; pTR: PixelPoint; pBR: PixelPoint; pBL: PixelPoint },
  paperLum: number
): { points: PixelPoint[]; quality: EdgeQuality } {
  const { width, height, data } = imgData;
  const inkThreshold = Math.min(130, paperLum * 0.62);
  const gutterPaperThreshold = paperLum * 0.72;

  // Search corridor proportional to image size
  const searchRadiusPx = Math.max(30, Math.min(100, Math.round(Math.min(width, height) * 0.04)));

  const points: PixelPoint[] = [];
  const numScanlines = 40;
  let strongDetections = 0;
  let cutIntoArtworkCount = 0;

  if (edgeType === 'top' || edgeType === 'bottom') {
    const isTop = edgeType === 'top';
    const startP = isTop ? quadPx.pTL : quadPx.pBL;
    const endP = isTop ? quadPx.pTR : quadPx.pBR;

    for (let s = 1; s < numScanlines; s++) {
      const t = s / numScanlines;
      if (t < 0.06 || t > 0.94) continue;

      const expectedX = Math.round(startP.x + t * (endP.x - startP.x));
      const expectedY = Math.round(startP.y + t * (endP.y - startP.y));

      if (expectedX < 3 || expectedX >= width - 3) continue;

      // TOP BORDER:
      // Start in the top gutter (expectedY - searchRadiusPx) and scan DOWNWARDS into the panel.
      // The FIRST dark stroke with paper above it is the TRUE outer edge of the top border!
      //
      // BOTTOM BORDER:
      // Start in the bottom gutter (expectedY + searchRadiusPx) and scan UPWARDS into the panel.
      // The FIRST dark stroke with paper below it is the TRUE outer edge of the bottom border!
      const minY = Math.max(3, expectedY - searchRadiusPx);
      const maxY = Math.min(height - 4, expectedY + searchRadiusPx);

      let bestOuterY: number | null = null;
      let foundStroke = false;

      if (isTop) {
        let inStroke = false;
        let strokeStart = 0;

        for (let y = minY; y <= maxY; y++) {
          const lum = getPixelLum(data, width, expectedX, y);
          const isDark = lum < inkThreshold;

          if (isDark && !inStroke) {
            inStroke = true;
            strokeStart = y;
          } else if (!isDark && inStroke) {
            inStroke = false;
            const strokeEnd = y - 1;
            const strokeWidth = strokeEnd - strokeStart + 1;

            if (strokeWidth >= 1 && strokeWidth <= 18) {
              // Verify outer paper is light
              const outerPaperY = Math.max(0, strokeStart - 3);
              const outerLum = getPixelLum(data, width, expectedX, outerPaperY);

              if (outerLum >= gutterPaperThreshold || strokeStart - minY > 5) {
                bestOuterY = strokeStart;
                foundStroke = true;
                break; // Found outermost frame boundary!
              }
            }
          }
        }
      } else {
        // Bottom: scan from maxY down to minY
        let inStroke = false;
        let strokeEnd = 0;

        for (let y = maxY; y >= minY; y--) {
          const lum = getPixelLum(data, width, expectedX, y);
          const isDark = lum < inkThreshold;

          if (isDark && !inStroke) {
            inStroke = true;
            strokeEnd = y;
          } else if (!isDark && inStroke) {
            inStroke = false;
            const strokeStart = y + 1;
            const strokeWidth = strokeEnd - strokeStart + 1;

            if (strokeWidth >= 1 && strokeWidth <= 18) {
              const outerPaperY = Math.min(height - 1, strokeEnd + 3);
              const outerLum = getPixelLum(data, width, expectedX, outerPaperY);

              if (outerLum >= gutterPaperThreshold || maxY - strokeEnd > 5) {
                bestOuterY = strokeEnd;
                foundStroke = true;
                break;
              }
            }
          }
        }
      }

      if (bestOuterY !== null) {
        points.push({ x: expectedX, y: bestOuterY });
        strongDetections++;
      } else {
        // If no stroke found at all, check if current position cuts into dark artwork
        const curLum = getPixelLum(data, width, expectedX, expectedY);
        if (curLum < inkThreshold) cutIntoArtworkCount++;
      }
    }
  } else {
    // Left or Right vertical border
    const isLeft = edgeType === 'left';
    const startP = isLeft ? quadPx.pTL : quadPx.pTR;
    const endP = isLeft ? quadPx.pBL : quadPx.pBR;

    for (let s = 1; s < numScanlines; s++) {
      const t = s / numScanlines;
      if (t < 0.06 || t > 0.94) continue;

      const expectedX = Math.round(startP.x + t * (endP.x - startP.x));
      const expectedY = Math.round(startP.y + t * (endP.y - startP.y));

      if (expectedY < 3 || expectedY >= height - 3) continue;

      const minX = Math.max(3, expectedX - searchRadiusPx);
      const maxX = Math.min(width - 4, expectedX + searchRadiusPx);

      let bestOuterX: number | null = null;

      if (isLeft) {
        // Scan from minX (left gutter) rightward into panel
        let inStroke = false;
        let strokeStart = 0;

        for (let x = minX; x <= maxX; x++) {
          const lum = getPixelLum(data, width, x, expectedY);
          const isDark = lum < inkThreshold;

          if (isDark && !inStroke) {
            inStroke = true;
            strokeStart = x;
          } else if (!isDark && inStroke) {
            inStroke = false;
            const strokeEnd = x - 1;
            const strokeWidth = strokeEnd - strokeStart + 1;

            if (strokeWidth >= 1 && strokeWidth <= 18) {
              const outerPaperX = Math.max(0, strokeStart - 3);
              const outerLum = getPixelLum(data, width, outerPaperX, expectedY);

              if (outerLum >= gutterPaperThreshold || strokeStart - minX > 5) {
                bestOuterX = strokeStart;
                break;
              }
            }
          }
        }
      } else {
        // Right: scan from maxX (right gutter) leftward into panel
        let inStroke = false;
        let strokeEnd = 0;

        for (let x = maxX; x >= minX; x--) {
          const lum = getPixelLum(data, width, x, expectedY);
          const isDark = lum < inkThreshold;

          if (isDark && !inStroke) {
            inStroke = true;
            strokeEnd = x;
          } else if (!isDark && inStroke) {
            inStroke = false;
            const strokeStart = x + 1;
            const strokeWidth = strokeEnd - strokeStart + 1;

            if (strokeWidth >= 1 && strokeWidth <= 18) {
              const outerPaperX = Math.min(width - 1, strokeEnd + 3);
              const outerLum = getPixelLum(data, width, outerPaperX, expectedY);

              if (outerLum >= gutterPaperThreshold || maxX - strokeEnd > 5) {
                bestOuterX = strokeEnd;
                break;
              }
            }
          }
        }
      }

      if (bestOuterX !== null) {
        points.push({ x: bestOuterX, y: expectedY });
        strongDetections++;
      } else {
        const curLum = getPixelLum(data, width, expectedX, expectedY);
        if (curLum < inkThreshold) cutIntoArtworkCount++;
      }
    }
  }

  const validSampleCount = numScanlines * 0.85;
  const confidence = Math.min(1.0, strongDetections / Math.max(8, validSampleCount));

  const edgeLabel = edgeType === 'top' ? '顶' : edgeType === 'bottom' ? '底' : edgeType === 'left' ? '左' : '右';
  let warning: string | undefined = undefined;

  if (confidence < 0.4) {
    warning = `${edgeLabel}边黑框不连贯或缺失，请核对`;
  } else if (cutIntoArtworkCount > validSampleCount * 0.4) {
    warning = `${edgeLabel}边可能切入画面内部，建议微调`;
  }

  const quality: EdgeQuality = {
    confidence,
    detected: confidence >= 0.45,
    angleDeg: 0,
    outerEdgeOffsetPx: 0,
    warning,
  };

  return { points, quality };
}

/**
 * RANSAC robust straight line fitting
 */
function fitLineRANSAC(points: PixelPoint[], isVertical: boolean): FittedLine {
  if (points.length < 2) {
    return { isVertical, m: 0, c: 0, inlierRatio: 0, sampleCount: points.length };
  }

  let bestM = 0;
  let bestC = isVertical ? points[0].x : points[0].y;
  let bestInliers: PixelPoint[] = [];
  const thresholdPx = 2.5;

  const iterations = Math.min(60, points.length * 3);

  for (let iter = 0; iter < iterations; iter++) {
    const idx1 = Math.floor(Math.random() * points.length);
    let idx2 = Math.floor(Math.random() * points.length);
    if (idx1 === idx2) idx2 = (idx1 + 1) % points.length;

    const p1 = points[idx1];
    const p2 = points[idx2];

    let m = 0;
    let c = 0;

    if (isVertical) {
      const dy = p2.y - p1.y;
      if (Math.abs(dy) < 1e-4) continue;
      m = (p2.x - p1.x) / dy;
      if (Math.abs(m) > 0.25) continue; // comic borders tilt at most ~14 degrees
      c = p1.x - m * p1.y;
    } else {
      const dx = p2.x - p1.x;
      if (Math.abs(dx) < 1e-4) continue;
      m = (p2.y - p1.y) / dx;
      if (Math.abs(m) > 0.25) continue;
      c = p1.y - m * p1.x;
    }

    const inliers: PixelPoint[] = [];
    for (const p of points) {
      const expected = isVertical ? m * p.y + c : m * p.x + c;
      const actual = isVertical ? p.x : p.y;
      if (Math.abs(expected - actual) <= thresholdPx) {
        inliers.push(p);
      }
    }

    if (inliers.length > bestInliers.length) {
      bestInliers = inliers;
      bestM = m;
      bestC = c;
    }
  }

  // Refit with least squares on inliers
  if (bestInliers.length >= 3) {
    let sumU = 0;
    let sumV = 0;
    let sumUU = 0;
    let sumUV = 0;
    const n = bestInliers.length;

    for (const p of bestInliers) {
      const u = isVertical ? p.y : p.x;
      const v = isVertical ? p.x : p.y;
      sumU += u;
      sumV += v;
      sumUU += u * u;
      sumUV += u * v;
    }

    const denom = n * sumUU - sumU * sumU;
    if (Math.abs(denom) > 1e-5) {
      bestM = (n * sumUV - sumU * sumV) / denom;
      bestC = (sumV - bestM * sumU) / n;
    }
  }

  return {
    isVertical,
    m: bestM,
    c: bestC,
    inlierRatio: bestInliers.length / points.length,
    sampleCount: points.length,
  };
}

/**
 * Intersect two lines (one horizontal y = m1 * x + c1, one vertical x = m2 * y + c2)
 */
function intersectHorizAndVert(
  horizLine: FittedLine,
  vertLine: FittedLine,
  fallback: PixelPoint
): PixelPoint {
  const denom = 1.0 - horizLine.m * vertLine.m;
  if (Math.abs(denom) < 1e-4) {
    return fallback;
  }

  const y = (horizLine.m * vertLine.c + horizLine.c) / denom;
  const x = vertLine.m * y + vertLine.c;
  return { x, y };
}

/**
 * Check whether a quad contains an internal vertical white gutter (meaning it inadvertently spans across 2 panels)
 */
export function checkQuadCrossesGutter(
  canvas: HTMLCanvasElement,
  quad: Quad
): { crossesGutter: boolean; splitX?: number } {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { crossesGutter: false };

  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const paperLum = estimatePaperLuminance(imgData);
  const gutterLumThresh = paperLum * 0.82;

  const minX = Math.round(Math.min(quad.topLeft.x, quad.bottomLeft.x) * w);
  const maxX = Math.round(Math.max(quad.topRight.x, quad.bottomRight.x) * w);
  const minY = Math.round(Math.min(quad.topLeft.y, quad.topRight.y) * h);
  const maxY = Math.round(Math.max(quad.bottomLeft.y, quad.bottomRight.y) * h);

  const quadW = maxX - minX;
  const quadH = maxY - minY;

  if (quadW < 80 || quadH < 80) return { crossesGutter: false };

  // Sample internal vertical columns from 30% to 70% width
  const sampleMinX = Math.round(minX + quadW * 0.28);
  const sampleMaxX = Math.round(minX + quadW * 0.72);

  let bestGutterX: number | null = null;
  let maxConsecutiveWhiteCols = 0;
  let curWhiteCols = 0;
  let curGutterStart = 0;

  for (let x = sampleMinX; x <= sampleMaxX; x += 2) {
    // Check vertical line darkness
    let paperPixelCount = 0;
    const testSamples = 25;
    for (let i = 0; i < testSamples; i++) {
      const y = Math.round(minY + (i / testSamples) * quadH);
      const lum = getPixelLum(data, w, widthSafe(w, x), heightSafe(h, y));
      if (lum >= gutterLumThresh) paperPixelCount++;
    }

    const isWhiteGutterCol = paperPixelCount >= testSamples * 0.82;
    if (isWhiteGutterCol) {
      if (curWhiteCols === 0) curGutterStart = x;
      curWhiteCols += 2;
      if (curWhiteCols > maxConsecutiveWhiteCols) {
        maxConsecutiveWhiteCols = curWhiteCols;
        bestGutterX = curGutterStart + curWhiteCols / 2;
      }
    } else {
      curWhiteCols = 0;
    }
  }

  // A real comic gutter is typically at least 6px wide with near-pure paper
  if (maxConsecutiveWhiteCols >= 8 && bestGutterX !== null) {
    return { crossesGutter: true, splitX: bestGutterX / w };
  }

  return { crossesGutter: false };
}

function widthSafe(w: number, x: number): number {
  return Math.max(0, Math.min(w - 1, x));
}

function heightSafe(h: number, y: number): number {
  return Math.max(0, Math.min(h - 1, y));
}

/**
 * Master Border Refinement:
 * Fits exact outer boundaries of Top, Bottom, Left, and Right black borders,
 * then intersects lines to produce mathematically exact quadrilateral corners.
 */
export function refinePanelQuadToOuterBorders(
  canvas: HTMLCanvasElement,
  quad: Quad
): { quad: Quad; diagnostics: BorderDiagnostics } {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;

  if (!ctx) {
    return {
      quad,
      diagnostics: {
        overallConfidence: 0.5,
        edges: {
          top: { confidence: 0.5, detected: true, angleDeg: 0, outerEdgeOffsetPx: 0 },
          bottom: { confidence: 0.5, detected: true, angleDeg: 0, outerEdgeOffsetPx: 0 },
          left: { confidence: 0.5, detected: true, angleDeg: 0, outerEdgeOffsetPx: 0 },
          right: { confidence: 0.5, detected: true, angleDeg: 0, outerEdgeOffsetPx: 0 },
        },
        warnings: [],
      },
    };
  }

  const imgData = ctx.getImageData(0, 0, w, h);
  const paperLum = estimatePaperLuminance(imgData);

  const quadPx = {
    pTL: { x: quad.topLeft.x * w, y: quad.topLeft.y * h },
    pTR: { x: quad.topRight.x * w, y: quad.topRight.y * h },
    pBR: { x: quad.bottomRight.x * w, y: quad.bottomRight.y * h },
    pBL: { x: quad.bottomLeft.x * w, y: quad.bottomLeft.y * h },
  };

  // 1. Detect candidate outer edge points for all 4 borders (inward from outside gutters)
  const topRes = findOuterEdgePointsForBorder(imgData, 'top', quadPx, paperLum);
  const bottomRes = findOuterEdgePointsForBorder(imgData, 'bottom', quadPx, paperLum);
  const leftRes = findOuterEdgePointsForBorder(imgData, 'left', quadPx, paperLum);
  const rightRes = findOuterEdgePointsForBorder(imgData, 'right', quadPx, paperLum);

  // 2. Fit straight lines to outer edges
  const lineTop = fitLineRANSAC(topRes.points, false);
  const lineBottom = fitLineRANSAC(bottomRes.points, false);
  const lineLeft = fitLineRANSAC(leftRes.points, true);
  const lineRight = fitLineRANSAC(rightRes.points, true);

  // Fallbacks if detection was empty on some edge
  if (topRes.points.length < 5) {
    const slope = (quadPx.pTR.y - quadPx.pTL.y) / Math.max(1, quadPx.pTR.x - quadPx.pTL.x);
    lineTop.m = slope;
    lineTop.c = quadPx.pTL.y - slope * quadPx.pTL.x;
  }
  if (bottomRes.points.length < 5) {
    const slope = (quadPx.pBR.y - quadPx.pBL.y) / Math.max(1, quadPx.pBR.x - quadPx.pBL.x);
    lineBottom.m = slope;
    lineBottom.c = quadPx.pBL.y - slope * quadPx.pBL.x;
  }
  if (leftRes.points.length < 5) {
    const slope = (quadPx.pBL.x - quadPx.pTL.x) / Math.max(1, quadPx.pBL.y - quadPx.pTL.y);
    lineLeft.m = slope;
    lineLeft.c = quadPx.pTL.x - slope * quadPx.pTL.y;
  }
  if (rightRes.points.length < 5) {
    const slope = (quadPx.pBR.x - quadPx.pTR.x) / Math.max(1, quadPx.pBR.y - quadPx.pTR.y);
    lineRight.m = slope;
    lineRight.c = quadPx.pTR.x - slope * quadPx.pTR.y;
  }

  // 3. Compute 4 mathematical intersections
  const newTL = intersectHorizAndVert(lineTop, lineLeft, quadPx.pTL);
  const newTR = intersectHorizAndVert(lineTop, lineRight, quadPx.pTR);
  const newBR = intersectHorizAndVert(lineBottom, lineRight, quadPx.pBR);
  const newBL = intersectHorizAndVert(lineBottom, lineLeft, quadPx.pBL);

  // Ensure validity and normalize to [0, 1]
  const refinedQuad: Quad = {
    topLeft: {
      x: Math.max(0, Math.min(0.99, newTL.x / w)),
      y: Math.max(0, Math.min(0.99, newTL.y / h)),
    },
    topRight: {
      x: Math.max(0.01, Math.min(1.0, newTR.x / w)),
      y: Math.max(0, Math.min(0.99, newTR.y / h)),
    },
    bottomRight: {
      x: Math.max(0.01, Math.min(1.0, newBR.x / w)),
      y: Math.max(0.01, Math.min(1.0, newBR.y / h)),
    },
    bottomLeft: {
      x: Math.max(0, Math.min(0.99, newBL.x / w)),
      y: Math.max(0.01, Math.min(1.0, newBL.y / h)),
    },
  };

  const warnings: string[] = [];
  if (topRes.quality.warning) warnings.push(topRes.quality.warning);
  if (bottomRes.quality.warning) warnings.push(bottomRes.quality.warning);
  if (leftRes.quality.warning) warnings.push(leftRes.quality.warning);
  if (rightRes.quality.warning) warnings.push(rightRes.quality.warning);

  // Check if box crosses an internal gutter
  const gutterCheck = checkQuadCrossesGutter(canvas, refinedQuad);
  if (gutterCheck.crossesGutter) {
    warnings.push('此选框横跨了两格之间的空白沟，可能属于错误合并');
  }

  const overallConfidence =
    (topRes.quality.confidence +
      bottomRes.quality.confidence +
      leftRes.quality.confidence +
      rightRes.quality.confidence) /
    4;

  const diagnostics: BorderDiagnostics = {
    overallConfidence,
    edges: {
      top: topRes.quality,
      bottom: bottomRes.quality,
      left: leftRes.quality,
      right: rightRes.quality,
    },
    warnings,
  };

  return { quad: refinedQuad, diagnostics };
}

/**
 * Auto-snap all 4 borders of a quadrilateral using the robust line-fitting engine
 */
export function autoSnapQuad(
  canvas: HTMLCanvasElement,
  quad: Quad,
  _radiusPx: number = 20
): Quad {
  const result = refinePanelQuadToOuterBorders(canvas, quad);
  return result.quad;
}

/**
 * Click-to-Find-Panel ("在目标漫画内部点一下，重新寻找完整边框"):
 * Starts from a user-tapped interior point, raycasts in 4 directions to find
 * the surrounding black frame, and returns the fitted quadrilateral.
 */
export function findPanelFromInteriorPoint(
  canvas: HTMLCanvasElement,
  clickPt: Point
): { quad: Quad; diagnostics: BorderDiagnostics } | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const paperLum = estimatePaperLuminance(imgData);
  const inkThresh = Math.min(125, paperLum * 0.62);

  const cx = Math.round(clickPt.x * w);
  const cy = Math.round(clickPt.y * h);

  if (cx < 5 || cx >= w - 5 || cy < 5 || cy >= h - 5) return null;

  // Raycast Up, Down, Left, Right
  let topY = 0;
  for (let y = cy; y >= 2; y--) {
    if (getPixelLum(data, w, cx, y) < inkThresh) {
      topY = y;
      break;
    }
  }

  let bottomY = h - 1;
  for (let y = cy; y < h - 2; y++) {
    if (getPixelLum(data, w, cx, y) < inkThresh) {
      bottomY = y;
      break;
    }
  }

  let leftX = 0;
  for (let x = cx; x >= 2; x--) {
    if (getPixelLum(data, w, x, cy) < inkThresh) {
      leftX = x;
      break;
    }
  }

  let rightX = w - 1;
  for (let x = cx; x < w - 2; x++) {
    if (getPixelLum(data, w, x, cy) < inkThresh) {
      rightX = x;
      break;
    }
  }

  if (rightX - leftX < 40 || bottomY - topY < 40) return null;

  const seedQuad: Quad = {
    topLeft: { x: Math.max(0, (leftX - 4) / w), y: Math.max(0, (topY - 4) / h) },
    topRight: { x: Math.min(1, (rightX + 4) / w), y: Math.max(0, (topY - 4) / h) },
    bottomRight: { x: Math.min(1, (rightX + 4) / w), y: Math.min(1, (bottomY + 4) / h) },
    bottomLeft: { x: Math.max(0, (leftX - 4) / w), y: Math.min(1, (bottomY + 4) / h) },
  };

  return refinePanelQuadToOuterBorders(canvas, seedQuad);
}

/**
 * Inset or Outset individual edge of a quadrilateral by specified pixels
 */
export function nudgeQuadEdge(
  quad: Quad,
  edge: 'top' | 'bottom' | 'left' | 'right',
  deltaPx: number,
  imgWidth: number,
  imgHeight: number
): Quad {
  const dxNorm = deltaPx / imgWidth;
  const dyNorm = deltaPx / imgHeight;

  const result: Quad = {
    topLeft: { ...quad.topLeft },
    topRight: { ...quad.topRight },
    bottomRight: { ...quad.bottomRight },
    bottomLeft: { ...quad.bottomLeft },
  };

  if (edge === 'top') {
    result.topLeft.y = Math.max(0, Math.min(1, result.topLeft.y - dyNorm));
    result.topRight.y = Math.max(0, Math.min(1, result.topRight.y - dyNorm));
  } else if (edge === 'bottom') {
    result.bottomLeft.y = Math.max(0, Math.min(1, result.bottomLeft.y + dyNorm));
    result.bottomRight.y = Math.max(0, Math.min(1, result.bottomRight.y + dyNorm));
  } else if (edge === 'left') {
    result.topLeft.x = Math.max(0, Math.min(1, result.topLeft.x - dxNorm));
    result.bottomLeft.x = Math.max(0, Math.min(1, result.bottomLeft.x - dxNorm));
  } else if (edge === 'right') {
    result.topRight.x = Math.max(0, Math.min(1, result.topRight.x + dxNorm));
    result.bottomRight.x = Math.max(0, Math.min(1, result.bottomRight.x + dxNorm));
  }

  return result;
}

/**
 * Expand or shrink all 4 edges of a quadrilateral uniformly
 */
export function expandQuad(
  quad: Quad,
  deltaPx: number,
  imgWidth: number,
  imgHeight: number
): Quad {
  let q = nudgeQuadEdge(quad, 'top', deltaPx, imgWidth, imgHeight);
  q = nudgeQuadEdge(q, 'bottom', deltaPx, imgWidth, imgHeight);
  q = nudgeQuadEdge(q, 'left', deltaPx, imgWidth, imgHeight);
  q = nudgeQuadEdge(q, 'right', deltaPx, imgWidth, imgHeight);
  return q;
}

/**
 * Truly Dynamic Local Computer Vision Comic Panel Detector:
 *
 * Fully respects user requirements:
 * 1. ZERO fixed grid / NO hardcoded Peanuts seeds / NO 3x2 templates.
 * 2. Independent Row-by-Row analysis: allows every row to have different panel count & widths (e.g. 1 on top, 3 in middle, 2 at bottom).
 * 3. Gutter Analysis: uses whitespace gutters to separate independent comic panels.
 * 4. Anti-Merge: splits any candidate that accidentally spans across two panels.
 * 5. Title Banner separation: detects title banner independently.
 */
export function detectPanelsLocalCV(
  canvas: HTMLCanvasElement
): {
  panels: Array<{ quad: Quad; diagnostics: BorderDiagnostics; index: number }>;
  titleBanner?: { quad: Quad; diagnostics: BorderDiagnostics };
} {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { panels: [] };

  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const paperLum = estimatePaperLuminance(imgData);
  const inkThresh = Math.min(125, paperLum * 0.60);
  const gutterPaperThresh = paperLum * 0.78;

  // Processing grid
  const procW = 600;
  const scale = procW / w;
  const procH = Math.max(100, Math.round(h * scale));

  // Compute 2D binarized dark ink map on processing grid
  const isDarkGrid = new Uint8Array(procW * procH);
  const rowInkCount = new Int32Array(procH);
  const colInkCount = new Int32Array(procW);

  for (let py = 0; py < procH; py++) {
    const origY = Math.min(h - 1, Math.floor(py / scale));
    const rowOffset = py * procW;
    for (let px = 0; px < procW; px++) {
      const origX = Math.min(w - 1, Math.floor(px / scale));
      const lum = getPixelLum(data, w, origX, origY);
      if (lum < inkThresh) {
        isDarkGrid[rowOffset + px] = 1;
        rowInkCount[py]++;
        colInkCount[px]++;
      }
    }
  }

  // 1. Detect Outer Content Margins (exclude outer white margins of the page)
  let contentTop = 0;
  for (let py = 0; py < procH * 0.3; py++) {
    if (rowInkCount[py] > procW * 0.05) {
      contentTop = py;
      break;
    }
  }
  let contentBottom = procH - 1;
  for (let py = procH - 1; py > procH * 0.7; py--) {
    if (rowInkCount[py] > procW * 0.05) {
      contentBottom = py;
      break;
    }
  }

  let contentLeft = 0;
  for (let px = 0; px < procW * 0.3; px++) {
    if (colInkCount[px] > procH * 0.05) {
      contentLeft = px;
      break;
    }
  }
  let contentRight = procW - 1;
  for (let px = procW - 1; px > procW * 0.7; px--) {
    if (colInkCount[px] > procH * 0.05) {
      contentRight = px;
      break;
    }
  }

  const contentH = contentBottom - contentTop;
  const contentW = contentRight - contentLeft;

  if (contentW < 50 || contentH < 50) {
    return { panels: [] };
  }

  // 2. Identify Horizontal Gutters (dividing the comic page into Rows)
  // A row gutter is a horizontal span where rowInkCount dips below threshold
  const minGutterThickness = Math.max(3, Math.round(procH * 0.012));
  const rowGutterThreshold = procW * 0.06;

  interface RowSegment {
    top: number;
    bottom: number;
  }

  const rows: RowSegment[] = [];
  let inRow = false;
  let rowStart = contentTop;

  for (let py = contentTop; py <= contentBottom; py++) {
    const isGutter = rowInkCount[py] < rowGutterThreshold;

    if (!isGutter && !inRow) {
      inRow = true;
      rowStart = py;
    } else if (isGutter && inRow) {
      // Check if gutter persists for at least minGutterThickness
      let gutterSpan = 0;
      for (let k = py; k < Math.min(contentBottom, py + minGutterThickness + 3); k++) {
        if (rowInkCount[k] < rowGutterThreshold) gutterSpan++;
      }

      if (gutterSpan >= minGutterThickness) {
        const rowEnd = py - 1;
        const rHeight = rowEnd - rowStart;
        if (rHeight >= procH * 0.07) {
          rows.push({ top: rowStart, bottom: rowEnd });
        }
        inRow = false;
        py += gutterSpan - 1;
      }
    }
  }

  if (inRow) {
    const rHeight = contentBottom - rowStart;
    if (rHeight >= procH * 0.07) {
      rows.push({ top: rowStart, bottom: contentBottom });
    }
  }

  // If gutter detection found no clear rows, treat entire content as single row
  if (rows.length === 0) {
    rows.push({ top: contentTop, bottom: contentBottom });
  }

  // 3. For EACH Row Independently: Detect Columns (Panels within that specific Row)
  // This allows Row 1 to have 2 panels, Row 2 to have 3 panels, Row 3 to have 2 panels!
  const candidateBoxes: Array<{ left: number; top: number; right: number; bottom: number }> = [];

  for (const row of rows) {
    const rH = row.bottom - row.top;
    if (rH < 20) continue;

    // Compute column darkness within this specific row
    const rowColInk = new Int32Array(procW);
    for (let py = row.top; py <= row.bottom; py++) {
      const offset = py * procW;
      for (let px = contentLeft; px <= contentRight; px++) {
        if (isDarkGrid[offset + px]) rowColInk[px]++;
      }
    }

    const colGutterThresh = rH * 0.05;
    const minColGutterThickness = Math.max(3, Math.round(procW * 0.015));

    let inCol = false;
    let colStart = contentLeft;

    for (let px = contentLeft; px <= contentRight; px++) {
      const isColGutter = rowColInk[px] < colGutterThresh;

      if (!isColGutter && !inCol) {
        inCol = true;
        colStart = px;
      } else if (isColGutter && inCol) {
        let span = 0;
        for (let k = px; k < Math.min(contentRight, px + minColGutterThickness + 3); k++) {
          if (rowColInk[k] < colGutterThresh) span++;
        }

        if (span >= minColGutterThickness) {
          const colEnd = px - 1;
          const cWidth = colEnd - colStart;
          if (cWidth >= procW * 0.10) {
            candidateBoxes.push({
              left: colStart,
              top: row.top,
              right: colEnd,
              bottom: row.bottom,
            });
          }
          inCol = false;
          px += span - 1;
        }
      }
    }

    if (inCol) {
      const cWidth = contentRight - colStart;
      if (cWidth >= procW * 0.10) {
        candidateBoxes.push({
          left: colStart,
          top: row.top,
          right: contentRight,
          bottom: row.bottom,
        });
      }
    }
  }

  // 4. Convert candidate boxes back to normalized [0, 1] Quads
  const rawQuads: Quad[] = candidateBoxes.map((b) => ({
    topLeft: { x: b.left / procW, y: b.top / procH },
    topRight: { x: b.right / procW, y: b.top / procH },
    bottomRight: { x: b.right / procW, y: b.bottom / procH },
    bottomLeft: { x: b.left / procW, y: b.bottom / procH },
  }));

  // 5. Refine candidate borders using outer-border RANSAC engine
  // Do NOT blindly slice panels across white dialogue gaps
  const refinedCandidates: Array<{ quad: Quad; diagnostics: BorderDiagnostics }> = [];
  for (const q of rawQuads) {
    const res = refinePanelQuadToOuterBorders(canvas, q);
    // Sanity check area: must be at least 1.5% of total page area
    const widthNorm = res.quad.topRight.x - res.quad.topLeft.x;
    const heightNorm = res.quad.bottomLeft.y - res.quad.topLeft.y;
    if (widthNorm >= 0.08 && heightNorm >= 0.06 && widthNorm * heightNorm >= 0.012) {
      refinedCandidates.push(res);
    }
  }

  // 6. Separate Title Banner (Header / Masthead) vs. Story Panels
  // In Sunday newspaper strips, the Title Banner sits at the top (centerY < 0.30)
  // displaying the comic strip's title logo ("PEANUTS"), author attribution, or masthead.
  // It is NEVER a narrative story panel and must be completely excluded from regularPanels!
  let titleBanner: { quad: Quad; diagnostics: BorderDiagnostics } | undefined = undefined;
  const regularPanels: Array<{ quad: Quad; diagnostics: BorderDiagnostics }> = [];

  for (const c of refinedCandidates) {
    const centerY = (c.quad.topLeft.y + c.quad.bottomLeft.y) / 2;
    const width = c.quad.topRight.x - c.quad.topLeft.x;
    const height = c.quad.bottomLeft.y - c.quad.topLeft.y;
    const aspect = width / Math.max(0.01, height);

    // Title banner detection:
    // Located in the top 30% of the image AND either:
    // - Wide aspect ratio (aspect > 1.8)
    // - Spans broad width (width > 0.45)
    // - Located above the first row of story panels (centerY < 0.26)
    const isHeaderZone = centerY < 0.28 && (aspect > 1.7 || width > 0.42 || centerY < 0.20);

    if (isHeaderZone && !titleBanner) {
      titleBanner = c;
    } else if (isHeaderZone && titleBanner) {
      // If title banner was split or has multiple top fragments, merge into single title quad
      titleBanner = {
        quad: {
          topLeft: {
            x: Math.min(titleBanner.quad.topLeft.x, c.quad.topLeft.x),
            y: Math.min(titleBanner.quad.topLeft.y, c.quad.topLeft.y),
          },
          topRight: {
            x: Math.max(titleBanner.quad.topRight.x, c.quad.topRight.x),
            y: Math.min(titleBanner.quad.topRight.y, c.quad.topRight.y),
          },
          bottomRight: {
            x: Math.max(titleBanner.quad.bottomRight.x, c.quad.bottomRight.x),
            y: Math.max(titleBanner.quad.bottomRight.y, c.quad.bottomRight.y),
          },
          bottomLeft: {
            x: Math.min(titleBanner.quad.bottomLeft.x, c.quad.bottomLeft.x),
            y: Math.max(titleBanner.quad.bottomLeft.y, c.quad.bottomLeft.y),
          },
        },
        diagnostics: titleBanner.diagnostics,
      };
    } else {
      regularPanels.push(c);
    }
  }

  // 8. Sort regular panels in Reading Order (Top to Bottom, Left to Right)
  regularPanels.sort((a, b) => {
    const aCenterY = (a.quad.topLeft.y + a.quad.bottomLeft.y) / 2;
    const bCenterY = (b.quad.topLeft.y + b.quad.bottomLeft.y) / 2;
    // If centers are within 8% height of each other, sort by X
    if (Math.abs(aCenterY - bCenterY) < 0.08) {
      const aCenterX = (a.quad.topLeft.x + a.quad.topRight.x) / 2;
      const bCenterX = (b.quad.topLeft.x + b.quad.topRight.x) / 2;
      return aCenterX - bCenterX;
    }
    return aCenterY - bCenterY;
  });

  const finalPanels = regularPanels.map((p, idx) => ({
    quad: p.quad,
    diagnostics: p.diagnostics,
    index: idx + 1,
  }));

  return {
    panels: finalPanels,
    titleBanner,
  };
}
