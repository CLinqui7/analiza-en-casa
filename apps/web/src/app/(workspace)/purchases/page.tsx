'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Purchase } from '@analiza/contracts';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth, useWorkspace } from '@/components/providers';

const purchaseFormSchema = z.object({ catalogItemId: z.string().min(1, 'Seleccione un ítem de catálogo.'), reference: z.string().trim().min(1, 'Ingrese una referencia de compra.'), note: z.string().trim() });
type PurchaseForm = z.infer<typeof purchaseFormSchema>;

export default function PurchasesPage() {
  const { addPurchase, catalogItems, purchases } = useWorkspace();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<PurchaseForm>({ resolver: zodResolver(purchaseFormSchema), defaultValues: { catalogItemId: catalogItems[0]?.id ?? '', reference: '', note: '' } });
  function close() { setOpen(false); form.reset({ catalogItemId: catalogItems[0]?.id ?? '', reference: '', note: '' }); }
  function submit(values: PurchaseForm) {
    if (!catalogItems.some((item) => item.id === values.catalogItemId)) { form.setError('catalogItemId', { type: 'validate', message: 'El ítem de catálogo no está disponible.' }); return; }
    const purchase: Purchase = { id: crypto.randomUUID(), catalogItemId: values.catalogItemId, reference: values.reference, note: values.note || undefined, status: 'DRAFT', createdAt: new Date().toISOString() };
    addPurchase(purchase); setMessage('Compra sintética guardada como borrador con evidencia de auditoría.'); close();
  }
  return <div className="page-stack"><header className="page-header page-header-actions"><div><p className="eyebrow">Inventario</p><h1>Compras</h1><p>Borradores sintéticos referenciados a catálogo. No crea recepción, stock, proveedor, factura, costo, impuestos ni estados financieros sin reglas aprobadas.</p></div>{can('purchases:write') ? <Button data-action-id="PURCHASE-CREATE" disabled={!catalogItems.length} onClick={() => { setMessage(null); setOpen(true); }} type="button">Nueva compra</Button> : null}</header>{message ? <p className="notice success" role="status">{message}</p> : null}{!catalogItems.length ? <p className="notice" role="status">Cree primero un ítem de catálogo sintético.</p> : null}<Panel><div className="table-heading"><h2>Borradores</h2><StatusTag>{purchases.length} registros</StatusTag></div>{purchases.length ? <div className="table-wrap"><table><thead><tr><th>Referencia</th><th>Ítem</th><th>Estado</th><th>Nota</th><th>Creación</th></tr></thead><tbody>{purchases.map((purchase) => <tr key={purchase.id}><td><code>{purchase.reference}</code></td><td>{catalogItems.find((item) => item.id === purchase.catalogItemId)?.name ?? 'No disponible'}</td><td>Borrador</td><td>{purchase.note ?? '—'}</td><td>{new Date(purchase.createdAt).toLocaleString('es-SV')}</td></tr>)}</tbody></table></div> : <EmptyState detail="Cree un borrador desde un ítem de catálogo." title="Sin compras" />}</Panel><Dialog description="Este registro no ejecuta una recepción ni cambia inventario. Esas transiciones requieren reglas aprobadas e idempotencia adicional." footer={<><Button className="button-secondary" onClick={close} type="button">Cancelar</Button><Button form="purchase-form" type="submit">Guardar borrador</Button></>} onClose={close} open={open} title="Nueva compra sintética"><form className="form-grid" id="purchase-form" noValidate onSubmit={form.handleSubmit(submit)}><label>Ítem de catálogo<select {...form.register('catalogItemId')}>{catalogItems.map((item) => <option key={item.id} value={item.id}>{item.sku} · {item.name}</option>)}</select>{form.formState.errors.catalogItemId ? <span className="field-error">{form.formState.errors.catalogItemId.message}</span> : null}</label><label>Referencia de compra<input {...form.register('reference')} />{form.formState.errors.reference ? <span className="field-error">{form.formState.errors.reference.message}</span> : null}</label><label>Nota (opcional)<textarea {...form.register('note')} rows={3} /></label></form></Dialog></div>;
}
