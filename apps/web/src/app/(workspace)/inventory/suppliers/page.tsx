'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { catalogItemSchema, type CatalogItem } from '@analiza/contracts';
import { useAuth, useWorkspace } from '@/components/providers';

export default function SuppliersPage() {
  const { catalogItems, addCatalogItem } = useWorkspace();
  const { can } = useAuth();
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<CatalogItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const suppliers = catalogItems.filter((item) => item.category === 'PROVIDERS');
  const visible = suppliers.filter((item) =>
    `${item.name} ${item.sku} ${item.contactName ?? ''} ${item.email ?? ''}`
      .toLocaleLowerCase('es')
      .includes(query.trim().toLocaleLowerCase('es')),
  );
  function create() {
    setError('');
    setDraft({
      id: crypto.randomUUID(),
      sku: `PRO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      name: '',
      category: 'PROVIDERS',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    });
  }
  async function save() {
    if (!draft || busy) return;
    const parsed = catalogItemSchema.safeParse(draft);
    if (!parsed.success) {
      setError('Revise el nombre y el formato del correo electrónico.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (!(await addCatalogItem(parsed.data))) throw new Error();
      setMessage('Proveedor guardado. Ya está disponible en compras y órdenes a proveedores.');
      setDraft(null);
    } catch {
      setError('No se pudo guardar el proveedor. Revise la conexión y reintente.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-stack suppliers-page">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Inventario y compras · Existencias</p>
          <h1>Proveedores</h1>
          <p>Contactos de compra, en un solo directorio para todo el equipo.</p>
        </div>
        <div className="action-row">
          <Link className="button button-secondary" href="/inventory">
            Volver a existencias
          </Link>
          {can('catalogs:write') ? (
            <Button onClick={create} data-action-id="INVENTORY-SUPPLIERS-CREATE">
              Nuevo proveedor
            </Button>
          ) : null}
        </div>
      </header>
      {message ? (
        <p className="notice success" role="status">
          {message}
        </p>
      ) : null}
      <Panel>
        <div className="table-heading">
          <label>
            Buscar proveedor
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Empresa, código, contacto o correo"
            />
          </label>
          <StatusTag>{visible.length} proveedores</StatusTag>
        </div>
      </Panel>
      {visible.length ? (
        <div className="supplier-grid">
          {visible.map((item) => (
            <Panel key={item.id} className="supplier-card">
              <div className="page-header-actions">
                <span className="eyebrow">{item.sku}</span>
                <StatusTag tone={item.status === 'ACTIVE' ? 'success' : 'neutral'}>
                  {item.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                </StatusTag>
              </div>
              <h2>{item.name}</h2>
              <dl className="definition-list">
                <div>
                  <dt>Contacto</dt>
                  <dd>{item.contactName || 'Sin registrar'}</dd>
                </div>
                <div>
                  <dt>Teléfonos</dt>
                  <dd>
                    {[item.landlinePhone, item.mobilePhone].filter(Boolean).join(' · ') ||
                      'Sin registrar'}
                  </dd>
                </div>
                <div>
                  <dt>Correo</dt>
                  <dd>{item.email || 'Sin registrar'}</dd>
                </div>
                <div>
                  <dt>Dirección y notas</dt>
                  <dd>{item.notes || 'Sin registrar'}</dd>
                </div>
              </dl>
              {can('catalogs:write') ? (
                <Button
                  className="button-secondary"
                  onClick={() => {
                    setError('');
                    setDraft({ ...item });
                  }}
                >
                  Editar proveedor
                </Button>
              ) : null}
            </Panel>
          ))}
        </div>
      ) : (
        <EmptyState title="Sin proveedores" detail="Registre un proveedor o ajuste su búsqueda." />
      )}
      <Dialog
        open={Boolean(draft)}
        onClose={() => {
          if (!busy) setDraft(null);
        }}
        title={
          draft && suppliers.some((item) => item.id === draft.id)
            ? 'Editar proveedor'
            : 'Nuevo proveedor'
        }
        footer={
          <>
            <Button className="button-secondary" disabled={busy} onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button disabled={busy} form="supplier-form" type="submit">
              {busy ? 'Guardando…' : 'Guardar proveedor'}
            </Button>
          </>
        }
      >
        {draft ? (
          <form
            className="form-grid"
            id="supplier-form"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            {error ? (
              <p className="notice danger full-field" role="alert">
                {error}
              </p>
            ) : null}
            <label className="full-field">
              Empresa / nombre
              <input
                required
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </label>
            {(
              [
                ['contactName', 'Contacto'],
                ['landlinePhone', 'Teléfono fijo'],
                ['mobilePhone', 'Teléfono celular'],
                ['email', 'Correo'],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type={key === 'email' ? 'email' : 'text'}
                  value={draft[key] ?? ''}
                  onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                />
              </label>
            ))}
            <label>
              Estado
              <select
                value={draft.status}
                onChange={(event) =>
                  setDraft({ ...draft, status: event.target.value as 'ACTIVE' | 'INACTIVE' })
                }
              >
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
              </select>
            </label>
            <label className="full-field">
              Dirección y notas
              <textarea
                maxLength={2000}
                rows={3}
                value={draft.notes ?? ''}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              />
            </label>
          </form>
        ) : null}
      </Dialog>
    </div>
  );
}
