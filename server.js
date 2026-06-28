const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const maxChars = Number(process.env.KIKITORI_MAX_CHARS || 80000);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxChars * 4) {
        reject(new Error("入力が長すぎます。少し分けて清書してください。"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function instructionFor(mode, date) {
  if (mode === "minutes") {
    return [
      "あなたは日本語の議事録作成アシスタントです。",
      "音声文字起こしには誤字、言い淀み、重複、脱線が含まれます。",
      "事実を捏造せず、重要な内容だけを読みやすく整理してください。",
      "出力は次の見出しにしてください。",
      date + " 議事録",
      "1. 概要",
      "2. 議題",
      "3. 主な要点",
      "4. 決定事項・方針",
      "5. 課題",
      "6. 次の対応",
      "不明な項目は『不明』ではなく、分かる範囲で簡潔に書いてください。"
    ].join("\n");
  }
  if (mode === "summary") {
    return [
      "あなたは日本語の要約アシスタントです。",
      "音声文字起こしの乱れを補正し、内容を短く分かりやすく要約してください。",
      "原文の箇条書き化ではなく、重要な論点、結論、数字、理由をまとめてください。",
      "出力は次の形にしてください。",
      date + " 要約",
      "概要: 2〜4文",
      "重要ポイント: 箇条書き5〜8個",
      "結論: 1〜2文",
      "事実を捏造しないでください。"
    ].join("\n");
  }
  return [
    "あなたは日本語の日記清書アシスタントです。",
    "音声入力の話し言葉、重複、言い淀みを自然な日本語に整えてください。",
    "内容を勝手に増やさず、出来事、食べたもの、気持ちが分かるようにまとめてください。",
    "出力は『" + date + "の日記』というタイトルから始め、読みやすい段落にしてください。",
    "気持ちが語られていない場合は、無理に感情を作らないでください。"
  ].join("\n");
}

async function polishWithOpenAI(payload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEYが設定されていません。");

  const text = String(payload.text || "").trim();
  if (!text) throw new Error("清書する本文がありません。");
  if (text.length > maxChars) throw new Error("入力が長すぎます。少し分けて清書してください。");

  const mode = ["diary", "minutes", "summary"].includes(payload.mode) ? payload.mode : "diary";
  const date = payload.date || new Date().toISOString().slice(0, 10);
  const instruction = instructionFor(mode, date);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: instruction },
        { role: "user", content: text }
      ]
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error && data.error.message ? data.error.message : "OpenAI APIでエラーが発生しました。";
    throw new Error(message);
  }

  const output = data.output_text || (data.output || []).flatMap((item) => item.content || []).map((part) => part.text || "").join("\n").trim();
  if (!output) throw new Error("AIから清書結果を受け取れませんでした。");
  return output;
}

function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(root, pathname));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/polish") {
    try {
      const body = await readBody(req);
      const payload = JSON.parse(body || "{}");
      const text = await polishWithOpenAI(payload);
      sendJson(res, 200, { text });
    } catch (error) {
      sendJson(res, 500, { error: error.message || "清書できませんでした。" });
    }
    return;
  }
  serveStatic(req, res);
});

server.listen(port, host, () => {
  const browserHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  const url = "http://" + browserHost + ":" + port + "/index.html?v=14";
  console.log("キキトリ local AI server: " + url);
  console.log("API key: " + (process.env.OPENAI_API_KEY ? "set" : "not set"));
  console.log("Model: " + model);
  if (process.env.AUTO_OPEN === "1") {
    require("child_process").exec('start "" "' + url + '"');
  }
});
