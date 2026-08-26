import {
  money,
  formatDate,
  quoteProgress,
  quoteBalance,
  inventoryFree,
  inventoryState,
  statementBalance,
  ageFromBirthDate,
  daysBetween,
  roleCan,
  QUOTE_STATUS_LABELS,
  ITEM_CATEGORY_LABELS,
  safeText
} from "./domain.js";

const QUOTE_ADMIN_LABELS = Object.fromEntries(Object.entries(QUOTE_STATUS_LABELS).map(([key, value]) => [key, value.admin]));

const STATUS_TONES = {
  ACTIVE: "success",
  APPROVED: "success",
  APPLIED: "success",
  DELIVERED: "success",
  SIGNED: "success",
  CONFIRMED: "success",
  RECEIVED: "success",
  CLOSED: "neutral",
  SENT: "info",
  SENT_TO_PATIENT: "info",
  SENT_TO_INSURER: "info",
  INSURER_REVIEW: "warning",
  INFO_REQUIRED: "warning",
  PARTIALLY_APPROVED: "warning",
  PATIENT_PAYMENT: "warning",
  SERVICE_SCHEDULED: "success",
  READY_TO_SEND: "info",
  READY_TO_SEND: "info",
  PENDING: "warning",
  PENDING_APPROVAL: "warning",
  PENDING_REVIEW: "warning",
  PENDING_CLOSE: "warning",
  DRAFT: "neutral",
  INACTIVE: "neutral",
  VOIDED: "danger",
  REJECTED: "danger",
  CANCELLED: "danger",
  FAILED: "danger",
  LOW: "danger",
  CRITICAL: "danger",
  OUT: "danger",
  OK: "success",
  PASS: "success",
  PARTIAL: "warning",
  MISSING: "danger",
  QUEUED: "info"
};

const LABELS = {
  ...QUOTE_ADMIN_LABELS,
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  PENDING: "Pendiente",
  APPLIED: "Aplicado",
  REVERSED: "Reversado",
  REFUNDED: "Reembolsado",
  DRAFT: "Borrador",
  SIGNED: "Firmado",
  VOIDED: "Anulado",
  CONFIRMED: "Confirmado",
  RECEIVED: "Recibida",
  PENDING_APPROVAL: "Pendiente de aprobación",
  PENDING_REVIEW: "Pendiente de revisión",
  APPROVED: "Aprobado",
  READY_TO_SEND: "Listo para enviar",
  SENT: "Enviado",
  DELIVERED: "Entregado",
  QUEUED: "En cola",
  FAILED: "Fallido",
  CLOSED: "Cerrado",
  PENDING_CLOSE: "Pendiente de cierre",
  PARTIAL: "Parcial",
  TOTAL: "Total",
  OPEN: "Abierto",
  AVAILABLE: "Disponible",
  EXPIRED: "Vencido",
  EXPIRING: "Próximo a vencer",
  PAID: "Pagado",
  UNPAID: "Pendiente",
  OUT: "Sin disponibilidad",
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
  ALTA: "Alta",
  MEDIA: "Media",
  BAJA: "Baja",
  PASS: "Cubierto",
  PARTIAL_QA: "Parcial",
  MISSING: "Faltante"
};

const DOC_TYPE_LABELS = {
  HEALTH_REPORT: "Reporte de salud",
  MEDICAL_ORDER: "Orden médica",
  MEDICATION_CARD: "Tarjeta de medicamentos",
  CARE_PLAN: "Plan de cuidados",
  CLINICAL_EVOLUTION: "Evolución clínica",
  LAB_REQUEST: "Solicitud de laboratorio",
  NURSING_NOTE: "Nota de enfermería"
};

const MOVE_LABELS = {
  PURCHASE_ENTRY: "Entrada por compra",
  PATIENT_COMMITMENT: "Compromiso a paciente",
  PATIENT_CONSUMPTION: "Consumo de paciente",
  RETURN_TO_STOCK: "Devolución a bodega",
  TRANSFER: "Traslado",
  POSITIVE_ADJUSTMENT: "Ajuste positivo",
  NEGATIVE_ADJUSTMENT: "Ajuste negativo",
  EXPIRY_DISPOSAL: "Baja por vencimiento"
};

function esc(value) {
  return safeText(value ?? "");
}

function badge(value, label = null) {
  const tone = STATUS_TONES[value] || "neutral";
  return `<span class="badge badge-${tone}">${esc(label || LABELS[value] || value || "N/D")}</span>`;
}

function initials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "AC";
}

function icon(name) {
  const icons = {
    dashboard: "⌂", patients: "♙", cases: "▦", quotes: "▧", insurance: "✓",
    money: "$", clinical: "✚", agenda: "▣", purchases: "▤", inventory: "▥",
    catalogs: "≡", doctors: "♟", reports: "⌁", settings: "⚙", audit: "◎",
    qa: "◫", plus: "+", print: "⎙", send: "➤", edit: "✎", view: "→",
    search: "⌕", filter: "⚑", alert: "!", check: "✓", clock: "◷",
    file: "▱", qr: "▦", reset: "↻", export: "⇩", upload: "⇧", close: "×"
  };
  return `<span class="icon icon-${name}" aria-hidden="true">${icons[name] || "•"}</span>`;
}

function actionButton(label, action, options = {}) {
  const { kind = "secondary", iconName = "", data = "", disabled = false, type = "button" } = options;
  return `<button type="${type}" class="btn btn-${kind}" data-action="${esc(action)}" ${data} ${disabled ? "disabled" : ""}>${iconName ? icon(iconName) : ""}<span>${esc(label)}</span></button>`;
}

function linkButton(label, href, options = {}) {
  const { kind = "secondary", iconName = "" } = options;
  return `<a class="btn btn-${kind}" href="${esc(href)}">${iconName ? icon(iconName) : ""}<span>${esc(label)}</span></a>`;
}

function pageHeader(title, description, actions = "") {
  return `
    <div class="page-header">
      <div>
        <p class="eyebrow">Analiza en Casa</p>
        <h1>${esc(title)}</h1>
        <p>${esc(description)}</p>
      </div>
      <div class="page-actions">${actions}</div>
    </div>`;
}

function metric(label, value, helper, iconName = "dashboard", tone = "teal") {
  return `
    <article class="metric-card metric-${tone}">
      <div class="metric-icon">${icon(iconName)}</div>
      <div>
        <p>${esc(label)}</p>
        <strong>${esc(value)}</strong>
        <small>${esc(helper)}</small>
      </div>
    </article>`;
}

function card(title, body, options = {}) {
  const { subtitle = "", actions = "", className = "" } = options;
  return `
    <section class="card ${className}">
      <header class="card-header">
        <div>
          <h2>${esc(title)}</h2>
          ${subtitle ? `<p>${esc(subtitle)}</p>` : ""}
        </div>
        <div class="card-actions">${actions}</div>
      </header>
      <div class="card-body">${body}</div>
    </section>`;
}

function emptyState(title, description, action = "") {
  return `<div class="empty-state">${icon("file")}<h3>${esc(title)}</h3><p>${esc(description)}</p>${action}</div>`;
}

function table(headers, rows, options = {}) {
  const { compact = false, className = "" } = options;
  return `
    <div class="table-wrap ${compact ? "table-compact" : ""}">
      <table class="${className}">
        <thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join("")}</tr></thead>
        <tbody>${rows.length ? rows.join("") : `<tr><td colspan="${headers.length}">${emptyState("Sin resultados", "Ajusta los filtros o crea un nuevo registro.")}</td></tr>`}</tbody>
      </table>
    </div>`;
}

function tabs(items, active) {
  return `<nav class="tabs">${items.map(([key, label, count]) =>
    `<button class="tab ${key === active ? "active" : ""}" data-action="set-tab" data-tab="${esc(key)}">${esc(label)}${count !== undefined ? `<span>${count}</span>` : ""}</button>`
  ).join("")}</nav>`;
}

function patientName(state, id) {
  return state.patients.find((item) => item.id === id)?.fullName || "Paciente no encontrado";
}

function doctorName(state, id) {
  return state.doctors.find((item) => item.id === id)?.name || "Sin médico";
}

function insurerName(state, id) {
  return state.insurers.find((item) => item.id === id)?.name || "Particular";
}

function warehouseName(state, id) {
  return state.warehouses.find((item) => item.id === id)?.name || id || "N/D";
}

function caseLabel(state, caseId) {
  const c = state.cases.find((item) => item.id === caseId);
  return c ? `${c.id} · ${patientName(state, c.patientId)}` : caseId;
}

function searchFilter(items, query, fields) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => fields.some((field) => String(item[field] ?? "").toLowerCase().includes(q)));
}

function renderDashboard(state, store, ui) {
  const activeCases = state.cases.filter((item) => !["CLOSED", "CANCELLED"].includes(item.status));
  const openQuotes = state.quotes.filter((item) => !["CLOSED", "CANCELLED", "REJECTED"].includes(item.status));
  const openBalance = state.quotes.reduce((sum, quote) => sum + quoteBalance(quote, state.payments), 0);
  const lowStock = state.inventoryItems.filter((item) => inventoryState(item) !== "OK");
  const pendingInsurance = state.insuranceRequests.filter((item) => !["APPROVED", "REJECTED", "CLOSED"].includes(item.status));
  const todayShifts = state.shifts.slice(0, 5);
  const recentEvents = state.auditLogs.slice(0, 7);

  const statusCounts = {};
  for (const quote of state.quotes) statusCounts[quote.status] = (statusCounts[quote.status] || 0) + 1;
  const maxCount = Math.max(1, ...Object.values(statusCounts));

  return `
    ${pageHeader("Centro operativo", "Una vista integral para pacientes, casos, cotizaciones, seguros, clínica, inventario y finanzas.",
      `${actionButton("Nueva cotización", "open-quote-form", {kind: "primary", iconName: "plus"})}${actionButton("Nuevo paciente", "open-patient-form", {iconName: "plus"})}`)}
    <div class="metrics-grid">
      ${metric("Pacientes activos", state.patients.filter((p) => p.status === "ACTIVE").length, `${activeCases.length} hospitalizaciones abiertas`, "patients", "teal")}
      ${metric("Cotizaciones abiertas", openQuotes.length, `${pendingInsurance.length} requieren seguimiento`, "quotes", "blue")}
      ${metric("Saldo por cobrar", money(openBalance), "Responsabilidad pendiente del paciente", "money", "amber")}
      ${metric("Alertas de inventario", lowStock.length, `${state.inventoryReservations.filter((r) => r.status === "OPEN").length} compromisos abiertos`, "inventory", "coral")}
    </div>

    <div class="dashboard-grid dashboard-grid-2">
      ${card("Embudo de cotizaciones", `
        <div class="status-bars">
          ${Object.entries(statusCounts).map(([status, count]) => `
            <a class="status-bar-row" href="#/preautorizaciones">
              <span>${esc(QUOTE_ADMIN_LABELS[status] || status)}</span>
              <div class="bar-track"><span style="width:${Math.max(8, count / maxCount * 100)}%"></span></div>
              <strong>${count}</strong>
            </a>`).join("")}
        </div>`, {subtitle: "Distribución por estado actual", actions: linkButton("Ver flujo", "#/preautorizaciones", {kind: "ghost"})})}

      ${card("Próximos turnos", `
        <div class="timeline-list">
          ${todayShifts.map((shift) => `
            <article class="timeline-item">
              <span class="timeline-dot"></span>
              <div><strong>${esc(shift.resourceName)}</strong><p>${esc(patientName(state, shift.patientId))} · ${esc(shift.type.replaceAll("_", " "))}</p><small>${formatDate(shift.start, true)} → ${formatDate(shift.end, true)}</small></div>
              ${badge(shift.status)}
            </article>`).join("")}
        </div>`, {actions: linkButton("Abrir agenda", "#/agenda", {kind: "ghost"})})}
    </div>

    <div class="dashboard-grid dashboard-grid-3">
      ${card("Casos que requieren acción", table(
        ["Caso", "Paciente", "Estado", "Próxima acción", ""],
        activeCases.slice(0, 6).map((record) => `<tr>
          <td><a class="strong-link" href="#/hospitalizaciones/${record.id}">${esc(record.id)}</a></td>
          <td>${esc(patientName(state, record.patientId))}</td>
          <td>${badge(record.status)}</td>
          <td class="cell-wrap">${esc(record.nextAction)}</td>
          <td><a class="row-action" href="#/hospitalizaciones/${record.id}">Abrir ${icon("view")}</a></td>
        </tr>`), {compact: true}), {className: "span-2"})}

      ${card("Inventario crítico", `
        <div class="compact-list">
          ${lowStock.slice(0, 6).map((item) => `<a href="#/inventario" class="compact-item">
            <div><strong>${esc(item.name)}</strong><small>${esc(warehouseName(state, item.warehouseId))}</small></div>
            <div class="align-right"><strong>${inventoryFree(item)} ${esc(item.unit)}</strong>${badge(inventoryState(item))}</div>
          </a>`).join("") || `<p class="success-callout">No hay alertas críticas.</p>`}
        </div>`, {actions: linkButton("Gestionar", "#/inventario", {kind: "ghost"})})}
    </div>

    ${card("Actividad reciente", table(
      ["Fecha", "Usuario", "Rol", "Acción", "Entidad", "Detalle"],
      recentEvents.map((event) => `<tr>
        <td>${formatDate(event.date, true)}</td>
        <td>${esc(event.user)}</td>
        <td>${badge(event.role, event.role)}</td>
        <td><code>${esc(event.action)}</code></td>
        <td>${esc(event.entity)}</td>
        <td class="cell-wrap">${esc(event.summary)}</td>
      </tr>`), {compact: true}), {actions: linkButton("Auditoría completa", "#/auditoria", {kind: "ghost"})})}
  `;
}

