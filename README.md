# 🎨 图片提示词反推 · Image Prompt Reverser

> 一个 Chrome 浏览器扩展:**右键任意图片 / 框选网页区域**,一键反推生成 **JSON 格式提示词**,适配 Nano Banana / 即梦 / Flux / SD 等主流 AI 绘画模型。

![license](https://img.shields.io/badge/license-MIT-blue.svg)
![manifest](https://img.shields.io/badge/Manifest-V3-green.svg)
![platform](https://img.shields.io/badge/Chrome-120%2B-orange.svg)

---

## ✨ 功能特性

- 🖱 **右键图片反推** — 在任意网页右键图片,一键反推(含 Pinterest、小红书等遮罩式站点的兼容)
- 📷 **截图区域反推** — 点击插件图标 → 框选任意区域 → 反推
- 📦 **JSON 结构化输出** — 可直接复制到其他工具,自带画面比例、朝向、推荐分辨率
- 🎭 **5 种风格预设** — 通用 / Nano Banana / 即梦 / Flux / Stable Diffusion
- 🔐 **自定义 API** — OpenAI 兼容格式,支持所有中转站,API Key 仅存浏览器本地
- 🍎 **苹果玻璃风 UI** — 深色磨砂玻璃浮窗,可拖拽、ESC 关闭、⌘+C 复制
- 🛡 **多重防护** — 自动修复非法 JSON、请求失败自动重试、扩展重载后友好提示

---

## 🚀 安装

### 开发者模式加载(推荐,追最新代码)

```bash
git clone https://github.com/jisi71/image-prompt-reverser.git
```

1. 打开 Chrome,地址栏输入 `chrome://extensions/`
2. 右上角打开"**开发者模式**"
3. 点击左上角"**加载已解压的扩展程序**"
4. 选择 `image-prompt-reverser/` 目录
5. 点击扩展图标 → "打开设置" 配置 API

### Chrome Web Store(审核中)

> 暂未上架,审核通过后此处会贴链接。

---

## 🔧 配置

在设置页填写三项:

| 字段 | 说明 | 示例 |
|---|---|---|
| Base URL | OpenAI 兼容格式端点 | `https://api.openai.com/v1` |
| API Key | 对应平台的密钥 | `sk-xxxxx` |
| 模型名称 | **支持视觉(vision)** 的模型 | `gemini-2.5-flash` |

> ⚠️ 必须使用**视觉理解模型**(输入图 → 输出文),不是生图模型。

### 🎯 推荐模型

| 模型 | 优势 | 成本 |
|---|---|---|
| `gemini-2.5-pro` | 视觉细节识别最强 | 💰💰 |
| `gemini-2.5-flash` | 速度快、便宜,质量够用 | 💰 |
| `gpt-4o` / `gpt-5` | 构图、镜头语言强 | 💰💰💰 |
| `claude-sonnet-4-6` | 语义深,描述有文学性 | 💰💰 |
| `qwen-vl-max` | 中文最强 | 💰 |

---

## 📖 使用

### 方式一:右键图片
在网页上看到想反推的图片,**右键** → `🎨 提示词反推(当前图片)` 或 `🎨 提示词反推(光标下的图片)`(Pinterest/小红书 等遮罩式站点用后者)。

### 方式二:截图反推
1. 点击浏览器工具栏的扩展图标
2. 点击 **📷 截图反推**
3. 按住鼠标拖拽框选区域(按 `Esc` 取消)
4. 浮窗弹出 JSON 结果

### 方式三:切换反推风格
- 在插件弹窗的下拉菜单切换
- 或在设置页点选卡片
- 或 **右键点击插件图标** → "切换反推风格"

### 浮窗快捷键
- `⌘/Ctrl + C` — 复制 JSON(焦点在面板时)
- `Esc` — 关闭浮窗
- 拖拽标题栏 — 移动浮窗

---

## 🎨 5 种预设的 JSON 结构

<details>
<summary>通用(中文)</summary>

```json
{
  "subject": "主体内容",
  "style": "艺术风格",
  "composition": "构图方式",
  "lighting": "光影描述",
  "color": "主色调",
  "mood": "氛围情绪",
  "aspect_ratio": "16:9",
  "orientation": "横版",
  "details": ["细节1", "细节2"],
  "prompt": "完整可用提示词"
}
```
</details>

<details>
<summary>Nano Banana(英文长句)</summary>

```json
{
  "prompt": "A detailed flowing English sentence...",
  "negative_prompt": "things to avoid",
  "aspect_ratio": "16:9",
  "orientation": "landscape"
}
```
</details>

<details>
<summary>即梦 Jimeng(中文标签)</summary>

```json
{
  "prompt": "主体,场景,风格,光影,高清,16:9 横版构图",
  "negative_prompt": "低质量,模糊,变形",
  "aspect_ratio": "16:9",
  "orientation": "横版"
}
```
</details>

<details>
<summary>Flux(英文长描述)</summary>

```json
{
  "prompt": "English paragraph with cinematic details...",
  "aspect_ratio": "16:9",
  "orientation": "landscape",
  "style_reference": "cinematic"
}
```
</details>

<details>
<summary>Stable Diffusion(权重标签)</summary>

```json
{
  "prompt": "(masterpiece:1.2), best quality, ...",
  "negative_prompt": "lowres, bad anatomy, ...",
  "aspect_ratio": "16:9",
  "width": 1344,
  "height": 768,
  "sampler_suggestion": "DPM++ 2M Karras",
  "steps_suggestion": 30,
  "cfg_suggestion": 7
}
```
</details>

---

## 🗂 目录结构

```
image-prompt-reverser/
├── manifest.json          # Manifest V3 配置
├── background.js          # Service Worker:右键菜单 + 消息路由 + API 调用
├── content.js             # 内容脚本:截图选区 + 结果浮窗 + 右键图片探测
├── content.css            # 浮窗/遮罩 苹果玻璃样式
├── popup/                 # 工具栏弹窗(截图入口 + 风格切换)
├── options/               # 设置页(API 配置 + 预设选择 + 连接测试)
├── lib/
│   ├── api.js             # OpenAI 兼容 vision 调用 + JSON 修复
│   └── presets.js         # 5 种风格的 system prompt
└── icons/                 # 扩展图标
```

---

## 🔒 隐私说明

- ✅ 所有配置(API Key / URL / 模型名)仅存储在 `chrome.storage.sync`,不上传任何服务器
- ✅ 反推的图片直接发送到你配置的 API 端点,**不经过任何中间服务**
- ✅ 不使用第三方分析、不追踪、不用 Cookie
- ✅ 源代码完全开源,可自行审计

---

## 🐛 问题反馈

遇到 Bug 或有功能建议?欢迎 [提交 Issue](https://github.com/jisi71/image-prompt-reverser/issues)。

提交前请附上:
1. Chrome 版本
2. 目标网站 URL
3. 选择的 API 与模型
4. 控制台错误截图(F12 → Console / 扩展详情页的"错误")

---

## 🤝 贡献

欢迎 PR!开发前建议先开 Issue 讨论一下方向。

### 本地开发
```bash
# 克隆
git clone https://github.com/jisi71/image-prompt-reverser.git
cd image-prompt-reverser

# Chrome 加载(开发者模式 → 加载已解压)
# 改完代码后在 chrome://extensions/ 点刷新即可
```

---

## 📜 License

[MIT](./LICENSE) © 2026 jisi71
