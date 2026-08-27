import {
  calculateQuote,
  uid,
  roundMoney,
  validatePayment,
  canTransitionQuote,
  quoteBalance,
  roleCan,
  statementBalance,
  safeStorage
} from "./domain.js";
import { seedData } from "./mock-data.js";
import { createSupabaseAdapter } from "./supabase-adapter.js";

const STORAGE_KEY = "analiza-en-casa-production-qa-v1";
export const DEMO_PASSWORD = "Demo2026!";

function clone(value) {
  return structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

export function normalizeState(rawState = {}) {
  const base = clone(seedData);
  const raw = rawState && typeof rawState === "object" ? clone(rawState) : {};
  const normalized = {
    ...base,
    ...raw,
    meta: { ...base.meta, ...(raw.meta || {}) },
    organization: { ...base.organization, ...(raw.organization || {}) },
    session: { ...base.session, ...(raw.session || {}) }
  };
  for (const [key, value] of Object.entries(base)) {
    if (Array.isArray(value)) normalized[key] = Array.isArray(raw[key]) ? raw[key] : clone(value);
  }
  normalized.session.authenticated = Boolean(normalized.session.authenticated && normalized.session.userId && normalized.session.role);
  normalized.clinicalCorrections ||= [];
  normalized.notificationAttempts ||= [];
  normalized.administrativeExecutionProfiles ||= [];
  normalized.clinicalProfiles ||= [];
  return normalized;
}

function loadLocalState() {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeState(seedData);
    const parsed = JSON.parse(raw);
    if (parsed?.meta?.schemaVersion !== seedData.meta.schemaVersion) return normalizeState(seedData);
    return normalizeState(parsed);
  } catch {
    return normalizeState(seedData);
  }
}

