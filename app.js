const STORAGE_KEY = "tradingEventHandler.events";
const THEME_KEY = "tradingEventHandler.theme";
const LISTS = window.TRADING_EVENT_LISTS || {};
const TRADING_TYPES = LISTS.tradingTypes || ["Spot", "Future", "Convert", "State", "Earn", "Tradfi", "Watch"];
const EVENT_CATEGORIES = LISTS.eventCategories || ["Competition", "Campaign", "Airdrop", "Reward", "Launchpad", "Promotion", "Other"];
const CHECKING_TYPES = LISTS.checkingTypes || ["Daily", "Weekly", "Monthly", "Manual", "Custom"];

let events = [];
let eventModal;
let toast;

const selectors = {
  tableBody: document.getElementById("eventsTableBody"),
  emptyState: document.getElementById("emptyState"),
  addEventBtn: document.getElementById("addEventBtn"),
  eventForm: document.getElementById("eventForm"),
  eventModalTitle: document.getElementById("eventModalTitle"),
  eventId: document.getElementById("eventId"),
  eventName: document.getElementById("eventName"),
  eventUrl: document.getElementById("eventUrl"),
  startDateTime: document.getElementById("startDateTime"),
  expireDateTime: document.getElementById("expireDateTime"),
  statusInput: document.getElementById("statusInput"),
  eventCategory: document.getElementById("eventCategory"),
  checkingType: document.getElementById("checkingType"),
  checkedInDays: document.getElementById("checkedInDays"),
  description: document.getElementById("description"),
  requirementsList: document.getElementById("requirementsList"),
  addRequirementBtn: document.getElementById("addRequirementBtn"),
  formTotalVolume: document.getElementById("formTotalVolume"),
  searchInput: document.getElementById("searchInput"),
  statusFilter: document.getElementById("statusFilter"),
  typeFilter: document.getElementById("typeFilter"),
  checkingFilter: document.getElementById("checkingFilter"),
  categoryFilter: document.getElementById("categoryFilter"),
  clearFiltersBtn: document.getElementById("clearFiltersBtn"),
  importFile: document.getElementById("importFile"),
  importBtn: document.getElementById("importBtn"),
  exportBtn: document.getElementById("exportBtn"),
  deleteAllBtn: document.getElementById("deleteAllBtn"),
  themeToggle: document.getElementById("themeToggle"),
  toastMessage: document.getElementById("toastMessage"),
  statTotal: document.getElementById("statTotal"),
  statActive: document.getElementById("statActive"),
  statUpcoming: document.getElementById("statUpcoming"),
  statExpired: document.getElementById("statExpired"),
  statVolume: document.getElementById("statVolume")
};

document.addEventListener("DOMContentLoaded", () => {
  eventModal = new bootstrap.Modal(document.getElementById("eventModal"));
  toast = new bootstrap.Toast(document.getElementById("appToast"), { delay: 2600 });

  applyStoredTheme();
  populateStaticDropdowns();
  loadFromLocalStorage();
  bindEvents();
  render();
  setInterval(handleTick, 1000);
});

function bindEvents() {
  // Keep DOM event wiring in one place so rendering stays predictable.
  selectors.addEventBtn.addEventListener("click", () => openEventModal());
  selectors.eventForm.addEventListener("submit", saveEventFromForm);
  selectors.addRequirementBtn.addEventListener("click", () => addRequirementRow());
  selectors.requirementsList.addEventListener("input", updateFormTotal);
  selectors.requirementsList.addEventListener("click", handleRequirementClick);
  selectors.tableBody.addEventListener("click", handleTableActions);
  selectors.themeToggle.addEventListener("click", toggleTheme);
  selectors.importBtn.addEventListener("click", () => selectors.importFile.click());
  selectors.importFile.addEventListener("change", importData);
  selectors.exportBtn.addEventListener("click", exportData);
  selectors.deleteAllBtn.addEventListener("click", clearAllData);
  selectors.clearFiltersBtn.addEventListener("click", clearFilters);

  [
    selectors.searchInput,
    selectors.statusFilter,
    selectors.typeFilter,
    selectors.checkingFilter,
    selectors.categoryFilter
  ].forEach((control) => control.addEventListener("input", render));
}

