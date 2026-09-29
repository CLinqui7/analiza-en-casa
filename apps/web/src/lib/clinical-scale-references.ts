export type ClinicalScaleReference = {
  id: string;
  title: string;
  sourceLabel: string;
  row: number;
  image: string;
  note: string;
  conflict: boolean;
};

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
  },
  {
    id: 'glasgow',
    title: 'Glasgow · conciencia',
    sourceLabel: 'ESCALA DE GASGLOW',
    row: 23,
    image: '/reference-scales/hoja1-fila-23.png',
    note: 'La captura omite la respuesta verbal de 1 punto y muestra rangos superpuestos. No se calcula ni interpreta el total.',
    conflict: true,
  },
  {
    id: 'ramsay',
    title: 'Ramsay · sedación',
    sourceLabel: 'Escala de Ramsay',
    row: 24,
    image: '/reference-scales/hoja1-fila-24.png',
    note: 'Referencia de la captura original; falta aprobar la versión que utilizará el equipo clínico.',
    conflict: false,
  },
  {
    id: 'ecog',
    title: 'ECOG · desempeño',
    sourceLabel: 'Esacala Ecof',
    row: 25,
    image: '/reference-scales/hoja1-fila-25.png',
    note: 'El Excel dice “Ecof” y la imagen dice “ECOG”. La denominación debe confirmarse.',
    conflict: true,
  },
  {
    id: 'esas',
    title: 'ESAS · síntomas',
    sourceLabel: 'Escala de ESAS',
    row: 26,
    image: '/reference-scales/hoja1-fila-26.png',
    note: 'La imagen presenta varios síntomas de 0 a 10. Falta confirmar la versión y el protocolo de registro.',
    conflict: false,
  },
  {
    id: 'karnofsky',
    title: 'Karnofsky · desempeño',
    sourceLabel: 'Escala de karnofky',
    row: 27,
    image: '/reference-scales/hoja1-fila-27.png',
    note: 'El nombre en el Excel contiene una errata; se conserva la fuente original para revisión.',
    conflict: true,
  },
  {
    id: 'dowton-a',
    title: 'Dowton · primera captura',
    sourceLabel: 'Escala de Dowton',
    row: 28,
    image: '/reference-scales/hoja1-fila-28.png',
    note: 'Primera imagen de la solicitud. No se combina con la segunda captura.',
    conflict: false,
  },
  {
    id: 'dowton-b',
    title: 'Segunda captura de caídas',
    sourceLabel: 'Escala de Dowton',
    row: 29,
    image: '/reference-scales/hoja1-fila-29.png',
    note: 'La imagen es diferente de Dowton. Se mantiene separada y sin nombre clínico aprobado.',
    conflict: true,
  },
  {
    id: 'barthel',
    title: 'Barthel · actividades diarias',
    sourceLabel: 'Fila sin nombre en el Excel',
    row: 30,
    image: '/reference-scales/hoja1-fila-30.png',
    note: 'La fila del Excel no tiene nombre; la identificación proviene de la imagen y requiere confirmación.',
    conflict: true,
  },
  {
    id: 'braden',
    title: 'Braden · riesgo de lesiones',
    sourceLabel: 'Escala de Branden',
    row: 31,
    image: '/reference-scales/hoja1-fila-31.png',
    note: 'El Excel dice “Branden” y la imagen “Braden”. No se asigna un nivel de riesgo automáticamente.',
    conflict: true,
  },
];
