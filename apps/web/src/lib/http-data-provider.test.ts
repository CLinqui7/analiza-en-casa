import { describe, expect, it, vi } from 'vitest';
import type { Doctor, Hospitalization, Patient } from '@analiza/contracts';
import { HttpDataProvider } from './http-data-provider';

const patient: Patient = {
  id: '8a5e65c6-64cb-46e0-9d34-a0d4b05ac001',
  fullName: 'Paciente Sintético',
  documentType: 'DUI',
  documentId: '00000000-0',
  status: 'ACTIVE',
};
const createdPatient: Patient = { ...patient, id: '8a5e65c6-64cb-46e0-9d34-a0d4b05ac002' };
const doctor: Doctor = {
  id: 'doctor-synthetic-http-1',
  fullName: 'Médica HTTP Sintética',
  jvpm: 'JVPM-HTTP-001',
  documentId: '00000000-0',
  specialty: 'Medicina interna',
  address: 'Dirección sintética',
  attachments: [],
};
const hospitalization: Hospitalization = {
  id: 'hospitalization-synthetic-http-1',
  patientId: patient.id,
  startDate: '2026-09-09',
  admissionPeriods: [{ admissionDate: '2026-09-09' }],
  status: 'ACTIVE',
  accountType: 'PARTICULAR',
};

describe('Mongo HTTP data provider', () => {
  // test-id: vitest:db01-http-no-browser-authority
  it('uses same-origin cookies and does not send organization or role headers', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      void _input;
      void _init;
      return new Response(JSON.stringify({ patients: [] }));
    });
    const provider = new HttpDataProvider(fetchMock);

    await provider.load();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/workspace',
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
    );
    expect(fetchMock.mock.calls[0][1]?.headers).not.toHaveProperty('X-Organization-Id');
    expect(fetchMock.mock.calls[0][1]?.headers).not.toHaveProperty('X-Role');
  });

  // test-id: vitest:db01-http-fail-closed
  it('surfaces a server failure and never falls back to localStorage or a bulk write', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      void _input;
      void _init;
      return new Response(null, { status: 503 });
    });
    const provider = new HttpDataProvider(fetchMock);

    await expect(provider.load()).rejects.toThrow('No fue posible cargar');
    await expect(provider.saveChanges({ patients: [] })).rejects.toThrow(
      'no se guardó ningún cambio',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // test-id: vitest:e01-http-patient-command-csrf-version
  it('creates and replaces a patient only through bounded commands with CSRF and the loaded version', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ patients: [patient], patientVersions: { [patient.id]: 2 } })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(createdPatient), { status: 201 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...patient, fullName: 'Paciente actualizado' })),
      );
    const provider = new HttpDataProvider(fetchMock, '/api/workspace', () => ({
      'X-Analiza-Csrf': 'synthetic-test-token',
    }));

    await provider.load();
    await expect(provider.createPatient(createdPatient)).resolves.toEqual(createdPatient);
    await expect(
      provider.replacePatient({ ...patient, fullName: 'Paciente actualizado' }),
    ).resolves.toEqual({ ...patient, fullName: 'Paciente actualizado' });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/patients',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        headers: expect.objectContaining({ 'X-Analiza-Csrf': 'synthetic-test-token' }),
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[2][1]?.body as string)).toEqual({
      patient: { ...patient, fullName: 'Paciente actualizado' },
      expectedVersion: 2,
    });
  });

  // test-id: vitest:e01-http-patient-conflict
  it('keeps the form recoverable when the server reports a version conflict', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ patients: [patient], patientVersions: { [patient.id]: 2 } })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'El registro cambió antes de guardar.' }), {
          status: 409,
        }),
      );
    const provider = new HttpDataProvider(fetchMock, '/api/workspace', () => ({
      'X-Analiza-Csrf': 'synthetic-test-token',
    }));

    await provider.load();
    await expect(provider.replacePatient(patient)).rejects.toThrow('cambió antes de guardar');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // test-id: vitest:e02-http-doctor-hospitalization-command-csrf-version
  it('loads resource versions and sends bounded doctor and hospitalization commands with CSRF', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            patients: [patient],
            doctors: [doctor],
            hospitalizations: [hospitalization],
            patientVersions: { [patient.id]: 1 },
            doctorVersions: { [doctor.id]: 3 },
            hospitalizationVersions: { [hospitalization.id]: 4 },
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(doctor)))
      .mockResolvedValueOnce(new Response(JSON.stringify(hospitalization)));
    const provider = new HttpDataProvider(fetchMock, '/api/workspace', () => ({
      'X-Analiza-Csrf': 'synthetic-test-token',
    }));

    await provider.load();
    await expect(provider.replaceDoctor(doctor)).resolves.toEqual(doctor);
    await expect(provider.replaceHospitalization(hospitalization)).resolves.toEqual(
      hospitalization,
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/doctors/${doctor.id}`,
      expect.objectContaining({ method: 'PUT', credentials: 'same-origin' }),
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).toEqual({
      doctor,
      expectedVersion: 3,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `/api/hospitalizations/${hospitalization.id}`,
      expect.objectContaining({ method: 'PUT', credentials: 'same-origin' }),
    );
    expect(JSON.parse(fetchMock.mock.calls[2][1]?.body as string)).toEqual({
      hospitalization,
      expectedVersion: 4,
    });
  });
});
