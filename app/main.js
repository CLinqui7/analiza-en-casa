import { loadRuntimeConfig, saveRuntimeConfigOverride } from "./config.js";
import { createAppStore } from "./store.js";
import {
  renderRoute,
  renderNavigation,
  renderLogin,
  renderTopbar,
  renderUserMenu,
  renderNotificationPanel
} from "./views.js";
import {
  quoteDocument,
  healthReportDocument,
  medicalOrderDocument,
  medicationCardDocument,
  carePlanDocument,
  doctorStatementDocument,
  purchaseDocument,
  inventoryAcknowledgementDocument,
  openPrintWindow
} from "./templates.js";
import {
  money,
  calculateQuote,
  quoteBalance,
  QUOTE_STATUS_FLOW,
  QUOTE_STATUS_LABELS,
  ITEM_CATEGORY_LABELS,
  toCsv,
  safeText,
  uid,
  roleCan
} from "./domain.js";

const QUOTE_ADMIN_LABELS_MAIN = Object.fromEntries(Object.entries(QUOTE_STATUS_LABELS).map(([key, value]) => [key, value.admin]));
const STANDALONE_DEMO_OTP = "202626";
const PROFESSIONAL_ADDITION_REASONS = ["Tiempo extra", "Excelencia", "Mal agendado", "Paciente especial", "Transporte"];
const PROFESSIONAL_DISCOUNT_REASONS = ["Retraso", "Mal agendado", "No asistió", "Cambio del turno", "Planilla", "Paciente Hospitalizado", "Paciente Falleció", "NO CIERRE DE VISITA A TIEMPO", "Transporte", "Cumplimiento incorrecto"];

const config = await loadRuntimeConfig();
const store = await createAppStore(config);

const ui = {
  search: "",
  tab: "overview",
  sidebarOpen: false,
  patientTab: "active",
  patientPage: 1,
  patientPageSize: 10,
  patientSortKey: "fullName",
  patientSortDirection: "asc",
  patientImport: null,
  casePage: 1,
  caseQuotePage: 1,
  casePageSize: 10,
  caseStatus: "ACTIVE",
  caseStartDate: "",
  caseAccountType: "",
  caseQuoteStatus: "",
  caseQuoteDate: "",
  receivablesTab: "accounts",
  receivablesSearch: "",
  receivablesPage: 1,
  receivablesPageSize: 10,
  receivablesSortKey: "startDate",
  receivablesSortDirection: "desc",
  clinicalCaseSearch: "",
  clinicalStatus: "",
  clinicalServiceType: "",
  clinicalAttentionType: "",
  clinicalPage: 1,
  clinicalPageSize: 10,
  healthReportSearch: "",
  healthReportPage: 1,
  healthReportPageSize: 10,
  healthReportTab: "main",
  healthReportRange: null,
  healthReportConfig: null,
  medicalOrderTab: "active",
  medicalOrderSearch: "",
  medicalOrderPage: 1,
  medicalOrderPageSize: 10,
  medicationDraft: null,
  agendaView: "month",
  agendaDate: "2026-08-01",
  agendaPatientId: "",
  agendaPatientQuery: "",
  agendaResourceId: "",
  payablesTab: "summary",
  payablesFilterOpen: false,
  payablesDateFrom: "",
  payablesDateTo: "",
  payablesResourceId: "",
  payablesStatus: "",
  payablesSearch: "",
  payablesPage: 1,
  payablesPageSize: 10,
  professionalPaymentServiceId: "",
  professionalConceptType: "ADDITION",
  professionalConceptReason: "",
  purchaseSearch: "",
  purchasePage: 1,
  purchasePageSize: 10,
  purchaseDraft: null,
  statementTab: "quotes",
  statementContext: null,
  pwaInstallAvailable: false,
  userMenuOpen: false,
  notificationsOpen: false,
  commandOpen: false,
  quoteDraft: null,
  portalSnapshot: null,
  portalMessage: "",
  currentRoute: ""
};

const app = document.querySelector("#app");
const modalRoot = document.querySelector("#modal-root");
const toastRoot = document.querySelector("#toast-root");
const overlayRoot = document.querySelector("#overlay-root");
let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  ui.pwaInstallAvailable = true;
  render();
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  ui.pwaInstallAvailable = false;
  render();
});

if ("serviceWorker" in navigator && ["http:", "https:"].includes(location.protocol)) {
  navigator.serviceWorker.register("/service-worker.js").catch(() => {
    // La app sigue disponible online; la acción de instalación no se muestra sin prompt nativo.
  });
}

function routeFromHash() {
  return (location.hash.replace(/^#\/?/, "") || "dashboard").replace(/\/+$/, "");
}

function isPortalRoute(route) {
  return route.startsWith("portal/");
}

function render() {
  const state = store.getState();
  const route = routeFromHash();
  const routeChanged = ui.currentRoute !== route;
  if (routeChanged) {
    ui.search = "";
    ui.tab = "overview";
    ui.currentRoute = route;
    if (!isPortalRoute(route)) {
      ui.portalSnapshot = null;
      ui.portalMessage = "";
    }
  }

  document.body.classList.toggle("portal-mode", isPortalRoute(route));
  document.body.classList.toggle("authenticated", Boolean(state.session.authenticated));

  if (isPortalRoute(route)) {
    app.innerHTML = renderRoute(route, state, store, ui);
    closeOverlays();
    return;
  }

  if (!state.session.authenticated) {
    app.innerHTML = renderLogin(state, store.config, ui);
    closeOverlays();
    return;
  }

  const role = state.session.role;
  const routeContent = route === "cotizaciones/nueva"
    ? renderQuoteModal({ asPage: true })
    : renderRoute(route, state, store, ui);
  app.innerHTML = `
    <div class="app-shell ${ui.sidebarOpen ? "sidebar-open" : "sidebar-collapsed"}">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <a href="#/dashboard"><span class="brand-mark">AC</span><div><strong>Analiza en Casa</strong><small>Atención domiciliar</small></div></a>
          <button class="icon-button mobile-only" data-action="toggle-sidebar">×</button>
        </div>
        <nav class="sidebar-nav">${renderNavigation(role, route)}</nav>
        <div class="sidebar-footer">
          <div class="environment-pill"><span></span>${store.config.dataMode === "supabase" ? "Supabase" : "Demo local"}</div>
          <small>Datos sintéticos · QA 2026.08</small>
        </div>
      </aside>
      <div class="main-shell">
        <header class="topbar">${renderTopbar(state, store, route, ui)}</header>
        <main class="content" id="content">${routeContent}</main>
      </div>
    </div>`;
  renderOverlays();
  applyActionPermissions(state);
}

const ACTION_PERMISSIONS = {
  "open-patient-form": "patients:write",
  "edit-patient": "patients:write",
  "save-patient": "patients:write",
  "import-patients": "patients:write",
  "confirm-patient-import": "patients:write",
  "patient-insurance-change": "patients:write",
  "patient-holder-change": "patients:write",
  "clear-patient-location": "patients:write",
  "open-case-form": "cases:write",
  "edit-case": "cases:write",
  "save-case": "cases:write",
  "open-quote-form": "quotes:write",
  "edit-quote-draft": "quotes:write",
  "revise-quote": "quotes:write",
  "send-quote": "quotes:write",
  "open-insurance-status": "insurance:write",
  "open-payment-form": "payments:write",
  "open-reverse-payment": "payments:write",
  "save-reverse-payment": "payments:write",
  "open-administrative-execution": "cases:write",
  "save-administrative-execution": "cases:write",
  "open-clinical-profile-form": "clinical:write",
  "save-clinical-profile": "clinical:write",
  "send-quote": "quotes:write",
  "send-quote-whatsapp": "quotes:write",
  "quote-add-item": "quotes:write",
  "quote-remove-item": "quotes:write",
  "quote-patient-change": "quotes:write",
  "quote-referral-add": "quotes:write",
  "open-quote-referral": "quotes:write",
  "save-quote-referral": "quotes:write",
  "open-quote-date-picker": "quotes:write",
  "save-quote-date": "quotes:write",
  "quote-remove-referral": "quotes:write",
  "quote-set-category": "quotes:write",
  "quote-item-select": "quotes:write",
  "quote-item-filter": "quotes:write",
  "clear-quote-giftcard": "quotes:write",
  "quote-calc-change": "quotes:write",
  "save-quote": "quotes:write",
  "open-clinical-document": "clinical:write",
  "sign-document": "clinical:sign",
  "open-clinical-correction": "clinical:write",
  "open-clinical-void": "clinical:write",
  "open-vitals-form": "clinical:write",
  "open-nursing-note": "clinical:write",
  "share-note": "clinical:write",
  "open-shift-form": "agenda:write",
  "open-visit-detail": "agenda:read",
  "save-shift-assignment": "agenda:write",
  "open-medication-card": "clinical:write",
  "sign-medication-card": "clinical:sign",
  "administer-medication": "clinical:write",
  "open-purchase-form": "purchases:write",
  "choose-purchase-kind": "purchases:write",
  "add-purchase-item": "purchases:write",
  "remove-purchase-item": "purchases:write",
  "save-purchase": "purchases:write",
  "export-purchases": "purchases:read",
  "export-purchase": "purchases:read",
  "view-purchase": "purchases:read",
  "open-purchase-details": "purchases:read",
  "open-inventory-movement": "inventory:write",
  "open-closure-form": "inventory:write",
  "approve-closure": "inventory:write",
  "open-kit-form": "inventory:write",
  "duplicate-kit": "inventory:write",
  "apply-kit": "inventory:write",
  "open-catalog-form": "catalogs:write",
  "edit-catalog-item": "catalogs:write",
  "open-discount-form": "catalogs:write",
  "import-catalog": "catalogs:write",
  "open-doctor-form": "doctors:write",
  "save-doctor": "doctors:write",
  "open-professional-payment": "statements:read",
  "open-professional-concept": "statements:read",
  "export-payables": "statements:read",
  "blocked-payables-mutation": "statements:write",
  "generate-statements": "statements:write",
  "send-statement": "statements:write",
  "save-settings": "settings:write",
  "reset-demo": "settings:write"
};

function actionPermission(action) {
  return ACTION_PERMISSIONS[action] || null;
}

function applyActionPermissions(state) {
  document.querySelectorAll("[data-action]").forEach((control) => {
    const permission = actionPermission(control.dataset.action);
    if (permission && !roleCan(state.session.role, permission)) control.remove();
  });
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index <= text.length; index += 1) {
    const char = text[index] ?? "\n";
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field.trim()); field = ""; }
    else if (char === "\n") {
      row.push(field.trim().replace(/\r$/, "")); field = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
    } else field += char;
  }
  if (quoted) throw new Error("El CSV contiene una comilla sin cerrar.");
  if (rows.length < 2) throw new Error("El CSV requiere encabezados y al menos una fila.");
  const headers = rows[0].map((value) => value.replace(/^\uFEFF/, ""));
  const required = ["document", "firstName", "lastName"];
  const missing = required.filter((name) => !headers.includes(name));
  if (missing.length) throw new Error(`Faltan encabezados obligatorios: ${missing.join(", ")}.`);
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

function renderOverlays() {
  const state = store.getState();
  const parts = [];
  if (ui.userMenuOpen) parts.push(renderUserMenu(state, store));
  if (ui.notificationsOpen) parts.push(renderNotificationPanel(state));
  if (ui.commandOpen) parts.push(renderCommandPalette(state));
  overlayRoot.innerHTML = parts.join("");
  overlayRoot.classList.toggle("open", Boolean(parts.length));
  applyActionPermissions(state);
}

function closeOverlays() {
  ui.userMenuOpen = false;
  ui.notificationsOpen = false;
  ui.commandOpen = false;
  overlayRoot.innerHTML = "";
  overlayRoot.classList.remove("open");
}

function renderCommandPalette(state) {
  const query = document.querySelector("[data-global-search]")?.value?.trim().toLowerCase() || "";
  const results = [];
  for (const patient of state.patients) {
    if (!query || [patient.fullName, patient.document, patient.phone].some((v) => String(v).toLowerCase().includes(query))) {
      results.push({ type: "Paciente", label: patient.fullName, meta: patient.document, href: `#/pacientes/${patient.id}` });
    }
  }
  for (const record of state.cases) {
    const patient = state.patients.find((p) => p.id === record.patientId);
    if (!query || [record.id, patient?.fullName, record.status].some((v) => String(v).toLowerCase().includes(query))) {
      results.push({ type: "Hospitalización", label: record.id, meta: patient?.fullName, href: `#/hospitalizaciones/${record.id}` });
    }
  }
  for (const quote of state.quotes) {
    const patient = state.patients.find((p) => p.id === quote.patientId);
    if (!query || [quote.id, patient?.fullName, quote.status].some((v) => String(v).toLowerCase().includes(query))) {
      results.push({ type: "Cotización", label: quote.id, meta: patient?.fullName, href: `#/cotizaciones/${quote.id}` });
    }
  }
  return `<div class="command-palette">
    <header><span>⌕</span><input id="command-input" placeholder="Buscar en todo el sistema" value="${safeText(query)}" autofocus><kbd>Esc</kbd></header>
    <div class="command-results">${results.slice(0, 12).map((r) => `<a href="${r.href}"><span>${safeText(r.type)}</span><div><strong>${safeText(r.label)}</strong><small>${safeText(r.meta)}</small></div><b>↵</b></a>`).join("") || `<p>No se encontraron resultados.</p>`}</div>
  </div>`;
}

function showToast(message, tone = "success", timeout = 3800) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${tone}`;
  toast.innerHTML = `<span>${tone === "success" ? "✓" : tone === "danger" ? "!" : "i"}</span><div>${safeText(message)}</div><button aria-label="Cerrar">×</button>`;
  toast.querySelector("button").addEventListener("click", () => toast.remove());
  toastRoot.appendChild(toast);
  setTimeout(() => toast.remove(), timeout);
}

function runSafely(action, successMessage = "") {
  try {
    const result = action();
    if (result instanceof Promise) {
      return result.then((value) => {
        if (successMessage) showToast(successMessage);
        render();
        return value;
      }).catch((error) => showToast(error.message || String(error), "danger", 6000));
    }
    if (successMessage) showToast(successMessage);
    render();
    return result;
  } catch (error) {
    showToast(error.message || String(error), "danger", 6000);
    return null;
  }
}

function openModal({ title, subtitle = "", body, size = "md", footer = "", closeable = true }) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-action="close-modal"></div>
    <section class="modal modal-${size}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <header class="modal-header"><div><p class="eyebrow">Analiza en Casa</p><h2 id="modal-title">${safeText(title)}</h2>${subtitle ? `<p>${safeText(subtitle)}</p>` : ""}</div>${closeable ? `<button class="icon-button" data-action="close-modal">×</button>` : ""}</header>
      <div class="modal-body">${body}</div>
      ${footer ? `<footer class="modal-footer">${footer}</footer>` : ""}
    </section>`;
  modalRoot.classList.add("open");
  setTimeout(() => modalRoot.querySelector("input,select,textarea,button")?.focus(), 20);
}

function closeModal() {
  modalRoot.innerHTML = "";
  modalRoot.classList.remove("open");
  if (routeFromHash() !== "cotizaciones/nueva") ui.quoteDraft = null;
}

function formValue(form, name) {
  return new FormData(form).get(name);
}

function formBool(form, name) {
  return new FormData(form).has(name);
}

function patientOptions(selected = "") {
  const state = store.getState();
  return state.patients.map((p) => `<option value="${p.id}" ${p.id === selected ? "selected" : ""}>${safeText(p.fullName)} · ${safeText(p.document)}</option>`).join("");
}

function caseOptions(selected = "") {
  const state = store.getState();
  return state.cases.map((c) => `<option value="${c.id}" ${c.id === selected ? "selected" : ""}>${safeText(c.id)} · ${safeText(store.patientById(c.patientId)?.fullName)}</option>`).join("");
}

function insurerOptions(selected = "") {
  return `<option value="">Particular / sin aseguradora</option>${store.getState().insurers.map((i) => `<option value="${i.id}" ${i.id === selected ? "selected" : ""}>${safeText(i.name)}</option>`).join("")}`;
}

function planOptions(selected = "") {
  return `<option value="">Sin plan</option>${store.getState().insurancePlans.map((i) => `<option value="${i.id}" ${i.id === selected ? "selected" : ""}>${safeText(i.name)}</option>`).join("")}`;
}

function doctorOptions(selected = "") {
  return store.getState().doctors.map((d) => `<option value="${d.id}" ${d.id === selected ? "selected" : ""}>${safeText(d.name)} · ${safeText(d.specialty)}</option>`).join("");
}

function warehouseOptions(selected = "") {
  return store.getState().warehouses.map((w) => `<option value="${w.id}" ${w.id === selected ? "selected" : ""}>${safeText(w.name)}</option>`).join("");
}

function catalogOptions(selected = "", category = "") {
  return store.getState().catalogItems.filter((i) => !category || i.category === category).map((i) => `<option value="${i.id}" ${i.id === selected ? "selected" : ""}>${safeText(i.sku)} · ${safeText(i.name)} · ${money(i.price)}</option>`).join("");
}

function quotePatientLabel(patient) {
  return patient ? `${patient.document} · ${patient.fullName}` : "";
}

function quoteCategoryLabel(category) {
  return category === "STUDIES" ? "Estudios Dx" : ITEM_CATEGORY_LABELS[category] || category;
}

function quoteCatalogLabel(item) {
  if (!item) return "";
  const metadata = [item.professional, item.unit, item.manufacturer].filter(Boolean).join(" · ");
  return `${item.sku} · ${item.name}${metadata ? ` · ${metadata}` : ""}`;
}

function openPatientForm(id = null) {
  location.hash = id ? `#/pacientes/${encodeURIComponent(id)}/editar` : "#/pacientes/nuevo";
}

function openCaseForm(id = null, patientId = "") {
  const state = store.getState();
  const record = id ? state.cases.find((item) => item.id === id) : null;
  openModal({
    title: record ? `Editar ${record.id}` : "Nueva hospitalización",
    subtitle: "Caso central para conectar cotización, seguro, clínica, agenda, inventario y cierre.",
    size: "lg",
    body: `<form id="case-form" class="form-grid">
      <input type="hidden" name="id" value="${safeText(record?.id || "")}">
      <label class="full">Paciente<select name="patientId" required>${patientOptions(record?.patientId || patientId)}</select></label>
      <label>Tipo de cuenta<select name="accountType"><option value="SEGURO" ${record?.accountType==="SEGURO"?"selected":""}>Seguro</option><option value="PARTICULAR" ${record?.accountType==="PARTICULAR"?"selected":""}>Particular</option><option value="EMPRESA" ${record?.accountType==="EMPRESA"?"selected":""}>Empresa</option></select></label>
      <label>Aseguradora<select name="insurerId">${insurerOptions(record?.insurerId)}</select></label>
      <label>Responsable administrativo<input name="manager" value="${safeText(record?.manager || "Andrea Mejía")}"></label>
      <label>Fecha de inicio<input type="date" name="startDate" value="${safeText(record?.startDate || new Date().toISOString().slice(0,10))}"></label>
      <label>Prioridad<select name="priority"><option value="BAJA" ${record?.priority==="BAJA"?"selected":""}>Baja</option><option value="MEDIA" ${record?.priority==="MEDIA"?"selected":""}>Media</option><option value="ALTA" ${record?.priority==="ALTA"?"selected":""}>Alta</option></select></label>
      <label>Médico contratante<select name="contractingDoctorId">${doctorOptions(record?.contractingDoctorId)}</select></label>
      <label class="full">Resumen diagnóstico<textarea name="diagnosisSummary" rows="3">${safeText(record?.diagnosisSummary || "")}</textarea></label>
      <label class="full">Próxima acción<textarea name="nextAction" rows="2">${safeText(record?.nextAction || "Crear cotización y validar datos administrativos.")}</textarea></label>
      <label class="full">Dispositivos / accesos<input name="devices" value="${safeText(record?.devices?.join(", ") || "")}" placeholder="Catéter, bomba, oxígeno..."></label>
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-case">Guardar hospitalización</button>`
  });
}

function openQuoteForm(caseId = "", quoteId = null, revise = false, editDraft = false) {
  const state = store.getState();
  const existing = quoteId ? state.quotes.find((q) => q.id === quoteId) : null;
  const selectedCase = state.cases.find((c) => c.id === (caseId || existing?.caseId)) || state.cases[0];
  ui.quoteDraft = {
    quoteId: existing?.id || null,
    revise,
    editDraft: Boolean(existing && editDraft),
    caseId: selectedCase?.id || "",
    patientId: selectedCase?.patientId || "",
    category: "SERVICES",
    items: existing ? structuredClone(existing.items) : [],
    discount: existing ? structuredClone(existing.discount) : { type: "PERCENT", value: 0, reason: "" },
    invoiceDate: existing?.invoiceDate || new Date().toISOString().slice(0, 10),
    discountGroupId: existing?.discountGroupId || "REGULAR",
    referredBy: existing?.referredBy || "",
    giftcard: existing?.giftcard || "",
    insurerAmount: existing?.insurerAmount || 0,
    comments: existing?.comments || ""
  };
  if (!quoteId) {
    if (routeFromHash() === "cotizaciones/nueva") render();
    else location.hash = "#/cotizaciones/nueva";
    return;
  }
  renderQuoteModal();
}

function openQuoteReferralForm() {
  syncQuoteHead();
  openModal({
    title: "Agregar referencia",
    subtitle: "Alta provisional para esta cotización; el catálogo maestro y sus tipos dependen de CH03-Q007/CH04-Q005/CH04-Q006.",
    body: `<form id="quote-referral-form" class="form-grid"><label class="full">Nombre o etiqueta sintética<input name="label" required autocomplete="off" placeholder="Referencia sintética"></label><p class="full form-help">No ingrese datos clínicos ni información real. Esta entrada no crea un maestro productivo.</p></form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-quote-referral">Agregar</button>`
  });
}

function openQuoteDatePicker() {
  syncQuoteHead();
  openModal({
    title: "Seleccionar fecha",
    subtitle: "La zona horaria y los rangos permitidos permanecen configurables mediante CH04-Q003.",
    body: `<form id="quote-date-form" class="form-grid"><label class="full">Fecha<input type="date" name="invoiceDate" value="${safeText(ui.quoteDraft?.invoiceDate || "")}" required></label></form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-quote-date">Seleccionar</button>`
  });
}

