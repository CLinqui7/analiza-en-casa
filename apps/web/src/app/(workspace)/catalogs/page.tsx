'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { CatalogItem } from '@analiza/contracts';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useAuth, useWorkspace } from '@/components/providers';

const categories = [
  ['SERVICES', 'Servicios', 'SER'],
  ['LABORATORY', 'Analiza Lab', 'LAB'],
  ['PHYSIOTHERAPY', 'Analiza Fisio', 'FIS'],
  ['IMAGING', 'Analiza Imágenes', 'IMG'],
  ['MEDICATIONS', 'Medicamentos', 'MED'],
  ['SUPPLIES', 'Insumos', 'INS'],
  ['EQUIPMENT', 'Equipos', 'EQU'],
  ['PROVIDERS', 'Proveedores', 'PRO'],
] as const;
type Category = (typeof categories)[number][0];
const isCategory = (value: CatalogItem['category']): value is Category =>
  categories.some(([category]) => category === value);
const itemSchema = z.object({
  category: z.enum([
    'SERVICES',
    'LABORATORY',
    'PHYSIOTHERAPY',
    'IMAGING',
    'MEDICATIONS',
    'SUPPLIES',
    'EQUIPMENT',
    'PROVIDERS',
  ]),
  name: z.string().trim().min(1, 'El nombre es obligatorio.'),
  costPrice: z.number().finite().nonnegative('El costo no puede ser negativo.'),
  salePriceExcludingTax: z
    .number()
    .finite()
    .nonnegative('El precio de venta no puede ser negativo.'),
});
type ItemForm = z.infer<typeof itemSchema>;

