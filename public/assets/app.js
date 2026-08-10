/* Resume UI + vacancy match client */

const CONTACT_SCORE_THRESHOLD = 70;

const CANDIDATE_CONTACTS = {
  phoneDisplay: "+7 (917) 534-44-35",
  phoneTel: "+79175344435",
  telegram: "@alexnazarov89",
  telegramUrl: "https://t.me/alexnazarov89",
};

const CHIPS = [
  "Kubernetes", "Argo CD", "GitOps", "Deckhouse",
  "Helm", "OpenTelemetry", "VictoriaMetrics", "GitLab CI", "Kaniko",
  "Keycloak", "Vault", "FreeIPA", "Istio", "Capsule", "Tetragon",
  "Ansible", "AWX", "Yandex Cloud",
];

const EYEBROW_LINES = [
  "Tech Lead DevOps · Kubernetes · GitOps",
  "Vanilla K8s и Deckhouse",
  "Argo CD · полный GitOps bootstrap",
  "Keycloak · SSO для команд",
  "Vault · коммунальные секреты",
  "RBAC · единый доступ по системам",
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
    applyContactsFromResume(md);
  } catch (err) {
    el.innerHTML = `<p class="loading">Не удалось загрузить resume.md: ${err.message}</p>`;
  }
}

function applyContactsFromResume(md) {
  const phoneMatch = md.match(/\+7[\d\s()\-]{10,}/);
  const tgMatch = md.match(/Telegram:\s*(@[\w_]+)/i);
  if (phoneMatch) {
    const display = phoneMatch[0].replace(/\s+/g, " ").trim();
    CANDIDATE_CONTACTS.phoneDisplay = display;
    CANDIDATE_CONTACTS.phoneTel = display.replace(/[^\d+]/g, "");
  }
  if (tgMatch) {
    const handle = tgMatch[1].startsWith("@") ? tgMatch[1] : `@${tgMatch[1]}`;
    CANDIDATE_CONTACTS.telegram = handle;
    CANDIDATE_CONTACTS.telegramUrl = `https://t.me/${handle.replace(/^@/, "")}`;
  }
  syncContactModalLinks();
}

function syncContactModalLinks() {
  const phone = $("#contact-phone");
  const phoneText = $("#contact-phone-text");
  const tg = $("#contact-telegram");
  const tgText = $("#contact-telegram-text");
  if (phone) phone.href = `tel:${CANDIDATE_CONTACTS.phoneTel}`;
  if (phoneText) phoneText.textContent = CANDIDATE_CONTACTS.phoneDisplay;
  if (tg) tg.href = CANDIDATE_CONTACTS.telegramUrl;
  if (tgText) tgText.textContent = CANDIDATE_CONTACTS.telegram;
}

function openContactModal(score) {
  const modal = $("#contact-modal");
  if (!modal) return;
  syncContactModalLinks();
  const scoreEl = $("#contact-modal-score");
  if (scoreEl) scoreEl.textContent = `${Math.round(score)}%`;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  modal.querySelector(".contact-modal-close")?.focus();
}

function closeContactModal() {
  const modal = $("#contact-modal");
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = "";
}

function setupContactModal() {
  const modal = $("#contact-modal");
  if (!modal) return;
  syncContactModalLinks();
  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-modal]")) closeContactModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeContactModal();
  });
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

function setBusy(busy, message = "", kind = "") {
  const btn = $("#btn-match");
  const status = $("#match-status");
  btn.disabled = busy || btn.dataset.matchDown === "1";
  btn.querySelector(".btn-spinner").hidden = !busy;
  btn.querySelector(".btn-label").textContent = busy ? "Сравниваю…" : "Сравнить с кандидатом";
  status.textContent = message;
  status.classList.toggle("is-error", kind === "error");
  status.classList.toggle("is-ok", kind === "ok");
}

function clearMatchError() {
  const box = $("#match-error");
  if (!box) return;
  box.hidden = true;
  box.innerHTML = "";
}