function renderPatients(state, store, ui) {
  const rows = searchFilter(state.patients, ui.search, ["fullName", "document", "phone", "email", "address"]).map((patient) => {
    const cases = state.cases.filter((item) => item.patientId === patient.id);
    return `<tr>
      <td><div class="person-cell"><span class="avatar">${initials(patient.fullName)}</span><div><a class="strong-link" href="#/pacientes/${patient.id}">${esc(patient.fullName)}</a><small>${esc(patient.id)}</small></div></div></td>
      <td>${esc(patient.documentType)} ${esc(patient.document)}</td>
      <td>${ageFromBirthDate(patient.birthDate)} años<br><small>${esc(patient.bloodType)}</small></td>
      <td>${esc(patient.phone)}<br><small>${esc(patient.email)}</small></td>
      <td>${esc(insurerName(state, patient.insurerId))}<br><small>${esc(patient.policy || "Sin póliza")}</small></td>
      <td>${badge(patient.triage)}</td>
      <td>${cases.length}</td>
      <td>${badge(patient.status)}</td>
      <td><div class="row-actions"><a href="#/pacientes/${patient.id}" title="Ver">${icon("view")}</a><button data-action="edit-patient" data-id="${patient.id}" title="Editar">${icon("edit")}</button></div></td>
    </tr>`;
  });

  return `
    ${pageHeader("Pacientes", "Expediente administrativo único con datos personales, responsables, seguro, ubicación y trazabilidad.",
      `${actionButton("Importar CSV", "import-patients", {iconName: "upload"})}${actionButton("Exportar", "export-patients", {iconName: "export"})}${actionButton("Nuevo paciente", "open-patient-form", {kind: "primary", iconName: "plus"})}`)}
    <div class="filter-bar">
      <label class="search-field">${icon("search")}<input data-ui-search placeholder="Buscar por nombre, DUI, teléfono o seguro" value="${esc(ui.search || "")}"></label>
      <select data-ui-filter="patientStatus"><option value="">Todos los estados</option><option>ACTIVE</option><option>INACTIVE</option></select>
      <div class="filter-summary">${rows.length} registros</div>
    </div>
    ${card("Directorio de pacientes", table(["Paciente", "Documento", "Edad", "Contacto", "Seguro", "Triage", "Casos", "Estado", ""], rows))}
  `;
}

function renderPatientDetail(state, store, ui, id) {
  const patient = state.patients.find((item) => item.id === id);
  if (!patient) return notFound("Paciente");
  const cases = state.cases.filter((item) => item.patientId === id);
  const quotes = state.quotes.filter((item) => item.patientId === id);
  const payments = state.payments.filter((item) => item.patientId === id);
  const documents = state.clinicalDocuments.filter((item) => item.patientId === id);
  const plan = state.insurancePlans.find((item) => item.id === patient.planId);
  return `
    ${pageHeader(patient.fullName, `${patient.id} · ${patient.documentType} ${patient.document}`,
      `${actionButton("Editar paciente", "edit-patient", {iconName: "edit", data: `data-id="${patient.id}"`})}${actionButton("Crear hospitalización", "open-case-form", {kind:"primary", iconName:"plus", data:`data-patient-id="${patient.id}"`})}`)}
    <div class="profile-grid">
      ${card("Datos personales", `
        <div class="profile-hero"><span class="avatar avatar-lg">${initials(patient.fullName)}</span><div><h3>${esc(patient.fullName)}</h3><p>${ageFromBirthDate(patient.birthDate)} años · ${patient.sex === "F" ? "Femenino" : "Masculino"} · Sangre ${esc(patient.bloodType)}</p>${badge(patient.status)} ${badge(patient.triage, `Triage ${LABELS[patient.triage] || patient.triage}`)}</div></div>
        <dl class="detail-list">
          <div><dt>Nacionalidad</dt><dd>${esc(patient.nationality)}</dd></div>
          <div><dt>Nacimiento</dt><dd>${formatDate(patient.birthDate)}</dd></div>
          <div><dt>Teléfono</dt><dd>${esc(patient.phone)}</dd></div>
          <div><dt>Correo</dt><dd>${esc(patient.email)}</dd></div>
          <div class="full"><dt>Dirección</dt><dd>${esc(patient.address)} <small>${esc(patient.geo)}</small></dd></div>
        </dl>`, {className:"span-2"})}
      ${card("Seguro", `
        <dl class="detail-list">
          <div class="full"><dt>Aseguradora</dt><dd>${esc(insurerName(state, patient.insurerId))}</dd></div>
          <div><dt>Plan</dt><dd>${esc(plan?.name || "N/D")}</dd></div>
          <div><dt>Póliza</dt><dd>${esc(patient.policy || "N/D")}</dd></div>
          <div class="full"><dt>Vigencia</dt><dd>${formatDate(patient.policyValidUntil)}</dd></div>
        </dl>
        <div class="info-callout">${esc(plan?.coverageNote || "La cobertura se registra según aprobación del seguro.")}</div>`)}
      ${card("Responsable y notificaciones", `
        <dl class="detail-list">
          <div class="full"><dt>Responsable</dt><dd>${esc(patient.contactName)}</dd></div>
          <div class="full"><dt>Teléfono</dt><dd>${esc(patient.contactPhone)}</dd></div>
        </dl>
        <div class="chip-row">
          <span class="chip ${patient.notifyWhatsApp ? "on" : ""}">WhatsApp</span>
          <span class="chip ${patient.notifySms ? "on" : ""}">SMS</span>
          <span class="chip ${patient.notifyEmail ? "on" : ""}">Correo</span>
        </div>`)}
    </div>

    <div class="dashboard-grid">
      ${card("Hospitalizaciones", table(["Caso", "Inicio", "Cuenta", "Estado", "Próxima acción"],
        cases.map((record) => `<tr><td><a class="strong-link" href="#/hospitalizaciones/${record.id}">${record.id}</a></td><td>${formatDate(record.startDate)}</td><td>${esc(record.accountType)}</td><td>${badge(record.status)}</td><td class="cell-wrap">${esc(record.nextAction)}</td></tr>`), {compact:true}), {className:"span-2"})}
      ${card("Resumen financiero", `
        <div class="financial-summary">
          <div><span>Cotizado</span><strong>${money(quotes.reduce((sum, item) => sum + item.total, 0))}</strong></div>
          <div><span>Seguro</span><strong>${money(quotes.reduce((sum, item) => sum + item.insurerAmount, 0))}</strong></div>
          <div><span>Pagado</span><strong>${money(payments.filter(p=>p.status==="APPLIED").reduce((sum, item) => sum + item.amount, 0))}</strong></div>
        </div>
        ${quotes[0] ? `<a class="portal-link" href="#/portal/${quotes[0].portalToken}">${icon("qr")} Abrir portal demo del paciente</a>` : ""}`)}
    </div>

    ${card("Documentos clínicos", table(["Documento", "Tipo", "Autor", "Fecha", "Versión", "Estado", ""],
      documents.map((doc) => `<tr>
        <td>${esc(doc.title)}</td><td>${esc(DOC_TYPE_LABELS[doc.type] || doc.type)}</td><td>${esc(doc.authorName)}</td>
        <td>${formatDate(doc.createdAt, true)}</td><td>v${doc.version}</td><td>${badge(doc.status)}</td>
        <td><button class="row-action" data-action="view-document" data-id="${doc.id}">Ver / imprimir</button></td>
      </tr>`), {compact:true}), {actions: actionButton("Nuevo documento", "open-clinical-document", {kind:"ghost", iconName:"plus", data:`data-patient-id="${patient.id}" data-case-id="${cases[0]?.id || ""}"`})})}
  `;
}

function renderCases(state, store, ui) {
  const records = searchFilter(state.cases, ui.search, ["id", "manager", "status", "diagnosisSummary", "nextAction"])
    .map((record) => {
      const quote = state.quotes.find((item) => item.caseId === record.id);
      return `<tr>
        <td><a class="strong-link" href="#/hospitalizaciones/${record.id}">${esc(record.id)}</a></td>
        <td>${esc(patientName(state, record.patientId))}</td>
        <td>${esc(record.accountType)}<br><small>${esc(insurerName(state, record.insurerId))}</small></td>
        <td>${esc(record.manager)}</td>
        <td>${formatDate(record.startDate)}<br><small>${daysBetween(record.startDate, record.endDate || new Date().toISOString())} días</small></td>
        <td>${badge(record.priority)}</td>
        <td>${badge(record.status)}</td>
        <td>${quote ? `<a href="#/cotizaciones/${quote.id}">${esc(quote.id)}<br>${badge(quote.status)}</a>` : `<span class="muted">Sin cotización</span>`}</td>
        <td><a class="row-action" href="#/hospitalizaciones/${record.id}">Gestionar ${icon("view")}</a></td>
      </tr>`;
    });
  return `
    ${pageHeader("Hospitalizaciones", "El caso es el contenedor central: paciente, cotización, seguro, pagos, clínica, agenda, inventario y cierre.",
      `${actionButton("Nueva hospitalización", "open-case-form", {kind:"primary", iconName:"plus"})}`)}
    <div class="filter-bar">
      <label class="search-field">${icon("search")}<input data-ui-search placeholder="Buscar caso, paciente, responsable o estado" value="${esc(ui.search || "")}"></label>
      <select data-ui-filter="caseStatus"><option value="">Todos los estados</option><option>ACTIVE</option><option>PENDING_CLOSE</option><option>CLOSED</option></select>
      <div class="filter-summary">${records.length} casos</div>
    </div>
    ${card("Gestión de hospitalizaciones", table(["Hospitalización", "Paciente", "Cuenta", "Responsable", "Duración", "Prioridad", "Estado", "Cotización", ""], records))}
  `;
}

