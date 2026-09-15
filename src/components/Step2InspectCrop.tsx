import React, { useState, useEffect, useRef } from 'react';
import { ComicPanel, Quad, TypesetSettings } from '../types/comic';
import { PrecisionCropCanvas } from './PrecisionCropCanvas';
import { renderTypesetCard } from '../utils/paperTexture';
import {
  ArrowLeft,
  Maximize2,
  Plus,
  Trash2,
  AlertTriangle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  RotateCcw,
  Sliders,
  Copy,
  Layers,
  Move,
  Check,
} from 'lucide-react';

interface Step2InspectCropProps {
  imageElement: HTMLCanvasElement | HTMLImageElement | null;
  rawImageCanvas: HTMLCanvasElement | null;
  panels: ComicPanel[];
  activePanelId: string | null;
  settings: TypesetSettings;
  onSelectPanel: (id: string) => void;
  onUpdatePanelQuad: (id: string, quad: Quad) => void;
  onUpdatePanelTypography?: (
    id: string,
    updates: {
      customFontSize?: number;
      customYOffset?: number;
      customXOffset?: number;
      customAlign?: 'auto' | 'left' | 'center' | 'right' | 'split';
      customGap?: number;
      comicScale?: number;
      comicOffsetX?: number;
      comicOffsetY?: number;
      colorAdjustments?: {
        brightness: number;
        contrast: number;
        saturation: number;
      };
      blendMode?: 'normal' | 'multiply' | 'plus-darker';
    },
    applyToAll?: boolean
  ) => void;
  onAddPanel: () => void;
  onDeletePanel: (id: string) => void;
  onToggleNeedsReview: (id: string) => void;
  onAutoSnapAllPanels: () => void;
  onGoToStep3: () => void;
  onBackToStep1: () => void;
}

