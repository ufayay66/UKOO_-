import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ComicPanel, TypesetSettings } from '../types/comic';
import { renderTypesetCard, computeCardLayoutInfo } from '../utils/paperTexture';
import { ThumbnailCard } from './ThumbnailCard';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Plus,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Columns,
  BookOpen,
  X,
  Languages,
  RotateCcw,
  Check,
  ChevronDown,
  AlertTriangle,
  MoveVertical,
  MoveHorizontal,
  Move,
  Type,
  Maximize2,
  Minimize2,
  Sparkles,
  Sliders,
  CopyCheck,
  MessageSquareOff,
  Crop,
  ZoomIn,
  ZoomOut,
  Layers,
} from 'lucide-react';

interface Step3EditTranslationProps {
  panels: ComicPanel[];
  activePanelId: string | null;
  settings: TypesetSettings;
  onSelectPanel: (id: string) => void;
  onUpdatePanelText: (
    id: string,
    updates: {
      originalText?: string;
      translatedText?: string;
      bubbles?: Array<{
        id: string;
        originalText: string;
        translatedText: string;
        positionHint: 'left' | 'center' | 'right';
        userEditedOriginal?: boolean;
        userEditedTranslated?: boolean;
      }>;
      userEditedText?: boolean;
      userEditedOriginalText?: boolean;
      userEditedTranslatedText?: boolean;
      hasNoDialogue?: boolean;
    }
  ) => void;
  onUpdatePanelTypography: (
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
    },
    applyToAll?: boolean
  ) => void;
  onResetPanelTypography: (id: string) => void;
  onRetryPanelOcr: (id: string) => Promise<void>;
  onTranslateFromOriginal: (id: string) => Promise<void>;
  onRevertOcr: (id: string) => void;
  onTranslateAllPanels: () => Promise<void>;
  onTriggerAutoOcr?: () => void;
  isTranslatingAll: boolean;
  hasApiKey: boolean;
  rawImageCanvas: HTMLCanvasElement | null;
  onGoToStep4: () => void;
  onBackToStep2: () => void;
}

const FONT_SIZE_PRESETS = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 42, 48, 56, 64, 72, 96, 128];

