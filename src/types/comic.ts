/**
 * Types for Newspaper Comic Splitter & Typesetter
 */

export interface Point {
  x: number; // 0..1 normalized coordinates relative to original image width
  y: number; // 0..1 normalized coordinates relative to original image height
}

export interface Quad {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export interface SpeechBubble {
  id: string;
  originalText: string;
  translatedText: string;
  positionHint: 'left' | 'center' | 'right';
  box?: { x: number; y: number; width: number; height: number }; // normalized inside panel
  userEditedOriginal?: boolean;
  userEditedTranslated?: boolean;
}

export interface EdgeQuality {
  confidence: number; // 0..1 (1 = strong continuous black line)
  detected: boolean;
  angleDeg: number;
  outerEdgeOffsetPx: number;
  warning?: string;
}

export interface BorderDiagnostics {
  overallConfidence: number; // 0..1
  edges: {
    top: EdgeQuality;
    bottom: EdgeQuality;
    left: EdgeQuality;
    right: EdgeQuality;
  };
  warnings: string[];
}

export interface ComicPanel {
  id: string;
  index: number; // 1-based index in reading order
  isTitleBanner?: boolean;
  quad: Quad;
  needsReview?: boolean; // marked if border is unclear or distorted
  userEdited?: boolean; // marked if user manually dragged corners or nudged edges
  borderDiagnostics?: BorderDiagnostics;
  speechBubbles: SpeechBubble[];
  originalTextCombined?: string;
  translatedTextCombined?: string;
  cachedCroppedUrl?: string; // high-res perspective warped panel
  cachedAspect?: number; // width / height

  // Auto OCR & Translation tracking
  ocrStatus?: 'idle' | 'recognizing' | 'translating' | 'completed' | 'error';
  ocrError?: string;
  userEditedText?: boolean;
  userEditedOriginalText?: boolean;
  userEditedTranslatedText?: boolean;
  hasNoDialogue?: boolean;
  initialOcrOriginalText?: string;
  initialOcrTranslatedText?: string;
  initialSpeechBubbles?: SpeechBubble[];

  // Per-panel typesetting controls & overrides
  customFontSize?: number; // e.g. 20 to 52px
  customYOffset?: number; // vertical shift in px (-120 to +120)
  customXOffset?: number; // horizontal shift in px (-120 to +120)
  customAlign?: 'auto' | 'left' | 'center' | 'right' | 'split';
  customGap?: number; // spacing between text and comic top

  // Per-panel independent comic artwork transform (completely decoupled from text)
  comicScale?: number; // uniform scale ratio (default 1.0, range 0.4 - 2.5)
  comicOffsetX?: number; // horizontal shift of comic image (-400 to +400)
  comicOffsetY?: number; // vertical shift of comic image (-400 to +400)

  // Color adjustments (brightness, contrast, saturation in %)
  colorAdjustments?: {
    brightness: number; // default 100 (%) (range 50 to 150)
    contrast: number;   // default 100 (%) (range 50 to 150)
    saturation: number; // default 100 (%) (range 0 to 200)
  };

  // Blend mode with underlying paper texture
  blendMode?: 'normal' | 'multiply' | 'plus-darker'; // default 'plus-darker'
}

export interface TypesetSettings {
  aspectRatio: '3:4';
  resolution: {
    width: number;
    height: number;
  }; // 1080x1440 or 2160x2880
  paperStyle: 'warm_cream' | 'vintage_newsprint' | 'parchment' | 'clean_white' | 'custom';
  paperTextureIntensity: number; // 0 to 100
  customBackgroundUrl?: string;
  
  // Header / Signature
  showSignature: boolean;
  signatureText: string; // e.g. "@有个框艺术商店"
  signatureColor: string; // e.g. "rgba(100, 75, 55, 0.45)"
  signatureSize: number; // pt or px ratio
  
  // Translation text
  translationColor: string; // e.g. "#8f3e2e"
  translationFontFamily: string; // serif or sans
  translationFontSize: number;
  translationLineHeight: number;
  translationLetterSpacing: number;
  
  // Layout spacing
  horizontalMarginRatio: number; // e.g. 0.075 (7.5% margin on each side)
  spacingBetweenTextAndComic: number;
  
  // Page number
  showPageNumber: boolean;
  pageNumberFormat: 'index_total' | 'index_only' | 'page_index'; // "1/6", "1", "Page 1"
  pageNumberFontFamily: string; // Caveat / handwritten
  pageNumberColor: string;
  pageNumberSize: number;
  
  // Title page option
  includeTitlePage: boolean;
}

export const defaultTypesetSettings: TypesetSettings = {
  aspectRatio: '3:4',
  resolution: { width: 1080, height: 1440 },
  paperStyle: 'warm_cream',
  paperTextureIntensity: 45,
  showSignature: true,
  signatureText: '@有个框艺术商店',
  signatureColor: 'rgba(100, 75, 55, 0.45)',
  signatureSize: 28,
  translationColor: '#8f3e2e',
  translationFontFamily: 'serif',
  translationFontSize: 42,
  translationLineHeight: 1.4,
  translationLetterSpacing: 0.5,
  horizontalMarginRatio: 0.075,
  spacingBetweenTextAndComic: 10,
  showPageNumber: true,
  pageNumberFormat: 'index_total',
  pageNumberFontFamily: 'Caveat',
  pageNumberColor: '#1d1917',
  pageNumberSize: 64,
  includeTitlePage: false,
};

export interface DetectResponse {
  success: boolean;
  source: 'gemini' | 'local_cv' | 'sample';
  titleBanner?: {
    quad: Quad;
    title: string;
  };
  panels: Array<{
    quad: Quad;
    index: number;
    isTitleBanner?: boolean;
    needsReview?: boolean;
    detectedText?: string;
    speechBubbles?: Array<{
      originalText: string;
      positionHint?: 'left' | 'center' | 'right';
    }>;
  }>;
}

export interface TranslateResponse {
  success: boolean;
  panels: Array<{
    id: string;
    speechBubbles: Array<{
      id: string;
      originalText: string;
      translatedText: string;
      positionHint: 'left' | 'center' | 'right';
    }>;
    translatedTextCombined: string;
  }>;
}
