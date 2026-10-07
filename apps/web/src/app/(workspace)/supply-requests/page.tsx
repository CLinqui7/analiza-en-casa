'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { SearchableSelect } from '@/components/common/searchable-select';
import { useAuth, useWorkspace } from '@/components/providers';
import { mongoMutationHeaders } from '@/lib/auth';
import {
  supplyRequestSchema,
  type SupplyRequest,
  type SupplyRequestCatalogItem,
} from '@/lib/supply-requests';

const priorityLabels = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta' } as const;
const categoryLabels = {
  MEDICATIONS: 'Medicamento',
  SUPPLIES: 'Insumo',
  EQUIPMENT: 'Equipo',
} as const;

type Inbox = { requests: SupplyRequest[]; catalogItems: SupplyRequestCatalogItem[] };

export default function SupplyRequestsPage() {
  const { can, session } = useAuth();
  const { patients } = useWorkspace();
  const [inbox, setInbox] = useState<Inbox>({ requests: [], catalogItems: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [catalogItemId, setCatalogItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [note, setNote] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch('/api/supply-requests', { cache: 'no-store', signal });
    if (!response.ok) throw new Error('No se pudo cargar la bandeja de solicitudes.');
    const payload = (await response.json()) as Inbox;
    setInbox({
      requests: (payload.requests ?? []).map((row) => supplyRequestSchema.parse(row)),
      catalogItems: payload.catalogItems ?? [],
    });
  }, []);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void load(controller.signal)
        .catch((cause) => {
          if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
            setError(cause instanceof Error ? cause.message : 'No se pudo cargar la bandeja.');
          }
        })
        .finally(() => setLoading(false));
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load, session]);

  const activePatients = useMemo(
    () => patients.filter((patient) => patient.status === 'ACTIVE'),
    [patients],
  );
  const itemsById = useMemo(
    () => new Map(inbox.catalogItems.map((item) => [item.id, item])),
    [inbox.catalogItems],
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (
      !patientId ||
      !catalogItemId ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 100000
    ) {
      setError('Seleccione paciente e ítem y escriba una cantidad entera positiva.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/supply-requests', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.mode === 'mock' ? {} : mongoMutationHeaders()),
        },
        body: JSON.stringify({
          idempotencyKey,
          patientId,
          catalogItemId,
          quantity,
          priority,
          note,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? 'No se pudo guardar la solicitud.');
      }
      await load();
      setNotice(
        'Solicitud interna recibida y auditada. No se ha enviado ninguna notificación externa.',
      );
      setOpen(false);
      setPatientId('');
      setCatalogItemId('');
      setQuantity(1);
      setPriority('MEDIUM');
      setNote('');
      setIdempotencyKey(crypto.randomUUID());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la solicitud.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Enfermería · inventario</p>
          <h1>Solicitudes de medicamentos e insumos</h1>
          <p>
            Pedidos internos por paciente, catálogo y prioridad. No generan compras ni movimientos
            automáticamente.
          </p>
        </div>
        {can('supply-requests:write') ? (
          <Button
            data-action-id="SUPPLY-REQUEST-CREATE"
            onClick={() => {
              setError('');
              setOpen(true);
            }}
            type="button"
          >
            Nueva solicitud
          </Button>
        ) : null}
      </header>
      {error ? (
        <p className="notice danger" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="notice success" role="status">
          {notice}
        </p>
      ) : null}
      <Panel>
        <div className="table-heading">
          <h2>Bandeja interna</h2>
          <StatusTag>{inbox.requests.length} solicitudes</StatusTag>
        </div>
        {loading ? (
          <p role="status">Cargando solicitudes…</p>
        ) : inbox.requests.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Ítem</th>
                  <th>Cantidad</th>
                  <th>Prioridad</th>
                  <th>Paciente</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {inbox.requests.map((request) => {
                  const item = itemsById.get(request.catalogItemId);
                  const patient = can('patients:read')
                    ? patients.find((entry) => entry.id === request.patientId)
                    : undefined;
                  return (
                    <tr key={request.id}>
                      <td>
                        {new Intl.DateTimeFormat('es-SV', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(request.createdAt))}
                      </td>
                      <td>
                        {item ? `${item.sku} · ${item.name}` : 'Ítem de catálogo no disponible'}
                      </td>
                      <td>{request.quantity}</td>
                      <td>{priorityLabels[request.priority]}</td>
                      <td>{patient?.fullName ?? 'Destino protegido'}</td>
                      <td>
                        <StatusTag tone="warning">Recibida</StatusTag>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Sin solicitudes"
            detail="Cuando enfermería envíe un pedido aparecerá aquí."
          />
        )}
      </Panel>
      <Dialog
        description="El pedido queda dentro del sistema. No incluye diagnóstico, indicaciones médicas ni envío por WhatsApp o correo."
        footer={
          <>
            <Button className="button-secondary" onClick={() => setOpen(false)} type="button">
              Cancelar
            </Button>
            <Button disabled={busy} form="supply-request-form" type="submit">
              {busy ? 'Guardando…' : 'Enviar solicitud interna'}
            </Button>
          </>
        }
        onClose={() => setOpen(false)}
        open={open}
        title="Nueva solicitud de enfermería"
      >
        <form
          className="form-grid"
          id="supply-request-form"
          onSubmit={(event) => void submit(event)}
        >
          <label>
            Paciente
            <SearchableSelect
              ariaLabel="Buscar paciente por nombre o DUI para solicitud"
              onChange={setPatientId}
              options={activePatients.map((patient) => ({
                value: patient.id,
                label: `${patient.fullName} · ${patient.documentId}`,
              }))}
              placeholder="Nombre o DUI"
              value={patientId}
            />
          </label>
          <label>
            Medicamento, insumo o equipo
            <SearchableSelect
              ariaLabel="Buscar medicamento, insumo o equipo"
              onChange={setCatalogItemId}
              options={inbox.catalogItems.map((item) => ({
                value: item.id,
                label: `${categoryLabels[item.category]} · ${item.sku} · ${item.name}`,
              }))}
              placeholder="Código o nombre del catálogo"
              value={catalogItemId}
            />
          </label>
          <label>
            Cantidad
            <input
              min="1"
              max="100000"
              step="1"
              type="number"
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
            />
          </label>
          <label>
            Prioridad operativa
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as typeof priority)}
            >
              <option value="LOW">Baja</option>
              <option value="MEDIUM">Media</option>
              <option value="HIGH">Alta</option>
            </select>
          </label>
          <label className="full">
            Nota logística opcional
            <textarea
              maxLength={500}
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <span className="field-help">
              No escriba diagnósticos, tratamientos ni indicaciones clínicas.
            </span>
          </label>
        </form>
      </Dialog>
    </div>
  );
}
