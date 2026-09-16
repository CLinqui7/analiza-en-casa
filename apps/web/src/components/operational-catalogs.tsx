'use client';
import { useState, type FormEvent } from 'react';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { configurationCategories, type ConfigurationEntry } from '@analiza/contracts';
import { useAuth, useWorkspace } from './providers';
import { useOperations } from '@/lib/use-operations';

export const categoryLabels = {
  SPECIALTY: 'Especialidades médicas',
  DOSE: 'Dosis registradas',
  INSURER: 'Seguros y descuentos',
  MEDICATION: 'Medicamentos y presentaciones',
};
export function OperationalCatalogs() {
  const operations = useOperations();
  const { can } = useAuth();
  const { catalogItems } = useWorkspace();
  const [category, setCategory] = useState<ConfigurationEntry['category']>('SPECIALTY');
  const [editing, setEditing] = useState<ConfigurationEntry | null>(null);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const entries = operations.configuration.filter(
    (entry) =>
      entry.category === category && entry.label.toLowerCase().includes(query.toLowerCase()),
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    if (await operations.execute({ command: 'configuration.save', entry: editing })) {
      setEditing(null);
      setMessage('Catálogo guardado en la base de datos.');
    }
  }
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Analiza en Casa</p>
          <h1>Catálogos operativos</h1>
          <p>Opciones compartidas para el equipo. Los valores los define la persona encargada.</p>
        </div>
        {can('catalogs:write') ? (
          <Button
            data-action-id="CONFIGURATION-CREATE"
            onClick={() => {
              setMessage('');
              setEditing({ id: crypto.randomUUID(), category, label: '', active: true });
            }}
          >
            + Agregar opción
          </Button>
        ) : null}
      </header>
      <div className="card-grid">
        {configurationCategories.map((key) => (
          <button
            className={`panel catalog-category-card${category === key ? ' selected' : ''}`}
            key={key}
            onClick={() => setCategory(key)}
          >
            <span aria-hidden="true">
              {key === 'INSURER' ? '✓' : key === 'MEDICATION' ? '⊞' : '＋'}
            </span>
            <strong>{categoryLabels[key]}</strong>
            <small>
              {operations.configuration.filter((item) => item.category === key).length} opciones
            </small>
          </button>
        ))}
      </div>
      <Panel className="studio-toolbar">
        <input
          aria-label="Buscar opción"
          placeholder="Buscar en el catálogo"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <span>{entries.length} resultados</span>
      </Panel>
      {message ? (
        <p className="notice success" role="status">
          {message}
        </p>
      ) : null}
      {operations.error ? (
        <p className="notice" role="alert">
          {operations.error}
        </p>
      ) : null}
      <Panel>
        <div className="table-heading">
          <h2>{categoryLabels[category]}</h2>
        </div>
        {entries.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Opción</th>
                  <th>Configuración</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <strong>{entry.label}</strong>
                    </td>
                    <td>
                      {entry.category === 'INSURER'
                        ? `${entry.discountPercent ?? 0}% registrado`
                        : entry.category === 'MEDICATION'
                          ? `Blíster: ${entry.tabletsPerBlister ?? '—'} tabletas · Caja: ${entry.tabletsPerBox ?? '—'} tabletas`
                          : 'Selección del catálogo'}
                    </td>
                    <td>
                      <StatusTag tone={entry.active ? 'success' : 'neutral'}>
                        {entry.active ? 'Activo' : 'Inactivo'}
                      </StatusTag>
                    </td>
                    <td>
                      {can('catalogs:write') ? (
                        <Button className="button-secondary" onClick={() => setEditing(entry)}>
                          Editar
                        </Button>
                      ) : (
                        'Lectura'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Sin opciones registradas"
            detail="La encargada puede agregar opciones; aparecerán en los formularios del equipo."
          />
        )}
      </Panel>
      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? categoryLabels[editing.category] : ''}
        description="Registre únicamente valores aprobados por su organización; no se sugieren dosis ni coberturas."
        footer={
          <>
            <Button className="button-secondary" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button form="configuration-form" type="submit" disabled={operations.busy}>
              Guardar opción
            </Button>
          </>
        }
      >
        {editing ? (
          <form id="configuration-form" className="form-grid" onSubmit={submit}>
            <label className="full">
              Nombre / descripción
              <input
                required
                value={editing.label}
                onChange={(event) => setEditing({ ...editing, label: event.target.value })}
              />
            </label>
            {editing.category === 'INSURER' ? (
              <label>
                Descuento registrado (%)
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  step="0.01"
                  value={editing.discountPercent ?? ''}
                  onChange={(event) =>
                    setEditing({ ...editing, discountPercent: Number(event.target.value) })
                  }
                />
                <span className="field-help">
                  No sustituye la aprobación individual de una cotización.
                </span>
              </label>
            ) : null}
            {editing.category === 'MEDICATION' ? (
              <>
                <label className="full">
                  Artículo del inventario
                  <select
                    required
                    value={editing.inventoryItemId ?? ''}
                    onChange={(event) =>
                      setEditing({ ...editing, inventoryItemId: event.target.value })
                    }
                  >
                    <option value="">Seleccionar artículo</option>
                    {catalogItems
                      .filter((item) => item.status === 'ACTIVE')
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.sku} · {item.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Tabletas por blíster
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={editing.tabletsPerBlister ?? ''}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        tabletsPerBlister: event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      })
                    }
                  />
                </label>
                <label>
                  Tabletas por caja
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={editing.tabletsPerBox ?? ''}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        tabletsPerBox: event.target.value ? Number(event.target.value) : undefined,
                      })
                    }
                  />
                </label>
              </>
            ) : null}
            <label>
              Estado
              <select
                value={String(editing.active)}
                onChange={(event) =>
                  setEditing({ ...editing, active: event.target.value === 'true' })
                }
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </label>
            {operations.error ? (
              <p className="field-error full" role="alert">
                {operations.error}
              </p>
            ) : null}
          </form>
        ) : null}
      </Dialog>
    </div>
  );
}
