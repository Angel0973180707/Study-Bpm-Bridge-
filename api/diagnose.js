/**
 * api/diagnose.js (COMPLETE OVERWRITE)
 * 幸福智多星 | 安全後端代理 (Vercel Serverless Function)
 *
 * ✅ 使用 Vercel 環境變數：GEMINI_API_KEY
 * ✅ 模型 fallback（避免你遇到的 model not found）
 * ✅ 可選：網域白名單 / Token 防盜刷
 *
 * 建議 Vercel Environment Variables：
 * - GEMINI_API_KEY = 你的 Gemini API Key（必填）
 * - ALLOWED_ORIGINS = 允許來源網域（可選，多個用逗號）
 *   例：https://study-bpm-bridge.vercel.app,https://angel0973180707.github.io
 * - ACCESS_TOKEN = 前端必帶 token 才能呼叫（可選）
 * - GEMINI_MODEL = 想指定模型（可選），例：gemini-2.5-flash
 */

export default async function handler(req, res) {
  // --- 基本 CORS（同網域通常不需要，但加了更穩） ---
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Access-Token");

  if (req.method === "OPTIONS") {
    // 讓瀏覽器預檢直接通過
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "只支援 POST 請求" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "伺服器端找不到 GEMINI_API_KEY。請確認 Vercel 設定並執行 Redeploy。",
    });
  }

  // --- 可選：限制來源網域（Origin 白名單） ---
  // 注意：App內建 WebView / 某些情境可能沒有 Origin，故採「有 Origin 才檢查」的寬鬆策略
  const allowedOriginsRaw = (process.env.ALLOWED_ORIGINS || "").trim();
  const origin = req.headers.origin || "";
  if (allowedOriginsRaw && origin) {
    const allowed = allowedOriginsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (allowed.length > 0 && !allowed.includes(origin)) {
      return res.status(403).json({
        error: `Forbidden：此來源未在白名單內（origin=${origin}）`,
      });
    }
    // 回應 CORS allow-origin（只回應白名單來源）
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  // --- 可選：Token 防盜刷（前端 header 需帶 X-Access-Token） ---
  const requiredToken = (process.env.ACCESS_TOKEN || "").trim();
  if (requiredToken) {
    const token =
      (req.headers["x-access-token"] || req.headers["X-Access-Token"] || "").toString().trim();
    if (!token || token !== requiredToken) {
      return res.status(401).json({ error: "Unauthorized：缺少或錯誤的 access token" });
    }
  }

  // --- 讀取前端資料 ---
  let promptData, systemInstruction;
  try {
    ({ promptData, systemInstruction } = req.body || {});
  } catch {
    return res.status(400).json({ error: "JSON 解析失敗：請確認 POST body 是 JSON" });
  }

  if (!promptData) {
    return res.status(400).json({ error: "缺少 promptData" });
  }
  if (!systemInstruction || typeof systemInstruction !== "string") {
    return res.status(400).json({ error: "缺少 systemInstruction（需為字串）" });
  }

  // --- 模型策略：先穩定版，再 fallback ---
  // 你之前那個 preview 名稱會造成 not found，所以這裡先用穩定版本
  const primaryModel = (process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();
  const fallbackModels = [
    primaryModel,
    "gemini-1.5-flash",
    // 你也可以再加： "gemini-1.5-pro"
  ].filter(Boolean);

  // --- 送出內容（你目前前端送的是 promptData+systemInstruction）---
  // 我們把 promptData 轉成文字（JSON 字串），讓模型能讀懂
  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: JSON.stringify(promptData) }],
      },
    ],
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    generationConfig: {
      temperature: 0.7,
      // 你希望回 JSON，我們仍然提供，但若該模型/版本不支援，也不會因此崩掉
      responseMimeType: "application/json",
    },
  };

  // --- 超時保護（避免卡死）---
  const TIMEOUT_MS = 20000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  // 呼叫 Gemini（嘗試多個模型）
  try {
    let lastErrMsg = "";
    for (const model of fallbackModels) {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

      let resp, data;
      try {
        resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        data = await resp.json().catch(() => ({}));
      } catch (e) {
        lastErrMsg = `連線失敗（model=${model}）：${e?.message || String(e)}`;
        continue;
      }

      // Gemini 會用 data.error 回報
      if (data && data.error) {
        const msg = data.error.message || JSON.stringify(data.error);
        lastErrMsg = `AI 服務錯誤（model=${model}）：${msg}`;

        // 如果是「model not found / not supported」→ 換下一個模型再試
        const lower = String(msg).toLowerCase();
        const isModelNotFound =
          lower.includes("not found") ||
          lower.includes("not supported") ||
          lower.includes("model") && lower.includes("is not");

        if (isModelNotFound) continue;

        // 其他錯誤（例如：配額/權限/金鑰）就直接回
        return res.status(500).json({
          error: lastErrMsg,
          hint:
            "若是金鑰/配額/權限問題：請到 AI Studio/Google Cloud 檢查 key 是否有效、是否有啟用 API、是否超出配額。",
        });
      }

      // HTTP 非 2xx 但沒有 data.error 的情況
      if (!resp.ok) {
        lastErrMsg = `HTTP 錯誤（model=${model}）：status=${resp.status}`;
        // 400/404 常見就是模型不支援或不存在 → 試下一個
        if (resp.status === 400 || resp.status === 404) continue;
        return res.status(resp.status).json({ error: lastErrMsg, raw: data });
      }

      // ✅ 成功：回傳原始 data 給前端（你前端會從 candidates 取 text）
      return res.status(200).json({
        ...data,
        _meta: { usedModel: model },
      });
    }

    // 全部模型都失敗
    return res.status(500).json({
      error:
        lastErrMsg ||
        "所有模型嘗試皆失敗（可能是模型不可用 / key 無權限 / 配額不足 / 網路問題）",
      triedModels: fallbackModels,
    });
  } catch (error) {
    const msg =
      error?.name === "AbortError"
        ? `連線逾時（>${TIMEOUT_MS}ms），請稍後再試或降低請求頻率`
        : `連線中斷：${error?.message || String(error)}`;

    return res.status(500).json({ error: msg });
  } finally {
    clearTimeout(timer);
  }
}