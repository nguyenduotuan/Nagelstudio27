import { translations } from "./translations.js";

const DEFAULT_LANGUAGE = "de";
const STORAGE_KEY = "nailshop-language";
const LANGUAGE_CHANGED = "nailshop:languagechange";
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const LANGUAGES = { de: "Deutsch", en: "English", vi: "Tiếng Việt" };
const LOCALES = { de: "de-DE", en: "en-GB", vi: "vi-VN" };

let shopPromise = null;

export function getLanguage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return translations[saved] ? saved : DEFAULT_LANGUAGE;
}

export function t(key) {
  return translations[getLanguage()][key] ?? translations[DEFAULT_LANGUAGE][key] ?? key;
}

export function onLanguageChange(callback) {
  document.addEventListener(LANGUAGE_CHANGED, callback);
}

function root() {
  return document.body.dataset.root ?? "";
}

export function create(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export async function loadJson(fileName) {
  const response = await fetch(new URL(`../data/${fileName}`, import.meta.url), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load ${fileName} (${response.status})`);
  }
  return response.json();
}

export function fetchShop() {
  shopPromise ??= loadJson("shop.json");
  return shopPromise;
}

export const telHref = (phone) => `tel:${phone.replace(/[^\d+]/g, "")}`;

function applyTexts() {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nLabel));
  });
  document.querySelectorAll("[data-i18n-alt]").forEach((element) => {
    element.alt = t(element.dataset.i18nAlt);
  });
}

const TITLE_KEYS = { prices: "nav.prices", contact: "nav.contact", booking: "booking.title" };

function updateTitle(shop) {
  const key = TITLE_KEYS[document.body.dataset.page];
  document.title = key ? `${t(key)} – ${shop.name}` : shop.name;
}

function applyLanguage(language) {
  localStorage.setItem(STORAGE_KEY, language);
  document.documentElement.lang = language;
  applyTexts();
  document.querySelectorAll("[data-language]").forEach((button) => {
    const active = button.dataset.language === language;
    button.setAttribute("aria-pressed", String(active));
    button.classList.toggle("active", active);
  });
  fetchShop().then(updateTitle).catch(console.error);
  document.dispatchEvent(new Event(LANGUAGE_CHANGED));
}

function renderHeader(shop) {
  const header = document.getElementById("site-header");
  if (!header) return;
  header.classList.add("site-header");
  const inner = create("div", "header-inner");

  const brand = create("a", "brand", shop.name);
  brand.href = `${root()}index.html`;
  inner.append(brand);

  const nav = create("nav", "nav");
  nav.setAttribute("aria-label", "Main");
  const current = document.body.dataset.page;
  [
    ["home", "nav.home", `${root()}index.html`],
    ["prices", "nav.prices", `${root()}src/pages/prices.html`],
    ["contact", "nav.contact", `${root()}src/pages/contact.html`],
  ].forEach(([page, key, href]) => {
    const link = create("a", "nav-link");
    link.href = href;
    link.dataset.i18n = key;
    if (page === current) link.setAttribute("aria-current", "page");
    nav.append(link);
  });
  inner.append(nav);

  const switcher = create("div", "lang-switch");
  switcher.setAttribute("role", "group");
  switcher.dataset.i18nLabel = "lang.label";
  Object.entries(LANGUAGES).forEach(([code, label]) => {
    const button = create("button", `flag flag-${code}`);
    button.type = "button";
    button.dataset.language = code;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", () => applyLanguage(code));
    switcher.append(button);
  });
  inner.append(switcher);

  header.replaceChildren(inner);
}

function renderFooter(shop) {
  const footer = document.getElementById("site-footer");
  if (!footer) return;
  footer.classList.add("site-footer");
  const text = create("p", "footer-text", `© ${new Date().getFullYear()} ${shop.name}. `);
  const rights = create("span");
  rights.dataset.i18n = "footer.rights";
  text.append(rights);
  footer.replaceChildren(text);
}

function renderContactBlock(shop) {
  const block = document.getElementById("contact-block");
  if (!block) return;

  const row = (labelKey, value) => {
    const wrapper = create("div", "contact-row");
    const label = create("h3", "contact-label");
    label.dataset.i18n = labelKey;
    wrapper.append(label, value);
    return wrapper;
  };

  const phone = create("a", "contact-value contact-phone", shop.phone);
  phone.href = telHref(shop.phone);
  const address = create("div", "contact-value");
  String(shop.address ?? "")
    .split("\n")
    .filter(Boolean)
    .forEach((line) => address.append(create("span", "address-line", line)));
  const details = create("div", "contact-details");
  details.append(row("contact.phone", phone), row("contact.address", address));

  const divider = create("div", "contact-divider");
  divider.setAttribute("aria-hidden", "true");

  const hours = create("div", "contact-hours");
  const hoursLabel = create("h3", "contact-label");
  hoursLabel.dataset.i18n = "hours.title";
  const list = create("div", "hours-list");
  hours.append(hoursLabel, list);

  const renderHours = () => {
    list.replaceChildren();
    WEEKDAYS.forEach((day, index) => {
      const value = shop.openingHours?.[day];
      const item = create("div", "hours-row");
      item.style.setProperty("--n", index);
      const name = new Date(2024, 0, 1 + index).toLocaleDateString(LOCALES[getLanguage()], { weekday: "long" });
      item.append(
        create("span", "hours-day", name),
        create("span", `hours-time${value ? "" : " closed"}`, value || t("hours.closed")),
      );
      list.append(item);
    });
  };
  renderHours();
  onLanguageChange(renderHours);

  const card = create("div", "contact-card");
  card.append(details, divider, hours);
  block.replaceChildren(card);
}

function initAmbient() {
  const layer = create("div", "ambient");
  layer.setAttribute("aria-hidden", "true");
  for (let o = 1; o <= 4; o += 1) layer.append(create("span", `orb orb-${o}`));
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");

  const addDust = () => {
    if (layer.querySelector(".dust")) return;
    for (let i = 0; i < 16; i += 1) {
      const star = i % 3 === 0;
      const dust = create("span", `dust${star ? " star" : ""}`);
      dust.style.setProperty("--x", `${(i * 37 + 11) % 96}%`);
      dust.style.setProperty("--s", `${star ? 0.8 + (i % 4) * 0.12 : 0.35 + (i % 5) * 0.08}rem`);
      dust.style.setProperty("--dur", `${16 + ((i * 5) % 11)}s`);
      dust.style.setProperty("--dl", `-${((i * 3.1) % 20).toFixed(1)}s`);
      dust.style.setProperty("--sway", `${(i % 2 ? 1 : -1) * (1.5 + (i % 4))}rem`);
      layer.append(dust);
    }
  };
  const applyMotionPreference = () => {
    if (calm.matches) {
      layer.querySelectorAll(".dust").forEach((dust) => dust.remove());
      layer.style.setProperty("--sy", 0);
    } else {
      addDust();
    }
  };

  applyMotionPreference();
  document.body.prepend(layer);
  calm.addEventListener("change", applyMotionPreference);

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking || calm.matches) return;
      ticking = true;
      requestAnimationFrame(() => {
        layer.style.setProperty("--sy", window.scrollY);
        ticking = false;
      });
    },
    { passive: true },
  );
}

function initReveal() {
  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.05, rootMargin: "0px 0px -4% 0px" },
  );
  document.querySelectorAll(".section-inner, .page > *").forEach((node) => {
    node.classList.add("reveal");
    observer.observe(node);
  });
}

// Call once per page: renders shared chrome, wires up the language switcher and fills in shop details.
export async function initPage() {
  document.documentElement.lang = getLanguage();
  initAmbient();
  initReveal();

  const shop = await fetchShop();
  renderHeader(shop);
  renderFooter(shop);
  renderContactBlock(shop);
  document.querySelectorAll("[data-shop-call]").forEach((link) => {
    link.href = telHref(shop.phone);
  });
  document.querySelectorAll("[data-shop]").forEach((element) => {
    element.textContent = shop[element.dataset.shop];
  });

  applyLanguage(getLanguage());
  return shop;
}
