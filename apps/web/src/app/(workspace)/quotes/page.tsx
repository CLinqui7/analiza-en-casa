'use client';

import type { Quote, QuoteDiscount, QuoteItem, QuoteItemCategory } from '@analiza/contracts';
import { calculateQuoteBalance, calculateQuoteTotals, createQuoteRevision, quoteCategories, searchQuotes, validateQuoteItem } from '@analiza/domain';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useAuth, useWorkspace } from '@/components/providers';

type EditorMode = 'create' | 'edit' | 'revise';
type QuoteDraft = Pick<Quote, 'caseId' | 'summary' | 'comments' | 'items' | 'discount' | 'insurerAmount'> & { revisionReason: string };

const emptyItem = (category: QuoteItemCategory = 'SERVICES'): QuoteItem => ({ id: '', category, name: '', quantity: 1, unitPrice: 0, discountAmount: 0 });
const emptyDraft = (caseId = ''): QuoteDraft => ({ caseId, summary: '', comments: '', items: [], discount: undefined, insurerAmount: 0, revisionReason: '' });
const money = (value: number) => `USD ${value.toFixed(2)}`;
function updatedCategoryPercentages(existing: QuoteDiscount['categories'], category: QuoteItemCategory, value: number): Record<QuoteItemCategory, number> {
  const result: Record<QuoteItemCategory, number> = {
    SERVICES: existing?.SERVICES ?? 0, STUDIES: existing?.STUDIES ?? 0, MEDICATIONS: existing?.MEDICATIONS ?? 0,
    SUPPLIES: existing?.SUPPLIES ?? 0, EQUIPMENT: existing?.EQUIPMENT ?? 0, FEES: existing?.FEES ?? 0, EXTRAS: existing?.EXTRAS ?? 0,
  };
  result[category] = value;
  return result;
}

function cloneDraft(quote: Quote): QuoteDraft {
  return { caseId: quote.caseId, summary: quote.summary, comments: quote.comments ?? '', items: quote.items.map((item) => ({ ...item })), discount: quote.discount ? { ...quote.discount, categories: quote.discount.categories ? { ...quote.discount.categories } : undefined } : undefined, insurerAmount: quote.insurerAmount, revisionReason: '' };
}

