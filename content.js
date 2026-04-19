// 内容脚本:截图选区 UI + 结果浮窗
(function () {
  if (window.__REVERSE_PROMPT_LOADED__) return;
  window.__REVERSE_PROMPT_LOADED__ = true;

  const PANEL_ID = 'rpx-panel';
  const OVERLAY_ID = 'rpx-overlay';

  // 扩展上下文是否仍然有效(扩展被重载/停用/卸载后会失效)
  const ctxAlive = () => {
    try { return !!(chrome?.runtime?.id); } catch (_) { return false; }
  };

  // 安全地发消息,上下文失效或通道异常时不抛异常
  const safeSend = (msg) => {
    if (!ctxAlive()) return Promise.resolve({ ok: false, error: '__INVALIDATED__' });
    try {
      return chrome.runtime.sendMessage(msg).catch((e) => ({
        ok: false,
        error: /Extension context invalidated|message port closed|receiving end/i.test(e?.message || '')
          ? '__INVALIDATED__'
          : (e?.message || String(e))
      }));
    } catch (e) {
      return Promise.resolve({ ok: false, error: '__INVALIDATED__' });
    }
  };

  const showInvalidatedHint = () => {
    showPanel({ error: '扩展已重载,本页面的旧脚本已失效。\n请 刷新本页 (⌘R / F5) 后重试。' });
  };

  // ---------- 右键探测光标下的图片(兼容 Pinterest / 小红书等遮罩式页面) ----------
  let lastImageInfo = null; // { url, at: number }

  const IMG_EXT_RE = /\.(?:jpe?g|png|webp|gif|bmp|avif)(?:\?|$|#)/i;

  function pickBestFromSrcset(srcset) {
    if (!srcset) return null;
    // "url1 1x, url2 2x" 或 "url1 500w, url2 1000w"
    const parts = srcset.split(',').map(s => s.trim()).filter(Boolean);
    let best = null, bestScore = -1;
    for (const p of parts) {
      const [url, size] = p.split(/\s+/);
      const n = parseFloat(size) || 1;
      if (n > bestScore) { bestScore = n; best = url; }
    }
    return best;
  }

  function extractUrlFromElement(el) {
    if (!el || !el.tagName) return null;
    const tag = el.tagName.toUpperCase();
    if (tag === 'IMG') {
      return el.currentSrc || el.src ||
        pickBestFromSrcset(el.getAttribute('srcset')) || null;
    }
    if (tag === 'SOURCE') {
      return pickBestFromSrcset(el.getAttribute('srcset')) || el.getAttribute('src');
    }
    if (tag === 'VIDEO') {
      return el.getAttribute('poster') || null;
    }
    // <picture> 包裹的取其下 <img>
    if (tag === 'PICTURE') {
      const img = el.querySelector('img');
      if (img) return img.currentSrc || img.src;
    }
    // CSS background-image
    try {
      const bg = getComputedStyle(el).backgroundImage;
      const m = bg && bg.match(/url\((["']?)([^)"']+)\1\)/);
      if (m && m[2] && !/^data:image\/svg/i.test(m[2])) return m[2];
    } catch (_) {}
    return null;
  }

  function findImageNear(target, x, y) {
    // 1) 直接目标
    let url = extractUrlFromElement(target);
    if (url) return url;

    // 2) elementsFromPoint 依次探测(穿透 overlay)
    if (typeof x === 'number' && typeof y === 'number') {
      const stack = document.elementsFromPoint(x, y) || [];
      for (const el of stack) {
        url = extractUrlFromElement(el);
        if (url) return url;
      }
    }

    // 3) 向上走父链
    let el = target;
    while (el && el !== document.documentElement) {
      url = extractUrlFromElement(el);
      if (url) return url;
      // 向下找子孙中的 img (Pinterest 典型结构)
      if (el.querySelector) {
        const innerImg = el.querySelector('img, picture img, source');
        if (innerImg) {
          url = extractUrlFromElement(innerImg);
          if (url) return url;
        }
      }
      el = el.parentElement;
    }
    return null;
  }

  // 捕获阶段优先监听,抢在页面 preventDefault 之前记录
  document.addEventListener('contextmenu', (e) => {
    const url = findImageNear(e.target, e.clientX, e.clientY);
    lastImageInfo = { url, at: Date.now() };
  }, true);

  // 某些站 contextmenu 被 preventDefault,但 mousedown 先到
  document.addEventListener('mousedown', (e) => {
    if (e.button !== 2) return;
    const url = findImageNear(e.target, e.clientX, e.clientY);
    if (url) lastImageInfo = { url, at: Date.now() };
  }, true);

  // 当前浮窗状态
  const state = {
    taskId: null,
    sourceImage: null,   // data URL,用于重试
    dragHandlers: null,  // makeDraggable 返回的清理句柄
    keyHandler: null,    // 全局 ESC/Ctrl+C
    currentJson: null
  };

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!ctxAlive()) { try { sendResponse({ ok: false, error: '__INVALIDATED__' }); } catch (_) {} return false; }
    try {
      if (msg.type === 'GET_LAST_IMAGE') {
        // 仅接受 5 秒内的记录,避免串扰
        const fresh = lastImageInfo && (Date.now() - lastImageInfo.at < 5000) ? lastImageInfo.url : null;
        sendResponse({ ok: true, url: fresh });
        return false;
      }
      if (msg.type === 'ENTER_CAPTURE_MODE') {
        startCapture();
      } else if (msg.type === 'SHOW_LOADING') {
        state.taskId = msg.taskId || state.taskId;
        showPanel({ loading: true, stage: msg.stage });
      } else if (msg.type === 'SHOW_RESULT') {
        state.taskId = msg.taskId || state.taskId;
        state.sourceImage = msg.payload?.sourceImage || state.sourceImage;
        showPanel({ result: msg.payload });
      } else if (msg.type === 'SHOW_ERROR') {
        state.taskId = msg.taskId || state.taskId;
        state.sourceImage = msg.sourceImage || state.sourceImage;
        showPanel({ error: msg.message });
      }
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
    return false;
  });

  // ---------------- 截图选区 ----------------
  function startCapture() {
    removeOverlay();
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `
      <div class="rpx-mask"></div>
      <div class="rpx-tip">拖拽选择区域进行反推,按 ESC 取消</div>
      <div class="rpx-sel" style="display:none"></div>
      <div class="rpx-size" style="display:none"></div>
    `;
    document.documentElement.appendChild(overlay);

    const sel = overlay.querySelector('.rpx-sel');
    const sizeTip = overlay.querySelector('.rpx-size');
    let start = null;
    let pointerId = null;

    const onDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY };
      pointerId = e.pointerId;
      sel.style.display = 'block';
      sizeTip.style.display = 'block';
      updateSel(sel, sizeTip, start, start);
      try { overlay.setPointerCapture(pointerId); } catch (_) {}
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!start) return;
      updateSel(sel, sizeTip, start, { x: e.clientX, y: e.clientY });
    };
    const onUp = (e) => {
      if (!start) return;
      const end = { x: e.clientX, y: e.clientY };
      const rect = rectOf(start, end);
      const s = start;
      start = null;
      cleanup();
      if (rect.w < 8 || rect.h < 8) return;
      doCaptureAndReverse(rect);
      void s;
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        start = null;
        cleanup();
      }
    };

    const cleanup = () => {
      try { if (pointerId != null) overlay.releasePointerCapture(pointerId); } catch (_) {}
      overlay.removeEventListener('pointerdown', onDown);
      overlay.removeEventListener('pointermove', onMove);
      overlay.removeEventListener('pointerup', onUp);
      overlay.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey, true);
      removeOverlay();
    };

    overlay.addEventListener('pointerdown', onDown);
    overlay.addEventListener('pointermove', onMove);
    overlay.addEventListener('pointerup', onUp);
    overlay.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey, true);
  }

  function rectOf(a, b) {
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(a.x - b.x),
      h: Math.abs(a.y - b.y)
    };
  }
  function updateSel(el, sizeTip, a, b) {
    const r = rectOf(a, b);
    el.style.left = r.x + 'px';
    el.style.top = r.y + 'px';
    el.style.width = r.w + 'px';
    el.style.height = r.h + 'px';
    sizeTip.textContent = `${Math.round(r.w)} × ${Math.round(r.h)}`;
    // 在选区右下角,若空间不足则放右下外
    const vw = window.innerWidth, vh = window.innerHeight;
    let tx = r.x + r.w + 6, ty = r.y + r.h + 6;
    if (tx + 80 > vw) tx = r.x + r.w - 80;
    if (ty + 24 > vh) ty = r.y + r.h - 24;
    sizeTip.style.left = Math.max(4, tx) + 'px';
    sizeTip.style.top = Math.max(4, ty) + 'px';
  }
  function removeOverlay() {
    const el = document.getElementById(OVERLAY_ID);
    if (el) el.remove();
  }

  async function doCaptureAndReverse(rect) {
    const taskId = 'cap-' + Date.now();
    state.taskId = taskId;
    showPanel({ loading: true, stage: '正在截图...' });

    const resp = await safeSend({ type: 'CAPTURE_VISIBLE' });
    if (resp?.error === '__INVALIDATED__') return showInvalidatedHint();
    if (!resp?.ok) return showPanel({ error: resp?.error || '截图失败' });

    const dpr = window.devicePixelRatio || 1;
    let cropped;
    try {
      cropped = await cropDataUrl(resp.dataUrl, rect, dpr);
    } catch (e) {
      return showPanel({ error: e.message });
    }
    state.sourceImage = cropped;

    showPanel({ loading: true, stage: '正在调用模型反推...' });
    const r = await safeSend({ type: 'REVERSE_IMAGE', dataUrl: cropped, taskId });
    if (state.taskId !== taskId) return; // 已被新任务覆盖
    if (r?.error === '__INVALIDATED__') return showInvalidatedHint();
    if (!r?.ok) return showPanel({ error: r?.error || '反推失败' });
    showPanel({
      result: {
        json: r.result,
        presetId: r.result.__preset,
        presetLabel: r.result.__presetLabel,
        elapsedMs: r.result.__elapsedMs,
        sourceImage: cropped
      }
    });
  }

  function cropDataUrl(dataUrl, rect, dpr) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(rect.w * dpr));
        canvas.height = Math.max(1, Math.round(rect.h * dpr));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(
          img,
          Math.round(rect.x * dpr),
          Math.round(rect.y * dpr),
          Math.round(rect.w * dpr),
          Math.round(rect.h * dpr),
          0, 0, canvas.width, canvas.height
        );
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('图片裁剪失败'));
      img.src = dataUrl;
    });
  }

  // ---------------- 结果浮窗 ----------------
  function showPanel({ loading, stage, result, error } = {}) {
    // 在重建前清理上次的全局监听
    teardownPanelListeners();

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      document.documentElement.appendChild(panel);
    }
    panel.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'rpx-header';
    header.innerHTML = `
      <span class="rpx-title">🎨 图片提示词反推</span>
      <span class="rpx-badge" id="rpx-badge"></span>
      <span class="rpx-elapsed" id="rpx-elapsed"></span>
      <span class="rpx-spacer"></span>
      <button class="rpx-btn rpx-copy" id="rpx-copy" title="复制 JSON (Ctrl/⌘+C)">复制 JSON</button>
      <button class="rpx-btn rpx-settings" id="rpx-settings" title="打开设置">⚙</button>
      <button class="rpx-btn rpx-close" id="rpx-close" title="关闭 (Esc)">✕</button>
    `;
    panel.appendChild(header);

    const body = document.createElement('div');
    body.className = 'rpx-body';
    panel.appendChild(body);

    const copyBtn = header.querySelector('#rpx-copy');

    if (loading) {
      body.innerHTML = `<div class="rpx-loading"><div class="rpx-spinner"></div><div>${escapeHtml(stage || '正在反推提示词...')}</div><button class="rpx-btn rpx-cancel" id="rpx-cancel">取消</button></div>`;
      copyBtn.style.display = 'none';
      state.currentJson = null;
      body.querySelector('#rpx-cancel').onclick = () => {
        if (state.taskId) safeSend({ type: 'CANCEL_TASK', taskId: state.taskId });
        closePanel();
      };
    } else if (error) {
      body.innerHTML = `
        <div class="rpx-error">
          <b>出错了</b>
          <pre>${escapeHtml(error)}</pre>
          <div class="rpx-actions">
            <button class="rpx-btn rpx-retry" id="rpx-retry">🔁 重试</button>
            <button class="rpx-btn" id="rpx-open-options">打开设置</button>
          </div>
          <div class="rpx-hint">请检查设置页的 API 配置,或稍后重试。</div>
        </div>`;
      copyBtn.style.display = 'none';
      state.currentJson = null;
      const retry = body.querySelector('#rpx-retry');
      if (!state.sourceImage) retry.disabled = true;
      retry.onclick = async () => {
        if (!state.sourceImage) return;
        const taskId = 'retry-' + Date.now();
        state.taskId = taskId;
        showPanel({ loading: true, stage: '正在重试...' });
        const r = await safeSend({
          type: 'RETRY_IMAGE', dataUrl: state.sourceImage, taskId
        });
        if (state.taskId !== taskId) return;
        if (r?.error === '__INVALIDATED__') return showInvalidatedHint();
        if (!r?.ok) return showPanel({ error: r?.error || '重试失败' });
        showPanel({
          result: {
            json: r.result,
            presetId: r.result.__preset,
            presetLabel: r.result.__presetLabel,
            elapsedMs: r.result.__elapsedMs,
            sourceImage: state.sourceImage
          }
        });
      };
      body.querySelector('#rpx-open-options').onclick = () =>
        safeSend({ type: 'OPEN_OPTIONS' });
    } else if (result) {
      const json = { ...result.json };
      delete json.__preset;
      delete json.__presetLabel;
      delete json.__elapsedMs;
      const pretty = JSON.stringify(json, null, 2);
      state.currentJson = pretty;
      body.innerHTML = `<pre class="rpx-json" id="rpx-json-pre" tabindex="0">${escapeHtml(pretty)}</pre>`;
      const badge = header.querySelector('#rpx-badge');
      if (result.presetLabel) badge.textContent = result.presetLabel;
      if (result.elapsedMs) {
        header.querySelector('#rpx-elapsed').textContent = `${(result.elapsedMs / 1000).toFixed(1)}s`;
      }
    }

    header.querySelector('#rpx-close').onclick = closePanel;
    header.querySelector('#rpx-settings').onclick = () =>
      safeSend({ type: 'OPEN_OPTIONS' });

    copyBtn.onclick = () => copyJson(copyBtn);

    state.dragHandlers = makeDraggable(panel, header);
    state.keyHandler = (e) => {
      if (e.key === 'Escape' && document.getElementById(PANEL_ID)) {
        closePanel();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        // 仅在浮窗内有焦点或无选择时才拦截
        const sel = window.getSelection()?.toString();
        if (sel && sel.trim()) return; // 用户正在复制别的内容,不拦截
        const active = document.activeElement;
        const inPanel = active && panel.contains(active);
        if (inPanel && state.currentJson) {
          e.preventDefault();
          copyJson(copyBtn);
        }
      }
    };
    window.addEventListener('keydown', state.keyHandler, true);
  }

  async function copyJson(btn) {
    if (!state.currentJson) return;
    try {
      await navigator.clipboard.writeText(state.currentJson);
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = state.currentJson;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (_) {}
      ta.remove();
    }
    flashBtn(btn, '已复制');
  }

  function closePanel() {
    teardownPanelListeners();
    const p = document.getElementById(PANEL_ID);
    if (p) p.remove();
    // 关闭时取消在途任务,节省 tokens
    if (state.taskId) safeSend({ type: 'CANCEL_TASK', taskId: state.taskId });
    state.taskId = null;
    state.currentJson = null;
  }

  function teardownPanelListeners() {
    if (state.dragHandlers) {
      state.dragHandlers.destroy();
      state.dragHandlers = null;
    }
    if (state.keyHandler) {
      window.removeEventListener('keydown', state.keyHandler, true);
      state.keyHandler = null;
    }
  }

  function flashBtn(btn, text) {
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = text;
    btn.classList.add('rpx-ok');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('rpx-ok'); }, 1200);
  }

  function makeDraggable(panel, handle) {
    let sx, sy, ox, oy, dragging = false;
    const onDown = (e) => {
      if (e.target.closest('button')) return;
      dragging = true;
      const r = panel.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY;
      ox = r.left; oy = r.top;
      panel.style.right = 'auto';
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!dragging) return;
      panel.style.left = (ox + e.clientX - sx) + 'px';
      panel.style.top = (oy + e.clientY - sy) + 'px';
    };
    const onUp = () => { dragging = false; };
    handle.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return {
      destroy() {
        handle.removeEventListener('mousedown', onDown);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      }
    };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
})();
