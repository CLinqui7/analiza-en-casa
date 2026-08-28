'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type NurseHourEntry } from '@analiza/contracts';
import { nurseHoursTotal, toCsv } from '@analiza/domain';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useWorkspace } from '@/components/providers';

const hoursFormSchema = z.object({
  resourceId: z.string().min(1, 'Seleccione un recurso.'),
  date: z.string().min(1, 'Indique la fecha.'),
  hours: z.coerce.number().positive('Las horas deben ser mayores que cero.'),
  service: z.string().trim().min(1, 'Describa el servicio de forma operativa.'),
});
type HoursFormInput = z.input<typeof hoursFormSchema>;
type HoursForm = z.output<typeof hoursFormSchema>;

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function NurseHoursPage() {
  const { addNurseHour, nurseHours, nursingResources } = useWorkspace();
  const [isOpen, setOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const total = nurseHoursTotal(nurseHours);
  const byResource = useMemo(
    () =>
      nursingResources.map((resource) => ({
        resource,
        hours: nurseHoursTotal(nurseHours.filter((entry) => entry.resourceId === resource.id)),
      })),
    [nurseHours, nursingResources],
  );
  const form = useForm<HoursFormInput, unknown, HoursForm>({
    resolver: zodResolver(hoursFormSchema),
    defaultValues: {
      resourceId: nursingResources[0]?.id ?? '',
      date: '2026-08-28',
      hours: 1,
      service: '',
    },
  });

  function closeDialog() {
    setOpen(false);
    form.reset({
      resourceId: nursingResources[0]?.id ?? '',
      date: '2026-08-28',
      hours: 1,
      service: '',
    });
  }
  function submit(values: HoursForm) {
    const entry: NurseHourEntry = { id: crypto.randomUUID(), ...values };
    addNurseHour(entry);
    setResult('Hora de enfermería agregada al reporte consolidado.');
    closeDialog();
  }
  function exportReport() {
    const rows = [
      ['Recurso', 'Fecha', 'Horas', 'Servicio'],
      ...nurseHours.map((entry) => [
        nursingResources.find((resource) => resource.id === entry.resourceId)?.displayName ??
          'No disponible',
        entry.date,
        String(entry.hours),
        entry.service,
      ]),
    ];
    downloadCsv('reporte-horas-enfermeria-demo.csv', toCsv(rows));
    setResult('CSV del reporte consolidado generado localmente.');
  }

  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Reportes</p>
          <h1>Horas de enfermería</h1>
          <p>Consolidado por recurso, con exportación CSV local y trazabilidad del registro.</p>
        </div>
        <div className="action-row">
          <Button className="button-secondary" onClick={exportReport} type="button">
            Exportar CSV
          </Button>
          <Button
            onClick={() => {
              setResult(null);
              setOpen(true);
            }}
            type="button"
          >
            Agregar horas
          </Button>
        </div>
      </header>
      {result ? (
        <p className="notice success" role="status">
          {result}
        </p>
      ) : null}
      <section className="metric-grid">
        <Panel>
          <span>Horas consolidadas</span>
          <strong>{total}</strong>
        </Panel>
        <Panel>
          <span>Recursos con registro</span>
          <strong>{byResource.filter((row) => row.hours > 0).length}</strong>
        </Panel>
      </section>
      <Panel>
        <div className="table-heading">
          <h2>Resumen por recurso</h2>
          <StatusTag>{nurseHours.length} entradas</StatusTag>
        </div>
        {byResource.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Recurso</th>
                  <th>Territorio</th>
                  <th>Horas</th>
                </tr>
              </thead>
              <tbody>
                {byResource.map(({ resource, hours }) => (
                  <tr key={resource.id}>
                    <td>{resource.displayName}</td>
                    <td>{resource.territory}</td>
                    <td>{hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState detail="Registre un recurso y sus horas." title="Sin datos" />
        )}
      </Panel>
      <Dialog
        description="La exportación se compone de las entradas visibles de esta sesión demo."
        footer={
          <>
            <Button className="button-secondary" onClick={closeDialog} type="button">
              Cancelar
            </Button>
            <Button form="hours-form" type="submit">
              Guardar horas
            </Button>
          </>
        }
        onClose={closeDialog}
        open={isOpen}
        title="Agregar horas de enfermería"
      >
        <form className="form-grid" id="hours-form" noValidate onSubmit={form.handleSubmit(submit)}>
          <label>
            Recurso
            <select {...form.register('resourceId')}>
              {nursingResources.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.displayName}
                </option>
              ))}
            </select>
            {form.formState.errors.resourceId ? (
              <span className="field-error">{form.formState.errors.resourceId.message}</span>
            ) : null}
          </label>
          <label>
            Fecha
            <input {...form.register('date')} type="date" />
            {form.formState.errors.date ? (
              <span className="field-error">{form.formState.errors.date.message}</span>
            ) : null}
          </label>
          <label>
            Horas
            <input {...form.register('hours')} min="0.25" step="0.25" type="number" />
            {form.formState.errors.hours ? (
              <span className="field-error">{form.formState.errors.hours.message}</span>
            ) : null}
          </label>
          <label>
            Servicio operativo
            <input {...form.register('service')} />
            {form.formState.errors.service ? (
              <span className="field-error">{form.formState.errors.service.message}</span>
            ) : null}
          </label>
        </form>
      </Dialog>
    </div>
  );
}
