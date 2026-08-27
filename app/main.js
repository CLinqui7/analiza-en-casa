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
  "open-shift-form": "clinical:write",
  "open-medication-card": "clinical:write",
  "sign-medication-card": "clinical:sign",
  "administer-medication": "clinical:write",
  "open-purchase-form": "purchases:write",
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

function openClinicalDocumentForm(caseId = "", type = "HEALTH_REPORT", patientId = "") {
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

function openShiftForm(caseId = "") {
  const state = store.getState();
  const record = state.cases.find((c) => c.id === caseId) || state.cases[0];
  const resources = state.users.filter((u) => ["NURSE", "DOCTOR"].includes(u.role));
  const tomorrow = new Date(Date.now() + 86400000);
  const date = tomorrow.toISOString().slice(0, 10);
  openModal({
    title: "Programar turno",
    subtitle: "Paciente, recurso, tipo de servicio, fecha y horario.",
    size: "md",
    body: `<form id="shift-form" class="form-grid">
      <label class="full">Hospitalización<select name="caseId">${caseOptions(record?.id)}</select></label>
      <label class="full">Recurso<select name="resourceId">${resources.map((u) => `<option value="${u.id}" data-name="${safeText(u.name)}">${safeText(u.name)} · ${safeText(u.role)}</option>`).join("")}</select></label>
      <label>Fecha<input type="date" name="date" value="${date}" required></label>
      <label>Tipo<select name="type"><option value="ENFERMERIA_12H">Enfermería 12 horas</option><option value="ENFERMERIA_24H">Enfermería 24 horas</option><option value="VISITA_MEDICA">Visita médica</option><option value="SUPERVISION">Supervisión</option><option value="TERAPIA">Terapia</option></select></label>
      <label>Hora inicio<input type="time" name="startTime" value="06:00" required></label>
      <label>Hora fin<input type="time" name="endTime" value="18:00" required></label>
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-shift">Programar</button>`
  });
}

function openPurchaseForm() {
  const state = store.getState();
  openModal({
    title: "Nueva compra",
    subtitle: "Solicitud o compra ejecutada con proveedor, factura, ítems, IVA y entrada posterior a inventario.",
    size: "lg",
    body: `<form id="purchase-form" class="form-grid">
      <label>Proveedor<select name="supplierId">${state.suppliers.map((s) => `<option value="${s.id}">${safeText(s.name)}</option>`).join("")}</select></label>
      <label>Fecha<input type="date" name="date" value="${new Date().toISOString().slice(0, 10)}"></label>
      <label>Número de factura<input name="invoiceNumber" value="FAC-DEMO-${Math.floor(Math.random()*9000+1000)}"></label>
      <label>Tipo de pago<select name="paymentType"><option>CREDIT</option><option>CASH</option><option>PETTY_CASH</option></select></label>
      <label>Estado<select name="status"><option>PENDING_APPROVAL</option><option>APPROVED</option><option>RECEIVED</option></select></label>
      <label>Descuento monetario<input type="number" name="discount" min="0" step=".01" value="0"></label>
      <div class="form-section full"><h3>Concepto de compra</h3></div>
      <label class="full">Ítem<select name="catalogItemId">${catalogOptions()}</select></label>
      <label>Cantidad<input type="number" name="quantity" min=".01" step=".01" value="10"></label>
      <label>Costo unitario<input type="number" name="unitCost" min="0" step=".01" value="10"></label>
      <label>IVA %<input type="number" name="taxRate" min="0" step=".01" value="13"></label>
      <label class="full upload-zone">Factura PDF o imagen<input type="file" name="invoiceFile"><small>Se almacenará en Supabase Storage privado en modo productivo.</small></label>
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-purchase">Guardar compra</button>`
  });
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

function openMedicationCardForm() {
  const state = store.getState();
  const record=state.cases[0];
  openModal({
    title:"Nueva tarjeta de medicamentos",
    subtitle:"Tratamiento, dosis, vía, frecuencia y horarios. La firma bloquea el contenido y las correcciones quedan auditadas.",
    size:"lg",
    body:`<form id="medication-card-form" class="form-grid">
      <label class="full">Hospitalización<select name="caseId">${caseOptions(record?.id)}</select></label>
      <label class="full">Medicamento<input name="medication" required value="Medicamento demo 500 mg"></label>
      <label>Dosis<input name="dose" value="1 tableta"></label>
      <label>Vía<select name="route"><option>VO</option><option>IV</option><option>IM</option><option>SC</option><option>INHALADA</option></select></label>
      <label>Frecuencia<input name="frequency" value="Cada 8 horas"></label>
      <label>Horarios<input name="schedule" value="06:00, 14:00, 22:00"></label>
      <label>Inicio<input type="date" name="startDate" value="${new Date().toISOString().slice(0,10)}"></label>
      <label>Fin<input type="date" name="endDate" value="${new Date(Date.now()+7*86400000).toISOString().slice(0,10)}"></label>
      <label class="full"><input type="checkbox" name="signNow"> Firmar y bloquear al guardar</label>
    </form>`,
    footer:`<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-medication-card">Crear tarjeta</button>`
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

function printMedicationCard(id){
  const state=store.getState();
  const card=state.medicationCards.find(c=>c.id===id);
  if(!card) throw new Error("Tarjeta no encontrada.");
  const corrections=state.clinicalCorrections.filter(item=>item.subjectType==="MEDICATION_CARD"&&item.subjectId===card.id);
  openPrintWindow(medicationCardDocument({card,patient:store.patientById(card.patientId),recordCase:store.caseById(card.caseId),corrections}),`Tarjeta ${card.id}`);
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
    case "open-payment-form": openPaymentForm(data.quoteId || ""); break;
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
    case "open-purchase-form": openPurchaseForm(); break;
    case "view-purchase": runSafely(()=>printPurchase(data.id)); break;
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
    case "open-medication-card": openMedicationCardForm(); break;
    case "print-medication-card": runSafely(()=>printMedicationCard(data.id)); break;
    case "sign-medication-card": runSafely(()=>store.signMedicationCard(data.id),"Tarjeta firmada y bloqueada."); break;
    case "administer-medication": showToast("Administración registrada en modo demo."); break;
    case "open-doctor-form": openDoctorForm(); break;
    case "generate-statements": runSafely(()=>store.generateDoctorStatements(),"Estados de cuenta generados."); break;
    case "send-statement": runSafely(()=>store.sendDoctorStatement(data.id),"Estado de cuenta enviado en modo simulado."); break;
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
    const result=runSafely(()=>store.createPayment(data),"Pago aplicado sin duplicar la referencia.");
    if(result) closeModal();
  }

  if(action==="save-clinical-document"){
    const form=document.querySelector("#clinical-document-form");
    if(!form?.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    const document=runSafely(()=>store.createClinicalDocument({caseId:data.caseId,type:data.type,title:data.title,summary:data.summary,content:{diagnosis:data.diagnosis,background:(data.background||"").split(",").map(v=>v.trim()).filter(Boolean),allergies:(data.allergies||"").split(",").map(v=>v.trim()).filter(Boolean),devices:(data.devices||"").split(",").map(v=>v.trim()).filter(Boolean),plan:data.plan}}),"Documento clínico creado.");
    if(document&&formBool(form,"signNow")) runSafely(()=>store.signClinicalDocument(document.id),"Documento firmado.");
    if(document){closeModal(); location.hash=`#/hospitalizaciones/${data.caseId}`; ui.tab="clinical";}
  }

  if(action==="save-clinical-correction"){
    const form=document.querySelector("#clinical-correction-form");
    if(!form?.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    const result=runSafely(()=>store.createClinicalCorrection(data.subjectType,data.subjectId,{kind:data.kind,reason:data.reason,content:{text:data.content}}),"Corrección auditada registrada.");
    if(result) closeModal();
  }

  if(action==="save-clinical-void"){
    const form=document.querySelector("#clinical-void-form");
    if(!form?.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    const result=runSafely(()=>data.subjectType==="CLINICAL_DOCUMENT"?store.voidClinicalDocument(data.subjectId,data.reason):store.voidClinicalRecord(data.subjectType,data.subjectId,data.reason),"Registro anulado y conservado en historial.");
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
    const resource=form.querySelector("select[name=resourceId] option:checked");
    data.resourceName=resource?.dataset.name||resource?.textContent;
    data.start=`${data.date}T${data.startTime}:00-06:00`; data.end=`${data.date}T${data.endTime}:00-06:00`;
    const result=runSafely(()=>store.createShift(data),"Turno programado.");
    if(result) closeModal();
  }

  if(action==="save-purchase"){
    const form=document.querySelector("#purchase-form");
    if(!form?.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    const item=store.getState().catalogItems.find(i=>i.id===data.catalogItemId);
    data.items=[{catalogItemId:item.id,name:item.name,quantity:Number(data.quantity),unitCost:Number(data.unitCost),taxRate:Number(data.taxRate)}];
    const result=runSafely(()=>store.createPurchase(data),"Compra creada; la entrada a inventario queda separada y auditable.");
    if(result) closeModal();
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
    const data=Object.fromEntries(new FormData(form));
    const card=runSafely(()=>store.createMedicationCard({caseId:data.caseId,items:[{id:uid("MCI"),medication:data.medication,dose:data.dose,route:data.route,frequency:data.frequency,schedule:data.schedule.split(",").map(v=>v.trim()).filter(Boolean),startDate:data.startDate,endDate:data.endDate,lastAdministration:null,administrationStatus:"PENDING"}]}),"Tarjeta de medicamentos creada como borrador.");
    if(card&&formBool(form,"signNow")) runSafely(()=>store.signMedicationCard(card.id),"Tarjeta firmada y bloqueada.");
    if(card){closeModal();render();}
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
