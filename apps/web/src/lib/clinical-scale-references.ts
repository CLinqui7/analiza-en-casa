export type ClinicalScaleReference = {
  id: string;
  title: string;
  sourceLabel: string;
  row: number;
  image: string;
  note: string;
  conflict: boolean;
  fields: readonly { key: string; label: string; options: readonly number[] }[];
};

const range = (start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index);
const binaryFields = (labels: readonly string[]) =>
  labels.map((label, index) => ({ key: `field${index + 1}`, label, options: [0, 1] }));

/** Exact row and image mapping from the user-supplied Studio HTML; no scoring rules are inferred. */
export const clinicalScaleReferences: readonly ClinicalScaleReference[] = [
  {
    id: 'eva',
    title: 'EVA · dolor',
    sourceLabel: 'Escala de EVA',
    row: 22,
    image: '/reference-scales/hoja1-fila-22.png',
    note: 'La imagen reúne una escala verbal y rangos EVA. Falta confirmar la versión institucional que se capturará.',
    conflict: false,
    fields: [{ key: 'score', label: 'Puntuación visible', options: range(0, 10) }],
  },
  {
    id: 'glasgow',
    title: 'Glasgow · conciencia',
    sourceLabel: 'ESCALA DE GASGLOW',
    row: 23,
    image: '/reference-scales/hoja1-fila-23.png',
    note: 'La captura omite la respuesta verbal de 1 punto y muestra rangos superpuestos. No se calcula ni interpreta el total.',
    conflict: true,
    fields: [
      { key: 'eye', label: 'Apertura ocular', options: [4, 3, 2, 1] },
      { key: 'verbal', label: 'Respuesta verbal · valores visibles', options: [5, 4, 3, 2] },
      { key: 'motor', label: 'Respuesta motora', options: [6, 5, 4, 3, 2, 1] },
    ],
  },
  {
    id: 'ramsay',
    title: 'Ramsay · sedación',
    sourceLabel: 'Escala de Ramsay',
    row: 24,
    image: '/reference-scales/hoja1-fila-24.png',
    note: 'Referencia de la captura original; falta aprobar la versión que utilizará el equipo clínico.',
    conflict: false,
    fields: [{ key: 'score', label: 'Puntuación visible', options: range(1, 6) }],
  },
  {
    id: 'ecog',
    title: 'ECOG · desempeño',
    sourceLabel: 'Esacala Ecof',
    row: 25,
    image: '/reference-scales/hoja1-fila-25.png',
    note: 'El Excel dice “Ecof” y la imagen dice “ECOG”. La denominación debe confirmarse.',
    conflict: true,
    fields: [{ key: 'grade', label: 'Grado en la imagen', options: range(0, 4) }],
  },
  {
    id: 'esas',
    title: 'ESAS · síntomas',
    sourceLabel: 'Escala de ESAS',
    row: 26,
    image: '/reference-scales/hoja1-fila-26.png',
    note: 'La imagen presenta varios síntomas de 0 a 10. Falta confirmar la versión y el protocolo de registro.',
    conflict: false,
    fields: [
      'Dolor',
      'Agotamiento',
      'Somnolencia',
      'Náuseas',
      'Pérdida de apetito',
      'Dificultad para respirar',
      'Desánimo',
      'Nerviosismo',
      'Dificultad para dormir',
      'Bienestar',
      'Otro problema',
    ].map((label, index) => ({ key: `symptom${index + 1}`, label, options: range(0, 10) })),
  },
  {
    id: 'karnofsky',
    title: 'Karnofsky · desempeño',
    sourceLabel: 'Escala de karnofky',
    row: 27,
    image: '/reference-scales/hoja1-fila-27.png',
    note: 'El nombre en el Excel contiene una errata; se conserva la fuente original para revisión.',
    conflict: true,
    fields: [
      {
        key: 'score',
        label: 'Puntuación visible',
        options: range(0, 10)
          .map((v) => v * 10)
          .reverse(),
      },
    ],
  },
  {
    id: 'dowton-a',
    title: 'Dowton · primera captura',
    sourceLabel: 'Escala de Dowton',
    row: 28,
    image: '/reference-scales/hoja1-fila-28.png',
    note: 'Primera imagen de la solicitud. No se combina con la segunda captura.',
    conflict: false,
    fields: binaryFields([
      'Caídas previas',
      'Medicamentos',
      'Déficits sensoriales',
      'Estado mental',
      'Deambulación',
    ]),
  },
  {
    id: 'dowton-b',
    title: 'Segunda captura de caídas',
    sourceLabel: 'Escala de Dowton',
    row: 29,
    image: '/reference-scales/hoja1-fila-29.png',
    note: 'La imagen es diferente de Dowton. Se mantiene separada y sin nombre clínico aprobado.',
    conflict: true,
    fields: [
      'Estado físico general',
      'Estado mental',
      'Movilidad',
      'Actividad',
      'Incontinencia',
    ].map((label, index) => ({ key: `field${index + 1}`, label, options: [4, 3, 2, 1] })),
  },
  {
    id: 'barthel',
    title: 'Barthel · actividades diarias',
    sourceLabel: 'Fila sin nombre en el Excel',
    row: 30,
    image: '/reference-scales/hoja1-fila-30.png',
    note: 'La fila del Excel no tiene nombre; la identificación proviene de la imagen y requiere confirmación.',
    conflict: true,
    fields: [
      { key: 'eating', label: 'Comer', options: [0, 5, 10] },
      { key: 'transfer', label: 'Traslado', options: [0, 5, 10, 15] },
      { key: 'grooming', label: 'Aseo personal', options: [0, 5] },
      { key: 'toilet', label: 'Uso del retrete', options: [0, 5, 10] },
      { key: 'bathing', label: 'Bañarse / ducharse', options: [0, 5] },
      { key: 'walking', label: 'Desplazarse', options: [0, 5, 10, 15] },
      { key: 'stairs', label: 'Subir / bajar escalones', options: [0, 5, 10] },
      { key: 'dressing', label: 'Vestirse / desvestirse', options: [0, 5, 10] },
      { key: 'bowel', label: 'Control de heces', options: [0, 5, 10] },
      { key: 'bladder', label: 'Control de orina', options: [0, 5, 10] },
    ],
  },
  {
    id: 'braden',
    title: 'Braden · riesgo de lesiones',
    sourceLabel: 'Escala de Branden',
    row: 31,
    image: '/reference-scales/hoja1-fila-31.png',
    note: 'El Excel dice “Branden” y la imagen “Braden”. No se asigna un nivel de riesgo automáticamente.',
    conflict: true,
    fields: [
      'Percepción sensorial',
      'Exposición a humedad',
      'Actividad',
      'Movilidad',
      'Nutrición',
      'Roce / peligro de lesiones',
    ].map((label, index) => ({
      key: `field${index + 1}`,
      label,
      options: index === 5 ? [1, 2, 3] : [1, 2, 3, 4],
    })),
  },
];
