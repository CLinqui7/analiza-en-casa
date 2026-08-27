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
        <thead><tr>${headers.map((header) => `<th>${header ? esc(header) : '<span class="sr-only">Acciones</span>'}</th>`).join("")}</tr></thead>
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

function quoteRowMenu(quote) {
  const canSend = !quote.immutable && ["DRAFT", "READY_TO_SEND"].includes(quote.status);
  const editAction = quote.status === "DRAFT" && !quote.immutable ? "edit-quote-draft" : "revise-quote";
  const editLabel = editAction === "edit-quote-draft" ? "Editar" : "Nueva versión";
  const unavailable = "Pendiente de reglas y formato confirmados por el cliente (CH07).";
  return `<details class="quote-row-menu">
    <summary aria-label="Abrir acciones de ${esc(quote.id)}" title="Acciones">⋮</summary>
    <div class="quote-row-menu-panel" role="menu" aria-label="Acciones de ${esc(quote.id)}">
      <button type="button" role="menuitem" data-action="${editAction}" data-id="${esc(quote.id)}">${editLabel}</button>
      <button type="button" role="menuitem" disabled title="${unavailable}">Duplicar</button>
      <a role="menuitem" href="#/cotizaciones/${esc(quote.id)}#versiones">Versiones</a>
      <details class="quote-row-submenu">
        <summary>Imprimir <span>›</span></summary>
        <div>
          <button type="button" role="menuitem" disabled title="${unavailable}">Excel</button>
          <button type="button" role="menuitem" disabled title="${unavailable}">Detalle de servicio</button>
          <button type="button" role="menuitem" data-action="print-quote" data-id="${esc(quote.id)}">Cotización</button>
          <button type="button" role="menuitem" disabled title="${unavailable}">Factura</button>
          <button type="button" role="menuitem" disabled title="${unavailable}">Cotización internacional</button>
          <button type="button" role="menuitem" disabled title="${unavailable}">Factura internacional</button>
        </div>
      </details>
      <details class="quote-row-submenu">
        <summary>Enviar <span>›</span></summary>
        <div>
          <button type="button" role="menuitem" data-action="send-quote" data-id="${esc(quote.id)}" ${canSend ? "" : `disabled title="La versión enviada es inmutable; cree una nueva versión."`}>E-mail</button>
          <button type="button" role="menuitem" data-action="send-quote-whatsapp" data-id="${esc(quote.id)}" ${canSend ? "" : `disabled title="La versión enviada es inmutable; cree una nueva versión."`}>Whatsapp</button>
        </div>
      </details>
      <button type="button" role="menuitem" data-action="open-insurance-status" data-id="${esc(quote.id)}">Envíos al seguro</button>
      <button type="button" role="menuitem" data-action="open-administrative-execution" data-id="${esc(quote.id)}">Poner en ejecución</button>
      <a role="menuitem" href="#/cotizaciones/${esc(quote.id)}#historial-seguro">Historial de envíos</a>
      <button type="button" role="menuitem" disabled title="${unavailable}">Eliminar</button>
    </div>
  </details>`;
}

function renderDashboard(state, store, ui) {
  const activePatients = state.patients.filter((patient) => patient.status === "ACTIVE").length;
  const medicationItems = state.medicationCards.flatMap((card) => card.items || []);
  const updatedTreatments = medicationItems.filter((item) => item.lastAdministration).length;
  const carePlans = state.clinicalDocuments.filter((document) => document.type === "CARE_PLAN" && document.status !== "VOIDED").length;
  const now = new Date();
  const endingTreatments = medicationItems.filter((item) => {
    if (!item.endDate) return false;
    const days = (new Date(`${item.endDate}T23:59:59Z`) - now) / 86_400_000;
    return days >= 0 && days <= 7;
  }).length;
  const vitalRows = [...state.vitalSigns].sort((left, right) => String(right.recordedAt).localeCompare(String(left.recordedAt)));

  return `
    ${pageHeader("Dashboard", "Indicadores del capítulo CH01 calculados desde datos sintéticos o marcados explícitamente cuando falta una regla del cliente.",
      `${actionButton("Nueva cotización", "open-quote-form", {kind: "primary", iconName: "plus"})}${actionButton("Nuevo paciente", "open-patient-form", {iconName: "plus"})}`)}
    <div class="metrics-grid metrics-grid-six">
      ${metric("Pacientes con alertas", "—", "Pendiente de umbrales clínicos aprobados", "alert", "coral")}
      ${metric("Pacientes activos", activePatients, "Calculado desde estado ACTIVE", "patients", "teal")}
      ${metric("Tratamientos actualizados", updatedTreatments, "Indicador demo: administración registrada", "clinical", "blue")}
      ${metric("Tratamientos por finalizar", endingTreatments, "Indicador demo: ventana configurable de 7 días", "clock", "amber")}
      ${metric("Planes de cuidado", carePlans, "Documentos CARE_PLAN no anulados", "file", "purple")}
      ${metric("Incidentes", "—", "Sin fuente ni regla aprobada", "alert", "coral")}
    </div>
    ${card("Pacientes con valores fuera de rango", table(
      ["Acciones", "Paciente", "FC", "FR", "Oxígeno", "Sistólica", "Diastólica", "Temp", "Dolor", "Glicemia", "Fecha", "Recurso"],
      vitalRows.map((vital) => `<tr>
        <td><a class="row-action" href="#/hospitalizaciones/${esc(vital.caseId)}">Ver ${icon("view")}</a></td>
        <td>${esc(patientName(state, vital.patientId))}<small>Sin clasificación clínica</small></td>
        <td>${esc(vital.heartRate)}</td><td>${esc(vital.respiratoryRate)}</td><td>${esc(vital.spo2)}%</td>
        <td>${esc(vital.systolic)}</td><td>${esc(vital.diastolic)}</td><td>${esc(vital.temperature)} °C</td>
        <td>${esc(vital.pain)}</td><td>—</td><td>${formatDate(vital.recordedAt, true)}</td><td>${esc(vital.authorName)}</td>
      </tr>`), {compact: true}), {
        subtitle: "Los umbrales están bloqueados por decisión del cliente; ningún registro se etiqueta normal o anormal.",
        actions: `<button class="btn btn-secondary" type="button" disabled title="Requiere umbrales clínicos aprobados">Normales</button><span class="badge badge-neutral">Sin clasificar</span>`
      })}
  `;
}

