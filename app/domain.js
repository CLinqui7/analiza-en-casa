const memoryStorage = new Map();

export const safeStorage = {
  getItem(key) {
    try {
      if (typeof window !== "undefined" && window.localStorage) return window.localStorage.getItem(key);
    } catch {
      // Orígenes opacos, modo archivo o políticas del navegador.
    }
    return memoryStorage.has(String(key)) ? memoryStorage.get(String(key)) : null;
  },
  setItem(key, value) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, String(value));
        return;
      }
    } catch {
      // Usa memoria durante QA.
    }
    memoryStorage.set(String(key), String(value));
  },
  removeItem(key) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch {}
    memoryStorage.delete(String(key));
  },
  clear() {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.clear();
        return;
      }
    } catch {}
    memoryStorage.clear();
  }
};

export const QUOTE_STATUS_FLOW = [
  "DRAFT",
  "READY_TO_SEND",
  "SENT_TO_PATIENT",
  "SENT_TO_INSURER",
  "INSURER_REVIEW",
  "INFO_REQUIRED",
  "PARTIALLY_APPROVED",
  "APPROVED",
  "PATIENT_PAYMENT",
  "SERVICE_SCHEDULED",
  "CLOSED"
];

export const QUOTE_STATUS_LABELS = {
  DRAFT: { admin: "Borrador", patient: "Estamos preparando su cotización", tone: "neutral" },
  READY_TO_SEND: { admin: "Lista para enviar", patient: "Su cotización está lista", tone: "info" },
  SENT_TO_PATIENT: { admin: "Enviada al paciente", patient: "Le enviamos la cotización", tone: "info" },
  SENT_TO_INSURER: { admin: "Enviada al seguro", patient: "La solicitud fue enviada a su seguro", tone: "info" },
  INSURER_REVIEW: { admin: "Seguro en revisión", patient: "Su seguro está revisando la solicitud", tone: "warning" },
  INFO_REQUIRED: { admin: "Información requerida", patient: "Estamos completando información solicitada", tone: "warning" },
  PARTIALLY_APPROVED: { admin: "Aprobación parcial", patient: "Su seguro aprobó una parte", tone: "warning" },
  APPROVED: { admin: "Aprobada", patient: "Su solicitud fue aprobada", tone: "success" },
  REJECTED: { admin: "Rechazada", patient: "La solicitud no fue aprobada", tone: "danger" },
  PATIENT_PAYMENT: { admin: "Pago del paciente", patient: "Hay un pago pendiente", tone: "warning" },
  SERVICE_SCHEDULED: { admin: "Servicio programado", patient: "El servicio puede programarse", tone: "success" },
  CLOSED: { admin: "Cerrada", patient: "El proceso fue completado", tone: "success" },
  CANCELLED: { admin: "Cancelada", patient: "El proceso fue cancelado", tone: "danger" }
};

export const CLINICAL_STATUS_LABELS = {
  DRAFT: "Borrador",
  SIGNED: "Firmado",
  CORRECTED: "Corregido",
  VOIDED: "Anulado"
};

export const ITEM_CATEGORIES = [
  "SERVICES",
  "STUDIES",
  "MEDICATIONS",
  "SUPPLIES",
  "EQUIPMENT",
  "FEES",
  "EXTRAS"
];

export const ITEM_CATEGORY_LABELS = {
  SERVICES: "Servicios",
  STUDIES: "Estudios diagnósticos",
  MEDICATIONS: "Medicamentos",
  SUPPLIES: "Insumos",
  EQUIPMENT: "Equipos",
  FEES: "Honorarios",
  EXTRAS: "Extras"
};

