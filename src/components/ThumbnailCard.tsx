import React, { useEffect, useRef, useCallback } from 'react';
import { ComicPanel, TypesetSettings } from '../types/comic';
import { renderTypesetCard } from '../utils/paperTexture';
import { AlertTriangle } from 'lucide-react';

export interface ThumbnailCardProps {
  panel: ComicPanel;
  index: number;
  totalPanels: number;
  isActive: boolean;
  settings: TypesetSettings;
  onClick: () => void;
  label?: string;
}

export const ThumbnailCard: React.FC<ThumbnailCardProps> = React.memo(
  ({ panel, index, totalPanels, isActive, settings, onClick, label }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const drawThumbnail = useCallback(() => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;

      // 3:4 aspect ratio canvas rendered at 216x288 (3x DPR for 72x96 CSS dimensions)
      const rendered = renderTypesetCard(panel, totalPanels, settings, 216, 288, () => {
        drawThumbnail();
      });

      canvas.width = 216;
      canvas.height = 288;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(rendered, 0, 0);
      }
    }, [panel, totalPanels, settings]);

    useEffect(() => {
      drawThumbnail();
    }, [drawThumbnail, panel, settings]);

    const hasOcrError = panel.ocrStatus === 'error';
    const isProcessing = panel.ocrStatus === 'recognizing' || panel.ocrStatus === 'translating';
    const displayLabel = label || (panel.isTitleBanner ? '标题页' : `第 ${index + 1} 格`);

    return (
      <button
        type="button"
        data-panel-id={panel.id}
        onClick={onClick}
        className="flex flex-col items-center group cursor-pointer shrink-0 text-left focus:outline-none transition-transform active:scale-96 select-none"
        title={`切换至${displayLabel} (点击查看)`}
      >
        {/* Complete 3:4 Paper Preview Card */}
        <div className="relative">
          <div
            className={`relative w-[72px] h-[96px] rounded-lg overflow-hidden bg-[#FBF7EF] transition-all box-border ${
              isActive
                ? 'border-2 border-[#222725] shadow-xs ring-2 ring-[#222725]/15'
                : 'border-2 border-[#DFD5C2] group-hover:border-[#8A847A] shadow-2xs'
            }`}
          >
            <canvas
              ref={canvasRef}
              className="w-full h-full object-contain block pointer-events-none"
            />
          </div>

          {/* Error indicator badge outside the preview: does not block the card */}
          {hasOcrError && (
            <span
              title={`第 ${index + 1} 格识别异常: ${panel.ocrError || '请核实对白'}`}
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-xs border-2 border-[#FBF7EF] z-10 pointer-events-none"
            >
              !
            </span>
          )}

          {/* Processing pulsing dot badge */}
          {isProcessing && (
            <span
              title="处理中..."
              className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-[#FBF7EF] animate-pulse z-10 pointer-events-none"
            />
          )}
        </div>

        {/* Page Sequence Number outside card */}
        <div className="mt-1.5 flex items-center space-x-1">
          <span
            className={`text-xs sm:text-[13px] font-medium leading-none transition-colors ${
              isActive ? 'text-[#222725] font-bold' : 'text-[#65615B] group-hover:text-[#222725]'
            }`}
          >
            {displayLabel}
          </span>
        </div>
      </button>
    );
  }
);

ThumbnailCard.displayName = 'ThumbnailCard';
