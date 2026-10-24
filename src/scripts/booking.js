import { initPage, t, getLanguage } from "./common.js";

initPage();

const form = document.getElementById("booking-form");
const status = document.getElementById("booking-status");
const submitButton = form.querySelector("button[type=submit]");
const phone = form.elements.phone;
const phoneConfirmation = form.elements.phoneConfirmation;

function validatePhoneConfirmation() {
  const normalizePhone = (value) => value.replace(/\D/g, "").replace(/^00/, "").replace(/^0/, "49");
  const mismatch = phoneConfirmation.value && normalizePhone(phone.value) !== normalizePhone(phoneConfirmation.value);
  phoneConfirmation.setCustomValidity(mismatch ? t("booking.phoneMismatch") : "");
}

phone.addEventListener("input", validatePhoneConfirmation);
phoneConfirmation.addEventListener("input", validatePhoneConfirmation);

function showStatus(key) {
  status.dataset.i18n = key;
  status.textContent = t(key);
}

function showIssue(key) {
  delete status.dataset.i18n;
  status.replaceChildren(document.createTextNode(`${t(key)} ${t("booking.callImmediate")} `));
  const callLink = document.createElement("a");
  const existingCallLink = document.querySelector("[data-shop-call]");
  const existingCallHref = existingCallLink?.getAttribute("href");
  callLink.href = existingCallHref && existingCallHref !== "#" ? existingCallLink.href : "contact.html";
  callLink.textContent = t("action.call");
  status.append(callLink);
}

function getErrorKey(error) {
  if (["invalid_name", "invalid_phone", "invalid_phoneConfirmation", "invalid_request", "invalid_appointmentDate"].includes(error)) return "booking.errorRequired";
  if (error === "phone_mismatch") return "booking.errorPhoneMismatch";
  if (error === "invalid_phone_number") return "booking.errorPhoneInvalid";
  if (error === "duplicate_phone") return "booking.errorDuplicate";
  if (error === "invalid_appointment_time" || error === "invalid_appointment_datetime") return "booking.errorDateTime";
  if (error === "spam_detected") return "booking.errorSpam";
  if (error === "rate_limited") return "booking.errorRateLimit";
  return "booking.errorGeneric";
}

form.addEventListener("invalid", () => showIssue("booking.errorRequired"), true);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  try {
    const response = await fetch("/api/booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.elements.name.value,
        phone: form.elements.phone.value,
        phoneConfirmation: phoneConfirmation.value,
        appointmentDate: form.elements.appointmentDate.value,
        appointmentTime: form.elements.appointmentTime.value,
        request: form.elements.request.value,
        website: form.elements.website.value,
        lang: getLanguage(),
      }),
    });
    if (!response.ok) {
      let error = "";
      try {
        error = (await response.json()).error;
      } catch {
        error = "";
      }
      showIssue(getErrorKey(error));
      return;
    }
    form.reset();
    showStatus("booking.success");
  } catch {
    showIssue("booking.errorConnection");
  } finally {
    submitButton.disabled = false;
  }
});
