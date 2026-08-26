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
    sent_at: record.sentAt || null
  };
}

export async function createSupabaseAdapter(config) {
  if (config.dataMode !== "supabase") {
    return {
      mode: "mock",
      async bootstrap() { return null; },
      async sync() { return { ok: true, mode: "mock" }; }
    };
  }

  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    throw new Error("Supabase está activado, pero faltan URL o publishable key.");
  }

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  async function bootstrap() {
    const collections = {};
    const queries = [
      ["patients", "patients", "*"],
      ["cases", "hospitalizations", "*"],
      ["quotes", "quotes", "*, quote_versions(*, quote_items(*))"],
      ["payments", "payments", "*"],
      ["clinicalDocuments", "clinical_documents", "*"],
      ["shifts", "shifts", "*"],
      ["purchases", "purchases", "*, purchase_items(*)"],
      ["inventoryItems", "inventory_items", "*"],
      ["inventoryMovements", "inventory_movements", "*"],
      ["doctors", "doctors", "*"],
      ["doctorStatements", "doctor_statements", "*, doctor_statement_items(*)"],
      ["notifications", "notifications", "*"],
      ["auditLogs", "audit_logs", "*"]
    ];

    for (const [key, table, select] of queries) {
      const { data, error } = await client.from(table).select(select).limit(500);
      if (error) throw error;
      collections[key] = data || [];
    }
    return collections;
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
        await insert("quotes", toQuoteRow(quote));
        const version = await insert("quote_versions", {
          quote_id: quote.id,
          version: quote.version,
          status_snapshot: quote.status,
          subtotal: quote.subtotal,
          discount_amount: quote.discountAmount,
          total: quote.total,
          insurer_amount: quote.insurerAmount,
          patient_amount: quote.patientAmount,
          discount_snapshot: snakeCaseObject(quote.discount || {}),
          comments: quote.comments || null,
          immutable: Boolean(quote.immutable),
          revision_reason: quote.revisionReason || null,
          snapshot: snakeCaseObject(quote.sentSnapshot || quote)
        });
        const rows = quote.items.map((item, index) => ({
          quote_version_id: version.id,
          catalog_item_id: item.catalogItemId || null,
          category: item.category,
          description: item.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount_amount: item.discountAmount || 0
        }));
        if (rows.length) {
          const { error } = await client.from("quote_items").insert(rows);
          if (error) throw error;
        }
        return { ok: true };
      }
      case "CREATE_QUOTE_REVISION": {
        const { data, error } = await client.rpc("create_quote_revision", {
          p_quote_id: payload.quote.quoteId,
          p_source_version_id: payload.sourceQuoteId,
          p_reason: payload.quote.revisionReason
        });
        if (error) throw error;
        return { ok: true, quoteVersionId: data };
      }
      case "UPDATE_QUOTE_DRAFT": {
        const quote = payload.quote;
        const { error: quoteError } = await client.from("quotes")
          .update(toQuoteRow(quote))
          .eq("id", quote.quoteId || quote.id);
        if (quoteError) throw quoteError;
        const { error: versionError } = await client.from("quote_versions")
          .update({
            subtotal: quote.subtotal,
            discount_amount: quote.discountAmount,
            total: quote.total,
            insurer_amount: quote.insurerAmount,
            patient_amount: quote.patientAmount,
            discount_snapshot: snakeCaseObject(quote.discount || {}),
            comments: quote.comments || null,
            snapshot: snakeCaseObject(quote)
          })
          .eq("id", quote.id);
        if (versionError) throw versionError;
        const { error: deleteError } = await client.from("quote_items").delete().eq("quote_version_id", quote.id);
        if (deleteError) throw deleteError;
        const rows = quote.items.map((item) => ({
          quote_version_id: quote.id,
          catalog_item_id: item.catalogItemId || null,
          category: item.category,
          description: item.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount_amount: item.discountAmount || 0
        }));
        if (rows.length) {
          const { error } = await client.from("quote_items").insert(rows);
          if (error) throw error;
        }
        return { ok: true };
      }
      case "UPDATE_QUOTE_STATUS": {
        const { error } = await client.rpc("transition_quote_status", {
          p_quote_id: payload.quoteId,
          p_to_status: payload.status,
          p_note: payload.note || null
        });
        if (error) throw error;
        return { ok: true };
      }
      case "SEND_QUOTE_VERSION": {
        const quote = payload.quote;
        const { error } = await client.rpc("send_quote_version", {
          p_quote_id: quote.quoteId || quote.id,
          p_quote_version_id: quote.id
        });
        if (error) throw error;
        return { ok: true };
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
      case "CREATE_PAYMENT":
        return insert("payments", {
          id: payload.payment.id,
          quote_id: payload.payment.quoteId,
          patient_id: payload.payment.patientId,
          paid_at: payload.payment.date,
          method: payload.payment.method,
          payer_name: payload.payment.payer,
          external_reference: payload.payment.reference || null,
          amount: payload.payment.amount,
          status: payload.payment.status
        });
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
        return insert("inventory_movements", {
          id: payload.movement.id,
          inventory_item_id: payload.movement.inventoryItemId,
          hospitalization_id: payload.movement.caseId || null,
          movement_type: payload.movement.type,
          quantity: payload.movement.quantity,
          warehouse_from_id: payload.movement.warehouseFrom || null,
          warehouse_to_id: payload.movement.warehouseTo || null,
          reference: payload.movement.reference || null,
          note: payload.movement.note || null
        });
      default:
        return { ok: true, skipped: true, action };
    }
  }

  return { mode: "supabase", client, bootstrap, sync };
}
