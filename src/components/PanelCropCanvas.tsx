import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ComicPanel, Point, Quad } from '../types/comic';
import { autoSnapQuad, nudgeQuadEdge } from '../utils/imageProcessing';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Magnet,
  Move,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface PanelCropCanvasProps {
  imageElement: HTMLCanvasElement | HTMLImageElement | null;
  panels: ComicPanel[];
  activePanelId: string | null;
  onSelectPanel: (id: string) => void;
  onUpdatePanelQuad: (id: string, quad: Quad) => void;
  onAddPanelAtQuad?: (quad: Quad) => void;
}

type DragTarget =
  | { type: 'corner'; corner: keyof Quad }
  | { type: 'panel'; startPoint: Point; origQuad: Quad }
  | null;

export const PanelCropCanvas: React.FC<PanelCropCanvasProps> = ({
  imageElement,
  panels,
  activePanelId,
  onSelectPanel,
  onUpdatePanelQuad,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [dragging, setDragging] = useState<DragTarget>(null);
  const [hoveredCorner, setHoveredCorner] = useState<keyof Quad | null>(null);

  // Loupe state (3.5x magnifier)
  const [loupeVisible, setLoupeVisible] = useState(false);
  const [loupeCoord, setLoupeCoord] = useState<{ imgX: number; imgY: number; screenX: number; screenY: number }>({
    imgX: 0,
    imgY: 0,
    screenX: 0,
    screenY: 0,
  });

  const activePanel = panels.find((p) => p.id === activePanelId) || panels[0];

  // Canvas size state
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // Update canvas sizing based on container
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      setCanvasSize({ width: clientWidth, height: clientHeight });
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Fit image to screen initially
  useEffect(() => {
    if (!imageElement || canvasSize.width === 0 || canvasSize.height === 0) return;
    const imgW = 'naturalWidth' in imageElement ? imageElement.naturalWidth : imageElement.width;
    const imgH = 'naturalHeight' in imageElement ? imageElement.naturalHeight : imageElement.height;

    const scaleX = (canvasSize.width - 48) / imgW;
    const scaleY = (canvasSize.height - 48) / imgH;
    const fitScale = Math.min(scaleX, scaleY, 1.0);

    setScale(fitScale);
    setOffset({
      x: (canvasSize.width - imgW * fitScale) / 2,
      y: (canvasSize.height - imgH * fitScale) / 2,
    });
  }, [imageElement, canvasSize.width, canvasSize.height]);

  // Transform helpers
  const imgToScreen = useCallback(
    (pt: Point) => {
      if (!imageElement) return { x: 0, y: 0 };
      const imgW = 'naturalWidth' in imageElement ? imageElement.naturalWidth : imageElement.width;
      const imgH = 'naturalHeight' in imageElement ? imageElement.naturalHeight : imageElement.height;
      return {
        x: offset.x + pt.x * imgW * scale,
        y: offset.y + pt.y * imgH * scale,
      };
    },
    [offset, scale, imageElement]
  );

  const screenToImg = useCallback(
    (clientX: number, clientY: number): Point => {
      if (!imageElement || !canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;

      const imgW = 'naturalWidth' in imageElement ? imageElement.naturalWidth : imageElement.width;
      const imgH = 'naturalHeight' in imageElement ? imageElement.naturalHeight : imageElement.height;

      const px = (sx - offset.x) / (imgW * scale);
      const py = (sy - offset.y) / (imgH * scale);

      return {
        x: Math.max(0, Math.min(1, px)),
        y: Math.max(0, Math.min(1, py)),
      };
    },
    [offset, scale, imageElement]
  );

  // Render main canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageElement) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const imgW = 'naturalWidth' in imageElement ? imageElement.naturalWidth : imageElement.width;
    const imgH = 'naturalHeight' in imageElement ? imageElement.naturalHeight : imageElement.height;

    // Draw background image
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);
    ctx.drawImage(imageElement, 0, 0);
    ctx.restore();

    // Draw dark overlay outside panels (to highlight focus)
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Cut out panels from overlay
    panels.forEach((p) => {
      const p0 = imgToScreen(p.quad.topLeft);
      const p1 = imgToScreen(p.quad.topRight);
      const p2 = imgToScreen(p.quad.bottomRight);
      const p3 = imgToScreen(p.quad.bottomLeft);

      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();

    // Draw all panels
    panels.forEach((panel) => {
      const isActive = panel.id === activePanel?.id;
      const q = panel.quad;
      const p0 = imgToScreen(q.topLeft);
      const p1 = imgToScreen(q.topRight);
      const p2 = imgToScreen(q.bottomRight);
      const p3 = imgToScreen(q.bottomLeft);

      // Border outline
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.closePath();

      if (isActive) {
        ctx.strokeStyle = '#2563eb'; // Vibrant royal blue
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Subtle dash inner line
        ctx.strokeStyle = '#ffffff';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        ctx.strokeStyle = panel.isTitleBanner ? '#d97706' : 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();

      // Number badge at top-left of panel
      ctx.save();
      const badgeText = panel.isTitleBanner ? '标题页' : `第 ${panel.index} 格`;
      ctx.font = 'bold 12px "Noto Sans SC", sans-serif';
      const textW = ctx.measureText(badgeText).width;
      const bx = p0.x + 4;
      const by = p0.y + 4;

      ctx.fillStyle = isActive ? '#2563eb' : panel.isTitleBanner ? '#d97706' : 'rgba(30, 30, 30, 0.8)';
      ctx.beginPath();
      ctx.roundRect(bx, by, textW + 12, 20, 4);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, bx + 6, by + 10);
      ctx.restore();

      // If active, draw 4 corner handles
      if (isActive) {
        const corners: Array<{ key: keyof Quad; pt: { x: number; y: number } }> = [
          { key: 'topLeft', pt: p0 },
          { key: 'topRight', pt: p1 },
          { key: 'bottomRight', pt: p2 },
          { key: 'bottomLeft', pt: p3 },
        ];

        corners.forEach(({ key, pt }) => {
          const isHover = hoveredCorner === key;
          ctx.save();
          // Shadow
          ctx.shadowColor = 'rgba(0,0,0,0.3)';
          ctx.shadowBlur = 4;
          // Outer ring
          ctx.fillStyle = isHover ? '#f59e0b' : '#2563eb';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, isHover ? 8 : 6.5, 0, Math.PI * 2);
          ctx.fill();
          // Inner dot
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      }
    });
  }, [imageElement, panels, activePanel, offset, scale, hoveredCorner, imgToScreen]);

  useEffect(() => {
    render();
  }, [render]);

  // Update Loupe magnifier
  useEffect(() => {
    if (!loupeVisible || !loupeCanvasRef.current || !imageElement) return;
    const loupe = loupeCanvasRef.current;
    const lCtx = loupe.getContext('2d');
    if (!lCtx) return;

    const imgW = 'naturalWidth' in imageElement ? imageElement.naturalWidth : imageElement.width;
    const imgH = 'naturalHeight' in imageElement ? imageElement.naturalHeight : imageElement.height;

    const sourceX = loupeCoord.imgX * imgW;
    const sourceY = loupeCoord.imgY * imgH;

    const zoomFactor = 3.5;
    const viewW = loupe.width / zoomFactor;
    const viewH = loupe.height / zoomFactor;

    lCtx.clearRect(0, 0, loupe.width, loupe.height);
    lCtx.imageSmoothingEnabled = false; // Pixel-crisp view

    // Draw magnified image
    lCtx.drawImage(
      imageElement,
      sourceX - viewW / 2,
      sourceY - viewH / 2,
      viewW,
      viewH,
      0,
      0,
      loupe.width,
      loupe.height
    );

    // Crosshair in loupe center
    const cx = loupe.width / 2;
    const cy = loupe.height / 2;
    lCtx.strokeStyle = 'rgba(37, 99, 235, 0.85)';
    lCtx.lineWidth = 1.5;

    lCtx.beginPath();
    lCtx.moveTo(cx - 16, cy);
    lCtx.lineTo(cx + 16, cy);
    lCtx.moveTo(cx, cy - 16);
    lCtx.lineTo(cx, cy + 16);
    lCtx.stroke();

    // Center target ring
    lCtx.beginPath();
    lCtx.arc(cx, cy, 6, 0, Math.PI * 2);
    lCtx.stroke();
  }, [loupeVisible, loupeCoord, imageElement]);

  // Hit test corner
  const getCornerAtPos = (clientX: number, clientY: number): keyof Quad | null => {
    if (!activePanel || !canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;

    const corners: Array<keyof Quad> = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
    for (const k of corners) {
      const pt = imgToScreen(activePanel.quad[k]);
      if (Math.hypot(pt.x - sx, pt.y - sy) <= 15) {
        return k;
      }
    }
    return null;
  };

  // Mouse / Touch handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const corner = getCornerAtPos(e.clientX, e.clientY);
    if (corner && activePanel) {
      setDragging({ type: 'corner', corner });
      const imgPt = activePanel.quad[corner];
      setLoupeCoord({
        imgX: imgPt.x,
        imgY: imgPt.y,
        screenX: e.clientX,
        screenY: e.clientY,
      });
      setLoupeVisible(true);
      return;
    }

    // Check click on other panels
    const clickImgPt = screenToImg(e.clientX, e.clientY);
    for (let i = panels.length - 1; i >= 0; i--) {
      const p = panels[i];
      const q = p.quad;
      const minX = Math.min(q.topLeft.x, q.bottomLeft.x);
      const maxX = Math.max(q.topRight.x, q.bottomRight.x);
      const minY = Math.min(q.topLeft.y, q.topRight.y);
      const maxY = Math.max(q.bottomLeft.y, q.bottomRight.y);

      if (clickImgPt.x >= minX && clickImgPt.x <= maxX && clickImgPt.y >= minY && clickImgPt.y <= maxY) {
        onSelectPanel(p.id);
        setDragging({
          type: 'panel',
          startPoint: clickImgPt,
          origQuad: {
            topLeft: { ...q.topLeft },
            topRight: { ...q.topRight },
            bottomRight: { ...q.bottomRight },
            bottomLeft: { ...q.bottomLeft },
          },
        });
        return;
      }
    }

    // Otherwise Pan
    setIsPanning(true);
    setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging && !isPanning) {
      const c = getCornerAtPos(e.clientX, e.clientY);
      setHoveredCorner(c);
      return;
    }

    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (dragging?.type === 'corner' && activePanel) {
      const imgPt = screenToImg(e.clientX, e.clientY);
      const newQuad = {
        ...activePanel.quad,
        [dragging.corner]: imgPt,
      };
      onUpdatePanelQuad(activePanel.id, newQuad);

      setLoupeCoord({
        imgX: imgPt.x,
        imgY: imgPt.y,
        screenX: e.clientX,
        screenY: e.clientY,
      });
      setLoupeVisible(true);
    } else if (dragging?.type === 'panel' && activePanel) {
      const curImgPt = screenToImg(e.clientX, e.clientY);
      const dx = curImgPt.x - dragging.startPoint.x;
      const dy = curImgPt.y - dragging.startPoint.y;

      const q = dragging.origQuad;
      const newQuad: Quad = {
        topLeft: { x: Math.max(0, Math.min(1, q.topLeft.x + dx)), y: Math.max(0, Math.min(1, q.topLeft.y + dy)) },
        topRight: { x: Math.max(0, Math.min(1, q.topRight.x + dx)), y: Math.max(0, Math.min(1, q.topRight.y + dy)) },
        bottomRight: { x: Math.max(0, Math.min(1, q.bottomRight.x + dx)), y: Math.max(0, Math.min(1, q.bottomRight.y + dy)) },
        bottomLeft: { x: Math.max(0, Math.min(1, q.bottomLeft.x + dx)), y: Math.max(0, Math.min(1, q.bottomLeft.y + dy)) },
      };
      onUpdatePanelQuad(activePanel.id, newQuad);
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
    setIsPanning(false);
    setLoupeVisible(false);
  };

  // Zoom helpers
  const handleZoom = (factor: number) => {
    setScale((prev) => {
      const next = Math.max(0.2, Math.min(5.0, prev * factor));
      // Keep center fixed
      const cx = canvasSize.width / 2;
      const cy = canvasSize.height / 2;
      setOffset((off) => ({
        x: cx - (cx - off.x) * (next / prev),
        y: cy - (cy - off.y) * (next / prev),
      }));
      return next;
    });
  };

  const handleResetZoom = () => {
    if (!imageElement) return;
    const imgW = 'naturalWidth' in imageElement ? imageElement.naturalWidth : imageElement.width;
    const imgH = 'naturalHeight' in imageElement ? imageElement.naturalHeight : imageElement.height;
    const fitScale = Math.min((canvasSize.width - 48) / imgW, (canvasSize.height - 48) / imgH, 1.0);
    setScale(fitScale);
    setOffset({
      x: (canvasSize.width - imgW * fitScale) / 2,
      y: (canvasSize.height - imgH * fitScale) / 2,
    });
  };

  // Edge Nudge Handler
  const handleNudgeEdge = (edge: 'top' | 'bottom' | 'left' | 'right', deltaPx: number) => {
    if (!activePanel || !imageElement) return;
    const imgW = 'naturalWidth' in imageElement ? imageElement.naturalWidth : imageElement.width;
    const imgH = 'naturalHeight' in imageElement ? imageElement.naturalHeight : imageElement.height;

    const newQuad = nudgeQuadEdge(activePanel.quad, edge, deltaPx, imgW, imgH);
    onUpdatePanelQuad(activePanel.id, newQuad);
  };

  // Auto Snap Active Panel
  const handleAutoSnapActive = () => {
    if (!activePanel || !imageElement) return;
    let canvas: HTMLCanvasElement;
    if (imageElement instanceof HTMLCanvasElement) {
      canvas = imageElement;
    } else {
      canvas = document.createElement('canvas');
      canvas.width = imageElement.naturalWidth;
      canvas.height = imageElement.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(imageElement, 0, 0);
    }

    const snapped = autoSnapQuad(canvas, activePanel.quad, 16);
    onUpdatePanelQuad(activePanel.id, snapped);
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#1c1a19] rounded-xl overflow-hidden border border-[#383330]">
      {/* Top Floating Toolbar */}
      <div className="absolute top-3 left-3 z-30 flex items-center space-x-1.5 bg-[#2a2624]/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-[#48423e] text-xs text-[#eae5df]">
        <span className="font-semibold text-[#f59e0b]">
          {activePanel?.isTitleBanner ? '顶部标题' : `第 ${activePanel?.index} 格`}
        </span>
        <span className="text-[#888]">|</span>
        <span className="text-[#ccc]">拖拽四角或使用微调按钮精确贴合黑框</span>
      </div>

      {/* Top Right Zoom Controls */}
      <div className="absolute top-3 right-3 z-30 flex items-center space-x-1 bg-[#2a2624]/90 backdrop-blur-md p-1 rounded-lg border border-[#48423e]">
        <button
          id="btn-canvas-zoom-in"
          onClick={() => handleZoom(1.25)}
          className="p-1.5 hover:bg-[#3d3734] rounded text-white transition-colors cursor-pointer"
          title="放大画面"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          id="btn-canvas-zoom-out"
          onClick={() => handleZoom(0.8)}
          className="p-1.5 hover:bg-[#3d3734] rounded text-white transition-colors cursor-pointer"
          title="缩小画面"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          id="btn-canvas-zoom-reset"
          onClick={handleResetZoom}
          className="p-1.5 hover:bg-[#3d3734] rounded text-white transition-colors cursor-pointer"
          title="重置居中"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Main Canvas Area */}
      <div
        ref={containerRef}
        className={`relative flex-1 w-full h-full overflow-hidden ${
          hoveredCorner ? 'cursor-crosshair' : dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="w-full h-full block"
        />

        {/* Floating Magnifier Loupe (3.5x Zoom) */}
        {loupeVisible && (
          <div
            className="pointer-events-none fixed z-50 overflow-hidden rounded-full border-3 border-amber-400 bg-black"
            style={{
              width: 140,
              height: 140,
              left: Math.max(20, Math.min(window.innerWidth - 160, loupeCoord.screenX - 70)),
              top: Math.max(20, loupeCoord.screenY - 160),
            }}
          >
            <canvas ref={loupeCanvasRef} width={140} height={140} className="w-full h-full block" />
            <div className="absolute bottom-1.5 left-0 right-0 text-center text-[10px] font-bold text-amber-300">
              3.5x 局部放大
            </div>
          </div>
        )}
      </div>

      {/* Bottom Edge Fine-Tuning Bar */}
      <div className="bg-[#24201e] border-t border-[#3a3532] px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#eae5df]">
        <div className="flex items-center space-x-2">
          <button
            id="btn-auto-snap-edge"
            onClick={handleAutoSnapActive}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-md font-medium transition-colors cursor-pointer"
            title="通过边缘梯度算法自动吸附当前格的4条黑框"
          >
            <Magnet className="w-3.5 h-3.5" />
            <span>智能吸附黑框边缘</span>
          </button>

          <span className="text-[#666] hidden sm:inline">|</span>

          {/* 4 Edges pixel nudges */}
          <div className="flex items-center space-x-2 text-[11px]">
            <span className="text-[#a89f91]">微调边框:</span>

            {/* Top */}
            <div className="flex items-center bg-[#1a1817] px-1.5 py-0.5 rounded border border-[#3e3935]">
              <span className="text-[#888] mr-1">上</span>
              <button
                onClick={() => handleNudgeEdge('top', 1)}
                className="px-1 py-0.5 hover:bg-[#332f2c] text-[#ffc83b] rounded cursor-pointer"
                title="向上扩展1像素"
              >
                +1
              </button>
              <button
                onClick={() => handleNudgeEdge('top', -1)}
                className="px-1 py-0.5 hover:bg-[#332f2c] text-[#ccc] rounded cursor-pointer"
                title="向下收缩1像素"
              >
                -1
              </button>
            </div>

            {/* Bottom */}
            <div className="flex items-center bg-[#1a1817] px-1.5 py-0.5 rounded border border-[#3e3935]">
              <span className="text-[#888] mr-1">下</span>
              <button
                onClick={() => handleNudgeEdge('bottom', 1)}
                className="px-1 py-0.5 hover:bg-[#332f2c] text-[#ffc83b] rounded cursor-pointer"
                title="向下扩展1像素"
              >
                +1
              </button>
              <button
                onClick={() => handleNudgeEdge('bottom', -1)}
                className="px-1 py-0.5 hover:bg-[#332f2c] text-[#ccc] rounded cursor-pointer"
                title="向上收缩1像素"
              >
                -1
              </button>
            </div>

            {/* Left */}
            <div className="flex items-center bg-[#1a1817] px-1.5 py-0.5 rounded border border-[#3e3935]">
              <span className="text-[#888] mr-1">左</span>
              <button
                onClick={() => handleNudgeEdge('left', 1)}
                className="px-1 py-0.5 hover:bg-[#332f2c] text-[#ffc83b] rounded cursor-pointer"
                title="向左扩展1像素"
              >
                +1
              </button>
              <button
                onClick={() => handleNudgeEdge('left', -1)}
                className="px-1 py-0.5 hover:bg-[#332f2c] text-[#ccc] rounded cursor-pointer"
                title="向右收缩1像素"
              >
                -1
              </button>
            </div>

            {/* Right */}
            <div className="flex items-center bg-[#1a1817] px-1.5 py-0.5 rounded border border-[#3e3935]">
              <span className="text-[#888] mr-1">右</span>
              <button
                onClick={() => handleNudgeEdge('right', 1)}
                className="px-1 py-0.5 hover:bg-[#332f2c] text-[#ffc83b] rounded cursor-pointer"
                title="向右扩展1像素"
              >
                +1
              </button>
              <button
                onClick={() => handleNudgeEdge('right', -1)}
                className="px-1 py-0.5 hover:bg-[#332f2c] text-[#ccc] rounded cursor-pointer"
                title="向左收缩1像素"
              >
                -1
              </button>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-[#8e857b] hidden md:block">
          贴心提示：双击空白处可取消选中，按住画面可平移画布
        </div>
      </div>
    </div>
  );
};
