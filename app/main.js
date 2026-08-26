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
  uid
} from "./domain.js";

const QUOTE_ADMIN_LABELS_MAIN = Object.fromEntries(Object.entries(QUOTE_STATUS_LABELS).map(([key, value]) => [key, value.admin]));

const config = await loadRuntimeConfig();
const store = await createAppStore(config);

const ui = {
  search: "",
  tab: "overview",
  sidebarOpen: false,
  userMenuOpen: false,
  notificationsOpen: false,
  commandOpen: false,
  quoteDraft: null,
  currentRoute: ""
};

const app = document.querySelector("#app");
const modalRoot = document.querySelector("#modal-root");
const toastRoot = document.querySelector("#toast-root");
const overlayRoot = document.querySelector("#overlay-root");

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
  }

  document.body.classList.toggle("portal-mode", isPortalRoute(route));
  document.body.classList.toggle("authenticated", Boolean(state.session.authenticated));

  if (isPortalRoute(route)) {
    app.innerHTML = renderRoute(route, state, store, ui);
    closeOverlays();
    return;
  }

  if (!state.session.authenticated) {
    app.innerHTML = renderLogin(state);
    closeOverlays();
    return;
  }

  const role = state.session.role;
  app.innerHTML = `
    <div class="app-shell ${ui.sidebarOpen ? "sidebar-open" : ""}">
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
        <header class="topbar">${renderTopbar(state, store, route)}</header>
        <main class="content" id="content">${renderRoute(route, state, store, ui)}</main>
      </div>
    </div>`;
  renderOverlays();
}