function renderQuoteModal({ asPage = false } = {}) {
  const state = store.getState();
  if (!ui.quoteDraft && asPage) {
    const selectedCase = state.cases[0];
    ui.quoteDraft = {
      quoteId: null,
      revise: false,
      editDraft: false,
      caseId: selectedCase?.id || "",
      patientId: selectedCase?.patientId || "",
      category: "SERVICES",
      items: [],
      discount: { type: "PERCENT", value: 0, reason: "" },
      invoiceDate: new Date().toISOString().slice(0, 10),
      discountGroupId: "REGULAR",
      referredBy: "",
      giftcard: "",
      insurerAmount: 0,
      comments: ""
    };
  }
  const draft = ui.quoteDraft;
  if (!draft) return "";
  if (!asPage && routeFromHash() === "cotizaciones/nueva") {
    render();
    return "";
  }
  const record = state.cases.find((c) => c.id === draft.caseId);
  if (record) draft.patientId = record.patientId;
  const patient = store.patientById(draft.patientId);
  const quotePatients = state.patients.filter((candidate) => state.cases.some((item) => item.patientId === candidate.id));
  const referralValues = String(draft.referredBy || "").split("|").map((value) => value.trim()).filter(Boolean);
  const referralCatalog = [...new Set(state.quotes.flatMap((quote) => String(quote.referredBy || "").split("|").map((value) => value.trim())).filter(Boolean))];
  const activeCategory = draft.category || "SERVICES";
  const categoryItems = state.catalogItems.filter((item) => item.category === activeCategory);
  const selectedCatalogItem = Object.hasOwn(draft, "selectedCatalogItemId")
    ? categoryItems.find((item) => item.id === draft.selectedCatalogItemId)
    : categoryItems[0];
  const itemFilter = draft.itemFilter || "ALL";
  const visibleQuoteItems = draft.items.map((item, index) => ({ item, index }))
    .filter(({ item }) => itemFilter === "ALL" || item.catalogItemId === itemFilter);
  const activeDiscountRule = state.discountRules.find((rule) => rule.id === draft.discountGroupId && rule.active && !rule.requiresApproval);
  const effectiveDiscount = activeDiscountRule
    ? { type:"CATEGORY_PERCENTAGES", categories:activeDiscountRule.categories || {}, value:0, reason:draft.discount?.reason || "", ruleId:activeDiscountRule.id }
    : { type:"CATEGORY_PERCENTAGES", categories:{}, value:0, reason:"", ruleId:"REGULAR" };
  const discountSummary = activeDiscountRule
    ? Object.entries(activeDiscountRule.categories || {}).filter(([, value]) => Number(value) > 0).map(([category, value]) => `${quoteCategoryLabel(category)} ${value}%`).join(" · ")
    : "Regular · 0%";
  const result = calculateQuote(draft.items, effectiveDiscount, draft.insurerAmount);
  const title = draft.editDraft ? `Editar borrador ${draft.quoteId}` : draft.revise ? `Nueva versión de ${draft.quoteId}` : "Nueva cotización";
  const subtitle = "Agrega servicios, estudios, medicamentos, insumos, equipos, honorarios y extras.";
  const body = `
      <div class="quote-builder">
        <section class="quote-builder-main">
          <form id="quote-head-form" class="form-grid compact-form">
            <h3 class="full form-section-title">Datos del paciente</h3>
            <input type="hidden" name="caseId" value="${safeText(draft.caseId)}">
            <input type="hidden" name="patientId" value="${safeText(draft.patientId)}">
            <div class="full quote-patient-grid">
              <label>* Paciente<input name="patientSearch" list="quote-patient-options" value="${safeText(quotePatientLabel(patient))}" required autocomplete="off" placeholder="Buscar por documento o nombre" data-action="quote-patient-change"><datalist id="quote-patient-options">${quotePatients.map((candidate) => `<option value="${safeText(quotePatientLabel(candidate))}"></option>`).join("")}</datalist></label>
              <label>DUI/NIT<input name="patientDocument" disabled value="${safeText(patient?.document || "")}"></label>
              <label>Teléfono<input name="patientPhone" disabled value="${safeText(patient?.phone || "")}"></label>
              <label>Correo<input name="patientEmail" disabled value="${safeText(patient?.email || "")}"></label>
            </div>
            <h3 class="full form-section-title">Datos de la factura</h3>
            <label>* Fecha<div class="input-with-action"><input name="invoiceDate" value="${safeText(draft.invoiceDate)}" required readonly><button type="button" data-action="open-quote-date-picker" aria-label="Abrir calendario">📅</button></div></label>
            <label>* Grupo de descuento<select name="discountGroupId" required data-action="quote-calc-change"><option value="REGULAR" ${draft.discountGroupId === "REGULAR" ? "selected" : ""}>Regular</option>${state.discountRules.filter((rule) => rule.active).map((rule) => `<option value="${safeText(rule.id)}" ${draft.discountGroupId === rule.id ? "selected" : ""} ${rule.requiresApproval ? "disabled" : ""}>${safeText(rule.name)}${rule.requiresApproval ? " · aprobación pendiente" : ""}</option>`).join("")}</select></label>
            <label class="full"><span>* Referido por <button type="button" class="inline-add" data-action="open-quote-referral" title="Agregar referencia provisional">+</button></span><input type="hidden" name="referredBy" value="${safeText(referralValues.join(" | "))}"><div class="referral-picker"><input name="referralCandidate" list="quote-referral-options" ${referralValues.length ? "" : "required"} autocomplete="off" placeholder="Buscar referencia autorizada" data-action="quote-referral-add"><datalist id="quote-referral-options">${referralCatalog.map((value) => `<option value="${safeText(value)}"></option>`).join("")}</datalist><div class="referral-tags">${referralValues.map((value, index) => `<span>${safeText(value)}<button type="button" data-action="quote-remove-referral" data-index="${index}" aria-label="Quitar ${safeText(value)}">×</button></span>`).join("")}</div></div></label>
            <label>Giftcard<div class="input-with-action"><input name="giftcard" value="${safeText(draft.giftcard)}" data-action="quote-calc-change"><button type="button" data-action="clear-quote-giftcard" aria-label="Limpiar giftcard">×</button></div></label>
            <label>Descuento configurado<input value="${safeText(discountSummary)}" disabled></label>
            <label>Monto del seguro<input type="number" name="insurerAmount" min="0" step=".01" value="${draft.insurerAmount || 0}" data-action="quote-calc-change"></label>
            <label class="full">${activeDiscountRule?.requiresReason ? "* " : ""}Motivo del descuento<input name="discountReason" value="${safeText(draft.discount.reason || "")}" ${activeDiscountRule?.requiresReason ? "required" : ""} data-action="quote-calc-change"></label>
            <label class="full">* Comentarios<textarea name="comments" rows="2" required data-action="quote-calc-change">${safeText(draft.comments || "")}</textarea></label>
            ${draft.revise ? `<label class="full">Motivo de la nueva versión<textarea name="revisionReason" rows="2" required data-action="quote-calc-change">${safeText(draft.revisionReason || "")}</textarea></label>` : ""}
          </form>
          <nav class="quote-category-tabs" aria-label="Categorías de cotización">${Object.keys(ITEM_CATEGORY_LABELS).map((category) => `<button type="button" class="${category === activeCategory ? "active" : ""}" data-action="quote-set-category" data-category="${category}" aria-current="${category === activeCategory ? "page" : "false"}">${safeText(quoteCategoryLabel(category))}</button>`).join("")}</nav>
          <label class="quote-inventory-filter"><input type="checkbox" disabled title="CH05-Q005: regla de disponibilidad pendiente"> Solo disponibles en inventario</label>
          <div class="quote-add-context">
            <label>* Socio de negocios<input value="Pendiente de catálogo CH05-Q001" disabled></label>
            <label>${safeText(quoteCategoryLabel(activeCategory))}<input id="quote-item-search" list="quote-item-options" value="${safeText(quoteCatalogLabel(selectedCatalogItem))}" autocomplete="off" placeholder="Buscar concepto" data-action="quote-item-select"><datalist id="quote-item-options">${categoryItems.map((item) => `<option value="${safeText(quoteCatalogLabel(item))}"></option>`).join("")}</datalist><select id="quote-item-select" class="sr-only" aria-hidden="true" tabindex="-1"><option value="${safeText(selectedCatalogItem?.id || "")}"></option></select></label>
            <label>Precio<input id="quote-item-price" value="${safeText(selectedCatalogItem?.price ?? "")}" disabled></label>
          </div>
          <div class="quote-no-results" role="status" ${draft.catalogNoResults ? "" : "hidden"}>No results found</div>
          <div class="quote-add-row">
            <label>* Cantidad<input id="quote-item-qty" type="number" min=".01" step=".01" value="0" required aria-label="Cantidad"></label>
            <button class="btn btn-primary" data-action="quote-add-item" ${draft.processing ? "disabled" : ""}>+ Añadir</button>
          </div>
          <div class="quote-item-list">
            ${draft.items.length ? `<label class="quote-item-filter">Filtrar por Item<select data-action="quote-item-filter"><option value="ALL">Todos</option>${draft.items.map((item) => `<option value="${safeText(item.catalogItemId)}" ${itemFilter === item.catalogItemId ? "selected" : ""}>${safeText(item.name)}</option>`).join("")}</select></label><div class="table-wrap"><table class="quote-ledger"><thead><tr><th>Tipo</th><th>Código</th><th>Item</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th><th>Desc. %</th><th>Desc. $</th><th>Impuesto</th><th>Total</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>${Object.keys(ITEM_CATEGORY_LABELS).filter((category) => visibleQuoteItems.some(({item}) => item.category === category)).map((category) => `<tr class="quote-ledger-group"><th colspan="11">${safeText(quoteCategoryLabel(category))}</th></tr>${visibleQuoteItems.filter(({item}) => item.category === category).map(({item,index}) => { const catalogItem=state.catalogItems.find((candidate)=>candidate.id===item.catalogItemId); const subtotal=item.quantity*item.unitPrice; const discountPercent=Number(effectiveDiscount.categories?.[item.category]||0); const discount=subtotal*discountPercent/100; return `<tr><td>${safeText(quoteCategoryLabel(item.category))}</td><td><code>${safeText(catalogItem?.sku || item.catalogItemId || "—")}</code></td><td><strong>${safeText(item.name)}</strong></td><td><input type="number" step=".01" min=".01" value="${item.quantity}" data-action="quote-item-qty-change" data-index="${index}" aria-label="Cantidad ${safeText(item.name)}"></td><td><output aria-label="Precio de catálogo ${safeText(item.name)}">${money(item.unitPrice)}</output></td><td>${money(subtotal)}</td><td>${discountPercent.toFixed(2)}%</td><td>${money(discount)}</td><td><input type="checkbox" disabled title="CH05-Q004: impuesto pendiente de reglas" aria-label="Impuesto ${safeText(item.name)}"></td><td><strong>${money(subtotal-discount)}</strong></td><td><button data-action="quote-remove-item" data-index="${index}" aria-label="Quitar ${safeText(item.name)}">×</button></td></tr>`; }).join("")}`).join("")}</tbody></table></div>` : `<div class="empty-state"><h3>Sin conceptos</h3><p>Selecciona un ítem del catálogo para iniciar.</p></div>`}
          </div>
        </section>
        <aside class="quote-builder-summary">
          <h3>Resumen</h3>
          <div><span>Subtotal</span><strong>${money(result.subtotal)}</strong></div>
          <div><span>Descuento</span><strong>−${money(result.discountAmount)}</strong></div>
          <div title="CH05-Q004: tasa y base pendientes"><span>Impuesto</span><strong>${money(0)}</strong></div>
          <div class="total"><span>Total</span><strong>${money(result.total)}</strong></div>
          <div><span>Seguro</span><strong>${money(result.insurerAmount)}</strong></div>
          <div class="balance"><span>Paciente</span><strong>${money(result.patientAmount)}</strong></div>
          <p>${draft.items.length} conceptos · ${new Set(draft.items.map(i=>i.category)).size} categorías</p>
        </aside>
      </div>${draft.processing ? `<div class="quote-processing" role="status"><span class="spinner"></span><strong>Procesando...</strong></div>` : ""}`;
  const saveLabel = draft.editDraft ? "Guardar borrador" : draft.revise ? "Crear nueva versión" : "Guardar cotización";
  if (asPage) {
    return `<section class="page quote-create-page">
      <header class="page-header">
        <div><p class="eyebrow">Hospitalización / Cotizaciones</p><h1>${safeText(title)}</h1><p>${safeText(subtitle)}</p></div>
        <div class="page-actions"><a class="btn btn-secondary" href="#/hospitalizaciones">Atrás</a><button class="btn btn-primary" data-action="save-quote">${saveLabel}</button></div>
      </header>
      <article class="card"><div class="card-body">${body}</div><footer class="card-footer"><a class="btn btn-secondary" href="#/hospitalizaciones">Atrás</a><button class="btn btn-primary" data-action="save-quote">${saveLabel}</button></footer></article>
    </section>`;
  }
  openModal({ title, subtitle, size: "xl", body, footer: `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-quote">${saveLabel}</button>` });
  return "";
}

function syncQuoteHead() {
  const form = document.querySelector("#quote-head-form");
  if (!form || !ui.quoteDraft) return;
  const data = new FormData(form);
  const hasPatientSearch = data.has("patientSearch");
  const patientSearch = String(data.get("patientSearch") || "").trim();
  const matchedPatient = store.getState().patients.find((candidate) => quotePatientLabel(candidate) === patientSearch || candidate.id === patientSearch);
  const selectedPatientId = hasPatientSearch ? (matchedPatient?.id || "") : (data.get("patientId") || ui.quoteDraft.patientId);
  const selectedCaseId = data.get("caseId") || ui.quoteDraft.caseId;
  const selectedCase = store.caseById(selectedCaseId);
  const compatibleCase = selectedCase?.patientId === selectedPatientId
    ? selectedCase
    : store.getState().cases.find((candidate) => candidate.patientId === selectedPatientId);
  ui.quoteDraft.caseId = compatibleCase?.id || "";
  ui.quoteDraft.patientId = selectedPatientId || compatibleCase?.patientId || "";
  const discountGroupId = String(data.get("discountGroupId") || "REGULAR");
  const discountRule = store.getState().discountRules.find((rule) => rule.id === discountGroupId && rule.active && !rule.requiresApproval);
  ui.quoteDraft.discount = discountRule
    ? { type:"CATEGORY_PERCENTAGES", categories:structuredClone(discountRule.categories || {}), value:0, reason:data.get("discountReason") || "", ruleId:discountRule.id }
    : { type:"CATEGORY_PERCENTAGES", categories:{}, value:0, reason:"", ruleId:"REGULAR" };
  ui.quoteDraft.invoiceDate = data.get("invoiceDate") || "";
  ui.quoteDraft.discountGroupId = discountRule?.id || "REGULAR";
  ui.quoteDraft.referredBy = data.get("referredBy") || "";
  ui.quoteDraft.giftcard = data.get("giftcard") || "";
  ui.quoteDraft.insurerAmount = Number(data.get("insurerAmount") || 0);
  ui.quoteDraft.comments = data.get("comments") || "";
  ui.quoteDraft.revisionReason = data.get("revisionReason") || "";
}

function openInsuranceStatus(quoteId = "") {
  const state = store.getState();
  const quote = state.quotes.find((q) => q.id === quoteId) || state.quotes[0];
  if (!quote) return showToast("No hay cotizaciones para actualizar.", "danger");
  const request = state.insuranceRequests.find((candidate) => candidate.quoteId === quote.id);
  const currentIndex = QUOTE_STATUS_FLOW.indexOf(quote.status);
  const allowed = QUOTE_STATUS_FLOW.slice(Math.max(0, currentIndex)).concat(["INFO_REQUIRED", "PARTIALLY_APPROVED", "APPROVED", "REJECTED"]).filter((v, i, a) => a.indexOf(v) === i);
  openModal({
    title: `Actualizar ${quote.id}`,
    subtitle: `${store.patientById(quote.patientId)?.fullName} · ${QUOTE_ADMIN_LABELS_MAIN[quote.status] || quote.status}`,
    size: "md",
    body: `<form id="insurance-form" class="form-grid">
      <input type="hidden" name="quoteId" value="${quote.id}">
      <input type="hidden" name="eventId" value="${safeText(uid("QSE"))}">
      <label class="full">Nuevo estado<select name="status">${allowed.map((s) => `<option value="${s}" ${s === quote.status ? "selected" : ""}>${safeText(QUOTE_ADMIN_LABELS_MAIN[s] || s)}</option>`).join("")}</select></label>
      <label class="full">Monto aprobado por aseguradora<input type="number" min="0" max="${quote.total}" step=".01" name="approvedAmount" value="${safeText(request?.approvedAmount ?? "")}"></label>
      <label class="full">Observación / respuesta<textarea name="note" rows="4" required placeholder="Carta recibida, documentos solicitados, motivo del rechazo..."></textarea></label>
      <label class="full">Número de reclamo o autorización<input name="claimNumber" maxlength="120" value="${safeText(request?.claimNumber || "")}" placeholder="Opcional"></label>
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-insurance-status">Guardar y notificar</button>`
  });
}

function openPaymentForm(quoteId = "") {
  const state = store.getState();
  const quote = state.quotes.find((q) => q.id === quoteId) || state.quotes.find((q) => quoteBalance(q, state.payments) > 0);
  if (!quote) return showToast("No hay saldos pendientes.", "danger");
  const balance = quoteBalance(quote, state.payments);
  openModal({
    title: "Registrar pago",
    subtitle: `${quote.id} · ${store.patientById(quote.patientId)?.fullName} · saldo ${money(balance)}`,
    size: "md",
    body: `<form id="payment-form" class="form-grid">
      <input type="hidden" name="quoteId" value="${quote.id}">
      <label>Monto<input type="number" min=".01" max="${balance}" step=".01" name="amount" value="${balance}" required></label>
      <label>Método<select name="method"><option>TRANSFER</option><option>CARD</option><option>CASH</option><option>CHECK</option><option>ONLINE</option></select></label>
      <label class="full">Pagado por<input name="payer" value="${safeText(store.patientById(quote.patientId)?.contactName || "")}" required></label>
      <label class="full">Referencia única<input name="reference" value="DEMO-${Date.now()}" required></label>
      <label class="full upload-zone"><span>Comprobante</span><input type="file" name="receiptFile" accept=".pdf,.png,.jpg"><small>En Supabase se almacena en un bucket privado.</small></label>
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-payment">Aplicar pago</button>`
  });
}

function openAdministrativeExecution(quoteId) {
  const state = store.getState();
  const quote = state.quotes.find((candidate) => candidate.id === quoteId);
  const record = quote && state.cases.find((candidate) => candidate.id === quote.caseId);
  const patient = record && store.patientById(record.patientId);
  if (!quote || !record || !patient) return showToast("No fue posible abrir el perfil administrativo.", "danger");
  const existing = state.administrativeExecutionProfiles.find((candidate) => candidate.caseId === record.id && candidate.status === "ACTIVE");
  openModal({
    title: "Detalles de Hospitalización",
    subtitle: `Perfil administrativo de ejecución${existing ? `: ${safeText(existing.id)}` : ""}`,
    size: "xl",
    body: `<form id="administrative-execution-form" class="form-grid">
      <input type="hidden" name="quoteId" value="${safeText(quote.id)}">
      <input type="hidden" name="idempotencyKey" value="${safeText(existing?.idempotencyKey || uid("EXEC"))}">
      <div class="form-section full"><h3>Identidad administrativa</h3></div>
      <label>Paciente<input value="${safeText(patient.fullName)}" disabled></label>
      <label>DUI/NIT<input value="${safeText(patient.document)}" disabled></label>
      <label>Hospitalización<input value="${safeText(record.id)}" disabled></label>
      <label>Estado<input value="${safeText(record.status)}" disabled></label>
      <div class="form-section full"><h3>Perfil administrativo de ejecución</h3><p>Los catálogos se capturan como valores configurables hasta recibir las listas oficiales.</p></div>
      <label>Responsable administrativo<input name="healthManager" value="${safeText(existing?.healthManager || record.manager || store.currentUser()?.name || "")}" required></label>
      <label>Referido por<input name="referredBy" value="${safeText(existing?.referredBy || quote.referredBy || "")}" required></label>
      <label>Tipo Revenue<input name="revenueType" value="${safeText(existing?.revenueType || "")}" placeholder="Catálogo configurable" required></label>
      <label>Tipo<input name="serviceType" value="${safeText(existing?.serviceType || "")}" placeholder="Catálogo configurable"></label>
      <label>Fecha de inicio<input type="date" name="startDate" value="${safeText(existing?.startDate || record.startDate || new Date().toISOString().slice(0,10))}" required></label>
      <label>Días de duración<input type="number" min="1" max="3660" step="1" name="durationDays" value="${safeText(existing?.durationDays || 1)}" required></label>
      <label>Forma de pago<input name="paymentForm" value="${safeText(existing?.paymentForm || "")}" placeholder="Catálogo configurable" required></label>
      <label>Aseguradora<select name="insurerId">${insurerOptions(existing?.insurerId || record.insurerId || "")}</select></label>
      <label>Tipo de solicitud<input name="requestType" value="${safeText(existing?.requestType || "")}" placeholder="Catálogo configurable" required></label>
      <label class="checkbox-label"><input type="checkbox" name="thirdPartyInvoice" ${existing?.thirdPartyInvoice ? "checked" : ""}> Generar factura a nombre de un tercero</label>
      <label>Categoría mayor<input name="majorCategory" value="${safeText(existing?.majorCategory || "")}" placeholder="Catálogo configurable"></label>
      <label>Subcategoría de servicios<input name="serviceSubcategory" value="${safeText(existing?.serviceSubcategory || "")}" placeholder="Catálogo configurable"></label>
      <label class="full">Hospital del que proviene<input name="sourceHospital" value="${safeText(existing?.sourceHospital || "")}" placeholder="Catálogo configurable"></label>
      <label class="full">Descripción<textarea name="description" rows="3">${safeText(existing?.description || "")}</textarea></label>
      <label>Tipo de paciente<input name="patientType" value="${safeText(existing?.patientType || "")}" placeholder="Catálogo configurable"></label>
      <label>Tipo de módulo<input name="moduleType" value="${safeText(existing?.moduleType || "")}" placeholder="Catálogo configurable"></label>
      <label>Adicionales<input name="additionalOptions" value="${safeText(existing?.additionalOptions || "")}" placeholder="Catálogo configurable"></label>
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-administrative-execution" ${existing ? "disabled title=\"Ya existe un perfil activo; su edición requiere reglas de corrección aprobadas.\"" : ""}>Guardar</button>`
  });
}

function paymentRowsForCase(caseId) {
  return store.getState().payments.filter((payment) => payment.caseId === caseId || store.getState().quotes.some((quote) => quote.id === payment.quoteId && quote.caseId === caseId));
}

function clinicalDeviceRow(index = 0) {
  return `<fieldset class="form-section full clinical-device-row" data-device-index="${index}"><legend>Dispositivo ${index + 1}</legend><div class="form-grid">
    <label>Dispositivo<input name="deviceType" placeholder="Catálogo configurable"></label><label>Fecha<input type="date" name="deviceDate"></label>
    <label>Calibre<input name="deviceGauge"></label><label>Motivo<input name="deviceReason"></label>
    <label>Frecuencia de cambio<input name="deviceFrequency" placeholder="Valor documentado"></label><label>Observaciones<input name="deviceObservations"></label>
  </div></fieldset>`;
}

function openClinicalProfiles(caseId) {
  const state = store.getState();
  const record = state.cases.find((candidate) => candidate.id === caseId);
  if (!record) return showToast("Hospitalización no encontrada.", "danger");
  const profiles = (state.clinicalProfiles || []).filter((candidate) => candidate.caseId === caseId)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  openModal({
    title: "Perfiles Clínicos",
    subtitle: `${caseId} · historial append-only`,
    size: "xl",
    body: `<div class="action-strip"><button class="btn btn-primary" data-action="open-clinical-profile-form" data-case-id="${safeText(caseId)}">+ Nuevo perfil clínico</button></div>
      <div class="table-wrap"><table><thead><tr><th>Acc.</th><th>Fecha de inicio</th><th>Triage</th><th>Médico tratante</th><th>Tipo de servicio</th><th>Estatus</th><th>Fecha fin</th></tr></thead><tbody>${profiles.map((profile) => {
        const doctor = state.doctors.find((candidate) => candidate.id === profile.treatingDoctorId);
        return `<tr><td>—</td><td>${new Date(`${profile.startDate}T12:00:00Z`).toLocaleDateString("es-SV")}</td><td>${safeText(profile.triage)}</td><td>${safeText(doctor?.name || "No asignado")}</td><td>${safeText(profile.serviceType)}</td><td>${safeText(profile.clinicalStatus)}</td><td>${profile.endDate ? new Date(`${profile.endDate}T12:00:00Z`).toLocaleDateString("es-SV") : "—"}</td></tr>`;
      }).join("") || `<tr><td colspan="7">Ningún perfil clínico registrado.</td></tr>`}</tbody></table></div>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cerrar</button>`
  });
}

