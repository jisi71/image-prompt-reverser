// OpenAI 兼容格式的视觉模型调用
// 支持 image_url(网络图)或 base64 data URL

const STRICT_JSON_HINT =
  '\n\n【严格输出要求】\n'
  + '1. 本次回复必须且只能是一个合法的 JSON 对象,以 { 开头,以 } 结尾。\n'
  + '2. 不要输出任何解释、前言、结语、markdown 代码块标记(如 ```json)。\n'
  + '3. 所有字符串使用英文双引号 ",不要使用中文引号 " " \' \'。\n'
  + '4. JSON 末尾不要有多余逗号。\n'
  + '5. 字符串中如需换行用 \\n 转义,不要直接换行。\n'
  + '6. 字段名使用英文双引号包裹。';

export async function callVisionAPI({
  baseUrl,
  apiKey,
  model,
  systemPrompt,
  imageDataOrUrl,
  timeout = 60000,
  signal
}) {
  if (!baseUrl || !apiKey || !model) {
    throw new Error('请先在设置页填写 API Base URL、API Key 和模型名称');
  }

  const url = baseUrl.replace(/\/+$/, '') + '/chat/completions';
  const fullSystem = systemPrompt + STRICT_JSON_HINT;

  // 读取"不支持 response_format 的 model 黑名单"(跨会话记忆)
  const cacheKey = 'noJsonMode';
  let noJsonMode = {};
  try {
    const r = await chrome.storage.local.get([cacheKey]);
    noJsonMode = r[cacheKey] || {};
  } catch (_) {}
  const blKey = `${baseUrl}::${model}`;
  const startWithoutRF = !!noJsonMode[blKey];

  const buildBody = ({ withResponseFormat, temperature = 0.3, extraUser = '' }) => {
    const body = {
      model,
      messages: [
        { role: 'system', content: fullSystem },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '请严格按照 system 中给定的 JSON 结构反推这张图片的提示词。只输出 JSON,不要 markdown 代码块。'
                + extraUser
            },
            { type: 'image_url', image_url: { url: imageDataOrUrl } }
          ]
        }
      ],
      temperature,
      max_tokens: 1800
    };
    if (withResponseFormat) body.response_format = { type: 'json_object' };
    return body;
  };

  // ------- 第一次调用 -------
  let data;
  let usedResponseFormat = !startWithoutRF;
  try {
    data = await doFetch(url, apiKey, buildBody({ withResponseFormat: !startWithoutRF }), timeout, signal);
  } catch (e) {
    if (e.__retryable) {
      // 记住该 model 不支持 response_format,下次直接跳过
      try {
        noJsonMode[blKey] = true;
        await chrome.storage.local.set({ [cacheKey]: noJsonMode });
      } catch (_) {}
      usedResponseFormat = false;
      data = await doFetch(url, apiKey, buildBody({ withResponseFormat: false }), timeout, signal);
    } else {
      throw e;
    }
  }

  const content1 = data?.choices?.[0]?.message?.content;
  if (!content1) throw new Error('API 返回为空');

  // 尝试从第一次输出解析
  const parsed1 = tryParseJSON(content1);
  if (parsed1) return parsed1;

  // ------- 第二次调用:更严格、更低温 -------
  const fixBody = buildBody({
    withResponseFormat: usedResponseFormat,
    temperature: 0,
    extraUser:
      '\n\n⚠️ 上次回复无法被 JSON.parse 解析,请务必只输出合法 JSON。'
      + '\n上次的错误输出(仅供参考,不要复述):\n'
      + content1.slice(0, 400)
  });
  let data2;
  try {
    data2 = await doFetch(url, apiKey, fixBody, timeout, signal);
  } catch (e) {
    if (e.__retryable) {
      try {
        noJsonMode[blKey] = true;
        await chrome.storage.local.set({ [cacheKey]: noJsonMode });
      } catch (_) {}
      delete fixBody.response_format;
      data2 = await doFetch(url, apiKey, fixBody, timeout, signal);
    } else {
      // 第二次请求失败,落回第一次的内容再最后一搏
      const rescued = aggressiveExtract(content1);
      if (rescued) return rescued;
      throw e;
    }
  }

  const content2 = data2?.choices?.[0]?.message?.content || '';
  const parsed2 = tryParseJSON(content2);
  if (parsed2) return parsed2;

  // ------- 最后兜底:用激进修复方式从两次输出里抢救 -------
  const rescued = aggressiveExtract(content2) || aggressiveExtract(content1);
  if (rescued) return rescued;

  throw new Error(
    '模型连续两次返回的不是合法 JSON。\n\n第一次输出:\n'
    + content1.slice(0, 300)
    + '\n\n第二次输出:\n'
    + String(content2).slice(0, 300)
  );
}

