/**
 * Server-side API Handlers for Gemini Vision Panel Detection and OCR/Translation
 */

import { GoogleGenAI } from '@google/genai';

let geminiClient: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

export async function handleHealthCheck(): Promise<{ ok: boolean; hasApiKey: boolean }> {
  const client = getGemini();
  return {
    ok: true,
    hasApiKey: !!client,
  };
}

/**
 * Candidate models with automatic failover across quota limits and transient spikes.
 * gemini-3.5-flash is ultra-fast with fresh quota; 3.1-flash-lite and others provide active fallbacks.
 */
const CANDIDATE_MODELS = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash'];

async function generateWithModelFallback(
  ai: any,
  models: string[],
  contents: any,
  config: any = {}
) {
  let lastErr: any = null;
  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents,
        config,
      });
      return res;
    } catch (err: any) {
      console.warn(`Model [${model}] failed (${err?.status || err?.message?.slice(0, 80)}), trying next candidate...`);
      lastErr = err;
    }
  }
  throw lastErr;
}

/**
 * Check intersection over union (IoU) of two quads using approximate bounding boxes
 */
function calculateQuadIoU(q1: any, q2: any): number {
  if (!q1 || !q2) return 0;
  const minX1 = Math.min(q1.topLeft?.x ?? 0, q1.bottomLeft?.x ?? 0);
  const maxX1 = Math.max(q1.topRight?.x ?? 1, q1.bottomRight?.x ?? 1);
  const minY1 = Math.min(q1.topLeft?.y ?? 0, q1.topRight?.y ?? 0);
  const maxY1 = Math.max(q1.bottomLeft?.y ?? 1, q1.bottomRight?.y ?? 1);

  const minX2 = Math.min(q2.topLeft?.x ?? 0, q2.bottomLeft?.x ?? 0);
  const maxX2 = Math.max(q2.topRight?.x ?? 1, q2.bottomRight?.x ?? 1);
  const minY2 = Math.min(q2.topLeft?.y ?? 0, q2.topRight?.y ?? 0);
  const maxY2 = Math.max(q2.bottomLeft?.y ?? 1, q2.bottomRight?.y ?? 1);

  const interLeft = Math.max(minX1, minX2);
  const interTop = Math.max(minY1, minY2);
  const interRight = Math.min(maxX1, maxX2);
  const interBottom = Math.min(maxY1, maxY2);

  if (interRight <= interLeft || interBottom <= interTop) return 0;

  const interArea = (interRight - interLeft) * (interBottom - interTop);
  const area1 = Math.max(0.0001, (maxX1 - minX1) * (maxY1 - minY1));
  const area2 = Math.max(0.0001, (maxX2 - minX2) * (maxY2 - minY2));

  return interArea / (area1 + area2 - interArea);
}