function QuoteEditor({ mode, source, open, onClose, onSaved }: { mode: EditorMode; source?: Quote; open: boolean; onClose: () => void; onSaved: (message: string) => void }) {
  const { addQuote, hospitalizations, patients, updateQuote } = useWorkspace();
  const [draft, setDraft] = useState<QuoteDraft>(() => source ? cloneDraft(source) : emptyDraft(hospitalizations[0]?.id));
  const [item, setItem] = useState<QuoteItem>(() => emptyItem());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<QuoteItemCategory>('SERVICES');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totals = useMemo(() => {
    try { return calculateQuoteTotals(draft.items, draft.discount, draft.insurerAmount); }
    catch { return { subtotal: 0, itemDiscountAmount: 0, generalDiscountAmount: 0, discountAmount: 0, total: 0, insurerAmount: 0, patientAmount: 0 }; }
  }, [draft]);
  const selectedCase = hospitalizations.find((candidate) => candidate.id === draft.caseId);
  const selectedPatient = patients.find((candidate) => candidate.id === selectedCase?.patientId);
  const itemError = validateQuoteItem(item);

  function setNumber(key: 'quantity' | 'unitPrice' | 'discountAmount', value: string) { setItem((current) => ({ ...current, [key]: Number(value) })); }
  function addOrUpdateItem() {
    const validation = validateQuoteItem(item);
    if (validation) { setErrors((current) => ({ ...current, item: validation })); return; }
    const persisted = { ...item, id: editingItemId ?? crypto.randomUUID() };
    setDraft((current) => ({ ...current, items: editingItemId ? current.items.map((candidate) => candidate.id === editingItemId ? persisted : candidate) : [...current.items, persisted] }));
    setItem(emptyItem(activeCategory)); setEditingItemId(null); setErrors((current) => ({ ...current, item: '' }));
  }
  function editItem(candidate: QuoteItem) { setItem({ ...candidate }); setEditingItemId(candidate.id); setActiveCategory(candidate.category); setErrors((current) => ({ ...current, item: '' })); }
  function removeItem(id: string) { setDraft((current) => ({ ...current, items: current.items.filter((candidate) => candidate.id !== id) })); }
  function updateDiscount(next: Partial<QuoteDiscount>) { setDraft((current) => ({ ...current, discount: { type: current.discount?.type ?? 'PERCENT', ...current.discount, ...next } })); }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const nextErrors: Record<string, string> = {};
    if (!selectedCase) nextErrors.caseId = 'Seleccione una hospitalización válida.';
    if (!draft.summary.trim()) nextErrors.summary = 'El resumen operativo es obligatorio.';
    if (mode === 'revise' && !draft.revisionReason.trim()) nextErrors.revisionReason = 'El motivo de revisión es obligatorio.';
    try { calculateQuoteTotals(draft.items, draft.discount, draft.insurerAmount); } catch (cause) { nextErrors.totals = cause instanceof Error ? cause.message : 'No fue posible calcular la cotización.'; }
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    const now = new Date().toISOString();
    const common = { caseId: selectedCase!.id, patientId: selectedCase!.patientId, summary: draft.summary.trim(), comments: draft.comments?.trim() || undefined, items: draft.items, discount: draft.discount, insurerAmount: draft.insurerAmount };
    if (mode === 'create') { const id = crypto.randomUUID(); addQuote({ id, ...common, version: 1, status: 'DRAFT', subtotal: 0, discountAmount: 0, total: 0, patientAmount: 0, immutable: false, createdAt: now, originalQuoteId: id, rootQuoteId: id }); onSaved('Borrador de cotización persistido.'); }
    else if (mode === 'edit' && source) { updateQuote({ ...source, ...common }); onSaved('Borrador de cotización actualizado y persistido.'); }
    else if (mode === 'revise' && source) { const revision = createQuoteRevision(source, crypto.randomUUID(), draft.revisionReason, now); addQuote({ ...revision, ...common }); onSaved('Nueva versión de cotización creada como borrador.'); }
  }
  const title = mode === 'create' ? 'Nueva cotización' : mode === 'edit' ? `Editar borrador ${source?.id}` : `Revisar ${source?.id}`;
  const saveAction = mode === 'create' ? 'QUOTE-CREATE-SUBMIT' : mode === 'edit' ? 'QUOTE-EDIT-SUBMIT' : 'QUOTE-REVISE-SUBMIT';
  const cancelAction = mode === 'create' ? 'QUOTE-CREATE-CANCEL' : mode === 'edit' ? 'QUOTE-EDIT-CANCEL' : 'QUOTE-REVISE-CANCEL';
  return <Dialog description="Los importes, descuentos y responsabilidad de seguro son valores manuales de demostración; no se infieren reglas, impuestos ni cobertura." footer={<><Button className="button-secondary" data-action-id={cancelAction} onClick={onClose} type="button">Cancelar</Button><Button data-action-id={saveAction} form="quote-editor-form" type="submit">{mode === 'edit' ? 'Guardar cambios' : mode === 'revise' ? 'Crear revisión' : 'Guardar borrador'}</Button></>} onClose={onClose} open={open} title={title}>
    <form className="form-grid" id="quote-editor-form" noValidate onSubmit={submit}>
      <label>Hospitalización<select disabled={mode !== 'create'} onChange={(event) => setDraft((current) => ({ ...current, caseId: event.target.value }))} value={draft.caseId}>{hospitalizations.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.id} · {patients.find((patient) => patient.id === candidate.patientId)?.fullName ?? 'Paciente no disponible'}</option>)}</select>{errors.caseId ? <span className="field-error">{errors.caseId}</span> : null}</label>
      <label>Paciente derivado<input disabled value={selectedPatient?.fullName ?? 'Seleccione una hospitalización'} /><span className="field-help">El paciente se deriva de la hospitalización seleccionada.</span></label>
      <label>Resumen operativo<textarea onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))} rows={3} value={draft.summary} />{errors.summary ? <span className="field-error">{errors.summary}</span> : null}</label>
      <label>Comentarios<textarea onChange={(event) => setDraft((current) => ({ ...current, comments: event.target.value }))} rows={3} value={draft.comments ?? ''} /></label>
      {mode === 'revise' ? <label className="full-field">Motivo de revisión<textarea onChange={(event) => setDraft((current) => ({ ...current, revisionReason: event.target.value }))} rows={2} value={draft.revisionReason} />{errors.revisionReason ? <span className="field-error">{errors.revisionReason}</span> : null}</label> : null}
      <fieldset className="quote-fieldset full-field"><legend>Constructor por categorías</legend><div className="tabs" role="tablist">{quoteCategories.map((category) => <button aria-selected={activeCategory === category.value} className={`tab ${activeCategory === category.value ? 'active' : ''}`} key={category.value} onClick={() => { setActiveCategory(category.value); setItem((current) => ({ ...current, category: category.value })); }} role="tab" type="button">{category.label}</button>)}</div>
        <div className="form-grid form-grid-compact quote-item-editor"><label>Concepto<input onChange={(event) => setItem((current) => ({ ...current, name: event.target.value }))} value={item.name} /></label><label>Cantidad<input min="0.01" onChange={(event) => setNumber('quantity', event.target.value)} step="0.01" type="number" value={Number.isFinite(item.quantity) ? item.quantity : ''} /></label><label>Precio manual<input min="0" onChange={(event) => setNumber('unitPrice', event.target.value)} step="0.01" type="number" value={Number.isFinite(item.unitPrice) ? item.unitPrice : ''} /></label><label>Descuento manual<input min="0" onChange={(event) => setNumber('discountAmount', event.target.value)} step="0.01" type="number" value={Number.isFinite(item.discountAmount) ? item.discountAmount : ''} /></label><div className="quote-item-total"><span>Subtotal de línea</span><strong>{itemError ? '—' : money(item.quantity * item.unitPrice - item.discountAmount)}</strong></div><div className="quote-item-actions"><Button data-action-id={editingItemId ? 'QUOTE-ITEM-EDIT' : 'QUOTE-ITEM-ADD'} onClick={addOrUpdateItem} type="button">{editingItemId ? 'Actualizar línea' : 'Agregar línea'}</Button>{editingItemId ? <Button className="button-secondary" onClick={() => { setItem(emptyItem(activeCategory)); setEditingItemId(null); }} type="button">Cancelar edición</Button> : null}</div></div>
        {errors.item ? <p className="field-error" role="alert">{errors.item}</p> : null}
        <div className="table-wrap"><table><thead><tr><th>Concepto</th><th>Cantidad</th><th>Precio</th><th>Descuento</th><th>Subtotal</th><th>Acción</th></tr></thead><tbody>{draft.items.filter((candidate) => candidate.category === activeCategory).map((candidate) => <tr key={candidate.id}><td>{candidate.name}</td><td>{candidate.quantity}</td><td>{money(candidate.unitPrice)}</td><td>{money(candidate.discountAmount)}</td><td>{money(candidate.quantity * candidate.unitPrice - candidate.discountAmount)}</td><td><div className="action-row"><Button className="button-secondary" data-action-id="QUOTE-ITEM-EDIT" onClick={() => editItem(candidate)} type="button">Editar</Button><Button className="button-secondary" data-action-id="QUOTE-ITEM-REMOVE" onClick={() => removeItem(candidate.id)} type="button">Eliminar</Button></div></td></tr>)}{!draft.items.some((candidate) => candidate.category === activeCategory) ? <tr><td colSpan={6}>No hay conceptos en esta categoría.</td></tr> : null}</tbody></table></div>
      </fieldset>
      <fieldset className="quote-fieldset full-field"><legend>Descuento general manual</legend><div className="form-grid form-grid-compact"><label>Tipo<select data-action-id="QUOTE-DISCOUNT-UPDATE" onChange={(event) => updateDiscount({ type: event.target.value as QuoteDiscount['type'], value: 0, categories: undefined })} value={draft.discount?.type ?? 'PERCENT'}><option value="PERCENT">Porcentaje</option><option value="FIXED">Monto fijo</option><option value="CATEGORY_PERCENTAGES">Por categoría</option></select></label>{draft.discount?.type !== 'CATEGORY_PERCENTAGES' ? <label>{draft.discount?.type === 'FIXED' ? 'Monto de descuento' : 'Porcentaje de descuento'}<input data-action-id="QUOTE-DISCOUNT-UPDATE" min="0" onChange={(event) => updateDiscount({ value: Number(event.target.value) })} step="0.01" type="number" value={draft.discount?.value ?? 0} /></label> : quoteCategories.map((category) => <label key={category.value}>{category.label} (%)<input data-action-id="QUOTE-DISCOUNT-UPDATE" max="100" min="0" onChange={(event) => updateDiscount({ categories: updatedCategoryPercentages(draft.discount?.categories, category.value, Number(event.target.value)) })} step="0.01" type="number" value={draft.discount?.categories?.[category.value] ?? 0} /></label>)}<label>Responsabilidad explícita de aseguradora<input min="0" onChange={(event) => setDraft((current) => ({ ...current, insurerAmount: Number(event.target.value) }))} step="0.01" type="number" value={draft.insurerAmount} /></label></div></fieldset>
      <section className="quote-totals full-field" aria-label="Totales de cotización"><div><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div><div><span>Descuento</span><strong>{money(totals.discountAmount)}</strong></div><div><span>Total</span><strong>{money(totals.total)}</strong></div><div><span>Aseguradora</span><strong>{money(totals.insurerAmount)}</strong></div><div><span>Paciente</span><strong>{money(totals.patientAmount)}</strong></div></section>{errors.totals ? <p className="field-error full-field" role="alert">{errors.totals}</p> : null}
    </form>
  </Dialog>;
}