// =============== JSON 解析 / 修复 ===============

// 多策略尝试解析为对象,失败返回 null
function tryParseJSON(raw) {
  if (!raw) return null;
  const attempts = [
    (s) => s,
    (s) => stripCodeFence(s),
    (s) => stripCodeFence(s).trim(),
    (s) => extractOutermostObject(stripCodeFence(s)),
    (s) => repairJSON(extractOutermostObject(stripCodeFence(s)) || s),
    (s) => repairJSON(s)
  ];
  for (const fn of attempts) {
    try {
      const t = fn(raw);
      if (!t) continue;
      const obj = JSON.parse(t);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
    } catch (_) {}
  }
  return null;
}

// 终极抢救:从混乱文本里抢出合法 JSON 对象
function aggressiveExtract(raw) {
  if (!raw) return null;
  const text = stripCodeFence(raw);
  // 扫描所有成对大括号组合,优先取最长的能解析的
  const candidates = findAllBalancedObjects(text).sort((a, b) => b.length - a.length);
  for (const c of candidates) {
    try {
      const obj = JSON.parse(c);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
    } catch (_) {
      try {
        const obj = JSON.parse(repairJSON(c));
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
      } catch (_) {}
    }
  }
  return null;
}

function stripCodeFence(s) {
  if (!s) return s;
  s = String(s).replace(/^\uFEFF/, ''); // 去 BOM
  // 去 ```json ... ``` 或 ```\n...\n```
  s = s.replace(/```(?:json|JSON)?\s*\n?/g, '');
  s = s.replace(/\n?```\s*$/g, '');
  return s;
}

// 抽取文本中 "最外层" 的那对 { ... } 作为候选
function extractOutermostObject(s) {
  if (!s) return null;
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first < 0 || last < 0 || last <= first) return null;
  return s.slice(first, last + 1);
}

// 扫描所有平衡的 { ... } 子串(忽略字符串内的大括号)
function findAllBalancedObjects(s) {
  const out = [];
  const n = s.length;
  for (let i = 0; i < n; i++) {
    if (s[i] !== '{') continue;
    let depth = 0, inStr = false, esc = false, quote = '';
    for (let j = i; j < n; j++) {
      const c = s[j];
      if (inStr) {
        if (esc) { esc = false; continue; }
        if (c === '\\') { esc = true; continue; }
        if (c === quote) inStr = false;
      } else {
        if (c === '"' || c === "'") { inStr = true; quote = c; continue; }
        if (c === '{') depth++;
        else if (c === '}') {
          depth--;
          if (depth === 0) {
            out.push(s.slice(i, j + 1));
            break;
          }
        }
      }
    }
  }
  return out;
}

// 常见 JSON 错误修复:中文引号、单引号、尾逗号、未加引号的 key、控制字符
function repairJSON(s) {
  if (!s) return s;
  let t = String(s);

  // 1) 去 BOM / 零宽空格
  t = t.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 2) 中文引号 → 英文双引号
  t = t.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");

  // 3) 去控制字符(但保留 \t \n \r,它们后面统一处理)
  t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

  // 4) 裸换行 -> 只在字符串内转义;简化做法:全局裸 \r 删除,字符串外的 \n 保留作格式
  //    稳妥的办法是"在字符串内部"的换行替换为 \\n
  t = escapeNewlinesInsideStrings(t);

  // 5) 单引号字符串 -> 双引号(谨慎处理,仅当看起来是 key/简单 value 时)
  //    简单策略:把不在字符串内的单引号替换为双引号
  t = swapQuotesOutsideDoubleStrings(t);

  // 6) 未加引号的 key: {foo: 1} -> {"foo": 1}
  t = t.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_\-]*)\s*:/g, '$1"$2":');

  // 7) 去尾逗号:  , }  /  , ]
  t = t.replace(/,(\s*[}\]])/g, '$1');

  // 8) 多余的 JS 注释
  t = t.replace(/\/\/[^\n\r]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

  return t;
}

