# Chrome Web Store Listing · English

> Submit at: https://chrome.google.com/webstore/devconsole
> Copy-paste each section into the matching form field.

---

## 1. Extension Name

**Limit: 45 characters**

### Recommended
```
Image Prompt Reverser · AI Art Prompt Generator
```

### Alternatives
- `AI Image to Prompt Generator`
- `Prompt Reverser for Midjourney, Flux & SD`

---

## 2. Summary (Short description)

**Limit: 132 characters**

### Recommended (127 chars)
```
Right-click any image or screenshot a region to reverse-engineer structured JSON prompts for Nano Banana, Flux, SD, and more.
```

### Alternative
- `Turn any image into a JSON prompt ready for Stable Diffusion, Flux, Midjourney-style workflows. Bring your own vision model API.`

---

## 3. Category

**Recommended**: `Productivity`

> Alternative: `Developer Tools`

---

## 4. Language

- Primary: `English`
- Also enable: `Chinese (Simplified)` — use `store/listing.zh.md`

---

## 5. Detailed description

**Limit: 16,000 characters. Plain text with line breaks is supported.**

```
🎨 Image Prompt Reverser

A Chrome extension for AI-art enthusiasts that lets you right-click any image on the web — or screenshot a region — and instantly generate a structured JSON prompt, ready to drop into Nano Banana, Jimeng, Flux, Stable Diffusion, and other modern image models.

━━━━━━━━━━━━━━━━━━━━
✨ FEATURES
━━━━━━━━━━━━━━━━━━━━

🖱 Right-click image reverse
Right-click any image on any website → "🎨 Reverse Prompt (this image)" → a floating panel shows the JSON result.
Includes a fallback "image under cursor" mode for sites like Pinterest and Xiaohongshu that hijack right-click with transparent overlays.

📷 Screenshot region reverse
Click the toolbar icon → 📷 Screenshot Reverse → drag-select any region (with live pixel size tooltip) → auto-cropped and reversed.

📦 Structured JSON output
Not just a text description — a structured JSON you can paste directly into your pipeline. Includes:
  · subject / style / composition / lighting / color / mood
  · aspect_ratio (measured from the real image, not guessed by the model)
  · orientation (landscape / portrait / square)
  · SD preset also includes recommended width/height, sampler, steps, CFG

🎭 5 style presets, tuned per model
  · General — full natural-language description, great for study
  · Nano Banana — Google Gemini 2.5 Flash Image, flowing English sentences
  · Jimeng — ByteDance Jimeng, mixed Chinese tags + phrases
  · Flux — English long-form with cinematography terms
  · Stable Diffusion — classic weighted tags like (keyword:1.2)

🔐 Bring your own API
  · OpenAI-compatible format — works with any gateway
  · You configure the Base URL, API Key, and model yourself
  · All data stays in your local browser, no middleware server
  · One-click "Test Connection" button to verify your setup

🍎 Apple-glass UI
  · Dark frosted-glass floating panel with real backdrop-filter blur
  · Gradient orb backgrounds with highlight strokes
  · Keyboard: ⌘/Ctrl+C to copy, Esc to close, drag to move
  · "Retry" button on error — no need to screenshot again

🛡 Robust error handling
  · Auto-repair malformed JSON from the model (smart quotes, trailing commas, unquoted keys, bare newlines)
  · If parsing fails, a second request is automatically sent with temperature=0
  · Models that don't support JSON-mode are remembered and skipped automatically

━━━━━━━━━━━━━━━━━━━━
⚙️ GETTING STARTED
━━━━━━━━━━━━━━━━━━━━

1. Click the extension icon → Open Settings
2. Enter Base URL, API Key, and a vision-capable model name
3. Click "🧪 Test Connection" to verify
4. Save, then right-click any image on any website

⚠️ You must use a VISION-capable model (image-in → text-out), such as:
  · Google: gemini-2.5-pro / gemini-2.5-flash
  · OpenAI: gpt-4o / gpt-5 / gpt-4.1
  · Anthropic: claude-sonnet-4-6 / claude-opus-4-6
  · Alibaba: qwen-vl-max
  · ByteDance: doubao-1-5-vision-pro
Image-generation models (e.g. flux-schnell, dall-e-3) will NOT work.

━━━━━━━━━━━━━━━━━━━━
🔒 PRIVACY
━━━━━━━━━━━━━━━━━━━━

This extension does NOT collect, upload, or store any of your data on any developer server.
  · All settings live in chrome.storage (local browser only)
  · Images are sent only to the API endpoint you configure
  · No third-party analytics, no cookies, no tracking
  · Fully open-source: https://github.com/jisi71/image-prompt-reverser

Full privacy policy: https://jisi71.github.io/image-prompt-reverser/privacy.en.html

━━━━━━━━━━━━━━━━━━━━
🐛 ISSUES
━━━━━━━━━━━━━━━━━━━━

GitHub: https://github.com/jisi71/image-prompt-reverser/issues

━━━━━━━━━━━━━━━━━━━━
📜 LICENSE
━━━━━━━━━━━━━━━━━━━━

MIT License — free to use, modify, and redistribute.
```

