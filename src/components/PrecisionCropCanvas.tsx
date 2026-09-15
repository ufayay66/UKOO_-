import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { ComicPanel, Point, Quad } from '../types/comic';
import {
  refinePanelQuadToOuterBorders,
  nudgeQuadEdge,
  findPanelFromInteriorPoint,
  checkQuadCrossesGutter,
} from '../utils/imageProcessing';
import {
  RotateCcw,
  Sparkles,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Check,
  Undo2,
  Crosshair,
} from 'lucide-react';

interface PrecisionCropCanvasProps {
  imageElement: HTMLCanvasElement | HTMLImageElement | null;
  rawImageCanvas: HTMLCanvasElement | null;
  panel: ComicPanel;
  onUpdateQuad: (quad: Quad) => void;
  onClose?: () => void;
  isModal?: boolean;
}

type Mode = 'corner' | 'pan' | 'click_find';

export const PrecisionCropCanvas: React.FC<PrecisionCropCanvasProps> = ({
  imageElement,
  rawImageCanvas,
  panel,
  onUpdateQuad,
  onClose,
  isModal = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);

  const [mode, setMode] = useState<Mode>('corner');
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // History stack for undo
  const [history, setHistory] = useState<Quad[]>([panel.quad]);
  const [activeQuad, setActiveQuad] = useState<Quad>(panel.quad);

  // Status message tooltip / feedback
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Container dimensions
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 });

  // Track if initial fit has been done for current panel
  const lastFittedPanelIdRef = useRef<string | null>(null);

  // Track user interaction so viewport doesn't jump
  const isInteractingRef = useRef(false);

  // Sync if prop panel changes
  useEffect(() => {
    setActiveQuad(panel.quad);
    setHistory([panel.quad]);
    setFeedbackMessage(null);
  }, [panel.id]);

  // Dragging state
  const [activeCorner, setActiveCorner] = useState<keyof Quad | null>(null);
  const [hoveringCorner, setHoveringCorner] = useState<keyof Quad | null>(null);
  const [isDraggingCenter, setIsDraggingCenter] = useState(false);
  const [isHoveringCenter, setIsHoveringCenter] = useState(false);
  const dragCenterStartRef = useRef<{
    clientX: number;
    clientY: number;
    initialQuad: Quad;
  } | null>(null);

  // Four-edge direct dragging state
  const [activeEdge, setActiveEdge] = useState<'top' | 'bottom' | 'left' | 'right' | null>(null);
  const [hoveringEdge, setHoveringEdge] = useState<'top' | 'bottom' | 'left' | 'right' | null>(null);
  const dragEdgeStartRef = useRef<{
    edge: 'top' | 'bottom' | 'left' | 'right';
    clientX: number;
    clientY: number;
    initialQuad: Quad;
  } | null>(null);

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Loupe position and visibility
  const [loupeVisible, setLoupeVisible] = useState(false);
  const [loupeScreenPos, setLoupeScreenPos] = useState({ x: 0, y: 0 });
  const [loupeImgPt, setLoupeImgPt] = useState<Point>({ x: 0, y: 0 });

  // Touch pinch tracking
  const touchStateRef = useRef<{
    initialDist: number;
    initialScale: number;
    initialOffset: { x: number; y: number };
    midpoint: { x: number; y: number };
  } | null>(null);

  // Measure container dimensions
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w > 40 && h > 40) {
        setViewSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Use rawImageCanvas as preferred canvas or imageElement as fallback
  const effectiveImg = rawImageCanvas || imageElement;

  // Safe normalized quad ensuring finite valid numbers between 0 and 1
  const safeActiveQuad = useMemo<Quad>(() => {
    const q = activeQuad || panel?.quad;
    return {
      topLeft: {
        x: Number.isFinite(q?.topLeft?.x) ? Math.max(0, Math.min(1, q.topLeft.x)) : 0.1,
        y: Number.isFinite(q?.topLeft?.y) ? Math.max(0, Math.min(1, q.topLeft.y)) : 0.1,
      },
      topRight: {
        x: Number.isFinite(q?.topRight?.x) ? Math.max(0, Math.min(1, q.topRight.x)) : 0.9,
        y: Number.isFinite(q?.topRight?.y) ? Math.max(0, Math.min(1, q.topRight.y)) : 0.1,
      },
      bottomRight: {
        x: Number.isFinite(q?.bottomRight?.x) ? Math.max(0, Math.min(1, q.bottomRight.x)) : 0.9,
        y: Number.isFinite(q?.bottomRight?.y) ? Math.max(0, Math.min(1, q.bottomRight.y)) : 0.9,
      },
      bottomLeft: {
        x: Number.isFinite(q?.bottomLeft?.x) ? Math.max(0, Math.min(1, q.bottomLeft.x)) : 0.1,
        y: Number.isFinite(q?.bottomLeft?.y) ? Math.max(0, Math.min(1, q.bottomLeft.y)) : 0.9,
      },
    };
  }, [activeQuad, panel?.quad]);

  /**
   * Fit current panel into the available viewport:
   * Deducts top toolbar (~52px) and bottom nudge bar (~64px).
   * Allocates ~15% operation margin around panel so 4 corners have ample drag space.
   * Centers the panel and handles completely inside view.
   */
  const fitPanelToViewport = useCallback(
    (quadToFit?: Quad) => {
      if (!effectiveImg || viewSize.width < 50 || viewSize.height < 50) return false;

      const imgW = 'naturalWidth' in effectiveImg ? (effectiveImg.naturalWidth || effectiveImg.width) : effectiveImg.width;
      const imgH = 'naturalHeight' in effectiveImg ? (effectiveImg.naturalHeight || effectiveImg.height) : effectiveImg.height;

      if (!imgW || !imgH || !Number.isFinite(imgW) || !Number.isFinite(imgH) || imgW <= 0 || imgH <= 0) return false;

      const topInset = 54;
      const bottomInset = 66;
      const sideInset = 24;

      const availW = Math.max(60, viewSize.width - sideInset * 2);
      const availH = Math.max(60, viewSize.height - (topInset + bottomInset));

      const centerScreenX = viewSize.width / 2;
      const centerScreenY = topInset + availH / 2;

      const q = quadToFit || safeActiveQuad;
      const safeTL = q?.topLeft || { x: 0.1, y: 0.1 };
      const safeTR = q?.topRight || { x: 0.9, y: 0.1 };
      const safeBR = q?.bottomRight || { x: 0.9, y: 0.9 };
      const safeBL = q?.bottomLeft || { x: 0.1, y: 0.9 };

      const minX = Math.min(safeTL.x, safeBL.x) * imgW;
      const maxX = Math.max(safeTR.x, safeBR.x) * imgW;
      const minY = Math.min(safeTL.y, safeTR.y) * imgH;
      const maxY = Math.max(safeBL.y, safeBR.y) * imgH;

      const panelW = Math.max(40, maxX - minX);
      const panelH = Math.max(40, maxY - minY);

      // Scale such that panel occupies ~70% of available viewport to guarantee generous room for corners
      const targetScaleX = (availW * 0.70) / panelW;
      const targetScaleY = (availH * 0.70) / panelH;
      let targetScale = Math.min(targetScaleX, targetScaleY);
      if (!Number.isFinite(targetScale) || targetScale <= 0) {
        targetScale = Math.min(availW / imgW, availH / imgH);
      }
      targetScale = Math.max(0.1, Math.min(targetScale, 4.5));

      const panelCenterImgX = (minX + maxX) / 2;
      const panelCenterImgY = (minY + maxY) / 2;

      const newOffsetX = centerScreenX - panelCenterImgX * targetScale;
      const newOffsetY = centerScreenY - panelCenterImgY * targetScale;

      setScale(targetScale);
      setOffset({
        x: Number.isFinite(newOffsetX) ? newOffsetX : 0,
        y: Number.isFinite(newOffsetY) ? newOffsetY : 0,
      });
      return true;
    },
    [effectiveImg, viewSize.width, viewSize.height, safeActiveQuad]
  );

  /**
   * Fit the ENTIRE comic newspaper into the viewport
   */
  const fitWholeComic = useCallback(() => {
    if (!effectiveImg || viewSize.width < 50 || viewSize.height < 50) return;
    const imgW = 'naturalWidth' in effectiveImg ? (effectiveImg.naturalWidth || effectiveImg.width) : effectiveImg.width;
    const imgH = 'naturalHeight' in effectiveImg ? (effectiveImg.naturalHeight || effectiveImg.height) : effectiveImg.height;

    if (!imgW || !imgH || !Number.isFinite(imgW) || !Number.isFinite(imgH) || imgW <= 0 || imgH <= 0) return;

    const topInset = 54;
    const bottomInset = 66;
    const sideInset = 20;
    const availW = Math.max(60, viewSize.width - sideInset * 2);
    const availH = Math.max(60, viewSize.height - (topInset + bottomInset));

    const targetScale = Math.max(0.05, Math.min(availW / imgW, availH / imgH));
    setScale(targetScale);
    setOffset({
      x: viewSize.width / 2 - (imgW / 2) * targetScale,
      y: topInset + availH / 2 - (imgH / 2) * targetScale,
    });
  }, [effectiveImg, viewSize.width, viewSize.height]);

  const lastFittedSizeRef = useRef<{ w: number; h: number } | null>(null);

  // Trigger fit when panel ID changes, or when image/container dimensions become ready or change significantly
  useEffect(() => {
    if (viewSize.width > 50 && viewSize.height > 50 && effectiveImg) {
      const sizeChanged =
        !lastFittedSizeRef.current ||
        Math.abs(lastFittedSizeRef.current.w - viewSize.width) > 15 ||
        Math.abs(lastFittedSizeRef.current.h - viewSize.height) > 15;

      if (lastFittedPanelIdRef.current !== panel.id || sizeChanged) {
        const success = fitPanelToViewport(panel.quad);
        if (success) {
          lastFittedPanelIdRef.current = panel.id;
          lastFittedSizeRef.current = { w: viewSize.width, h: viewSize.height };
        }
      }
    }
  }, [panel.id, viewSize.width, viewSize.height, effectiveImg, fitPanelToViewport, panel.quad]);

  // Reset fitted ref if panel ID changes so new panel always fits freshly
  useEffect(() => {
    lastFittedPanelIdRef.current = null;
    lastFittedSizeRef.current = null;
  }, [panel.id]);

  // Coordinate transforms
  const imgToScreen = useCallback(
    (pt: Point) => {
      if (!effectiveImg) return { x: 0, y: 0 };
      const imgW = 'naturalWidth' in effectiveImg ? (effectiveImg.naturalWidth || effectiveImg.width) : effectiveImg.width;
      const imgH = 'naturalHeight' in effectiveImg ? (effectiveImg.naturalHeight || effectiveImg.height) : effectiveImg.height;
      return {
        x: (offset.x || 0) + (pt.x || 0) * imgW * (scale || 1),
        y: (offset.y || 0) + (pt.y || 0) * imgH * (scale || 1),
      };
    },
    [offset, scale, effectiveImg]
  );

  const screenToImg = useCallback(
    (clientX: number, clientY: number): Point => {
      if (!effectiveImg || !canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;

      const imgW = 'naturalWidth' in effectiveImg ? (effectiveImg.naturalWidth || effectiveImg.width) : effectiveImg.width;
      const imgH = 'naturalHeight' in effectiveImg ? (effectiveImg.naturalHeight || effectiveImg.height) : effectiveImg.height;

      if (!imgW || !imgH || !scale) return { x: 0, y: 0 };

      const px = (sx - (offset.x || 0)) / (imgW * scale);
      const py = (sy - (offset.y || 0)) / (imgH * scale);

      return {
        x: Math.max(0, Math.min(1, Number.isFinite(px) ? px : 0)),
        y: Math.max(0, Math.min(1, Number.isFinite(py) ? py : 0)),
      };
    },
    [offset, scale, effectiveImg]
  );

  // Render main canvas with devicePixelRatio support
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || viewSize.width === 0 || viewSize.height === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(viewSize.width * dpr) || canvas.height !== Math.round(viewSize.height * dpr)) {
      canvas.width = Math.round(viewSize.width * dpr);
      canvas.height = Math.round(viewSize.height * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, viewSize.width, viewSize.height);

    if (!effectiveImg) {
      ctx.fillStyle = '#666';
      ctx.font = '14px "Noto Sans SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('正在载入报纸图片...', viewSize.width / 2, viewSize.height / 2);
      ctx.restore();
      return;
    }

    const imgW = 'naturalWidth' in effectiveImg ? (effectiveImg.naturalWidth || effectiveImg.width) : effectiveImg.width;
    const imgH = 'naturalHeight' in effectiveImg ? (effectiveImg.naturalHeight || effectiveImg.height) : effectiveImg.height;

    if (!imgW || !imgH || imgW <= 0 || imgH <= 0) {
      ctx.restore();
      return;
    }

    // Fallback: If scale or offset is somehow not yet finite, fit immediately
    const safeScale = Number.isFinite(scale) && scale > 0.01 ? scale : 1;
    const safeOffsetX = Number.isFinite(offset.x) ? offset.x : 0;
    const safeOffsetY = Number.isFinite(offset.y) ? offset.y : 0;

    // Draw background newspaper image
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(effectiveImg, safeOffsetX, safeOffsetY, imgW * safeScale, imgH * safeScale);
    ctx.restore();

    // Dark tint backdrop outside the active panel to clearly isolate the panel
    const pTL = imgToScreen(safeActiveQuad.topLeft);
    const pTR = imgToScreen(safeActiveQuad.topRight);
    const pBR = imgToScreen(safeActiveQuad.bottomRight);
    const pBL = imgToScreen(safeActiveQuad.bottomLeft);

    if (
      Number.isFinite(pTL.x) && Number.isFinite(pTL.y) &&
      Number.isFinite(pTR.x) && Number.isFinite(pTR.y) &&
      Number.isFinite(pBR.x) && Number.isFinite(pBR.y) &&
      Number.isFinite(pBL.x) && Number.isFinite(pBL.y)
    ) {
      ctx.save();
      ctx.fillStyle = 'rgba(20, 18, 16, 0.40)';
      ctx.beginPath();
      ctx.rect(0, 0, viewSize.width, viewSize.height);
      ctx.moveTo(pTL.x, pTL.y);
      ctx.lineTo(pBL.x, pBL.y);
      ctx.lineTo(pBR.x, pBR.y);
      ctx.lineTo(pTR.x, pTR.y);
      ctx.closePath();
      ctx.fill('evenodd');
      ctx.restore();

      // Draw active quad outline (crisp Charcoal border with thin white outer highlight)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pTL.x, pTL.y);
      ctx.lineTo(pTR.x, pTR.y);
      ctx.lineTo(pBR.x, pBR.y);
      ctx.lineTo(pBL.x, pBL.y);
      ctx.closePath();

      // White outer shadow/stroke for high contrast on dark paper
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Dark crisp ink line
      ctx.strokeStyle = '#222725';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Highlight active or hovered edge line (轻微高亮 / 拖拽赤褐高亮)
      const currentHighlightedEdge = activeEdge || (isHoveringCenter || activeCorner ? null : hoveringEdge);
      if (currentHighlightedEdge) {
        ctx.save();
        ctx.beginPath();
        if (currentHighlightedEdge === 'top') {
          ctx.moveTo(pTL.x, pTL.y);
          ctx.lineTo(pTR.x, pTR.y);
        } else if (currentHighlightedEdge === 'bottom') {
          ctx.moveTo(pBL.x, pBL.y);
          ctx.lineTo(pBR.x, pBR.y);
        } else if (currentHighlightedEdge === 'left') {
          ctx.moveTo(pTL.x, pTL.y);
          ctx.lineTo(pBL.x, pBL.y);
        } else if (currentHighlightedEdge === 'right') {
          ctx.moveTo(pTR.x, pTR.y);
          ctx.lineTo(pBR.x, pBR.y);
        }

        // Soft halo on edge
        ctx.strokeStyle = activeEdge ? 'rgba(143, 62, 46, 0.45)' : 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = activeEdge ? 8 : 6;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Distinct crisp edge line
        ctx.strokeStyle = activeEdge ? '#8F3E2E' : '#222725';
        ctx.lineWidth = activeEdge ? 3.5 : 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      }

      // Draw 4 corner handles with large visual clarity and generous touch radius
      const corners: Array<{ key: keyof Quad; pt: { x: number; y: number } }> = [
        { key: 'topLeft', pt: pTL },
        { key: 'topRight', pt: pTR },
        { key: 'bottomRight', pt: pBR },
        { key: 'bottomLeft', pt: pBL },
      ];

      corners.forEach(({ key, pt }) => {
        const isDraggingThis = activeCorner === key;
        ctx.save();

        // Large outer halo for visibility
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, isDraggingThis ? 18 : 13, 0, Math.PI * 2);
        ctx.fillStyle = isDraggingThis ? 'rgba(143, 62, 46, 0.35)' : 'rgba(255, 255, 255, 0.75)';
        ctx.fill();

        // Outer ring
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, isDraggingThis ? 11 : 9, 0, Math.PI * 2);
        ctx.fillStyle = isDraggingThis ? '#8F3E2E' : '#222725';
        ctx.fill();

        // Inner dot
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, isDraggingThis ? 5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = '#FBF7EF';
        ctx.fill();

        ctx.restore();
      });

      // Draw Center Overall Translation Handle (带四向箭头的小圆形手柄，沿用深色、浅色描边风格)
      const centerPt = {
        x: (safeActiveQuad.topLeft.x + safeActiveQuad.topRight.x + safeActiveQuad.bottomRight.x + safeActiveQuad.bottomLeft.x) / 4,
        y: (safeActiveQuad.topLeft.y + safeActiveQuad.topRight.y + safeActiveQuad.bottomRight.y + safeActiveQuad.bottomLeft.y) / 4,
      };
      const pCenter = imgToScreen(centerPt);

      if (Number.isFinite(pCenter.x) && Number.isFinite(pCenter.y)) {
        ctx.save();

        const isHighlight = isDraggingCenter || isHoveringCenter;
        const radius = isDraggingCenter ? 15 : isHoveringCenter ? 14 : 13;

        // 1. Drop shadow / outer halo
        ctx.beginPath();
        ctx.arc(pCenter.x, pCenter.y, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = isDraggingCenter
          ? 'rgba(143, 62, 46, 0.45)'
          : isHoveringCenter
          ? 'rgba(34, 39, 37, 0.3)'
          : 'rgba(255, 255, 255, 0.75)';
        ctx.fill();

        // 2. High-contrast crisp border (white)
        ctx.beginPath();
        ctx.arc(pCenter.x, pCenter.y, radius + 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fill();

        // 3. Central circular disk body (Charcoal dark #222725 or Terracotta red #8F3E2E when dragging)
        ctx.beginPath();
        ctx.arc(pCenter.x, pCenter.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isDraggingCenter ? '#8F3E2E' : '#222725';
        ctx.fill();

        // 4. Center dot
        ctx.beginPath();
        ctx.arc(pCenter.x, pCenter.y, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = '#FBF7EF';
        ctx.fill();

        // 5. Four-way directional arrows (四向箭头)
        ctx.strokeStyle = '#FBF7EF';
        ctx.fillStyle = '#FBF7EF';
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const arm = 6;
        const arrow = 2.8;

        // Top arrow
        ctx.beginPath();
        ctx.moveTo(pCenter.x, pCenter.y - 2);
        ctx.lineTo(pCenter.x, pCenter.y - arm);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pCenter.x - arrow, pCenter.y - arm + 2.2);
        ctx.lineTo(pCenter.x, pCenter.y - arm - 1);
        ctx.lineTo(pCenter.x + arrow, pCenter.y - arm + 2.2);
        ctx.stroke();

        // Bottom arrow
        ctx.beginPath();
        ctx.moveTo(pCenter.x, pCenter.y + 2);
        ctx.lineTo(pCenter.x, pCenter.y + arm);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pCenter.x - arrow, pCenter.y + arm - 2.2);
        ctx.lineTo(pCenter.x, pCenter.y + arm + 1);
        ctx.lineTo(pCenter.x + arrow, pCenter.y + arm - 2.2);
        ctx.stroke();

        // Left arrow
        ctx.beginPath();
        ctx.moveTo(pCenter.x - 2, pCenter.y);
        ctx.lineTo(pCenter.x - arm, pCenter.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pCenter.x - arm + 2.2, pCenter.y - arrow);
        ctx.lineTo(pCenter.x - arm - 1, pCenter.y);
        ctx.lineTo(pCenter.x - arm + 2.2, pCenter.y + arrow);
        ctx.stroke();

        // Right arrow
        ctx.beginPath();
        ctx.moveTo(pCenter.x + 2, pCenter.y);
        ctx.lineTo(pCenter.x + arm, pCenter.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pCenter.x + arm - 2.2, pCenter.y - arrow);
        ctx.lineTo(pCenter.x + arm + 1, pCenter.y);
        ctx.lineTo(pCenter.x + arm - 2.2, pCenter.y + arrow);
        ctx.stroke();

        // 6. Hover tooltip pill ("拖动以整体移动选框")
        if (isHoveringCenter && !isDraggingCenter && !activeCorner) {
          const tooltipText = '拖动以整体移动选框';
          ctx.font = '11px "Noto Sans SC", sans-serif';
          const tw = ctx.measureText(tooltipText).width;
          const pw = tw + 16;
          const ph = 22;
          const px = pCenter.x - pw / 2;
          const py = pCenter.y + radius + 8;

          ctx.fillStyle = 'rgba(34, 39, 37, 0.94)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          if ('roundRect' in ctx) {
            (ctx as any).roundRect(px, py, pw, ph, 6);
          } else {
            ctx.rect(px, py, pw, ph);
          }
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#FBF7EF';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(tooltipText, pCenter.x, py + ph / 2);
        }

        ctx.restore();
      }
    }

    ctx.restore();
  }, [
    effectiveImg,
    offset,
    scale,
    safeActiveQuad,
    activeCorner,
    isDraggingCenter,
    isHoveringCenter,
    activeEdge,
    hoveringEdge,
    imgToScreen,
    viewSize.width,
    viewSize.height,
  ]);

  // Render floating magnifying loupe
  useEffect(() => {
    if (!loupeVisible || !loupeCanvasRef.current || !rawImageCanvas) return;
    const lCanvas = loupeCanvasRef.current;
    const ctx = lCanvas.getContext('2d');
    if (!ctx) return;

    const size = lCanvas.width;
    ctx.clearRect(0, 0, size, size);

    const imgW = rawImageCanvas.width;
    const imgH = rawImageCanvas.height;

    const centerImgX = loupeImgPt.x * imgW;
    const centerImgY = loupeImgPt.y * imgH;

    const zoom = 3.5;
    const sampleRadius = size / 2 / zoom;

    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.clip();

    // Background paper
    ctx.fillStyle = '#FBF7EF';
    ctx.fill();

    ctx.drawImage(
      rawImageCanvas,
      centerImgX - sampleRadius,
      centerImgY - sampleRadius,
      sampleRadius * 2,
      sampleRadius * 2,
      0,
      0,
      size,
      size
    );

    // Crosshair in loupe
    ctx.strokeStyle = '#8F3E2E';
    ctx.lineWidth = 1.5;

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(size / 2, 8);
    ctx.lineTo(size / 2, size / 2 - 6);
    ctx.moveTo(size / 2, size / 2 + 6);
    ctx.lineTo(size / 2, size - 8);
    ctx.stroke();

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(8, size / 2);
    ctx.lineTo(size / 2 - 6, size / 2);
    ctx.moveTo(size / 2 + 6, size / 2);
    ctx.lineTo(size - 8, size / 2);
    ctx.stroke();

    // Center target ring
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    // Outer ring border
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.strokeStyle = '#222725';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();
  }, [loupeVisible, loupeImgPt, rawImageCanvas]);

  // Calculate geometric center of current selection quad
  const getQuadCenter = useCallback((q: Quad): Point => {
    const tl = q?.topLeft || { x: 0, y: 0 };
    const tr = q?.topRight || { x: 0, y: 0 };
    const br = q?.bottomRight || { x: 0, y: 0 };
    const bl = q?.bottomLeft || { x: 0, y: 0 };
    return {
      x: (tl.x + tr.x + br.x + bl.x) / 4,
      y: (tl.y + tr.y + br.y + bl.y) / 4,
    };
  }, []);

  // Distance from point (px, py) to line segment (x1, y1)-(x2, y2)
  const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  };

  // Hit test for corner handles, center move handle, and 4 edge lines
  const checkHit = useCallback(
    (clientX: number, clientY: number, touchMode = false) => {
      if (!canvasRef.current) return { type: 'none' as const };
      const rect = canvasRef.current.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;

      // 1. Check corner handles (highest priority)
      const corners: Array<{ key: keyof Quad; pt: Point }> = [
        { key: 'topLeft', pt: safeActiveQuad.topLeft },
        { key: 'topRight', pt: safeActiveQuad.topRight },
        { key: 'bottomRight', pt: safeActiveQuad.bottomRight },
        { key: 'bottomLeft', pt: safeActiveQuad.bottomLeft },
      ];

      const cornerHitRadius = touchMode ? 52 : 40;
      let closestCornerKey: keyof Quad | null = null;
      let minCornerDist = cornerHitRadius;

      corners.forEach(({ key, pt }) => {
        const sPt = imgToScreen(pt);
        const d = Math.hypot(sx - sPt.x, sy - sPt.y);
        if (d < minCornerDist) {
          minCornerDist = d;
          closestCornerKey = key;
        }
      });

      if (closestCornerKey) {
        return { type: 'corner' as const, corner: closestCornerKey };
      }

      // 2. Check center handle (second priority)
      const centerPt = getQuadCenter(safeActiveQuad);
      const sCenter = imgToScreen(centerPt);
      const distToCenter = Math.hypot(sx - sCenter.x, sy - sCenter.y);
      const centerHitRadius = touchMode ? 36 : 24;
      if (distToCenter <= centerHitRadius) {
        return { type: 'center' as const };
      }

      // 3. Check 4 edge lines (third priority)
      const sTL = imgToScreen(safeActiveQuad.topLeft);
      const sTR = imgToScreen(safeActiveQuad.topRight);
      const sBR = imgToScreen(safeActiveQuad.bottomRight);
      const sBL = imgToScreen(safeActiveQuad.bottomLeft);

      const dTop = distToSegment(sx, sy, sTL.x, sTL.y, sTR.x, sTR.y);
      const dBottom = distToSegment(sx, sy, sBL.x, sBL.y, sBR.x, sBR.y);
      const dLeft = distToSegment(sx, sy, sTL.x, sTL.y, sBL.x, sBL.y);
      const dRight = distToSegment(sx, sy, sTR.x, sTR.y, sBR.x, sBR.y);

      const edgeHitRadius = touchMode ? 26 : 14;
      const edges: Array<{ edge: 'top' | 'bottom' | 'left' | 'right'; dist: number }> = [
        { edge: 'top', dist: dTop },
        { edge: 'bottom', dist: dBottom },
        { edge: 'left', dist: dLeft },
        { edge: 'right', dist: dRight },
      ];

      let closestEdge: 'top' | 'bottom' | 'left' | 'right' | null = null;
      let minEdgeDist = edgeHitRadius;
      edges.forEach((item) => {
        if (item.dist < minEdgeDist) {
          minEdgeDist = item.dist;
          closestEdge = item.edge;
        }
      });

      if (closestEdge) {
        return { type: 'edge' as const, edge: closestEdge };
      }

      return { type: 'none' as const };
    },
    [getQuadCenter, safeActiveQuad, imgToScreen]
  );

  // Translate individual edge while keeping opposite corners fixed and preserving skew
  const calculateEdgeDragQuad = useCallback(
    (currentClientX: number, currentClientY: number): Quad | null => {
      if (!dragEdgeStartRef.current || !effectiveImg) return null;

      const imgW = 'naturalWidth' in effectiveImg ? (effectiveImg.naturalWidth || effectiveImg.width) : effectiveImg.width;
      const imgH = 'naturalHeight' in effectiveImg ? (effectiveImg.naturalHeight || effectiveImg.height) : effectiveImg.height;

      if (!imgW || !imgH || !scale || scale <= 0) return null;

      const dxScreen = currentClientX - dragEdgeStartRef.current.clientX;
      const dyScreen = currentClientY - dragEdgeStartRef.current.clientY;

      const deltaNormX = dxScreen / (imgW * scale);
      const deltaNormY = dyScreen / (imgH * scale);

      const { edge, initialQuad: initQ } = dragEdgeStartRef.current;
      const minDist = 0.015; // minimum safe dimension ~1.5%

      if (edge === 'top') {
        // Move top edge vertically: only topLeft.y and topRight.y change by deltaY
        const minDeltaY = -Math.min(initQ.topLeft.y, initQ.topRight.y);
        const maxDeltaY = Math.min(
          initQ.bottomLeft.y - initQ.topLeft.y - minDist,
          initQ.bottomRight.y - initQ.topRight.y - minDist,
          1 - Math.max(initQ.topLeft.y, initQ.topRight.y) - minDist
        );
        const clampedDeltaY = Math.max(minDeltaY, Math.min(maxDeltaY, deltaNormY));

        return {
          ...initQ,
          topLeft: { x: initQ.topLeft.x, y: initQ.topLeft.y + clampedDeltaY },
          topRight: { x: initQ.topRight.x, y: initQ.topRight.y + clampedDeltaY },
        };
      }

      if (edge === 'bottom') {
        // Move bottom edge vertically: only bottomLeft.y and bottomRight.y change by deltaY
        const maxDeltaY = 1 - Math.max(initQ.bottomLeft.y, initQ.bottomRight.y);
        const minDeltaY = Math.max(
          initQ.topLeft.y + minDist - initQ.bottomLeft.y,
          initQ.topRight.y + minDist - initQ.bottomRight.y,
          -Math.min(initQ.bottomLeft.y, initQ.bottomRight.y)
        );
        const clampedDeltaY = Math.max(minDeltaY, Math.min(maxDeltaY, deltaNormY));

        return {
          ...initQ,
          bottomLeft: { x: initQ.bottomLeft.x, y: initQ.bottomLeft.y + clampedDeltaY },
          bottomRight: { x: initQ.bottomRight.x, y: initQ.bottomRight.y + clampedDeltaY },
        };
      }

      if (edge === 'left') {
        // Move left edge horizontally: only topLeft.x and bottomLeft.x change by deltaX
        const minDeltaX = -Math.min(initQ.topLeft.x, initQ.bottomLeft.x);
        const maxDeltaX = Math.min(
          initQ.topRight.x - initQ.topLeft.x - minDist,
          initQ.bottomRight.x - initQ.bottomLeft.x - minDist,
          1 - Math.max(initQ.topLeft.x, initQ.bottomLeft.x) - minDist
        );
        const clampedDeltaX = Math.max(minDeltaX, Math.min(maxDeltaX, deltaNormX));

        return {
          ...initQ,
          topLeft: { x: initQ.topLeft.x + clampedDeltaX, y: initQ.topLeft.y },
          bottomLeft: { x: initQ.bottomLeft.x + clampedDeltaX, y: initQ.bottomLeft.y },
        };
      }

      if (edge === 'right') {
        // Move right edge horizontally: only topRight.x and bottomRight.x change by deltaX
        const maxDeltaX = 1 - Math.max(initQ.topRight.x, initQ.bottomRight.x);
        const minDeltaX = Math.max(
          initQ.topLeft.x + minDist - initQ.topRight.x,
          initQ.bottomLeft.x + minDist - initQ.bottomRight.x,
          -Math.min(initQ.topRight.x, initQ.bottomRight.x)
        );
        const clampedDeltaX = Math.max(minDeltaX, Math.min(maxDeltaX, deltaNormX));

        return {
          ...initQ,
          topRight: { x: initQ.topRight.x + clampedDeltaX, y: initQ.topRight.y },
          bottomRight: { x: initQ.bottomRight.x + clampedDeltaX, y: initQ.bottomRight.y },
        };
      }

      return null;
    },
    [effectiveImg, scale]
  );

  // Translate entire quad while preserving shape, skew, and bounds [0, 1]
  const calculateCenterDragQuad = useCallback(
    (currentClientX: number, currentClientY: number): Quad | null => {
      if (!dragCenterStartRef.current || !effectiveImg) return null;

      const imgW = 'naturalWidth' in effectiveImg ? (effectiveImg.naturalWidth || effectiveImg.width) : effectiveImg.width;
      const imgH = 'naturalHeight' in effectiveImg ? (effectiveImg.naturalHeight || effectiveImg.height) : effectiveImg.height;

      if (!imgW || !imgH || !scale || scale <= 0) return null;

      const dxScreen = currentClientX - dragCenterStartRef.current.clientX;
      const dyScreen = currentClientY - dragCenterStartRef.current.clientY;

      // Exact conversion from screen pixels to normalized raw image coordinates
      const deltaNormX = dxScreen / (imgW * scale);
      const deltaNormY = dyScreen / (imgH * scale);

      const initQ = dragCenterStartRef.current.initialQuad;
      const minX = Math.min(initQ.topLeft.x, initQ.topRight.x, initQ.bottomRight.x, initQ.bottomLeft.x);
      const maxX = Math.max(initQ.topLeft.x, initQ.topRight.x, initQ.bottomRight.x, initQ.bottomLeft.x);
      const minY = Math.min(initQ.topLeft.y, initQ.topRight.y, initQ.bottomRight.y, initQ.bottomLeft.y);
      const maxY = Math.max(initQ.topLeft.y, initQ.topRight.y, initQ.bottomRight.y, initQ.bottomLeft.y);

      // Clamp whole quad movement so no corner crosses boundaries [0, 1]
      const clampedDeltaX = Math.max(-minX, Math.min(1 - maxX, deltaNormX));
      const clampedDeltaY = Math.max(-minY, Math.min(1 - maxY, deltaNormY));

      return {
        topLeft: {
          x: initQ.topLeft.x + clampedDeltaX,
          y: initQ.topLeft.y + clampedDeltaY,
        },
        topRight: {
          x: initQ.topRight.x + clampedDeltaX,
          y: initQ.topRight.y + clampedDeltaY,
        },
        bottomRight: {
          x: initQ.bottomRight.x + clampedDeltaX,
          y: initQ.bottomRight.y + clampedDeltaY,
        },
        bottomLeft: {
          x: initQ.bottomLeft.x + clampedDeltaX,
          y: initQ.bottomLeft.y + clampedDeltaY,
        },
      };
    },
    [effectiveImg, scale]
  );

  // Push to history when quad changes
  const updateQuadWithHistory = (newQuad: Quad) => {
    if (rafUpdateRef.current) {
      cancelAnimationFrame(rafUpdateRef.current);
      rafUpdateRef.current = null;
    }
    setHistory((prev) => [...prev.slice(-15), newQuad]);
    setActiveQuad(newQuad);
    onUpdateQuad(newQuad);
  };

  // Throttled live update during drag for smooth real-time preview on right side
  const rafUpdateRef = useRef<number | null>(null);
  const notifyQuadUpdateThrottled = useCallback(
    (q: Quad) => {
      if (rafUpdateRef.current) return;
      rafUpdateRef.current = requestAnimationFrame(() => {
        rafUpdateRef.current = null;
        onUpdateQuad(q);
      });
    },
    [onUpdateQuad]
  );

  // Undo action
  const handleUndo = () => {
    if (history.length > 1) {
      const nextHistory = [...history];
      nextHistory.pop();
      const prevQuad = nextHistory[nextHistory.length - 1];
      setHistory(nextHistory);
      setActiveQuad(prevQuad);
      onUpdateQuad(prevQuad);
      setFeedbackMessage('已撤销上一次调整');
    }
  };

  // Reset to original detected quad
  const handleReset = () => {
    updateQuadWithHistory(panel.quad);
    fitPanelToViewport(panel.quad);
    setFeedbackMessage('已重置为此格初始检测边框');
  };

  /**
   * High-Precision Border Snapping:
   * 1. Checks if quad currently crosses an internal gutter (merged cells).
   * 2. Runs inward-from-gutter RANSAC outer border fitting.
   */
  const handleAutoSnap = () => {
    if (!rawImageCanvas) return;

    // Check if quad crosses an internal gutter
    const gutterInfo = checkQuadCrossesGutter(rawImageCanvas, activeQuad);
    let seedQuad = activeQuad;

    if (gutterInfo.crossesGutter && gutterInfo.splitX) {
      // Quad spans across 2 cells: shrink to left half first to break cross-cell lock
      const splitX = gutterInfo.splitX;
      seedQuad = {
        topLeft: { ...activeQuad.topLeft },
        topRight: { x: splitX - 0.01, y: activeQuad.topRight.y },
        bottomRight: { x: splitX - 0.01, y: activeQuad.bottomRight.y },
        bottomLeft: { ...activeQuad.bottomLeft },
      };
      setFeedbackMessage('检测到跨格空白沟，已自动定位回单格');
    }

    const { quad: snapped, diagnostics } = refinePanelQuadToOuterBorders(rawImageCanvas, seedQuad);
    updateQuadWithHistory(snapped);

    if (diagnostics.warnings.length > 0) {
      setFeedbackMessage(diagnostics.warnings[0]);
    } else {
      setFeedbackMessage('已紧密贴合四边外沿黑线');
    }
  };

  // Click-to-Find Handler
  const handleClickFind = (clientX: number, clientY: number) => {
    if (!rawImageCanvas) return;
    const imgPt = screenToImg(clientX, clientY);
    const result = findPanelFromInteriorPoint(rawImageCanvas, imgPt);
    if (result) {
      updateQuadWithHistory(result.quad);
      fitPanelToViewport(result.quad);
      setFeedbackMessage('已根据点击位置重新寻获完整黑框');
      setMode('corner');
    } else {
      setFeedbackMessage('未在此点探测到完整的黑框，建议手动调整四角');
    }
  };

  // Edge nudge by delta pixels
  const handleNudgeEdge = (edge: 'top' | 'bottom' | 'left' | 'right', deltaPx: number) => {
    if (!rawImageCanvas) return;
    const nudged = nudgeQuadEdge(
      activeQuad,
      edge,
      deltaPx,
      rawImageCanvas.width,
      rawImageCanvas.height
    );
    updateQuadWithHistory(nudged);
  };

  // Position the loupe comfortably ABOVE the user's touch point
  const updateLoupePosition = (clientX: number, clientY: number, imgPt: Point) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const touchX = clientX - rect.left;
    const touchY = clientY - rect.top;

    const loupeY = touchY < 140 ? touchY + 110 : touchY - 110;
    const loupeX = Math.max(70, Math.min(rect.width - 70, touchX));

    setLoupeScreenPos({ x: loupeX, y: loupeY });
    setLoupeImgPt(imgPt);
    setLoupeVisible(true);
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    isInteractingRef.current = true;

    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const midpoint = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      };
      touchStateRef.current = {
        initialDist: dist,
        initialScale: scale,
        initialOffset: { ...offset },
        midpoint,
      };
      setActiveCorner(null);
      setIsDraggingCenter(false);
      dragCenterStartRef.current = null;
      setActiveEdge(null);
      dragEdgeStartRef.current = null;
      setLoupeVisible(false);
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];

      if (mode === 'click_find') {
        handleClickFind(touch.clientX, touch.clientY);
        return;
      }

      if (mode === 'pan') {
        setIsPanning(true);
        setPanStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
        return;
      }

      const hit = checkHit(touch.clientX, touch.clientY, true);
      if (hit.type === 'corner') {
        setActiveCorner(hit.corner);
        const imgPt = activeQuad[hit.corner];
        updateLoupePosition(touch.clientX, touch.clientY, imgPt);
        return;
      }

      if (hit.type === 'center') {
        setIsDraggingCenter(true);
        dragCenterStartRef.current = {
          clientX: touch.clientX,
          clientY: touch.clientY,
          initialQuad: {
            topLeft: { ...safeActiveQuad.topLeft },
            topRight: { ...safeActiveQuad.topRight },
            bottomRight: { ...safeActiveQuad.bottomRight },
            bottomLeft: { ...safeActiveQuad.bottomLeft },
          },
        };
        return;
      }

      if (hit.type === 'edge') {
        setActiveEdge(hit.edge);
        dragEdgeStartRef.current = {
          edge: hit.edge,
          clientX: touch.clientX,
          clientY: touch.clientY,
          initialQuad: {
            topLeft: { ...safeActiveQuad.topLeft },
            topRight: { ...safeActiveQuad.topRight },
            bottomRight: { ...safeActiveQuad.bottomRight },
            bottomLeft: { ...safeActiveQuad.bottomLeft },
          },
        };
        return;
      }

      setIsPanning(true);
      setPanStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStateRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = currentDist / touchStateRef.current.initialDist;
      const newScale = Math.max(0.2, Math.min(6.0, touchStateRef.current.initialScale * ratio));

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const midX = touchStateRef.current.midpoint.x - rect.left;
        const midY = touchStateRef.current.midpoint.y - rect.top;

        const scaleDiff = newScale / touchStateRef.current.initialScale;
        const newOffsetX = midX - (midX - touchStateRef.current.initialOffset.x) * scaleDiff;
        const newOffsetY = midY - (midY - touchStateRef.current.initialOffset.y) * scaleDiff;

        setScale(newScale);
        setOffset({ x: newOffsetX, y: newOffsetY });
      }
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];

      if (activeCorner) {
        const imgPt = screenToImg(touch.clientX, touch.clientY);
        const nextQuad = { ...activeQuad, [activeCorner]: imgPt };
        setActiveQuad(nextQuad);
        notifyQuadUpdateThrottled(nextQuad);
        updateLoupePosition(touch.clientX, touch.clientY, imgPt);
        return;
      }

      if (isDraggingCenter) {
        const nextQuad = calculateCenterDragQuad(touch.clientX, touch.clientY);
        if (nextQuad) {
          setActiveQuad(nextQuad);
          notifyQuadUpdateThrottled(nextQuad);
        }
        return;
      }

      if (activeEdge) {
        const nextQuad = calculateEdgeDragQuad(touch.clientX, touch.clientY);
        if (nextQuad) {
          setActiveQuad(nextQuad);
          notifyQuadUpdateThrottled(nextQuad);
        }
        return;
      }

      if (isPanning) {
        setOffset({
          x: touch.clientX - panStart.x,
          y: touch.clientY - panStart.y,
        });
      }
    }
  };

  const handleTouchEnd = () => {
    touchStateRef.current = null;
    if (activeCorner) {
      updateQuadWithHistory(activeQuad);
      setActiveCorner(null);
      setLoupeVisible(false);
    }
    if (isDraggingCenter) {
      updateQuadWithHistory(activeQuad);
      setIsDraggingCenter(false);
      dragCenterStartRef.current = null;
    }
    if (activeEdge) {
      updateQuadWithHistory(activeQuad);
      setActiveEdge(null);
      dragEdgeStartRef.current = null;
    }
    setIsPanning(false);
    isInteractingRef.current = false;
  };

  // Mouse handlers (Desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isInteractingRef.current = true;

    if (mode === 'click_find') {
      handleClickFind(e.clientX, e.clientY);
      return;
    }

    if (mode === 'pan') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      return;
    }

    const hit = checkHit(e.clientX, e.clientY, false);
    if (hit.type === 'corner') {
      setActiveCorner(hit.corner);
      const imgPt = activeQuad[hit.corner];
      updateLoupePosition(e.clientX, e.clientY, imgPt);
      return;
    }

    if (hit.type === 'center') {
      setIsDraggingCenter(true);
      dragCenterStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        initialQuad: {
          topLeft: { ...safeActiveQuad.topLeft },
          topRight: { ...safeActiveQuad.topRight },
          bottomRight: { ...safeActiveQuad.bottomRight },
          bottomLeft: { ...safeActiveQuad.bottomLeft },
        },
      };
      return;
    }

    if (hit.type === 'edge') {
      setActiveEdge(hit.edge);
      dragEdgeStartRef.current = {
        edge: hit.edge,
        clientX: e.clientX,
        clientY: e.clientY,
        initialQuad: {
          topLeft: { ...safeActiveQuad.topLeft },
          topRight: { ...safeActiveQuad.topRight },
          bottomRight: { ...safeActiveQuad.bottomRight },
          bottomLeft: { ...safeActiveQuad.bottomLeft },
        },
      };
      return;
    }

    setIsPanning(true);
    setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (activeCorner) {
      const imgPt = screenToImg(e.clientX, e.clientY);
      const nextQuad = { ...activeQuad, [activeCorner]: imgPt };
      setActiveQuad(nextQuad);
      notifyQuadUpdateThrottled(nextQuad);
      updateLoupePosition(e.clientX, e.clientY, imgPt);
      return;
    }

    if (isDraggingCenter) {
      const nextQuad = calculateCenterDragQuad(e.clientX, e.clientY);
      if (nextQuad) {
        setActiveQuad(nextQuad);
        notifyQuadUpdateThrottled(nextQuad);
      }
      return;
    }

    if (activeEdge) {
      const nextQuad = calculateEdgeDragQuad(e.clientX, e.clientY);
      if (nextQuad) {
        setActiveQuad(nextQuad);
        notifyQuadUpdateThrottled(nextQuad);
      }
      return;
    }

    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    // Hover detection when idle in selection mode
    if (mode === 'select') {
      const hit = checkHit(e.clientX, e.clientY, false);
      setHoveringCorner(hit.type === 'corner' ? hit.corner : null);
      setIsHoveringCenter(hit.type === 'center');
      setHoveringEdge(hit.type === 'edge' ? hit.edge : null);
    }
  };

  const handleMouseUp = () => {
    if (activeCorner) {
      updateQuadWithHistory(activeQuad);
      setActiveCorner(null);
      setLoupeVisible(false);
    }
    if (isDraggingCenter) {
      updateQuadWithHistory(activeQuad);
      setIsDraggingCenter(false);
      dragCenterStartRef.current = null;
    }
    if (activeEdge) {
      updateQuadWithHistory(activeQuad);
      setActiveEdge(null);
      dragEdgeStartRef.current = null;
    }
    setIsPanning(false);
    isInteractingRef.current = false;
  };

  const getCanvasCursorClass = () => {
    if (mode === 'click_find') return 'cursor-pointer';
    if (mode === 'pan' || isPanning) return isPanning ? 'cursor-grabbing' : 'cursor-grab';
    if (activeCorner || hoveringCorner) return 'cursor-crosshair';
    if (isDraggingCenter) return 'cursor-grabbing';
    if (isHoveringCenter) return 'cursor-grab';
    if (activeEdge === 'top' || activeEdge === 'bottom' || hoveringEdge === 'top' || hoveringEdge === 'bottom') {
      return 'cursor-ns-resize';
    }
    if (activeEdge === 'left' || activeEdge === 'right' || hoveringEdge === 'left' || hoveringEdge === 'right') {
      return 'cursor-ew-resize';
    }
    return 'cursor-crosshair';
  };

  const getCanvasTitle = () => {
    if (hoveringCorner || activeCorner) return '拖动角点以单独调整';
    if (isHoveringCenter || isDraggingCenter) return '拖动以整体移动选框';
    if (hoveringEdge === 'top' || hoveringEdge === 'bottom' || activeEdge === 'top' || activeEdge === 'bottom') {
      return '拖动以调整上下裁切范围';
    }
    if (hoveringEdge === 'left' || hoveringEdge === 'right' || activeEdge === 'left' || activeEdge === 'right') {
      return '拖动以调整左右裁切范围';
    }
    return undefined;
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newScale = Math.max(0.2, Math.min(6.0, scale * zoomFactor));

    const newOffsetX = mouseX - (mouseX - offset.x) * (newScale / scale);
    const newOffsetY = mouseY - (mouseY - offset.y) * (newScale / scale);

    setScale(newScale);
    setOffset({ x: newOffsetX, y: newOffsetY });
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex flex-col bg-[#1c1917] overflow-hidden select-none touch-none ${
        isModal ? 'fixed inset-0 z-50' : 'rounded-2xl border border-[#e5dfd5]'
      }`}
    >
      {/* Top Floating Control Bar */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-30 flex items-center justify-between pointer-events-none gap-1.5">
        {/* Left: Mode Switch Pills & View Presets */}
        <div className="flex items-center space-x-1 bg-[#222725]/90 backdrop-blur-md p-1 rounded-full border border-white/15 pointer-events-auto overflow-x-auto max-w-[70vw]">
          <button
            type="button"
            onClick={() => setMode('corner')}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              mode === 'corner' ? 'bg-[#FBF7EF] text-[#222725]' : 'text-[#E5DFD5] hover:text-white'
            }`}
            title="拖动四个角点进行精细调整"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>调四角</span>
          </button>

          <button
            type="button"
            onClick={fitWholeComic}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-full text-xs text-[#E5DFD5] hover:text-white hover:bg-white/10 transition-all cursor-pointer whitespace-nowrap"
            title="查看整张报纸"
          >
            <Maximize2 className="w-3 h-3" />
            <span>整张全貌</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-1.5 pointer-events-auto shrink-0">
          {/* Undo */}
          <button
            type="button"
            disabled={history.length <= 1}
            onClick={handleUndo}
            className="p-2 rounded-full bg-[#222725]/90 hover:bg-[#222725] text-white border border-white/15 disabled:opacity-30 cursor-pointer transition-all"
            title="撤销上一次调整"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>

          {/* Reset */}
          <button
            type="button"
            onClick={handleReset}
            className="p-2 rounded-full bg-[#222725]/90 hover:bg-[#222725] text-white border border-white/15 cursor-pointer transition-all"
            title="重置为此格初始检测边框"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Auto Snap */}
          <button
            type="button"
            onClick={handleAutoSnap}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-full bg-[#8F3E2E] hover:bg-[#A84A37] text-white text-xs font-semibold cursor-pointer transition-all"
            title="在四边附近探测真实黑框并精细吸附外沿"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#FBF7EF]" />
            <span>吸附黑框</span>
          </button>

          {/* Done / Close if in modal */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-full bg-[#FBF7EF] hover:bg-white text-[#222725] text-xs font-bold cursor-pointer transition-all"
            >
              <Check className="w-3.5 h-3.5 text-[#222725]" />
              <span>完成</span>
            </button>
          )}
        </div>
      </div>

      {/* Floating feedback message toast */}
      {feedbackMessage && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 px-3 py-1 bg-[#222725]/95 text-[#FBF7EF] border border-white/20 rounded-full text-xs animate-fade-in pointer-events-none">
          {feedbackMessage}
        </div>
      )}

      {/* Main Interactive Canvas */}
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        title={getCanvasTitle()}
        className={`absolute inset-0 w-full h-full block ${getCanvasCursorClass()}`}
      />

      {/* Floating 3.5x Magnifying Loupe (Placed above finger touch point) */}
      {loupeVisible && (
        <div
          className="absolute pointer-events-none z-40 transition-transform -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${loupeScreenPos.x}px`,
            top: `${loupeScreenPos.y}px`,
          }}
        >
          <div className="relative">
            <canvas
              ref={loupeCanvasRef}
              width={124}
              height={124}
              className="rounded-full block bg-[#FBF7EF]"
            />
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#222725] text-[#FBF7EF] text-[10px] font-bold rounded-full whitespace-nowrap">
              3.5× 准星外沿对齐
            </div>
          </div>
        </div>
      )}

      {/* Bottom Floating 4-Edge Fine Nudge Controller */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 z-30 flex items-center justify-between pointer-events-none gap-2">
        {/* Helper text pill */}
        <div className="hidden md:flex items-center space-x-2 bg-[#222725]/85 backdrop-blur-md px-3 py-1.5 rounded-full text-xs text-[#E5DFD5] border border-white/10 pointer-events-auto">
          <span>{mode === 'click_find' ? '请在漫画内部点击，软件将自动重新寻找边框' : '拖动四边调整范围 · 拖动中心整体平移 · 拖动四角微调 · 双指/滚轮缩放'}</span>
        </div>

        {/* 4-Edge Nudge Stepper Pad */}
        <div className="ml-auto flex items-center space-x-1 bg-[#222725]/90 backdrop-blur-md p-1.5 rounded-2xl border border-white/15 pointer-events-auto">
          <span className="text-[11px] text-[#A09A90] font-medium px-1 hidden xs:inline">微调:</span>

          {/* Left Edge */}
          <div className="flex items-center bg-white/10 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => handleNudgeEdge('left', 2)}
              className="p-1.5 text-white hover:bg-white/20 rounded active:scale-90"
              title="左边外扩2px"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-[#E5DFD5] font-semibold px-0.5">左</span>
            <button
              type="button"
              onClick={() => handleNudgeEdge('left', -2)}
              className="p-1.5 text-white hover:bg-white/20 rounded active:scale-90"
              title="左边内收2px"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Top Edge */}
          <div className="flex items-center bg-white/10 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => handleNudgeEdge('top', 2)}
              className="p-1.5 text-white hover:bg-white/20 rounded active:scale-90"
              title="顶边外扩2px"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-[#E5DFD5] font-semibold px-0.5">顶</span>
            <button
              type="button"
              onClick={() => handleNudgeEdge('top', -2)}
              className="p-1.5 text-white hover:bg-white/20 rounded active:scale-90"
              title="顶边内收2px"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bottom Edge */}
          <div className="flex items-center bg-white/10 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => handleNudgeEdge('bottom', 2)}
              className="p-1.5 text-white hover:bg-white/20 rounded active:scale-90"
              title="底边外扩2px"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-[#E5DFD5] font-semibold px-0.5">底</span>
            <button
              type="button"
              onClick={() => handleNudgeEdge('bottom', -2)}
              className="p-1.5 text-white hover:bg-white/20 rounded active:scale-90"
              title="底边内收2px"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Right Edge */}
          <div className="flex items-center bg-white/10 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => handleNudgeEdge('right', -2)}
              className="p-1.5 text-white hover:bg-white/20 rounded active:scale-90"
              title="右边内收2px"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-[#E5DFD5] font-semibold px-0.5">右</span>
            <button
              type="button"
              onClick={() => handleNudgeEdge('right', 2)}
              className="p-1.5 text-white hover:bg-white/20 rounded active:scale-90"
              title="右边外扩2px"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
