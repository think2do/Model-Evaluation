const sections = [...document.querySelectorAll("section[id]")];
const navLinks = [...document.querySelectorAll(".rail-nav a")];
const progressBar = document.querySelector("#progress-bar");
const toast = document.querySelector("#toast");
const notesToggle = document.querySelector("#notes-toggle");

/* ═══════════ 翻页模式（deck） ═══════════ */
document.body.classList.add("deck");
const prevBtn = document.querySelector(".deck-prev");
const nextBtn = document.querySelector(".deck-next");
const deckCounter = document.querySelector(".deck-counter");
let deckIndex = 0;
let wheelLock = false;
let touchY = null;

const pad2 = (n) => String(n + 1).padStart(2, "0");

function deckGoTo(index, { resetScroll = true } = {}) {
  deckIndex = Math.max(0, Math.min(sections.length - 1, index));

  sections.forEach((sec, i) => {
    sec.classList.toggle("is-current", i === deckIndex);
    sec.setAttribute("aria-hidden", i === deckIndex ? "false" : "true");
  });
  if (resetScroll) sections[deckIndex].scrollTop = 0;

  const id = sections[deckIndex].id;
  const group = sections[deckIndex].dataset.group || id;
  navLinks.forEach((link) => {
    link.classList.toggle("is-active", link.dataset.group === group);
  });

  const label =
    id === "top"
      ? "封面"
      : navLinks.find((l) => l.dataset.section === id)?.querySelector("span")?.textContent || "";
  if (deckCounter) deckCounter.innerHTML = `${pad2(deckIndex)} / ${pad2(sections.length - 1)} <em>${label}</em>`;
  if (prevBtn) prevBtn.disabled = deckIndex === 0;
  if (nextBtn) nextBtn.disabled = deckIndex === sections.length - 1;

  const progress = sections.length > 1 ? deckIndex / (sections.length - 1) : 0;
  progressBar.style.height = `${progress * 100}%`;
}

/* 底部控制条 */
prevBtn?.addEventListener("click", () => deckGoTo(deckIndex - 1));
nextBtn?.addEventListener("click", () => deckGoTo(deckIndex + 1));

/* 目录跳页 */
navLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    const idx = sections.findIndex((s) => s.id === link.dataset.section);
    if (idx >= 0) {
      e.preventDefault();
      deckGoTo(idx);
    }
  });
});

/* 键盘翻页 */
window.addEventListener("keydown", (e) => {
  const key = e.key;
  if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(key)) {
    e.preventDefault();
    deckGoTo(deckIndex + 1);
  } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(key)) {
    e.preventDefault();
    deckGoTo(deckIndex - 1);
  } else if (key === "Home") {
    e.preventDefault();
    deckGoTo(0);
  } else if (key === "End") {
    e.preventDefault();
    deckGoTo(sections.length - 1);
  }
});

/* 滚轮翻页：页面内部还能滚时先内部滚，滚到边界再翻页 */
window.addEventListener(
  "wheel",
  (e) => {
    const sec = sections[deckIndex];
    const canDown = sec.scrollHeight - sec.scrollTop - sec.clientHeight > 1;
    const canUp = sec.scrollTop > 1;
    const dir = e.deltaY > 0 ? 1 : -1;
    if ((dir > 0 && canDown) || (dir < 0 && canUp)) return;
    e.preventDefault();
    if (wheelLock) return;
    wheelLock = true;
    deckGoTo(deckIndex + dir);
    setTimeout(() => {
      wheelLock = false;
    }, 550);
  },
  { passive: false }
);

/* 触屏滑动翻页：内部不能滚动时才响应翻页 */
document.addEventListener(
  "touchstart",
  (e) => {
    touchY = e.touches[0].clientY;
  },
  { passive: true }
);
document.addEventListener(
  "touchend",
  (e) => {
    if (touchY === null) return;
    const dy = e.changedTouches[0].clientY - touchY;
    touchY = null;
    if (Math.abs(dy) < 60) return;
    const sec = sections[deckIndex];
    const atTop = sec.scrollTop <= 1;
    const atEnd = sec.scrollHeight - sec.scrollTop - sec.clientHeight <= 1;
    const dir = dy < 0 ? 1 : -1;
    if ((dir > 0 && atEnd) || (dir < 0 && atTop)) deckGoTo(deckIndex + dir);
  },
  { passive: true }
);

/* 初始进入第一页 */
deckGoTo(0, { resetScroll: false });

/* 滚动模式下的章节高亮（翻页模式下由 deckGoTo 接管，此函数不再生效） */
const setActiveSection = () => {
  if (document.body.classList.contains("deck")) return;
  const marker = window.scrollY + window.innerHeight * 0.32;
  let current = "overview";

  sections.forEach((section) => {
    if (section.offsetTop <= marker) current = section.id;
  });

  navLinks.forEach((link) => {
    link.classList.toggle("is-active", link.dataset.section === current);
  });

  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0;
  progressBar.style.height = `${progress * 100}%`;
};

window.addEventListener("scroll", setActiveSection, { passive: true });
window.addEventListener("resize", setActiveSection);
setActiveSection();

/* 改造前后切换 */
document.querySelectorAll(".segmented button").forEach((button) => {
  button.addEventListener("click", () => {
    const group = button.closest(".before-after");
    group.querySelectorAll(".segmented button").forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
    group.querySelectorAll(".ba-panel").forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.panel === button.dataset.view);
    });
  });
});

let toastTimer;
const showToast = (message = "已复制") => {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1800);
};

/* 复制按钮 */
document.querySelectorAll(".copy-button").forEach((button) => {
  button.addEventListener("click", async () => {
    const targetId = button.dataset.copyTarget;
    const target = targetId ? document.getElementById(targetId) : null;
    const text = button.dataset.copyText || target?.innerText || "";

    try {
      await navigator.clipboard.writeText(text.trim());
      showToast();
    } catch {
      showToast("复制失败，请手动选择");
    }
  });
});

/* 演讲者注释：一键展开 / 收起全部 */
notesToggle?.addEventListener("click", () => {
  const showing = document.body.classList.toggle("show-notes");
  notesToggle.textContent = showing ? "🎤 隐藏注释" : "🎤 演讲者注释";
  document.querySelectorAll(".speaker-note").forEach((note) => {
    note.open = showing;
  });
});
