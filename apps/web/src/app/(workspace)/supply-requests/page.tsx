'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import {
  RequestProductsEditor,
  blankRequestProduct,
  readProductRows,
} from '@/components/clinical/request-products-editor';
import { SearchableSelect } from '@/components/common/searchable-select';
import { useAuth, useWorkspace } from '@/components/providers';
import { mongoMutationHeaders } from '@/lib/auth';
import {
  supplyRequestSchema,
  supplyRequestProducts,
  type SupplyRequest,
  type SupplyRequestCatalogItem,
} from '@/lib/supply-requests';

const priorityLabels = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta' } as const;
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
  const [rows, setRows] = useState(() => [blankRequestProduct()]);
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
    let products;
    try {
      products = supplyRequestProducts.parse(readProductRows(rows));
    } catch {
      setError(
        'Seleccione cada concepto una sola vez, con una cantidad entera positiva y el importe del honorario cuando corresponda.',
      );
      return;
    }
    if (!patientId) {
      setError('Seleccione el paciente para esta solicitud.');
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
          ...(products.length === 1 && 'catalogItemId' in products[0] ? products[0] : { products }),
          priority,
          note,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? 'No se pudo guardar la solicitud.');
      }
      const saved = supplyRequestSchema.safeParse(await response.json());
      if (saved.success) {
        setInbox((previous) => ({
          ...previous,
          requests: [saved.data, ...previous.requests.filter((row) => row.id !== saved.data.id)],
        }));
      } else {
        void load().catch(() =>
          setError('La solicitud quedó registrada. Actualice la bandeja para ver sus productos.'),
        );
      }
      setNotice(
        'Solicitud interna recibida y auditada. Los conceptos ya están disponibles en Precotización.',
      );
      setOpen(false);
      setPatientId('');
      setRows([blankRequestProduct()]);
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
      {error && !open ? (
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
                  <th>Productos y cantidades</th>
                  <th>Prioridad</th>
                  <th>Paciente</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {inbox.requests.map((request) => {
                  const products =
                    request.products ??
                    (request.catalogItemId
                      ? [
                          {
                            id: request.id,
                            catalogItemId: request.catalogItemId,
                            quantity: request.quantity,
                          },
                        ]
                      : []);
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
                        {products.map((line) => (
                          <div key={line.id}>
                            {'feeService' in line
                              ? line.feeService
                              : (itemsById.get(line.catalogItemId)?.name ??
                                'Producto del catálogo')}{' '}
                            × {line.quantity}
                          </div>
                        ))}
                      </td>
                      <td>{priorityLabels[request.priority]}</td>
                      <td>{patient?.fullName ?? 'Destino protegido'}</td>
                      <td>
                        <StatusTag tone={request.status === 'ASSIGNED' ? 'success' : 'warning'}>
                          {request.status === 'ASSIGNED'
                            ? 'Asignada a cotización'
                            : request.status === 'REMOVED'
                              ? 'Retirada de cotización'
                              : 'Recibida'}
                        </StatusTag>
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
            <Button
              className="button-secondary"
              disabled={busy}
              onClick={() => setOpen(false)}
              type="button"
            >
              Cancelar
            </Button>
            <Button disabled={busy} form="supply-request-form" type="submit">
              {busy ? 'Guardando…' : 'Enviar solicitud interna'}
            </Button>
          </>
        }
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        open={open}
        title="Nueva solicitud de enfermería"
      >
        <form
          className="form-grid"
          id="supply-request-form"
          onSubmit={(event) => void submit(event)}
        >
          {error && (
            <p className="notice danger full" role="alert">
              {error}
            </p>
          )}
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
          <div className="full">
            <RequestProductsEditor
              rows={rows}
              onChange={setRows}
              catalog={inbox.catalogItems}
              busy={busy}
              minimum={1}
            />
          </div>
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