function showMatchError({ title, message, hint, code }) {
  const box = $("#match-error");
  const status = $("#match-status");
  if (status) {
    status.textContent = message || title || "Сравнение недоступно";
    status.classList.add("is-error");
    status.classList.remove("is-ok");
  }
  if (!box) return;
  box.hidden = false;
  box.innerHTML = `
    <h3>${escapeHtml(title || "Сравнение недоступно")}</h3>
    <p>${escapeHtml(message || "")}</p>
    ${hint ? `<p>${escapeHtml(hint)}</p>` : ""}
  `;
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function setMatchBadge(state, text) {
  const badge = $("#match-ready-badge");
  const label = $("#match-ready-text");
  if (!badge || !label) return;
  badge.classList.remove("is-checking", "is-ok", "is-down", "badge-accent");
  badge.classList.add(state);
  if (state === "is-ok") badge.classList.add("badge-accent");
  label.textContent = text;
}

function setMatchAlert(show, payload = {}) {
  const alert = $("#match-alert");
  const btn = $("#btn-match");
  if (!alert) return;
  if (!show) {
    alert.hidden = true;
    alert.innerHTML = "";
    if (btn) {
      btn.dataset.matchDown = "0";
      const spinner = btn.querySelector(".btn-spinner");
      if (spinner?.hidden) btn.disabled = false;
    }
    return;
  }
  alert.hidden = false;
  alert.innerHTML = `
    <strong>${escapeHtml(payload.title || "Сравнение временно недоступно")}</strong>
    ${escapeHtml(payload.message || "")}
    ${payload.hint ? `<span class="muted">${escapeHtml(payload.hint)}</span>` : ""}
  `;
  const lock = payload.lock !== false;
  if (btn && lock) {
    btn.dataset.matchDown = "1";
    btn.disabled = true;
  }
}

async function checkMatchReady() {
  const badge = $("#match-ready-badge");
  if (badge && !badge.classList.contains("is-ok") && !badge.classList.contains("is-down")) {
    setMatchBadge("is-checking", "Проверка…");
  }
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    if (!res.ok) throw new Error(`health HTTP ${res.status}`);
    const data = await res.json();
    if (data.llmOk || data.opencodeOk) {
      setMatchBadge("is-ok", "Готово к сравнению");
      if (badge) badge.title = "Можно сравнить вакансию с профилем кандидата";
      setMatchAlert(false);
      const btn = $("#btn-match");
      if (btn) {
        btn.dataset.matchDown = "0";
        const spinner = btn.querySelector(".btn-spinner");
        if (spinner?.hidden) btn.disabled = false;
      }
      return true;
    }
    setMatchBadge("is-down", "Сравнение недоступно");
    setMatchAlert(true, {
      title: "Сравнение временно недоступно",
      message: data.llmError || "Сервис оценки соответствия сейчас не отвечает.",
      hint: "Проверьте HF_TOKEN в .env. Резюме можно читать и скачать PDF.",
    });
    return false;
  } catch {
    setMatchBadge("is-down", "Нет связи");
    setMatchAlert(true, {
      title: "Сервис недоступен",
      message: "Не удалось проверить готовность сравнения.",
      hint: "Откройте резюме кандидата ниже или обновите страницу позже.",
    });
    return false;
  }
}