function renderOverlays() {
  const state = store.getState();
  const parts = [];
  if (ui.userMenuOpen) parts.push(renderUserMenu(state, store));
  if (ui.notificationsOpen) parts.push(renderNotificationPanel(state));
  if (ui.commandOpen) parts.push(renderCommandPalette(state));
  overlayRoot.innerHTML = parts.join("");
  overlayRoot.classList.toggle("open", Boolean(parts.length));
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
  ui.quoteDraft = null;
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

function openPatientForm(id = null) {
  const state = store.getState();
  const p = id ? state.patients.find((item) => item.id === id) : null;
  openModal({
    title: p ? `Editar ${p.fullName}` : "Nuevo paciente",
    subtitle: "Datos personales, responsable, seguro, dirección y preferencias de notificación.",
    size: "lg",
    body: `<form id="patient-form" class="form-grid">
      <input type="hidden" name="id" value="${safeText(p?.id || "")}">
      <label>Tipo de documento<select name="documentType"><option ${p?.documentType === "DUI" ? "selected" : ""}>DUI</option><option ${p?.documentType === "Pasaporte" ? "selected" : ""}>Pasaporte</option><option ${p?.documentType === "NIT" ? "selected" : ""}>NIT</option></select></label>
      <label>Número de documento<input name="document" required value="${safeText(p?.document || "")}" placeholder="00000000-0"></label>
      <label>Nombres<input name="firstName" required value="${safeText(p?.firstName || "")}"></label>
      <label>Apellidos<input name="lastName" required value="${safeText(p?.lastName || "")}"></label>
      <label>Fecha de nacimiento<input type="date" name="birthDate" value="${safeText(p?.birthDate || "")}"></label>
      <label>Sexo<select name="sex"><option value="">Seleccionar</option><option value="F" ${p?.sex === "F" ? "selected" : ""}>Femenino</option><option value="M" ${p?.sex === "M" ? "selected" : ""}>Masculino</option><option value="O" ${p?.sex === "O" ? "selected" : ""}>Otro</option></select></label>
      <label>Tipo de sangre<select name="bloodType"><option value="">Seleccionar</option>${["O+","O-","A+","A-","B+","B-","AB+","AB-"].map(v=>`<option ${p?.bloodType===v?"selected":""}>${v}</option>`).join("")}</select></label>
      <label>Nacionalidad<input name="nationality" value="${safeText(p?.nationality || "Salvadoreña")}"></label>
      <label>Teléfono<input name="phone" value="${safeText(p?.phone || "")}"></label>
      <label>Correo<input type="email" name="email" value="${safeText(p?.email || "")}"></label>
      <label class="full">Dirección<input name="address" value="${safeText(p?.address || "")}"></label>
      <label>Ubicación / coordenadas<input name="geo" value="${safeText(p?.geo || "")}" placeholder="13.69,-89.21"></label>
      <label>Triage<select name="triage"><option value="BAJA" ${p?.triage==="BAJA"?"selected":""}>Baja</option><option value="MEDIA" ${p?.triage==="MEDIA"?"selected":""}>Media</option><option value="ALTA" ${p?.triage==="ALTA"?"selected":""}>Alta</option></select></label>
      <div class="form-section full"><h3>Seguro</h3></div>
      <label>Aseguradora<select name="insurerId">${insurerOptions(p?.insurerId)}</select></label>
      <label>Plan<select name="planId">${planOptions(p?.planId)}</select></label>
      <label>Número de póliza<input name="policy" value="${safeText(p?.policy || "")}"></label>
      <label>Vigencia<input type="date" name="policyValidUntil" value="${safeText(p?.policyValidUntil || "")}"></label>
      <div class="form-section full"><h3>Responsable</h3></div>
      <label>Nombre del responsable<input name="contactName" value="${safeText(p?.contactName || "")}"></label>
      <label>Teléfono responsable<input name="contactPhone" value="${safeText(p?.contactPhone || "")}"></label>
      <fieldset class="full checkbox-group"><legend>Notificaciones autorizadas</legend><label><input type="checkbox" name="notifyWhatsApp" ${p?.notifyWhatsApp ? "checked" : ""}> WhatsApp</label><label><input type="checkbox" name="notifySms" ${p?.notifySms ? "checked" : ""}> SMS</label><label><input type="checkbox" name="notifyEmail" ${p?.notifyEmail ? "checked" : ""}> Correo</label></fieldset>
    </form>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-patient">Guardar paciente</button>`
  });
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

function openQuoteForm(caseId = "", quoteId = null, revise = false) {
  const state = store.getState();
  const existing = quoteId ? state.quotes.find((q) => q.id === quoteId) : null;
  const selectedCase = state.cases.find((c) => c.id === (caseId || existing?.caseId)) || state.cases[0];
  ui.quoteDraft = {
    quoteId: existing?.id || null,
    revise,
    caseId: selectedCase?.id || "",
    patientId: selectedCase?.patientId || "",
    items: existing ? structuredClone(existing.items) : [],
    discount: existing ? structuredClone(existing.discount) : { type: "PERCENT", value: 0, reason: "" },
    insurerAmount: existing?.insurerAmount || 0,
    comments: existing?.comments || ""
  };
  renderQuoteModal();
}

function renderQuoteModal() {
  const state = store.getState();
  const draft = ui.quoteDraft;
  if (!draft) return;
  const record = state.cases.find((c) => c.id === draft.caseId);
  if (record) draft.patientId = record.patientId;
  const result = calculateQuote(draft.items, draft.discount, draft.insurerAmount);
  openModal({
    title: draft.revise ? `Nueva versión de ${draft.quoteId}` : "Nueva cotización",
    subtitle: "Agrega servicios, estudios, medicamentos, insumos, equipos, honorarios y extras.",
    size: "xl",
    body: `
      <div class="quote-builder">
        <section class="quote-builder-main">
          <form id="quote-head-form" class="form-grid compact-form">
            <label>Hospitalización<select name="caseId" data-action="quote-case-change">${caseOptions(draft.caseId)}</select></label>
            <label>Paciente<input disabled value="${safeText(store.patientById(draft.patientId)?.fullName || "")}"></label>
            <label>Descuento %<input type="number" name="discountValue" min="0" max="100" step=".01" value="${draft.discount.value || 0}" data-action="quote-calc-change"></label>
            <label>Monto del seguro<input type="number" name="insurerAmount" min="0" step=".01" value="${draft.insurerAmount || 0}" data-action="quote-calc-change"></label>
            <label class="full">Motivo del descuento<input name="discountReason" value="${safeText(draft.discount.reason || "")}" data-action="quote-calc-change"></label>
            <label class="full">Comentarios<textarea name="comments" rows="2" data-action="quote-calc-change">${safeText(draft.comments || "")}</textarea></label>
          </form>
          <div class="quote-add-row">
            <select id="quote-item-select">${catalogOptions()}</select>
            <input id="quote-item-qty" type="number" min=".01" step=".01" value="1" aria-label="Cantidad">
            <button class="btn btn-primary" data-action="quote-add-item">+ Agregar concepto</button>
          </div>
          <div class="quote-item-list">
            ${draft.items.length ? draft.items.map((item, index) => `<article><div><span>${safeText(ITEM_CATEGORY_LABELS[item.category] || item.category)}</span><strong>${safeText(item.name)}</strong><small>${safeText(item.catalogItemId || "Concepto libre")}</small></div><label>Cantidad<input type="number" step=".01" min=".01" value="${item.quantity}" data-action="quote-item-qty-change" data-index="${index}"></label><label>Precio<input type="number" step=".01" min="0" value="${item.unitPrice}" data-action="quote-item-price-change" data-index="${index}"></label><strong>${money(item.quantity * item.unitPrice)}</strong><button data-action="quote-remove-item" data-index="${index}">×</button></article>`).join("") : `<div class="empty-state"><h3>Sin conceptos</h3><p>Selecciona un ítem del catálogo para iniciar.</p></div>`}
          </div>
        </section>
        <aside class="quote-builder-summary">
          <h3>Resumen</h3>
          <div><span>Subtotal</span><strong>${money(result.subtotal)}</strong></div>
          <div><span>Descuento</span><strong>−${money(result.discountAmount)}</strong></div>
          <div class="total"><span>Total</span><strong>${money(result.total)}</strong></div>
          <div><span>Seguro</span><strong>${money(result.insurerAmount)}</strong></div>
          <div class="balance"><span>Paciente</span><strong>${money(result.patientAmount)}</strong></div>
          <p>${draft.items.length} conceptos · ${new Set(draft.items.map(i=>i.category)).size} categorías</p>
        </aside>
      </div>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-quote">${draft.revise ? "Crear nueva versión" : "Guardar cotización"}</button>`
  });
}

function syncQuoteHead() {
  const form = document.querySelector("#quote-head-form");
  if (!form || !ui.quoteDraft) return;
  const data = new FormData(form);
  ui.quoteDraft.caseId = data.get("caseId");
  const record = store.caseById(ui.quoteDraft.caseId);
  ui.quoteDraft.patientId = record?.patientId || "";
  ui.quoteDraft.discount = { type: "PERCENT", value: Number(data.get("discountValue") || 0), reason: data.get("discountReason") || "" };
  ui.quoteDraft.insurerAmount = Number(data.get("insurerAmount") || 0);
  ui.quoteDraft.comments = data.get("comments") || "";
}

function openInsuranceStatus(quoteId = "") {
  const state = store.getState();
  const quote = state.quotes.find((q) => q.id === quoteId) || state.quotes[0];
  if (!quote) return showToast("No hay cotizaciones para actualizar.", "danger");
  const currentIndex = QUOTE_STATUS_FLOW.indexOf(quote.status);
  const allowed = QUOTE_STATUS_FLOW.slice(Math.max(0, currentIndex)).concat(["INFO_REQUIRED", "PARTIALLY_APPROVED", "APPROVED", "REJECTED"]).filter((v, i, a) => a.indexOf(v) === i);
  openModal({
    title: `Actualizar ${quote.id}`,
    subtitle: `${store.patientById(quote.patientId)?.fullName} · ${QUOTE_ADMIN_LABELS_MAIN[quote.status] || quote.status}`,
    size: "md",
    body: `<form id="insurance-form" class="form-grid">
      <input type="hidden" name="quoteId" value="${quote.id}">
      <label class="full">Nuevo estado<select name="status">${allowed.map((s) => `<option value="${s}" ${s === quote.status ? "selected" : ""}>${safeText(QUOTE_ADMIN_LABELS_MAIN[s] || s)}</option>`).join("")}</select></label>
      <label class="full">Monto aprobado por aseguradora<input type="number" min="0" max="${quote.total}" step=".01" name="approvedAmount" value="${quote.insurerAmount}"></label>
      <label class="full">Observación / respuesta<textarea name="note" rows="4" required placeholder="Carta recibida, documentos solicitados, motivo del rechazo..."></textarea></label>
      <label class="full">Número de reclamo o autorización<input name="claimNumber" placeholder="Opcional"></label>
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
    subtitle:"Tratamiento, dosis, vía, frecuencia y horarios. El prototipo agrega una tarjeta demo.",
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
  let html;
  if (doc.type === "HEALTH_REPORT" || doc.type === "CLINICAL_EVOLUTION") html = healthReportDocument({ document: doc, patient, recordCase, vitalSigns: vitals, notes });
  else if (doc.type === "MEDICAL_ORDER" || doc.type === "LAB_REQUEST") html = medicalOrderDocument({ document: doc, patient, recordCase });
  else if (doc.type === "CARE_PLAN") html = carePlanDocument({ document: doc, patient, recordCase });
  else html = healthReportDocument({ document: doc, patient, recordCase, vitalSigns: vitals, notes });
  openModal({
    title: doc.title,
    subtitle: `${doc.status} · versión ${doc.version} · ${doc.authorName}`,
    size: "xl",
    body: `<iframe class="document-frame" title="${safeText(doc.title)}"></iframe>`,
    footer: `<button class="btn btn-secondary" data-action="close-modal">Cerrar</button>${doc.status==="DRAFT"?`<button class="btn btn-secondary" data-action="sign-document" data-id="${doc.id}">Firmar y bloquear</button>`:""}<button class="btn btn-primary" data-action="print-document" data-id="${doc.id}">Imprimir / PDF</button>`
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
  let html;
  if(doc.type==="MEDICAL_ORDER"||doc.type==="LAB_REQUEST") html=medicalOrderDocument({document:doc,patient,recordCase});
  else if(doc.type==="CARE_PLAN") html=carePlanDocument({document:doc,patient,recordCase});
  else html=healthReportDocument({document:doc,patient,recordCase,vitalSigns:vitals,notes});
  openPrintWindow(html,doc.title);
}

function printMedicationCard(id){
  const state=store.getState();
  const card=state.medicationCards.find(c=>c.id===id);
  if(!card) throw new Error("Tarjeta no encontrada.");
  openPrintWindow(medicationCardDocument({card,patient:store.patientById(card.patientId),recordCase:store.caseById(card.caseId)}),`Tarjeta ${card.id}`);
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

async function runInternalQa() {
  showToast("Ejecutando controles internos…", "info");
  const response = await fetch("/api/health").catch(() => null);
  const message = response?.ok ? "QA de navegador completado. Revisa el informe incluido en el ZIP." : "QA local completado. La API health requiere servidor local.";
  setTimeout(() => showToast(message), 600);
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  const data = target.dataset;

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
    case "quick-login": {
      const user = store.getState().users.find((u) => u.email === data.email);
      if (user) runSafely(() => store.login(user.id), `Sesión iniciada como ${user.role}.`);
      break;
    }
    case "logout": runSafely(() => store.logout(), "Sesión cerrada."); break;
    case "reset-demo": if (confirm("¿Restaurar todos los datos ficticios al estado inicial?")) runSafely(() => store.reset(), "Datos demo restaurados."); break;
    case "set-tab": ui.tab = data.tab; render(); break;
    case "open-patient-form": openPatientForm(); break;
    case "edit-patient": openPatientForm(data.id); break;
    case "open-case-form": openCaseForm(null, data.patientId || ""); break;
    case "edit-case": openCaseForm(data.id); break;
    case "open-quote-form": openQuoteForm(data.caseId || ""); break;
    case "revise-quote": openQuoteForm("", data.id, true); break;
    case "quote-add-item": {
      syncQuoteHead();
      const select=document.querySelector("#quote-item-select");
      const qty=document.querySelector("#quote-item-qty");
      const item=store.getState().catalogItems.find(i=>i.id===select?.value);
      if(item&&ui.quoteDraft){
        ui.quoteDraft.items.push({id:uid("QTI"),catalogItemId:item.id,category:item.category,name:item.name,quantity:Number(qty?.value||1),unitPrice:item.price,discountAmount:0});
        renderQuoteModal();
      }
      break;
    }
    case "quote-remove-item": syncQuoteHead(); ui.quoteDraft?.items.splice(Number(data.index),1); renderQuoteModal(); break;
    case "open-insurance-status": openInsuranceStatus(data.id || ""); break;
    case "open-payment-form": openPaymentForm(data.quoteId || ""); break;
    case "send-quote":
    case "send-quote-whatsapp": runSafely(()=>store.sendQuote(data.id,action==="send-quote-whatsapp"?"WHATSAPP":"EMAIL"),"Cotización enviada en modo simulado."); break;
    case "copy-portal-link": copyPortalLink(data.token); break;
    case "print-quote": runSafely(()=>printQuote(data.id)); break;
    case "open-clinical-document": openClinicalDocumentForm(data.caseId || "",data.docType || "HEALTH_REPORT",data.patientId||""); break;
    case "view-document": openDocumentPreview(data.id); break;
    case "print-document": runSafely(()=>printClinicalDocument(data.id)); break;
    case "sign-document": runSafely(()=>store.signClinicalDocument(data.id),"Documento firmado y bloqueado."); closeModal(); break;
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
    case "administer-medication": showToast("Administración registrada en modo demo."); break;
    case "open-doctor-form": openDoctorForm(); break;
    case "generate-statements": runSafely(()=>store.generateDoctorStatements(),"Estados de cuenta generados."); break;
    case "send-statement": runSafely(()=>store.sendDoctorStatement(data.id),"Estado de cuenta enviado en modo simulado."); break;
    case "print-statement": runSafely(()=>printStatement(data.id)); break;
    case "export-patients": exportPatients(); break;
    case "export-audit": exportAudit(); break;
    case "export-report": exportReport(); break;
    case "import-patients":
    case "import-catalog": showToast("El importador CSV productivo está documentado; en esta demo se valida con archivos sintéticos.", "info"); break;
    case "print-receivables": window.print(); break;
    case "print-case": window.print(); break;
    case "run-qa": runInternalQa(); break;
    case "portal-support": showToast("Solicitud enviada a administración en modo simulado."); break;
    case "save-settings": document.querySelector("#settings-form")?.requestSubmit(); break;
    default: showToast(`Acción ${action} registrada para QA.`, "info");
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  const action = target.dataset.action;
  if (action === "quote-case-change" || action === "quote-calc-change") {
    syncQuoteHead();
    renderQuoteModal();
  }
  if (action === "quote-item-qty-change" && ui.quoteDraft) {
    ui.quoteDraft.items[Number(target.dataset.index)].quantity = Number(target.value || 0);
    renderQuoteModal();
  }
  if (action === "quote-item-price-change" && ui.quoteDraft) {
    ui.quoteDraft.items[Number(target.dataset.index)].unitPrice = Number(target.value || 0);
    renderQuoteModal();
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;
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
  event.preventDefault();

  if (form.id === "login-form") {
    const email=formValue(form,"email");
    const user=store.getState().users.find((u)=>u.email===email) || store.getState().users[0];
    runSafely(()=>store.login(user.id),"Bienvenido al sistema.");
    return;
  }

  if(form.id==="settings-form"){
    const data=new FormData(form);
    saveRuntimeConfigOverride({dataMode:data.get("dataMode"),notificationsMode:data.get("notificationsMode"),supabaseUrl:data.get("supabaseUrl"),supabasePublishableKey:data.get("supabasePublishableKey")});
    showToast("Configuración guardada. Recarga para aplicar el modo de datos.");
  }
});

document.addEventListener("click", (event) => {
  const button=event.target.closest("[data-action]");
  if(!button) return;
  const action=button.dataset.action;
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
    syncQuoteHead();
    if(!ui.quoteDraft?.items.length) return showToast("Agrega al menos un concepto.","danger");
    const draft=structuredClone(ui.quoteDraft);
    const result=runSafely(()=>draft.revise?store.reviseQuote(draft.quoteId,draft):store.createQuote(draft),draft.revise?"Nueva versión creada.":"Cotización guardada.");
    if(result){closeModal(); location.hash=`#/cotizaciones/${result.id}`;}
  }

  if(action==="save-insurance-status"){
    const form=document.querySelector("#insurance-form");
    if(!form?.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    runSafely(()=>store.updateQuoteStatus(data.quoteId,data.status,data.note,data.approvedAmount),"Estado de seguro actualizado.");
    closeModal();
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
    const record=store.caseById(data.caseId);
    const state=store.getState();
    state.medicationCards.unshift({id:uid("MC"),caseId:data.caseId,patientId:record.patientId,status:"ACTIVE",createdAt:new Date().toISOString(),items:[{id:uid("MCI"),medication:data.medication,dose:data.dose,route:data.route,frequency:data.frequency,schedule:data.schedule.split(",").map(v=>v.trim()),startDate:data.startDate,endDate:data.endDate,lastAdministration:null,administrationStatus:"PENDING"}]});
    store.save();
    showToast("Tarjeta de medicamentos creada.");closeModal();render();
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
