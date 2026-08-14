/**
 * Markdown resume → PDF (pdfkit + DejaVu Sans for Cyrillic).
 */
import PDFDocument from "pdfkit";
import path from "node:path";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

const MARGIN = 48;
const PAGE_WIDTH = 595.28; // A4
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLORS = {
  text: "#1a1a1a",
  muted: "#555555",
  accent: "#0b5fff",
  rule: "#d0d5dd",
};

export async function buildResumePdf({ md, fontsDir, photoPath = null }) {
  const fontRegular = path.join(fontsDir, "DejaVuSans.ttf");
  const fontBold = path.join(fontsDir, "DejaVuSans-Bold.ttf");
  await access(fontRegular, fsConstants.R_OK);
  await access(fontBold, fsConstants.R_OK);

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: {
      Title: "Резюме — Алексей Назаров",
      Author: "Алексей Назаров",
      Subject: "DevOps / Platform Engineer",
      Creator: "resume",
    },
  });

  doc.registerFont("Body", fontRegular);
  doc.registerFont("BodyBold", fontBold);

  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  renderMarkdown(doc, mdForPdf(md), photoPath);
  doc.end();
  return done;
}

/** Site-only CTA — not for a recruiter PDF. */
function mdForPdf(md) {
  return String(md)
    .replace(/\r\n/g, "\n")
    .replace(/\n---+\s*\n+## Как со мной работать[\s\S]*$/u, "\n")
    .trimEnd();
}

function renderMarkdown(doc, md, photoPath) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let headerDone = false;
  let headerBottom = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = stripEmoji(raw).trimEnd();
    i += 1;

    if (!line.trim()) {
      doc.moveDown(0.35);
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      drawRule(doc);
      continue;
    }

    if (line.startsWith("# ")) {
      const title = inlinePlain(line.slice(2));
      const topY = doc.y;
      if (photoPath && !headerDone) {
        try {
          const size = 72;
          doc.image(photoPath, PAGE_WIDTH - MARGIN - size, topY, {
            width: size,
            height: size,
            fit: [size, size],
            align: "center",
            valign: "center",
          });
          headerBottom = topY + size + 8;
        } catch {
          /* photo optional */
        }
      }
      doc.font("BodyBold").fontSize(20).fillColor(COLORS.text);
      doc.text(title, MARGIN, topY, {
        width: CONTENT_WIDTH - (photoPath ? 88 : 0),
        lineGap: 2,
      });
      headerDone = true;
      continue;
    }

    if (line.startsWith("## ")) {
      ensureSpace(doc, 36);
      doc.moveDown(0.4);
      doc.font("BodyBold").fontSize(13).fillColor(COLORS.accent);
      doc.text(inlinePlain(line.slice(3)), MARGIN, doc.y, {
        width: CONTENT_WIDTH,
        lineGap: 2,
      });
      drawRule(doc, 0.15);
      continue;
    }

    if (line.startsWith("### ")) {
      ensureSpace(doc, 28);
      doc.moveDown(0.25);
      doc.font("BodyBold").fontSize(11).fillColor(COLORS.text);
      doc.text(inlinePlain(line.slice(4)), MARGIN, doc.y, {
        width: CONTENT_WIDTH,
        lineGap: 1,
      });
      continue;
    }

    if (/^[-*] /.test(line.trim())) {
      const item = line.trim().replace(/^[-*] /, "");
      ensureSpace(doc, 22);
      const bulletX = MARGIN + 6;
      const textX = MARGIN + 16;
      const y = doc.y;
      doc.save();
      doc.circle(bulletX, y + 5, 1.4).fill(COLORS.accent);
      doc.restore();
      writeInline(doc, item, {
        x: textX,
        y,
        width: CONTENT_WIDTH - 16,
        fontSize: 9.5,
      });
      continue;
    }

    // Subtitle / contact under H1 — leave room for photo while it still overlaps
    const besidePhoto = Boolean(photoPath) && headerDone && doc.y < headerBottom;
    ensureSpace(doc, 22);
    writeInline(doc, line.trim(), {
      x: MARGIN,
      y: doc.y,
      width: CONTENT_WIDTH - (besidePhoto ? 88 : 0),
      fontSize: besidePhoto || doc.y < MARGIN + 120 ? 10 : 9.5,
      color: besidePhoto || doc.y < MARGIN + 120 ? COLORS.muted : COLORS.text,
    });
  }
}

/**
 * Mixed bold/regular runs. Pass absolute x/y on the first fragment only;
 * never leave a dangling continued:true (that collapses following lines).
 */
function writeInline(doc, text, { x, y, width, fontSize, color = COLORS.text }) {
  const parts = tokenizeInline(text).filter((p) => p.text.length > 0);
  if (!parts.length) return;

  const startY = y ?? doc.y;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const last = i === parts.length - 1;
    doc.font(part.bold ? "BodyBold" : "Body").fontSize(fontSize).fillColor(color);
    if (i === 0) {
      doc.text(part.text, x, startY, {
        width,
        lineGap: 2,
        continued: !last,
      });
    } else {
      doc.text(part.text, {
        lineGap: 2,
        continued: !last,
      });
    }
  }
}

function tokenizeInline(text) {
  const cleaned = stripEmoji(text);
  const parts = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m;
  while ((m = re.exec(cleaned))) {
    if (m.index > last) {
      parts.push({ text: cleaned.slice(last, m.index), bold: false });
    }
    if (m[1] != null) parts.push({ text: m[1], bold: true });
    else if (m[2] != null) parts.push({ text: m[2], bold: false });
    else if (m[3] != null) parts.push({ text: m[3], bold: false });
    last = m.index + m[0].length;
  }
  if (last < cleaned.length) parts.push({ text: cleaned.slice(last), bold: false });
  if (!parts.length) parts.push({ text: cleaned, bold: false });
  return parts.map((p) => ({ ...p, text: p.text.replace(/\s+/g, " ") }));
}

function inlinePlain(text) {
  return tokenizeInline(text)
    .map((p) => p.text)
    .join("")
    .trim();
}

function stripEmoji(s) {
  return String(s)
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s{2,}/g, " ");
}

function drawRule(doc, gap = 0.35) {
  doc.moveDown(gap);
  const y = doc.y;
  doc
    .strokeColor(COLORS.rule)
    .lineWidth(0.8)
    .moveTo(MARGIN, y)
    .lineTo(PAGE_WIDTH - MARGIN, y)
    .stroke();
  doc.moveDown(gap);
}

function ensureSpace(doc, need) {
  if (doc.y + need > doc.page.height - MARGIN) {
    doc.addPage();
  }
}
