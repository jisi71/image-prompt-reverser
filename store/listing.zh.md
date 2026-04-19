# Chrome Web Store 提交文案 · 中文

> 提交地址:https://chrome.google.com/webstore/devconsole
> 准备好后,直接复制粘贴对应字段即可。

---

## 1. 扩展名称 (Name)

**字数限制:45 字符以内**

### 推荐
```
图片提示词反推 · AI 绘画反推生成器
```

### 备选
- `图片提示词反推 · Prompt 反推工具`
- `AI 图片反推 · 一键生成绘画 Prompt`

---

## 2. 简短描述 (Summary)

**字数限制:132 字符以内**

### 推荐(128 字)
```
右键图片或框选截图,一键反推生成 JSON 格式 AI 绘画提示词。适配 Nano Banana、即梦、Flux、Stable Diffusion 等主流模型,支持自定义视觉 API。
```

### 备选
- `右键图片 → 反推生成结构化 JSON 提示词。支持 5 种风格预设,自定义视觉 API,苹果玻璃风浮窗界面。`

---

## 3. 分类 (Category)

**推荐**:`生产工具 (Productivity)`

> 备选:`开发者工具 (Developer Tools)`

---

## 4. 语言

- 主语言:`简体中文`
- 建议同步开通:`English`(使用 store/listing.en.md 的内容)

---

## 5. 详细描述 (Detailed description)

**字数限制:16000 字符。支持简单换行格式。**

```
🎨 图片提示词反推 (Image Prompt Reverser)

一个为 AI 绘画爱好者设计的 Chrome 扩展:在任意网页右键图片,或框选截图,一键反推生成结构化 JSON 格式的提示词,直接用于 Nano Banana、即梦、Flux、Stable Diffusion 等主流 AI 绘画模型。

━━━━━━━━━━━━━━━━━━━━
✨ 核心功能
━━━━━━━━━━━━━━━━━━━━

🖱 右键图片反推
在任意网页右键一张图片 → "🎨 提示词反推(当前图片)" → 浮窗立即显示 JSON 结果。
额外提供"光标下的图片"模式,兼容 Pinterest、小红书等用透明遮罩抢走右键的站点。

📷 截图区域反推
点击浏览器工具栏的扩展图标 → 📷 截图反推 → 按住鼠标拖拽框选任意区域(带实时像素尺寸提示)→ 自动裁剪并反推。

📦 JSON 结构化输出
不是普通的文字描述,而是可直接使用的结构化 JSON,包含:
  · 主体 / 风格 / 构图 / 光影 / 色彩 / 氛围
  · 画面比例(自动测量真实尺寸,覆盖模型判断)
  · 画面朝向(横版 / 竖版 / 方形)
  · SD 预设额外输出推荐分辨率、采样器、步数、CFG

🎭 5 种风格预设
针对不同模型的提示词风格特别优化:
  · 通用 — 全中文完整描述,适合参考与学习
  · Nano Banana — Google Gemini 2.5 Flash Image,英文自然长句
  · 即梦 Jimeng — 字节即梦,中文标签 + 短句
  · Flux — 英文长描述,镜头语言丰富
  · Stable Diffusion — 经典权重标签 (keyword:1.2)

🔐 完全自定义的 API
  · 兼容 OpenAI API 格式,支持所有中转站
  · API Key、URL、模型名 全部由你自己配置
  · 所有数据仅存于本地浏览器,不经过任何中间服务器
  · 支持一键"测试连接"验证配置

🍎 苹果玻璃风 UI
  · 深色磨砂玻璃浮窗,可拖拽、可自适应 backdrop-filter
  · 渐变色斑背景 + 高光描边
  · 快捷键:⌘/Ctrl+C 复制、Esc 关闭
  · 错误时有一键"重试"按钮,不用重新截图

🛡 多重容错
  · 模型返回非法 JSON 时,自动修复(中文引号、尾逗号、未加引号的 key、裸换行等)
  · 修复失败则自动用 temperature=0 重新请求一次
  · 识别到模型不支持 JSON 模式后,自动记忆并跳过

━━━━━━━━━━━━━━━━━━━━
⚙️ 首次使用
━━━━━━━━━━━━━━━━━━━━

1. 点击扩展图标 → 打开设置
2. 填入 Base URL、API Key、视觉模型名称(如 gemini-2.5-flash、gpt-4o)
3. 点击"🧪 测试连接"验证
4. 保存后回到网页,右键图片即可反推

⚠️ 必须使用 支持视觉(vision)的模型,如:
  · Google: gemini-2.5-pro / gemini-2.5-flash
  · OpenAI: gpt-4o / gpt-5 / gpt-4.1
  · Anthropic: claude-sonnet-4-6 / claude-opus-4-6
  · 阿里: qwen-vl-max
  · 字节: doubao-1-5-vision-pro
不要填生图模型(如 flux-schnell、dall-e-3),会报错。

━━━━━━━━━━━━━━━━━━━━
🔒 隐私承诺
━━━━━━━━━━━━━━━━━━━━

本扩展 不收集、不上传、不存储 你的任何数据到开发者服务器。
  · 所有配置仅保存在 chrome.storage 本地
  · 图片仅发送到你自己配置的 API 端点
  · 无第三方分析、无 Cookie、无追踪
  · 源代码完全开源:https://github.com/jisi71/image-prompt-reverser

详细隐私政策:https://jisi71.github.io/image-prompt-reverser/privacy.zh.html

━━━━━━━━━━━━━━━━━━━━
🐛 问题反馈
━━━━━━━━━━━━━━━━━━━━

GitHub: https://github.com/jisi71/image-prompt-reverser/issues

━━━━━━━━━━━━━━━━━━━━
📜 开源协议
━━━━━━━━━━━━━━━━━━━━

MIT License — 可自由使用、修改、分发。
```