function renderCaseDetail(state, store, ui, id) {
  const record = state.cases.find((item) => item.id === id);
  if (!record) return notFound("Hospitalización");
  const patient = state.patients.find((item) => item.id === record.patientId);
  const quote = state.quotes.find((item) => item.caseId === id);
  const docs = state.clinicalDocuments.filter((item) => item.caseId === id);
  const vitals = state.vitalSigns.filter((item) => item.caseId === id);
  const notes = state.nursingNotes.filter((item) => item.caseId === id);
  const reservations = state.inventoryReservations.filter((item) => item.caseId === id);
  const shifts = state.shifts.filter((item) => item.caseId === id);
  const payments = quote ? state.payments.filter((item) => item.quoteId === quote.id) : [];
  const tab = ui.tab || "overview";
  const tabItems = [
    ["overview", "Resumen"],
    ["quote", "Cotización", quote ? 1 : 0],
    ["clinical", "Clínica", docs.length + notes.length],
    ["inventory", "Inventario", reservations.length],
    ["agenda", "Agenda", shifts.length],
    ["payments", "Pagos", payments.length]
  ];

  let body = "";
  if (tab === "quote") {
    body = quote ? renderQuoteDetailContent(state, store, ui, quote) : emptyState("Sin cotización", "Crea la primera cotización para este caso.", actionButton("Crear cotización", "open-quote-form", {kind:"primary", data:`data-case-id="${id}"`}));
  } else if (tab === "clinical") {
    body = `
      <div class="action-strip">
        ${actionButton("Reporte de salud", "open-clinical-document", {kind:"primary", iconName:"plus", data:`data-case-id="${id}" data-doc-type="HEALTH_REPORT"`})}
        ${actionButton("Orden médica", "open-clinical-document", {iconName:"plus", data:`data-case-id="${id}" data-doc-type="MEDICAL_ORDER"`})}
        ${actionButton("Signos vitales", "open-vitals-form", {iconName:"plus", data:`data-case-id="${id}"`})}
        ${actionButton("Nota de enfermería", "open-nursing-note", {iconName:"plus", data:`data-case-id="${id}"`})}
      </div>
      <div class="dashboard-grid">
        ${card("Documentos clínicos", table(["Documento","Autor","Fecha","Versión","Estado",""],
          docs.map((doc)=>`<tr><td>${esc(doc.title)}<small>${esc(DOC_TYPE_LABELS[doc.type] || doc.type)}</small></td><td>${esc(doc.authorName)}</td><td>${formatDate(doc.createdAt,true)}</td><td>v${doc.version}</td><td>${badge(doc.status)}</td><td><button class="row-action" data-action="view-document" data-id="${doc.id}">Abrir</button></td></tr>`), {compact:true}), {className:"span-2"})}
        ${card("Últimos signos vitales", vitals.length ? vitals.slice(0,4).map((v)=>`<article class="vitals-card"><strong>${formatDate(v.recordedAt,true)}</strong><div><span>TA ${v.systolic}/${v.diastolic}</span><span>FC ${v.heartRate}</span><span>SpO₂ ${v.spo2}%</span><span>T° ${v.temperature}</span></div><small>${esc(v.authorName)}</small></article>`).join("") : emptyState("Sin registros","Agrega el primer control."))}
      </div>
      ${card("Notas de enfermería", notes.length ? notes.map((note)=>`<article class="note-card"><header><div><strong>${esc(note.authorName)}</strong><small>${formatDate(note.createdAt,true)}</small></div>${badge(note.status)}</header><p>${esc(note.text)}</p><footer>${badge(note.shareStatus, note.shareStatus==="SHARED_WITH_DOCTOR"?"Compartida con médico":"No compartida")}${note.status==="SIGNED" && note.shareStatus!=="SHARED_WITH_DOCTOR" ? actionButton("Compartir de forma segura","share-note",{kind:"ghost",iconName:"send",data:`data-id="${note.id}"`}):""}</footer></article>`).join("") : emptyState("Sin notas","Registra la primera nota de enfermería."))}
    `;
  } else if (tab === "inventory") {
    body = `
      <div class="action-strip">
        ${actionButton("Comprometer insumo", "open-inventory-movement", {kind:"primary",iconName:"plus",data:`data-case-id="${id}" data-type="PATIENT_COMMITMENT"`})}
        ${actionButton("Registrar consumo", "open-inventory-movement", {iconName:"plus",data:`data-case-id="${id}" data-type="PATIENT_CONSUMPTION"`})}
        ${actionButton("Crear cierre", "open-closure-form", {iconName:"plus",data:`data-case-id="${id}"`})}
      </div>
      ${card("Inventario temporal del paciente", table(["Ítem","Entregado","Consumido","Devuelto","Pendiente","Estado"],
        reservations.map((res)=>{
          const item=state.inventoryItems.find((candidate)=>candidate.id===res.inventoryItemId);
          return `<tr><td>${esc(item?.name || res.inventoryItemId)}</td><td>${res.delivered}</td><td>${res.consumed}</td><td>${res.returned}</td><td>${Math.max(0,res.delivered-res.consumed-res.returned)}</td><td>${badge(res.status)}</td></tr>`;
        }), {compact:true}))}
      ${card("Cierres", table(["ID","Tipo","Creación","Responsable","Estado",""],
        state.inventoryClosures.filter((c)=>c.caseId===id).map((closure)=>`<tr><td>${closure.id}</td><td>${badge(closure.type)}</td><td>${formatDate(closure.createdAt,true)}</td><td>${esc(closure.createdBy)}</td><td>${badge(closure.status)}</td><td>${closure.status==="PENDING_REVIEW" ? actionButton("Aprobar","approve-closure",{kind:"ghost",data:`data-id="${closure.id}"`}):""}</td></tr>`), {compact:true}))}
    `;
  } else if (tab === "agenda") {
    body = `
      <div class="action-strip">${actionButton("Programar turno", "open-shift-form", {kind:"primary",iconName:"plus",data:`data-case-id="${id}"`})}</div>
      ${renderShiftList(state, shifts)}
    `;
  } else if (tab === "payments") {
    body = quote ? `
      <div class="metrics-grid metrics-small">
        ${metric("Responsabilidad paciente",money(quote.patientAmount),"Monto posterior a cobertura","money","amber")}
        ${metric("Pagado",money(payments.filter(p=>p.status==="APPLIED").reduce((s,p)=>s+p.amount,0)),"Pagos aplicados","check","teal")}
        ${metric("Saldo",money(quoteBalance(quote,state.payments)),"Pendiente","clock","coral")}
      </div>
      <div class="action-strip">${actionButton("Registrar pago","open-payment-form",{kind:"primary",iconName:"plus",data:`data-quote-id="${quote.id}"`})}</div>
      ${renderPaymentsTable(state,payments)}
    ` : emptyState("Sin cotización","No existe cuenta por cobrar hasta crear una cotización.");
  } else {
    body = `
      <div class="case-summary">
        <section>
          <div class="profile-hero"><span class="avatar avatar-lg">${initials(patient?.fullName)}</span><div><h3>${esc(patient?.fullName)}</h3><p>${esc(record.diagnosisSummary)}</p>${badge(record.status)} ${badge(record.priority, `Prioridad ${LABELS[record.priority] || record.priority}`)}</div></div>
          <dl class="detail-list">
            <div><dt>Inicio</dt><dd>${formatDate(record.startDate)}</dd></div>
            <div><dt>Duración</dt><dd>${daysBetween(record.startDate,record.endDate||new Date().toISOString())} días</dd></div>
            <div><dt>Cuenta</dt><dd>${esc(record.accountType)}</dd></div>
            <div><dt>Aseguradora</dt><dd>${esc(insurerName(state,record.insurerId))}</dd></div>
            <div><dt>Médico contratante</dt><dd>${esc(doctorName(state,record.contractingDoctorId))}</dd></div>
            <div><dt>Responsable administrativo</dt><dd>${esc(record.manager)}</dd></div>
            <div class="full"><dt>Próxima acción</dt><dd>${esc(record.nextAction)}</dd></div>
            <div class="full"><dt>Dispositivos</dt><dd>${record.devices?.map((d)=>`<span class="chip on">${esc(d)}</span>`).join("") || "Ninguno"}</dd></div>
          </dl>
        </section>
        <aside class="next-action-panel">
          <span>${icon("clock")}</span><h3>Próxima acción</h3><p>${esc(record.nextAction)}</p>
          ${actionButton("Editar caso","edit-case",{kind:"ghost",iconName:"edit",data:`data-id="${record.id}"`})}
        </aside>
      </div>
      <div class="dashboard-grid">
        ${card("Cotización y seguro", quote ? `
          <div class="quote-mini"><div><span>${esc(quote.id)} · v${quote.version}</span><strong>${money(quote.total)}</strong></div>${badge(quote.status)}<div class="progress"><span style="width:${quoteProgress(quote.status)}%"></span></div><small>Seguro ${money(quote.insurerAmount)} · Paciente ${money(quote.patientAmount)}</small></div>
          <a class="portal-link" href="#/cotizaciones/${quote.id}">Gestionar cotización ${icon("view")}</a>
          <a class="portal-link" href="#/portal/${quote.portalToken}">${icon("qr")} Portal del paciente</a>` :
          emptyState("Sin cotización","Todavía no se ha creado una cotización.",actionButton("Crear cotización","open-quote-form",{kind:"primary",data:`data-case-id="${id}"`})))}
        ${card("Resumen clínico", `<div class="financial-summary"><div><span>Documentos</span><strong>${docs.length}</strong></div><div><span>Signos vitales</span><strong>${vitals.length}</strong></div><div><span>Notas</span><strong>${notes.length}</strong></div></div><button class="portal-link" data-action="set-tab" data-tab="clinical">Abrir expediente clínico ${icon("view")}</button>`)}
      </div>`;
  }

  return `
    ${pageHeader(record.id, `${patient?.fullName || ""} · ${record.accountType} · ${formatDate(record.startDate)}`,
      `${actionButton("Editar caso","edit-case",{iconName:"edit",data:`data-id="${record.id}"`})}${quote ? actionButton("Imprimir resumen","print-case",{iconName:"print",data:`data-id="${record.id}"`}):""}`)}
    ${tabs(tabItems,tab)}
    <div class="tab-panel">${body}</div>
  `;
}

function renderQuotes(state, store, ui) {
  const rows = searchFilter(state.quotes, ui.search, ["id","status","comments"])
    .map((quote)=>`<tr>
      <td><a class="strong-link" href="#/cotizaciones/${quote.id}">${esc(quote.id)}</a><small>v${quote.version}</small></td>
      <td>${esc(patientName(state,quote.patientId))}<small>${esc(quote.caseId)}</small></td>
      <td>${formatDate(quote.createdAt,true)}</td>
      <td>${money(quote.subtotal)}</td>
      <td>${money(quote.insurerAmount)}</td>
      <td>${money(quote.patientAmount)}</td>
      <td>${money(quoteBalance(quote,state.payments))}</td>
      <td>${badge(quote.status)}</td>
      <td><a class="row-action" href="#/cotizaciones/${quote.id}">Abrir ${icon("view")}</a></td>
    </tr>`);
  return `
    ${pageHeader("Cotizaciones", "Constructor por categorías, precios, descuentos, cobertura, versiones, PDF, portal y mensajería.",
      `${actionButton("Nueva cotización","open-quote-form",{kind:"primary",iconName:"plus"})}`)}
    <div class="filter-bar"><label class="search-field">${icon("search")}<input data-ui-search placeholder="Buscar cotización, paciente o estado" value="${esc(ui.search||"")}"></label><div class="filter-summary">${rows.length} cotizaciones</div></div>
    ${card("Cotizaciones y preautorizaciones",table(["Cotización","Paciente / caso","Creación","Subtotal","Seguro","Paciente","Saldo","Estado",""],rows))}
  `;
}

function renderQuoteDetail(state, store, ui, id) {
  const quote=state.quotes.find((item)=>item.id===id);
  if(!quote) return notFound("Cotización");
  return `
    ${pageHeader(`${quote.id} · versión ${quote.version}`, `${patientName(state,quote.patientId)} · ${quote.caseId}`,
      `${actionButton("Revisar / nueva versión","revise-quote",{iconName:"edit",data:`data-id="${quote.id}"`})}${actionButton("Imprimir","print-quote",{iconName:"print",data:`data-id="${quote.id}"`})}${actionButton("Enviar","send-quote",{kind:"primary",iconName:"send",data:`data-id="${quote.id}"`})}`)}
    ${renderQuoteDetailContent(state,store,ui,quote)}
  `;
}

