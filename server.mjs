#!/usr/bin/env node
/**
 * Static resume site + OpenCode vacancy matcher.
 * Zero magic: Express serves public/, /api/* calls local `opencode run`.
 */
import express from "express";
import multer from "multer";
import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.RESUME_ROOT || __dirname;
const PUBLIC = path.join(ROOT, "public");
const CONTENT = path.join(ROOT, "content");
const RESUME_MD = path.join(CONTENT, "resume.md");
const PROMPT_MD = path.join(ROOT, "prompts", "match.md");
const PHOTO_CANDIDATES = [
  "photo.jpg",
  "photo.jpeg",
  "photo.png",
  "photo.webp",
  "photo.svg",
  "avatar.jpg",
  "avatar.jpeg",
  "avatar.png",
  "avatar.webp",
  "avatar.svg",
];
const PHOTO_MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const OPENCODE_BIN = process.env.OPENCODE_BIN || "opencode";
const OPENCODE_MODEL = process.env.OPENCODE_MODEL || "opencode/deepseek-v4-flash-free";
const OPENCODE_TIMEOUT_MS = Number(process.env.OPENCODE_TIMEOUT_MS || 180_000);
const MAX_VACANCY_CHARS = Number(process.env.MAX_VACANCY_CHARS || 80_000);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.static(PUBLIC));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "resume-match",
    model: OPENCODE_MODEL,
    opencode: OPENCODE_BIN,
  });
});

app.get("/api/resume.md", async (_req, res) => {
  try {
    const md = await readFile(RESUME_MD, "utf8");
    res.type("text/markdown; charset=utf-8").send(md);
  } catch (err) {
    res.status(500).json({ error: `Cannot read resume.md: ${err.message}` });
  }
});

app.get("/api/photo", async (_req, res) => {
  try {
    const photo = await findPhoto();
    if (!photo) {
      return res.status(404).json({
        error: "Фото не найдено. Положите content/photo.jpg (или .png/.webp)",
      });
    }
    res.setHeader("Content-Type", photo.mime);
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.sendFile(photo.path);
  } catch (err) {
    return res.status(500).json({ error: `Cannot read photo: ${err.message}` });
  }
});

app.get("/api/photo/meta", async (_req, res) => {
  const photo = await findPhoto();
  res.json({
    ok: Boolean(photo),
    file: photo ? path.basename(photo.path) : null,
  });
});

app.post("/api/match", upload.single("pdf"), async (req, res) => {
  const started = Date.now();
  try {
    const vacancy = await resolveVacancy(req);
    if (!vacancy.trim()) {
      return res.status(400).json({ error: "Пустая вакансия: нужен text, url или pdf" });
    }
    if (vacancy.length > MAX_VACANCY_CHARS) {
      return res.status(400).json({
        error: `Вакансия слишком длинная (${vacancy.length} > ${MAX_VACANCY_CHARS} символов)`,
      });
    }

    const resume = await readFile(RESUME_MD, "utf8");
    const promptTpl = await readFile(PROMPT_MD, "utf8");
    const message = [
      promptTpl.trim(),
      "",
      "===== РЕЗЮМЕ =====",
      resume.trim(),
      "",
      "===== ВАКАНСИЯ =====",
      vacancy.trim(),
    ].join("\n");

    const raw = await runOpenCode(message);
    const parsed = extractJson(raw);
    parsed.model = OPENCODE_MODEL;
    parsed.elapsedMs = Date.now() - started;
    parsed.vacancyChars = vacancy.length;
    return res.json(parsed);
  } catch (err) {
    console.error("[match]", err);
    return res.status(500).json({
      error: err.message || String(err),
      elapsedMs: Date.now() - started,
    });
  }
});

// SPA-like fallback (Express 5 path syntax)
app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(PUBLIC, "index.html"));
});

async function findPhoto() {
  for (const name of PHOTO_CANDIDATES) {
    const full = path.join(CONTENT, name);
    try {
      await access(full, fsConstants.R_OK);
      const ext = path.extname(name).toLowerCase();
      return { path: full, mime: PHOTO_MIME[ext] || "application/octet-stream" };
    } catch {
      // try next candidate
    }
  }
  return null;
}

async function resolveVacancy(req) {
  if (req.file) {
    const parser = new PDFParse({ data: req.file.buffer });
    try {
      const out = await parser.getText();
      return String(out?.text || "").trim();
    } finally {
      await parser.destroy().catch(() => {});
    }
  }

  const body = req.body || {};
  if (body.url) return fetchUrlText(String(body.url).trim());
  if (body.text) return String(body.text);
  return "";
}

async function fetchUrlText(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Некорректный URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Разрешены только http/https");
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "resume-match/1.0 (+https://localhost; vacancy-fetch)",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) throw new Error(`Не удалось скачать URL: HTTP ${res.status}`);
    const ctype = res.headers.get("content-type") || "";
    const buf = Buffer.from(await res.arrayBuffer());

    if (ctype.includes("pdf") || url.toLowerCase().endsWith(".pdf")) {
      const parser = new PDFParse({ data: buf });
      try {
        const out = await parser.getText();
        return String(out?.text || "").trim();
      } finally {
        await parser.destroy().catch(() => {});
      }
    }

    const html = buf.toString("utf8");
    return htmlToText(html);
  } finally {
    clearTimeout(t);
  }
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(p|div|h1|h2|h3|h4|li|br|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function runOpenCode(message) {
  return new Promise((resolve, reject) => {
    const args = [
      "run",
      "--format", "json",
      "--dir", ROOT,
      "--title", "resume-vacancy-match",
      "-m", OPENCODE_MODEL,
      message,
    ];

    const child = spawn(OPENCODE_BIN, args, {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`OpenCode timeout after ${OPENCODE_TIMEOUT_MS}ms`));
    }, OPENCODE_TIMEOUT_MS);

    child.stdout.on("data", (d) => { stdout += d.toString("utf8"); });
    child.stderr.on("data", (d) => { stderr += d.toString("utf8"); });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Не удалось запустить OpenCode (${OPENCODE_BIN}): ${err.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`OpenCode exit ${code}: ${stderr.slice(-800) || stdout.slice(-800)}`));
        return;
      }
      resolve(stdout);
    });
  });
}

function extractJson(ndjson) {
  const texts = [];
  for (const line of ndjson.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const evt = JSON.parse(trimmed);
      if (evt?.type === "text" && evt?.part?.text) texts.push(evt.part.text);
      if (evt?.type === "error") {
        throw new Error(evt.error?.message || JSON.stringify(evt.error) || "OpenCode error event");
      }
    } catch (err) {
      if (err.message.startsWith("OpenCode")) throw err;
      // skip non-json noise
    }
  }

  const blob = texts.join("\n").trim();
  if (!blob) throw new Error("OpenCode вернул пустой ответ");

  const candidates = [
    blob,
    ...((blob.match(/\{[\s\S]*\}/g) || []).sort((a, b) => b.length - a.length)),
  ];

  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      // try next
    }
  }

  // strip ```json fences if present
  const fenced = blob.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(fenced);
  } catch {
    throw new Error(`Не удалось разобрать JSON от OpenCode. Фрагмент: ${blob.slice(0, 400)}`);
  }
}

app.listen(PORT, HOST, () => {
  console.log(`[resume] http://${HOST}:${PORT}`);
  console.log(`[resume] model=${OPENCODE_MODEL} bin=${OPENCODE_BIN}`);
  console.log(`[resume] source=${RESUME_MD}`);
});