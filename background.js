// background service worker
import { PRESETS, getPreset } from './lib/presets.js';
import { callVisionAPI, fetchImageAsDataURL, getImageSize, deriveAspect } from './lib/api.js';

const MENU_ID = 'reverse-prompt-image';
const MENU_ID_PAGE = 'reverse-prompt-page';

// 在途任务 id -> AbortController,用于从前端取消
const INFLIGHT = new Map();

chrome.runtime.onInstalled.addListener(async () => {
  await setupContextMenu();
  const cur = await chrome.storage.sync.get(['preset']);
  if (!cur.preset) {
    await chrome.storage.sync.set({ preset: 'general' });
  }
});

chrome.runtime.onStartup?.addListener(setupContextMenu);

async function setupContextMenu() {
  await chrome.contextMenus.removeAll();
  // 主菜单:Chrome 识别到 <img> 时出现,最快最准
  chrome.contextMenus.create({
    id: MENU_ID,
    title: '🎨 提示词反推(当前图片)',
    contexts: ['image']
  });
  // 兜底菜单:右键任意位置都出现,兼容 Pinterest / 小红书 等遮罩站
  chrome.contextMenus.create({
    id: MENU_ID_PAGE,
    title: '🎨 提示词反推(光标下的图片)',
    contexts: ['page', 'frame', 'selection', 'link']
  });
  chrome.contextMenus.create({
    id: 'preset-parent',
    title: '切换反推风格',
    contexts: ['action']
  });
  for (const [id, p] of Object.entries(PRESETS)) {
    chrome.contextMenus.create({
      id: 'preset-' + id,
      parentId: 'preset-parent',
      title: p.label,
      type: 'radio',
      contexts: ['action']
    });
  }
  const { preset = 'general' } = await chrome.storage.sync.get(['preset']);
  try {
    chrome.contextMenus.update('preset-' + preset, { checked: true });
  } catch (_) {}
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === MENU_ID && info.srcUrl) {
    await runReverseOnImageUrl(tab.id, info.srcUrl);
    return;
  }
  if (info.menuItemId === MENU_ID_PAGE) {
    // 兜底:问 content 脚本当前光标下的图片 URL
    let url = info.srcUrl || info.linkUrl || null;
    if (!url) {
      try {
        const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_LAST_IMAGE' });
        if (resp?.ok && resp.url) url = resp.url;
      } catch (_) {}
    }
    if (!url) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'SHOW_ERROR',
          message: '未在光标位置检测到图片。\n\n请尝试:\n• 把光标对准图片中心再右键\n• 或用插件图标 → "截图反推" 框选图片'
        });
      } catch (_) {}
      return;
    }
    await runReverseOnImageUrl(tab.id, url);
    return;
  }
  if (typeof info.menuItemId === 'string' && info.menuItemId.startsWith('preset-')) {
    const id = info.menuItemId.replace('preset-', '');
    if (PRESETS[id]) {
      await chrome.storage.sync.set({ preset: id });
    }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === 'START_CAPTURE') {
        const tab = await getActiveTab();
        if (!tab?.id) throw new Error('未找到当前标签页');
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'ENTER_CAPTURE_MODE' });
        } catch (_) {
          throw new Error('当前页面不支持注入(如 chrome:// / 商店页)');
        }
        sendResponse({ ok: true });
      } else if (msg?.type === 'CAPTURE_VISIBLE') {
        const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' });
        sendResponse({ ok: true, dataUrl });
      } else if (msg?.type === 'REVERSE_IMAGE') {
        const taskId = msg.taskId || String(Date.now());
        const result = await runReverseOnDataUrl(msg.dataUrl, taskId);
        sendResponse({ ok: true, result, taskId });
      } else if (msg?.type === 'CANCEL_TASK') {
        const ctrl = INFLIGHT.get(msg.taskId);
        if (ctrl) ctrl.abort(new Error('用户取消'));
        sendResponse({ ok: true });
      } else if (msg?.type === 'GET_PRESETS') {
        sendResponse({ ok: true, presets: PRESETS });
      } else if (msg?.type === 'OPEN_OPTIONS') {
        chrome.runtime.openOptionsPage();
        sendResponse({ ok: true });
      } else if (msg?.type === 'RETRY_IMAGE') {
        // 从 content 脚本的"重试"按钮触发
        const taskId = msg.taskId || String(Date.now());
        const result = await runReverseOnDataUrl(msg.dataUrl, taskId);
        sendResponse({ ok: true, result, taskId });
      } else {
        sendResponse({ ok: false, error: 'Unknown message' });
      }
    } catch (e) {
      console.error(e);
      sendResponse({ ok: false, error: e.message || String(e) });
    }
  })();
  return true;
});

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// 检查是否有该 URL 对应 origin 的 host 权限
async function hasOriginPermission(url) {
  try {
    const origin = new URL(url).origin + '/*';
    return await chrome.permissions.contains({ origins: [origin] });
  } catch (_) {
    return false;
  }
}

