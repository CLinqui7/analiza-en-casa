'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type NursingResource } from '@analiza/contracts';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useWorkspace } from '@/components/providers';
import { useAuth } from '@/components/providers';

const resourceFormSchema = z.object({
  displayName: z.string().trim().min(1, 'Ingrese el nombre visible.'),
  territory: z.string().trim().min(1, 'Ingrese el territorio operativo.'),
  shift: z.enum(['MORNING', 'AFTERNOON', 'NIGHT']),
  availability: z.enum(['AVAILABLE', 'ASSIGNED', 'OFF_DUTY']),
  capacity: z.coerce.number().int().nonnegative('La capacidad no puede ser negativa.'),
  boardRegistrationNumber: z.string().trim().min(1, 'Ingrese el número de Junta o registro profesional.'),
});
type ResourceFormInput = z.input<typeof resourceFormSchema>;
type ResourceForm = z.output<typeof resourceFormSchema>;

const shiftLabel = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' };
const availabilityLabel = {
  AVAILABLE: 'Disponible',
  ASSIGNED: 'Asignado',
  OFF_DUTY: 'Fuera de turno',
};
const availabilityTone = {
  AVAILABLE: 'success',
  ASSIGNED: 'warning',
  OFF_DUTY: 'neutral',
} as const;

export default function NursingBoardPage() {
  const { addNursingResource, nursingResources } = useWorkspace();
  const { can } = useAuth();
  const [isOpen, setOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const form = useForm<ResourceFormInput, unknown, ResourceForm>({
    resolver: zodResolver(resourceFormSchema),
    defaultValues: {
      displayName: '',
      territory: '',
      shift: 'MORNING',
      availability: 'AVAILABLE',
      capacity: 0,
    },
  });

  function closeDialog() {
    setOpen(false);
    form.reset();
  }
  function submit(values: ResourceForm) {
    const resource: NursingResource = { id: crypto.randomUUID(), ...values };
    addNursingResource(resource);
    setResult(`Recurso ${resource.displayName} registrado en el tablero.`);
    closeDialog();
  }

  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Clínico · operaciones</p>
          <h1>Tablero de enfermería</h1>
          <p>Disponibilidad, territorio, turno y capacidad operativa, sin datos de pacientes.</p>
        </div>
        {can('nursing:write') ? <Button
          data-action-id="NURSING-RESOURCE-CREATE"
          onClick={() => {
            setResult(null);
            setOpen(true);
          }}
          type="button"
        >
          Registrar recurso
        </Button> : null}
      </header>
      {result ? (
        <p className="notice success" role="status">
          {result}
        </p>
      ) : null}
      {nursingResources.length ? (
        <section className="board-grid">
          {nursingResources.map((resource) => (
            <Panel className="resource-card" key={resource.id}>
              <div className="table-heading">
                <h2>{resource.displayName}</h2>
                <StatusTag tone={availabilityTone[resource.availability]}>
                  {availabilityLabel[resource.availability]}
                </StatusTag>
              </div>
              <dl className="definition-list">
                <div>
                  <dt>Número de Junta / registro profesional</dt>
                  <dd>{resource.boardRegistrationNumber}</dd>
                </div>
                <div>
                  <dt>Territorio</dt>
                  <dd>{resource.territory}</dd>
                </div>
                <div>
                  <dt>Turno</dt>
                  <dd>{shiftLabel[resource.shift]}</dd>
                </div>
                <div>
                  <dt>Capacidad disponible</dt>
                  <dd>{resource.capacity}</dd>
                </div>
              </dl>
            </Panel>
          ))}
        </section>
      ) : (
        <Panel>
          <EmptyState detail="Registre un recurso para iniciar el tablero." title="Sin recursos" />
        </Panel>
      )}
      <Dialog
        description="El registro crea un recurso operativo sintético y agrega su evento a la bitácora."
        footer={
          <>
            <Button className="button-secondary" onClick={closeDialog} type="button">
              Cancelar
            </Button>
            <Button form="resource-form" type="submit">
              Guardar recurso
            </Button>
          </>
        }
        onClose={closeDialog}
        open={isOpen}
        title="Registrar recurso de enfermería"
      >
        <form
          className="form-grid"
          id="resource-form"
          noValidate
          onSubmit={form.handleSubmit(submit)}
        >
          <label>
            Número de Junta / registro profesional
            <input {...form.register('boardRegistrationNumber')} />
            {form.formState.errors.boardRegistrationNumber ? (
              <span className="field-error">{form.formState.errors.boardRegistrationNumber.message}</span>
            ) : null}
          </label>
          <label>
            Nombre visible
            <input {...form.register('displayName')} />
            {form.formState.errors.displayName ? (
              <span className="field-error">{form.formState.errors.displayName.message}</span>
            ) : null}
          </label>
          <label>
            Territorio
            <input {...form.register('territory')} />
            {form.formState.errors.territory ? (
              <span className="field-error">{form.formState.errors.territory.message}</span>
            ) : null}
          </label>
          <label>
            Turno
            <select {...form.register('shift')}>
              <option value="MORNING">Mañana</option>
              <option value="AFTERNOON">Tarde</option>
              <option value="NIGHT">Noche</option>
            </select>
          </label>
          <label>
            Estado
            <select {...form.register('availability')}>
              <option value="AVAILABLE">Disponible</option>
              <option value="ASSIGNED">Asignado</option>
              <option value="OFF_DUTY">Fuera de turno</option>
            </select>
          </label>
          <label>
            Capacidad disponible
            <input {...form.register('capacity')} min="0" type="number" />
            {form.formState.errors.capacity ? (
              <span className="field-error">{form.formState.errors.capacity.message}</span>
            ) : null}
          </label>
        </form>
      </Dialog>
    </div>
  );
}
