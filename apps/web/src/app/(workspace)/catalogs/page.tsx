'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { CatalogItem } from '@analiza/contracts';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth, useWorkspace } from '@/components/providers';

const itemSchema = z.object({ sku: z.string().trim().min(1, 'El SKU es obligatorio.'), name: z.string().trim().min(1, 'El nombre es obligatorio.') });
type ItemForm = z.infer<typeof itemSchema>;

export default function CatalogsPage() {
  const { addCatalogItem, catalogItems } = useWorkspace();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<ItemForm>({ resolver: zodResolver(itemSchema), defaultValues: { sku: '', name: '' } });
  function close() { setOpen(false); form.reset(); }
  function submit(values: ItemForm) {
    if (catalogItems.some((item) => item.sku.toLocaleUpperCase('es') === values.sku.toLocaleUpperCase('es'))) { form.setError('sku', { type: 'duplicate', message: 'Ya existe un ítem con este SKU.' }); return; }
    const item: CatalogItem = { id: crypto.randomUUID(), sku: values.sku.toLocaleUpperCase('es'), name: values.name, status: 'ACTIVE', createdAt: new Date().toISOString() };
    addCatalogItem(item); setMessage('Ítem de catálogo persistido con evidencia de auditoría.'); close();
  }
  return <div className="page-stack"><header className="page-header page-header-actions"><div><p className="eyebrow">Inventario</p><h1>Catálogos</h1><p>Ítems sintéticos con SKU único. No se definen precios, descuentos, impuestos, proveedor ni disponibilidad sin reglas aprobadas.</p></div>{can('catalogs:write') ? <Button data-action-id="CATALOG-CREATE" onClick={() => { setMessage(null); setOpen(true); }} type="button">Nuevo ítem</Button> : null}</header>{message ? <p className="notice success" role="status">{message}</p> : null}<Panel><div className="table-heading"><h2>Ítems</h2><StatusTag>{catalogItems.length} registros</StatusTag></div>{catalogItems.length ? <div className="table-wrap"><table><thead><tr><th>SKU</th><th>Nombre</th><th>Estado</th><th>Creación</th></tr></thead><tbody>{catalogItems.map((item) => <tr key={item.id}><td><code>{item.sku}</code></td><td>{item.name}</td><td>{item.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</td><td>{new Date(item.createdAt).toLocaleString('es-SV')}</td></tr>)}</tbody></table></div> : <EmptyState detail="Cree un ítem sintético para comenzar." title="Sin ítems" />}</Panel><Dialog description="El SKU se valida como único dentro del proveedor de datos activo. Los demás atributos requieren reglas de catálogo aprobadas." footer={<><Button className="button-secondary" onClick={close} type="button">Cancelar</Button><Button form="catalog-item-form" type="submit">Guardar ítem</Button></>} onClose={close} open={open} title="Nuevo ítem de catálogo"><form className="form-grid" id="catalog-item-form" noValidate onSubmit={form.handleSubmit(submit)}><label>SKU<input {...form.register('sku')} />{form.formState.errors.sku ? <span className="field-error">{form.formState.errors.sku.message}</span> : null}</label><label>Nombre<input {...form.register('name')} />{form.formState.errors.name ? <span className="field-error">{form.formState.errors.name.message}</span> : null}</label></form></Dialog></div>;
}