function populateStaticDropdowns() {
  selectors.checkingType.innerHTML = buildOptions(CHECKING_TYPES, CHECKING_TYPES[0]);
  selectors.eventCategory.innerHTML = buildOptions(EVENT_CATEGORIES, EVENT_CATEGORIES[0]);
  refreshListFilter(selectors.checkingFilter, "All Checking", CHECKING_TYPES);
  refreshListFilter(selectors.categoryFilter, "All Categories", EVENT_CATEGORIES);
}

function loadFromLocalStorage() {
  try {
    const savedEvents = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    events = savedEvents.map((event) => {
      const normalizedEvent = normalizeImportedEvent(event);
      normalizedEvent.status = calculateStatus(normalizedEvent);
      return normalizedEvent;
    });
    persistEvents();
  } catch {
    events = [];
    showToast("Saved data could not be read. Starting with an empty list.");
  }
}

function persistEvents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function openEventModal(eventId = null) {
  selectors.eventForm.reset();
  selectors.requirementsList.innerHTML = "";
  selectors.eventId.value = "";
  selectors.checkedInDays.value = 0;
  selectors.statusInput.value = "Upcoming";
  selectors.eventCategory.value = EVENT_CATEGORIES[0] || "";
  selectors.checkingType.value = CHECKING_TYPES[0] || "";

  if (eventId) {
    const event = events.find((item) => item.id === eventId);
    if (!event) return;

    selectors.eventModalTitle.textContent = "Edit Trading Event";
    selectors.eventId.value = event.id;
    selectors.eventName.value = event.name;
    selectors.eventUrl.value = event.url || "";
    selectors.startDateTime.value = toDateTimeLocalValue(event.startAt || event.createdAt || new Date().toISOString());
    selectors.expireDateTime.value = toDateTimeLocalValue(event.expireAt);
    selectors.statusInput.value = event.status;
    ensureSelectOption(selectors.eventCategory, event.category || EVENT_CATEGORIES[0]);
    selectors.eventCategory.value = event.category || EVENT_CATEGORIES[0] || "";
    ensureSelectOption(selectors.checkingType, event.checkingType);
    selectors.checkingType.value = event.checkingType;
    selectors.checkedInDays.value = event.checkedInDays || 0;
    selectors.description.value = event.description || "";
    event.requirements.forEach(addRequirementRow);
  } else {
    selectors.eventModalTitle.textContent = "Create Trading Event";
    selectors.startDateTime.value = defaultStartValue();
    selectors.expireDateTime.value = defaultExpireValue();
    addRequirementRow({ type: "Spot", volume: "" });
  }

  updateFormTotal();
  eventModal.show();
}

function addRequirementRow(requirement = { type: "", volume: "" }) {
  const selectedType = requirement.type || TRADING_TYPES[0];
  const typeOptions = buildTradingTypeOptions(selectedType);
  const row = document.createElement("div");
  row.className = "requirement-row";
  row.innerHTML = `
    <div>
      <label class="form-label">Trading Type</label>
      <select class="form-select requirement-type" required>
        ${typeOptions}
      </select>
    </div>
    <div>
      <label class="form-label">Required Volume (USDT)</label>
      <input class="form-control requirement-volume" type="number" min="0" step="0.01" value="${Number(requirement.volume) || ""}" placeholder="10000" required>
    </div>
    <button class="btn btn-outline-danger remove-requirement" type="button" title="Remove trading type">
      <i class="bi bi-trash3"></i>
    </button>
  `;
  selectors.requirementsList.appendChild(row);
  updateFormTotal();
}

function buildTradingTypeOptions(selectedType) {
  const options = TRADING_TYPES.includes(selectedType)
    ? TRADING_TYPES
    : [selectedType, ...TRADING_TYPES];

  return options.map((type) => `
    <option value="${escapeAttribute(type)}" ${type === selectedType ? "selected" : ""}>${escapeHtml(type)}</option>
  `).join("");
}

function buildOptions(options, selectedValue) {
  return options.map((option) => `
    <option value="${escapeAttribute(option)}" ${option === selectedValue ? "selected" : ""}>${escapeHtml(option)}</option>
  `).join("");
}

