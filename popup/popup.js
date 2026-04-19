const $ = (sel) => document.querySelector(sel);

async function init() {
  // 加载预设
  const { ok, presets } = await chrome.runtime.sendMessage({ type: 'GET_PRESETS' });
  const select = $('#preset-select');
  const { preset = 'general' } = await chrome.storage.sync.get(['preset']);
  if (ok && presets) {
    for (const [id, p] of Object.entries(presets)) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = p.label;
      if (id === preset) opt.selected = true;
      select.appendChild(opt);
    }
  }
  select.onchange = async () => {
    await chrome.storage.sync.set({ preset: select.value });
    flash('✓ 已切换');
  };

  $('#btn-capture').onclick = async () => {
    // 检查 API 配置
    const cfg = await chrome.storage.sync.get(['baseUrl', 'apiKey', 'model']);
    if (!cfg.baseUrl || !cfg.apiKey || !cfg.model) {
      if (confirm('尚未配置 API,是否立即前往设置?')) {
        chrome.runtime.openOptionsPage();
      }
      return;
    }
    const r = await chrome.runtime.sendMessage({ type: 'START_CAPTURE' });
    if (!r?.ok) {
      alert('启动截图失败:' + (r?.error || '未知错误') + '\n\n可能原因:当前页面不允许注入(如 chrome:// 或新标签页)。请切换到普通网页后重试。');
      return;
    }
    window.close();
  };

  $('#open-options').onclick = (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  };
}

function flash(text) {
  const el = $('#status');
  el.textContent = text;
  setTimeout(() => (el.textContent = ''), 1200);
}

init();
