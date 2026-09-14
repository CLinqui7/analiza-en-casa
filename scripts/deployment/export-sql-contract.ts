import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import {
  patientSchema,
  doctorSchema,
  hospitalizationSchema,
  nursingResourceSchema,
  shiftSchema,
  configurationEntrySchema,
  catalogItemSchema,
} from '../../packages/contracts/src/index';

const models = {
  patients: patientSchema,
  doctors: doctorSchema,
  hospitalizations: hospitalizationSchema,
  nursing_resources: nursingResourceSchema,
  shifts: shiftSchema,
  configuration_entries: configurationEntrySchema,
  catalog_items: catalogItemSchema,
};
await writeFile(
  'database/postgresql/DTO_CONTRACT.json',
  JSON.stringify(
    {
      description:
        'Exact existing DTO fields stored in body JSONB; no binary objects or new clinical rules.',
      models: Object.fromEntries(
        Object.entries(models).map(([name, schema]) => [name, z.toJSONSchema(schema)]),
      ),
    },
    null,
    2,
  ) + '\n',
);
