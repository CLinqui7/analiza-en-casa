import {
  paymentSchema,
  catalogItemSchema,
  clinicalDocumentSchema,
  inventoryMovementSchema,
  purchaseSchema,
} from '@analiza/contracts';
import { emptyServerWorkspace } from '@/lib/workspace-empty';
import { can } from '@/lib/permissions';
import { isCoreRelease } from '@/lib/release-profile';
import { MongoDoctorRepository } from '@/server/mongo-doctors';
import { MongoHospitalizationRepository } from '@/server/mongo-hospitalizations';
import { MongoPatientRepository } from '@/server/mongo-patients';
import { MongoShiftRepository } from '@/server/mongo-shifts';
import { MongoInsuranceRepository, MongoQuoteRepository } from '@/server/mongo-quotes';

import { MongoAuthService, mongoAuthStore } from '../mongo-auth';
import { mongoDatabase } from '../mongodb';
import { MongoFileRepository, mongoFileOwnerLookup } from '../mongo-files';
import { MongoGridFsPrivateStorage } from '../mongo-gridfs-storage';
import { MongoOperationsRepository } from '../mongo-operations';
import type { ServerActor } from '../validation/patients';
import type { Persistence, WorkspaceResult } from './contracts';
import { MongoWorkspaceSetupRepository } from '../mongo-workspace-setup';
export async function mongoPersistence(): Promise<Persistence> {
  const database = await mongoDatabase();
  const operations = new MongoOperationsRepository(database);
  const quotes = new MongoQuoteRepository(database);
  return {
    onboarding: new MongoWorkspaceSetupRepository(database),
    auth: new MongoAuthService(mongoAuthStore(database)),
    patients: new MongoPatientRepository(database.collection('patients')),
    doctors: new MongoDoctorRepository(database.collection('doctors')),
    hospitalizations: new MongoHospitalizationRepository(
      database.collection('hospitalizations'),
      database.collection('patients'),
      {
        resources: database.collection('nursingResources'),
        memberships: database.collection('memberships'),
      },
    ),
    quotes,
    shifts: new MongoShiftRepository(database as never),
    operations,
    files: new MongoFileRepository(
      database.collection('fileMetadata') as never,
      new MongoGridFsPrivateStorage(database),
      mongoFileOwnerLookup(database as never),
      database.collection('auditEvents') as never,
    ),
    async ready() {
      await database.command({ ping: 1 }, { timeoutMS: 2000 });
    },
    async workspace(session: ServerActor): Promise<WorkspaceResult> {
      const [
        patients,
        doctors,
        hospitalizations,
        agenda,
        quotes,
        insurance,
        catalogItems,
        payments,
        inventoryMovements,
        purchases,
        clinicalDocuments,
        auditEvents,
      ] = await Promise.all([
        can(session.role, 'patients:read')
          ? new MongoPatientRepository(database.collection('patients')).listWithVersions(session)
          : Promise.resolve([]),
        can(session.role, 'settings:write')
          ? new MongoDoctorRepository(database.collection('doctors')).listWithVersions(session)
          : Promise.resolve([]),
        can(session.role, 'cases:read')
          ? new MongoHospitalizationRepository(
              database.collection('hospitalizations'),
              database.collection('patients'),
            ).listWithVersions(session)
          : Promise.resolve([]),
        can(session.role, 'agenda:read')
          ? Promise.all([
              new MongoShiftRepository(database as never).list(session),
              new MongoShiftRepository(database as never).listResources(session),
            ])
          : Promise.resolve([[], []] as const),
        !isCoreRelease && can(session.role, 'quotes:read')
          ? new MongoQuoteRepository(database).listWithVersions(session)
          : Promise.resolve([]),
        !isCoreRelease && can(session.role, 'insurance:read')
          ? new MongoInsuranceRepository(database).list(session)
          : Promise.resolve({ requests: [], events: [] }),
        can(session.role, 'catalogs:read')
          ? database
              .collection('catalogItems')
              .find({ organizationId: session.organizationId })
              .toArray()
          : Promise.resolve([]),
        !isCoreRelease && can(session.role, 'payments:read')
          ? database
              .collection('payments')
              .find({ organizationId: session.organizationId })
              .toArray()
          : Promise.resolve([]),
        !isCoreRelease && can(session.role, 'inventory:read')
          ? database
              .collection('inventoryMovements')
              .find({ organizationId: session.organizationId })
              .toArray()
          : Promise.resolve([]),
        !isCoreRelease && can(session.role, 'purchases:read')
          ? database
              .collection('purchases')
              .find({ organizationId: session.organizationId })
              .toArray()
          : Promise.resolve([]),
        !isCoreRelease && can(session.role, 'clinical:read')
          ? database
              .collection('clinicalDocuments')
              .find({ organizationId: session.organizationId })
              .toArray()
          : Promise.resolve([]),
        can(session.role, 'audit:read')
          ? database
              .collection('auditEvents')
              .find(
                { organizationId: session.organizationId },
                { projection: { id: 1, action: 1, resourceId: 1, occurredAt: 1 } },
              )
              .sort({ occurredAt: -1 })
              .limit(100)
              .toArray()
          : Promise.resolve([]),
      ]);
      return {
        ...emptyServerWorkspace(),
        patients: patients.map(({ patient }) => patient),
        doctors: doctors.map(({ doctor }) => doctor),
        hospitalizations: hospitalizations.map(({ hospitalization }) => hospitalization),
        shifts: [...agenda[0]],
        nursingResources: [...agenda[1]],
        quotes: quotes.map(({ quote }) => quote),
        insuranceRequests: insurance.requests,
        insuranceEvents: insurance.events,
        catalogItems: catalogItems.map((item) => catalogItemSchema.parse(item)),
        payments: payments.map((item) => paymentSchema.parse(item)),
        inventoryMovements: inventoryMovements.map((item) => inventoryMovementSchema.parse(item)),
        purchases: purchases.map((item) => purchaseSchema.parse(item)),
        clinicalDocuments: clinicalDocuments.map((item) => clinicalDocumentSchema.parse(item)),
        auditEntries: auditEvents.map((item) => ({
          id: String(item.id),
          action: String(item.action),
          subject: String(item.resourceId ?? ''),
          at: new Date(item.occurredAt).toISOString(),
        })),
        patientVersions: Object.fromEntries(
          patients.map(({ patient, version }) => [patient.id, version]),
        ),
        doctorVersions: Object.fromEntries(
          doctors.map(({ doctor, version }) => [doctor.id, version]),
        ),
        hospitalizationVersions: Object.fromEntries(
          hospitalizations.map(({ hospitalization, version }) => [hospitalization.id, version]),
        ),
        quoteVersions: Object.fromEntries(quotes.map(({ quote, version }) => [quote.id, version])),
      };
    },
  };
}
