import { access, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const reviewsRoot = join(root, "video-audit-reviews");
const chaptersPath = join(root, "references", "video-audit", "CHAPTERS.json");
const canonicalPath = join(root, "docs", "MASTER_VIDEO_REQUIREMENTS.json");
const markdownPath = join(root, "docs", "MASTER_VIDEO_REQUIREMENTS.md");
const featureCsvPath = join(root, "docs", "MASTER_FEATURE_MATRIX.csv");
const gapCsvPath = join(root, "docs", "VIDEO_VS_PLATFORM_GAP_MATRIX.csv");
const questionsPath = join(root, "docs", "MASTER_OPEN_QUESTIONS.md");

const allowedStatuses = new Set([
  "IMPLEMENTED_EXACT",
  "IMPLEMENTED_PARTIAL",
  "MISSING",
  "CONFLICTS_WITH_VIDEO",
  "NOT_TESTABLE",
  "NEEDS_CLIENT_CONFIRMATION"
]);
const allowedPriorities = new Set(["P0", "P1", "P2", "P3"]);
const defaultRoutes = {
  CH01: "#/dashboard; #/pacientes",
  CH02: "#/pacientes",
  CH03: "#/hospitalizaciones; #/cotizaciones",
  CH04: "#/cotizaciones",
  CH05: "#/cotizaciones",
  CH06: "#/cotizaciones",
  CH07: "#/preautorizaciones; #/cotizaciones",
  CH08: "#/cuentas-por-cobrar",
  CH09: "#/hospitalizaciones; #/clinica/reportes",
  CH10: "#/clinica/ordenes; #/clinica/medicamentos",
  CH11: "#/agenda",
  CH12: "#/cuentas-por-pagar",
  CH13: "#/compras",
  CH14: "#/inventario/movimientos; #/inventario/comprometidos; #/inventario/cierres; #/inventario/bodegas; #/inventario/kits",
  CH15: "#/inventario/comprometidos; #/catalogos",
  CH16: "#/catalogos/descuentos",
  CH17: "#/clinica/reportes; #/clinica/evoluciones"
};

function normalizedConfidence(value) {
  const text = String(value || "UNKNOWN").toUpperCase();
  return ({ ALTA: "HIGH", MEDIA: "MEDIUM", BAJA: "LOW" })[text] || text;
}

function normalizedEvidencePath(value, sourceDirectory, reviewDirectory) {
  const path = String(value || "").replace(/\\/g, "/");
  if (!path) return "";
  if (/^(references|video-audit-reviews|docs)\//.test(path)) return path;
  if (path.startsWith("exact_clip_checks/")) return `${reviewDirectory}/${path}`;
  return `${sourceDirectory}/${path}`;
}

function normalizedEvidence(feature, chapterId, sourceDirectory, reviewDirectory) {
  return (feature.evidence || []).map((item) => ({
    chapter_id: item.chapter_id || chapterId,
    event_id: item.chapter_event_id || item.event_id || "",
    timestamp: item.timestamp || "",
    path: normalizedEvidencePath(item.path || item.image || item.evidence_path, sourceDirectory, reviewDirectory),
    detail_path: normalizedEvidencePath(item.detail_path || item.detail_crop, sourceDirectory, reviewDirectory),
    transcript: item.transcript || item.transcript_evidence || "",
    observation: item.observation || ""
  }));
}

function stripMarkdown(value) {
  return String(value || "")
    .replace(/\*\*/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function parseQuestions(text, chapterId) {
  const result = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const match = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (!match) continue;
    const cleaned = stripMarkdown(match[1]);
    const idMatch = cleaned.match(/\b(CH\d{2}-Q\d+)\b/i);
    const classificationMatch = cleaned.match(/\b(UNCERTAIN|VERBAL|VISIBLE|EXPLICIT)\b/i);
    result.push({
      question_id: idMatch?.[1]?.toUpperCase() || `${chapterId}-Q${String(result.length + 1).padStart(3, "0")}`,
      chapter_id: chapterId,
      classification: classificationMatch?.[1]?.toUpperCase() || "UNCERTAIN",
      question: cleaned.replace(/^CH\d{2}-Q\d+\s*[·—:-]*\s*/i, "").replace(/^(UNCERTAIN|VERBAL|VISIBLE|EXPLICIT)\s*[·—:-]*\s*/i, ""),
      evidence_event_ids: [...new Set(cleaned.match(/CH\d{2}-E\d{4}/gi) || [])].map((id) => id.toUpperCase()),
      status: "OPEN"
    });
  }
  return result;
}

function defaultAssessment(feature, chapterId) {
  const classification = String(feature.classification || "UNCERTAIN").toUpperCase();
  const searchable = `${feature.name || ""} ${feature.description || ""}`.toLowerCase();
  const notTestable = /no demostrado|no se (observa|evidencia|confirma)|intervalo visual discontinuo|resultado .* incierto/.test(searchable);
  const needsDecision = ["UNCERTAIN", "VERBAL"].includes(classification);
  return {
    status: notTestable ? "NOT_TESTABLE" : needsDecision ? "NEEDS_CLIENT_CONFIRMATION" : "IMPLEMENTED_PARTIAL",
    priority: notTestable || needsDecision ? "P2" : "P1",
    patient_safety_impact: "Pendiente de evaluación contra la implementación y las reglas confirmadas.",
    financial_impact: "Pendiente de evaluación contra la implementación y las reglas confirmadas.",
    current_platform_evidence: defaultRoutes[chapterId] || "Revisión de plataforma pendiente.",
    test_path: `${defaultRoutes[chapterId] || "revisión manual"}; npm test`,
    recommended_action: notTestable
      ? "Conservar la incertidumbre; no usar este fragmento como criterio de paridad hasta contar con evidencia concluyente."
      : needsDecision
      ? "Confirmar la regla o el resultado esperado antes de implementar."
      : "Comparar el comportamiento observado con la ruta actual y completar la parte faltante.",
    blocked_by_client_information: needsDecision && !notTestable,
    notes: "Clasificación conservadora inicial; debe cerrarse durante la comparación código/pruebas."
  };
}

const assessmentOverrides = {
  "CH12-F01": {
    status:"IMPLEMENTED_PARTIAL", priority:"P1", patient_safety_impact:"Sin impacto clínico directo; la vista minimiza datos y no crea reclamos ficticios.", financial_impact:"Generación, restricciones y limpieza permanecen bloqueadas hasta definir sus efectos.", current_platform_evidence:"app/views.js renderPayables; app/main.js blocked-payables-mutation", test_path:"tests/ch12-professional-payables.test.mjs; tests/e2e/ch12.spec.mjs", recommended_action:"Conservar la superficie y completar Reclamos/acciones sólo tras resolver CH12-Q008–CH12-Q011.", blocked_by_client_information:true, notes:"Tabs, tablas y acciones visibles; las operaciones no demostradas no simulan éxito."
  },
  "CH12-F02": {
    status:"IMPLEMENTED_EXACT", priority:"P1", patient_safety_impact:"La tabla usa únicamente el alcance de organización ya autorizado.", financial_impact:"Separa estado de pago y visita y no inventa una correlación ausente.", current_platform_evidence:"app/views.js renderPayables; app/supabase-adapter.js mapSupabaseBootstrap", test_path:"tests/ch12-professional-payables.test.mjs; tests/e2e/ch12.spec.mjs", recommended_action:"Mantener regresión de filtros, búsqueda, paginación y móvil.", blocked_by_client_information:false, notes:"La selección es local y cualquier efecto grupal continúa bloqueado."
  },
  "CH12-F03": {
    status:"NEEDS_CLIENT_CONFIRMATION", priority:"P2", patient_safety_impact:"Debe definirse la minimización de identificadores de paciente en reportes profesionales.", financial_impact:"Contenido, alcance, formato y efecto de edición grupal no están demostrados.", current_platform_evidence:"app/views.js renderPayables; app/main.js blocked-payables-mutation", test_path:"tests/e2e/ch12.spec.mjs", recommended_action:"Resolver CH12-Q001, CH12-Q007 y CH12-Q010 antes de habilitar reportes o edición grupal.", blocked_by_client_information:true, notes:"El control oculto no se nombra como hecho; se presenta como pendiente de confirmar."
  },
  "CH12-F04": {
    status:"IMPLEMENTED_EXACT", priority:"P2", patient_safety_impact:"Sin impacto clínico; los filtros no alteran registros.", financial_impact:"Rango, recurso y estado filtran sólo la vista.", current_platform_evidence:"app/views.js renderPayables; app/main.js apply-payables-filters", test_path:"tests/e2e/ch12.spec.mjs", recommended_action:"Mantener pruebas de combinación, limpieza y paginación.", blocked_by_client_information:false, notes:"Cerrar, Limpiar y Aplicar están implementados."
  },
  "CH12-F05": {
    status:"IMPLEMENTED_PARTIAL", priority:"P1", patient_safety_impact:"La identidad se muestra desde datos autorizados y no se envía por canales inseguros.", financial_impact:"Tarifa, monto, estado y comentario son de sólo lectura hasta aprobar la transición financiera.", current_platform_evidence:"app/main.js openProfessionalServicePayment", test_path:"tests/ch12-professional-payables.test.mjs; tests/e2e/ch12.spec.mjs", recommended_action:"Habilitar edición únicamente mediante RPC auditada después de resolver CH12-Q002–CH12-Q007 y CH12-Q012.", blocked_by_client_information:true, notes:"La composición visual y Cancelar existen; Guardar no finge persistencia."
  },
  "CH12-F06": {
    status:"IMPLEMENTED_PARTIAL", priority:"P1", patient_safety_impact:"Los motivos no ejecutan reglas clínicas ni exponen detalles en notificaciones.", financial_impact:"Agregar no cambia saldos hasta definir fórmula, autorización, contabilidad y reversión.", current_platform_evidence:"app/main.js openProfessionalPaymentConcept/blocked-payables-mutation", test_path:"tests/ch12-professional-payables.test.mjs; tests/e2e/ch12.spec.mjs", recommended_action:"Modelar líneas append-only y una RPC idempotente cuando se aprueben CH12-Q005–CH12-Q007.", blocked_by_client_information:true, notes:"Tipo, motivo, monto y comentario reproducen la superficie observada."
  },
  "CH12-F07": {
    status:"IMPLEMENTED_EXACT", priority:"P2", patient_safety_impact:"Los rótulos son documentales y no se interpretan como reglas clínicas.", financial_impact:"No se asigna efecto monetario a ningún motivo.", current_platform_evidence:"app/main.js PROFESSIONAL_ADDITION_REASONS/PROFESSIONAL_DISCOUNT_REASONS", test_path:"tests/ch12-professional-payables.test.mjs; tests/e2e/ch12.spec.mjs", recommended_action:"Mantenerlos configurables y no productivos hasta confirmar CH12-Q005–CH12-Q006.", blocked_by_client_information:false, notes:"Se incluyen todos los rótulos legibles de la evidencia; no se inventan motivos adicionales."
  },
  "CH12-F08": {
    status:"NEEDS_CLIENT_CONFIRMATION", priority:"P0", patient_safety_impact:"Sin regla clínica inferida; debe limitarse la identificación del paciente en exportaciones.", financial_impact:"Alto: faltan tarifa versionada, estados, aprobación, retenciones, pagos parciales, reversión e idempotencia.", current_platform_evidence:"app/store.js bloquea generateDoctorStatements/sendDoctorStatement; supabase/migrations/202608270008_ch12_professional_payables.sql cierra DML directo", test_path:"tests/ch12-professional-payables.test.mjs", recommended_action:"Aprobar CH12-Q002–CH12-Q012 y luego implementar ledger y RPC transaccionales antes de habilitar cualquier mutación.", blocked_by_client_information:true, notes:"El P0 se contiene cerrando escrituras directas, RLS de ítems, doble inclusión y éxitos local-first."
  },
  "CH13-F01": {
    status:"IMPLEMENTED_EXACT", priority:"P1", patient_safety_impact:"El listado queda limitado por permiso y organización.", financial_impact:"Totales y estados se leen del registro persistido; la exportación es sintética y provisional.", current_platform_evidence:"app/views.js renderPurchases; app/main.js purchase-search/purchase-page/export-purchases", test_path:"tests/ch13-purchase-drafts.test.mjs; tests/e2e/ch13.spec.mjs", recommended_action:"Mantener regresión de columnas, búsqueda, paginación, exportación y móvil.", blocked_by_client_information:false, notes:"Reproduce las nueve columnas observadas y los controles de tabla."
  },
  "CH13-F02": {
    status:"NEEDS_CLIENT_CONFIRMATION", priority:"P0", patient_safety_impact:"Una recepción falsa podría afectar disponibilidad operativa.", financial_impact:"Estado y Registro PT pueden disparar contabilidad, pago o inventario aún no definidos.", current_platform_evidence:"app/views.js sólo presenta badges; app/store.js crea exclusivamente DRAFT", test_path:"tests/ch13-purchase-drafts.test.mjs; tests/e2e/ch13.spec.mjs", recommended_action:"Resolver CH13-Q001, CH13-Q002, CH13-Q009 y CH13-Q010 antes de habilitar transiciones.", blocked_by_client_information:true, notes:"Los rótulos visibles se conservan, pero ninguna transición se infiere."
  },
  "CH13-F03": {
    status:"IMPLEMENTED_EXACT", priority:"P1", patient_safety_impact:"Sin impacto clínico; elegir modalidad no persiste.", financial_impact:"La modalidad define sólo la composición del borrador.", current_platform_evidence:"app/main.js openPurchaseTypeChooser/openPurchaseForm", test_path:"tests/ch13-purchase-drafts.test.mjs; tests/e2e/ch13.spec.mjs", recommended_action:"Mantener ambas rutas en regresión.", blocked_by_client_information:false, notes:"Usa el rótulo exacto Caja menuda observado en la interfaz."
  },
  "CH13-F04": {
    status:"IMPLEMENTED_PARTIAL", priority:"P1", patient_safety_impact:"El catálogo y proveedor se limitan al tenant.", financial_impact:"Costo es manual; precio histórico y alta de presentación permanecen bloqueados.", current_platform_evidence:"app/main.js openPurchaseForm/purchaseCatalogOptions/blocked-purchase-presentation", test_path:"tests/ch13-purchase-drafts.test.mjs; tests/e2e/ch13.spec.mjs", recommended_action:"Completar historial y presentaciones sólo después de resolver CH13-Q014.", blocked_by_client_information:true, notes:"Cabecera, catálogo buscable y línea están implementados; no se inventa precio histórico."
  },
  "CH13-F05": {
    status:"IMPLEMENTED_EXACT", priority:"P1", patient_safety_impact:"Sin impacto clínico; las referencias se validan por organización.", financial_impact:"Líneas múltiples se recalculan y rechazan total negativo.", current_platform_evidence:"app/main.js add-purchase-item/remove-purchase-item; app/store.js createPurchase", test_path:"tests/ch13-purchase-drafts.test.mjs; tests/e2e/ch13.spec.mjs", recommended_action:"Mantener pruebas de múltiples líneas y errores.", blocked_by_client_information:false, notes:"Proveedor, ítem, costo, cantidad, presentación y total aparecen en la tabla."
  },
  "CH13-F06": {
    status:"IMPLEMENTED_PARTIAL", priority:"P0", patient_safety_impact:"El adjunto podría contener datos personales o fiscales y no se carga sin controles.", financial_impact:"Proveedor, factura y montos forman un borrador; el archivo sigue sin persistir.", current_platform_evidence:"app/main.js Nueva compra caja menuda; app/store.js createPurchase", test_path:"tests/ch13-purchase-drafts.test.mjs; tests/e2e/ch13.spec.mjs", recommended_action:"Implementar Storage privado sólo tras resolver CH13-Q007.", blocked_by_client_information:true, notes:"Impuesto y descuento son montos manuales; se eliminó la tasa 13% inventada."
  },
  "CH13-F07": {
    status:"IMPLEMENTED_EXACT", priority:"P0", patient_safety_impact:"Sin regla clínica; los importes no cambian inventario.", financial_impact:"Subtotal, descuento, extra, impuesto y total se validan en cliente y servidor sin tasa implícita.", current_platform_evidence:"app/main.js purchaseDraftTotals; app/store.js createPurchase; migration 202608270009 create_purchase_draft", test_path:"tests/ch13-purchase-drafts.test.mjs; tests/e2e/ch13.spec.mjs", recommended_action:"Mantener importes explícitos hasta aprobar política fiscal y redondeo.", blocked_by_client_information:false, notes:"La aritmética usa únicamente montos capturados; no interpreta impuestos."
  },
  "CH13-F08": {
    status:"IMPLEMENTED_PARTIAL", priority:"P1", patient_safety_impact:"El detalle es de sólo lectura y tenant-scoped.", financial_impact:"Muestra el snapshot persistido sin editarlo; acceso al archivo no está habilitado.", current_platform_evidence:"app/main.js openPurchaseDetail", test_path:"tests/ch13-purchase-drafts.test.mjs; tests/e2e/ch13.spec.mjs", recommended_action:"Habilitar Ver archivo mediante URL firmada sólo tras CH13-Q007.", blocked_by_client_information:true, notes:"Cabecera, líneas y cinco totales están implementados."
  },
  "CH13-F09": {
    status:"IMPLEMENTED_PARTIAL", priority:"P0", patient_safety_impact:"Anulación y edición permanecen bloqueadas para evitar cambios operativos silenciosos.", financial_impact:"Ver e impresión/CSV sintéticos funcionan; editar, copiar y anular no mutan.", current_platform_evidence:"app/views.js purchase-row-menu; app/main.js blocked-purchase-mutation/printPurchase/export-purchase", test_path:"tests/e2e/ch13.spec.mjs", recommended_action:"Resolver CH13-Q010–CH13-Q013 antes de habilitar mutaciones o salidas oficiales.", blocked_by_client_information:true, notes:"Todas las acciones observadas permanecen visibles y ninguna acción incompleta afirma éxito."
  },
  "CH13-F10": {
    status:"NEEDS_CLIENT_CONFIRMATION", priority:"P0", patient_safety_impact:"Una entrada omitida o duplicada puede afectar disponibilidad de insumos.", financial_impact:"Recepción e inventario deben enlazarse de forma atómica e idempotente.", current_platform_evidence:"app/store.js createPurchase crea sólo DRAFT y no llama createInventoryMovement", test_path:"tests/ch13-purchase-drafts.test.mjs", recommended_action:"Resolver CH13-Q002–CH13-Q003 antes de vincular recepción e inventario.", blocked_by_client_information:true, notes:"La afirmación es verbal; el video no demuestra la recepción."
  },
  "CH13-F11": {
    status:"NEEDS_CLIENT_CONFIRMATION", priority:"P0", patient_safety_impact:"Adjuntos y recepción pueden afectar privacidad y disponibilidad operativa.", financial_impact:"Faltan reglas fiscales, aprobación, anulación, corrección, impresión y retención.", current_platform_evidence:"migration 202608270009 cierra DML directo y crea sólo borradores; UI bloquea efectos desconocidos", test_path:"tests/ch13-purchase-drafts.test.mjs; tests/e2e/ch13.spec.mjs", recommended_action:"Resolver CH13-Q001–CH13-Q014 antes de ampliar la máquina de compra.", blocked_by_client_information:true, notes:"El P0 previo queda contenido por RPC tenant-safe, idempotencia, auditoría y ausencia de éxito local-first."
  },
  "CH14-F01": {
    status:"IMPLEMENTED_PARTIAL", priority:"P1", patient_safety_impact:"La lista no ejecuta cambios y conserva el alcance del tenant.", financial_impact:"Disponible, comprometido y total se reconcilian con la convención técnica actual; su definición contable sigue pendiente.", current_platform_evidence:"app/views.js renderInventory; app/store.js inventory model", test_path:"tests/ch14-inventory-boundaries.test.mjs; tests/e2e/ch14.spec.mjs", recommended_action:"Completar filtro de bodega y paginación real después de fijar la semántica de comprometido.", blocked_by_client_information:true, notes:"La tabla, búsqueda, CSV y pestañas están presentes; bodega y tamaño de página continúan fijos."
  },
  "CH14-F02": {
    status:"IMPLEMENTED_PARTIAL", priority:"P1", patient_safety_impact:"El historial es de sólo lectura y no altera stock.", financial_impact:"Origen, destino, cantidad y lote se muestran sin afirmar un estado contable no persistido.", current_platform_evidence:"app/main.js inventoryItemHistory", test_path:"tests/e2e/ch14.spec.mjs", recommended_action:"Implementar rango, referencia, nota y estado sólo desde campos autoritativos.", blocked_by_client_information:true, notes:"Columnas observadas implementadas; rango no operativo y estado visual conservador."
  },
  "CH14-F03": {
    status:"NEEDS_CLIENT_CONFIRMATION", priority:"P0", patient_safety_impact:"Una reserva o consumo mal interpretado puede desalinear disponibilidad operativa.", financial_impact:"La definición de comprometido afecta cuenta, cierre y reversión.", current_platform_evidence:"app/store.js createInventoryMovement; docs/OPEN_QUESTIONS.md", test_path:"tests/ch14-inventory-boundaries.test.mjs", recommended_action:"Resolver CH14-Q001 antes de ampliar acuses o cierres.", blocked_by_client_information:true, notes:"No se promueve la explicación verbal a una regla productiva."
  },
  "CH14-F04": {
    status:"IMPLEMENTED_PARTIAL", priority:"P1", patient_safety_impact:"Los datos se limitan a casos sintéticos autorizados.", financial_impact:"Las pestañas no ejecutan movimientos.", current_platform_evidence:"app/views.js renderCommittedInventory", test_path:"tests/e2e/ch14.spec.mjs", recommended_action:"Conectar Recursos, No disponible, Solicitudes y Tareas sólo a colecciones autoritativas.", blocked_by_client_information:true, notes:"Pacientes funciona; las otras pestañas muestran vacío explícito."
  },
  "CH14-F05": {
    status:"NEEDS_CLIENT_CONFIRMATION", priority:"P0", patient_safety_impact:"Editar o eliminar un acuse sin versión/reversión puede borrar trazabilidad de insumos entregados.", financial_impact:"Un acuse puede afectar inventario y cuenta del paciente.", current_platform_evidence:"app/views.js renderCommittedInventory; app/main.js blocked-inventory-action", test_path:"tests/e2e/ch14.spec.mjs", recommended_action:"Resolver CH14-Q002–CH14-Q003 antes de habilitar cualquier acción.", blocked_by_client_information:true, notes:"Acciones visibles y bloqueadas; no existe éxito simulado."
  },
  "CH14-F06": {
    status:"IMPLEMENTED_PARTIAL", priority:"P1", patient_safety_impact:"La vista no cierra hospitalizaciones ni cambia estados clínicos.", financial_impact:"No aplica conciliación financiera sin aprobación.", current_platform_evidence:"app/views.js renderInventoryClosures; app/store.js createInventoryClosure", test_path:"tests/ch14-inventory-boundaries.test.mjs; tests/e2e/ch14.spec.mjs", recommended_action:"Mantener sólo lectura hasta resolver CH14-Q007.", blocked_by_client_information:true, notes:"Cuatro pestañas y casos visibles; mutaciones cerradas."
  },
  "CH14-F07": {
    status:"IMPLEMENTED_EXACT", priority:"P0", patient_safety_impact:"Cancelar preserva los datos y Aceptar no ejecuta pérdida silenciosa.", financial_impact:"No borra conciliación ni cierre previo.", current_platform_evidence:"app/main.js openClosureWarning", test_path:"tests/e2e/ch14.spec.mjs", recommended_action:"Mantener bloqueo de Aceptar hasta resolver CH14-Q006.", blocked_by_client_information:true, notes:"Advertencia y ambos controles reproducidos con desviación segura: Aceptar no muta."
  },
  "CH14-F08": {
    status:"NEEDS_CLIENT_CONFIRMATION", priority:"P0", patient_safety_impact:"Cerrar una hospitalización sin conciliación puede alterar disponibilidad y continuidad operativa.", financial_impact:"Aprobación total puede bloquear o alterar cuenta e inventario.", current_platform_evidence:"app/store.js createInventoryClosure/approveInventoryClosure; migration 202608270010", test_path:"tests/ch14-inventory-boundaries.test.mjs; tests/e2e/ch14.spec.mjs", recommended_action:"Resolver CH14-Q006–CH14-Q007 y crear RPC transaccional antes de habilitar.", blocked_by_client_information:true, notes:"Editar, Aprobar y Cancelar permanecen bloqueados; impresión es provisional."
  },
  "CH14-F09": {
    status:"IMPLEMENTED_PARTIAL", priority:"P1", patient_safety_impact:"Sin impacto clínico directo; el catálogo no se muta.", financial_impact:"Proveedor puede ser referencia de compras y debe conservar historial.", current_platform_evidence:"app/views.js renderSuppliers", test_path:"tests/e2e/ch14.spec.mjs", recommended_action:"Definir identidad, unicidad y desactivación en CH14-Q008 antes del CRUD.", blocked_by_client_information:true, notes:"Tabla visible con datos sintéticos; alta/edición bloqueadas."
  },
  "CH14-F10": {
    status:"IMPLEMENTED_PARTIAL", priority:"P0", patient_safety_impact:"Una transferencia incorrecta puede ocultar stock disponible en la ubicación real.", financial_impact:"La RPC conserva la suma de existencias y audita el movimiento.", current_platform_evidence:"app/views.js renderWarehouses; app/store.js createInventoryMovement; apply_inventory_movement_v2", test_path:"tests/ch14-inventory-boundaries.test.mjs; tests/e2e/ch14.spec.mjs", recommended_action:"Resolver CH14-Q009 y validar concurrencia/RLS en Supabase real.", blocked_by_client_information:true, notes:"Lista presente; movimiento productivo transaccional; CRUD y acceso directo incompletos."
  },
  "CH14-F11": {
    status:"IMPLEMENTED_PARTIAL", priority:"P0", patient_safety_impact:"La RPC rechaza lote vencido, no disponible o insuficiente; el modo local bloquea ítems trazables.", financial_impact:"Evita divergencia lote–stock en rutas de mutación habilitadas.", current_platform_evidence:"app/views.js renderInventoryLots; app/store.js createInventoryMovement; apply_inventory_movement_v2", test_path:"tests/ch14-inventory-boundaries.test.mjs; tests/e2e/ch14.spec.mjs", recommended_action:"Resolver CH14-Q010–CH14-Q011 y validar migraciones en Supabase real.", blocked_by_client_information:true, notes:"Vista de sólo lectura; se rechaza deliberadamente el defecto de fechas inválidas activas observado."
  },
  "CH14-F12": {
    status:"IMPLEMENTED_PARTIAL", priority:"P1", patient_safety_impact:"La lista no consume componentes.", financial_impact:"No se crean maestros incompletos ni se eliminan referencias históricas.", current_platform_evidence:"app/views.js renderKits; app/store.js createKit", test_path:"tests/ch14-inventory-boundaries.test.mjs; tests/e2e/ch14.spec.mjs", recommended_action:"Resolver CH14-Q012 antes de habilitar CRUD/versionado.", blocked_by_client_information:true, notes:"Catálogo y acciones visibles; mutaciones bloqueadas."
  },
  "CH14-F13": {
    status:"NEEDS_CLIENT_CONFIRMATION", priority:"P0", patient_safety_impact:"Una descarga parcial o desde lote incorrecto puede desalinear disponibilidad de insumos.", financial_impact:"El consumo debe ser atómico e idempotente para no duplicar cargos o existencias.", current_platform_evidence:"app/main.js openKitForm; app/store.js createKit", test_path:"tests/ch14-inventory-boundaries.test.mjs; tests/e2e/ch14.spec.mjs", recommended_action:"Resolver CH14-Q012–CH14-Q013 y crear una RPC transaccional.", blocked_by_client_information:true, notes:"Composición visual presente; descarga automática no implementada."
  },
  "CH14-F14": {
    status:"IMPLEMENTED_PARTIAL", priority:"P0", patient_safety_impact:"La captura no descuenta ni reserva stock hasta tener reglas aprobadas.", financial_impact:"No crea cargos o compromisos ficticios.", current_platform_evidence:"app/main.js openAcknowledgementForm/blocked-inventory-action", test_path:"tests/e2e/ch14.spec.mjs", recommended_action:"Resolver CH14-Q001–CH14-Q005 antes de persistir.", blocked_by_client_information:true, notes:"Campos y acciones observados presentes; Añadir, Vaciar y Plantilla bloqueados."
  },
  "CH14-F15": {
    status:"NEEDS_CLIENT_CONFIRMATION", priority:"P0", patient_safety_impact:"La política de faltantes puede afectar disponibilidad y sustitución de insumos.", financial_impact:"No crea compra, acuse o cotización por inferencia.", current_platform_evidence:"app/main.js blocked-inventory-action; docs/OPEN_QUESTIONS.md", test_path:"tests/e2e/ch14.spec.mjs", recommended_action:"Resolver CH14-Q005 antes de habilitar el flujo.", blocked_by_client_information:true, notes:"La evidencia aparece al final sin demostrar resultado."
  },
  "CH14-F16": {
    status:"NEEDS_CLIENT_CONFIRMATION", priority:"P1", patient_safety_impact:"Sin acción clínica automática.", financial_impact:"No se cambia una cotización desde una frase ambigua.", current_platform_evidence:"docs/OPEN_QUESTIONS.md", test_path:"NONE", recommended_action:"Resolver CH14-Q014 con el cliente.", blocked_by_client_information:true, notes:"No existe demostración visual suficiente."
  }
};

function defaultSafetyFindings() {
  return [
    {
      finding_id: "SAFE-P0-001",
      module: "Portal del paciente",
      feature: "Verificación secundaria, expiración y anti-enumeración",
      detailed_behavior: "El acceso público debe validar token hash, expiración, verificación secundaria y límites de intentos antes de revelar el estado financiero del paciente.",
      evidence_paths: ["app/views.js", "app/main.js", "supabase/migrations/202608260002_security_rls_functions.sql"],
      current_platform_evidence: "La RPC SQL valida token hash, expiración, documento y código, pero la ruta demo #/portal/:token se renderiza antes del login y busca portalToken directamente, sin verificación secundaria ni expiración.",
      status: "IMPLEMENTED_PARTIAL",
      priority: "P0",
      patient_safety_impact: "Puede exponer identidad y estado de atención a quien obtenga el enlace demo.",
      financial_impact: "Puede exponer cotización, cobertura, pagos y saldo.",
      recommended_action: "Unificar el portal con la ruta de validación server-side, respuestas genéricas, expiración, rate limiting y auditoría; no usar DUI como único factor.",
      blocked_by_client_information: false,
      notes: "No implementar en este checkpoint; hallazgo de seguridad confirmado por inspección de código."
    },
    {
      finding_id: "SAFE-P0-002",
      module: "Cotizaciones",
      feature: "Inmutabilidad de versiones enviadas",
      detailed_behavior: "Una cotización enviada debe conservar su snapshot; cualquier revisión crea una nueva versión sin sobrescribir la anterior.",
      evidence_paths: ["video-audit-reviews/CH07_preautorizacion_seguro_y_reclamo/chapter_feature_inventory.json", "app/store.js", "app/supabase-adapter.js", "supabase/migrations/202608260001_initial_schema.sql"],
      current_platform_evidence: "reviseQuote incrementa version y muta el mismo objeto/items; no conserva el snapshot anterior. El adaptador además usa columnas version_number/immutable_snapshot que no existen en quote_versions.",
      status: "CONFLICTS_WITH_VIDEO",
      priority: "P0",
      patient_safety_impact: "Una versión histórica incorrecta puede alterar lo autorizado para la atención.",
      financial_impact: "Puede perder evidencia de importes, cobertura y términos ya enviados.",
      recommended_action: "Crear versiones append-only y pruebas de que una revisión nunca cambia el snapshot enviado; alinear adaptador y esquema.",
      blocked_by_client_information: false,
      notes: "Relacionado con CH07-F04 (Versiones). No implementar en este checkpoint."
    },
    {
      finding_id: "SAFE-P0-003",
      module: "Documentos clínicos",
      feature: "Correcciones auditadas sin edición silenciosa de documentos firmados",
      detailed_behavior: "Una corrección debe exigir autorización y motivo, preservar la versión firmada y crear nueva evidencia auditable.",
      evidence_paths: ["video-audit-reviews/CH10_orden_medica_tratamientos_y_tarjeta_de_medicamentos/chapter_feature_inventory.json", "app/store.js", "supabase/migrations/202608260002_security_rls_functions.sql"],
      current_platform_evidence: "updateClinicalDocument sólo bloquea a NURSE y muta el documento firmado para otros roles; el trigger SQL permite update in-place con permiso y no exige motivo ni preserva el snapshot firmado.",
      status: "CONFLICTS_WITH_VIDEO",
      priority: "P0",
      patient_safety_impact: "Puede borrar o alterar silenciosamente una orden o nota clínica firmada.",
      financial_impact: "Puede afectar evidencia de servicios y responsabilidad profesional.",
      recommended_action: "Implementar corrección append-only con razón obligatoria, autorización específica, vínculo de versiones y auditoría inmutable.",
      blocked_by_client_information: false,
      notes: "Relacionado con CH10-F10. No implementar en este checkpoint."
    },
    {
      finding_id: "SAFE-P0-004",
      module: "Mensajería",
      feature: "Autorización organizacional e idempotencia de notificaciones",
      detailed_behavior: "Toda solicitud de envío debe autenticar al actor, derivar organization_id del servidor y deduplicarse con una clave estable.",
      evidence_paths: ["video-audit-reviews/CH02_alta_y_edicion_de_pacientes/chapter_feature_inventory.json", "video-audit-reviews/CH07_preautorizacion_seguro_y_reclamo/chapter_feature_inventory.json", "api/notifications.js", "supabase/migrations/202608260001_initial_schema.sql"],
    current_platform_evidence: "La API sólo acepta plantilla allowlisted, destinatario registrado, entidad relacionada e idempotency_key; requiere JWT de usuario y queue_notification deriva organización/contacto, deduplica y registra auditoría. El worker registra intentos, backoff y simulación sin afirmar entrega real.",
    status: "IMPLEMENTED_PARTIAL",
      priority: "P0",
      patient_safety_impact: "Permite solicitudes no autorizadas o duplicadas y riesgo de destinatario incorrecto.",
      financial_impact: "Puede duplicar mensajes y costos de proveedor.",
    recommended_action: "Validar queue_notification, RLS, worker y adaptadores de proveedor en una instancia Supabase real; configurar proveedor sólo con credenciales del cliente.",
      blocked_by_client_information: false,
    notes: "Implementado en lote P0 3; mantener parcial hasta prueba real de RLS/RPC y proveedor."
    },
    {
      finding_id: "SAFE-P0-005",
      module: "Supabase / acceso multi-organización",
      feature: "Asignación de organización confiable y funciones privilegiadas cerradas",
      detailed_behavior: "La organización del usuario debe provenir de una invitación/relación confiable y las funciones SECURITY DEFINER no deben quedar ejecutables por PUBLIC.",
      evidence_paths: ["supabase/migrations/202608260002_security_rls_functions.sql"],
      current_platform_evidence: "bootstrap_new_user toma organization_id de raw_user_meta_data; las funciones SECURITY DEFINER se crean en public sin REVOKE EXECUTE FROM PUBLIC explícito.",
      status: "MISSING",
      priority: "P0",
      patient_safety_impact: "Puede cruzar límites organizacionales y exponer datos clínicos.",
      financial_impact: "Puede cruzar cuentas, cotizaciones, pagos e inventario entre organizaciones.",
      recommended_action: "Resolver organización mediante invitación confiable y revocar/grantar EXECUTE explícitamente por función/rol.",
      blocked_by_client_information: false,
      notes: "Hallazgo estático; Supabase local no está disponible para una prueba RLS real en este checkpoint."
    },
    {
      finding_id: "SAFE-P0-006",
      module: "Pagos e inventario",
      feature: "Contratos persistentes e idempotencia alineados con el esquema",
      detailed_behavior: "Pagos y movimientos de inventario deben persistir de forma atómica, auditada e idempotente con las columnas requeridas por el esquema.",
      evidence_paths: ["video-audit-reviews/CH08_perfil_administrativo_cuentas_por_cobrar_y_pagos/chapter_feature_inventory.json", "video-audit-reviews/CH14_inventario_movimientos_acuses_cierres_bodegas_y_kits/chapter_feature_inventory.json", "app/supabase-adapter.js", "supabase/migrations/202608260001_initial_schema.sql", "supabase/migrations/202608260002_security_rls_functions.sql"],
    current_platform_evidence: "El adaptador usa apply_payment y apply_inventory_movement_v2. Las RPCs derivan organización, aplican idempotencia, saldo/stock, lotes/reservas, comprobante/asignación, reversión y auditoría append-only.",
    status: "IMPLEMENTED_PARTIAL",
      priority: "P0",
      patient_safety_impact: "Un stock incorrecto puede afectar disponibilidad operativa de insumos.",
      financial_impact: "Pagos duplicados/fallidos y movimientos no atómicos pueden desalinear saldos e inventario.",
    recommended_action: "Ejecutar pruebas de concurrencia, RLS, lotes, transferencias y reversión contra Supabase real antes de elevar el estado.",
      blocked_by_client_information: false,
    notes: "Implementado en lote P0 3; available = stock - committed y permanece parcial hasta validación persistente real."
    },
    {
      finding_id: "SAFE-P0-007",
      module: "Compras",
      feature: "Borradores financieros transaccionales y referencias tenant-safe",
      detailed_behavior: "La creación de una compra debe confirmar cabecera y líneas de forma atómica e idempotente, recalcular montos en servidor y validar que proveedor, catálogo y padre pertenezcan a la organización activa.",
      evidence_paths: ["video-audit-reviews/CH13_compras_y_compras_al_por_mayor/chapter_feature_inventory.json", "app/store.js", "app/supabase-adapter.js", "supabase/migrations/202608270009_ch13_purchase_drafts.sql", "tests/ch13-purchase-drafts.test.mjs"],
      current_platform_evidence: "createPurchase usa requiredSync en modo Supabase; create_purchase_draft deriva organización, valida referencias, recalcula importes manuales, inserta cabecera/líneas/evento/auditoría y deduplica bajo bloqueo. DML directo queda revocado.",
      status: "IMPLEMENTED_PARTIAL",
      priority: "P0",
      patient_safety_impact: "Una recepción o referencia cruzada incorrecta puede afectar la disponibilidad operativa de insumos.",
      financial_impact: "Persistencia parcial, importes manipulados o reintentos duplicados pueden desalinear compras, facturas e inventario.",
      recommended_action: "Aplicar la migración y ejecutar concurrencia/RLS con dos organizaciones en Supabase real; mantener aprobación, recepción, anulación y adjuntos cerrados hasta contar con reglas.",
      blocked_by_client_information: false,
      notes: "El P0 está contenido en código y contrato SQL, pero permanece parcial hasta validar la migración en una instancia Supabase real."
    }
  ];
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function bootstrapCanonical() {
  const chapterManifest = JSON.parse(await readFile(chaptersPath, "utf8"));
  const prior = (await exists(canonicalPath)) ? JSON.parse(await readFile(canonicalPath, "utf8")) : null;
  const priorRequirements = new Map((prior?.requirements || []).map((item) => [item.requirement_id, item]));
  const reviewDirectories = (await readdir(reviewsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const requirements = [];
  const openQuestions = [];
  const chapters = [];

  for (const chapter of chapterManifest) {
    const directoryName = reviewDirectories.find((name) => name.startsWith(`${chapter.chapter_id}_`));
    if (!directoryName) throw new Error(`No review directory for ${chapter.chapter_id}`);
    const reviewDirectory = join(reviewsRoot, directoryName);
    const sourceDirectory = `references/video-audit/${chapter.directory}`;
    const reviewDirectoryRelative = `video-audit-reviews/${directoryName}`;
    const inventory = JSON.parse(await readFile(join(reviewDirectory, "chapter_feature_inventory.json"), "utf8"));
    const receipt = JSON.parse(await readFile(join(reviewDirectory, "chapter_review_receipt.json"), "utf8"));
    if (!Array.isArray(inventory.features) || inventory.features.length === 0) throw new Error(`${chapter.chapter_id}: empty feature inventory`);
    if ((receipt.reviewed_event_ids || []).length !== chapter.event_frames) throw new Error(`${chapter.chapter_id}: incomplete receipt`);
    const questionFile = join(reviewDirectory, "chapter_open_questions.md");
    const questions = (await exists(questionFile)) ? parseQuestions(await readFile(questionFile, "utf8"), chapter.chapter_id) : [];
    openQuestions.push(...questions);
    const requirementIds = [];

    for (const [index, feature] of inventory.features.entries()) {
      const requirementId = String(feature.id || `${chapter.chapter_id}-F${String(index + 1).padStart(3, "0")}`).toUpperCase();
      const priorRequirement = priorRequirements.get(requirementId);
      const evidence = normalizedEvidence(feature, chapter.chapter_id, sourceDirectory, reviewDirectoryRelative);
      if (!evidence.length) throw new Error(`${requirementId}: no evidence`);
      for (const item of evidence) {
        if (item.chapter_id !== chapter.chapter_id || !item.event_id || !item.timestamp || !item.path) {
          throw new Error(`${requirementId}: incomplete evidence trace`);
        }
        const absoluteEvidencePath = resolve(root, item.path);
        const relativeEvidencePath = relative(root, absoluteEvidencePath);
        if (relativeEvidencePath.startsWith("..") || resolve(relativeEvidencePath) === relativeEvidencePath || !(await exists(absoluteEvidencePath))) {
          throw new Error(`${requirementId}: missing or out-of-scope evidence path ${item.path}`);
        }
        if (item.detail_path) {
          const absoluteDetailPath = resolve(root, item.detail_path);
          const relativeDetailPath = relative(root, absoluteDetailPath);
          if (relativeDetailPath.startsWith("..") || resolve(relativeDetailPath) === relativeDetailPath || !(await exists(absoluteDetailPath))) {
            throw new Error(`${requirementId}: missing or out-of-scope detail path ${item.detail_path}`);
          }
        }
      }
      requirementIds.push(requirementId);
      const evidenceEventIds = new Set(evidence.map((item) => item.event_id));
      requirements.push({
        requirement_id: requirementId,
        module: feature.category || chapter.title,
        feature: feature.name || feature.title || requirementId,
        detailed_behavior: feature.description || "",
        evidence_type: String(feature.classification || "UNCERTAIN").toUpperCase(),
        chapter_id: chapter.chapter_id,
        classification: String(feature.classification || "UNCERTAIN").toUpperCase(),
        confidence: normalizedConfidence(feature.confidence),
        rule_or_limit: feature.rule || "",
        evidence,
        open_question_ids: questions
          .filter((question) => question.evidence_event_ids.some((eventId) => evidenceEventIds.has(eventId)))
          .map((question) => question.question_id),
        platform_assessment: assessmentOverrides[requirementId] || priorRequirement?.platform_assessment || defaultAssessment(feature, chapter.chapter_id)
      });
    }

    chapters.push({
      chapter_id: chapter.chapter_id,
      title: chapter.title,
      description: chapter.description,
      source_directory: sourceDirectory,
      review_directory: reviewDirectoryRelative,
      event_count: chapter.event_frames,
      detail_crop_count: chapter.detail_crops,
      event_contact_sheet_count: chapter.event_contact_sheets,
      safety_contact_sheet_count: chapter.safety_contact_sheets,
      reviewed_event_count: receipt.reviewed_event_ids.length,
      completed_at: receipt.completed_at || "",
      requirement_ids: requirementIds,
      open_question_ids: questions.map((question) => question.question_id)
    });
  }

  const priorSafetyFindings = prior?.platform_safety_findings || [];
  const priorSafetyIds = new Set(priorSafetyFindings.map((finding) => finding.finding_id));
  const platformSafetyFindings = [
    ...priorSafetyFindings,
    ...defaultSafetyFindings().filter((finding) => !priorSafetyIds.has(finding.finding_id))
  ];
  const canonical = {
    schema_version: 1,
    source_of_truth: "This JSON is the canonical requirement, platform-gap and open-question source. Markdown and CSV files are generated from it.",
    allowed_gap_statuses: [...allowedStatuses],
    allowed_priorities: [...allowedPriorities],
    audit_scope: {
      chapters: chapters.length,
      events: chapters.reduce((sum, chapter) => sum + chapter.event_count, 0),
      detail_crops: chapters.reduce((sum, chapter) => sum + chapter.detail_crop_count, 0),
      completed_chapters: chapters.filter((chapter) => chapter.event_count === chapter.reviewed_event_count).length
    },
    chapters,
    requirements,
    open_questions: openQuestions,
    platform_safety_findings: platformSafetyFindings
  };
  const gapRecords = [
    ...requirements.map((item) => item.platform_assessment),
    ...platformSafetyFindings.map((item) => ({ status: item.status, priority: item.priority }))
  ];
  canonical.summary = {
    requirements: requirements.length,
    open_questions: openQuestions.length,
    safety_findings: platformSafetyFindings.length,
    gap_status_counts: Object.fromEntries([...allowedStatuses].map((status) => [status, gapRecords.filter((item) => item.status === status).length])),
    priority_counts: Object.fromEntries([...allowedPriorities].map((priority) => [priority, gapRecords.filter((item) => item.priority === priority).length]))
  };
  await writeFile(canonicalPath, `${JSON.stringify(canonical, null, 2)}\n`);
  return canonical;
}

function validateCanonical(document) {
  if (document.audit_scope?.chapters !== 17 || document.audit_scope?.completed_chapters !== 17) throw new Error("Canonical audit is not 17/17 complete");
  const ids = new Set();
  for (const item of document.requirements || []) {
    if (ids.has(item.requirement_id)) throw new Error(`Duplicate requirement ${item.requirement_id}`);
    ids.add(item.requirement_id);
    if (!allowedStatuses.has(item.platform_assessment?.status)) throw new Error(`${item.requirement_id}: invalid gap status`);
    if (!allowedPriorities.has(item.platform_assessment?.priority)) throw new Error(`${item.requirement_id}: invalid priority`);
    if (!(item.evidence || []).length) throw new Error(`${item.requirement_id}: missing evidence`);
  }
  for (const item of document.platform_safety_findings || []) {
    if (!allowedStatuses.has(item.status)) throw new Error(`${item.finding_id}: invalid safety status`);
    if (!allowedPriorities.has(item.priority)) throw new Error(`${item.finding_id}: invalid safety priority`);
  }
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csv(headers, rows) {
  return `${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function renderMarkdown(document) {
  const counts = Object.fromEntries([...allowedStatuses].map((status) => [status, document.requirements.filter((item) => item.platform_assessment.status === status).length]));
  const priorityCounts = Object.fromEntries([...allowedPriorities].map((priority) => [priority, document.requirements.filter((item) => item.platform_assessment.priority === priority).length]));
  const lines = [
    "# Requisitos maestros reconstruidos del video",
    "",
    "> Generado de forma determinista desde `docs/MASTER_VIDEO_REQUIREMENTS.json`. No editar este archivo directamente.",
    "",
    `- Capítulos: ${document.audit_scope.chapters}/17`,
    `- Eventos revisados: ${document.audit_scope.events}`,
    `- Requisitos: ${document.requirements.length}`,
    `- Preguntas abiertas: ${document.open_questions.length}`,
    `- Estados de gap: ${Object.entries(counts).map(([key, value]) => `${key}=${value}`).join(", ")}`,
    `- Prioridades: ${Object.entries(priorityCounts).map(([key, value]) => `${key}=${value}`).join(", ")}`,
    "",
    "## Gaps P0 de seguridad e integridad",
    "",
    "| ID | Módulo | Gap | Estado |",
    "|---|---|---|---|",
    ...(document.platform_safety_findings || [])
      .filter((finding) => finding.priority === "P0")
      .map((finding) => `| ${finding.finding_id} | ${finding.module.replace(/\|/g, "/")} | ${finding.feature.replace(/\|/g, "/")} | ${finding.status} |`),
    ""
  ];
  for (const chapter of document.chapters) {
    lines.push(`## ${chapter.chapter_id} · ${chapter.title}`, "", `Eventos: ${chapter.reviewed_event_count}/${chapter.event_count}. Requisitos: ${chapter.requirement_ids.length}.`, "", "| ID | Requisito | Evidencia | Estado en plataforma | Prioridad |", "|---|---|---|---|---|");
    for (const id of chapter.requirement_ids) {
      const item = document.requirements.find((requirement) => requirement.requirement_id === id);
      const events = item.evidence.map((entry) => `${entry.event_id} @ ${entry.timestamp}`).join("; ");
      lines.push(`| ${item.requirement_id} | ${item.feature.replace(/\|/g, "/")} | ${events.replace(/\|/g, "/")} | ${item.platform_assessment.status} | ${item.platform_assessment.priority} |`);
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function renderQuestions(document) {
  const lines = [
    "# Preguntas abiertas maestras",
    "",
    "> Generado de forma determinista desde `docs/MASTER_VIDEO_REQUIREMENTS.json`. No editar este archivo directamente.",
    "",
    `Preguntas abiertas: ${document.open_questions.length}. No se infiere ninguna regla de negocio, clínica, financiera o legal ausente.`,
    ""
  ];
  for (const chapter of document.chapters) {
    const questions = document.open_questions.filter((item) => item.chapter_id === chapter.chapter_id);
    if (!questions.length) continue;
    lines.push(`## ${chapter.chapter_id} · ${chapter.title}`, "");
    for (const question of questions) lines.push(`- **${question.question_id} · ${question.classification}** — ${question.question}`);
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

async function renderOutputs(document) {
  validateCanonical(document);
  const featureHeaders = ["requirement_id", "module", "feature", "detailed_behavior", "evidence_type", "chapter_id", "event_ids", "timestamps", "evidence_paths", "classification", "confidence", "test_path", "open_question_ids"];
  const featureRows = document.requirements.map((item) => [
    item.requirement_id, item.module, item.feature, item.detailed_behavior, item.evidence_type, item.chapter_id,
    item.evidence.map((entry) => entry.event_id), item.evidence.map((entry) => entry.timestamp), item.evidence.flatMap((entry) => [entry.path, entry.detail_path].filter(Boolean)),
    item.classification, item.confidence, item.platform_assessment.test_path, item.open_question_ids
  ]);
  const gapHeaders = ["requirement_id", "module", "feature", "detailed_behavior", "evidence_type", "chapter_id", "event_ids", "timestamps", "evidence_paths", "current_platform_evidence", "status", "severity", "patient_safety_impact", "financial_impact", "recommended_action", "blocked_by_client_information", "notes"];
  const gapRows = document.requirements.map((item) => [
    item.requirement_id, item.module, item.feature, item.detailed_behavior, item.evidence_type, item.chapter_id,
    item.evidence.map((entry) => entry.event_id), item.evidence.map((entry) => entry.timestamp), item.evidence.flatMap((entry) => [entry.path, entry.detail_path].filter(Boolean)),
    item.platform_assessment.current_platform_evidence, item.platform_assessment.status, item.platform_assessment.priority,
    item.platform_assessment.patient_safety_impact, item.platform_assessment.financial_impact, item.platform_assessment.recommended_action,
    item.platform_assessment.blocked_by_client_information, item.platform_assessment.notes
  ]);
  for (const finding of document.platform_safety_findings || []) {
    gapRows.push([
      finding.finding_id, finding.module, finding.feature, finding.detailed_behavior, "SAFETY_GUARDRAIL", "N/A", "", "", finding.evidence_paths || [],
      finding.current_platform_evidence, finding.status, finding.priority, finding.patient_safety_impact, finding.financial_impact,
      finding.recommended_action, finding.blocked_by_client_information, finding.notes
    ]);
  }
  await Promise.all([
    writeFile(markdownPath, renderMarkdown(document)),
    writeFile(featureCsvPath, csv(featureHeaders, featureRows)),
    writeFile(gapCsvPath, csv(gapHeaders, gapRows)),
    writeFile(questionsPath, renderQuestions(document))
  ]);
}

const bootstrap = process.argv.includes("--bootstrap");
const document = bootstrap ? await bootstrapCanonical() : JSON.parse(await readFile(canonicalPath, "utf8"));
await renderOutputs(document);
console.log(JSON.stringify({
  mode: bootstrap ? "bootstrap-and-render" : "render",
  chapters: document.audit_scope.chapters,
  events: document.audit_scope.events,
  requirements: document.requirements.length,
  open_questions: document.open_questions.length,
  safety_findings: document.platform_safety_findings.length
}, null, 2));
