import { NextResponse } from 'next/server';
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
import { authorizationStatus } from '@/server/http-auth';
import { MongoDoctorRepository } from '@/server/mongo-doctors';
import { MongoHospitalizationRepository } from '@/server/mongo-hospitalizations';
import { MongoPatientRepository } from '@/server/mongo-patients';
import { MongoShiftRepository } from '@/server/mongo-shifts';
import { MongoInsuranceRepository, MongoQuoteRepository } from '@/server/mongo-quotes';
import { MongoAuthService, mongoAuthStore, sessionCookieName } from '@/server/mongo-auth';
import { mongoDatabase, mongoRuntimeConfig } from '@/server/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The only browser entry point reserved for Mongo workspace data. */
function errorResponse(status: 401 | 403 | 503) {
  const error =
    status === 401
      ? 'No autorizado.'
      : status === 403
        ? 'No tiene autorización para esta operación.'
        : 'El acceso seguro al espacio de trabajo no está configurado.';
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** The session actor, rather than body/query/localStorage, scopes every Mongo query. */
export async function GET(request?: Request) {
  try {
    const database = await mongoDatabase();
    const auth = new MongoAuthService(mongoAuthStore(database));
    const session = await auth.requireSession(
      request?.headers
        .get('cookie')
        ?.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${sessionCookieName}=`))
        ?.slice(sessionCookieName.length + 1),
    );
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
        ? database.collection('payments').find({ organizationId: session.organizationId }).toArray()
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
    return NextResponse.json(
      {
        ...emptyServerWorkspace(),
        patients: patients.map(({ patient }) => patient),
        doctors: doctors.map(({ doctor }) => doctor),
        hospitalizations: hospitalizations.map(({ hospitalization }) => hospitalization),
        shifts: agenda[0],
        nursingResources: agenda[1],
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
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(authorizationStatus(error));
  }
}

export async function POST() {
  try {
    mongoRuntimeConfig();
    // Full-snapshot writes remain disabled even after Mongo configuration; resource commands
    // must perform their own session, CSRF and expected-version validation.
    return errorResponse(403);
  } catch {
    return errorResponse(503);
  }
}
