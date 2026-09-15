/**
 * Sample dataset replicating Attachment 1 (Peanuts / Charlie Brown Newspaper Strip)
 * Includes full high-res canvas procedural generator of the newspaper photo and pre-configured coordinates
 */

import { ComicPanel, Quad } from '../types/comic';

export const SAMPLE_QUADS: { title: Quad; panels: Quad[] } = {
  // Title Banner at top
  title: {
    topLeft: { x: 0.126, y: 0.071 },
    topRight: { x: 0.932, y: 0.081 },
    bottomRight: { x: 0.924, y: 0.288 },
    bottomLeft: { x: 0.118, y: 0.278 },
  },
  // 6 comic panels in 3 rows x 2 cols
  panels: [
    // 1. Charlie Brown talking to team: "ALL RIGHT, TEAM..HERE'S WHAT I HAVE TO SAY..."
    {
      topLeft: { x: 0.114, y: 0.301 },
      topRight: { x: 0.508, y: 0.307 },
      bottomRight: { x: 0.502, y: 0.510 },
      bottomLeft: { x: 0.108, y: 0.504 },
    },
    // 2. Team listening: "WE'VE BEEN MISSING TOO MANY SIGNALS LATELY..."
    {
      topLeft: { x: 0.519, y: 0.309 },
      topRight: { x: 0.922, y: 0.315 },
      bottomRight: { x: 0.916, y: 0.518 },
      bottomLeft: { x: 0.513, y: 0.512 },
    },
    // 3. Charlie Brown emphasizing: "IF WE KNOW OUR SIGNALS, WE JUST HAVE TO PAY ATTENTION..."
    {
      topLeft: { x: 0.104, y: 0.522 },
      topRight: { x: 0.499, y: 0.528 },
      bottomRight: { x: 0.493, y: 0.731 },
      bottomLeft: { x: 0.098, y: 0.725 },
    },
    // 4. "IT'S SIMPLY A MATTER OF CONCENTRATION"
    {
      topLeft: { x: 0.510, y: 0.530 },
      topRight: { x: 0.912, y: 0.536 },
      bottomRight: { x: 0.906, y: 0.739 },
      bottomLeft: { x: 0.504, y: 0.733 },
    },
    // 5. Close up: "ARE THERE ANY QUESTIONS?" / "I HAVE A QUESTION.."
    {
      topLeft: { x: 0.094, y: 0.743 },
      topRight: { x: 0.490, y: 0.749 },
      bottomRight: { x: 0.484, y: 0.952 },
      bottomLeft: { x: 0.088, y: 0.946 },
    },
    // 6. Lucy handstand bubble gum: "HOW DOES SHE DO THAT?"
    {
      topLeft: { x: 0.501, y: 0.751 },
      topRight: { x: 0.904, y: 0.757 },
      bottomRight: { x: 0.898, y: 0.960 },
      bottomLeft: { x: 0.495, y: 0.954 },
    },
  ],
};

