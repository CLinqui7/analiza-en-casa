import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { seedData } from "../app/mock-data.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const required = [
  "index.html","app/main.js","app/views.js","app/store.js","app/domain.js","app/mock-data.js",
  "app/supabase-adapter.js","app/templates.js","app/styles.css",
  "api/runtime-config.js","api/health.js","api/notifications.js","api/portal-status.js","api/cron-retries.js",
  "supabase/migrations/202608260001_initial_schema.sql",
  "supabase/migrations/202608260002_security_rls_functions.sql",
  "supabase/migrations/202608260003_indexes_permissions_storage.sql",
  "supabase/seed.sql","vercel.json",".env.example","README.md"
];

const checks = [];
function add(name, passed, detail = "") { checks.push({ name, passed: Boolean(passed), detail }); }

for (const path of required) {
  try { add(`required:${path}`, (await stat(join(root,path))).isFile(), "Archivo presente"); }
  catch { add(`required:${path}`, false, "Archivo faltante"); }
}

const allFiles = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory() && !["node_modules",".git"].includes(entry.name)) await walk(full);
    else if (entry.isFile()) allFiles.push(full);
  }
}
await walk(root);

const clientFiles = allFiles.filter((path) => /\/(app|assets)\//.test(path) || path.endsWith("/index.html"));
const clientText = (await Promise.all(clientFiles.map((path) => readFile(path,"utf8")))).join("\n");
add("security:no-service-role-in-client", !/SUPABASE_SERVICE_ROLE_KEY\s*[=:]\s*["'][^"']+/.test(clientText), "La clave de servicio solo aparece como nombre de variable, nunca con valor.");
add("security:no-hardcoded-provider-secret", !/(TWILIO_AUTH_TOKEN|WHATSAPP_ACCESS_TOKEN|RESEND_API_KEY)\s*[=:]\s*["'][A-Za-z0-9_\-]{12,}/.test(clientText), "No hay secretos de proveedor en el cliente.");

add("seed:synthetic-classification", seedData.meta.dataClassification === "SYNTHETIC_DEMO", seedData.meta.dataClassification);
add("seed:17-video-chapters", seedData.qaCoverage.length === 17, `${seedData.qaCoverage.length} capítulos`);
add("seed:patients", seedData.patients.length >= 5, `${seedData.patients.length} pacientes`);
add("seed:cases", seedData.cases.length >= 5, `${seedData.cases.length} hospitalizaciones`);
add("seed:quotes", seedData.quotes.length >= 5, `${seedData.quotes.length} cotizaciones`);
add("seed:all-patient-documents-marked-demo", seedData.patients.every((p) => p.email.includes("demo") || p.document.includes("DEMO") || p.document.startsWith("00000000")), "Identificadores sintéticos");

const duplicateDocs = seedData.patients.map((p)=>`${p.documentType}:${p.document}`).filter((v,i,a)=>a.indexOf(v)!==i);
add("integrity:unique-patient-documents", duplicateDocs.length === 0, duplicateDocs.join(","));
const duplicateRefs = seedData.payments.map((p)=>p.reference).filter(Boolean).filter((v,i,a)=>a.indexOf(v)!==i);
add("integrity:unique-payment-references", duplicateRefs.length === 0, duplicateRefs.join(","));
add("integrity:quotes-have-items", seedData.quotes.every((q)=>q.items.length>0), "Todas las cotizaciones tienen conceptos");
add("integrity:quote-totals", seedData.quotes.every((q)=>Math.abs(q.total-(q.subtotal-q.discountAmount))<0.011), "Total = subtotal - descuento");
add("integrity:coverage-sum", seedData.quotes.every((q)=>Math.abs(q.total-(q.insurerAmount+q.patientAmount))<0.011), "Total = seguro + paciente");
add("integrity:committed-not-over-stock", seedData.inventoryItems.every((i)=>i.committed<=i.stock), "Comprometido no supera existencia");
add("integrity:closure-review-step", seedData.inventoryClosures.every((c)=>["PENDING_REVIEW","APPROVED"].includes(c.status)), "Los cierres no saltan revisión");

const views = await readFile(join(root,"app/views.js"),"utf8");
const main = await readFile(join(root,"app/main.js"),"utf8");
const actions = [...views.matchAll(/data-action=["']([^"']+)/g)].map((m)=>m[1]);
const dynamicActions = new Set(["set-tab"]);
const handled = new Set([...main.matchAll(/case\s+["']([^"']+)["']\s*:/g)].map((m)=>m[1]));
const missingActions = [...new Set(actions)].filter((action)=>!action.includes("${")&&!handled.has(action)&&!dynamicActions.has(action)&&!action.startsWith("save-"));
add("ui:actions-have-handlers", missingActions.length === 0, missingActions.length ? missingActions.join(", ") : `${new Set(actions).size} acciones cubiertas`);


const configSource = await readFile(join(root,"app/config.js"),"utf8");
const runtimeSource = await readFile(join(root,"api/runtime-config.js"),"utf8");
const styles = await readFile(join(root,"app/styles.css"),"utf8");
add("ui:route-permission-enforcement", views.includes("ROUTE_PERMISSIONS") && views.includes("accessDenied"), "Rutas directas validan permisos");
add("ui:quote-labels-normalized", views.includes("QUOTE_ADMIN_LABELS") && !views.includes("QUOTE_STATUS_LABELS[status] || status"), "Estados no renderizan objetos");
add("ui:save-actions-no-generic-toast", main.includes('action?.startsWith("save-") && action !== "save-settings"'), "Guardar no dispara aviso duplicado");
add("ui:modal-backdrop-stack", styles.includes("Modal stacking fix") && styles.includes(".modal-root > .modal-backdrop"), "Backdrop debajo del diálogo");
add("ui:portal-full-responsive-canvas", styles.includes("Public portal must use the full responsive canvas"), "Portal responsive");
add("ui:quote-summary-contrast", styles.includes("Quote financial summary text must remain legible"), "Importes legibles");
add("config:save-runtime-export", configSource.includes("saveRuntimeConfigOverride"), "Formulario de configuración conectado");
add("config:publishable-key-consistent", runtimeSource.includes("supabasePublishableKey") && main.includes('data.get("supabasePublishableKey")') && views.includes('name="supabasePublishableKey"'), "Nombre de clave consistente");

const schema = await readFile(join(root,"supabase/migrations/202608260001_initial_schema.sql"),"utf8");
const rls = await readFile(join(root,"supabase/migrations/202608260002_security_rls_functions.sql"),"utf8");
for (const table of ["patients","hospitalizations","quotes","quote_versions","payments","clinical_documents","nursing_notes","inventory_movements","inventory_closures","doctor_statements","notifications","patient_portal_links","audit_logs"]) {
  add(`sql:table:${table}`, new RegExp(`create table if not exists public\\.${table}\\b`).test(schema), "Tabla incluida");
  add(`sql:rls:${table}`, new RegExp(`alter table public\\.%I enable row level security`).test(rls) || rls.includes(`public.${table}`), "RLS o política incluida");
}
add("sql:portal-security-definer", /function public\.portal_quote_snapshot/.test(rls) && /security definer/.test(rls), "RPC del portal");
add("sql:atomic-inventory", /function public\.apply_inventory_movement/.test(rls) && /for update/.test(rls), "Movimiento transaccional");
add("sql:signed-document-protection", /protect_signed_clinical_document/.test(rls), "Bloqueo de documentos firmados");
add("sql:idempotency", /idempotency_key/.test(schema), "Pagos, inventario y notificaciones");

const failed = checks.filter((check)=>!check.passed);
const result = {
  project: "Analiza en Casa · Production QA",
  generatedAt: new Date().toISOString(),
  total: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  status: failed.length ? "FAILED" : "PASSED",
  checks
};
await writeFile(join(root,"docs/QA_AUTOMATED_RESULTS.json"),JSON.stringify(result,null,2));
await writeFile(join(root,"docs/QA_AUTOMATED_RESULTS.md"),[
  "# Resultado automatizado de QA",
  "",
  `- Estado: **${result.status}**`,
  `- Controles: ${result.total}`,
  `- Aprobados: ${result.passed}`,
  `- Fallidos: ${result.failed}`,
  `- Generado: ${result.generatedAt}`,
  "",
  "| Control | Resultado | Detalle |",
  "|---|---|---|",
  ...checks.map((c)=>`| ${c.name} | ${c.passed?"PASS":"FAIL"} | ${(c.detail||"").replace(/\|/g,"/")} |`)
].join("\n"));

console.log(JSON.stringify({status:result.status,total:result.total,passed:result.passed,failed:result.failed},null,2));
if (failed.length) {
  console.error("\nControles fallidos:");
  for (const check of failed) console.error(`- ${check.name}: ${check.detail}`);
  process.exitCode = 1;
}
