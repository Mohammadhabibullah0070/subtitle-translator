export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { texts, apiKey, sourceLang } = req.body;

    if (!texts || !apiKey) {
      return res.status(400).json({ error: "Missing texts or apiKey" });
    }

    const textArray = Array.isArray(texts) ? texts : [texts];

    const body = {
      text: textArray,
      target_lang: "BN",
    };

    // Only set source_lang if not auto-detect
    if (sourceLang && sourceLang !== "AUTO") {
      body.source_lang = sourceLang;
    }

    const response = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("DeepL API Error:", response.status, data);
      return res
        .status(response.status)
        .json({ error: data.message || "DeepL API Error", details: data });
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
