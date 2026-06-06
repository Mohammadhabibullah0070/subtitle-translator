import { useState, useRef, useCallback } from "react";
import "./App.css";

const BATCH_SIZE = 25;
const DELAY_BETWEEN_BATCHES = 500;
const MAX_RETRIES = 3;
const API_TIMEOUT = 30000;

const SOURCE_LANGUAGES = [
  { code: "AUTO", label: "Auto-detect",  flag: "🌐" },
  { code: "AR",   label: "Arabic",        flag: "🇸🇦" },
  { code: "BG",   label: "Bulgarian",     flag: "🇧🇬" },
  { code: "CS",   label: "Czech",         flag: "🇨🇿" },
  { code: "DA",   label: "Danish",        flag: "🇩🇰" },
  { code: "DE",   label: "German",        flag: "🇩🇪" },
  { code: "EL",   label: "Greek",         flag: "🇬🇷" },
  { code: "EN",   label: "English",       flag: "🇬🇧" },
  { code: "ES",   label: "Spanish",       flag: "🇪🇸" },
  { code: "ET",   label: "Estonian",      flag: "🇪🇪" },
  { code: "FI",   label: "Finnish",       flag: "🇫🇮" },
  { code: "FR",   label: "French",        flag: "🇫🇷" },
  { code: "HU",   label: "Hungarian",     flag: "🇭🇺" },
  { code: "ID",   label: "Indonesian",    flag: "🇮🇩" },
  { code: "IT",   label: "Italian",       flag: "🇮🇹" },
  { code: "JA",   label: "Japanese",      flag: "🇯🇵" },
  { code: "KO",   label: "Korean",        flag: "🇰🇷" },
  { code: "LT",   label: "Lithuanian",    flag: "🇱🇹" },
  { code: "LV",   label: "Latvian",       flag: "🇱🇻" },
  { code: "NB",   label: "Norwegian",     flag: "🇳🇴" },
  { code: "NL",   label: "Dutch",         flag: "🇳🇱" },
  { code: "PL",   label: "Polish",        flag: "🇵🇱" },
  { code: "PT",   label: "Portuguese",    flag: "🇵🇹" },
  { code: "RO",   label: "Romanian",      flag: "🇷🇴" },
  { code: "RU",   label: "Russian",       flag: "🇷🇺" },
  { code: "SK",   label: "Slovak",        flag: "🇸🇰" },
  { code: "SL",   label: "Slovenian",     flag: "🇸🇮" },
  { code: "SV",   label: "Swedish",       flag: "🇸🇪" },
  { code: "TR",   label: "Turkish",       flag: "🇹🇷" },
  { code: "UK",   label: "Ukrainian",     flag: "🇺🇦" },
  { code: "ZH",   label: "Chinese",       flag: "🇨🇳" },
];

function parseSRT(text) {
  const blocks = text.trim().split(/\n\s*\n/);
  return blocks
    .map((block) => {
      const lines = block.trim().split("\n");
      const index = lines[0].trim();
      const timestamp = lines[1]?.trim() || "";
      const content = lines.slice(2).join("\n").trim();
      return { index, timestamp, content };
    })
    .filter((b) => b.timestamp && b.content);
}

function buildSRT(entries) {
  return entries
    .map((e) => `${e.index}\n${e.timestamp}\n${e.content}`)
    .join("\n\n");
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function translateBatch(texts, sourceLang, retryCount = 0) {
  const apiKey = localStorage.getItem("deepl_api_key");
  if (!apiKey) throw new Error("DeepL API key not set. Please configure it in settings.");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const backendUrl =
      process.env.NODE_ENV === "production"
        ? "/api/translate"
        : "http://localhost:3001/translate";

    const response = await fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts, apiKey, sourceLang }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 429 && retryCount < MAX_RETRIES) {
        await sleep((retryCount + 1) * 3000);
        return translateBatch(texts, sourceLang, retryCount + 1);
      }
      throw new Error(
        `DeepL API Error ${response.status}: ${
          errorData.error || errorData.message || response.statusText
        }`
      );
    }

    const data = await response.json();
    return data.translations.map((t) => t.text);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      if (retryCount < MAX_RETRIES) {
        await sleep(1000 * (retryCount + 1));
        return translateBatch(texts, sourceLang, retryCount + 1);
      }
      throw new Error("Request timeout after retries");
    }
    if (retryCount < MAX_RETRIES && !err.message.includes("API key")) {
      await sleep(1000 * (retryCount + 1));
      return translateBatch(texts, sourceLang, retryCount + 1);
    }
    throw err;
  }
}