function openClinicalProfileForm(caseId) {
  const state = store.getState();
  const record = state.cases.find((candidate) => candidate.id === caseId);
  const patient = record && store.patientById(record.patientId);
  if (!record || !patient) return showToast("No fue posible abrir el perfil clínico.", "danger");
  const today = new Date().toISOString().slice(0,10);
  openModal({
    title: "Detalles de Hospitalización",
    subtitle: "Nuevo perfil clínico en borrador · la activación requiere política confirmada",
    size: "xl",
    body: `<form id="clinical-profile-form" class="form-grid">
      <input type="hidden" name="caseId" value="${safeText(caseId)}"><input type="hidden" name="idempotencyKey" value="${safeText(uid("CLINICAL-PROFILE"))}">
      <label>Paciente<input value="${safeText(patient.fullName)}" disabled></label><label>DUI/NIT<input value="${safeText(patient.document)}" disabled></label>
      <label>Hospitalización<input value="${safeText(caseId)}" disabled></label><label>Estatus<input value="Borrador" disabled></label>
      <div class="form-section full"><h3>Perfil clínico de Hospitalización</h3><nav class="tabs"><button type="button" class="tab active">Perfil clínico</button><button type="button" class="tab" disabled title="Requiere umbrales clínicos aprobados">Alertas de signos vitales</button></nav></div>
      <label>Fecha inicio<input type="date" name="startDate" value="${safeText(record.startDate || today)}" required></label><label>Fecha fin<input type="date" name="endDate"></label>
      <label class="full">Adjuntos<button type="button" class="btn btn-secondary" disabled title="Faltan reglas de almacenamiento, tipos, límites y retención">Adjuntar archivos</button></label>
      <label>Médico tratante<select name="treatingDoctorId"><option value="">Seleccione</option>${doctorOptions(record.contractingDoctorId)}</select></label>
      <label>Otros médicos tratantes<select name="otherDoctorIds" multiple>${doctorOptions()}</select></label>
      <label>Diagnóstico · código<input name="diagnosisCode" placeholder="Catálogo oficial pendiente" maxlength="80" required></label>
      <label>Diagnóstico · descripción<input name="diagnosisLabel" placeholder="Descripción documentada por el profesional" maxlength="500" required></label>
      <label>Grupo Diagnóstico<input name="diagnosisGroup" placeholder="Catálogo configurable" required></label><label>Triage<input name="triage" placeholder="Clasificación documentada" required></label>
      <label>Grupo perfil del paciente<input name="profileGroup" placeholder="Catálogo configurable" required></label><label>Subgrupo perfil paciente<input name="profileSubgroup" placeholder="Catálogo configurable" required></label>
      <label>Tipo de paciente<input name="patientType" placeholder="Catálogo configurable" required></label><label>Supervisor encargado<input name="supervisorName"></label>
      <label>Coordinador clínico<select name="coordinatorId"><option value="">Seleccione</option>${doctorOptions()}</select></label><label>Tags de enfermería<input name="nursingTags"></label>
      <label>Frecuencia de visita de supervisión<input name="supervisionFrequency" placeholder="Valor documentado"></label><label>Frecuencia de reporte al médico<input name="physicianReportFrequency" placeholder="Valor documentado"></label>
      <label class="full">Tipo de servicio<input name="serviceType" placeholder="Catálogo configurable" required></label>
      <div class="form-section full"><h3>Dispositivos</h3><p>Se registran como datos suministrados; no se derivan frecuencias ni indicaciones.</p><div id="clinical-device-list">${clinicalDeviceRow(0)}</div><button type="button" class="btn btn-secondary" data-action="add-clinical-device-row">+ Agregar dispositivo a lista</button></div>
      <div class="form-section full"><h3>Planificación de turnos</h3><p>Guardar estos campos no genera turnos automáticamente.</p></div>
      <label>Rango de fechas para turnos · inicio<input type="date" name="shiftStartDate"></label><label>Fin<input type="date" name="shiftEndDate"></label>
      <label>Frecuencia<input name="shiftFrequency" placeholder="Catálogo configurable"></label><label>Tipo de atención<input name="attentionType" placeholder="Catálogo configurable"></label>
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-clinical-profile">Guardar borrador</button>`
  });
}

const HEALTH_REPORT_SECTIONS = [
  ["vitals", "Tabla de Signos Vitales"],
  ["medication", "Tarjeta de medicamentos"],
  ["vitals-chart", "Gráfico Signos Vitales"],
  ["condition-notes", "Notas condición paciente"],
  ["evidence", "Evidencias"],
  ["prescriptions", "Recetas Adjuntas/Digitales"],
  ["handoffs", "Bitácora de Entrega de turno"],
  ["medical-visits", "Visitas Médicas de Seguimiento Clínico"],
  ["nursing", "Notas de enfermería con firma y sello"],
  ["orders", "Órdenes médicas"],
  ["care", "Registro y cuidados diarios"],
  ["assessments", "Evaluaciones de enfermería"]
];
const HEALTH_REPORT_DEFAULT_SECTION_KEYS = HEALTH_REPORT_SECTIONS.slice(0, 6).map(([key]) => key);

function openHealthReportRange(caseId) {
  const state = store.getState();
  const record = state.cases.find((candidate) => candidate.id === caseId);
  if (!record) return showToast("Hospitalización no encontrada.", "danger");
  const profile = (state.clinicalProfiles || []).filter((candidate) => candidate.caseId === caseId)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0];
  const current = ui.healthReportRange?.caseId === caseId ? ui.healthReportRange : null;
  openModal({
    title: "Rango fechas",
    subtitle: "El reporte se calcula sólo con registros del período seleccionado.",
    body: `<form id="health-report-range-form" class="form-grid"><input type="hidden" name="caseId" value="${safeText(caseId)}">
      <label>Fecha de inicio<input type="date" name="start" value="${safeText(current?.start || profile?.startDate || record.startDate || "")}" required></label>
      <label>Fecha de fin<input type="date" name="end" value="${safeText(current?.end || profile?.endDate || record.endDate || new Date().toISOString().slice(0,10))}" required></label>
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Salir</button><button class="btn btn-primary" data-action="save-health-report-range">Cargar</button>`
  });
}

function ensureHealthReportConfig(caseId) {
  if (ui.healthReportConfig?.caseId !== caseId) {
    ui.healthReportConfig = {caseId, selected: [...HEALTH_REPORT_DEFAULT_SECTION_KEYS], includeAttachments: false};
  }
  return ui.healthReportConfig;
}

function renderHealthReportConfigModal(caseId) {
  const config = ensureHealthReportConfig(caseId);
  const selected = new Set(config.selected);
  const titleByKey = Object.fromEntries(HEALTH_REPORT_SECTIONS);
  openModal({
    title: "Configuration report",
    subtitle: "Selecciona y ordena los títulos que aparecerán en el reporte.",
    size: "xl",
    body: `<div class="report-config-grid">
      <section class="card"><header class="card-header"><h3>Títulos disponibles</h3></header><div class="card-body">${HEALTH_REPORT_SECTIONS.filter(([key]) => !selected.has(key)).map(([key, title]) => `<div class="list-row"><span>${safeText(title)}</span><button class="btn btn-secondary" data-action="health-report-config-add" data-case-id="${safeText(caseId)}" data-section="${safeText(key)}">Añadir</button></div>`).join("") || "<p>Todos los títulos están incluidos.</p>"}</div></section>
      <section class="card"><header class="card-header"><h3>Reporte</h3><p>Orden de impresión</p></header><div class="card-body">${config.selected.map((key, index) => `<div class="list-row"><span>${index + 1}. ${safeText(titleByKey[key] || key)}</span><span><button class="btn btn-secondary" data-action="health-report-config-up" data-case-id="${safeText(caseId)}" data-section="${safeText(key)}" ${index === 0 ? "disabled" : ""} aria-label="Subir ${safeText(titleByKey[key] || key)}">↑</button><button class="btn btn-secondary" data-action="health-report-config-down" data-case-id="${safeText(caseId)}" data-section="${safeText(key)}" ${index === config.selected.length - 1 ? "disabled" : ""} aria-label="Bajar ${safeText(titleByKey[key] || key)}">↓</button><button class="btn btn-secondary" data-action="health-report-config-remove" data-case-id="${safeText(caseId)}" data-section="${safeText(key)}">Quitar</button></span></div>`).join("") || "<p>Selecciona al menos un título.</p>"}</div></section>
    </div><label class="checkbox-label"><input type="checkbox" disabled title="Faltan políticas de adjuntos, acceso y retención"> Include attached documents <small>pendiente de política del cliente</small></label>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cerrar</button><button class="btn btn-primary" data-action="print-health-report-config" data-case-id="${safeText(caseId)}" ${config.selected.length ? "" : "disabled"}>Imprimir</button>`
  });
}

function healthReportSectionHtml(key, context) {
  const {state, record, patient, profile, range} = context;
  const inRange = (value) => !value || ((!range.start || String(value).slice(0,10) >= range.start) && (!range.end || String(value).slice(0,10) <= range.end));
  const rows = (headers, values) => `<table><thead><tr>${headers.map((value) => `<th>${safeText(value)}</th>`).join("")}</tr></thead><tbody>${values.join("") || `<tr><td colspan="${headers.length}">Sin registros en el período seleccionado.</td></tr>`}</tbody></table>`;
  if (key === "vitals") return rows(["Fecha","TA","FC","FR","SpO₂","Temp","Dolor"], state.vitalSigns.filter((item) => item.caseId === record.id && inRange(item.recordedAt)).map((item) => `<tr><td>${safeText(new Date(item.recordedAt).toLocaleString("es-SV"))}</td><td>${safeText(`${item.systolic}/${item.diastolic}`)}</td><td>${safeText(item.heartRate)}</td><td>${safeText(item.respiratoryRate)}</td><td>${safeText(item.spo2)}%</td><td>${safeText(item.temperature)}</td><td>${safeText(item.pain)}</td></tr>`));
  if (key === "medication") return rows(["Tarjeta","Medicamentos","Estado"], state.medicationCards.filter((item) => item.caseId === record.id).map((item) => `<tr><td>${safeText(item.id)}</td><td>${safeText((item.items || []).map((entry) => entry.medication).join(", "))}</td><td>${safeText(item.documentStatus || item.status)}</td></tr>`));
  if (key === "condition-notes" || key === "nursing" || key === "care") return rows(["Fecha","Autor","Estado","Registro"], state.nursingNotes.filter((item) => item.caseId === record.id && inRange(item.createdAt)).map((item) => `<tr><td>${safeText(new Date(item.createdAt).toLocaleString("es-SV"))}</td><td>${safeText(item.authorName)}</td><td>${safeText(item.status)}</td><td>${safeText(item.text)}</td></tr>`));
  if (["evidence","prescriptions","orders","assessments","medical-visits","handoffs"].includes(key)) return rows(["Documento","Tipo","Autor","Versión","Estado"], state.clinicalDocuments.filter((item) => item.caseId === record.id && inRange(item.createdAt)).map((item) => `<tr><td>${safeText(item.title)}</td><td>${safeText(item.type)}</td><td>${safeText(item.authorName)}</td><td>${safeText(item.version)}</td><td>${safeText(item.status)}</td></tr>`));
  if (key === "vitals-chart") return `<p>La tabla de signos vitales es la fuente autoritativa. La visualización gráfica no infiere umbrales clínicos.</p>`;
  return `<p>Sin registros para ${safeText(patient?.fullName || record.id)}.</p>`;
}

function printConfiguredHealthReport(caseId) {
  const state = store.getState();
  const record = state.cases.find((candidate) => candidate.id === caseId);
  const patient = record && state.patients.find((candidate) => candidate.id === record.patientId);
  if (!record || !patient) throw new Error("Reporte no disponible.");
  const profile = (state.clinicalProfiles || []).filter((candidate) => candidate.caseId === caseId)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0];
  const range = ui.healthReportRange?.caseId === caseId ? ui.healthReportRange : {start: profile?.startDate || record.startDate, end: profile?.endDate || record.endDate || new Date().toISOString().slice(0,10)};
  const config = ensureHealthReportConfig(caseId);
  const titleByKey = Object.fromEntries(HEALTH_REPORT_SECTIONS);
  const sections = config.selected.map((key) => `<section><h2>${safeText(titleByKey[key] || key)}</h2>${healthReportSectionHtml(key, {state, record, patient, profile, range})}</section>`).join("");
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte de salud ${safeText(caseId)}</title><style>body{font:14px Arial,sans-serif;color:#17202a;margin:32px}header{border-bottom:2px solid #0b6b63;margin-bottom:24px}h1{font-size:24px}h2{font-size:17px;margin-top:28px}table{width:100%;border-collapse:collapse}th,td{padding:7px;border:1px solid #ccd5d9;text-align:left;vertical-align:top}small{color:#52606d}@media print{body{margin:12mm}section{break-inside:avoid}}</style></head><body><header><h1>Reporte de salud</h1><p><strong>${safeText(patient.fullName)}</strong> · ${safeText(caseId)}</p><p>Período: ${safeText(range.start)} al ${safeText(range.end)}</p><small>Documento generado desde registros autorizados. No sustituye documentos clínicos firmados.</small></header>${sections}</body></html>`;
  openPrintWindow(html, `Reporte de salud ${caseId}`);
}

function openReceivableQuotes(caseId) {
  const state = store.getState();
  const quotes = state.quotes.filter((quote) => quote.caseId === caseId);
  openModal({ title: `Cotizaciones · ${safeText(caseId)}`, size: "lg", body: `<div class="table-wrap"><table><thead><tr><th>Código</th><th>Versión</th><th>Estado</th><th>Total paciente</th></tr></thead><tbody>${quotes.map((quote) => `<tr><td><a href="#/cotizaciones/${safeText(quote.id)}">${safeText(quote.displayCode || quote.id)}</a></td><td>v${safeText(quote.version || 1)}</td><td>${safeText(QUOTE_ADMIN_LABELS_MAIN[quote.status] || quote.status)}</td><td>${money(quote.patientAmount)}</td></tr>`).join("") || `<tr><td colspan="4">Sin cotizaciones.</td></tr>`}</tbody></table></div>` });
}

function openAccountHistory(caseId) {
  openModal({
    title: "Históricos de estados de cuenta por cobrar",
    subtitle: caseId,
    size: "lg",
    body: `<nav class="tabs"><button class="tab active">Estados Particulares</button><button class="tab">Estados Mixtos</button></nav>
      <div class="callout callout-info">No hay cortes históricos persistidos. La periodicidad y el evento que crea snapshots requieren confirmación del cliente.</div>
      <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Creador</th><th>Periodo</th><th>Saldo anterior</th><th>Total facturas</th><th>Total pagos</th><th>Total pendiente</th></tr></thead><tbody><tr><td colspan="7">Ningún dato disponible en esta tabla.</td></tr></tbody></table></div>`
  });
}

function openReceivablePayments(caseId) {
  const state = store.getState();
  const payments = paymentRowsForCase(caseId);
  const quote = state.quotes.find((candidate) => candidate.caseId === caseId && quoteBalance(candidate, state.payments) > 0);
  openModal({
    title: `Pagos · Hospitalización ${safeText(caseId)}`,
    size: "xl",
    body: `${quote ? `<div class="action-strip"><button class="btn btn-primary" data-action="open-payment-form" data-quote-id="${safeText(quote.id)}">Añadir pago</button></div>` : ""}
      <div class="table-wrap"><table><thead><tr><th>Acc.</th><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Pagado por</th><th>Estado</th></tr></thead><tbody>${payments.map((payment) => `<tr><td><button class="row-action" data-action="print-payment" data-id="${safeText(payment.id)}">Imprimir</button>${payment.status === "APPLIED" ? `<button class="row-action" data-action="open-reverse-payment" data-id="${safeText(payment.id)}">Revertir</button>` : ""}</td><td>${new Date(payment.date).toLocaleDateString("es-SV")}</td><td>${safeText(payment.method)}</td><td>${money(payment.amount)}</td><td>${safeText(payment.payer)}</td><td>${safeText(payment.status)}</td></tr>`).join("") || `<tr><td colspan="6">Sin pagos.</td></tr>`}</tbody></table></div>`
  });
}

function openReversePayment(paymentId) {
  const payment = store.getState().payments.find((candidate) => candidate.id === paymentId);
  if (!payment || payment.status !== "APPLIED") return showToast("El pago no está disponible para reversión.", "danger");
  openModal({
    title: "Revertir pago",
    subtitle: `${payment.receipt} · ${money(payment.amount)}. El comprobante se conserva y queda anulado.`,
    body: `<form id="reverse-payment-form" class="form-grid"><input type="hidden" name="paymentId" value="${safeText(payment.id)}"><input type="hidden" name="idempotencyKey" value="${safeText(uid("REVERSE"))}"><label class="full">Motivo de la corrección<textarea name="reason" rows="4" required></textarea></label></form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-danger" data-action="save-reverse-payment">Revertir y conservar historial</button>`
  });
}

function openAccountStatement(patientId = "") {
  const state = store.getState();
  const patient = state.patients.find((candidate) => candidate.id === patientId) || state.patients.find((candidate) => state.cases.some((record) => record.patientId === candidate.id));
  const cases = state.cases.filter((record) => record.patientId === patient?.id);
  const record = cases[0];
  openModal({
    title: "Estado de cuenta",
    subtitle: "Vista previa calculada desde movimientos confirmados; no crea un corte histórico.",
    size: "lg",
    body: `<form id="account-statement-form" class="form-grid">
      <label class="full">Tipo de estado de cuenta<select name="statementType"><option value="PATIENT">Paciente</option><option disabled>Aseguradora · reglas pendientes</option><option disabled>Empresa · reglas pendientes</option></select></label>
      <label class="full">Paciente<select name="patientId" data-change="statement-patient-change">${patientOptions(patient?.id)}</select></label>
      <label>Hospitalización<select name="caseId">${cases.map((item) => `<option value="${safeText(item.id)}">${safeText(item.id)}</option>`).join("")}</select></label>
      <label>Tipo de paciente<select name="accountType"><option value="PARTICULAR" ${record?.accountType === "PARTICULAR" ? "selected" : ""}>Particular</option><option value="MIXTO" ${record?.accountType === "MIXTO" ? "selected" : ""}>Mixto</option></select></label>
      <label>Desde<input type="date" name="dateFrom" value="${safeText(record?.startDate || new Date().toISOString().slice(0,10))}" required></label>
      <label>Hasta<input type="date" name="dateTo" value="${new Date().toISOString().slice(0,10)}" required></label>
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cerrar</button><button class="btn btn-primary" data-action="preview-account-statement">Vista previa</button>`
  });
}

function currentQuotesForCase(caseId) {
  return [...store.getState().quotes.filter((quote) => quote.caseId === caseId).reduce((roots, quote) => {
    const root = quote.quoteId || quote.originalQuoteId || quote.id;
    const prior = roots.get(root);
    if (!prior || Number(quote.version || 0) >= Number(prior.version || 0)) roots.set(root, quote);
    return roots;
  }, new Map()).values()];
}

function statementDateInRange(value, context) {
  const date = String(value || "").slice(0, 10);
  return Boolean(date && date >= context.dateFrom && date <= context.dateTo);
}

function renderAccountStatementPreview() {
  const context = ui.statementContext;
  if (!context) return;
  const state = store.getState();
  const patient = store.patientById(context.patientId);
  const record = state.cases.find((candidate) => candidate.id === context.caseId);
  const quotes = currentQuotesForCase(context.caseId).filter((quote) => statementDateInRange(quote.invoiceDate || quote.createdAt, context));
  const payments = paymentRowsForCase(context.caseId).filter((payment) => payment.status === "APPLIED" && statementDateInRange(payment.date, context));
  const documents = state.clinicalDocuments.filter((document) => document.caseId === context.caseId);
  const tab = ui.statementTab;
  const selectedQuotes = new Set(context.selectedQuoteIds || []);
  const selectedPayments = new Set(context.selectedPaymentIds || []);
  const body = tab === "quotes" ? `<div class="table-wrap"><table><thead><tr><th>Sel.</th><th>Fecha de ejecución</th><th>Cotización</th><th>Estado</th><th>Total</th></tr></thead><tbody>${quotes.map((quote) => `<tr><td><input type="checkbox" name="statementQuote" value="${safeText(quote.id)}" ${selectedQuotes.has(quote.id) ? "checked" : ""}></td><td>${safeText(quote.invoiceDate || record?.startDate || "")}</td><td>${safeText(quote.displayCode || quote.id)}</td><td>${safeText(QUOTE_ADMIN_LABELS_MAIN[quote.status] || quote.status)}</td><td>${money(quote.patientAmount)}</td></tr>`).join("")}</tbody></table></div>`
    : tab === "payments" ? `<div class="table-wrap"><table><thead><tr><th>Sel.</th><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Pagado por</th><th>Estado</th></tr></thead><tbody>${payments.map((payment) => `<tr><td><input type="checkbox" name="statementPayment" value="${safeText(payment.id)}" ${selectedPayments.has(payment.id) ? "checked" : ""}></td><td>${safeText(String(payment.date).slice(0,10))}</td><td>${safeText(payment.method)}</td><td>${money(payment.amount)}</td><td>${safeText(payment.payer)}</td><td>${safeText(payment.status)}</td></tr>`).join("")}</tbody></table></div>`
    : `<div class="table-wrap"><table><thead><tr><th>Documento</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>${documents.map((document) => `<tr><td>${safeText(document.title)}</td><td>${safeText(String(document.createdAt).slice(0,10))}</td><td>${safeText(document.status)}</td></tr>`).join("") || `<tr><td colspan="3">Sin documentos administrativos asociados.</td></tr>`}</tbody></table></div>`;
  openModal({
    title: "Cuentas por cobrar",
    subtitle: `${safeText(patient?.fullName || "")} · ${safeText(record?.id || "")} · ${safeText(context.dateFrom)} a ${safeText(context.dateTo)}`,
    size: "xl",
    body: `<section class="card"><div class="card-body"><dl class="detail-list"><div><dt>Paciente</dt><dd>${safeText(patient?.fullName || "—")}</dd></div><div><dt>DUI/NIT</dt><dd>${safeText(patient?.document || "—")}</dd></div><div><dt>Fecha de nacimiento</dt><dd>${safeText(patient?.birthDate || "—")}</dd></div><div><dt>Sexo</dt><dd>${safeText(patient?.sex || "—")}</dd></div><div><dt>Tipo de cuenta</dt><dd>${safeText(context.accountType)}</dd></div><div><dt>Hospitalización</dt><dd>${safeText(record?.id || "—")}</dd></div></dl></div></section>
      <nav class="tabs"><button class="tab ${tab === "quotes" ? "active" : ""}" data-action="account-statement-tab" data-tab="quotes">Cotizaciones</button><button class="tab ${tab === "payments" ? "active" : ""}" data-action="account-statement-tab" data-tab="payments">Pagos</button><button class="tab ${tab === "documents" ? "active" : ""}" data-action="account-statement-tab" data-tab="documents">Documentos</button></nav>${body}`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cerrar</button><button class="btn btn-primary" data-action="open-payment-summary">Ver resumen</button>`
  });
}

function openPaymentSummary() {
  const context = ui.statementContext;
  if (!context) return;
  const selectedQuotes = new Set(context.selectedQuoteIds || []);
  const selectedPayments = new Set(context.selectedPaymentIds || []);
  const quotes = currentQuotesForCase(context.caseId).filter((quote) => selectedQuotes.has(quote.id) && statementDateInRange(quote.invoiceDate || quote.createdAt, context));
  const payments = paymentRowsForCase(context.caseId).filter((payment) => selectedPayments.has(payment.id) && payment.status === "APPLIED" && statementDateInRange(payment.date, context));
  const totalInvoices = quotes.reduce((sum, quote) => sum + Number(quote.patientAmount || 0), 0);
  const totalPayments = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const pending = Math.max(0, totalInvoices - totalPayments);
  openModal({
    title: "Resumen del pago",
    subtitle: "El saldo nunca se presenta como crédito hasta definir la política de sobrepagos.",
    body: `<div class="metrics-grid metrics-small"><article class="metric-card"><p>Saldo anterior</p><strong>${money(0)}</strong></article><article class="metric-card"><p>Total facturas</p><strong>${money(totalInvoices)}</strong></article><article class="metric-card"><p>Total pagos</p><strong>${money(totalPayments)}</strong></article><article class="metric-card"><p>Total pendientes</p><strong>${money(pending)}</strong></article></div>${totalPayments > totalInvoices ? `<div class="callout callout-warning">Existe un excedente no asignado de ${money(totalPayments-totalInvoices)}. No se aplicó como crédito ni anticipo.</div>` : ""}`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cerrar</button><button class="btn btn-primary" data-action="print-receivables">Imprimir</button><button class="btn btn-secondary" disabled title="Requiere reglas de snapshot histórico">Guardar cambios</button>`
  });
}

