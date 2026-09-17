'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Dialog, Panel, StatusTag } from '@analiza/ui';
import { useAuth, useWorkspace } from '@/components/providers';
import { useOperations } from '@/lib/use-operations';
import type { NurseProfileSubmission } from '@/lib/nurse-profile';
import {
  listPrivateFiles,
  privateFileDownloadHref,
  uploadPrivateFiles,
  type PrivateFileMetadata,
} from '@/lib/private-files';

const patientTypeOptions = [
  ['PEDIATRIC', 'Pediátricos'],
  ['GERIATRIC', 'Geriátricos'],
  ['PALLIATIVE', 'Paliativos'],
  ['ACUTE', 'Agudos'],
  ['CHRONIC', 'Crónicos'],
  ['STABLE', 'Estables'],
  ['CRITICAL', 'Críticos'],
] as const;

export default function NursingTeamPage() {
  const { nursingResources, refreshPatients } = useWorkspace();
  const { session } = useAuth();
  const operations = useOperations();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [profiles, setProfiles] = useState<NurseProfileSubmission[]>([]);
  const [profilesError, setProfilesError] = useState('');
  const [attachments, setAttachments] = useState<Record<string, PrivateFileMetadata[]>>({});
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/admin/nurse-profiles', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return (await response.json()) as NurseProfileSubmission[];
      })
      .then(setProfiles)
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setProfilesError('No fue posible cargar los cuestionarios de enfermería.');
        }
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!session || !nursingResources.length) return;
    let active = true;
    void Promise.all(
      nursingResources.map(
        async (resource) =>
          [resource.id, await listPrivateFiles('nursing_resource', resource.id)] as const,
      ),
    )
      .then((entries) => {
        if (active) setAttachments(Object.fromEntries(entries));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [nursingResources, session]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const resourceId = crypto.randomUUID();
    const selectedFile = form.get('credentialFile');
    const result = await operations.execute({
      command: 'nurse.create',
      email: form.get('email'),
      password: form.get('password'),
      role: form.get('role'),
      resource: {
        id: resourceId,
        displayName: form.get('name'),
        territory: form.get('territory'),
        boardRegistrationNumber: form.get('registration'),
        shift: form.get('shift'),
        capacity: 1,
        availability: 'AVAILABLE',
        patientTypes: form.getAll('patientTypes'),
        comments: form.get('comments') || undefined,
      },
    });
    if (result) {
      if (selectedFile instanceof File && selectedFile.size) {
        try {
          const uploaded = await uploadPrivateFiles('nursing_resource', resourceId, [selectedFile]);
          setAttachments((current) => ({ ...current, [resourceId]: uploaded }));
        } catch {
          setMessage(
            'La cuenta se creó, pero el archivo no pudo adjuntarse. Puede volver a cargarlo al editar el perfil.',
          );
          await refreshPatients();
          return;
        }
      }
      setOpen(false);
      setMessage('Perfil de usuario creado con su rol y acceso al sistema.');
      await refreshPatients();
    }
  }
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Analiza en Casa</p>
          <h1>Usuarios y equipo de enfermería</h1>
          <p>Cuentas de acceso, roles y asignación para la atención domiciliaria.</p>
        </div>
        <Button data-action-id="NURSE-ACCOUNT-CREATE" onClick={() => setOpen(true)}>
          + Crear perfil de usuario
        </Button>
      </header>
      {message ? (
        <p role="status" className="notice success">
          {message}
        </p>
      ) : null}
      <Panel>
        <div className="table-heading">
          <h2>Enfermeras y recursos</h2>
          <StatusTag>{nursingResources.length} registros</StatusTag>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Registro</th>
                <th>Zona</th>
                <th>Turno</th>
                <th>Cuenta de usuario</th>
                <th>Pacientes y respaldo</th>
              </tr>
            </thead>
            <tbody>
              {nursingResources.map((resource) => (
                <tr key={resource.id}>
                  <td>
                    <strong>{resource.displayName}</strong>
                  </td>
                  <td>
                    <small>
                      {resource.patientTypes
                        ?.map((type) => patientTypeOptions.find(([value]) => value === type)?.[1])
                        .filter(Boolean)
                        .join(', ') || 'Sin especialidad indicada'}
                    </small>
                    {attachments[resource.id]?.map((file) => (
                      <div key={file.id}>
                        <a href={privateFileDownloadHref(file.id)} target="_blank" rel="noreferrer">
                          Ver archivo · {file.name}
                        </a>
                      </div>
                    ))}
                  </td>
                  <td>{resource.boardRegistrationNumber}</td>
                  <td>{resource.territory}</td>
                  <td>
                    {{ MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }[resource.shift]}
                  </td>
                  <td>
                    <StatusTag tone={resource.userId ? 'success' : 'warning'}>
                      {resource.userId ? 'Vinculada' : 'Recurso sin acceso'}
                    </StatusTag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel>
        <div className="table-heading">
          <div>
            <h2>Cuestionarios de ingreso</h2>
            <p>Información enviada por cada enfermera durante su primer acceso.</p>
          </div>
          <StatusTag>{profiles.length} completados</StatusTag>
        </div>
        {profilesError ? <p className="notice danger">{profilesError}</p> : null}
        {!profilesError && !profiles.length ? (
          <p>Aún no hay cuestionarios completados.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Enfermera</th>
                  <th>Funciones</th>
                  <th>Pacientes</th>
                  <th>Medicamentos conocidos</th>
                  <th>Horario</th>
                  <th>Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((entry) => (
                  <tr key={entry.userId}>
                    <td>
                      <strong>{entry.profile.fullName || entry.accountName}</strong>
                      <br />
                      <small>{entry.accountEmail}</small>
                    </td>
                    <td>{entry.profile.mainFunctions}</td>
                    <td>Hasta {entry.workload.maxPatients}</td>
                    <td>
                      {[...entry.workload.knownMedicationIds, entry.workload.otherMedications]
                        .filter(Boolean)
                        .join(', ') || 'No indicó'}
                    </td>
                    <td>
                      {entry.schedule.startTime}–{entry.schedule.endTime} ·{' '}
                      {entry.schedule.weeklyHours} h/semana
                    </td>
                    <td>{new Date(entry.updatedAt).toLocaleString('es-MX')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Nuevo perfil de usuario"
        description="Seleccione el rol que define las funciones visibles para esta cuenta."
        footer={
          <>
            <Button className="button-secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button form="nurse-account-form" type="submit" disabled={operations.busy}>
              Crear cuenta
            </Button>
          </>
        }
      >
        <form className="form-grid" id="nurse-account-form" onSubmit={submit}>
          <label>
            Nombre completo
            <input name="name" required />
          </label>
          <label>
            Rol
            <select name="role" defaultValue="NURSE">
              {session?.role === 'ADMIN' ? <option value="ADMIN">Administrador</option> : null}
              {session?.role === 'ADMIN' ? <option value="MANAGER">Gerente</option> : null}
              <option value="NURSE_MANAGER">Supervisora / jefe de enfermería</option>
              <option value="NURSE">Enfermería</option>
            </select>
          </label>
          <label>
            Registro profesional
            <input name="registration" required />
          </label>
          <fieldset className="full checkbox-fieldset">
            <legend>Tipos de pacientes que está capacitada para atender</legend>
            <div className="checkbox-grid">
              {patientTypeOptions.map(([value, label]) => (
                <label key={value} className="checkbox-option">
                  <input name="patientTypes" type="checkbox" value={value} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="full">
            Comentarios
            <textarea
              name="comments"
              maxLength={2000}
              placeholder="Experiencia, restricciones, certificaciones u otra información útil."
              rows={4}
            />
          </label>
          <label className="full">
            Adjuntar archivo
            <input
              name="credentialFile"
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
            />
            <span className="field-help">
              Credencial, certificación o documento de respaldo. Máximo 25 MB.
            </span>
          </label>
          <label>
            Zona
            <input name="territory" required />
          </label>
          <label>
            Turno
            <select name="shift">
              <option value="MORNING">Mañana</option>
              <option value="AFTERNOON">Tarde</option>
              <option value="NIGHT">Noche</option>
            </select>
          </label>
          <label>
            Correo de acceso
            <input name="email" type="email" autoComplete="off" required />
          </label>
          <label>
            Contraseña inicial
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
            <span className="field-help">
              Mínimo 12 caracteres. Entréguela únicamente por un canal privado.
            </span>
          </label>
          {operations.error ? (
            <p className="field-error full" role="alert">
              {operations.error}
            </p>
          ) : null}
        </form>
      </Dialog>
    </div>
  );
}
