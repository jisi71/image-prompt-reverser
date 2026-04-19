const $ = (sel) => document.querySelector(sel);

async function init() {
  await loadConfig();
  await renderPresets();
  bindEvents();
}

async function loadConfig() {
  const cfg = await chrome.storage.sync.get(['baseUrl', 'apiKey', 'model']);
  $('#baseUrl').value = cfg.baseUrl || '';
  $('#apiKey').value = cfg.apiKey || '';
  $('#model').value = cfg.model || '';
}

async function renderPresets() {
  const { ok, presets } = await chrome.runtime.sendMessage({ type: 'GET_PRESETS' });
  const { preset = 'general' } = await chrome.storage.sync.get(['preset']);
  const container = $('#presets');
  container.innerHTML = '';
  if (!ok) return;
  for (const [id, p] of Object.entries(presets)) {
    const item = document.createElement('div');
    item.className = 'preset-item' + (id === preset ? ' active' : '');
    item.dataset.id = id;
    item.innerHTML = `
      <div class="name">${p.label}</div>
      <div class="desc">${p.description}</div>
    `;
    item.onclick = async () => {
      await chrome.storage.sync.set({ preset: id });
      document.querySelectorAll('.preset-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      showMsg('✓ 已切换为 ' + p.label, 'ok');
    };
    container.appendChild(item);
  }
}

function bindEvents() {
  $('#btn-save').onclick = async () => {
    const baseUrl = $('#baseUrl').value.trim();
    const apiKey = $('#apiKey').value.trim();
    const model = $('#model').value.trim();

    const urlErr = validateBaseUrl(baseUrl);
    if (urlErr) return showMsg('❌ ' + urlErr, 'err');
    if (!apiKey) return showMsg('❌ 请填写 API Key', 'err');
    if (!model) return showMsg('❌ 请填写模型名称', 'err');

    await chrome.storage.sync.set({ baseUrl, apiKey, model });
    showMsg('✓ 已保存', 'ok');
  };

  $('#btn-test').onclick = async () => {
    const baseUrl = $('#baseUrl').value.trim();
    const apiKey = $('#apiKey').value.trim();
    const model = $('#model').value.trim();

    const urlErr = validateBaseUrl(baseUrl);
    if (urlErr) return showMsg('❌ ' + urlErr, 'err');
    if (!apiKey || !model) return showMsg('请先填写完整', 'err');

    showMsg('正在测试...', '');
    try {
      const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      const url = baseUrl.replace(/\/+$/, '') + '/chat/completions';
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: '回复单词 OK 即可。' },
            { role: 'user', content: [
              { type: 'text', text: '测试连接,请回复 OK' },
              { type: 'image_url', image_url: { url: tinyPng } }
            ]}
          ],
          max_tokens: 10
        })
      });
      if (!resp.ok) {
        const t = await resp.text();
        return showMsg('❌ ' + resp.status + ' ' + t.slice(0, 160), 'err');
      }
      const data = await resp.json();
      const c = data?.choices?.[0]?.message?.content || '(空)';
      showMsg('✓ 连接正常,模型返回:' + c.slice(0, 30), 'ok');
    } catch (e) {
      showMsg('❌ ' + e.message, 'err');
    }
  };

  $('#btn-reset').onclick = async () => {
    if (!confirm('确定要重置所有配置吗?\n(API 地址、Key、模型名、默认预设将被清空)')) return;
    await chrome.storage.sync.clear();
    await chrome.storage.sync.set({ preset: 'general' });
    await loadConfig();
    await renderPresets();
    showMsg('✓ 已重置', 'ok');
  };

  const toggle = $('#toggle-key');
  toggle.onclick = () => {
    const input = $('#apiKey');
    if (input.type === 'password') {
      input.type = 'text';
      toggle.textContent = '🙈';
      toggle.title = '隐藏';
    } else {
      input.type = 'password';
      toggle.textContent = '👁';
      toggle.title = '显示';
    }
  };
}

function validateBaseUrl(u) {
  if (!u) return '请填写 Base URL';
  if (!/^https?:\/\//i.test(u)) return 'Base URL 必须以 http:// 或 https:// 开头';
  try {
    new URL(u);
  } catch (_) {
    return 'Base URL 格式不合法';
  }
  if (/\/chat\/completions\/?$/i.test(u)) {
    return 'Base URL 不要包含 /chat/completions,仅填到 /v1 即可';
  }
  return null;
}

function showMsg(text, type = '') {
  const el = $('#msg');
  el.textContent = text;
  el.className = type;
  if (type === 'ok') setTimeout(() => { el.textContent = ''; el.className = ''; }, 2500);
}

init();