function renderQuoteDetailContent(state, store, ui, quote) {
  const patient=state.patients.find((item)=>item.id===quote.patientId);
  const request=state.insuranceRequests.find((item)=>item.quoteId===quote.id);
  const payments=state.payments.filter((item)=>item.quoteId===quote.id);
  const grouped={};
  quote.items.forEach((item)=>{(grouped[item.category] ||= []).push(item);});
  return `
    <div class="quote-overview">
      <section class="quote-main">
        <div class="quote-status-header">
          <div>${badge(quote.status)}<h2>${esc(QUOTE_ADMIN_LABELS[quote.status]||quote.status)}</h2><p>Última actualización: ${formatDate(request?.events?.at(-1)?.date||quote.sentAt||quote.createdAt,true)}</p></div>
          <div class="progress-circle" style="--progress:${quoteProgress(quote.status)}"><span>${quoteProgress(quote.status)}%</span></div>
        </div>
        <div class="progress progress-lg"><span style="width:${quoteProgress(quote.status)}%"></span></div>
        ${Object.entries(grouped).map(([category,items])=>`
          <div class="quote-category">
            <header><h3>${esc(ITEM_CATEGORY_LABELS[category]||category)}</h3><span>${items.length} conceptos</span></header>
            ${table(["Concepto","Cantidad","Precio","Descuento","Subtotal"],items.map((item)=>`<tr><td>${esc(item.name)}</td><td>${item.quantity}</td><td>${money(item.unitPrice)}</td><td>${money(item.discountAmount||0)}</td><td>${money(item.quantity*item.unitPrice-(item.discountAmount||0))}</td></tr>`),{compact:true})}
          </div>`).join("")}
        ${request ? card("Historial con aseguradora", `<div class="vertical-timeline">${request.events.map((event)=>`<article><span></span><div><strong>${esc(QUOTE_ADMIN_LABELS[event.status]||event.status)}</strong><small>${formatDate(event.date,true)}</small><p>${esc(event.note)}</p></div></article>`).join("")}</div>`,{className:"nested-card"}) : ""}
      </section>
      <aside class="quote-summary-panel">
        <div class="summary-line"><span>Subtotal</span><strong>${money(quote.subtotal)}</strong></div>
        <div class="summary-line"><span>Descuento</span><strong>−${money(quote.discountAmount)}</strong></div>
        <div class="summary-line total"><span>Total</span><strong>${money(quote.total)}</strong></div>
        <div class="coverage-block"><div><span>Aseguradora</span><strong>${money(quote.insurerAmount)}</strong></div><div><span>Paciente</span><strong>${money(quote.patientAmount)}</strong></div></div>
        <div class="summary-line"><span>Pagado</span><strong>${money(payments.filter(p=>p.status==="APPLIED").reduce((s,p)=>s+p.amount,0))}</strong></div>
        <div class="summary-line balance"><span>Saldo</span><strong>${money(quoteBalance(quote,state.payments))}</strong></div>
        <div class="summary-actions">
          ${actionButton("Actualizar seguro","open-insurance-status",{kind:"primary",iconName:"check",data:`data-id="${quote.id}"`})}
          ${actionButton("Registrar pago","open-payment-form",{iconName:"money",data:`data-quote-id="${quote.id}"`})}
          ${actionButton("Enviar WhatsApp","send-quote-whatsapp",{iconName:"send",data:`data-id="${quote.id}"`})}
          ${actionButton("Copiar enlace portal","copy-portal-link",{kind:"ghost",iconName:"qr",data:`data-token="${quote.portalToken}"`})}
        </div>
        <div class="patient-mini"><span class="avatar">${initials(patient?.fullName)}</span><div><strong>${esc(patient?.fullName)}</strong><small>${esc(patient?.phone)} · ${esc(patient?.email)}</small></div></div>
        <p class="quote-comments">${esc(quote.comments)}</p>
      </aside>
    </div>`;
}

function renderInsurance(state, store, ui) {
  const cards=state.quotes.map((quote)=>{
    const request=state.insuranceRequests.find((item)=>item.quoteId===quote.id);
    return `<article class="kanban-card">
      <header><a href="#/cotizaciones/${quote.id}">${esc(quote.id)}</a>${badge(quote.status)}</header>
      <h3>${esc(patientName(state,quote.patientId))}</h3>
      <p>${esc(insurerName(state,state.patients.find(p=>p.id===quote.patientId)?.insurerId))}</p>
      <div class="kanban-money"><span>Total ${money(quote.total)}</span><span>Aprobado ${money(quote.insurerAmount)}</span></div>
      <small>${esc(request?.lastNote||"Sin observación")}</small>
      <button data-action="open-insurance-status" data-id="${quote.id}">Actualizar ${icon("view")}</button>
    </article>`;
  });
  const columns=[
    ["SENT_TO_INSURER","Enviadas al seguro"],
    ["INSURER_REVIEW","En revisión"],
    ["INFO_REQUIRED","Información requerida"],
    ["PARTIALLY_APPROVED","Aprobación parcial"],
    ["APPROVED","Aprobadas"],
    ["REJECTED","Rechazadas"]
  ];
  return `
    ${pageHeader("Preautorizaciones y seguros","Seguimiento de envío, recepción, solicitudes de información, aprobación, rechazo y reclamo.",
      `${actionButton("Registrar actualización","open-insurance-status",{kind:"primary",iconName:"plus"})}`)}
    <div class="kanban-board">
      ${columns.map(([status,label])=>`<section class="kanban-column"><header><h2>${label}</h2><span>${state.quotes.filter(q=>q.status===status).length}</span></header><div>${state.quotes.filter(q=>q.status===status).map(q=>cards[state.quotes.indexOf(q)]).join("")||`<p class="kanban-empty">Sin registros</p>`}</div></section>`).join("")}
    </div>`;
}

function renderReceivables(state, store, ui) {
  const rows=state.quotes.map((quote)=>{
    const paid=state.payments.filter((p)=>p.quoteId===quote.id && p.status==="APPLIED").reduce((s,p)=>s+p.amount,0);
    const balance=quoteBalance(quote,state.payments);
    return `<tr><td><a class="strong-link" href="#/cotizaciones/${quote.id}">${quote.id}</a></td><td>${esc(patientName(state,quote.patientId))}</td><td>${money(quote.patientAmount)}</td><td>${money(paid)}</td><td>${money(balance)}</td><td>${badge(balance<=.01?"PAID":"UNPAID")}</td><td>${actionButton("Registrar pago","open-payment-form",{kind:"ghost",data:`data-quote-id="${quote.id}"`,disabled:balance<=.01})}</td></tr>`;
  });
  return `
    ${pageHeader("Cuentas por cobrar","Facturas, responsabilidad del paciente, pagos, adelantos, ajustes, comprobantes y estado de cuenta.",
      `${actionButton("Registrar pago","open-payment-form",{kind:"primary",iconName:"plus"})}${actionButton("Imprimir estado global","print-receivables",{iconName:"print"})}`)}
    <div class="metrics-grid metrics-small">
      ${metric("Responsabilidad total",money(state.quotes.reduce((s,q)=>s+q.patientAmount,0)),"Suma de cuentas de pacientes","money","blue")}
      ${metric("Pagos aplicados",money(state.payments.filter(p=>p.status==="APPLIED").reduce((s,p)=>s+p.amount,0)),"Movimientos confirmados","check","teal")}
      ${metric("Saldo abierto",money(state.quotes.reduce((s,q)=>s+quoteBalance(q,state.payments),0)),"Pendiente de cobro","clock","coral")}
    </div>
    ${card("Estado de cuentas",table(["Cotización","Paciente","Responsabilidad","Pagado","Saldo","Estado",""],rows))}
    ${renderPaymentsTable(state,state.payments)}
  `;
}

function renderPaymentsTable(state,payments) {
  return card("Movimientos de pago",table(["Fecha","Comprobante","Paciente","Método","Pagado por","Referencia","Monto","Estado"],
    payments.map((payment)=>`<tr><td>${formatDate(payment.date,true)}</td><td>${esc(payment.receipt)}</td><td>${esc(patientName(state,payment.patientId))}</td><td>${esc(payment.method)}</td><td>${esc(payment.payer)}</td><td><code>${esc(payment.reference)}</code></td><td>${money(payment.amount)}</td><td>${badge(payment.status)}</td></tr>`),{compact:true}));
}

function renderClinicalHome(state, store, ui) {
  const signed=state.clinicalDocuments.filter((d)=>d.status==="SIGNED").length;
  const openCards=state.medicationCards.filter((c)=>c.status==="ACTIVE").length;
  return `
    ${pageHeader("Expediente clínico","Órdenes, reportes, evoluciones, planes, tarjeta de medicamentos, signos vitales y notas de enfermería.",
      `${actionButton("Nuevo documento clínico","open-clinical-document",{kind:"primary",iconName:"plus"})}`)}
    <div class="metrics-grid">
      ${metric("Documentos",state.clinicalDocuments.length,`${signed} firmados`,"file","blue")}
      ${metric("Tarjetas activas",openCards,"Tratamientos en curso","clinical","teal")}
      ${metric("Signos vitales",state.vitalSigns.length,"Controles registrados","clock","amber")}
      ${metric("Notas de enfermería",state.nursingNotes.length,"Trazables y compartibles","clinical","purple")}
    </div>
    <div class="module-grid">
      ${clinicalModule("Reportes de salud","Resumen clínico, antecedentes, alergias, dispositivos, signos vitales y plan.","#/clinica/reportes","HEALTH_REPORT",state)}
      ${clinicalModule("Órdenes médicas","Indicaciones, tratamientos, estudios y solicitudes de laboratorio.","#/clinica/ordenes","MEDICAL_ORDER",state)}
      ${clinicalModule("Tarjeta de medicamentos","Dosis, vía, frecuencia, horarios y administración.","#/clinica/medicamentos","MEDICATION_CARD",state)}
      ${clinicalModule("Planes de cuidado","Objetivos, intervenciones, frecuencia, responsables y evaluación.","#/clinica/planes-de-cuidado","CARE_PLAN",state)}
      ${clinicalModule("Evoluciones y notas","Evolución médica, signos vitales y notas de enfermería.","#/clinica/evoluciones","CLINICAL_EVOLUTION",state)}
    </div>`;
}

function clinicalModule(title,description,href,type,state){
  const count= type==="MEDICATION_CARD" ? state.medicationCards.length : state.clinicalDocuments.filter(d=>d.type===type).length;
  return `<a class="module-card" href="${href}"><span>${icon("clinical")}</span><div><h2>${esc(title)}</h2><p>${esc(description)}</p><strong>${count} registros</strong></div>${icon("view")}</a>`;
}

function renderClinicalDocuments(state, store, ui, type) {
  const title=DOC_TYPE_LABELS[type] || "Documentos clínicos";
  if(type==="MEDICATION_CARD") return renderMedicationCards(state,store,ui);
  const docs=state.clinicalDocuments.filter((d)=>d.type===type);
  return `
    ${pageHeader(title, clinicalDescription(type),
      `${actionButton(`Nuevo ${title.toLowerCase()}`,"open-clinical-document",{kind:"primary",iconName:"plus",data:`data-doc-type="${type}"`})}`)}
    ${card(title,table(["Documento","Caso / paciente","Autor","Creación","Firma","Versión","Estado",""],
      docs.map((doc)=>`<tr><td><strong>${esc(doc.title)}</strong><small>${esc(doc.summary)}</small></td><td><a href="#/hospitalizaciones/${doc.caseId}">${esc(doc.caseId)}</a><small>${esc(patientName(state,doc.patientId))}</small></td><td>${esc(doc.authorName)}</td><td>${formatDate(doc.createdAt,true)}</td><td>${doc.signedAt?formatDate(doc.signedAt,true):"—"}</td><td>v${doc.version}</td><td>${badge(doc.status)}</td><td><div class="row-actions"><button data-action="view-document" data-id="${doc.id}" title="Ver">${icon("view")}</button>${doc.status==="DRAFT"?`<button data-action="sign-document" data-id="${doc.id}" title="Firmar">${icon("check")}</button>`:""}</div></td></tr>`)))}
  `;
}

function clinicalDescription(type){
  const map={
    HEALTH_REPORT:"Documento configurable con diagnóstico, antecedentes, alergias, dispositivos, signos vitales, evolución y plan.",
    MEDICAL_ORDER:"Órdenes, medicamentos, estudios, indicaciones, duración y profesional responsable.",
    CARE_PLAN:"Problemas, objetivos, intervenciones, frecuencia, responsables y evaluación.",
    CLINICAL_EVOLUTION:"Evoluciones clínicas, antecedentes seleccionables y seguimiento longitudinal.",
    LAB_REQUEST:"Solicitudes de laboratorio y estudios relacionados con el caso."
  };
  return map[type]||"Documentación clínica versionada, firmable y auditable.";
}

function renderMedicationCards(state, store, ui){
  return `
    ${pageHeader("Tarjeta de medicamentos","Tratamientos activos con medicamento, dosis, vía, frecuencia, horarios y registro de administración.",
      `${actionButton("Nueva tarjeta","open-medication-card",{kind:"primary",iconName:"plus"})}`)}
    <div class="medication-grid">
      ${state.medicationCards.map((cardData)=>`
        <article class="card medication-card">
          <header class="card-header"><div><h2>${esc(patientName(state,cardData.patientId))}</h2><p>${esc(cardData.caseId)} · ${formatDate(cardData.createdAt)}</p></div>${badge(cardData.status)}</header>
          <div class="card-body">
            ${table(["Medicamento","Dosis / vía","Frecuencia","Horario","Última administración","Estado"],
              cardData.items.map((item)=>`<tr><td><strong>${esc(item.medication)}</strong><small>${formatDate(item.startDate)} → ${formatDate(item.endDate)}</small></td><td>${esc(item.dose)} · ${esc(item.route)}</td><td>${esc(item.frequency)}</td><td>${item.schedule.map((t)=>`<span class="time-chip">${esc(t)}</span>`).join("")}</td><td>${item.lastAdministration?formatDate(item.lastAdministration,true):"—"}</td><td>${badge(item.administrationStatus)}</td></tr>`),{compact:true})}
          </div>
          <footer class="card-footer">${actionButton("Imprimir tarjeta","print-medication-card",{iconName:"print",data:`data-id="${cardData.id}"`})}${actionButton("Registrar administración","administer-medication",{kind:"primary",data:`data-id="${cardData.id}"`})}</footer>
        </article>`).join("")}
    </div>`;
}

