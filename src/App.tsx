import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ComicPanel, Quad, TypesetSettings, defaultTypesetSettings } from './types/comic';
import { Header } from './components/Header';
import { Step1Upload } from './components/Step1Upload';
import { Step2InspectCrop } from './components/Step2InspectCrop';
import { Step3EditTranslation } from './components/Step3EditTranslation';
import { Step4PreviewExport } from './components/Step4PreviewExport';
import {
  generateSampleNewspaperImage,
  SAMPLE_PANELS_DATA,
  SAMPLE_TITLE_BANNER,
} from './data/samplePeanutsData';
import {
  warpQuadToCanvas,
  autoSnapQuad,
  detectPanelsLocalCV,
  refinePanelQuadToOuterBorders,
} from './utils/imageProcessing';

export const App: React.FC = () => {
  // 4 steps workflow: 1: 上传报纸, 2: 检查裁切, 3: 编辑译文, 4: 预览导出
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [imageElement, setImageElement] = useState<HTMLCanvasElement | HTMLImageElement | null>(null);
  const [rawImageCanvas, setRawImageCanvas] = useState<HTMLCanvasElement | null>(null);

  const [panels, setPanels] = useState<ComicPanel[]>([]);
  const [activePanelId, setActivePanelId] = useState<string | null>(null);

  const [includeTitleBanner, setIncludeTitleBanner] = useState<boolean>(false);
  const [readingOrder, setReadingOrder] = useState<'ltr' | 'rtl'>('ltr');
  const [targetLang, setTargetLang] = useState<'zh-CN' | 'en'>('zh-CN');
  const [isSampleImage, setIsSampleImage] = useState<boolean>(false);

  const [settings, setSettings] = useState<TypesetSettings>(defaultTypesetSettings);

  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processStatus, setProcessStatus] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  // Check API health on mount
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setHasApiKey(Boolean(data?.hasApiKey));
      })
      .catch(() => {
        setHasApiKey(false);
      });
  }, []);

  // Ensure an HTMLCanvasElement is available for pixel processing
  const prepareCanvasFromImage = (
    img: HTMLCanvasElement | HTMLImageElement
  ): HTMLCanvasElement => {
    if (img instanceof HTMLCanvasElement) {
      return img;
    }
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0);
    }
    return canvas;
  };

  // Helper to re-crop panel using perspective warp
  const recropPanel = useCallback(
    (canvas: HTMLCanvasElement, quad: Quad): string => {
      const croppedCanvas = warpQuadToCanvas(canvas, quad, 1200);
      return croppedCanvas.toDataURL('image/png');
    },
    []
  );

  // Load sample Peanuts newspaper page
  const handleLoadSample = useCallback(() => {
    setIsProcessing(true);
    setProcessStatus('正在载入花生漫画整版报纸...');
    setIsSampleImage(true);

    setTimeout(() => {
      const sampleCanvas = generateSampleNewspaperImage();
      setImageElement(sampleCanvas);
      setRawImageCanvas(sampleCanvas);

      // Build initial panels from sample
      const initialPanels: ComicPanel[] = [];

      if (includeTitleBanner) {
        const titleCrop = recropPanel(sampleCanvas, SAMPLE_TITLE_BANNER.quad);
        initialPanels.push({
          ...SAMPLE_TITLE_BANNER,
          cachedCroppedUrl: titleCrop,
        });
      }

      SAMPLE_PANELS_DATA.forEach((p) => {
        const croppedUrl = recropPanel(sampleCanvas, p.quad);
        initialPanels.push({
          ...p,
          cachedCroppedUrl: croppedUrl,
        });
      });

      setPanels(initialPanels);
      setActivePanelId(initialPanels[0]?.id || null);
      setIsProcessing(false);
      setProcessStatus('');
    }, 120);
  }, [includeTitleBanner, recropPanel]);

  // When user selects an image file or camera snapshot
  const handleImageSelected = (
    image: HTMLCanvasElement | HTMLImageElement,
    _rawFile?: File,
    _isSample?: boolean
  ) => {
    const canvas = prepareCanvasFromImage(image);
    setImageElement(image);
    setRawImageCanvas(canvas);
    setPanels([]);
    setActivePanelId(null);
    setIsSampleImage(Boolean(_isSample));
    setProcessStatus('');
  };

  const handleClearImage = () => {
    setImageElement(null);
    setRawImageCanvas(null);
    setPanels([]);
    setActivePanelId(null);
    setIsSampleImage(false);
    setProcessStatus('');
  };

  const isOverlappingWithTitle = (q: Quad, titleQuad: Quad | null): boolean => {
    if (!titleQuad || !q) return false;
    const minX1 = Math.min(q.topLeft.x, q.bottomLeft.x);
    const maxX1 = Math.max(q.topRight.x, q.bottomRight.x);
    const minY1 = Math.min(q.topLeft.y, q.topRight.y);
    const maxY1 = Math.max(q.bottomLeft.y, q.bottomRight.y);

    const minX2 = Math.min(titleQuad.topLeft.x, titleQuad.bottomLeft.x);
    const maxX2 = Math.max(titleQuad.topRight.x, titleQuad.bottomRight.x);
    const minY2 = Math.min(titleQuad.topLeft.y, titleQuad.topRight.y);
    const maxY2 = Math.max(titleQuad.bottomLeft.y, titleQuad.bottomRight.y);

    const interLeft = Math.max(minX1, minX2);
    const interTop = Math.max(minY1, minY2);
    const interRight = Math.min(maxX1, maxX2);
    const interBottom = Math.min(maxY1, maxY2);

    if (interRight <= interLeft || interBottom <= interTop) return false;

    const interArea = (interRight - interLeft) * (interBottom - interTop);
    const area1 = Math.max(0.0001, (maxX1 - minX1) * (maxY1 - minY1));
    const area2 = Math.max(0.0001, (maxX2 - minX2) * (maxY2 - minY2));
    const iou = interArea / (area1 + area2 - interArea);

    return iou > 0.28 || (interArea / area1) > 0.45;
  };

  // Auto Split & Detection Execution
  const handleRunAutoSplit = async () => {
    if (!rawImageCanvas) return;
    setIsProcessing(true);
    setProcessStatus('正在分析报纸漫画边框...');

    try {
      const canvas = rawImageCanvas;

      let detectedQuads: Quad[] = [];
      let detectedTitle: { quad: Quad; text: string } | null = null;
      let detectedBubblesMap: Record<number, any[]> = {};

      // Try calling server Gemini API if available
      if (hasApiKey) {
        setProcessStatus('正在调用 Gemini 智能视觉识别每格边框与气泡文字...');
        const base64Data = canvas.toDataURL('image/jpeg', 0.85);

        try {
          const res = await fetch('/api/split-detect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64Data }),
          });
          const json = await res.json();

          if (json.success && json.data?.panels?.length > 0) {
            if (json.data.titleBanner?.hasTitle && json.data.titleBanner?.quad) {
              detectedTitle = json.data.titleBanner;
            }

            // Exclude any panels that overlap with title banner
            const titleQ = detectedTitle?.quad || null;
            const validPanels = json.data.panels.filter((p: any) => {
              if (!titleQ) return true;
              return !isOverlappingWithTitle(p.quad, titleQ);
            });

            detectedQuads = validPanels.map((p: any) => p.quad);
            validPanels.forEach((p: any, idx: number) => {
              detectedBubblesMap[idx + 1] = p.speechBubbles || [];
            });
          }
        } catch (e) {
          console.warn('Gemini vision API error, falling back to local CV:', e);
        }
      }

      // If no panels detected via API or no API key, use local CV edge detection
      if (detectedQuads.length === 0) {
        setProcessStatus('正在运行本地计算机视觉多格边缘与分界线检测...');
        const cvResults = detectPanelsLocalCV(canvas);
        if (cvResults.panels && cvResults.panels.length > 0) {
          if (cvResults.titleBanner) {
            detectedTitle = { quad: cvResults.titleBanner.quad, text: '标题横幅' };
          }
          // Filter out any quad that overlaps with title banner
          const titleQ = detectedTitle?.quad || null;
          detectedQuads = cvResults.panels
            .filter((p) => (titleQ ? !isOverlappingWithTitle(p.quad, titleQ) : true))
            .map((p) => p.quad);
        } else if (isSampleImage) {
          // If sample demo, use standard sample panels (exactly 6 story panels)
          detectedQuads = SAMPLE_PANELS_DATA.map((p) => p.quad);
          detectedTitle = {
            quad: SAMPLE_TITLE_BANNER.quad,
            text: SAMPLE_TITLE_BANNER.originalTextCombined || 'PEANUTS featuring Good ol\' Charlie Brown',
          };
        } else {
          // Strict mandate: Do NOT invent fake fixed grids or arbitrary cuts
          console.warn('Auto split did not find distinct black border frames; marking for review.');
        }
      }

      setProcessStatus('正在精细拟合每格四条外沿黑框并校正透视...');

      // Preserve any panels that user previously customized manually
      const userEditedPanels = panels.filter((p) => p.userEdited);

      // Refine quads using edge fitting so edges hug the black ink border outer edge
      const newPanels: ComicPanel[] = [];

      // If user enabled title banner
      if (includeTitleBanner) {
        const titleQuad = detectedTitle?.quad || SAMPLE_TITLE_BANNER.quad;
        const { quad: snappedTitle, diagnostics: titleDiag } = refinePanelQuadToOuterBorders(canvas, titleQuad);
        const titleCrop = recropPanel(canvas, snappedTitle);
        newPanels.push({
          id: 'panel-title',
          index: 0,
          isTitleBanner: true,
          quad: snappedTitle,
          borderDiagnostics: titleDiag,
          needsReview: titleDiag.overallConfidence < 0.65 || titleDiag.warnings.length > 0,
          speechBubbles: [],
          originalTextCombined: detectedTitle?.text || (isSampleImage ? SAMPLE_TITLE_BANNER.originalTextCombined : '标题'),
          translatedTextCombined: isSampleImage ? SAMPLE_TITLE_BANNER.translatedTextCombined : '',
          cachedCroppedUrl: titleCrop,
        });
      }

      // Process regular story panels (strictly numbered 1 to N, never including title banner)
      for (let i = 0; i < detectedQuads.length; i++) {
        const rawQuad = detectedQuads[i];

        // Check if there was an existing user-edited panel for this index
        const existingEdited = userEditedPanels.find((p) => p.index === i + 1);
        if (existingEdited) {
          newPanels.push(existingEdited);
          continue;
        }

        // High-precision RANSAC line fitting to outer boundary of all 4 borders
        const { quad: snapped, diagnostics } = refinePanelQuadToOuterBorders(canvas, rawQuad);
        const cropUrl = recropPanel(canvas, snapped);

        const sampleRef = isSampleImage ? SAMPLE_PANELS_DATA[i % SAMPLE_PANELS_DATA.length] : null;
        const bubbles = detectedBubblesMap[i + 1] || sampleRef?.speechBubbles || [];

        const origCombined =
          bubbles.map((b: any) => b.originalText).filter(Boolean).join('  ') ||
          sampleRef?.originalTextCombined ||
          '';
        const transCombined =
          bubbles.map((b: any) => b.translatedText).filter(Boolean).join('  ') ||
          sampleRef?.translatedTextCombined ||
          '';

        const needsReview = diagnostics.overallConfidence < 0.68 || diagnostics.warnings.length > 0;

        newPanels.push({
          id: `panel-${i + 1}`,
          index: i + 1,
          quad: snapped,
          borderDiagnostics: diagnostics,
          needsReview,
          speechBubbles: bubbles,
          originalTextCombined: origCombined,
          translatedTextCombined: transCombined,
          cachedCroppedUrl: cropUrl,
        });
      }

      // Reorder based on reading order
      if (readingOrder === 'rtl') {
        newPanels.reverse();
        newPanels.forEach((p, idx) => {
          if (!p.isTitleBanner) p.index = idx + 1;
        });
      }

      setPanels(newPanels);
      setActivePanelId(newPanels[0]?.id || null);
      setCurrentStep(2); // Go to Step 2: 检查裁切
    } catch (err: any) {
      alert('拆分识别过程中出现错误: ' + err.message);
    } finally {
      setIsProcessing(false);
      setProcessStatus('');
    }
  };

  // Update a single panel's quadrilateral (and re-crop + re-diagnose real-time)
  const handleUpdatePanelQuad = (id: string, quad: Quad) => {
    if (!rawImageCanvas) return;
    const cropUrl = recropPanel(rawImageCanvas, quad);
    const { diagnostics } = refinePanelQuadToOuterBorders(rawImageCanvas, quad);

    setPanels((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          return {
            ...p,
            quad,
            borderDiagnostics: diagnostics,
            needsReview: diagnostics.overallConfidence < 0.68 || diagnostics.warnings.length > 0,
            userEdited: true, // mark that user manually customized this panel
            cachedCroppedUrl: cropUrl,
          };
        }
        return p;
      })
    );
  };

  // Update text & dialogue
  const handleUpdatePanelText = (
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
  ) => {
    setPanels((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          return {
            ...p,
            ...(updates.originalText !== undefined ? { originalTextCombined: updates.originalText } : {}),
            ...(updates.translatedText !== undefined ? { translatedTextCombined: updates.translatedText } : {}),
            ...(updates.bubbles !== undefined ? { speechBubbles: updates.bubbles } : {}),
            ...(updates.userEditedText !== undefined ? { userEditedText: updates.userEditedText } : {}),
            ...(updates.userEditedOriginalText !== undefined ? { userEditedOriginalText: updates.userEditedOriginalText } : {}),
            ...(updates.userEditedTranslatedText !== undefined ? { userEditedTranslatedText: updates.userEditedTranslatedText } : {}),
            ...(updates.hasNoDialogue !== undefined ? { hasNoDialogue: updates.hasNoDialogue } : {}),
          };
        }
        return p;
      })
    );
  };

  // Update per-panel typography, comic layout, color adjustments and blend mode
  const handleUpdatePanelTypography = (
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
  ) => {
    setPanels((prev) =>
      prev.map((p) => {
        if (applyToAll) {
          // When applying to all, ONLY copy color adjustments and blend mode, never copy crop, scale, position or text layout
          return {
            ...p,
            ...(updates.colorAdjustments !== undefined ? { colorAdjustments: { ...updates.colorAdjustments } } : {}),
            ...(updates.blendMode !== undefined ? { blendMode: updates.blendMode } : {}),
          };
        }
        if (p.id === id) {
          return {
            ...p,
            ...(updates.customFontSize !== undefined ? { customFontSize: updates.customFontSize } : {}),
            ...(updates.customYOffset !== undefined ? { customYOffset: updates.customYOffset } : {}),
            ...(updates.customXOffset !== undefined ? { customXOffset: updates.customXOffset } : {}),
            ...(updates.customAlign !== undefined ? { customAlign: updates.customAlign } : {}),
            ...(updates.customGap !== undefined ? { customGap: updates.customGap } : {}),
            ...(updates.comicScale !== undefined ? { comicScale: updates.comicScale } : {}),
            ...(updates.comicOffsetX !== undefined ? { comicOffsetX: updates.comicOffsetX } : {}),
            ...(updates.comicOffsetY !== undefined ? { comicOffsetY: updates.comicOffsetY } : {}),
            ...(updates.colorAdjustments !== undefined ? { colorAdjustments: { ...updates.colorAdjustments } } : {}),
            ...(updates.blendMode !== undefined ? { blendMode: updates.blendMode } : {}),
          };
        }
        return p;
      })
    );
  };

  const handleResetPanelTypography = (id: string) => {
    setPanels((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          return {
            ...p,
            customFontSize: undefined,
            customYOffset: undefined,
            customXOffset: undefined,
            customAlign: undefined,
            customGap: undefined,
            comicScale: 1.0,
            comicOffsetX: 0,
            comicOffsetY: 0,
          };
        }
        return p;
      })
    );
  };

  const panelsRef = useRef<ComicPanel[]>(panels);
  useEffect(() => {
    panelsRef.current = panels;
  }, [panels]);

  const isOcrPipelineRunningRef = useRef(false);

  // Revert edited text back to initial AI OCR result
  const handleRevertOcr = (id: string) => {
    setPanels((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          return {
            ...p,
            originalTextCombined: p.initialOcrOriginalText || '',
            translatedTextCombined: p.initialOcrTranslatedText || '',
            speechBubbles: p.initialSpeechBubbles || [],
            userEditedText: false,
            userEditedOriginalText: false,
            userEditedTranslatedText: false,
          };
        }
        return p;
      })
    );
  };

  // Run visual OCR & translation on a single panel with field-level edit protection & retries
  const handleRunSinglePanelOcr = async (panel: ComicPanel, maxRetries = 2) => {
    if (!panel.cachedCroppedUrl) return;

    // Update status to recognizing
    setPanels((prev) =>
      prev.map((p) =>
        p.id === panel.id ? { ...p, ocrStatus: 'recognizing', ocrError: undefined } : p
      )
    );

    if (!hasApiKey) {
      // Local fallback for sample newspaper
      const sample = SAMPLE_PANELS_DATA.find((s) => s.index === panel.index);
      if (sample && !panel.originalTextCombined) {
        setPanels((prev) =>
          prev.map((p) =>
            p.id === panel.id
              ? {
                  ...p,
                  ocrStatus: 'completed',
                  originalTextCombined: sample.originalTextCombined,
                  translatedTextCombined: sample.translatedTextCombined,
                  speechBubbles: sample.speechBubbles,
                  initialOcrOriginalText: sample.originalTextCombined,
                  initialOcrTranslatedText: sample.translatedTextCombined,
                  initialSpeechBubbles: sample.speechBubbles,
                }
              : p
          )
        );
      } else {
        setPanels((prev) =>
          prev.map((p) =>
            p.id === panel.id
              ? {
                  ...p,
                  ocrStatus: p.originalTextCombined ? 'completed' : 'error',
                  ocrError: p.originalTextCombined
                    ? undefined
                    : '未配置 GEMINI_API_KEY。请在右上角设置中配置 API Key，或在下方输入框手动输入。',
                }
              : p
          )
        );
      }
      return;
    }

    let lastError = '';
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch('/api/panel-ocr-translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            panelId: panel.id,
            index: panel.index,
            totalPanels: panels.length,
            imageBase64: panel.cachedCroppedUrl,
            targetLang,
          }),
        });

        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          setPanels((prev) =>
            prev.map((p) => {
              if (p.id !== panel.id) return p;

              // Field-level protection: do not overwrite fields user has manually edited
              const protectOriginal = !!p.userEditedOriginalText;
              const protectTranslated = !!p.userEditedTranslatedText;

              // Compute speech bubbles merging edits
              let finalBubbles = d.speechBubbles || [];
              if (p.speechBubbles && p.speechBubbles.length > 0 && (protectOriginal || protectTranslated)) {
                finalBubbles = p.speechBubbles.map((b, idx) => {
                  const matching = d.speechBubbles?.[idx];
                  return {
                    ...b,
                    originalText: b.userEditedOriginal ? b.originalText : (matching?.originalText || b.originalText),
                    translatedText: b.userEditedTranslated ? b.translatedText : (matching?.translatedText || b.translatedText),
                  };
                });
              }

              const finalOriginal = protectOriginal ? p.originalTextCombined : d.originalTextCombined;
              const finalTranslated = protectTranslated ? p.translatedTextCombined : d.translatedTextCombined;

              const isTranslationFailed = d.translationFailed && !protectTranslated;

              return {
                ...p,
                ocrStatus: isTranslationFailed ? 'error' : 'completed',
                ocrError: isTranslationFailed ? '英文识别成功，翻译未完成，请点击重试翻译' : undefined,
                hasNoDialogue: !d.hasDialogue,
                originalTextCombined: finalOriginal,
                translatedTextCombined: finalTranslated,
                speechBubbles: finalBubbles,
                initialOcrOriginalText: d.originalTextCombined,
                initialOcrTranslatedText: d.translatedTextCombined,
                initialSpeechBubbles: d.speechBubbles,
              };
            })
          );
          return;
        } else {
          lastError = json.error || '识别失败，请重试';
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 1200));
          }
        }
      } catch (err: any) {
        lastError = err.message || '网络连接或服务异常';
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1200));
        }
      }
    }

    // Exhausted retries
    setPanels((prev) =>
      prev.map((p) =>
        p.id === panel.id
          ? {
              ...p,
              ocrStatus: 'error',
              ocrError: lastError || '识别或翻译遇到问题，请重试',
            }
          : p
      )
    );
  };

  // Re-translate from current modified original text without re-doing image OCR
  const handleTranslateFromOriginal = async (id: string, maxRetries = 2) => {
    const p = panelsRef.current.find((x) => x.id === id) || panels.find((x) => x.id === id);
    if (!p) return;

    if (!p.originalTextCombined?.trim() || p.originalTextCombined === '无对白') {
      return;
    }

    setPanels((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ocrStatus: 'translating', ocrError: undefined } : item
      )
    );

    if (!hasApiKey) {
      setPanels((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, ocrStatus: 'error', ocrError: '请配置 GEMINI_API_KEY 以使用 AI 自动翻译。' }
            : item
        )
      );
      return;
    }

    const payload = [
      {
        id: p.id,
        index: p.index,
        originalText: p.originalTextCombined || '',
        speechBubbles: p.speechBubbles,
      },
    ];

    let lastError = '';
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetLang, panels: payload }),
        });
        const json = await res.json();
        if (json.success && json.data?.panels?.[0]) {
          const resPanel = json.data.panels[0];
          setPanels((prev) =>
            prev.map((item) => {
              if (item.id !== id) return item;
              return {
                ...item,
                translatedTextCombined: resPanel.translatedTextCombined,
                speechBubbles: resPanel.speechBubbles || item.speechBubbles,
                ocrStatus: 'completed',
                ocrError: undefined,
                userEditedTranslatedText: false,
              };
            })
          );
          return;
        } else {
          lastError = json.error || '翻译失败';
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      } catch (e: any) {
        lastError = e.message || '翻译网络异常';
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    setPanels((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              ocrStatus: 'error',
              ocrError: lastError || '翻译未完成，请点击重试',
            }
          : item
      )
    );
  };

  // Trigger auto OCR & translation pipeline upon crop confirmation
  const triggerAutoOcrPipeline = async (priorityId: string | null) => {
    if (isOcrPipelineRunningRef.current) return;
    isOcrPipelineRunningRef.current = true;

    try {
      const currentList = [...panelsRef.current];
      // Sort so priority panel is processed first
      const sorted = currentList.sort((a, b) => {
        if (a.id === priorityId) return -1;
        if (b.id === priorityId) return 1;
        return a.index - b.index;
      });

      for (const item of sorted) {
        // Fetch up-to-date panel state from ref to avoid stale data
        const p = panelsRef.current.find((x) => x.id === item.id);
        if (!p) continue;

        // Skip if already completed
        if (p.ocrStatus === 'completed') continue;

        // If already has both original and translated text and not in error, mark completed
        if (p.originalTextCombined && p.translatedTextCombined && p.ocrStatus !== 'error') {
          setPanels((prev) =>
            prev.map((it) => (it.id === p.id ? { ...it, ocrStatus: 'completed' } : it))
          );
          continue;
        }

        // If original text is already present (e.g. recognized or typed), only translate text!
        if (p.originalTextCombined?.trim() && p.originalTextCombined !== '无对白' && (!p.translatedTextCombined || p.ocrStatus === 'error')) {
          await handleTranslateFromOriginal(p.id);
          await new Promise((r) => setTimeout(r, 300));
          continue;
        }

        // Full panel OCR and translate
        await handleRunSinglePanelOcr(p);
        await new Promise((r) => setTimeout(r, 300));
      }
    } finally {
      isOcrPipelineRunningRef.current = false;
    }
  };

  const handleGoToStep3 = () => {
    setCurrentStep(3);
    setTimeout(() => {
      triggerAutoOcrPipeline(activePanelId);
    }, 50);
  };

  // Add new panel
  const handleAddPanel = () => {
    if (!rawImageCanvas) return;
    const newIdx = panels.filter((p) => !p.isTitleBanner).length + 1;
    const defaultQuad: Quad = {
      topLeft: { x: 0.25, y: 0.25 },
      topRight: { x: 0.75, y: 0.25 },
      bottomRight: { x: 0.75, y: 0.55 },
      bottomLeft: { x: 0.25, y: 0.55 },
    };
    const snapped = autoSnapQuad(rawImageCanvas, defaultQuad, 10);
    const cropUrl = recropPanel(rawImageCanvas, snapped);

    const newPanel: ComicPanel = {
      id: `panel-${Date.now()}`,
      index: newIdx,
      quad: snapped,
      cachedCroppedUrl: cropUrl,
      originalTextCombined: '',
      translatedTextCombined: '',
      speechBubbles: [],
    };

    setPanels((prev) => [...prev, newPanel]);
    setActivePanelId(newPanel.id);
  };

  // Delete panel
  const handleDeletePanel = (id: string) => {
    setPanels((prev) => {
      const next = prev.filter((p) => p.id !== id);
      let idx = 1;
      next.forEach((p) => {
        if (!p.isTitleBanner) {
          p.index = idx++;
        }
      });
      return next;
    });
    if (activePanelId === id) {
      setActivePanelId(panels[0]?.id || null);
    }
  };

  // Toggle needs review
  const handleToggleNeedsReview = (id: string) => {
    setPanels((prev) =>
      prev.map((p) => (p.id === id ? { ...p, needsReview: !p.needsReview } : p))
    );
  };

  // Auto snap all panels (re-refine all 4 outer borders)
  const handleAutoSnapAllPanels = () => {
    if (!rawImageCanvas) return;
    setPanels((prev) =>
      prev.map((p) => {
        const { quad: snapped, diagnostics } = refinePanelQuadToOuterBorders(rawImageCanvas, p.quad);
        const cropUrl = recropPanel(rawImageCanvas, snapped);
        const needsReview = diagnostics.overallConfidence < 0.65 || diagnostics.warnings.length > 0;
        return {
          ...p,
          quad: snapped,
          borderDiagnostics: diagnostics,
          needsReview: p.userEdited ? p.needsReview : needsReview,
          cachedCroppedUrl: cropUrl,
        };
      })
    );
  };

  // Translate single panel
  const handleTranslateSinglePanel = async (id: string) => {
    const p = panels.find((x) => x.id === id);
    if (!p) return;

    if (!hasApiKey) {
      // Local preset fallback
      const sample = SAMPLE_PANELS_DATA.find((s) => s.index === p.index);
      if (sample) {
        handleUpdatePanelText(p.id, {
          translatedText: sample.translatedTextCombined,
          bubbles: sample.speechBubbles,
        });
      }
      return;
    }

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetLang,
          panels: [
            {
              id: p.id,
              index: p.index,
              originalText: p.originalTextCombined,
              speechBubbles: p.speechBubbles,
            },
          ],
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.panels?.[0]) {
        const resPanel = json.data.panels[0];
        handleUpdatePanelText(p.id, {
          translatedText: resPanel.translatedTextCombined,
          bubbles: resPanel.speechBubbles,
        });
      }
    } catch (e: any) {
      alert('翻译失败: ' + e.message);
    }
  };

  // Translate all panels
  const handleTranslateAllPanels = async () => {
    setIsTranslating(true);
    try {
      if (!hasApiKey) {
        // Apply sample translations if available
        setPanels((prev) =>
          prev.map((p) => {
            const sample = SAMPLE_PANELS_DATA.find((s) => s.index === p.index);
            if (sample) {
              return {
                ...p,
                translatedTextCombined: sample.translatedTextCombined,
                speechBubbles: sample.speechBubbles,
              };
            }
            return p;
          })
        );
        return;
      }

      const payload = panels.map((p) => ({
        id: p.id,
        index: p.index,
        originalText: p.originalTextCombined,
        speechBubbles: p.speechBubbles,
      }));

      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetLang, panels: payload }),
      });
      const json = await res.json();

      if (json.success && json.data?.panels) {
        const map = new Map(json.data.panels.map((x: any) => [x.id, x]));
        setPanels((prev) =>
          prev.map((p) => {
            const resPanel: any = map.get(p.id);
            if (resPanel) {
              return {
                ...p,
                translatedTextCombined: resPanel.translatedTextCombined,
                speechBubbles: resPanel.speechBubbles || p.speechBubbles,
              };
            }
            return p;
          })
        );
      }
    } catch (e: any) {
      alert('全篇翻译失败: ' + e.message);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF7EF] flex flex-col text-[#222725] font-sans antialiased selection:bg-[#8F3E2E]/20">
      {/* Top Header Navigation */}
      <Header
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        hasImage={Boolean(rawImageCanvas)}
        panelsCount={panels.length}
        hasApiKey={hasApiKey}
        onLoadSample={handleLoadSample}
      />

      {/* Step Views */}
      <main className="flex-1 flex flex-col">
        {/* Step 1: 上传报纸 */}
        {currentStep === 1 && (
          <Step1Upload
            onImageSelected={handleImageSelected}
            onRunAutoSplit={handleRunAutoSplit}
            includeTitleBanner={includeTitleBanner}
            onToggleIncludeTitleBanner={setIncludeTitleBanner}
            readingOrder={readingOrder}
            onChangeReadingOrder={setReadingOrder}
            targetLang={targetLang}
            onChangeTargetLang={setTargetLang}
            isProcessing={isProcessing}
            processStatus={processStatus}
            hasImageLoaded={Boolean(rawImageCanvas)}
            hasApiKey={hasApiKey}
            onLoadSample={handleLoadSample}
            onClearImage={handleClearImage}
            onContinueExisting={() => setCurrentStep(2)}
            existingPanelsCount={panels.length}
          />
        )}

        {/* Step 2: 检查裁切 */}
        {currentStep === 2 && (
          <Step2InspectCrop
            imageElement={imageElement}
            rawImageCanvas={rawImageCanvas}
            panels={panels}
            activePanelId={activePanelId}
            settings={settings}
            onSelectPanel={setActivePanelId}
            onUpdatePanelQuad={handleUpdatePanelQuad}
            onUpdatePanelTypography={handleUpdatePanelTypography}
            onAddPanel={handleAddPanel}
            onDeletePanel={handleDeletePanel}
            onToggleNeedsReview={handleToggleNeedsReview}
            onAutoSnapAllPanels={handleAutoSnapAllPanels}
            onGoToStep3={handleGoToStep3}
            onBackToStep1={() => setCurrentStep(1)}
          />
        )}

        {/* Step 3: 编辑译文 */}
        {currentStep === 3 && (
          <Step3EditTranslation
            panels={panels}
            activePanelId={activePanelId}
            settings={settings}
            onSelectPanel={setActivePanelId}
            onUpdatePanelText={handleUpdatePanelText}
            onUpdatePanelTypography={handleUpdatePanelTypography}
            onResetPanelTypography={handleResetPanelTypography}
            onRetryPanelOcr={async (id: string) => {
              const p = panels.find((x) => x.id === id);
              if (!p) return;
              if (p.originalTextCombined?.trim() && p.originalTextCombined !== '无对白') {
                await handleTranslateFromOriginal(p.id);
              } else {
                await handleRunSinglePanelOcr(p);
              }
            }}
            onTranslateFromOriginal={handleTranslateFromOriginal}
            onRevertOcr={handleRevertOcr}
            onTranslateAllPanels={handleTranslateAllPanels}
            onTriggerAutoOcr={() => triggerAutoOcrPipeline(activePanelId)}
            isTranslatingAll={isTranslating}
            hasApiKey={hasApiKey}
            rawImageCanvas={rawImageCanvas}
            onGoToStep4={() => setCurrentStep(4)}
            onBackToStep2={() => setCurrentStep(2)}
          />
        )}

        {/* Step 4: 预览导出 */}
        {currentStep === 4 && (
          <Step4PreviewExport
            panels={panels}
            settings={settings}
            onUpdateSettings={(newVals) => setSettings((prev) => ({ ...prev, ...newVals }))}
            onBackToStep3={() => setCurrentStep(3)}
          />
        )}
      </main>
    </div>
  );
};

export default App;