function printPayment(paymentId) {
  const payment = store.getState().payments.find((candidate) => candidate.id === paymentId);
  if (!payment) throw new Error("Pago no encontrado.");
  const patient = store.patientById(payment.patientId);
  openPrintWindow(`<div class="header"><div class="brand"><div class="mark">AC</div><strong>Analiza en Casa</strong></div><div class="doc-title"><h1>Comprobante de pago</h1><small>Documento DEMO</small></div></div><div class="grid"><div class="field"><small>Comprobante</small><strong>${safeText(payment.receipt)}</strong></div><div class="field"><small>Paciente</small><strong>${safeText(patient?.fullName || "—")}</strong></div><div class="field"><small>Fecha</small><strong>${safeText(String(payment.date).slice(0,10))}</strong></div><div class="field"><small>Método</small><strong>${safeText(payment.method)}</strong></div><div class="field"><small>Pagado por</small><strong>${safeText(payment.payer)}</strong></div><div class="field"><small>Monto</small><strong>${money(payment.amount)}</strong></div><div class="field"><small>Estado</small><strong>${safeText(payment.status)}</strong></div></div><p>Datos completamente ficticios para QA funcional.</p>`, payment.receipt || payment.id);
}

function receivableExportRows(filtered = false) {
  const state = store.getState();
  const search = filtered ? String(ui.receivablesSearch || "").toLocaleLowerCase("es") : "";
  return currentQuotesForExport(state).filter((quote) => {
    const patient = store.patientById(quote.patientId);
    return !search || [patient?.fullName, patient?.document, quote.caseId].some((value) => String(value || "").toLocaleLowerCase("es").includes(search));
  }).map((quote) => ({ hospitalization: quote.caseId, patient: store.patientById(quote.patientId)?.fullName, totalInvoices: quote.patientAmount, totalPayments: state.payments.filter((payment) => payment.quoteId === quote.id && payment.status === "APPLIED").reduce((sum,payment)=>sum+payment.amount,0), pending: quoteBalance(quote,state.payments) }));
}

function currentQuotesForExport(state) {
  return [...state.quotes.reduce((roots, quote) => { const root=quote.quoteId||quote.originalQuoteId||quote.id; const prior=roots.get(root); if(!prior||Number(quote.version||0)>=Number(prior.version||0)) roots.set(root,quote); return roots; },new Map()).values()];
}

function openClinicalDocumentForm(caseId = "", type = "HEALTH_REPORT", patientId = "") {
  if (type === "MEDICAL_ORDER") return openMedicalOrderForm(caseId, patientId);
  const state = store.getState();
  const record = state.cases.find((c) => c.id === caseId) || state.cases.find((c) => !patientId || c.patientId === patientId) || state.cases[0];
  openModal({
    title: `Nuevo ${documentTypeLabel(type).toLowerCase()}`,
    subtitle: "El documento se guarda como borrador, admite versión, firma, impresión y auditoría.",
    size: "lg",
    body: `<form id="clinical-document-form" class="form-grid">
      <input type="hidden" name="type" value="${type}">
      <label class="full">Hospitalización<select name="caseId">${caseOptions(record?.id)}</select></label>
      <label class="full">Título<input name="title" value="${documentTypeLabel(type)} · ${new Date().toLocaleDateString("es-SV")}" required></label>
      <label class="full">Resumen clínico<textarea name="summary" rows="4" required placeholder="Resumen claro y verificable..."></textarea></label>
      <label class="full">Diagnóstico / situación actual<textarea name="diagnosis" rows="3"></textarea></label>
      <label class="full">Antecedentes<input name="background" placeholder="Separar por comas"></label>
      <label class="full">Alergias<input name="allergies" placeholder="Separar por comas"></label>
      <label class="full">Dispositivos / accesos<input name="devices" placeholder="Separar por comas"></label>
      <label class="full">Plan / indicaciones<textarea name="plan" rows="5"></textarea></label>
      <label class="full"><input type="checkbox" name="signNow"> Firmar al guardar</label>
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-clinical-document">Guardar documento</button>`
  });
}

const MEDICAL_ORDER_SECTIONS = [
  ["diet", "Dieta"],
  ["nursingCare", "Cuidados de Enfermería"],
  ["venoclysis", "Venoclisis"],
  ["medications", "Medicamentos"],
  ["therapies", "Terapias"],
  ["laboratories", "Laboratorios"],
  ["other", "Otros"],
  ["oxygen", "Oxígeno"],
  ["fluidBalance", "Balance Hídrico + Diuresis"],
  ["support", "Respaldo"],
  ["vitalSigns", "Signos Vitales"]
];

function openClinicalCreationChoice(caseId = "") {
  openModal({
    title: "¿Qué quieres crear?",
    subtitle: "Selecciona el documento clínico para la hospitalización autorizada.",
    size: "md",
    body: `<div class="choice-stack"><button class="btn btn-primary" data-action="choose-medical-order" data-case-id="${safeText(caseId)}">Orden Médica</button><button class="btn btn-secondary" data-action="choose-medication-card" data-case-id="${safeText(caseId)}">Tarjeta de medicamentos</button></div>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cerrar</button>`
  });
}

function orderPatientSummary(record) {
  const state = store.getState();
  const patient = record ? store.patientById(record.patientId) : null;
  const profile = state.clinicalProfiles.find((item) => item.caseId === record?.id);
  return `<div class="details-grid full"><div><span>Paciente</span><strong>${safeText(patient?.fullName || "—")}</strong></div><div><span>Cédula</span><strong>${safeText(patient?.document || "—")}</strong></div><div><span>Hospitalización</span><strong>${safeText(record?.id || "—")}</strong></div><div><span>Triage</span><strong>${safeText(profile?.triage || "No asignado")}</strong></div></div>`;
}

function openMedicalOrderForm(caseId = "", patientId = "") {
  const state = store.getState();
  const record = state.cases.find((item) => item.id === caseId) || state.cases.find((item) => !patientId || item.patientId === patientId) || state.cases[0];
  openModal({
    title: "Orden médica nueva",
    subtitle: "Borrador clínico versionado. Las secciones sólo guardan lo documentado por el profesional autorizado.",
    size: "xl",
    body: `<form id="medical-order-form" class="form-grid">
      <label class="full">Hospitalización<select name="caseId" data-action="medical-order-case-change">${caseOptions(record?.id)}</select></label>
      ${orderPatientSummary(record)}
      <label>Médico tratante<select name="treatingDoctorId" required><option value="">Seleccione</option>${doctorOptions(record?.contractingDoctorId)}</select></label>
      <label>Otros médicos tratantes<select name="otherDoctorIds" multiple>${doctorOptions()}</select></label>
      <label class="full">Diagnósticos documentados<textarea name="diagnosis" maxlength="2000" rows="2"></textarea></label>
      <fieldset class="full"><legend>Orden médica · plan de cuidados</legend><p class="field-hint">Selecciona únicamente las secciones indicadas. No se calculan indicaciones clínicas.</p>
        <div class="order-section-picker">${MEDICAL_ORDER_SECTIONS.map(([key,label],index) => `<label><input type="checkbox" name="section-${key}" ${index < 2 ? "checked" : ""}> ${safeText(label)}</label><textarea name="content-${key}" rows="3" maxlength="5000" placeholder="Contenido documentado para ${safeText(label)}"></textarea>`).join("")}</div>
      </fieldset>
      <input type="hidden" name="idempotencyKey" value="${uid("MEDICAL-ORDER")}">
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Atrás</button><button class="btn btn-primary" data-action="save-medical-order">Guardar borrador</button>`
  });
}

function openPatientOrders(caseId) {
  const state = store.getState();
  const record = state.cases.find((item) => item.id === caseId);
  if (!record) return showToast("Hospitalización no encontrada.", "danger");
  const documents = state.clinicalDocuments.filter((item) => item.caseId === caseId && item.type === "MEDICAL_ORDER");
  const cards = state.medicationCards.filter((item) => item.caseId === caseId);
  const treatments = cards.flatMap((cardData) => (cardData.items || []).map((item) => ({...item, cardId: cardData.id, documentStatus: cardData.documentStatus})));
  const docRows = documents.map((item) => `<tr><td><button class="row-action" data-action="view-document" data-id="${safeText(item.id)}">Ver</button></td><td>${safeText(item.id)}</td><td>${safeText(item.status)}</td><td>${safeText(item.authorName)}</td><td>${safeText(item.updatedAt || item.createdAt)}</td><td>Regla PMC pendiente</td></tr>`);
  const cardRows = cards.map((item) => `<tr><td><button class="row-action" data-action="print-medication-card" data-id="${safeText(item.id)}" data-variant="complete">Imprimir</button></td><td>${safeText(item.id)}</td><td>${safeText(item.documentStatus)}</td><td>${safeText(item.createdByName || item.createdBy || "—")}</td><td>${safeText(item.updatedAt || item.createdAt)}</td><td>Regla PMC pendiente</td></tr>`);
  const treatmentRows = treatments.map((item) => `<tr><td>${safeText(item.medication)}</td><td>${safeText(item.dose)}</td><td>${safeText(item.route)}</td><td>${safeText(item.frequency)}</td><td>${safeText(item.startDate)} → ${safeText(item.endDate || "—")}</td><td>${safeText(item.documentStatus)}</td></tr>`);
  openModal({
    title: "Órdenes",
    subtitle: `${record.id} · ${store.patientById(record.patientId)?.fullName || "Paciente"}`,
    size: "xl",
    body: `${orderPatientSummary(record)}<div class="tabs" aria-label="Consulta de documentos"><span class="tab active">Órdenes médicas (${documents.length})</span><span class="tab">Tarjetas de medicamentos (${cards.length})</span><span class="tab">Historial de tratamientos (${treatments.length})</span></div><section><h3>Órdenes médicas</h3>${simpleTable(["Acciones","Código","Estatus","Actualizado por","Última actualización","Estatus PMC"],docRows)}</section><section><h3>Tarjetas de medicamentos</h3>${simpleTable(["Acciones","Código","Estatus","Actualizado por","Última actualización","Estatus PMC"],cardRows)}</section><section><h3>Historial de tratamientos</h3>${simpleTable(["Tratamiento","Dosis","Vía","Frecuencia","Vigencia","Documento"],treatmentRows)}</section>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cerrar</button><button class="btn btn-primary" data-action="open-clinical-creation-choice" data-case-id="${safeText(caseId)}">+ Nuevo</button>`
  });
}

function simpleTable(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th>${safeText(header)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.join("") : `<tr><td colspan="${headers.length}">No hay registros disponibles.</td></tr>`}</tbody></table></div>`;
}

function openClinicalCorrectionForm(subjectType, subjectId) {
  const state = store.getState();
  const record = subjectType === "CLINICAL_DOCUMENT"
    ? state.clinicalDocuments.find((item) => item.id === subjectId)
    : subjectType === "NURSING_NOTE"
      ? state.nursingNotes.find((item) => item.id === subjectId)
      : state.medicationCards.find((item) => item.id === subjectId);
  if (!record) return showToast("Registro clínico no encontrado.", "danger");
  openModal({
    title: "Corrección clínica auditada",
    subtitle: "Crea un addendum, enmienda o fe de erratas. El registro firmado original no se modifica.",
    size: "lg",
    body: `<form id="clinical-correction-form" class="form-grid">
      <input type="hidden" name="subjectType" value="${subjectType}"><input type="hidden" name="subjectId" value="${subjectId}">
      <label>Tipo<select name="kind"><option value="ADDENDUM">Addendum</option><option value="AMENDMENT">Enmienda</option><option value="ERRATA">Fe de erratas</option></select></label>
      <label class="full">Motivo<textarea name="reason" rows="3" required placeholder="Motivo verificable de la corrección"></textarea></label>
      <label class="full">Contenido corregido o complementario<textarea name="content" rows="6" required placeholder="Información corregida o complementaria"></textarea></label>
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-clinical-correction">Registrar corrección</button>`
  });
}

function openClinicalVoidForm(subjectType, subjectId) {
  openModal({
    title: "Anular registro clínico",
    subtitle: "La anulación conserva el registro, exige permiso específico y deja auditoría.",
    size: "md",
    body: `<form id="clinical-void-form" class="form-grid">
      <input type="hidden" name="subjectType" value="${subjectType}"><input type="hidden" name="subjectId" value="${subjectId}">
      <label class="full">Motivo de la anulación<textarea name="reason" rows="4" required></textarea></label>
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-danger" data-action="save-clinical-void">Anular y conservar historial</button>`
  });
}

function documentTypeLabel(type) {
  return {
    HEALTH_REPORT: "Reporte de salud",
    MEDICAL_ORDER: "Orden médica",
    CARE_PLAN: "Plan de cuidados",
    CLINICAL_EVOLUTION: "Evolución clínica",
    LAB_REQUEST: "Solicitud de laboratorio",
    MEDICATION_CARD: "Tarjeta de medicamentos"
  }[type] || "Documento clínico";
}

function openVitalsForm(caseId = "") {
  const record = store.getState().cases.find((c) => c.id === caseId) || store.getState().cases[0];
  openModal({
    title: "Registrar signos vitales",
    subtitle: `${record?.id} · ${store.patientById(record?.patientId)?.fullName}`,
    size: "md",
    body: `<form id="vitals-form" class="form-grid">
      <label class="full">Hospitalización<select name="caseId">${caseOptions(record?.id)}</select></label>
      <label>Temperatura °C<input type="number" step=".1" name="temperature" value="36.7" required></label>
      <label>Frecuencia cardíaca<input type="number" name="heartRate" value="78" required></label>
      <label>Frecuencia respiratoria<input type="number" name="respiratoryRate" value="17" required></label>
      <label>SpO₂ %<input type="number" name="spo2" value="97" required></label>
      <label>Presión sistólica<input type="number" name="systolic" value="122" required></label>
      <label>Presión diastólica<input type="number" name="diastolic" value="76" required></label>
      <label>Dolor 0–10<input type="number" min="0" max="10" name="pain" value="2"></label>
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-vitals">Guardar control</button>`
  });
}

function openNursingNoteForm(caseId = "") {
  const record = store.getState().cases.find((c) => c.id === caseId) || store.getState().cases[0];
  openModal({
    title: "Nueva nota de enfermería",
    subtitle: "Al firmar, la enfermera no puede editarla. Correcciones posteriores quedan auditadas por un rol autorizado.",
    size: "lg",
    body: `<form id="nursing-note-form" class="form-grid">
      <label class="full">Hospitalización<select name="caseId">${caseOptions(record?.id)}</select></label>
      <label class="full">Nota<textarea name="text" rows="9" required placeholder="Estado del paciente, cuidados, respuesta, incidencias e indicaciones cumplidas..."></textarea></label>
      <label class="full"><input type="checkbox" name="sign" checked> Firmar y bloquear al guardar</label>
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-nursing-note">Guardar nota</button>`
  });
}

const VISIT_TYPE_OPTIONS = [
  ["NURSING_CARE", "Cuidado de enfermería"],
  ["SUPERVISION", "Supervisión"],
  ["MEDICAL_VISIT", "Visita médica"],
  ["DAILY_RECORD", "Registro diario"],
  ["SWALLOWING_THERAPY", "Terapia de deglución"],
  ["OCCUPATIONAL_THERAPY", "Terapia ocupacional"],
  ["PHYSIOTHERAPY", "Fisioterapia"],
  ["NUTRITION", "Nutricionista"],
  ["CAREGIVER", "Cuidador"],
  ["CLINICAL_PSYCHOLOGY", "Consulta Psicología Clínica"],
  ["SOCIAL_WORK", "Trabajador Social"],
  ["SPIRITUAL_VISIT", "Visita Espiritual"],
  ["TECHNICAL_NURSING_CARE", "Cuidados Técnicos de Enfermería"],
  ["SPECIAL_LABORATORY", "Laboratorio Especial"],
  ["GERIATRICS", "Visita de Geriatría"],
  ["TERTIARY_LABORATORY", "Laboratorio Tercerizado"],
  ["RESPIRATORY_VISIT", "Visita Respiratoria General"]
];

function visitCaseSummary(record) {
  const state = store.getState();
  const patient = record ? store.patientById(record.patientId) : null;
  const insurer = state.insurers.find((item) => item.id === record?.insurerId);
  return {
    patientName: patient?.fullName || "—",
    document: patient?.document || "—",
    company: insurer?.name || "No documentada"
  };
}

function openShiftForm(caseId = "") {
  const state = store.getState();
  const record = state.cases.find((item) => item.id === caseId) || state.cases.find((item) => item.status === "ACTIVE") || state.cases[0];
  const summary = visitCaseSummary(record);
  const tomorrow = new Date(Date.now() + 86400000);
  const date = tomorrow.toISOString().slice(0, 10);
  openModal({
    title: "Crear turno a paciente",
    subtitle: "La recurrencia y los descuentos no se ejecutan hasta confirmar sus reglas operativas y financieras.",
    size: "lg",
    body: `<form id="shift-form" class="form-grid">
      <label class="full">Paciente / hospitalización<select name="caseId" data-action="shift-case-change" required>${caseOptions(record?.id)}</select></label>
      <label>Paciente<input name="patientName" value="${safeText(summary.patientName)}" readonly></label>
      <label>Cédula<input name="document" value="${safeText(summary.document)}" readonly></label>
      <label>Empresa<input name="company" value="${safeText(summary.company)}" readonly></label>
      <label>Fecha inicio<input type="datetime-local" name="start" value="${date}T06:00" required></label>
      <label>Fecha fin<input type="datetime-local" name="end" value="${date}T18:00" required></label>
      <label>Frecuencia documentada<input name="frequency" value="Cada 8 horas" maxlength="160" required><small>No genera recurrencias automáticamente.</small></label>
      <label>Número de veces<input type="number" name="occurrenceCount" value="1" min="1" max="1" required><small>Más de una visita requiere reglas confirmadas.</small></label>
      <label>Clasificación<select name="classification" required><option value="PUNTUAL">Puntual</option><option value="TURNO">Turno</option></select></label>
      <label>Tipo<select name="type" required>${VISIT_TYPE_OPTIONS.map(([value,label]) => `<option value="${value}">${safeText(label)}</option>`).join("")}</select></label>
      <label class="full"><input type="checkbox" name="applyDiscount" disabled> Aplicar descuento <small>Bloqueado hasta confirmar autorización, motivo, vigencia y cálculo.</small></label>
      <input type="hidden" name="idempotencyKey" value="${uid("VISIT")}">
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cerrar</button><button class="btn btn-primary" data-action="save-shift">Guardar</button>`
  });
}

function openVisitDetail(id) {
  const state = store.getState();
  const shift = state.shifts.find((item) => item.id === id);
  if (!shift) return showToast("Visita no encontrada.", "danger");
  const record = store.caseById(shift.caseId);
  const patient = store.patientById(shift.patientId);
  const visitTypeLabel = VISIT_TYPE_OPTIONS.find(([value]) => value === shift.type)?.[1] || String(shift.type || "Visita").replaceAll("_"," ");
  const resources = state.users.filter((item) => item.status === "ACTIVE" && ["NURSE","DOCTOR"].includes(item.role));
  const isTerminal = ["COMPLETED","CANCELLED"].includes(shift.status);
  openModal({
    title: `${visitTypeLabel} · ${shift.status === "COMPLETED" ? "Visita finalizada" : "Visita programada"}`,
    subtitle: `${shift.id} · versión operativa auditable`,
    size: "xl",
    body: `<form id="visit-detail-form" class="form-grid"><input type="hidden" name="shiftId" value="${safeText(shift.id)}"><input type="hidden" name="idempotencyKey" value="${uid("SHIFT-ASSIGN")}">
      <div class="tabs full" aria-label="Detalle de visita"><span class="tab active">Agenda</span><span class="tab">Actualizaciones</span></div>
      <label>Inicio<input value="${safeText(shift.start)}" readonly></label><label>Fin<input value="${safeText(shift.end)}" readonly></label>
      <label>Paciente<input value="${safeText(patient?.fullName || "—")}" readonly></label><label>Hospitalización<input value="${safeText(record?.id || "—")}" readonly></label>
      <label>Clasificación<input value="${safeText(shift.classification || "No documentada")}" readonly></label><label>Estado<input value="${safeText(shift.status)}" readonly></label>
      <label class="full">Recursos<select name="resourceId" required ${isTerminal ? "disabled" : ""}><option value="">Seleccione</option>${resources.map((resource) => `<option value="${resource.id}" ${resource.id === shift.resourceId ? "selected" : ""}>${safeText(resource.name)} · ${safeText(resource.role)}</option>`).join("")}</select>${isTerminal ? "<small>La asignación queda inmutable al finalizar o cancelar la visita.</small>" : ""}</label>
      <fieldset class="full"><legend>Tipo de turno</legend><label><input type="radio" disabled> Primer turno</label><label><input type="radio" disabled> Turno de seguimiento</label><label><input type="radio" disabled> Último turno</label><small>La secuencia requiere una regla confirmada.</small></fieldset>
      <label class="full">Tarifa<input value="Regla tarifaria pendiente" readonly></label>
      <label class="full"><input type="checkbox" disabled> Aplicar descuento <small>Sin regla financiera confirmada.</small></label>
      <button type="button" class="btn btn-secondary full" data-action="blocked-professional-payment">Editar pago de servicios profesionales</button>
      <section class="full form-section"><h3>Ajustes de pago</h3>${simpleTable(["Motivo","Monto","Comentario"], [])}</section>
      <label class="full">Observaciones internas<textarea name="internalObservations" maxlength="5000" ${isTerminal ? "readonly" : ""}>${safeText(shift.internalObservations || "")}</textarea></label>
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cerrar</button>${isTerminal ? "" : '<button class="btn btn-primary" data-action="save-shift-assignment">Guardar</button>'}`
  });
}

function professionalPaymentService(id) {
  return store.getState().doctorServices.find((item) => item.id === id) || null;
}

function professionalVisitStatus(state, service) {
  const shift = state.shifts.find((item) => item.caseId === service.caseId && item.patientId === service.patientId && String(item.start || "").slice(0, 10) === String(service.date || "").slice(0, 10));
  if (!shift) return "No documentado";
  if (shift.status === "COMPLETED") return "Finalizada";
  if (shift.status === "CANCELLED") return "Cancelada";
  return "Iniciada";
}

function openProfessionalServicePayment(id) {
  const state = store.getState();
  const service = professionalPaymentService(id);
  if (!service) return showToast("Pago de servicio no encontrado.", "danger");
  const doctor = state.doctors.find((item) => item.id === service.doctorId);
  const patient = state.patients.find((item) => item.id === service.patientId);
  ui.professionalPaymentServiceId = service.id;
  openModal({
    title: "Pago de servicios profesionales",
    subtitle: "Revisión del servicio. Los cambios monetarios permanecen bloqueados hasta aprobar reglas y autorizaciones.",
    size: "lg",
    body: `<form id="professional-payment-form" class="form-grid professional-payment-form">
      <label>Fecha<input name="date" value="${safeText(service.date || "")}" readonly></label>
      <label>Hospitalización<input name="hospitalization" value="${safeText(service.caseId || "—")}" readonly></label>
      <label>Recurso<input name="resource" value="${safeText(doctor?.name || "Recurso no encontrado")}" readonly></label>
      <label>Paciente<input name="patient" value="${safeText(patient?.fullName || "Paciente no encontrado")}" readonly></label>
      <label>Tarifa<input name="rate" value="${safeText(money(Number(service.rate || 0)))}" readonly></label>
      <label>Monto<input name="amount" value="${safeText(money(Number(service.quantity || 0) * Number(service.rate || 0)))}" readonly></label>
      <label>Estatus<input name="status" value="${safeText(service.status || "PENDING")}" readonly></label>
      <label>Estado visita<input value="${safeText(professionalVisitStatus(state, service))}" readonly></label>
      <label class="full">Comentarios<textarea name="comments" rows="3" readonly placeholder="Requiere reglas aprobadas para edición."></textarea></label>
      <section class="full form-section professional-concepts"><div class="section-heading"><div><h3>Conceptos</h3><p>Las líneas de añadidura o descuento deben ser append-only y auditables.</p></div><button type="button" class="btn btn-secondary" data-action="open-professional-concept" data-id="${safeText(service.id)}">Agregar</button></div>
        <div class="table-wrap"><table><thead><tr><th>Tipo</th><th>Motivo</th><th>Monto</th><th>Comentario</th></tr></thead><tbody><tr><td colspan="4" class="muted-cell">Sin conceptos registrados.</td></tr></tbody></table></div>
      </section>
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="blocked-payables-mutation">Guardar</button>`
  });
}

