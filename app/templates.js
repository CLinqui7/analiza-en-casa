import { money, formatDate, safeText, ITEM_CATEGORY_LABELS, statementBalance } from "./domain.js";

const printCss = `
  @page { size: Letter; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #173042; font-size: 12px; line-height: 1.45; }
  h1,h2,h3,h4,p { margin-top: 0; }
  .header { display:flex; justify-content:space-between; gap:24px; align-items:flex-start; border-bottom:3px solid #15938b; padding-bottom:16px; margin-bottom:18px; }
  .brand { display:flex; gap:12px; align-items:center; }
  .mark { width:44px; height:44px; border-radius:12px; display:grid; place-items:center; background:#0f2d3f; color:white; font-weight:800; }
  .brand small { color:#6c7d88; display:block; margin-top:2px; }
  .doc-title { text-align:right; }
  .doc-title h1 { font-size:20px; margin-bottom:3px; }
  .doc-title small { color:#6c7d88; }
  .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px 16px; margin-bottom:18px; }
  .field { border:1px solid #dce7ec; border-radius:8px; padding:8px 10px; }
  .field small { display:block; color:#6c7d88; margin-bottom:2px; }
  table { width:100%; border-collapse:collapse; margin:10px 0 16px; }
  th, td { text-align:left; padding:8px 7px; border-bottom:1px solid #dce7ec; vertical-align:top; }
  th { background:#edf7f6; color:#0f2d3f; font-size:11px; text-transform:uppercase; letter-spacing:.03em; }
  .right { text-align:right; }
  .summary { width:330px; margin-left:auto; }
  .summary div { display:flex; justify-content:space-between; padding:5px 0; }
  .summary .total { border-top:2px solid #173042; font-size:15px; font-weight:700; margin-top:4px; padding-top:8px; }
  .section { margin:18px 0; }
  .section h2 { font-size:14px; color:#0f2d3f; border-bottom:1px solid #b9d7d4; padding-bottom:5px; }
  .signature-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:48px; margin-top:48px; }
  .signature { border-top:1px solid #173042; padding-top:5px; text-align:center; color:#6c7d88; }
  .footer { margin-top:24px; padding-top:10px; border-top:1px solid #dce7ec; color:#6c7d88; font-size:10px; display:flex; justify-content:space-between; }
  .badge { display:inline-block; padding:3px 7px; border-radius:999px; background:#edf7f6; font-size:10px; }
  .notice { padding:10px; border:1px solid #f2b94b; background:#fff8e8; border-radius:8px; }
`;

function baseHeader(title, code, version = 1) {
  return `
    <div class="header">
      <div class="brand">
        <div class="mark">AC</div>
        <div>
          <strong>Analiza en Casa</strong>
          <small>Atención y hospitalización domiciliar</small>
        </div>
      </div>
      <div class="doc-title">
        <h1>${safeText(title)}</h1>
        <small>${safeText(code)} · Versión ${safeText(version)} · Documento DEMO</small>
      </div>
    </div>
  `;
}

function footer() {
  return `
    <div class="footer">
      <span>Datos completamente ficticios para QA funcional.</span>
      <span>Generado ${formatDate(new Date().toISOString(), true)}</span>
    </div>
  `;
}

function patientGrid(patient, recordCase = null) {
  return `
    <div class="grid">
      <div class="field"><small>Paciente</small><strong>${safeText(patient?.fullName || "—")}</strong></div>
      <div class="field"><small>Documento</small><strong>${safeText(patient?.document || "—")}</strong></div>
      <div class="field"><small>Hospitalización</small><strong>${safeText(recordCase?.id || "—")}</strong></div>
      <div class="field"><small>Fecha de inicio</small><strong>${formatDate(recordCase?.startDate)}</strong></div>
    </div>
  `;
}

