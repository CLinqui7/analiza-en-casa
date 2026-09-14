import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import { can } from '@/lib/permissions';
import {
  emptyWorkspaceSetup,
  workspaceSetupSchema,
  staffProfileSchema,
  serviceProfileSchema,
  organizationProfileSchema,
  type WorkspaceSetup,
} from '@/lib/workspace-setup';
import {
  MongoAccessError,
  MongoConflictError,
  MongoInputError,
  type ServerActor,
} from './validation/patients';

function authorize(actor: ServerActor) {
  if (!can(actor.role, 'settings:write')) throw new MongoAccessError();
}

/** Workspace metadata is scoped from the server session; staff records never grant login access. */
export class MongoWorkspaceSetupRepository {
  constructor(private readonly database: Db) {}

  async get(actor: ServerActor): Promise<WorkspaceSetup> {
    authorize(actor);
    const organization = await this.database
      .collection('organizations')
      .findOne({ id: actor.organizationId });
    if (!organization) throw new MongoInputError('Este espacio no tiene un registro inicial.');
    const [staff, services] = await Promise.all([
      this.database
        .collection('organizationStaff')
        .find({ organizationId: actor.organizationId })
        .sort({ createdAt: 1, id: 1 })
        .toArray(),
      this.database
        .collection('organizationServices')
        .find({ organizationId: actor.organizationId })
        .sort({ createdAt: 1, id: 1 })
        .toArray(),
    ]);
    return {
      expectedVersion: organization.onboardingVersion,
      organization: organization.profile
        ? organizationProfileSchema.parse(organization.profile)
        : emptyWorkspaceSetup().organization,
      staff: staff.map((row) => staffProfileSchema.strip().parse(row)),
      services: services.map((row) => serviceProfileSchema.strip().parse(row)),
    };
  }

  async save(actor: ServerActor, input: unknown): Promise<WorkspaceSetup> {
    authorize(actor);
    const parsed = workspaceSetupSchema.safeParse(input);
    if (!parsed.success)
      throw new MongoInputError('Revisa los datos de organización, personal y servicios.');
    const data = parsed.data;
    const session = this.database.client.startSession();
    const now = new Date();
    try {
      await session.withTransaction(
        async () => {
          const options = { session };
          const organization = await this.database.collection('organizations').findOneAndUpdate(
            { id: actor.organizationId, onboardingVersion: data.expectedVersion },
            {
              $set: { profile: data.organization, updatedAt: now },
              $inc: { onboardingVersion: 1 },
            },
            { ...options, returnDocument: 'after' },
          );
          if (!organization) throw new MongoConflictError();
          for (const [collectionName, entries] of [
            ['organizationStaff', data.staff],
            ['organizationServices', data.services],
          ] as const) {
            const collection = this.database.collection(collectionName);
            const existing = await collection
              .find({ organizationId: actor.organizationId }, { ...options, projection: { id: 1 } })
              .toArray();
            if (existing.some((row) => !entries.some((entry) => entry.id === row.id))) {
              throw new MongoInputError(
                'Conserva las fichas guardadas; puedes desactivarlas cuando no se utilicen.',
              );
            }
            for (const entry of entries) {
              await collection.updateOne(
                { organizationId: actor.organizationId, id: entry.id },
                {
                  $set: { ...entry, updatedAt: now },
                  $setOnInsert: { organizationId: actor.organizationId, createdAt: now },
                },
                { ...options, upsert: true },
              );
            }
          }
          await this.database.collection('auditEvents').insertOne(
            {
              id: randomUUID(),
              organizationId: actor.organizationId,
              actorUserId: actor.userId,
              action: 'workspace.setup.saved',
              resourceId: actor.organizationId,
              occurredAt: now,
              version: data.expectedVersion + 1,
              staffCount: data.staff.length,
              serviceCount: data.services.length,
            },
            options,
          );
        },
        { writeConcern: { w: 'majority' }, maxCommitTimeMS: 5000, timeoutMS: 15000 },
      );
      return { ...data, expectedVersion: data.expectedVersion + 1 };
    } finally {
      await session.endSession();
    }
  }
}

export const workspaceSetupIndexes = [
  {
    collection: 'organizationStaff',
    key: { organizationId: 1, id: 1 },
    name: 'organization_staff_org_id_unique',
    unique: true,
  },
  {
    collection: 'organizationServices',
    key: { organizationId: 1, id: 1 },
    name: 'organization_services_org_id_unique',
    unique: true,
  },
] as const;