export function uid(prefix = "ID") {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.randomUUID) return `${prefix}-${cryptoObj.randomUUID().slice(0, 8).toUpperCase()}`;
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export function money(value, currency = "USD", locale = "es-SV") {
  const amount = Number(value || 0);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatDate(value, withTime = false, locale = "es-SV") {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const options = withTime
    ? { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }
    : { year: "numeric", month: "short", day: "2-digit" };
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export function calculateQuote(items = [], discount = { type: "PERCENT", value: 0 }, insuranceApproved = 0) {
  const categoryTotals = Object.fromEntries(ITEM_CATEGORIES.map((category) => [category, 0]));
  let subtotal = 0;

  for (const item of items) {
    const quantity = Math.max(0, Number(item.quantity || 0));
    const unitPrice = Math.max(0, Number(item.unitPrice || 0));
    const itemDiscount = Math.max(0, Number(item.discountAmount || 0));
    const lineTotal = Math.max(0, quantity * unitPrice - itemDiscount);
    subtotal += lineTotal;
    const category = ITEM_CATEGORIES.includes(item.category) ? item.category : "EXTRAS";
    categoryTotals[category] += lineTotal;
  }

  let discountAmount = 0;
  if (discount?.type === "CATEGORY_PERCENTAGES") {
    discountAmount = Object.entries(categoryTotals).reduce((sum, [category, categoryTotal]) => {
      const percentage = Math.min(100, Math.max(0, Number(discount.categories?.[category] || 0)));
      return sum + categoryTotal * percentage / 100;
    }, 0);
  } else if (discount?.type === "FIXED") discountAmount = Math.max(0, Number(discount.value || 0));
  else discountAmount = subtotal * Math.max(0, Number(discount?.value || 0)) / 100;

  discountAmount = Math.min(discountAmount, subtotal);
  const total = roundMoney(subtotal - discountAmount);
  const insurerAmount = roundMoney(Math.min(Math.max(0, Number(insuranceApproved || 0)), total));
  const patientAmount = roundMoney(Math.max(0, total - insurerAmount));

  return {
    subtotal: roundMoney(subtotal),
    discountAmount: roundMoney(discountAmount),
    total,
    insurerAmount,
    patientAmount,
    categoryTotals: Object.fromEntries(
      Object.entries(categoryTotals).map(([key, value]) => [key, roundMoney(value)])
    )
  };
}

export function validatePayment({ amount, balance, existingReferences = [], reference = "" }) {
  const numericAmount = roundMoney(amount);
  const numericBalance = roundMoney(balance);
  const normalizedReference = String(reference || "").trim().toUpperCase();

  if (!(numericAmount > 0)) return { ok: false, code: "INVALID_AMOUNT", message: "El monto debe ser mayor que cero." };
  if (numericAmount > numericBalance + 0.01) {
    return { ok: false, code: "OVERPAYMENT", message: "El pago supera el saldo pendiente." };
  }
  if (normalizedReference && existingReferences.map((x) => String(x).trim().toUpperCase()).includes(normalizedReference)) {
    return { ok: false, code: "DUPLICATE_REFERENCE", message: "La referencia ya fue registrada." };
  }
  return { ok: true, amount: numericAmount, reference: normalizedReference };
}

export function nextQuoteStatus(status) {
  if (status === "REJECTED" || status === "CANCELLED" || status === "CLOSED") return status;
  const index = QUOTE_STATUS_FLOW.indexOf(status);
  if (index < 0) return "DRAFT";
  return QUOTE_STATUS_FLOW[Math.min(index + 1, QUOTE_STATUS_FLOW.length - 1)];
}

export function canTransitionQuote(from, to) {
  if (from === to) return true;
  if (["CLOSED", "CANCELLED"].includes(from)) return false;
  if (to === "REJECTED" || to === "CANCELLED") return true;
  const current = QUOTE_STATUS_FLOW.indexOf(from);
  const target = QUOTE_STATUS_FLOW.indexOf(to);
  if (current < 0 || target < 0) return false;

  const allowedBranches = {
    INSURER_REVIEW: ["INFO_REQUIRED", "PARTIALLY_APPROVED", "APPROVED"],
    INFO_REQUIRED: ["INSURER_REVIEW", "PARTIALLY_APPROVED", "APPROVED"],
    PARTIALLY_APPROVED: ["APPROVED", "PATIENT_PAYMENT"],
    APPROVED: ["PATIENT_PAYMENT", "SERVICE_SCHEDULED"]
  };
  return target === current + 1 || (allowedBranches[from] || []).includes(to);
}

export function quoteProgress(status) {
  if (status === "REJECTED" || status === "CANCELLED") return 100;
  const index = QUOTE_STATUS_FLOW.indexOf(status);
  if (index < 0) return 0;
  return Math.round((index / (QUOTE_STATUS_FLOW.length - 1)) * 100);
}

export function quoteBalance(quote, payments = []) {
  const applied = payments
    .filter((payment) => payment.quoteId === quote.id && payment.status === "APPLIED")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  return roundMoney(Math.max(0, Number(quote.patientAmount || 0) - applied));
}

export function inventoryFree(item) {
  return Number(item.stock || 0) - Number(item.committed || 0);
}

export function inventoryState(item) {
  const free = inventoryFree(item);
  if (free <= 0) return "OUT";
  if (free <= Number(item.minimum || 0)) return "LOW";
  return "OK";
}

export function statementBalance(statement) {
  return roundMoney(
    Number(statement.gross || 0)
    + Number(statement.adjustments || 0)
    - Number(statement.withholdings || 0)
    - Number(statement.paid || 0)
  );
}

export function maskDocument(value) {
  const text = String(value || "");
  if (text.length <= 4) return "••••";
  return `${"•".repeat(Math.max(4, text.length - 4))}${text.slice(-4)}`;
}

export function maskPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `•••• ${digits.slice(-4)}`;
}

export function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function includesSearch(record, query, fields = []) {
  const normalized = normalizeSearch(query);
  if (!normalized) return true;
  return fields.some((field) => normalizeSearch(record?.[field]).includes(normalized));
}

export function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function toCsv(rows = [], columns = []) {
  const resolvedColumns = columns.length
    ? columns
    : Object.keys(rows[0] || {}).map((key) => ({ label: key, value: key }));
  const header = resolvedColumns.map((column) => csvEscape(column.label)).join(",");
  const body = rows.map((row) => resolvedColumns.map((column) => csvEscape(
    typeof column.value === "function" ? column.value(row) : row[column.value]
  )).join(",")).join("\n");
  return `${header}\n${body}`;
}

export function ageFromBirthDate(value, now = new Date()) {
  if (!value) return null;
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return null;
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday = now.getMonth() < birth.getMonth()
    || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return Math.max(0, age);
}

export function daysBetween(start, end = new Date()) {
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86400000));
}

