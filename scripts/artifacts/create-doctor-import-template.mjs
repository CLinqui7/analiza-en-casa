// Run with the bundled artifact runtime; ARTIFACT_WORKSPACE has a node_modules
// junction to that runtime. This builder never reads operational doctor data.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const runtime = createRequire(path.join(path.resolve(process.env.ARTIFACT_WORKSPACE), 'entry.cjs'));
const { Workbook, SpreadsheetFile } = await import(
  pathToFileURL(runtime.resolve('@oai/artifact-tool')).href
);
const output = path.resolve('outputs/doctors-preparation-20261105');
const previews = path.resolve('.local/doctor-import-artifact');
const fields = [
  ['ID de origen', 'Recomendado', 'Identificador del archivo original. Conservar como texto.'],
  ['Nombre completo', 'Obligatorio', 'Nombre del profesional, tal como aparece en la fuente.'],
  ['Especialidad', 'Obligatorio', 'Especialidad informada por el equipo.'],
  ['Teléfono fijo', 'Obligatorio', 'Texto. No sustituir por celular ni completar con ceros.'],
  [
    'Nuevo o recurrente',
    'Obligatorio',
    'Seleccionar Nuevo o Recurrente. Sin valor predeterminado.',
  ],
  ['JVPM', 'Opcional', 'Número de colegiación como texto.'],
  ['CONADEM', 'Opcional', 'Registro como texto.'],
  ['DUI', 'Opcional', 'Conservar ceros iniciales y guiones.'],
  ['NIT', 'Opcional', 'Conservar el identificador original como texto.'],
  ['Teléfono celular', 'Opcional', 'Texto. Puede incluir código de país.'],
  ['Email', 'Opcional', 'Correo del médico.'],
  ['Fecha de nacimiento', 'Opcional', 'Fecha completa AAAA-MM-DD. Dejar vacía si falta.'],
  ['Clínica', 'Opcional', 'Nombre de la clínica.'],
  ['Dirección', 'Opcional', 'Dirección indicada en la fuente.'],
  ['Horarios de consulta', 'Opcional', 'Horario informado; no inferir disponibilidad.'],
  ['Horario de visita médica', 'Opcional', 'Horario informado por el equipo.'],
  ['Zona', 'Opcional', 'Zona de atención indicada.'],
  ['Nombre de la secretaria', 'Opcional', 'Nombre informado por el equipo.'],
  [
    'Cumpleaños de la secretaria',
    'Opcional',
    'Fecha AAAA-MM-DD. Si falta el año, dejar pendiente.',
  ],
];
const wb = Workbook.create();
const sheet = wb.worksheets.add('Medicos');
const guide = wb.worksheets.add('Guia');
for (const s of [sheet, guide]) s.showGridLines = false;
sheet.tabColor = '#20485C';
sheet.getRange('A1:S1001').format.font = { name: 'Arial', size: 10, color: '#17384A' };
sheet.getRange('A1:S1001').format.rowHeight = 23;
sheet.getRange('A1:S1001').format.columnWidth = 24;
sheet.getRange('A1:S1001').format.verticalAlignment = 'center';
sheet.getRange('A2:S1001').setNumberFormat('@');
sheet.getRange('L2:L1001').setNumberFormat('yyyy-mm-dd');
sheet.getRange('S2:S1001').setNumberFormat('yyyy-mm-dd');
sheet.getRange('A1:S1').values = [fields.map(([label]) => label)];
sheet.tables.add('A1:S1001', true, 'MedicosPorRevisar');
sheet.getRange('A1:S1').format = {
  fill: '#20485C',
  font: { name: 'Arial', size: 10, bold: true, color: '#FFFFFF' },
  rowHeight: 44,
  wrapText: true,
  horizontalAlignment: 'center',
  verticalAlignment: 'center',
};
sheet.getRange('B2:E1001').format.fill = '#FFF5DD';
sheet.getRange('B1:B1001').format.columnWidth = 38;
sheet.getRange('C1:C1001').format.columnWidth = 30;
sheet.getRange('N1:N1001').format.columnWidth = 40;
sheet.getRange('E2:E1001').dataValidation = {
  rule: { type: 'list', values: ['Nuevo', 'Recurrente'] },
};
sheet.freezePanes.freezeRows(1);
sheet.freezePanes.freezeColumns(2);
guide.getRange('A1:C33').format.font = { name: 'Arial', size: 10, color: '#17384A' };
guide.getRange('A1:C33').format.rowHeight = 28;
guide.getRange('A1:A33').format.columnWidth = 34;
guide.getRange('B1:B33').format.columnWidth = 17;
guide.getRange('C1:C33').format.columnWidth = 85;
guide.getRange('A2').values = [['Carga de médicos']];
guide.getRange('A2').format.font = { name: 'Arial', size: 16, bold: true, color: '#20485C' };
guide.getRange('A3').values = [
  ['Una fila por médico. La hoja Medicos tiene espacio preparado para 1.000 registros.'],
];
guide.getRange('A5:C5').values = [['Campo', 'Captura', 'Cómo completarlo']];
guide.getRange('A5:C5').format = {
  fill: '#20485C',
  font: { name: 'Arial', size: 10, bold: true, color: '#FFFFFF' },
  rowHeight: 30,
};
guide.getRange('A6:C24').values = fields;
guide.getRange('A6:C24').format.verticalAlignment = 'center';
guide.getRange('A7:B10').format.fill = '#FFF5DD';
guide.getRange('A26').values = [['Antes de entregar el archivo']];
guide.getRange('A26').format.font = { name: 'Arial', size: 12, bold: true };
guide.getRange('A27').values = [
  ['Conservar el original. Completar una copia sin fórmulas y sin cambiar los encabezados.'],
];
guide.getRange('A28').values = [
  ['Dejar vacíos los datos opcionales desconocidos. Los obligatorios faltantes quedan pendientes.'],
];
guide.getRange('A29').values = [
  ['Los posibles duplicados se revisan antes de guardar; no se fusionan automáticamente.'],
];
guide.getRange('A30').values = [
  ['Esta plantilla prepara la revisión. Completarla no carga médicos en la aplicación.'],
];
guide.getRange('A32').values = [
  ['Campos según el formulario vigente y las decisiones del cliente del 20 de octubre de 2026.'],
];
wb.recalculate();
await fs.mkdir(output, { recursive: true });
await fs.mkdir(previews, { recursive: true });
for (const [name, range, filename] of [
  ['Medicos', 'A1:H8', 'medicos-first.png'],
  ['Medicos', 'I1:S8', 'medicos-last.png'],
  ['Guia', 'A1:C33', 'guide.png'],
]) {
  const blob = await wb.render({ sheetName: name, range, scale: 1.4, format: 'png' });
  await fs.writeFile(path.join(previews, filename), new Uint8Array(await blob.arrayBuffer()));
}
const check = await wb.inspect({
  kind: 'table',
  range: 'Medicos!A1:S2',
  include: 'values,formulas',
  tableMaxRows: 2,
  tableMaxCols: 19,
  maxChars: 3000,
});
await fs.writeFile(path.join(previews, 'inspection.ndjson'), check.ndjson);
const file = await SpreadsheetFile.exportXlsx(wb);
const destination = path.join(output, 'Plantilla-medicos-Analiza.xlsx');
await file.save(destination);
console.log(
  JSON.stringify({ output: destination, columns: fields.length, reservedRows: 1000, records: 0 }),
);
