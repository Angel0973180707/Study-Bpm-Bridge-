/**
 * 幸福智多星 | 安全後端代理 (Node.js)
 * 檔案路徑：api/diagnose.js
 * 功能：保護金鑰，並將前測數據轉換為專業診斷
 */

export default async function handler(req, res) {
  // 從 Vercel 環境變數中讀取 GEMINI_API_KEY
  const apiKey = process.env.GEMINI_API_KEY;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支援 POST 請求' });
  }

  // 1. 安全檢查：確認金鑰是否存在
  if (!apiKey) {
    return res.status(500).json({ 
      error: '伺服器端找不到 GEMINI_API_KEY。請確認 Vercel 設定並執行 Redeploy。' 
    });
  }

  const { promptData, systemInstruction } = req.body;

  try {
    // 2. 呼叫 Google Gemini API (使用最新的 flash 模型)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    // 3. 檢查 API 是否有回報錯誤
    if (data.error) {
      return res.status(500).json({ error: `AI 服務錯誤: ${data.error.message}` });
    }

    // 4. 回傳數據給前端
    res.status(200).json(data);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: '連線中斷，請確認網路或 API 狀態。' });
  }
}