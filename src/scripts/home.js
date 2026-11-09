import { create, initPage, loadJson, onLanguageChange, t } from "./common.js";

const STAR =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z"/></svg>';

async function renderAnnouncement() {
  const section = document.getElementById("announcement");
  const response = await fetch("/api/announcement", { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load announcement (${response.status})`);
  const announcement = await response.json();
  if (!announcement.text) return;

  document.getElementById("announcement-text").textContent = announcement.text;
  section.hidden = false;
}

async function renderGallery() {
  const { cover, images } = await loadJson("gallery.json");
  const imageUrl = (file) => new URL(`../../public/images/${file}`, import.meta.url).href;

  const banner = document.getElementById("gallery-banner");
  const overlay = document.getElementById("gallery-overlay");
  const grid = document.getElementById("overlay-grid");
  const empty = document.getElementById("overlay-empty");
  const closeButton = document.getElementById("overlay-close");

  if (cover) {
    document.getElementById("banner-bg").style.backgroundImage = `url("${imageUrl(cover)}")`;
    banner.classList.add("has-cover");
  }

  const open = () => {
    grid.replaceChildren();
    empty.hidden = images.length > 0;
    images.forEach((file) => {
      const cell = create("div", "overlay-cell");
      const image = create("img");
      image.src = imageUrl(file);
      image.alt = t("gallery.imageAlt");
      image.loading = "lazy";
      cell.append(image);
      grid.append(cell);
    });
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    closeButton.focus();
  };
  const close = () => {
    overlay.hidden = true;
    document.body.style.overflow = "";
    banner.focus();
  };

  banner.addEventListener("click", open);
  closeButton.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) close();
  });
}

async function renderReviews() {
  const reviews = await loadJson("reviews.json");
  if (reviews.length === 0) return;

  const section = document.getElementById("reviews");
  const track = document.getElementById("slider-track");
  const previous = document.getElementById("rev-prev");
  const next = document.getElementById("rev-next");
  let index = 0;

  const go = (target) => {
    index = (target + reviews.length) % reviews.length;
    track.style.transform = `translateX(-${index * 100}%)`;
  };

  const updateToggles = () => {
    track.querySelectorAll(".slide").forEach((slide) => {
      const quote = slide.querySelector(".review-text");
      const more = slide.querySelector(".review-more");
      more.hidden = !quote.classList.contains("expanded") && quote.scrollHeight <= quote.clientHeight + 1;
    });
  };

  reviews.forEach(({ author, text }) => {
    const slide = create("div", "slide");
    const card = create("figure", "review-card");
    const stars = create("div", "stars");
    stars.setAttribute("role", "img");
    stars.innerHTML = STAR.repeat(5);
    const quote = create("blockquote", "review-text", text);
    const more = create("button", "review-more");
    more.type = "button";
    more.hidden = true;
    more.addEventListener("click", () => {
      const expanded = quote.classList.toggle("expanded");
      more.setAttribute("aria-expanded", String(expanded));
      more.textContent = t(expanded ? "reviews.less" : "reviews.more");
    });
    card.append(stars, quote, more, create("figcaption", "review-name", author));
    slide.append(card);
    track.append(slide);
  });

  const setLabels = () => {
    track.querySelectorAll(".stars").forEach((stars) => stars.setAttribute("aria-label", t("reviews.stars")));
    track.querySelectorAll(".review-more").forEach((more) => {
      more.textContent = t(more.getAttribute("aria-expanded") === "true" ? "reviews.less" : "reviews.more");
    });
    requestAnimationFrame(updateToggles);
  };
  setLabels();
  onLanguageChange(setLabels);

  section.hidden = false;
  previous.addEventListener("click", () => go(index - 1));
  next.addEventListener("click", () => go(index + 1));

  let startX = null;
  track.addEventListener("touchstart", (event) => {
    startX = event.touches[0].clientX;
  }, { passive: true });
  track.addEventListener("touchend", (event) => {
    if (startX == null) return;
    const dx = event.changedTouches[0].clientX - startX;
    if (dx > 40) go(index - 1);
    else if (dx < -40) go(index + 1);
    startX = null;
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updateToggles, 150);
  });
}

initPage();
renderGallery().catch(console.error);
renderReviews().catch(console.error);
renderAnnouncement().catch(() => {});
