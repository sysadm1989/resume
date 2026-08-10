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
import { buildResumePdf } from "./lib/resume-pdf.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.RESUME_ROOT || __dirname;
const PUBLIC = path.join(ROOT, "public");
const CONTENT = path.join(ROOT, "content");
const FONTS = path.join(ROOT, "assets", "fonts");
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

sanitizeOpenCodeConfigDir();

function sanitizeOpenCodeConfigDir() {
  const raw = process.env.OPENCODE_CONFIG_DIR;
  if (!raw) return;
  const looksPlaceholder = /\/home\/YOU\b|\/Users\/YOU\b|\$\{?HOME\}?|YOUR_/i.test(raw);
  if (looksPlaceholder) {
    console.warn(`[resume] ignore placeholder OPENCODE_CONFIG_DIR=${raw}`);
    delete process.env.OPENCODE_CONFIG_DIR;
    return;
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.static(PUBLIC));

app.get("/api/health", async (_req, res) => {
  const probe = await probeOpenCode();
  res.json({
    ok: true,
    service: "resume-match",
    model: OPENCODE_MODEL,
    opencode: OPENCODE_BIN,
    opencodeOk: probe.ok,
    opencodeVersion: probe.version || null,
    opencodeError: probe.ok ? null : probe.error,
  });
});

app.get("/api/opencode", async (_req, res) => {
  const probe = await probeOpenCode();
  const status = probe.ok ? 200 : 503;
  res.status(status).json({
    ok: probe.ok,
    bin: OPENCODE_BIN,
    model: OPENCODE_MODEL,
    version: probe.version || null,
    error: probe.ok ? null : probe.error,
    hint: probe.ok
      ? null
      : "Установите OpenCode и выполните opencode auth под тем же пользователем, что запускает сервис",
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

app.get("/api/resume.pdf", async (_req, res) => {
  try {
    const md = await readFile(RESUME_MD, "utf8");
    const photo = await findPhoto();
    const pdf = await buildResumePdf({
      md,
      fontsDir: FONTS,
      photoPath: photo?.path || null,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Nazarov-Alexey-DevOps.pdf"'
    );
    res.setHeader("Cache-Control", "private, max-age=60");
    return res.send(pdf);
  } catch (err) {
    console.error("[resume.pdf]", err);
    return res.status(500).json({ error: `Cannot build PDF: ${err.message}` });
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
    const classified = classifyOpenCodeError(err);
    return res.status(classified.status).json({
      error: classified.error,
      code: classified.code,
      hint: classified.hint,
      detail: classified.detail || undefined,
      model: OPENCODE_MODEL,
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

  const host = parsed.hostname.toLowerCase();
  const isHh = /(^|\.)hh\.(ru|kz|uz|by)$/i.test(host) || host.includes("headhunter");

  // hh.ru / многие ATS режут бот-UA → 423/403/406
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    "Upgrade-Insecure-Requests": "1",
  };

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25_000);
  try {
    if (isHh) {
      const fromApi = await fetchHhVacancyApi(parsed, headers, ctrl.signal);
      if (fromApi) return fromApi;
    }

    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers,
    });
    if (!res.ok) {
      if ([401, 403, 406, 423, 429, 503].includes(res.status)) {
        throw new Error(
          `vacancy_url_blocked: сайт вакансии ответил HTTP ${res.status} (anti-bot). Вставьте текст вакансии вручную`
        );
      }
      throw new Error(`Не удалось скачать URL: HTTP ${res.status}`);
    }
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
    const extracted = extractVacancyHtml(html, { preferJobPosting: isHh });
    if (!extracted || extracted.length < 80) {
      throw new Error(
        "vacancy_url_empty: не удалось извлечь текст вакансии со страницы. Вставьте текст вручную (вкладка «Текст»)"
      );
    }
    return extracted;
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error("vacancy_url_blocked: таймаут загрузки страницы вакансии. Вставьте текст вручную");
    }
    throw err;
  } finally {
    clearTimeout(t);
  }
}

async function fetchHhVacancyApi(parsed, baseHeaders, signal) {
  const m = parsed.pathname.match(/\/vacancy\/(\d+)/i);
  if (!m) return null;
  const id = m[1];
  try {
    const res = await fetch(`https://api.hh.ru/vacancies/${id}`, {
      signal,
      headers: {
        ...baseHeaders,
        Accept: "application/json",
        "HH-User-Agent": "ResumeMatch/1.0 (sysadm1989@gmail.com)",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parts = [];
    if (data.name) parts.push(`Вакансия: ${data.name}`);
    if (data.employer?.name) parts.push(`Компания: ${data.employer.name}`);
    if (data.area?.name) parts.push(`Город: ${data.area.name}`);
    if (data.experience?.name) parts.push(`Опыт: ${data.experience.name}`);
    if (data.schedule?.name) parts.push(`График: ${data.schedule.name}`);
    if (Array.isArray(data.key_skills) && data.key_skills.length) {
      parts.push(`Навыки: ${data.key_skills.map((s) => s.name).filter(Boolean).join(", ")}`);
    }
    if (data.description) parts.push(htmlToText(String(data.description)));
    const text = parts.join("\n").trim();
    return text.length >= 80 ? text : null;
  } catch {
    return null;
  }
}

function extractVacancyHtml(html, opts = {}) {
  if (opts.preferJobPosting) {
    const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const block of blocks) {
      try {
        const raw = block[1].trim();
        const data = JSON.parse(raw);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          const graph = item["@graph"] || [item];
          for (const node of graph) {
            if (!node || typeof node !== "object") continue;
            const type = String(node["@type"] || "");
            if (!/JobPosting/i.test(type)) continue;
            const parts = [];
            if (node.title) parts.push(`Вакансия: ${node.title}`);
            if (node.hiringOrganization?.name) parts.push(`Компания: ${node.hiringOrganization.name}`);
            if (node.jobLocation?.address?.addressLocality) {
              parts.push(`Город: ${node.jobLocation.address.addressLocality}`);
            }
            if (node.description) parts.push(htmlToText(String(node.description)));
            const text = parts.join("\n").trim();
            if (text.length >= 80) return text;
          }
        }
      } catch {
        // next block
      }
    }

    const qa = html.match(/data-qa=["']vacancy-description["'][^>]*>([\s\S]*?)<\/div>/i);
    if (qa?.[1]) {
      const text = htmlToText(qa[1]);
      if (text.length >= 80) return text;
    }
  }
  return htmlToText(html);
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

function probeOpenCode() {
  return new Promise((resolve) => {
    const child = spawn(OPENCODE_BIN, ["--version"], {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ ok: false, error: `OpenCode не ответил за 5с (${OPENCODE_BIN} --version)` });
    }, 5_000);

    child.stdout.on("data", (d) => { stdout += d.toString("utf8"); });
    child.stderr.on("data", (d) => { stderr += d.toString("utf8"); });
    child.on("error", (err) => {
      clearTimeout(timer);
      const missing = err.code === "ENOENT";
      resolve({
        ok: false,
        error: missing
          ? `OpenCode не найден (bin=${OPENCODE_BIN}). Установите CLI и добавьте в PATH`
          : `Не удалось запустить OpenCode: ${err.message}`,
      });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const out = (stdout || stderr).trim();
      if (code !== 0) {
        resolve({
          ok: false,
          error: `OpenCode --version exit ${code}: ${out.slice(0, 240) || "no output"}`,
        });
        return;
      }
      resolve({ ok: true, version: out.split("\n")[0].trim() || "ok" });
    });
  });
}

function classifyOpenCodeError(err) {
  const raw = err?.message || String(err);
  const lower = raw.toLowerCase();

  if (/vacancy_url_blocked|anti-bot|http (401|403|423|429|503)/i.test(raw)) {
    return {
      status: 422,
      code: "vacancy_url_blocked",
      error: "Не удалось скачать вакансию по ссылке",
      hint: "hh.ru и похожие сайты часто блокируют автоматическую загрузку. Откройте вакансию, скопируйте текст и вставьте во вкладку «Текст»",
      detail: raw,
    };
  }

  if (/vacancy_url_empty|не удалось извлечь текст/i.test(raw)) {
    return {
      status: 422,
      code: "vacancy_url_empty",
      error: "По ссылке не удалось прочитать текст вакансии",
      hint: "Вставьте описание вакансии вручную во вкладку «Текст»",
      detail: raw,
    };
  }

  if (/некорректный url|разрешены только http/i.test(raw)) {
    return {
      status: 400,
      code: "vacancy_url_invalid",
      error: "Некорректная ссылка на вакансию",
      hint: "Укажите полный URL вида https://…",
      detail: raw,
    };
  }

  if (/timeout/i.test(raw)) {
    return {
      status: 504,
      code: "opencode_timeout",
      error: "OpenCode не ответил вовремя",
      hint: `Модель ${OPENCODE_MODEL} зависла или API Zen недоступен. Повторите позже или проверьте сеть/auth`,
      detail: raw,
    };
  }

  if (/enoent|не удалось запустить|не найден/i.test(raw)) {
    return {
      status: 503,
      code: "opencode_missing",
      error: "OpenCode не установлен или недоступен серверу",
      hint: "На сервере: curl -fsSL https://opencode.ai/install | bash && opencode auth",
      detail: raw,
    };
  }

  if (/FileSystem\.makeDirectory|OPENCODE_CONFIG_DIR|\/home\/YOU|config\/opencode/i.test(raw)) {
    return {
      status: 503,
      code: "opencode_auth",
      error: "OpenCode не смог открыть свой конфиг",
      hint: "В .env уберите OPENCODE_CONFIG_DIR=/home/YOU/... (это заглушка). Локально достаточно ~/.config/opencode после opencode auth",
      detail: raw,
    };
  }

  if (/model|not found|unknown model|unsupported/i.test(lower) && /model|deepseek|opencode\//i.test(lower)) {
    return {
      status: 503,
      code: "opencode_model",
      error: `Модель недоступна: ${OPENCODE_MODEL}`,
      hint: "Проверьте OPENCODE_MODEL в .env и список: opencode models",
      detail: raw,
    };
  }

  if (/пустой ответ/i.test(raw)) {
    return {
      status: 502,
      code: "opencode_empty",
      error: "OpenCode вернул пустой ответ",
      hint: "Попробуйте ещё раз. Если повторяется — смените модель или проверьте лимиты free-tier",
      detail: raw,
    };
  }

  if (/не удалось разобрать json/i.test(raw)) {
    return {
      status: 502,
      code: "opencode_bad_json",
      error: "OpenCode ответил, но не в ожидаемом JSON",
      hint: "Повторите запрос. Модель могла «съехать» с формата ответа",
      detail: raw,
    };
  }

  if (/open.?code/i.test(raw)) {
    return {
      status: 502,
      code: "opencode_failed",
      error: "OpenCode не смог выполнить сравнение",
      hint: "Смотрите journalctl -u resume или логи контейнера. Частые причины: auth, сеть, модель",
      detail: raw,
    };
  }

  return {
    status: 500,
    code: "match_failed",
    error: raw.slice(0, 400),
    hint: "Ошибка на сервере match. Проверьте логи сервиса",
    detail: raw,
  };
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
        throw new Error(`OpenCode error: ${evt.error?.message || JSON.stringify(evt.error) || "unknown"}`);
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