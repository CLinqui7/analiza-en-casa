import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Patient, Payment, Quote } from '@analiza/contracts';
import { quoteCategories, quoteDisplayCode } from '@analiza/domain';
import { usdAmountInSpanishWords } from './money-in-words';

const money = (value: number) => `USD ${value.toFixed(2)}`;
const safe = (value: string) =>
  value
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2022/g, '*')
    .replace(/[^\x20-\x7e\u00a1-\u00ff]/g, ' ');

export function quotePdfPresentation(quote: Quote) {
  return {
    sentDate: new Date(quote.sentAt ?? quote.createdAt).toLocaleDateString('es-SV', {
      timeZone: 'America/El_Salvador',
    }),
    paymentCondition: quote.paymentCondition || 'No especificada',
    amountInWords: usdAmountInSpanishWords(quote.total) ?? 'No disponible para este importe.',
    footer: 'Documento generado para consulta interna autorizada. No contiene reglas fiscales.',
  };
}

type LineWriter = (text: string, options?: { bold?: boolean; size?: number; gap?: number }) => void;

async function documentWithWriter(title: string, logoBytes?: Uint8Array) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const logo = logoBytes ? await document.embedPng(logoBytes) : undefined;
  let page = document.addPage([612, 792]);
  let y = 658;
  function drawHeader(continued = false) {
    if (logo) {
      const ratio = logo.width / logo.height;
      page.drawImage(logo, { x: 48, y: 715, width: 160, height: 160 / ratio });
    } else {
      page.drawRectangle({ x: 48, y: 734, width: 20, height: 20, color: rgb(0.81, 0.19, 0.22) });
      page.drawRectangle({ x: 53, y: 729, width: 10, height: 30, color: rgb(0.88, 0.25, 0.29) });
      page.drawText('Analiza en Casa', {
        x: 77,
        y: 735,
        size: 16,
        font: bold,
        color: rgb(0.18, 0.3, 0.47),
      });
    }
    page.drawLine({
      start: { x: 48, y: 707 },
      end: { x: 564, y: 707 },
      thickness: 1,
      color: rgb(0.81, 0.87, 0.9),
    });
    page.drawText(continued ? `${title} - continuación` : title, {
      x: 48,
      y: 677,
      size: 18,
      font: bold,
      color: rgb(0.04, 0.18, 0.27),
    });
  }
  drawHeader();
  const ensureSpace = (height: number) => {
    if (y - height >= 68) return false;
    page = document.addPage([612, 792]);
    drawHeader(true);
    y = 658;
    return true;
  };
  const write: LineWriter = (text, options = {}) => {
    const size = options.size ?? 10;
    if (!text.trim()) {
      y -= options.gap ?? 12;
      return;
    }
    const font = options.bold ? bold : regular;
    const words = safe(text).split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > 516 && line) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    lines.push(line);
    for (const [index, currentLine] of lines.entries()) {
      ensureSpace(size + 7);
      page.drawText(currentLine, {
        x: 48,
        y,
        size,
        font,
        color: rgb(0.04, 0.18, 0.27),
      });
      y -= index === lines.length - 1 ? (options.gap ?? size + 7) : size + 4;
    }
  };
  const quoteTableHeader = () => {
    ensureSpace(28);
    page.drawRectangle({ x: 48, y: y - 21, width: 516, height: 26, color: rgb(0.92, 0.95, 0.97) });
    for (const [label, x] of [
      ['Concepto', 56],
      ['Cant.', 318],
      ['Precio', 368],
      ['Desc.', 438],
      ['Subtotal', 506],
    ] as const)
      page.drawText(label, { x, y: y - 12, size: 8, font: bold, color: rgb(0.17, 0.3, 0.39) });
    y -= 30;
  };
  const quoteCategory = (label: string) => {
    ensureSpace(48);
    page.drawRectangle({ x: 48, y: y - 17, width: 516, height: 22, color: rgb(0.9, 0.96, 0.95) });
    page.drawText(safe(label), {
      x: 56,
      y: y - 10,
      size: 9,
      font: bold,
      color: rgb(0.03, 0.33, 0.36),
    });
    y -= 25;
    quoteTableHeader();
  };
  const quoteRow = (item: Quote['items'][number], index: number) => {
    const name = safe(`${item.name}${item.doctorName ? ` | Médico: ${item.doctorName}` : ''}`);
    const lines: string[] = [];
    let line = '';
    for (const word of name.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (regular.widthOfTextAtSize(next, 8.5) > 250 && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
    const height = Math.max(28, lines.length * 12 + 12);
    if (ensureSpace(height)) quoteTableHeader();
    if (index % 2 === 1)
      page.drawRectangle({
        x: 48,
        y: y - height + 3,
        width: 516,
        height,
        color: rgb(0.975, 0.984, 0.989),
      });
    lines.forEach((text, lineIndex) =>
      page.drawText(text, {
        x: 56,
        y: y - 10 - lineIndex * 12,
        size: 8.5,
        font: regular,
        color: rgb(0.06, 0.2, 0.28),
      }),
    );
    const values = [
      [String(item.quantity), 350],
      [money(item.unitPrice), 425],
      [money(item.discountAmount), 495],
      [money(item.quantity * item.unitPrice - item.discountAmount), 559],
    ] as const;
    for (const [value, right] of values)
      page.drawText(value, {
        x: right - regular.widthOfTextAtSize(value, 8),
        y: y - 10,
        size: 8,
        font: regular,
        color: rgb(0.06, 0.2, 0.28),
      });
    y -= height;
    page.drawLine({
      start: { x: 48, y },
      end: { x: 564, y },
      thickness: 0.4,
      color: rgb(0.89, 0.92, 0.94),
    });
  };
  const quoteTotal = (total: number) => {
    ensureSpace(50);
    page.drawRectangle({ x: 48, y: y - 40, width: 516, height: 46, color: rgb(0.04, 0.24, 0.32) });
    page.drawText('TOTAL COTIZADO', {
      x: 62,
      y: y - 22,
      size: 10,
      font: bold,
      color: rgb(1, 1, 1),
    });
    const value = money(total);
    page.drawText(value, {
      x: 548 - bold.widthOfTextAtSize(value, 17),
      y: y - 25,
      size: 17,
      font: bold,
      color: rgb(1, 1, 1),
    });
    y -= 58;
  };
  const finish = () => {
    const pages = document.getPages();
    for (const [index, current] of pages.entries()) {
      current.drawLine({
        start: { x: 48, y: 43 },
        end: { x: 564, y: 43 },
        thickness: 1,
        color: rgb(0.81, 0.87, 0.9),
      });
      current.drawText(`Documento interno · página ${index + 1} de ${pages.length}`, {
        x: 48,
        y: 29,
        size: 8,
        font: regular,
        color: rgb(0.38, 0.47, 0.52),
      });
    }
  };
  return { document, write, finish, quoteTableHeader, quoteCategory, quoteRow, quoteTotal };
}

export async function buildQuotePdf(
  quote: Quote,
  patient?: Patient,
  logoBytes?: Uint8Array,
): Promise<Uint8Array> {
  if (quote.status !== 'SENT' || !quote.immutable)
    throw new Error('Sólo se exportan versiones enviadas e inmutables.');
  const presentation = quotePdfPresentation(quote);
  const { document, write, finish, quoteCategory, quoteRow, quoteTotal } = await documentWithWriter(
    'Cotización informativa',
    logoBytes,
  );
  write('No es factura ni documento fiscal.', { bold: true, gap: 22 });
  write(`Referencia: ${quoteDisplayCode(quote.id)} · versión ${quote.version}`);
  write(`Paciente: ${patient?.fullName ?? 'No disponible'}`);
  write(`Fecha de envío: ${presentation.sentDate}`);
  write(`Condición de pago: ${presentation.paymentCondition}`);
  write(`Atención: ${quote.careSetting ?? 'No documentada'}`);
  write(`Hospitalización: ${quote.caseId ?? 'Atención nueva sin hospitalización'}`);
  write(`Resumen: ${quote.summary}`, { gap: 22 });
  write('Servicios y conceptos cotizados', { bold: true, size: 13, gap: 23 });
  if (!quote.items.length) write('Sin conceptos registrados.');
  for (const category of quoteCategories) {
    const items = quote.items.filter((item) => item.category === category.value);
    if (!items.length) continue;
    quoteCategory(category.label);
    items.forEach(quoteRow);
  }
  write('', { gap: 7 });
  write('Resumen financiero', { bold: true, size: 13, gap: 21 });
  write(`Subtotal: ${money(quote.subtotal)}`);
  write(`Descuento: ${money(quote.discountAmount)}`);
  quoteTotal(quote.total);
  write(`Monto en letras: ${presentation.amountInWords}`);
  write(`Responsabilidad de aseguradora: ${money(quote.insurerAmount)}`);
  write(`Responsabilidad del paciente: ${money(quote.patientAmount)}`);
  if (quote.comments) write(`Comentarios: ${quote.comments}`, { gap: 16 });
  write('', { gap: 12 });
  write(presentation.footer);
  finish();
  return document.save();
}

export async function buildPaymentReceiptPdf(
  payment: Payment,
  quote: Quote,
  patient?: Patient,
): Promise<Uint8Array> {
  const { document, write, finish } = await documentWithWriter('Comprobante interno de pago');
  write('No es factura ni documento fiscal.', { bold: true, gap: 22 });
  write(`Pago: ${payment.id}`);
  write(`Cotización: ${quoteDisplayCode(quote.id)} · versión ${quote.version}`);
  write(`Paciente: ${patient?.fullName ?? 'No disponible'}`);
  write(`Fecha: ${new Date(payment.createdAt).toLocaleString('es-SV')}`);
  write(`Monto: ${money(payment.amount)}`, { bold: true });
  write(
    `Medio de pago: ${
      payment.paymentMethod
        ? { CASH: 'Efectivo', CHECK: 'Cheque', TRANSFER: 'Transferencia', CARD: 'Tarjeta' }[
            payment.paymentMethod
          ]
        : 'No registrado'
    }`,
  );
  if (payment.reference) write(`Número de referencia: ${payment.reference}`);
  write(`Estado: ${payment.status === 'APPLIED' ? 'Aplicado' : 'Reversado'}`);
  if (payment.voidReason) write(`Motivo de reversión: ${payment.voidReason}`);
  write('', { gap: 14 });
  write(
    'Este comprobante documenta un movimiento interno. No sustituye una factura ni acredita tratamiento fiscal.',
  );
  finish();
  return document.save();
}

export async function buildPatientStatementPdf(
  patient: Patient,
  accounts: ReadonlyArray<{ quote: Quote; responsibility: number; paid: number; balance: number }>,
  payments: readonly Payment[],
  quotes: readonly Quote[],
  logoBytes?: Uint8Array,
): Promise<Uint8Array> {
  const { document, write, finish } = await documentWithWriter(
    'Estado de cuenta individual',
    logoBytes,
  );
  const quoteRoot = (quote: Quote) => quote.rootQuoteId ?? quote.originalQuoteId ?? quote.id;
  const quotesById = new Map(quotes.map((quote) => [quote.id, quote]));
  write(
    'Documento interno no fiscal. Importes de responsabilidad del paciente y pagos aplicados.',
    {
      bold: true,
      gap: 22,
    },
  );
  write(`Paciente: ${patient.fullName}`);
  write(`Documento: ${patient.documentId || 'No registrado'}`);
  write(`Fecha de emisión: ${new Date().toLocaleDateString('es-SV')}`, { gap: 22 });
  write('Movimientos', { bold: true, size: 13, gap: 21 });
  const roots = new Set(accounts.map((account) => quoteRoot(account.quote)));
  for (const account of accounts) {
    write(
      `${new Date(account.quote.sentAt ?? account.quote.createdAt).toLocaleDateString('es-SV')} · ${quoteDisplayCode(account.quote.id)} v${account.quote.version} · cargo ${money(account.responsibility)}`,
      { bold: true },
    );
    const relatedPayments = payments.filter((payment) => {
      const source = quotesById.get(payment.quoteId);
      return (
        payment.status === 'APPLIED' && source && quoteRoot(source) === quoteRoot(account.quote)
      );
    });
    for (const payment of relatedPayments) {
      write(
        `${new Date(payment.createdAt).toLocaleDateString('es-SV')} · pago ${payment.paymentMethod ?? 'registrado'} · abono ${money(payment.amount)}`,
        { size: 9 },
      );
    }
    write(`Saldo de cotización: ${money(account.balance)}`, { gap: 19 });
  }
  if (!roots.size) write('Sin cotizaciones enviadas para este paciente.');
  write('Resumen', { bold: true, size: 13, gap: 21 });
  write(`Cargos: ${money(accounts.reduce((sum, account) => sum + account.responsibility, 0))}`);
  write(`Pagos aplicados: ${money(accounts.reduce((sum, account) => sum + account.paid, 0))}`);
  write(`Saldo pendiente: ${money(accounts.reduce((sum, account) => sum + account.balance, 0))}`, {
    bold: true,
  });
  finish();
  return document.save();
}

export function downloadPdf(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
  anchor.click();
  URL.revokeObjectURL(url);
}
