/**
 * 幸福智多星 | 安全後端代理 (Node.js)
 * 檔案路徑：api/diagnose.js
 */
export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. 確保 Vercel 環境變數有填寫
  if (!apiKey) {
    return res.status(500).json({ 
      error: '【錯誤】保險箱缺少金鑰，請至 Vercel Settings > Environment Variables 設定 GEMINI_API_KEY。' 
    });
  }

  const { promptData, systemInstruction } = req.body;

  try {
    // 2. 呼叫 Google Gemini 2.5 Flash
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

    // 3. 檢查 API 回傳狀態
    if (data.error) {
      return res.status(500).json({ error: `【AI 大腦報錯】${data.error.message}` });
    }

    // 傳回原始數據，由前端進行最後的 JSON 清理
    res.status(200).json(data);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: `【連線中斷】伺服器連線異常：${error.message}` });
  }
}