function renderEvolutions(state, store, ui) {
  const evolutions=state.clinicalDocuments.filter((d)=>d.type==="CLINICAL_EVOLUTION");
  return `
    ${pageHeader("Evoluciones, signos vitales y notas","Seguimiento longitudinal con bloqueo legal posterior a firma y correcciones auditadas.",
      `${actionButton("Nueva evolución","open-clinical-document",{kind:"primary",iconName:"plus",data:`data-doc-type="CLINICAL_EVOLUTION"`})}${actionButton("Signos vitales","open-vitals-form",{iconName:"plus"})}${actionButton("Nota de enfermería","open-nursing-note",{iconName:"plus"})}`)}
    <div class="dashboard-grid">
      ${card("Evoluciones clínicas", evolutions.length?evolutions.map((doc)=>`<article class="note-card"><header><div><strong>${esc(patientName(state,doc.patientId))}</strong><small>${formatDate(doc.createdAt,true)} · ${esc(doc.authorName)}</small></div>${badge(doc.status)}</header><h3>${esc(doc.title)}</h3><p>${esc(doc.summary)}</p><footer><button class="row-action" data-action="view-document" data-id="${doc.id}">Abrir / imprimir</button></footer></article>`).join(""):emptyState("Sin evoluciones","Crea la primera evolución clínica."),{className:"span-2"})}
      ${card("Últimos controles", state.vitalSigns.map((v)=>`<article class="vitals-card"><strong>${esc(patientName(state,v.patientId))}</strong><small>${formatDate(v.recordedAt,true)}</small><div><span>TA ${v.systolic}/${v.diastolic}</span><span>FC ${v.heartRate}</span><span>FR ${v.respiratoryRate}</span><span>SpO₂ ${v.spo2}%</span><span>T° ${v.temperature}</span><span>Dolor ${v.pain}/10</span></div></article>`).join(""))}
    </div>
    ${card("Notas de enfermería",state.nursingNotes.map((note)=>`<article class="note-card"><header><div><strong>${esc(note.authorName)}</strong><small>${esc(patientName(state,note.patientId))} · ${formatDate(note.createdAt,true)}</small></div>${badge(note.status)}</header><p>${esc(note.text)}</p><footer>${badge(note.shareStatus,note.shareStatus==="SHARED_WITH_DOCTOR"?"Compartida con médico":"Pendiente de compartir")}${note.status==="SIGNED"&&note.shareStatus!=="SHARED_WITH_DOCTOR"?actionButton("Compartir con médico","share-note",{kind:"ghost",iconName:"send",data:`data-id="${note.id}"`}):""}</footer></article>`).join(""))}
  `;
}

function renderAgenda(state, store, ui) {
  const shifts=[...state.shifts].sort((a,b)=>new Date(a.start)-new Date(b.start));
  return `
    ${pageHeader("Agenda y turnos","Calendario de recursos, pacientes, tipo de servicio, fecha, hora y confirmación.",
      `${actionButton("Nuevo turno","open-shift-form",{kind:"primary",iconName:"plus"})}`)}
    <div class="agenda-layout">
      <aside class="calendar-sidebar card">
        <div class="mini-calendar"><header><button>‹</button><strong>Agosto 2026</strong><button>›</button></header><div class="weekday-row">${["L","M","M","J","V","S","D"].map(d=>`<span>${d}</span>`).join("")}</div><div class="day-grid">${Array.from({length:35},(_,i)=>`<span class="${i===25?"today":""}">${i<3?"":i-2}</span>`).join("")}</div></div>
        <div class="resource-legend">${state.users.filter(u=>["NURSE","DOCTOR"].includes(u.role)).map(u=>`<label><span class="legend-dot"></span>${esc(u.name)}</label>`).join("")}</div>
      </aside>
      <section>${renderShiftList(state,shifts)}</section>
    </div>`;
}

function renderShiftList(state, shifts){
  return card("Turnos programados",`<div class="shift-list">${shifts.map((shift)=>`<article class="shift-card"><time><strong>${new Date(shift.start).toLocaleTimeString("es-SV",{hour:"2-digit",minute:"2-digit"})}</strong><small>${formatDate(shift.start)}</small></time><div><h3>${esc(shift.resourceName)}</h3><p>${esc(patientName(state,shift.patientId))} · ${esc(shift.type.replaceAll("_"," "))}</p><small>${esc(shift.caseId)} · hasta ${new Date(shift.end).toLocaleTimeString("es-SV",{hour:"2-digit",minute:"2-digit"})}</small></div>${badge(shift.status)}</article>`).join("")}</div>`);
}

function renderPayables(state, store, ui) {
  const rows=state.doctorServices.map((service)=>{
    const doctor=state.doctors.find((d)=>d.id===service.doctorId);
    return `<tr><td>${formatDate(service.date)}</td><td>${esc(doctor?.name)}</td><td>${esc(patientName(state,service.patientId))}<small>${esc(service.caseId)}</small></td><td>${esc(service.service)}</td><td>${service.quantity}</td><td>${money(service.rate)}</td><td>${money(service.quantity*service.rate)}</td><td>${badge(service.status)}</td></tr>`;
  });
  const gross=state.doctorServices.reduce((s,i)=>s+i.quantity*i.rate,0);
  const paid=state.doctorStatements.reduce((s,i)=>s+i.paid,0);
  return `
    ${pageHeader("Cuentas por pagar","Servicios de médicos, enfermería y proveedores; cortes, ajustes, retenciones y pagos.",
      `${actionButton("Generar corte","generate-statements",{kind:"primary",iconName:"check"})}${linkButton("Estados de cuenta","#/estados-de-cuenta",{iconName:"view"})}`)}
    <div class="metrics-grid metrics-small">
      ${metric("Servicios aprobados",state.doctorServices.filter(s=>s.status==="APPROVED").length,"Listos para liquidar","check","teal")}
      ${metric("Monto bruto",money(gross),"Servicios registrados","money","blue")}
      ${metric("Pagado",money(paid),"Cortes aplicados","money","amber")}
    </div>
    ${card("Servicios realizados",table(["Fecha","Recurso","Paciente / caso","Servicio","Cantidad","Tarifa","Total","Estado"],rows))}
  `;
}

function renderPurchases(state, store, ui) {
  const rows=state.purchases.map((purchase)=>{
    const supplier=state.suppliers.find((s)=>s.id===purchase.supplierId);
    return `<tr><td><a class="strong-link" href="#/compras">${esc(purchase.id)}</a><small>${esc(purchase.invoiceNumber||"Sin factura")}</small></td><td>${esc(supplier?.name)}</td><td>${formatDate(purchase.date)}</td><td>${purchase.items.length}</td><td>${money(purchase.subtotal)}</td><td>${money(purchase.tax)}</td><td>${money(purchase.discount)}</td><td>${money(purchase.total)}</td><td>${badge(purchase.status)}</td><td>${actionButton("Ver / imprimir","view-purchase",{kind:"ghost",data:`data-id="${purchase.id}"`})}</td></tr>`;
  });
  return `
    ${pageHeader("Compras","Solicitudes, autorización, factura, proveedor, historial de precios, impuestos, descuentos y entrada a inventario.",
      `${actionButton("Nueva compra","open-purchase-form",{kind:"primary",iconName:"plus"})}`)}
    <div class="metrics-grid metrics-small">
      ${metric("Compras del período",state.purchases.length,"Órdenes y facturas","purchases","blue")}
      ${metric("Total comprado",money(state.purchases.reduce((s,p)=>s+p.total,0)),"Datos ficticios","money","teal")}
      ${metric("Pendientes",state.purchases.filter(p=>p.status==="PENDING_APPROVAL").length,"Requieren autorización","clock","amber")}
    </div>
    ${card("Órdenes y compras",table(["Compra / factura","Proveedor","Fecha","Ítems","Subtotal","IVA","Descuento","Total","Estado",""],rows))}
  `;
}

function renderInventory(state, store, ui) {
  const items=searchFilter(state.inventoryItems,ui.search,["name","sku","category"]).map((item)=>{
    const lots=state.inventoryLots.filter(l=>l.inventoryItemId===item.id);
    return `<tr><td><strong>${esc(item.name)}</strong><small>${esc(item.sku)} · ${esc(ITEM_CATEGORY_LABELS[item.category]||item.category)}</small></td><td>${esc(warehouseName(state,item.warehouseId))}</td><td>${item.stock} ${esc(item.unit)}</td><td>${item.committed}</td><td><strong>${inventoryFree(item)}</strong></td><td>${item.minimum}</td><td>${lots.length}</td><td>${badge(inventoryState(item))}</td><td>${actionButton("Movimiento","open-inventory-movement",{kind:"ghost",data:`data-item-id="${item.id}"`})}</td></tr>`;
  });
  return `
    ${pageHeader("Inventario","Existencias, comprometidos, lotes, series, bodegas, movimientos, pacientes, acuses, cierres y kits.",
      `${actionButton("Nuevo movimiento","open-inventory-movement",{kind:"primary",iconName:"plus"})}${linkButton("Cierres","#/inventario/cierres",{iconName:"view"})}`)}
    <div class="metrics-grid">
      ${metric("Ítems",state.inventoryItems.length,`${state.inventoryLots.length} lotes registrados`,"inventory","blue")}
      ${metric("Unidades comprometidas",state.inventoryItems.reduce((s,i)=>s+i.committed,0),"Inventario temporal de pacientes","clock","amber")}
      ${metric("Alertas",state.inventoryItems.filter(i=>inventoryState(i)!=="OK").length,"Mínimo o sin disponibilidad","alert","coral")}
      ${metric("Bodegas",state.warehouses.length,"Principal, emergencia y domiciliar","inventory","teal")}
    </div>
    <div class="filter-bar"><label class="search-field">${icon("search")}<input data-ui-search placeholder="Buscar SKU, medicamento, insumo o equipo" value="${esc(ui.search||"")}"></label><div class="filter-summary">${items.length} ítems</div></div>
    ${card("Existencias por bodega",table(["Ítem","Bodega","Existencia","Comprometido","Libre","Mínimo","Lotes","Estado",""],items))}
  `;
}

function renderInventoryMovements(state, store, ui) {
  return `
    ${pageHeader("Movimientos de inventario","Entradas, salidas, compromiso, consumo, devolución, traslado, ajustes y bajas.",
      `${actionButton("Registrar movimiento","open-inventory-movement",{kind:"primary",iconName:"plus"})}`)}
    ${card("Historial de movimientos",table(["Fecha","ID","Ítem","Tipo","Cantidad","Caso","Origen","Destino","Responsable","Referencia"],
      state.inventoryMovements.map((move)=>{
        const item=state.inventoryItems.find(i=>i.id===move.inventoryItemId);
        return `<tr><td>${formatDate(move.date,true)}</td><td>${esc(move.id)}</td><td>${esc(item?.name)}</td><td>${esc(MOVE_LABELS[move.type]||move.type)}</td><td>${move.quantity} ${esc(item?.unit)}</td><td>${move.caseId?`<a href="#/hospitalizaciones/${move.caseId}">${esc(move.caseId)}</a>`:"—"}</td><td>${esc(warehouseName(state,move.warehouseFrom))}</td><td>${esc(warehouseName(state,move.warehouseTo))}</td><td>${esc(move.authorName)}</td><td>${esc(move.reference||"—")}</td></tr>`;
      }),{compact:true}))}
  `;
}

