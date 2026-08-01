const sections = [...document.querySelectorAll("section[id]")];
const navLinks = [...document.querySelectorAll(".rail-nav a")];
const progressBar = document.querySelector("#progress-bar");
const toast = document.querySelector("#toast");

const setActiveSection = () => {
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