const MATCH_ERROR_COPY = {
  llm_timeout: {
    title: "Сравнение занимает слишком долго",
    message: "Не удалось вовремя оценить соответствие вакансии и кандидата.",
    hint: "Повторите чуть позже. Резюме доступно без сравнения.",
  },
  llm_auth: {
    title: "Сравнение недоступно",
    message: "Нет доступа к модели (токен Hugging Face).",
    hint: "Администратору: задайте HF_TOKEN в .env. Резюме можно скачать PDF.",
  },
  llm_model: {
    title: "Сравнение недоступно",
    message: "Выбранная модель временно недоступна.",
    hint: "Попробуйте позже или смените HF_MODEL.",
  },
  llm_quota: {
    title: "Лимит запросов",
    message: "Исчерпан бесплатный лимит Hugging Face.",
    hint: "Подождите и повторите позже.",
  },
  llm_empty: {
    title: "Не удалось получить результат",
    message: "Модель вернула пустой ответ.",
    hint: "Повторите сравнение. Резюме кандидата доступно без изменений.",
  },
  llm_bad_json: {
    title: "Не удалось разобрать результат",
    message: "Ответ модели пришёл в неожиданном формате.",
    hint: "Повторите попытку чуть позже.",
  },
  llm_failed: {
    title: "Сравнение не выполнено",
    message: "Не удалось оценить соответствие вакансии и кандидата.",
    hint: "Попробуйте ещё раз. Резюме можно изучить вручную.",
  },
  match_failed: {
    title: "Сравнение не выполнено",
    message: "Не удалось оценить соответствие вакансии и кандидата.",
    hint: "Обновите страницу или повторите позже.",
  },
  vacancy_url_blocked: {
    title: "Ссылка недоступна для загрузки",
    message: "Сайт вакансии не отдал текст (часто anti-bot у hh.ru).",
    hint: "Откройте вакансию в браузере, скопируйте описание и вставьте во вкладку «Текст».",
  },
  vacancy_url_empty: {
    title: "Текст вакансии не найден",
    message: "По ссылке не удалось извлечь описание вакансии.",
    hint: "Вставьте текст вакансии вручную во вкладку «Текст».",
  },
  vacancy_url_invalid: {
    title: "Некорректная ссылка",
    message: "Указан неверный URL вакансии.",
    hint: "Проверьте ссылку или вставьте текст вручную.",
  },
  network: {
    title: "Нет связи",
    message: "Не удалось связаться с сервисом сравнения.",
    hint: "Проверьте соединение и откройте резюме кандидата ниже.",
  },
};

