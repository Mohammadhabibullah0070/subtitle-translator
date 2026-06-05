import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/translate", async (req, res) => {
  try {
    const { texts, apiKey } = req.body;

    if (!texts || !apiKey) {
      return res.status(400).json({ error: "Missing texts or apiKey" });
    }

    const response = await fetch("https://api-free.deepl.com/v1/translate", {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: Array.isArray(texts) ? texts.join("\n") : texts,
        source_lang: "EN",
        target_lang: "BN",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("DeepL API Error:", response.status, data);
      return res
        .status(response.status)
        .json({ error: data.message || "DeepL API Error", details: data });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
