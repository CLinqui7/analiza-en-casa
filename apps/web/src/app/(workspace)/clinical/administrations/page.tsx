'use client';
import { useState, type FormEvent } from 'react';
import { Button, Dialog, EmptyState, Panel } from '@analiza/ui';
import { useAuth, useWorkspace } from '@/components/providers';
import { useOperations } from '@/lib/use-operations';

export default function AdministrationsPage() {
  const operations = useOperations();
  const { hospitalizations, patients, inventoryMovements, refreshPatients } = useWorkspace();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [medicationId, setMedicationId] = useState('');
  const [presentation, setPresentation] = useState('TABLET');
  const [quantity, setQuantity] = useState(1);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const medications = operations.configuration.filter(
    (entry) => entry.active && entry.category === 'MEDICATION',
  );
  const doses = operations.configuration.filter(
    (entry) => entry.active && entry.category === 'DOSE',
  );
  const medication = medications.find((entry) => entry.id === medicationId);
  const factor =
    presentation === 'TABLET'
      ? 1
      : presentation === 'BLISTER'
        ? medication?.tabletsPerBlister
        : medication?.tabletsPerBox;
  const cases = hospitalizations.filter(
    (item) =>
      item.status !== 'CLOSED' &&
      (session?.role === 'ADMIN' ||
        (session && item.assignedNurseUserIds?.includes(session.userId))),
  );
  const warehouses = [
    ...new Set(['central', ...inventoryMovements.map((item) => item.warehouseId ?? 'central')]),
  ];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (
      await operations.execute({
        command: 'medication.administer',
        administration: {
          caseId: form.get('caseId'),
          medicationId,
          doseId: form.get('doseId'),
          presentation,
          quantity,
          warehouseId: form.get('warehouseId'),
          administeredAt: new Date(String(form.get('administeredAt'))).toISOString(),
          note: String(form.get('note') || ''),
          idempotencyKey: requestKey,
        },
      })
    ) {
      setRequestKey(crypto.randomUUID());
      setOpen(false);
      setMessage('Administración guardada e inventario descontado en la misma operación.');
      await refreshPatients();
    }
  }
  return (
    <div className="page-stack clinical-suite-page">
      <header className="page-header clinical-module-header">
        <div>
          <p className="eyebrow">Analiza en Casa</p>
          <h1>Administración de medicamentos</h1>
          <p>
            Registro de una administración realizada, con dosis del catálogo y salida del
            inventario.
          </p>
        </div>
        <Button
          data-action-id="MEDICATION-ADMINISTER"
          onClick={() => setOpen(true)}
          disabled={!cases.length}
        >
          + Registrar administración
        </Button>
      </header>
      {message ? (
        <p className="notice success" role="status">
          {message}
        </p>
      ) : null}
      <Panel>
        <div className="table-heading">
          <h2>Administraciones y consumo</h2>
        </div>
        {operations.administrations.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Paciente</th>
                  <th>Medicamento</th>
                  <th>Dosis registrada</th>
                  <th>Presentación</th>
                  <th>Salida del inventario</th>
                </tr>
              </thead>
              <tbody>
                {operations.administrations.map((entry) => (
                  <tr key={entry.id}>
                    <td>{new Date(entry.administeredAt).toLocaleString('es-SV')}</td>
                    <td>
                      {
                        patients.find(
                          (item) =>
                            item.id ===
                            hospitalizations.find((item) => item.id === entry.caseId)?.patientId,
                        )?.fullName
                      }
                    </td>
                    <td>
                      {
                        operations.configuration.find((item) => item.id === entry.medicationId)
                          ?.label
                      }
                    </td>
                    <td>
                      {operations.configuration.find((item) => item.id === entry.doseId)?.label}
                    </td>
                    <td>
                      {entry.quantity} ×{' '}
                      {{ TABLET: 'tableta', BLISTER: 'blíster', BOX: 'caja' }[entry.presentation]}
                    </td>
                    <td>{entry.baseUnits} tabletas</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Sin administraciones registradas"
            detail="La salida se aplica sólo al confirmar el guardado, nunca al crear una cotización."
          />
        )}
      </Panel>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Registrar administración"
        description="No es una prescripción. Seleccione la dosis previamente definida y verifique la presentación administrada."
        footer={
          <>
            <Button
              className="button-secondary"
              data-action-id="MEDICATION-ADMINISTRATION-CANCEL"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              data-action-id="MEDICATION-ADMINISTRATION-CONFIRM"
              type="submit"
              form="administration-form"
              disabled={operations.busy || !factor}
            >
              Confirmar y descontar
            </Button>
          </>
        }
      >
        <form id="administration-form" className="form-grid" onSubmit={submit}>
          <label>
            Hospitalización
            <select data-action-id="MEDICATION-ADMINISTRATION-CASE" name="caseId" required>
              {cases.map((item) => (
                <option key={item.id} value={item.id}>
                  {patients.find((patient) => patient.id === item.patientId)?.fullName} · {item.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hora de administración
            <input
              data-action-id="MEDICATION-ADMINISTRATION-DATETIME"
              name="administeredAt"
              type="datetime-local"
              required
            />
          </label>
          <label>
            Medicamento
            <select
              data-action-id="MEDICATION-ADMINISTRATION-MEDICATION"
              required
              value={medicationId}
              onChange={(event) => setMedicationId(event.target.value)}
            >
              <option value="">Seleccionar medicamento</option>
              {medications.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Dosis del catálogo
            <select data-action-id="MEDICATION-ADMINISTRATION-DOSE" name="doseId" required>
              <option value="">Seleccionar dosis registrada</option>
              {doses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Presentación
            <select
              data-action-id="MEDICATION-ADMINISTRATION-PRESENTATION"
              value={presentation}
              onChange={(event) => setPresentation(event.target.value)}
            >
              <option value="TABLET">Tableta</option>
              <option value="BLISTER">Blíster</option>
              <option value="BOX">Caja</option>
            </select>
          </label>
          <label>
            Cantidad de presentaciones
            <input
              data-action-id="MEDICATION-ADMINISTRATION-QUANTITY"
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              required
            />
          </label>
          <label>
            Bodega
            <select data-action-id="MEDICATION-ADMINISTRATION-WAREHOUSE" name="warehouseId">
              {warehouses.map((id) => (
                <option key={id} value={id}>
                  {id === 'central' ? 'Bodega central' : id}
                </option>
              ))}
            </select>
          </label>
          <p className="notice">
            {factor
              ? `Se descontarán ${factor * quantity} tabletas del inventario.`
              : 'Configure la equivalencia de esta presentación en el catálogo.'}
          </p>
          <label className="full">
            Observaciones
            <textarea data-action-id="MEDICATION-ADMINISTRATION-NOTE" name="note" rows={3} />
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