export async function createAppStore(config) {
  let state = loadLocalState();
  state.clinicalCorrections ||= [];
  state.patients = state.patients.map((patient) => ({
    ...patient,
    organizationId: patient.organizationId || state.organization?.id,
    fullName: patient.fullName || `${patient.firstName || ""} ${patient.lastName || ""}`.trim(),
    addressComments: patient.addressComments || ""
  }));
  state.cases = state.cases.map((record) => ({
    ...record,
    organizationId: record.organizationId || state.organization?.id
  }));
  state.quotes = state.quotes.map((quote) => ({
    ...quote,
    organizationId: quote.organizationId || state.organization?.id,
    quoteId: quote.quoteId || quote.id,
    originalQuoteId: quote.originalQuoteId || quote.quoteId || quote.id,
    immutable: Boolean(quote.immutable || quote.sentAt),
    revisionReason: quote.revisionReason || ""
  }));
  state.medicationCards = state.medicationCards.map((card) => ({
    ...card,
    organizationId: card.organizationId || state.organization?.id,
    documentStatus: card.documentStatus || "DRAFT",
    version: card.version || 1,
    signatureMetadata: card.signatureMetadata || null
  }));
  state.nursingNotes = state.nursingNotes.map((note) => ({
    ...note,
    organizationId: note.organizationId || state.organization?.id,
    signedAt: note.signedAt || (note.status === "SIGNED" ? note.createdAt : null),
    signatureMetadata: note.signatureMetadata || null
  }));
  for (const collection of ["payments", "inventoryItems", "inventoryLots", "inventoryMovements", "inventoryReservations", "inventoryClosures", "warehouses", "kits", "notifications"]) {
    state[collection] ||= [];
    state[collection] = state[collection].map((record) => ({
      ...record,
      organizationId: record.organizationId || state.organization?.id
    }));
  }
  state.notificationAttempts ||= [];
  let adapter = await createSupabaseAdapter(config);
  const listeners = new Set();

  if (adapter.mode === "supabase") {
    state.session = { authenticated: false, userId: null, role: null };
    state.meta.dataSource = "SUPABASE_AUTH_REQUIRED";
    state.meta.remoteFallback = false;
  }

  function save() {
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    for (const listener of listeners) listener(state);
  }

  function setState(mutator) {
    mutator(state);
    save();
  }

  function currentUser() {
    return state.users.find((user) => user.id === state.session.userId) || null;
  }

  function audit(action, entity, summary, metadata = {}) {
    const user = currentUser();
    state.auditLogs.unshift({
      id: uid("AUD"),
      date: nowIso(),
      user: user?.name || "Sistema",
      role: state.session.role || user?.role || "SYSTEM",
      action,
      entity,
      summary,
      ip: "local/demo",
      metadata
    });
    state.auditLogs = state.auditLogs.slice(0, 500);
  }

  async function safeSync(action, payload) {
    try {
      const result = await adapter.sync(action, payload);
      if (result?.error) throw result.error;
      return result;
    } catch (error) {
      setState((draft) => {
        draft.meta.remoteError = error.message;
        audit("REMOTE_SYNC_FAILED", action, `No se pudo sincronizar ${action}: ${error.message}`);
      });
      return { ok: false, error };
    }
  }

  async function requiredSync(action, payload) {
    try {
      return await adapter.sync(action, payload);
    } catch (error) {
      setState((draft) => {
        draft.meta.remoteError = error.message;
        audit("REMOTE_SYNC_FAILED", action, `No se pudo confirmar ${action}: ${error.message}`);
      });
      throw error;
    }
  }

  function requirePermission(permission) {
    const allowed = roleCan(state.session.role, permission);
    if (!allowed) throw new Error(`El rol ${state.session.role} no tiene permiso: ${permission}`);
  }

  function patientById(id) {
    return state.patients.find((patient) => patient.id === id);
  }

  function caseById(id) {
    return state.cases.find((record) => record.id === id);
  }

  function quoteById(id) {
    return state.quotes.find((quote) => quote.id === id);
  }

  function assertCurrentOrganization(record, label = "Registro") {
    const recordOrganizationId = record?.organizationId || state.organization?.id;
    if (!record || recordOrganizationId !== state.organization?.id) {
      throw new Error(`${label} no disponible.`);
    }
  }

  function maskDestination(destination = "") {
    const value = String(destination).trim();
    if (value.includes("@")) {
      const [local, domain] = value.split("@", 2);
      return `${local.slice(0, 2)}•••@${domain}`;
    }
    const digits = value.replace(/\D/g, "");
    return digits ? `•••• ${digits.slice(-4)}` : "••••";
  }

  const notificationTemplates = {
    QUOTE_READY: { recipientType: "PATIENT", permission: "quotes:write", preview: "Su cotización está disponible en el portal seguro." },
    QUOTE_STATUS: { recipientType: "PATIENT", permission: "insurance:write", preview: "Su solicitud tiene una actualización. Consulte el portal seguro." },
    PAYMENT_RECEIVED: { recipientType: "PATIENT", permission: "payments:write", preview: "Hay una actualización administrativa disponible en el portal seguro." },
    DOCTOR_STATEMENT: { recipientType: "DOCTOR", permission: "statements:write", preview: "Su estado de cuenta está disponible en el portal profesional seguro." },
    NURSING_NOTE_AVAILABLE: { recipientType: "DOCTOR", permission: "clinical:write", preview: "Hay un documento disponible en el portal profesional seguro." }
  };

  function registeredNotificationRecipient(recipientType, recipientId, channel) {
    const source = recipientType === "PATIENT"
      ? patientById(recipientId)
      : state.doctors.find((candidate) => candidate.id === recipientId);
    if (!source) throw new Error("Destinatario autorizado no encontrado.");
    assertCurrentOrganization(source, "Destinatario");
    const destination = channel === "EMAIL" ? source.email : source.phone;
    if (!destination) throw new Error("El destinatario autorizado no tiene un canal registrado.");
    return { id: source.id, masked: maskDestination(destination) };
  }

  function queueNotification(input) {
    const templateCode = String(input.templateCode || "").toUpperCase();
    const channel = String(input.channel || "").toUpperCase();
    const template = notificationTemplates[templateCode];
    if (!template || !["WHATSAPP", "SMS", "EMAIL"].includes(channel)) throw new Error("Canal o plantilla no permitida.");
    requirePermission(template.permission);
    const recipientType = template.recipientType;
    const recipient = registeredNotificationRecipient(recipientType, input.recipientId, channel);
    const relatedEntityType = String(input.relatedEntityType || "").toUpperCase();
    const relatedEntityId = String(input.relatedEntityId || "").trim();
    if (!relatedEntityType || !relatedEntityId) throw new Error("La notificación requiere una entidad autorizada.");
    const relatedQuote = state.quotes.find((candidate) => candidate.id === relatedEntityId);
    const relatedStatement = state.doctorStatements.find((candidate) => candidate.id === relatedEntityId);
    const relatedNote = state.nursingNotes.find((candidate) => candidate.id === relatedEntityId);
    const relatedCase = relatedNote && caseById(relatedNote.caseId);
    const validRelationship = (
      (["QUOTE_READY", "QUOTE_STATUS"].includes(templateCode)
        && ["QUOTE", "QUOTE_VERSION"].includes(relatedEntityType) && relatedQuote?.patientId === recipient.id)
      || (templateCode === "PAYMENT_RECEIVED" && relatedEntityType === "QUOTE" && relatedQuote?.patientId === recipient.id)
      || (templateCode === "DOCTOR_STATEMENT" && relatedEntityType === "DOCTOR_STATEMENT" && relatedStatement?.doctorId === recipient.id)
      || (templateCode === "NURSING_NOTE_AVAILABLE" && relatedEntityType === "NURSING_NOTE" && relatedCase?.contractingDoctorId === recipient.id)
    );
    if (!validRelationship) throw new Error("El destinatario no está autorizado para la entidad relacionada.");
    const idempotencyKey = String(input.idempotencyKey || `NOT:${templateCode}:${channel}:${recipient.id}:${relatedEntityType}:${relatedEntityId}`).trim();
    if (!idempotencyKey || idempotencyKey.length > 160) throw new Error("Clave de idempotencia inválida.");
    const existing = state.notifications.find((candidate) => candidate.idempotencyKey === idempotencyKey && candidate.organizationId === state.organization?.id);
    if (existing) return existing;

    const notification = {
      id: uid("NOT"),
      organizationId: state.organization?.id,
      date: nowIso(),
      channel,
      provider: config.notificationsMode === "mock" ? "SIMULATED" : "SERVER_QUEUE",
      templateCode,
      recipientType,
      recipientId: recipient.id,
      relatedEntityType,
      relatedEntityId,
      idempotencyKey,
      target: recipient.masked,
      subject: templateCode.replaceAll("_", " "),
      status: config.notificationsMode === "mock" ? "SIMULATED" : "PENDING_SERVER",
      safePreview: template.preview,
      retryCount: 0,
      createdAt: nowIso()
    };
    setState((draft) => {
      draft.notifications.unshift(notification);
      draft.notificationAttempts.unshift({
        id: uid("NOTATT"), notificationId: notification.id, provider: notification.provider,
        state: notification.status, createdAt: notification.createdAt
      });
      audit("QUEUE_NOTIFICATION", notification.id, `Notificación ${templateCode} encolada por ${channel}.`, {
        templateCode, channel, relatedEntityType, relatedEntityId, idempotencyKey
      });
    });
    if (!input.remoteConfirmed) safeSync("QUEUE_NOTIFICATION", { notification });
    return notification;
  }

  function quoteIsImmutable(quote) {
    return Boolean(quote?.immutable || quote?.sentAt);
  }

  function quoteRootId(quote) {
    return quote.quoteId || quote.originalQuoteId || quote.id;
  }

  function quoteVersions(quote) {
    const rootId = quoteRootId(quote);
    return state.quotes
      .filter((candidate) => quoteRootId(candidate) === rootId)
      .sort((left, right) => Number(left.version || 0) - Number(right.version || 0));
  }

  function clinicalRecord(subjectType, id) {
    if (subjectType === "CLINICAL_DOCUMENT") {
      return state.clinicalDocuments.find((candidate) => candidate.id === id);
    }
    if (subjectType === "NURSING_NOTE") {
      return state.nursingNotes.find((candidate) => candidate.id === id);
    }
    if (subjectType === "MEDICATION_CARD") {
      return state.medicationCards.find((candidate) => candidate.id === id);
    }
    return null;
  }

  function clinicalRecordStatus(subjectType, id) {
    const record = clinicalRecord(subjectType, id);
    if (!record) return null;
    const status = subjectType === "MEDICATION_CARD" ? record.documentStatus : record.status;
    if (status === "VOIDED") return status;
    return state.clinicalCorrections.some((correction) => correction.subjectType === subjectType && correction.subjectId === id)
      ? "CORRECTED"
      : status;
  }

  function clinicalHistory(subjectType, id) {
    const original = clinicalRecord(subjectType, id);
    if (!original) return [];
    const corrections = state.clinicalCorrections
      .filter((correction) => correction.subjectType === subjectType && correction.subjectId === id)
      .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));
    return [original, ...corrections];
  }

  function establishSession(user, role = null) {
    setState((draft) => {
      draft.session = {
        authenticated: true,
        userId: user.id,
        role: role || user.role,
        loggedAt: nowIso()
      };
      audit("LOGIN", user.id, `Inicio de sesión como ${role || user.role}.`);
    });
  }

  async function authenticate(email, password) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const suppliedPassword = String(password || "");
    if (!normalizedEmail || !suppliedPassword) throw new Error("Ingresa usuario y contraseña.");
    if (adapter.mode === "mock") {
      const user = state.users.find((candidate) => candidate.email.toLowerCase() === normalizedEmail && candidate.status === "ACTIVE");
      if (!user || suppliedPassword !== DEMO_PASSWORD) throw new Error("No fue posible iniciar sesión con esas credenciales.");
      establishSession(user);
      return { userId: user.id, role: user.role, mode: "mock" };
    }

    let authUser;
    try {
      authUser = await adapter.signInWithPassword(normalizedEmail, suppliedPassword);
      const profile = await adapter.loadCurrentProfile(authUser.id);
      const user = {
        id: authUser.id,
        name: profile.full_name,
        email: authUser.email,
        role: profile.role,
        status: profile.status,
        organizationId: profile.organization_id
      };
      const remote = await adapter.bootstrap();
      const clearedCollections = Object.fromEntries(Object.entries(seedData).filter(([, value]) => Array.isArray(value)).map(([key]) => [key, []]));
      state = normalizeState({
        ...state,
        ...clearedCollections,
        ...remote,
        users: [user],
        organization: profile.organizations || state.organization,
        meta: { ...state.meta, dataSource: "SUPABASE", remoteBootstrappedAt: nowIso(), remoteFallback: false }
      });
      save();
      establishSession(user, profile.role);
      return { userId: user.id, role: profile.role, mode: "supabase" };
    } catch (error) {
      if (authUser) await adapter.signOut().catch(() => {});
      throw new Error("No fue posible iniciar sesión con esas credenciales.");
    }
  }

  async function recoverPassword(email) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) throw new Error("Ingresa el correo de acceso.");
    if (adapter.mode === "supabase") await adapter.resetPasswordForEmail(normalizedEmail);
    return { ok: true, simulated: adapter.mode === "mock" };
  }

  async function logout() {
    if (adapter.mode === "supabase") await adapter.signOut();
    setState((draft) => {
      audit("LOGOUT", draft.session.userId, "Cierre de sesión.");
      draft.session = { authenticated: false, userId: null, role: null, loggedAt: null };
    });
  }

  function reset() {
    state = normalizeState(seedData);
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    for (const listener of listeners) listener(state);
  }

  function createPatient(input) {
    requirePermission("patients:write");
    const fullName = String(input.fullName || `${input.firstName || ""} ${input.lastName || ""}`).trim();
    const document = String(input.document || "").trim();
    if (!document || !fullName) throw new Error("Documento y nombre completo son obligatorios.");
    const email = String(input.email || "").trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Correo inválido.");
    const patient = {
      id: uid("PAT"),
      documentType: input.documentType || "DUI",
      document,
      firstName: String(input.firstName || "").trim(),
      lastName: String(input.lastName || "").trim(),
      fullName,
      birthDate: input.birthDate || "",
      sex: input.sex || "",
      bloodType: input.bloodType || "",
      nationality: input.nationality || "",
      company: input.company || "",
      phone: input.phone || "",
      homePhone: input.homePhone || "",
      email,
      retired: Boolean(input.retired),
      civilStatus: input.civilStatus || "",
      occupation: input.occupation || "",
      address: input.address || "",
      addressComments: input.addressComments || "",
      locationLink: input.locationLink || "",
      geo: input.geo || "",
      triage: input.triage || "NO_ASIGNADO",
      status: "ACTIVE",
      insurerId: input.insurerId || null,
      planId: input.planId || null,
      policy: input.policy || "",
      policyCertificate: input.policyCertificate || "",
      policyEffectiveDate: input.policyEffectiveDate || "",
      policyValidUntil: input.policyValidUntil || "",
      isPolicyHolder: input.isPolicyHolder ?? null,
      insuredDocument: input.insuredDocument || "",
      insuredName: input.insuredName || "",
      insuredBirthDate: input.insuredBirthDate || "",
      contactName: input.contactName || "",
      contactPhone: input.contactPhone || "",
      contactEmail: input.contactEmail || "",
      contactRelationship: input.contactRelationship || "",
      contactRole: input.contactRole || "",
      contactCountry: input.contactCountry || "",
      notifyWhatsApp: Boolean(input.notifyWhatsApp),
      notifySms: Boolean(input.notifySms),
      notifyEmail: Boolean(input.notifyEmail),
      organizationId: state.organization?.id
    };

    const duplicate = state.patients.some((existing) =>
      existing.organizationId === patient.organizationId
      && existing.documentType === patient.documentType
      && existing.document.replace(/\s/g, "").toUpperCase() === patient.document.replace(/\s/g, "").toUpperCase()
    );
    if (duplicate) throw new Error("Ya existe un paciente con ese documento.");

    setState((draft) => {
      draft.patients.unshift(patient);
      audit("CREATE_PATIENT", patient.id, `Paciente ficticio creado: ${patient.fullName}.`);
    });
    safeSync("CREATE_PATIENT", { patient });
    return patient;
  }

  function importPatients(inputs) {
    requirePermission("patients:write");
    if (adapter.mode !== "mock") throw new Error("La carga productiva requiere el importador transaccional del servidor.");
    if (!Array.isArray(inputs) || !inputs.length) throw new Error("El archivo no contiene pacientes.");
    if (inputs.length > 500) throw new Error("La carga demo admite hasta 500 filas por archivo.");
    const existingKeys = new Set(state.patients.map((patient) => `${patient.documentType}:${String(patient.document).replace(/\s/g, "").toUpperCase()}`));
    const batchKeys = new Set();
    const imported = inputs.map((input, index) => {
      const row = index + 2;
      const documentType = String(input.documentType || "DUI").trim();
      const document = String(input.document || "").trim();
      const firstName = String(input.firstName || "").trim();
      const lastName = String(input.lastName || "").trim();
      const email = String(input.email || "").trim().toLowerCase();
      if (!document || !firstName || !lastName) throw new Error(`Fila ${row}: documento, firstName y lastName son obligatorios.`);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Fila ${row}: correo inválido.`);
      if (input.birthDate && Number.isNaN(Date.parse(input.birthDate))) throw new Error(`Fila ${row}: fecha de nacimiento inválida.`);
      const key = `${documentType}:${document.replace(/\s/g, "").toUpperCase()}`;
      if (existingKeys.has(key) || batchKeys.has(key)) throw new Error(`Fila ${row}: documento duplicado en el alcance autorizado.`);
      batchKeys.add(key);
      return {
        id: uid("PAT"), documentType, document, firstName, lastName, fullName: `${firstName} ${lastName}`,
        birthDate: input.birthDate || "", sex: input.sex || "", bloodType: input.bloodType || "",
        nationality: input.nationality || "Salvadoreña", company: input.company || "", phone: input.phone || "",
        email, address: input.address || "", geo: "", triage: input.triage || "NO_ASIGNADO",
        status: String(input.status || "ACTIVE").toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        insurerId: null, planId: null, policy: "", policyValidUntil: "", contactName: "", contactPhone: "",
        notifyWhatsApp: false, notifySms: false, notifyEmail: false, organizationId: state.organization?.id
      };
    });
    setState((draft) => {
      draft.patients.unshift(...imported);
      audit("IMPORT_PATIENTS", `BATCH-${nowIso()}`, `${imported.length} pacientes sintéticos importados.`, { count: imported.length });
    });
    return imported;
  }

  function updatePatient(id, patch) {
    requirePermission("patients:write");
    let updated;
    setState((draft) => {
      const patient = draft.patients.find((record) => record.id === id);
      if (!patient) throw new Error("Paciente no encontrado.");
      assertCurrentOrganization(patient, "Paciente");
      const documentType = patch.documentType || patient.documentType;
      const document = String(patch.document ?? patient.document).replace(/\s/g, "").toUpperCase();
      if (draft.patients.some((record) => record.id !== id && record.organizationId === patient.organizationId && record.documentType === documentType && String(record.document).replace(/\s/g, "").toUpperCase() === document)) {
        throw new Error("No fue posible guardar el paciente con ese documento.");
      }
      if (patch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(patch.email).trim())) throw new Error("Correo inválido.");
      Object.assign(patient, patch);
      if (patch.firstName || patch.lastName) patient.fullName = `${patient.firstName} ${patient.lastName}`.trim();
      updated = clone(patient);
      audit("UPDATE_PATIENT", id, `Datos administrativos actualizados para ${patient.fullName}.`);
    });
    return updated;
  }

  function createCase(input) {
    requirePermission("cases:write");
    const patient = patientById(input.patientId);
    assertCurrentOrganization(patient, "Paciente");
    const sequence = state.cases.length + 196;
    const record = {
      id: `HOS-${new Date().getFullYear()}-${String(sequence).padStart(4, "0")}`,
      organizationId: state.organization?.id,
      patientId: input.patientId,
      accountType: input.accountType || "PRIVADO",
      insurerId: input.insurerId || null,
      manager: input.manager || currentUser().name,
      startDate: input.startDate || new Date().toISOString().slice(0, 10),
      endDate: "",
      status: "ACTIVE",
      priority: input.priority || "MEDIA",
      diagnosisSummary: input.diagnosisSummary || "",
      contractingDoctorId: input.contractingDoctorId || null,
      nextAction: input.nextAction || "Crear cotización inicial.",
      supervisors: [],
      devices: [],
      createdAt: nowIso()
    };
    setState((draft) => {
      draft.cases.unshift(record);
      audit("CREATE_CASE", record.id, `Hospitalización creada para ${patientById(record.patientId)?.fullName}.`);
    });
    safeSync("CREATE_CASE", { case: record });
    return record;
  }

  function updateCase(id, patch) {
    requirePermission("cases:write");
    setState((draft) => {
      const record = draft.cases.find((candidate) => candidate.id === id);
      if (!record) throw new Error("Hospitalización no encontrada.");
      assertCurrentOrganization(record, "Hospitalización");
      Object.assign(record, patch);
      audit("UPDATE_CASE", id, `Hospitalización actualizada: ${Object.keys(patch).join(", ")}.`);
    });
  }

  function validateQuoteGeneral(input, fallback = {}) {
    const invoiceDate = String(input.invoiceDate ?? fallback.invoiceDate ?? "").trim();
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(invoiceDate) ? new Date(`${invoiceDate}T00:00:00.000Z`) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== invoiceDate) {
      throw new Error("Indique una fecha de cotización válida.");
    }
    const discountGroupId = String(input.discountGroupId ?? fallback.discountGroupId ?? "").trim();
    const allowedDiscount = discountGroupId === "REGULAR" || state.discountRules.some((rule) => rule.id === discountGroupId && rule.active);
    if (!allowedDiscount) throw new Error("Seleccione un grupo de descuento autorizado.");
    const referredBy = String(input.referredBy ?? fallback.referredBy ?? "").trim();
    if (!referredBy) throw new Error("Indique al menos una referencia autorizada.");
    const comments = String(input.comments ?? fallback.comments ?? "").trim();
    if (!comments) throw new Error("Los comentarios administrativos son obligatorios.");
    return { invoiceDate, discountGroupId, referredBy, comments, giftcard: String(input.giftcard ?? fallback.giftcard ?? "").trim() };
  }

  function validateQuoteItems(inputItems) {
    if (!Array.isArray(inputItems) || !inputItems.length) throw new Error("La cotización requiere al menos un concepto.");
    const allowedCategories = new Set(["SERVICES", "STUDIES", "MEDICATIONS", "SUPPLIES", "EQUIPMENT", "FEES", "EXTRAS"]);
    return inputItems.map((item) => {
      if (!allowedCategories.has(item.category)) throw new Error("La categoría del concepto no está autorizada.");
      if (!String(item.name || "").trim()) throw new Error("El concepto requiere una descripción.");
      if (!Number.isFinite(Number(item.quantity)) || !(Number(item.quantity) > 0)) throw new Error("La cantidad del concepto debe ser mayor que cero.");
      if (!Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) < 0) throw new Error("Hay conceptos sin precio válido.");
      const lineDiscount = Number(item.discountAmount ?? 0);
      if (!Number.isFinite(lineDiscount) || lineDiscount < 0) throw new Error("El descuento de línea debe ser un importe válido no negativo.");
      if (lineDiscount > Number(item.quantity) * Number(item.unitPrice)) throw new Error("El descuento de línea no puede superar el importe bruto.");
      const catalogItem = state.catalogItems.find((candidate) => candidate.id === item.catalogItemId && candidate.active !== false);
      if (!catalogItem || catalogItem.category !== item.category) throw new Error("El concepto no pertenece al catálogo autorizado.");
      if (String(item.name).trim() !== String(catalogItem.name).trim()) throw new Error("La descripción debe coincidir con el catálogo autorizado.");
      if (Number(item.unitPrice) !== Number(catalogItem.price)) throw new Error("El precio debe coincidir con el catálogo autorizado.");
      return {
        ...item,
        catalogItemId: catalogItem.id,
        category: catalogItem.category,
        name: catalogItem.name,
        quantity: Number(item.quantity),
        unitPrice: Number(catalogItem.price),
        discountAmount: lineDiscount
      };
    });
  }

  function resolveQuoteDiscount(discountGroupId, reason = "") {
    if (discountGroupId === "REGULAR") {
      return { type: "CATEGORY_PERCENTAGES", categories: {}, value: 0, reason: "", ruleId: "REGULAR" };
    }
    const rule = state.discountRules.find((candidate) => candidate.id === discountGroupId && candidate.active);
    if (!rule) throw new Error("Seleccione un grupo de descuento autorizado.");
    if (rule.requiresApproval) throw new Error("El grupo de descuento requiere un flujo de aprobación todavía no configurado.");
    const normalizedReason = String(reason || "").trim();
    if (rule.requiresReason && !normalizedReason) throw new Error("Indique el motivo del descuento.");
    return {
      type: "CATEGORY_PERCENTAGES",
      categories: clone(rule.categories || {}),
      value: 0,
      reason: normalizedReason,
      ruleId: rule.id
    };
  }

  function createQuote(input) {
    requirePermission("quotes:write");
    const recordCase = caseById(input.caseId);
    if (!recordCase) throw new Error("Seleccione una hospitalización válida.");
    assertCurrentOrganization(recordCase, "Hospitalización");
    const patient = patientById(recordCase.patientId);
    if (!patient) throw new Error("Paciente no encontrado.");
    const authorizedItems = validateQuoteItems(input.items);
    const general = validateQuoteGeneral(input);
    const authorizedDiscount = resolveQuoteDiscount(general.discountGroupId, input.discount?.reason);

    const calculation = calculateQuote(
      authorizedItems,
      authorizedDiscount,
      input.insurerAmount || 0
    );
    const sequence = 150 + state.quotes.length;
    const quote = {
      id: `QT-${new Date().getFullYear()}-${String(sequence).padStart(4, "0")}`,
      quoteId: null,
      originalQuoteId: null,
      previousVersionId: null,
      organizationId: state.organization?.id,
      caseId: recordCase.id,
      patientId: patient.id,
      status: "DRAFT",
      version: 1,
      currency: "USD",
      items: authorizedItems.map((item) => ({
        id: item.id || uid("QTI"),
        catalogItemId: item.catalogItemId || null,
        category: item.category,
        name: item.name,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discountAmount: Number(item.discountAmount || 0)
      })),
      discount: authorizedDiscount,
      ...calculation,
      comments: general.comments,
      invoiceDate: general.invoiceDate,
      discountGroupId: general.discountGroupId,
      referredBy: general.referredBy,
      giftcard: general.giftcard,
      revisionReason: "",
      immutable: false,
      createdBy: currentUser().id,
      createdAt: nowIso(),
      sentAt: null,
      portalToken: `demo-${uid("portal").toLowerCase()}`,
      expiresAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString()
    };
    quote.quoteId = quote.id;
    quote.originalQuoteId = quote.id;

    const commit = (remote = null) => {
      if (remote?.quote_id && remote?.quote_version_id) {
        quote.displayCode = quote.id;
        quote.id = remote.quote_version_id;
        quote.quoteId = remote.quote_id;
        quote.originalQuoteId = remote.quote_id;
        quote.remoteConfirmedAt = nowIso();
      }
      setState((draft) => {
      draft.quotes.unshift(quote);
      const currentCase = draft.cases.find((candidate) => candidate.id === recordCase.id);
      if (currentCase) currentCase.nextAction = "Revisar y enviar cotización.";
      audit("CREATE_QUOTE", quote.id, `Cotización creada para ${patient.fullName} por ${quote.total}.`);
      });
      return quote;
    };
    if (adapter.mode === "supabase") {
      return requiredSync("CREATE_QUOTE", { quote }).then(commit);
    }
    return commit();
  }

  function reviseQuote(id, input) {
    requirePermission("quotes:write");
    const original = quoteById(id);
    if (!original) throw new Error("Cotización no encontrada.");
    assertCurrentOrganization(original, "Cotización");
    const revisionReason = String(input.revisionReason || "").trim();
    if (!revisionReason) throw new Error("Indique el motivo de la nueva versión.");
    const general = validateQuoteGeneral(input, original);
    const authorizedItems = validateQuoteItems(input.items || original.items);
    const authorizedDiscount = resolveQuoteDiscount(general.discountGroupId, input.discount?.reason || original.discount?.reason);
    const calculation = calculateQuote(
      authorizedItems,
      authorizedDiscount,
      input.insurerAmount ?? original.insurerAmount
    );
    const rootId = quoteRootId(original);
    const nextVersion = quoteVersions(original).reduce((highest, candidate) => Math.max(highest, Number(candidate.version || 0)), 0) + 1;
    const revised = {
        ...clone(original),
        id: uid("QTV"),
        quoteId: rootId,
        originalQuoteId: original.originalQuoteId || rootId,
        previousVersionId: original.id,
        version: nextVersion,
        status: "DRAFT",
        immutable: false,
        sentAt: null,
        sentSnapshot: null,
        revisionReason,
        createdBy: currentUser().id,
        createdAt: nowIso(),
        items: authorizedItems.map((item) => ({ ...clone(item), id: uid("QTI") })),
        discount: clone(authorizedDiscount),
        comments: general.comments,
        invoiceDate: general.invoiceDate,
        discountGroupId: general.discountGroupId,
        referredBy: general.referredBy,
        giftcard: general.giftcard,
        ...calculation,
        portalToken: `demo-${uid("portal").toLowerCase()}`,
        expiresAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString()
      };
    const commit = (remote = null) => {
      if (remote?.quote_version_id) {
        revised.id = remote.quote_version_id;
        revised.quoteId = remote.quote_id || revised.quoteId;
        revised.originalQuoteId = remote.quote_id || revised.originalQuoteId;
        revised.remoteConfirmedAt = nowIso();
      }
      setState((draft) => {
      draft.quotes.unshift(revised);
      audit("CREATE_QUOTE_REVISION", revised.id, `Versión ${revised.version} creada desde ${original.id}; motivo: ${revisionReason}.`, {
        quoteId: rootId,
        previousVersionId: original.id,
        version: revised.version
      });
      });
      return revised;
    };
    if (adapter.mode === "supabase") {
      return requiredSync("CREATE_QUOTE_REVISION", { quote: revised, sourceQuoteId: id }).then(commit);
    }
    return commit();
  }

  function updateQuoteDraft(id, input) {
    requirePermission("quotes:write");
    const original = quoteById(id);
    if (!original) throw new Error("Cotización no encontrada.");
    assertCurrentOrganization(original, "Cotización");
    if (original.status !== "DRAFT" || quoteIsImmutable(original)) {
      throw new Error("La versión enviada no se puede editar. Cree una nueva versión.");
    }
    const general = validateQuoteGeneral(input, original);
    const authorizedItems = validateQuoteItems(input.items || original.items);
    const authorizedDiscount = resolveQuoteDiscount(general.discountGroupId, input.discount?.reason || original.discount?.reason);
    const calculation = calculateQuote(
      authorizedItems,
      authorizedDiscount,
      input.insurerAmount ?? original.insurerAmount
    );
    const updated = {
      ...clone(original),
      items: clone(authorizedItems),
      discount: clone(authorizedDiscount),
      comments: general.comments,
      invoiceDate: general.invoiceDate,
      discountGroupId: general.discountGroupId,
      referredBy: general.referredBy,
      giftcard: general.giftcard,
      ...calculation
    };
    const commit = (remote = null) => {
      if (remote?.quote_version_id) updated.remoteConfirmedAt = nowIso();
      setState((draft) => {
      const quote = draft.quotes.find((candidate) => candidate.id === id);
      if (!quote) throw new Error("Cotización no encontrada.");
      Object.assign(quote, clone(updated));
      audit("UPDATE_QUOTE_DRAFT", quote.id, `Borrador v${quote.version} actualizado.`, {
        quoteId: quoteRootId(quote),
        version: quote.version
      });
      });
      return updated;
    };
    if (adapter.mode === "supabase") {
      return requiredSync("UPDATE_QUOTE_DRAFT", { quote: updated }).then(commit);
    }
    return commit();
  }

  function updateQuoteStatus(quoteId, status, note = "", approvedAmount = null, claimNumber = "", idempotencyKey = "") {
    requirePermission("insurance:write");
    const quote = quoteById(quoteId);
    if (!quote) throw new Error("Cotización no encontrada.");
    assertCurrentOrganization(quote, "Cotización");
    const normalizedNote = String(note || "").trim();
    const normalizedApprovedAmount = approvedAmount === null || approvedAmount === "" ? null : Number(approvedAmount);
    if (normalizedApprovedAmount !== null && (!Number.isFinite(normalizedApprovedAmount) || normalizedApprovedAmount < 0 || normalizedApprovedAmount > Number(quote.total))) {
      throw new Error("El monto aprobado debe ser válido y no superar el total de la cotización.");
    }
    const normalizedClaimNumber = String(claimNumber || "").trim();
    if (normalizedClaimNumber.length > 120) throw new Error("El número de reclamo o autorización es demasiado largo.");
    const eventId = String(idempotencyKey || uid("QSE")).trim();
    if (!eventId || eventId.length > 160) throw new Error("La clave de idempotencia de seguro es inválida.");
    const priorRequest = state.insuranceRequests.find((request) => request.events?.some((event) => event.idempotencyKey === eventId));
    const priorEvent = priorRequest?.events.find((event) => event.idempotencyKey === eventId);
    if (priorEvent) {
      if (priorRequest.quoteId !== quoteId || priorEvent.status !== status || priorEvent.note !== normalizedNote
        || Number(priorEvent.approvedAmount ?? normalizedApprovedAmount) !== Number(normalizedApprovedAmount)
        || String(priorEvent.claimNumber ?? normalizedClaimNumber) !== normalizedClaimNumber) {
        throw new Error("La clave de idempotencia ya pertenece a otra operación.");
      }
      return quote;
    }
    if (!canTransitionQuote(quote.status, status)) {
      throw new Error(`Transición no permitida: ${quote.status} → ${status}.`);
    }
    if (!normalizedNote) throw new Error("La actualización de seguro requiere una observación.");
    const previousStatus = quote.status;

    const commit = (remote = null) => {
      const committedEvent = state.insuranceRequests.some((request) => request.events?.some((event) => event.idempotencyKey === eventId));
      if (committedEvent) return quoteById(quoteId);
      setState((draft) => {
      const quote = draft.quotes.find((candidate) => candidate.id === quoteId);
      quote.status = status;
      const request = draft.insuranceRequests.find((candidate) => candidate.quoteId === quoteId);
      if (request) {
        request.status = status;
        if (normalizedApprovedAmount !== null) request.approvedAmount = roundMoney(normalizedApprovedAmount);
        if (normalizedClaimNumber) request.claimNumber = normalizedClaimNumber;
        request.lastNote = normalizedNote;
        if (!request.events.some((event) => event.idempotencyKey === eventId)) request.events.push({
          date: nowIso(), status, note: normalizedNote, idempotencyKey: eventId,
          approvedAmount: normalizedApprovedAmount, claimNumber: normalizedClaimNumber, quoteVersionId: quoteId
        });
      } else if (["SENT_TO_INSURER", "INSURER_REVIEW", "INFO_REQUIRED", "PARTIALLY_APPROVED", "APPROVED", "REJECTED"].includes(status)) {
        draft.insuranceRequests.unshift({
          id: remote?.insurance_request_id || uid("PRE"),
          quoteId,
          insurerId: patientById(quote.patientId)?.insurerId || null,
          status,
          submittedAt: nowIso(),
          approvedAmount: roundMoney(normalizedApprovedAmount || 0),
          requestedDocuments: [],
          claimNumber: normalizedClaimNumber,
          lastNote: normalizedNote,
          events: [{
            date: nowIso(), status, note: normalizedNote, idempotencyKey: eventId,
            approvedAmount: normalizedApprovedAmount, claimNumber: normalizedClaimNumber, quoteVersionId: quoteId
          }]
        });
      }
      audit("UPDATE_QUOTE_STATUS", quoteId, `Estado actualizado de ${previousStatus} a ${status}. ${normalizedNote}`, {
        quoteId: quoteRootId(quote),
        version: quote.version,
        eventId
      });
      });
      const committedQuote = quoteById(quoteId);
      queueNotification({
        templateCode: "QUOTE_STATUS", channel: "WHATSAPP", recipientId: committedQuote.patientId,
        relatedEntityType: "QUOTE", relatedEntityId: committedQuote.id, idempotencyKey: `NOT:QUOTE_STATUS:${eventId}`,
        remoteConfirmed: adapter.mode === "supabase"
      });
      return committedQuote;
    };

    const payload = { quoteId: quote.quoteId || quote.id, quoteVersionId: quote.id, status, note: normalizedNote, approvedAmount: normalizedApprovedAmount, claimNumber: normalizedClaimNumber, eventId };
    if (adapter.mode === "supabase") return requiredSync("UPDATE_QUOTE_STATUS", payload).then(commit);
    return commit();
  }

  function sendQuote(quoteId, channel = "WHATSAPP") {
    requirePermission("quotes:write");
    const normalizedChannel = String(channel || "").toUpperCase();
    if (!["WHATSAPP", "EMAIL"].includes(normalizedChannel)) throw new Error("Canal de envío no permitido para cotizaciones.");
    const quote = quoteById(quoteId);
    if (!quote) throw new Error("Cotización no encontrada.");
    assertCurrentOrganization(quote, "Cotización");
    const notificationKey = `NOT:QUOTE_READY:${quote.id}:${normalizedChannel}`;
    const priorDelivery = state.notifications.find((notification) => notification.idempotencyKey === notificationKey);
    if (quoteIsImmutable(quote) && priorDelivery) return quote;
    if (quoteIsImmutable(quote)) throw new Error("La versión ya fue enviada y no puede enviarse nuevamente.");
    if (!["DRAFT", "READY_TO_SEND"].includes(quote.status)) throw new Error("Sólo se puede enviar una versión en borrador o lista para enviar.");
    if (quote.items.some((item) => item.unitPrice === null || item.unitPrice === undefined)) throw new Error("No se puede enviar una cotización con precios faltantes.");

    const commit = () => {
      const current = quoteById(quoteId);
      const committedDelivery = state.notifications.find((notification) => notification.idempotencyKey === notificationKey);
      if (quoteIsImmutable(current) && committedDelivery) return current;
      setState((draft) => {
      const quote = draft.quotes.find((candidate) => candidate.id === quoteId);
      quote.status = "SENT_TO_PATIENT";
      quote.sentAt = nowIso();
      quote.immutable = true;
      quote.sentSnapshot = clone({
        ...quote,
        sentSnapshot: undefined,
        items: quote.items,
        discount: quote.discount
      });
      audit("SEND_QUOTE", quoteId, `Cotización v${quote.version} enviada por ${normalizedChannel} y bloqueada.`, {
        quoteId: quoteRootId(quote),
        version: quote.version,
        channel: normalizedChannel,
        idempotencyKey: notificationKey
      });
      });
      const committedQuote = quoteById(quoteId);
      queueNotification({
        templateCode: "QUOTE_READY", channel: normalizedChannel, recipientId: committedQuote.patientId,
        relatedEntityType: "QUOTE_VERSION", relatedEntityId: committedQuote.id, idempotencyKey: notificationKey,
        remoteConfirmed: adapter.mode === "supabase"
      });
      return committedQuote;
    };

    if (adapter.mode === "supabase") return requiredSync("SEND_QUOTE_VERSION", { quote, channel: normalizedChannel, idempotencyKey: notificationKey }).then(commit);
    return commit();
  }

  function createPayment(input) {
    requirePermission("payments:write");
    const quote = quoteById(input.quoteId);
    if (!quote) throw new Error("Cotización no encontrada.");
    assertCurrentOrganization(quote, "Cotización");
    const balance = quoteBalance(quote, state.payments);
    const existingReferences = state.payments.map((payment) => payment.reference).filter(Boolean);
    const validation = validatePayment({
      amount: input.amount,
      balance,
      existingReferences,
      reference: input.reference
    });
    if (!validation.ok) throw new Error(validation.message);

    const payment = {
      id: uid("PAY"),
      quoteId: quote.id,
      rootQuoteId: quoteRootId(quote),
      quoteVersionId: quote.id,
      caseId: quote.caseId || "",
      patientId: quote.patientId,
      date: nowIso(),
      organizationId: state.organization?.id,
      currency: quote.currency || "USD",
      method: input.method || "TRANSFER",
      payer: input.payer || patientById(quote.patientId)?.contactName || "Paciente",
      reference: validation.reference,
      amount: validation.amount,
      status: "APPLIED",
      receipt: uid("REC"),
      idempotencyKey: String(input.idempotencyKey || `PAY:${quote.id}:${validation.reference}`).slice(0, 160),
      allocations: [{ quoteId: quote.id, quoteVersionId: quote.id, amount: validation.amount, currency: quote.currency || "USD", status: "APPLIED" }]
    };

    const commit = (remoteResult = null) => {
      const remote = remoteResult?.payment || {};
      const committed = adapter.mode === "supabase" ? {
        ...payment,
        id: remote.id || payment.id,
        organizationId: remote.organizationId || payment.organizationId,
        date: remote.paidAt || remote.createdAt || payment.date,
        amount: Number(remote.amount ?? payment.amount),
        currency: remote.currency || payment.currency,
        method: remote.method || payment.method,
        payer: remote.payer || payment.payer,
        reference: remote.externalReference || payment.reference,
        status: remote.status || payment.status,
        receipt: remote.receiptCode || payment.receipt,
        idempotencyKey: remote.idempotencyKey || payment.idempotencyKey
      } : payment;
      const existing = state.payments.find((candidate) => candidate.idempotencyKey === committed.idempotencyKey);
      if (existing) return existing;
      setState((draft) => {
        draft.payments.unshift(committed);
        audit("CREATE_PAYMENT", committed.id, `Pago ${committed.amount} aplicado a ${quote.id}.`, {
          quoteId: quoteRootId(quote), quoteVersionId: quote.id, idempotencyKey: committed.idempotencyKey
        });
      });
      queueNotification({
        templateCode: "PAYMENT_RECEIVED", channel: "EMAIL", recipientId: committed.patientId,
        relatedEntityType: "QUOTE", relatedEntityId: committed.quoteId, idempotencyKey: `NOT:PAYMENT_RECEIVED:${committed.id}`
      });
      return committed;
    };

    if (adapter.mode === "supabase") return requiredSync("CREATE_PAYMENT", { payment }).then(commit);
    return commit();
  }

  function startAdministrativeExecution(input) {
    requirePermission("cases:write");
    const quote = quoteById(input.quoteId);
    if (!quote) throw new Error("Cotización no encontrada.");
    assertCurrentOrganization(quote, "Cotización");
    const record = caseById(quote.caseId);
    assertCurrentOrganization(record, "Hospitalización");
    const durationDays = Number(input.durationDays);
    if (!String(input.healthManager || "").trim() || !String(input.referredBy || "").trim()
      || !String(input.revenueType || "").trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(input.startDate || ""))
      || !Number.isInteger(durationDays) || durationDays <= 0 || durationDays > 3660
      || !String(input.paymentForm || "").trim() || !String(input.requestType || "").trim()) {
      throw new Error("Complete los campos administrativos obligatorios con valores válidos.");
    }
    const idempotencyKey = String(input.idempotencyKey || `EXEC:${quote.id}:${input.startDate}`).trim().slice(0, 160);
    const profile = {
      id: uid("PI"), organizationId: state.organization?.id, caseId: quote.caseId,
      quoteId: quote.id, rootQuoteId: quoteRootId(quote), patientId: quote.patientId,
      healthManager: String(input.healthManager).trim(), referredBy: String(input.referredBy).trim(),
      revenueType: String(input.revenueType).trim(), serviceType: String(input.serviceType || "").trim(),
      startDate: input.startDate, durationDays, paymentForm: String(input.paymentForm).trim(),
      insurerId: input.insurerId || null, requestType: String(input.requestType).trim(),
      thirdPartyInvoice: Boolean(input.thirdPartyInvoice), majorCategory: String(input.majorCategory || "").trim(),
      serviceSubcategory: String(input.serviceSubcategory || "").trim(), sourceHospital: String(input.sourceHospital || "").trim(),
      description: String(input.description || "").trim(), patientType: String(input.patientType || "").trim(),
      moduleType: String(input.moduleType || "").trim(), additionalOptions: String(input.additionalOptions || "").trim(),
      status: "ACTIVE", idempotencyKey, createdAt: nowIso()
    };
    const existing = state.administrativeExecutionProfiles.find((candidate) => candidate.idempotencyKey === idempotencyKey);
    if (existing) return existing;
    const commit = (remoteResult = null) => {
      const remote = remoteResult?.profile || {};
      const committed = adapter.mode === "supabase" ? {
        ...profile, ...remote, id: remote.id || profile.id,
        caseId: remote.hospitalizationId || profile.caseId,
        quoteId: remote.quoteVersionId || profile.quoteId,
        rootQuoteId: remote.quoteId || profile.rootQuoteId,
        durationDays: Number(remote.durationDays || profile.durationDays),
        thirdPartyInvoice: Boolean(remote.thirdPartyInvoice ?? profile.thirdPartyInvoice)
      } : profile;
      const duplicate = state.administrativeExecutionProfiles.find((candidate) => candidate.idempotencyKey === committed.idempotencyKey);
      if (duplicate) return duplicate;
      setState((draft) => {
        draft.administrativeExecutionProfiles.unshift(committed);
        audit("START_ADMINISTRATIVE_EXECUTION", committed.id, `Perfil administrativo creado para ${record.id}.`, {
          quoteId: quoteRootId(quote), quoteVersionId: quote.id, idempotencyKey
        });
      });
      return committed;
    };
    if (adapter.mode === "supabase") return requiredSync("START_ADMINISTRATIVE_EXECUTION", { profile }).then(commit);
    return commit();
  }

  function reversePayment(paymentId, reason, idempotencyKey = "") {
    requirePermission("payments:write");
    const normalizedReason = String(reason || "").trim();
    if (!normalizedReason) throw new Error("Indique el motivo de la reversión.");
    const payment = state.payments.find((candidate) => candidate.id === paymentId);
    if (!payment) throw new Error("Pago no encontrado.");
    assertCurrentOrganization(payment, "Pago");
    if (payment.status !== "APPLIED") throw new Error("Sólo se puede revertir un pago aplicado.");
    const key = String(idempotencyKey || `REVERSE:${paymentId}:${normalizedReason}`).slice(0, 160);
    const commit = (remoteResult = null) => {
      const remote = remoteResult?.payment || {};
      const alreadyCommitted = state.payments.find((candidate) => candidate.id === paymentId && candidate.status === "REVERSED" && candidate.reversalIdempotencyKey === key);
      if (alreadyCommitted) return alreadyCommitted;
      setState((draft) => {
        const target = draft.payments.find((candidate) => candidate.id === paymentId);
        target.status = remote.status || "REVERSED";
        target.reversedAt = remote.reversedAt || nowIso();
        target.reversedBy = remote.reversedBy || currentUser().id;
        target.reversalReason = remote.reversalReason || normalizedReason;
        target.reversalIdempotencyKey = remote.reversalIdempotencyKey || key;
        target.allocations = (target.allocations || []).map((allocation) => ({ ...allocation, status: "REVERSED", reversedAt: target.reversedAt }));
        audit("REVERSE_PAYMENT", paymentId, "Pago revertido sin eliminar el comprobante.", { reason: normalizedReason, idempotencyKey: key });
      });
      return state.payments.find((candidate) => candidate.id === paymentId);
    };
    if (adapter.mode === "supabase") return requiredSync("REVERSE_PAYMENT", { paymentId, reason: normalizedReason, idempotencyKey: key }).then(commit);
    return commit();
  }

  function createClinicalDocument(input) {
    requirePermission("clinical:write");
    const document = {
      id: uid("DOC"),
      caseId: input.caseId,
      patientId: caseById(input.caseId)?.patientId || input.patientId,
      type: input.type || "HEALTH_REPORT",
      organizationId: state.organization?.id,
      title: input.title || "Documento clínico",
      status: "DRAFT",
      authorId: currentUser().id,
      authorName: currentUser().name,
      createdAt: nowIso(),
      signedAt: null,
      signatureMetadata: null,
      version: 1,
      summary: input.summary || "",
      content: input.content || {}
    };
    setState((draft) => {
      draft.clinicalDocuments.unshift(document);
      audit("CREATE_CLINICAL_DOCUMENT", document.id, `${document.title} creado en borrador.`);
    });
    safeSync("CREATE_CLINICAL_DOCUMENT", { document });
    return document;
  }

  function createClinicalProfile(input) {
    requirePermission("clinical:write");
    const recordCase = caseById(input.caseId);
    if (!recordCase) throw new Error("Seleccione una hospitalización válida.");
    assertCurrentOrganization(recordCase, "Hospitalización");
    const requiredText = ["diagnosisCode", "diagnosisLabel", "diagnosisGroup", "triage", "profileGroup", "profileSubgroup", "patientType", "serviceType"];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.startDate || ""))
      || (input.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(input.endDate)))
      || (input.endDate && input.endDate < input.startDate)
      || requiredText.some((field) => !String(input[field] || "").trim())) {
      throw new Error("Complete los campos clínicos obligatorios con valores válidos.");
    }
    const devices = Array.isArray(input.devices) ? input.devices.map((device) => ({
      deviceType: String(device.deviceType || "").trim(),
      date: String(device.date || "").trim(),
      gauge: String(device.gauge || "").trim(),
      reason: String(device.reason || "").trim(),
      changeFrequency: String(device.changeFrequency || "").trim(),
      observations: String(device.observations || "").trim()
    })) : [];
    if (devices.length > 50 || devices.some((device) => !device.deviceType || (device.date && !/^\d{4}-\d{2}-\d{2}$/.test(device.date)))) {
      throw new Error("Revise los dispositivos del perfil clínico.");
    }
    const shiftStartDate = String(input.shiftStartDate || "").trim();
    const shiftEndDate = String(input.shiftEndDate || "").trim();
    if ((shiftStartDate || shiftEndDate) && (!/^\d{4}-\d{2}-\d{2}$/.test(shiftStartDate) || !/^\d{4}-\d{2}-\d{2}$/.test(shiftEndDate) || shiftEndDate < shiftStartDate)) {
      throw new Error("El rango de planificación de turnos no es válido.");
    }
    const otherDoctorIds = Array.isArray(input.otherDoctorIds) ? [...new Set(input.otherDoctorIds.filter(Boolean))] : [];
    const referencedDoctorIds = [input.treatingDoctorId, input.coordinatorId, ...otherDoctorIds].filter(Boolean);
    if (referencedDoctorIds.some((doctorId) => !state.doctors.some((doctor) => doctor.id === doctorId
      && doctor.status === "ACTIVE"
      && (!doctor.organizationId || doctor.organizationId === state.organization?.id)))) {
      throw new Error("Seleccione únicamente profesionales activos de la organización.");
    }
    const idempotencyKey = String(input.idempotencyKey || uid("CLINICAL-PROFILE")).trim().slice(0, 160);
    const profile = {
      id: uid("CP"), organizationId: state.organization?.id, caseId: recordCase.id, patientId: recordCase.patientId,
      startDate: input.startDate, endDate: input.endDate || null,
      treatingDoctorId: input.treatingDoctorId || null,
      otherDoctorIds,
      diagnosisCode: String(input.diagnosisCode).trim(), diagnosisLabel: String(input.diagnosisLabel).trim(),
      diagnosisGroup: String(input.diagnosisGroup).trim(), triage: String(input.triage).trim(),
      profileGroup: String(input.profileGroup).trim(), profileSubgroup: String(input.profileSubgroup).trim(),
      patientType: String(input.patientType).trim(), supervisorName: String(input.supervisorName || "").trim(),
      coordinatorId: input.coordinatorId || null, nursingTags: String(input.nursingTags || "").trim(),
      supervisionFrequency: String(input.supervisionFrequency || "").trim(),
      physicianReportFrequency: String(input.physicianReportFrequency || "").trim(), serviceType: String(input.serviceType).trim(),
      devices, shiftStartDate: shiftStartDate || null, shiftEndDate: shiftEndDate || null,
      shiftFrequency: String(input.shiftFrequency || "").trim(), attentionType: String(input.attentionType || "").trim(),
      clinicalStatus: "DRAFT", attachmentMetadata: [], idempotencyKey, createdAt: nowIso(), createdBy: currentUser().id
    };
    const existing = state.clinicalProfiles.find((candidate) => candidate.idempotencyKey === idempotencyKey);
    if (existing) return existing;
    const commit = (remoteResult = null) => {
      const remote = remoteResult?.profile || {};
      const committed = adapter.mode === "supabase" ? {
        ...profile, ...remote, id: remote.id || profile.id,
        caseId: remote.hospitalizationId || profile.caseId,
        otherDoctorIds: remote.otherDoctorIds || profile.otherDoctorIds,
        devices: remote.devices || profile.devices,
        attachmentMetadata: remote.attachmentMetadata || profile.attachmentMetadata
      } : profile;
      const duplicate = state.clinicalProfiles.find((candidate) => candidate.idempotencyKey === committed.idempotencyKey);
      if (duplicate) return duplicate;
      setState((draft) => {
        draft.clinicalProfiles.unshift(committed);
        audit("CREATE_CLINICAL_PROFILE", committed.id, `Perfil clínico creado para ${recordCase.id}.`, {
          caseId: recordCase.id, idempotencyKey: committed.idempotencyKey
        });
      });
      return committed;
    };
    if (adapter.mode === "supabase") return requiredSync("CREATE_CLINICAL_PROFILE", { profile }).then(commit);
    return commit();
  }

  function validateHealthReportRange(input) {
    requirePermission("clinical:read");
    const recordCase = caseById(input.caseId);
    if (!recordCase) throw new Error("Seleccione una hospitalización válida.");
    assertCurrentOrganization(recordCase, "Hospitalización");
    const start = String(input.start || "").trim();
    const end = String(input.end || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) {
      throw new Error("El rango del reporte de salud no es válido.");
    }
    const result = {caseId: recordCase.id, start, end};
    if (adapter.mode === "supabase") return requiredSync("VALIDATE_HEALTH_REPORT_RANGE", result).then(() => result);
    return result;
  }

  function updateClinicalDocument(id, patch) {
    requirePermission("clinical:write");
    setState((draft) => {
      const document = draft.clinicalDocuments.find((candidate) => candidate.id === id);
      if (!document) throw new Error("Documento clínico no encontrado.");
      assertCurrentOrganization(document, "Documento clínico");
      if (document.status !== "DRAFT") throw new Error("El documento firmado no puede editarse. Cree una corrección auditada.");
      document.version += 1;
      Object.assign(document, patch);
      audit("UPDATE_CLINICAL_DOCUMENT", id, `Documento actualizado a versión ${document.version}.`);
    });
  }

  function signClinicalDocument(id) {
    requirePermission("clinical:sign");
    setState((draft) => {
      const document = draft.clinicalDocuments.find((candidate) => candidate.id === id);
      if (!document) throw new Error("Documento clínico no encontrado.");
      assertCurrentOrganization(document, "Documento clínico");
      if (document.status !== "DRAFT") throw new Error("Sólo se puede firmar un borrador.");
      document.status = "SIGNED";
      document.signedAt = nowIso();
      document.signedBy = currentUser().id;
      document.signatureMetadata = {
        signedAt: document.signedAt,
        signedBy: currentUser().id,
        signerRole: state.session.role,
        method: "APPLICATION_SIGNATURE_METADATA",
        legalValidation: "NEEDS_CLIENT_CONFIRMATION"
      };
      audit("SIGN_CLINICAL_DOCUMENT", id, "Documento firmado y bloqueado para edición ordinaria.", {
        version: document.version,
        signatureMetadata: document.signatureMetadata
      });
    });
    safeSync("SIGN_CLINICAL_DOCUMENT", { documentId: id });
  }

  function voidClinicalDocument(id, reason) {
    requirePermission("clinical:correct_signed");
    const normalizedReason = String(reason || "").trim();
    if (!normalizedReason) throw new Error("Indique el motivo de la anulación.");
    setState((draft) => {
      const document = draft.clinicalDocuments.find((candidate) => candidate.id === id);
      if (!document) throw new Error("Documento clínico no encontrado.");
      assertCurrentOrganization(document, "Documento clínico");
      if (document.status !== "SIGNED") throw new Error("Sólo se puede anular un documento firmado.");
      document.status = "VOIDED";
      document.voidReason = normalizedReason;
      document.voidedAt = nowIso();
      document.voidedBy = currentUser().id;
      audit("VOID_CLINICAL_DOCUMENT", id, `Documento anulado: ${normalizedReason}.`, {
        version: document.version,
        reason: normalizedReason
      });
    });
    safeSync("VOID_CLINICAL_DOCUMENT", { documentId: id, reason: normalizedReason });
    return true;
  }

  function createClinicalCorrection(subjectType, subjectId, input) {
    requirePermission("clinical:correct_signed");
    const record = clinicalRecord(subjectType, subjectId);
    if (!record) throw new Error("Registro clínico no encontrado.");
    assertCurrentOrganization(record, "Registro clínico");
    const sourceStatus = subjectType === "MEDICATION_CARD" ? record.documentStatus : record.status;
    if (sourceStatus !== "SIGNED") throw new Error("Sólo se puede corregir un registro firmado.");
    const reason = String(input.reason || "").trim();
    if (!reason) throw new Error("Indique el motivo de la corrección.");
    const correctionKind = input.kind || "ADDENDUM";
    if (!["AMENDMENT", "ADDENDUM", "ERRATA"].includes(correctionKind)) {
      throw new Error("Tipo de corrección no válido.");
    }
    let correction;
    setState((draft) => {
      const prior = draft.clinicalCorrections
        .filter((candidate) => candidate.subjectType === subjectType && candidate.subjectId === subjectId)
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0];
      correction = {
        id: uid("COR"),
        organizationId: state.organization?.id,
        subjectType,
        subjectId,
        originalDocumentId: subjectId,
        previousVersionId: prior?.id || subjectId,
        correctionKind,
        reason,
        content: clone(input.content || {}),
        authorId: currentUser().id,
        authorName: currentUser().name,
        authorRole: state.session.role,
        status: "CORRECTED",
        createdAt: nowIso()
      };
      draft.clinicalCorrections.unshift(correction);
      audit("CREATE_CLINICAL_CORRECTION", correction.id, `${correctionKind} creado para ${subjectType} ${subjectId}: ${reason}.`, {
        subjectType,
        subjectId,
        previousVersionId: correction.previousVersionId,
        correctionKind
      });
    });
    safeSync("CREATE_CLINICAL_CORRECTION", { correction });
    return correction;
  }

  function createMedicationCard(input) {
    requirePermission("clinical:write");
    const recordCase = caseById(input.caseId);
    if (!recordCase) throw new Error("Seleccione una hospitalización válida.");
    const card = {
      id: uid("MC"),
      organizationId: state.organization?.id,
      caseId: recordCase.id,
      patientId: recordCase.patientId,
      status: "ACTIVE",
      documentStatus: "DRAFT",
      version: 1,
      createdAt: nowIso(),
      createdBy: currentUser().id,
      signatureMetadata: null,
      items: clone(input.items || [])
    };
    setState((draft) => {
      draft.medicationCards.unshift(card);
      audit("CREATE_MEDICATION_CARD", card.id, "Tarjeta de medicamentos creada en borrador.");
    });
    safeSync("CREATE_MEDICATION_CARD", { card });
    return card;
  }

  function signMedicationCard(id) {
    requirePermission("clinical:sign");
    setState((draft) => {
      const card = draft.medicationCards.find((candidate) => candidate.id === id);
      if (!card) throw new Error("Tarjeta de medicamentos no encontrada.");
      assertCurrentOrganization(card, "Tarjeta de medicamentos");
      if (card.documentStatus !== "DRAFT") throw new Error("Sólo se puede firmar una tarjeta en borrador.");
      card.documentStatus = "SIGNED";
      card.signedAt = nowIso();
      card.signedBy = currentUser().id;
      card.signatureMetadata = {
        signedAt: card.signedAt,
        signedBy: currentUser().id,
        signerRole: state.session.role,
        method: "APPLICATION_SIGNATURE_METADATA",
        legalValidation: "NEEDS_CLIENT_CONFIRMATION"
      };
      audit("SIGN_MEDICATION_CARD", id, "Tarjeta de medicamentos firmada y bloqueada.");
    });
    safeSync("SIGN_MEDICATION_CARD", { cardId: id });
  }

  function voidClinicalRecord(subjectType, subjectId, reason) {
    requirePermission("clinical:correct_signed");
    const record = clinicalRecord(subjectType, subjectId);
    if (!record) throw new Error("Registro clínico no encontrado.");
    assertCurrentOrganization(record, "Registro clínico");
    const normalizedReason = String(reason || "").trim();
    if (!normalizedReason) throw new Error("Indique el motivo de la anulación.");
    const status = subjectType === "MEDICATION_CARD" ? record.documentStatus : record.status;
    if (status !== "SIGNED") throw new Error("Sólo se puede anular un registro firmado.");
    setState((draft) => {
      const target = clinicalRecord(subjectType, subjectId);
      if (subjectType === "MEDICATION_CARD") target.documentStatus = "VOIDED";
      else target.status = "VOIDED";
      target.voidReason = normalizedReason;
      target.voidedAt = nowIso();
      target.voidedBy = currentUser().id;
      audit("VOID_CLINICAL_RECORD", subjectId, `${subjectType} anulado: ${normalizedReason}.`, {
        subjectType,
        version: target.version || 1,
        reason: normalizedReason
      });
    });
    safeSync("VOID_CLINICAL_RECORD", { subjectType, subjectId, reason: normalizedReason });
    return true;
  }

  function addVitalSigns(input) {
    requirePermission("clinical:write");
    const record = {
      id: uid("VS"),
      caseId: input.caseId,
      patientId: caseById(input.caseId)?.patientId,
      recordedAt: nowIso(),
      temperature: Number(input.temperature),
      heartRate: Number(input.heartRate),
      respiratoryRate: Number(input.respiratoryRate),
      systolic: Number(input.systolic),
      diastolic: Number(input.diastolic),
      spo2: Number(input.spo2),
      pain: Number(input.pain || 0),
      authorName: currentUser().name
    };
    setState((draft) => {
      draft.vitalSigns.unshift(record);
      audit("ADD_VITAL_SIGNS", record.id, `Signos vitales registrados para ${record.caseId}.`);
    });
    return record;
  }

  function addNursingNote(input) {
    requirePermission("clinical:write");
    if (input.sign) requirePermission("clinical:sign");
    const note = {
      id: uid("NOTE"),
      caseId: input.caseId,
      patientId: caseById(input.caseId)?.patientId,
      createdAt: nowIso(),
      authorId: currentUser().id,
      authorName: currentUser().name,
      organizationId: state.organization?.id,
      status: input.sign ? "SIGNED" : "DRAFT",
      signedAt: input.sign ? nowIso() : null,
      signatureMetadata: input.sign ? {
        signedAt: nowIso(),
        signedBy: currentUser().id,
        signerRole: state.session.role,
        method: "APPLICATION_SIGNATURE_METADATA",
        legalValidation: "NEEDS_CLIENT_CONFIRMATION"
      } : null,
      text: input.text,
      shareStatus: "NOT_SHARED",
      sharedAt: null
    };
    setState((draft) => {
      draft.nursingNotes.unshift(note);
      audit("ADD_NURSING_NOTE", note.id, `Nota de enfermería ${note.status === "SIGNED" ? "firmada y bloqueada" : "guardada"}.`);
    });
    return note;
  }

  function shareNursingNote(id) {
    requirePermission("clinical:write");
    const sourceNote = state.nursingNotes.find((candidate) => candidate.id === id);
    if (!sourceNote) throw new Error("Nota no encontrada.");
    assertCurrentOrganization(sourceNote, "Nota de enfermería");
    const sourceCase = caseById(sourceNote.caseId);
    if (!sourceCase?.contractingDoctorId) throw new Error("No hay profesional autorizado para recibir la notificación.");
    setState((draft) => {
      const note = draft.nursingNotes.find((candidate) => candidate.id === id);
      if (!note) throw new Error("Nota no encontrada.");
      if (note.status !== "SIGNED") throw new Error("La nota debe estar firmada antes de compartirla.");
      note.shareStatus = "SHARED_WITH_DOCTOR";
      note.sharedAt = nowIso();
      audit("SHARE_NURSING_NOTE", id, "Nota compartida con médico mediante enlace seguro.");
    });
    queueNotification({
      templateCode: "NURSING_NOTE_AVAILABLE", channel: "EMAIL", recipientId: sourceCase.contractingDoctorId,
      relatedEntityType: "NURSING_NOTE", relatedEntityId: id, idempotencyKey: `NOT:NURSING_NOTE_AVAILABLE:${id}`
    });
  }

  function createShift(input) {
    requirePermission("agenda:write");
    const shift = {
      id: uid("SHIFT"),
      caseId: input.caseId,
      patientId: caseById(input.caseId)?.patientId,
      resourceId: input.resourceId || "",
      resourceName: input.resourceName,
      start: input.start,
      end: input.end,
      type: input.type,
      status: "PENDING"
    };
    setState((draft) => {
      draft.shifts.unshift(shift);
      audit("CREATE_SHIFT", shift.id, `Turno creado para ${shift.resourceName}.`);
    });
    safeSync("CREATE_SHIFT", { shift });
    return shift;
  }

  function createPurchase(input) {
    requirePermission("purchases:write");
    const subtotal = roundMoney(input.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitCost), 0));
    const tax = roundMoney(input.items.reduce((sum, item) =>
      sum + Number(item.quantity) * Number(item.unitCost) * Number(item.taxRate || 0) / 100, 0));
    const discount = roundMoney(input.discount || 0);
    const purchase = {
      id: `PUR-${new Date().getFullYear()}-${String(83 + state.purchases.length).padStart(4, "0")}`,
      supplierId: input.supplierId,
      date: input.date || new Date().toISOString().slice(0, 10),
      invoiceNumber: input.invoiceNumber || "",
      status: input.status || "PENDING_APPROVAL",
      paymentType: input.paymentType || "CREDIT",
      invoiceFile: input.invoiceFile || "",
      subtotal,
      tax,
      discount,
      total: roundMoney(subtotal + tax - discount),
      items: clone(input.items)
    };
    setState((draft) => {
      draft.purchases.unshift(purchase);
      audit("CREATE_PURCHASE", purchase.id, `Compra creada por ${purchase.total}.`);
    });
    safeSync("CREATE_PURCHASE", { purchase });
    return purchase;
  }

  function createInventoryMovement(input) {
    requirePermission("inventory:write");
    const item = state.inventoryItems.find((candidate) => candidate.id === input.inventoryItemId);
    if (!item) throw new Error("Ítem de inventario no encontrado.");
    assertCurrentOrganization(item, "Ítem de inventario");
    const quantity = Number(input.quantity);
    if (!(quantity > 0)) throw new Error("La cantidad debe ser mayor que cero.");
    const type = String(input.type || "").toUpperCase();
    const supportedTypes = new Set(["PURCHASE_ENTRY", "PATIENT_COMMITMENT", "PATIENT_CONSUMPTION", "RETURN_TO_STOCK", "TRANSFER", "POSITIVE_ADJUSTMENT", "NEGATIVE_ADJUSTMENT", "EXPIRY_DISPOSAL"]);
    if (!supportedTypes.has(type)) throw new Error("Tipo de movimiento no permitido.");
    const recordCase = input.caseId ? caseById(input.caseId) : null;
    if (recordCase) assertCurrentOrganization(recordCase, "Hospitalización");
    if (["PATIENT_COMMITMENT", "PATIENT_CONSUMPTION"].includes(type) && !recordCase) {
      throw new Error("El movimiento requiere una hospitalización autorizada.");
    }
    const destination = input.warehouseTo ? state.warehouses.find((warehouse) => warehouse.id === input.warehouseTo) : null;
    if (destination) assertCurrentOrganization(destination, "Bodega destino");
    if (type === "TRANSFER" && (!destination || destination.id === item.warehouseId)) {
      throw new Error("Seleccione una bodega destino distinta y autorizada.");
    }
    const normalizedReference = String(input.reference || "").trim().toUpperCase();
    const idempotencyKey = String(input.idempotencyKey || `INV:${item.id}:${type}:${normalizedReference}`).slice(0, 160);
    if (!normalizedReference || !idempotencyKey) throw new Error("La referencia e idempotencia son obligatorias.");
    const duplicate = state.inventoryMovements.find((candidate) => candidate.organizationId === state.organization?.id && candidate.idempotencyKey === idempotencyKey);
    if (duplicate) return duplicate;
    const openReservation = recordCase && state.inventoryReservations.find((candidate) => candidate.caseId === recordCase.id
      && candidate.inventoryItemId === item.id && candidate.status === "OPEN");
    if (type === "PATIENT_CONSUMPTION" && (!openReservation || openReservation.quantity - openReservation.consumed - openReservation.returned < quantity)) {
      throw new Error("El consumo supera la reserva disponible.");
    }
    if (type === "RETURN_TO_STOCK" && recordCase && (!openReservation || item.committed < quantity || openReservation.quantity - openReservation.consumed - openReservation.returned < quantity)) {
      throw new Error("La devolución supera la reserva disponible.");
    }

    const movement = {
      id: uid("MOV"),
      organizationId: state.organization?.id,
      inventoryItemId: item.id,
      caseId: input.caseId || "",
      type,
      quantity,
      date: nowIso(),
      warehouseFrom: input.warehouseFrom || item.warehouseId,
      warehouseTo: input.warehouseTo || "",
      lotId: input.lotId || "",
      lotNumber: input.lotNumber || "",
      lotExpiresAt: input.lotExpiresAt || "",
      reference: normalizedReference,
      idempotencyKey,
      authorName: currentUser().name,
      note: input.note || ""
    };

    setState((draft) => {
      const target = draft.inventoryItems.find((candidate) => candidate.id === item.id);
      switch (movement.type) {
        case "PURCHASE_ENTRY":
        case "POSITIVE_ADJUSTMENT":
          target.stock += quantity;
          break;
        case "RETURN_TO_STOCK":
          if (!recordCase) target.stock += quantity;
          break;
        case "PATIENT_COMMITMENT":
          if (target.stock - target.committed < quantity) throw new Error("Stock libre insuficiente.");
          target.committed += quantity;
          break;
        case "PATIENT_CONSUMPTION":
          if (target.committed < quantity) throw new Error("La cantidad consumida supera lo comprometido.");
          target.committed -= quantity;
          target.stock -= quantity;
          break;
        case "NEGATIVE_ADJUSTMENT":
        case "EXPIRY_DISPOSAL":
          if (target.stock - target.committed < quantity) throw new Error("Stock libre insuficiente.");
          target.stock -= quantity;
          break;
        case "TRANSFER": {
          if (target.stock - target.committed < quantity) throw new Error("Stock libre insuficiente.");
          const targetAtDestination = draft.inventoryItems.find((candidate) => candidate.organizationId === state.organization?.id
            && candidate.warehouseId === movement.warehouseTo && candidate.catalogItemId === target.catalogItemId);
          if (!targetAtDestination) throw new Error("La bodega destino no tiene un registro autorizado para este ítem.");
          target.stock -= quantity;
          targetAtDestination.stock += quantity;
          break;
        }
        default:
          break;
      }
      const reservation = recordCase && draft.inventoryReservations.find((candidate) => candidate.caseId === recordCase.id
        && candidate.inventoryItemId === target.id && candidate.status === "OPEN");
      if (movement.type === "PATIENT_COMMITMENT") {
        if (reservation) reservation.quantity += quantity;
        else draft.inventoryReservations.unshift({
          id: uid("RES"), organizationId: state.organization?.id, caseId: recordCase.id, inventoryItemId: target.id,
          quantity, delivered: 0, consumed: 0, returned: 0, status: "OPEN", createdAt: nowIso()
        });
      }
      if (movement.type === "PATIENT_CONSUMPTION") {
        reservation.consumed += quantity;
        reservation.delivered += quantity;
      }
      if (movement.type === "RETURN_TO_STOCK" && reservation) {
        // A return from an open reservation releases a commitment; stock never
        // left the warehouse, so increasing it here would create phantom stock.
        target.committed -= quantity;
        reservation.returned += quantity;
      }
      draft.inventoryMovements.unshift(movement);
      audit("CREATE_INVENTORY_MOVEMENT", movement.id, `${movement.type}: ${quantity} ${item.unit} de ${item.name}.`);
    });
    safeSync("CREATE_INVENTORY_MOVEMENT", { movement });
    return movement;
  }

  function createInventoryClosure(input) {
    requirePermission("inventory:write");
    const closure = {
      id: uid("CLOSE"),
      caseId: input.caseId,
      type: input.type || "PARTIAL",
      status: "PENDING_REVIEW",
      createdAt: nowIso(),
      createdBy: currentUser().name,
      note: input.note || "",
      items: clone(input.items || [])
    };
    setState((draft) => {
      draft.inventoryClosures.unshift(closure);
      const recordCase = draft.cases.find((candidate) => candidate.id === closure.caseId);
      if (recordCase && closure.type === "TOTAL") recordCase.status = "PENDING_CLOSE";
      audit("CREATE_INVENTORY_CLOSURE", closure.id, `Cierre ${closure.type} creado para ${closure.caseId}.`);
    });
    return closure;
  }

  function approveInventoryClosure(id) {
    requirePermission("inventory:write");
    setState((draft) => {
      const closure = draft.inventoryClosures.find((candidate) => candidate.id === id);
      if (!closure) throw new Error("Cierre no encontrado.");
      closure.status = "APPROVED";
      closure.approvedAt = nowIso();
      closure.approvedBy = currentUser().name;
      if (closure.type === "TOTAL") {
        const recordCase = draft.cases.find((candidate) => candidate.id === closure.caseId);
        if (recordCase) recordCase.status = "CLOSED";
      }
      audit("APPROVE_INVENTORY_CLOSURE", id, "Cierre aprobado y bloqueado.");
    });
  }

  function createKit(input) {
    requirePermission("inventory:write");
    const kit = {
      id: uid("KIT"),
      name: input.name,
      code: input.code,
      active: true,
      items: clone(input.items || [])
    };
    setState((draft) => {
      draft.kits.unshift(kit);
      audit("CREATE_KIT", kit.id, `Kit creado: ${kit.name}.`);
    });
    return kit;
  }

  function createCatalogItem(input) {
    requirePermission("catalogs:write");
    const item = {
      id: uid("CAT"),
      sku: input.sku,
      category: input.category,
      name: input.name,
      unit: input.unit,
      price: Number(input.price || 0),
      cost: Number(input.cost || 0),
      taxable: Boolean(input.taxable),
      requiresLot: Boolean(input.requiresLot),
      active: true
    };
    setState((draft) => {
      draft.catalogItems.unshift(item);
      audit("CREATE_CATALOG_ITEM", item.id, `Ítem de catálogo creado: ${item.name}.`);
    });
    return item;
  }

  function createDiscountRule(input) {
    requirePermission("catalogs:write");
    const rule = {
      id: uid("DISC"),
      name: input.name,
      type: input.type || "PROFILE",
      categories: clone(input.categories || {}),
      requiresReason: true,
      requiresApproval: Boolean(input.requiresApproval),
      active: true
    };
    setState((draft) => {
      draft.discountRules.unshift(rule);
      audit("CREATE_DISCOUNT_RULE", rule.id, `Perfil de descuento creado: ${rule.name}.`);
    });
    return rule;
  }

  function generateDoctorStatements() {
    requirePermission("statements:write");
    setState((draft) => {
      for (const statement of draft.doctorStatements) {
        if (statement.status === "DRAFT") statement.status = "READY_TO_SEND";
      }
      audit("GENERATE_DOCTOR_STATEMENTS", "2026-08", "Corte de estados de cuenta generado.");
    });
  }

  function sendDoctorStatement(id, channel = "EMAIL") {
    requirePermission("statements:write");
    setState((draft) => {
      const statement = draft.doctorStatements.find((candidate) => candidate.id === id);
      if (!statement) throw new Error("Estado de cuenta no encontrado.");
      const doctor = draft.doctors.find((candidate) => candidate.id === statement.doctorId);
      statement.status = "SENT";
      statement.sentAt = nowIso();
      audit("SEND_DOCTOR_STATEMENT", id, `Estado de cuenta enviado por ${channel}.`);
    });
    const statement = state.doctorStatements.find((candidate) => candidate.id === id);
    if (statement) queueNotification({
      templateCode: "DOCTOR_STATEMENT", channel, recipientId: statement.doctorId,
      relatedEntityType: "DOCTOR_STATEMENT", relatedEntityId: statement.id, idempotencyKey: `NOT:DOCTOR_STATEMENT:${statement.id}:${channel}`
    });
  }

  function addNotification(input) {
    return queueNotification(input);
  }

  function updateRuntimeMeta(patch) {
    setState((draft) => {
      draft.meta = { ...draft.meta, ...patch };
    });
  }

  return {
    config,
    getState: () => state,
    currentUser,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    save,
    reset,
    authenticate,
    recoverPassword,
    logout,
    patientById,
    caseById,
    quoteById,
    createPatient,
    importPatients,
    updatePatient,
    createCase,
    updateCase,
    createQuote,
    reviseQuote,
    updateQuoteDraft,
    quoteVersions,
    updateQuoteStatus,
    sendQuote,
    createPayment,
    startAdministrativeExecution,
    reversePayment,
    createClinicalDocument,
    createClinicalProfile,
    validateHealthReportRange,
    updateClinicalDocument,
    signClinicalDocument,
    voidClinicalDocument,
    createClinicalCorrection,
    clinicalHistory,
    clinicalRecordStatus,
    createMedicationCard,
    signMedicationCard,
    voidClinicalRecord,
    addVitalSigns,
    addNursingNote,
    shareNursingNote,
    createShift,
    createPurchase,
    createInventoryMovement,
    createInventoryClosure,
    approveInventoryClosure,
    createKit,
    createCatalogItem,
    createDiscountRule,
    generateDoctorStatements,
    sendDoctorStatement,
    addNotification,
    queueNotification,
    statementBalance,
    updateRuntimeMeta
  };
}