function renderPatients(state, store, ui) {
  const tab = ui.patientTab || "active";
  const canWrite = roleCan(state.session.role, "patients:write");
  const activeCount = state.patients.filter((patient) => patient.status === "ACTIVE").length;
  const inactiveCount = state.patients.filter((patient) => patient.status === "INACTIVE").length;
  const tabControls = `<nav class="tabs" aria-label="Estados de pacientes">
    <button class="tab ${tab === "active" ? "active" : ""}" data-action="set-patient-tab" data-tab="active" aria-current="${tab === "active" ? "page" : "false"}">Activos <span>${activeCount}</span></button>
    <button class="tab ${tab === "inactive" ? "active" : ""}" data-action="set-patient-tab" data-tab="inactive" aria-current="${tab === "inactive" ? "page" : "false"}">Inactivos <span>${inactiveCount}</span></button>
    ${canWrite ? `<button class="tab ${tab === "bulk" ? "active" : ""}" data-action="set-patient-tab" data-tab="bulk" aria-current="${tab === "bulk" ? "page" : "false"}">Carga masiva</button>` : ""}
  </nav>`;

  if (tab === "bulk") {
    if (!canWrite) return accessDenied(state.session.role, "patients:write");
    const preview = ui.patientImport;
    return `
      ${pageHeader("Pacientes", "Carga masiva transaccional en modo demo con datos exclusivamente sintéticos.", actionButton("Volver a activos", "set-patient-tab", {data:'data-tab="active"'}))}
      ${tabControls}
      ${card("Carga masiva", `
        <div class="bulk-import">
          <p>CSV UTF-8. Encabezados obligatorios: <code>document,firstName,lastName</code>. Opcionales: <code>documentType,birthDate,sex,phone,email,company,status</code>.</p>
          <label class="file-drop" for="patient-import-file"><strong>Seleccionar CSV sintético</strong><span>No use información real.</span><input id="patient-import-file" type="file" accept=".csv,text/csv"></label>
          ${preview?.error ? `<p class="error-callout" role="alert">${esc(preview.error)}</p>` : ""}
          ${preview?.rows?.length ? `<div class="import-preview"><p><strong>${preview.rows.length}</strong> filas listas desde ${esc(preview.fileName)}.</p>${table(["Documento","Nombre","Correo","Empresa"], preview.rows.slice(0,10).map((item)=>`<tr><td>${esc(item.documentType || "DUI")} ${esc(item.document)}</td><td>${esc(item.firstName)} ${esc(item.lastName)}</td><td>${esc(item.email || "—")}</td><td>${esc(item.company || "—")}</td></tr>`), {compact:true})}<div class="form-actions">${actionButton("Cancelar","clear-patient-import")}${actionButton("Importar pacientes","confirm-patient-import",{kind:"primary"})}</div></div>` : ""}
        </div>`)}
    `;
  }

  const expectedStatus = tab === "inactive" ? "INACTIVE" : "ACTIVE";
  const filtered = searchFilter(state.patients.filter((patient) => patient.status === expectedStatus), ui.search, ["fullName", "document", "phone", "email", "address", "company"]);
  const sortKey = ui.patientSortKey || "fullName";
  const direction = ui.patientSortDirection === "desc" ? -1 : 1;
  filtered.sort((left, right) => String(sortKey === "age" ? left.birthDate : left[sortKey] || "").localeCompare(String(sortKey === "age" ? right.birthDate : right[sortKey] || ""), "es", {numeric:true}) * direction);
  const pageSize = Number(ui.patientPageSize || 10);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(Math.max(1, Number(ui.patientPage || 1)), totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const sortHeader = (label, key) => `<button class="sort-button" data-action="sort-patients" data-sort="${key}" aria-label="Ordenar por ${esc(label)}" aria-pressed="${sortKey === key}">${esc(label)}${sortKey === key ? (direction === 1 ? " ↑" : " ↓") : " ↕"}</button>`;
  const sortableTh = (label, key) => `<th aria-sort="${sortKey === key ? (direction === 1 ? "ascending" : "descending") : "none"}">${sortHeader(label, key)}</th>`;
  const rows = pageRows.map((patient) => `<tr>
    <td><div class="row-actions"><a href="#/pacientes/${patient.id}" title="Ver paciente" aria-label="Ver ${esc(patient.fullName)}">${icon("view")}</a><button data-action="edit-patient" data-id="${patient.id}" title="Editar paciente" aria-label="Editar ${esc(patient.fullName)}">${icon("edit")}</button></div></td>
    <td>${esc(patient.documentType)} ${esc(patient.document)}</td>
    <td><a class="strong-link" href="#/pacientes/${patient.id}">${esc(patient.fullName)}</a></td>
    <td>${ageFromBirthDate(patient.birthDate)} años</td>
    <td>${esc(patient.company || "Sin empresa")}</td>
    <td>${badge(patient.triage, patient.triage === "NO_ASIGNADO" ? "No asignado" : LABELS[patient.triage] || patient.triage)}</td>
    <td>${patient.notifyWhatsApp ? badge("ACTIVE", "Autorizado") : badge("INACTIVE", "No autorizado")}</td>
    <td>${badge(patient.status)}</td>
  </tr>`);
  const loading = ui.patientLoadState === "loading";
  const remoteError = store.config.dataMode === "supabase" && state.meta.remoteError;
  const body = loading
    ? `<div class="data-state" role="status" aria-live="polite"><span class="spinner"></span><strong>Cargando...</strong></div>`
    : remoteError
      ? `<div class="data-state error-callout" role="alert"><strong>No fue posible cargar pacientes.</strong><span>${esc(state.meta.remoteError)}</span></div>`
      : `<div class="table-wrap"><table><thead><tr><th>Acciones</th>${sortableTh("Documento","document")}${sortableTh("Nombre completo","fullName")}${sortableTh("Edad","age")}${sortableTh("Empresa","company")}${sortableTh("Triage","triage")}<th>Notif. Botmaker/WhatsApp</th>${sortableTh("Estado","status")}</tr></thead><tbody>${rows.length ? rows.join("") : `<tr><td colspan="8">${emptyState("No hay registros disponibles", "Ajusta la búsqueda o cambia de pestaña.")}</td></tr>`}</tbody></table></div>`;
  const pages = Array.from({length: totalPages}, (_, index) => index + 1).map((page) => `<button data-action="patient-page" data-page="${page}" class="${page === currentPage ? "active" : ""}" aria-current="${page === currentPage ? "page" : "false"}">${page}</button>`).join("");

  return `
    ${pageHeader("Pacientes", "Expediente administrativo único con datos personales, responsables, seguro, ubicación y trazabilidad.",
      `${actionButton("Excel", "export-patients", {iconName: "export"})}${actionButton("Nuevo", "open-patient-form", {kind: "primary", iconName: "plus"})}`)}
    ${tabControls}
    <div class="filter-bar">
      <label class="search-field">${icon("search")}<span class="sr-only">Buscar pacientes</span><input data-ui-search placeholder="Buscar por nombre, documento, teléfono o empresa" value="${esc(ui.search || "")}"></label>
      <label class="page-size-label">Mostrar <select data-ui-filter="patientPageSize" aria-label="Cantidad de registros por página">${[5,10,25,50].map((size)=>`<option value="${size}" ${pageSize === size ? "selected" : ""}>${size}</option>`).join("")}</select> registros</label>
      <div class="filter-summary">${filtered.length} registros</div>
    </div>
    ${card("Directorio de pacientes", `${body}<nav class="pagination" aria-label="Paginación de pacientes"><button data-action="patient-page" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>Anterior</button>${pages}<button data-action="patient-page" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>Siguiente</button></nav>`)}
  `;
}

function renderPatientForm(state, store, ui, id = null) {
  if (!roleCan(state.session.role, "patients:write")) return accessDenied(state.session.role, "patients:write");
  const patient = id ? state.patients.find((item) => item.id === id) : null;
  if (id && !patient) return notFound("Paciente");
  const insurerOptions = [
    `<option value="REGULAR" ${!patient?.insurerId ? "selected" : ""}>Paciente regular</option>`,
    ...state.insurers.filter((item) => item.status === "ACTIVE").map((item) => `<option value="${esc(item.id)}" ${patient?.insurerId === item.id ? "selected" : ""}>${esc(item.id)} | ${esc(item.name)}</option>`)
  ].join("");
  const companies = [...new Set(state.patients.map((item) => item.company).filter(Boolean))];
  const insured = Boolean(patient?.insurerId);
  return `
    ${pageHeader(patient ? "Editar paciente" : "Paciente nuevo", "Datos administrativos del paciente. Los campos marcados con * son obligatorios según la interfaz observada.")}
    <form id="patient-form" class="patient-page-form">
      <input type="hidden" name="id" value="${esc(patient?.id || "")}">
      ${card("Datos del paciente", `<div class="patient-fields-grid">
        <label><span>* Tipo de documento</span><select name="documentType" required><option value="DUI" ${["DUI","Cédula"].includes(patient?.documentType) ? "selected" : ""}>Cédula</option><option value="Pasaporte" ${patient?.documentType === "Pasaporte" ? "selected" : ""}>Pasaporte</option></select></label>
        <label><span>* Documento</span><input name="document" required value="${esc(patient?.document || "")}" autocomplete="off"></label>
        <label class="span-2"><span>* Nombre completo</span><input name="fullName" required value="${esc(patient?.fullName || "")}" autocomplete="name"></label>
        <label><span>* Fecha de nacimiento</span><input type="date" name="birthDate" required value="${esc(patient?.birthDate || "")}"></label>
        <fieldset class="patient-inline-options"><legend>* Sexo</legend><label><input type="radio" name="sex" value="M" ${patient?.sex === "M" ? "checked" : ""} required> Masculino</label><label><input type="radio" name="sex" value="F" ${patient?.sex === "F" ? "checked" : ""}> Femenino</label></fieldset>
        <label><span>* Teléfono celular</span><input type="tel" name="phone" required value="${esc(patient?.phone || "")}" autocomplete="tel"></label>
        <label><span>Teléfono casa</span><input type="tel" name="homePhone" value="${esc(patient?.homePhone || "")}"></label>
        <label><span>Correo</span><input type="email" name="email" value="${esc(patient?.email || "")}" autocomplete="email"></label>
        <label class="patient-check"><input type="checkbox" name="retired" ${patient?.retired ? "checked" : ""}> Jubilado</label>
        <label><span>Tipo de sangre</span><select name="bloodType"><option value="">Seleccione</option>${["O+","O-","A+","A-","B+","B-","AB+","AB-"].map((value) => `<option ${patient?.bloodType === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
        <label><span>Estado civil</span><input name="civilStatus" value="${esc(patient?.civilStatus || "")}" placeholder="Pendiente de catálogo del cliente"></label>
        <label><span>Nacionalidad</span><input name="nationality" list="patient-nationalities" value="${esc(patient?.nationality || "")}" placeholder="Buscar nacionalidad"><datalist id="patient-nationalities"><option value="Salvadoreña"><option value="Panameña"></datalist></label>
        <label><span>* Empresa</span><input name="company" list="patient-companies" required value="${esc(patient?.company || "")}" placeholder="Seleccionar empresa"><datalist id="patient-companies">${companies.map((value) => `<option value="${esc(value)}">`).join("")}</datalist></label>
        <label><span>Ocupación</span><input name="occupation" value="${esc(patient?.occupation || "")}"></label>
        <label class="patient-consent span-all"><input type="checkbox" name="notifyWhatsApp" ${patient?.notifyWhatsApp ? "checked" : ""}><span><strong>Este paciente desea recibir notificaciones automáticas por WhatsApp (Botmaker)</strong><small>Desmarcado por defecto. No se enviará contenido clínico; la base legal, revocación e historial requieren confirmación del cliente.</small></span></label>
      </div>`) }

      ${card("Información de seguro", `<div class="patient-fields-grid">
        <label class="span-all"><span>* Seguro</span><select name="insurerId" data-change="patient-insurance-change" required>${insurerOptions}</select></label>
        <fieldset class="patient-inline-options span-all patient-insurance-fields" ${insured ? "" : "hidden"}><legend>¿Paciente es el asegurado titular?</legend><label><input type="radio" name="isPolicyHolder" value="false" data-change="patient-holder-change" ${patient?.isPolicyHolder === false ? "checked" : ""} ${insured ? "required" : ""}> No</label><label><input type="radio" name="isPolicyHolder" value="true" data-change="patient-holder-change" ${patient?.isPolicyHolder ? "checked" : ""} ${insured ? "required" : ""}> Sí</label></fieldset>
        <div class="patient-fields-grid span-all patient-insurance-fields" ${insured ? "" : "hidden"}>
          <label><span>* Nro de póliza</span><input name="policy" value="${esc(patient?.policy || "")}" ${insured ? "required" : ""}></label>
          <label><span>Certificado/Unidad</span><input name="policyCertificate" value="${esc(patient?.policyCertificate || "")}"></label>
          <label><span>Fecha efectiva</span><input type="date" name="policyEffectiveDate" value="${esc(patient?.policyEffectiveDate || "")}"></label>
          <label><span>* DUI/NIT del asegurado</span><input name="insuredDocument" value="${esc(patient?.insuredDocument || "")}" ${insured ? "required" : ""}></label>
          <label><span>* Nombre asegurado</span><input name="insuredName" value="${esc(patient?.insuredName || "")}" ${insured ? "required" : ""}></label>
          <label><span>* Fecha de nacimiento del asegurado</span><input type="date" name="insuredBirthDate" value="${esc(patient?.insuredBirthDate || "")}" ${insured ? "required" : ""}></label>
          <button class="btn btn-secondary" type="button" disabled title="CH02-Q005: requiere reglas de múltiples coberturas">Agregar</button>
        </div>
      </div>`, {subtitle:"El catálogo es sintético. La titularidad y las múltiples coberturas permanecen sujetas a CH02-Q004/CH02-Q005."})}

      ${card("Información de contactos", `<div class="patient-fields-grid">
        <label><span>Nombre completo</span><input name="contactName" value="${esc(patient?.contactName || "")}"></label>
        <label><span>Teléfono</span><input type="tel" name="contactPhone" value="${esc(patient?.contactPhone || "")}"></label>
        <label><span>Correo</span><input type="email" name="contactEmail" value="${esc(patient?.contactEmail || "")}"></label>
        <label><span>Parentesco</span><input name="contactRelationship" value="${esc(patient?.contactRelationship || "")}" placeholder="Pendiente de catálogo"></label>
        <label><span>Rol</span><input name="contactRole" value="${esc(patient?.contactRole || "")}" placeholder="Pendiente de catálogo"></label>
        <label><span>País de residencia</span><input name="contactCountry" value="${esc(patient?.contactCountry || "")}" placeholder="Pendiente de catálogo"></label>
      </div>`, {subtitle:"La multiplicidad y los catálogos de contactos requieren decisión CH02-Q006."})}

      ${card("Información de dirección", `<div class="patient-fields-grid">
        <label class="span-all"><span>Pegar enlace <small title="CH02-Q007: proveedores y precedencia pendientes">ⓘ</small></span><div class="inline-control"><input name="locationLink" value="${esc(patient?.locationLink || "")}" placeholder="Enlace de ubicación"><button class="btn btn-secondary" type="button" data-action="clear-patient-location">Limpiar</button></div></label>
        <label class="span-2"><span>* Dirección</span><input name="address" required value="${esc(patient?.address || "")}" placeholder="Enter a location"></label>
        <label class="span-2"><span>Ubicación geográfica</span><input name="geo" value="${esc(patient?.geo || "")}" placeholder="Marcador o coordenadas"></label>
        <label class="span-2"><span>* Comentarios relevantes de la dirección</span><input name="addressComments" required value="${esc(patient?.addressComments || "")}"></label>
        <button class="btn btn-secondary" type="button" disabled title="CH02-Q007: finalidad y retención de cámara pendientes">Cámara</button>
        <div class="synthetic-map span-all" role="img" aria-label="Mapa demo sin geocodificación real"><div class="map-grid"></div><span class="map-pin">●</span><strong>Mapa demo</strong><small>No geocodifica ni captura imágenes. Configuración pendiente CH02-Q007.</small></div>
      </div>`) }

      <div class="patient-form-actions"><a class="btn btn-secondary" href="#/pacientes">Atrás</a><button class="btn btn-primary" type="submit">Guardar</button></div>
    </form>`;
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
  const canWriteCases = roleCan(state.session.role, "cases:write");
  const canWriteQuotes = roleCan(state.session.role, "quotes:write");
  const activeTab = ["active", "quotes", "pic"].includes(ui.tab) ? ui.tab : "active";
  const casePageSize = Number(ui.casePageSize || 10);
  const tabControls = `<nav class="tabs" aria-label="Gestión de hospitalización">
    <button class="tab ${activeTab === "active" ? "active" : ""}" data-action="set-tab" data-tab="active" aria-current="${activeTab === "active" ? "page" : "false"}">Activos</button>
    <button class="tab ${activeTab === "quotes" ? "active" : ""}" data-action="set-tab" data-tab="quotes" aria-current="${activeTab === "quotes" ? "page" : "false"}">Cotizaciones</button>
    <button class="tab ${activeTab === "pic" ? "active" : ""}" data-action="set-tab" data-tab="pic" aria-current="${activeTab === "pic" ? "page" : "false"}">PIC Ejecución <span title="CH03-Q003: fórmula no confirmada">—</span></button>
  </nav>`;

  let tabBody = "";
  if (activeTab === "pic") {
    tabBody = `<div class="data-state" role="status"><strong>PIC Ejecución pendiente de reglas del cliente</strong><span>No se muestra un conteo ni se habilitan transiciones hasta resolver CH03-Q001, CH03-Q003 y CH03-Q005.</span></div>`;
  } else if (activeTab === "quotes") {
    const query = String(ui.search || "").trim().toLocaleLowerCase("es");
    const filteredQuotes = state.quotes
      .filter((quote) => {
        if (!query) return true;
        const patient = state.patients.find((item) => item.id === quote.patientId);
        return [quote.id, quote.status, quote.comments, patient?.fullName, patient?.document]
          .some((value) => String(value || "").toLocaleLowerCase("es").includes(query));
      })
      .filter((quote) => !ui.caseQuoteStatus || quote.status === ui.caseQuoteStatus)
      .filter((quote) => !ui.caseQuoteDate || String(quote.createdAt || "").slice(0, 10) === ui.caseQuoteDate);
    const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / casePageSize));
    const currentPage = Math.min(Math.max(1, Number(ui.caseQuotePage || 1)), totalPages);
    const pageRows = filteredQuotes.slice((currentPage - 1) * casePageSize, currentPage * casePageSize);
    const rows = pageRows.map((quote) => {
      const patient = state.patients.find((item) => item.id === quote.patientId);
      const request = state.insuranceRequests.find((item) => item.quoteId === quote.id);
      return `<tr>
        <td>${quoteRowMenu(quote)}</td>
        <td>${esc(patient?.fullName || "Paciente no encontrado")}</td>
        <td>${esc(patient?.document || "—")}</td>
        <td><a class="strong-link" href="#/cotizaciones/${esc(quote.id)}">${esc(quote.id)}</a></td>
        <td><button type="button" class="interactive-badge" data-action="open-insurance-status" data-id="${esc(quote.id)}" aria-label="Actualizar estado de ${esc(quote.id)}">${badge(quote.status, QUOTE_ADMIN_LABELS[quote.status] || quote.status)}</button></td>
        <td>${badge(request?.preauthorizationSentAt ? "SENT" : "PENDING", request?.preauthorizationSentAt ? "Enviado" : "Regla pendiente")}</td>
        <td>${badge(request?.responseStatus || "PENDING", request?.responseStatus ? (QUOTE_ADMIN_LABELS[request.responseStatus] || request.responseStatus) : "Regla pendiente")}</td>
        <td>${badge(request?.claimStatus || "PENDING", request?.claimStatus || "Regla pendiente")}</td>
        <td>${formatDate(quote.createdAt)}</td>
        <td>${money(quote.total)}</td>
      </tr>`;
    });
    const pages = Array.from({length: totalPages}, (_, index) => index + 1).map((page) => `<button data-action="case-quote-page" data-page="${page}" class="${page === currentPage ? "active" : ""}" aria-current="${page === currentPage ? "page" : "false"}">${page}</button>`).join("");
    tabBody = `<div class="filter-panel">
      <label>Estado<select data-ui-filter="caseQuoteStatus"><option value="">Seleccione</option>${Object.entries(QUOTE_ADMIN_LABELS).map(([status, label]) => `<option value="${esc(status)}" ${ui.caseQuoteStatus === status ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></label>
      <label>Fecha de creación<input type="date" data-ui-filter="caseQuoteDate" value="${esc(ui.caseQuoteDate || "")}"></label>
      <div class="filter-actions"><button class="btn btn-primary" data-action="apply-case-filters">✓ Aplicar</button><button class="btn btn-secondary" data-action="clear-case-filters">Limpiar</button>${canWriteQuotes ? actionButton("Nuevo", "open-quote-form", {kind:"primary", iconName:"plus"}) : ""}</div>
    </div>
    <div class="filter-bar"><label class="page-size-label">Mostrar <select data-ui-filter="casePageSize" aria-label="Cantidad de cotizaciones por página">${[5,10,25,50].map((size)=>`<option value="${size}" ${casePageSize === size ? "selected" : ""}>${size}</option>`).join("")}</select> registros</label><nav class="pagination" aria-label="Paginación de cotizaciones"><button data-action="case-quote-page" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>Anterior</button>${pages}<button data-action="case-quote-page" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>Siguiente</button></nav><label class="search-field">${icon("search")}<span class="sr-only">Buscar cotizaciones</span><input data-ui-search value="${esc(ui.search || "")}"></label></div>
    ${table(["", "Paciente", "DUI/NIT", "Nro.", "Estado", "Envío preautorización", "Respuesta seguro", "Envío de reclamo", "Creación", "Total"], rows)}`;
  } else {
    const filteredCases = state.cases.map((record) => ({record, patient: state.patients.find((item) => item.id === record.patientId)}))
      .filter(({record}) => !ui.caseStatus || record.status === ui.caseStatus)
      .filter(({record}) => !ui.caseStartDate || record.startDate === ui.caseStartDate)
      .filter(({record}) => !ui.caseAccountType || record.accountType === ui.caseAccountType)
      .filter(({record, patient}) => !ui.search || [record.id, record.status, record.accountType, patient?.fullName, patient?.document, patient?.company].some((value) => String(value || "").toLowerCase().includes(String(ui.search).toLowerCase())));
    const totalPages = Math.max(1, Math.ceil(filteredCases.length / casePageSize));
    const currentPage = Math.min(Math.max(1, Number(ui.casePage || 1)), totalPages);
    const pageRows = filteredCases.slice((currentPage - 1) * casePageSize, currentPage * casePageSize);
    const rows = pageRows.map(({record, patient}) => `<tr>
      <td><a class="row-action" href="#/hospitalizaciones/${esc(record.id)}" aria-label="Gestionar ${esc(record.id)}">${icon("view")}</a></td>
      <td><a class="strong-link" href="#/hospitalizaciones/${esc(record.id)}">${esc(record.id)}</a></td>
      <td>${esc(patient?.document || "—")}</td>
      <td>${esc(patient?.fullName || "Paciente no encontrado")}</td>
      <td>${esc(patient?.company || "Sin empresa")}</td>
      <td>${esc(record.accountType)}</td>
      <td>${badge(record.status)}</td>
      <td>${formatDate(record.startDate)} al ${record.endDate ? formatDate(record.endDate) : "actual"}<small>${daysBetween(record.startDate, record.endDate || new Date().toISOString())} días</small></td>
    </tr>`);
    const pages = Array.from({length: totalPages}, (_, index) => index + 1).map((page) => `<button data-action="case-page" data-page="${page}" class="${page === currentPage ? "active" : ""}" aria-current="${page === currentPage ? "page" : "false"}">${page}</button>`).join("");
    const accountTypes = [...new Set(state.cases.map((record) => record.accountType).filter(Boolean))];
    tabBody = `<div class="filter-panel">
      <label>Estado Administrativo<select data-ui-filter="caseStatus"><option value="">Todos</option>${["ACTIVE","PENDING_CLOSE","CLOSED"].map((status)=>`<option value="${status}" ${ui.caseStatus === status ? "selected" : ""}>${LABELS[status] || status}</option>`).join("")}</select></label>
      <label>Fecha de inicio<input type="date" data-ui-filter="caseStartDate" value="${esc(ui.caseStartDate || "")}"></label>
      <label>Tipo de cuenta<select data-ui-filter="caseAccountType"><option value="">Seleccione</option>${accountTypes.map((type) => `<option value="${esc(type)}" ${ui.caseAccountType === type ? "selected" : ""}>${esc(type)}</option>`).join("")}</select></label>
      <div class="filter-actions"><button class="btn btn-primary" data-action="apply-case-filters">✓ Aplicar</button><button class="btn btn-secondary" data-action="clear-case-filters">Limpiar</button></div>
    </div>
    <div class="filter-bar"><label class="page-size-label">Mostrar <select data-ui-filter="casePageSize" aria-label="Cantidad de hospitalizaciones por página">${[5,10,25,50].map((size)=>`<option value="${size}" ${casePageSize === size ? "selected" : ""}>${size}</option>`).join("")}</select> registros</label><nav class="pagination" aria-label="Paginación de hospitalizaciones"><button data-action="case-page" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>Anterior</button>${pages}<button data-action="case-page" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>Siguiente</button></nav><label class="search-field">${icon("search")}<span class="sr-only">Buscar hospitalizaciones</span><input data-ui-search value="${esc(ui.search || "")}"></label></div>
    ${table(["", "Hospitalización", "DUI/NIT", "Paciente", "Empresa", "Tipo Cuenta", "Administrativo", "Duración"], rows)}`;
  }
  return `
    ${pageHeader("Hospitalización", "Gestión administrativa de casos, cotizaciones y seguimiento previo a ejecución.", canWriteCases ? actionButton("Nueva hospitalización", "open-case-form", {kind:"primary", iconName:"plus"}) : "")}
    <section class="relation-card"><header><strong>Relación de pacientes por empresa</strong><span title="CH03-Q003: fórmula pendiente">—</span><button type="button" disabled title="CH03-Q003: alcance del panel pendiente">+</button></header></section>
    ${tabControls}
    ${card(activeTab === "active" ? "Hospitalizaciones activas" : activeTab === "quotes" ? "Cotizaciones" : "PIC Ejecución", tabBody)}
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
  const draftEditable=quote.status==="DRAFT"&&!quote.immutable;
  return `
    ${pageHeader(`${quote.id} · versión ${quote.version}`, `${patientName(state,quote.patientId)} · ${quote.caseId}`,
      `${draftEditable?actionButton("Editar borrador","edit-quote-draft",{iconName:"edit",data:`data-id="${quote.id}"`}):actionButton("Revisar / nueva versión","revise-quote",{iconName:"edit",data:`data-id="${quote.id}"`})}${actionButton("Imprimir","print-quote",{iconName:"print",data:`data-id="${quote.id}"`})}${!quote.immutable?actionButton("Enviar","send-quote",{kind:"primary",iconName:"send",data:`data-id="${quote.id}"`}):""}`)}
    ${renderQuoteDetailContent(state,store,ui,quote)}
  `;
}

function renderQuoteDetailContent(state, store, ui, quote) {
  const patient=state.patients.find((item)=>item.id===quote.patientId);
  const request=state.insuranceRequests.find((item)=>item.quoteId===quote.id);
  const payments=state.payments.filter((item)=>item.quoteId===quote.id);
  const versions=state.quotes
    .filter((candidate)=>(candidate.quoteId||candidate.originalQuoteId||candidate.id)===(quote.quoteId||quote.originalQuoteId||quote.id))
    .sort((left,right)=>Number(left.version||0)-Number(right.version||0));
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
        ${card("Historial de versiones", table(["Versión","Estado","Creación","Motivo","Total",""], versions.map((version)=>`<tr><td>v${version.version}</td><td>${badge(version.immutable?"SENT_TO_PATIENT":version.status)}</td><td>${formatDate(version.createdAt,true)}</td><td>${esc(version.revisionReason||"Versión inicial")}</td><td>${money(version.total)}</td><td><a class="row-action" href="#/cotizaciones/${version.id}">Consultar</a></td></tr>`)),{className:"nested-card"})}
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
  const latestQuotes = [...state.quotes.reduce((roots, quote) => {
    const rootId = quote.quoteId || quote.originalQuoteId || quote.id;
    const current = roots.get(rootId);
    if (!current || Number(quote.version || 0) >= Number(current.version || 0)) roots.set(rootId, quote);
    return roots;
  }, new Map()).values()];
  const search = String(ui.receivablesSearch || "").trim().toLocaleLowerCase("es");
  const filteredQuotes = latestQuotes.filter((quote) => {
    const patient = state.patients.find((candidate) => candidate.id === quote.patientId);
    return !search || [quote.id, quote.displayCode, quote.caseId, patient?.fullName, patient?.document]
      .some((value) => String(value || "").toLocaleLowerCase("es").includes(search));
  });
  const sortKey = ui.receivablesSortKey || "startDate";
  const sortDirection = ui.receivablesSortDirection === "asc" ? 1 : -1;
  const entries = filteredQuotes.map((quote) => {
    const record = state.cases.find((candidate) => candidate.id === quote.caseId);
    const patient = state.patients.find((candidate) => candidate.id === quote.patientId);
    const paid = state.payments.filter((payment) => payment.quoteId === quote.id && payment.status === "APPLIED").reduce((sum, payment) => sum + payment.amount, 0);
    return { quote, record, patient, paid, balance: quoteBalance(quote, state.payments) };
  }).sort((left, right) => {
    const value = (entry) => ({
      startDate: entry.record?.startDate,
      patient: entry.patient?.fullName,
      caseId: entry.quote.caseId,
      status: entry.record?.status,
      accountType: entry.record?.accountType,
      manager: entry.record?.manager,
      invoices: entry.quote.patientAmount,
      payments: entry.paid,
      balance: entry.balance
    })[sortKey] ?? "";
    return String(value(left)).localeCompare(String(value(right)), "es", { numeric: true }) * sortDirection;
  });
  const pageSize = Number(ui.receivablesPageSize || 10);
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const currentPage = Math.min(Math.max(1, Number(ui.receivablesPage || 1)), totalPages);
  const pageEntries = entries.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const rows=pageEntries.map(({quote, record, paid, balance})=>{
    return `<tr>
      <td><details class="quote-row-menu"><summary aria-label="Acciones de ${esc(quote.caseId || quote.id)}">•••</summary><div class="quote-row-menu-panel">
        <button data-action="open-receivable-quotes" data-case-id="${esc(quote.caseId)}">Ver cotizaciones</button>
        <button data-action="open-account-history" data-case-id="${esc(quote.caseId)}">Estados de cuenta</button>
        <button data-action="open-receivable-payments" data-case-id="${esc(quote.caseId)}">Ver pagos</button>
        <button disabled title="Requiere política de archivo aprobada">Archivar</button>
        <button disabled title="Integración no definida">Registro XPO</button>
      </div></details></td>
      <td>${formatDate(record?.startDate)}</td><td>${esc(patientName(state,quote.patientId))}</td>
      <td><a class="strong-link" href="#/hospitalizaciones/${esc(quote.caseId)}">${esc(quote.caseId)}</a></td>
      <td>${badge(record?.status || "ACTIVE")}</td><td>${esc(record?.accountType || "—")}</td><td>${esc(record?.manager || "—")}</td>
      <td>${money(quote.patientAmount)}</td><td>${money(paid)}</td><td>${money(balance)}</td><td>${badge(balance<=.01?"PAID":"UNPAID")}</td></tr>`;
  });
  const sortableTh = (label, key) => `<th aria-sort="${sortKey === key ? (sortDirection === 1 ? "ascending" : "descending") : "none"}"><button class="sort-button" data-action="sort-receivables" data-sort="${key}" aria-label="Ordenar por ${esc(label)}">${esc(label)}${sortKey === key ? (sortDirection === 1 ? " ↑" : " ↓") : " ↕"}</button></th>`;
  const pages = Array.from({length: totalPages}, (_, index) => index + 1).map((page) => `<button data-action="receivables-page" data-page="${page}" class="${page === currentPage ? "active" : ""}" aria-current="${page === currentPage ? "page" : "false"}">${page}</button>`).join("");
  const accountsTable = `<div class="table-wrap"><table><thead><tr><th><span class="sr-only">Acciones</span></th>${sortableTh("Fecha inicio","startDate")}${sortableTh("Paciente","patient")}${sortableTh("Cód. hospitalización","caseId")}${sortableTh("Estado Hosp.","status")}${sortableTh("Tipo cuenta","accountType")}${sortableTh("Gestionado por","manager")}${sortableTh("Total facturas","invoices")}${sortableTh("Total pagos","payments")}${sortableTh("Pendiente","balance")}<th>Estado cuenta</th></tr></thead><tbody>${rows.length ? rows.join("") : `<tr><td colspan="11">${emptyState("Sin resultados", "Ajusta la búsqueda.")}</td></tr>`}</tbody></table></div>`;
  const accountsTotal = latestQuotes.reduce((sum, quote) => sum + Number(quote.patientAmount || 0), 0);
  const paidTotal = state.payments.filter((payment) => payment.status === "APPLIED").reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const openTotal = latestQuotes.reduce((sum, quote) => sum + quoteBalance(quote, state.payments), 0);
  const activeTab = ui.receivablesTab || "accounts";
  return `
    ${pageHeader("Cuentas por cobrar","Facturas, responsabilidad del paciente, pagos, adelantos, ajustes, comprobantes y estado de cuenta.",
      `${actionButton("Excel con filtros","export-receivables-filtered",{iconName:"export"})}${actionButton("Reporte","open-account-statement",{iconName:"file"})}${actionButton("Excel","export-receivables",{iconName:"export"})}`)}
    <nav class="tabs" aria-label="Cuentas por cobrar">
      <button class="tab ${activeTab === "accounts" ? "active" : ""}" data-action="set-receivables-tab" data-tab="accounts">Cuentas <span>${latestQuotes.length}</span></button>
      <button class="tab ${activeTab === "payments" ? "active" : ""}" data-action="set-receivables-tab" data-tab="payments">Pagos <span>${state.payments.length}</span></button>
    </nav>
    <div class="metrics-grid metrics-small">
      ${metric("Responsabilidad total",money(accountsTotal),"Suma de cuentas actuales","money","blue")}
      ${metric("Pagos aplicados",money(paidTotal),"Movimientos confirmados","check","teal")}
      ${metric("Saldo abierto",money(openTotal),"Pendiente de cobro","clock","coral")}
    </div>
    ${activeTab === "accounts" ? card("Cuentas", `
      <div class="filter-bar"><label class="page-size-label">Mostrar <select data-ui-filter="receivablesPageSize" aria-label="Cantidad de cuentas por página">${[10,25,50].map((size)=>`<option value="${size}" ${pageSize === size ? "selected" : ""}>${size}</option>`).join("")}</select> registros</label><span class="filter-summary">${entries.length} registros</span><label class="search-field">${icon("search")}<span class="sr-only">Buscar cuenta</span><input data-input="receivables-search" value="${esc(ui.receivablesSearch || "")}" placeholder="Paciente, documento u hospitalización"></label></div>
      ${accountsTable}<nav class="pagination" aria-label="Paginación de cuentas"><button data-action="receivables-page" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>Anterior</button>${pages}<button data-action="receivables-page" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>Siguiente</button></nav>`,
      {subtitle:`${filteredQuotes.length} cuenta(s) mostrada(s)`}) : `
      <div class="action-strip">${actionButton("Añadir pago","open-payment-form",{kind:"primary",iconName:"plus"})}</div>
      ${renderPaymentsTable(state,state.payments)}`}
  `;
}

function renderPaymentsTable(state,payments) {
  return card("Movimientos de pago",table(["","Fecha","Comprobante","Paciente","Tipo","Pagado por","Referencia","Monto","Estado"],
    payments.map((payment)=>`<tr><td><details class="quote-row-menu"><summary aria-label="Acciones del pago ${esc(payment.receipt)}">•••</summary><div class="quote-row-menu-panel">
      <button disabled title="Los pagos aplicados son inmutables">Editar pago</button>
      <button data-action="print-payment" data-id="${esc(payment.id)}">Imprimir</button>
      ${payment.status === "APPLIED" ? `<button data-action="open-reverse-payment" data-id="${esc(payment.id)}">Revertir pago</button>` : ""}
      <button disabled title="Los pagos no se eliminan; use una reversión auditada">Eliminar pagos</button>
    </div></details></td><td>${formatDate(payment.date,true)}</td><td>${esc(payment.receipt)}</td><td>${esc(patientName(state,payment.patientId))}</td><td>${esc(payment.method)}</td><td>${esc(payment.payer)}</td><td><code>${esc(payment.reference)}</code></td><td>${money(payment.amount)}</td><td>${badge(payment.status)}</td></tr>`),{compact:true}));
}

function renderClinicalHospitalizations(state, store, ui) {
  const profiles = state.clinicalProfiles || [];
  const query = String(ui.clinicalCaseSearch || "").trim().toLocaleLowerCase("es");
  const latestByCase = profiles.reduce((map, profile) => {
    const current = map.get(profile.caseId);
    if (!current || String(profile.createdAt).localeCompare(String(current.createdAt)) > 0) map.set(profile.caseId, profile);
    return map;
  }, new Map());
  const entries = state.cases.map((record) => ({
    record,
    patient: state.patients.find((candidate) => candidate.id === record.patientId),
    profile: latestByCase.get(record.id)
  })).filter(({record, patient, profile}) => {
    const clinicalStatus = profile?.clinicalStatus || "PENDING";
    return (!ui.clinicalStatus || clinicalStatus === ui.clinicalStatus)
      && (!ui.clinicalServiceType || profile?.serviceType === ui.clinicalServiceType)
      && (!ui.clinicalAttentionType || profile?.attentionType === ui.clinicalAttentionType)
      && (!query || [record.id, patient?.document, patient?.fullName, patient?.company, profile?.triage]
        .some((value) => String(value || "").toLocaleLowerCase("es").includes(query)));
  });
  const pageSize = Number(ui.clinicalPageSize || 10);
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const currentPage = Math.min(Math.max(1, Number(ui.clinicalPage || 1)), totalPages);
  const pageEntries = entries.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const services = [...new Set(profiles.map((profile) => profile.serviceType).filter(Boolean))];
  const attentionTypes = [...new Set(profiles.map((profile) => profile.attentionType).filter(Boolean))];
  const clinicalStatusLabel = (status) => ({PENDING:"Pendiente",DRAFT:"Borrador",ACTIVE:"Activo",FINISHED:"Finalizado",VOIDED:"Anulado"})[status] || status;
  const rows = pageEntries.map(({record, patient, profile}) => `<tr>
    <td><details class="quote-row-menu"><summary aria-label="Acciones clínicas de ${esc(record.id)}">•••</summary><div class="quote-row-menu-panel">
      <a href="#/hospitalizaciones/${esc(record.id)}">Ver cotizaciones</a>
      <button data-action="open-clinical-profiles" data-case-id="${esc(record.id)}">Perfil clínico</button>
      <a href="#/clinica/reportes/${esc(record.id)}">Documento</a>
      <button disabled title="Requiere reglas clínicas aprobadas">Relevos</button>
      <button disabled title="Requiere reglas clínicas aprobadas">Reingresos</button>
      <button disabled title="Requiere reglas clínicas aprobadas">Reinfecciones</button>
      <button disabled title="Requiere reglas clínicas aprobadas">Ulceraciones</button>
      <button disabled title="Requiere reglas clínicas aprobadas">Near miss</button>
    </div></details></td>
    <td>${esc(patient?.fullName || "Paciente no encontrado")}</td><td>${esc(patient?.document || "—")}</td>
    <td><a class="strong-link" href="#/hospitalizaciones/${esc(record.id)}">${esc(record.id)}</a></td>
    <td>${badge(profile?.triage || "UNCLASSIFIED", profile?.triage || "No asignado")}</td><td>${esc(patient?.company || "Sin empresa")}</td>
    <td>${badge(profile?.clinicalStatus || "PENDING", clinicalStatusLabel(profile?.clinicalStatus || "PENDING"))}</td>
    <td>${formatDate(profile?.startDate || record.startDate)}</td><td>${profile?.endDate ? formatDate(profile.endDate) : "—"}</td>
    <td>${daysBetween(profile?.startDate || record.startDate, profile?.endDate || new Date().toISOString())} días</td></tr>`);
  const pages = Array.from({length: totalPages}, (_, index) => index + 1).map((page) => `<button data-action="clinical-page" data-page="${page}" class="${page === currentPage ? "active" : ""}">${page}</button>`).join("");
  return `
    ${pageHeader("Hospitalización clínica", "Activación y perfiles clínicos por hospitalización, sin inferir diagnóstico, triage ni frecuencia de atención.")}
    <section class="relation-card"><header><strong>Relación de pacientes por empresa</strong><span>${state.cases.length}</span><button type="button" disabled title="La fórmula del agrupamiento requiere confirmación">+</button></header></section>
    <div class="filter-panel">
      <label>Estado clínico<select data-ui-filter="clinicalStatus"><option value="">Todos</option><option value="PENDING" ${ui.clinicalStatus === "PENDING" ? "selected" : ""}>Pendiente</option><option value="DRAFT" ${ui.clinicalStatus === "DRAFT" ? "selected" : ""}>Borrador</option><option value="ACTIVE" ${ui.clinicalStatus === "ACTIVE" ? "selected" : ""}>Activos</option><option value="FINISHED" ${ui.clinicalStatus === "FINISHED" ? "selected" : ""}>Finalizados</option></select></label>
      <label>Activado por<input value="Personal autorizado" disabled title="El filtro por actor requiere catálogo de usuarios productivo"></label>
      <label>Tipo de servicio<select data-ui-filter="clinicalServiceType"><option value="">Seleccione</option>${services.map((value) => `<option ${ui.clinicalServiceType === value ? "selected" : ""}>${esc(value)}</option>`).join("")}</select></label>
      <label>Tipo de atención<select data-ui-filter="clinicalAttentionType"><option value="">Seleccione</option>${attentionTypes.map((value) => `<option ${ui.clinicalAttentionType === value ? "selected" : ""}>${esc(value)}</option>`).join("")}</select></label>
      <div class="filter-actions"><button class="btn btn-primary" data-action="apply-clinical-filters">Aplicar</button><button class="btn btn-secondary" data-action="clear-clinical-filters">Limpiar</button></div>
    </div>
    ${card("Activos", `<div class="filter-bar"><label class="page-size-label">Registros <select data-ui-filter="clinicalPageSize">${[10,25,50].map((size) => `<option value="${size}" ${pageSize === size ? "selected" : ""}>${size}</option>`).join("")}</select></label><label class="search-field">${icon("search")}<input data-input="clinical-case-search" value="${esc(ui.clinicalCaseSearch || "")}" placeholder="Paciente, documento u hospitalización"></label></div>
      ${table(["Acciones","Paciente","DUI/NIT","Hospitalización","Triage","Empresa","Clínico","Inicio","Fin","Duración"], rows)}
      <nav class="pagination" aria-label="Paginación clínica"><button data-action="clinical-page" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>Anterior</button>${pages}<button data-action="clinical-page" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>Siguiente</button></nav>`)}
  `;
}

function reportEntries(state) {
  return state.cases.map((record) => {
    const patient = state.patients.find((candidate) => candidate.id === record.patientId);
    const profile = (state.clinicalProfiles || []).filter((candidate) => candidate.caseId === record.id)
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0];
    const documents = state.clinicalDocuments.filter((document) => document.caseId === record.id && document.type === "HEALTH_REPORT");
    return {record, patient, profile, documents};
  });
}

function healthReportMenu(caseId) {
  const blocked = "Requiere contrato clínico y permisos confirmados por el cliente.";
  return `<details class="quote-row-menu"><summary aria-label="Acciones del reporte ${esc(caseId)}">•••</summary><div class="quote-row-menu-panel">
    <a href="#/clinica/reportes/${esc(caseId)}">Historia clínica</a><button disabled title="${blocked}">Claims</button>
    <button disabled title="${blocked}">Ver visitas</button><button disabled title="${blocked}">Notas de servicio</button>
    <a href="#/clinica/reportes/${esc(caseId)}">Reporte de salud</a><button disabled title="${blocked}">Auditorías</button><button disabled title="${blocked}">Registro XPO</button>
  </div></details>`;
}

function renderHealthReportDetail(state, store, ui, caseId) {
  const entry = reportEntries(state).find((candidate) => candidate.record.id === caseId);
  if (!entry) return notFound("Reporte de salud");
  const {record, patient, profile} = entry;
  const range = ui.healthReportRange?.caseId === caseId ? ui.healthReportRange : {caseId, start: profile?.startDate || record.startDate, end: profile?.endDate || record.endDate || new Date().toISOString().slice(0,10)};
  const inRange = (value) => !value || ((!range.start || String(value).slice(0,10) >= range.start) && (!range.end || String(value).slice(0,10) <= range.end));
  const vitals = state.vitalSigns.filter((item) => item.caseId === caseId && inRange(item.recordedAt));
  const notes = state.nursingNotes.filter((item) => item.caseId === caseId && inRange(item.createdAt));
  const documents = state.clinicalDocuments.filter((item) => item.caseId === caseId && inRange(item.createdAt));
  const cards = state.medicationCards.filter((item) => item.caseId === caseId);
  const activeTab = ui.healthReportTab || "main";
  const tabs = [["main","Información Principal"],["assessment","Evaluación Clínica"],["care","Atención Médica"],["treatments","Tratamientos y Órdenes"],["events","Eventos Clínicos"],["evidence","Evidencia y Documentos"]];
  let body = "";
  if (activeTab === "assessment") {
    body = `<div class="details-grid"><div><span>Diagnóstico documentado</span><strong>${esc(profile ? `${profile.diagnosisCode} · ${profile.diagnosisLabel}` : "Sin perfil clínico")}</strong></div><div><span>Grupo diagnóstico</span><strong>${esc(profile?.diagnosisGroup || "—")}</strong></div><div><span>Triage</span><strong>${esc(profile?.triage || "No asignado")}</strong></div><div><span>Grupo / subgrupo</span><strong>${esc([profile?.profileGroup, profile?.profileSubgroup].filter(Boolean).join(" · ") || "—")}</strong></div></div>
      ${card("Dispositivos", table(["Dispositivo","Fecha","Calibre","Motivo","Frecuencia","Observaciones"], (profile?.devices || []).map((device) => `<tr><td>${esc(device.deviceType)}</td><td>${formatDate(device.date)}</td><td>${esc(device.gauge || "—")}</td><td>${esc(device.reason || "—")}</td><td>${esc(device.changeFrequency || "—")}</td><td>${esc(device.observations || "—")}</td></tr>`), {compact:true}))}
      ${card("Tabla de signos vitales", table(["Fecha","TA","FC","FR","SpO₂","Temp","Dolor"], vitals.map((vital) => `<tr><td>${formatDate(vital.recordedAt,true)}</td><td>${vital.systolic}/${vital.diastolic}</td><td>${vital.heartRate}</td><td>${vital.respiratoryRate}</td><td>${vital.spo2}%</td><td>${vital.temperature} °C</td><td>${vital.pain}</td></tr>`), {compact:true}))}`;
  } else if (activeTab === "care") {
    body = `<div class="details-grid"><div><span>Médico tratante</span><strong>${esc(doctorName(state, profile?.treatingDoctorId))}</strong></div><div><span>Tipo de servicio</span><strong>${esc(profile?.serviceType || "—")}</strong></div><div><span>Frecuencia de supervisión</span><strong>${esc(profile?.supervisionFrequency || "No configurada")}</strong></div><div><span>Reporte al médico</span><strong>${esc(profile?.physicianReportFrequency || "No configurado")}</strong></div><div><span>Rango para turnos</span><strong>${esc(profile?.shiftStartDate || "—")} → ${esc(profile?.shiftEndDate || "—")}</strong></div><div><span>Frecuencia / atención</span><strong>${esc([profile?.shiftFrequency, profile?.attentionType].filter(Boolean).join(" · ") || "No configurada")}</strong></div></div>`;
  } else if (activeTab === "treatments") {
    body = `${card("Órdenes", table(["Documento","Autor","Fecha","Estado"], documents.filter((document) => ["MEDICAL_ORDER","LAB_REQUEST"].includes(document.type)).map((document) => `<tr><td>${esc(document.title)}</td><td>${esc(document.authorName)}</td><td>${formatDate(document.createdAt,true)}</td><td>${badge(document.status)}</td></tr>`), {compact:true}))}${card("Tarjeta de medicamentos", table(["Tarjeta","Ítems","Creación","Estado"], cards.map((item) => `<tr><td>${esc(item.id)}</td><td>${item.items?.length || 0}</td><td>${formatDate(item.createdAt,true)}</td><td>${badge(item.documentStatus || item.status)}</td></tr>`), {compact:true}))}`;
  } else if (activeTab === "events") {
    const events = [...vitals.map((item) => ({date:item.recordedAt,type:"Signos vitales",author:item.authorName,status:"RECORDED"})), ...notes.map((item) => ({date:item.createdAt,type:"Nota de enfermería",author:item.authorName,status:item.status}))].sort((left,right)=>String(right.date).localeCompare(String(left.date)));
    body = card("Eventos clínicos", table(["Fecha","Tipo","Autor","Estado"], events.map((item) => `<tr><td>${formatDate(item.date,true)}</td><td>${esc(item.type)}</td><td>${esc(item.author)}</td><td>${badge(item.status)}</td></tr>`), {compact:true}));
  } else if (activeTab === "evidence") {
    body = `${card("Evidencia y documentos", table(["Documento","Tipo","Autor","Versión","Estado"], documents.map((document) => `<tr><td><button class="row-action" data-action="view-document" data-id="${esc(document.id)}">${esc(document.title)}</button></td><td>${esc(DOC_TYPE_LABELS[document.type] || document.type)}</td><td>${esc(document.authorName)}</td><td>v${document.version}</td><td>${badge(document.status)}</td></tr>`), {compact:true}))}<div class="info-callout">Los adjuntos permanecen deshabilitados hasta definir almacenamiento, tipos, límites, retención y acceso.</div>`;
  } else {
    const insurer = state.insurers.find((candidate) => candidate.id === record.insurerId);
    body = `<div class="details-grid"><div><span>Paciente</span><strong>${esc(patient?.fullName)}</strong></div><div><span>Cédula</span><strong>${esc(patient?.document)}</strong></div><div><span>Fecha de nacimiento</span><strong>${formatDate(patient?.birthDate)}</strong></div><div><span>Edad</span><strong>${patient?.birthDate ? `${ageFromBirthDate(patient.birthDate)} años` : "—"}</strong></div><div><span>Sexo</span><strong>${esc(patient?.sex || "—")}</strong></div><div><span>Período de hospitalización</span><strong>${formatDate(record.startDate)} → ${record.endDate ? formatDate(record.endDate) : "actual"}</strong></div><div><span>Estado</span><strong>${esc(profile?.clinicalStatus || "Pendiente")}</strong></div><div><span>Tipo de paciente</span><strong>${esc(profile?.patientType || "—")}</strong></div><div><span>Tipo de módulo</span><strong>Catálogo pendiente</strong></div><div><span>Adicional</span><strong>—</strong></div></div>${card("Seguros del paciente", table(["Imprimir","Seguro","Póliza","Certificado","Fecha efectiva","Titular","DUI/NIT"], insurer ? [`<tr><td>—</td><td>${esc(insurer.name)}</td><td>—</td><td>—</td><td>—</td><td>${esc(patient?.isPolicyHolder === true ? patient.fullName : "Titular no confirmado")}</td><td>${esc(patient?.isPolicyHolder === true ? patient.document : "—")}</td></tr>`] : [], {compact:true}))}`;
  }
  return `${pageHeader(`Reporte de salud del ${formatDate(range.start)} al ${formatDate(range.end)}`, "Vista longitudinal calculada desde registros autorizados; no modifica documentos firmados.", `${actionButton("Cambiar rango de fechas","change-health-report-range",{iconName:"clock",data:`data-case-id="${esc(caseId)}"`})}${actionButton("Imprimir","open-health-report-config",{kind:"primary",iconName:"print",data:`data-case-id="${esc(caseId)}"`})}${linkButton("Salir","#/clinica/reportes",{kind:"danger"})}`)}<div class="report-selector"><label>Reporte de salud del <select><option>${esc(caseId)} | ${formatDate(record.startDate)}</option></select></label></div><nav class="tabs report-tabs">${tabs.map(([key,label]) => `<button class="tab ${activeTab === key ? "active" : ""}" data-action="set-health-report-tab" data-tab="${key}">${esc(label)}</button>`).join("")}</nav>${body}`;
}

function renderHealthReports(state, store, ui, caseId = "") {
  if (caseId) return renderHealthReportDetail(state, store, ui, caseId);
  const query = String(ui.healthReportSearch || "").trim().toLocaleLowerCase("es");
  const entries = reportEntries(state).filter(({record,patient}) => !query || [record.id,patient?.document,patient?.fullName,patient?.company].some((value) => String(value || "").toLocaleLowerCase("es").includes(query)));
  const pageSize = Number(ui.healthReportPageSize || 10);
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const currentPage = Math.min(Math.max(1, Number(ui.healthReportPage || 1)), totalPages);
  const pageEntries = entries.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pages = Array.from({length: totalPages}, (_, index) => index + 1).map((page) => `<button data-action="health-report-page" data-page="${page}" class="${page === currentPage ? "active" : ""}">${page}</button>`).join("");
  const statusLabel = (status) => ({PENDING:"Pendiente",DRAFT:"Borrador",ACTIVE:"Activo",FINISHED:"Finalizado",VOIDED:"Anulado"})[status] || status;
  return `${pageHeader("Reporte de salud", "Expedientes longitudinales por hospitalización con selección de rango y configuración segura de impresión.")}<div class="filter-bar"><label class="page-size-label">Registros <select data-ui-filter="healthReportPageSize">${[10,25,50].map((size) => `<option value="${size}" ${pageSize === size ? "selected" : ""}>${size}</option>`).join("")}</select></label><label class="search-field">${icon("search")}<input data-input="health-report-search" value="${esc(ui.healthReportSearch || "")}" placeholder="Paciente, cédula u hospitalización"></label></div>${card("Reportes de salud", `${table(["","Cédula","Nombre","Empresa","Hospitalización","Período","Auditoría","Triage","Estatus"], pageEntries.map(({record,patient,profile}) => `<tr><td>${healthReportMenu(record.id)}</td><td>${esc(patient?.document)}</td><td>${esc(patient?.fullName)}</td><td>${esc(patient?.company || "—")}</td><td><a href="#/clinica/reportes/${esc(record.id)}">${esc(record.id)}</a></td><td>${formatDate(profile?.startDate || record.startDate)} al ${profile?.endDate ? formatDate(profile.endDate) : "actual"}</td><td>Sin auditoría</td><td>${badge(profile?.triage || "UNCLASSIFIED", profile?.triage || "No asignado")}</td><td>${badge(profile?.clinicalStatus || "PENDING", statusLabel(profile?.clinicalStatus || "PENDING"))}</td></tr>`))}<nav class="pagination" aria-label="Paginación de reportes"><button data-action="health-report-page" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>Anterior</button>${pages}<button data-action="health-report-page" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>Siguiente</button></nav>`)}`;
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

function renderMedicalOrders(state, store, ui) {
  const activeTab = ui.medicalOrderTab || "active";
  const query = String(ui.medicalOrderSearch || "").trim().toLocaleLowerCase("es");
  const profilesByCase = new Map((state.clinicalProfiles || []).map((profile) => [profile.caseId, profile]));
  const hasCorrection = (record) => {
    const documentIds = state.clinicalDocuments.filter((item) => item.caseId === record.id).map((item) => item.id);
    const cardIds = state.medicationCards.filter((item) => item.caseId === record.id).map((item) => item.id);
    return state.clinicalCorrections.some((item) => documentIds.includes(item.subjectId) || cardIds.includes(item.subjectId));
  };
  const hasUpdate = (record) => state.medicationCards.some((cardData) => cardData.caseId === record.id
    && (cardData.items || []).some((item) => item.lastAdministration));
  const tabCases = state.cases.filter((record) => {
    if (activeTab === "active") return record.status === "ACTIVE";
    if (activeTab === "inactive") return record.status !== "ACTIVE";
    if (activeTab === "changes") return hasCorrection(record);
    if (activeTab === "updates") return hasUpdate(record);
    return true;
  });
  const entries = tabCases.map((record) => ({record, patient: state.patients.find((item) => item.id === record.patientId)}))
    .filter(({record,patient}) => !query || [record.id,patient?.document,patient?.fullName].some((value) => String(value || "").toLocaleLowerCase("es").includes(query)));
  const pageSize = Number(ui.medicalOrderPageSize || 10);
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const currentPage = Math.min(Math.max(1, Number(ui.medicalOrderPage || 1)), totalPages);
  const pageEntries = entries.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pages = Array.from({length: totalPages}, (_, index) => index + 1).map((page) => `<button data-action="medical-order-page" data-page="${page}" class="${page === currentPage ? "active" : ""}">${page}</button>`).join("");
  const tabButton = (key, label, count) => `<button class="tab ${key === activeTab ? "active" : ""}" data-action="set-medical-order-tab" data-tab="${key}">${esc(label)} <span>${count}</span></button>`;
  const activeCount = state.cases.filter((record) => record.status === "ACTIVE").length;
  const inactiveCount = state.cases.length - activeCount;
  const changedCount = state.cases.filter(hasCorrection).length;
  const updatedCount = state.cases.filter(hasUpdate).length;
  const rows = pageEntries.map(({record,patient}) => {
    const profile = profilesByCase.get(record.id);
    return `<tr><td><button class="row-action" data-action="open-clinical-creation-choice" data-case-id="${esc(record.id)}" aria-label="Nuevo documento para ${esc(patient?.fullName || record.id)}">+</button><button class="row-action" data-action="view-patient-orders" data-case-id="${esc(record.id)}" aria-label="Ver órdenes de ${esc(patient?.fullName || record.id)}">${icon("view")}</button></td><td><strong>${esc(patient?.fullName || "—")}</strong></td><td>${esc(patient?.document || "—")}</td><td>${formatDate(patient?.birthDate)}</td><td>${badge(profile?.triage || "UNCLASSIFIED", profile?.triage || "No asignado")}</td><td><a href="#/hospitalizaciones/${esc(record.id)}">${esc(record.id)}</a></td><td>${badge(record.status)}</td></tr>`;
  });
  return `${pageHeader("Orden Médica", "Pacientes, órdenes, tratamientos y tarjetas con acceso por hospitalización.", actionButton("Nuevo","open-clinical-creation-choice",{kind:"primary",iconName:"plus"}))}
    <nav class="tabs" aria-label="Estados de Orden Médica">${tabButton("active","Activos",activeCount)}${tabButton("inactive","Inactivos",inactiveCount)}${tabButton("changes","Tratamientos con cambios",changedCount)}${tabButton("updates","Actualizaciones",updatedCount)}</nav>
    <div class="filter-bar"><label class="page-size-label">Registros <select data-ui-filter="medicalOrderPageSize">${[10,25,50].map((size) => `<option value="${size}" ${pageSize === size ? "selected" : ""}>${size}</option>`).join("")}</select></label><label class="search-field">${icon("search")}<input data-input="medical-order-search" value="${esc(ui.medicalOrderSearch || "")}" placeholder="Paciente, cédula u hospitalización"></label></div>
    ${card("Pacientes", `${table(["","Nombre","Cédula","Fecha Nac.","Triage","Hospitalización","Estatus"], rows)}<nav class="pagination" aria-label="Paginación de Orden Médica"><button data-action="medical-order-page" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>Anterior</button>${pages}<button data-action="medical-order-page" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>Siguiente</button></nav>`)} `;
}

function renderClinicalDocuments(state, store, ui, type) {
  const title=DOC_TYPE_LABELS[type] || "Documentos clínicos";
  if(type==="MEDICATION_CARD") return renderMedicationCards(state,store,ui);
  const docs=state.clinicalDocuments.filter((d)=>d.type===type);
  const rows = docs.map((doc) => {
    const status = store.clinicalRecordStatus("CLINICAL_DOCUMENT", doc.id);
    const correctionCount = store.clinicalHistory("CLINICAL_DOCUMENT", doc.id).length - 1;
    const actions = `<button data-action="view-document" data-id="${doc.id}" title="Ver">${icon("view")}</button>`
      + (doc.status === "DRAFT" ? `<button data-action="sign-document" data-id="${doc.id}" title="Firmar">${icon("check")}</button>` : "")
      + (doc.status === "SIGNED" ? `<button data-action="open-clinical-correction" data-subject-type="CLINICAL_DOCUMENT" data-id="${doc.id}" title="Corregir">${icon("edit")}</button><button data-action="open-clinical-void" data-subject-type="CLINICAL_DOCUMENT" data-id="${doc.id}" title="Anular">×</button>` : "");
    return `<tr><td><strong>${esc(doc.title)}</strong><small>${esc(doc.summary)}</small></td><td><a href="#/hospitalizaciones/${doc.caseId}">${esc(doc.caseId)}</a><small>${esc(patientName(state,doc.patientId))}</small></td><td>${esc(doc.authorName)}</td><td>${formatDate(doc.createdAt,true)}</td><td>${doc.signedAt?formatDate(doc.signedAt,true):"—"}</td><td>v${doc.version}<small>${correctionCount?`${correctionCount} corrección(es)`:""}</small></td><td>${badge(status)}</td><td><div class="row-actions">${actions}</div></td></tr>`;
  });
  return `
    ${pageHeader(title, clinicalDescription(type),
      `${actionButton(`Nuevo ${title.toLowerCase()}`,"open-clinical-document",{kind:"primary",iconName:"plus",data:`data-doc-type="${type}"`})}`)}
    ${card(title,table(["Documento","Caso / paciente","Autor","Creación","Firma","Versión","Estado",""],
      rows))}
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
      ${state.medicationCards.length ? state.medicationCards.map((cardData)=>`
        <article class="card medication-card">
          <header class="card-header"><div><h2>${esc(patientName(state,cardData.patientId))}</h2><p>${esc(cardData.caseId)} · ${formatDate(cardData.createdAt)} · v${cardData.version||1}</p><small>${esc(cardData.diagnosis || "Diagnóstico no documentado")} · ${esc(doctorName(state,cardData.treatingDoctorId))}</small></div>${badge(store.clinicalRecordStatus("MEDICATION_CARD",cardData.id)||cardData.documentStatus||"DRAFT")}</header>
          <div class="card-body">
            ${table(["Tratamiento","Dosis / vía","Frecuencia","Horarios","Inicio / fin","Crónico","Indicaciones"],
              (cardData.items || []).map((item)=>`<tr><td><strong>${esc(item.medication)}</strong></td><td>${esc(item.dose)} · ${esc(item.route)}</td><td>${esc(item.frequency)}</td><td>${(item.schedule || []).map((t)=>`<span class="time-chip">${esc(t)}</span>`).join("") || "—"}</td><td>${formatDate(item.startDate)} → ${formatDate(item.endDate)}</td><td>${item.chronic ? "Sí" : "No"}</td><td>${esc(item.indications || "—")}</td></tr>`),{compact:true})}
          </div>
          <footer class="card-footer">${actionButton("Tarjeta completa","print-medication-card",{iconName:"print",data:`data-id="${cardData.id}" data-variant="complete"`})}${actionButton("Tarjeta simple","print-medication-card",{iconName:"print",data:`data-id="${cardData.id}" data-variant="simple"`})}${actionButton("Conteo presencial","print-medication-card",{iconName:"print",data:`data-id="${cardData.id}" data-variant="count"`})}${cardData.documentStatus==="DRAFT"?actionButton("Firmar","sign-medication-card",{kind:"primary",data:`data-id="${cardData.id}"`}):""}${cardData.documentStatus==="SIGNED"?`${actionButton("Corregir","open-clinical-correction",{data:`data-subject-type="MEDICATION_CARD" data-id="${cardData.id}"`})}${actionButton("Anular","open-clinical-void",{data:`data-subject-type="MEDICATION_CARD" data-id="${cardData.id}"`})}`:""}</footer>
        </article>`).join("") : emptyState("Sin tarjetas de medicamentos", "Crea una tarjeta desde Orden Médica para una hospitalización autorizada.")}
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
    ${card("Notas de enfermería",state.nursingNotes.map((note)=>`<article class="note-card"><header><div><strong>${esc(note.authorName)}</strong><small>${esc(patientName(state,note.patientId))} · ${formatDate(note.createdAt,true)}</small></div>${badge(store.clinicalRecordStatus("NURSING_NOTE",note.id)||note.status)}</header><p>${esc(note.text)}</p><footer>${badge(note.shareStatus,note.shareStatus==="SHARED_WITH_DOCTOR"?"Compartida con médico":"Pendiente de compartir")}${note.status==="SIGNED"&&note.shareStatus!=="SHARED_WITH_DOCTOR"?actionButton("Compartir con médico","share-note",{kind:"ghost",iconName:"send",data:`data-id="${note.id}"`}):""}${note.status==="SIGNED"?`${actionButton("Corregir","open-clinical-correction",{data:`data-subject-type="NURSING_NOTE" data-id="${note.id}"`})}${actionButton("Anular","open-clinical-void",{data:`data-subject-type="NURSING_NOTE" data-id="${note.id}"`})}`:""}</footer></article>`).join(""))}
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
  const canWrite = roleCan(state.session.role, "settings:write");
  return `
    ${pageHeader("Configuración","Usuarios, roles, aseguradoras, plantillas, mensajería, seguridad y modo de datos.",
      `${actionButton("Guardar configuración","save-settings",{kind:"primary",iconName:"check"})}`)}
    <div class="settings-grid">
      ${card("Entorno",`<form id="settings-form" class="form-grid">
        <label>Modo de datos<select name="dataMode" ${canWrite?"":"disabled"}><option value="mock" ${store.config.dataMode==="mock"?"selected":""}>Demo local</option><option value="supabase" ${store.config.dataMode==="supabase"?"selected":""}>Supabase</option></select></label>
        <label>Modo de mensajería<select name="notificationsMode" ${canWrite?"":"disabled"}><option value="mock" ${store.config.notificationsMode==="mock"?"selected":""}>Simulado</option><option value="live" ${store.config.notificationsMode==="live"?"selected":""}>Proveedores reales</option></select></label>
        <label class="full">URL de Supabase<input name="supabaseUrl" value="${esc(store.config.supabaseUrl||"")}" placeholder="https://xxxx.supabase.co" ${canWrite?"":"readonly"}></label>
        <label class="full">Publishable key<input name="supabasePublishableKey" value="${esc(store.config.supabasePublishableKey||"")}" placeholder="sb_publishable_..." ${canWrite?"":"readonly"}></label>
      </form><div class="info-callout">${canWrite?"Las claves de servicio nunca se guardan en el navegador. Los proveedores reales se configuran como variables de entorno en Vercel.":"Vista de sólo lectura para este rol. No se permite modificar la configuración."}</div>`)}
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
    case "pacientes": {
      if (parts[1] === "nuevo") return renderPatientForm(state,store,ui);
      if (parts[2] === "editar") return renderPatientForm(state,store,ui,parts[1]);
      return parts[1] ? renderPatientDetail(state,store,ui,parts[1]) : renderPatients(state,store,ui);
    }
    case "hospitalizaciones": return parts[1]?renderCaseDetail(state,store,ui,parts[1]):renderCases(state,store,ui);
    case "cotizaciones": return parts[1]?renderQuoteDetail(state,store,ui,parts[1]):renderQuotes(state,store,ui);
    case "preautorizaciones": return renderInsurance(state,store,ui);
    case "cuentas-por-cobrar":
    case "pagos": return renderReceivables(state,store,ui);
    case "clinica": {
      const sub=parts[1];
      if(!sub) return renderClinicalHome(state,store,ui);
      if(sub==="hospitalizaciones") return renderClinicalHospitalizations(state,store,ui);
      if(sub==="reportes") return renderHealthReports(state,store,ui,parts[2]);
      if(sub==="ordenes") return renderMedicalOrders(state,store,ui);
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
  {section:"Operaciones",items:[
    {href:"#/dashboard",label:"Dashboard",icon:"dashboard",permission:"dashboard:read"},
    {href:"#/pacientes",label:"Pacientes",icon:"patients",permission:"patients:read"},
    {href:"#/agenda",label:"Agenda y turnos",icon:"agenda",permission:"agenda:read"}
  ]},
  {section:"Facturación",items:[
    {href:"#/hospitalizaciones",label:"Hospitalización",icon:"cases",permission:"cases:read"},
    {href:"#/cuentas-por-cobrar",label:"Cuentas por cobrar",icon:"money",permission:"payments:read"},
    {href:"#/preautorizaciones",label:"Preautorizaciones & Reclamos",icon:"insurance",permission:"insurance:read"},
    {href:"#/cotizaciones",label:"Cotizaciones",icon:"quotes",permission:"quotes:read"},
    {href:"#/cuentas-por-pagar",label:"Cuentas por pagar",icon:"money",permission:"statements:read"},
    {href:"#/compras",label:"Compras",icon:"purchases",permission:"purchases:read"}
  ]},
  {section:"Clínica",items:[
    {href:"#/clinica/hospitalizaciones",label:"Hospitalización clínica",icon:"clinical",permission:"clinical:read"},
    {href:"#/clinica/reportes",label:"Reporte de salud",icon:"file",permission:"clinical:read"},
    {href:"#/clinica/ordenes",label:"Órdenes médicas",icon:"file",permission:"clinical:read"},
    {href:"#/clinica/medicamentos",label:"Tarjeta de medicamentos",icon:"clinical",permission:"clinical:read"},
    {href:"#/clinica/planes-de-cuidado",label:"Planes de cuidado",icon:"file",permission:"clinical:read"},
    {href:"#/clinica/evoluciones",label:"Evoluciones y notas",icon:"clinical",permission:"clinical:read"}
  ]},
  {section:"Inventario",items:[
    {href:"#/inventario",label:"Existencias",icon:"inventory",permission:"inventory:read"},
    {href:"#/inventario/movimientos",label:"Movimientos",icon:"inventory",permission:"inventory:read"},
    {href:"#/inventario/comprometidos",label:"Comprometidos y acuses",icon:"inventory",permission:"inventory:read"},
    {href:"#/inventario/cierres",label:"Cierres",icon:"inventory",permission:"inventory:read"},
    {href:"#/inventario/bodegas",label:"Bodegas",icon:"inventory",permission:"inventory:read"},
    {href:"#/inventario/kits",label:"Kits",icon:"inventory",permission:"inventory:read"}
  ]},
  {section:"RRHH",items:[
    {href:"#/medicos",label:"Médicos y recursos",icon:"doctors",permission:"doctors:read"},
    {href:"#/estados-de-cuenta",label:"Estados médicos",icon:"doctors",permission:"statements:read"}
  ]},
  {section:"Items y Maestros",items:[
    {href:"#/catalogos",label:"Catálogos y tarifas",icon:"catalogs",permission:"catalogs:read"},
    {href:"#/catalogos/descuentos",label:"Descuentos",icon:"money",permission:"catalogs:read"},
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
    const containsActive = visible.some((item)=>currentRoute.startsWith(item.href.slice(2)));
    return `<details class="nav-section" ${containsActive ? "open" : ""}><summary>${esc(section.section)}<span aria-hidden="true">⌄</span></summary>${visible.map(item=>{
      const active=currentRoute.startsWith(item.href.slice(2));
      return `<a href="${item.href}" class="${active?"active":""}" ${active?'aria-current="page"':""}>${icon(item.icon)}<span>${esc(item.label)}</span></a>`;
    }).join("")}</details>`;
  }).join("");
}

export function renderLogin(state, config = {}, ui = {}){
  const demoMode = config.dataMode !== "supabase";
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
          <div><p class="eyebrow">${demoMode ? "Modo demostración" : "Acceso con Supabase Auth"}</p><h2>Iniciar sesión</h2><p>${demoMode ? "Datos sintéticos. Todos los perfiles demo exigen la contraseña exacta Demo2026!." : "Usa las credenciales asignadas por la organización."}</p></div>
          <label>Usuario o correo<input type="email" name="email" autocomplete="username" placeholder="usuario@organizacion" required autofocus></label>
          <label>Clave<div class="password-field"><input type="password" name="password" autocomplete="current-password" required><button type="button" data-action="toggle-password" aria-label="Mostrar u ocultar clave">◉</button></div></label>
          <button class="btn btn-primary btn-block" type="submit">Iniciar sesión</button>
          ${ui.pwaInstallAvailable ? `<button class="btn btn-secondary btn-block" type="button" data-action="install-pwa">${icon("upload")} Instalar en dispositivo</button>` : ""}
          <button class="text-button" type="button" data-action="recover-password">¿Olvidaste tu contraseña?</button>
          ${demoMode ? `<div class="demo-users"><p>Perfiles sintéticos — sólo completan el formulario</p>${state.users.map(u=>`<button type="button" data-action="quick-login" data-email="${esc(u.email)}"><span class="avatar">${initials(u.name)}</span><div><strong>${esc(u.name)}</strong><small>${esc(u.role)}</small></div></button>`).join("")}</div>` : ""}
          <small class="privacy-note">${demoMode ? "DEMO LOCAL · Ninguna autenticación ni entrega es real." : "La sesión se valida exclusivamente mediante Supabase Auth."}</small>
        </form>
      </section>
    </div>`;
}

export function renderTopbar(state,store,route,ui={}){
  const user=store.currentUser();
  return `
    <button class="icon-button" data-action="toggle-sidebar" aria-label="Expandir o contraer menú" aria-expanded="${Boolean(ui.sidebarOpen)}">☰</button>
    <label class="global-search">${icon("search")}<input data-global-search placeholder="Buscar paciente, caso, cotización o comando…"><kbd>Ctrl K</kbd></label>
    <div class="topbar-actions">
      <button class="icon-button notification-button" data-action="toggle-notifications" title="Notificaciones">${icon("alert")}<span>${state.notifications.filter(n=>["QUEUED","FAILED"].includes(n.status)).length}</span></button>
      <button class="user-menu" data-action="toggle-user-menu"><span class="avatar">${initials(user?.name)}</span><div><strong>${esc(user?.name)}</strong><small>${esc(state.session.role)}</small></div><span>⌄</span></button>
    </div>`;
}

export function renderUserMenu(state,store){
  const user=store.currentUser();
  return `<div class="popover user-popover"><header><span class="avatar avatar-lg">${initials(user?.name)}</span><div><strong>${esc(user?.name)}</strong><small>${esc(user?.email)}</small></div></header><div class="organization-context"><span>${icon("cases")}</span><div><small>Organización activa</small><strong>${esc(state.organization?.name || "Sin organización")}</strong></div></div><button data-action="open-my-user">${icon("doctors")} Mi usuario</button><a href="#/configuracion">${icon("settings")} Configuración</a><button data-action="reset-demo">${icon("reset")} Restaurar datos demo</button><button data-action="logout">${icon("close")} Cerrar sesión</button></div>`;
}

export function renderNotificationPanel(state){
  return `<div class="popover notifications-popover"><header><div><h3>Notificaciones</h3><p>${state.notifications.length} registros</p></div><a href="#/auditoria">Ver actividad</a></header><div class="notification-list">${state.notifications.slice(0,8).map(n=>`<article><span class="notification-channel">${esc(n.channel[0])}</span><div><strong>${esc(n.subject)}</strong><p>${esc(n.safePreview)}</p><small>${formatDate(n.date,true)} · ${esc(n.target)}</small></div>${badge(n.status)}</article>`).join("")}</div></div>`;
}
