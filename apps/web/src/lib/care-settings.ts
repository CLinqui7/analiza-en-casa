export const careSettingLabels = {
  HOSPITALIZATION: 'Hospitalización',
  HOME_OUTPATIENT: 'Ambulatorio en domicilio del paciente',
  CLINIC_OUTPATIENT: 'Ambulatorio en Analiza en Casa',
} as const;
export type CareSetting = keyof typeof careSettingLabels;