export function safeText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function roleCan(role, permission) {
  const permissions = {
    SUPERADMIN: ["*"],
    ADMIN: ["*"],
    NURSE: [
      "dashboard:read", "patients:read", "cases:read",
      "quotes:read", "insurance:read", "clinical:read", "clinical:write",
      "clinical:sign",
      "agenda:read", "inventory:read"
    ],
    DOCTOR: [
      "dashboard:read", "patients:read", "cases:read", "quotes:read",
      "insurance:read", "clinical:read", "clinical:write", "clinical:sign",
      "agenda:read", "doctors:read", "statements:read"
    ],
    INVENTORY: [
      "dashboard:read", "patients:read", "cases:read", "purchases:read",
      "purchases:write", "inventory:read", "inventory:write",
      "catalogs:read", "catalogs:write", "reports:read", "qa:read"
    ],
    FINANCE: [
      "dashboard:read", "patients:read", "cases:read", "quotes:read",
      "quotes:write", "insurance:read", "insurance:write", "payments:read",
      "payments:write", "purchases:read", "inventory:read", "doctors:read",
      "statements:read", "statements:write", "reports:read", "audit:read", "qa:read"
    ],
    AUDITOR: [
      "dashboard:read", "patients:read", "cases:read", "quotes:read",
      "insurance:read", "payments:read", "clinical:read", "agenda:read",
      "purchases:read", "inventory:read", "catalogs:read", "doctors:read",
      "statements:read", "reports:read", "audit:read", "qa:read", "settings:read"
    ]
  };
  const grants = permissions[role] || [];
  if (grants.includes("*") || grants.includes(permission)) return true;
  const [scope, action] = permission.split(":");
  if (action === "read" && grants.includes(`${scope}:write`)) return true;
  return false;
}

export function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