export default function CatalogsPage() {
  const { addCatalogItem, catalogItems } = useWorkspace();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>('SERVICES');
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<ItemForm>({
    resolver: zodResolver(itemSchema),
    defaultValues: { category: 'SERVICES', name: '', costPrice: 0, salePriceExcludingTax: 0 },
  });
  const selectedCategory = useWatch({ control: form.control, name: 'category' });
  const visibleItems = useMemo(
    () => catalogItems.filter((item) => (item.category ?? 'SUPPLIES') === activeCategory),
    [activeCategory, catalogItems],
  );
  function nextSku(category: Category) {
    const prefix = categories.find(([value]) => value === category)?.[2] ?? 'CAT';
    const numbers = catalogItems
      .filter((item) => item.sku.startsWith(`${prefix}-`))
      .map((item) => Number(item.sku.slice(prefix.length + 1)))
      .filter(Number.isFinite);
    return `${prefix}-${String(Math.max(0, ...numbers) + 1).padStart(4, '0')}`;
  }
  function close() {
    setOpen(false);
    setEditing(null);
    form.reset({
      category: activeCategory,
      name: '',
      costPrice: 0,
      salePriceExcludingTax: 0,
    });
  }
  function create(category: Category = activeCategory) {
    setMessage(null);
    setEditing(null);
    form.reset({ category, name: '', costPrice: 0, salePriceExcludingTax: 0 });
    setOpen(true);
  }
  function edit(item: CatalogItem) {
    setMessage(null);
    setEditing(item);
    form.reset({
      category: isCategory(item.category) ? item.category : 'SUPPLIES',
      name: item.name,
      costPrice: item.costPrice ?? 0,
      salePriceExcludingTax: item.salePriceExcludingTax ?? 0,
    });
    setOpen(true);
  }
  async function save(values: ItemForm) {
    const item: CatalogItem = {
      id: editing?.id ?? crypto.randomUUID(),
      sku: editing?.sku ?? nextSku(values.category),
      name: values.name.trim(),
      category: values.category,
      status: editing?.status ?? 'ACTIVE',
      createdAt: editing?.createdAt ?? new Date().toISOString(),
      costPrice: values.costPrice,
      salePriceExcludingTax: values.salePriceExcludingTax,
    };
    if (!(await addCatalogItem(item))) {
      form.setError('root', {
        message: 'No se pudo guardar. Revise la conexión e inténtelo nuevamente.',
      });
      return;
    }
    setActiveCategory(values.category);
    setMessage(`${item.name} fue ${editing ? 'actualizado' : 'creado'} correctamente.`);
    close();
  }
  async function toggle(item: CatalogItem) {
    if (
      !(await addCatalogItem({ ...item, status: item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }))
    )
      return;
    setMessage(`${item.name} quedó ${item.status === 'ACTIVE' ? 'inactivo' : 'activo'}.`);
  }

  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Catálogo general</h1>
          <p>
            Cree, edite, active o desactive los conceptos disponibles en cotizaciones e inventario.
          </p>
        </div>
        {can('catalogs:write') ? <Button onClick={() => create()}>Nuevo ítem</Button> : null}
      </header>
      <div className="card-grid">
        {categories.map(([value, label]) => (
          <button
            aria-pressed={activeCategory === value}
            className={`panel catalog-category-card${activeCategory === value ? ' active' : ''}`}
            key={value}
            onClick={() => setActiveCategory(value)}
            type="button"
          >
            <strong>{label}</strong>
            <small>
              {catalogItems.filter((item) => (item.category ?? 'SUPPLIES') === value).length}{' '}
              registros
            </small>
          </button>
        ))}
      </div>
      <p>
        <Link href="/catalogs/operational">Administrar especialidades, dosis y aseguradoras</Link>
      </p>
      {message ? (
        <p className="notice success" role="status">
          {message}
        </p>
      ) : null}
      <Panel>
        <div className="table-heading">
          <h2>{categories.find(([value]) => value === activeCategory)?.[1]}</h2>
          <StatusTag>{visibleItems.length} registros</StatusTag>
        </div>
        {visibleItems.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Costo</th>
                  <th>Venta sin IVA</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <code>{item.sku}</code>
                    </td>
                    <td>{item.name}</td>
                    <td>USD {(item.costPrice ?? 0).toFixed(2)}</td>
                    <td>USD {(item.salePriceExcludingTax ?? 0).toFixed(2)}</td>
                    <td>
                      <StatusTag tone={item.status === 'ACTIVE' ? 'success' : 'neutral'}>
                        {item.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                      </StatusTag>
                    </td>
                    <td className="action-row">
                      {can('catalogs:write') ? (
                        <>
                          <Button className="button-secondary" onClick={() => edit(item)}>
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
          <EmptyState detail="Cree el primer registro de esta categoría." title="Sin registros" />
        )}
      </Panel>
      <Dialog
        description="El código se genera automáticamente y no cambia al editar."
        footer={
          <>
            <Button className="button-secondary" onClick={close}>
              Cancelar
            </Button>
            <Button form="catalog-item-form" type="submit">
              Guardar
            </Button>
          </>
        }
        onClose={close}
        open={open}
        title={editing ? 'Editar ítem' : 'Nuevo ítem'}
      >
        <form className="form-grid" id="catalog-item-form" onSubmit={form.handleSubmit(save)}>
          {form.formState.errors.root ? (
            <p className="field-error full" role="alert">
              {form.formState.errors.root.message}
            </p>
          ) : null}
          <label>
            Categoría
            <select {...form.register('category')} disabled={Boolean(editing)}>
              {categories.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Código automático
            <input readOnly value={editing?.sku ?? nextSku(selectedCategory)} />
          </label>
          <label className="full">
            Nombre
            <input {...form.register('name')} />
            {form.formState.errors.name ? (
              <span className="field-error">{form.formState.errors.name.message}</span>
            ) : null}
          </label>
          <label>
            Precio de costo
            <input
              min="0"
              step="0.01"
              type="number"
              {...form.register('costPrice', { valueAsNumber: true })}
            />
            {form.formState.errors.costPrice ? (
              <span className="field-error">{form.formState.errors.costPrice.message}</span>
            ) : null}
          </label>
          <label>
            Precio de venta sin IVA
            <input
              min="0"
              step="0.01"
              type="number"
              {...form.register('salePriceExcludingTax', { valueAsNumber: true })}
            />
            {form.formState.errors.salePriceExcludingTax ? (
              <span className="field-error">
                {form.formState.errors.salePriceExcludingTax.message}
              </span>
            ) : null}
          </label>
        </form>
      </Dialog>
    </div>
  );
}
