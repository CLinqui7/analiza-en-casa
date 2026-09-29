import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import { can } from '@/lib/permissions';
import {
  clinicalScaleSourceVersion,
  parseClinicalScaleInput,
  type ClinicalScaleCapture,
} from '@/lib/clinical-scale-capture';
import { clinicalScaleReferences } from '@/lib/clinical-scale-references';
import { MongoAccessError, MongoInputError, type ServerActor } from './validation/patients';

type StoredCapture = ClinicalScaleCapture & { organizationId: string };

function authorize(actor: ServerActor, write = false) {
  if (
    !can(actor.role, 'patients:read') ||
    !can(actor.role, write ? 'clinical:write' : 'clinical:read')
  ) {
    throw new MongoAccessError();
  }
}

function publicCapture(row: StoredCapture): ClinicalScaleCapture {
  return {
    id: row.id,
    patientId: row.patientId,
    caseId: row.caseId,
    scaleId: row.scaleId,
    sourceRow: row.sourceRow,
    sourceVersion: row.sourceVersion,
    observedAt: row.observedAt,
    values: row.values,
    notes: row.notes,
    clinicalValidated: false,
    createdBy: row.createdBy,
    authorName: row.authorName,
    createdAt: row.createdAt,
  };
}

export class MongoClinicalScaleRepository {
  constructor(private readonly database: Db) {}

  async listForPatient(
    actor: ServerActor,
    patientId: string,
  ): Promise<ClinicalScaleCapture[] | null> {
    authorize(actor);
    const patient = await this.database
      .collection('patients')
      .findOne({ organizationId: actor.organizationId, id: patientId }, { projection: { _id: 1 } });
    if (!patient) return null;
    const rows = await this.database
      .collection<StoredCapture>('clinicalScaleCaptures')
      .find({ organizationId: actor.organizationId, patientId })
      .sort({ observedAt: -1, createdAt: -1, id: -1 })
      .limit(500)
      .toArray();
    return rows.map(publicCapture);
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
    const capture: StoredCapture = {
      ...input,
      id: randomUUID(),
      organizationId: actor.organizationId,
      patientId,
      sourceRow: reference.row,
      sourceVersion: clinicalScaleSourceVersion,
      clinicalValidated: false,
      createdBy: actor.userId,
      authorName: actor.userId,
      createdAt: new Date().toISOString(),
    };
    const session = this.database.client.startSession();
    try {
      return await session.withTransaction(async () => {
        const options = { session, projection: { _id: 1 } };
        const patient = await this.database
          .collection('patients')
          .findOne({ organizationId: actor.organizationId, id: patientId }, options);
        if (!patient) return null;
        if (input.caseId) {
          const hospitalization = await this.database
            .collection('hospitalizations')
            .findOne(
              { organizationId: actor.organizationId, id: input.caseId, patientId },
              options,
            );
          if (!hospitalization)
            throw new MongoInputError('La hospitalización no pertenece a este paciente.');
        }
        await this.database
          .collection<StoredCapture>('clinicalScaleCaptures')
          .insertOne(capture, { session });
        await this.database.collection('auditEvents').insertOne(
          {
            organizationId: actor.organizationId,
            id: randomUUID(),
            actorUserId: actor.userId,
            action: 'clinical_scale.created',
            resourceType: 'clinicalScaleCaptures',
            resourceId: capture.id,
            occurredAt: new Date(),
          },
          { session },
        );
        return publicCapture(capture);
      });
    } finally {
      await session.endSession();
    }
  }
}
