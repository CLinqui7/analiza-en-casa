const TABLE_MAP = {
  patients: "patients",
  cases: "hospitalizations",
  quotes: "quotes",
  payments: "payments",
  clinicalDocuments: "clinical_documents",
  shifts: "shifts",
  purchases: "purchases",
  inventoryMovements: "inventory_movements",
  notifications: "notifications"
};

function snakeCaseObject(input) {
  if (Array.isArray(input)) return input.map(snakeCaseObject);
  if (!input || typeof input !== "object") return input;
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [
    key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
    snakeCaseObject(value)
  ]));
}

function camelCaseObject(input) {
  if (Array.isArray(input)) return input.map(camelCaseObject);
  if (!input || typeof input !== "object") return input;
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [
    key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
    camelCaseObject(value)
  ]));
}

export function mapSupabaseBootstrap(rawCollections = {}) {
  const collections = { ...rawCollections };
  collections.patients = (rawCollections.patients || []).map((raw) => {
    const patient = camelCaseObject(raw);
    return {
      ...patient,
      document: patient.documentNumber,
      fullName: `${patient.firstName || ""} ${patient.lastName || ""}`.trim(),
      organizationId: patient.organizationId
    };
  });
  collections.cases = (rawCollections.cases || []).map((raw) => {
    const record = camelCaseObject(raw);
    return {
      ...record,
      patientId: record.patientId,
      insurerId: record.insurerId,
      accountType: record.accountType,
      manager: record.administrativeManagerName || "",
      contractingDoctorId: record.contractingDoctorId,
      startDate: record.startDate,
      endDate: record.endDate,
      diagnosisSummary: record.diagnosisSummary,
      nextAction: record.nextAction,
      organizationId: record.organizationId
    };
  });

  collections.quotes = (rawCollections.quotes || []).flatMap((rawQuote) => {
    const root = camelCaseObject(rawQuote);
    return (root.quoteVersions || []).map((version) => ({
      id: version.id,
      displayCode: root.code,
      quoteId: root.id,
      originalQuoteId: root.id,
      caseId: root.hospitalizationId,
      patientId: root.patientId,
      organizationId: root.organizationId,
      status: version.version === root.currentVersion ? root.status : version.statusSnapshot,
      version: version.version,
      currency: root.currency,
      subtotal: Number(version.subtotal),
      discountAmount: Number(version.discountAmount),
      total: Number(version.total),
      insurerAmount: Number(version.insurerAmount),
      patientAmount: Number(version.patientAmount),
      discount: version.discountSnapshot || {},
      comments: version.comments || "",
      invoiceDate: version.invoiceDate || root.invoiceDate || "",
      discountGroupId: version.discountGroupId || root.discountGroupId || "REGULAR",
      referredBy: version.referredBy || root.referredBy || "",
      giftcard: version.giftcard || root.giftcard || "",
      priceListId: version.priceListId || null,
      immutable: Boolean(version.immutable),
      sentAt: version.sentAt || (version.version === root.currentVersion ? root.sentAt : null),
      createdAt: version.createdAt,
      items: (version.quoteItems || []).map((item) => ({
        id: item.id,
        catalogItemId: item.catalogItemId,
        category: item.category,
        name: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discountAmount: Number(item.discountAmount || 0)
      }))
    }));
  });

  const currentVersionByRoot = new Map(
    collections.quotes
      .slice()
      .sort((left, right) => Number(left.version) - Number(right.version))
      .map((quote) => [quote.quoteId, quote.id])
  );
  collections.insuranceRequests = (rawCollections.insuranceRequests || []).map((raw) => {
    const request = camelCaseObject(raw);
    return {
      ...request,
      rootQuoteId: request.quoteId,
      quoteId: currentVersionByRoot.get(request.quoteId) || request.quoteId,
      requestedAmount: Number(request.requestedAmount || 0),
      approvedAmount: Number(request.approvedAmount || 0),
      events: (request.insuranceRequestEvents || [])
        .map((event) => ({ ...event, date: event.createdAt }))
        .sort((left, right) => String(left.date).localeCompare(String(right.date)))
    };
  });
  collections.notifications = (rawCollections.notifications || []).map((raw) => {
    const notification = camelCaseObject(raw);
    return { ...notification, target: notification.destinationMasked, date: notification.createdAt };
  });
  collections.administrativeExecutionProfiles = (rawCollections.administrativeExecutionProfiles || []).map((raw) => {
    const profile = camelCaseObject(raw);
    return {
      ...profile,
      caseId: profile.hospitalizationId,
      rootQuoteId: profile.quoteId,
      quoteId: profile.quoteVersionId,
      patientId: profile.patientId,
      durationDays: Number(profile.durationDays || 0)
    };
  });
  collections.payments = (rawCollections.payments || []).map((raw) => {
    const payment = camelCaseObject(raw);
    const quoteVersionId = payment.quoteVersionId || currentVersionByRoot.get(payment.quoteId) || payment.quoteId;
    return {
      ...payment,
      rootQuoteId: payment.quoteId,
      quoteId: quoteVersionId,
      quoteVersionId,
      caseId: payment.hospitalizationId || "",
      date: payment.paidAt || payment.createdAt,
      reference: payment.externalReference,
      receipt: payment.receiptCode || payment.paymentReceipts?.[0]?.receiptCode || "",
      amount: Number(payment.amount || 0),
      allocations: (payment.paymentAllocations || []).map((allocation) => ({
        ...allocation,
        quoteId: allocation.quoteVersionId || quoteVersionId,
        rootQuoteId: allocation.quoteId,
        amount: Number(allocation.amount || 0)
      }))
    };
  });
  return collections;
}

