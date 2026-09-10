'use client';
import { useState, type FormEvent } from 'react';
import { Button, Dialog, Panel, StatusTag } from '@analiza/ui';
import { useWorkspace } from '@/components/providers';
import { useOperations } from '@/lib/use-operations';

export default function NursingTeamPage() {
  const { nursingResources, refreshPatients } = useWorkspace();
  const operations = useOperations();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await operations.execute({
      command: 'nurse.create',
      email: form.get('email'),
      password: form.get('password'),
      resource: {
        id: crypto.randomUUID(),
        displayName: form.get('name'),
        territory: form.get('territory'),
        boardRegistrationNumber: form.get('registration'),
        shift: form.get('shift'),
        capacity: 1,
        availability: 'AVAILABLE',
      },
    });
    if (result) {
      setOpen(false);
      setMessage('Cuenta de enfermería creada. Ya puede asignarse a una hospitalización.');
      await refreshPatients();
    }
  }
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Analiza en Casa</p>
          <h1>Equipo de enfermería</h1>
          <p>Personas, cuentas de acceso y asignación para la atención domiciliaria.</p>
        </div>
        <Button data-action-id="NURSE-ACCOUNT-CREATE" onClick={() => setOpen(true)}>
          + Agregar enfermera
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
              </tr>
            </thead>
            <tbody>
              {nursingResources.map((resource) => (
                <tr key={resource.id}>
                  <td>
                    <strong>{resource.displayName}</strong>
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
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Nueva enfermera"
        description="La cuenta creada tendrá exclusivamente el rol Enfermera dentro de esta organización."
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
            Registro profesional
            <input name="registration" required />
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
