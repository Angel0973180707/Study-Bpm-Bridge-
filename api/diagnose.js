/**
 * 幸福智多星 | 安全後端代理 (Node.js)
 * 檔案路徑：api/diagnose.js
 * * 功能：保護笑長的 API Key，並在伺服器端調用 Gemini AI。
 */
export default async function handler(req, res) {
  // 從 Vercel 環境變數讀取金鑰
  const apiKey = process.env.GEMINI_API_KEY;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: '伺服器尚未設定金鑰，請至 Vercel Settings 配置 GEMINI_API_KEY。' });
  }

  const { promptData, systemInstruction } = req.body;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: JSON.stringify(promptData) }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { 
          responseMimeType: "application/json",
          temperature: 0.7 
        }
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    res.status(200).json(data);
  } catch (error) {
    console.error('API Server Error:', error);
    res.status(500).json({ error: 'AI 服務連線異常，請稍後再試。' });
  }
}