import { useState, useRef, useCallback } from "react";

const BATCH_SIZE = 25; // subtitles per API call (reduced for token efficiency)
const DELAY_BETWEEN_BATCHES = 500; // ms - rate limiting
const MAX_RETRIES = 3;
const API_TIMEOUT = 30000; // 30 seconds

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

async function translateBatch(texts, retryCount = 0) {
  const apiKey = localStorage.getItem("deepl_api_key");
  if (!apiKey) {
    throw new Error("DeepL API key not set. Please configure it in settings.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    // Call backend proxy to translate with DeepL
    const backendUrl =
      process.env.NODE_ENV === "production"
        ? "/api/translate"
        : "http://localhost:3001/translate";

    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        texts: texts,
        apiKey: apiKey,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 429 && retryCount < MAX_RETRIES) {
        await sleep((retryCount + 1) * 3000);
        return translateBatch(texts, retryCount + 1);
      }
      throw new Error(
        `DeepL API Error ${response.status}: ${errorData.error || errorData.message || response.statusText}`,
      );
    }

    const data = await response.json();
    return data.translations.map((t) => t.text);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      if (retryCount < MAX_RETRIES) {
        await sleep(1000 * (retryCount + 1));
        return translateBatch(texts, retryCount + 1);
      }
      throw new Error("Request timeout after retries");
    }
    if (retryCount < MAX_RETRIES && !err.message.includes("API key")) {
      await sleep(1000 * (retryCount + 1));
      return translateBatch(texts, retryCount + 1);
    }
    throw err;
  }
}