---

## 6. Permission justifications

### `contextMenus`
```
Adds "Reverse Prompt" entries to the browser's right-click menu, enabling the user to trigger reverse-prompt on any image on any website.
```

### `storage`
```
Uses chrome.storage.sync to locally save the user's API Base URL, API Key, model name, and default style preset; uses chrome.storage.local to cache which models don't support JSON mode, avoiding redundant failing requests. All data is stored only in the user's local browser and never transmitted to any developer-operated server.
```

### `activeTab`
```
When the user explicitly clicks the extension icon to start the "Screenshot Reverse" feature, the extension performs a single chrome.tabs.captureVisibleTab on the current tab. The screenshot is sent only to the user-configured vision API endpoint; it is never stored or sent to any developer server.
```

### `host_permissions: <all_urls>`
```
Users may want to reverse-prompt images on any website, so the extension needs to:
1) Inject a content script to detect the image element under the cursor on right-click (supports sites like Pinterest and Xiaohongshu that use transparent overlay divs);
2) Render the result panel and screenshot selection UI on the page;
3) Send the image URL or screenshot base64 to the API endpoint the user configured in the options page.
The extension does not read page content, forms, cookies, or any other sensitive information, and only acts when the user actively invokes it.
```

---

## 7. Single purpose

```
The single purpose of this extension is to help users, while browsing any webpage, send an image or a screenshot region to their own configured vision-capable AI model and receive a structured JSON prompt suitable for AI-art generation tools.
```

---

## 8. Remote code

**Choice**: `No, I am not using Remote code`

**Reasoning** (if asked):
```
This extension does not load any remote JavaScript. All code is bundled with the extension and runs locally. The extension sends HTTPS requests to the user-configured API endpoint and receives JSON responses, but those responses are only rendered as data — they are never evaluated as code.
```

---

## 9. Data disclosures

| Type | Handled? | Note |
|---|---|---|
| Personally identifiable information | ❌ | Not collected |
| Health information | ❌ | |
| Financial and payment information | ❌ | |
| Authentication information | ❌ | API key stays local |
| Personal communications | ❌ | |
| Location | ❌ | |
| Web history | ❌ | |
| User activity | ❌ | |
| Website content | ✅ | User-selected images are sent to the user's own API endpoint |

**Check all three certifications**:
- ✅ I do not sell or transfer user data to third parties outside of the approved use cases.
- ✅ I do not use or transfer user data for purposes unrelated to my item's single purpose.
- ✅ I do not use or transfer user data to determine creditworthiness or for lending purposes.

---

## 10. Screenshots

Chrome Web Store requires **1280×800 or 640×400**, 1–5 images.

Suggested set:
1. 🎨 Right-click menu triggering reverse, with JSON result panel
2. 📷 Screenshot region in progress, with live pixel size
3. ⚙️ Options page: API configuration + 5 preset cards
4. 📋 JSON result panel with Copy button highlighted
5. 🎭 Style-preset switcher menu

Tools: Chrome's built-in screenshot (⇧⌘S) or CleanShot X.
