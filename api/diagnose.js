/**
 * 幸福智多星 | 安全後端代理 (Node.js)
 * 檔案路徑：api/diagnose.js
 */
export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 檢查環境變數
  if (!apiKey) {
    return res.status(500).json({ 
      error: '【系統提示】請至 Vercel Settings > Environment Variables 新增名為 GEMINI_API_KEY 的金鑰變數。' 
    });
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

    if (data.error) {
      return res.status(500).json({ error: `【AI 服務報錯】${data.error.message}` });
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: `【連線異常】${error.message}` });
  }
}