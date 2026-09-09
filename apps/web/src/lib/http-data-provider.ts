'use client';

import {
  doctorSchema,
  hospitalizationSchema,
  nursingResourceSchema,
  shiftSchema,
  patientSchema,
  type Doctor,
  type Hospitalization,
  type Patient,
  type Shift,
} from '@analiza/contracts';
import { mongoMutationHeaders } from '@/lib/auth';
import type { DataProvider, WorkspaceSnapshot } from '@/lib/data-provider';

type WorkspaceResponse = WorkspaceSnapshot & {
  patientVersions?: Record<string, unknown>;
  doctorVersions?: Record<string, unknown>;
  hospitalizationVersions?: Record<string, unknown>;
};

function responseError(response: Response, fallback: string): Promise<Error> {
  return response
    .json()
    .then((body: unknown) => {
      if (
        body &&
        typeof body === 'object' &&
        typeof (body as { error?: unknown }).error === 'string'
      ) {
        return new Error((body as { error: string }).error);
      }
      return new Error(fallback);
    })
    .catch(() => new Error(fallback));
}

export class HttpDataProvider implements DataProvider {
  readonly mode = 'mongodb' as const;

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly endpoint = '/api/workspace',
    private readonly mutationHeaders: () => Record<string, string> = mongoMutationHeaders,
  ) {}
  private patientVersions = new Map<string, number>();
  private doctorVersions = new Map<string, number>();
  private hospitalizationVersions = new Map<string, number>();

  private loadVersions(raw: Record<string, unknown> | undefined) {
    return new Map(
      Object.entries(raw ?? {}).flatMap(([id, version]) =>
        typeof version === 'number' && Number.isInteger(version) && version > 0
          ? [[id, version]]
          : [],
      ),
    );
  }

  async load(): Promise<WorkspaceSnapshot> {
    const response = await this.fetchImpl(this.endpoint, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok)
      throw await responseError(response, 'No fue posible cargar el espacio de trabajo seguro.');
    const payload = (await response.json()) as WorkspaceResponse;
    if (!Array.isArray(payload.patients))
      throw new Error('La respuesta segura de pacientes no es válida.');
    this.patientVersions = this.loadVersions(payload.patientVersions);
    this.doctorVersions = this.loadVersions(payload.doctorVersions);
    this.hospitalizationVersions = this.loadVersions(payload.hospitalizationVersions);
    return {
      ...payload,
      patients: payload.patients.map((patient) => patientSchema.parse(patient)),
      doctors: (payload.doctors ?? []).map((doctor) => doctorSchema.parse(doctor)),
      hospitalizations: (payload.hospitalizations ?? []).map((item) =>
        hospitalizationSchema.parse(item),
      ),
      shifts: (payload.shifts ?? []).map((shift) => shiftSchema.parse(shift)),
      nursingResources: (payload.nursingResources ?? []).map((resource) =>
        nursingResourceSchema.parse(resource),
      ),
    };
  }

  async createPatient(patient: Patient): Promise<Patient> {
    const response = await this.fetchImpl('/api/patients', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...this.mutationHeaders(),
      },
      body: JSON.stringify({ patient }),
    });
    if (!response.ok) throw await responseError(response, 'No fue posible guardar el paciente.');
    const saved = patientSchema.parse(await response.json());
    this.patientVersions.set(saved.id, 1);
    return saved;
  }

  async replacePatient(patient: Patient): Promise<Patient> {
    const expectedVersion = this.patientVersions.get(patient.id);
    if (!expectedVersion)
      throw new Error(
        'No se conoce la versión del paciente; actualice el listado antes de editar.',
      );
    const response = await this.fetchImpl(`/api/patients/${encodeURIComponent(patient.id)}`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...this.mutationHeaders(),
      },
      body: JSON.stringify({ patient, expectedVersion }),
    });
    if (!response.ok) throw await responseError(response, 'No fue posible guardar los cambios.');
    const saved = patientSchema.parse(await response.json());
    this.patientVersions.set(saved.id, expectedVersion + 1);
    return saved;
  }

  async createDoctor(doctor: Doctor): Promise<Doctor> {
    const response = await this.fetchImpl('/api/doctors', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...this.mutationHeaders(),
      },
      body: JSON.stringify({ doctor }),
    });
    if (!response.ok) throw await responseError(response, 'No fue posible guardar el médico.');
    const saved = doctorSchema.parse(await response.json());
    this.doctorVersions.set(saved.id, 1);
    return saved;
  }

  async replaceDoctor(doctor: Doctor): Promise<Doctor> {
    const expectedVersion = this.doctorVersions.get(doctor.id);
    if (!expectedVersion)
      throw new Error('No se conoce la versión del médico; actualice el listado antes de editar.');
    const response = await this.fetchImpl(`/api/doctors/${encodeURIComponent(doctor.id)}`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...this.mutationHeaders(),
      },
      body: JSON.stringify({ doctor, expectedVersion }),
    });
    if (!response.ok)
      throw await responseError(response, 'No fue posible guardar los cambios del médico.');
    const saved = doctorSchema.parse(await response.json());
    this.doctorVersions.set(saved.id, expectedVersion + 1);
    return saved;
  }

  async createHospitalization(hospitalization: Hospitalization): Promise<Hospitalization> {
    const response = await this.fetchImpl('/api/hospitalizations', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...this.mutationHeaders(),
      },
      body: JSON.stringify({ hospitalization }),
    });
    if (!response.ok)
      throw await responseError(response, 'No fue posible guardar la hospitalización.');
    const saved = hospitalizationSchema.parse(await response.json());
    this.hospitalizationVersions.set(saved.id, 1);
    return saved;
  }

  async replaceHospitalization(hospitalization: Hospitalization): Promise<Hospitalization> {
    const expectedVersion = this.hospitalizationVersions.get(hospitalization.id);
    if (!expectedVersion)
      throw new Error(
        'No se conoce la versión de la hospitalización; actualice el listado antes de editar.',
      );
    const response = await this.fetchImpl(
      `/api/hospitalizations/${encodeURIComponent(hospitalization.id)}`,
      {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...this.mutationHeaders(),
        },
        body: JSON.stringify({ hospitalization, expectedVersion }),
      },
    );
    if (!response.ok)
      throw await responseError(
        response,
        'No fue posible guardar los cambios de la hospitalización.',
      );
    const saved = hospitalizationSchema.parse(await response.json());
    this.hospitalizationVersions.set(saved.id, expectedVersion + 1);
    return saved;
  }

  async createShiftSeries(shifts: Shift[], idempotencyKey: string): Promise<Shift[]> {
    const response = await this.fetchImpl('/api/shifts', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...this.mutationHeaders(),
      },
      body: JSON.stringify({ shifts, idempotencyKey }),
    });
    if (!response.ok)
      throw await responseError(response, 'No fue posible guardar la serie de turnos.');
    const payload: unknown = await response.json();
    if (
      !payload ||
      typeof payload !== 'object' ||
      !Array.isArray((payload as { shifts?: unknown }).shifts)
    ) {
      throw new Error('La respuesta de la serie de turnos no es válida.');
    }
    return (payload as { shifts: unknown[] }).shifts.map((shift) => shiftSchema.parse(shift));
  }

  async saveChanges(_changes: Partial<WorkspaceSnapshot>): Promise<void> {
    void _changes;
    // The legacy provider emits changed arrays, which are full collection snapshots.
    // Mongo commands are per-resource with versions; never convert this into bulk upserts.
    throw new Error(
      'La escritura Mongo requiere comandos por recurso con versión; no se guardó ningún cambio.',
    );
  }
}
