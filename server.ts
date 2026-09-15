/**
 * Production Server for Newspaper Comic Splitter & Typesetting Tool
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { handleHealthCheck, handleSplitDetect, handleTranslate, handlePanelOcrTranslate } from './src/server/apiHandlers.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// High-resolution photo upload support (up to 50MB base64)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Endpoints
app.get('/api/health', async (_req, res) => {
  const result = await handleHealthCheck();
  res.json(result);
});

app.post('/api/split-detect', async (req, res) => {
  const { imageBase64 } = req.body;
  if (!imageBase64) {
    res.status(400).json({ success: false, error: '缺少图片数据 (imageBase64)' });
    return;
  }
  const result = await handleSplitDetect(imageBase64);
  res.json(result);
});

app.post('/api/panel-ocr-translate', async (req, res) => {
  const { panelId, index, totalPanels, imageBase64, targetLang, context } = req.body;
  if (!imageBase64) {
    res.status(400).json({ success: false, error: '缺少漫画格子图片数据 (imageBase64)' });
    return;
  }
  const result = await handlePanelOcrTranslate({
    panelId: panelId || 'panel-unknown',
    index: index || 1,
    totalPanels: totalPanels || 1,
    imageBase64,
    targetLang: targetLang || 'zh-CN',
    context,
  });
  if (result.statusCode) {
    res.status(result.statusCode).json(result);
  } else {
    res.json(result);
  }
});

app.post('/api/translate', async (req, res) => {
  const { targetLang, panels } = req.body;
  if (!panels || !Array.isArray(panels)) {
    res.status(400).json({ success: false, error: '缺少 panels 列表' });
    return;
  }
  const result = await handleTranslate({ targetLang: targetLang || 'zh-CN', panels });
  res.json(result);
});

// Serve static files from Vite build output
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
