'use client';

import type { CatalogItem } from '@analiza/contracts';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useMemo, useState, type FormEvent } from 'react';
import { useAuth, useWorkspace } from '@/components/providers';

const blankInsurer = {
  name: '',
  contactName: '',
  landlinePhone: '',
  mobilePhone: '',
  email: '',
  notes: '',
};

export default function InsurersPage() {
  const { addCatalogItem, catalogItems } = useWorkspace();
  const { can } = useAuth();
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const insurers = useMemo(
    () =>
      catalogItems
        .filter((item) => item.category === 'INSURERS')
        .filter((item) =>
          [item.name, item.contactName, item.email, item.mobilePhone]
            .filter(Boolean)
            .join(' ')
            .toLocaleLowerCase('es')
            .includes(query.trim().toLocaleLowerCase('es')),
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [catalogItems, query],
  );
  const allInsurers = catalogItems.filter((item) => item.category === 'INSURERS');

  function show(item?: CatalogItem) {
    setEditing(item ?? null);
    setError('');
    setMessage('');
    setOpen(true);
  }

  function nextSku() {
    const numbers = allInsurers
      .map((item) => Number(item.sku.replace(/^ASE-/, '')))
      .filter(Number.isFinite);
    return `ASE-${String(Math.max(0, ...numbers) + 1).padStart(4, '0')}`;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: keyof typeof blankInsurer) => String(form.get(name) ?? '').trim();
    const name = value('name');
    if (!name) {
      setError('El nombre de la aseguradora es obligatorio.');
      return;
    }
    const item: CatalogItem = {
      id: editing?.id ?? crypto.randomUUID(),
      sku: editing?.sku ?? nextSku(),
      name,
      category: 'INSURERS',
      status: editing?.status ?? 'ACTIVE',
      createdAt: editing?.createdAt ?? new Date().toISOString(),
      contactName: value('contactName') || undefined,
      landlinePhone: value('landlinePhone') || undefined,
      mobilePhone: value('mobilePhone') || undefined,
      email: value('email') || undefined,
      notes: value('notes') || undefined,
    };
    if (!(await addCatalogItem(item))) {
      setError('No fue posible guardar la aseguradora. Revise los datos e inténtelo nuevamente.');
      return;
    }
    setOpen(false);
    setMessage(`${name} fue ${editing ? 'actualizada' : 'agregada'} correctamente.`);
  }

  async function toggle(item: CatalogItem) {
    const nextStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (await addCatalogItem({ ...item, status: nextStatus })) {
      setMessage(`${item.name} quedó ${nextStatus === 'ACTIVE' ? 'activa' : 'inactiva'}.`);
    }
  }

  return (
    <div className="page-stack insurers-page">
      <header className="insurers-hero">
        <div>
          <p className="eyebrow">Directorio administrativo</p>
          <h1>Aseguradoras</h1>
          <p>
            Mantenga los contactos de cada compañía en un solo lugar y selecciónelos directamente al
            crear una hospitalización.
          </p>
        </div>
        {can('catalogs:write') ? (
          <Button onClick={() => show()}>+ Agregar aseguradora</Button>
        ) : null}
      </header>

      <section className="insurer-metrics" aria-label="Resumen de aseguradoras">
        <div>
          <strong>{allInsurers.length}</strong>
          <span>Registradas</span>
        </div>
        <div>
          <strong>{allInsurers.filter((item) => item.status === 'ACTIVE').length}</strong>
          <span>Activas</span>
        </div>
        <div>
          <strong>{allInsurers.filter((item) => item.contactName || item.email).length}</strong>
          <span>Con contacto</span>
        </div>
      </section>

      {message ? (
        <p className="notice success" role="status">
          {message}
        </p>
      ) : null}
      <Panel>
        <div className="table-heading insurer-toolbar">
          <div>
            <h2>Directorio</h2>
            <p>Los registros activos aparecen en el menú desplegable de Hospitalización.</p>
          </div>
          <label className="insurer-search">
            <span>Buscar</span>
            <input
              aria-label="Buscar aseguradora"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nombre, contacto o teléfono…"
              type="search"
              value={query}
            />
          </label>
        </div>
        {insurers.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Aseguradora</th>
                  <th>Contacto</th>
                  <th>Teléfonos</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {insurers.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      <br />
                      <small>{item.sku}</small>
                    </td>
                    <td>
                      {item.contactName || 'Sin contacto'}
                      {item.email ? (
                        <>
                          <br />
                          <a href={`mailto:${item.email}`}>{item.email}</a>
                        </>
                      ) : null}
                    </td>
                    <td>
                      {[item.landlinePhone, item.mobilePhone].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td>
                      <StatusTag tone={item.status === 'ACTIVE' ? 'success' : 'neutral'}>
                        {item.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
                      </StatusTag>
                    </td>
                    <td className="action-row">
                      {can('catalogs:write') ? (
                        <>
                          <Button className="button-secondary" onClick={() => show(item)}>
                            Editar
                          </Button>
                          <Button className="button-secondary" onClick={() => void toggle(item)}>
                            {item.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                          </Button>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Sin aseguradoras"
            detail="Agregue el primer contacto del directorio."
          />
        )}
      </Panel>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar aseguradora' : 'Nueva aseguradora'}
        description="Estos datos son administrativos y estarán disponibles para el equipo autorizado."
        footer={
          <>
            <Button className="button-secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button form="insurer-form" type="submit">
              Guardar
            </Button>
          </>
        }
      >
        <form className="form-grid" id="insurer-form" onSubmit={save} key={editing?.id ?? 'new'}>
          <label className="full">
            Nombre *<input name="name" defaultValue={editing?.name ?? blankInsurer.name} required />
          </label>
          <label>
            Persona de contacto
            <input name="contactName" defaultValue={editing?.contactName ?? ''} />
          </label>
          <label>
            Correo electrónico
            <input name="email" type="email" defaultValue={editing?.email ?? ''} />
          </label>
          <label>
            Teléfono fijo
            <input name="landlinePhone" defaultValue={editing?.landlinePhone ?? ''} />
          </label>
          <label>
            Teléfono celular
            <input name="mobilePhone" defaultValue={editing?.mobilePhone ?? ''} />
          </label>
          <label className="full">
            Notas
            <textarea
              name="notes"
              rows={4}
              maxLength={2000}
              defaultValue={editing?.notes ?? ''}
              placeholder="Horarios, procesos, ejecutiva asignada u observaciones…"
            />
          </label>
          {error ? (
            <p className="field-error full" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </Dialog>
    </div>
  );
}