function clinicalRecordMetadata(record, corrections = []) {
  const signature = record.signatureMetadata;
  const status = record.documentStatus || record.status || "DRAFT";
  const displayStatus = status === "VOIDED" ? status : corrections.length ? "CORRECTED" : status;
  const correctionRows = corrections.map((correction) => `<li><strong>${safeText(correction.correctionKind)}</strong> · ${safeText(correction.reason)}<br><small>${safeText(correction.authorName)} · ${safeText(correction.authorRole)} · ${formatDate(correction.createdAt, true)}</small><br>${safeText(correction.content?.text || "")}</li>`).join("");
  return `
    <div class="section"><h2>Estado y trazabilidad</h2>
      <div class="grid">
        <div class="field"><small>Estado</small><strong>${safeText(displayStatus)}</strong></div>
        <div class="field"><small>Versión</small><strong>v${safeText(record.version || 1)}</strong></div>
        <div class="field"><small>Firma</small><strong>${signature ? `${safeText(signature.signerRole)} · ${formatDate(signature.signedAt, true)}` : "Sin firma"}</strong></div>
        <div class="field"><small>Validación legal</small><strong>${safeText(signature?.legalValidation || "NEEDS_CLIENT_CONFIRMATION")}</strong></div>
      </div>
      ${record.voidReason ? `<div class="notice"><strong>ANULADO.</strong> Motivo: ${safeText(record.voidReason)} · ${formatDate(record.voidedAt, true)}</div>` : ""}
      ${correctionRows ? `<div class="notice"><strong>Enmiendas y addenda</strong><ol>${correctionRows}</ol></div>` : ""}
    </div>`;
}

export function quoteDocument({ quote, patient, recordCase, insurer }) {
  const rows = quote.items.map((item) => `
    <tr>
      <td><span class="badge">${safeText(ITEM_CATEGORY_LABELS[item.category] || item.category)}</span></td>
      <td>${safeText(item.name)}</td>
      <td class="right">${safeText(item.quantity)}</td>
      <td class="right">${money(item.unitPrice)}</td>
      <td class="right">${money(item.quantity * item.unitPrice - Number(item.discountAmount || 0))}</td>
    </tr>
  `).join("");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${safeText(quote.id)}</title><style>${printCss}</style></head><body>
    ${baseHeader("Cotización de servicios", quote.id, quote.version)}
    ${patientGrid(patient, recordCase)}
    <div class="grid">
      <div class="field"><small>Tipo de cuenta</small><strong>${safeText(recordCase?.accountType || "—")}</strong></div>
      <div class="field"><small>Aseguradora</small><strong>${safeText(insurer?.name || "Pago privado")}</strong></div>
    </div>
    <table>
      <thead><tr><th>Categoría</th><th>Concepto</th><th class="right">Cantidad</th><th class="right">Precio</th><th class="right">Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="summary">
      <div><span>Subtotal</span><strong>${money(quote.subtotal)}</strong></div>
      <div><span>Descuento</span><strong>-${money(quote.discountAmount)}</strong></div>
      <div class="total"><span>Total</span><strong>${money(quote.total)}</strong></div>
      <div><span>Aprobado por seguro</span><strong>${money(quote.insurerAmount)}</strong></div>
      <div><span>Responsabilidad del paciente</span><strong>${money(quote.patientAmount)}</strong></div>
    </div>
    <div class="section"><h2>Comentarios</h2><p>${safeText(quote.comments || "Sin comentarios.")}</p></div>
    <div class="notice"><strong>Plantilla provisional.</strong> Debe reemplazarse por el formato oficial aprobado por el cliente antes de uso legal.</div>
    ${footer()}
  </body></html>`;
}

export function healthReportDocument({ document, patient, recordCase, vitalSigns = [], notes = [], corrections = [] }) {
  const latest = vitalSigns[0];
  const content = document.content || {};
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${safeText(document.title)}</title><style>${printCss}</style></head><body>
    ${baseHeader(document.title, document.id, document.version)}
    ${patientGrid(patient, recordCase)}
    ${clinicalRecordMetadata(document, corrections)}
    <div class="section"><h2>Diagnóstico / motivo de atención</h2><p>${safeText(content.diagnosis || recordCase?.diagnosisSummary || "Pendiente de documentar.")}</p></div>
    <div class="section"><h2>Antecedentes</h2><p>${safeText((content.background || []).join(", ") || "Sin antecedentes registrados.")}</p></div>
    <div class="section"><h2>Alergias</h2><p>${safeText((content.allergies || []).join(", ") || "Sin alergias registradas.")}</p></div>
    <div class="section"><h2>Dispositivos</h2><p>${safeText((content.devices || recordCase?.devices || []).join(", ") || "Ninguno registrado.")}</p></div>
    <div class="section"><h2>Últimos signos vitales</h2>
      <table><thead><tr><th>Fecha</th><th>Temp.</th><th>FC</th><th>FR</th><th>PA</th><th>SpO₂</th><th>Dolor</th></tr></thead>
      <tbody><tr>
        <td>${formatDate(latest?.recordedAt, true)}</td><td>${safeText(latest?.temperature ?? "—")} °C</td>
        <td>${safeText(latest?.heartRate ?? "—")}</td><td>${safeText(latest?.respiratoryRate ?? "—")}</td>
        <td>${safeText(latest ? `${latest.systolic}/${latest.diastolic}` : "—")}</td>
        <td>${safeText(latest?.spo2 ?? "—")}%</td><td>${safeText(latest?.pain ?? "—")}/10</td>
      </tr></tbody></table>
    </div>
    <div class="section"><h2>Resumen y evolución</h2><p>${safeText(document.summary || "Sin resumen.")}</p></div>
    <div class="section"><h2>Plan</h2><p>${safeText(content.plan || "Pendiente de documentar.")}</p></div>
    <div class="section"><h2>Notas de enfermería recientes</h2>
      ${notes.slice(0, 3).map((note) => `<p><strong>${formatDate(note.createdAt, true)} · ${safeText(note.authorName)}</strong><br>${safeText(note.text)}</p>`).join("") || "<p>Sin notas.</p>"}
    </div>
    <div class="signature-grid"><div class="signature">${safeText(document.authorName)}<br>Responsable</div><div class="signature">Firma y sello</div></div>
    ${footer()}
  </body></html>`;
}