function humanizeMatchFailure(data, httpStatus) {
  const code = (data && data.code) || `http_${httpStatus || "?"}`;
  const preset = MATCH_ERROR_COPY[code];
  if (preset) return { ...preset, code };
  return {
    title: "Сравнение не выполнено",
    message: "Не удалось оценить соответствие вакансии и кандидата.",
    hint: "Повторите позже или изучите резюме вручную.",
    code,
  };
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
  if (score > CONTACT_SCORE_THRESHOLD) {
    window.setTimeout(() => openContactModal(score), prefersReducedMotion() ? 0 : 700);
  }
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

function revealEl(el) {
  el?.classList.add("in");
}

function setupScrollReveal() {
  const items = $all(".reveal");
  if (prefersReducedMotion()) {
    items.forEach((el) => revealEl(el));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          revealEl(entry.target);
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );
  items.forEach((el) => {
    if (!el.classList.contains("in")) io.observe(el);
  });

  const revealHashTarget = () => {
    const id = location.hash.replace(/^#/, "");
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    revealEl(el);
    if (id === "match") {
      // Sticky header + iOS zoom made the vacancy textarea easy to miss
      requestAnimationFrame(() => {
        $("#vacancy-text")?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    }
  };
  window.addEventListener("hashchange", revealHashTarget);
  revealHashTarget();
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

/** Full-page ambient: Pods / ReplicaSets / Rollouts / VPA (не путать с hero GitOps-spine) */
function setupAmbientK8sCanvas(canvas) {
  if (!canvas || prefersReducedMotion()) {
    canvas?.remove();
    return () => {};
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0;
  let h = 0;
  let raf = 0;
  let lastSpawn = 0;
  const packets = [];
  const pulse = {};

  // Углы/края — центр под контент
  const nodes = [
    // top-left: Deployment → ReplicaSet → Pods
    { id: "deploy", label: "Deployment", sub: "api", nx: 0.06, ny: 0.07, kind: "deployment" },
    { id: "rs-api", label: "ReplicaSet", sub: "3/3", nx: 0.14, ny: 0.14, kind: "replicaset" },
    { id: "pod-a1", label: "Pod", sub: "api-0", nx: 0.24, ny: 0.07, kind: "pod" },
    { id: "pod-a2", label: "Pod", sub: "api-1", nx: 0.3, ny: 0.14, kind: "pod" },
    { id: "pod-a3", label: "Pod", sub: "api-2", nx: 0.22, ny: 0.2, kind: "pod" },
    { id: "svc-api", label: "Service", sub: "ClusterIP", nx: 0.08, ny: 0.26, kind: "service" },

    // top-right: Ingress → Rollout → Pods + HPA
    { id: "ing", label: "Ingress", sub: "istio", nx: 0.72, ny: 0.06, kind: "ingress" },
    { id: "rollout", label: "Rollout", sub: "canary 20%", nx: 0.82, ny: 0.12, kind: "rollout" },
    { id: "pod-stable", label: "Pod", sub: "stable", nx: 0.93, ny: 0.07, kind: "pod" },
    { id: "pod-canary", label: "Pod", sub: "canary", nx: 0.92, ny: 0.18, kind: "pod" },
    { id: "hpa", label: "HPA", sub: "2→8", nx: 0.74, ny: 0.22, kind: "hpa" },

    // left edge: Namespace / ConfigMap / Secret
    { id: "ns", label: "Namespace", sub: "payment-dev", nx: 0.05, ny: 0.48, kind: "namespace" },
    { id: "cm", label: "ConfigMap", sub: "app-cfg", nx: 0.07, ny: 0.58, kind: "configmap" },
    { id: "sec", label: "Secret", sub: "vault-csi", nx: 0.06, ny: 0.68, kind: "secret" },

    // right edge: NetworkPolicy + PVC tip
    { id: "netpol", label: "NetworkPolicy", sub: "deny-all+", nx: 0.93, ny: 0.42, kind: "netpol" },
    { id: "job", label: "CronJob", sub: "0 */6 * * *", nx: 0.92, ny: 0.55, kind: "cronjob" },

    // bottom-left: VPA + PVC + Pod
    { id: "vpa", label: "VPA", sub: "cpu↑ mem↓", nx: 0.08, ny: 0.82, kind: "vpa" },
    { id: "pvc", label: "PVC", sub: "data 20Gi", nx: 0.18, ny: 0.9, kind: "pvc" },
    { id: "pod-vpa", label: "Pod", sub: "resized", nx: 0.26, ny: 0.82, kind: "pod" },

    // bottom-right: StatefulSet / DaemonSet / Pods
    { id: "sts", label: "StatefulSet", sub: "pg 2/2", nx: 0.72, ny: 0.82, kind: "statefulset" },
    { id: "pod-s0", label: "Pod", sub: "pg-0", nx: 0.84, ny: 0.78, kind: "pod" },
    { id: "pod-s1", label: "Pod", sub: "pg-1", nx: 0.9, ny: 0.86, kind: "pod" },
    { id: "ds", label: "DaemonSet", sub: "node-agent", nx: 0.78, ny: 0.92, kind: "daemonset" },
  ];

  const edgePairs = [
    ["deploy", "rs-api"],
    ["rs-api", "pod-a1"], ["rs-api", "pod-a2"], ["rs-api", "pod-a3"],
    ["svc-api", "pod-a1"], ["svc-api", "pod-a2"],
    ["ing", "rollout"], ["ing", "svc-api"],
    ["rollout", "pod-stable"], ["rollout", "pod-canary"],
    ["hpa", "rollout"],
    ["ns", "cm"], ["ns", "sec"],
    ["cm", "pod-a2"], ["sec", "pod-a3"],
    ["vpa", "pod-vpa"], ["pvc", "pod-vpa"],
    ["sts", "pod-s0"], ["sts", "pod-s1"],
    ["ds", "pod-s1"],
    ["netpol", "pod-canary"],
    ["job", "pod-s0"],
  ];

  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const edges = edgePairs.map(([a, b]) => ({ a: byId[a], b: byId[b] })).filter((e) => e.a && e.b);

  const inset = () => ({
    x: Math.max(36, w * 0.025),
    y: Math.max(24, h * 0.035),
  });

  const pos = (n, now = 0) => {
    const pad = inset();
    const driftX = Math.sin(now / 3200 + n.nx * 8) * 5;
    const driftY = Math.cos(now / 2800 + n.ny * 7) * 4;
    return {
      x: pad.x + n.nx * (w - pad.x * 2) + driftX,
      y: pad.y + n.ny * (h - pad.y * 2) + driftY,
    };
  };

  const roundRect = (c, x, y, width, height, radius) => {
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
  };

  const drawHex = (x, y, r, stroke, fill) => {
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
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.1;
    ctx.stroke();
  };

  const box = (x, y, rw, rh, stroke, fill, radius = 7) => {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.15;
    roundRect(ctx, x - rw / 2, y - rh / 2, rw, rh, radius);
    ctx.fill();
    ctx.stroke();
  };

  const drawPod = (x, y, glow) => {
    drawHex(
      x, y, 13,
      `rgba(94, 234, 212, ${0.45 + glow * 0.4})`,
      `rgba(34, 211, 238, ${0.1 + glow * 0.2})`
    );
    ctx.fillStyle = "#34d399";
    ctx.beginPath();
    ctx.arc(x - 5.5, y - 5.5, 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawReplicaSet = (x, y, glow) => {
    box(x, y, 90, 34, `rgba(125, 211, 252, ${0.4 + glow * 0.35})`, "rgba(13, 20, 32, 0.75)");
    for (let i = 0; i < 3; i++) {
      drawHex(x - 26 + i * 15, y + 8, 4.5, "rgba(94, 234, 212, 0.55)", "rgba(56, 189, 248, 0.12)");
    }
  };

  const drawDeployment = (x, y, glow) => {
    box(x, y, 98, 32, `rgba(56, 189, 248, ${0.45 + glow * 0.3})`, "rgba(10, 22, 36, 0.8)", 6);
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.25 + glow * 0.2})`;
    ctx.strokeRect(x - 44, y - 11, 88, 22);
  };

  const drawRollout = (x, y, glow, now) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.transform(1, 0, -0.16, 1, 0, 0);
    box(0, 0, 94, 32, `rgba(167, 139, 250, ${0.5 + glow * 0.35})`, "rgba(24, 16, 40, 0.8)");
    ctx.restore();
    const prog = 0.2 + 0.15 * Math.sin(now / 900);
    ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
    roundRect(ctx, x - 32, y + 8, 64, 3.5, 2);
    ctx.fill();
    ctx.fillStyle = "rgba(94, 234, 212, 0.7)";
    roundRect(ctx, x - 32, y + 8, 64 * prog, 3.5, 2);
    ctx.fill();
  };

  const drawVpa = (x, y, glow, now) => {
    box(x, y, 76, 36, `rgba(52, 211, 153, ${0.5 + glow * 0.35})`, "rgba(13, 28, 24, 0.8)");
    const bob = Math.sin(now / 500) * 2;
    ctx.strokeStyle = "rgba(94, 234, 212, 0.85)";
    ctx.fillStyle = "rgba(94, 234, 212, 0.85)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x + 20, y + 3 + bob);
    ctx.lineTo(x + 20, y - 9 + bob);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 20, y - 9 + bob);
    ctx.lineTo(x + 16, y - 4 + bob);
    ctx.lineTo(x + 24, y - 4 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 30, y - 5 - bob);
    ctx.lineTo(x + 30, y + 7 - bob);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 30, y + 7 - bob);
    ctx.lineTo(x + 26, y + 2 - bob);
    ctx.lineTo(x + 34, y + 2 - bob);
    ctx.closePath();
    ctx.fill();
  };

  const drawService = (x, y, glow) => {
    // oval / pill = Service
    ctx.beginPath();
    ctx.ellipse(x, y, 42, 15, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(12, 24, 40, 0.8)";
    ctx.fill();
    ctx.strokeStyle = `rgba(96, 165, 250, ${0.5 + glow * 0.3})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  };

  const drawIngress = (x, y, glow) => {
    // gateway trapezoid
    ctx.beginPath();
    ctx.moveTo(x - 40, y + 12);
    ctx.lineTo(x - 28, y - 12);
    ctx.lineTo(x + 28, y - 12);
    ctx.lineTo(x + 40, y + 12);
    ctx.closePath();
    ctx.fillStyle = "rgba(30, 20, 48, 0.8)";
    ctx.fill();
    ctx.strokeStyle = `rgba(192, 132, 252, ${0.55 + glow * 0.3})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  };

  const drawHpa = (x, y, glow, now) => {
    box(x, y, 72, 30, `rgba(251, 191, 36, ${0.45 + glow * 0.3})`, "rgba(32, 26, 12, 0.8)");
    const t = (Math.sin(now / 700) + 1) / 2;
    ctx.fillStyle = "rgba(251, 191, 36, 0.7)";
    roundRect(ctx, x - 24, y + 6, 12 + t * 28, 3, 1.5);
    ctx.fill();
  };

  const drawStatefulSet = (x, y, glow) => {
    box(x, y, 96, 34, `rgba(45, 212, 191, ${0.45 + glow * 0.3})`, "rgba(10, 28, 28, 0.8)");
    for (let i = 0; i < 2; i++) {
      ctx.strokeStyle = "rgba(45, 212, 191, 0.5)";
      ctx.strokeRect(x - 30 + i * 28, y + 4, 18, 8);
    }
  };

  const drawDaemonSet = (x, y, glow) => {
    box(x, y, 100, 30, `rgba(248, 113, 113, ${0.4 + glow * 0.3})`, "rgba(36, 14, 18, 0.8)");
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = "rgba(248, 113, 113, 0.55)";
      ctx.beginPath();
      ctx.arc(x - 30 + i * 20, y + 7, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawCronJob = (x, y, glow, now) => {
    box(x, y, 100, 30, `rgba(129, 140, 248, ${0.45 + glow * 0.3})`, "rgba(18, 18, 40, 0.8)");
    // clock tick
    const ang = (now / 800) % (Math.PI * 2);
    ctx.strokeStyle = "rgba(165, 180, 252, 0.85)";
    ctx.beginPath();
    ctx.arc(x + 34, y, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 34, y);
    ctx.lineTo(x + 34 + Math.cos(ang) * 5, y + Math.sin(ang) * 5);
    ctx.stroke();
  };

  const drawConfigMap = (x, y, glow) => {
    box(x, y, 88, 28, `rgba(148, 163, 184, ${0.45 + glow * 0.25})`, "rgba(20, 24, 32, 0.8)");
    ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x - 28, y - 2 + i * 4, 36 - i * 6, 1.5);
    }
  };

  const drawSecret = (x, y, glow) => {
    box(x, y, 86, 28, `rgba(251, 113, 133, ${0.45 + glow * 0.3})`, "rgba(36, 14, 22, 0.8)");
    // lock
    ctx.strokeStyle = "rgba(251, 113, 133, 0.8)";
    ctx.strokeRect(x + 26, y - 1, 8, 7);
    ctx.beginPath();
    ctx.arc(x + 30, y - 3, 3.5, Math.PI, 0);
    ctx.stroke();
  };

  const drawPvc = (x, y, glow) => {
    // cylinder-ish storage
    ctx.beginPath();
    ctx.ellipse(x, y - 8, 28, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(15, 30, 40, 0.85)";
    ctx.fill();
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.45 + glow * 0.3})`;
    ctx.stroke();
    ctx.fillRect(x - 28, y - 8, 56, 14);
    ctx.beginPath();
    ctx.ellipse(x, y + 6, 28, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };

  const drawNamespace = (x, y, glow) => {
    box(x, y, 108, 28, `rgba(94, 234, 212, ${0.35 + glow * 0.25})`, "rgba(8, 20, 24, 0.55)", 14);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = `rgba(94, 234, 212, ${0.35 + glow * 0.2})`;
    roundRect(ctx, x - 50, y - 10, 100, 20, 10);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const drawNetPol = (x, y, glow) => {
    box(x, y, 108, 28, `rgba(251, 146, 60, ${0.45 + glow * 0.3})`, "rgba(36, 22, 10, 0.8)");
    ctx.strokeStyle = "rgba(251, 146, 60, 0.7)";
    ctx.beginPath();
    ctx.moveTo(x + 28, y - 6);
    ctx.lineTo(x + 38, y + 6);
    ctx.moveTo(x + 38, y - 6);
    ctx.lineTo(x + 28, y + 6);
    ctx.stroke();
  };

  const drawNode = (n, now) => {
    const { x, y } = pos(n, now);
    const glow = Math.max(0, ((pulse[n.id] || 0) - now) / 700);

    switch (n.kind) {
      case "pod": drawPod(x, y, glow); break;
      case "replicaset": drawReplicaSet(x, y, glow); break;
      case "deployment": drawDeployment(x, y, glow); break;
      case "rollout": drawRollout(x, y, glow, now); break;
      case "vpa": drawVpa(x, y, glow, now); break;
      case "service": drawService(x, y, glow); break;
      case "ingress": drawIngress(x, y, glow); break;
      case "hpa": drawHpa(x, y, glow, now); break;
      case "statefulset": drawStatefulSet(x, y, glow); break;
      case "daemonset": drawDaemonSet(x, y, glow); break;
      case "cronjob": drawCronJob(x, y, glow, now); break;
      case "configmap": drawConfigMap(x, y, glow); break;
      case "secret": drawSecret(x, y, glow); break;
      case "pvc": drawPvc(x, y, glow); break;
      case "namespace": drawNamespace(x, y, glow); break;
      case "netpol": drawNetPol(x, y, glow); break;
      default: drawPod(x, y, glow);
    }

    ctx.font = '8.5px "IBM Plex Mono", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(232, 238, 247, 0.9)";
    const labelY = n.kind === "pod" ? y : (n.kind === "pvc" ? y - 2 : y - 5);
    ctx.fillText(n.label, x, labelY);
    if (n.sub) {
      ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
      ctx.font = '7.5px "IBM Plex Mono", monospace';
      const subY = n.kind === "pod" ? y + 19 : (n.kind === "vpa" ? y + 5 : y + 6);
      const subX = n.kind === "vpa" ? x - 6 : x;
      ctx.fillText(n.sub, subX, subY);
    }
  };

  const hueFor = (kind) => ({
    rollout: 265,
    ingress: 280,
    vpa: 155,
    hpa: 42,
    replicaset: 198,
    deployment: 200,
    service: 210,
    statefulset: 168,
    daemonset: 5,
    cronjob: 230,
    secret: 350,
    configmap: 220,
    pvc: 195,
    namespace: 170,
    netpol: 25,
  }[kind] || 172);

  const spawnPacket = () => {
    const edge = edges[Math.floor(Math.random() * edges.length)];
    if (!edge) return;
    packets.push({
      edge,
      t: 0,
      speed: 0.0032 + Math.random() * 0.0045,
      hue: hueFor(edge.a.kind),
    });
  };

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

    for (const { a, b } of edges) {
      const pa = pos(a, now);
      const pb = pos(b, now);
      ctx.strokeStyle = "rgba(56, 189, 248, 0.12)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 7]);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (now - lastSpawn > 380) {
      spawnPacket();
      lastSpawn = now;
    }

    for (let i = packets.length - 1; i >= 0; i--) {
      const pkt = packets[i];
      pkt.t += pkt.speed;
      const pa = pos(pkt.edge.a, now);
      const pb = pos(pkt.edge.b, now);
      const t = Math.min(1, pkt.t);
      const x = pa.x + (pb.x - pa.x) * t;
      const y = pa.y + (pb.y - pa.y) * t;
      const fade = 1 - Math.abs(t - 0.5) * 1.5;
      ctx.fillStyle = `hsla(${pkt.hue}, 80%, 65%, ${0.7 * Math.max(0.15, fade)})`;
      ctx.beginPath();
      ctx.arc(x, y, 2.3, 0, Math.PI * 2);
      ctx.fill();
      if (pkt.t >= 1) {
        pulse[pkt.edge.b.id] = now + 700;
        packets.splice(i, 1);
      }
    }

    for (const n of nodes) drawNode(n, now);
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

/** Hero compact spine: Git → GitLab → Argo CD → Istio → pods */
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

  if (!compact) {
    // фон страницы — отдельная K8s-анимация
    return setupAmbientK8sCanvas(canvas);
  }

  const nodes = [
    { id: "git", label: "Git", nx: 0.04, ny: 0.5, kind: "ci" },
    { id: "ci", label: "GitLab", nx: 0.2, ny: 0.5, kind: "ci" },
    { id: "argo", label: "Argo CD", nx: 0.4, ny: 0.5, kind: "gitops" },
    { id: "istio", label: "Istio", nx: 0.58, ny: 0.5, kind: "mesh" },
    { id: "api", label: "api-svc", nx: 0.76, ny: 0.5, kind: "pod" },
    { id: "id", label: "keycloak", nx: 0.94, ny: 0.5, kind: "pod" },
  ];

  const edgePairs = [
    ["git", "ci"],
    ["ci", "argo"],
    ["argo", "istio"],
    ["istio", "api"],
    ["api", "id"],
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
  setupAmbientK8sCanvas($("#mesh-canvas"));
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
  $("#match-result").hidden = true;
  clearMatchError();

  const online = await checkMatchReady();
  if (!online) {
    setBusy(false, "Сравнение сейчас недоступно", "error");
    return;
  }

  const ctrl = new AbortController();
  const clientTimeoutMs = 190_000;
  const timer = window.setTimeout(() => ctrl.abort(), clientTimeoutMs);

  try {
    setBusy(true, "Сравниваю вакансию с профилем кандидата…");

    let res;
    if (tab === "pdf") {
      const file = $("#vacancy-pdf").files?.[0];
      if (!file) throw Object.assign(new Error("Выберите PDF"), { code: "validation" });
      const fd = new FormData();
      fd.append("pdf", file);
      res = await fetch("/api/match", { method: "POST", body: fd, signal: ctrl.signal });
    } else {
      const body = tab === "url"
        ? { url: $("#vacancy-url").value.trim() }
        : { text: $("#vacancy-text").value.trim() };
      if (tab === "url" && !body.url) throw Object.assign(new Error("Укажите URL"), { code: "validation" });
      if (tab === "text" && !body.text) throw Object.assign(new Error("Вставьте текст вакансии"), { code: "validation" });
      res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    }

    let data = {};
    try {
      data = await res.json();
    } catch {
      data = { code: "match_failed", error: `HTTP ${res.status}` };
    }

    if (!res.ok) {
      const info = humanizeMatchFailure(data, res.status);
      setBusy(false, info.message, "error");
      showMatchError(info);
      if (["llm_auth", "llm_model", "llm_quota"].includes(info.code)) {
        setMatchBadge("is-down", "Сравнение недоступно");
        setMatchAlert(true, { ...info, lock: true });
      } else if (["llm_timeout", "llm_failed", "llm_empty", "llm_bad_json"].includes(info.code)) {
        setMatchBadge("is-down", "Сбой сравнения");
        setMatchAlert(true, { ...info, lock: false });
      }
      return;
    }

    renderMatch(data);
    const ms = data.elapsedMs ? ` · ${data.elapsedMs}ms` : "";
    setBusy(false, `Готово: соответствие кандидата и вакансии${ms}`, "ok");
  } catch (err) {
    if (err?.code === "validation") {
      setBusy(false, err.message, "error");
      return;
    }
    if (err?.name === "AbortError") {
      const info = { ...MATCH_ERROR_COPY.llm_timeout, code: "llm_timeout" };
      setBusy(false, info.message, "error");
      showMatchError(info);
      setMatchBadge("is-down", "Сбой сравнения");
      return;
    }
    const info = { ...MATCH_ERROR_COPY.network, code: "network" };
    setBusy(false, info.message, "error");
    showMatchError(info);
  } finally {
    window.clearTimeout(timer);
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
  setupContactModal();
  loadPhoto();
  loadResume();
  checkMatchReady();
  window.setInterval(checkMatchReady, 60_000);
  $("#btn-match").addEventListener("click", runMatch);
  $("#btn-download-pdf")?.addEventListener("click", async () => {
    const btn = $("#btn-download-pdf");
    const prev = btn?.textContent;
    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Готовим PDF…";
      }
      const res = await fetch("/api/resume.pdf");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Nazarov-Alexey-DevOps.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Не удалось скачать PDF: ${err.message || err}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = prev || "Скачать PDF";
      }
    }
  });
});
