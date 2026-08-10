/* Resume UI + vacancy match client */

const CHIPS = [
  "Kubernetes", "Argo CD", "GitOps", "Deckhouse",
  "Helm", "OpenTelemetry", "GitLab CI", "Keycloak", "Vault",
  "Istio", "Ansible", "AWX", "Yandex Cloud",
];

const EYEBROW_LINES = [
  "Tech Lead DevOps · Kubernetes · GitOps",
  "Argo CD · полный GitOps bootstrap",
  "Keycloak · SSO для команд",
  "Platform · CI/CD · IDP",
  "Microservices · mesh · observability",
];

/** Логи по реальному spring-ci: prepare → sca → kaniko → deploy-argocd */
const PIPELINE_BEATS = [
  {
    stage: 0,
    status: "prepare · cicd/",
    ns: "develop",
    log: "prepare · envsubst → cicd/argocd-application.yaml · Dockerfile.kaniko",
  },
  {
    stage: 1,
    status: "kaniko · building",
    ns: "develop",
    log: "kaniko · push payment-registry/platform-api:0.12.4.0 · digest sha256:a1…",
  },
  {
    stage: 2,
    status: "sca · scanning",
    ns: "develop",
    log: "track_sca · appsec-track-cli scan · SCA_ENV=dev · 0 critical",
  },
  {
    stage: 3,
    status: "reconciling · 2/2",
    ns: "develop",
    log: "deploy-argocd · patch image.tag=0.12.4.0 · Application platform-api-develop",
  },
  {
    stage: 4,
    status: "Synced · Healthy",
    ns: "develop",
    log: "argocd app sync platform-api-develop · Healthy · Synced",
  },
  {
    stage: 4,
    status: "rollout · 3/3 Ready",
    ns: "test",
    log: "kubectl rollout status deploy/platform-api -n test · successfully rolled out",
  },
];

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return [...document.querySelectorAll(sel)]; }

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function setChips() {
  const row = $("#skill-chips");
  row.innerHTML = CHIPS.map((c, i) => {
    const delay = prefersReducedMotion() ? 0 : i * 0.045;
    return `<span class="chip" style="animation-delay:${delay}s">${c}</span>`;
  }).join("");
}

async function loadPhoto() {
  try {
    const meta = await fetch("/api/photo/meta", { cache: "no-store" });
    if (!meta.ok) return;
    const data = await meta.json();
    if (!data.ok) return;

    const src = `/api/photo?v=${encodeURIComponent(data.file || "1")}`;
    const frame = $("#hero-photo");
    const img = $("#hero-photo-img");
    if (!frame || !img) return;
    img.onload = () => { frame.hidden = false; };
    img.onerror = () => { frame.hidden = true; };
    img.src = src;
  } catch {
    // photo is optional
  }
}

async function loadResume() {
  const el = $("#resume-content");
  try {
    const res = await fetch("/api/resume.md", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const md = await res.text();
    el.innerHTML = marked.parse(md);
    decorateMarkdown(el);

    const lines = md.split("\n");
    const h1 = lines.find((l) => l.startsWith("# "))?.replace(/^#\s+/, "");
    const role = lines.find((l) => l.startsWith("**") && l.includes("DevOps"))
      ?.replace(/\*\*/g, "")
      ?.split("·")[0]
      ?.trim();
    if (h1) {
      $("#hero-name").textContent = h1;
      document.title = `${h1} — Tech Lead DevOps`;
      $("#hero-photo-img")?.setAttribute("alt", `Фото: ${h1}`);
    }
    if (role) $("#hero-role").textContent = role;
  } catch (err) {
    el.innerHTML = `<p class="loading">Не удалось загрузить resume.md: ${err.message}</p>`;
  }
}

function setupTabs() {
  $all(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $all(".tab").forEach((t) => t.classList.remove("active"));
      $all(".tab-panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      $(`[data-panel="${tab.dataset.tab}"]`).classList.add("active");
    });
  });
}

