import React, { useState, useEffect, useRef } from 'react';
import { ComicPanel, TypesetSettings } from '../types/comic';
import { renderTypesetCard } from '../utils/paperTexture';
import { downloadSinglePanelPNG, downloadAllPanelsZIP } from '../utils/exportZip';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileArchive,
  Palette,
  Sliders,
  Sparkles,
  Type,
  Grid,
  Maximize2,
  FileDown,
  Upload,
  Layers,
  ArrowLeft,
} from 'lucide-react';

interface Step3TypesetExportProps {
  panels: ComicPanel[];
  settings: TypesetSettings;
  onUpdateSettings: (newSettings: Partial<TypesetSettings>) => void;
  onBackToStep2: () => void;
}

export const Step3TypesetExport: React.FC<Step3TypesetExportProps> = ({
  panels,
  settings,
  onUpdateSettings,
  onBackToStep2,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'single' | 'grid'>('single');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ percent: number; status: string } | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const customBgInputRef = useRef<HTMLInputElement>(null);

  const currentPanel = panels[currentIndex] || panels[0];

  // Draw current card preview on canvas
  useEffect(() => {
    if (!currentPanel || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;

    // Render at preview display resolution (e.g. 540x720 for crisp preview without lag)
    const rendered = renderTypesetCard(currentPanel, panels.length, settings, 1080, 1440);

    canvas.width = 1080;
    canvas.height = 1440;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(rendered, 0, 0);
    }
  }, [currentPanel, panels.length, settings]);

  // Handle single PNG download
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

  // Handle batch ZIP download
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
      alert('打包导出失败: ' + e.message);
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  // Handle custom background texture upload
  const handleCustomBgUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      onUpdateSettings({
        paperStyle: 'custom',
        customBackgroundUrl: e.target?.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-[1600px] mx-auto p-2 sm:p-4 gap-3">
      {/* Top Header Bar */}
      <div className="bg-white rounded-xl p-3 px-4 border border-[#e5dfd5] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToStep2}
            className="flex items-center space-x-1 text-xs font-medium text-[#6d6257] hover:text-[#231f1c] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回检查裁切</span>
          </button>
          <span className="text-[#ddd]">|</span>
          <span className="text-sm font-bold text-[#231f1c]">
            3:4 成品排版预览与批量导出
          </span>
        </div>

        {/* View Mode & Actions */}
        <div className="flex items-center space-x-2">
          {/* Switch Single / Grid view */}
          <div className="flex items-center bg-[#faf7f2] p-0.5 rounded-lg border border-[#e5dfd5] text-xs">
            <button
              onClick={() => setViewMode('single')}
              className={`px-3 py-1.5 rounded-md font-medium cursor-pointer ${
                viewMode === 'single' ? 'bg-white text-[#8f3e2e] font-bold' : 'text-[#666]'
              }`}
            >
              单页翻阅
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-md font-medium cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-[#8f3e2e] font-bold' : 'text-[#666]'
              }`}
            >
              全部总览
            </button>
          </div>

          <button
            id="btn-download-single-png"
            disabled={isExporting}
            onClick={handleDownloadCurrentPNG}
            className="px-3 py-1.5 text-xs font-medium bg-[#f5ede2] hover:bg-[#ebdfce] text-[#784f33] rounded-lg border border-[#ded0be] transition-colors cursor-pointer flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出当前页 PNG</span>
          </button>

          <button
            id="btn-download-all-zip"
            disabled={isExporting}
            onClick={() => handleDownloadAllZIP(false)}
            className="px-4 py-1.5 text-xs font-bold bg-[#8f3e2e] hover:bg-[#7a3223] text-white rounded-lg transition-all cursor-pointer flex items-center space-x-1.5"
          >
            <FileArchive className="w-3.5 h-3.5" />
            <span>批量下载全部 (ZIP)</span>
          </button>
        </div>
      </div>

      {/* Progress Overlay if exporting */}
      {isExporting && exportProgress && (
        <div className="bg-[#fcf8f2] border border-[#ebdccb] p-3 rounded-xl flex items-center space-x-3">
          <Sparkles className="w-4 h-4 text-[#8f3e2e] animate-spin shrink-0" />
          <div className="flex-1">
            <div className="flex justify-between text-xs text-[#665749] mb-1">
              <span>{exportProgress.status}</span>
              <span>{exportProgress.percent}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#ebdccb] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#8f3e2e] transition-all duration-300"
                style={{ width: `${exportProgress.percent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        {/* Left / Center Preview Stage (7 or 8 cols on desktop) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col items-center justify-center bg-[#24201e] rounded-xl p-4 overflow-hidden relative">
          {viewMode === 'single' ? (
            /* Single Page Viewer (Carousel) */
            <div className="relative w-full h-full flex flex-col items-center justify-center">
              {/* 3:4 Aspect Ratio Container */}
              <div className="relative max-h-[calc(100%-4rem)] max-w-full aspect-[3/4] flex items-center justify-center">
                <canvas
                  ref={previewCanvasRef}
                  className="max-h-full max-w-full object-contain rounded-lg block"
                  style={{ aspectRatio: '3/4' }}
                />

                {/* Next / Prev Navigation Buttons (Viewer UI only, not exported) */}
                <button
                  id="btn-prev-page"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((c) => Math.max(0, c - 1))}
                  className="absolute left-2 sm:-left-12 p-2.5 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs disabled:opacity-20 cursor-pointer transition-all"
                  title="上一张"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <button
                  id="btn-next-page"
                  disabled={currentIndex === panels.length - 1}
                  onClick={() => setCurrentIndex((c) => Math.min(panels.length - 1, c + 1))}
                  className="absolute right-2 sm:-right-12 p-2.5 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs disabled:opacity-20 cursor-pointer transition-all"
                  title="下一张"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Bottom Viewer Indicators (UI only) */}
              <div className="mt-3 flex items-center space-x-2 text-xs text-[#bbb]">
                <span>
                  {currentPanel?.isTitleBanner
                    ? '封面标题页'
                    : `第 ${currentPanel?.index} 格 (共 ${panels.length} 格)`}
                </span>
                <div className="flex items-center space-x-1.5 ml-3">
                  {panels.map((p, idx) => (
                    <button
                      key={p.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                        currentIndex === idx ? 'bg-[#f59e0b] w-4' : 'bg-[#555] hover:bg-[#888]'
                      }`}
                      title={`跳转至第 ${p.index} 格`}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Grid Overview */
            <div className="w-full h-full overflow-y-auto p-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
              {panels.map((panel, idx) => {
                const canvas = renderTypesetCard(panel, panels.length, settings, 540, 720);
                const dataUrl = canvas.toDataURL();
                return (
                  <div
                    key={panel.id}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setViewMode('single');
                    }}
                    className={`group relative aspect-[3/4] rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                      currentIndex === idx
                        ? 'border-[#f59e0b] scale-[1.02]'
                        : 'border-transparent hover:border-[#888]'
                    }`}
                  >
                    <img src={dataUrl} alt={`Panel ${panel.index}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                      点击聚焦查看
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Settings & Controls (4 or 5 cols on desktop) */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col bg-white rounded-xl border border-[#e5dfd5] overflow-y-auto p-4 space-y-5">
          <div className="flex items-center space-x-2 pb-3 border-b border-[#f0ebd9]">
            <Palette className="w-4 h-4 text-[#8f3e2e]" />
            <h3 className="text-sm font-bold text-[#231f1c]">排版与样式统一设置</h3>
          </div>

          {/* 1. Resolution & Canvas Aspect Ratio */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-[#2d2824] block">导出分辨率</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => onUpdateSettings({ resolution: { width: 1080, height: 1440 } })}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  settings.resolution.width === 1080
                    ? 'border-[#8f3e2e] bg-[#faf4ec] text-[#8f3e2e] font-bold'
                    : 'border-[#e0d6c9] hover:bg-[#faf7f2] text-[#555]'
                }`}
              >
                <div className="font-semibold">1080 × 1440</div>
                <div className="text-[10px] text-[#888]">标准 3:4 竖版</div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ resolution: { width: 2160, height: 2880 } })}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  settings.resolution.width === 2160
                    ? 'border-[#8f3e2e] bg-[#faf4ec] text-[#8f3e2e] font-bold'
                    : 'border-[#e0d6c9] hover:bg-[#faf7f2] text-[#555]'
                }`}
              >
                <div className="font-semibold">2160 × 2880</div>
                <div className="text-[10px] text-[#888]">超清 2K/4K 级导出</div>
              </button>
            </div>
          </div>

          {/* 2. Paper Texture & Background Style */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#2d2824]">复古纸张质感</span>
              <span className="text-[11px] text-[#888]">
                强度: {settings.paperTextureIntensity}%
              </span>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
              {[
                { key: 'warm_cream', label: '温暖米黄', bg: '#f3ede2' },
                { key: 'vintage_newsprint', label: '怀旧报纸', bg: '#eee5d5' },
                { key: 'parchment', label: '羊皮纸感', bg: '#f2e8d5' },
                { key: 'clean_white', label: '纯白素描', bg: '#faf9f6' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      paperStyle: item.key as TypesetSettings['paperStyle'],
                    })
                  }
                  className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                    settings.paperStyle === item.key
                      ? 'border-[#8f3e2e] ring-1 ring-[#8f3e2e] font-bold'
                      : 'border-[#e5dfd5]'
                  }`}
                  style={{ backgroundColor: item.bg }}
                >
                  <span className="text-[11px] text-[#333] block truncate">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Texture Intensity Slider */}
            <div className="pt-2">
              <input
                type="range"
                min="0"
                max="100"
                value={settings.paperTextureIntensity}
                onChange={(e) =>
                  onUpdateSettings({ paperTextureIntensity: parseInt(e.target.value, 10) })
                }
                className="w-full h-1.5 bg-[#ded5c7] rounded-lg appearance-none cursor-pointer accent-[#8f3e2e]"
              />
            </div>

            {/* Custom Paper Texture Upload */}
            <div className="pt-1">
              <input
                type="file"
                ref={customBgInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleCustomBgUpload(e.target.files[0]);
                }}
              />
              <button
                type="button"
                onClick={() => customBgInputRef.current?.click()}
                className="w-full py-1.5 text-xs font-medium text-[#784f33] bg-[#faf7f2] hover:bg-[#f0e7d8] border border-[#e5dfd5] rounded-lg cursor-pointer flex items-center justify-center space-x-1"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>上传自定义纸质底图</span>
              </button>
            </div>
          </div>

          {/* 3. Header Signature */}
          <div className="space-y-2 p-3 bg-[#faf7f2] rounded-xl border border-[#ede5d8]">
            <div className="flex items-center justify-between">
              <label htmlFor="cb-show-signature" className="text-xs font-semibold text-[#2d2824] cursor-pointer">
                顶部署名 / 水印文字
              </label>
              <input
                type="checkbox"
                id="cb-show-signature"
                checked={settings.showSignature}
                onChange={(e) => onUpdateSettings({ showSignature: e.target.checked })}
                className="h-4 w-4 rounded text-[#8f3e2e] focus:ring-[#8f3e2e] border-gray-300 cursor-pointer"
              />
            </div>

            {settings.showSignature && (
              <div className="space-y-2 pt-1">
                <input
                  type="text"
                  value={settings.signatureText}
                  onChange={(e) => onUpdateSettings({ signatureText: e.target.value })}
                  placeholder="如: @有个框艺术商店"
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-[#dfd7cc] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8f3e2e]"
                />
                <div className="text-[11px] text-[#8e857b]">
                  低对比度显示在图片正上方，营造典雅品牌感
                </div>
              </div>
            )}
          </div>

          {/* 4. Translation Typography */}
          <div className="space-y-3 p-3 bg-[#faf7f2] rounded-xl border border-[#ede5d8]">
            <span className="text-xs font-semibold text-[#2d2824] block">上方译文字体与颜色</span>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Font Family */}
              <div>
                <label className="text-[11px] text-[#7e7367] block mb-1">字体样式</label>
                <select
                  value={settings.translationFontFamily}
                  onChange={(e) => onUpdateSettings({ translationFontFamily: e.target.value })}
                  className="w-full text-xs px-2 py-1.5 bg-white border border-[#dfd7cc] rounded-lg"
                >
                  <option value="serif">衬线典雅 (Noto Serif)</option>
                  <option value="sans">现代黑体 (Noto Sans)</option>
                </select>
              </div>

              {/* Color */}
              <div>
                <label className="text-[11px] text-[#7e7367] block mb-1">颜色</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={settings.translationColor}
                    onChange={(e) => onUpdateSettings({ translationColor: e.target.value })}
                    className="w-7 h-7 rounded border border-[#ccc] cursor-pointer"
                  />
                  <span className="text-[11px] text-[#555]">{settings.translationColor}</span>
                </div>
              </div>
            </div>

            {/* Font Size */}
            <div>
              <div className="flex justify-between text-[11px] text-[#7e7367] mb-1">
                <span>译文字号</span>
                <span>{settings.translationFontSize}px</span>
              </div>
              <input
                type="range"
                min="24"
                max="44"
                value={settings.translationFontSize}
                onChange={(e) =>
                  onUpdateSettings({ translationFontSize: parseInt(e.target.value, 10) })
                }
                className="w-full h-1.5 bg-[#ded5c7] rounded-lg appearance-none cursor-pointer accent-[#8f3e2e]"
              />
            </div>
          </div>

          {/* 5. Page Numbering */}
          <div className="space-y-2 p-3 bg-[#faf7f2] rounded-xl border border-[#ede5d8]">
            <div className="flex items-center justify-between">
              <label htmlFor="cb-show-page" className="text-xs font-semibold text-[#2d2824] cursor-pointer">
                底部居中页码
              </label>
              <input
                type="checkbox"
                id="cb-show-page"
                checked={settings.showPageNumber}
                onChange={(e) => onUpdateSettings({ showPageNumber: e.target.checked })}
                className="h-4 w-4 rounded text-[#8f3e2e] focus:ring-[#8f3e2e] border-gray-300 cursor-pointer"
              />
            </div>

            {settings.showPageNumber && (
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div>
                  <label className="text-[11px] text-[#7e7367] block mb-1">页码格式</label>
                  <select
                    value={settings.pageNumberFormat}
                    onChange={(e) =>
                      onUpdateSettings({
                        pageNumberFormat: e.target.value as TypesetSettings['pageNumberFormat'],
                      })
                    }
                    className="w-full text-xs px-2 py-1.5 bg-white border border-[#dfd7cc] rounded-lg"
                  >
                    <option value="index_total">1/6, 2/6... (推荐)</option>
                    <option value="index_only">1, 2...</option>
                    <option value="page_index">Page 1, Page 2...</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-[#7e7367] mb-1">
                    <span>页码大小</span>
                    <span>{settings.pageNumberSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="32"
                    max="56"
                    value={settings.pageNumberSize}
                    onChange={(e) =>
                      onUpdateSettings({ pageNumberSize: parseInt(e.target.value, 10) })
                    }
                    className="w-full h-1.5 bg-[#ded5c7] rounded-lg appearance-none cursor-pointer accent-[#8f3e2e]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Export Buttons */}
          <div className="pt-2 space-y-2">
            <button
              onClick={() => handleDownloadAllZIP(false)}
              disabled={isExporting}
              className="w-full py-3 bg-[#8f3e2e] hover:bg-[#7b3223] text-white rounded-xl font-bold text-sm transition-all cursor-pointer flex items-center justify-center space-x-2"
            >
              <FileArchive className="w-4 h-4" />
              <span>打包下载全部 3:4 成品 (ZIP)</span>
            </button>

            <button
              onClick={() => handleDownloadAllZIP(true)}
              disabled={isExporting}
              className="w-full py-2.5 bg-[#f5ede2] hover:bg-[#ebdfce] text-[#6d4d33] border border-[#dccbb6] rounded-xl font-medium text-xs transition-all cursor-pointer flex items-center justify-center space-x-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>一键下载 (包含 3:4 成品 + 原始黑框裁切)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