export function medicalOrderDocument({ document, patient, recordCase, corrections = [] }) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${safeText(document.title)}</title><style>${printCss}</style></head><body>
    ${baseHeader(document.title, document.id, document.version)}
    ${patientGrid(patient, recordCase)}
    ${clinicalRecordMetadata(document, corrections)}
    <div class="section"><h2>Indicaciones médicas</h2><p style="white-space:pre-line">${safeText(document.content?.indications || document.summary || "Pendiente de documentar.")}</p></div>
    <div class="section"><h2>Vigencia</h2><p>Desde ${formatDate(document.createdAt)} hasta nueva indicación o cierre del caso.</p></div>
    <div class="signature-grid"><div class="signature">${safeText(document.authorName)}<br>Médico responsable</div><div class="signature">Firma y sello</div></div>
    ${footer()}
  </body></html>`;
}

export function medicationCardDocument({ card, patient, recordCase, corrections = [] }) {
  const rows = card.items.map((item) => `
    <tr>
      <td>${safeText(item.medication)}</td><td>${safeText(item.dose)}</td><td>${safeText(item.route)}</td>
      <td>${safeText(item.frequency)}</td><td>${safeText(item.schedule.join(", "))}</td>
      <td>${formatDate(item.startDate)}</td><td>${formatDate(item.endDate)}</td>
    </tr>
  `).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Tarjeta de medicamentos</title><style>${printCss}</style></head><body>
    ${baseHeader("Tarjeta de medicamentos", card.id, card.version || 1)}
    ${patientGrid(patient, recordCase)}
    ${clinicalRecordMetadata(card, corrections)}
    <table><thead><tr><th>Medicamento</th><th>Dosis</th><th>Vía</th><th>Frecuencia</th><th>Horario</th><th>Inicio</th><th>Fin</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="notice">La administración real debe documentar fecha, hora, responsable, omisión y motivo. Esta plantilla es de validación.</div>
    ${footer()}
  </body></html>`;
}

export function carePlanDocument({ document, patient, recordCase, corrections = [] }) {
  const objectives = document.content?.objectives || [];
  const interventions = document.content?.interventions || [];
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${safeText(document.title)}</title><style>${printCss}</style></head><body>
    ${baseHeader(document.title, document.id, document.version)}
    ${patientGrid(patient, recordCase)}
    ${clinicalRecordMetadata(document, corrections)}
    <div class="section"><h2>Objetivos</h2><ol>${objectives.map((item) => `<li>${safeText(item)}</li>`).join("") || "<li>Pendiente de documentar.</li>"}</ol></div>
    <div class="section"><h2>Intervenciones</h2><ol>${interventions.map((item) => `<li>${safeText(item)}</li>`).join("") || "<li>Pendiente de documentar.</li>"}</ol></div>
    <div class="section"><h2>Frecuencia</h2><p>${safeText(document.content?.frequency || "Pendiente")}</p></div>
    <div class="signature-grid"><div class="signature">${safeText(document.authorName)}<br>Responsable</div><div class="signature">Aprobación clínica</div></div>
    ${footer()}
  </body></html>`;
}

export function doctorStatementDocument({ statement, doctor, services = [], patients = [] }) {
  const rows = services.map((service) => {
    const patient = patients.find((record) => record.id === service.patientId);
    return `<tr><td>${formatDate(service.date)}</td><td>${safeText(patient?.fullName || service.patientId)}</td><td>${safeText(service.service)}</td><td class="right">${safeText(service.quantity)}</td><td class="right">${money(service.rate)}</td><td class="right">${money(service.quantity * service.rate)}</td></tr>`;
  }).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${safeText(statement.id)}</title><style>${printCss}</style></head><body>
    ${baseHeader("Estado de cuenta profesional", statement.id, 1)}
    <div class="grid">
      <div class="field"><small>Profesional</small><strong>${safeText(doctor?.name || "—")}</strong></div>
      <div class="field"><small>Especialidad</small><strong>${safeText(doctor?.specialty || "—")}</strong></div>
      <div class="field"><small>Período</small><strong>${formatDate(statement.periodStart)} a ${formatDate(statement.periodEnd)}</strong></div>
      <div class="field"><small>Estado</small><strong>${safeText(statement.status)}</strong></div>
    </div>
    <table><thead><tr><th>Fecha</th><th>Paciente</th><th>Servicio</th><th class="right">Cant.</th><th class="right">Tarifa</th><th class="right">Subtotal</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="summary">
      <div><span>Bruto</span><strong>${money(statement.gross)}</strong></div>
      <div><span>Ajustes</span><strong>${money(statement.adjustments)}</strong></div>
      <div><span>Retenciones</span><strong>-${money(statement.withholdings)}</strong></div>
      <div><span>Pagado</span><strong>-${money(statement.paid)}</strong></div>
      <div class="total"><span>Pendiente</span><strong>${money(statementBalance(statement))}</strong></div>
    </div>
    ${footer()}
  </body></html>`;
}

