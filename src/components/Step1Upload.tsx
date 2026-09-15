import React, { useRef, useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, Sparkles, ArrowRight, RotateCcw, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DoodleNewspaperUpload } from './HandDrawnIllustrations';

interface Step1UploadProps {
  onImageSelected: (
    image: HTMLCanvasElement | HTMLImageElement,
    rawFile?: File,
    isSample?: boolean
  ) => void;
  onRunAutoSplit: () => void;
  includeTitleBanner: boolean;
  onToggleIncludeTitleBanner: (val: boolean) => void;
  readingOrder: 'ltr' | 'rtl';
  onChangeReadingOrder: (order: 'ltr' | 'rtl') => void;
  targetLang: 'zh-CN' | 'en';
  onChangeTargetLang: (lang: 'zh-CN' | 'en') => void;
  isProcessing: boolean;
  processStatus: string;
  hasImageLoaded: boolean;
  hasApiKey: boolean;
  onLoadSample: () => void;
  onClearImage?: () => void;
  onContinueExisting?: () => void;
  existingPanelsCount?: number;
}

export const Step1Upload: React.FC<Step1UploadProps> = ({
  onImageSelected,
  onRunAutoSplit,
  includeTitleBanner,
  onToggleIncludeTitleBanner,
  readingOrder,
  onChangeReadingOrder,
  targetLang,
  onChangeTargetLang,
  isProcessing,
  processStatus,
  hasImageLoaded,
  hasApiKey,
  onLoadSample,
  onClearImage,
  onContinueExisting,
  existingPanelsCount = 0,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');

  // Drag & drop and loading states
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dragCounterRef = useRef<number>(0);

  // Unified single source of truth for upload success:
  const isUploadSuccess = Boolean(hasImageLoaded && !isLoadingFile && !errorMessage);

  // Dynamic light animated ellipsis for real-time loading feedback
  const [ellipsisDots, setEllipsisDots] = useState<string>('...');
  useEffect(() => {
    if (!isLoadingFile) return;
    let count = 1;
    const interval = setInterval(() => {
      count = (count % 3) + 1;
      setEllipsisDots('.'.repeat(count));
    }, 450);
    return () => clearInterval(interval);
  }, [isLoadingFile]);

  const showErrorMessage = (msg: string) => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
    }
    setErrorMessage(msg);
    errorTimerRef.current = setTimeout(() => {
      setErrorMessage(null);
    }, 10000);
  };

  // Prevent browser default file drop behavior globally to avoid navigating away or opening image
  useEffect(() => {
    const preventDefaultDrag = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventDefaultDrag);
    window.addEventListener('drop', preventDefaultDrag);
    return () => {
      window.removeEventListener('dragover', preventDefaultDrag);
      window.removeEventListener('drop', preventDefaultDrag);
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, []);

  const handleFile = async (file: File) => {
    // Validate format
    const isImage =
      file.type.startsWith('image/') ||
      /\.(jpe?g|png|webp|heic|heif|bmp|gif)$/i.test(file.name);
    if (!isImage) {
      showErrorMessage('请上传有效的图片文件 (PNG, JPG, WebP)');
      return;
    }

    // Validate size (limit to 30MB)
    const MAX_SIZE_MB = 30;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      showErrorMessage(`图片文件过大（单张建议不超过 ${MAX_SIZE_MB}MB）`);
      return;
    }

    setErrorMessage(null);
    setSelectedFileName(file.name);
    setIsLoadingFile(true);

    // Correctly handle mobile camera EXIF orientation using createImageBitmap
    if ('createImageBitmap' in window) {
      try {
        const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const canvas = document.createElement('canvas');
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bmp, 0, 0);
          onImageSelected(canvas, file, false);
          setIsLoadingFile(false);
          return;
        }
      } catch (err) {
        console.warn('createImageBitmap failed, falling back to standard Image loader:', err);
      }
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setIsLoadingFile(false);
      showErrorMessage('读取图片失败，请重试');
    };
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        onImageSelected(img, file, false);
        setIsLoadingFile(false);
      };
      img.onerror = () => {
        setIsLoadingFile(false);
        showErrorMessage('图片解码失败，请确认文件完整有效');
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Drag event handlers with anti-flicker counter
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const fileList = e.dataTransfer.files;
    if (!fileList || fileList.length === 0) return;

    if (fileList.length > 1) {
      showErrorMessage('一次请上传一张报纸照片');
      return;
    }

    const droppedFile = fileList[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between max-w-xl mx-auto w-full px-5 py-6 sm:py-8 pb-32">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFile(e.target.files[0]);
        }}
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFile(e.target.files[0]);
        }}
      />

      <div className="space-y-5 text-center">
        {/* Step Title & Subtitle */}
        <div className="space-y-1.5">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#222725] tracking-tight">
            上传报纸
          </h2>
          <p className="text-sm text-[#75716B] max-w-md mx-auto">
            拍摄或上传报纸漫画，自动裁切排版为 3:4 卡片
          </p>
        </div>

        {/* Hand-drawn Doodle Illustration & Desktop Drag-and-Drop Zone */}
        <div
          id="desktop-dropzone-container"
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          title="点击选择报纸照片，或直接拖拽文件至此"
          className={`group relative max-w-[420px] mx-auto w-full h-[310px] flex flex-col justify-center transition-all duration-200 cursor-pointer outline-none select-none rounded-2xl border-2 border-dashed ${
            isDragging
              ? 'border-[#8F3E2E] bg-[#FDF2EE] scale-[1.01] shadow-md ring-2 ring-[#8F3E2E]/20'
              : isUploadSuccess
                ? 'border-[#86EFAC] bg-[#F0FDF4]/90 hover:border-[#6EE7B7] hover:bg-[#ECFDF5]'
                : 'border-[#DFD5C2] bg-[#FAF6EE]/50 hover:border-[#AFA287] hover:bg-[#F5EDE0] hover:shadow-xs'
          } active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-[#8F3E2E]/30`}
        >
          {/* Non-interactive children to prevent drag flicker */}
          <div className="pointer-events-none select-none flex flex-col items-center justify-center">
            {/* Fixed visual stage: 195px x 195px illustration with identical newspaper body and smooth element transitions */}
            <div className="relative w-[195px] h-[195px] flex items-center justify-center">
              <DoodleNewspaperUpload size={195} isSuccess={isUploadSuccess} />
            </div>

            {/* Status prompt directly below illustration: enlarged font with clear interactive cues */}
            <div className="flex items-center justify-center mt-1.5 min-h-[30px] px-2 text-center transition-colors">
              {errorMessage ? (
                <span className="text-sm sm:text-[15px] text-[#8F3E2E] font-medium inline-flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 text-[#8F3E2E] shrink-0" />
                  <span className="truncate max-w-[280px]">照片上传失败，点击重选</span>
                </span>
              ) : isLoadingFile ? (
                <span className="text-sm sm:text-[15px] text-[#5C5040] font-medium inline-flex items-center space-x-1.5">
                  <Loader2 className="w-4 h-4 text-[#5C5040] animate-spin shrink-0" />
                  <span>正在加载照片</span>
                  <span className="w-4 text-left font-mono font-bold tracking-wider">{ellipsisDots}</span>
                </span>
              ) : isProcessing ? (
                <span className="text-sm sm:text-[15px] text-[#5C5040] font-medium inline-flex items-center space-x-1.5">
                  <Loader2 className="w-4 h-4 text-[#5C5040] animate-spin shrink-0" />
                  <span className="truncate max-w-[280px]">{processStatus || '正在分析照片边框与气泡...'}</span>
                </span>
              ) : isUploadSuccess ? (
                <span className="text-sm sm:text-[15px] text-[#1E6B47] font-semibold flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>照片上传成功，点击下方「开始拆分」</span>
                </span>
              ) : isDragging ? (
                <span className="text-sm sm:text-[15px] font-bold text-[#8F3E2E] tracking-wide inline-flex items-center space-x-1.5">
                  <span>松开即可上传报纸</span>
                </span>
              ) : (
                <span className="text-sm sm:text-[15px] text-[#787166] group-hover:text-[#222725] font-medium tracking-wide transition-colors">
                  将报纸照片拖到这里，或点击上传
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Inline Error Message Banner (preserves existing content) */}
        {errorMessage && (
          <div
            id="upload-error-message"
            className="max-w-sm mx-auto bg-[#FAF0ED] border border-[#E9CBC5] text-[#8F3E2E] text-xs px-3.5 py-2.5 rounded-xl flex items-center justify-between text-left"
          >
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#8F3E2E]" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-[#8F3E2E] hover:text-[#5A241A] cursor-pointer ml-2 p-0.5"
              title="关闭提示"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Primary Upload Actions (Camera & Photo Library) */}
        <div className="grid grid-cols-2 gap-3 max-w-[360px] mx-auto pt-1">
          <button
            id="btn-upload-camera"
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="h-13 bg-[#F2ECE0] hover:bg-[#EAE1D0] active:scale-97 text-[#222725] rounded-full font-medium text-sm transition-all border border-[#DFD5C2] flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Camera className="w-4 h-4 text-[#222725]" />
            <span>拍照上传</span>
          </button>

          <button
            id="btn-upload-file"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-13 bg-[#F2ECE0] hover:bg-[#EAE1D0] active:scale-97 text-[#222725] rounded-full font-medium text-sm transition-all border border-[#DFD5C2] flex items-center justify-center space-x-2 cursor-pointer"
          >
            <ImageIcon className="w-4 h-4 text-[#222725]" />
            <span>从相册选择</span>
          </button>
        </div>

        {/* Quick Sample Button */}
        <div className="pt-1">
          <button
            id="btn-load-sample-strip"
            type="button"
            onClick={() => {
              setSelectedFileName('花生漫画经典四格.png');
              onLoadSample();
            }}
            className="text-xs text-[#75716B] hover:text-[#222725] underline underline-offset-4 cursor-pointer transition-colors"
          >
            没有现成报纸？一键载入《花生漫画》样张体验
          </button>
        </div>

        {/* Already loaded indicator / Continue existing */}
        {hasImageLoaded && (
          <div className="bg-white rounded-2xl p-4 border border-[#EAE3D2] shadow-xs text-left max-w-[360px] mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-[#222725] max-w-[170px] truncate" title={selectedFileName || '报纸照片已就绪'}>
                  {selectedFileName ? selectedFileName : '报纸照片已就绪'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {existingPanelsCount > 0 && onContinueExisting && (
                  <button
                    type="button"
                    onClick={onContinueExisting}
                    className="text-xs text-[#8F3E2E] font-medium hover:underline cursor-pointer"
                  >
                    继续编辑 ({existingPanelsCount}格) →
                  </button>
                )}
                {onClearImage && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFileName('');
                      onClearImage();
                    }}
                    className="text-xs text-[#8A847A] hover:text-[#8F3E2E] hover:underline cursor-pointer"
                    title="清空当前照片并返回初始状态"
                  >
                    清空照片
                  </button>
                )}
              </div>
            </div>

            {/* Subtle Preferences Accordion/Row */}
            <div className="pt-2 border-t border-[#F0EBE0] space-y-2.5 text-xs text-[#554F47]">
              {/* Reading Order */}
              <div className="flex items-center justify-between">
                <span className="text-[#75716B]">阅读顺序</span>
                <div className="flex items-center space-x-2">
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="radio"
                      name="order"
                      checked={readingOrder === 'ltr'}
                      onChange={() => onChangeReadingOrder('ltr')}
                      className="accent-[#222725] text-[#222725] focus:ring-[#222725]"
                      style={{ accentColor: '#222725' }}
                    />
                    <span>左到右</span>
                  </label>
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="radio"
                      name="order"
                      checked={readingOrder === 'rtl'}
                      onChange={() => onChangeReadingOrder('rtl')}
                      className="accent-[#222725] text-[#222725] focus:ring-[#222725]"
                      style={{ accentColor: '#222725' }}
                    />
                    <span>右到左 (日漫)</span>
                  </label>
                </div>
              </div>

              {/* Title Banner */}
              <div className="flex items-center justify-between">
                <span className="text-[#75716B]">包含顶部标题横幅</span>
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeTitleBanner}
                    onChange={(e) => onToggleIncludeTitleBanner(e.target.checked)}
                    className="accent-[#222725] rounded text-[#222725] focus:ring-[#222725]"
                    style={{ accentColor: '#222725' }}
                  />
                  <span className="text-[11px] text-[#75716B]">(第 0 页)</span>
                </label>
              </div>

              {/* Target Language */}
              <div className="flex items-center justify-between">
                <span className="text-[#75716B]">对白译文</span>
                <div className="flex items-center space-x-2">
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="radio"
                      name="lang"
                      checked={targetLang === 'zh-CN'}
                      onChange={() => onChangeTargetLang('zh-CN')}
                      className="accent-[#222725] text-[#222725] focus:ring-[#222725]"
                      style={{ accentColor: '#222725' }}
                    />
                    <span>简体中文</span>
                  </label>
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="radio"
                      name="lang"
                      checked={targetLang === 'en'}
                      onChange={() => onChangeTargetLang('en')}
                      className="accent-[#222725] text-[#222725] focus:ring-[#222725]"
                      style={{ accentColor: '#222725' }}
                    />
                    <span>English</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Bottom Primary Action Button */}
      <div className="fixed bottom-6 left-0 right-0 z-30 flex justify-center px-4 pointer-events-none pb-safe">
        <div className="max-w-[360px] w-full pointer-events-auto">
          <button
            id="btn-run-auto-split"
            disabled={!hasImageLoaded || isProcessing}
            onClick={onRunAutoSplit}
            className={`w-full h-13 rounded-full font-bold text-base flex items-center justify-center space-x-2 transition-all active:scale-98 cursor-pointer shadow-md ${
              !hasImageLoaded
                ? 'bg-[#DDD6C8] text-[#8F887C] opacity-60 cursor-not-allowed'
                : isProcessing
                ? 'bg-[#3A3F3C] text-white cursor-wait'
                : 'bg-[#222725] hover:bg-[#151817] text-[#FBF7EF]'
            }`}
          >
            {isProcessing ? (
              <Sparkles className="w-5 h-5 animate-spin text-[#FBF7EF]" />
            ) : null}
            <span>
              {isProcessing
                ? processStatus || '正在分析中...'
                : '开始拆分 →'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
