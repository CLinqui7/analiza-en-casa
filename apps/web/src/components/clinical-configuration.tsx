'use client';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Button, Dialog, Panel } from '@analiza/ui';
import {
  clinicalScales,
  configurationEntrySchema,
  scaleDefinitionSchema,
  type ConfigurationEntry,
} from '@analiza/contracts';
import { quoteCategories } from '@analiza/domain';
import { useOperations } from '@/lib/use-operations';
import './clinical-workflow.css';

// Rendering accepts unfinished text while the save boundary remains strict.
const definitionDraftSchema = z.object({
  ...scaleDefinitionSchema.shape,
  version: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      options: z.array(z.object({ label: z.string(), score: z.number() })),
    }),
  ),
});

export function ClinicalConfiguration({ discounts = false }: { discounts?: boolean }) {
  const operations = useOperations();
  const [category, setCategory] = useState<
    'DIAGNOSIS' | 'SCALE' | 'DISCOUNT_PROFILE' | 'MEDICATION_STOCK'
  >(discounts ? 'DISCOUNT_PROFILE' : 'DIAGNOSIS');
  const [editing, setEditing] = useState<ConfigurationEntry | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const scales: ConfigurationEntry[] = clinicalScales.map(
    (scale) =>
      operations.configuration.find(
        (entry) => entry.category === 'SCALE' && entry.scaleDefinition?.id === scale.id,
      ) ?? {
        id: `scale-${scale.id}`,
        category: 'SCALE',
        label: scale.name,
        active: true,
        scaleDefinition: scale,
      },
  );
  const entries = (
    category === 'SCALE'
      ? scales
      : operations.configuration.filter((entry) => entry.category === category)
  ).filter((entry) => entry.label.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')));
  const [definitionJson, setDefinitionJson] = useState('');
  const parsedDefinition = (() => {
    try {
      return definitionDraftSchema.safeParse(JSON.parse(definitionJson));
    } catch {
      return null;
    }
  })();
  const definition = parsedDefinition?.success ? parsedDefinition.data : undefined;
  function edit(entry: ConfigurationEntry) {
    setEditing(entry);
    setError('');
    setDefinitionJson(entry.scaleDefinition ? JSON.stringify(entry.scaleDefinition, null, 2) : '');
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setError('');
    let entry = editing;
    if (category === 'SCALE') {
      try {
        entry = {
          ...editing,
          scaleDefinition: scaleDefinitionSchema.parse(JSON.parse(definitionJson)),
        };
      } catch {
        setError('Revise la definición: identificador, versión, campos y puntuaciones válidas.');
        return;
      }
    }
    const parsed = configurationEntrySchema.safeParse(entry);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (await operations.execute({ command: 'configuration.save', entry: parsed.data })) {
      setEditing(null);
      setMessage(
        'Configuración guardada. Los registros anteriores conservan sus valores y versión.',
      );
    }
  }
  return (
    <div className="page-stack clinical-workflow">
      <header className="clinical-hero">
        <div>
          <p className="eyebrow">Administración · Catálogos</p>
          <h1>{discounts ? 'Descuentos' : 'Diagnósticos y escalas'}</h1>
          <p>El equipo define los datos de trabajo. Cada cambio queda registrado.</p>
        </div>
        {category !== 'SCALE' ? (
          <Button
            onClick={() =>
              edit({
                id: crypto.randomUUID(),
                category,
                label: '',
                active: true,
                ...(category === 'DIAGNOSIS' ? { scaleIds: [] } : { categoryRates: {} }),
              })
            }
          >
            Agregar{' '}
            {category === 'DIAGNOSIS'
              ? 'diagnóstico'
              : category === 'MEDICATION_STOCK'
                ? 'configuración de consumo'
                : 'perfil'}
          </Button>
        ) : null}
      </header>
      {!discounts ? (
        <nav className="clinical-tabs" aria-label="Configuración clínica">
          <button
            aria-current={category === 'DIAGNOSIS' ? 'page' : undefined}
            onClick={() => setCategory('DIAGNOSIS')}
          >
            Diagnósticos
          </button>
          <button
            aria-current={category === 'SCALE' ? 'page' : undefined}
            onClick={() => setCategory('SCALE')}
          >
            Escalas
          </button>
          <button
            aria-current={category === 'MEDICATION_STOCK' ? 'page' : undefined}
            onClick={() => setCategory('MEDICATION_STOCK')}
          >
            Consumo de medicamentos
          </button>
        </nav>
      ) : null}
      {message ? (
        <p className="notice success" role="status">
          {message}
        </p>
      ) : null}
      {operations.error && !editing ? (
        <p className="notice error" role="alert">
          {operations.error}
        </p>
      ) : null}
      <Panel>
        {category === 'MEDICATION_STOCK' ? (
          <p className="notice">
            Defina una vez el origen y las unidades de inventario por aplicación de cada
            medicamento. Se usarán en nuevas aplicaciones; los consumos anteriores conservan su
            configuración.
          </p>
        ) : null}
        <label>
          Buscar
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="clinical-patient-list">
          {entries.map((entry) => (
            <div key={entry.id}>
              <div>
                <strong>{entry.label}</strong>
                <small>
                  {!entry.active
                    ? 'Inactivo'
                    : entry.category === 'DIAGNOSIS'
                      ? entry.scaleIds?.join(', ') || 'Sin vínculos: se muestran todas las escalas'
                      : entry.category === 'SCALE'
                        ? entry.scaleDefinition?.version
                        : entry.category === 'MEDICATION_STOCK'
                          ? `${operations.warehouses.find((w) => w.id === entry.warehouseId)?.name ?? 'Origen no disponible'} · ${entry.unitsPerApplication} unidades por aplicación`
                          : Object.entries(entry.categoryRates ?? {})
                              .map(
                                ([key, rate]) =>
                                  `${quoteCategories.find((category) => category.value === key)?.label}: ${rate}%`,
                              )
                              .join(' · ') || 'Sin porcentajes'}
                </small>
              </div>
              <Button className="button-secondary" onClick={() => edit(entry)}>
                Editar
              </Button>
            </div>
          ))}
        </div>
      </Panel>
      <Dialog
        open={!!editing}
        title={
          category === 'DIAGNOSIS'
            ? 'Diagnóstico'
            : category === 'SCALE'
              ? 'Definición de escala'
              : category === 'MEDICATION_STOCK'
                ? 'Consumo de medicamento'
                : 'Perfil de descuento'
        }
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button className="button-secondary" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button form="clinical-configuration-form" type="submit" disabled={operations.busy}>
              Guardar
            </Button>
          </>
        }
      >
        {editing ? (
          <form id="clinical-configuration-form" className="clinical-editor" onSubmit={submit}>
            {category === 'MEDICATION_STOCK' ? (
              <div className="form-grid">
                <label>
                  Medicamento de inventario
                  <select
                    required
                    value={editing.inventoryItemId ?? ''}
                    disabled={operations.configuration.some((e) => e.id === editing.id)}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        inventoryItemId: event.target.value,
                        label:
                          operations.clinicalStockItems.find((i) => i.id === event.target.value)
                            ?.name ?? '',
                      })
                    }
                  >
                    <option value="">Seleccione medicamento</option>
                    {operations.clinicalStockItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Origen de inventario
                  <select
                    required
                    value={editing.warehouseId ?? ''}
                    onChange={(event) =>
                      setEditing({ ...editing, warehouseId: event.target.value })
                    }
                  >
                    <option value="">Seleccione bodega</option>
                    {operations.warehouses
                      .filter((w) => w.status === 'ACTIVE')
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Unidades de inventario por aplicación
                  <input
                    type="number"
                    required
                    min={1}
                    max={100000}
                    step={1}
                    value={editing.unitsPerApplication ?? ''}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        unitsPerApplication: event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      })
                    }
                  />
                </label>
                <p className="field-help">
                  Registre las unidades que realmente se consumen. La dosis y la cantidad cotizada
                  no determinan este valor.
                </p>
              </div>
            ) : (
              <label>
                Nombre
                <input
                  value={editing.label}
                  required
                  onChange={(event) => setEditing({ ...editing, label: event.target.value })}
                />
              </label>
            )}
            <label>
              Estado
              <select
                disabled={category === 'SCALE'}
                value={String(editing.active)}
                onChange={(event) =>
                  setEditing({ ...editing, active: event.target.value === 'true' })
                }
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </label>
            {category === 'DIAGNOSIS' ? (
              <fieldset>
                <legend>Escalas vinculadas</legend>
                <p className="field-help">
                  Si no selecciona ninguna, se podrán usar todas las escalas.
                </p>
                <div className="clinical-scale-options">
                  {clinicalScales.map((scale) => (
                    <label key={scale.id}>
                      <input
                        type="checkbox"
                        checked={editing.scaleIds?.includes(scale.id) ?? false}
                        onChange={(event) =>
                          setEditing({
                            ...editing,
                            scaleIds: event.target.checked
                              ? [...(editing.scaleIds ?? []), scale.id]
                              : editing.scaleIds?.filter((id) => id !== scale.id),
                          })
                        }
                      />
                      <span>{scale.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            {category === 'DISCOUNT_PROFILE' ? (
              <>
                <p>
                  Ingrese los porcentajes aprobados para cada categoría. Se aplican a la cotización
                  al seleccionar este perfil; puede revisarlos antes de guardar.
                </p>
                <div className="form-grid">
                  {quoteCategories.map((category) => (
                    <label key={category.value}>
                      {category.label} · %
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={editing.categoryRates?.[category.value] ?? ''}
                        onChange={(event) => {
                          const rates = { ...editing.categoryRates };
                          if (event.target.value === '') delete rates[category.value];
                          else rates[category.value] = Number(event.target.value);
                          setEditing({ ...editing, categoryRates: rates });
                        }}
                      />
                    </label>
                  ))}
                </div>
                <label>
                  Reglas y respaldo de la aseguradora
                  <textarea
                    rows={4}
                    value={editing.notes ?? ''}
                    onChange={(event) => setEditing({ ...editing, notes: event.target.value })}
                  />
                </label>
              </>
            ) : null}
            {category === 'SCALE' ? (
              <>
                <p>
                  La definición incluye versión, opciones y puntuaciones. Las evaluaciones guardadas
                  conservan la definición usada al registrarlas.
                </p>
                {definition ? (
                  <>
                    <label>
                      Versión de la definición
                      <input
                        value={definition.version}
                        required
                        onChange={(event) =>
                          setDefinitionJson(
                            JSON.stringify({ ...definition, version: event.target.value }, null, 2),
                          )
                        }
                      />
                    </label>
                    {definition.items.map((item, index) => (
                      <fieldset key={item.id}>
                        <legend>{item.label}</legend>
                        {item.options.map((option, optionIndex) => (
                          <div className="form-grid" key={optionIndex}>
                            <label>
                              Respuesta {optionIndex + 1}
                              <input
                                value={option.label}
                                onChange={(event) =>
                                  setDefinitionJson(
                                    JSON.stringify(
                                      {
                                        ...definition,
                                        items: definition.items.map((current, i) =>
                                          i === index
                                            ? {
                                                ...current,
                                                options: current.options.map((currentOption, j) =>
                                                  j === optionIndex
                                                    ? {
                                                        ...currentOption,
                                                        label: event.target.value,
                                                      }
                                                    : currentOption,
                                                ),
                                              }
                                            : current,
                                        ),
                                      },
                                      null,
                                      2,
                                    ),
                                  )
                                }
                              />
                            </label>
                            <label>
                              Puntos
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={option.score}
                                onChange={(event) =>
                                  setDefinitionJson(
                                    JSON.stringify(
                                      {
                                        ...definition,
                                        items: definition.items.map((current, i) =>
                                          i === index
                                            ? {
                                                ...current,
                                                options: current.options.map((currentOption, j) =>
                                                  j === optionIndex
                                                    ? {
                                                        ...currentOption,
                                                        score: Number(event.target.value),
                                                      }
                                                    : currentOption,
                                                ),
                                              }
                                            : current,
                                        ),
                                      },
                                      null,
                                      2,
                                    ),
                                  )
                                }
                              />
                            </label>
                          </div>
                        ))}
                      </fieldset>
                    ))}
                  </>
                ) : null}
                <label>
                  Cargar definición JSON
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        if (file.size > 200000) {
                          setError('El archivo supera 200 KB.');
                          return;
                        }
                        setDefinitionJson(await file.text());
                      }
                    }}
                  />
                </label>
                <details>
                  <summary>Formato completo de la definición</summary>
                  <label>
                    Definición editable
                    <textarea
                      rows={15}
                      value={definitionJson}
                      onChange={(event) => setDefinitionJson(event.target.value)}
                    />
                  </label>
                </details>
              </>
            ) : null}
            {error || operations.error ? (
              <p className="notice error" role="alert">
                {error || operations.error}
              </p>
            ) : null}
          </form>
        ) : null}
      </Dialog>
    </div>
  );
}