export function purchaseDocument({ purchase, supplier }) {
  const rows = purchase.items.map((item) => `<tr><td>${safeText(item.name)}</td><td class="right">${safeText(item.quantity)}</td><td class="right">${money(item.unitCost)}</td><td class="right">${safeText(item.taxRate)}%</td><td class="right">${money(item.quantity * item.unitCost)}</td></tr>`).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${safeText(purchase.id)}</title><style>${printCss}</style></head><body>
    ${baseHeader("Orden / registro de compra", purchase.id, 1)}
    <div class="grid">
      <div class="field"><small>Proveedor</small><strong>${safeText(supplier?.name || "—")}</strong></div>
      <div class="field"><small>Factura</small><strong>${safeText(purchase.invoiceNumber || "Pendiente")}</strong></div>
      <div class="field"><small>Fecha</small><strong>${formatDate(purchase.date)}</strong></div>
      <div class="field"><small>Estado</small><strong>${safeText(purchase.status)}</strong></div>
    </div>
    <table><thead><tr><th>Ítem</th><th class="right">Cantidad</th><th class="right">Costo</th><th class="right">IVA</th><th class="right">Subtotal</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="summary">
      <div><span>Subtotal</span><strong>${money(purchase.subtotal)}</strong></div>
      <div><span>IVA</span><strong>${money(purchase.tax)}</strong></div>
      <div><span>Descuento</span><strong>-${money(purchase.discount)}</strong></div>
      <div class="total"><span>Total</span><strong>${money(purchase.total)}</strong></div>
    </div>
    ${footer()}
  </body></html>`;
}

export function inventoryAcknowledgementDocument({ recordCase, patient, reservations = [], inventoryItems = [] }) {
  const rows = reservations.map((reservation) => {
    const item = inventoryItems.find((candidate) => candidate.id === reservation.inventoryItemId);
    return `<tr><td>${safeText(item?.sku || reservation.inventoryItemId)}</td><td>${safeText(item?.name || "—")}</td><td class="right">${safeText(reservation.delivered)}</td><td class="right">${safeText(reservation.consumed)}</td><td class="right">${safeText(reservation.returned)}</td><td>${safeText(reservation.status)}</td></tr>`;
  }).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Acuse de inventario</title><style>${printCss}</style></head><body>
    ${baseHeader("Acuse de inventario en domicilio", `ACK-${recordCase?.id || "DEMO"}`, 1)}
    ${patientGrid(patient, recordCase)}
    <table><thead><tr><th>SKU</th><th>Ítem</th><th class="right">Entregado</th><th class="right">Consumido</th><th class="right">Devuelto</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="signature-grid"><div class="signature">Entrega / bodega</div><div class="signature">Recibe / responsable</div></div>
    ${footer()}
  </body></html>`;
}

export function openPrintWindow(html, title = "Documento") {
  const popup = window.open("", "_blank", "width=960,height=900");
  if (!popup) throw new Error("El navegador bloqueó la ventana de impresión.");
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.document.title = title;
  popup.focus();
  setTimeout(() => popup.print(), 350);
}