function openProfessionalPaymentConcept(id = ui.professionalPaymentServiceId) {
  const service = professionalPaymentService(id);
  if (!service) return showToast("Pago de servicio no encontrado.", "danger");
  ui.professionalPaymentServiceId = service.id;
  const reasons = ui.professionalConceptType === "DISCOUNT" ? PROFESSIONAL_DISCOUNT_REASONS : PROFESSIONAL_ADDITION_REASONS;
  if (!reasons.includes(ui.professionalConceptReason)) ui.professionalConceptReason = "";
  openModal({
    title: "Agregar Concepto",
    subtitle: "Catálogo documental observado en CH12; no define por sí solo cálculo, contabilidad ni autorización.",
    size: "md",
    body: `<form id="professional-concept-form" class="form-grid">
      <label>Tipo*<select name="type" data-action="professional-concept-type" required><option value="ADDITION" ${ui.professionalConceptType === "ADDITION" ? "selected" : ""}>Añadidura</option><option value="DISCOUNT" ${ui.professionalConceptType === "DISCOUNT" ? "selected" : ""}>Descuento</option></select></label>
      <label>Motivo*<select name="reason" data-action="professional-concept-reason" required><option value="">Seleccione</option>${reasons.map((reason) => `<option value="${safeText(reason)}" ${ui.professionalConceptReason === reason ? "selected" : ""}>${safeText(reason)}</option>`).join("")}</select></label>
      <label>Monto*<input type="number" name="amount" min="0.01" step="0.01" placeholder="0.00" required></label>
      <label class="full">Comentario<textarea name="comment" rows="3" maxlength="1000"></textarea></label>
      <p class="full blocked-note">La acción Agregar no modifica saldos hasta confirmar motivos, permisos, cálculo, impuestos, retenciones, aprobación y reversión.</p>
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="back-professional-payment">Cancelar</button><button class="btn btn-primary" data-action="blocked-payables-mutation">Agregar</button>`
  });
}

function payablesExportRows() {
  const state = store.getState();
  return state.doctorServices.map((service) => ({
    servicio: service.id,
    recurso: state.doctors.find((item) => item.id === service.doctorId)?.name || "",
    fecha_visita: service.date || "",
    referencia_paciente: service.patientId || "",
    hospitalizacion: service.caseId || "",
    monto: Number(service.quantity || 0) * Number(service.rate || 0),
    estatus_pago: service.status || "",
    estatus_visita: professionalVisitStatus(state, service)
  }));
}

function purchaseDraftTotals(draft = ui.purchaseDraft) {
  const items = draft?.items || [];
  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || 0), 0);
  const tax = items.reduce((sum, item) => sum + Number(item.taxAmount || 0), 0);
  const discount = items.reduce((sum, item) => sum + Number(item.discountAmount || 0), 0);
  const extra = Number(draft?.extraAmount || 0);
  return { subtotal, tax, discount, extra, total: subtotal + tax + extra - discount };
}

function capturePurchaseDraft(form) {
  if (!form || !ui.purchaseDraft) return;
  const values = Object.fromEntries(new FormData(form));
  ui.purchaseDraft.date = values.date || ui.purchaseDraft.date;
  ui.purchaseDraft.invoiceNumber = String(values.invoiceNumber || "").trim();
  ui.purchaseDraft.observations = String(values.observations || "").trim();
  ui.purchaseDraft.headerSupplierId = String(values.headerSupplierId || ui.purchaseDraft.headerSupplierId || "");
  ui.purchaseDraft.extraAmount = Number(values.extraAmount || 0);
}

function openPurchaseTypeChooser() {
  ui.purchaseDraft = null;
  openModal({
    title: "¿Qué quieres crear?",
    subtitle: "Selecciona la modalidad observada en CH13.",
    body: `<div class="purchase-kind-grid">
      <button class="purchase-kind-card" data-action="choose-purchase-kind" data-kind="ORDER"><strong>Orden de compra</strong><span>Solicitud con proveedor, presentación y líneas múltiples.</span></button>
      <button class="purchase-kind-card" data-action="choose-purchase-kind" data-kind="PETTY_CASH"><strong>Caja menuda</strong><span>Factura ejecutada con montos manuales de impuesto, descuento y extra.</span></button>
    </div>`
  });
}

function purchaseCatalogOptions(selected = "") {
  const state = store.getState();
  return state.catalogItems.filter((item) =>
    item.organizationId === state.organization.id && item.active !== false && item.status !== "INACTIVE"
  ).map((item) => {
    const stock = state.inventoryItems.filter((inventory) => inventory.catalogItemId === item.id).reduce((sum, inventory) => sum + Number(inventory.stock || 0), 0);
    return `<option value="${safeText(item.id)}" ${item.id === selected ? "selected" : ""}>${safeText(item.sku)} · ${safeText(item.name)} · existencia ${stock}</option>`;
  }).join("");
}

function purchaseSupplierOptions(selected = "") {
  const state = store.getState();
  return state.suppliers.filter((supplier) =>
    supplier.organizationId === state.organization.id && supplier.status !== "INACTIVE"
  ).map((supplier) =>
    `<option value="${safeText(supplier.id)}" ${supplier.id === selected ? "selected" : ""}>${safeText(supplier.name)}</option>`
  ).join("");
}

function openPurchaseForm(kind = "ORDER") {
  const state = store.getState();
  if (!ui.purchaseDraft || ui.purchaseDraft.kind !== kind) {
    ui.purchaseDraft = {
      kind,
      date: new Date().toISOString().slice(0, 10),
      invoiceNumber: "",
      observations: "",
      headerSupplierId: "",
      extraAmount: 0,
      idempotencyKey: uid("PURCHASE-DRAFT"),
      items: []
    };
  }
  const draft = ui.purchaseDraft;
  const pettyCash = draft.kind === "PETTY_CASH";
  const totals = purchaseDraftTotals(draft);
  const itemRows = draft.items.map((item, index) => `<tr>
    ${pettyCash ? "" : `<td>${safeText(state.suppliers.find((supplier) => supplier.id === item.supplierId)?.name || "Proveedor no disponible")}</td>`}
    <td>${safeText(item.name)}</td><td>${money(item.unitCost)}</td><td>${Number(item.quantity)}</td><td>${safeText(item.presentation)}</td>
    ${pettyCash ? `<td>${money(item.taxAmount)}</td><td>${money(item.discountAmount)}</td>` : ""}
    <td>${money(Number(item.quantity) * Number(item.unitCost) + Number(item.taxAmount || 0) - Number(item.discountAmount || 0))}</td>
    <td><button class="icon-button" data-action="remove-purchase-item" data-index="${index}" aria-label="Eliminar ${safeText(item.name)}">×</button></td>
  </tr>`).join("");
  openModal({
    title: pettyCash ? "Nueva compra caja menuda" : "Nueva compra",
    subtitle: "El guardado crea únicamente un borrador remoto; no aprueba, recibe, anula ni mueve inventario.",
    size: "xl",
    body: `<form id="purchase-form" class="form-grid purchase-compose">
      <input type="hidden" name="kind" value="${safeText(draft.kind)}">
      <label>Fecha*<input type="date" name="date" value="${safeText(draft.date)}" required></label>
      ${pettyCash ? `<label>Proveedor*<select name="headerSupplierId" required><option value="">Seleccione</option>${purchaseSupplierOptions(draft.headerSupplierId)}</select></label>` : ""}
      <label>Número de factura${pettyCash ? "*" : ""}<input name="invoiceNumber" maxlength="160" value="${safeText(draft.invoiceNumber)}" ${pettyCash ? "required" : ""}></label>
      ${pettyCash ? `<label class="upload-zone">Archivo Factura*<input type="file" disabled aria-describedby="purchase-file-note"><small id="purchase-file-note">Buscar — carga bloqueada hasta confirmar almacenamiento privado, validación y retención. El borrador puede guardarse sin adjunto.</small></label>` : ""}
      <label class="full">Observaciones<textarea name="observations" rows="3" maxlength="5000">${safeText(draft.observations)}</textarea></label>
      <div class="form-section full"><h3>Ítem de compra</h3><p>El catálogo muestra código, descripción y existencia. El costo se captura manualmente; no se inventa una tarifa histórica.</p></div>
      <label class="full">Buscar ítem<input type="search" data-input="purchase-catalog-search" placeholder="Código, descripción o existencia"></label>
      <label class="full">Ítem*<select name="catalogItemId" required><option value="">Seleccione</option>${purchaseCatalogOptions()}</select></label>
      ${pettyCash ? "" : `<label>Proveedor*<select name="lineSupplierId" required><option value="">Seleccione</option>${purchaseSupplierOptions()}</select></label>`}
      <label>Presentación*<input name="presentation" maxlength="160" placeholder="Presentación documentada" required></label>
      <label>Costo*<input type="number" name="unitCost" min="0" step="0.01" required></label>
      <label>Cantidad*<input type="number" name="quantity" min="0.001" step="0.001" required></label>
      ${pettyCash ? `<label>Monto impuesto<input type="number" name="taxAmount" min="0" step="0.01" value="0"></label><label>Monto descuento<input type="number" name="discountAmount" min="0" step="0.01" value="0"></label>` : `<input type="hidden" name="taxAmount" value="0"><input type="hidden" name="discountAmount" value="0">`}
      <div class="full purchase-line-actions"><button type="button" class="btn btn-secondary" data-action="blocked-purchase-presentation">+ Presentación</button><button type="button" class="btn btn-primary" data-action="add-purchase-item">Añadir</button></div>
      <div class="full table-wrap"><table><thead><tr>${pettyCash ? "" : "<th>Proveedor</th>"}<th>Ítem</th><th>Costo</th><th>Cantidad</th><th>Presentación</th>${pettyCash ? "<th>Impuesto</th><th>Descuento</th>" : ""}<th>Total</th><th></th></tr></thead><tbody>${itemRows || `<tr><td colspan="${pettyCash ? 8 : 7}">Añade al menos un ítem para guardar el borrador.</td></tr>`}</tbody></table></div>
      ${pettyCash ? `<div class="full purchase-summary"><label>Extra<input type="number" name="extraAmount" min="0" step="0.01" value="${safeText(draft.extraAmount)}" data-input="purchase-extra"></label><dl><div><dt>Subtotal</dt><dd data-purchase-total="subtotal">${money(totals.subtotal)}</dd></div><div><dt>Descuentos</dt><dd data-purchase-total="discount">${money(totals.discount)}</dd></div><div><dt>Extra</dt><dd data-purchase-total="extra">${money(totals.extra)}</dd></div><div><dt>Impuesto</dt><dd data-purchase-total="tax">${money(totals.tax)}</dd></div><div><dt>Total</dt><dd data-purchase-total="total">${money(totals.total)}</dd></div></dl></div>` : ""}
      <p class="full blocked-note">Aprobación, recepción, Registro PT, adjuntos, edición, copia, anulación e inventario permanecen bloqueados hasta confirmar sus reglas.</p>
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="back-purchase-kind">Atrás</button><button class="btn btn-primary" data-action="save-purchase">Guardar borrador</button>`
  });
}

function openPurchaseDetail(id) {
  const state = store.getState();
  const purchase = state.purchases.find((candidate) => candidate.id === id);
  if (!purchase) return showToast("Compra no encontrada.", "danger");
  const supplier = state.suppliers.find((candidate) => candidate.id === purchase.supplierId);
  const items = purchase.items || [];
  openModal({
    title: "Detalles de compra",
    subtitle: "Vista de cabecera, líneas y totales; no cambia el estado financiero.",
    size: "xl",
    body: `<dl class="detail-list purchase-detail-grid"><div><dt>Fecha</dt><dd>${safeText(purchase.date || "—")}</dd></div><div><dt># Orden</dt><dd>${safeText(purchase.code || purchase.id)}</dd></div><div><dt># Factura</dt><dd>${safeText(purchase.invoiceNumber || "Sin factura")}</dd></div><div><dt>Estado</dt><dd>${safeText(purchase.status || "DRAFT")}</dd></div><div><dt>Categoría</dt><dd>${safeText(purchase.kind === "PETTY_CASH" ? "Caja menuda" : "Orden de compra")}</dd></div><div><dt>Proveedor</dt><dd>${safeText(supplier?.name || "Según líneas")}</dd></div><div class="full"><dt>Observaciones</dt><dd>${safeText(purchase.observations || "Sin observaciones")}</dd></div><div class="full"><dt>Archivos adjuntos</dt><dd>${purchase.invoiceFileName || purchase.invoiceFile ? `${safeText(purchase.invoiceFileName || purchase.invoiceFile)} · acceso no habilitado` : "Sin archivo persistido"}</dd></div></dl>
      <div class="table-wrap"><table><thead><tr><th>Ítem</th><th>Costo</th><th>Cantidad</th><th>Presentación</th><th>Impuesto</th><th>Descuento</th><th>Total</th></tr></thead><tbody>${items.map((item) => `<tr><td>${safeText(item.name || item.description)}</td><td>${money(item.unitCost)}</td><td>${Number(item.quantity)}</td><td>${safeText(item.presentation || "No documentada")}</td><td>${money(item.taxAmount || 0)}</td><td>${money(item.discountAmount || 0)}</td><td>${money(item.lineTotal ?? Number(item.quantity || 0) * Number(item.unitCost || 0) + Number(item.taxAmount || 0) - Number(item.discountAmount || 0))}</td></tr>`).join("")}</tbody></table></div>
      <dl class="purchase-detail-totals"><div><dt>Subtotal</dt><dd>${money(purchase.subtotal)}</dd></div><div><dt>Extra</dt><dd>${money(purchase.extra || 0)}</dd></div><div><dt>Descuento</dt><dd>${money(purchase.discount)}</dd></div><div><dt>Impuesto</dt><dd>${money(purchase.tax)}</dd></div><div><dt>Total</dt><dd>${money(purchase.total)}</dd></div></dl>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cerrar</button>`
  });
}

function purchaseExportRows(purchases = store.getState().purchases) {
  const state = store.getState();
  return purchases.map((purchase) => ({
    tipo: purchase.kind === "PETTY_CASH" ? "Caja menuda" : "Orden de compra",
    numero: purchase.code || purchase.id,
    proveedor: state.suppliers.find((supplier) => supplier.id === purchase.supplierId)?.name || "",
    total: Number(purchase.total || 0),
    factura: purchase.invoiceNumber || "",
    fecha: purchase.date || "",
    estado: purchase.status || "",
    registro_pt: purchase.registryStatus || "Sin Registro"
  }));
}

function openInventoryMovementForm(itemId = "", caseId = "", type = "") {
  const state = store.getState();
  const item = state.inventoryItems.find((i) => i.id === itemId) || state.inventoryItems[0];
  const lots = (state.inventoryLots || []).filter((lot) => lot.inventoryItemId === item?.id && lot.status === "AVAILABLE");
  openModal({
    title: "Movimiento de inventario",
    subtitle: "Todos los movimientos modifican existencias o comprometidos y quedan auditados.",
    size: "lg",
    body: `<form id="inventory-movement-form" class="form-grid">
      <label class="full">Ítem<select name="inventoryItemId">${state.inventoryItems.map((i) => `<option value="${i.id}" ${i.id === item?.id ? "selected" : ""}>${safeText(i.sku)} · ${safeText(i.name)} · libre ${i.stock-i.committed}</option>`).join("")}</select></label>
      <label>Tipo<select name="type">${["PURCHASE_ENTRY","PATIENT_COMMITMENT","PATIENT_CONSUMPTION","RETURN_TO_STOCK","TRANSFER","POSITIVE_ADJUSTMENT","NEGATIVE_ADJUSTMENT","EXPIRY_DISPOSAL"].map((v)=>`<option value="${v}" ${v===type?"selected":""}>${v.replaceAll("_"," ")}</option>`).join("")}</select></label>
      <label>Cantidad<input type="number" name="quantity" min=".01" step=".01" value="1" required></label>
      <label>Hospitalización<select name="caseId"><option value="">Sin caso</option>${caseOptions(caseId)}</select></label>
      <label>Bodega origen<select name="warehouseFrom">${warehouseOptions(item?.warehouseId)}</select></label>
      <label>Bodega destino<select name="warehouseTo"><option value="">No aplica</option>${warehouseOptions()}</select></label>
      <label>Lote/serie<select name="lotId"><option value="">Sin lote configurado</option>${lots.map((lot) => `<option value="${lot.id}">${safeText(lot.lotNumber || lot.serialNumber || lot.id)}${lot.expiresAt ? ` · vence ${lot.expiresAt}` : ""}</option>`).join("")}</select></label>
      <label>Lote nuevo<input name="lotNumber" placeholder="Sólo para entrada configurada"></label>
      <label>Vencimiento<input type="date" name="lotExpiresAt"></label>
      <label>Referencia<input name="reference" value="MOV-DEMO-${Date.now()}"></label>
      <label class="full">Nota<textarea name="note" rows="3"></textarea></label>
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-inventory-movement">Registrar movimiento</button>`
  });
}

function openClosureForm(caseId = "") {
  const state = store.getState();
  const record = state.cases.find((c) => c.id === caseId) || state.cases.find((c)=>c.status!=="CLOSED") || state.cases[0];
  const reservations = state.inventoryReservations.filter((r) => r.caseId === record?.id);
  openModal({
    title: "Nuevo cierre de inventario",
    subtitle: "El cierre parcial permite revisión. El cierre total requiere aprobación antes de bloquear la cuenta.",
    size: "lg",
    body: `<form id="closure-form" class="form-grid">
      <label>Hospitalización<select name="caseId">${caseOptions(record?.id)}</select></label>
      <label>Tipo<select name="type"><option value="PARTIAL">Parcial</option><option value="TOTAL">Total</option></select></label>
      <label class="full">Observación<textarea name="note" rows="3" required></textarea></label>
      <div class="full">${reservations.length ? `<table><thead><tr><th>Ítem</th><th>Entregado</th><th>Consumido</th><th>Devuelto</th><th>Diferencia</th></tr></thead><tbody>${reservations.map((r)=>{const i=state.inventoryItems.find(x=>x.id===r.inventoryItemId);return `<tr><td>${safeText(i?.name)}</td><td>${r.delivered}</td><td>${r.consumed}</td><td>${r.returned}</td><td>${r.delivered-r.consumed-r.returned}</td></tr>`}).join("")}</tbody></table>` : `<p class="info-callout">No hay reservas registradas; se creará el cierre sin detalle.</p>`}</div>
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-closure">Crear cierre</button>`
  });
}

function openKitForm() {
  const state = store.getState();
  openModal({
    title: "Nuevo kit de insumos",
    subtitle: "Define sus componentes para aplicar la descarga completa a una hospitalización.",
    size: "lg",
    body: `<form id="kit-form" class="form-grid">
      <label>Nombre<input name="name" required placeholder="Kit de curación avanzada"></label>
      <label>Código<input name="code" required value="KIT-${Math.floor(Math.random()*900+100)}"></label>
      <div class="form-section full"><h3>Componentes</h3><p>Selecciona los ítems y establece la cantidad.</p></div>
      ${state.catalogItems.filter(i=>["SUPPLIES","MEDICATIONS"].includes(i.category)).slice(0,8).map((item,index)=>`<label class="full inline-item"><input type="checkbox" name="item-${index}" value="${item.id}"><span>${safeText(item.name)}</span><input type="number" name="qty-${index}" min=".01" step=".01" value="1"></label>`).join("")}
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-kit">Crear kit</button>`
  });
}

function openCatalogForm(category = "", id = "") {
  const state = store.getState();
  const item = id ? state.catalogItems.find((i)=>i.id===id) : null;
  openModal({
    title: item ? `Editar ${item.name}` : "Nuevo ítem de catálogo",
    subtitle: "Datos maestros, costo, tarifa, impuestos, lote/serie y estado.",
    size: "md",
    body: `<form id="catalog-form" class="form-grid">
      <input type="hidden" name="id" value="${safeText(item?.id||"")}">
      <label>Categoría<select name="category">${Object.entries(ITEM_CATEGORY_LABELS).map(([k,v])=>`<option value="${k}" ${(item?.category||category)===k?"selected":""}>${safeText(v)}</option>`).join("")}</select></label>
      <label>SKU<input name="sku" required value="${safeText(item?.sku||`NEW-${Date.now().toString().slice(-5)}`)}"></label>
      <label class="full">Descripción<input name="name" required value="${safeText(item?.name||"")}"></label>
      <label>Unidad<input name="unit" value="${safeText(item?.unit||"unidad")}"></label>
      <label>Costo<input type="number" step=".01" name="cost" value="${item?.cost||0}"></label>
      <label>Precio<input type="number" step=".01" name="price" value="${item?.price||0}"></label>
      <label><input type="checkbox" name="taxable" ${item?.taxable?"checked":""}> Aplica impuesto</label>
      <label><input type="checkbox" name="requiresLot" ${item?.requiresLot?"checked":""}> Requiere lote/serie</label>
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-catalog-item">${item?"Guardar cambios":"Crear ítem"}</button>`
  });
}

function openDiscountForm() {
  openModal({
    title: "Nuevo perfil de descuento",
    subtitle: "Porcentajes máximos por categoría; requiere motivo y puede requerir aprobación.",
    size: "lg",
    body: `<form id="discount-form" class="form-grid">
      <label>Nombre<input name="name" required placeholder="Convenio Empresa Demo"></label>
      <label>Tipo<select name="type"><option>PROFILE</option><option>INSURER</option><option>COMPANY</option><option>PROMOTION</option></select></label>
      ${Object.entries(ITEM_CATEGORY_LABELS).map(([key,label])=>`<label>${safeText(label)} %<input type="number" min="0" max="100" step=".01" name="cat-${key}" value="0"></label>`).join("")}
      <label class="full"><input type="checkbox" name="requiresApproval" checked> Requiere aprobación financiera</label>
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-discount">Crear perfil</button>`
  });
}

function openMedicationCardForm(caseId = "", preserveDraft = false) {
  const state = store.getState();
  const record = state.cases.find((item) => item.id === (caseId || ui.medicationDraft?.caseId)) || state.cases[0];
  if (!preserveDraft || !ui.medicationDraft) {
    ui.medicationDraft = {
      caseId: record?.id || "",
      treatingDoctorId: record?.contractingDoctorId || "",
      otherDoctorIds: [],
      diagnosis: record?.diagnosisSummary || "",
      items: [],
      signNow: false,
      idempotencyKey: uid("MEDICATION-CARD")
    };
  }
  const draft = ui.medicationDraft;
  const selectedCase = state.cases.find((item) => item.id === draft.caseId) || record;
  const selected = (value, expected) => value === expected ? "selected" : "";
  openModal({
    title:"Tarjeta de medicamentos nueva",
    subtitle:"Borrador con encabezado clínico y tratamientos documentados. No genera ni recomienda dosis.",
    size:"xl",
    body:`<form id="medication-card-form" class="form-grid">
      <label class="full">Hospitalización<select name="caseId" data-action="medication-card-case-change">${caseOptions(selectedCase?.id)}</select></label>
      ${orderPatientSummary(selectedCase)}
      <label>Médico tratante<select name="treatingDoctorId" required><option value="">Seleccione</option>${doctorOptions(draft.treatingDoctorId)}</select></label>
      <label>Otros médicos tratantes<select name="otherDoctorIds" multiple>${state.doctors.map((doctor) => `<option value="${doctor.id}" ${draft.otherDoctorIds.includes(doctor.id) ? "selected" : ""}>${safeText(doctor.name)} · ${safeText(doctor.specialty)}</option>`).join("")}</select></label>
      <label class="full">Diagnósticos documentados<textarea name="diagnosis" rows="2" maxlength="2000">${safeText(draft.diagnosis)}</textarea></label>
      <section class="full form-section"><header class="card-header"><div><h3>Tabla de tratamientos</h3><p>Tratamientos del paciente · Actualizaciones</p></div><button type="button" class="btn btn-secondary" data-action="open-treatment-draft">+ Agregar tratamiento</button></header>
        ${simpleTable(["Tratamiento","Dosis","Horarios","Inicio","Duración","Crónico","Indicaciones"], draft.items.map((item,index) => `<tr><td>${safeText(item.medication)}</td><td>${safeText(item.dose)} · ${safeText(item.route)}</td><td>${safeText((item.schedule || []).join(", ") || "—")}</td><td>${safeText(item.startDate)}</td><td>${safeText(item.durationDays ? `${item.durationDays} días` : item.endDate || "—")}</td><td>${item.chronic ? "Sí" : "No"}</td><td>${safeText(item.indications || "—")}<button type="button" class="row-action" data-action="remove-treatment-draft" data-index="${index}" aria-label="Quitar tratamiento">×</button></td></tr>`))}
      </section>
      <label class="full"><input type="checkbox" name="signNow" ${draft.signNow ? "checked" : ""}> Firmar y bloquear al guardar</label>
    </form>`,
    footer:`<button class="btn btn-secondary" data-action="cancel-medication-draft">Atrás</button><button class="btn btn-primary" data-action="save-medication-card">Guardar tarjeta</button>`
  });
}

