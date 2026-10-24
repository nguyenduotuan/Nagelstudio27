import { translations } from "./translations.js";

const DEFAULT_LANGUAGE = "de";
const STORAGE_KEY = "nailshop-language";
const LANGUAGE_CHANGED = "nailshop:languagechange";
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

let openingHours = null;

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

function applyLanguage(language) {
  localStorage.setItem(STORAGE_KEY, language);
  document.documentElement.lang = language;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-alt]").forEach((element) => {
    element.alt = t(element.dataset.i18nAlt);
  });
  document.querySelectorAll("[data-language]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.language === language));
  });

  renderHours();
  document.dispatchEvent(new Event(LANGUAGE_CHANGED));
}

// 2024-01-01 was a Monday, so day i of that week gives the localised weekday name.
function renderHours() {
  if (!openingHours) return;

  document.querySelectorAll("[data-hours]").forEach((list) => {
    list.replaceChildren();
    WEEKDAYS.forEach((day, index) => {
      const row = document.createElement("li");
      const name = document.createElement("span");
      const time = document.createElement("span");
      name.textContent = new Date(2024, 0, 1 + index).toLocaleDateString(getLanguage(), { weekday: "long" });
      time.textContent = openingHours[day] ?? t("hours.closed");
      row.classList.toggle("closed", !openingHours[day]);
      row.append(name, time);
      list.append(row);
    });
  });
}

export async function loadJson(fileName) {
  const response = await fetch(new URL(`../data/${fileName}`, import.meta.url), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load ${fileName} (${response.status})`);
  }
  return response.json();
}

async function fillShopInfo() {
  const shop = await loadJson("shop.json");

  openingHours = shop.openingHours;
  renderHours();

  document.querySelectorAll("[data-shop]").forEach((element) => {
    element.textContent = shop[element.dataset.shop];
  });
  document.querySelectorAll("[data-shop-call]").forEach((link) => {
    link.href = `tel:${shop.phone.replace(/[^\d+]/g, "")}`;
  });
}

// Call once per page: wires up the language switcher and fills in shop details.
export function initPage() {
  document.querySelectorAll("[data-language]").forEach((button) => {
    button.addEventListener("click", () => applyLanguage(button.dataset.language));
  });

  applyLanguage(getLanguage());
  fillShopInfo().catch(console.error);
}
