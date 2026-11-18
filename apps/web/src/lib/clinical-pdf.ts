import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type ClinicalPdfBlock = { text: string; heading?: number };
/** Extracts the same selected record as printing, without controls or hidden UI. */
export function clinicalPdfBlocks(source: HTMLElement): ClinicalPdfBlock[] {
  const root = source.cloneNode(true) as HTMLElement;
  root
    .querySelectorAll('.no-print,button,script,style,input,select,textarea,[aria-hidden="true"]')
    .forEach((node) => node.remove());
  const blocks: ClinicalPdfBlock[] = [];
  const readableText = (node: Node): string => {
    if (node.nodeType === 3) return node.textContent ?? '';
    const content = [...node.childNodes].map(readableText).join('');
    return node.nodeType === 1 &&
      /^(BR|P|DIV|SECTION|H[1-6]|LI|DT|DD)$/.test((node as Element).tagName)
      ? ` ${content} `
      : content;
  };
  const text = (node: Node) => readableText(node).replace(/\s+/g, ' ').trim();
  function visit(element: Element) {
    if (element.tagName === 'TABLE') {
      const caption = element.querySelector('caption');
      if (caption) blocks.push({ text: text(caption), heading: 3 });
      const headers = [...element.querySelectorAll('thead th')].map(text);
      for (const row of element.querySelectorAll('tbody tr')) {
        const cells = [...row.children].filter((cell) => ['TD', 'TH'].includes(cell.tagName));
        blocks.push({
          text: cells
            .map(
              (cell, i) =>
                `${headers[i] && cells.length > 1 ? headers[i] + ': ' : ''}${text(cell)}`,
            )
            .join(' · '),
        });
      }
      return;
    }
    if (/^H[1-6]$/.test(element.tagName)) {
      blocks.push({ text: text(element), heading: Number(element.tagName[1]) });
      return;
    }
    if (['P', 'LI', 'DT', 'DD', 'SUMMARY'].includes(element.tagName)) {
      // Preserve nested medication schedules/notes rather than collecting them twice.
      if (text(element)) blocks.push({ text: text(element) });
      return;
    }
    for (const node of element.childNodes) {
      if (node.nodeType === 1) visit(node as Element);
      else if (node.nodeType === 3 && text(node)) blocks.push({ text: text(node) });
    }
  }
  visit(root);
  return blocks.filter((block) => block.text);
}

export async function buildClinicalPdf(blocks: ClinicalPdfBlock[]) {
  if (!blocks.length) throw new Error('Seleccione al menos una sección con contenido.');
  const document = await PDFDocument.create();
  document.setTitle('Expediente clínico');
  document.setCreator('Analiza en Casa');
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.08, 0.22, 0.28),
    accent = rgb(0.68, 0.16, 0.26);
  let page = document.addPage([612, 792]),
    y = 682;
  const header = () => {
    page.drawText('Analiza en Casa', { x: 46, y: 744, size: 17, font: bold, color: ink });
    page.drawText('EXPEDIENTE CLÍNICO', { x: 46, y: 722, size: 9, font: bold, color: accent });
    page.drawLine({
      start: { x: 46, y: 707 },
      end: { x: 566, y: 707 },
      color: rgb(0.84, 0.88, 0.9),
      thickness: 1,
    });
  };
  header();
  for (const block of blocks) {
    const size = block.heading ? (block.heading <= 2 ? 13 : 11) : 10;
    const font = block.heading ? bold : regular;
    // Keep non-WinAnsi characters identifiable instead of silently dropping clinical content.
    const printable = [...block.text.normalize('NFC')]
      .map((char) => {
        try {
          font.encodeText(char);
          return char;
        } catch {
          return `[U+${char.codePointAt(0)!.toString(16).toUpperCase()}]`;
        }
      })
      .join('');
    const lines: string[] = [];
    let line = '';
    for (const word of printable.split(/\s+/)) {
      if (line && font.widthOfTextAtSize(`${line} ${word}`, size) > 520) {
        lines.push(line);
        line = '';
      }
      for (const char of (line ? ' ' : '') + word) {
        if (font.widthOfTextAtSize(line + char, size) > 520) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
    }
    if (line) lines.push(line);
    if (block.heading) y -= 10;
    if (y < (block.heading ? 100 : 65)) {
      page = document.addPage([612, 792]);
      y = 682;
      header();
    }
    for (const row of lines) {
      if (y < 65) {
        page = document.addPage([612, 792]);
        y = 682;
        header();
      }
      page.drawText(row, { x: 46, y, size, font, color: ink });
      y -= size + 5;
    }
    y -= block.heading ? 5 : 8;
  }
  for (const [index, sheet] of document.getPages().entries()) {
    sheet.drawText(`Uso clínico autorizado · Página ${index + 1} de ${document.getPageCount()}`, {
      x: 46,
      y: 35,
      size: 8,
      font: regular,
      color: rgb(0.4, 0.47, 0.5),
    });
  }
  return document.save();
}