export const Step3EditTranslation: React.FC<Step3EditTranslationProps> = ({
  panels,
  activePanelId,
  settings,
  onSelectPanel,
  onUpdatePanelText,
  onUpdatePanelTypography,
  onResetPanelTypography,
  onRetryPanelOcr,
  onTranslateFromOriginal,
  onRevertOcr,
  onTranslateAllPanels,
  onTriggerAutoOcr,
  isTranslatingAll,
  hasApiKey,
  rawImageCanvas,
  onGoToStep4,
  onBackToStep2,
}) => {
  const [showFullNewspaper, setShowFullNewspaper] = useState(false);
  const [isRetryingSingle, setIsRetryingSingle] = useState(false);
  const [isTranslatingText, setIsTranslatingText] = useState(false);
  const [copiedAllFeedback, setCopiedAllFeedback] = useState(false);
  const [copiedScaleAllFeedback, setCopiedScaleAllFeedback] = useState(false);
  const [inspectRawCrop, setInspectRawCrop] = useState(false);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverTarget, setHoverTarget] = useState<'text' | 'comic' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragModeRef = useRef<'text' | 'comic' | null>(null);
  const dragStartMouseRef = useRef({ x: 0, y: 0 });
  const dragStartOffsetRef = useRef({ x: 0, y: 0 });

  const activePanel = panels.find((p) => p.id === activePanelId) || panels[0];
  const activeIndex = panels.findIndex((p) => p.id === activePanel?.id);

  // Auto-trigger background queue for any unfinished panels upon entering Step 3
  useEffect(() => {
    const hasUnfinished = panels.some(
      (p) => p.ocrStatus !== 'completed' && p.ocrStatus !== 'recognizing' && p.ocrStatus !== 'translating'
    );
    if (hasUnfinished && onTriggerAutoOcr) {
      onTriggerAutoOcr();
    }
  }, []);

  // Natural aspect ratio computation for current panel
  const currentRatio = useMemo(() => {
    if (!activePanel?.quad) return 1.33;
    const q = activePanel.quad;
    const topW = Math.hypot(q.topRight.x - q.topLeft.x, q.topRight.y - q.topLeft.y);
    const botW = Math.hypot(q.bottomRight.x - q.bottomLeft.x, q.bottomRight.y - q.bottomLeft.y);
    const leftH = Math.hypot(q.bottomLeft.x - q.topLeft.x, q.bottomLeft.y - q.topLeft.y);
    const rightH = Math.hypot(q.bottomRight.x - q.topRight.x, q.bottomRight.y - q.topRight.y);
    const avgW = (topW + botW) / 2;
    const avgH = (leftH + rightH) / 2;
    return avgH > 0 ? avgW / avgH : 1.33;
  }, [activePanel?.quad]);

  const ratioDescription = useMemo(() => {
    if (currentRatio > 1.45) return `横宽格 (${currentRatio.toFixed(2)}:1)`;
    if (currentRatio > 1.15) return `标准横格 (${currentRatio.toFixed(2)}:1)`;
    if (currentRatio >= 0.88) return `正方格 (${currentRatio.toFixed(2)}:1)`;
    return `竖长格 (${currentRatio.toFixed(2)}:1)`;
  }, [currentRatio]);

  // Live render full 3:4 Finished Card Preview on canvas
  const updateCanvasPreview = useCallback(() => {
    if (!activePanel || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const rendered = renderTypesetCard(activePanel, panels.length, settings, 1080, 1440, () => {
      updateCanvasPreview();
    });

    canvas.width = 1080;
    canvas.height = 1440;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(rendered, 0, 0);
    }
  }, [activePanel, panels.length, settings]);

  // Serialize bubbles text so that any newline or character change in speechBubbles immediately triggers preview canvas re-rendering
  const bubbleTextsKey = (activePanel?.speechBubbles || []).map((b) => `${b.id}:${b.translatedText}`).join('---');

  useEffect(() => {
    updateCanvasPreview();
  }, [
    updateCanvasPreview,
    activePanel?.id,
    activePanel?.cachedCroppedUrl,
    activePanel?.translatedTextCombined,
    activePanel?.speechBubbles,
    bubbleTextsKey,
    activePanel?.customFontSize,
    activePanel?.customYOffset,
    activePanel?.customXOffset,
    activePanel?.customAlign,
    activePanel?.customGap,
    activePanel?.comicScale,
    activePanel?.comicOffsetX,
    activePanel?.comicOffsetY,
  ]);

  // Handle panel navigation
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

  // Thumbnail container ref & auto-scroll into view when active panel changes
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!thumbnailContainerRef.current || !activePanel?.id) return;
    const container = thumbnailContainerRef.current;
    const activeEl = container.querySelector<HTMLElement>(`[data-panel-id="${activePanel.id}"]`);
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
  }, [activePanel?.id]);

  // Single panel smart retry: only retry translation if English original already exists!
  const handleRetryClick = async () => {
    if (!activePanel) return;
    setIsRetryingSingle(true);
    try {
      if (activePanel.originalTextCombined?.trim() && activePanel.originalTextCombined !== '无对白') {
        await onTranslateFromOriginal(activePanel.id);
      } else {
        await onRetryPanelOcr(activePanel.id);
      }
    } finally {
      setIsRetryingSingle(false);
    }
  };

  // Translate modified original text without re-doing visual OCR
  const handleTranslateOriginalClick = async () => {
    if (!activePanel) return;
    setIsTranslatingText(true);
    try {
      await onTranslateFromOriginal(activePanel.id);
    } finally {
      setIsTranslatingText(false);
    }
  };

  // Bubble text changes (live updates preview immediately)
  const handleBubbleChange = (
    bubbleId: string,
    field: 'originalText' | 'translatedText' | 'positionHint',
    val: string
  ) => {
    if (!activePanel) return;
    const nextBubbles = (activePanel.speechBubbles || []).map((b) => {
      if (b.id === bubbleId) {
        return {
          ...b,
          [field]: val,
          ...(field === 'originalText' ? { userEditedOriginal: true } : {}),
          ...(field === 'translatedText' ? { userEditedTranslated: true } : {}),
        };
      }
      return b;
    });

    const combinedTrans = nextBubbles.map((b) => b.translatedText).filter(Boolean).join('  ');
    const combinedOrig = nextBubbles.map((b) => b.originalText).filter(Boolean).join('  ');

    onUpdatePanelText(activePanel.id, {
      bubbles: nextBubbles,
      translatedText: combinedTrans,
      originalText: combinedOrig,
      userEditedText: true,
      ...(field === 'originalText' ? { userEditedOriginalText: true } : {}),
      ...(field === 'translatedText' ? { userEditedTranslatedText: true } : {}),
      hasNoDialogue: false,
    });
  };

  const handleAddBubble = () => {
    if (!activePanel) return;
    const newBubbles = [
      ...(activePanel.speechBubbles || []),
      {
        id: `bubble-${Date.now()}`,
        originalText: '',
        translatedText: '',
        positionHint: (activePanel.speechBubbles?.length === 1 ? 'right' : 'center') as 'left' | 'center' | 'right',
      },
    ];
    onUpdatePanelText(activePanel.id, {
      bubbles: newBubbles,
      userEditedText: true,
      hasNoDialogue: false,
    });
  };

  const handleDeleteBubble = (bubbleId: string) => {
    if (!activePanel) return;
    const nextBubbles = (activePanel.speechBubbles || []).filter((b) => b.id !== bubbleId);
    const combinedTrans = nextBubbles.map((b) => b.translatedText).filter(Boolean).join('  ');
    const combinedOrig = nextBubbles.map((b) => b.originalText).filter(Boolean).join('  ');

    onUpdatePanelText(activePanel.id, {
      bubbles: nextBubbles,
      translatedText: combinedTrans,
      originalText: combinedOrig,
      userEditedText: true,
    });
  };

  const handleToggleNoDialogue = () => {
    if (!activePanel) return;
    const nextNoDialogue = !activePanel.hasNoDialogue;
    onUpdatePanelText(activePanel.id, {
      hasNoDialogue: nextNoDialogue,
      translatedText: nextNoDialogue ? '' : activePanel.initialOcrTranslatedText || '',
      originalText: nextNoDialogue ? '无对白' : activePanel.initialOcrOriginalText || '',
      userEditedText: true,
    });
  };

  const handleApplyToAllTypography = () => {
    if (!activePanel) return;
    onUpdatePanelTypography(
      activePanel.id,
      {
        customFontSize: activePanel.customFontSize,
        customYOffset: activePanel.customYOffset,
        customXOffset: activePanel.customXOffset,
        customAlign: activePanel.customAlign,
        customGap: activePanel.customGap,
      },
      true
    );
    setCopiedAllFeedback(true);
    setTimeout(() => setCopiedAllFeedback(false), 2000);
  };

  const handleApplyScaleToAll = () => {
    if (!activePanel) return;
    onUpdatePanelTypography(
      activePanel.id,
      {
        comicScale: activePanel.comicScale ?? 1.0,
      },
      true
    );
    setCopiedScaleAllFeedback(true);
    setTimeout(() => setCopiedScaleAllFeedback(false), 2000);
  };

  // Convert mouse event coordinates to 1080x1440 card coordinate space
  const getCardCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return { x: 0, y: 0, factor: 1 };
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1080;
    const y = ((e.clientY - rect.top) / rect.height) * 1440;
    const factor = 1080 / rect.width;
    return { x, y, factor };
  };

  // Interactive Drag on Canvas: Decoupled for Text vs Comic
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!activePanel) return;
    const { x, y } = getCardCoords(e);
    const { textBounds, comicBounds } = computeCardLayoutInfo(activePanel, panels.length, settings, 1080, 1440);

    const inText =
      x >= textBounds.x - 20 &&
      x <= textBounds.x + textBounds.width + 20 &&
      y >= textBounds.y - 15 &&
      y <= textBounds.y + textBounds.height + 15;

    const inComic =
      x >= comicBounds.x - 10 &&
      x <= comicBounds.x + comicBounds.width + 10 &&
      y >= comicBounds.y - 10 &&
      y <= comicBounds.y + comicBounds.height + 10;

    if (inText) {
      dragModeRef.current = 'text';
      setIsDragging(true);
      dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
      dragStartOffsetRef.current = {
        x: activePanel.customXOffset || 0,
        y: activePanel.customYOffset || 0,
      };
    } else if (inComic) {
      dragModeRef.current = 'comic';
      setIsDragging(true);
      dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
      dragStartOffsetRef.current = {
        x: activePanel.comicOffsetX || 0,
        y: activePanel.comicOffsetY || 0,
      };
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!activePanel) return;
    const { x, y, factor } = getCardCoords(e);

    if (!dragModeRef.current) {
      const { textBounds, comicBounds } = computeCardLayoutInfo(activePanel, panels.length, settings, 1080, 1440);
      const inText =
        x >= textBounds.x - 20 &&
        x <= textBounds.x + textBounds.width + 20 &&
        y >= textBounds.y - 15 &&
        y <= textBounds.y + textBounds.height + 15;

      const inComic =
        x >= comicBounds.x - 10 &&
        x <= comicBounds.x + comicBounds.width + 10 &&
        y >= comicBounds.y - 10 &&
        y <= comicBounds.y + comicBounds.height + 10;

      if (inText) {
        setHoverTarget('text');
      } else if (inComic) {
        setHoverTarget('comic');
      } else {
        setHoverTarget(null);
      }
      return;
    }

    const dx = (e.clientX - dragStartMouseRef.current.x) * factor;
    const dy = (e.clientY - dragStartMouseRef.current.y) * factor;

    if (dragModeRef.current === 'text') {
      // Dragging text ONLY updates text X/Y offset; comic stays completely stationary
      const newX = Math.round(Math.max(-200, Math.min(200, dragStartOffsetRef.current.x + dx)));
      const newY = Math.round(Math.max(-120, Math.min(120, dragStartOffsetRef.current.y + dy)));
      onUpdatePanelTypography(activePanel.id, { customXOffset: newX, customYOffset: newY });
    } else if (dragModeRef.current === 'comic') {
      // Dragging comic ONLY updates comic X/Y offset; text, signature & page number stay stationary
      const newX = Math.round(Math.max(-300, Math.min(300, dragStartOffsetRef.current.x + dx)));
      const newY = Math.round(Math.max(-300, Math.min(300, dragStartOffsetRef.current.y + dy)));
      onUpdatePanelTypography(activePanel.id, { comicOffsetX: newX, comicOffsetY: newY });
    }
  };

  const handleCanvasMouseUp = () => {
    dragModeRef.current = null;
    setIsDragging(false);
  };

  const currentFontSize = activePanel?.customFontSize !== undefined ? activePanel.customFontSize : settings.translationFontSize;
  const [fontSizeInput, setFontSizeInput] = useState<string>(String(currentFontSize));
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState<boolean>(false);
  const fontDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFontSizeInput(String(currentFontSize));
  }, [currentFontSize, activePanel?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(event.target as Node)) {
        setIsFontDropdownOpen(false);
      }
    };
    if (isFontDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFontDropdownOpen]);

  const currentYOffset = activePanel?.customYOffset || 0;
  const currentXOffset = activePanel?.customXOffset || 0;
  const currentAlign = activePanel?.customAlign || 'left';
  const currentComicScale = activePanel?.comicScale ?? 1.0;
  const currentComicOffsetX = activePanel?.comicOffsetX ?? 0;
  const currentComicOffsetY = activePanel?.comicOffsetY ?? 0;

  const isRecognizing = activePanel?.ocrStatus === 'recognizing';
  const isTranslating = activePanel?.ocrStatus === 'translating';
  const hasError = activePanel?.ocrStatus === 'error';
  const isCompleted = activePanel?.ocrStatus === 'completed';

  const canvasCursorClass = isDragging
    ? 'cursor-grabbing'
    : hoverTarget === 'text'
    ? 'cursor-move'
    : hoverTarget === 'comic'
    ? 'cursor-grab'
    : 'cursor-default';

  return (
    <div className="flex-1 flex flex-col justify-between max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 pb-28">
      {/* Top Header Bar: Stepper and Global Actions */}
      <div className="flex items-center justify-between py-2 border-b border-[#EAE3D2] text-xs sm:text-sm">
        <button
          type="button"
          onClick={onBackToStep2}
          className="text-[#75716B] hover:text-[#222725] font-medium flex items-center space-x-1 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>上一步: 裁切</span>
        </button>

        {/* Panel Stepper Navigator */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            disabled={activeIndex <= 0}
            onClick={handlePrev}
            className="p-1 text-[#75716B] hover:text-[#222725] disabled:opacity-30 cursor-pointer"
            title="上一格"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="font-bold text-[#222725]">
            {activePanel?.isTitleBanner ? '顶部标题页' : `第 ${activePanel?.index || 1} 格`}
          </span>
          <span className="text-[#A09A90]">/ 共 {panels.length} 格</span>

          <button
            type="button"
            disabled={activeIndex >= panels.length - 1}
            onClick={handleNext}
            className="p-1 text-[#75716B] hover:text-[#222725] disabled:opacity-30 cursor-pointer"
            title="下一格"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Global actions: View Newspaper & All Translation */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowFullNewspaper(true)}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-[#222725] bg-[#F2ECE0] hover:bg-[#EAE1D0] rounded-full cursor-pointer transition-all border border-[#DFD5C2]"
            title="查看完整报纸原图以核对剧情前后文"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">查看整版</span>
          </button>

          <button
            type="button"
            disabled={isTranslatingAll}
            onClick={onTranslateAllPanels}
            className="flex items-center space-x-1 px-3 py-1 text-xs font-medium text-[#8F3E2E] bg-[#F8EFEA] hover:bg-[#F3E3DB] border border-[#ECD1C8] rounded-full cursor-pointer transition-all disabled:opacity-40"
            title="结合整组漫画故事剧情重新翻译全部格子"
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{isTranslatingAll ? '全篇翻译中...' : '全篇重译'}</span>
          </button>
        </div>
      </div>

      {/* Main Translation & Typesetting Grid: Left 3:4 Finished Card / Right Controls */}
      <div className="flex-1 my-3 grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        {/* Left Column: Complete 3:4 Finished Product Preview */}
        <div className="md:col-span-5 lg:col-span-4 xl:col-span-4 flex flex-col items-center">
          <div className="w-full flex items-center justify-between pb-1.5 px-1 text-xs text-[#75716B]">
            <span className="font-semibold text-[#222725] flex items-center space-x-1">
              <span>3:4 成品排版预览</span>
              <span className="text-[11px] font-normal text-[#8F887C]">(实时渲染)</span>
            </span>
            <button
              type="button"
              onClick={() => setInspectRawCrop(!inspectRawCrop)}
              className="text-[11px] text-[#8F3E2E] hover:underline cursor-pointer flex items-center space-x-0.5"
            >
              <span>{inspectRawCrop ? '返回3:4卡片' : '查看裁切原图'}</span>
            </button>
          </div>

          {/* 3:4 Card Container */}
          <div className="relative w-full max-w-[320px] sm:max-w-[360px] md:max-w-full aspect-[3/4] rounded-2xl overflow-hidden border border-[#D8D0BE] bg-[#FBF7EF] flex items-center justify-center transition-all group">
            {inspectRawCrop ? (
              /* Raw cropped image inspection */
              <div className="w-full h-full p-4 flex flex-col items-center justify-center bg-[#222725]/5">
                {activePanel?.cachedCroppedUrl ? (
                  <img
                    src={activePanel.cachedCroppedUrl}
                    alt="Raw Crop"
                    className="max-h-full max-w-full object-contain rounded border border-[#222725]/30"
                  />
                ) : (
                  <span className="text-xs text-[#75716B]">裁切生成中...</span>
                )}
                <span className="text-[11px] text-[#8F887C] mt-2">原始报纸墨印像素</span>
              </div>
            ) : (
              /* High-fidelity 3:4 typeset card canvas */
              <div className={`relative w-full h-full ${canvasCursorClass}`} title="拖拽译文微调文字位置，拖拽画面微调漫画位置">
                <canvas
                  ref={previewCanvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                  className="w-full h-full object-contain block select-none"
                />

                {/* Floating Feedback Tooltip for Decoupled Dragging */}
                {hoverTarget === 'text' && !isDragging && (
                  <div className="absolute top-2.5 left-1/2 -translate-x-1/2 bg-[#8F3E2E] text-white text-[10px] px-2.5 py-1 rounded-full pointer-events-none flex items-center space-x-1 animate-in fade-in z-10">
                    <Move className="w-3 h-3" />
                    <span>按住拖动译文 (漫画保持原位)</span>
                  </div>
                )}
                {hoverTarget === 'comic' && !isDragging && (
                  <div className="absolute top-2.5 left-1/2 -translate-x-1/2 bg-[#222725] text-white text-[10px] px-2.5 py-1 rounded-full pointer-events-none flex items-center space-x-1 animate-in fade-in z-10">
                    <Move className="w-3 h-3" />
                    <span>按住拖动画面 (文字保持原位)</span>
                  </div>
                )}
                {isDragging && dragModeRef.current === 'text' && (
                  <div className="absolute top-2.5 left-1/2 -translate-x-1/2 bg-[#8F3E2E] text-white text-[11px] px-3 py-1 rounded-full pointer-events-none flex items-center space-x-1.5 z-10">
                    <Move className="w-3.5 h-3.5" />
                    <span>正在移动译文 (漫画原位)</span>
                  </div>
                )}
                {isDragging && dragModeRef.current === 'comic' && (
                  <div className="absolute top-2.5 left-1/2 -translate-x-1/2 bg-[#222725] text-white text-[11px] px-3 py-1 rounded-full pointer-events-none flex items-center space-x-1.5 z-10">
                    <Move className="w-3.5 h-3.5" />
                    <span>正在移动画面 (文字原位)</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-2 text-center text-[11px] text-[#8F887C] flex flex-wrap items-center justify-center gap-2">
            <span className="px-2 py-0.5 bg-[#FAF7EF] rounded-full border border-[#DFD7CC]">
              {ratioDescription}
            </span>
            <span>缩放 {Math.round(currentComicScale * 100)}%</span>
            <span>·</span>
            <span>字号 {currentFontSize}px</span>
          </div>
        </div>

        {/* Right Column: Comic Controls, Dialogue OCR Translation & Typography */}
        <div className="md:col-span-7 lg:col-span-8 xl:col-span-8 flex flex-col space-y-4">
          {/* Top Section: Comic Sizing & Position (漫画尺寸与位置) */}
          <div className="bg-white/90 rounded-2xl p-4 border border-[#EAE3D2] space-y-3.5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-[#F0EBE0] gap-2">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-[#FAF7EF] rounded-lg border border-[#DFD7CC] text-[#222725]">
                  <Crop className="w-4 h-4" />
                </div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-[#222725]">漫画尺寸与位置</h3>
                  <span className="text-[11px] font-medium text-[#8F3E2E] bg-[#FAF7EF] px-2 py-0.5 rounded-full border border-[#DFD7CC]">
                    {ratioDescription}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center space-x-1.5 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() =>
                    activePanel &&
                    onUpdatePanelTypography(activePanel.id, {
                      comicOffsetX: 0,
                      comicOffsetY: 0,
                    })
                  }
                  className="px-2 py-1 text-xs text-[#75716B] hover:text-[#222725] hover:bg-[#F2ECE0] rounded-lg cursor-pointer transition-colors"
                  title="画面居中"
                >
                  居中复位
                </button>

                <button
                  type="button"
                  onClick={() =>
                    activePanel &&
                    onUpdatePanelTypography(activePanel.id, {
                      comicScale: 1.0,
                      comicOffsetX: 0,
                      comicOffsetY: 0,
                    })
                  }
                  className="px-2 py-1 text-xs text-[#75716B] hover:text-[#222725] hover:bg-[#F2ECE0] rounded-lg cursor-pointer transition-colors"
                  title="恢复默认"
                >
                  恢复默认
                </button>

                <button
                  type="button"
                  onClick={handleApplyScaleToAll}
                  className="px-2.5 py-1 text-xs font-semibold bg-[#F5EFE0] hover:bg-[#EAE1D0] text-[#222725] rounded-full border border-[#DFD5C2] cursor-pointer transition-all flex items-center space-x-1"
                  title="将当前漫画缩放比例应用到全部格"
                >
                  {copiedScaleAllFeedback ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">已套用</span>
                    </>
                  ) : (
                    <>
                      <Layers className="w-3.5 h-3.5" />
                      <span>套用全篇</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Comic Controls Body */}
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Comic Scale Slider */}
                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#222725] flex items-center space-x-1">
                      <ZoomIn className="w-3.5 h-3.5 text-[#75716B]" />
                      <span>画面缩放</span>
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() =>
                          activePanel &&
                          onUpdatePanelTypography(activePanel.id, { comicScale: 1.0 })
                        }
                        className="text-[10px] text-[#75716B] hover:text-[#222725] underline cursor-pointer"
                      >
                        重置
                      </button>
                      <span className="text-[#8F3E2E] font-bold font-mono">
                        {Math.round(currentComicScale * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() =>
                        activePanel &&
                        onUpdatePanelTypography(activePanel.id, {
                          comicScale: Math.max(0.6, Number((currentComicScale - 0.05).toFixed(2))),
                        })
                      }
                      className="w-7 h-7 rounded-lg bg-[#F5EFE0] hover:bg-[#EAE1D0] font-bold text-[#222725] flex items-center justify-center cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min={0.6}
                      max={1.4}
                      step={0.02}
                      value={currentComicScale}
                      onChange={(e) =>
                        activePanel &&
                        onUpdatePanelTypography(activePanel.id, {
                          comicScale: Number(e.target.value),
                        })
                      }
                      className="flex-1 accent-[#222725] cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        activePanel &&
                        onUpdatePanelTypography(activePanel.id, {
                          comicScale: Math.min(1.4, Number((currentComicScale + 0.05).toFixed(2))),
                        })
                      }
                      className="w-7 h-7 rounded-lg bg-[#F5EFE0] hover:bg-[#EAE1D0] font-bold text-[#222725] flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 2. Comic Vertical Position */}
                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#222725] flex items-center space-x-1">
                      <MoveVertical className="w-3.5 h-3.5 text-[#75716B]" />
                      <span>垂直位置</span>
                    </span>
                    <span className="text-[#222725] font-bold font-mono">
                      {currentComicOffsetY > 0 ? `+${currentComicOffsetY}` : currentComicOffsetY}px
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() =>
                        activePanel &&
                        onUpdatePanelTypography(activePanel.id, {
                          comicOffsetY: Math.max(-200, currentComicOffsetY - 5),
                        })
                      }
                      className="px-2 py-1 rounded-lg bg-[#F5EFE0] hover:bg-[#EAE1D0] text-[11px] font-medium text-[#222725] cursor-pointer"
                    >
                      向上
                    </button>
                    <input
                      type="range"
                      min={-200}
                      max={200}
                      step={2}
                      value={currentComicOffsetY}
                      onChange={(e) =>
                        activePanel &&
                        onUpdatePanelTypography(activePanel.id, {
                          comicOffsetY: Number(e.target.value),
                        })
                      }
                      className="flex-1 accent-[#222725] cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        activePanel &&
                        onUpdatePanelTypography(activePanel.id, {
                          comicOffsetY: Math.min(200, currentComicOffsetY + 5),
                        })
                      }
                      className="px-2 py-1 rounded-lg bg-[#F5EFE0] hover:bg-[#EAE1D0] text-[11px] font-medium text-[#222725] cursor-pointer"
                    >
                      向下
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section: Side-by-Side Modules (左边「识别与译文」，右边「译文与排版」) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* Left Module: 识别与译文 (Dialogue OCR Translation) */}
            <div className="bg-white/90 rounded-2xl p-4 border border-[#EAE3D2] space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#F0EBE0]">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-[#222725]">
                    {activePanel?.isTitleBanner ? '顶部标题' : `第 ${activePanel?.index} 格识别与译文`}
                  </h3>

                  {/* Status Badges */}
                  {isRecognizing && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>正在识别...</span>
                    </span>
                  )}
                  {isTranslating && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>正在翻译...</span>
                    </span>
                  )}
                  {isCompleted && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <Check className="w-3 h-3" />
                      <span>{activePanel.hasNoDialogue ? '无对白' : '完成'}</span>
                    </span>
                  )}
                  {hasError && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-800 border border-red-200">
                      <AlertTriangle className="w-3 h-3" />
                      <span>识别异常</span>
                    </span>
                  )}
                </div>

                {/* Action buttons: Single retry & revert */}
                <div className="flex items-center space-x-1.5">
                  {activePanel?.userEditedText && activePanel.initialOcrOriginalText && (
                    <button
                      type="button"
                      onClick={() => onRevertOcr(activePanel.id)}
                      className="px-2 py-1 text-xs font-medium text-[#75716B] hover:text-[#222725] bg-[#F5EFE0] hover:bg-[#EAE1D0] rounded-full border border-[#DFD5C2] cursor-pointer transition-all flex items-center space-x-1"
                      title="还原初始识别"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>还原</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isRetryingSingle || isRecognizing || isTranslating}
                    onClick={handleRetryClick}
                    className="px-2.5 py-1 text-xs font-medium bg-[#F5EFE0] hover:bg-[#EAE1D0] text-[#222725] rounded-full border border-[#DFD5C2] cursor-pointer transition-all flex items-center space-x-1 disabled:opacity-50"
                    title="重新识别与翻译"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRetryingSingle || isRecognizing ? 'animate-spin' : ''}`} />
                    <span>重译</span>
                  </button>
                </div>
              </div>

              {/* Error Banner */}
              {hasError && (
                <div className="p-2.5 bg-red-50/80 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-800">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span className="font-semibold">{activePanel?.ocrError || '识别或翻译遇到问题'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRetryClick}
                    className="ml-2 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shrink-0"
                  >
                    重试
                  </button>
                </div>
              )}

              {/* Missing API Key Guidance Banner */}
              {!hasApiKey && (
                <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                  <span>未配置 API Key，可直接手动校对或在设置中添加</span>
                </div>
              )}

              {/* Dialogue Inputs (Bubbles or Single box) */}
              <div className="space-y-3 pt-1">
                {activePanel?.speechBubbles && activePanel.speechBubbles.length > 0 ? (
                  /* Multiple Bubbles */
                  activePanel.speechBubbles.map((bubble, bIdx) => (
                    <div
                      key={bubble.id || bIdx}
                      className="p-3 bg-[#FAF7EF] rounded-xl border border-[#EAE2D2] space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#8F3E2E]">气泡 #{bIdx + 1}</span>

                        <div className="flex items-center space-x-1">
                          {/* Bubble Horizontal Alignment Hint */}
                          <div className="flex items-center bg-white p-0.5 rounded-lg border border-[#DFD7CC]">
                            <button
                              type="button"
                              onClick={() => handleBubbleChange(bubble.id, 'positionHint', 'left')}
                              className={`p-1 rounded cursor-pointer ${
                                bubble.positionHint === 'left' ? 'bg-[#222725] text-white' : 'text-[#75716B]'
                              }`}
                              title="靠左"
                            >
                              <AlignLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBubbleChange(bubble.id, 'positionHint', 'center')}
                              className={`p-1 rounded cursor-pointer ${
                                bubble.positionHint === 'center' ? 'bg-[#222725] text-white' : 'text-[#75716B]'
                              }`}
                              title="居中"
                            >
                              <AlignCenter className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBubbleChange(bubble.id, 'positionHint', 'right')}
                              className={`p-1 rounded cursor-pointer ${
                                bubble.positionHint === 'right' ? 'bg-[#222725] text-white' : 'text-[#75716B]'
                              }`}
                              title="靠右"
                            >
                              <AlignRight className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {activePanel.speechBubbles.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteBubble(bubble.id)}
                              className="text-[#999] hover:text-red-600 p-1 cursor-pointer"
                              title="删除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Original English Text */}
                      <div>
                        <label className="text-[11px] text-[#75716B] block mb-1">
                          英文原文:
                        </label>
                        <textarea
                          rows={2}
                          value={bubble.originalText || ''}
                          onChange={(e) => handleBubbleChange(bubble.id, 'originalText', e.target.value)}
                          placeholder="英文原文..."
                          className="w-full text-base sm:text-sm px-3 py-1.5 bg-white border border-[#DFD7CC] rounded-xl text-[#222725] focus:outline-none focus:ring-1 focus:ring-[#222725] resize-y leading-relaxed"
                        />
                      </div>

                      {/* Translated Chinese Text */}
                      <div>
                        <label className="text-[11px] font-bold text-[#8F3E2E] block mb-1">
                          中文译文:
                        </label>
                        <textarea
                          rows={2}
                          value={bubble.translatedText || ''}
                          onChange={(e) => handleBubbleChange(bubble.id, 'translatedText', e.target.value)}
                          placeholder="中文译文 (支持回车换行)..."
                          className="w-full text-base sm:text-sm font-medium px-3 py-1.5 bg-white border border-[#8F3E2E]/40 rounded-xl text-[#8F3E2E] focus:outline-none focus:ring-1 focus:ring-[#8F3E2E] resize-y leading-relaxed"
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  /* Fallback single text area */
                  <div className="space-y-2.5">
                    <div>
                      <label className="text-xs text-[#75716B] block mb-1">英文原文:</label>
                      <textarea
                        rows={2}
                        value={activePanel?.originalTextCombined || ''}
                        onChange={(e) => {
                          if (!activePanel) return;
                          onUpdatePanelText(activePanel.id, {
                            originalText: e.target.value,
                            userEditedText: true,
                            userEditedOriginalText: true,
                            hasNoDialogue: false,
                          });
                        }}
                        className="w-full text-base sm:text-sm px-3 py-1.5 bg-[#FAF7EF] border border-[#DFD7CC] rounded-xl text-[#222725] focus:outline-none focus:ring-1 focus:ring-[#222725] resize-y leading-relaxed"
                        placeholder="输入英文原文..."
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[#8F3E2E] block mb-1">
                        中文译文:
                      </label>
                      <textarea
                        rows={2}
                        value={activePanel?.translatedTextCombined || ''}
                        onChange={(e) => {
                          if (!activePanel) return;
                          onUpdatePanelText(activePanel.id, {
                            translatedText: e.target.value,
                            userEditedText: true,
                            userEditedTranslatedText: true,
                            hasNoDialogue: false,
                          });
                        }}
                        className="w-full text-base sm:text-sm font-medium px-3 py-1.5 bg-[#FAF7EF] border border-[#8F3E2E]/40 rounded-xl text-[#8F3E2E] focus:outline-none focus:ring-1 focus:ring-[#8F3E2E] resize-y leading-relaxed"
                        placeholder="输入中文译文 (支持回车换行)..."
                      />
                    </div>
                  </div>
                )}

                {/* Action row below inputs: Add bubble & Re-translate from current text */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleAddBubble}
                    className="py-1.5 px-3 text-xs font-medium text-[#75716B] hover:text-[#222725] bg-[#F5EFE0] hover:bg-[#EAE1D0] border border-dashed border-[#DFD5C2] rounded-xl transition-colors cursor-pointer flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>添加气泡</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleNoDialogue}
                    className={`py-1.5 px-3 text-xs font-medium rounded-xl border transition-colors cursor-pointer flex items-center space-x-1 ${
                      activePanel?.hasNoDialogue
                        ? 'bg-[#8F3E2E] text-white border-[#8F3E2E]'
                        : 'bg-[#F5EFE0] text-[#75716B] hover:text-[#222725] border-[#DFD5C2]'
                    }`}
                    title="标记为无对白"
                  >
                    <MessageSquareOff className="w-3.5 h-3.5" />
                    <span>{activePanel?.hasNoDialogue ? '已设无对白' : '无对白'}</span>
                  </button>

                  {activePanel?.originalTextCombined && !activePanel.hasNoDialogue && (
                    <button
                      type="button"
                      disabled={isTranslatingText}
                      onClick={handleTranslateOriginalClick}
                      className="py-1.5 px-3 text-xs font-medium text-[#8F3E2E] hover:text-[#6f2e22] bg-[#FAF3EE] hover:bg-[#F3E5DE] border border-[#ECD1C8] rounded-xl transition-colors cursor-pointer flex items-center space-x-1 ml-auto"
                      title="按当前英文原文重新翻译"
                    >
                      <Languages className={`w-3.5 h-3.5 ${isTranslatingText ? 'animate-spin' : ''}`} />
                      <span>重新翻译</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right Module: 译文与排版 (Typography & Text Layout) */}
            <div className="bg-white/90 rounded-2xl p-4 border border-[#EAE3D2] space-y-3.5">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-[#F0EBE0] gap-2">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-[#FAF7EF] rounded-lg border border-[#DFD7CC] text-[#8F3E2E]">
                    <Type className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-[#222725]">译文与排版</h3>
                </div>

                <div className="flex items-center space-x-1.5 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() =>
                      activePanel &&
                      onUpdatePanelTypography(activePanel.id, {
                        customFontSize: undefined,
                        customYOffset: 0,
                        customXOffset: 0,
                        customAlign: 'auto',
                      })
                    }
                    className="px-2 py-1 text-xs text-[#75716B] hover:text-[#222725] hover:bg-[#F2ECE0] rounded-lg cursor-pointer transition-colors"
                    title="恢复此格文字排版为默认"
                  >
                    恢复默认
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyToAllTypography}
                    className="px-2.5 py-1 text-xs font-semibold bg-[#F5EFE0] hover:bg-[#EAE1D0] text-[#222725] rounded-full border border-[#DFD5C2] cursor-pointer transition-all flex items-center space-x-1"
                    title="将当前文字排版参数应用到全部格"
                  >
                    {copiedAllFeedback ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">已套用</span>
                      </>
                    ) : (
                      <>
                        <CopyCheck className="w-3.5 h-3.5" />
                        <span>套用全篇</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Typography Controls */}
              <div className="space-y-4 text-xs">
                {/* 1. Font Size Control */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#222725] flex items-center space-x-1">
                      <Type className="w-3.5 h-3.5 text-[#75716B]" />
                      <span>字号</span>
                    </span>
                    {/* Figma-style font size input with presets dropdown */}
                    <div className="relative flex items-center" ref={fontDropdownRef}>
                      <div className="flex items-center bg-[#F3EFE6] hover:bg-[#ECE6D8] border border-[#D9D1C3] focus-within:border-[#8F3E2E] focus-within:ring-1 focus-within:ring-[#8F3E2E]/30 rounded-lg transition-all">
                        <input
                          id="font-size-manual-input"
                          type="number"
                          min={10}
                          max={160}
                          value={fontSizeInput}
                          onChange={(e) => {
                            const text = e.target.value;
                            setFontSizeInput(text);
                            const val = parseInt(text, 10);
                            if (!isNaN(val) && val >= 10 && val <= 160 && activePanel) {
                              onUpdatePanelTypography(activePanel.id, {
                                customFontSize: val,
                              });
                            }
                          }}
                          onBlur={() => {
                            const val = parseInt(fontSizeInput, 10);
                            if (isNaN(val) || val < 10) {
                              setFontSizeInput(String(currentFontSize));
                            } else {
                              const clamped = Math.min(160, Math.max(10, val));
                              setFontSizeInput(String(clamped));
                              if (activePanel) {
                                onUpdatePanelTypography(activePanel.id, { customFontSize: clamped });
                              }
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                              setIsFontDropdownOpen(false);
                            }
                          }}
                          className="w-10 text-center py-1 pl-1 text-xs font-semibold font-mono text-[#222725] bg-transparent focus:outline-none cursor-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          title="直接输入字号数值"
                        />
                        <div className="w-[1px] h-3.5 bg-[#D9D1C3]" />
                        <button
                          type="button"
                          onClick={() => setIsFontDropdownOpen((prev) => !prev)}
                          className="px-1.5 py-1 text-[#75716B] hover:text-[#222725] transition-colors cursor-pointer rounded-r-lg flex items-center justify-center"
                          title="展开字号下拉选择"
                        >
                          <ChevronDown
                            className={`w-3 h-3 transition-transform ${isFontDropdownOpen ? 'rotate-180 text-[#222725]' : ''}`}
                          />
                        </button>
                      </div>

                      {/* Figma-style Dark Dropdown Menu */}
                      {isFontDropdownOpen && (
                        <div
                          className="absolute right-0 top-full mt-1 w-28 max-h-60 overflow-y-auto bg-[#1E1E1E] text-white rounded-xl border border-[#333333] py-1 px-1 z-50 animate-in fade-in zoom-in-95 duration-100 font-mono text-xs select-none"
                          style={{ scrollbarWidth: 'thin' }}
                        >
                          {FONT_SIZE_PRESETS.map((size) => {
                            const isSelected = size === currentFontSize;
                            return (
                              <button
                                key={size}
                                type="button"
                                onClick={() => {
                                  setFontSizeInput(String(size));
                                  if (activePanel) {
                                    onUpdatePanelTypography(activePanel.id, { customFontSize: size });
                                  }
                                  setIsFontDropdownOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#0D99FF] text-white font-bold'
                                    : 'text-[#E5E5E5] hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <span className="w-4 flex items-center justify-center shrink-0">
                                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                                </span>
                                <span className="flex-1 text-center font-mono">{size}</span>
                                <span className="w-4 shrink-0" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() =>
                        activePanel &&
                        onUpdatePanelTypography(activePanel.id, {
                          customFontSize: Math.max(10, currentFontSize - 2),
                        })
                      }
                      className="w-7 h-7 rounded-lg bg-[#F5EFE0] hover:bg-[#EAE1D0] font-bold text-[#222725] flex items-center justify-center cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min={10}
                      max={Math.max(64, currentFontSize)}
                      step={1}
                      value={currentFontSize}
                      onChange={(e) =>
                        activePanel &&
                        onUpdatePanelTypography(activePanel.id, {
                          customFontSize: Number(e.target.value),
                        })
                      }
                      className="flex-1 accent-[#8F3E2E] cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        activePanel &&
                        onUpdatePanelTypography(activePanel.id, {
                          customFontSize: Math.min(120, currentFontSize + 2),
                        })
                      }
                      className="w-7 h-7 rounded-lg bg-[#F5EFE0] hover:bg-[#EAE1D0] font-bold text-[#222725] flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 2. Vertical Position Offset (Up / Down) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#222725] flex items-center space-x-1">
                      <MoveVertical className="w-3.5 h-3.5 text-[#75716B]" />
                      <span>垂直位置</span>
                    </span>
                    <span className="text-[#8F3E2E] font-bold font-mono">
                      {currentYOffset > 0 ? `+${currentYOffset}` : currentYOffset}px
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() =>
                        activePanel &&
                        onUpdatePanelTypography(activePanel.id, {
                          customYOffset: Math.max(-100, currentYOffset - 5),
                        })
                      }
                      className="px-2 py-1 rounded-lg bg-[#F5EFE0] hover:bg-[#EAE1D0] text-[11px] font-medium text-[#222725] cursor-pointer"
                    >
                      向上
                    </button>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={2}
                      value={currentYOffset}
                      onChange={(e) =>
                        activePanel &&
                        onUpdatePanelTypography(activePanel.id, {
                          customYOffset: Number(e.target.value),
                        })
                      }
                      className="flex-1 accent-[#8F3E2E] cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        activePanel &&
                        onUpdatePanelTypography(activePanel.id, {
                          customYOffset: Math.min(100, currentYOffset + 5),
                        })
                      }
                      className="px-2 py-1 rounded-lg bg-[#F5EFE0] hover:bg-[#EAE1D0] text-[11px] font-medium text-[#222725] cursor-pointer"
                    >
                      向下
                    </button>
                  </div>
                </div>

                {/* 3. Horizontal Position Offset (Left / Right) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#222725] flex items-center space-x-1">
                      <MoveHorizontal className="w-3.5 h-3.5 text-[#75716B]" />
                      <span>水平位置</span>
                    </span>
                    <span className="text-[#8F3E2E] font-bold font-mono">
                      {currentXOffset > 0 ? `+${currentXOffset}` : currentXOffset}px
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() =>
                        activePanel &&
                        onUpdatePanelTypography(activePanel.id, {
                          customXOffset: Math.max(-150, currentXOffset - 5),
                        })
                      }
                      className="px-2 py-1 rounded-lg bg-[#F5EFE0] hover:bg-[#EAE1D0] text-[11px] font-medium text-[#222725] cursor-pointer"
                    >
                      向左
                    </button>
                    <input
                      type="range"
                      min={-150}
                      max={150}
                      step={2}
                      value={currentXOffset}
                      onChange={(e) =>
                        activePanel &&
                        onUpdatePanelTypography(activePanel.id, {
                          customXOffset: Number(e.target.value),
                        })
                      }
                      className="flex-1 accent-[#8F3E2E] cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        activePanel &&
                        onUpdatePanelTypography(activePanel.id, {
                          customXOffset: Math.min(150, currentXOffset + 5),
                        })
                      }
                      className="px-2 py-1 rounded-lg bg-[#F5EFE0] hover:bg-[#EAE1D0] text-[11px] font-medium text-[#222725] cursor-pointer"
                    >
                      向右
                    </button>
                  </div>
                </div>

                {/* 4. Horizontal Alignment */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#222725]">对齐方式</span>
                    <span className="text-[11px] text-[#75716B]">
                      {currentAlign === 'split'
                        ? '左右分栏'
                        : currentAlign === 'center'
                        ? '居中对齐'
                        : currentAlign === 'right'
                        ? '居右对齐'
                        : '居左对齐'}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 p-1 bg-[#FAF7EF] rounded-xl border border-[#DFD7CC]">
                    <button
                      type="button"
                      onClick={() =>
                        activePanel && onUpdatePanelTypography(activePanel.id, { customAlign: 'left' })
                      }
                      className={`py-1.5 rounded-lg font-medium cursor-pointer transition-all flex items-center justify-center space-x-1 ${
                        currentAlign === 'left'
                          ? 'bg-[#222725] text-white'
                          : 'text-[#75716B] hover:text-[#222725]'
                      }`}
                      title="居左对齐 (贴近漫画左边缘)"
                    >
                      <AlignLeft className="w-3.5 h-3.5" />
                      <span>居左</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        activePanel && onUpdatePanelTypography(activePanel.id, { customAlign: 'center' })
                      }
                      className={`py-1.5 rounded-lg font-medium cursor-pointer transition-all flex items-center justify-center space-x-1 ${
                        currentAlign === 'center'
                          ? 'bg-[#222725] text-white'
                          : 'text-[#75716B] hover:text-[#222725]'
                      }`}
                      title="居中对齐"
                    >
                      <AlignCenter className="w-3.5 h-3.5" />
                      <span>居中</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        activePanel && onUpdatePanelTypography(activePanel.id, { customAlign: 'right' })
                      }
                      className={`py-1.5 rounded-lg font-medium cursor-pointer transition-all flex items-center justify-center space-x-1 ${
                        currentAlign === 'right'
                          ? 'bg-[#222725] text-white'
                          : 'text-[#75716B] hover:text-[#222725]'
                      }`}
                      title="居右对齐"
                    >
                      <AlignRight className="w-3.5 h-3.5" />
                      <span>居右</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        activePanel && onUpdatePanelTypography(activePanel.id, { customAlign: 'split' })
                      }
                      className={`py-1.5 rounded-lg font-medium cursor-pointer transition-all flex items-center justify-center space-x-1 ${
                        currentAlign === 'split'
                          ? 'bg-[#222725] text-white'
                          : 'text-[#75716B] hover:text-[#222725]'
                      }`}
                      title="左右分栏"
                    >
                      <Columns className="w-3.5 h-3.5" />
                      <span>分栏</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Finished Artworks Thumbnail Strip (成品预览缩略图) */}
      <div className="mt-5 sm:mt-6 pt-3.5 pb-2 border-t border-[#EAE3D2] w-full max-w-full overflow-hidden">
        <div className="flex items-center justify-between px-1 mb-2.5">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-[#222725] flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-[#8F3E2E]" />
              <span>全篇排版缩略图</span>
            </span>
            <span className="text-xs sm:text-sm text-[#75716B] hidden sm:inline">
              · 共 {panels.length} 页，点击可直接切换并编辑当前页
            </span>
          </div>
          <div className="text-xs sm:text-sm text-[#75716B] flex items-center space-x-1.5">
            <span>当前：</span>
            <span className="font-bold text-[#222725] bg-[#F3EDE2] px-2 py-0.5 rounded-md border border-[#E2D8C6] text-xs sm:text-sm">
              {activePanel?.isTitleBanner ? '标题页' : `第 ${activeIndex + 1} 格`}
            </span>
            <span className="text-[#A09A90] text-xs sm:text-sm">/ {panels.length}</span>
          </div>
        </div>

        {/* Horizontally scrollable list */}
        <div
          ref={thumbnailContainerRef}
          className="flex items-center space-x-3 overflow-x-auto py-1.5 px-1 scrollbar-thin touch-pan-x"
        >
          {panels.map((panel, idx) => (
            <ThumbnailCard
              key={panel.id}
              panel={panel}
              index={idx}
              totalPanels={panels.length}
              isActive={panel.id === activePanel?.id}
              settings={settings}
              onClick={() => onSelectPanel(panel.id)}
            />
          ))}
        </div>
      </div>

      {/* Full Newspaper Reference Modal */}
      {showFullNewspaper && rawImageCanvas && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-[#FBF7EF] rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-[#EAE3D2]">
            <div className="p-3 px-4 border-b border-[#EAE3D2] flex items-center justify-between">
              <span className="font-bold text-sm text-[#222725]">完整报纸原图参考 (核对剧情)</span>
              <button
                type="button"
                onClick={() => setShowFullNewspaper(false)}
                className="p-1 rounded-full text-[#75716B] hover:text-[#222725] hover:bg-black/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-[#222725]/5">
              <img
                src={rawImageCanvas.toDataURL()}
                alt="Full Newspaper"
                className="max-h-[75vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Sticky Bottom Primary Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#FBF7EF]/90 backdrop-blur-md border-t border-[#EAE3D2] z-30 flex justify-center pb-safe">
        <div className="max-w-md w-full flex items-center space-x-3">
          <button
            type="button"
            onClick={onBackToStep2}
            className="text-sm font-medium text-[#75716B] hover:text-[#222725] px-3 py-2 cursor-pointer transition-colors"
          >
            返回裁切
          </button>

          <button
            id="btn-goto-typeset"
            type="button"
            onClick={onGoToStep4}
            className="flex-1 h-13 rounded-full bg-[#222725] hover:bg-[#151817] active:scale-98 text-[#FBF7EF] font-bold text-base flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <span>生成排版导出 →</span>
          </button>
        </div>
      </div>
    </div>
  );
};
