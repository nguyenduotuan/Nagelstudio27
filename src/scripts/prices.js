import { getLanguage, initPage, loadJson, onLanguageChange } from "./common.js";

const categories = await loadJson("prices.json");
const container = document.getElementById("price-list");

function renderPrices() {
  const language = getLanguage();
  container.replaceChildren();

  categories.forEach((category) => {
    const section = document.createElement("section");
    const heading = document.createElement("h2");
    const list = document.createElement("ul");
    heading.textContent = category.title[language];

    category.items.forEach((item) => {
      const row = document.createElement("li");
      const name = document.createElement("span");
      const price = document.createElement("span");
      name.textContent = item.name[language];
      price.textContent = item.price;
      row.append(name, price);
      list.append(row);
    });

    section.append(heading, list);
    container.append(section);
  });
}

onLanguageChange(renderPrices);
initPage();