function activeTab() {
  return $(".tab.active")?.dataset.tab || "text";
}

function setBusy(busy, message = "") {
  const btn = $("#btn-match");
  const status = $("#match-status");
  btn.disabled = busy;
  btn.querySelector(".btn-spinner").hidden = !busy;
  btn.querySelector(".btn-label").textContent = busy ? "Сравниваю…" : "Сравнить с резюме";
  status.textContent = message;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderMatch(data) {
  const root = $("#match-result");
  root.hidden = false;
  const score = Math.max(0, Math.min(100, Number(data.score) || 0));
  const matched = Array.isArray(data.matched) ? data.matched : [];
  const gaps = Array.isArray(data.gaps) ? data.gaps : [];
  const extras = Array.isArray(data.overqualified_or_extra) ? data.overqualified_or_extra : [];
  const focus = Array.isArray(data.interview_focus) ? data.interview_focus : [];

  root.innerHTML = `
    <div class="score-card">
      <div class="score-ring" data-score="${score}" style="--p:0">0</div>
      <div>
        <span class="verdict ${escapeHtml(data.verdict || "")}">${escapeHtml(data.verdict || "unknown")}</span>
        <p>${escapeHtml(data.summary || "")}</p>
        <p><strong>Рекомендация:</strong> ${escapeHtml(data.recommendation || "—")}</p>
      </div>
    </div>
    <div class="match-grid">
      <div class="card">
        <h3>Совпадения</h3>
        <ul>
          ${matched.map((m) => `<li><strong>${escapeHtml(m.requirement)}</strong><br/><span class="muted">${escapeHtml(m.evidence)}</span></li>`).join("") || "<li>Нет явных совпадений</li>"}
        </ul>
      </div>
      <div class="card">
        <h3>Пробелы</h3>
        <ul>
          ${gaps.map((g) => `<li><strong class="sev-${escapeHtml(g.severity || "")}">${escapeHtml(g.requirement)}</strong><br/><span class="muted">${escapeHtml(g.note)}</span></li>`).join("") || "<li>Критических пробелов не видно</li>"}
        </ul>
      </div>
      <div class="card">
        <h3>Сверх вакансии</h3>
        <ul>${extras.map((x) => `<li>${escapeHtml(x)}</li>`).join("") || "<li>—</li>"}</ul>
      </div>
      <div class="card">
        <h3>Фокус интервью</h3>
        <ul>${focus.map((x) => `<li>${escapeHtml(x)}</li>`).join("") || "<li>—</li>"}</ul>
      </div>
    </div>
  `;
  animateScoreRing(root.querySelector(".score-ring"), score);
  root.scrollIntoView({ behavior: "smooth", block: "start" });
}

function decorateMarkdown(container) {
  const blocks = container.querySelectorAll(
    "h2, h3, p, ul, ol, hr, blockquote, pre"
  );
  blocks.forEach((node, i) => {
    node.classList.add("md-block");
    if (!prefersReducedMotion()) {
      node.style.animationDelay = `${Math.min(i * 0.04, 0.8)}s`;
    }
  });
}

function animateScoreRing(el, target) {
  if (!el) return;
  const goal = Math.max(0, Math.min(100, Number(target) || 0));
  if (prefersReducedMotion()) {
    el.style.setProperty("--p", String(goal));
    el.textContent = String(goal);
    return;
  }
  const start = performance.now();
  const duration = 900;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - t) ** 3;
    const current = Math.round(goal * eased);
    el.style.setProperty("--p", String(current));
    el.textContent = String(current);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function setupScrollReveal() {
  const items = $all(".reveal");
  if (prefersReducedMotion()) {
    items.forEach((el) => el.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
  );
  items.forEach((el) => {
    if (!el.classList.contains("in")) io.observe(el);
  });
}

function setupTopbar() {
  const bar = $("#topbar");
  const onScroll = () => {
    bar?.classList.toggle("scrolled", window.scrollY > 24);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

function setupNavSpy() {
  const links = $all(".nav a[data-nav]");
  const sections = links
    .map((a) => {
      const id = a.getAttribute("href")?.replace(/^#/, "");
      const el = id ? document.getElementById(id) : null;
      return el ? { a, el } : null;
    })
    .filter(Boolean);

  if (!sections.length) return;

  const setActive = (id) => {
    links.forEach((a) => {
      a.classList.toggle("active", a.dataset.nav === id);
    });
  };

  const io = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) setActive(visible.target.id);
    },
    { rootMargin: "-20% 0px -55% 0px", threshold: [0.1, 0.25, 0.5] }
  );
  sections.forEach(({ el }) => io.observe(el));
}

function setupCursorGlow() {
  const glow = $(".cursor-glow");
  if (!glow || prefersReducedMotion() || window.matchMedia("(max-width: 800px)").matches) {
    glow?.remove();
    return;
  }
  let raf = 0;
  let x = window.innerWidth / 2;
  let y = window.innerHeight / 3;
  const apply = () => {
    raf = 0;
    document.documentElement.style.setProperty("--mx", `${x}px`);
    document.documentElement.style.setProperty("--my", `${y}px`);
  };
  window.addEventListener(
    "pointermove",
    (e) => {
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    },
    { passive: true }
  );
  apply();
}

function setupEyebrowRotator() {
  const el = $("#eyebrow-rotator");
  if (!el || prefersReducedMotion() || EYEBROW_LINES.length < 2) return;

  let idx = 0;
  const swap = () => {
    el.classList.add("is-leaving");
    window.setTimeout(() => {
      idx = (idx + 1) % EYEBROW_LINES.length;
      el.textContent = EYEBROW_LINES[idx];
      el.classList.remove("is-leaving");
      el.classList.add("is-entering");
      requestAnimationFrame(() => {
        el.classList.remove("is-entering");
      });
    }, 320);
  };
  window.setInterval(swap, 4200);
}

/** Full-page ambient mesh (GitOps sync + Istio north-south / east-west) */
function setupMeshCanvas(canvas, opts = {}) {
  if (!canvas || prefersReducedMotion()) {
    canvas?.remove();
    return () => {};
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const compact = opts.compact === true;
  let w = 0;
  let h = 0;

  /**
   * Compact = spring-ci / GitOps spine из templates:
   * Git → GitLab CI → Argo CD → Istio → api-svc → keycloak
   * Full = ambient corner mesh на фоне страницы.
   */
  const nodes = compact
    ? [
        { id: "git", label: "Git", nx: 0.04, ny: 0.5, kind: "ci" },
        { id: "ci", label: "GitLab", nx: 0.2, ny: 0.5, kind: "ci" },
        { id: "argo", label: "Argo CD", nx: 0.4, ny: 0.5, kind: "gitops" },
        { id: "istio", label: "Istio", nx: 0.58, ny: 0.5, kind: "mesh" },
        { id: "api", label: "api-svc", nx: 0.76, ny: 0.5, kind: "pod" },
        { id: "id", label: "keycloak", nx: 0.94, ny: 0.5, kind: "pod" },
      ]
    : [
        { id: "git", label: "Git", nx: 0.06, ny: 0.14, kind: "ci" },
        { id: "ci", label: "GitLab CI", nx: 0.2, ny: 0.1, kind: "ci" },
        { id: "reg", label: "Registry", nx: 0.34, ny: 0.16, kind: "ci" },
        { id: "argo", label: "Argo CD", nx: 0.48, ny: 0.12, kind: "gitops" },
        { id: "api", label: "api-svc", nx: 0.62, ny: 0.22, kind: "pod" },
        { id: "wrk", label: "worker", nx: 0.76, ny: 0.1, kind: "pod" },
        { id: "istio", label: "Istio GW", nx: 0.72, ny: 0.28, kind: "mesh" },
        { id: "id", label: "keycloak", nx: 0.12, ny: 0.88, kind: "pod" },
        { id: "otel", label: "OTel", nx: 0.88, ny: 0.86, kind: "pod" },
      ];

  const edgePairs = compact
    ? [
        ["git", "ci"],
        ["ci", "argo"],
        ["argo", "istio"],
        ["istio", "api"],
        ["api", "id"],
      ]
    : [
        ["git", "ci"], ["ci", "reg"], ["reg", "argo"],
        ["argo", "api"], ["argo", "wrk"],
        ["istio", "api"], ["istio", "id"], ["istio", "wrk"],
        ["api", "wrk"], ["api", "otel"], ["wrk", "otel"],
      ];

  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const edges = edgePairs.map(([a, b]) => ({ a: byId[a], b: byId[b] })).filter((e) => e.a && e.b);

  const packets = [];
  let pulse = {};
  let raf = 0;
  let lastSpawn = 0;
  let spineDash = 0;
  let edgeCursor = 0;

  const inset = () => {
    if (compact) {
      return { x: 28, y: 16 };
    }
    return {
      x: Math.max(52, w * 0.045),
      y: Math.max(36, h * 0.05),
    };
  };

  const pos = (n) => {
    const pad = inset();
    const innerW = Math.max(1, w - pad.x * 2);
    const innerH = Math.max(1, h - pad.y * 2);
    return { x: pad.x + n.nx * innerW, y: pad.y + n.ny * innerH };
  };

  const boxSize = (n) => {
    ctx.font = `${compact ? 9 : 10}px "IBM Plex Mono", monospace`;
    const tw = ctx.measureText(n.label).width;
    if (n.kind === "pod") {
      const r = compact ? 15 : 16;
      return { rw: r * 2, rh: r * 2, r, isPod: true };
    }
    const rw = compact ? Math.max(38, tw + 16) : Math.max(44, tw + 16);
    const rh = compact ? 24 : 26;
    return { rw, rh, r: 0, isPod: false };
  };

  const spawnPacket = () => {
    if (compact) {
      const edge = edges[edgeCursor % edges.length];
      edgeCursor += 1;
      if (!edge) return;
      packets.push({
        edge,
        t: 0,
        speed: 0.007 + Math.random() * 0.004,
        hue: edge.a.kind === "mesh" ? 265 : edge.a.kind === "gitops" ? 168 : 190,
      });
      return;
    }
    const edge = edges[Math.floor(Math.random() * edges.length)];
    if (!edge) return;
    packets.push({
      edge,
      t: 0,
      speed: 0.004 + Math.random() * 0.006,
      hue: edge.a.kind === "ci" ? 190 : edge.a.kind === "mesh" ? 265 : 168,
    });
  };

  const drawHex = (x, y, r, stroke, fill, glowAmt) => {
    ctx.save();
    if (glowAmt > 0.05) {
      ctx.shadowColor = "rgba(56, 189, 248, 0.65)";
      ctx.shadowBlur = 10 + glowAmt * 18;
    }
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 3) * i - Math.PI / 6;
      const px = x + r * Math.cos(ang);
      const py = y + r * Math.sin(ang);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = compact ? 1.5 : 1;
    ctx.stroke();
    ctx.restore();
  };

  const drawNode = (n, now) => {
    const { x, y } = pos(n);
    const pr = pulse[n.id] || 0;
    const glow = Math.max(0, (pr - now) / 600);
    const { rw, rh, r, isPod } = boxSize(n);

    if (isPod) {
      drawHex(
        x, y, r,
        `rgba(94, 234, 212, ${0.55 + glow * 0.4})`,
        `rgba(34, 211, 238, ${0.18 + glow * 0.25})`,
        glow
      );
    } else if (n.kind === "mesh") {
      ctx.save();
      if (glow > 0.05) {
        ctx.shadowColor = "rgba(167, 139, 250, 0.55)";
        ctx.shadowBlur = 12;
      }
      ctx.fillStyle = `rgba(24, 16, 40, ${0.92})`;
      ctx.strokeStyle = `rgba(167, 139, 250, ${0.55 + glow * 0.35})`;
      ctx.lineWidth = 1.4;
      roundRect(ctx, x - rw / 2, y - rh / 2, rw, rh, 6);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.fillStyle = `rgba(13, 20, 32, ${0.9})`;
      ctx.strokeStyle = `rgba(125, 211, 252, ${0.35 + glow * 0.4})`;
      ctx.lineWidth = 1.15;
      roundRect(ctx, x - rw / 2, y - rh / 2, rw, rh, 6);
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = "#34d399";
    ctx.beginPath();
    const dotX = isPod ? x - r * 0.55 : x - rw / 2 + 6;
    const dotY = isPod ? y - r * 0.45 : y - rh / 2 + 6;
    ctx.arc(dotX, dotY, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = `${compact ? 9 : 10}px "IBM Plex Mono", monospace`;
    ctx.fillStyle = "rgba(232, 238, 247, 0.95)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(n.label, x, y + (isPod ? 0 : 1));
  };

  function roundRect(c, x, y, width, height, radius) {
    c.beginPath();
    c.moveTo(x + radius, y);
    c.lineTo(x + width - radius, y);
    c.quadraticCurveTo(x + width, y, x + width, y + radius);
    c.lineTo(x + width, y + height - radius);
    c.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    c.lineTo(x + radius, y + height);
    c.quadraticCurveTo(x, y + height, x, y + height - radius);
    c.lineTo(x, y + radius);
    c.quadraticCurveTo(x, y, x + radius, y);
    c.closePath();
  }

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, rect.width);
    h = Math.max(1, rect.height);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const draw = (now) => {
    ctx.clearRect(0, 0, w, h);
    const pad = inset();
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.x * 0.25, pad.y * 0.2, w - pad.x * 0.5, h - pad.y * 0.4);
    ctx.clip();

    if (compact && edges.length) {
      const first = pos(edges[0].a);
      const last = pos(edges[edges.length - 1].b);
      spineDash = (spineDash + 0.35) % 20;
      ctx.strokeStyle = "rgba(56, 189, 248, 0.22)";
      ctx.lineWidth = 1.15;
      ctx.setLineDash([5, 7]);
      ctx.lineDashOffset = -spineDash;
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;

      for (let i = 0; i < edges.length - 1; i++) {
        const a = pos(edges[i].a);
        const b = pos(edges[i].b);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        ctx.fillStyle = "rgba(56, 189, 248, 0.55)";
        ctx.beginPath();
        ctx.arc(mx, my, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      for (const { a, b } of edges) {
        const pa = pos(a);
        const pb = pos(b);
        ctx.strokeStyle = "rgba(56, 189, 248, 0.12)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (now - lastSpawn > (compact ? 380 : 280)) {
      spawnPacket();
      lastSpawn = now;
    }

    for (let i = packets.length - 1; i >= 0; i--) {
      const pkt = packets[i];
      pkt.t += pkt.speed;
      const pa = pos(pkt.edge.a);
      const pb = pos(pkt.edge.b);
      const t = Math.min(1, pkt.t);
      const x = pa.x + (pb.x - pa.x) * t;
      const y = pa.y + (pb.y - pa.y) * t;
      const fade = 1 - Math.abs(t - 0.5) * 1.4;

      ctx.save();
      ctx.shadowColor = `hsla(${pkt.hue}, 90%, 65%, 0.8)`;
      ctx.shadowBlur = 8;
      ctx.fillStyle = `hsla(${pkt.hue}, 85%, 68%, ${0.9 * Math.max(0.2, fade)})`;
      ctx.beginPath();
      ctx.arc(x, y, compact ? 2.8 : 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (pkt.t >= 1) {
        pulse[pkt.edge.b.id] = now + 650;
        packets.splice(i, 1);
      }
    }

    for (const n of nodes) drawNode(n, now);

    ctx.restore();
    raf = requestAnimationFrame(draw);
  };

  const onResize = () => resize();
  window.addEventListener("resize", onResize, { passive: true });
  resize();
  raf = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
  };
}

function setupDevOpsVisuals() {
  setupMeshCanvas($("#mesh-canvas"), { compact: false });
  setupMeshCanvas($("#hero-mesh-canvas"), { compact: true });
  setupPipelineStages();
}

function setupPipelineStages() {
  const stages = $all(".pipe-stage");
  const statusEl = $("#viz-status");
  const nsEl = $("#viz-ns");
  const line = $("#log-ticker")?.querySelector(".log-line");
  if (!stages.length) return;

  let beat = 0;

  const apply = () => {
    const b = PIPELINE_BEATS[beat % PIPELINE_BEATS.length];
    stages.forEach((s, i) => {
      const idx = Number(s.dataset.stage);
      s.classList.toggle("is-active", idx === b.stage);
      s.classList.toggle("is-done", idx < b.stage);
    });
    if (statusEl) statusEl.textContent = b.status;
    if (nsEl) nsEl.textContent = b.ns;
    if (line && !prefersReducedMotion()) {
      line.classList.add("is-leaving");
      window.setTimeout(() => {
        line.textContent = b.log;
        line.classList.remove("is-leaving");
        line.classList.add("is-entering");
        requestAnimationFrame(() => line.classList.remove("is-entering"));
      }, 220);
    } else if (line) {
      line.textContent = b.log;
    }
    beat = (beat + 1) % PIPELINE_BEATS.length;
  };

  apply();
  if (prefersReducedMotion()) return;
  window.setInterval(apply, 2200);
}

function setupPdfDropzone() {
  const zone = $("#pdf-dropzone");
  const input = $("#vacancy-pdf");
  const nameEl = $("#pdf-file-name");
  if (!zone || !input || !nameEl) return;

  const showName = () => {
    const f = input.files?.[0];
    nameEl.textContent = f ? `${f.name} · ${(f.size / 1024).toFixed(0)} KB` : "файл не выбран";
  };

  input.addEventListener("change", showName);

  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("dragover");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("dragover");
    const file = e.dataTransfer?.files?.[0];
    if (!file || file.type !== "application/pdf") return;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    showName();
    $all(".tab").forEach((t) => t.classList.remove("active"));
    $all(".tab-panel").forEach((p) => p.classList.remove("active"));
    $(".tab[data-tab='pdf']")?.classList.add("active");
    $("[data-panel='pdf']")?.classList.add("active");
  });
}

async function runMatch() {
  const tab = activeTab();
  const status = $("#match-status");
  $("#match-result").hidden = true;

  try {
    setBusy(true, "OpenCode анализирует соответствие…");

    let res;
    if (tab === "pdf") {
      const file = $("#vacancy-pdf").files?.[0];
      if (!file) throw new Error("Выберите PDF");
      const fd = new FormData();
      fd.append("pdf", file);
      res = await fetch("/api/match", { method: "POST", body: fd });
    } else {
      const body = tab === "url"
        ? { url: $("#vacancy-url").value.trim() }
        : { text: $("#vacancy-text").value.trim() };
      if (tab === "url" && !body.url) throw new Error("Укажите URL");
      if (tab === "text" && !body.text) throw new Error("Вставьте текст вакансии");
      res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    renderMatch(data);
    setBusy(false, `Готово · model: ${data.model || "opencode"} · ${data.elapsedMs || "?"}ms`);
  } catch (err) {
    setBusy(false, "");
    status.textContent = `Ошибка: ${err.message}`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setChips();
  setupTabs();
  setupScrollReveal();
  setupTopbar();
  setupNavSpy();
  setupCursorGlow();
  setupEyebrowRotator();
  setupDevOpsVisuals();
  setupPdfDropzone();
  loadPhoto();
  loadResume();
  $("#btn-match").addEventListener("click", runMatch);
  $("#btn-print").addEventListener("click", () => window.print());
});