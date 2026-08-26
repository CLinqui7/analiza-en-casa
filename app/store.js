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

function clone(value) {
  return structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function loadLocalState() {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(seedData);
    const parsed = JSON.parse(raw);
    if (parsed?.meta?.schemaVersion !== seedData.meta.schemaVersion) return clone(seedData);
    return parsed;
  } catch {
    return clone(seedData);
  }
}

export async function createAppStore(config) {
  let state = loadLocalState();
  state.clinicalCorrections ||= [];
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
  let adapter = await createSupabaseAdapter(config);
  const listeners = new Set();

  if (adapter.mode === "supabase") {
    try {
      const remote = await adapter.bootstrap();
      if (remote && Object.values(remote).some((collection) => collection?.length)) {
        state = { ...state, ...remote, meta: { ...state.meta, remoteBootstrappedAt: nowIso() } };
      }
    } catch (error) {
      state.meta.remoteError = error.message;
      state.meta.remoteFallback = true;
    }
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
    return state.users.find((user) => user.id === state.session.userId) || state.users[0];
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

  function login(userId, role = null) {
    const user = state.users.find((candidate) => candidate.id === userId);
    if (!user) throw new Error("Usuario demo no encontrado.");
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

  function logout() {
    setState((draft) => {
      audit("LOGOUT", draft.session.userId, "Cierre de sesión.");
      draft.session.authenticated = false;
    });
  }

  function reset() {
    state = clone(seedData);
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    for (const listener of listeners) listener(state);
  }

  function createPatient(input) {
    requirePermission("patients:write");
    const patient = {
      id: uid("PAT"),
      documentType: input.documentType || "DUI",
      document: input.document.trim(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      fullName: `${input.firstName} ${input.lastName}`.trim(),
      birthDate: input.birthDate || "",
      sex: input.sex || "",
      bloodType: input.bloodType || "",
      nationality: input.nationality || "Salvadoreña",
      phone: input.phone || "",
      email: input.email || "",
      address: input.address || "",
      geo: input.geo || "",
      triage: input.triage || "BAJA",
      status: "ACTIVE",
      insurerId: input.insurerId || null,
      planId: input.planId || null,
      policy: input.policy || "",
      policyValidUntil: input.policyValidUntil || "",
      contactName: input.contactName || "",
      contactPhone: input.contactPhone || "",
      notifyWhatsApp: Boolean(input.notifyWhatsApp),
      notifySms: Boolean(input.notifySms),
      notifyEmail: Boolean(input.notifyEmail)
    };

    const duplicate = state.patients.some((existing) =>
      existing.documentType === patient.documentType
      && existing.document.replace(/\s/g, "") === patient.document.replace(/\s/g, "")
    );
    if (duplicate) throw new Error("Ya existe un paciente con ese documento.");

    setState((draft) => {
      draft.patients.unshift(patient);
      audit("CREATE_PATIENT", patient.id, `Paciente ficticio creado: ${patient.fullName}.`);
    });
    safeSync("CREATE_PATIENT", { patient });
    return patient;
  }

  function updatePatient(id, patch) {
    requirePermission("patients:write");
    let updated;
    setState((draft) => {
      const patient = draft.patients.find((record) => record.id === id);
      if (!patient) throw new Error("Paciente no encontrado.");
      Object.assign(patient, patch);
      if (patch.firstName || patch.lastName) patient.fullName = `${patient.firstName} ${patient.lastName}`.trim();
      updated = clone(patient);
      audit("UPDATE_PATIENT", id, `Datos administrativos actualizados para ${patient.fullName}.`);
    });
    return updated;
  }

  function createCase(input) {
    requirePermission("cases:write");
    if (!patientById(input.patientId)) throw new Error("Paciente no encontrado.");
    const sequence = state.cases.length + 196;
    const record = {
      id: `HOS-${new Date().getFullYear()}-${String(sequence).padStart(4, "0")}`,
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
      Object.assign(record, patch);
      audit("UPDATE_CASE", id, `Hospitalización actualizada: ${Object.keys(patch).join(", ")}.`);
    });
  }

  function createQuote(input) {
    requirePermission("quotes:write");
    const recordCase = caseById(input.caseId);
    if (!recordCase) throw new Error("Seleccione una hospitalización válida.");
    const patient = patientById(recordCase.patientId);
    if (!patient) throw new Error("Paciente no encontrado.");
    if (!input.items?.length) throw new Error("La cotización requiere al menos un concepto.");

    const missingPrice = input.items.some((item) => !(Number(item.unitPrice) >= 0));
    if (missingPrice) throw new Error("Hay conceptos sin precio.");

    const calculation = calculateQuote(
      input.items,
      input.discount || { type: "PERCENT", value: 0 },
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
      items: input.items.map((item) => ({
        id: item.id || uid("QTI"),
        catalogItemId: item.catalogItemId || null,
        category: item.category,
        name: item.name,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discountAmount: Number(item.discountAmount || 0)
      })),
      discount: input.discount || { type: "PERCENT", value: 0, reason: "" },
      ...calculation,
      comments: input.comments || "",
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

    setState((draft) => {
      draft.quotes.unshift(quote);
      recordCase.nextAction = "Revisar y enviar cotización.";
      audit("CREATE_QUOTE", quote.id, `Cotización creada para ${patient.fullName} por ${quote.total}.`);
    });
    safeSync("CREATE_QUOTE", { quote });
    return quote;
  }

  function reviseQuote(id, input) {
    requirePermission("quotes:write");
    const original = quoteById(id);
    if (!original) throw new Error("Cotización no encontrada.");
    assertCurrentOrganization(original, "Cotización");
    const revisionReason = String(input.revisionReason || "").trim();
    if (!revisionReason) throw new Error("Indique el motivo de la nueva versión.");
    const calculation = calculateQuote(
      input.items || original.items,
      input.discount || original.discount,
      input.insurerAmount ?? original.insurerAmount
    );
    const rootId = quoteRootId(original);
    const nextVersion = quoteVersions(original).reduce((highest, candidate) => Math.max(highest, Number(candidate.version || 0)), 0) + 1;
    let revised;
    setState((draft) => {
      const source = draft.quotes.find((candidate) => candidate.id === id);
      if (!source) throw new Error("Cotización no encontrada.");
      revised = {
        ...clone(source),
        id: uid("QTV"),
        quoteId: rootId,
        originalQuoteId: source.originalQuoteId || rootId,
        previousVersionId: source.id,
        version: nextVersion,
        status: "DRAFT",
        immutable: false,
        sentAt: null,
        sentSnapshot: null,
        revisionReason,
        createdBy: currentUser().id,
        createdAt: nowIso(),
        items: (input.items || source.items).map((item) => ({ ...clone(item), id: uid("QTI") })),
        discount: clone(input.discount || source.discount),
        comments: input.comments ?? source.comments,
        ...calculation,
        portalToken: `demo-${uid("portal").toLowerCase()}`,
        expiresAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString()
      };
      draft.quotes.unshift(revised);
      audit("CREATE_QUOTE_REVISION", revised.id, `Versión ${revised.version} creada desde ${source.id}; motivo: ${revisionReason}.`, {
        quoteId: rootId,
        previousVersionId: source.id,
        version: revised.version
      });
    });
    safeSync("CREATE_QUOTE_REVISION", { quote: revised, sourceQuoteId: id });
    return revised;
  }

  function updateQuoteDraft(id, input) {
    requirePermission("quotes:write");
    const original = quoteById(id);
    if (!original) throw new Error("Cotización no encontrada.");
    assertCurrentOrganization(original, "Cotización");
    if (original.status !== "DRAFT" || quoteIsImmutable(original)) {
      throw new Error("La versión enviada no se puede editar. Cree una nueva versión.");
    }
    const calculation = calculateQuote(
      input.items || original.items,
      input.discount || original.discount,
      input.insurerAmount ?? original.insurerAmount
    );
    let updated;
    setState((draft) => {
      const quote = draft.quotes.find((candidate) => candidate.id === id);
      if (!quote) throw new Error("Cotización no encontrada.");
      quote.items = clone(input.items || quote.items);
      quote.discount = clone(input.discount || quote.discount);
      quote.comments = input.comments ?? quote.comments;
      Object.assign(quote, calculation);
      updated = clone(quote);
      audit("UPDATE_QUOTE_DRAFT", quote.id, `Borrador v${quote.version} actualizado.`, {
        quoteId: quoteRootId(quote),
        version: quote.version
      });
    });
    safeSync("UPDATE_QUOTE_DRAFT", { quote: updated });
    return updated;
  }

  function updateQuoteStatus(quoteId, status, note = "", approvedAmount = null) {
    requirePermission("insurance:write");
    const eventId = uid("QSE");
    setState((draft) => {
      const quote = draft.quotes.find((candidate) => candidate.id === quoteId);
      if (!quote) throw new Error("Cotización no encontrada.");
      assertCurrentOrganization(quote, "Cotización");
      if (!canTransitionQuote(quote.status, status)) {
        throw new Error(`Transición no permitida: ${quote.status} → ${status}.`);
      }
      const previousStatus = quote.status;
      if (quoteIsImmutable(quote) && approvedAmount !== null && approvedAmount !== "" && Number(approvedAmount) !== Number(quote.insurerAmount)) {
        throw new Error("La cobertura de una versión enviada es inmutable. Cree una nueva versión.");
      }
      quote.status = status;
      if (approvedAmount !== null && approvedAmount !== "") {
        quote.insurerAmount = roundMoney(Math.min(Number(approvedAmount), quote.total));
        quote.patientAmount = roundMoney(Math.max(0, quote.total - quote.insurerAmount));
      }
      const request = draft.insuranceRequests.find((candidate) => candidate.quoteId === quoteId);
      if (request) {
        request.status = status;
        request.approvedAmount = quote.insurerAmount;
        request.lastNote = note || request.lastNote;
        request.events.push({ date: nowIso(), status, note });
      } else if (["SENT_TO_INSURER", "INSURER_REVIEW", "INFO_REQUIRED", "PARTIALLY_APPROVED", "APPROVED", "REJECTED"].includes(status)) {
        draft.insuranceRequests.unshift({
          id: uid("PRE"),
          quoteId,
          insurerId: patientById(quote.patientId)?.insurerId || null,
          status,
          submittedAt: nowIso(),
          approvedAmount: quote.insurerAmount,
          requestedDocuments: [],
          claimNumber: "",
          lastNote: note,
          events: [{ date: nowIso(), status, note }]
        });
      }
      draft.notifications.unshift({
        id: uid("NOT"),
        date: nowIso(),
        channel: "WHATSAPP",
        target: "•••• " + (patientById(quote.patientId)?.phone || "").slice(-4),
        subject: `Actualización ${quote.id}`,
        status: "QUEUED",
        safePreview: "Su solicitud tiene una actualización. Consulte el portal seguro."
      });
      audit("UPDATE_QUOTE_STATUS", quoteId, `Estado actualizado de ${previousStatus} a ${status}. ${note}`, {
        quoteId: quoteRootId(quote),
        version: quote.version
      });
    });
    safeSync("UPDATE_QUOTE_STATUS", { quoteId, status, note, eventId });
  }

  function sendQuote(quoteId, channel = "WHATSAPP") {
    requirePermission("quotes:write");
    setState((draft) => {
      const quote = draft.quotes.find((candidate) => candidate.id === quoteId);
      if (!quote) throw new Error("Cotización no encontrada.");
      assertCurrentOrganization(quote, "Cotización");
      if (quoteIsImmutable(quote)) throw new Error("La versión ya fue enviada y no puede enviarse nuevamente.");
      if (!["DRAFT", "READY_TO_SEND"].includes(quote.status)) {
        throw new Error("Sólo se puede enviar una versión en borrador o lista para enviar.");
      }
      if (quote.items.some((item) => item.unitPrice === null || item.unitPrice === undefined)) {
        throw new Error("No se puede enviar una cotización con precios faltantes.");
      }
      if (quote.status === "DRAFT") quote.status = "SENT_TO_PATIENT";
      quote.sentAt = nowIso();
      quote.immutable = true;
      quote.sentSnapshot = clone({
        ...quote,
        sentSnapshot: undefined,
        items: quote.items,
        discount: quote.discount
      });
      const patient = patientById(quote.patientId);
      draft.notifications.unshift({
        id: uid("NOT"),
        date: nowIso(),
        channel,
        target: channel === "EMAIL" ? patient?.email : "•••• " + (patient?.phone || "").slice(-4),
        subject: `Cotización ${quote.id} · v${quote.version}`,
        status: config.notificationsMode === "mock" ? "DELIVERED" : "QUEUED",
        safePreview: "Su cotización está disponible en el portal seguro."
      });
      audit("SEND_QUOTE", quoteId, `Cotización v${quote.version} enviada por ${channel} y bloqueada.`, {
        quoteId: quoteRootId(quote),
        version: quote.version,
        channel
      });
    });
    safeSync("SEND_QUOTE_VERSION", { quote: quoteById(quoteId), channel });
  }

  function createPayment(input) {
    requirePermission("payments:write");
    const quote = quoteById(input.quoteId);
    if (!quote) throw new Error("Cotización no encontrada.");
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
      patientId: quote.patientId,
      date: nowIso(),
      method: input.method || "TRANSFER",
      payer: input.payer || patientById(quote.patientId)?.contactName || "Paciente",
      reference: validation.reference,
      amount: validation.amount,
      status: "APPLIED",
      receipt: uid("REC")
    };

    setState((draft) => {
      draft.payments.unshift(payment);
      const remaining = quoteBalance(quote, draft.payments);
      if (remaining <= 0.01 && quote.status === "PATIENT_PAYMENT") quote.status = "SERVICE_SCHEDULED";
      audit("CREATE_PAYMENT", payment.id, `Pago ${payment.amount} aplicado a ${quote.id}.`);
    });
    safeSync("CREATE_PAYMENT", { payment });
    return payment;
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
    setState((draft) => {
      const note = draft.nursingNotes.find((candidate) => candidate.id === id);
      if (!note) throw new Error("Nota no encontrada.");
      if (note.status !== "SIGNED") throw new Error("La nota debe estar firmada antes de compartirla.");
      note.shareStatus = "SHARED_WITH_DOCTOR";
      note.sharedAt = nowIso();
      draft.notifications.unshift({
        id: uid("NOT"),
        date: nowIso(),
        channel: "WHATSAPP",
        target: "Médico contratante",
        subject: `Nota clínica ${note.caseId}`,
        status: config.notificationsMode === "mock" ? "DELIVERED" : "QUEUED",
        safePreview: "Hay una nota clínica disponible en el portal profesional seguro."
      });
      audit("SHARE_NURSING_NOTE", id, "Nota compartida con médico mediante enlace seguro.");
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
    const quantity = Number(input.quantity);
    if (!(quantity > 0)) throw new Error("La cantidad debe ser mayor que cero.");

    const movement = {
      id: uid("MOV"),
      inventoryItemId: item.id,
      caseId: input.caseId || "",
      type: input.type,
      quantity,
      date: nowIso(),
      warehouseFrom: input.warehouseFrom || item.warehouseId,
      warehouseTo: input.warehouseTo || "",
      reference: input.reference || "",
      authorName: currentUser().name,
      note: input.note || ""
    };

    setState((draft) => {
      const target = draft.inventoryItems.find((candidate) => candidate.id === item.id);
      switch (movement.type) {
        case "PURCHASE_ENTRY":
        case "POSITIVE_ADJUSTMENT":
        case "RETURN_TO_STOCK":
          target.stock += quantity;
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
        case "TRANSFER":
          // En el demo se conserva el total y se audita la ubicación.
          if (movement.warehouseTo) target.warehouseId = movement.warehouseTo;
          break;
        default:
          break;
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
      draft.notifications.unshift({
        id: uid("NOT"),
        date: nowIso(),
        channel,
        target: doctor?.email || doctor?.name,
        subject: `Estado de cuenta ${statement.periodStart} a ${statement.periodEnd}`,
        status: config.notificationsMode === "mock" ? "DELIVERED" : "QUEUED",
        safePreview: "Su estado de cuenta está disponible en el portal profesional."
      });
      audit("SEND_DOCTOR_STATEMENT", id, `Estado de cuenta enviado por ${channel}.`);
    });
  }

  function addNotification(input) {
    setState((draft) => {
      draft.notifications.unshift({
        id: uid("NOT"),
        date: nowIso(),
        status: config.notificationsMode === "mock" ? "DELIVERED" : "QUEUED",
        ...input
      });
      audit("CREATE_NOTIFICATION", input.subject || "Notificación", `Notificación creada por ${input.channel}.`);
    });
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
    login,
    logout,
    patientById,
    caseById,
    quoteById,
    createPatient,
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
    createClinicalDocument,
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
    statementBalance,
    updateRuntimeMeta
  };
}
