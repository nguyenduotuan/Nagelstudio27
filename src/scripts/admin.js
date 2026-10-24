const calendarPanel = document.getElementById("calendar-panel");
const bookingsPanel = document.getElementById("bookings-panel");
const monthCalendar = document.getElementById("month-calendar");
const weekCalendar = document.getElementById("week-calendar");
const calendarGrid = document.getElementById("calendar-grid");
const monthLabel = document.getElementById("calendar-month");
const selectedDate = document.getElementById("selected-date");
const bookingList = document.getElementById("booking-list");
const calendarError = document.getElementById("calendar-error");
const bookingError = document.getElementById("booking-error");
const bookingDialog = document.getElementById("booking-dialog");
const bookingDialogBody = document.getElementById("booking-dialog-body");
const deleteBookingDialog = document.getElementById("delete-booking-dialog");
const deleteBookingForm = document.getElementById("delete-booking-form");
const deleteConfirmation = document.getElementById("delete-confirmation");
const deleteBookingSubmit = document.getElementById("delete-booking-submit");
const deleteBookingError = document.getElementById("delete-booking-error");
const monthNames = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const weekdayNames = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

let bookings = [];
let calendarView = "month";
let visibleDate = new Date();
let activeBookingFolder = "pending";
let bookingToDelete = null;

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getWeekStart(date) {
  const mondayOffset = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - mondayOffset);
}