function syncMedicationDraft() {
  const form = document.querySelector("#medication-card-form");
  if (!form || !ui.medicationDraft) return;
  const data = new FormData(form);
  ui.medicationDraft.caseId = String(data.get("caseId") || "");
  ui.medicationDraft.treatingDoctorId = String(data.get("treatingDoctorId") || "");
  ui.medicationDraft.otherDoctorIds = data.getAll("otherDoctorIds").map(String);
  ui.medicationDraft.diagnosis = String(data.get("diagnosis") || "");
  ui.medicationDraft.signNow = data.has("signNow");
}

function openTreatmentDraftForm() {
  syncMedicationDraft();
  const state = store.getState();
  const medicationNames = state.catalogItems.filter((item) => item.category === "MEDICATIONS").map((item) => item.name);
  const today = new Date().toISOString().slice(0,10);
  openModal({
    title: "Configuración de tratamientos",
    subtitle: "Captura fiel de una indicación existente; no ofrece recomendación clínica.",
    size: "lg",
    body: `<form id="treatment-draft-form" class="form-grid">
      <label class="full">Paciente<input value="${safeText(store.patientById(store.caseById(ui.medicationDraft.caseId)?.patientId)?.fullName || "—")}" disabled></label>
      <label>Medicamento<input name="medication" list="medication-catalog" required maxlength="300"><datalist id="medication-catalog">${medicationNames.map((name) => `<option value="${safeText(name)}"></option>`).join("")}</datalist></label>
      <label>Médico<select name="doctorId" required><option value="">Seleccione</option>${doctorOptions(ui.medicationDraft.treatingDoctorId)}</select></label>
      <label>Vía de administración<select name="route" required><option value="">Seleccione</option><option>IV</option><option>VO</option><option>SC</option><option>IM</option><option value="OTHER">Otra documentada</option></select></label>
      <label>Dosis<input name="dose" required maxlength="160" autocomplete="off"></label>
      <label>Frecuencia<select name="frequency" required><option value="">Seleccione</option><option>Cada 4 horas</option><option>Cada 6 horas</option><option>Cada 8 horas</option><option>Cada 12 horas</option><option>Cada día</option><option>BID</option><option>TID</option><option value="OTHER">Otra documentada</option></select></label>
      <label>Duración (días)<input type="number" name="durationDays" min="1" max="3660" step="1"></label>
      <label>Fecha inicio<input type="date" name="startDate" value="${today}" required></label>
      <label>Fecha fin<input type="date" name="endDate" min="${today}" required></label>
      <label class="full"><input type="checkbox" name="chronic"> Medicamento crónico (marca documentada)</label>
      <label class="full">Horarios<input name="schedule" placeholder="08:00, 20:00 o PRN" maxlength="500"></label>
      <label class="full">Indicaciones<textarea name="indications" rows="4" maxlength="5000"></textarea></label>
      <label class="full"><input type="checkbox" name="showDilutions"> Mostrar diluciones documentadas</label>
      <label class="full">Diluciones<textarea name="dilutions" rows="2" maxlength="2000" disabled placeholder="Se habilita al marcar Mostrar diluciones"></textarea></label>
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="return-to-medication-draft">Cerrar</button><button class="btn btn-primary" data-action="save-treatment-draft">Guardar tratamiento</button>`
  });
}

function openDoctorForm() {
  openModal({
    title:"Nuevo profesional",
    subtitle:"Registro básico para agenda, honorarios y estados de cuenta.",
    size:"md",
    body:`<form id="doctor-form" class="form-grid">
      <label class="full">Nombre<input name="name" required></label>
      <label>Especialidad<input name="specialty" required></label>
      <label>Tipo de tarifa<select name="rateType"><option>PER_VISIT</option><option>HOURLY</option><option>FIXED</option></select></label>
      <label>Teléfono<input name="phone"></label>
      <label>Correo<input type="email" name="email"></label>
    </form>`,
    footer:`<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-doctor">Guardar profesional</button>`
  });
}

function openDocumentPreview(id) {
  const state = store.getState();
  const doc = state.clinicalDocuments.find((d) => d.id === id);
  if (!doc) return showToast("Documento no encontrado.", "danger");
  const patient = store.patientById(doc.patientId);
  const recordCase = store.caseById(doc.caseId);
  const vitals = state.vitalSigns.filter((v) => v.caseId === doc.caseId);
  const notes = state.nursingNotes.filter((n) => n.caseId === doc.caseId);
  const corrections = state.clinicalCorrections.filter((item) => item.subjectType === "CLINICAL_DOCUMENT" && item.subjectId === doc.id);
  const displayStatus = store.clinicalRecordStatus("CLINICAL_DOCUMENT", doc.id);
  let html;
  if (doc.type === "HEALTH_REPORT" || doc.type === "CLINICAL_EVOLUTION") html = healthReportDocument({ document: doc, patient, recordCase, vitalSigns: vitals, notes, corrections });
  else if (doc.type === "MEDICAL_ORDER" || doc.type === "LAB_REQUEST") html = medicalOrderDocument({ document: doc, patient, recordCase, corrections });
  else if (doc.type === "CARE_PLAN") html = carePlanDocument({ document: doc, patient, recordCase, corrections });
  else html = healthReportDocument({ document: doc, patient, recordCase, vitalSigns: vitals, notes, corrections });
  openModal({
    title: doc.title,
    subtitle: `${displayStatus} · versión ${doc.version} · ${doc.authorName}`,
    size: "xl",
    body: `<iframe class="document-frame" title="${safeText(doc.title)}"></iframe>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cerrar</button>${doc.status==="DRAFT"?`<button class="btn btn-secondary" data-action="sign-document" data-id="${doc.id}">Firmar y bloquear</button>`:""}${doc.status==="SIGNED"?`<button class="btn btn-secondary" data-action="open-clinical-correction" data-subject-type="CLINICAL_DOCUMENT" data-id="${doc.id}">Corregir</button><button class="btn btn-danger" data-action="open-clinical-void" data-subject-type="CLINICAL_DOCUMENT" data-id="${doc.id}">Anular</button>`:""}<button class="btn btn-primary" data-action="print-document" data-id="${doc.id}">Imprimir / PDF</button>`
  });
  const frame = modalRoot.querySelector("iframe");
  frame.srcdoc = html;
  frame.dataset.documentHtml = encodeURIComponent(html);
}

function printQuote(id) {
  const state = store.getState();
  const quote = state.quotes.find((q) => q.id === id);
  if (!quote) throw new Error("Cotización no encontrada.");
  const patient = store.patientById(quote.patientId);
  const recordCase = store.caseById(quote.caseId);
  const insurer = state.insurers.find((i) => i.id === patient?.insurerId);
  openPrintWindow(quoteDocument({ quote, patient, recordCase, insurer }), quote.id);
}

function printClinicalDocument(id) {
  const state=store.getState();
  const doc=state.clinicalDocuments.find(d=>d.id===id);
  if(!doc) throw new Error("Documento no encontrado.");
  const patient=store.patientById(doc.patientId);
  const recordCase=store.caseById(doc.caseId);
  const vitals=state.vitalSigns.filter(v=>v.caseId===doc.caseId);
  const notes=state.nursingNotes.filter(n=>n.caseId===doc.caseId);
  const corrections=state.clinicalCorrections.filter(item=>item.subjectType==="CLINICAL_DOCUMENT"&&item.subjectId===doc.id);
  let html;
  if(doc.type==="MEDICAL_ORDER"||doc.type==="LAB_REQUEST") html=medicalOrderDocument({document:doc,patient,recordCase,corrections});
  else if(doc.type==="CARE_PLAN") html=carePlanDocument({document:doc,patient,recordCase,corrections});
  else html=healthReportDocument({document:doc,patient,recordCase,vitalSigns:vitals,notes,corrections});
  openPrintWindow(html,doc.title);
}

function printMedicationCard(id, variant = "complete"){
  const state=store.getState();
  const card=state.medicationCards.find(c=>c.id===id);
  if(!card) throw new Error("Tarjeta no encontrada.");
  const corrections=state.clinicalCorrections.filter(item=>item.subjectType==="MEDICATION_CARD"&&item.subjectId===card.id);
  openPrintWindow(medicationCardDocument({card,patient:store.patientById(card.patientId),recordCase:store.caseById(card.caseId),corrections,variant}),`Tarjeta ${card.id}`);
}

function printStatement(id){
  const state=store.getState();
  const statement=state.doctorStatements.find(s=>s.id===id);
  if(!statement) throw new Error("Estado no encontrado.");
  const doctor=state.doctors.find(d=>d.id===statement.doctorId);
  const services=state.doctorServices.filter(s=>statement.items.includes(s.id));
  openPrintWindow(doctorStatementDocument({statement,doctor,services,patients:state.patients}),statement.id);
}

function printPurchase(id){
  const state=store.getState();
  const purchase=state.purchases.find(p=>p.id===id);
  if(!purchase) throw new Error("Compra no encontrada.");
  const supplier=state.suppliers.find(s=>s.id===purchase.supplierId);
  openPrintWindow(purchaseDocument({purchase,supplier}),purchase.id);
}

function printClosure(id){
  const state=store.getState();
  const closure=state.inventoryClosures.find(c=>c.id===id);
  if(!closure) throw new Error("Cierre no encontrado.");
  const recordCase=store.caseById(closure.caseId);
  const patient=store.patientById(recordCase?.patientId);
  const reservations=state.inventoryReservations.filter(r=>r.caseId===closure.caseId);
  openPrintWindow(inventoryAcknowledgementDocument({recordCase,patient,reservations,inventoryItems:state.inventoryItems}),closure.id);
}

function saveDownload(filename, content, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function exportPatients() {
  const rows = store.getState().patients.map(({ id, fullName, documentType, document, birthDate, sex, bloodType, phone, email, address, triage, status }) => ({ id, fullName, documentType, document, birthDate, sex, bloodType, phone, email, address, triage, status }));
  saveDownload("pacientes_demo.csv", toCsv(rows), "text/csv;charset=utf-8");
}

function exportAudit() {
  saveDownload("auditoria_demo.csv", toCsv(store.getState().auditLogs), "text/csv;charset=utf-8");
}

function exportReport() {
  const state=store.getState();
  const payload={generatedAt:new Date().toISOString(),classification:"SYNTHETIC_DEMO",patients:state.patients.length,cases:state.cases.length,quotes:state.quotes.length,openBalance:state.quotes.reduce((s,q)=>s+quoteBalance(q,state.payments),0),inventoryAlerts:state.inventoryItems.filter(i=>i.stock-i.committed<=i.minimum).length};
  saveDownload("reporte_operativo_demo.json",JSON.stringify(payload,null,2),"application/json");
}

function copyPortalLink(token) {
  const url = `${location.origin}${location.pathname}#/portal/${token}`;
  navigator.clipboard?.writeText(url).then(() => showToast("Enlace seguro copiado.")).catch(() => {
    prompt("Copia el enlace:", url);
  });
}

function portalTokenFromRoute() {
  const route = routeFromHash();
  return isPortalRoute(route) ? route.slice("portal/".length) : "";
}

function isStandaloneDemo() {
  return location.protocol === "file:" && store.config.dataMode === "mock";
}

function standalonePortalSnapshot(token) {
  const state = store.getState();
  const quote = state.quotes.find((candidate) => candidate.portalToken === token);
  if (!quote) return null;
  const paid = state.payments
    .filter((payment) => payment.quoteId === quote.id && payment.status === "APPLIED")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const events = [
    { status: "DRAFT", note: "Cotización creada.", date: quote.createdAt },
    ...(quote.sentAt ? [{ status: "SENT_TO_PATIENT", note: "Cotización disponible en el portal seguro.", date: quote.sentAt }] : []),
    ...(quote.status && !["DRAFT", "SENT_TO_PATIENT"].includes(quote.status)
      ? [{ status: quote.status, note: "Estado administrativo actualizado.", date: quote.updatedAt || quote.sentAt || quote.createdAt }]
      : [])
  ];
  return {
    quote_id: quote.id,
    status: quote.status,
    total: Number(quote.total || 0),
    insurer_amount: Number(quote.insurerAmount || 0),
    patient_amount: Number(quote.patientAmount || 0),
    paid,
    balance: Math.max(0, Number(quote.patientAmount || 0) - paid),
    updated_at: quote.updatedAt || quote.sentAt || quote.createdAt,
    events
  };
}

async function requestPortalCode() {
  const token = portalTokenFromRoute();
  if (!token) return;
  if (isStandaloneDemo()) {
    // La respuesta es idéntica para tokens válidos e inválidos para no revelar existencia.
    ui.portalMessage = `Modo autónomo con datos sintéticos: usa el código demo ${STANDALONE_DEMO_OTP}. No se envió ningún mensaje.`;
    render();
    return;
  }
  try {
    const response = await fetch("/api/portal-request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ token })
    });
    const payload = await response.json().catch(() => ({}));
    ui.portalMessage = response.ok
      ? (payload.message || "Si el enlace es válido, enviamos un código al canal registrado.")
      : "No fue posible completar la solicitud. Intenta más tarde.";
  } catch {
    ui.portalMessage = "No fue posible completar la solicitud. Intenta más tarde.";
  }
  render();
}

async function verifyPortalAccess(form) {
  const data = new FormData(form);
  const token = String(data.get("token") || "");
  const verificationCode = String(data.get("verificationCode") || "").trim();
  if (isStandaloneDemo()) {
    const snapshot = verificationCode === STANDALONE_DEMO_OTP ? standalonePortalSnapshot(token) : null;
    ui.portalSnapshot = snapshot ? { token, data: snapshot } : null;
    ui.portalMessage = snapshot ? "" : "No fue posible validar el acceso.";
    render();
    return;
  }
  try {
    const response = await fetch("/api/portal-status", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ token, verificationCode })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.quote_id) throw new Error("invalid");
    ui.portalSnapshot = { token, data: payload };
    ui.portalMessage = "";
  } catch {
    ui.portalSnapshot = null;
    ui.portalMessage = "No fue posible validar el acceso.";
  }
  render();
}

