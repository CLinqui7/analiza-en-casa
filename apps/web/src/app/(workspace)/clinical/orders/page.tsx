'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { searchPatients } from '@analiza/domain';
import { useAuth, useWorkspace } from '@/components/providers';

const actionSchema = z.object({
  title: z.string().trim().min(1, 'Describa la acción operativa.'),
  owner: z.string().trim().min(1, 'Indique un responsable operativo.'),
});
type ActionForm = z.infer<typeof actionSchema>;
type Action = ActionForm & { id: string; at: string; status: 'OPEN' | 'DONE' };

export default function ClinicalActionsPage() {
  const { patients } = useWorkspace();
  const { can } = useAuth();
  const [query, setQuery] = useState('');
  const matchingPatients = searchPatients(patients, query);
  const [actions, setActions] = useState<Action[]>([
    {
      id: 'action-demo-001',
      title: 'Validar disponibilidad de recurso demo',
      owner: 'Coordinación demo',
      at: '2026-08-28T08:00:00.000Z',
      status: 'OPEN',
    },
  ]);
  const [isOpen, setOpen] = useState(false);
  const form = useForm<ActionForm>({
    resolver: zodResolver(actionSchema),
    defaultValues: { title: '', owner: '' },
  });
  function close() {
    setOpen(false);
    form.reset();
  }
  function submit(values: ActionForm) {
    setActions((current) => [
      { id: crypto.randomUUID(), ...values, at: new Date().toISOString(), status: 'OPEN' },
      ...current,
    ]);
    close();
  }
  function complete(id: string) {
    setActions((current) =>
      current.map((action) => (action.id === id ? { ...action, status: 'DONE' } : action)),
    );
  }
  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Clínico · auditoría</p>
          <h1>Órdenes y acciones</h1>
          <p>
            Registro operativo auditable; no se usa para prescribir ni divulgar contenido clínico.
          </p>
        </div>
        {can('clinical:write') ? <Button data-action-id="MEDICAL-ORDER-CREATE" onClick={() => setOpen(true)} type="button">
          Nueva acción
        </Button> : null}
      </header>
      <Panel>
        <label className="search-label" htmlFor="medical-order-search">
          Buscar por paciente
        </label>
        <input
          data-action-id="MEDICAL-ORDER-SEARCH"
          id="medical-order-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre, documento o teléfono"
          type="search"
          value={query}
        />
        <p>{matchingPatients.length ? `${matchingPatients.length} paciente(s) coinciden.` : 'Sin pacientes coincidentes.'}</p>
      </Panel>
      <Panel>
        <div className="table-heading">
          <h2>Acciones operativas</h2>
          <StatusTag>
            {actions.filter((action) => action.status === 'OPEN').length} abiertas
          </StatusTag>
        </div>
        {actions.length ? (
          <div className="action-list">
            {actions.map((action) => (
              <article className="action-card" key={action.id}>
                <div>
                  <strong>{action.title}</strong>
                  <span>
                    {action.owner} · {new Date(action.at).toLocaleString('es-SV')}
                  </span>
                </div>
                {action.status === 'OPEN' && can('clinical:write') ? (
                  <Button
                    className="button-secondary"
                    onClick={() => complete(action.id)}
                    type="button"
                  >
                    Marcar completada
                  </Button>
                ) : (
                  <StatusTag tone="success">Completada</StatusTag>
                )}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState detail="Cree una acción operativa para registrarla." title="Sin acciones" />
        )}
      </Panel>
      <Dialog
        description="Las acciones no incluyen diagnóstico, tratamiento ni medicación."
        footer={
          <>
            <Button className="button-secondary" onClick={close} type="button">
              Cancelar
            </Button>
            <Button form="action-form" type="submit">
              Guardar acción
            </Button>
          </>
        }
        onClose={close}
        open={isOpen}
        title="Nueva acción operativa"
      >
        <form
          className="form-grid"
          id="action-form"
          noValidate
          onSubmit={form.handleSubmit(submit)}
        >
          <label>
            Acción
            <input {...form.register('title')} />
            {form.formState.errors.title ? (
              <span className="field-error">{form.formState.errors.title.message}</span>
            ) : null}
          </label>
          <label>
            Responsable
            <input {...form.register('owner')} />
            {form.formState.errors.owner ? (
              <span className="field-error">{form.formState.errors.owner.message}</span>
            ) : null}
          </label>
        </form>
      </Dialog>
    </div>
  );
}