function renderCommittedInventory(state, store, ui) {
  return `
    ${pageHeader("Comprometidos y acuses","Inventario entregado al domicilio que permanece temporalmente asociado al paciente hasta consumo, devolución o cierre.",
      `${actionButton("Crear acuse","open-inventory-movement",{kind:"primary",iconName:"plus",data:`data-type="PATIENT_COMMITMENT"`})}`)}
    ${card("Inventario por paciente",table(["Caso / paciente","Ítem","Comprometido","Entregado","Consumido","Devuelto","Pendiente","Estado"],
      state.inventoryReservations.map((res)=>{
        const item=state.inventoryItems.find(i=>i.id===res.inventoryItemId);
        return `<tr><td><a href="#/hospitalizaciones/${res.caseId}">${esc(caseLabel(state,res.caseId))}</a></td><td>${esc(item?.name)}</td><td>${res.quantity}</td><td>${res.delivered}</td><td>${res.consumed}</td><td>${res.returned}</td><td>${Math.max(0,res.delivered-res.consumed-res.returned)}</td><td>${badge(res.status)}</td></tr>`;
      })))}
  `;
}

function renderInventoryClosures(state, store, ui) {
  return `
    ${pageHeader("Cierres de inventario","Cierre parcial editable para conciliación y cierre total sujeto a revisión y aprobación antes de bloquear la cuenta.",
      `${actionButton("Nuevo cierre","open-closure-form",{kind:"primary",iconName:"plus"})}`)}
    ${card("Cierres por hospitalización",table(["Cierre","Caso / paciente","Tipo","Creación","Responsable","Nota","Estado",""],
      state.inventoryClosures.map((closure)=>`<tr><td>${esc(closure.id)}</td><td><a href="#/hospitalizaciones/${closure.caseId}">${esc(caseLabel(state,closure.caseId))}</a></td><td>${badge(closure.type)}</td><td>${formatDate(closure.createdAt,true)}</td><td>${esc(closure.createdBy)}</td><td class="cell-wrap">${esc(closure.note)}</td><td>${badge(closure.status)}</td><td><div class="row-actions">${actionButton("Imprimir","print-closure",{kind:"ghost",iconName:"print",data:`data-id="${closure.id}"`})}${closure.status==="PENDING_REVIEW"?actionButton("Aprobar","approve-closure",{kind:"primary",data:`data-id="${closure.id}"`}):""}</div></td></tr>`)))}
  `;
}

function renderWarehouses(state,store,ui){
  return `
    ${pageHeader("Bodegas y transferencias","Ubicaciones físicas, inventario de emergencia, domiciliar y traslados con trazabilidad.",
      `${actionButton("Nueva transferencia","open-inventory-movement",{kind:"primary",iconName:"plus",data:`data-type="TRANSFER"`})}`)}
    <div class="warehouse-grid">${state.warehouses.map((wh)=>{
      const items=state.inventoryItems.filter(i=>i.warehouseId===wh.id);
      return `<article class="warehouse-card"><header>${icon("inventory")}<div><h2>${esc(wh.name)}</h2><p>${esc(wh.location)}</p></div>${badge(wh.status)}</header><div class="financial-summary"><div><span>Ítems</span><strong>${items.length}</strong></div><div><span>Existencia</span><strong>${items.reduce((s,i)=>s+i.stock,0)}</strong></div><div><span>Libre</span><strong>${items.reduce((s,i)=>s+inventoryFree(i),0)}</strong></div></div></article>`;
    }).join("")}</div>`;
}

function renderKits(state,store,ui){
  return `
    ${pageHeader("Kits de insumos","Agrupaciones reutilizables para comprometer y descargar automáticamente todos sus componentes.",
      `${actionButton("Nuevo kit","open-kit-form",{kind:"primary",iconName:"plus"})}`)}
    <div class="kit-grid">${state.kits.map((kit)=>`<article class="card kit-card"><header class="card-header"><div><h2>${esc(kit.name)}</h2><p>${esc(kit.code)}</p></div>${badge(kit.active?"ACTIVE":"INACTIVE")}</header><div class="card-body"><ul>${kit.items.map(i=>`<li><span>${esc(i.name)}</span><strong>${i.quantity}</strong></li>`).join("")}</ul></div><footer class="card-footer">${actionButton("Duplicar","duplicate-kit",{iconName:"edit",data:`data-id="${kit.id}"`})}${actionButton("Descargar a paciente","apply-kit",{kind:"primary",iconName:"send",data:`data-id="${kit.id}"`})}</footer></article>`).join("")}</div>`;
}

function renderCatalogs(state,store,ui,category=null){
  const items=category ? state.catalogItems.filter(i=>i.category===category) : state.catalogItems;
  const title=category ? ITEM_CATEGORY_LABELS[category] || category : "Catálogos y tarifas";
  const rows=searchFilter(items,ui.search,["sku","name","category"]).map((item)=>`<tr><td><code>${esc(item.sku)}</code></td><td><strong>${esc(item.name)}</strong><small>${esc(ITEM_CATEGORY_LABELS[item.category]||item.category)}</small></td><td>${esc(item.unit)}</td><td>${money(item.cost)}</td><td>${money(item.price)}</td><td>${item.taxable?"Sí":"No"}</td><td>${item.requiresLot?"Sí":"No"}</td><td>${badge(item.active?"ACTIVE":"INACTIVE")}</td><td>${actionButton("Editar","edit-catalog-item",{kind:"ghost",iconName:"edit",data:`data-id="${item.id}"`})}</td></tr>`);
  return `
    ${pageHeader(title,"Servicios, estudios, medicamentos, insumos, equipos, honorarios, extras, costos, precios y vigencias.",
      `${actionButton("Importar CSV","import-catalog",{iconName:"upload"})}${actionButton("Nuevo ítem","open-catalog-form",{kind:"primary",iconName:"plus",data:category?`data-category="${category}"`:""})}`)}
    ${!category?`<div class="catalog-shortcuts">${Object.entries(ITEM_CATEGORY_LABELS).map(([key,label])=>`<a href="#/catalogos/${key.toLowerCase()}"><span>${icon("catalogs")}</span><strong>${esc(label)}</strong><small>${state.catalogItems.filter(i=>i.category===key).length} ítems</small></a>`).join("")}<a href="#/catalogos/descuentos"><span>${icon("money")}</span><strong>Descuentos</strong><small>${state.discountRules.length} perfiles</small></a></div>`:""}
    <div class="filter-bar"><label class="search-field">${icon("search")}<input data-ui-search placeholder="Buscar código o descripción" value="${esc(ui.search||"")}"></label><div class="filter-summary">${rows.length} ítems</div></div>
    ${card("Maestro de ítems",table(["SKU","Descripción","Unidad","Costo","Precio","IVA","Lote/serie","Estado",""],rows))}
  `;
}

function renderDiscounts(state,store,ui){
  const categories=Object.keys(ITEM_CATEGORY_LABELS);
  return `
    ${pageHeader("Descuentos y convenios","Perfiles por cliente, empresa o aseguradora con porcentaje permitido por categoría, autorización y motivo.",
      `${actionButton("Nuevo perfil","open-discount-form",{kind:"primary",iconName:"plus"})}`)}
    ${card("Reglas de descuento",table(["Perfil","Tipo",...categories.map(c=>ITEM_CATEGORY_LABELS[c]),"Aprobación","Estado"],
      state.discountRules.map((rule)=>`<tr><td><strong>${esc(rule.name)}</strong><small>${esc(rule.id)}</small></td><td>${esc(rule.type)}</td>${categories.map(c=>`<td>${rule.categories[c]??0}%</td>`).join("")}<td>${rule.requiresApproval?"Sí":"No"}</td><td>${badge(rule.active?"ACTIVE":"INACTIVE")}</td></tr>`)))}
    <div class="warning-callout"><strong>Regla legal y financiera:</strong> los descuentos requieren motivo, permisos y auditoría. Medicamentos u otras categorías pueden configurarse en 0%.</div>`;
}

function renderDoctors(state,store,ui){
  return `
    ${pageHeader("Médicos y recursos","Profesionales, especialidad, contacto, tipo de tarifa, servicios realizados y seguimiento.",
      `${actionButton("Nuevo profesional","open-doctor-form",{kind:"primary",iconName:"plus"})}${linkButton("Estados de cuenta","#/estados-de-cuenta",{iconName:"view"})}`)}
    <div class="doctor-grid">${state.doctors.map((doctor)=>{
      const services=state.doctorServices.filter(s=>s.doctorId===doctor.id);
      return `<article class="doctor-card"><header><span class="avatar avatar-lg">${initials(doctor.name)}</span><div><h2>${esc(doctor.name)}</h2><p>${esc(doctor.specialty)}</p></div>${badge(doctor.status)}</header><dl class="detail-list"><div><dt>Teléfono</dt><dd>${esc(doctor.phone)}</dd></div><div><dt>Correo</dt><dd>${esc(doctor.email)}</dd></div><div><dt>Tarifa</dt><dd>${esc(doctor.rateType)}</dd></div><div><dt>Servicios</dt><dd>${services.length}</dd></div></dl></article>`;
    }).join("")}</div>`;
}

function renderDoctorStatements(state,store,ui){
  return `
    ${pageHeader("Estados de cuenta médicos","Cortes por período con servicios, bruto, ajustes, retenciones, pagado, pendiente, PDF y envío automático.",
      `${actionButton("Generar corte","generate-statements",{kind:"primary",iconName:"check"})}`)}
    ${card("Cortes de honorarios",table(["Estado de cuenta","Médico","Período","Bruto","Ajustes","Retenciones","Neto","Pagado","Pendiente","Estado",""],
      state.doctorStatements.map((stm)=>{
        const doctor=state.doctors.find(d=>d.id===stm.doctorId);
        const net=stm.gross+stm.adjustments-stm.withholdings;
        return `<tr><td><strong>${esc(stm.id)}</strong><small>${stm.items.length} servicios</small></td><td>${esc(doctor?.name)}</td><td>${formatDate(stm.periodStart)} → ${formatDate(stm.periodEnd)}</td><td>${money(stm.gross)}</td><td>${money(stm.adjustments)}</td><td>${money(stm.withholdings)}</td><td>${money(net)}</td><td>${money(stm.paid)}</td><td>${money(statementBalance(stm))}</td><td>${badge(stm.status)}</td><td><div class="row-actions">${actionButton("Imprimir","print-statement",{kind:"ghost",iconName:"print",data:`data-id="${stm.id}"`})}${actionButton("Enviar","send-statement",{kind:"primary",iconName:"send",data:`data-id="${stm.id}"`})}</div></td></tr>`;
      })))}
  `;
}

function renderReports(state,store,ui){
  const monthlyQuotes=[5,8,6,10,12,14,9,16];
  const max=Math.max(...monthlyQuotes);
  const categoryTotals={};
  state.quotes.flatMap(q=>q.items).forEach(i=>categoryTotals[i.category]=(categoryTotals[i.category]||0)+i.quantity*i.unitPrice);
  return `
    ${pageHeader("Reportes","Indicadores operativos, financieros, clínicos, de seguros e inventario con datos sintéticos.",
      `${actionButton("Exportar reporte","export-report",{kind:"primary",iconName:"export"})}`)}
    <div class="dashboard-grid">
      ${card("Cotizaciones por mes",`<div class="bar-chart">${monthlyQuotes.map((v,i)=>`<div><span style="height:${v/max*100}%"></span><small>${["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago"][i]}</small><strong>${v}</strong></div>`).join("")}</div>`,{className:"span-2"})}
      ${card("Distribución por categoría",`<div class="donut-wrap"><div class="donut-chart"></div><div class="chart-legend">${Object.entries(categoryTotals).map(([k,v])=>`<div><span></span><label>${esc(ITEM_CATEGORY_LABELS[k]||k)}</label><strong>${money(v)}</strong></div>`).join("")}</div></div>`)}
    </div>
    <div class="metrics-grid">
      ${metric("Tasa de aprobación","67%","Total y parcial","check","teal")}
      ${metric("Tiempo medio seguro","2.4 días","Desde envío hasta decisión","clock","blue")}
      ${metric("Cobranza paciente","73%","Sobre responsabilidad emitida","money","amber")}
      ${metric("Rotación inventario","3.1x","Indicador demo","inventory","purple")}
    </div>
    ${card("Indicadores por módulo",table(["Módulo","Indicador","Valor","Lectura"],
      [
        ["Pacientes","Casos activos",state.cases.filter(c=>c.status==="ACTIVE").length,"Carga operativa vigente"],
        ["Seguros","Solicitudes pendientes",state.insuranceRequests.filter(r=>!["APPROVED","REJECTED"].includes(r.status)).length,"Requieren seguimiento"],
        ["Finanzas","Saldo por cobrar",money(state.quotes.reduce((s,q)=>s+quoteBalance(q,state.payments),0)),"Responsabilidad del paciente"],
        ["Clínica","Documentos firmados",state.clinicalDocuments.filter(d=>d.status==="SIGNED").length,"Bloqueados para edición ordinaria"],
        ["Inventario","Ítems bajo mínimo",state.inventoryItems.filter(i=>inventoryState(i)!=="OK").length,"Requieren reposición o revisión"],
        ["Compras","Total del período",money(state.purchases.reduce((s,p)=>s+p.total,0)),"Datos sintéticos"]
      ].map(r=>`<tr>${r.map((c,i)=>`<td class="${i===0?"strong-cell":""}">${esc(c)}</td>`).join("")}</tr>`),{compact:true}))}
  `;
}