function ensureSelectOption(select, value) {
  if (!value || [...select.options].some((option) => option.value === value)) return;
  select.insertAdjacentHTML("afterbegin", `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`);
}

function handleRequirementClick(event) {
  const removeButton = event.target.closest(".remove-requirement");
  if (!removeButton) return;

  if (selectors.requirementsList.children.length === 1) {
    showToast("Each event needs at least one trading type.");
    return;
  }

  removeButton.closest(".requirement-row").remove();
  updateFormTotal();
}

function saveEventFromForm(event) {
  event.preventDefault();

  const requirements = getRequirementsFromForm();
  if (!requirements.length) {
    showToast("Add at least one trading type.");
    return;
  }

  if (new Date(selectors.startDateTime.value) >= new Date(selectors.expireDateTime.value)) {
    showToast("Expire date must be after the start date.");
    return;
  }

  const id = selectors.eventId.value || crypto.randomUUID();
  const existing = events.find((item) => item.id === id);
  const savedEvent = {
    id,
    name: selectors.eventName.value.trim(),
    url: selectors.eventUrl.value.trim(),
    startAt: new Date(selectors.startDateTime.value).toISOString(),
    expireAt: new Date(selectors.expireDateTime.value).toISOString(),
    status: selectors.statusInput.value,
    category: selectors.eventCategory.value,
    checkingType: selectors.checkingType.value,
    checkedInDays: Number(selectors.checkedInDays.value) || 0,
    description: selectors.description.value.trim(),
    requirements,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Expired and completed states are authoritative, even when edited manually.
  savedEvent.status = calculateStatus(savedEvent);

  if (existing) {
    events = events.map((item) => (item.id === id ? savedEvent : item));
    showToast("Event updated.");
  } else {
    events.unshift(savedEvent);
    showToast("Event created.");
  }

  persistEvents();
  render();
  eventModal.hide();
}

function getRequirementsFromForm() {
  return [...selectors.requirementsList.querySelectorAll(".requirement-row")]
    .map((row) => ({
      type: row.querySelector(".requirement-type").value.trim(),
      volume: Number(row.querySelector(".requirement-volume").value) || 0
    }))
    .filter((requirement) => requirement.type && requirement.volume >= 0);
}

function handleTableActions(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  if (button.dataset.action === "edit") openEventModal(id);
  if (button.dataset.action === "delete") deleteEvent(id);
  if (button.dataset.action === "complete") markCompleted(id);
}

function deleteEvent(id) {
  const event = events.find((item) => item.id === id);
  if (!event || !confirm(`Delete "${event.name}"?`)) return;

  events = events.filter((item) => item.id !== id);
  persistEvents();
  render();
  showToast("Event deleted.");
}

function markCompleted(id) {
  events = events.map((event) => (
    event.id === id ? { ...event, status: "Completed", updatedAt: new Date().toISOString() } : event
  ));
  persistEvents();
  render();
  showToast("Event marked completed.");
}

function handleTick() {
  // Refresh countdowns every second and persist automatic expiration changes.
  let changed = false;
  events = events.map((event) => {
    const status = calculateStatus(event);
    if (status !== event.status) changed = true;
    return { ...event, status };
  });

  if (changed) persistEvents();
  renderTable();
  updateStats();
}

function render() {
  refreshTradingTypeFilter();
  renderTable();
  updateStats();
}

function renderTable() {
  const visibleEvents = getFilteredAndSortedEvents();
  selectors.tableBody.innerHTML = visibleEvents.map(renderEventRow).join("");
  selectors.emptyState.classList.toggle("d-none", visibleEvents.length > 0);
}

function renderEventRow(event) {
  const requirementsHtml = event.requirements.map((requirement) => `
    <span class="requirement-chip">
      ${escapeHtml(requirement.type)}
      <strong>${formatNumber(requirement.volume)}</strong>
    </span>
  `).join("");

  return `
    <tr>
      <td>
        <div class="event-title">${escapeHtml(event.name)}</div>
        <span class="badge text-bg-info mt-1">${escapeHtml(event.category || "Other")}</span>
        ${event.url ? `<a class="event-link" href="${escapeAttribute(event.url)}" target="_blank" rel="noopener noreferrer"><i class="bi bi-box-arrow-up-right"></i>Reference</a>` : ""}
        ${event.description ? `<div class="notes mt-1">${escapeHtml(event.description)}</div>` : ""}
      </td>
      <td><span class="badge status-badge ${statusClass(event.status)}">${event.status}</span></td>
      <td>
        <div>${formatDateTime(event.expireAt)}</div>
        <small class="text-body-secondary">Starts ${formatDateTime(event.startAt || event.createdAt || event.expireAt)}</small>
      </td>
      <td><span class="countdown">${formatRemaining(event.expireAt)}</span></td>
      <td>
        <div>${escapeHtml(event.checkingType)}</div>
        <small class="text-body-secondary">${event.checkedInDays || 0} checked-in days</small>
      </td>
      <td class="requirements">
        ${requirementsHtml}
        <span class="total-volume">Total: ${formatNumber(getEventTotal(event))} USDT</span>
      </td>
      <td class="text-end">
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-success" data-action="complete" data-id="${event.id}" title="Mark completed">
            <i class="bi bi-check2-circle"></i>
          </button>
          <button class="btn btn-outline-primary" data-action="edit" data-id="${event.id}" title="Edit event">
            <i class="bi bi-pencil-square"></i>
          </button>
          <button class="btn btn-outline-danger" data-action="delete" data-id="${event.id}" title="Delete event">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
}

function getFilteredAndSortedEvents() {
  // Filters are intentionally combined with AND logic for precise list narrowing.
  const search = selectors.searchInput.value.trim().toLowerCase();
  const status = selectors.statusFilter.value;
  const type = selectors.typeFilter.value;
  const checkingType = selectors.checkingFilter.value;
  const category = selectors.categoryFilter.value;

  const filtered = events.filter((event) => {
    const matchesSearch = event.name.toLowerCase().includes(search);
    const matchesStatus = !status || event.status === status;
    const matchesType = !type || event.requirements.some((req) => req.type === type);
    const matchesChecking = !checkingType || event.checkingType === checkingType;
    const matchesCategory = !category || event.category === category;
    return matchesSearch && matchesStatus && matchesType && matchesChecking && matchesCategory;
  });

  return filtered.sort((a, b) => {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function refreshTradingTypeFilter() {
  const currentValue = selectors.typeFilter.value;
  const savedTypes = events.flatMap((event) => event.requirements.map((req) => req.type));
  const types = [...new Set([...TRADING_TYPES, ...savedTypes])].sort();
  refreshListFilter(selectors.typeFilter, "All Types", types, currentValue);
  refreshListFilter(selectors.checkingFilter, "All Checking", [...new Set([...CHECKING_TYPES, ...events.map((event) => event.checkingType)])].sort(), selectors.checkingFilter.value);
  refreshListFilter(selectors.categoryFilter, "All Categories", [...new Set([...EVENT_CATEGORIES, ...events.map((event) => event.category || "Other")])].sort(), selectors.categoryFilter.value);
}

function refreshListFilter(select, label, values, selectedValue = select.value) {
  const cleanValues = values.filter(Boolean);
  select.innerHTML = `<option value="">${label}</option>${cleanValues.map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`).join("")}`;
  select.value = cleanValues.includes(selectedValue) ? selectedValue : "";
}

function updateStats() {
  selectors.statTotal.textContent = events.length;
  selectors.statActive.textContent = events.filter((event) => event.status === "Active").length;
  selectors.statUpcoming.textContent = events.filter((event) => event.status === "Upcoming").length;
  selectors.statExpired.textContent = events.filter((event) => event.status === "Expired").length;
  selectors.statVolume.textContent = `${formatNumber(events.reduce((sum, event) => sum + getEventTotal(event), 0))} USDT`;
}

function calculateStatus(event) {
  if (event.status === "Completed") return "Completed";
  const now = Date.now();
  const startTime = new Date(event.startAt || event.createdAt || now).getTime();
  const expireTime = new Date(event.expireAt).getTime();
  if (Number.isNaN(expireTime) || expireTime <= now) return "Expired";
  if (!Number.isNaN(startTime) && startTime > now) return "Upcoming";
  return "Active";
}

function getEventTotal(event) {
  return event.requirements.reduce((sum, requirement) => sum + Number(requirement.volume || 0), 0);
}

function updateFormTotal() {
  const total = getRequirementsFromForm().reduce((sum, requirement) => sum + requirement.volume, 0);
  selectors.formTotalVolume.textContent = `Total: ${formatNumber(total)} USDT`;
}

function importData() {
  const file = selectors.importFile.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const importedEvents = Array.isArray(parsed) ? parsed : parsed.events;
      if (!Array.isArray(importedEvents)) throw new Error("Invalid event file.");

      events = importedEvents.map(normalizeImportedEvent);
      persistEvents();
      render();
      showToast("Imported event data.");
    } catch (error) {
      showToast(error.message || "Could not import that file.");
    } finally {
      selectors.importFile.value = "";
    }
  };
  reader.readAsText(file);
}