function toPatientRow(patient) {
  return {
    id: patient.id,
    document_type: patient.documentType,
    document_number: patient.document,
    first_name: patient.firstName,
    last_name: patient.lastName,
    birth_date: patient.birthDate || null,
    sex: patient.sex,
    blood_type: patient.bloodType || null,
    nationality: patient.nationality || null,
    phone: patient.phone || null,
    email: patient.email || null,
    triage: patient.triage || "BAJA",
    status: patient.status || "ACTIVE"
  };
}

function toCaseRow(record) {
  return {
    id: record.id,
    patient_id: record.patientId,
    insurer_id: record.insurerId || null,
    account_type: record.accountType,
    administrative_manager: record.manager,
    start_date: record.startDate,
    end_date: record.endDate || null,
    status: record.status,
    priority: record.priority,
    diagnosis_summary: record.diagnosisSummary || null,
    contracting_doctor_id: record.contractingDoctorId || null,
    next_action: record.nextAction || null
  };
}

function toQuoteRow(record) {
  return {
    id: record.id,
    code: record.id,
    hospitalization_id: record.caseId,
    patient_id: record.patientId,
    status: record.status,
    current_version: record.version,
    currency: record.currency || "USD",
    subtotal: record.subtotal,
    discount_amount: record.discountAmount,
    total: record.total,
    insurer_amount: record.insurerAmount,
    patient_amount: record.patientAmount,
    comments: record.comments || null,
    invoice_date: record.invoiceDate,
    discount_group_id: record.discountGroupId,
    referred_by: record.referredBy,
    giftcard: record.giftcard || null,
    sent_at: record.sentAt || null
  };
}