export const SAMPLE_PANELS_DATA: ComicPanel[] = [
  {
    id: 'sample-panel-1',
    index: 1,
    quad: SAMPLE_QUADS.panels[0],
    originalTextCombined: "ALL RIGHT, TEAM..HERE'S WHAT I HAVE TO SAY...",
    translatedTextCombined: '好了，队员们，我有话要说……',
    speechBubbles: [
      {
        id: 'b-1',
        originalText: "ALL RIGHT, TEAM..HERE'S WHAT I HAVE TO SAY...",
        translatedText: '好了，队员们，我有话要说……',
        positionHint: 'left',
      },
    ],
  },
  {
    id: 'sample-panel-2',
    index: 2,
    quad: SAMPLE_QUADS.panels[1],
    originalTextCombined: "WE'VE BEEN MISSING TOO MANY SIGNALS LATELY.. I THINK IT'S BECAUSE WE'RE NOT CONCENTRATING...",
    translatedTextCombined: '我们最近漏掉了太多暗号……我觉得是因为我们不够专注……',
    speechBubbles: [
      {
        id: 'b-2',
        originalText: "WE'VE BEEN MISSING TOO MANY SIGNALS LATELY.. I THINK IT'S BECAUSE WE'RE NOT CONCENTRATING...",
        translatedText: '我们最近漏掉了太多暗号……我觉得是因为我们不够专注……',
        positionHint: 'left',
      },
    ],
  },
  {
    id: 'sample-panel-3',
    index: 3,
    quad: SAMPLE_QUADS.panels[2],
    originalTextCombined: 'IF WE KNOW OUR SIGNALS, WE JUST HAVE TO PAY ATTENTION...',
    translatedTextCombined: '只要我们熟悉暗号，集中注意力就行了……',
    speechBubbles: [
      {
        id: 'b-3',
        originalText: 'IF WE KNOW OUR SIGNALS, WE JUST HAVE TO PAY ATTENTION...',
        translatedText: '只要我们熟悉暗号，集中注意力就行了……',
        positionHint: 'left',
      },
    ],
  },
  {
    id: 'sample-panel-4',
    index: 4,
    quad: SAMPLE_QUADS.panels[3],
    originalTextCombined: "IT'S SIMPLY A MATTER OF CONCENTRATION",
    translatedTextCombined: '这纯粹是专注力的问题',
    speechBubbles: [
      {
        id: 'b-4',
        originalText: "IT'S SIMPLY A MATTER OF CONCENTRATION",
        translatedText: '这纯粹是专注力的问题',
        positionHint: 'center',
      },
    ],
  },
  {
    id: 'sample-panel-5',
    index: 5,
    quad: SAMPLE_QUADS.panels[4],
    originalTextCombined: 'ARE THERE ANY QUESTIONS?  I HAVE A QUESTION..',
    translatedTextCombined: '大家有什么问题吗？ 我有个问题……',
    speechBubbles: [
      {
        id: 'b-5-1',
        originalText: 'ARE THERE ANY QUESTIONS?',
        translatedText: '大家有什么问题吗？',
        positionHint: 'left',
      },
      {
        id: 'b-5-2',
        originalText: 'I HAVE A QUESTION..',
        translatedText: '我有个问题……',
        positionHint: 'right',
      },
    ],
  },
  {
    id: 'sample-panel-6',
    index: 6,
    quad: SAMPLE_QUADS.panels[5],
    originalTextCombined: 'HOW DOES SHE DO THAT?',
    translatedTextCombined: '她是怎么做到的？',
    speechBubbles: [
      {
        id: 'b-6',
        originalText: 'HOW DOES SHE DO THAT?',
        translatedText: '她是怎么做到的？',
        positionHint: 'center',
      },
    ],
  },
];

export const SAMPLE_TITLE_BANNER: ComicPanel = {
  id: 'sample-title-banner',
  index: 0,
  isTitleBanner: true,
  quad: SAMPLE_QUADS.title,
  originalTextCombined: 'PEANUTS featuring "Good ol\' Charlie Brown" by SCHULZ - EVERYBODY GATHER \'ROUND!',
  translatedTextCombined: '《花生漫画》查理·布朗与朋友们',
  speechBubbles: [
    {
      id: 'b-title',
      originalText: "EVERYBODY GATHER 'ROUND!",
      translatedText: '大家集合啦！',
      positionHint: 'right',
    },
  ],
};

/**
 * Procedurally render the authentic full newspaper photo matching Attachment 1
 * Includes:
 * - Outer photo frame with slight perspective tilt
 * - Warm aged newsprint background with paper grain
 * - Black outer borders with genuine comic hand-drawn thickness
 * - Detailed colorful Peanuts characters, dialogue speech bubbles, and baseball caps
 */
