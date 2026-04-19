const $ = (sel) => document.querySelector(sel);

async function init() {
  await loadConfig();
  await renderPresets();
  await refreshPermStates();
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

// ============ 权限状态 ============
function originPattern(url) {
  try { return new URL(url).origin + '/*'; } catch { return null; }
}

async function refreshPermStates() {
  // API origin
  const { baseUrl } = await chrome.storage.sync.get(['baseUrl']);
  const apiStatus = $('#perm-api-status');
  const btnGrant = $('#btn-grant-api');
  if (!baseUrl) {
    apiStatus.textContent = '未配置 API,保存配置后会自动请求授权';
    apiStatus.className = 'perm-status unknown';
    btnGrant.disabled = true;
  } else {
    const pat = originPattern(baseUrl);
    const has = pat ? await chrome.permissions.contains({ origins: [pat] }) : false;
    if (has) {
      apiStatus.textContent = '✓ 已授权:' + new URL(baseUrl).origin;
      apiStatus.className = 'perm-status granted';
      btnGrant.disabled = false;
      btnGrant.textContent = '🔄 重新授权';
    } else {
      apiStatus.textContent = '✗ 未授权:' + (pat ? new URL(baseUrl).origin : '无效 URL');
      apiStatus.className = 'perm-status denied';
      btnGrant.disabled = !pat;
      btnGrant.textContent = '🔓 授权 API 域名';
    }
  }

  // all_urls
  const allStatus = $('#perm-all-status');
  const btnAllGrant = $('#btn-grant-all');
  const btnAllRevoke = $('#btn-revoke-all');
  const hasAll = await chrome.permissions.contains({ origins: ['<all_urls>'] });
  if (hasAll) {
    allStatus.textContent = '✓ 已开启(所有网站均可下载图片)';
    allStatus.className = 'perm-status granted';
    btnAllGrant.style.display = 'none';
    btnAllRevoke.style.display = 'inline-block';
  } else {
    allStatus.textContent = '✗ 未开启(默认状态,隐私更佳)';
    allStatus.className = 'perm-status unknown';
    btnAllGrant.style.display = 'inline-block';
    btnAllRevoke.style.display = 'none';
  }
}

// ============ 事件绑定 ============
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

    // 自动请求 API 域名权限(用户手势触发 → 允许)
    const pat = originPattern(baseUrl);
    if (pat) {
      const has = await chrome.permissions.contains({ origins: [pat] });
      if (!has) {
        const granted = await chrome.permissions.request({ origins: [pat] });
        if (!granted) {
          showMsg('⚠️ 已保存,但未授权 API 域名访问,反推时会失败', 'err');
          await refreshPermStates();
          return;
        }
      }
    }

    showMsg('✓ 已保存并授权', 'ok');
    await refreshPermStates();
  };

  $('#btn-test').onclick = async () => {
    const baseUrl = $('#baseUrl').value.trim();
    const apiKey = $('#apiKey').value.trim();
    const model = $('#model').value.trim();

    const urlErr = validateBaseUrl(baseUrl);
    if (urlErr) return showMsg('❌ ' + urlErr, 'err');
    if (!apiKey || !model) return showMsg('请先填写完整', 'err');

    // 测试前先确认/请求权限
    const pat = originPattern(baseUrl);
    if (pat) {
      const has = await chrome.permissions.contains({ origins: [pat] });
      if (!has) {
        const granted = await chrome.permissions.request({ origins: [pat] });
        if (!granted) return showMsg('❌ 未授权 API 域名,无法测试', 'err');
        await refreshPermStates();
      }
    }

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
    if (!confirm('确定要重置所有配置吗?\n(API 地址、Key、模型名、默认预设将被清空。权限需单独撤销。)')) return;
    await chrome.storage.sync.clear();
    await chrome.storage.sync.set({ preset: 'general' });
    await loadConfig();
    await renderPresets();
    await refreshPermStates();
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

  // 权限按钮
  $('#btn-grant-api').onclick = async () => {
    const { baseUrl } = await chrome.storage.sync.get(['baseUrl']);
    const pat = originPattern(baseUrl);
    if (!pat) return showMsg('❌ 请先填写并保存有效的 Base URL', 'err');
    const granted = await chrome.permissions.request({ origins: [pat] });
    showMsg(granted ? '✓ 已授权' : '⚠️ 未授权', granted ? 'ok' : 'err');
    await refreshPermStates();
  };

  $('#btn-grant-all').onclick = async () => {
    const granted = await chrome.permissions.request({ origins: ['<all_urls>'] });
    showMsg(granted ? '✓ 已开启所有网站访问' : '⚠️ 未授权', granted ? 'ok' : 'err');
    await refreshPermStates();
  };

  $('#btn-revoke-all').onclick = async () => {
    if (!confirm('确认关闭"所有网站访问"?\n关闭后,从私有/防盗链站点反推可能失败。')) return;
    await chrome.permissions.remove({ origins: ['<all_urls>'] });
    showMsg('✓ 已关闭', 'ok');
    await refreshPermStates();
  };

  // 浏览器端权限变化时(比如用户去扩展详情页撤销)自动刷新
  chrome.permissions.onAdded?.addListener(refreshPermStates);
  chrome.permissions.onRemoved?.addListener(refreshPermStates);
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