function createBookingDetails(booking) {
  const details = document.createElement("dl");
  details.className = "admin-booking-details";

  const addDetail = (label, value, className = "") => {
    const row = document.createElement("div");
    if (className) row.className = className;
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value || "Keine Angabe";
    row.append(term, description);
    details.append(row);
    return description;
  };

  const dateLabel = booking.appointmentDate
    ? new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${booking.appointmentDate}T12:00:00`))
    : "";
  addDetail("Wunschdatum", dateLabel);
  addDetail("Wunschzeit", booking.appointmentTime ? `${booking.appointmentTime.slice(0, 5)} Uhr` : "Ganztägig");
  addDetail("Name", booking.name);
  const phoneDescription = addDetail("Telefonnummer", booking.phone, "admin-booking-phone");
  if (booking.phone) {
    const phone = document.createElement("a");
    phone.href = `tel:${booking.phone.replace(/[^\d+]/g, "")}`;
    phone.textContent = booking.phone;
    phoneDescription.replaceChildren(phone);
  }
  addDetail("Gewünschte Behandlung", booking.request, "admin-booking-request");
  const receivedLabel = booking.createdAt
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(booking.createdAt))
    : "";
  addDetail("Eingegangen am", receivedLabel);
  return details;
}

function openBookingDialog(booking) {
  bookingDialogBody.replaceChildren(createBookingDetails(booking));
  bookingDialog.showModal();
}

function renderMonthCalendar() {
  const year = visibleDate.getFullYear();
  const month = visibleDate.getMonth();
  monthLabel.textContent = `${monthNames[month]} ${year}`;
  calendarGrid.replaceChildren();

  for (const weekday of weekdayNames) {
    const heading = document.createElement("span");
    heading.className = "calendar-weekday";
    heading.textContent = weekday;
    calendarGrid.append(heading);
  }

  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let blank = 0; blank < firstWeekday; blank += 1) {
    const spacer = document.createElement("span");
    spacer.setAttribute("aria-hidden", "true");
    calendarGrid.append(spacer);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const currentDay = new Date(year, month, day);
    const dayBookings = bookings.filter((booking) => booking.appointmentDate === dateKey(currentDay));
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.textContent = String(day);
    button.setAttribute("aria-label", `${day}. ${monthNames[month]} ${year}${dayBookings.length ? `, ${dayBookings.length} Terminanfrage${dayBookings.length === 1 ? "" : "n"}` : ""}`);
    if (dayBookings.length) {
      button.classList.add("has-bookings");
      button.dataset.count = String(dayBookings.length);
    }
    button.addEventListener("click", () => {
      const dateLabel = new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(new Date(year, month, day));
      selectedDate.textContent = dayBookings.length
        ? `${dateLabel}: ${dayBookings.length} Terminanfrage${dayBookings.length === 1 ? "" : "n"} (${dayBookings.map((booking) => booking.appointmentTime ? `${booking.appointmentTime} Uhr` : "ganztägig").join(", ")})`
        : `${dateLabel}: Keine Terminanfragen.`;
    });
    calendarGrid.append(button);
  }
}

function renderWeekCalendar() {
  const weekStart = getWeekStart(visibleDate);
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
  const formatDate = (date) => new Intl.DateTimeFormat("de-DE").format(date);
  monthLabel.textContent = `${formatDate(weekStart)} – ${formatDate(weekEnd)}`;
  weekCalendar.replaceChildren();

  const days = Array.from({ length: 7 }, (_, offset) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + offset));
  const weekKeys = new Set(days.map(dateKey));
  const weekBookings = bookings.filter((booking) => weekKeys.has(booking.appointmentDate));
  const timedBookings = weekBookings.filter((booking) => /^\d{2}:\d{2}/.test(booking.appointmentTime || ""));
  const allDayBookings = weekBookings.filter((booking) => !booking.appointmentTime);
  const bookingHours = timedBookings.map((booking) => Number(booking.appointmentTime.slice(0, 2)));
  // Show at least 08-19 Uhr, widened to fit any request outside that range.
  const firstHour = Math.min(8, ...bookingHours);
  const lastHour = Math.max(19, ...bookingHours);
  const todayKey = dateKey(new Date());

  const corner = document.createElement("div");
  corner.className = "timetable-corner";
  weekCalendar.append(corner);
  for (const date of days) {
    const heading = document.createElement("div");
    heading.className = "timetable-day-heading";
    heading.classList.toggle("today", dateKey(date) === todayKey);
    const weekday = document.createElement("strong");
    weekday.textContent = new Intl.DateTimeFormat("de-DE", { weekday: "short" }).format(date);
    const dayDate = document.createElement("span");
    dayDate.textContent = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "numeric" }).format(date);
    heading.append(weekday, dayDate);
    weekCalendar.append(heading);
  }

  const allDayLabel = document.createElement("div");
  allDayLabel.className = "timetable-all-day-label";
  allDayLabel.textContent = "Ganztägig";
  weekCalendar.append(allDayLabel);
  for (const date of days) {
    const cell = document.createElement("div");
    cell.className = "timetable-all-day-cell";
    for (const booking of allDayBookings.filter((item) => item.appointmentDate === dateKey(date))) {
      const entry = document.createElement("button");
      entry.type = "button";
      entry.className = "timetable-booking timetable-booking-all-day";
      entry.textContent = booking.name || "Name unbekannt";
      entry.title = `Ganztägig – ${booking.name || "Name unbekannt"}${booking.phone ? `, ${booking.phone}` : ""}`;
      entry.addEventListener("click", () => openBookingDialog(booking));
      cell.append(entry);
    }
    weekCalendar.append(cell);
  }

  for (let hour = firstHour; hour <= lastHour; hour += 1) {
    const label = document.createElement("div");
    label.className = "timetable-hour";
    label.textContent = `${String(hour).padStart(2, "0")}:00`;
    weekCalendar.append(label);

    for (const date of days) {
      const cell = document.createElement("div");
      cell.className = "timetable-cell";
      cell.classList.toggle("today", dateKey(date) === todayKey);
      const slotBookings = timedBookings
        .filter((booking) => booking.appointmentDate === dateKey(date) && Number(booking.appointmentTime.slice(0, 2)) === hour)
        .sort((first, second) => first.appointmentTime.localeCompare(second.appointmentTime));
      for (const booking of slotBookings) {
        const entry = document.createElement("button");
        entry.type = "button";
        entry.className = "timetable-booking";
        const time = document.createElement("strong");
        time.textContent = booking.appointmentTime.slice(0, 5);
        const customer = document.createElement("span");
        customer.textContent = booking.name || "Name unbekannt";
        entry.append(time, customer);
        entry.title = `${booking.appointmentTime.slice(0, 5)} Uhr – ${booking.name || "Name unbekannt"}${booking.phone ? `, ${booking.phone}` : ""}`;
        entry.addEventListener("click", () => openBookingDialog(booking));
        cell.append(entry);
      }
      weekCalendar.append(cell);
    }
  }
}

function renderCalendar() {
  const isWeekView = calendarView === "week";
  monthCalendar.hidden = isWeekView;
  weekCalendar.hidden = !isWeekView;
  document.querySelectorAll("[data-calendar-view]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.calendarView === calendarView));
  });
  document.getElementById("previous-period").setAttribute("aria-label", isWeekView ? "Vorherige Woche" : "Vorheriger Monat");
  document.getElementById("next-period").setAttribute("aria-label", isWeekView ? "Nächste Woche" : "Nächster Monat");
  if (isWeekView) renderWeekCalendar();
  else renderMonthCalendar();
}

function renderBookings() {
  bookingList.replaceChildren();
  const pendingBookings = bookings.filter((booking) => booking.status !== "accepted");
  const acceptedBookings = bookings.filter((booking) => booking.status === "accepted");
  document.querySelectorAll("[data-booking-count]").forEach((count) => {
    count.textContent = String(count.dataset.bookingCount === "accepted" ? acceptedBookings.length : pendingBookings.length);
  });
  document.querySelectorAll("[data-booking-folder]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.bookingFolder === activeBookingFolder));
  });

  const folderBookings = activeBookingFolder === "accepted" ? acceptedBookings : pendingBookings;
  if (folderBookings.length === 0) {
    bookingList.textContent = activeBookingFolder === "accepted"
      ? "Noch keine akzeptierten Terminbuchungen."
      : "Keine neuen Terminbuchungen vorhanden.";
    return;
  }

  const sortedBookings = [...folderBookings].sort((first, second) => {
    const firstDateTime = `${first.appointmentDate}T${first.appointmentTime}`;
    const secondDateTime = `${second.appointmentDate}T${second.appointmentTime}`;
    return firstDateTime.localeCompare(secondDateTime);
  });

  for (const booking of sortedBookings) {
    const entry = document.createElement("article");
    entry.className = "admin-booking";

    const header = document.createElement("div");
    header.className = "admin-booking-header";
    const appointment = document.createElement("h2");
    const dateLabel = booking.appointmentDate
      ? new Intl.DateTimeFormat("de-DE").format(new Date(`${booking.appointmentDate}T12:00:00`))
      : "Datum fehlt";
    appointment.textContent = `${dateLabel} · ${booking.appointmentTime || "Uhrzeit fehlt"}`;

    const actions = document.createElement("div");
    actions.className = "admin-booking-actions";
    if (booking.status !== "accepted") {
      const accept = document.createElement("button");
      accept.type = "button";
      accept.className = "booking-action booking-action-accept";
      accept.textContent = "✓";
      accept.title = "Terminbuchung akzeptieren";
      accept.setAttribute("aria-label", "Terminbuchung akzeptieren");
      accept.addEventListener("click", () => updateBookingStatus(booking.id, "accepted"));
      actions.append(accept);
    } else {
      const accepted = document.createElement("span");
      accepted.className = "booking-status-accepted";
      accepted.textContent = "✓ Akzeptiert";
      actions.append(accepted);
    }

    const decline = document.createElement("button");
    decline.type = "button";
    decline.className = "booking-action booking-action-delete";
    decline.textContent = "×";
    decline.title = "Ablehnen und löschen";
    decline.setAttribute("aria-label", "Terminbuchung ablehnen und löschen");
    decline.addEventListener("click", () => openDeleteDialog(booking));
    actions.append(decline);
    header.append(appointment, actions);

    entry.append(header, createBookingDetails(booking));
    bookingList.append(entry);
  }
}

async function updateBookingStatus(bookingId, status) {
  bookingError.textContent = "";
  try {
    const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) throw new Error("Status konnte nicht gespeichert werden.");
    await loadBookings();
  } catch (error) {
    bookingError.textContent = error.message;
  }
}

function openDeleteDialog(booking) {
  bookingToDelete = booking;
  deleteConfirmation.value = "";
  deleteBookingError.textContent = "";
  deleteBookingSubmit.disabled = true;
  deleteBookingDialog.showModal();
  deleteConfirmation.focus();
}

async function loadBookings() {
  const response = await fetch("/api/bookings", { cache: "no-store" });
  if (!response.ok) throw new Error("Buchungen konnten nicht geladen werden.");
  bookings = await response.json();
  renderBookings();
  renderCalendar();
}

document.querySelectorAll("[data-admin-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    const showCalendar = tab.dataset.adminTab === "calendar";
    document.querySelectorAll("[data-admin-tab]").forEach((item) => {
      item.setAttribute("aria-selected", String(item === tab));
    });
    calendarPanel.hidden = !showCalendar;
    bookingsPanel.hidden = showCalendar;
  });
});

document.querySelectorAll("[data-calendar-view]").forEach((button) => {
  button.addEventListener("click", () => {
    calendarView = button.dataset.calendarView;
    renderCalendar();
  });
});

document.getElementById("previous-period").addEventListener("click", () => {
  visibleDate = calendarView === "week"
    ? new Date(visibleDate.getFullYear(), visibleDate.getMonth(), visibleDate.getDate() - 7)
    : new Date(visibleDate.getFullYear(), visibleDate.getMonth() - 1, 1);
  renderCalendar();
});
document.getElementById("next-period").addEventListener("click", () => {
  visibleDate = calendarView === "week"
    ? new Date(visibleDate.getFullYear(), visibleDate.getMonth(), visibleDate.getDate() + 7)
    : new Date(visibleDate.getFullYear(), visibleDate.getMonth() + 1, 1);
  renderCalendar();
});

document.getElementById("booking-dialog-close").addEventListener("click", () => bookingDialog.close());
bookingDialog.addEventListener("click", (event) => {
  if (event.target === bookingDialog) bookingDialog.close();
});

document.querySelectorAll("[data-booking-folder]").forEach((button) => {
  button.addEventListener("click", () => {
    activeBookingFolder = button.dataset.bookingFolder;
    renderBookings();
  });
});

deleteConfirmation.addEventListener("input", () => {
  deleteBookingSubmit.disabled = deleteConfirmation.value !== "loeschen";
});
document.getElementById("delete-booking-cancel").addEventListener("click", () => deleteBookingDialog.close());
deleteBookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!bookingToDelete || deleteConfirmation.value !== "loeschen") return;
  deleteBookingSubmit.disabled = true;
  deleteBookingError.textContent = "";
  try {
    const response = await fetch(`/api/bookings/${encodeURIComponent(bookingToDelete.id)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: deleteConfirmation.value }),
    });
    if (!response.ok) throw new Error("Terminbuchung konnte nicht gelöscht werden.");
    deleteBookingDialog.close();
    bookingToDelete = null;
    await loadBookings();
  } catch (error) {
    deleteBookingError.textContent = error.message;
    deleteBookingSubmit.disabled = false;
  }
});

document.getElementById("refresh-bookings").addEventListener("click", async () => {
  calendarError.textContent = "";
  bookingError.textContent = "";
  try {
    await loadBookings();
  } catch (error) {
    calendarError.textContent = error.message;
    bookingError.textContent = error.message;
  }
});

renderCalendar();
loadBookings().catch((error) => {
  calendarError.textContent = error.message;
  bookingError.textContent = error.message;
});
