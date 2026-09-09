import { NextResponse } from 'next/server';
import { emptySnapshot } from '@/lib/data-provider';
import { can } from '@/lib/permissions';
import { authorizationStatus } from '@/server/http-auth';
import { MongoDoctorRepository } from '@/server/mongo-doctors';
import { MongoHospitalizationRepository } from '@/server/mongo-hospitalizations';
import { MongoPatientRepository } from '@/server/mongo-patients';
import { MongoShiftRepository } from '@/server/mongo-shifts';
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
    const [patients, doctors, hospitalizations, agenda] = await Promise.all([
      new MongoPatientRepository(database.collection('patients')).listWithVersions(session),
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
    ]);
    return NextResponse.json(
      {
        ...emptySnapshot(),
        patients: patients.map(({ patient }) => patient),
        doctors: doctors.map(({ doctor }) => doctor),
        hospitalizations: hospitalizations.map(({ hospitalization }) => hospitalization),
        shifts: agenda[0],
        nursingResources: agenda[1],
        patientVersions: Object.fromEntries(
          patients.map(({ patient, version }) => [patient.id, version]),
        ),
        doctorVersions: Object.fromEntries(
          doctors.map(({ doctor, version }) => [doctor.id, version]),
        ),
        hospitalizationVersions: Object.fromEntries(
          hospitalizations.map(({ hospitalization, version }) => [hospitalization.id, version]),
        ),
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