export default function App() {
  const [file, setFile]           = useState(null);
  const [entries, setEntries]     = useState([]);
  const [translated, setTranslated] = useState([]);
  const [progress, setProgress]   = useState(0);
  const [total, setTotal]         = useState(0);
  const [status, setStatus]       = useState("idle");
  const [error, setError]         = useState("");
  const [dragOver, setDragOver]   = useState(false);
  const [sourceLang, setSourceLang] = useState("AUTO");
  const [apiKey, setApiKey]       = useState(() => localStorage.getItem("deepl_api_key") || "");
  const [showSettings, setShowSettings] = useState(!localStorage.getItem("deepl_api_key"));
  const fileRef = useRef();

  const selectedLang = SOURCE_LANGUAGES.find((l) => l.code === sourceLang);

  const handleApiKeyChange = (key) => {
    setApiKey(key);
    localStorage.setItem("deepl_api_key", key);
    setShowSettings(false);
  };

  const handleFile = useCallback((f) => {
    if (!f || !f.name.endsWith(".srt")) {
      setError("Please upload a valid .srt file.");
      return;
    }
    setError("");
    setFile(f);
    setTranslated([]);
    setProgress(0);
    setStatus("parsing");
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseSRT(e.target.result);
      setEntries(parsed);
      setTotal(parsed.length);
      setStatus("idle");
    };
    reader.readAsText(f, "utf-8");
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const translate = async () => {
    if (!entries.length) return;
    if (!apiKey) {
      setError("Please configure your DeepL API key first.");
      setShowSettings(true);
      return;
    }
    setStatus("translating");
    setProgress(0);
    setError("");
    const result = [...entries];
    try {
      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);
        const texts = batch.map((e) => e.content);
        const translatedTexts = await translateBatch(texts, sourceLang);
        translatedTexts.forEach((t, j) => {
          result[i + j] = { ...result[i + j], content: t };
        });
        setProgress(Math.min(i + BATCH_SIZE, entries.length));
        if (i + BATCH_SIZE < entries.length) await sleep(DELAY_BETWEEN_BATCHES);
      }
      setTranslated(result);
      setStatus("done");
    } catch (err) {
      setError("Translation failed: " + err.message);
      setStatus("error");
    }
  };

  const download = () => {
    const srtContent = buildSRT(translated);
    const blob = new Blob(["\uFEFF" + srtContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name.replace(".srt", "_Bengali.srt");
    a.click();
    URL.revokeObjectURL(url);
  };

  const pct = total ? Math.round((progress / total) * 100) : 0;
  const estimatedTime = total > 0 ? Math.ceil((total / BATCH_SIZE) * (DELAY_BETWEEN_BATCHES / 1000)) : 0;

  return (
    <>
      {/* Font imports */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Bengali:wght@400;500;600&display=swap"
        rel="stylesheet"
      />

      <div className="app-root">
        {/* Ambient background */}
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
        <div className="bg-grid" />

        {/* ── Settings Modal ── */}
        {showSettings && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-title">🔑 DeepL API Key</div>
              <p className="modal-subtitle">
                Enter your free DeepL API key. It's stored only in your browser and never sent anywhere else.
              </p>
              <input
                type="password"
                className="modal-input"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleApiKeyChange(apiKey)}
              />
              <div className="modal-actions">
                <button className="btn-primary" onClick={() => handleApiKeyChange(apiKey)}>
                  Save Key
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setShowSettings(false);
                    setApiKey(localStorage.getItem("deepl_api_key") || "");
                  }}
                >
                  Cancel
                </button>
              </div>
              <div className="modal-footer">
                Get your free key at{" "}
                <a href="https://www.deepl.com/pro#developer" target="_blank" rel="noreferrer">
                  deepl.com/pro
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ── Top bar ── */}
        <div className="top-bar">
          <button className="settings-btn" onClick={() => setShowSettings(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            API Settings
          </button>
        </div>

        <div className="content">
          {/* ── Header ── */}
          <div className="header">
            <div className="header-badge">
              <span className="header-badge-dot" />
              Neural Translation · DeepL Powered
            </div>
            <h1 className="header-title">
              {selectedLang && selectedLang.code !== "AUTO"
                ? `${selectedLang.flag} ${selectedLang.label}`
                : "Any Language"}{" "}
              →{" "}
              <span className="header-title-accent">বাংলা</span>
            </h1>
            <p className="header-desc">
              Upload an <code>.srt</code> subtitle file, pick the source language,
              and get a precise Bengali translation powered by DeepL.
            </p>
          </div>

          {/* ── Language card ── */}
          <div className="card">
            <div className="section-label">Source Language</div>
            <select
              className="lang-select"
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
            >
              {SOURCE_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} style={{ background: "#0a0a14" }}>
                  {lang.flag}  {lang.label}
                  {lang.code === "AUTO" ? "  —  DeepL detects automatically" : ""}
                </option>
              ))}
            </select>
            <div className={`lang-hint ${sourceLang !== "AUTO" ? "active" : ""}`}>
              {sourceLang === "AUTO"
                ? "🌐  DeepL will automatically detect the subtitle language"
                : `🎯  Translating ${selectedLang?.flag} ${selectedLang?.label} → বাংলা (Bengali)`}
            </div>
          </div>

          {/* ── Upload zone ── */}
          <div
            className={`drop-zone ${
              dragOver ? "drag-over" : file ? "has-file" : ""
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".srt"
              style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files[0])}
            />
            {file ? (
              <>
                <span className="drop-icon">📄</span>
                <div className="drop-title file-name">{file.name}</div>
                <div className="drop-sub file-meta">
                  {total} subtitle{total !== 1 ? "s" : ""} detected · Click to change
                </div>
              </>
            ) : (
              <>
                <span className="drop-icon" style={{ opacity: 0.4 }}>⬆️</span>
                <div className="drop-title">Drop your .srt file here</div>
                <div className="drop-sub">or click to browse · UTF-8 supported</div>
              </>
            )}
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="error-box">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* ── Translate button ── */}
          {file && status !== "translating" && status !== "done" && (
            <button className="translate-btn" onClick={translate}>
              ✦ Translate to বাংলা
            </button>
          )}

          {/* ── Progress ── */}
          {status === "translating" && (
            <div className="progress-wrap">
              <div className="progress-top">
                <div className="progress-label">
                  <div className="progress-spinner" />
                  {selectedLang?.code === "AUTO" ? "Auto-detecting" : selectedLang?.flag + " " + selectedLang?.label}
                  {" → বাংলা"}
                </div>
                <div className="progress-pct">{pct}%</div>
              </div>

              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="progress-counts">
                <span>{progress} of {total} subtitles translated</span>
                <span>Est. {estimatedTime}s · Batch size {BATCH_SIZE}</span>
              </div>
            </div>
          )}

          {/* ── Done ── */}
          {status === "done" && (
            <>
              <div className="success-box">
                <div className="success-icon">✅</div>
                <div>
                  <div className="success-title">Translation complete!</div>
                  <div className="success-sub">
                    {translated.length} subtitles translated to Bengali
                  </div>
                </div>
              </div>

              <div className="action-row">
                <button className="btn-download" onClick={download}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download Bengali .srt
                </button>
                <button
                  className="btn-new"
                  onClick={() => {
                    setFile(null);
                    setEntries([]);
                    setTranslated([]);
                    setStatus("idle");
                    setProgress(0);
                  }}
                >
                  New File
                </button>
              </div>

              <div className="preview-label">Preview — First 5 subtitles</div>
              <div className="preview-list">
                {translated.slice(0, 5).map((e, i) => (
                  <div key={i} className="preview-item">
                    <div className="preview-meta">#{e.index} · {e.timestamp}</div>
                    <div className="preview-text">{e.content}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="footer">
            Powered by DeepL · {SOURCE_LANGUAGES.length - 1} source languages · Always → বাংলা
          </div>
        </div>
      </div>
    </>
  );
}
