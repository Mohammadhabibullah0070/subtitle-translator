<div align="center">

# 🎬 Subtitle Translator

### Translate `.srt` subtitle files from **any language** into **বাংলা (Bengali)** — instantly, in your browser.

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)
[![Powered by DeepL](https://img.shields.io/badge/Powered%20by-DeepL%20API-003087?style=for-the-badge&logo=deepl&logoColor=white)](https://www.deepl.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)

</div>

---

## ✨ What It Does

**Subtitle Translator** is a clean, fast web app that takes any `.srt` subtitle file and translates it into fluent Bengali using the **DeepL Neural Machine Translation API** — one of the most accurate translation engines in the world.

- 📂 **Drop your `.srt` file** — drag & drop or click to upload
- 🌐 **Choose your source language** — 31 languages supported, or let DeepL auto-detect
- ⚡ **Instant translation** — batch processing with a live progress bar
- 💾 **Download the result** — get a translated `.srt` ready to use in any media player

---

## 🚀 Live Demo

> Deployed on Vercel. Upload a subtitle file and get the Bengali translation in seconds.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 + Vite 6 |
| **Backend / API** | Vercel Serverless Functions (Node.js) |
| **Translation Engine** | DeepL API v2 |
| **Hosting** | Vercel |
| **Styling** | CSS (custom, dark-themed) |

---

## 🌍 Supported Source Languages

DeepL auto-detection is enabled by default — but you can also manually pick from **31 supported languages**:

| Flag | Language | Flag | Language | Flag | Language |
|------|----------|------|----------|------|----------|
| 🌐 | Auto-Detect | 🇦🇷 | Spanish | 🇷🇺 | Russian |
| 🇬🇧 | English | 🇨🇳 | Chinese | 🇯🇵 | Japanese |
| 🇩🇪 | German | 🇰🇷 | Korean | 🇮🇳 | Hindi |
| 🇫🇷 | French | 🇮🇹 | Italian | 🇸🇦 | Arabic |
| 🇧🇷 | Portuguese | 🇳🇱 | Dutch | 🇵🇱 | Polish |
| 🇹🇷 | Turkish | 🇸🇪 | Swedish | 🇩🇰 | Danish |
| 🇳🇴 | Norwegian | 🇫🇮 | Finnish | 🇨🇿 | Czech |
| 🇸🇰 | Slovak | 🇸🇮 | Slovenian | 🇭🇺 | Hungarian |
| 🇷🇴 | Romanian | 🇧🇬 | Bulgarian | 🇬🇷 | Greek |
| 🇪🇪 | Estonian | 🇱🇻 | Latvian | 🇱🇹 | Lithuanian |
| 🇮🇩 | Indonesian | | | | |

> **Target language is always Bengali (বাংলা).**

---

## ⚙️ Local Development

### Prerequisites

- Node.js `v18+`
- A [DeepL API key](https://www.deepl.com/pro-api) (free tier works)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/Mohammadhabibullah0070/subtitle-translator.git
cd subtitle-translator

# 2. Install dependencies
npm install

# 3. Create environment file
echo "DEEPL_API_KEY=your_deepl_api_key_here" > .env

# 4. Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔑 Environment Variables

| Variable | Description | Required |
|---|---|---|
| `DEEPL_API_KEY` | Your DeepL API key | ✅ Yes |

On Vercel, add this in **Project Settings → Environment Variables**.

---

## 📁 Project Structure

```
subtitle-translator/
├── api/
│   └── translate.js        # Vercel serverless function — calls DeepL API
├── src/
│   └── App.jsx             # Main React component — UI & logic
├── public/                 # Static assets
├── index.html              # App entry point
├── server.js               # Local dev proxy server
├── vite.config.js          # Vite configuration
├── vercel.json             # Vercel deployment config
└── package.json
```

---

## 🔄 How It Works

```
User uploads .srt file
        ↓
Frontend parses subtitle blocks
        ↓
Batches text → POST /api/translate
        ↓
Serverless function → DeepL API v2
        ↓
Translated text returned
        ↓
Rebuilt .srt file downloaded
```

The app batches subtitle lines intelligently to stay within DeepL's request limits while showing real-time progress.

---

## 🚢 Deploying to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Then set your `DEEPL_API_KEY` in the Vercel dashboard under **Project → Settings → Environment Variables**.

The `vercel.json` in this repo already configures the `/api` route correctly — no extra setup needed.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<div align="center">

Made with ❤️ · Powered by [DeepL](https://www.deepl.com) · Deployed on [Vercel](https://vercel.com)

</div>
