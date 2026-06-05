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
    const { texts, apiKey } = req.body;

    if (!texts || !apiKey) {
      return res.status(400).json({ error: "Missing texts or apiKey" });
    }

    // Fix 1: Use /v2/translate (not /v1/)
    // Fix 2: text must be an array of strings, not a joined string
    const textArray = Array.isArray(texts) ? texts : [texts];

    const response = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: textArray,
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

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
