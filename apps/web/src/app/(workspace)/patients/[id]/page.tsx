'use client';

import { Button, Panel } from '@analiza/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth, useWorkspace } from '@/components/providers';

function valueOrEmpty(value: string | undefined) {
  return value || 'Sin dato';
}

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const { can } = useAuth();
  const { loading, patients } = useWorkspace();
  const patient = patients.find((candidate) => candidate.id === params.id);
  if (loading)
    return (
      <main className="access-denied" role="status">
        Cargando paciente…
      </main>
    );
  if (!patient)
    return (
      <main className="access-denied" role="alert">
        El paciente no existe o no está disponible.
      </main>
    );
  const insurance = patient.insurance;
  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Registro</p>
          <h1>{patient.fullName}</h1>
          <p>Detalle administrativo sintético del paciente.</p>
        </div>
        {can('patients:write') ? (
          <Link data-action-id="PATIENT-EDIT" href={`/patients?edit=${patient.id}`}>
            <Button type="button">Editar paciente</Button>
          </Link>
        ) : null}
      </header>
      <section className="two-column">
        <Panel>
          <h2>Identificación</h2>
          <dl className="definition-list">
            <div>
              <dt>Nombre completo</dt>
              <dd>{patient.fullName}</dd>
            </div>
            <div>
              <dt>Tipo de documento</dt>
              <dd>{patient.documentType}</dd>
            </div>
            <div>
              <dt>Documento</dt>
              <dd>{patient.documentId}</dd>
            </div>
            <div>
              <dt>Fecha de nacimiento</dt>
              <dd>{valueOrEmpty(patient.birthDate)}</dd>
            </div>
            <div>
              <dt>Sexo</dt>
              <dd>{valueOrEmpty(patient.sex)}</dd>
            </div>
            <div>
              <dt>Empresa</dt>
              <dd>{valueOrEmpty(patient.company)}</dd>
            </div>
            <div>
              <dt>Jubilado</dt>
              <dd>{patient.retired ? 'Sí' : 'No'}</dd>
            </div>
            <div>
              <dt>Tipo de sangre</dt>
              <dd>{valueOrEmpty(patient.bloodType)}</dd>
            </div>
            <div>
              <dt>Estado civil</dt>
              <dd>{valueOrEmpty(patient.civilStatus)}</dd>
            </div>
            <div>
              <dt>Nacionalidad</dt>
              <dd>{valueOrEmpty(patient.nationality)}</dd>
            </div>
            <div>
              <dt>Ocupación</dt>
              <dd>{valueOrEmpty(patient.occupation)}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{patient.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</dd>
            </div>
          </dl>
        </Panel>
        <Panel>
          <h2>Contacto y seguro</h2>
          <dl className="definition-list">
            <div>
              <dt>Celular</dt>
              <dd>{valueOrEmpty(patient.phone)}</dd>
            </div>
            <div>
              <dt>Teléfono casa</dt>
              <dd>{valueOrEmpty(patient.homePhone)}</dd>
            </div>
            <div>
              <dt>Correo</dt>
              <dd>{valueOrEmpty(patient.email)}</dd>
            </div>
            <div>
              <dt>Tipo de paciente</dt>
              <dd>{insurance?.status === 'INSURED' ? 'Asegurado' : 'Paciente regular'}</dd>
            </div>
            <div>
              <dt>Aseguradora</dt>
              <dd>
                {insurance?.status === 'INSURED' ? valueOrEmpty(insurance.insurer) : 'Sin dato'}
              </dd>
            </div>
            <div>
              <dt>Titular</dt>
              <dd>
                {insurance?.status === 'INSURED'
                  ? insurance.isPolicyHolder
                    ? 'Paciente titular'
                    : 'Otro titular'
                  : 'Sin dato'}
              </dd>
            </div>
            <div>
              <dt>Póliza</dt>
              <dd>{valueOrEmpty(insurance?.policyNumber)}</dd>
            </div>
            <div>
              <dt>Certificado / unidad</dt>
              <dd>{valueOrEmpty(insurance?.certificateOrUnit)}</dd>
            </div>
            <div>
              <dt>Identificación titular</dt>
              <dd>{valueOrEmpty(insurance?.holderDocumentId)}</dd>
            </div>
            <div>
              <dt>Nombre titular</dt>
              <dd>{valueOrEmpty(insurance?.holderFullName)}</dd>
            </div>
            <div>
              <dt>Nacimiento titular</dt>
              <dd>{valueOrEmpty(insurance?.holderBirthDate)}</dd>
            </div>
            <div>
              <dt>Fecha efectiva</dt>
              <dd>{valueOrEmpty(insurance?.effectiveDate)}</dd>
            </div>
          </dl>
        </Panel>
        <Panel>
          <h2>Contactos</h2>
          {patient.contacts?.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Teléfono</th>
                    <th>Correo</th>
                    <th>Parentesco</th>
                    <th>Rol</th>
                    <th>País</th>
                    <th>Tipo de documento</th>
                    <th>Documento</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {patient.contacts.map((contact) => (
                    <tr key={contact.id}>
                      <td>{valueOrEmpty(contact.fullName)}</td>
                      <td>{valueOrEmpty(contact.phone)}</td>
                      <td>{valueOrEmpty(contact.email)}</td>
                      <td>{valueOrEmpty(contact.relationship)}</td>
                      <td>{valueOrEmpty(contact.role)}</td>
                      <td>{valueOrEmpty(contact.country)}</td>
                      <td>{valueOrEmpty(contact.documentType)}</td>
                      <td>{valueOrEmpty(contact.documentId)}</td>
                      <td>{contact.isPrimary ? 'Principal' : 'Secundario'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Sin contactos registrados.</p>
          )}
        </Panel>
        <Panel>
          <h2>Dirección</h2>
          <dl className="definition-list">
            <div>
              <dt>Dirección</dt>
              <dd>{valueOrEmpty(patient.address?.line)}</dd>
            </div>
            <div>
              <dt>Referencia / comentario</dt>
              <dd>{valueOrEmpty(patient.address?.comments)}</dd>
            </div>
            <div>
              <dt>Coordenadas</dt>
              <dd>{valueOrEmpty(patient.address?.coordinates)}</dd>
            </div>
            <div>
              <dt>URL de ubicación</dt>
              <dd>{valueOrEmpty(patient.address?.locationUrl)}</dd>
            </div>
          </dl>
        </Panel>
      </section>
      <Link className="text-link" data-action-id="PATIENT-BACK-TO-LIST" href="/patients">
        Volver a pacientes
      </Link>
    </div>
  );
}