async function runInternalQa() {
  showToast("Ejecutando controles internos…", "info");
  const response = await fetch("/api/health").catch(() => null);
  const message = response?.ok ? "QA de navegador completado. Revisa el informe incluido en el ZIP." : "QA local completado. La API health requiere servidor local.";
  setTimeout(() => showToast(message), 600);
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  if (target.matches("input, select, textarea")) return;
  const action = target.dataset.action;
  const data = target.dataset;
  const permission = actionPermission(action);
  if (permission && !roleCan(store.getState().session.role, permission)) {
    event.preventDefault();
    showToast("No tienes permiso para realizar esta acción.", "danger");
    return;
  }

  if (action !== "set-tab" && target.tagName === "A") return;
  event.preventDefault();
  if (action?.startsWith("save-") && action !== "save-settings") return;

  switch (action) {
    case "close-modal": closeModal(); break;
    case "toggle-sidebar": ui.sidebarOpen = !ui.sidebarOpen; render(); break;
    case "toggle-user-menu": ui.userMenuOpen = !ui.userMenuOpen; ui.notificationsOpen = false; renderOverlays(); break;
    case "toggle-notifications": ui.notificationsOpen = !ui.notificationsOpen; ui.userMenuOpen = false; renderOverlays(); break;
    case "toggle-password": {
      const input = document.querySelector("#login-form input[name=password]");
      if (input) input.type = input.type === "password" ? "text" : "password";
      break;
    }
    case "install-pwa": {
      if (!deferredInstallPrompt) {
        showToast("La instalación no está disponible en este navegador.", "info");
        break;
      }
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.finally(() => {
        deferredInstallPrompt = null;
        ui.pwaInstallAvailable = false;
        render();
      });
      break;
    }
    case "quick-login": {
      const user = store.getState().users.find((u) => u.email === data.email);
      const form = document.querySelector("#login-form");
      if (user && form) {
        form.elements.email.value = user.email;
        form.elements.password.value = "Demo2026!";
        form.elements.email.focus();
        showToast(`Perfil ${user.role} preparado. Confirma con Entrar al sistema.`, "info");
      }
      break;
    }
    case "recover-password": {
      const email = document.querySelector("#login-form input[name=email]")?.value || "";
      runSafely(() => store.recoverPassword(email), "Si la cuenta existe, recibirá instrucciones por el canal configurado.");
      break;
    }
    case "open-my-user": {
      const user = store.currentUser();
      openModal({
        title: "Mi usuario",
        subtitle: store.getState().organization?.name || "Organización no disponible",
        body: `<dl class="detail-list"><div><dt>Nombre</dt><dd>${safeText(user?.name || "")}</dd></div><div><dt>Correo</dt><dd>${safeText(user?.email || "")}</dd></div><div><dt>Rol</dt><dd>${safeText(store.getState().session.role || "")}</dd></div><div><dt>Estado</dt><dd>${safeText(user?.status || "ACTIVE")}</dd></div></dl>`
      });
      break;
    }
    case "logout": runSafely(() => store.logout(), "Sesión cerrada."); break;
    case "reset-demo": if (confirm("¿Restaurar todos los datos ficticios al estado inicial?")) runSafely(() => store.reset(), "Datos demo restaurados."); break;
    case "set-tab": ui.tab = data.tab; render(); break;
    case "set-receivables-tab": ui.receivablesTab = data.tab || "accounts"; render(); break;
    case "set-payables-tab": ui.payablesTab = data.tab || "summary"; ui.payablesPage = 1; render(); break;
    case "toggle-payables-filters": ui.payablesFilterOpen = !ui.payablesFilterOpen; render(); break;
    case "apply-payables-filters": ui.payablesPage = 1; ui.payablesFilterOpen = false; render(); break;
    case "clear-payables-filters": {
      ui.payablesDateFrom = "";
      ui.payablesDateTo = "";
      ui.payablesResourceId = "";
      ui.payablesStatus = "";
      ui.payablesSearch = "";
      ui.payablesPage = 1;
      render();
      break;
    }
    case "payables-page": ui.payablesPage = Math.max(1, Number(data.page || 1)); render(); break;
    case "receivables-page": ui.receivablesPage = Math.max(1, Number(data.page || 1)); render(); break;
    case "sort-receivables": {
      if (ui.receivablesSortKey === data.sort) ui.receivablesSortDirection = ui.receivablesSortDirection === "asc" ? "desc" : "asc";
      else { ui.receivablesSortKey = data.sort; ui.receivablesSortDirection = "asc"; }
      ui.receivablesPage = 1;
      render();
      break;
    }
    case "set-patient-tab": ui.patientTab = data.tab; ui.patientPage = 1; render(); break;
    case "case-page": ui.casePage = Math.max(1, Number(data.page || 1)); render(); break;
    case "case-quote-page": ui.caseQuotePage = Math.max(1, Number(data.page || 1)); render(); break;
    case "apply-case-filters": ui.casePage = 1; ui.caseQuotePage = 1; render(); break;
    case "clear-case-filters": {
      ui.caseStatus = "ACTIVE";
      ui.caseStartDate = "";
      ui.caseAccountType = "";
      ui.caseQuoteStatus = "";
      ui.caseQuoteDate = "";
      ui.casePage = 1;
      ui.caseQuotePage = 1;
      render();
      break;
    }
    case "sort-patients": {
      if (ui.patientSortKey === data.sort) ui.patientSortDirection = ui.patientSortDirection === "asc" ? "desc" : "asc";
      else { ui.patientSortKey = data.sort; ui.patientSortDirection = "asc"; }
      ui.patientPage = 1;
      render();
      break;
    }
    case "patient-page": ui.patientPage = Math.max(1, Number(data.page || 1)); render(); break;
    case "clear-patient-import": ui.patientImport = null; render(); break;
    case "clear-patient-location": {
      const form = document.querySelector("#patient-form");
      if (form) {
        for (const name of ["locationLink", "address", "geo", "addressComments"]) {
          const input = form.elements.namedItem(name);
          if (input) input.value = "";
        }
        form.elements.namedItem("address")?.focus();
      }
      break;
    }
    case "confirm-patient-import": {
      const rows = ui.patientImport?.rows || [];
      const result = runSafely(() => store.importPatients(rows), `${rows.length} pacientes sintéticos importados.`);
      if (result) { ui.patientImport = null; ui.patientTab = "active"; ui.patientPage = 1; render(); }
      break;
    }
    case "open-patient-form": openPatientForm(); break;
    case "edit-patient": openPatientForm(data.id); break;
    case "open-case-form": openCaseForm(null, data.patientId || ""); break;
    case "edit-case": openCaseForm(data.id); break;
    case "open-quote-form": openQuoteForm(data.caseId || ""); break;
    case "open-quote-referral": openQuoteReferralForm(); break;
    case "open-quote-date-picker": openQuoteDatePicker(); break;
    case "revise-quote": openQuoteForm("", data.id, true); break;
    case "edit-quote-draft": openQuoteForm("", data.id, false, true); break;
    case "quote-add-item": {
      syncQuoteHead();
      const select=document.querySelector("#quote-item-select");
      const qty=document.querySelector("#quote-item-qty");
      const item=store.getState().catalogItems.find(i=>i.id===select?.value);
      const quantity=Number(qty?.value || 0);
      if(!item) { showToast("Seleccione un concepto autorizado.","danger"); break; }
      if(!(quantity > 0)) { showToast("Indique una cantidad válida.","danger"); break; }
      if(ui.quoteDraft){
        ui.quoteDraft.processing=true;
        renderQuoteModal();
        setTimeout(()=>{
          if(!ui.quoteDraft) return;
          ui.quoteDraft.items.push({id:uid("QTI"),catalogItemId:item.id,category:item.category,name:item.name,quantity,unitPrice:item.price,discountAmount:0});
          ui.quoteDraft.processing=false;
          ui.quoteDraft.selectedCatalogItemId="";
          ui.quoteDraft.catalogNoResults=false;
          renderQuoteModal();
        },350);
      }
      break;
    }
    case "quote-set-category": syncQuoteHead(); if (ui.quoteDraft) { ui.quoteDraft.category = data.category || "SERVICES"; delete ui.quoteDraft.selectedCatalogItemId; ui.quoteDraft.catalogNoResults=false; } renderQuoteModal(); break;
    case "quote-remove-referral": {
      syncQuoteHead();
      const values = String(ui.quoteDraft?.referredBy || "").split("|").map((value) => value.trim()).filter(Boolean);
      values.splice(Number(data.index), 1);
      if (ui.quoteDraft) ui.quoteDraft.referredBy = values.join(" | ");
      renderQuoteModal();
      break;
    }
    case "clear-quote-giftcard": syncQuoteHead(); if (ui.quoteDraft) ui.quoteDraft.giftcard = ""; renderQuoteModal(); break;
    case "quote-remove-item": syncQuoteHead(); ui.quoteDraft?.items.splice(Number(data.index),1); renderQuoteModal(); break;
    case "open-insurance-status": openInsuranceStatus(data.id || ""); break;
    case "open-administrative-execution": openAdministrativeExecution(data.id || ""); break;
    case "open-clinical-profiles": openClinicalProfiles(data.caseId || ""); break;
    case "open-clinical-profile-form": openClinicalProfileForm(data.caseId || ""); break;
    case "add-clinical-device-row": {
      const list = document.querySelector("#clinical-device-list");
      if (list && list.children.length < 50) list.insertAdjacentHTML("beforeend", clinicalDeviceRow(list.children.length));
      break;
    }
    case "clinical-page": ui.clinicalPage = Math.max(1, Number(data.page || 1)); render(); break;
    case "apply-clinical-filters": ui.clinicalPage = 1; render(); break;
    case "clear-clinical-filters": {
      ui.clinicalStatus = "";
      ui.clinicalServiceType = "";
      ui.clinicalAttentionType = "";
      ui.clinicalPage = 1;
      render();
      break;
    }
    case "set-health-report-tab": ui.healthReportTab = data.tab || "main"; render(); break;
    case "health-report-page": ui.healthReportPage = Math.max(1, Number(data.page || 1)); render(); break;
    case "set-medical-order-tab": ui.medicalOrderTab = data.tab || "active"; ui.medicalOrderPage = 1; render(); break;
    case "medical-order-page": ui.medicalOrderPage = Math.max(1, Number(data.page || 1)); render(); break;
    case "open-clinical-creation-choice": openClinicalCreationChoice(data.caseId || ""); break;
    case "choose-medical-order": openMedicalOrderForm(data.caseId || ""); break;
    case "choose-medication-card": openMedicationCardForm(data.caseId || ""); break;
    case "view-patient-orders": openPatientOrders(data.caseId || ""); break;
    case "open-treatment-draft": openTreatmentDraftForm(); break;
    case "return-to-medication-draft": openMedicationCardForm("", true); break;
    case "remove-treatment-draft": if (ui.medicationDraft) { syncMedicationDraft(); ui.medicationDraft.items.splice(Number(data.index),1); openMedicationCardForm("",true); } break;
    case "cancel-medication-draft": ui.medicationDraft = null; closeModal(); break;
    case "change-health-report-range": openHealthReportRange(data.caseId || ""); break;
    case "open-health-report-config": renderHealthReportConfigModal(data.caseId || ""); break;
    case "health-report-config-add": {
      const config = ensureHealthReportConfig(data.caseId || "");
      if (!config.selected.includes(data.section)) config.selected.push(data.section);
      renderHealthReportConfigModal(data.caseId || "");
      break;
    }
    case "health-report-config-remove": {
      const config = ensureHealthReportConfig(data.caseId || "");
      config.selected = config.selected.filter((key) => key !== data.section);
      renderHealthReportConfigModal(data.caseId || "");
      break;
    }
    case "health-report-config-up":
    case "health-report-config-down": {
      const config = ensureHealthReportConfig(data.caseId || "");
      const index = config.selected.indexOf(data.section);
      const nextIndex = action === "health-report-config-up" ? index - 1 : index + 1;
      if (index >= 0 && nextIndex >= 0 && nextIndex < config.selected.length) {
        [config.selected[index], config.selected[nextIndex]] = [config.selected[nextIndex], config.selected[index]];
      }
      renderHealthReportConfigModal(data.caseId || "");
      break;
    }
    case "print-health-report-config": runSafely(() => printConfiguredHealthReport(data.caseId || "")); break;
    case "open-payment-form": openPaymentForm(data.quoteId || ""); break;
    case "open-receivable-quotes": openReceivableQuotes(data.caseId || ""); break;
    case "open-account-history": openAccountHistory(data.caseId || ""); break;
    case "open-receivable-payments": openReceivablePayments(data.caseId || ""); break;
    case "open-reverse-payment": openReversePayment(data.id || ""); break;
    case "print-payment": runSafely(() => printPayment(data.id)); break;
    case "open-account-statement": openAccountStatement(); break;
    case "preview-account-statement": {
      const form = document.querySelector("#account-statement-form");
      if (!form?.reportValidity()) break;
      const values = Object.fromEntries(new FormData(form));
      if (values.dateFrom > values.dateTo) { showToast("El rango de fechas es inválido.", "danger"); break; }
      const quotes = currentQuotesForCase(values.caseId).filter((quote) => statementDateInRange(quote.invoiceDate || quote.createdAt, values));
      const payments = paymentRowsForCase(values.caseId).filter((payment) => payment.status === "APPLIED" && statementDateInRange(payment.date, values));
      ui.statementContext = { ...values, selectedQuoteIds: quotes.map((quote) => quote.id), selectedPaymentIds: payments.map((payment) => payment.id) };
      ui.statementTab = "quotes";
      renderAccountStatementPreview();
      break;
    }
    case "account-statement-tab": ui.statementTab = data.tab || "quotes"; renderAccountStatementPreview(); break;
    case "open-payment-summary": openPaymentSummary(); break;
    case "export-receivables-filtered": saveDownload("cuentas_por_cobrar_filtradas_demo.csv", toCsv(receivableExportRows(true)), "text/csv;charset=utf-8"); break;
    case "export-receivables": saveDownload("cuentas_por_cobrar_demo.csv", toCsv(receivableExportRows(false)), "text/csv;charset=utf-8"); break;
    case "send-quote":
    case "send-quote-whatsapp": runSafely(()=>store.sendQuote(data.id,action==="send-quote-whatsapp"?"WHATSAPP":"EMAIL"),"Solicitud de envío confirmada."); break;
    case "copy-portal-link": copyPortalLink(data.token); break;
    case "print-quote": runSafely(()=>printQuote(data.id)); break;
    case "open-clinical-document": openClinicalDocumentForm(data.caseId || "",data.docType || "HEALTH_REPORT",data.patientId||""); break;
    case "view-document": openDocumentPreview(data.id); break;
    case "print-document": runSafely(()=>printClinicalDocument(data.id)); break;
    case "sign-document": runSafely(()=>store.signClinicalDocument(data.id),"Documento firmado y bloqueado."); closeModal(); break;
    case "open-clinical-correction": openClinicalCorrectionForm(data.subjectType, data.id); break;
    case "open-clinical-void": openClinicalVoidForm(data.subjectType, data.id); break;
    case "open-vitals-form": openVitalsForm(data.caseId||""); break;
    case "open-nursing-note": openNursingNoteForm(data.caseId||""); break;
    case "share-note": runSafely(()=>store.shareNursingNote(data.id),"Nota compartida mediante enlace seguro."); break;
    case "open-shift-form": openShiftForm(data.caseId||""); break;
    case "open-visit-detail": openVisitDetail(data.id || ""); break;
    case "set-agenda-view": ui.agendaView = data.view || "month"; render(); break;
    case "agenda-navigate": {
      const date = new Date(`${ui.agendaDate || "2026-08-01"}T00:00:00Z`);
      if (data.direction === "today") ui.agendaDate = new Date().toISOString().slice(0,7) + "-01";
      else { date.setUTCMonth(date.getUTCMonth() + Number(data.direction || 0)); ui.agendaDate = date.toISOString().slice(0,7) + "-01"; }
      render();
      break;
    }
    case "agenda-refresh": render(); break;
    case "blocked-bulk-visits": showToast("Eliminar visitas permanece deshabilitado hasta confirmar selección, recurrencia, permisos, motivo y auditoría.", "info"); break;
    case "blocked-agenda-destination": showToast("Este destino sólo aparece en la evidencia; su comportamiento requiere confirmación del cliente.", "info"); break;
    case "blocked-professional-payment": showToast("Los ajustes de pago permanecen deshabilitados hasta confirmar tarifa, autorización, motivo y reglas contables.", "info"); break;
    case "open-professional-payment": openProfessionalServicePayment(data.id || ""); break;
    case "open-professional-concept": openProfessionalPaymentConcept(data.id || ""); break;
    case "back-professional-payment": openProfessionalServicePayment(ui.professionalPaymentServiceId); break;
    case "blocked-payables-mutation": showToast("Operación financiera bloqueada: faltan reglas aprobadas de cálculo, autorización, idempotencia, auditoría, pago y reversión.", "info", 7000); break;
    case "export-payables": saveDownload("pagos_servicios_sinteticos.csv", toCsv(payablesExportRows()), "text/csv;charset=utf-8"); break;
    case "open-purchase-form": openPurchaseTypeChooser(); break;
    case "choose-purchase-kind": openPurchaseForm(data.kind === "PETTY_CASH" ? "PETTY_CASH" : "ORDER"); break;
    case "back-purchase-kind": capturePurchaseDraft(document.querySelector("#purchase-form")); openPurchaseTypeChooser(); break;
    case "add-purchase-item": {
      const form = document.querySelector("#purchase-form");
      if (!form || !ui.purchaseDraft) break;
      capturePurchaseDraft(form);
      const values = Object.fromEntries(new FormData(form));
      const catalogItem = store.getState().catalogItems.find((item) => item.id === values.catalogItemId);
      const supplierId = ui.purchaseDraft.kind === "PETTY_CASH" ? ui.purchaseDraft.headerSupplierId : String(values.lineSupplierId || "");
      const quantity = Number(values.quantity);
      const unitCost = Number(values.unitCost);
      const taxAmount = Number(values.taxAmount || 0);
      const discountAmount = Number(values.discountAmount || 0);
      if (!catalogItem || !supplierId || !String(values.presentation || "").trim() || !(quantity > 0) || unitCost < 0 || taxAmount < 0 || discountAmount < 0) {
        showToast("Completa ítem, proveedor, presentación, costo y cantidad con montos válidos.", "danger");
        break;
      }
      if (discountAmount > quantity * unitCost + taxAmount) {
        showToast("El descuento de línea no puede producir un total negativo.", "danger");
        break;
      }
      ui.purchaseDraft.items.push({
        catalogItemId: catalogItem.id,
        supplierId,
        name: catalogItem.name,
        presentation: String(values.presentation).trim(),
        quantity,
        unitCost,
        taxAmount,
        discountAmount
      });
      openPurchaseForm(ui.purchaseDraft.kind);
      break;
    }
    case "remove-purchase-item": {
      if (!ui.purchaseDraft) break;
      capturePurchaseDraft(document.querySelector("#purchase-form"));
      const index = Number(data.index);
      if (Number.isInteger(index) && index >= 0 && index < ui.purchaseDraft.items.length) ui.purchaseDraft.items.splice(index, 1);
      openPurchaseForm(ui.purchaseDraft.kind);
      break;
    }
    case "blocked-purchase-presentation": showToast("Crear presentaciones requiere confirmar catálogo, proveedor, vigencia y autorización.", "info", 6500); break;
    case "blocked-purchase-mutation": showToast(`${data.operation || "Esta operación"} permanece bloqueada hasta confirmar estados, permisos, motivo, versionado y reversión.`, "info", 7000); break;
    case "open-purchase-details": openPurchaseDetail(data.id); break;
    case "view-purchase": openPurchaseDetail(data.id); break;
    case "print-purchase": runSafely(()=>printPurchase(data.id)); break;
    case "export-purchases": saveDownload("compras_sinteticas.csv", toCsv(purchaseExportRows()), "text/csv;charset=utf-8"); break;
    case "export-purchase": {
      const purchase = store.getState().purchases.find((candidate) => candidate.id === data.id);
      if (purchase) saveDownload(`compra_${safeText(purchase.code || purchase.id)}_sintetica.csv`, toCsv(purchaseExportRows([purchase])), "text/csv;charset=utf-8");
      break;
    }
    case "purchase-page": ui.purchasePage = Math.max(1, Number(data.page || 1)); render(); break;
    case "open-inventory-movement": openInventoryMovementForm(data.itemId||"",data.caseId||"",data.type||""); break;
    case "open-closure-form": openClosureForm(data.caseId||""); break;
    case "approve-closure": runSafely(()=>store.approveInventoryClosure(data.id),"Cierre aprobado y auditado."); break;
    case "print-closure": runSafely(()=>printClosure(data.id)); break;
    case "open-kit-form": openKitForm(); break;
    case "duplicate-kit": {
      const kit=store.getState().kits.find(k=>k.id===data.id);
      if(kit) runSafely(()=>store.createKit({name:`${kit.name} copia`,code:`${kit.code}-COPY`,items:kit.items}),"Kit duplicado.");
      break;
    }
    case "apply-kit": showToast("Selecciona una hospitalización desde Comprometidos para aplicar el kit.", "info"); location.hash="#/inventario/comprometidos"; break;
    case "open-catalog-form": openCatalogForm(data.category||""); break;
    case "edit-catalog-item": openCatalogForm("",data.id); break;
    case "open-discount-form": openDiscountForm(); break;
    case "open-medication-card": openMedicationCardForm(data.caseId || ""); break;
    case "print-medication-card": runSafely(()=>printMedicationCard(data.id,data.variant || "complete")); break;
    case "sign-medication-card": runSafely(()=>store.signMedicationCard(data.id),"Tarjeta firmada y bloqueada."); break;
    case "administer-medication": showToast("Registro de administración deshabilitado hasta confirmar campos, permisos y correcciones.", "info"); break;
    case "open-doctor-form": openDoctorForm(); break;
    case "generate-statements": runSafely(()=>store.generateDoctorStatements()); break;
    case "send-statement": runSafely(()=>store.sendDoctorStatement(data.id)); break;
    case "print-statement": runSafely(()=>printStatement(data.id)); break;
    case "export-patients": exportPatients(); break;
    case "export-audit": exportAudit(); break;
    case "export-report": exportReport(); break;
    case "import-patients": ui.patientTab = "bulk"; ui.patientPage = 1; render(); break;
    case "import-catalog": showToast("La importación de catálogos no está implementada; el control permanece bloqueado.", "info"); break;
    case "print-receivables": window.print(); break;
    case "print-case": window.print(); break;
    case "run-qa": runInternalQa(); break;
    case "portal-support": showToast("Solicitud enviada a administración en modo simulado."); break;
    case "request-portal-code": requestPortalCode(); break;
    case "save-settings": document.querySelector("#settings-form")?.requestSubmit(); break;
    default: showToast(`La acción ${action} no está disponible.`, "danger");
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  const action = target.dataset.change || target.dataset.action;
  if (target.matches("[data-agenda-patient]")) { ui.agendaPatientId = target.value; render(); return; }
  if (target.matches("[data-agenda-resource]")) { ui.agendaResourceId = target.value; render(); return; }
  if (target.matches('[data-ui-filter="payablesDateFrom"]')) { ui.payablesDateFrom = target.value; ui.payablesPage = 1; return; }
  if (target.matches('[data-ui-filter="payablesDateTo"]')) { ui.payablesDateTo = target.value; ui.payablesPage = 1; return; }
  if (target.matches('[data-ui-filter="payablesResourceId"]')) { ui.payablesResourceId = target.value; ui.payablesPage = 1; return; }
  if (target.matches('[data-ui-filter="payablesStatus"]')) { ui.payablesStatus = target.value; ui.payablesPage = 1; return; }
  if (target.matches('[data-ui-filter="payablesPageSize"]')) { ui.payablesPageSize = Math.max(1, Math.min(50, Number(target.value || 10))); ui.payablesPage = 1; render(); return; }
  if (target.matches('[data-ui-filter="purchasePageSize"]')) { ui.purchasePageSize = Math.max(1, Math.min(100, Number(target.value || 10))); ui.purchasePage = 1; render(); return; }
  if (action === "professional-concept-type") { ui.professionalConceptType = target.value === "DISCOUNT" ? "DISCOUNT" : "ADDITION"; ui.professionalConceptReason = ""; openProfessionalPaymentConcept(); return; }
  if (action === "professional-concept-reason") { ui.professionalConceptReason = target.value; return; }
  if (action === "shift-case-change") {
    const summary = visitCaseSummary(store.caseById(target.value));
    const form = target.closest("form");
    if (form) {
      form.elements.namedItem("patientName").value = summary.patientName;
      form.elements.namedItem("document").value = summary.document;
      form.elements.namedItem("company").value = summary.company;
    }
    return;
  }
  if (action === "statement-patient-change") {
    openAccountStatement(target.value);
    return;
  }
  if (target.name === "statementQuote" && ui.statementContext) {
    const selected = new Set(ui.statementContext.selectedQuoteIds || []);
    target.checked ? selected.add(target.value) : selected.delete(target.value);
    ui.statementContext.selectedQuoteIds = [...selected];
    return;
  }
  if (target.name === "statementPayment" && ui.statementContext) {
    const selected = new Set(ui.statementContext.selectedPaymentIds || []);
    target.checked ? selected.add(target.value) : selected.delete(target.value);
    ui.statementContext.selectedPaymentIds = [...selected];
    return;
  }
  if (action === "quote-referral-add" && ui.quoteDraft) {
    syncQuoteHead();
    const candidate = String(target.value || "").trim();
    const allowed = [...new Set(store.getState().quotes.flatMap((quote) => String(quote.referredBy || "").split("|").map((value) => value.trim())).filter(Boolean))];
    const values = String(ui.quoteDraft.referredBy || "").split("|").map((value) => value.trim()).filter(Boolean);
    const catalogValue = allowed.find((value) => value.toLocaleLowerCase("es") === candidate.toLocaleLowerCase("es"));
    if (!catalogValue && candidate) showToast("Seleccione una referencia autorizada o use + para un alta provisional.", "danger");
    if (catalogValue && !values.some((value) => value.toLocaleLowerCase("es") === catalogValue.toLocaleLowerCase("es"))) values.push(catalogValue);
    ui.quoteDraft.referredBy = values.join(" | ");
    renderQuoteModal();
    return;
  }
  if (action === "quote-item-select" && ui.quoteDraft) {
    syncQuoteHead();
    const candidate=String(target.value || "").trim();
    const item=store.getState().catalogItems.find((entry)=>entry.category===(ui.quoteDraft.category || "SERVICES") && quoteCatalogLabel(entry)===candidate);
    ui.quoteDraft.selectedCatalogItemId=item?.id || "";
    ui.quoteDraft.catalogNoResults=Boolean(candidate && !item);
    renderQuoteModal();
    return;
  }
  if (action === "quote-item-filter" && ui.quoteDraft) {
    ui.quoteDraft.itemFilter = String(target.value || "ALL");
    renderQuoteModal();
    return;
  }
  if (action === "quote-case-change" || action === "quote-patient-change") {
    syncQuoteHead();
    renderQuoteModal();
  }
  if (action === "quote-calc-change") {
    syncQuoteHead();
    // Re-rendering a focused input on blur removes a subsequently clicked
    // button before the browser can dispatch its click event. Only the
    // discount selector needs an immediate structural refresh.
    if (target.matches('select[name="discountGroupId"]')) renderQuoteModal();
  }
  if (action === "quote-item-qty-change" && ui.quoteDraft) {
    ui.quoteDraft.items[Number(target.dataset.index)].quantity = Number(target.value || 0);
    renderQuoteModal();
  }
  if (action === "patient-insurance-change") {
    const enabled = target.value !== "REGULAR";
    const form = target.form;
    form?.querySelectorAll(".patient-insurance-fields").forEach((section) => { section.hidden = !enabled; });
    for (const name of ["policy", "insuredDocument", "insuredName", "insuredBirthDate"]) {
      const input = form?.elements.namedItem(name);
      if (input) input.required = enabled;
    }
    form?.querySelectorAll('input[name="isPolicyHolder"]').forEach((input) => { input.required = enabled; });
    if (!enabled) {
      form?.querySelectorAll('input[name="isPolicyHolder"]').forEach((input) => { input.checked = false; });
    }
  }
  if (action === "patient-holder-change" && target.value === "true") {
    const form = target.form;
    if (form) {
      form.elements.namedItem("insuredDocument").value = form.elements.namedItem("document").value;
      form.elements.namedItem("insuredName").value = form.elements.namedItem("fullName").value;
      form.elements.namedItem("insuredBirthDate").value = form.elements.namedItem("birthDate").value;
    }
  }
  if (action === "medication-card-case-change" && ui.medicationDraft) {
    syncMedicationDraft();
    openMedicationCardForm(target.value, true);
    return;
  }
  if (action === "medical-order-case-change") {
    const record = store.caseById(target.value);
    const summary = target.form?.querySelector(".details-grid");
    if (record && summary) summary.outerHTML = orderPatientSummary(record);
    const doctor = target.form?.elements.namedItem("treatingDoctorId");
    const diagnosis = target.form?.elements.namedItem("diagnosis");
    if (doctor && !doctor.value) doctor.value = record?.contractingDoctorId || "";
    if (diagnosis && !diagnosis.value) diagnosis.value = record?.diagnosisSummary || "";
    return;
  }
  if (target.matches('#treatment-draft-form [name="showDilutions"]')) {
    const dilutions = target.form?.elements.namedItem("dilutions");
    if (dilutions) { dilutions.disabled = !target.checked; if (!target.checked) dilutions.value = ""; }
  }
  if (target.matches('#treatment-draft-form [name="startDate"], #treatment-draft-form [name="durationDays"]')) {
    const form = target.form;
    const start = String(form?.elements.namedItem("startDate")?.value || "");
    const days = Number(form?.elements.namedItem("durationDays")?.value || 0);
    const end = form?.elements.namedItem("endDate");
    if (end && /^\d{4}-\d{2}-\d{2}$/.test(start) && Number.isInteger(days) && days > 0) {
      const date = new Date(`${start}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + days - 1);
      end.value = date.toISOString().slice(0,10);
      end.min = start;
    }
  }
  if (target.matches('[data-ui-filter="patientPageSize"]')) {
    ui.patientPageSize = Math.max(1, Math.min(100, Number(target.value || 10)));
    ui.patientPage = 1;
    render();
  }
  if (target.matches('[data-ui-filter="caseStatus"]')) {
    ui.caseStatus = target.value;
    ui.casePage = 1;
  }
  if (target.matches('[data-ui-filter="caseStartDate"]')) {
    ui.caseStartDate = target.value;
    ui.casePage = 1;
  }
  if (target.matches('[data-ui-filter="caseAccountType"]')) {
    ui.caseAccountType = target.value;
    ui.casePage = 1;
  }
  if (target.matches('[data-ui-filter="caseQuoteStatus"]')) {
    ui.caseQuoteStatus = target.value;
    ui.caseQuotePage = 1;
  }
  if (target.matches('[data-ui-filter="caseQuoteDate"]')) {
    ui.caseQuoteDate = target.value;
    ui.caseQuotePage = 1;
  }
  if (target.matches('[data-ui-filter="casePageSize"]')) {
    ui.casePageSize = Math.max(1, Math.min(100, Number(target.value || 10)));
    ui.casePage = 1;
    ui.caseQuotePage = 1;
  }
  if (target.matches('[data-ui-filter="receivablesPageSize"]')) {
    ui.receivablesPageSize = Math.max(1, Math.min(100, Number(target.value || 10)));
    ui.receivablesPage = 1;
    render();
  }
  if (target.matches('[data-ui-filter="clinicalStatus"]')) {
    ui.clinicalStatus = target.value;
    ui.clinicalPage = 1;
  }
  if (target.matches('[data-ui-filter="clinicalServiceType"]')) {
    ui.clinicalServiceType = target.value;
    ui.clinicalPage = 1;
  }
  if (target.matches('[data-ui-filter="clinicalAttentionType"]')) {
    ui.clinicalAttentionType = target.value;
    ui.clinicalPage = 1;
  }
  if (target.matches('[data-ui-filter="clinicalPageSize"]')) {
    ui.clinicalPageSize = Math.max(1, Math.min(50, Number(target.value || 10)));
    ui.clinicalPage = 1;
    render();
  }
  if (target.matches('[data-ui-filter="healthReportPageSize"]')) {
    ui.healthReportPageSize = Math.max(1, Math.min(50, Number(target.value || 10)));
    ui.healthReportPage = 1;
    render();
  }
  if (target.matches('[data-ui-filter="medicalOrderPageSize"]')) {
    ui.medicalOrderPageSize = Math.max(1, Math.min(50, Number(target.value || 10)));
    ui.medicalOrderPage = 1;
    render();
  }
  if (target.id === "patient-import-file") {
    const file = target.files?.[0];
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      ui.patientImport = { error: "Selecciona un archivo CSV.", rows: [], fileName: file.name };
      render();
      return;
    }
    file.text().then((text) => {
      ui.patientImport = { error: "", rows: parseCsv(text), fileName: file.name };
      render();
    }).catch((error) => {
      ui.patientImport = { error: error.message, rows: [], fileName: file.name };
      render();
    });
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.matches('[data-input="agenda-patient-search"]')) {
    ui.agendaPatientQuery = target.value;
    const position = target.selectionStart;
    render();
    const next = document.querySelector('[data-input="agenda-patient-search"]');
    if (next) { next.focus(); next.setSelectionRange(position,position); }
    return;
  }
  if (target.matches('[data-input="receivables-search"]')) {
    ui.receivablesSearch = target.value;
    ui.receivablesPage = 1;
    const position = target.selectionStart;
    render();
    const next = document.querySelector('[data-input="receivables-search"]');
    if (next) { next.focus(); next.setSelectionRange(position, position); }
    return;
  }
  if (target.matches('[data-input="payables-search"]')) {
    ui.payablesSearch = target.value;
    ui.payablesPage = 1;
    const position = target.selectionStart;
    render();
    const next = document.querySelector('[data-input="payables-search"]');
    if (next) { next.focus(); next.setSelectionRange(position, position); }
    return;
  }
  if (target.matches('[data-input="purchase-search"]')) {
    ui.purchaseSearch = target.value;
    ui.purchasePage = 1;
    const position = target.selectionStart;
    render();
    const next = document.querySelector('[data-input="purchase-search"]');
    if (next) { next.focus(); next.setSelectionRange(position, position); }
    return;
  }
  if (target.matches('[data-input="purchase-extra"]') && ui.purchaseDraft) {
    const value = Number(target.value || 0);
    ui.purchaseDraft.extraAmount = Number.isFinite(value) && value >= 0 ? value : 0;
    const totals = purchaseDraftTotals();
    for (const [key, amount] of Object.entries(totals)) {
      const output = document.querySelector(`[data-purchase-total="${key}"]`);
      if (output) output.textContent = money(amount);
    }
    return;
  }
  if (target.matches('[data-input="purchase-catalog-search"]')) {
    const select = target.form?.elements.namedItem("catalogItemId");
    const query = String(target.value || "").trim().toLocaleLowerCase("es");
    if (select) {
      for (const option of [...select.options]) {
        if (!option.value) continue;
        option.hidden = Boolean(query) && !option.textContent.toLocaleLowerCase("es").includes(query);
      }
      const visible = [...select.options].filter((option) => option.value && !option.hidden);
      if (query && visible.length === 1) select.value = visible[0].value;
      else if (select.selectedOptions[0]?.hidden) select.value = "";
    }
    return;
  }
  if (target.matches('[data-input="clinical-case-search"]')) {
    ui.clinicalCaseSearch = target.value;
    ui.clinicalPage = 1;
    const position = target.selectionStart;
    render();
    const next = document.querySelector('[data-input="clinical-case-search"]');
    if (next) { next.focus(); next.setSelectionRange(position, position); }
    return;
  }
  if (target.matches('[data-input="health-report-search"]')) {
    ui.healthReportSearch = target.value;
    ui.healthReportPage = 1;
    const position = target.selectionStart;
    render();
    const next = document.querySelector('[data-input="health-report-search"]');
    if (next) { next.focus(); next.setSelectionRange(position, position); }
    return;
  }
  if (target.matches('[data-input="medical-order-search"]')) {
    ui.medicalOrderSearch = target.value;
    ui.medicalOrderPage = 1;
    const position = target.selectionStart;
    render();
    const next = document.querySelector('[data-input="medical-order-search"]');
    if (next) { next.focus(); next.setSelectionRange(position, position); }
    return;
  }
  if (target.id === "quote-item-search" && ui.quoteDraft) {
    const query = String(target.value || "").trim().toLocaleLowerCase("es");
    const category = ui.quoteDraft.category || "SERVICES";
    const hasMatch = !query || store.getState().catalogItems.some((item) => item.category === category && quoteCatalogLabel(item).toLocaleLowerCase("es").includes(query));
    ui.quoteDraft.catalogNoResults = !hasMatch;
    const status = document.querySelector(".quote-no-results");
    if (status) status.hidden = hasMatch;
  }
  if (target.matches("[data-ui-search]")) {
    ui.search = target.value;
    const pos = target.selectionStart;
    render();
    const next = document.querySelector("[data-ui-search]");
    if (next) { next.focus(); next.setSelectionRange(pos,pos); }
  }
  if (target.matches("[data-global-search]")) {
    ui.commandOpen = true;
    renderOverlays();
    setTimeout(() => {
      const input=document.querySelector("#command-input");
      if(input){input.value=target.value;input.focus();}
    },0);
  }
  if (target.id === "command-input") {
    const global = document.querySelector("[data-global-search]");
    if (global) global.value = target.value;
    renderOverlays();
    setTimeout(()=>{const input=document.querySelector("#command-input");if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length)}},0);
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target;
  const formId = form.getAttribute("id");
  event.preventDefault();

  if (formId === "login-form") {
    const email = formValue(form, "email");
    const password = formValue(form, "password");
    runSafely(() => store.authenticate(email, password), "Bienvenido al sistema.");
    return;
  }

  if (formId === "portal-verification-form") {
    verifyPortalAccess(form);
    return;
  }

  if (formId === "patient-form") {
    if (!roleCan(store.getState().session.role, "patients:write")) {
      showToast("No tienes permiso para guardar pacientes.", "danger");
      return;
    }
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form));
    data.notifyWhatsApp = formBool(form, "notifyWhatsApp");
    data.notifySms = false;
    data.notifyEmail = false;
    data.retired = formBool(form, "retired");
    data.insurerId = data.insurerId === "REGULAR" ? "" : data.insurerId;
    data.isPolicyHolder = data.insurerId ? data.isPolicyHolder === "true" : null;
    const id = data.id;
    delete data.id;
    const result = runSafely(() => id ? store.updatePatient(id, data) : store.createPatient(data), id ? "Paciente actualizado." : "Paciente creado.");
    if (result) location.hash = `#/pacientes/${id || result.id}`;
    return;
  }

  if(formId==="settings-form"){
    if (!roleCan(store.getState().session.role, "settings:write")) {
      showToast("No tienes permiso para modificar la configuración.", "danger");
      return;
    }
    const data=new FormData(form);
    saveRuntimeConfigOverride({dataMode:data.get("dataMode"),notificationsMode:data.get("notificationsMode"),supabaseUrl:data.get("supabaseUrl"),supabasePublishableKey:data.get("supabasePublishableKey")});
    showToast("Configuración guardada. Recarga para aplicar el modo de datos.");
  }
});

document.addEventListener("click", async (event) => {
  const button=event.target.closest("[data-action]");
  if(!button) return;
  // Controls whose data-action is handled by the change listener must retain
  // their native checked/selected state instead of entering the command switch.
  if (button.matches("input, select, textarea")) return;
  const action=button.dataset.action;
  const permission = actionPermission(action);
  if (permission && !roleCan(store.getState().session.role, permission)) {
    event.preventDefault();
    showToast("No tienes permiso para realizar esta acción.", "danger");
    return;
  }
  if(!action?.startsWith("save-")) return;
  event.preventDefault();

  if(action==="save-patient"){
    const form=document.querySelector("#patient-form");
    if(!form?.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    data.notifyWhatsApp=formBool(form,"notifyWhatsApp"); data.notifySms=formBool(form,"notifySms"); data.notifyEmail=formBool(form,"notifyEmail");
    const id=data.id; delete data.id;
    const result=runSafely(()=>id?store.updatePatient(id,data):store.createPatient(data),id?"Paciente actualizado.":"Paciente creado.");
    if(result){closeModal(); location.hash=`#/pacientes/${id||result.id}`;}
  }

  if(action==="save-case"){
    const form=document.querySelector("#case-form");
    if(!form?.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    data.devices=(data.devices||"").split(",").map(v=>v.trim()).filter(Boolean);
    const id=data.id; delete data.id;
    const result=runSafely(()=>id?store.updateCase(id,data):store.createCase(data),id?"Hospitalización actualizada.":"Hospitalización creada.");
    if(result){closeModal(); location.hash=`#/hospitalizaciones/${id||result.id}`;}
  }

  if(action==="save-quote"){
    const headForm=document.querySelector("#quote-head-form");
    syncQuoteHead();
    const patientInput=headForm?.elements.namedItem("patientSearch");
    const selectedPatient=ui.quoteDraft ? store.patientById(ui.quoteDraft.patientId) : null;
    if(patientInput instanceof HTMLInputElement){
      const validPatient=Boolean(selectedPatient && quotePatientLabel(selectedPatient)===patientInput.value.trim() && store.caseById(ui.quoteDraft.caseId)?.patientId===selectedPatient.id);
      patientInput.setCustomValidity(validPatient ? "" : "Seleccione un paciente autorizado de la lista.");
    }
    if(!headForm?.reportValidity()) return;
    if(!ui.quoteDraft?.items.length) return showToast("Agrega al menos un concepto.","danger");
    const draft=structuredClone(ui.quoteDraft);
    const result=await runSafely(()=>draft.editDraft?store.updateQuoteDraft(draft.quoteId,draft):draft.revise?store.reviseQuote(draft.quoteId,draft):store.createQuote(draft),draft.editDraft?"Borrador actualizado.":draft.revise?"Nueva versión creada.":"Cotización guardada.");
    if(result){closeModal(); location.hash=`#/cotizaciones/${result.id}`;}
  }

  if(action==="save-quote-referral"){
    const form=document.querySelector("#quote-referral-form");
    if(!form?.reportValidity() || !ui.quoteDraft) return;
    const label=String(new FormData(form).get("label") || "").trim();
    const values=String(ui.quoteDraft.referredBy || "").split("|").map((value)=>value.trim()).filter(Boolean);
    if(!values.some((value)=>value.toLocaleLowerCase("es")===label.toLocaleLowerCase("es"))) values.push(label);
    ui.quoteDraft.referredBy=values.join(" | ");
    closeModal();
    render();
  }

  if(action==="save-quote-date"){
    const form=document.querySelector("#quote-date-form");
    if(!form?.reportValidity() || !ui.quoteDraft) return;
    ui.quoteDraft.invoiceDate=String(new FormData(form).get("invoiceDate") || "");
    closeModal();
    render();
  }

  if(action==="save-insurance-status"){
    const form=document.querySelector("#insurance-form");
    if(!form?.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    const result=await runSafely(()=>store.updateQuoteStatus(data.quoteId,data.status,data.note,data.approvedAmount,data.claimNumber,data.eventId),"Estado de seguro actualizado.");
    if(result) closeModal();
  }

  if(action==="save-payment"){
    const form=document.querySelector("#payment-form");
    if(!form?.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    const result=await runSafely(()=>store.createPayment(data),"Pago aplicado sin duplicar la referencia.");
    if(result) closeModal();
  }

  if(action==="save-administrative-execution"){
    const form=document.querySelector("#administrative-execution-form");
    if(!form?.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    data.thirdPartyInvoice=formBool(form,"thirdPartyInvoice");
    modalRoot.insertAdjacentHTML("beforeend", `<div class="quote-processing" role="status"><span class="spinner"></span><strong>Procesando...</strong></div>`);
    const result=await runSafely(()=>store.startAdministrativeExecution(data),"Perfil administrativo de ejecución creado y auditado.");
    if(result) closeModal(); else modalRoot.querySelector(".quote-processing")?.remove();
  }

  if(action==="save-clinical-profile"){
    const form=document.querySelector("#clinical-profile-form");
    if(!form) return;
    const start=form.elements.namedItem("startDate");
    const end=form.elements.namedItem("endDate");
    const shiftStart=form.elements.namedItem("shiftStartDate");
    const shiftEnd=form.elements.namedItem("shiftEndDate");
    end?.setCustomValidity(end.value && start?.value && end.value < start.value ? "La fecha fin no puede ser anterior al inicio." : "");
    const invalidShift=Boolean((shiftStart?.value || shiftEnd?.value) && (!shiftStart?.value || !shiftEnd?.value || shiftEnd.value < shiftStart.value));
    shiftEnd?.setCustomValidity(invalidShift ? "Complete un rango de turnos válido." : "");
    if(!form.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    data.otherDoctorIds=[...form.querySelectorAll('select[name="otherDoctorIds"] option:checked')].map((option)=>option.value).filter(Boolean);
    data.devices=[...form.querySelectorAll(".clinical-device-row")].map((row)=>({
      deviceType:row.querySelector('[name="deviceType"]')?.value.trim() || "",
      date:row.querySelector('[name="deviceDate"]')?.value || "",
      gauge:row.querySelector('[name="deviceGauge"]')?.value.trim() || "",
      reason:row.querySelector('[name="deviceReason"]')?.value.trim() || "",
      changeFrequency:row.querySelector('[name="deviceFrequency"]')?.value.trim() || "",
      observations:row.querySelector('[name="deviceObservations"]')?.value.trim() || ""
    })).filter((device)=>Object.values(device).some(Boolean));
    modalRoot.insertAdjacentHTML("beforeend", `<div class="quote-processing" role="status"><span class="spinner"></span><strong>Procesando...</strong></div>`);
    const result=await runSafely(()=>store.createClinicalProfile(data),"Perfil clínico guardado como borrador append-only.");
    if(result){closeModal(); openClinicalProfiles(data.caseId);} else modalRoot.querySelector(".quote-processing")?.remove();
  }

  if(action==="save-health-report-range"){
    const form=document.querySelector("#health-report-range-form");
    if(!form) return;
    const start=form.elements.namedItem("start");
    const end=form.elements.namedItem("end");
    end?.setCustomValidity(start?.value && end?.value && end.value < start.value ? "La fecha fin no puede ser anterior al inicio." : "");
    if(!form.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    modalRoot.insertAdjacentHTML("beforeend", `<div class="quote-processing" role="status"><span class="spinner"></span><strong>Procesando...</strong></div>`);
    const validated=await runSafely(()=>store.validateHealthReportRange(data));
    if(!validated){modalRoot.querySelector(".quote-processing")?.remove();return;}
    await new Promise((resolve)=>setTimeout(resolve,250));
    ui.healthReportRange=validated;
    closeModal();
    render();
  }

  if(action==="save-reverse-payment"){
    const form=document.querySelector("#reverse-payment-form");
    if(!form?.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    const result=await runSafely(()=>store.reversePayment(data.paymentId,data.reason,data.idempotencyKey),"Pago revertido; el comprobante original se conservó.");
    if(result) closeModal();
  }

  if(action==="save-clinical-document"){
    const form=document.querySelector("#clinical-document-form");
    if(!form?.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    const document=await runSafely(()=>store.createClinicalDocument({caseId:data.caseId,type:data.type,title:data.title,summary:data.summary,content:{diagnosis:data.diagnosis,background:(data.background||"").split(",").map(v=>v.trim()).filter(Boolean),allergies:(data.allergies||"").split(",").map(v=>v.trim()).filter(Boolean),devices:(data.devices||"").split(",").map(v=>v.trim()).filter(Boolean),plan:data.plan},idempotencyKey:uid("CLINICAL-DOCUMENT")}),"Documento clínico creado.");
    if(document&&formBool(form,"signNow")) await runSafely(()=>store.signClinicalDocument(document.id),"Documento firmado.");
    if(document){closeModal(); location.hash=`#/hospitalizaciones/${data.caseId}`; ui.tab="clinical";}
  }

  if(action==="save-medical-order"){
    const form=document.querySelector("#medical-order-form");
    if(!form?.reportValidity()) return;
    const fd=new FormData(form);
    const sections=MEDICAL_ORDER_SECTIONS.filter(([key])=>fd.has(`section-${key}`)).map(([key,label])=>({key,label,content:String(fd.get(`content-${key}`)||"").trim()}));
    if(!sections.length){showToast("Seleccione al menos una sección de la orden.","danger");return;}
    const result=await runSafely(()=>store.createClinicalDocument({
      caseId:String(fd.get("caseId")),type:"MEDICAL_ORDER",title:`Orden médica · ${String(fd.get("caseId"))}`,
      summary:sections.map((section)=>section.label).join(", "),
      content:{treatingDoctorId:String(fd.get("treatingDoctorId")||""),otherDoctorIds:fd.getAll("otherDoctorIds").map(String),diagnosis:String(fd.get("diagnosis")||"").trim(),sections},
      idempotencyKey:String(fd.get("idempotencyKey")||uid("MEDICAL-ORDER"))
    }),"Orden médica guardada como borrador.");
    if(result){closeModal();location.hash="#/clinica/ordenes";}
  }

  if(action==="save-treatment-draft"){
    const form=document.querySelector("#treatment-draft-form");
    if(!form?.reportValidity()||!ui.medicationDraft) return;
    const data=Object.fromEntries(new FormData(form));
    if(data.endDate < data.startDate){showToast("La fecha de fin no puede ser anterior al inicio.","danger");return;}
    const durationDays=data.durationDays?Number(data.durationDays):null;
    if(durationDays!==null&&(!Number.isInteger(durationDays)||durationDays<1||durationDays>3660)){showToast("La duración documentada no es válida.","danger");return;}
    ui.medicationDraft.items.push({id:uid("MCI"),medication:String(data.medication).trim(),doctorId:data.doctorId,route:data.route,dose:String(data.dose).trim(),frequency:data.frequency,durationDays,startDate:data.startDate,endDate:data.endDate,chronic:formBool(form,"chronic"),schedule:String(data.schedule||"").split(",").map(value=>value.trim()).filter(Boolean),indications:String(data.indications||"").trim(),dilutions:formBool(form,"showDilutions")?String(data.dilutions||"").trim():"",lastAdministration:null,administrationStatus:"PENDING"});
    openMedicationCardForm("",true);
  }

  if(action==="save-clinical-correction"){
    const form=document.querySelector("#clinical-correction-form");
    if(!form?.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    const result=await runSafely(()=>store.createClinicalCorrection(data.subjectType,data.subjectId,{kind:data.kind,reason:data.reason,content:{text:data.content}}),"Corrección auditada registrada.");
    if(result) closeModal();
  }

  if(action==="save-clinical-void"){
    const form=document.querySelector("#clinical-void-form");
    if(!form?.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    const result=await runSafely(()=>data.subjectType==="CLINICAL_DOCUMENT"?store.voidClinicalDocument(data.subjectId,data.reason):store.voidClinicalRecord(data.subjectType,data.subjectId,data.reason),"Registro anulado y conservado en historial.");
    if(result!==undefined) closeModal();
  }

  if(action==="save-vitals"){
    const form=document.querySelector("#vitals-form");
    if(!form?.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    const result=runSafely(()=>store.addVitalSigns(data),"Signos vitales registrados.");
    if(result) closeModal();
  }

  if(action==="save-nursing-note"){
    const form=document.querySelector("#nursing-note-form");
    if(!form?.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    data.sign=formBool(form,"sign");
    const result=runSafely(()=>store.addNursingNote(data),data.sign?"Nota firmada y bloqueada.":"Nota guardada.");
    if(result) closeModal();
  }

  if(action==="save-shift"){
    const form=document.querySelector("#shift-form");
    if(!form?.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    data.start=`${data.start}:00-06:00`; data.end=`${data.end}:00-06:00`;
    data.occurrenceCount=Number(data.occurrenceCount);
    if(data.end<=data.start){showToast("La fecha fin debe ser posterior al inicio.","danger");return;}
    const result=await runSafely(()=>store.createShift(data),"Visita guardada en agenda.");
    if(result) closeModal();
  }

  if(action==="save-shift-assignment"){
    const form=document.querySelector("#visit-detail-form");
    if(!form?.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    const result=await runSafely(()=>store.updateShiftAssignment(data.shiftId,{resourceId:data.resourceId,internalObservations:data.internalObservations,idempotencyKey:data.idempotencyKey}),"Asignación de visita guardada y auditada.");
    if(result) closeModal();
  }

  if(action==="save-purchase"){
    const form=document.querySelector("#purchase-form");
    if(!form) return;
    capturePurchaseDraft(form);
    if (!ui.purchaseDraft?.items?.length) return showToast("Añade al menos un ítem antes de guardar.", "danger");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ui.purchaseDraft.date || "")) return showToast("La fecha es obligatoria.", "danger");
    if (ui.purchaseDraft.kind === "PETTY_CASH" && (!ui.purchaseDraft.headerSupplierId || !ui.purchaseDraft.invoiceNumber)) return showToast("Proveedor y número de factura son obligatorios para caja menuda.", "danger");
    const draft = structuredClone(ui.purchaseDraft);
    const result=await runSafely(()=>store.createPurchase({
      kind:draft.kind,
      date:draft.date,
      invoiceNumber:draft.invoiceNumber,
      observations:draft.observations,
      supplierId:draft.headerSupplierId || draft.items[0]?.supplierId,
      extraAmount:draft.extraAmount,
      idempotencyKey:draft.idempotencyKey,
      items:draft.items
    }),"Borrador de compra confirmado y auditado; no generó recepción ni movimiento de inventario.");
    if(result!==undefined && result!==null) { ui.purchaseDraft=null; closeModal(); }
  }

  if(action==="save-inventory-movement"){
    const form=document.querySelector("#inventory-movement-form");
    if(!form?.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    const result=runSafely(()=>store.createInventoryMovement(data),"Movimiento aplicado al inventario.");
    if(result) closeModal();
  }

  if(action==="save-closure"){
    const form=document.querySelector("#closure-form");
    if(!form?.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    const state=store.getState();
    data.items=state.inventoryReservations.filter(r=>r.caseId===data.caseId).map(r=>({inventoryItemId:r.inventoryItemId,delivered:r.delivered,consumed:r.consumed,returned:r.returned,difference:r.delivered-r.consumed-r.returned}));
    const result=runSafely(()=>store.createInventoryClosure(data),"Cierre creado para revisión.");
    if(result) closeModal();
  }

  if(action==="save-kit"){
    const form=document.querySelector("#kit-form");
    if(!form?.reportValidity()) return;
    const fd=new FormData(form); const items=[];
    store.getState().catalogItems.filter(i=>["SUPPLIES","MEDICATIONS"].includes(i.category)).slice(0,8).forEach((item,index)=>{if(fd.has(`item-${index}`)) items.push({catalogItemId:item.id,name:item.name,quantity:Number(fd.get(`qty-${index}`)||1)});});
    if(!items.length) return showToast("Selecciona al menos un componente.","danger");
    const result=runSafely(()=>store.createKit({name:fd.get("name"),code:fd.get("code"),items}),"Kit creado.");
    if(result) closeModal();
  }

  if(action==="save-catalog-item"){
    const form=document.querySelector("#catalog-form");
    if(!form?.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    data.taxable=formBool(form,"taxable");data.requiresLot=formBool(form,"requiresLot");
    if(data.id) return showToast("La edición productiva está preparada en el repositorio Supabase; el modo demo evita alterar catálogos base.","info");
    const result=runSafely(()=>store.createCatalogItem(data),"Ítem de catálogo creado.");
    if(result) closeModal();
  }

  if(action==="save-discount"){
    const form=document.querySelector("#discount-form");
    if(!form?.reportValidity()) return;
    const fd=new FormData(form);const categories={};
    Object.keys(ITEM_CATEGORY_LABELS).forEach(k=>categories[k]=Number(fd.get(`cat-${k}`)||0));
    const result=runSafely(()=>store.createDiscountRule({name:fd.get("name"),type:fd.get("type"),categories,requiresApproval:fd.has("requiresApproval")}),"Perfil de descuento creado.");
    if(result) closeModal();
  }

  if(action==="save-medication-card"){
    const form=document.querySelector("#medication-card-form");
    if(!form?.reportValidity()) return;
    syncMedicationDraft();
    if(!ui.medicationDraft?.items.length){showToast("Agregue al menos un tratamiento documentado.","danger");return;}
    const signNow=ui.medicationDraft.signNow;
    const card=await runSafely(()=>store.createMedicationCard(ui.medicationDraft),"Tarjeta de medicamentos creada como borrador.");
    if(card&&signNow) await runSafely(()=>store.signMedicationCard(card.id),"Tarjeta firmada y bloqueada.");
    if(card){ui.medicationDraft=null;closeModal();location.hash="#/clinica/medicamentos";render();}
  }

  if(action==="save-doctor"){
    const form=document.querySelector("#doctor-form");
    if(!form?.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    const state=store.getState();
    state.doctors.unshift({id:uid("DOC"),...data,status:"ACTIVE"});
    store.save();showToast("Profesional creado.");closeModal();render();
  }
});

window.addEventListener("hashchange", () => { closeModal(); closeOverlays(); ui.sidebarOpen=false; render(); });
window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    ui.commandOpen = true; renderOverlays(); setTimeout(()=>document.querySelector("#command-input")?.focus(),10);
  }
  if (event.key === "Escape") {
    if (modalRoot.classList.contains("open")) closeModal();
    closeOverlays();
  }
});
overlayRoot.addEventListener("click",(event)=>{if(event.target===overlayRoot)closeOverlays();});

store.subscribe(render);
if (!location.hash) location.hash = "#/dashboard";
render();

window.__ANALIZA_QA__ = { store, config, render, openModal, closeModal };