export async function createSupabaseAdapter(config) {
  if (config.dataMode !== "supabase") {
    return {
      mode: "mock",
      async bootstrap() { return null; },
      async sync() { return { ok: true, mode: "mock" }; },
      async signOut() { return { ok: true, mode: "mock" }; }
    };
  }

  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    throw new Error("Supabase está activado, pero faltan URL o publishable key.");
  }

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.112.4");
  const client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  async function signInWithPassword(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data?.user) throw new Error("No fue posible iniciar sesión con esas credenciales.");
    return data.user;
  }

  async function getSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async function loadCurrentProfile(userId) {
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("id, organization_id, full_name, status, organizations(id, name, slug, currency, timezone)")
      .eq("id", userId)
      .single();
    if (profileError || profile?.status !== "ACTIVE") throw new Error("El usuario no tiene un perfil activo autorizado.");
    const { data: assignments, error: roleError } = await client
      .from("user_roles")
      .select("roles(code)")
      .eq("user_id", userId);
    if (roleError) throw new Error("No fue posible cargar los permisos del usuario.");
    const role = assignments?.map((assignment) => assignment.roles?.code).find(Boolean);
    if (!role) throw new Error("El usuario no tiene un rol autorizado.");
    return { ...profile, role };
  }

  async function resetPasswordForEmail(email) {
    const redirectTo = new URL("#/auth/update-password", config.appUrl || location.origin).toString();
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw new Error("No fue posible completar la solicitud de recuperación.");
    return { ok: true };
  }

  async function signOut() {
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw new Error("No fue posible cerrar la sesión.");
    return { ok: true };
  }

  async function bootstrap() {
    const rawCollections = {};
    const queries = [
      ["patients", "patients", "*"],
      ["cases", "hospitalizations", "*"],
      ["quotes", "quotes", "*, quote_versions(*, quote_items(*))"],
      ["payments", "payments", "*, payment_allocations(*), payment_receipts(*)"],
      ["clinicalDocuments", "clinical_documents", "*"],
      ["shifts", "shifts", "*"],
      ["purchases", "purchases", "*, purchase_items(*)"],
      ["inventoryItems", "inventory_items", "*"],
      ["inventoryMovements", "inventory_movements", "*"],
      ["doctors", "doctors", "*"],
      ["doctorStatements", "doctor_statements", "*, doctor_statement_items(*)"],
      ["insuranceRequests", "insurance_requests", "*, insurance_request_events(*)"],
      ["administrativeExecutionProfiles", "administrative_execution_profiles", "*"],
      ["notifications", "notifications", "*"],
      ["auditLogs", "audit_logs", "*"]
    ];

    for (const [key, table, select] of queries) {
      const { data, error } = await client.from(table).select(select).limit(500);
      if (error) throw error;
      rawCollections[key] = data || [];
    }
    return mapSupabaseBootstrap(rawCollections);
  }

  async function insert(table, row) {
    const { data, error } = await client.from(table).insert(row).select().single();
    if (error) throw error;
    return data;
  }

  async function sync(action, payload) {
    switch (action) {
      case "CREATE_PATIENT":
        return insert("patients", toPatientRow(payload.patient));
      case "CREATE_CASE":
        return insert("hospitalizations", toCaseRow(payload.case));
      case "CREATE_QUOTE": {
        const quote = payload.quote;
        const { data, error } = await client.rpc("create_quote_draft", {
          p_code: quote.id,
          p_hospitalization_id: quote.caseId,
          p_patient_id: quote.patientId,
          p_price_list_id: quote.priceListId || null,
          p_items: quote.items.map((item) => ({ catalog_item_id: item.catalogItemId, quantity: item.quantity })),
          p_currency: quote.currency || "USD",
          p_insurer_amount: quote.insurerAmount || 0,
          p_invoice_date: quote.invoiceDate,
          p_discount_group_id: quote.discountGroupId,
          p_discount_reason: quote.discount?.reason || "",
          p_referred_by: quote.referredBy,
          p_giftcard: quote.giftcard || "",
          p_comments: quote.comments
        });
        if (error) throw error;
        return { ok: true, ...data };
      }
      case "CREATE_QUOTE_REVISION": {
        const quote = payload.quote;
        const { data, error } = await client.rpc("create_quote_revision_catalog", {
          p_quote_id: quote.quoteId,
          p_source_version_id: payload.sourceQuoteId,
          p_reason: quote.revisionReason,
          p_price_list_id: quote.priceListId || null,
          p_items: quote.items.map((item) => ({ catalog_item_id: item.catalogItemId, quantity: item.quantity })),
          p_insurer_amount: quote.insurerAmount || 0,
          p_invoice_date: quote.invoiceDate,
          p_discount_group_id: quote.discountGroupId,
          p_discount_reason: quote.discount?.reason || "",
          p_referred_by: quote.referredBy,
          p_giftcard: quote.giftcard || "",
          p_comments: quote.comments
        });
        if (error) throw error;
        return { ok: true, ...data };
      }
      case "UPDATE_QUOTE_DRAFT": {
        const quote = payload.quote;
        const { data, error } = await client.rpc("update_quote_draft_catalog", {
          p_quote_id: quote.quoteId || quote.id,
          p_quote_version_id: quote.id,
          p_price_list_id: quote.priceListId || null,
          p_items: quote.items.map((item) => ({ catalog_item_id: item.catalogItemId, quantity: item.quantity })),
          p_insurer_amount: quote.insurerAmount || 0,
          p_invoice_date: quote.invoiceDate,
          p_discount_group_id: quote.discountGroupId,
          p_discount_reason: quote.discount?.reason || "",
          p_referred_by: quote.referredBy,
          p_giftcard: quote.giftcard || "",
          p_comments: quote.comments
        });
        if (error) throw error;
        return { ok: true, ...data };
      }
      case "UPDATE_QUOTE_STATUS": {
        const { data, error } = await client.rpc("transition_quote_insurance_status", {
          p_quote_id: payload.quoteId,
          p_quote_version_id: payload.quoteVersionId,
          p_to_status: payload.status,
          p_note: payload.note,
          p_approved_amount: payload.approvedAmount,
          p_claim_number: payload.claimNumber || null,
          p_idempotency_key: payload.eventId
        });
        if (error) throw error;
        return { ok: true, ...data };
      }
      case "SEND_QUOTE_VERSION": {
        const quote = payload.quote;
        const { data, error } = await client.rpc("send_quote_version_and_queue", {
          p_quote_id: quote.quoteId || quote.id,
          p_quote_version_id: quote.id,
          p_channel: payload.channel,
          p_idempotency_key: payload.idempotencyKey
        });
        if (error) throw error;
        return { ok: true, ...data };
      }
      case "SIGN_CLINICAL_DOCUMENT":
        return client.rpc("sign_clinical_record", { p_subject_type: "CLINICAL_DOCUMENT", p_subject_id: payload.documentId });
      case "SIGN_MEDICATION_CARD":
        return client.rpc("sign_clinical_record", { p_subject_type: "MEDICATION_CARD", p_subject_id: payload.cardId });
      case "VOID_CLINICAL_DOCUMENT":
        return client.rpc("void_clinical_record", { p_subject_type: "CLINICAL_DOCUMENT", p_subject_id: payload.documentId, p_reason: payload.reason });
      case "VOID_CLINICAL_RECORD":
        return client.rpc("void_clinical_record", { p_subject_type: payload.subjectType, p_subject_id: payload.subjectId, p_reason: payload.reason });
      case "CREATE_CLINICAL_CORRECTION":
        return client.rpc("create_clinical_record_correction", {
          p_subject_type: payload.correction.subjectType,
          p_subject_id: payload.correction.subjectId,
          p_correction_kind: payload.correction.correctionKind,
          p_reason: payload.correction.reason,
          p_content: snakeCaseObject(payload.correction.content || {})
        });
      case "CREATE_PAYMENT": {
        const { data, error } = await client.rpc("apply_payment", {
          p_quote_id: payload.payment.rootQuoteId || payload.payment.quoteId,
          p_quote_version_id: payload.payment.quoteVersionId || null,
          p_hospitalization_id: payload.payment.caseId || null,
          p_patient_id: payload.payment.patientId,
          p_amount: payload.payment.amount,
          p_currency: payload.payment.currency || "USD",
          p_method: payload.payment.method,
          p_payer: payload.payment.payer || null,
          p_external_reference: payload.payment.reference || null,
          p_idempotency_key: payload.payment.idempotencyKey
        });
        if (error) throw error;
        return { ok: true, payment: camelCaseObject(data) };
      }
      case "REVERSE_PAYMENT": {
        const { data, error } = await client.rpc("reverse_payment", {
          p_payment_id: payload.paymentId,
          p_reason: payload.reason,
          p_idempotency_key: payload.idempotencyKey
        });
        if (error) throw error;
        return { ok: true, payment: camelCaseObject(data) };
      }
      case "START_ADMINISTRATIVE_EXECUTION": {
        const profile = payload.profile;
        const { data, error } = await client.rpc("start_administrative_execution", {
          p_quote_id: profile.rootQuoteId,
          p_quote_version_id: profile.quoteId,
          p_hospitalization_id: profile.caseId,
          p_health_manager: profile.healthManager,
          p_referred_by: profile.referredBy,
          p_revenue_type: profile.revenueType,
          p_service_type: profile.serviceType || null,
          p_start_date: profile.startDate,
          p_duration_days: profile.durationDays,
          p_payment_form: profile.paymentForm,
          p_insurer_id: profile.insurerId || null,
          p_request_type: profile.requestType,
          p_third_party_invoice: profile.thirdPartyInvoice,
          p_major_category: profile.majorCategory || null,
          p_service_subcategory: profile.serviceSubcategory || null,
          p_source_hospital: profile.sourceHospital || null,
          p_description: profile.description || null,
          p_patient_type: profile.patientType || null,
          p_module_type: profile.moduleType || null,
          p_additional_options: profile.additionalOptions || null,
          p_idempotency_key: profile.idempotencyKey
        });
        if (error) throw error;
        return { ok: true, profile: camelCaseObject(data) };
      }
      case "CREATE_CLINICAL_DOCUMENT":
        return insert("clinical_documents", {
          id: payload.document.id,
          hospitalization_id: payload.document.caseId,
          patient_id: payload.document.patientId,
          document_type: payload.document.type,
          title: payload.document.title,
          status: payload.document.status,
          author_id: payload.document.authorId || null,
          version_number: payload.document.version || 1,
          summary: payload.document.summary || null,
          content: payload.document.content || {}
        });
      case "CREATE_SHIFT":
        return insert("shifts", {
          id: payload.shift.id,
          hospitalization_id: payload.shift.caseId,
          patient_id: payload.shift.patientId,
          resource_id: payload.shift.resourceId || null,
          resource_name: payload.shift.resourceName,
          starts_at: payload.shift.start,
          ends_at: payload.shift.end,
          shift_type: payload.shift.type,
          status: payload.shift.status
        });
      case "CREATE_PURCHASE":
        return insert("purchases", {
          id: payload.purchase.id,
          supplier_id: payload.purchase.supplierId,
          purchase_date: payload.purchase.date,
          invoice_number: payload.purchase.invoiceNumber,
          status: payload.purchase.status,
          payment_type: payload.purchase.paymentType,
          subtotal: payload.purchase.subtotal,
          tax_amount: payload.purchase.tax,
          discount_amount: payload.purchase.discount,
          total: payload.purchase.total
        });
      case "CREATE_INVENTORY_MOVEMENT":
        return client.rpc("apply_inventory_movement_v2", {
          p_inventory_item_id: payload.movement.inventoryItemId,
          p_movement_type: payload.movement.type,
          p_quantity: payload.movement.quantity,
          p_hospitalization_id: payload.movement.caseId || null,
          p_warehouse_to_id: payload.movement.warehouseTo || null,
          p_lot_id: payload.movement.lotId || null,
          p_lot_number: payload.movement.lotNumber || null,
          p_lot_expires_at: payload.movement.lotExpiresAt || null,
          p_reference: payload.movement.reference || null,
          p_note: payload.movement.note || null,
          p_idempotency_key: payload.movement.idempotencyKey
        });
      case "QUEUE_NOTIFICATION":
        return client.rpc("queue_notification", {
          p_channel: payload.notification.channel,
          p_template_code: payload.notification.templateCode,
          p_recipient_type: payload.notification.recipientType,
          p_recipient_id: payload.notification.recipientId,
          p_related_entity_type: payload.notification.relatedEntityType,
          p_related_entity_id: payload.notification.relatedEntityId,
          p_idempotency_key: payload.notification.idempotencyKey
        });
      default:
        return { ok: true, skipped: true, action };
    }
  }

  return {
    mode: "supabase",
    client,
    bootstrap,
    sync,
    signInWithPassword,
    getSession,
    loadCurrentProfile,
    resetPasswordForEmail,
    signOut
  };
}