function renderSettings(state,store,ui){
  return `
    ${pageHeader("Configuración","Usuarios, roles, aseguradoras, plantillas, mensajería, seguridad y modo de datos.",
      `${actionButton("Guardar configuración","save-settings",{kind:"primary",iconName:"check"})}`)}
    <div class="settings-grid">
      ${card("Entorno",`<form id="settings-form" class="form-grid">
        <label>Modo de datos<select name="dataMode"><option value="mock" ${store.config.dataMode==="mock"?"selected":""}>Demo local</option><option value="supabase" ${store.config.dataMode==="supabase"?"selected":""}>Supabase</option></select></label>
        <label>Modo de mensajería<select name="notificationsMode"><option value="mock" ${store.config.notificationsMode==="mock"?"selected":""}>Simulado</option><option value="live" ${store.config.notificationsMode==="live"?"selected":""}>Proveedores reales</option></select></label>
        <label class="full">URL de Supabase<input name="supabaseUrl" value="${esc(store.config.supabaseUrl||"")}" placeholder="https://xxxx.supabase.co"></label>
        <label class="full">Publishable key<input name="supabasePublishableKey" value="${esc(store.config.supabasePublishableKey||"")}" placeholder="sb_publishable_..."></label>
      </form><div class="info-callout">Las claves de servicio nunca se guardan en el navegador. Los proveedores reales se configuran como variables de entorno en Vercel.</div>`)}
      ${card("Usuarios y roles",table(["Usuario","Correo","Rol","Estado"],state.users.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${badge(u.role,u.role)}</td><td>${badge(u.status)}</td></tr>`),{compact:true}))}
      ${card("Plantillas de documentos",table(["Plantilla","Tipo","Versión","Estado"],state.templates.map(t=>`<tr><td>${esc(t.name)}</td><td>${esc(t.type)}</td><td>v${t.version}</td><td>${badge(t.status)}</td></tr>`),{compact:true}))}
      ${card("Aseguradoras",table(["Aseguradora","Contacto","Teléfono","Correo","Estado"],state.insurers.map(i=>`<tr><td>${esc(i.name)}</td><td>${esc(i.contactName)}</td><td>${esc(i.phone)}</td><td>${esc(i.email)}</td><td>${badge(i.status)}</td></tr>`),{compact:true}))}
    </div>`;
}

function renderAudit(state,store,ui){
  const rows=searchFilter(state.auditLogs,ui.search,["user","role","action","entity","summary"]).map(log=>`<tr><td>${formatDate(log.date,true)}</td><td>${esc(log.user)}<small>${esc(log.role)}</small></td><td><code>${esc(log.action)}</code></td><td>${esc(log.entity)}</td><td class="cell-wrap">${esc(log.summary)}</td><td>${esc(log.ip)}</td></tr>`);
  return `
    ${pageHeader("Auditoría","Registro inmutable de accesos y cambios sensibles: precios, estados, pagos, clínica, inventario y mensajería.",
      `${actionButton("Exportar auditoría","export-audit",{kind:"primary",iconName:"export"})}`)}
    <div class="filter-bar"><label class="search-field">${icon("search")}<input data-ui-search placeholder="Buscar usuario, acción o entidad" value="${esc(ui.search||"")}"></label><div class="filter-summary">${rows.length} eventos</div></div>
    ${card("Bitácora de actividad",table(["Fecha","Usuario / rol","Acción","Entidad","Detalle","IP"],rows))}
  `;
}

function renderQaCoverage(state,store,ui){
  const total=state.qaCoverage.reduce((s,c)=>s+c.features,0);
  const implemented=state.qaCoverage.reduce((s,c)=>s+c.implemented,0);
  const partial=state.qaCoverage.reduce((s,c)=>s+c.partial,0);
  const missing=state.qaCoverage.reduce((s,c)=>s+c.missing,0);
  return `
    ${pageHeader("QA de cobertura del video","Matriz capítulo por capítulo para impedir que una función observada quede fuera del producto.",
      `${actionButton("Ejecutar QA interno","run-qa",{kind:"primary",iconName:"check"})}${linkButton("Abrir documentación","#/configuracion",{iconName:"file"})}`)}
    <div class="metrics-grid">
      ${metric("Requisitos inventariados",total,"17 capítulos auditados","qa","blue")}
      ${metric("Implementados",implemented,`${Math.round(implemented/total*100)}% de cobertura`,"check","teal")}
      ${metric("Parciales",partial,"Requieren validación o integración","clock","amber")}
      ${metric("Faltantes",missing,"Deben ser cero antes de cierre","alert",missing?"coral":"teal")}
    </div>
    ${card("Cobertura por capítulo",table(["Capítulo","Área funcional","Funciones","Implementadas","Parciales","Faltantes","Cobertura","Estado"],
      state.qaCoverage.map(ch=>{
        const pct=Math.round((ch.implemented+ch.partial*.5)/ch.features*100);
        return `<tr><td><strong>${esc(ch.chapter)}</strong></td><td class="cell-wrap">${esc(ch.title)}</td><td>${ch.features}</td><td>${ch.implemented}</td><td>${ch.partial}</td><td>${ch.missing}</td><td><div class="coverage-cell"><div class="progress"><span style="width:${pct}%"></span></div><strong>${pct}%</strong></div></td><td>${badge(ch.status,ch.status==="PASS"?"Cubierto":ch.status)}</td></tr>`;
      })))}
    <div class="qa-notes">
      <section><h2>Controles automáticos incluidos</h2><ul><li>Estructura de proyecto y archivos requeridos.</li><li>Pruebas de cálculos de cotización, pagos, inventario y estados.</li><li>Verificación de datos sintéticos y ausencia de secretos.</li><li>Comprobación de rutas, IDs de acción y SQL de Supabase.</li><li>Pruebas visuales del flujo principal mediante navegador.</li></ul></section>
      <section><h2>Bloqueos reales del cliente</h2><ul><li>Plantillas oficiales que aparecen al imprimir.</li><li>Catálogos y precios reales.</li><li>Reglas definitivas de seguro y descuentos.</li><li>Fórmula de honorarios y retenciones.</li><li>Credenciales de WhatsApp, SMS y correo.</li></ul></section>
    </div>`;
}

function renderPortal(state,store,ui,token){
  const snapshot=ui.portalSnapshot?.token===token?ui.portalSnapshot.data:null;
  if(!snapshot) return `
    <div class="portal-shell">
      <header class="portal-header"><a href="#/"><span class="brand-mark">AC</span><div><strong>Analiza en Casa</strong><small>Portal seguro del paciente</small></div></a><span>${icon("lock")} Verificación requerida</span></header>
      <main class="portal-main">
        <section class="portal-card span-2"><header><h1>Verifica el acceso</h1><p>Para proteger tu información, usa el código de un solo uso enviado al canal previamente registrado.</p></header>
          <button class="btn btn-secondary" data-action="request-portal-code">Enviar código de verificación</button>
          <p class="privacy-note" aria-live="polite">${esc(ui.portalMessage||"No mostramos datos de la solicitud hasta completar la verificación.")}</p>
          <form id="portal-verification-form" class="form-grid" novalidate>
            <input type="hidden" name="token" value="${esc(token)}">
            <label class="full">Código de verificación<input name="verificationCode" inputmode="numeric" autocomplete="one-time-code" maxlength="128" required></label>
            <div class="form-actions full"><button class="btn btn-primary" type="submit">Continuar de forma segura</button></div>
          </form>
        </section>
      </main>
      <footer class="portal-footer">Este portal no muestra diagnósticos ni información clínica.</footer>
    </div>`;
  const events=Array.isArray(snapshot.events)?snapshot.events:[];
  return `
    <div class="portal-shell">
      <header class="portal-header"><a href="#/"><span class="brand-mark">AC</span><div><strong>Analiza en Casa</strong><small>Portal seguro del paciente</small></div></a><span>${icon("lock")} Acceso verificado</span></header>
      <main class="portal-main">
        <div class="portal-welcome"><div><p class="eyebrow">Solicitud ${esc(snapshot.quote_id)}</p><h1>Estado de la cotización</h1><p>Consulta el avance y los pasos administrativos pendientes.</p></div><div class="portal-status">${badge(snapshot.status)}<strong>${quoteProgress(snapshot.status)}%</strong></div></div>
        <section class="portal-status-card">
          <div><span class="pulse-dot"></span><p>Estado actual</p><h2>${esc(QUOTE_ADMIN_LABELS[snapshot.status]||snapshot.status)}</h2><small>Actualizado ${formatDate(events.at(-1)?.date||snapshot.updated_at,true)}</small></div>
          <aside><h3>¿Qué sigue?</h3><p>${esc(portalNextAction(snapshot.status))}</p></aside>
        </section>
        <div class="portal-grid">
          <section class="portal-card span-2"><header><h2>Historial de la solicitud</h2><p>Cada cambio queda registrado.</p></header><div class="portal-timeline">${events.map((event,index)=>`<article class="${index===events.length-1?"current":""}"><span>${index<events.length-1?"✓":index+1}</span><div><strong>${esc(QUOTE_ADMIN_LABELS[event.status]||event.status)}</strong><small>${formatDate(event.date,true)}</small></div></article>`).join("")}</div></section>
          <section class="portal-card financial"><header><h2>Resumen de pago</h2></header><div><span>Total cotizado</span><strong>${money(snapshot.total)}</strong></div><div><span>Cubre el seguro</span><strong>${money(snapshot.insurer_amount)}</strong></div><div><span>Responsabilidad del paciente</span><strong>${money(snapshot.patient_amount)}</strong></div><div><span>Pagado</span><strong>${money(snapshot.paid)}</strong></div><div class="balance"><span>Saldo pendiente</span><strong>${money(snapshot.balance)}</strong></div></section>
          <section class="portal-card"><header><h2>Documentos y acciones</h2></header><div class="portal-task done">${icon("check")} Cotización recibida</div><div class="portal-task ${snapshot.status==="INFO_REQUIRED"?"pending":"done"}">${icon(snapshot.status==="INFO_REQUIRED"?"clock":"check")} Información para aseguradora</div><div class="portal-task ${Number(snapshot.balance)>0?"pending":"done"}">${icon(Number(snapshot.balance)>0?"clock":"check")} Pago del paciente</div></section>
          <section class="portal-card support"><div class="qr-demo">${renderQrPattern(token)}</div><div><h2>Necesitas ayuda</h2><p>Contacta únicamente al área administrativa. La información clínica no se muestra en este portal.</p><button data-action="portal-support">${icon("send")} Escribir a administración</button></div></section>
        </div>
      </main>
      <footer class="portal-footer">Protegemos tu información. Este portal muestra sólo información administrativa necesaria.</footer>
    </div>`;
}

function portalNextAction(status){
  const map={
    DRAFT:"El equipo está terminando la cotización.",
    READY_TO_SEND:"Recibirás un enlace seguro cuando se envíe.",
    SENT_TO_PATIENT:"Revisa el documento y confirma tus datos.",
    SENT_TO_INSURER:"La aseguradora recibió la solicitud.",
    INSURER_REVIEW:"Esperamos la respuesta de la aseguradora.",
    INFO_REQUIRED:"Administración está completando la información solicitada.",
    PARTIALLY_APPROVED:"Revisa el monto cubierto y el saldo del paciente.",
    APPROVED:"Administración coordinará la programación del servicio.",
    REJECTED:"Administración te explicará las alternativas disponibles.",
    PATIENT_PAYMENT:"Realiza el pago pendiente por el canal acordado.",
    SERVICE_SCHEDULED:"El servicio ya puede programarse.",
    CLOSED:"El proceso fue completado."
  };
  return map[status]||"Administración actualizará esta pantalla cuando exista un cambio.";
}

function renderQrPattern(text){
  let value=0;
  for(const char of text) value=(value*31+char.charCodeAt(0))>>>0;
  const cells=[];
  for(let i=0;i<100;i++){
    value=(value*1664525+1013904223)>>>0;
    cells.push(`<i class="${value%3?"dark":""}"></i>`);
  }
  return cells.join("");
}

function notFound(entity){
  return `<div class="not-found">${icon("alert")}<h1>${esc(entity)} no encontrado</h1><p>El registro no existe o fue removido.</p><a class="btn btn-primary" href="#/">Volver al dashboard</a></div>`;
}

const ROUTE_PERMISSIONS = {
  dashboard: "dashboard:read",
  pacientes: "patients:read",
  hospitalizaciones: "cases:read",
  cotizaciones: "quotes:read",
  preautorizaciones: "insurance:read",
  "cuentas-por-cobrar": "payments:read",
  pagos: "payments:read",
  clinica: "clinical:read",
  agenda: "agenda:read",
  "cuentas-por-pagar": "statements:read",
  compras: "purchases:read",
  inventario: "inventory:read",
  catalogos: "catalogs:read",
  medicos: "doctors:read",
  "estados-de-cuenta": "statements:read",
  reportes: "reports:read",
  configuracion: "settings:read",
  auditoria: "audit:read",
  "qa-cobertura": "qa:read"
};

function accessDenied(role, permission){
  return `<div class="not-found access-denied">${icon("lock")}<h1>Acceso restringido</h1><p>El rol ${esc(role)} no tiene el permiso ${esc(permission)}. El intento queda visible para auditoría en producción.</p><a class="btn btn-primary" href="#/dashboard">Volver al dashboard</a></div>`;
}

export function renderRoute(route,state,store,ui){
  const parts=route.split("/").filter(Boolean);
  const head=parts[0]||"dashboard";
  if(head==="portal") return renderPortal(state,store,ui,parts[1]);
  const permission = ROUTE_PERMISSIONS[head];
  if(permission && !roleCan(state.session.role, permission)) return accessDenied(state.session.role, permission);
  switch(head){
    case "dashboard": return renderDashboard(state,store,ui);
    case "pacientes": return parts[1]?renderPatientDetail(state,store,ui,parts[1]):renderPatients(state,store,ui);
    case "hospitalizaciones": return parts[1]?renderCaseDetail(state,store,ui,parts[1]):renderCases(state,store,ui);
    case "cotizaciones": return parts[1]?renderQuoteDetail(state,store,ui,parts[1]):renderQuotes(state,store,ui);
    case "preautorizaciones": return renderInsurance(state,store,ui);
    case "cuentas-por-cobrar":
    case "pagos": return renderReceivables(state,store,ui);
    case "clinica": {
      const sub=parts[1];
      if(!sub) return renderClinicalHome(state,store,ui);
      if(sub==="reportes") return renderClinicalDocuments(state,store,ui,"HEALTH_REPORT");
      if(sub==="ordenes") return renderClinicalDocuments(state,store,ui,"MEDICAL_ORDER");
      if(sub==="medicamentos") return renderMedicationCards(state,store,ui);
      if(sub==="planes-de-cuidado") return renderClinicalDocuments(state,store,ui,"CARE_PLAN");
      if(sub==="evoluciones") return renderEvolutions(state,store,ui);
      return renderClinicalHome(state,store,ui);
    }
    case "agenda": return renderAgenda(state,store,ui);
    case "cuentas-por-pagar": return renderPayables(state,store,ui);
    case "compras": return renderPurchases(state,store,ui);
    case "inventario": {
      const sub=parts[1];
      if(!sub) return renderInventory(state,store,ui);
      if(sub==="movimientos") return renderInventoryMovements(state,store,ui);
      if(sub==="comprometidos") return renderCommittedInventory(state,store,ui);
      if(sub==="cierres") return renderInventoryClosures(state,store,ui);
      if(sub==="bodegas") return renderWarehouses(state,store,ui);
      if(sub==="kits") return renderKits(state,store,ui);
      return renderInventory(state,store,ui);
    }
    case "catalogos": {
      const sub=parts[1];
      if(!sub) return renderCatalogs(state,store,ui);
      if(sub==="descuentos") return renderDiscounts(state,store,ui);
      const map={servicios:"SERVICES",estudios:"STUDIES",medicamentos:"MEDICATIONS",insumos:"SUPPLIES",equipos:"EQUIPMENT",honorarios:"FEES",extras:"EXTRAS"};
      return renderCatalogs(state,store,ui,map[sub]||sub.toUpperCase());
    }
    case "medicos": return renderDoctors(state,store,ui);
    case "estados-de-cuenta": return renderDoctorStatements(state,store,ui);
    case "reportes": return renderReports(state,store,ui);
    case "configuracion": return renderSettings(state,store,ui);
    case "auditoria": return renderAudit(state,store,ui);
    case "qa-cobertura": return renderQaCoverage(state,store,ui);
    default: return notFound("Página");
  }
}

export const navigation = [
  {section:"Operación",items:[
    {href:"#/dashboard",label:"Dashboard",icon:"dashboard",permission:"dashboard:read"},
    {href:"#/pacientes",label:"Pacientes",icon:"patients",permission:"patients:read"},
    {href:"#/hospitalizaciones",label:"Hospitalizaciones",icon:"cases",permission:"cases:read"},
    {href:"#/cotizaciones",label:"Cotizaciones",icon:"quotes",permission:"quotes:read"},
    {href:"#/preautorizaciones",label:"Seguros",icon:"insurance",permission:"insurance:read"},
    {href:"#/agenda",label:"Agenda y turnos",icon:"agenda",permission:"agenda:read"}
  ]},
  {section:"Clínica",items:[
    {href:"#/clinica",label:"Expediente clínico",icon:"clinical",permission:"clinical:read"},
    {href:"#/clinica/reportes",label:"Reportes de salud",icon:"file",permission:"clinical:read"},
    {href:"#/clinica/ordenes",label:"Órdenes médicas",icon:"file",permission:"clinical:read"},
    {href:"#/clinica/medicamentos",label:"Tarjeta de medicamentos",icon:"clinical",permission:"clinical:read"},
    {href:"#/clinica/planes-de-cuidado",label:"Planes de cuidado",icon:"file",permission:"clinical:read"},
    {href:"#/clinica/evoluciones",label:"Evoluciones y notas",icon:"clinical",permission:"clinical:read"}
  ]},
  {section:"Finanzas",items:[
    {href:"#/cuentas-por-cobrar",label:"Cuentas por cobrar",icon:"money",permission:"payments:read"},
    {href:"#/cuentas-por-pagar",label:"Cuentas por pagar",icon:"money",permission:"statements:read"},
    {href:"#/estados-de-cuenta",label:"Estados médicos",icon:"doctors",permission:"statements:read"},
    {href:"#/compras",label:"Compras",icon:"purchases",permission:"purchases:read"}
  ]},
  {section:"Inventario",items:[
    {href:"#/inventario",label:"Existencias",icon:"inventory",permission:"inventory:read"},
    {href:"#/inventario/movimientos",label:"Movimientos",icon:"inventory",permission:"inventory:read"},
    {href:"#/inventario/comprometidos",label:"Comprometidos y acuses",icon:"inventory",permission:"inventory:read"},
    {href:"#/inventario/cierres",label:"Cierres",icon:"inventory",permission:"inventory:read"},
    {href:"#/inventario/bodegas",label:"Bodegas",icon:"inventory",permission:"inventory:read"},
    {href:"#/inventario/kits",label:"Kits",icon:"inventory",permission:"inventory:read"}
  ]},
  {section:"Administración",items:[
    {href:"#/catalogos",label:"Catálogos y tarifas",icon:"catalogs",permission:"catalogs:read"},
    {href:"#/catalogos/descuentos",label:"Descuentos",icon:"money",permission:"catalogs:read"},
    {href:"#/medicos",label:"Médicos y recursos",icon:"doctors",permission:"doctors:read"},
    {href:"#/reportes",label:"Reportes",icon:"reports",permission:"reports:read"},
    {href:"#/auditoria",label:"Auditoría",icon:"audit",permission:"audit:read"},
    {href:"#/qa-cobertura",label:"QA video vs sistema",icon:"qa",permission:"qa:read"},
    {href:"#/configuracion",label:"Configuración",icon:"settings",permission:"settings:read"}
  ]}
];

export function renderNavigation(role,currentRoute){
  return navigation.map(section=>{
    const visible=section.items.filter(item=>roleCan(role,item.permission));
    if(!visible.length) return "";
    return `<div class="nav-section"><p>${esc(section.section)}</p>${visible.map(item=>`<a href="${item.href}" class="${currentRoute.startsWith(item.href.slice(2))?"active":""}">${icon(item.icon)}<span>${esc(item.label)}</span></a>`).join("")}</div>`;
  }).join("");
}

export function renderLogin(state){
  return `
    <div class="login-shell">
      <section class="login-brand">
        <div class="brand-lockup"><span class="brand-mark brand-mark-lg">AC</span><div><strong>Analiza en Casa</strong><small>Plataforma integral de atención domiciliar</small></div></div>
        <div class="login-copy"><p class="eyebrow">Entorno de validación QA</p><h1>Un solo sistema para coordinar cada capa de la atención.</h1><p>Pacientes, seguros, pagos, clínica, turnos, inventario, compras y estados médicos con trazabilidad de punta a punta.</p>
          <div class="login-points"><span>${icon("check")} Datos 100% ficticios</span><span>${icon("check")} Preparado para Supabase</span><span>${icon("check")} Desplegable en Vercel</span></div>
        </div>
        <footer>Versión QA 2026.08 · No utilizar con pacientes reales</footer>
      </section>
      <section class="login-panel">
        <form id="login-form" class="login-card">
          <div><p class="eyebrow">Acceso seguro</p><h2>Iniciar sesión</h2><p>Selecciona un perfil para probar permisos y flujos.</p></div>
          <label>Correo<input type="email" name="email" value="admin@analiza.demo" required></label>
          <label>Contraseña<div class="password-field"><input type="password" name="password" value="Demo2026!" required><button type="button" data-action="toggle-password">◉</button></div></label>
          <button class="btn btn-primary btn-block" type="submit">Entrar al sistema</button>
          <div class="demo-users">
            <p>Accesos rápidos</p>
            ${state.users.slice(0,6).map(u=>`<button type="button" data-action="quick-login" data-email="${esc(u.email)}"><span class="avatar">${initials(u.name)}</span><div><strong>${esc(u.name)}</strong><small>${esc(u.role)}</small></div></button>`).join("")}
          </div>
          <small class="privacy-note">La autenticación real se conecta mediante Supabase Auth. Este modo local es únicamente para QA.</small>
        </form>
      </section>
    </div>`;
}

export function renderTopbar(state,store,route){
  const user=store.currentUser();
  return `
    <button class="icon-button mobile-only" data-action="toggle-sidebar" aria-label="Menú">☰</button>
    <label class="global-search">${icon("search")}<input data-global-search placeholder="Buscar paciente, caso, cotización o comando…"><kbd>Ctrl K</kbd></label>
    <div class="topbar-actions">
      <button class="icon-button notification-button" data-action="toggle-notifications" title="Notificaciones">${icon("alert")}<span>${state.notifications.filter(n=>["QUEUED","FAILED"].includes(n.status)).length}</span></button>
      <button class="user-menu" data-action="toggle-user-menu"><span class="avatar">${initials(user?.name)}</span><div><strong>${esc(user?.name)}</strong><small>${esc(state.session.role)}</small></div><span>⌄</span></button>
    </div>`;
}

export function renderUserMenu(state,store){
  const user=store.currentUser();
  return `<div class="popover user-popover"><header><span class="avatar avatar-lg">${initials(user?.name)}</span><div><strong>${esc(user?.name)}</strong><small>${esc(user?.email)}</small></div></header><a href="#/configuracion">${icon("settings")} Configuración</a><button data-action="reset-demo">${icon("reset")} Restaurar datos demo</button><button data-action="logout">${icon("close")} Cerrar sesión</button></div>`;
}

export function renderNotificationPanel(state){
  return `<div class="popover notifications-popover"><header><div><h3>Notificaciones</h3><p>${state.notifications.length} registros</p></div><a href="#/auditoria">Ver actividad</a></header><div class="notification-list">${state.notifications.slice(0,8).map(n=>`<article><span class="notification-channel">${esc(n.channel[0])}</span><div><strong>${esc(n.subject)}</strong><p>${esc(n.safePreview)}</p><small>${formatDate(n.date,true)} · ${esc(n.target)}</small></div>${badge(n.status)}</article>`).join("")}</div></div>`;
}
