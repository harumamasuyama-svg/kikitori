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
      "音声文字起こしには誤字、言い淀み、重複、脱線が含まれます。内容を整理して、実務で使える議事録にしてください。",
      "重要: 原文にない決定事項・日付・担当者・制度・施策を勝手に追加しないでください。推測した内容は『要確認』と明記してください。",
      "重要: 議題ごとに『要点』『決定事項・方針』『課題』『次の対応』を分けて書いてください。",
      "重要: 決定事項と次の対応が原文から明確に読み取れない場合は、『明確な決定事項なし』『次の対応は要確認』と書いてください。",
      "出力形式は必ず次の形にしてください。",
      date + " 議事録",
      "",
      "1. 概要",
      "会議全体を3〜5文で簡潔にまとめる。",
      "",
      "2. 議題別整理",
      "## 議題1: 議題名",
      "要点:",
      "・主要な発言、背景、数字、問題点を簡潔に書く。",
      "決定事項・方針:",
      "・明確に決まったこと、または方針として示されたことだけを書く。",
      "課題:",
      "・未解決の問題、リスク、確認が必要な点を書く。",
      "次の対応:",
      "・担当、期限、次にやることが分かる場合だけ書く。不明なら要確認と書く。",
      "",
      "必要な数だけ議題を増やしてください。",
      "",
      "3. 全体の決定事項・方針",
      "議題別の決定事項を重複なくまとめる。",
      "",
      "4. 全体の課題・要確認事項",
      "確認が必要な点、未確定事項、リスクをまとめる。"
    ].join("\n");
  }

  if (mode === "summary") {
    return [
      "あなたは日本語の要約アシスタントです。",
      "音声文字起こしの乱れを補正し、内容を短く分かりやすく要約してください。",
      "原文の箇条書き化ではなく、重要な論点、結論、数字、理由をまとめてください。",
      "原文にない内容は追加しないでください。推測が必要な場合は『要確認』と書いてください。",
      "出力は次の形にしてください。",
      date + " 要約",
      "概要: 2〜4文",
      "重要ポイント: 箇条書き5〜8個",
      "結論: 1〜2文"
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
