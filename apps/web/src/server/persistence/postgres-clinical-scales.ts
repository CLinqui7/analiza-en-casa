import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { can } from '@/lib/permissions';
import {
  clinicalScaleSourceVersion,
  parseClinicalScaleInput,
  type ClinicalScaleCapture,
} from '@/lib/clinical-scale-capture';
import { clinicalScaleReferences } from '@/lib/clinical-scale-references';
import { MongoAccessError, MongoInputError, type ServerActor } from '../validation/patients';
import { transaction } from './postgres-pool';

type CaptureRow = {
  id: string;
  patient_id: string;
  case_id: string | null;
  scale_id: string;
  source_row: number;
  source_version: string;
  observed_at: Date;
  values: Record<string, number>;
  notes: string;
  clinical_validated: false;
  created_by: string;
  author_name: string;
  created_at: Date;
};

function captureFromRow(row: CaptureRow): ClinicalScaleCapture {
  return {
    id: row.id,
    patientId: row.patient_id,
    caseId: row.case_id ?? undefined,
    scaleId: row.scale_id,
    sourceRow: row.source_row,
    sourceVersion: row.source_version,
    observedAt: row.observed_at.toISOString(),
    values: row.values,
    notes: row.notes,
    clinicalValidated: false,
    createdBy: row.created_by,
    authorName: row.author_name,
    createdAt: row.created_at.toISOString(),
  };
}

function authorize(actor: ServerActor, write = false) {
  if (
    !can(actor.role, 'patients:read') ||
    !can(actor.role, write ? 'clinical:write' : 'clinical:read')
  ) {
    throw new MongoAccessError();
  }
}

const captureColumns = `capture.id,capture.patient_id,capture.case_id,capture.scale_id,
  capture.source_row,capture.source_version,capture.observed_at,capture.values,capture.notes,
  capture.clinical_validated,capture.created_by,capture.created_at,
  coalesce(nullif(account.display_name,''),account.email_normalized) AS author_name`;

export class PostgresClinicalScaleRepository {
  constructor(private readonly pool: Pool) {}

  async listForPatient(
    actor: ServerActor,
    patientId: string,
  ): Promise<ClinicalScaleCapture[] | null> {
    authorize(actor);
    return transaction(this.pool, actor, async (client) => {
      const patient = await client.query(
        'SELECT id FROM analiza.patients WHERE organization_id=$1 AND id=$2',
        [actor.organizationId, patientId],
      );
      if (!patient.rowCount) return null;
      const captures = await client.query<CaptureRow>(
        `SELECT ${captureColumns}
         FROM analiza.clinical_scale_captures capture
         JOIN analiza.users account ON account.id=capture.created_by
         WHERE capture.organization_id=$1 AND capture.patient_id=$2
         ORDER BY capture.observed_at DESC,capture.created_at DESC,capture.id DESC LIMIT 500`,
        [actor.organizationId, patientId],
      );
      return captures.rows.map(captureFromRow);
    });
  }

  async create(
    actor: ServerActor,
    patientId: string,
    rawInput: unknown,
  ): Promise<ClinicalScaleCapture | null> {
    authorize(actor, true);
    let input;
    try {
      input = parseClinicalScaleInput(rawInput);
    } catch (error) {
      throw new MongoInputError(
        error instanceof Error ? error.message : 'Revisa los campos de la escala.',
      );
    }
    const reference = clinicalScaleReferences.find((item) => item.id === input.scaleId)!;
    return transaction(this.pool, actor, async (client) => {
      const patient = await client.query(
        'SELECT id FROM analiza.patients WHERE organization_id=$1 AND id=$2',
        [actor.organizationId, patientId],
      );
      if (!patient.rowCount) return null;
      if (input.caseId) {
        const hospitalization = await client.query(
          'SELECT id FROM analiza.hospitalizations WHERE organization_id=$1 AND patient_id=$2 AND id=$3',
          [actor.organizationId, patientId, input.caseId],
        );
        if (!hospitalization.rowCount) {
          throw new MongoInputError('La hospitalización no pertenece a este paciente.');
        }
      }
      const id = randomUUID();
      const inserted = await client.query<CaptureRow>(
        `WITH capture AS (
           INSERT INTO analiza.clinical_scale_captures
             (organization_id,id,patient_id,case_id,scale_id,source_row,source_version,
              observed_at,values,notes,created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
           RETURNING *
         )
         SELECT ${captureColumns} FROM capture
         JOIN analiza.users account ON account.id=capture.created_by`,
        [
          actor.organizationId,
          id,
          patientId,
          input.caseId ?? null,
          input.scaleId,
          reference.row,
          clinicalScaleSourceVersion,
          input.observedAt,
          JSON.stringify(input.values),
          input.notes,
          actor.userId,
        ],
      );
      await client.query(
        'INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id) VALUES($1,$2,$3,$4,$5,$6)',
        [
          actor.organizationId,
          randomUUID(),
          actor.userId,
          'clinical_scale.created',
          'clinical_scale_captures',
          id,
        ],
      );
      return captureFromRow(inserted.rows[0]);
    });
  }
}