export default function QuotesPage() {
  const { patients, payments, quotes } = useWorkspace(); const { can } = useAuth(); const router = useRouter(); const searchParams = useSearchParams();
  const [query, setQuery] = useState(''); const [message, setMessage] = useState<string | null>(null);
  const editId = searchParams.get('edit'); const reviseId = searchParams.get('revise'); const source = quotes.find((quote) => quote.id === (editId ?? reviseId));
  const mode: EditorMode | null = searchParams.get('create') === '1' ? 'create' : editId && source ? 'edit' : reviseId && source ? 'revise' : null;
  const visibleQuotes = searchQuotes(quotes, patients, query);
  function close() { router.push('/quotes'); } function saved(nextMessage: string) { setMessage(nextMessage); router.push('/quotes'); }
  return <div className="page-stack"><header className="page-header page-header-actions"><div><p className="eyebrow">Facturación</p><h1>Cotizaciones</h1><p>Constructor manual con valores sintéticos, versiones inmutables al enviar y responsabilidades explícitas. No se infieren precios, impuestos ni cobertura.</p></div>{can('quotes:write') ? <Button data-action-id="QUOTE-CREATE" onClick={() => router.push('/quotes?create=1')} type="button">Nueva cotización</Button> : null}</header>{message ? <p className="notice success" role="status">{message}</p> : null}<Panel><div className="table-heading"><div><h2>Versiones</h2><p>{quotes.length} registros persistidos</p></div><StatusTag>{visibleQuotes.length} visibles</StatusTag></div><div className="search-row"><label className="search-label">Buscar cotización<input data-action-id="QUOTE-SEARCH" onChange={(event) => setQuery(event.target.value)} placeholder="ID, paciente, caso o estado" value={query} /></label>{query ? <Button className="button-secondary" data-action-id="QUOTE-SEARCH-CLEAR" onClick={() => setQuery('')} type="button">Limpiar búsqueda</Button> : null}</div>{visibleQuotes.length ? <div className="table-wrap"><table><thead><tr><th>Cotización</th><th>Paciente / caso</th><th>Creación</th><th>Subtotal</th><th>Seguro</th><th>Paciente</th><th>Saldo</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{visibleQuotes.map((quote) => { const balance = calculateQuoteBalance(quote, payments); return <tr key={quote.id}><td>{quote.id}<br /><small>v{quote.version}</small></td><td>{patients.find((patient) => patient.id === quote.patientId)?.fullName ?? 'No disponible'}<br /><small>{quote.caseId}</small></td><td>{new Date(quote.createdAt).toLocaleString('es-SV')}</td><td>{money(quote.subtotal)}</td><td>{money(quote.insurerAmount)}</td><td>{money(quote.patientAmount)}</td><td>{money(balance.balance)}</td><td><StatusTag tone={quote.immutable ? 'success' : 'warning'}>{quote.immutable ? 'Enviada' : 'Borrador'}</StatusTag></td><td><Link data-action-id="QUOTE-DETAIL-NAVIGATE" href={`/quotes/${quote.id}`}>Consultar</Link></td></tr>; })}</tbody></table></div> : <EmptyState detail={query ? 'Pruebe otro ID, paciente, caso o estado.' : 'Cree una cotización para comenzar.'} title={query ? 'Sin resultados' : 'Sin cotizaciones'} />}</Panel>{mode ? <QuoteEditor key={`${mode}-${source?.id ?? 'new'}`} mode={mode} onClose={close} onSaved={saved} open source={source} /> : null}</div>;
}