export async function handleSplitDetect(imageBase64: string): Promise<{
  success: boolean;
  hasApiKey: boolean;
  source: 'gemini' | 'local_fallback';
  data?: any;
  error?: string;
}> {
  const ai = getGemini();
  if (!ai) {
    return {
      success: false,
      hasApiKey: false,
      source: 'local_fallback',
      error: 'GEMINI_API_KEY 未配置，切换为前端本地几何边缘检测。',
    };
  }

  try {
    // Clean base64 header if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

    const prompt = `You are a professional computer vision expert specializing in comic book digitization and layout parsing.
Analyze this photo of a newspaper comic page.

STRICT PARSING PIPELINE (Execute in this exact logical order):
1. WHOLE-PAGE LAYOUT UNDERSTANDING:
   - Identify the overall visual structure of the newspaper comic page.
   - Detect the outermost black-bordered panels and gutters (whitespace separating panels).
   - Recognize if the photograph has perspective tilt, skew, or distortion.

2. DISTINGUISH TITLE BANNER (版头) vs. STORY PANELS (正文画格):
   - PURPOSE IDENTIFICATION:
     * A Title Banner / Masthead / Logo Header displays the comic series title (e.g. "PEANUTS", "Good ol' Charlie Brown"), syndicate masthead, publication byline ("by SCHULZ"), date, or title illustration. It does NOT contain sequential story dialogue and is NOT a narrative story panel.
     * Story Panels contain sequential character dialogue, narrative flow, and scene progression.
   - BANNER SEPARATION MANDATE:
     * If a Title Banner exists (whether it spans the top row, a header bar, or a corner logo cell), place it ONLY in "titleBanner".
     * CRITICAL RULE: DO NOT put the Title Banner in the "panels" array!
     * The "panels" array MUST strictly begin with the REAL FIRST STORY PANEL (e.g., Charlie Brown talking to his team).
     * The Title Banner MUST NOT be counted in the story panels count.

3. IDENTIFY AUTHENTIC STORY PANELS & CALIBRATE CORNERS:
   - Every story panel is bounded by its outer black ink perimeter frame.
   - TRACE EXACT OUTER BLACK BORDER: Coordinates (topLeft, topRight, bottomRight, bottomLeft) must trace the OUTSIDE edge of the black bounding ink frame.
   - DO NOT treat speech bubbles, characters, sound effects, or internal drawing lines as panel boundaries.
   - DO NOT slice or split a single panel into multiple panels because of speech bubbles or whitespace between characters.
   - DO NOT merge two adjacent panels across a gutter.
   - DO NOT force uniform grid or equal-width cuts. Trace the genuine drawn panel frames.
   - Preserve genuine corner coordinates if the photo is tilted or skewed (retain the quadrilateral shape; do not force a rigid axis-aligned rectangle).
   - Coordinates MUST be normalized from 0.0 to 1.0 ({x: 0, y: 0} is top-left, {x: 1, y: 1} is bottom-right).
   - Order the story panels in standard reading order (row by row, left to right, numbered 1, 2, 3...).

4. EXTRACT DIALOGUE SPEECH BUBBLES:
   - For each story panel, extract speech bubbles with their original text and relative position ('left', 'center', or 'right').

Return ONLY valid JSON matching this schema:
{
  "titleBanner": {
    "hasTitle": boolean,
    "quad": {
      "topLeft": {"x": number, "y": number},
      "topRight": {"x": number, "y": number},
      "bottomRight": {"x": number, "y": number},
      "bottomLeft": {"x": number, "y": number}
    },
    "text": "title text"
  },
  "panels": [
    {
      "index": number,
      "quad": {
        "topLeft": {"x": number, "y": number},
        "topRight": {"x": number, "y": number},
        "bottomRight": {"x": number, "y": number},
        "bottomLeft": {"x": number, "y": number}
      },
      "speechBubbles": [
        {
          "originalText": "string",
          "positionHint": "left" | "center" | "right"
        }
      ]
    }
  ]
}`;

    const response = await generateWithModelFallback(
      ai,
      CANDIDATE_MODELS,
      [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
      {
        responseMimeType: 'application/json',
      }
    );

    const text = response.text || '{}';
    const parsed = JSON.parse(text);

    // Rigorous Post-Processing: Guarantee Title Banner is NEVER inside regular panels array
    if (parsed.panels && Array.isArray(parsed.panels)) {
      const filteredPanels: any[] = [];
      const titleQuad = parsed.titleBanner?.hasTitle ? parsed.titleBanner.quad : null;

      for (const p of parsed.panels) {
        let isTitle = false;

        // 1. Overlap check with identified titleBanner
        if (titleQuad && calculateQuadIoU(p.quad, titleQuad) > 0.35) {
          isTitle = true;
        }

        // 2. Keyword check for masthead / title logos in top 35% of page
        const pCenterY = ((p.quad?.topLeft?.y ?? 0) + (p.quad?.bottomLeft?.y ?? 0)) / 2;
        const pText = (p.speechBubbles || []).map((b: any) => b.originalText || '').join(' ').toUpperCase();
        if (
          pCenterY < 0.35 &&
          (pText.includes('PEANUTS') ||
            pText.includes('CHARLIE BROWN') ||
            pText.includes('FEATURING') ||
            pText.includes('SCHULZ') ||
            pText.includes('BY SCHULZ'))
        ) {
          isTitle = true;
          // If titleBanner was not filled, populate it
          if (!parsed.titleBanner || !parsed.titleBanner.hasTitle) {
            parsed.titleBanner = {
              hasTitle: true,
              quad: p.quad,
              text: pText || 'PEANUTS featuring Good ol\' Charlie Brown',
            };
          }
        }

        if (!isTitle) {
          filteredPanels.push(p);
        }
      }

      // Re-index narrative panels from 1 to N
      filteredPanels.forEach((p, idx) => {
        p.index = idx + 1;
      });
      parsed.panels = filteredPanels;
    }

    return {
      success: true,
      hasApiKey: true,
      source: 'gemini',
      data: parsed,
    };
  } catch (err: any) {
    console.error('Gemini split detect error after all fallback models:', err);
    return {
      success: false,
      hasApiKey: true,
      source: 'local_fallback',
      error: err.message || 'Gemini 识别请求失败',
    };
  }
}

export async function handleTranslate(payload: {
  targetLang: 'zh-CN' | 'en';
  panels: Array<{
    id: string;
    index: number;
    originalText: string;
    speechBubbles?: Array<{ id: string; originalText: string; positionHint: string }>;
  }>;
}): Promise<{
  success: boolean;
  hasApiKey: boolean;
  data?: any;
  error?: string;
}> {
  const ai = getGemini();
  if (!ai) {
    return {
      success: false,
      hasApiKey: false,
      error: 'GEMINI_API_KEY 未配置，请在 AI Studio 设置中配置密钥。',
    };
  }

  try {
    const prompt = `You are a professional comic strip translator.
Translate the following comic dialogue bubbles from their original language into ${payload.targetLang === 'zh-CN' ? 'Simplified Chinese (简体中文)' : 'English'}.
Requirements:
1. Maintain global comic strip context, humorous tone, and consistent character names (e.g. Charlie Brown -> 查理·布朗, Snoopy -> 史努比, Woodstock -> 糊涂塌客, Linus -> 莱纳斯, Lucy -> 露西).
2. Keep short, natural dialogue suitable for reading above comic strip cards.
3. If original text is already in the target language, keep it intact. If a panel is marked "无对白" or empty, preserve it without hallucinating text.

Input panels:
${JSON.stringify(payload.panels, null, 2)}

Return ONLY valid JSON matching this schema:
{
  "panels": [
    {
      "id": "string (matching input id)",
      "translatedTextCombined": "string",
      "speechBubbles": [
        {
          "id": "string",
          "originalText": "string",
          "translatedText": "string",
          "positionHint": "left" | "center" | "right"
        }
      ]
    }
  ]
}`;

    const response = await generateWithModelFallback(
      ai,
      CANDIDATE_MODELS,
      [{ role: 'user', parts: [{ text: prompt }] }],
      { responseMimeType: 'application/json' }
    );

    const text = response.text || '{}';
    const parsed = JSON.parse(text);

    return {
      success: true,
      hasApiKey: true,
      data: parsed,
    };
  } catch (err: any) {
    console.error('Gemini translation error:', err);
    const msg = err.message || '';
    let friendly = '翻译请求失败';
    if (msg.includes('503') || err?.status === 503) {
      friendly = '模型服务暂时繁忙 (503)，请稍候点击重试。';
    } else if (msg.includes('429') || err?.status === 429) {
      friendly = '请求频次达到限制 (429)，请稍等几秒后重试。';
    }
    return {
      success: false,
      hasApiKey: true,
      error: friendly,
    };
  }
}

/**
 * Perform single-panel visual OCR and context-aware translation directly on the cropped panel image
 */
export async function handlePanelOcrTranslate(payload: {
  panelId: string;
  index: number;
  totalPanels?: number;
  imageBase64: string;
  targetLang?: 'zh-CN' | 'en';
  context?: string;
}): Promise<{
  success: boolean;
  hasApiKey: boolean;
  data?: {
    panelId: string;
    hasDialogue: boolean;
    originalTextCombined: string;
    translatedTextCombined: string;
    speechBubbles: Array<{
      id: string;
      originalText: string;
      translatedText: string;
      positionHint: 'left' | 'center' | 'right';
    }>;
    translationFailed?: boolean;
  };
  error?: string;
  statusCode?: number;
}> {
  const ai = getGemini();
  if (!ai) {
    return {
      success: false,
      hasApiKey: false,
      error: 'GEMINI_API_KEY 未配置。请在设置中配置密钥，或在输入框中手动输入原文与译文。',
      statusCode: 401,
    };
  }

  try {
    const base64Data = payload.imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = payload.imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    const targetLang = payload.targetLang || 'zh-CN';
    const targetLangName = targetLang === 'zh-CN' ? 'Simplified Chinese (简体中文)' : 'English';

    const prompt = `You are an expert comic strip OCR and translation engine.
Carefully examine this cropped comic panel image (Panel ${payload.index} of ${payload.totalPanels || 'strip'}).

TASK INSTRUCTIONS:
1. Visually examine all speech bubbles, thought clouds, or narration boxes in this comic panel.
2. Accurately transcribe the exact English text inside each speech bubble in natural reading order (top to bottom, left to right).
3. If there are multiple bubbles, identify each one separately. Indicate the horizontal location for each bubble in "positionHint":
   - "left": closer to left side / left character
   - "center": centered in panel
   - "right": closer to right side / right character
4. NO DIALOGUE CHECK: If this panel has NO speech bubble or dialogue text at all (e.g., pure action or silence), you MUST set "hasDialogue": false, "speechBubbles": [], "originalTextCombined": "无对白", and "translatedTextCombined": "". DO NOT invent or make up imaginary dialogue!
5. TRANSLATION: Translate each speech bubble into ${targetLangName}.
   - For Peanuts / classic comics: use standard recognized character names (Snoopy -> 史努比, Woodstock -> 糊涂塌客, Charlie Brown -> 查理·布朗, Lucy -> 露西, Linus -> 莱纳斯).
   - The translation tone should be natural, witty, expressive, and properly punctuated for comic reading.
   - Maintain consistency across bubbles.
6. Provide "originalTextCombined" (all original bubble texts joined with double spaces) and "translatedTextCombined" (all translated bubble texts joined with double spaces).

Return ONLY valid JSON with this exact structure:
{
  "hasDialogue": true,
  "originalTextCombined": "...",
  "translatedTextCombined": "...",
  "speechBubbles": [
    {
      "id": "bubble-1",
      "originalText": "...",
      "translatedText": "...",
      "positionHint": "left"
    }
  ]
}`;

    let response = await generateWithModelFallback(
      ai,
      CANDIDATE_MODELS,
      [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
      { responseMimeType: 'application/json' }
    );

    const rawText = (response.text || '').trim();
    let parsed: any = {};
    try {
      const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
      parsed = JSON.parse(cleaned || '{}');
    } catch (parseErr) {
      console.warn('Failed to parse Gemini JSON output:', rawText, parseErr);
      parsed = {};
    }

    // Normalize output
    const hasDialogue = parsed.hasDialogue !== false && parsed.originalTextCombined !== '无对白';
    const speechBubbles = Array.isArray(parsed.speechBubbles)
      ? parsed.speechBubbles.map((b: any, idx: number) => ({
          id: b.id || `bubble-${Date.now()}-${idx + 1}`,
          originalText: b.originalText || '',
          translatedText: b.translatedText || '',
          positionHint: (b.positionHint === 'right' || b.positionHint === 'center' ? b.positionHint : 'left') as 'left' | 'center' | 'right',
        }))
      : [];

    const origCombined = parsed.originalTextCombined || speechBubbles.map((b) => b.originalText).filter(Boolean).join('  ') || (hasDialogue ? '' : '无对白');
    let transCombined = parsed.translatedTextCombined || speechBubbles.map((b) => b.translatedText).filter(Boolean).join('  ') || '';

    // If dialogue English text was recognized but translation is missing, run quick fallback text translation
    if (hasDialogue && origCombined && origCombined !== '无对白' && (!transCombined || transCombined.trim() === '')) {
      try {
        const transRes = await generateWithModelFallback(
          ai,
          CANDIDATE_MODELS,
          [{
            role: 'user',
            parts: [{
              text: `Translate this comic dialogue accurately into ${targetLangName}:\n"${origCombined}"\nReturn ONLY the translated text without quotes or explanation.`
            }]
          }]
        );
        const quickText = (transRes.text || '').trim();
        if (quickText) {
          transCombined = quickText;
          if (speechBubbles.length === 1) {
            speechBubbles[0].translatedText = quickText;
          }
        }
      } catch (quickErr) {
        console.warn('Quick fallback translation failed:', quickErr);
      }
    }

    const translationFailed = hasDialogue && !!origCombined && origCombined !== '无对白' && !transCombined;

    return {
      success: true,
      hasApiKey: true,
      data: {
        panelId: payload.panelId,
        hasDialogue,
        originalTextCombined: origCombined,
        translatedTextCombined: transCombined,
        speechBubbles,
        translationFailed,
      },
    };
  } catch (err: any) {
    console.error(`Gemini OCR error on panel ${payload.panelId}:`, err);
    const msg = err.message || '';
    let friendly = '识别翻译失败';
    let statusCode = 500;
    if (msg.includes('503') || err?.status === 503) {
      friendly = '模型服务暂时繁忙 (503)，请点击重试。';
      statusCode = 503;
    } else if (msg.includes('429') || err?.status === 429) {
      friendly = '请求频率超限 (429)，请稍候点击重试。';
      statusCode = 429;
    } else if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
      friendly = 'API 配额不足或已被限制，请检查密钥。';
      statusCode = 429;
    }
    return {
      success: false,
      hasApiKey: true,
      error: friendly,
      statusCode,
    };
  }
}
