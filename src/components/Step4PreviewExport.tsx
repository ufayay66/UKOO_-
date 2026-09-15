import React, { useState, useEffect, useRef } from 'react';
import { ComicPanel, TypesetSettings } from '../types/comic';
import { renderTypesetCard } from '../utils/paperTexture';
import { downloadSinglePanelPNG, downloadAllPanelsZIP } from '../utils/exportZip';
import { ThumbnailCard } from './ThumbnailCard';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileArchive,
  Sliders,
  Sparkles,
  ArrowLeft,
  X,
  Check,
  Palette,
  Type,
  Layers,
  Image as ImageIcon,
} from 'lucide-react';

interface Step4PreviewExportProps {
  panels: ComicPanel[];
  settings: TypesetSettings;
  onUpdateSettings: (newSettings: Partial<TypesetSettings>) => void;
  onBackToStep3: () => void;
}

export const Step4PreviewExport: React.FC<Step4PreviewExportProps> = ({
  panels,
  settings,
  onUpdateSettings,
  onBackToStep3,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ percent: number; status: string } | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const currentPanel = panels[currentIndex] || panels[0];

  // Render current card preview on canvas
  useEffect(() => {
    if (!currentPanel || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;

    // Render at crisp 1080x1440
    const rendered = renderTypesetCard(currentPanel, panels.length, settings, 1080, 1440);

    canvas.width = 1080;
    canvas.height = 1440;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(rendered, 0, 0);
    }
  }, [currentPanel, panels.length, settings]);

  // Thumbnail container ref & auto-scroll into view when currentIndex changes
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!thumbnailContainerRef.current || !panels[currentIndex]?.id) return;
    const container = thumbnailContainerRef.current;
    const activeEl = container.querySelector<HTMLElement>(`[data-panel-id="${panels[currentIndex].id}"]`);
    if (activeEl) {
      const containerLeft = container.scrollLeft;
      const containerWidth = container.clientWidth;
      const elLeft = activeEl.offsetLeft;
      const elWidth = activeEl.offsetWidth;

      if (elLeft < containerLeft) {
        container.scrollTo({ left: Math.max(0, elLeft - 24), behavior: 'smooth' });
      } else if (elLeft + elWidth > containerLeft + containerWidth) {
        container.scrollTo({ left: elLeft + elWidth - containerWidth + 24, behavior: 'smooth' });
      }
    }
  }, [currentIndex, panels]);

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const handleNext = () => {
    if (currentIndex < panels.length - 1) setCurrentIndex(currentIndex + 1);
  };

  // Download single PNG
  const handleDownloadCurrentPNG = async () => {
    if (!currentPanel) return;
    try {
      setIsExporting(true);
      await downloadSinglePanelPNG(currentPanel, panels.length, settings, settings.resolution);
    } catch (e: any) {
      alert('导出图片失败: ' + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Download batch ZIP
  const handleDownloadAllZIP = async (includeRaw: boolean = false) => {
    try {
      setIsExporting(true);
      await downloadAllPanelsZIP(panels, settings, settings.resolution, {
        includeRawCrops: includeRaw,
        includeProjectJson: true,
        onProgress: (percent, status) => {
          setExportProgress({ percent, status });
        },
      });
    } catch (e: any) {
      alert('导出 ZIP 失败: ' + e.message);
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between max-w-4xl mx-auto w-full px-4 sm:px-6 py-4 pb-32">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between py-2 border-b border-[#EAE3D2] text-xs sm:text-sm">
        <button
          type="button"
          onClick={onBackToStep3}
          className="text-[#75716B] hover:text-[#222725] font-medium flex items-center space-x-1 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>上一步: 译文</span>
        </button>

        {/* Page Switcher Indicator */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            disabled={currentIndex <= 0}
            onClick={handlePrev}
            className="p-1 text-[#75716B] hover:text-[#222725] disabled:opacity-30 cursor-pointer"
            title="上一张"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="font-bold text-[#222725] text-sm sm:text-base">
            第 {currentIndex + 1} 页
          </span>
          <span className="text-[#A09A90] text-sm sm:text-base">/ 共 {panels.length} 页</span>

          <button
            type="button"
            disabled={currentIndex >= panels.length - 1}
            onClick={handleNext}
            className="p-1 text-[#75716B] hover:text-[#222725] disabled:opacity-30 cursor-pointer"
            title="下一张"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Style & Paper Settings Drawer Button */}
        <button
          type="button"
          onClick={() => setShowSettingsDrawer(true)}
          className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-[#222725] bg-[#F2ECE0] hover:bg-[#EAE1D0] rounded-full cursor-pointer transition-all border border-[#DFD5C2]"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>纸张与排版</span>
        </button>
      </div>

      {/* Main Center Stage: The 3:4 Finished Card Spotlight */}
      <div className="flex-1 my-3 flex flex-col items-center justify-center relative min-h-[420px] sm:min-h-[500px]">
        {/* Card Shadow and Container */}
        <div className="relative w-full max-w-[340px] sm:max-w-[380px] aspect-[3/4] rounded-2xl overflow-hidden border border-[#D8D0BE] bg-[#FBF7EF] flex items-center justify-center transition-all">
          <canvas
            ref={previewCanvasRef}
            className="w-full h-full object-contain block select-none"
          />

          {/* Quick Page Flipping Floating Overlay Controls on Mobile */}
          <button
            type="button"
            disabled={currentIndex <= 0}
            onClick={handlePrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center disabled:opacity-0 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            type="button"
            disabled={currentIndex >= panels.length - 1}
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center disabled:opacity-0 transition-all cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Finished Artworks Thumbnail Strip (完整成品缩略图：紧接大预览下方，整体居中，超出可用宽度后单排横向滚动) */}
        <div
          ref={thumbnailContainerRef}
          className="w-full max-w-full overflow-x-auto overflow-y-hidden mt-4 py-2 px-2 scrollbar-thin touch-pan-x"
        >
          <div className="flex items-center space-x-3 w-max mx-auto py-0.5">
            {panels.map((p, idx) => (
              <ThumbnailCard
                key={p.id}
                panel={p}
                index={idx}
                totalPanels={panels.length}
                isActive={currentIndex === idx}
                settings={settings}
                onClick={() => setCurrentIndex(idx)}
                label={p.isTitleBanner ? '标题页' : `第 ${idx + 1} 页`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Settings Bottom Sheet Drawer (Mobile & Desktop) */}
      {showSettingsDrawer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end animate-in fade-in">
          <div
            className="bg-[#FBF7EF] rounded-t-3xl max-w-lg w-full mx-auto p-5 pb-8 border-t border-[#EAE3D2] max-h-[80vh] overflow-y-auto space-y-5 animate-in slide-in-from-bottom-8 duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE3D2]">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-[#222725]" />
                <h3 className="font-bold text-base text-[#222725]">排版与纸张风格</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsDrawer(false)}
                className="p-1 rounded-full text-[#75716B] hover:text-[#222725] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. Paper Background Style */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#222725] block">纸张底色风格</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'warm_cream', name: '暖白米纸', color: '#FBF7EF' },
                  { id: 'newsprint', name: '复古新闻纸', color: '#EBE5D8' },
                  { id: 'pure_white', name: '极简白', color: '#FFFFFF' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onUpdateSettings({ paperStyle: s.id as any })}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 cursor-pointer transition-all ${
                      settings.paperStyle === s.id
                        ? 'border-[#222725] bg-[#222725] text-white'
                        : 'border-[#DFD5C2] bg-white text-[#222725]'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-black/20"
                      style={{ backgroundColor: s.color }}
                    />
                    <span>{s.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Paper Texture Intensity */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#222725] block">纸质噪点与网点纹理</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'none', label: '无纹理' },
                  { id: 'subtle', label: '细腻轻柔' },
                  { id: 'authentic', label: '真实纸纹' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onUpdateSettings({ textureIntensity: t.id as any })}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                      settings.textureIntensity === t.id
                        ? 'border-[#222725] bg-[#222725] text-white'
                        : 'border-[#DFD5C2] bg-white text-[#222725]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Top Translated Text Color */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#222725] block">上方译文字体颜色</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: '#8F3E2E', name: '报纸红棕', color: '#8F3E2E' },
                  { id: '#222725', name: '炭墨黑', color: '#222725' },
                  { id: '#1E3A5F', name: '复古藏青', color: '#1E3A5F' },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onUpdateSettings({ translationColor: c.id })}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 cursor-pointer transition-all ${
                      settings.translationColor === c.id
                        ? 'border-[#222725] bg-[#222725] text-white'
                        : 'border-[#DFD5C2] bg-white text-[#222725]'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: c.color }} />
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Font Size */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#222725] block">译文字号大小</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'small', label: '小 (16px)' },
                  { id: 'medium', label: '中 (20px)' },
                  { id: 'large', label: '大 (24px)' },
                ].map((sz) => (
                  <button
                    key={sz.id}
                    type="button"
                    onClick={() => onUpdateSettings({ fontSize: sz.id as any })}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                      settings.fontSize === sz.id
                        ? 'border-[#222725] bg-[#222725] text-white'
                        : 'border-[#DFD5C2] bg-white text-[#222725]'
                    }`}
                  >
                    {sz.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Signature & Watermark */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#222725] block">顶部水印署名</label>
              <input
                type="text"
                value={settings.signatureText || ''}
                onChange={(e) => onUpdateSettings({ signatureText: e.target.value })}
                placeholder="@有个框艺术商店"
                className="w-full text-base sm:text-sm px-3.5 py-2.5 bg-white border border-[#DFD7CC] rounded-xl text-[#222725] focus:ring-1 focus:ring-[#222725] focus:outline-none"
              />
            </div>

            {/* Done button inside drawer */}
            <button
              type="button"
              onClick={() => setShowSettingsDrawer(false)}
              className="w-full py-3 rounded-full bg-[#222725] text-[#FBF7EF] font-bold text-sm cursor-pointer"
            >
              完成设置并应用
            </button>
          </div>
        </div>
      )}

      {/* Export Progress Overlay */}
      {isExporting && exportProgress && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FBF7EF] rounded-2xl max-w-sm w-full p-6 text-center border border-[#EAE3D2] space-y-4">
            <Sparkles className="w-8 h-8 text-[#8F3E2E] animate-spin mx-auto" />
            <div className="space-y-1">
              <h4 className="font-bold text-base text-[#222725]">正在打包高清画质...</h4>
              <p className="text-xs text-[#75716B]">{exportProgress.status}</p>
            </div>
            <div className="w-full bg-[#EAE3D2] rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#222725] h-full transition-all duration-300"
                style={{ width: `${exportProgress.percent}%` }}
              />
            </div>
            <span className="text-xs font-bold text-[#222725]">{exportProgress.percent}%</span>
          </div>
        </div>
      )}

      {/* Sticky Bottom Primary Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#FBF7EF]/90 backdrop-blur-md border-t border-[#EAE3D2] z-30 flex justify-center pb-safe">
        <div className="max-w-md w-full flex items-center space-x-2.5">
          {/* Download Current Page */}
          <button
            type="button"
            disabled={isExporting}
            onClick={handleDownloadCurrentPNG}
            className="w-13 h-13 aspect-square rounded-full bg-[#F2ECE0] hover:bg-[#EAE1D0] text-[#222725] border border-[#DFD5C2] cursor-pointer transition-all flex items-center justify-center shrink-0 active:scale-95 disabled:opacity-40"
            title="下载当前单页 (PNG)"
            aria-label="下载当前单页"
          >
            <Download className="w-5 h-5 text-[#222725]" />
          </button>

          {/* Primary Action: Batch ZIP Download */}
          <button
            id="btn-export-all-zip"
            type="button"
            disabled={isExporting}
            onClick={() => handleDownloadAllZIP(false)}
            className="flex-1 h-13 rounded-full bg-[#222725] hover:bg-[#151817] active:scale-98 text-[#FBF7EF] font-bold text-base flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <FileArchive className="w-4.5 h-4.5 text-[#FBF7EF]" />
            <span>{isExporting ? '正在打包...' : '全部导出 (ZIP) →'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