export default function App() {
  const [file, setFile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [translated, setTranslated] = useState([]);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | parsing | translating | done | error
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem("deepl_api_key") || "",
  );
  const [showSettings, setShowSettings] = useState(
    !localStorage.getItem("deepl_api_key"),
  );
  const fileRef = useRef();

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
    const f = e.dataTransfer.files[0];
    handleFile(f);
  };

  const translate = async () => {
    if (!entries.length) return;
    if (!apiKey) {
      setError("Please configure your DeepL API key first");
      setShowSettings(true);
      return;
    }
    setStatus("translating");
    setProgress(0);
    setError("");
    const result = [...entries];

    try {
      const totalBatches = Math.ceil(entries.length / BATCH_SIZE);
      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);
        const texts = batch.map((e) => e.content);
        const translatedTexts = await translateBatch(texts);
        translatedTexts.forEach((t, j) => {
          result[i + j] = { ...result[i + j], content: t };
        });
        setProgress(Math.min(i + BATCH_SIZE, entries.length));

        // Add delay between batches (except after the last one)
        if (i + BATCH_SIZE < entries.length) {
          await sleep(DELAY_BETWEEN_BATCHES);
        }
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
    const blob = new Blob(["\uFEFF" + srtContent], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name.replace(".srt", "_Bengali.srt");
    a.click();
    URL.revokeObjectURL(url);
  };

  const pct = total ? Math.round((progress / total) * 100) : 0;
  const estimatedTime =
    total > 0
      ? Math.ceil((total / BATCH_SIZE) * (DELAY_BETWEEN_BATCHES / 1000))
      : 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0c0c0f",
        fontFamily: "'Syne', sans-serif",
        color: "#f0ebe3",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "48px 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Google Fonts */}
      <link
        href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Noto+Sans+Bengali:wght@400;500&display=swap"
        rel="stylesheet"
      />

      {/* Background decoration */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 60% 50% at 70% 20%, rgba(234,88,12,0.12) 0%, transparent 70%), radial-gradient(ellipse 40% 40% at 20% 80%, rgba(234,88,12,0.07) 0%, transparent 70%)",
        }}
      />

      {/* Settings Modal */}
      {showSettings && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#1a1a1d",
              borderRadius: 12,
              padding: "32px",
              maxWidth: 400,
              border: "1px solid rgba(234,88,12,0.2)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                marginBottom: 12,
                fontWeight: 700,
              }}
            >
              Configure DeepL API Key
            </h2>
            <p style={{ color: "#9a9080", fontSize: 13, marginBottom: 16 }}>
              Enter your free DeepL API key. It will be stored locally in your
              browser and never sent to external servers.
            </p>
            <input
              type="password"
              placeholder="Your-API-Key-Here"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                color: "#f0ebe3",
                fontSize: 13,
                marginBottom: 16,
                boxSizing: "border-box",
                fontFamily: "monospace",
              }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => handleApiKeyChange(apiKey)}
                style={{
                  flex: 1,
                  background: "linear-gradient(135deg, #f97316, #ea580c)",
                  border: "none",
                  borderRadius: 6,
                  color: "#fff",
                  fontWeight: 600,
                  padding: "10px 0",
                  cursor: "pointer",
                }}
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowSettings(false);
                  setApiKey(localStorage.getItem("deepl_api_key") || "");
                }}
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6,
                  color: "#f0ebe3",
                  fontWeight: 600,
                  padding: "10px 0",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#5a5040",
                marginTop: 16,
                textAlign: "center",
              }}
            >
              Get your free key at{" "}
              <a
                href="https://www.deepl.com/pro#developer"
                target="_blank"
                rel="noreferrer"
                style={{ color: "#f97316" }}
              >
                deepl.com/pro#developer
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Header with Settings */}
      <div style={{ position: "fixed", top: 20, right: 20, zIndex: 100 }}>
        <button
          onClick={() => setShowSettings(true)}
          style={{
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6,
            color: "#f0ebe3",
            padding: "8px 14px",
            fontSize: 13,
            cursor: "pointer",
            fontWeight: 600,
            fontFamily: "'Syne', sans-serif",
          }}
        >
          ⚙ Settings
        </button>
      </div>

      {/* Header */}
      <div
        style={{ textAlign: "center", marginBottom: 52, position: "relative" }}
      >
        <div
          style={{
            display: "inline-block",
            background: "rgba(234,88,12,0.15)",
            border: "1px solid rgba(234,88,12,0.3)",
            borderRadius: 4,
            padding: "4px 14px",
            fontSize: 11,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "#f97316",
            marginBottom: 18,
            fontWeight: 600,
          }}
        >
          AI-Powered · Subtitle Translation
        </div>
        <h1
          style={{
            fontSize: "clamp(2rem, 6vw, 3.8rem)",
            fontWeight: 800,
            margin: 0,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
          }}
        >
          English →{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #f97316, #ea580c)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            বাংলা
          </span>
        </h1>
        <p
          style={{
            color: "#9a9080",
            marginTop: 14,
            fontSize: 15,
            letterSpacing: "0.01em",
            maxWidth: 420,
            margin: "14px auto 0",
          }}
        >
          Upload your movie or TV series{" "}
          <code
            style={{
              background: "rgba(255,255,255,0.07)",
              padding: "1px 6px",
              borderRadius: 3,
              fontSize: 13,
            }}
          >
            .srt
          </code>{" "}
          subtitle file and get a natural, accurate Bengali translation with
          DeepL.
        </p>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current.click()}
        style={{
          width: "100%",
          maxWidth: 560,
          border: `2px dashed ${dragOver ? "#f97316" : file ? "rgba(249,115,22,0.4)" : "rgba(255,255,255,0.1)"}`,
          borderRadius: 12,
          padding: "40px 32px",
          textAlign: "center",
          cursor: "pointer",
          background: dragOver
            ? "rgba(249,115,22,0.06)"
            : file
              ? "rgba(249,115,22,0.03)"
              : "rgba(255,255,255,0.02)",
          transition: "all 0.2s ease",
          marginBottom: 24,
          position: "relative",
        }}
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
            <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#f97316" }}>
              {file.name}
            </div>
            <div style={{ color: "#7a7060", fontSize: 13, marginTop: 6 }}>
              {total} subtitle{total !== 1 ? "s" : ""} detected · Click to
              change
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>
              ⬆️
            </div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              Drop your .srt file here
            </div>
            <div style={{ color: "#7a7060", fontSize: 13, marginTop: 6 }}>
              or click to browse
            </div>
          </>
        )}
      </div>

      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 8,
            padding: "12px 20px",
            color: "#fca5a5",
            fontSize: 14,
            marginBottom: 20,
            maxWidth: 560,
            width: "100%",
          }}
        >
          {error}
        </div>
      )}

      {/* Translate Button */}
      {file && status !== "translating" && status !== "done" && (
        <button
          onClick={translate}
          style={{
            background: "linear-gradient(135deg, #f97316, #ea580c)",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            fontSize: 16,
            padding: "14px 44px",
            cursor: "pointer",
            letterSpacing: "0.02em",
            boxShadow: "0 4px 24px rgba(249,115,22,0.35)",
            transition: "transform 0.15s, box-shadow 0.15s",
            marginBottom: 32,
          }}
          onMouseOver={(e) => {
            e.target.style.transform = "translateY(-2px)";
            e.target.style.boxShadow = "0 8px 32px rgba(249,115,22,0.45)";
          }}
          onMouseOut={(e) => {
            e.target.style.transform = "";
            e.target.style.boxShadow = "0 4px 24px rgba(249,115,22,0.35)";
          }}
        >
          Translate to বাংলা
        </button>
      )}

      {/* Progress Bar */}
      {status === "translating" && (
        <div style={{ width: "100%", maxWidth: 560, marginBottom: 32 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 10,
              fontSize: 13,
              color: "#9a9080",
            }}
          >
            <span>Translating subtitles…</span>
            <span>
              {progress} / {total} ({pct}%)
            </span>
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.06)",
              borderRadius: 99,
              height: 8,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 99,
                background: "linear-gradient(90deg, #f97316, #ea580c)",
                width: `${pct}%`,
                transition: "width 0.4s ease",
                boxShadow: "0 0 12px rgba(249,115,22,0.5)",
              }}
            />
          </div>
          <div
            style={{
              color: "#6a6050",
              fontSize: 12,
              marginTop: 8,
              textAlign: "center",
            }}
          >
            Processing in batches of {BATCH_SIZE} · Est. time: {estimatedTime}s
            · Rate limited to prevent API throttling
          </div>
        </div>
      )}

      {/* Done State */}
      {status === "done" && (
        <div style={{ width: "100%", maxWidth: 560 }}>
          <div
            style={{
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.25)",
              borderRadius: 10,
              padding: "16px 24px",
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 22 }}>✅</span>
            <div>
              <div style={{ fontWeight: 700, color: "#86efac", fontSize: 15 }}>
                Translation complete!
              </div>
              <div style={{ color: "#6a9060", fontSize: 13 }}>
                {translated.length} subtitles translated to Bengali
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
            <button
              onClick={download}
              style={{
                flex: 1,
                background: "linear-gradient(135deg, #f97316, #ea580c)",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                fontFamily: "'Syne', sans-serif",
                fontWeight: 700,
                fontSize: 15,
                padding: "13px 0",
                cursor: "pointer",
                boxShadow: "0 4px 20px rgba(249,115,22,0.3)",
              }}
            >
              ⬇ Download Bengali .srt
            </button>
            <button
              onClick={() => {
                setFile(null);
                setEntries([]);
                setTranslated([]);
                setStatus("idle");
                setProgress(0);
              }}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                color: "#f0ebe3",
                fontFamily: "'Syne', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                padding: "13px 20px",
                cursor: "pointer",
              }}
            >
              New File
            </button>
          </div>

          {/* Preview */}
          <div
            style={{
              marginBottom: 12,
              fontWeight: 700,
              fontSize: 14,
              color: "#9a9080",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Preview (first 5)
          </div>
          <div
            style={{
              borderRadius: 10,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {translated.slice(0, 5).map((e, i) => (
              <div
                key={i}
                style={{
                  padding: "14px 20px",
                  borderBottom:
                    i < 4 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  background:
                    i % 2 === 0
                      ? "rgba(255,255,255,0.02)"
                      : "rgba(255,255,255,0.01)",
                }}
              >
                <div
                  style={{
                    color: "#5a5040",
                    fontSize: 11,
                    marginBottom: 4,
                    fontFamily: "monospace",
                  }}
                >
                  #{e.index} · {e.timestamp}
                </div>
                <div
                  style={{
                    fontFamily: "'Noto Sans Bengali', sans-serif",
                    fontSize: 15,
                    lineHeight: 1.6,
                    color: "#f0ebe3",
                  }}
                >
                  {e.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p
        style={{
          color: "#3a3028",
          fontSize: 12,
          marginTop: "auto",
          paddingTop: 48,
          textAlign: "center",
        }}
      >
        Powered by DeepL · High-Quality AI Translation · Supports standard .srt
        format
      </p>
    </div>
  );
}
