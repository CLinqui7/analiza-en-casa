# Checkpoint de continuación de bajo consumo

- Rama: `codex/react-full-parity-selenium-100`.
- Último checkpoint: este commit `chore: checkpoint React parity before lower-cost continuation` (obtenga SHA con `git rev-parse --short HEAD`).
- Acabado ahora: evidencia de roles para navegación, recursos de enfermería y acciones operativas; no se añadió persistencia clínica. `MEDICAL-ORDER-CREATE` sigue siendo estado local y está marcado `PARTIAL`.
- Archivos locales de este checkpoint: `docs/qa/REACT_ROLE_MATRIX.json`, `docs/qa/CREDIT_HANDOFF.md`.

## Estado funcional ya cerrado (sin afirmar paridad exacta)

Pacientes y detalle, hospitalizaciones, cotizaciones inmutables, pagos idempotentes, documentos clínicos de cuidado/evolución, signos vitales, recursos de enfermería, agenda, reporte de horas, catálogo, borradores de compra, inventario/Kárdex, auditoría, ayuda, búsqueda de seguros y portal con OTP. Los guards React de las seis cuentas sintéticas están cubiertos en Playwright; las acciones de recursos de enfermería y órdenes operativas tienen permisos granulares.

## Paridad de rutas

- Totales: 40; `MIGRATED_EXACT`: 1; `MIGRATED_PARTIAL`: 26; `MISSING`: 13; bloqueadas por reglas/confirmación de cliente: 8.
- Parciales restantes: `ROUTE-DASHBOARD`, `ROUTE-PATIENTS`, `ROUTE-PATIENT-DETAIL`, `ROUTE-PATIENT-EDIT`, `ROUTE-HOSPITALIZATIONS`, `ROUTE-QUOTES`, `ROUTE-INSURANCE`, `ROUTE-RECEIVABLES`, `ROUTE-PAYMENTS`, `ROUTE-CLINICAL-HOME`, `ROUTE-CLINICAL-HOSPITALIZATIONS`, `ROUTE-HEALTH-REPORTS`, `ROUTE-MEDICAL-ORDERS`, `ROUTE-MEDICATION-CARDS`, `ROUTE-CARE-PLANS`, `ROUTE-EVOLUTIONS`, `ROUTE-NURSING-RESOURCES`, `ROUTE-AGENDA`, `ROUTE-NURSE-HOURS`, `ROUTE-PURCHASES`, `ROUTE-INVENTORY`, `ROUTE-INVENTORY-MOVEMENTS`, `ROUTE-KARDEX`, `ROUTE-CATALOGS`, `ROUTE-AUDIT`, `ROUTE-PORTAL`.
- Missing restantes: `ROUTE-PAYABLES`, `ROUTE-INVENTORY-COMMITMENTS`, `ROUTE-INVENTORY-CLOSURES`, `ROUTE-WAREHOUSES`, `ROUTE-KITS`, `ROUTE-LOTS`, `ROUTE-SUPPLIERS`, `ROUTE-DISCOUNTS`, `ROUTE-DOCTORS`, `ROUTE-PROFESSIONAL-STATEMENTS`, `ROUTE-REPORTS`, `ROUTE-SETTINGS`, `ROUTE-QA`.

## Blockers reales

- Preautorización/decisión de seguros, reglas de cobertura y rechazo requieren reglas de cliente.
- Tarjetas de medicamentos requieren autorización, dosis, frecuencia, administración y correcciones aprobadas; no inventarlas.
- Cuentas por cobrar, descuentos, cierres y conciliación requieren reglas financieras aprobadas.
- `MEDICAL-ORDER-CREATE` es una acción operacional local: para persistirla habría que definir un flujo no clínico auditado y no reutilizar tablas de prescripción.
- Producción Supabase aún requiere integración contra proyecto real, exposición explícita de tablas Data API, RLS/pgTAP y verificación de esquema; nunca usar `service_role` en el navegador.
- Entrega del OTP del portal, retención/auditoría de producción y reglas clínicas restantes requieren configuración o confirmación del cliente.

## Cobertura Selenium

- Acciones UI totales: 39.
- Selenium required: 39; cubiertas: 0; pendientes: 39; cobertura: 0.00%.
- No se amplió Selenium. `npm run selenium:coverage` falla intencionalmente por las 39 acciones sin `selenium_test_ids`.

## Última verificación

- Playwright focalizado: `npm run test:browser:react -- --grep "primary navigation requires|nursing resources require|clinical action search"` — 3 passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed.
- `npm run qa:inventory` — passed.
- `npm run react:parity` — failed esperado: 1 exacta/39 gaps resolubles o bloqueados explícitamente.
- `npm run selenium:coverage` — failed esperado: 0/39, 0.00%.
- Bug/gap conocido: crear una acción en `/clinical/orders` no sobrevive a recarga; se mantiene `PARTIAL` y no se afirma como orden clínica.

## Reanudar

- Primer `route_id`: `ROUTE-DASHBOARD` (primero `MIGRATED_PARTIAL` del manifiesto).
- Primer `action_id`: `INSURANCE-APPROVE` (primera acción `MISSING`; requiere regla de cliente antes de implementar).
- Comandos:

```powershell
git status --short
npm run qa:inventory
npm run react:parity
npm run selenium:coverage
npm run test:browser:react -- --grep "primary navigation requires|nursing resources require|clinical action search"
npm run typecheck
npm run lint
npm run build
```
