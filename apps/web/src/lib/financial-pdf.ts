import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Patient, Payment, Quote } from '@analiza/contracts';

const money = (value: number) => `USD ${value.toFixed(2)}`;
const safe = (value: string) => value.replace(/[\u2013\u2014]/g, '-').replace(/\u2022/g, '*');

type LineWriter = (text: string, options?: { bold?: boolean; size?: number; gap?: number }) => void;

async function documentWithWriter(title: string) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page = document.addPage([612, 792]);
  let y = 744;
  const write: LineWriter = (text, options = {}) => {
    const size = options.size ?? 10;
    const words = safe(text).split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > 78 && line) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    lines.push(line);
    for (const [index, currentLine] of lines.entries()) {
      if (y < 54) {
        page = document.addPage([612, 792]);
        y = 744;
      }
      page.drawText(currentLine, {
        x: 48,
        y,
        size,
        font: options.bold ? bold : regular,
        color: rgb(0.04, 0.18, 0.27),
      });
      y -= index === lines.length - 1 ? (options.gap ?? size + 7) : size + 4;
    }
  };
  write('ANALIZA EN CASA', { bold: true, size: 11, gap: 25 });
  write(title, { bold: true, size: 18, gap: 28 });
  return { document, write };
}

export async function buildQuotePdf(quote: Quote, patient?: Patient): Promise<Uint8Array> {
  if (quote.status !== 'SENT' || !quote.immutable)
    throw new Error('Sólo se exportan versiones enviadas e inmutables.');
  const { document, write } = await documentWithWriter('Cotización informativa');
  write('No es factura ni documento fiscal.', { bold: true, gap: 22 });
  write(`Referencia: ${quote.id} · versión ${quote.version}`);
  write(`Paciente: ${patient?.fullName ?? 'No disponible'}`);
  write(`Fecha de envío: ${new Date(quote.sentAt ?? quote.createdAt).toLocaleString('es-SV')}`);
  write(`Resumen: ${quote.summary}`, { gap: 22 });
  write('Conceptos', { bold: true, size: 13, gap: 21 });
  if (!quote.items.length) write('Sin conceptos registrados.');
  for (const item of quote.items) {
    const subtotal = item.quantity * item.unitPrice - item.discountAmount;
    write(`${item.name} · ${item.quantity} x ${money(item.unitPrice)} · ${money(subtotal)}`);
  }
  write('', { gap: 7 });
  write(`Subtotal: ${money(quote.subtotal)}`);
  write(`Descuento: ${money(quote.discountAmount)}`);
  write(`Total: ${money(quote.total)}`, { bold: true });
  write(`Responsabilidad de aseguradora: ${money(quote.insurerAmount)}`);
  write(`Responsabilidad del paciente: ${money(quote.patientAmount)}`);
  write('', { gap: 12 });
  write(
    'Documento generado para consulta interna autorizada. No contiene reglas fiscales, de cobertura ni de validez.',
  );
  return document.save();
}

export async function buildPaymentReceiptPdf(
  payment: Payment,
  quote: Quote,
  patient?: Patient,
): Promise<Uint8Array> {
  const { document, write } = await documentWithWriter('Comprobante interno de pago');
  write('No es factura ni documento fiscal.', { bold: true, gap: 22 });
  write(`Pago: ${payment.id}`);
  write(`Cotización: ${quote.id} · versión ${quote.version}`);
  write(`Paciente: ${patient?.fullName ?? 'No disponible'}`);
  write(`Fecha: ${new Date(payment.createdAt).toLocaleString('es-SV')}`);
  write(`Monto: ${money(payment.amount)}`, { bold: true });
  write(`Referencia: ${payment.reference}`);
  write(`Estado: ${payment.status === 'APPLIED' ? 'Aplicado' : 'Reversado'}`);
  if (payment.voidReason) write(`Motivo de reversión: ${payment.voidReason}`);
  write('', { gap: 14 });
  write(
    'Este comprobante documenta un movimiento interno. No sustituye una factura ni acredita tratamiento fiscal.',
  );
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
