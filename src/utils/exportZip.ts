/**
 * Batch ZIP Export and Single Page PNG Downloader
 */

import JSZip from 'jszip';
import { ComicPanel, TypesetSettings } from '../types/comic';
import { renderTypesetCard } from './paperTexture';

/**
 * Download a data URL or Blob as a file in browser
 */
export function downloadFile(urlOrBlob: string | Blob, filename: string) {
  const url = typeof urlOrBlob === 'string' ? urlOrBlob : URL.createObjectURL(urlOrBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (typeof urlOrBlob !== 'string') {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

/**
 * Export single typeset panel as PNG
 */
export async function downloadSinglePanelPNG(
  panel: ComicPanel,
  totalCount: number,
  settings: TypesetSettings,
  resolution: { width: number; height: number }
): Promise<void> {
  const canvas = renderTypesetCard(panel, totalCount, settings, resolution.width, resolution.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png', 1.0)
  );
  if (!blob) throw new Error('生成图片失败');

  const paddedNum = String(panel.index).padStart(2, '0');
  const filename = panel.isTitleBanner ? '00_标题页.png' : `漫画第${paddedNum}格.png`;
  downloadFile(blob, filename);
}

/**
 * Batch export all panels as a ZIP archive
 */
export async function downloadAllPanelsZIP(
  panels: ComicPanel[],
  settings: TypesetSettings,
  resolution: { width: number; height: number },
  options: {
    includeRawCrops?: boolean;
    includeProjectJson?: boolean;
    onProgress?: (percent: number, status: string) => void;
  } = {}
): Promise<void> {
  const zip = new JSZip();
  const total = panels.length;

  options.onProgress?.(5, '正在准备排版与生成画布...');

  // Folder for typeset 3:4 finished pages
  const typesetFolder = zip.folder('3x4成品排版');
  const rawFolder = options.includeRawCrops ? zip.folder('原始黑框裁切') : null;

  for (let i = 0; i < panels.length; i++) {
    const panel = panels[i];
    const padded = String(panel.index).padStart(2, '0');
    options.onProgress?.(
      Math.round(10 + (i / total) * 75),
      `正在渲染第 ${panel.index}/${total} 张图片 (${resolution.width}×${resolution.height})...`
    );

    // 1. Render typeset 3:4 image
    const canvas = renderTypesetCard(panel, total, settings, resolution.width, resolution.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png', 1.0)
    );

    if (blob && typesetFolder) {
      const filename = panel.isTitleBanner ? '00_标题页.png' : `${padded}.png`;
      typesetFolder.file(filename, blob);
    }

    // 2. Optional raw crop
    if (rawFolder && panel.cachedCroppedUrl) {
      // fetch blob from base64/dataURL
      const res = await fetch(panel.cachedCroppedUrl);
      const rawBlob = await res.blob();
      const rawFilename = panel.isTitleBanner ? '00_标题页_原裁切.png' : `${padded}_原裁切.png`;
      rawFolder.file(rawFilename, rawBlob);
    }
  }

  // 3. Optional Project metadata JSON for session restoration
  if (options.includeProjectJson) {
    const projectData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      settings,
      panels: panels.map((p) => ({
        id: p.id,
        index: p.index,
        isTitleBanner: p.isTitleBanner,
        quad: p.quad,
        speechBubbles: p.speechBubbles,
        translatedTextCombined: p.translatedTextCombined,
      })),
    };
    zip.file('project_data.json', JSON.stringify(projectData, null, 2));
  }

  options.onProgress?.(90, '正在打包 ZIP 文件...');
  const zipContent = await zip.generateAsync({ type: 'blob' }, (metadata) => {
    options.onProgress?.(90 + Math.round(metadata.percent * 0.1), '压缩中...');
  });

  options.onProgress?.(100, '打包完成，开始下载！');
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadFile(zipContent, `报纸漫画排版_${timestamp}_共${total}格.zip`);
}
