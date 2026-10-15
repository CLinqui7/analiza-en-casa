import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PurchaseOrder } from './purchase-order';

const printable = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '?');
const money = (value: number) => `USD ${value.toFixed(2)}`;

export async function buildPurchaseOrderPdf(order: PurchaseOrder): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page = document.addPage([612, 792]);
  let y = 742;
  const draw = (label: string, x: number, size = 10, strong = false) => {
    page.drawText(printable(label), {
      x,
      y,
      size,
      font: strong ? bold : regular,
      color: rgb(0.08, 0.16, 0.22),
    });
  };
  const drawRight = (label: string, right: number, size = 9, strong = false) => {
    const font = strong ? bold : regular;
    const value = printable(label);
    page.drawText(value, {
      x: right - font.widthOfTextAtSize(value, size),
      y,
      size,
      font,
      color: rgb(0.08, 0.16, 0.22),
    });
  };
  const header = () => {
    draw('Analiza en Casa', 42, 17, true);
    y -= 30;
    draw('Orden de compra a proveedor', 42, 15, true);
    y -= 26;
    draw(`Numero de orden: ${order.orderNumber}`, 42);
    y -= 18;
    draw(
      `Fecha de orden: ${new Date(order.issuedAt).toLocaleDateString('es-SV', { timeZone: 'America/El_Salvador' })}`,
      42,
    );
    y -= 18;
    draw(`Proveedor: ${order.supplierName.slice(0, 80)}`, 42);
    y -= 32;
    draw('ID / producto', 42, 9, true);
    draw('Cantidad', 330, 9, true);
    drawRight('P. referencia', 445, 9, true);
    drawRight('Total', 570, 9, true);
    y -= 16;
    page.drawLine({ start: { x: 42, y }, end: { x: 570, y }, thickness: 0.7 });
    y -= 18;
  };
  header();
  for (const item of order.items) {
    if (y < 95) {
      page = document.addPage([612, 792]);
      y = 742;
      header();
    }
    draw(item.sku.slice(0, 25), 42, 9, true);
    draw(String(item.quantity), 330, 9);
    drawRight(money(item.referenceUnitPrice), 445);
    drawRight(money(item.lineTotal), 570);
    y -= 14;
    draw(item.name.slice(0, 58), 42, 9);
    y -= 13;
    for (const fragment of `ID: ${item.catalogItemId}`.match(/.{1,60}/g) ?? []) {
      if (y < 95) {
        page = document.addPage([612, 792]);
        y = 742;
        header();
      }
      draw(fragment, 42, 8);
      y -= 11;
    }
    y -= 14;
  }
  if (y < 105) {
    page = document.addPage([612, 792]);
    y = 742;
  }
  page.drawLine({ start: { x: 42, y }, end: { x: 570, y }, thickness: 0.7 });
  y -= 23;
  drawRight(`Total de orden: ${money(order.total)}`, 570, 11, true);
  y -= 35;
  draw('Documento de solicitud. No es factura ni registra recepcion de inventario.', 42, 8);
  return document.save();
}