function normalizeImportedEvent(event) {
  return {
    id: event.id || crypto.randomUUID(),
    name: String(event.name || event.eventName || "Untitled Event"),
    url: String(event.url || event.eventUrl || ""),
    startAt: new Date(event.startAt || event.startDateTime || event.createdAt || Date.now()).toISOString(),
    expireAt: new Date(event.expireAt || event.expireDateTime || Date.now()).toISOString(),
    status: ["Upcoming", "Active", "Completed", "Expired"].includes(event.status) ? event.status : "Upcoming",
    category: String(event.category || event.eventCategory || "Other"),
    checkingType: String(event.checkingType || "Manual"),
    checkedInDays: Number(event.checkedInDays) || 0,
    description: String(event.description || event.notes || ""),
    requirements: Array.isArray(event.requirements) && event.requirements.length
      ? event.requirements.map((req) => ({ type: String(req.type || req.tradingType || "Trading"), volume: Number(req.volume || req.requiredVolume) || 0 }))
      : [{ type: "Spot", volume: 0 }],
    createdAt: event.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function exportData() {
  // Browser security requires an explicit download action for file-based saving.
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), events }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `trading-events-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Exported JSON file.");
}

function clearAllData() {
  if (!events.length) return;
  if (!confirm("Clear all saved trading events?")) return;

  events = [];
  persistEvents();
  render();
  showToast("All event data cleared.");
}

function clearFilters() {
  selectors.searchInput.value = "";
  selectors.statusFilter.value = "";
  selectors.typeFilter.value = "";
  selectors.checkingFilter.value = "";
  selectors.categoryFilter.value = "";
  render();
}

function toggleTheme() {
  const html = document.documentElement;
  const nextTheme = html.dataset.bsTheme === "dark" ? "light" : "dark";
  html.dataset.bsTheme = nextTheme;
  localStorage.setItem(THEME_KEY, nextTheme);
  selectors.themeToggle.innerHTML = nextTheme === "dark" ? `<i class="bi bi-sun"></i>` : `<i class="bi bi-moon-stars"></i>`;
}

function applyStoredTheme() {
  const storedTheme = localStorage.getItem(THEME_KEY) || "light";
  document.documentElement.dataset.bsTheme = storedTheme;
  selectors.themeToggle.innerHTML = storedTheme === "dark" ? `<i class="bi bi-sun"></i>` : `<i class="bi bi-moon-stars"></i>`;
}

function formatRemaining(expireAt) {
  const diff = new Date(expireAt).getTime() - Date.now();
  if (diff <= 0 || Number.isNaN(diff)) return "Expired";

  const seconds = Math.floor(diff / 1000) % 60;
  const minutes = Math.floor(diff / (1000 * 60)) % 60;
  const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return `${days} Days ${pad(hours)} Hours ${pad(minutes)} Minutes ${pad(seconds)} Seconds`;
}

function statusClass(status) {
  return {
    Upcoming: "text-bg-primary",
    Active: "text-bg-success",
    Completed: "text-bg-secondary",
    Expired: "text-bg-danger"
  }[status] || "text-bg-secondary";
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatNumber(value) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
}

function defaultExpireValue() {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return toDateTimeLocalValue(date.toISOString());
}

function defaultStartValue() {
  return toDateTimeLocalValue(new Date().toISOString());
}

function toDateTimeLocalValue(value) {
  const date = new Date(value);
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function showToast(message) {
  selectors.toastMessage.textContent = message;
  toast.show();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
