import { create, getLanguage, initPage, loadJson, onLanguageChange, t } from "./common.js";

const categories = await loadJson("prices.json");
const container = document.getElementById("price-list");

function renderPrices() {
  const language = getLanguage();
  container.replaceChildren();

  if (categories.length === 0) {
    container.append(create("p", "prices-empty", t("prices.empty")));
    return;
  }

  categories.forEach((category) => {
    const card = create("section", "price-card");
    card.append(create("h2", "price-cat", category.title[language]));
    const list = create("div", "price-list");
    category.items.forEach((item) => {
      const row = create("div", "price-row");
      row.append(
        create("span", "price-name", item.name[language]),
        create("span", "price-dots"),
        create("span", "price-value", item.price),
      );
      list.append(row);
    });
    card.append(list);
    container.append(card);
  });
}

onLanguageChange(renderPrices);
initPage();
