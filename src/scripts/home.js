import { initPage, loadJson, onLanguageChange, t } from "./common.js";

async function renderGallery() {
  const { cover, images } = await loadJson("gallery.json");

  const imageUrl = (file) => new URL(`../../public/images/${file}`, import.meta.url);
  const banner = document.getElementById("gallery-open");
  if (cover) {
    banner.style.setProperty("--cover", `url("${imageUrl(cover).href}")`);
  }

  const dialog = document.getElementById("gallery-dialog");
  const closeButton = document.getElementById("gallery-close");
  const setCloseLabel = () => closeButton.setAttribute("aria-label", t("gallery.close"));
  setCloseLabel();
  onLanguageChange(setCloseLabel);

  banner.addEventListener("click", () => dialog.showModal());
  closeButton.addEventListener("click", () => dialog.close());
  // Only the backdrop is the dialog itself; clicks on content hit child elements.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  if (images.length === 0) return;

  const gallery = document.getElementById("gallery");
  images.forEach((file) => {
    const image = document.createElement("img");
    image.src = imageUrl(file);
    image.dataset.i18nAlt = "gallery.imageAlt";
    image.loading = "lazy";
    gallery.append(image);
  });
  document.getElementById("gallery-empty").hidden = true;
}

async function renderReviews() {
  const reviews = await loadJson("reviews.json");
  if (reviews.length === 0) return;

  const list = document.getElementById("reviews");
  const stars = [];
  const toggles = [];
  reviews.forEach(({ author, text }) => {
    const quote = document.createElement("blockquote");
    const rating = document.createElement("span");
    const body = document.createElement("p");
    const more = document.createElement("button");
    const name = document.createElement("footer");
    body.className = "review-text";
    more.type = "button";
    more.className = "review-more";
    more.hidden = true;
    more.addEventListener("click", () => {
      const expanded = body.classList.toggle("is-expanded");
      more.setAttribute("aria-expanded", String(expanded));
      setToggleLabel(more);
    });
    toggles.push({ body, more });
    rating.className = "review-stars";
    rating.setAttribute("role", "img");
    rating.textContent = "★★★★★";
    stars.push(rating);
    body.textContent = text;
    name.textContent = author;
    quote.append(rating, body, more, name);
    list.append(quote);
  });

  const setStarLabels = () => stars.forEach((rating) => rating.setAttribute("aria-label", t("reviews.stars")));
  setStarLabels();
  onLanguageChange(setStarLabels);
  onLanguageChange(() => toggles.forEach(({ more }) => setToggleLabel(more)));
  document.getElementById("reviews-empty").hidden = true;
  document.getElementById("reviews-slider").hidden = false;
  setUpReviewSlider(list);

  // Show the toggle only for texts longer than the 5-line clamp; re-check when the width changes.
  const updateToggles = () => toggles.forEach(({ body, more }) => {
    const expanded = body.classList.contains("is-expanded");
    more.hidden = !expanded && body.scrollHeight <= body.clientHeight + 1;
    setToggleLabel(more);
  });
  new ResizeObserver(updateToggles).observe(list);
}

function setToggleLabel(button) {
  const expanded = button.getAttribute("aria-expanded") === "true";
  button.textContent = t(expanded ? "reviews.less" : "reviews.more");
}

function setUpReviewSlider(list) {
  const previous = document.getElementById("reviews-previous");
  const next = document.getElementById("reviews-next");
  const step = () => list.clientWidth * 0.8;

  previous.addEventListener("click", () => list.scrollBy({ left: -step(), behavior: "smooth" }));
  next.addEventListener("click", () => list.scrollBy({ left: step(), behavior: "smooth" }));

  const setLabels = () => {
    previous.setAttribute("aria-label", t("reviews.previous"));
    next.setAttribute("aria-label", t("reviews.next"));
    list.setAttribute("aria-label", t("reviews.title"));
  };
  setLabels();
  onLanguageChange(setLabels);
}

renderGallery().catch(console.error).finally(initPage);
renderReviews().catch(console.error);
