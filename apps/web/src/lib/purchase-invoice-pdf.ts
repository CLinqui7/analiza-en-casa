import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Purchase } from '@analiza/contracts';
import { purchaseTotals } from './purchase-totals';

const printable = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '?');
const money = (value: number) => `USD ${value.toFixed(2)}`;

export async function buildPurchaseInvoicePdf(
  lines: readonly Purchase[],
  names: Map<string, string>,
): Promise<Uint8Array> {
  if (!lines.length) throw new Error('No hay líneas.');
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page = document.addPage([612, 792]);
  let y = 744;
  const draw = (value: string, x: number, size = 9, strong = false) =>
    page.drawText(printable(value), {
      x,
      y,
      size,
      font: strong ? bold : regular,
      color: rgb(0.08, 0.16, 0.22),
    });
  const right = (value: string, x: number, size = 9, strong = false) => {
    const font = strong ? bold : regular;
    const text = printable(value);
    page.drawText(text, {
      x: x - font.widthOfTextAtSize(text, size),
      y,
      size,
      font,
      color: rgb(0.08, 0.16, 0.22),
    });
  };
  const header = () => {
    draw('Analiza en Casa', 42, 17, true);
    y -= 32;
    draw('Registro interno de factura de compra', 42, 14, true);
    y -= 24;
    draw(
      `Numero de factura de proveedor: ${lines[0].invoiceNumber || 'No registrado'}`.slice(0, 95),
      42,
    );
    y -= 16;
    draw(`Referencia: ${lines[0].reference}`.slice(0, 95), 42);
    y -= 16;
    draw(
      `Proveedor: ${names.get(lines[0].supplierCatalogItemId ?? '') ?? 'No documentado'}`.slice(
        0,
        95,
      ),
      42,
    );
    y -= 16;
    draw(`Fecha de registro: ${new Date(lines[0].createdAt).toLocaleDateString('es-SV')}`, 42);
    y -= 24;
    draw('Producto', 42, 9, true);
    right('Cantidad', 350, 9, true);
    right('Precio sin IVA', 460, 9, true);
    right('Subtotal', 570, 9, true);
    y -= 17;
    page.drawLine({ start: { x: 42, y }, end: { x: 570, y }, thickness: 0.7 });
    y -= 17;
  };
  header();
  for (const line of lines) {
    if (y < 130) {
      page = document.addPage([612, 792]);
      y = 744;
      header();
    }
    draw((names.get(line.catalogItemId) ?? line.catalogItemId).slice(0, 43), 42);
    right(String(line.quantity ?? 1), 350);
    right(line.unitCost === undefined ? 'Sin dato' : `USD ${line.unitCost.toFixed(4)}`, 460);
    right(
      line.unitCost === undefined ? 'Sin dato' : money((line.quantity ?? 1) * line.unitCost),
      570,
    );
    y -= 17;
  }
  if (y < 140) {
    page = document.addPage([612, 792]);
    y = 744;
  }
  page.drawLine({ start: { x: 340, y }, end: { x: 570, y }, thickness: 0.7 });
  y -= 20;
  const totals = purchaseTotals(lines);
  if (totals) {
    right(`Subtotal: ${money(totals.subtotal)}`, 570);
    y -= 16;
    right(`IVA 13%: ${money(totals.iva)}`, 570);
    y -= 16;
    right(`IVA percibido 1%: ${money(totals.perception)}`, 570);
    y -= 19;
    right(`Total: ${money(totals.total)}`, 570, 11, true);
    y -= 25;
  } else {
    right('Impuestos no documentados en este registro', 570);
    y -= 25;
  }
  if (lines.every((line) => line.invoiceVoidedAt)) {
    draw('FACTURA ANULADA EN EL SISTEMA', 42, 10, true);
    y -= 20;
  }
  draw(
    'Comprobante interno de registro. No sustituye el documento tributario del proveedor.',
    42,
    8,
  );
  return document.save();
}
