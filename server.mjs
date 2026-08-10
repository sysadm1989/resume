#!/usr/bin/env node
/**
 * Static resume site + vacancy match via Hugging Face Inference API.
 * Docker: mount repo → node image (no app build).
 */
import express from "express";
import multer from "multer";
import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
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
const HF_TOKEN = String(process.env.HF_TOKEN || "").trim();
const HF_API_BASE = String(process.env.HF_API_BASE || "https://router.huggingface.co/v1").replace(/\/$/, "");
const HF_MODEL = process.env.HF_MODEL || "Qwen/Qwen2.5-7B-Instruct:cheapest";
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 120_000);
const MAX_VACANCY_CHARS = Number(process.env.MAX_VACANCY_CHARS || 80_000);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.static(PUBLIC));

app.get("/api/health", async (_req, res) => {
  const llm = await probeLlm();
  res.json({
    ok: true,
    service: "resume-match",
    provider: "huggingface",
    model: HF_MODEL,
    llmOk: llm.ok,
    llmError: llm.ok ? null : llm.error,
  });
});

app.get("/api/llm", async (_req, res) => {
  const llm = await probeLlm();
  const status = llm.ok ? 200 : 503;
  res.status(status).json({
    ok: llm.ok,
    provider: "huggingface",
    model: HF_MODEL,
    apiBase: HF_API_BASE,
    error: llm.ok ? null : llm.error,
    hint: llm.ok
      ? null
      : "Задайте HF_TOKEN в .env (https://huggingface.co/settings/tokens, Inference Providers)",
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

    const raw = await runLlm(message);
    const parsed = extractJson(raw);
    parsed.model = HF_MODEL;
    parsed.provider = "huggingface";
    parsed.elapsedMs = Date.now() - started;
    parsed.vacancyChars = vacancy.length;
    return res.json(parsed);
  } catch (err) {
    console.error("[match]", err);
    const classified = classifyMatchError(err);
    return res.status(classified.status).json({
      error: classified.error,
      code: classified.code,
      hint: classified.hint,
      detail: classified.detail || undefined,
      model: HF_MODEL,
      provider: "huggingface",
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

function probeLlm() {
  if (!HF_TOKEN || /^hf_x+$/i.test(HF_TOKEN) || HF_TOKEN.includes("xxxxxxxx")) {
    return Promise.resolve({
      ok: false,
      error: "HF_TOKEN не задан или это заглушка из .env.example",
    });
  }
  return Promise.resolve({ ok: true });
}

function classifyMatchError(err) {
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

  if (/timeout|aborted/i.test(raw)) {
    return {
      status: 504,
      code: "llm_timeout",
      error: "Модель не ответила вовремя",
      hint: `Увеличьте LLM_TIMEOUT_MS или смените HF_MODEL (сейчас ${HF_MODEL})`,
      detail: raw,
    };
  }

  if (/hf_token|заглушка|не задан/i.test(raw)) {
    return {
      status: 503,
      code: "llm_auth",
      error: "Нет токена Hugging Face",
      hint: "В .env укажите HF_TOKEN с https://huggingface.co/settings/tokens (Inference Providers)",
      detail: raw,
    };
  }

  if (/401|403|unauthorized|invalid.*token/i.test(lower)) {
    return {
      status: 503,
      code: "llm_auth",
      error: "Токен Hugging Face отклонён",
      hint: "Проверьте HF_TOKEN и право Make calls to Inference Providers",
      detail: raw,
    };
  }

  if (/404|model.*(not found|unavailable)|does not exist/i.test(lower)) {
    return {
      status: 503,
      code: "llm_model",
      error: `Модель недоступна: ${HF_MODEL}`,
      hint: "Смените HF_MODEL в .env",
      detail: raw,
    };
  }

  if (/429|rate limit|quota|payment|credits/i.test(lower)) {
    return {
      status: 429,
      code: "llm_quota",
      error: "Лимит Hugging Face исчерпан",
      hint: "Подождите или смените модель / тариф HF",
      detail: raw,
    };
  }

  if (/пустой ответ/i.test(raw)) {
    return {
      status: 502,
      code: "llm_empty",
      error: "Модель вернула пустой ответ",
      hint: "Повторите запрос или смените HF_MODEL",
      detail: raw,
    };
  }

  if (/не удалось разобрать json/i.test(raw)) {
    return {
      status: 502,
      code: "llm_bad_json",
      error: "Модель ответила не в JSON",
      hint: "Повторите сравнение. При частых сбоях смените модель",
      detail: raw,
    };
  }

  if (/huggingface|hf api|router\.huggingface/i.test(raw)) {
    return {
      status: 502,
      code: "llm_failed",
      error: "Hugging Face API не выполнил сравнение",
      hint: "Смотрите docker compose logs -f resume",
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

async function runLlm(message) {
  if (!HF_TOKEN || /^hf_x+$/i.test(HF_TOKEN) || HF_TOKEN.includes("xxxxxxxx")) {
    throw new Error("HF_TOKEN не задан");
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LLM_TIMEOUT_MS);

  try {
    const res = await fetch(`${HF_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: HF_MODEL,
        temperature: 0.2,
        max_tokens: 4096,
        messages: [
          {
            role: "system",
            content:
              "Ты отвечаешь только одним валидным JSON-объектом. Без markdown, без пояснений до/после JSON.",
          },
          { role: "user", content: message },
        ],
      }),
      signal: ctrl.signal,
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`HF API HTTP ${res.status}: ${text.slice(0, 400)}`);
    }

    if (!res.ok) {
      const msg =
        data?.error?.message ||
        data?.error ||
        data?.message ||
        text.slice(0, 400);
      throw new Error(`HF API HTTP ${res.status}: ${msg}`);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (content == null || String(content).trim() === "") {
      throw new Error("Модель вернула пустой ответ");
    }
    return String(content);
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`LLM timeout after ${LLM_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(blob) {
  const text = String(blob || "").trim();
  if (!text) throw new Error("Модель вернула пустой ответ");

  const fenced = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const candidates = [
    fenced,
    text,
    ...((text.match(/\{[\s\S]*\}/g) || []).sort((a, b) => b.length - a.length)),
  ];

  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      // next
    }
  }

  throw new Error(`Не удалось разобрать JSON от модели. Фрагмент: ${text.slice(0, 400)}`);
}

app.listen(PORT, HOST, () => {
  console.log(`[resume] http://${HOST}:${PORT}`);
  console.log(`[resume] provider=huggingface model=${HF_MODEL}`);
  console.log(`[resume] source=${RESUME_MD}`);
});