export const Step2InspectCrop: React.FC<Step2InspectCropProps> = ({
  imageElement,
  rawImageCanvas,
  panels,
  activePanelId,
  settings,
  onSelectPanel,
  onUpdatePanelQuad,
  onUpdatePanelTypography,
  onAddPanel,
  onDeletePanel,
  onToggleNeedsReview,
  onAutoSnapAllPanels,
  onGoToStep3,
  onBackToStep1,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rightTab, setRightTab] = useState<'color' | 'layout'>('color');
  const [applyFeedback, setApplyFeedback] = useState<string | null>(null);
  const [renderCounter, setRenderCounter] = useState(0);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const activePanel = panels.find((p) => p.id === activePanelId) || panels[0];
  const activeIndex = panels.findIndex((p) => p.id === activePanel?.id);

  const handlePrev = () => {
    if (activeIndex > 0) {
      onSelectPanel(panels[activeIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (activeIndex < panels.length - 1) {
      onSelectPanel(panels[activeIndex + 1].id);
    }
  };

  // Color adjustments and blend mode for current panel
  const colorAdjustments = activePanel?.colorAdjustments || {
    brightness: 100,
    contrast: 100,
    saturation: 100,
  };
  const currentBlendMode = activePanel?.blendMode || 'plus-darker';

  // Comic transform inside paper for current panel
  const comicScale = activePanel?.comicScale ?? 1.0;
  const comicOffsetY = activePanel?.comicOffsetY ?? 0;

  // Render 3:4 typeset preview card
  useEffect(() => {
    if (!previewCanvasRef.current || !activePanel) return;

    let isMounted = true;
    const canvas = previewCanvasRef.current;
    const W = 810;
    const H = 1080;

    const rendered = renderTypesetCard(
      activePanel,
      panels.length,
      settings,
      W,
      H,
      () => {
        if (isMounted) {
          setRenderCounter((c) => c + 1);
        }
      }
    );

    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(rendered, 0, 0);
    }

    return () => {
      isMounted = false;
    };
  }, [
    activePanel?.id,
    activePanel?.cachedCroppedUrl,
    activePanel?.quad,
    activePanel?.colorAdjustments?.brightness,
    activePanel?.colorAdjustments?.contrast,
    activePanel?.colorAdjustments?.saturation,
    activePanel?.blendMode,
    activePanel?.comicScale,
    activePanel?.comicOffsetX,
    activePanel?.comicOffsetY,
    activePanel?.translatedTextCombined,
    activePanel?.speechBubbles,
    activePanel?.customFontSize,
    activePanel?.customYOffset,
    activePanel?.customXOffset,
    activePanel?.customGap,
    activePanel?.customAlign,
    panels.length,
    settings,
    renderCounter,
  ]);

  // Color slider change handler
  const handleColorChange = (key: 'brightness' | 'contrast' | 'saturation', val: number) => {
    if (!activePanel || !onUpdatePanelTypography) return;
    onUpdatePanelTypography(activePanel.id, {
      colorAdjustments: {
        ...colorAdjustments,
        [key]: val,
      },
    });
  };

  // Blend mode change handler
  const handleBlendModeChange = (mode: 'normal' | 'multiply' | 'plus-darker') => {
    if (!activePanel || !onUpdatePanelTypography) return;
    onUpdatePanelTypography(activePanel.id, {
      blendMode: mode,
    });
  };

  // Reset colors & blend mode to default
  const handleResetColors = () => {
    if (!activePanel || !onUpdatePanelTypography) return;
    onUpdatePanelTypography(activePanel.id, {
      colorAdjustments: {
        brightness: 100,
        contrast: 100,
        saturation: 100,
      },
      blendMode: 'plus-darker',
    });
    setApplyFeedback('已恢复默认调色与混合');
    setTimeout(() => setApplyFeedback(null), 2500);
  };

  // Apply color and blend mode to ALL panels
  const handleApplyColorsToAll = () => {
    if (!activePanel || !onUpdatePanelTypography) return;
    onUpdatePanelTypography(
      activePanel.id,
      {
        colorAdjustments: { ...colorAdjustments },
        blendMode: currentBlendMode,
      },
      true // applyToAll: true, only copies color and blendMode
    );
    setApplyFeedback('已将调色与混合应用到全部漫画');
    setTimeout(() => setApplyFeedback(null), 2500);
  };

  // Comic scale & position handlers
  const handleScaleChange = (scale: number) => {
    if (!activePanel || !onUpdatePanelTypography) return;
    onUpdatePanelTypography(activePanel.id, { comicScale: scale });
  };

  const handleOffsetYChange = (oy: number) => {
    if (!activePanel || !onUpdatePanelTypography) return;
    onUpdatePanelTypography(activePanel.id, { comicOffsetY: oy });
  };

  const handleResetComicLayout = () => {
    if (!activePanel || !onUpdatePanelTypography) return;
    onUpdatePanelTypography(activePanel.id, {
      comicScale: 1.0,
      comicOffsetX: 0,
      comicOffsetY: 0,
    });
  };

  const diag = activePanel?.borderDiagnostics;
  const edges = diag?.edges;

  const renderThumbnailsContent = () => (
    <>
      <div className="flex items-center justify-between text-xs text-[#75716B] mb-2 px-0.5">
        <div className="flex items-center space-x-1.5 font-medium text-[#222725]">
          <span>画格列表</span>
          <span className="text-[#A09A90] text-[11px]">({panels.length} 格)</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onAddPanel}
            className="text-[#222725] hover:text-[#8F3E2E] flex items-center space-x-1 cursor-pointer text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>补画一格</span>
          </button>
          {panels.length > 1 && activePanel && (
            <button
              type="button"
              onClick={() => onDeletePanel(activePanel.id)}
              className="text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-0.5 rounded-md flex items-center space-x-1 cursor-pointer ml-1 text-xs font-medium transition-colors"
              title="删除当前选中的格"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
              <span>删除</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2.5 overflow-x-auto py-1 px-0.5 scrollbar-thin">
        {panels.map((p) => {
          const isSelected = p.id === activePanel?.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectPanel(p.id)}
              className={`relative shrink-0 w-16 h-20 sm:w-20 sm:h-24 rounded-xl overflow-hidden border-2 transition-all cursor-pointer bg-[#EAE4D5] flex flex-col items-center justify-center ${
                isSelected
                  ? 'border-[#222725] ring-2 ring-[#222725]/15'
                  : 'border-transparent opacity-70 hover:opacity-100 hover:border-[#D5CEBF]'
              }`}
            >
              {p.cachedCroppedUrl ? (
                <img
                  src={p.cachedCroppedUrl}
                  alt={`Panel ${p.index}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-[10px] text-[#75716B]">正在裁切...</div>
              )}

              {/* Index badge */}
              <div
                className={`absolute top-1 left-1 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isSelected ? 'bg-[#222725] text-white' : 'bg-black/60 text-white'
                }`}
              >
                {p.isTitleBanner ? '0' : p.index}
              </div>

              {p.needsReview && (
                <div
                  className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-amber-500 flex items-center justify-center text-white text-[9px] font-bold"
                  title="待人工核对"
                >
                  !
                </div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="flex-1 flex flex-col justify-between max-w-7xl mx-auto w-full px-3 sm:px-6 pt-20 pb-28">
      {/* Top Bar: Back & Global Actions */}
      <div className="flex items-center justify-between py-2 border-b border-[#EAE3D2] text-xs sm:text-sm">
        <button
          type="button"
          onClick={onBackToStep1}
          className="text-[#75716B] hover:text-[#222725] font-medium flex items-center space-x-1 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回上传</span>
        </button>

        <div className="flex items-center space-x-2">
          <span className="font-bold text-[#222725]">
            {activePanel?.isTitleBanner ? '顶部标题页' : `第 ${activePanel?.index || 1} 格`}
          </span>
          <span className="text-[#A09A90]">/ 共 {panels.length} 格</span>

          {activePanel && (
            <button
              type="button"
              onClick={() => onToggleNeedsReview(activePanel.id)}
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer flex items-center space-x-1 ${
                activePanel.needsReview
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-[#F2ECE0] text-[#75716B] hover:text-[#222725]'
              }`}
              title="标记此格边框是否有残损或待人工核对"
            >
              <AlertTriangle className="w-3 h-3" />
              <span>{activePanel.needsReview ? '待核对' : '标为待核对'}</span>
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onAutoSnapAllPanels}
            className="flex items-center space-x-1 px-3 py-1 text-xs font-medium text-[#222725] bg-[#F2ECE0] hover:bg-[#EAE1D0] rounded-full cursor-pointer transition-all"
            title="对所有格子自动沿外沿黑框拟合"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#8F3E2E]" />
            <span className="hidden sm:inline">全格拟合</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(true)}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-[#222725] bg-[#F2ECE0] hover:bg-[#EAE1D0] rounded-full cursor-pointer transition-all"
            title="展开全屏高精裁切画布"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">全屏</span>
          </button>
        </div>
      </div>


      {/* Main Split-Pane Workspace: Left 60% (Crop Canvas + Thumbnails) / Right 40% (Paper Preview & Controls) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 my-1 items-stretch">
        {/* Left Column (~60%): Upper Crop Adjustment + Lower Thumbnails Strip */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-3 min-h-0">
          {/* Upper: Raw Newspaper Crop Canvas */}
          <div className="flex-1 min-h-[320px] bg-[#1C1917] rounded-2xl border border-[#E3DCC8] overflow-hidden relative flex flex-col">
            {/* Interactive Precision Crop Canvas */}
            <div className="flex-1 w-full h-full relative overflow-hidden min-h-0">
              {activePanel && (
                <PrecisionCropCanvas
                  imageElement={imageElement}
                  rawImageCanvas={rawImageCanvas}
                  panel={activePanel}
                  onUpdateQuad={(q) => onUpdatePanelQuad(activePanel.id, q)}
                  isModal={false}
                />
              )}

              {/* Quick Prev / Next overlay navigation buttons */}
              <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-auto z-20">
                <button
                  type="button"
                  disabled={activeIndex <= 0}
                  onClick={handlePrev}
                  className="w-8 h-8 rounded-full bg-[#222725]/85 hover:bg-[#222725] text-white flex items-center justify-center disabled:opacity-20 transition-all cursor-pointer"
                  title="上一格"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-auto z-20">
                <button
                  type="button"
                  disabled={activeIndex >= panels.length - 1}
                  onClick={handleNext}
                  className="w-8 h-8 rounded-full bg-[#222725]/85 hover:bg-[#222725] text-white flex items-center justify-center disabled:opacity-20 transition-all cursor-pointer"
                  title="下一格"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Lower: Thumbnails Strip (Desktop: positioned in left column bottom, bottom edge aligns with right column card) */}
          <div className="hidden lg:flex flex-col bg-[#FAF6EE] rounded-2xl border border-[#E3DCC8] p-3 shrink-0">
            {renderThumbnailsContent()}
          </div>
        </div>

        {/* Right Column (~40%): 3:4 Paper Preview & Color / Blend Controls */}
        <div className="lg:col-span-5 flex flex-col bg-[#FAF6EE] rounded-2xl border border-[#E3DCC8] p-3.5">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[#EAE3D2] text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-[#222725]">纸张效果预览</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#8F3E2E]/10 text-[#8F3E2E] text-[10px] font-semibold">
                3:4 纸张
              </span>
            </div>
            <span className="text-[11px] text-[#A09A90]">实时同步</span>
          </div>

          {/* 3:4 Paper Preview Stage */}
          <div className="my-2 flex items-center justify-center">
            <div className="relative aspect-[3/4] w-full max-w-[260px] sm:max-w-[290px] max-h-[310px] rounded-xl overflow-hidden border border-[#222725]/15 bg-[#F3EDE2]">
              <canvas
                ref={previewCanvasRef}
                className="w-full h-full object-contain block"
              />
            </div>
          </div>

          {/* Control Panel Below Preview - Flattened Hierarchy */}
          <div className="mt-2 pt-2.5 border-t border-[#EAE3D2] flex-1 flex flex-col justify-between">
            {/* Tabs: 调色与混合 vs 纸张位置微调 */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center space-x-1 bg-[#EDE7DA] p-0.5 rounded-lg border border-[#DDD5C3]">
                <button
                  type="button"
                  onClick={() => setRightTab('color')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center space-x-1 ${
                    rightTab === 'color'
                      ? 'bg-[#222725] text-white'
                      : 'text-[#75716B] hover:text-[#222725]'
                  }`}
                >
                  <Sliders className="w-3 h-3" />
                  <span>调色与融纸</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab('layout')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center space-x-1 ${
                    rightTab === 'layout'
                      ? 'bg-[#222725] text-white'
                      : 'text-[#75716B] hover:text-[#222725]'
                  }`}
                >
                  <Move className="w-3 h-3" />
                  <span>纸上微调</span>
                </button>
              </div>

              {/* Feedback toast */}
              {applyFeedback && (
                <div className="text-[11px] font-medium text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-300 animate-fade-in flex items-center space-x-1">
                  <Check className="w-3 h-3" />
                  <span>{applyFeedback}</span>
                </div>
              )}
            </div>

            {/* TAB 1: Color Adjustments and Blend Mode */}
            {rightTab === 'color' && (
              <div className="space-y-2.5 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  {/* Blend Mode Dropdown */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-[#555] mb-1 font-medium">
                      <span className="flex items-center space-x-1">
                        <Layers className="w-3 h-3 text-[#222725]" />
                        <span>混合融纸</span>
                      </span>
                    </div>
                    <div className="relative">
                      <select
                        value={currentBlendMode}
                        onChange={(e) => handleBlendModeChange(e.target.value as any)}
                        className="w-full appearance-none bg-[#FAF6EE] border border-[#D5CEBF] rounded-lg pl-2.5 pr-8 py-1.5 text-xs text-[#222725] font-medium focus:outline-none focus:ring-1 focus:ring-[#222725] cursor-pointer transition-colors"
                      >
                        <option value="plus-darker">Plus darker（推荐融纸）</option>
                        <option value="multiply">Multiply（正片叠底）</option>
                        <option value="normal">Normal（正常）</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-[#75716B] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Brightness Slider */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-[#666] mb-0.5">
                      <span>亮度</span>
                      <span className="font-mono text-[#222725] font-medium text-[11px]">
                        {colorAdjustments.brightness}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={50}
                      max={150}
                      step={1}
                      value={colorAdjustments.brightness}
                      onChange={(e) => handleColorChange('brightness', Number(e.target.value))}
                      className="w-full accent-[#222725] cursor-pointer h-1 bg-[#E2DBD0] rounded-lg"
                    />
                  </div>

                  {/* Contrast Slider */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-[#666] mb-0.5">
                      <span>对比度</span>
                      <span className="font-mono text-[#222725] font-medium text-[11px]">
                        {colorAdjustments.contrast}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={50}
                      max={150}
                      step={1}
                      value={colorAdjustments.contrast}
                      onChange={(e) => handleColorChange('contrast', Number(e.target.value))}
                      className="w-full accent-[#222725] cursor-pointer h-1 bg-[#E2DBD0] rounded-lg"
                    />
                  </div>

                  {/* Saturation Slider */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-[#666] mb-0.5">
                      <span>饱和度</span>
                      <span className="font-mono text-[#222725] font-medium text-[11px]">
                        {colorAdjustments.saturation}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={200}
                      step={1}
                      value={colorAdjustments.saturation}
                      onChange={(e) => handleColorChange('saturation', Number(e.target.value))}
                      className="w-full accent-[#222725] cursor-pointer h-1 bg-[#E2DBD0] rounded-lg"
                    />
                  </div>
                </div>

                {/* Reset & Apply to All buttons */}
                <div className="pt-2 border-t border-[#EAE3D2] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleResetColors}
                    className="flex items-center space-x-1 px-2 py-1 text-xs text-[#75716B] hover:text-[#222725] hover:bg-[#F2ECE0] rounded-md transition-colors cursor-pointer"
                    title="重置当前格调色与混合"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>恢复默认</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyColorsToAll}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-[#8F3E2E] hover:bg-[#7A3426] text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all cursor-pointer"
                    title="仅复制调色与混合模式，不影响各格裁切、排版位置与译文"
                  >
                    <Copy className="w-3 h-3" />
                    <span>应用到全部画格</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: Comic Artwork Transform on Paper */}
            {rightTab === 'layout' && (
              <div className="space-y-2.5 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="text-[11px] text-[#858075]">
                    微调漫画在纸张上的等比大小与位置，不改变原图裁切坐标。
                  </div>

                  {/* Scale */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-[#666] mb-0.5">
                      <span>漫画大小</span>
                      <span className="font-mono text-[#222725] font-medium text-[11px]">
                        {Math.round(comicScale * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={2.0}
                      step={0.05}
                      value={comicScale}
                      onChange={(e) => handleScaleChange(Number(e.target.value))}
                      className="w-full accent-[#222725] cursor-pointer h-1 bg-[#E2DBD0] rounded-lg"
                    />
                  </div>

                  {/* Vertical Offset Y */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-[#666] mb-0.5">
                      <span>垂直位移 (Y)</span>
                      <span className="font-mono text-[#222725] font-medium text-[11px]">
                        {comicOffsetY > 0 ? `+${comicOffsetY}px` : `${comicOffsetY}px`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-200}
                      max={200}
                      step={2}
                      value={comicOffsetY}
                      onChange={(e) => handleOffsetYChange(Number(e.target.value))}
                      className="w-full accent-[#222725] cursor-pointer h-1 bg-[#E2DBD0] rounded-lg"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-[#EAE3D2] flex justify-end">
                  <button
                    type="button"
                    onClick={handleResetComicLayout}
                    className="flex items-center space-x-1 px-2.5 py-1 text-xs text-[#75716B] hover:text-[#222725] hover:bg-[#F2ECE0] rounded-lg transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>重置位置与大小</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile-only Thumbnails Strip (Preserves original mobile layout below the two cards) */}
      <div className="block lg:hidden space-y-1.5 mt-2 bg-[#FAF6EE] rounded-2xl border border-[#E3DCC8] p-3">
        {renderThumbnailsContent()}
      </div>

      {/* Fullscreen Crop Modal Overlay if expanded */}
      {isFullscreen && activePanel && (
        <div className="fixed inset-0 z-50 bg-[#1C1917] flex flex-col animate-in fade-in duration-200">
          <PrecisionCropCanvas
            imageElement={imageElement}
            rawImageCanvas={rawImageCanvas}
            panel={activePanel}
            onUpdateQuad={(q) => onUpdatePanelQuad(activePanel.id, q)}
            onClose={() => setIsFullscreen(false)}
            isModal={true}
          />
        </div>
      )}

      {/* Sticky Bottom Primary Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#FBF7EF]/90 backdrop-blur-md border-t border-[#EAE3D2] z-30 flex justify-center pb-safe">
        <div className="max-w-md w-full flex items-center space-x-3">
          <button
            type="button"
            onClick={onBackToStep1}
            className="text-sm font-medium text-[#75716B] hover:text-[#222725] px-3 py-2 cursor-pointer transition-colors"
          >
            返回
          </button>

          <button
            id="btn-confirm-crop"
            type="button"
            onClick={onGoToStep3}
            className="flex-1 h-13 rounded-full bg-[#222725] hover:bg-[#151817] active:scale-98 text-[#FBF7EF] font-bold text-base flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <span>确认裁切 →</span>
          </button>
        </div>
      </div>
    </div>
  );
};