// 把字符串内部的裸换行转为 \n 转义
function escapeNewlinesInsideStrings(s) {
  let out = '';
  let inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) { out += c; esc = false; continue; }
      if (c === '\\') { out += c; esc = true; continue; }
      if (c === '"') { out += c; inStr = false; continue; }
      if (c === '\n') { out += '\\n'; continue; }
      if (c === '\r') { out += '\\r'; continue; }
      if (c === '\t') { out += '\\t'; continue; }
      out += c;
    } else {
      if (c === '"') inStr = true;
      out += c;
    }
  }
  return out;
}

// 把不在双引号字符串内的单引号替换为双引号
function swapQuotesOutsideDoubleStrings(s) {
  let out = '';
  let inDouble = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inDouble) {
      if (esc) { out += c; esc = false; continue; }
      if (c === '\\') { out += c; esc = true; continue; }
      if (c === '"') inDouble = false;
      out += c;
    } else {
      if (c === '"') { inDouble = true; out += c; continue; }
      if (c === "'") { out += '"'; continue; }
      out += c;
    }
  }
  return out;
}

// =============== 网络请求(原样)===============

async function doFetch(url, apiKey, body, timeout, externalSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeout);
  const onAbort = () => controller.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort(externalSignal.reason);
    else externalSignal.addEventListener('abort', onAbort, { once: true });
  }

  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (e) {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onAbort);
    if (e.name === 'AbortError') {
      if (externalSignal?.aborted) throw new Error('请求已取消');
      throw new Error('请求超时,请检查网络或 API 地址');
    }
    throw new Error('网络请求失败:' + e.message);
  }
  clearTimeout(timer);
  externalSignal?.removeEventListener('abort', onAbort);

  if (!resp.ok) {
    let errText = '';
    try { errText = await resp.text(); } catch (_) {}
    const err = new Error(`API 返回错误 ${resp.status}: ${errText.slice(0, 300)}`);
    // 只要请求带了 response_format 且出现 400/422,就一律重试一次(不再依赖关键字命中)
    // 例如 Gemini 的 "JSON mode is not enabled for this model"、"response_format unsupported" 等各种措辞
    if ((resp.status === 400 || resp.status === 422) && body.response_format) {
      err.__retryable = true;
    }
    throw err;
  }

  return await resp.json();
}

// =============== 图片工具 ===============

export async function fetchImageAsDataURL(imageUrl) {
  const r = await fetch(imageUrl);
  if (!r.ok) throw new Error('图片下载失败 ' + r.status);
  const blob = await r.blob();
  return await blobToDataURL(blob);
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function getImageSize(dataOrUrl) {
  try {
    const resp = await fetch(dataOrUrl);
    if (!resp.ok) throw new Error('无法读取图片');
    const blob = await resp.blob();
    const bmp = await createImageBitmap(blob);
    const w = bmp.width, h = bmp.height;
    bmp.close?.();
    return { width: w, height: h };
  } catch (_) {
    return null;
  }
}

export function deriveAspect(width, height) {
  if (!width || !height) return null;
  const STD = [
    { r: 21/9, label: '21:9', w: 1536, h: 640 },
    { r: 16/9, label: '16:9', w: 1344, h: 768 },
    { r: 3/2,  label: '3:2',  w: 1216, h: 832 },
    { r: 4/3,  label: '4:3',  w: 1152, h: 896 },
    { r: 5/4,  label: '5:4',  w: 1120, h: 896 },
    { r: 1/1,  label: '1:1',  w: 1024, h: 1024 },
    { r: 4/5,  label: '4:5',  w: 896,  h: 1120 },
    { r: 3/4,  label: '3:4',  w: 896,  h: 1152 },
    { r: 2/3,  label: '2:3',  w: 832,  h: 1216 },
    { r: 9/16, label: '9:16', w: 768,  h: 1344 },
    { r: 9/21, label: '9:21', w: 640,  h: 1536 }
  ];
  const ratio = width / height;
  let best = STD[0], bestDiff = Infinity;
  for (const s of STD) {
    const d = Math.abs(Math.log(ratio) - Math.log(s.r));
    if (d < bestDiff) { bestDiff = d; best = s; }
  }
  const orientation_zh = ratio > 1.05 ? '横版' : ratio < 0.95 ? '竖版' : '方形';
  const orientation_en = ratio > 1.05 ? 'landscape' : ratio < 0.95 ? 'portrait' : 'square';
  return {
    width,
    height,
    ratio: +ratio.toFixed(3),
    aspect_ratio: best.label,
    orientation_zh,
    orientation_en,
    sd_width: best.w,
    sd_height: best.h
  };
}
