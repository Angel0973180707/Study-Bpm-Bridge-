/**
 * 幸福智多星 | 安全後端代理 (Node.js)
 * 檔案路徑：api/diagnose.js
 */
export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支援 POST 請求' });
  }

  // 1. 檢查 Vercel 環境變數
  if (!apiKey) {
    return res.status(500).json({ 
      error: '【錯誤：缺少金鑰】請至 Vercel Settings > Environment Variables 新增名為 GEMINI_API_KEY 的變數。' 
    });
  }

  const { promptData, systemInstruction } = req.body;

  try {
    // 2. 呼叫 Google Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: JSON.stringify(promptData) }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { 
          responseMimeType: "application/json", // 強制要求 JSON
          temperature: 0.7 
        }
      })
    });

    const data = await response.json();

    // 3. 檢查 Google 回傳的原始錯誤
    if (data.error) {
      return res.status(500).json({ error: `【Google AI 報錯】${data.error.message}` });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('API Server Error:', error);
    res.status(500).json({ error: `【伺服器異常】${error.message}` });
  }
}