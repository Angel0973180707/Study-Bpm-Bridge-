/**
 * 幸福智多星 | 安全後端代理 (Node.js)
 * 檔案路徑：api/diagnose.js
 * 功能：安全地調用 Gemini AI，保護 API Key 不外洩。
 */

export default async function handler(req, res) {
  // 從 Vercel 環境變數中讀取 GEMINI_API_KEY
  const apiKey = process.env.GEMINI_API_KEY;

  // 只允許 POST 請求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { promptData, systemInstruction } = req.body;

  if (!apiKey) {
    return res.status(500).json({ error: '伺服器尚未設定 API Key' });
  }

  try {
    // 呼叫 Google Gemini API (使用最新的 gemini-2.5-flash-preview-09-2025)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: JSON.stringify(promptData) }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7,
        }
      })
    });

    const data = await response.json();

    // 檢查 Google API 是否回報錯誤
    if (data.error) {
      console.error('Gemini API Error:', data.error);
      return res.status(500).json({ error: data.error.message });
    }

    // 將 AI 的解讀結果回傳給前端網頁
    res.status(200).json(data);
  } catch (error) {
    console.error('Server Side Error:', error);
    res.status(500).json({ error: '解讀大腦暫時忙碌，請稍後再試。' });
  }
}