async function runReverseOnImageUrl(tabId, imageUrl) {
  const taskId = 'ctx-' + Date.now();
  try {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'SHOW_LOADING', taskId });
    } catch (_) {
      // 页面不允许注入(chrome:// 等),无法在原页弹窗提示
      return;
    }

    let imageDataOrUrl = imageUrl;
    if (/^https?:/i.test(imageUrl)) {
      try {
        imageDataOrUrl = await fetchImageAsDataURL(imageUrl);
      } catch (_) {
        // 失败则直接传 URL,由模型侧处理
      }
    }

    const result = await runReverseOnDataUrl(imageDataOrUrl, taskId, { sourceImage: imageDataOrUrl });
    await chrome.tabs.sendMessage(tabId, {
      type: 'SHOW_RESULT',
      taskId,
      payload: {
        json: result,
        presetId: result.__preset,
        presetLabel: result.__presetLabel,
        elapsedMs: result.__elapsedMs,
        sourceImage: imageDataOrUrl
      }
    });
  } catch (e) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'SHOW_ERROR',
        taskId,
        message: e.message || String(e),
        sourceImage: imageUrl
      });
    } catch (_) {}
  }
}

async function runReverseOnDataUrl(imageDataOrUrl, taskId) {
  const cfg = await chrome.storage.sync.get(['baseUrl', 'apiKey', 'model', 'preset']);
  const presetId = cfg.preset || 'general';
  const preset = getPreset(presetId);

  // 权限检查:必须有 API 域名的 host 权限
  if (cfg.baseUrl) {
    const hasPerm = await hasOriginPermission(cfg.baseUrl);
    if (!hasPerm) {
      let origin = '';
      try { origin = new URL(cfg.baseUrl).origin; } catch (_) {}
      throw new Error(
        `缺少 API 域名访问权限${origin ? ':' + origin : ''}\n\n`
        + '请打开扩展"设置"页,点击"🔓 授权 API 域名"按钮,授权一次即可。\n'
        + '首次保存 API 配置时也会自动弹出授权窗口。'
      );
    }
  }

  const t0 = performance.now();

  const size = await getImageSize(imageDataOrUrl);
  const aspect = size ? deriveAspect(size.width, size.height) : null;

  let systemPrompt = preset.systemPrompt;
  if (aspect) {
    systemPrompt += `\n\n【图片实际信息(请直接采用,不要自行判断比例)】\n`
      + `- 原始尺寸:${aspect.width} x ${aspect.height}\n`
      + `- 宽高比:${aspect.ratio}\n`
      + `- 最接近的标准比例:${aspect.aspect_ratio}\n`
      + `- 画面朝向:${aspect.orientation_zh}(${aspect.orientation_en})\n`
      + `请在 JSON 的 aspect_ratio 字段使用 "${aspect.aspect_ratio}",并在 prompt 中恰当体现该画面比例。`;
  }

  const controller = new AbortController();
  INFLIGHT.set(taskId, controller);

  let json;
  try {
    json = await callVisionAPI({
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      model: cfg.model,
      systemPrompt,
      imageDataOrUrl,
      signal: controller.signal
    });
  } finally {
    INFLIGHT.delete(taskId);
  }

  if (aspect) {
    json.aspect_ratio = aspect.aspect_ratio;
    const useZh = presetId === 'general' || presetId === 'jimeng';
    json.orientation = useZh ? aspect.orientation_zh : aspect.orientation_en;
    if (presetId === 'sd') {
      json.width = aspect.sd_width;
      json.height = aspect.sd_height;
    }
    json.source_size = `${aspect.width}x${aspect.height}`;
  }

  json.__preset = presetId;
  json.__presetLabel = preset.label;
  json.__elapsedMs = Math.round(performance.now() - t0);
  return json;
}
