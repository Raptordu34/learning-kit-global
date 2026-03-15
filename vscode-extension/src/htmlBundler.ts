import * as fs from 'fs';
import * as path from 'path';

// ─── Public exports (shared with webviewSidebarProvider) ─────────────────────

export function readCssWithImports(cssPath: string): string {
  const cssDir = path.dirname(cssPath);
  let css = fs.readFileSync(cssPath, 'utf-8');
  css = css.replace(/@import\s+url\(['"]?([^'")\s]+)['"]?\)[^;]*;/g, (_, href) => {
    if (href.startsWith('http')) { return ''; }
    try { return readCssWithImports(path.resolve(cssDir, href)); } catch { return ''; }
  });
  return css;
}

export function inlineStyles(html: string, htmlFilePath: string): string {
  const dir = path.dirname(htmlFilePath);
  return html.replace(
    /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi,
    (match, href) => {
      if (href.startsWith('http')) { return match; }
      try { return `<style>${readCssWithImports(path.resolve(dir, href))}</style>`; } catch { return ''; }
    }
  );
}

export function inlineScripts(html: string, htmlFilePath: string): string {
  const dir = path.dirname(htmlFilePath);
  return html.replace(
    /<script\s+([^>]*)src=["']([^"']+)["'][^>]*><\/script>/gi,
    (match, _attrs, src) => {
      if (src.startsWith('http')) { return match; }
      try {
        const content = fs.readFileSync(path.resolve(dir, src), 'utf-8');
        const isDeferred = /\bdefer\b/i.test(match);
        return isDeferred
          ? `<script>document.addEventListener('DOMContentLoaded',function(){${content}});</script>`
          : `<script>${content}</script>`;
      } catch { return ''; }
    }
  );
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function imageToDataUri(imgPath: string): string {
  try {
    const ext = path.extname(imgPath).toLowerCase().replace('.', '');
    const mimeMap: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
      ico: 'image/x-icon',
    };
    const mime = mimeMap[ext] ?? 'image/png';
    const data = fs.readFileSync(imgPath).toString('base64');
    return `data:${mime};base64,${data}`;
  } catch {
    return imgPath;
  }
}

function inlineImages(html: string, htmlFilePath: string): string {
  const dir = path.dirname(htmlFilePath);

  // Replace src="..." on img/video/source tags
  html = html.replace(
    /(<(?:img|source|video)[^>]*\s)src=["']([^"']+)["']/gi,
    (match, prefix, src) => {
      if (src.startsWith('http') || src.startsWith('data:')) { return match; }
      const resolved = path.resolve(dir, src);
      const dataUri = imageToDataUri(resolved);
      return `${prefix}src="${dataUri}"`;
    }
  );

  // Replace url(...) in inline styles
  html = html.replace(
    /url\(['"]?([^'")\s]+)['"]?\)/g,
    (match, src) => {
      if (src.startsWith('http') || src.startsWith('data:')) { return match; }
      const resolved = path.resolve(dir, src);
      const dataUri = imageToDataUri(resolved);
      return `url("${dataUri}")`;
    }
  );

  return html;
}

function buildSectionMap(docFolder: string, htmlFilePath: string): Record<string, string> {
  const files = fs.readdirSync(docFolder).filter(f => /^(section|slide)-.*\.html$/.test(f));
  const map: Record<string, string> = {};
  for (const f of files) {
    const fp = path.join(docFolder, f);
    try {
      let html = fs.readFileSync(fp, 'utf-8');
      html = inlineStyles(html, fp);
      html = inlineScripts(html, fp);
      html = inlineImages(html, fp);
      map[f] = html;
    } catch {
      // skip unreadable section
    }
  }
  return map;
}

function buildPatchScript(sectionMap: Record<string, string>): string {
  const safeJson = JSON.stringify(sectionMap).replace(/<\//g, '<\\/');
  return `<script>(function(){
  const SECTIONS = ${safeJson};

  // Patch 1 : loadSection (iframe-based templates)
  window.loadSection = function(url, btn) {
    const frame = document.getElementById('content-frame');
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
    frame.style.opacity = 0;
    try { localStorage.setItem('currentSection', url); } catch(e) {}
    setTimeout(function() {
      frame.srcdoc = SECTIONS[url] || '';
      frame.onload = function() {
        frame.style.opacity = 1;
        if (typeof applyModeToFrame === 'function') applyModeToFrame();
        if (typeof attachIframeHalo === 'function') attachIframeHalo(frame);
      };
    }, 300);
    document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
  };

  // Patch 2 : fetch (presentation template)
  const _fetch = window.fetch;
  window.fetch = function(url, opts) {
    const file = String(url).split('/').pop().split('?')[0];
    if (SECTIONS[file]) return Promise.resolve(new Response(SECTIONS[file], { status: 200 }));
    return _fetch.call(this, url, opts);
  };
})();</script>`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function bundleDocument(docFolder: string): Promise<string> {
  const indexPath = path.join(docFolder, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf-8');

  // 1. Inline styles
  html = inlineStyles(html, indexPath);

  // 2. Inline scripts
  html = inlineScripts(html, indexPath);

  // 3. Inline images
  html = inlineImages(html, indexPath);

  // 4. Bundle sections (always emit patch — inoffensive if unused)
  const sectionMap = buildSectionMap(docFolder, indexPath);
  if (Object.keys(sectionMap).length > 0) {
    const patch = buildPatchScript(sectionMap);
    html = html.replace('<head>', '<head>\n' + patch);
  }

  return html;
}