---

## 6. 权限说明 (Permission justifications)

> 这是提交页里每个敏感权限旁必须填的文字,审核员会逐条看。

### `contextMenus`
```
在右键菜单中添加"提示词反推"入口,让用户在任意网页右键图片即可触发反推流程。
```

### `storage`
```
使用 chrome.storage.sync 在本地保存用户的 API Base URL、API Key、模型名称和默认风格预设;使用 chrome.storage.local 记录已知不支持 JSON 模式的模型,避免重复失败请求。所有数据仅保存于用户本地浏览器,不上传任何服务器。
```

### `activeTab`
```
当用户主动点击扩展图标启动"截图反推"功能时,对当前活动标签页执行一次可见区域截图(chrome.tabs.captureVisibleTab)。截图仅发送到用户自己配置的视觉 API 端点,不由扩展存储或上传到开发者服务器。
```

### `optional_host_permissions: <all_urls>`
```
本扩展未请求任何默认的 host_permissions。仅声明 <all_urls> 为"可选权限":
1) 用户在设置页保存 API 配置时,扩展会按用户手势仅请求对该 API 域名的授权(例如 https://api.openai.com/*),完全由用户决定是否同意。
2) 仅在用户主动点击"开启所有网站访问"按钮时,扩展才会请求 <all_urls>,用于从私有/防盗链站点下载图片转 base64(可选功能)。
扩展不读取页面正文、表单、Cookie 或其他任何敏感信息,仅在用户主动触发反推时工作。
```

---

## 7. 单一用途声明 (Single purpose)

```
本扩展的单一用途是:帮助用户在浏览网页时,对任意图片或截图区域调用用户自行配置的视觉 AI 模型,反推生成结构化的 AI 绘画提示词(JSON 格式)。
```

---

## 8. 远程代码声明 (Remote code)

**选择**:`No, I am not using Remote code`

**理由**(无需填写,但若问到):
```
本扩展不加载任何远程 JavaScript。所有代码都打包在扩展内本地执行。扩展会向用户配置的 API 端点发送 HTTPS 请求并接收 JSON 响应,但响应内容仅作为数据展示,不会作为代码执行。
```

---

## 9. 需要用户提供的数据 (Data disclosures)

提交页有一个"你的扩展是否处理/传输以下用户数据"的清单,按实际勾选:

| 类型 | 是否处理 | 说明 |
|---|---|---|
| Personally identifiable information | ❌ | 不收集 |
| Health information | ❌ | |
| Financial and payment information | ❌ | |
| Authentication information | ❌ | API Key 仅保存本地,不传给开发者 |
| Personal communications | ❌ | |
| Location | ❌ | |
| Web history | ❌ | |
| User activity | ❌ | |
| Website content | ✅ | 用户选择反推的图片会发送到用户自己配置的 API |

**声明三项(都要勾选)**:
- ✅ I do not sell or transfer user data to third parties outside of the approved use cases.
- ✅ I do not use or transfer user data for purposes unrelated to my item's single purpose.
- ✅ I do not use or transfer user data to determine creditworthiness or for lending purposes.

---

## 10. 截图准备提示

Chrome Web Store 需要 **1280×800 或 640×400** 的截图,至少 1 张,最多 5 张。

建议的 5 张:
1. 🎨 右键图片弹出反推菜单(带上浮窗 JSON 结果)
2. 📷 截图选区进行中(带实时像素尺寸)
3. ⚙️ 设置页 API 配置 + 5 种预设卡片
4. 📋 JSON 结果浮窗 + 复制按钮高亮
5. 🎭 5 种风格切换菜单

工具推荐:Chrome 自带截图(⇧⌘S)或 CleanShot X。