export function generateSampleNewspaperImage(): HTMLCanvasElement {
  const W = 1600;
  const H = 2160;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // 1. Outer matting / picture frame / desk photo background
  ctx.fillStyle = '#eae6df';
  ctx.fillRect(0, 0, W, H);

  // Slight shadow under the newspaper page
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetX = 8;
  ctx.shadowOffsetY = 12;

  // 2. Newspaper page with subtle tilt / perspective
  const pageX = 130;
  const pageY = 90;
  const pageW = 1340;
  const pageH = 1980;

  ctx.fillStyle = '#e8dfcd'; // aged newsprint color
  ctx.fillRect(pageX, pageY, pageW, pageH);
  ctx.restore();

  // Subtle paper grain across the newspaper
  ctx.save();
  ctx.fillStyle = 'rgba(120, 100, 70, 0.04)';
  for (let i = 0; i < 4000; i++) {
    const rx = pageX + Math.random() * pageW;
    const ry = pageY + Math.random() * pageH;
    ctx.fillRect(rx, ry, Math.random() * 2 + 1, Math.random() * 2 + 1);
  }
  ctx.restore();

  // Helper to draw a comic cell with thick black ink border
  const drawCell = (
    quad: Quad,
    bgFill: string,
    drawContent: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
  ) => {
    ctx.save();
    const p0 = { x: quad.topLeft.x * W, y: quad.topLeft.y * H };
    const p1 = { x: quad.topRight.x * W, y: quad.topRight.y * H };
    const p2 = { x: quad.bottomRight.x * W, y: quad.bottomRight.y * H };
    const p3 = { x: quad.bottomLeft.x * W, y: quad.bottomLeft.y * H };

    // Fill cell background inside border
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.fillStyle = bgFill;
    ctx.fill();

    // Clip to draw contents
    ctx.save();
    ctx.clip();
    const cellW = (p1.x - p0.x + p2.x - p3.x) / 2;
    const cellH = (p3.y - p0.y + p2.y - p1.y) / 2;
    ctx.translate(p0.x, p0.y);
    drawContent(ctx, cellW, cellH);
    ctx.restore();

    // Draw authentic thick hand-drawn black border (2.5px to 4px)
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#181716';
    ctx.lineJoin = 'miter';
    ctx.stroke();

    ctx.restore();
  };

  // Helper for speech bubble
  const drawBubble = (
    c: CanvasRenderingContext2D,
    bx: number,
    by: number,
    bw: number,
    bh: number,
    tailX: number,
    tailY: number,
    textLines: string[]
  ) => {
    c.save();
    c.fillStyle = '#fbf9f4';
    c.strokeStyle = '#181716';
    c.lineWidth = 2.5;

    // Oval bubble with tail
    c.beginPath();
    c.ellipse(bx + bw / 2, by + bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    // Tail
    c.beginPath();
    c.moveTo(bx + bw * 0.3, by + bh * 0.85);
    c.lineTo(tailX, tailY);
    c.lineTo(bx + bw * 0.5, by + bh * 0.85);
    c.fillStyle = '#fbf9f4';
    c.fill();
    c.stroke();

    // Inner text
    c.fillStyle = '#181716';
    c.font = 'bold 15px "Caveat", "Noto Sans SC", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const lineHeight = 17;
    const startY = by + bh / 2 - ((textLines.length - 1) * lineHeight) / 2;
    textLines.forEach((line, i) => {
      c.fillText(line, bx + bw / 2, startY + i * lineHeight);
    });
    c.restore();
  };

  // 1. Title Banner
  drawCell(SAMPLE_QUADS.title, '#e9d758', (c, w, h) => {
    // Title text
    c.fillStyle = '#c8281e';
    c.font = '900 48px "Impact", "Arial Black", sans-serif';
    c.fillText('PEANUTS', 40, 60);

    c.font = 'italic bold 22px "Georgia", serif';
    c.fillStyle = '#222';
    c.fillText('featuring', 100, 92);

    c.font = '900 42px "Impact", "Arial Black", sans-serif';
    c.fillStyle = '#c8281e';
    c.fillText('"Good ol\'', 35, 140);
    c.fillText('Charlie Brown"', 35, 185);

    c.font = 'italic bold 22px "Brush Script MT", cursive, sans-serif';
    c.fillStyle = '#222';
    c.fillText('by SCHULZ', 120, 220);

    // Green bench
    c.fillStyle = '#2b7a4b';
    c.fillRect(w * 0.45, h * 0.72, w * 0.45, 12);
    c.fillRect(w * 0.48, h * 0.74, 10, 35);
    c.fillRect(w * 0.82, h * 0.74, 10, 35);

    // Baseball bat leaning on bench
    c.save();
    c.translate(w * 0.51, h * 0.65);
    c.rotate(-0.35);
    c.fillStyle = '#dfaf42';
    c.fillRect(-6, -60, 12, 90);
    c.strokeStyle = '#222';
    c.lineWidth = 2;
    c.strokeRect(-6, -60, 12, 90);
    c.restore();

    // Charlie Brown standing on bench
    c.save();
    const cx = w * 0.72;
    const cy = h * 0.60;
    // Head
    c.fillStyle = '#f8d2b8';
    c.beginPath();
    c.arc(cx, cy - 55, 28, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 2.5;
    c.strokeStyle = '#181716';
    c.stroke();
    // Cap
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(cx, cy - 65, 26, Math.PI, Math.PI * 2);
    c.fill();
    c.stroke();
    c.beginPath();
    c.ellipse(cx - 15, cy - 65, 28, 6, -0.2, 0, Math.PI * 2);
    c.stroke();
    // Face
    c.fillStyle = '#181716';
    c.fillRect(cx - 4, cy - 58, 4, 4); // eye
    c.fillRect(cx + 10, cy - 58, 4, 4); // eye
    // Red Shirt
    c.fillStyle = '#d43224';
    c.beginPath();
    c.roundRect(cx - 24, cy - 25, 48, 45, 6);
    c.fill();
    c.stroke();
    // Zigzag
    c.beginPath();
    c.moveTo(cx - 20, cy - 5);
    c.lineTo(cx - 10, cy + 5);
    c.lineTo(cx, cy - 5);
    c.lineTo(cx + 10, cy + 5);
    c.lineTo(cx + 20, cy - 5);
    c.lineWidth = 4;
    c.stroke();
    // Legs & shoes
    c.lineWidth = 2.5;
    c.fillStyle = '#f2be22';
    c.fillRect(cx - 16, cy + 20, 12, 14);
    c.fillRect(cx + 4, cy + 20, 12, 14);
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.ellipse(cx - 10, cy + 35, 14, 7, 0, 0, Math.PI * 2);
    c.ellipse(cx + 10, cy + 35, 14, 7, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.restore();

    // Bubble: "EVERYBODY GATHER 'ROUND!"
    drawBubble(c, w * 0.80, 25, 125, 80, w * 0.77, h * 0.42, [
      'EVERYBODY',
      'GATHER',
      "'ROUND!",
    ]);
  });

  // Panel 1: ALL RIGHT, TEAM..HERE'S WHAT I HAVE TO SAY...
  drawCell(SAMPLE_QUADS.panels[0], '#d9e2cb', (c, w, h) => {
    // Grass
    c.fillStyle = '#78a256';
    c.fillRect(0, h * 0.68, w, h * 0.32);

    // Charlie brown talking
    c.save();
    c.fillStyle = '#f8d2b8';
    c.beginPath();
    c.arc(80, h * 0.48, 26, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = '#222';
    c.stroke();
    // Cap
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(80, h * 0.48 - 8, 25, Math.PI, Math.PI * 2);
    c.fill();
    c.stroke();
    // Red Shirt
    c.fillStyle = '#d43224';
    c.fillRect(60, h * 0.62, 40, 36);
    c.strokeRect(60, h * 0.62, 40, 36);
    c.restore();

    // Snoopy on the far left
    c.save();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.ellipse(32, h * 0.65, 14, 24, 0.1, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = '#222';
    c.stroke();
    // Snoopy cap
    c.beginPath();
    c.arc(32, h * 0.54, 15, Math.PI, Math.PI * 2);
    c.fill();
    c.stroke();
    c.restore();

    // Team players (Linus, Lucy) listening
    c.save();
    [160, 240, 320, 390].forEach((px, idx) => {
      const colors = ['#2c7cb6', '#d67e32', '#3388aa', '#d43224'];
      c.fillStyle = '#f8d2b8';
      c.beginPath();
      c.arc(px, h * 0.50, 22, 0, Math.PI * 2);
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = '#222';
      c.stroke();
      // Cap
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(px, h * 0.50 - 6, 21, Math.PI, Math.PI * 2);
      c.fill();
      c.stroke();
      // Shirt
      c.fillStyle = colors[idx];
      c.fillRect(px - 16, h * 0.64, 32, 34);
      c.strokeRect(px - 16, h * 0.64, 32, 34);
      // Baseball glove
      c.fillStyle = '#bf6a28';
      c.beginPath();
      c.arc(px - 8, h * 0.78, 12, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    });
    c.restore();

    // Speech bubble: "ALL RIGHT, TEAM..HERE'S WHAT I HAVE TO SAY..."
    drawBubble(c, 80, 14, 280, 48, 95, h * 0.42, [
      "ALL RIGHT, TEAM..HERE'S",
      'WHAT I HAVE TO SAY...',
    ]);
  });

  // Panel 2: WE'VE BEEN MISSING TOO MANY SIGNALS LATELY...
  drawCell(SAMPLE_QUADS.panels[1], '#d9e2cb', (c, w, h) => {
    // Grass
    c.fillStyle = '#78a256';
    c.fillRect(0, h * 0.68, w, h * 0.32);

    // Charlie brown in center explaining
    c.save();
    c.fillStyle = '#f8d2b8';
    c.beginPath();
    c.arc(110, h * 0.50, 24, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = '#222';
    c.stroke();
    c.fillStyle = '#d43224';
    c.fillRect(90, h * 0.64, 40, 36);
    c.strokeRect(90, h * 0.64, 40, 36);

    // Teammates listening
    [180, 250, 340].forEach((px, idx) => {
      c.fillStyle = '#f8d2b8';
      c.beginPath();
      c.arc(px, h * 0.52, 22, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = idx === 0 ? '#2c7cb6' : idx === 1 ? '#d67e32' : '#3388aa';
      c.fillRect(px - 16, h * 0.66, 32, 34);
      c.strokeRect(px - 16, h * 0.66, 32, 34);
      // Glove
      c.fillStyle = '#bf6a28';
      c.beginPath();
      c.arc(px, h * 0.78, 12, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    });
    c.restore();

    // Bubble
    drawBubble(c, 40, 12, 360, 52, 110, h * 0.44, [
      "WE'VE BEEN MISSING TOO MANY SIGNALS LATELY..",
      "I THINK IT'S BECAUSE WE'RE NOT CONCENTRATING...",
    ]);
  });

  // Panel 3: IF WE KNOW OUR SIGNALS, WE JUST HAVE TO PAY ATTENTION...
  drawCell(SAMPLE_QUADS.panels[2], '#d9e2cb', (c, w, h) => {
    // Grass
    c.fillStyle = '#78a256';
    c.fillRect(0, h * 0.68, w, h * 0.32);

    // Bat on grass
    c.fillStyle = '#dfaf42';
    c.fillRect(4, h * 0.88, 70, 8);

    // Charlie brown lecturing
    c.save();
    c.fillStyle = '#f8d2b8';
    c.beginPath();
    c.arc(95, h * 0.50, 24, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = '#222';
    c.stroke();
    c.fillStyle = '#d43224';
    c.fillRect(75, h * 0.64, 40, 36);
    c.strokeRect(75, h * 0.64, 40, 36);

    // Friends listening
    [175, 235, 335].forEach((px) => {
      c.fillStyle = '#f8d2b8';
      c.beginPath();
      c.arc(px, h * 0.52, 21, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = '#bf6a28';
      c.beginPath();
      c.arc(px - 6, h * 0.78, 11, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    });
    c.restore();

    // Bubble
    drawBubble(c, 40, 14, 300, 48, 100, h * 0.44, [
      'IF WE KNOW OUR SIGNALS, WE JUST',
      'HAVE TO PAY ATTENTION...',
    ]);
  });

  // Panel 4: IT'S SIMPLY A MATTER OF CONCENTRATION
  drawCell(SAMPLE_QUADS.panels[3], '#d9e2cb', (c, w, h) => {
    // Charlie Brown, Linus, Lucy rolling upside down
    c.save();
    c.fillStyle = '#f8d2b8';
    c.beginPath();
    c.arc(70, h * 0.52, 24, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = '#222';
    c.stroke();
    c.fillStyle = '#d43224';
    c.fillRect(50, h * 0.66, 40, 36);
    c.strokeRect(50, h * 0.66, 40, 36);

    // Linus
    c.fillStyle = '#f8d2b8';
    c.beginPath();
    c.arc(150, h * 0.54, 21, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    // Lucy upside down on grass
    c.fillStyle = '#d43224';
    c.beginPath();
    c.arc(280, h * 0.70, 20, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    // Copyright
    c.fillStyle = '#333';
    c.font = '10px sans-serif';
    c.fillText('© 1981 United Feature Syndicate, Inc.', w * 0.45, h * 0.95);
    c.restore();

    // Bubble
    drawBubble(c, 80, 16, 250, 46, 90, h * 0.46, [
      "IT'S SIMPLY A MATTER",
      'OF CONCENTRATION',
    ]);
  });

  // Panel 5: ARE THERE ANY QUESTIONS? / I HAVE A QUESTION.. (Attachment 2 reference!)
  drawCell(SAMPLE_QUADS.panels[4], '#eedc63', (c, w, h) => {
    // Close up of Charlie Brown (left) and Linus (right)
    c.save();
    // Charlie Brown
    const cbX = w * 0.32;
    const cbY = h * 0.65;
    c.fillStyle = '#f8d2b8';
    c.beginPath();
    c.arc(cbX, cbY, 56, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 3;
    c.strokeStyle = '#181716';
    c.stroke();
    // Cap
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(cbX - 6, cbY - 14, 55, Math.PI * 0.9, Math.PI * 1.95);
    c.fill();
    c.stroke();
    // Visor
    c.beginPath();
    c.ellipse(cbX - 4, cbY - 18, 68, 12, -0.15, 0, Math.PI * 2);
    c.stroke();
    // Face features
    c.fillStyle = '#181716';
    c.beginPath();
    c.arc(cbX + 2, cbY + 6, 4, 0, Math.PI * 2); // eye
    c.fill();
    // Nose loop
    c.beginPath();
    c.arc(cbX + 16, cbY + 12, 8, -Math.PI * 0.3, Math.PI * 0.6);
    c.stroke();
    // Mouth
    c.beginPath();
    c.moveTo(cbX - 4, cbY + 28);
    c.lineTo(cbX + 18, cbY + 28);
    c.stroke();
    // Shirt collar
    c.fillStyle = '#d43224';
    c.fillRect(cbX - 25, cbY + 54, 50, 40);
    c.strokeRect(cbX - 25, cbY + 54, 50, 40);

    // Linus (right)
    const linX = w * 0.72;
    const linY = h * 0.68;
    c.fillStyle = '#f8d2b8';
    c.beginPath();
    c.arc(linX, linY, 50, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    // Linus wild hair strands
    c.lineWidth = 2.5;
    for (let i = -30; i <= 30; i += 8) {
      c.beginPath();
      c.moveTo(linX + i, linY - 45);
      c.lineTo(linX + i + (i < 0 ? -12 : 12), linY - 70);
      c.stroke();
    }
    // Face features
    c.fillStyle = '#181716';
    c.beginPath();
    c.arc(linX - 10, linY + 4, 3.5, 0, Math.PI * 2);
    c.arc(linX + 10, linY + 4, 3.5, 0, Math.PI * 2);
    c.fill();
    // Nose
    c.beginPath();
    c.arc(linX, linY + 12, 7, -0.3, Math.PI * 0.8);
    c.stroke();
    // Mouth
    c.beginPath();
    c.moveTo(linX - 6, linY + 28);
    c.lineTo(linX + 8, linY + 28);
    c.stroke();

    // Date stamp bottom right: 8-16
    c.fillStyle = '#181716';
    c.font = 'italic bold 16px "Caveat", cursive';
    c.fillText('8-16', w - 46, h - 14);

    c.restore();

    // Bubble 1 (Left): ARE THERE ANY QUESTIONS?
    drawBubble(c, 24, 16, 175, 52, cbX, cbY - 60, [
      'ARE THERE',
      'ANY QUESTIONS?',
    ]);

    // Bubble 2 (Right): I HAVE A QUESTION..
    drawBubble(c, w - 195, 16, 165, 52, linX, linY - 55, [
      'I HAVE A',
      'QUESTION..',
    ]);
  });

  // Panel 6: HOW DOES SHE DO THAT?
  drawCell(SAMPLE_QUADS.panels[5], '#d9e2cb', (c, w, h) => {
    // Grass
    c.fillStyle = '#78a256';
    c.fillRect(0, h * 0.68, w, h * 0.32);

    // Charlie Brown & Linus watching Lucy upside down
    c.save();
    c.fillStyle = '#f8d2b8';
    c.beginPath();
    c.arc(70, h * 0.54, 22, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = '#222';
    c.stroke();
    c.fillStyle = '#d43224';
    c.fillRect(50, h * 0.68, 38, 36);
    c.strokeRect(50, h * 0.68, 38, 36);

    // Linus
    c.fillStyle = '#f8d2b8';
    c.beginPath();
    c.arc(135, h * 0.58, 19, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    // Lucy upside down with huge pink bubble gum
    const lucyX = 260;
    const lucyY = h * 0.68;
    // Pink bubble
    c.fillStyle = '#f6a7b8';
    c.beginPath();
    c.arc(lucyX - 40, lucyY + 8, 26, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    // Upside down shoes
    c.fillStyle = '#ffffff';
    c.fillRect(lucyX - 6, lucyY - 55, 16, 20);
    c.strokeRect(lucyX - 6, lucyY - 55, 16, 20);
    c.fillStyle = '#c8281e';
    c.fillRect(lucyX - 8, lucyY - 62, 20, 10);
    c.strokeRect(lucyX - 8, lucyY - 62, 20, 10);

    // Signature Schulz
    c.font = 'italic bold 15px cursive';
    c.fillStyle = '#222';
    c.fillText('SCHULZ', 16, h - 12);
    c.restore();

    // Bubble: HOW DOES SHE DO THAT?
    drawBubble(c, 110, 16, 175, 48, 80, h * 0.48, [
      'HOW DOES SHE',
      'DO THAT?',
    ]);
  });

  return canvas;
}
