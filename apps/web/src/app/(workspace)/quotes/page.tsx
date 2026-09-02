'use client';

import type { Quote, QuoteDiscount, QuoteItem, QuoteItemCategory } from '@analiza/contracts';
import {
  calculateQuoteBalance,
  calculateQuoteTotals,
  createQuoteRevision,
  filterQuotes,
  quoteCategories,
  searchPatients,
  searchQuotes,
  validateQuoteItem,
} from '@analiza/domain';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useAuth, useWorkspace } from '@/components/providers';

type EditorMode = 'create' | 'edit' | 'revise';
type QuoteDraft = Pick<
  Quote,
  | 'caseId'
  | 'summary'
  | 'comments'
  | 'items'
  | 'discount'
  | 'insurerAmount'
  | 'invoiceDate'
  | 'discountGroup'
  | 'referralLabel'
  | 'referralSelections'
  | 'giftCardCode'
> & { revisionReason: string; patientId: string; patientQuery: string; referralQuery: string };

const emptyItem = (category: QuoteItemCategory = 'SERVICES'): QuoteItem => ({
  id: '',
  category,
  name: '',
  quantity: 0,
  unitPrice: 0,
  discountAmount: 0,
});
const emptyDraft = (caseId = '', patientId = ''): QuoteDraft => ({
  caseId,
  patientId,
  patientQuery: '',
  referralQuery: '',
  summary: '',
  comments: '',
  invoiceDate: new Date().toISOString().slice(0, 10),
  discountGroup: 'Regular',
  referralLabel: '',
  referralSelections: [],
  giftCardCode: '',
  items: [],
  discount: undefined,
  insurerAmount: 0,
  revisionReason: '',
});
const referralCatalog = [
  'Amigos & Familia',
  'Publicidad del Panel',
  'Redes Sociales',
  'Paciente recurrente',
  'Dr. Jorge Contreras',
];
type CatalogEntry = { id: string; label: string; inventoryAvailable: boolean };
const serviceCatalog: CatalogEntry[] = [
  {
    id: 'service-demo-available',
    label: 'Servicio sintético disponible',
    inventoryAvailable: true,
  },
  {
    id: 'service-demo-unavailable',
    label: 'Servicio sintético sin disponibilidad configurada',
    inventoryAvailable: false,
  },
];
const medicationCatalog: CatalogEntry[] = [
  {
    id: 'medication-demo-available',
    label: 'Medicamento sintético disponible',
    inventoryAvailable: true,
  },
  {
    id: 'medication-demo-unavailable',
    label: 'Medicamento sintético sin disponibilidad configurada',
    inventoryAvailable: false,
  },
];
const supplyCatalog: CatalogEntry[] = [
  {
    id: 'supply-demo-available',
    label: 'INS-SYN-001 | Insumo sintético disponible — Fabricante sintético (1)',
    inventoryAvailable: true,
  },
  {
    id: 'supply-demo-unavailable',
    label:
      'INS-SYN-002 | Insumo sintético sin disponibilidad configurada — Fabricante sintético (0)',
    inventoryAvailable: false,
  },
];
const studyCatalog: CatalogEntry[] = [
  {
    id: 'study-demo-available',
    label: 'Estudio sintético de hemoglobina disponible',
    inventoryAvailable: true,
  },
  {
    id: 'study-demo-unavailable',
    label: 'Estudio sintético sin disponibilidad configurada',
    inventoryAvailable: false,
  },
];
const feeServiceCatalog: CatalogEntry[] = [
  { id: 'fee-demo-follow-up', label: 'Seguimiento sintético disponible', inventoryAvailable: true },
];
const businessPartners = ['Socio sintético A', 'Socio sintético B'];
const money = (value: number) => `USD ${value.toFixed(2)}`;
function updatedCategoryPercentages(
  existing: QuoteDiscount['categories'],
  category: QuoteItemCategory,
  value: number,
): Record<QuoteItemCategory, number> {
  const result: Record<QuoteItemCategory, number> = {
    SERVICES: existing?.SERVICES ?? 0,
    STUDIES: existing?.STUDIES ?? 0,
    MEDICATIONS: existing?.MEDICATIONS ?? 0,
    SUPPLIES: existing?.SUPPLIES ?? 0,
    EQUIPMENT: existing?.EQUIPMENT ?? 0,
    FEES: existing?.FEES ?? 0,
    EXTRAS: existing?.EXTRAS ?? 0,
  };
  result[category] = value;
  return result;
}

function cloneDraft(quote: Quote): QuoteDraft {
  return {
    caseId: quote.caseId,
    patientId: quote.patientId,
    patientQuery: '',
    referralQuery: quote.referralLabel ?? '',
    summary: quote.summary,
    comments: quote.comments ?? '',
    invoiceDate: quote.invoiceDate ?? quote.createdAt.slice(0, 10),
    discountGroup: quote.discountGroup ?? 'Regular',
    referralLabel: quote.referralLabel ?? '',
    referralSelections: quote.referralSelections ?? [],
    giftCardCode: quote.giftCardCode ?? '',
    items: quote.items.map((item) => ({ ...item })),
    discount: quote.discount
      ? {
          ...quote.discount,
          categories: quote.discount.categories ? { ...quote.discount.categories } : undefined,
        }
      : undefined,
    insurerAmount: quote.insurerAmount,
    revisionReason: '',
  };
}

function QuoteEditor({
  mode,
  source,
  open,
  onClose,
  onSaved,
}: {
  mode: EditorMode;
  source?: Quote;
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { addQuote, doctors, hospitalizations, patients, updateQuote } = useWorkspace();
  const [draft, setDraft] = useState<QuoteDraft>(() =>
    source
      ? cloneDraft(source)
      : emptyDraft(
          hospitalizations[0]?.id,
          hospitalizations[0]
            ? patients.find((patient) => patient.id === hospitalizations[0].patientId)?.id
            : '',
        ),
  );
  const [item, setItem] = useState<QuoteItem>(() => emptyItem());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<QuoteItemCategory>('SERVICES');
  const [inventoryOnly, setInventoryOnly] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [processingItem, setProcessingItem] = useState(false);
  const [referralCatalogOpen, setReferralCatalogOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totals = useMemo(() => {
    try {
      return calculateQuoteTotals(draft.items, draft.discount, draft.insurerAmount);
    } catch {
      return {
        subtotal: 0,
        itemDiscountAmount: 0,
        generalDiscountAmount: 0,
        discountAmount: 0,
        total: 0,
        insurerAmount: 0,
        patientAmount: 0,
      };
    }
  }, [draft]);
  const selectedCase = hospitalizations.find(
    (candidate) => candidate.id === draft.caseId && candidate.patientId === draft.patientId,
  );
  const selectedPatient = patients.find((candidate) => candidate.id === draft.patientId);
  const compatibleCases = hospitalizations.filter(
    (candidate) => !draft.patientId || candidate.patientId === draft.patientId,
  );
  const patientOptions = searchPatients(patients, draft.patientQuery).slice(0, 10);
  const itemError = validateQuoteItem(item);
  const activeCatalog =
    activeCategory === 'SERVICES'
      ? serviceCatalog
      : activeCategory === 'MEDICATIONS'
        ? medicationCatalog
        : activeCategory === 'SUPPLIES'
          ? supplyCatalog
          : activeCategory === 'STUDIES'
            ? studyCatalog
            : activeCategory === 'FEES'
              ? feeServiceCatalog
              : [];
  const catalogResults = activeCatalog.filter(
    (entry) =>
      (!inventoryOnly || entry.inventoryAvailable) &&
      entry.label.toLocaleLowerCase().includes(catalogQuery.toLocaleLowerCase()),
  );

  function setNumber(key: 'quantity' | 'unitPrice' | 'discountAmount', value: string) {
    setItem((current) => ({ ...current, [key]: Number(value) }));
  }
  function selectFeeDoctor(doctorId: string) {
    const doctor = doctors.find((candidate) => candidate.id === doctorId);
    setItem((current) => ({ ...current, doctorId: doctor?.id, doctorName: doctor?.fullName }));
  }
  function addOrUpdateItem() {
    const validation = validateQuoteItem(item);
    if (validation) {
      setErrors((current) => ({ ...current, item: validation }));
      return;
    }
    const persisted = { ...item, id: editingItemId ?? crypto.randomUUID() };
    setDraft((current) => ({
      ...current,
      items: editingItemId
        ? current.items.map((candidate) => (candidate.id === editingItemId ? persisted : candidate))
        : [...current.items, persisted],
    }));
    setItem(emptyItem(activeCategory));
    setCatalogQuery('');
    setEditingItemId(null);
    setErrors((current) => ({ ...current, item: '' }));
    setProcessingItem(true);
    window.setTimeout(() => setProcessingItem(false), 120);
  }
  function editItem(candidate: QuoteItem) {
    setItem({ ...candidate });
    setCatalogQuery(candidate.name);
    setEditingItemId(candidate.id);
    setActiveCategory(candidate.category);
    setErrors((current) => ({ ...current, item: '' }));
  }
  function removeItem(id: string) {
    setDraft((current) => ({
      ...current,
      items: current.items.filter((candidate) => candidate.id !== id),
    }));
  }
  function updateDiscount(next: Partial<QuoteDiscount>) {
    setDraft((current) => ({
      ...current,
      discount: { type: current.discount?.type ?? 'PERCENT', ...current.discount, ...next },
    }));
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!selectedCase) nextErrors.caseId = 'Seleccione una hospitalización válida.';
    if (!draft.summary.trim()) nextErrors.summary = 'El resumen operativo es obligatorio.';
    if (!draft.referralSelections?.length) nextErrors.referral = 'Seleccione al menos un referido.';
    if (mode === 'revise' && !draft.revisionReason.trim())
      nextErrors.revisionReason = 'El motivo de revisión es obligatorio.';
    try {
      calculateQuoteTotals(draft.items, draft.discount, draft.insurerAmount);
    } catch (cause) {
      nextErrors.totals =
        cause instanceof Error ? cause.message : 'No fue posible calcular la cotización.';
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    const now = new Date().toISOString();
    const common = {
      caseId: selectedCase!.id,
      patientId: selectedCase!.patientId,
      summary: draft.summary.trim(),
      invoiceDate: draft.invoiceDate,
      discountGroup: draft.discountGroup?.trim() || 'Regular',
      referralLabel: draft.referralQuery.trim() || draft.referralLabel?.trim() || undefined,
      referralSelections: draft.referralSelections?.length ? draft.referralSelections : undefined,
      giftCardCode: draft.giftCardCode?.trim() || undefined,
      comments: draft.comments?.trim() || undefined,
      items: draft.items,
      discount: draft.discount,
      insurerAmount: draft.insurerAmount,
    };
    if (mode === 'create') {
      const id = crypto.randomUUID();
      addQuote({
        id,
        ...common,
        version: 1,
        status: 'DRAFT',
        subtotal: 0,
        discountAmount: 0,
        total: 0,
        patientAmount: 0,
        immutable: false,
        createdAt: now,
        originalQuoteId: id,
        rootQuoteId: id,
      });
      onSaved('Borrador de cotización persistido.');
    } else if (mode === 'edit' && source) {
      updateQuote({ ...source, ...common });
      onSaved('Borrador de cotización actualizado y persistido.');
    } else if (mode === 'revise' && source) {
      const revision = createQuoteRevision(source, crypto.randomUUID(), draft.revisionReason, now);
      addQuote({ ...revision, ...common });
      onSaved('Nueva versión de cotización creada como borrador.');
    }
  }
  const title =
    mode === 'create'
      ? 'Nueva cotización'
      : mode === 'edit'
        ? `Editar borrador ${source?.id}`
        : `Revisar ${source?.id}`;
  const saveAction =
    mode === 'create'
      ? 'QUOTE-CREATE-SUBMIT'
      : mode === 'edit'
        ? 'QUOTE-EDIT-SUBMIT'
        : 'QUOTE-REVISE-SUBMIT';
  const cancelAction =
    mode === 'create'
      ? 'QUOTE-CREATE-CANCEL'
      : mode === 'edit'
        ? 'QUOTE-EDIT-CANCEL'
        : 'QUOTE-REVISE-CANCEL';
  return (
    <Dialog
      description="Los importes, descuentos y responsabilidad de seguro son valores manuales de demostración; no se infieren reglas, impuestos ni cobertura."
      footer={
        <>
          <Button
            className="button-secondary"
            data-action-id={cancelAction}
            onClick={onClose}
            type="button"
          >
            Cancelar
          </Button>
          <Button data-action-id={saveAction} form="quote-editor-form" type="submit">
            {mode === 'edit'
              ? 'Guardar cambios'
              : mode === 'revise'
                ? 'Crear revisión'
                : 'Guardar borrador'}
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title={title}
    >
      <form className="form-grid" id="quote-editor-form" noValidate onSubmit={submit}>
        <fieldset className="quote-fieldset full-field">
          <legend>Datos del paciente</legend>
          <div className="form-grid form-grid-compact">
            <label htmlFor="quote-patient-search">Buscar paciente</label>
            <input
              aria-label="Buscar paciente"
              data-action-id="QUOTE-PATIENT-SEARCH"
              disabled={mode !== 'create'}
              id="quote-patient-search"
              list="quote-patient-options"
              onChange={(event) =>
                setDraft((current) => ({ ...current, patientQuery: event.target.value }))
              }
              placeholder="Nombre o documento"
              value={draft.patientQuery}
            />
            <datalist id="quote-patient-options">
              {patientOptions.map((patient) => (
                <option key={patient.id} value={patient.fullName}>
                  {patient.documentId}
                </option>
              ))}
            </datalist>
            <label>
              Paciente
              <select
                data-action-id="QUOTE-PATIENT-SELECT"
                disabled={mode !== 'create'}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    patientId: event.target.value,
                    caseId:
                      hospitalizations.find(
                        (candidate) => candidate.patientId === event.target.value,
                      )?.id ?? '',
                  }))
                }
                value={draft.patientId}
              >
                <option value="">Seleccione un paciente</option>
                {patientOptions.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.documentId} · {patient.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Documento
              <input disabled value={selectedPatient?.documentId ?? 'No disponible'} />
            </label>
            <label>
              Teléfono
              <input disabled value={selectedPatient?.phone ?? 'No disponible'} />
            </label>
            <label>
              Correo
              <input disabled value={selectedPatient?.email ?? 'No disponible'} />
            </label>
          </div>
          <p className="field-help">
            Los datos del paciente son de solo lectura desde la cotización; su edición se realiza en
            Pacientes.
          </p>
        </fieldset>
        <label>
          Hospitalización compatible
          <select
            disabled={mode !== 'create'}
            onChange={(event) =>
              setDraft((current) => ({ ...current, caseId: event.target.value }))
            }
            value={draft.caseId}
          >
            <option value="">Seleccione una hospitalización</option>
            {compatibleCases.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.id}
              </option>
            ))}
          </select>
          {errors.caseId ? <span className="field-error">{errors.caseId}</span> : null}
        </label>
        <label>
          Resumen operativo
          <textarea
            onChange={(event) =>
              setDraft((current) => ({ ...current, summary: event.target.value }))
            }
            rows={3}
            value={draft.summary}
          />
          {errors.summary ? <span className="field-error">{errors.summary}</span> : null}
        </label>
        <fieldset className="quote-fieldset full-field">
          <legend>Datos iniciales de factura</legend>
          <div className="form-grid form-grid-compact">
            <label>
              Fecha <span aria-hidden="true">*</span>
              <input
                data-action-id="QUOTE-INVOICE-DATE"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, invoiceDate: event.target.value }))
                }
                type="date"
                value={draft.invoiceDate ?? ''}
              />
            </label>
            <label>
              Grupo de descuento <span aria-hidden="true">*</span>
              <select
                data-action-id="QUOTE-DISCOUNT-GROUP"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, discountGroup: event.target.value }))
                }
                value={draft.discountGroup ?? 'Regular'}
              >
                <option value="Regular">Regular</option>
              </select>
            </label>
            <div className="full-field referral-field">
              <label htmlFor="quote-referral">
                Referido por <span aria-hidden="true">*</span>
              </label>
              <div className="referral-input-row">
                <input
                  aria-controls="quote-referral-catalog"
                  aria-describedby={errors.referral ? 'quote-referral-error' : undefined}
                  aria-invalid={Boolean(errors.referral)}
                  data-action-id="QUOTE-REFERRAL"
                  id="quote-referral"
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraft((current) => ({
                      ...current,
                      referralQuery: value,
                      referralLabel: value,
                    }));
                    setReferralCatalogOpen(true);
                  }}
                  value={draft.referralQuery}
                />
                <Button
                  aria-expanded={referralCatalogOpen}
                  aria-label="Mostrar opciones de referido"
                  className="referral-catalog-toggle"
                  data-action-id="QUOTE-REFERRAL-CATALOG"
                  onClick={() => setReferralCatalogOpen((current) => !current)}
                  type="button"
                >
                  +
                </Button>
              </div>
              {errors.referral ? (
                <p className="field-error" id="quote-referral-error" role="alert">
                  {errors.referral}
                </p>
              ) : null}
              {draft.referralSelections?.length ? (
                <div aria-label="Referidos seleccionados" className="action-row">
                  {draft.referralSelections.map((label) => (
                    <span className="status-tag" key={label}>
                      {label}
                      <button
                        aria-label={`Quitar ${label}`}
                        data-action-id="QUOTE-REFERRAL-REMOVE"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            referralSelections:
                              current.referralSelections?.filter(
                                (selection) => selection !== label,
                              ) ?? [],
                          }))
                        }
                        type="button"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              {referralCatalogOpen ? (
                <div
                  aria-label="Catálogo de referidos"
                  className="referral-catalog"
                  id="quote-referral-catalog"
                  role="listbox"
                  tabIndex={0}
                >
                  {referralCatalog
                    .filter((label) =>
                      label.toLocaleLowerCase().includes(draft.referralQuery.toLocaleLowerCase()),
                    )
                    .map((label) => (
                      <button
                        aria-selected={draft.referralSelections?.includes(label)}
                        data-action-id="QUOTE-REFERRAL-ADD"
                        key={label}
                        onClick={() => {
                          setDraft((current) => ({
                            ...current,
                            referralSelections: current.referralSelections?.includes(label)
                              ? current.referralSelections.filter(
                                  (selection) => selection !== label,
                                )
                              : [...(current.referralSelections ?? []), label],
                            referralLabel: '',
                            referralQuery: '',
                          }));
                          setErrors((current) => ({ ...current, referral: '' }));
                        }}
                        role="option"
                        type="button"
                      >
                        {label}
                      </button>
                    ))}
                </div>
              ) : null}
            </div>
            <label>
              Giftcard
              <input
                data-action-id="QUOTE-GIFTCARD"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, giftCardCode: event.target.value }))
                }
                value={draft.giftCardCode ?? ''}
              />
            </label>
            <label className="full">
              Comentarios <span aria-hidden="true">*</span>
              <textarea
                data-action-id="QUOTE-COMMENTS"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, comments: event.target.value }))
                }
                rows={3}
                value={draft.comments ?? ''}
              />
            </label>
          </div>
          <p className="field-help">
            Los referidos son etiquetas administrativas demostrativas; no aplican descuentos,
            impuestos, saldo ni cobertura.
          </p>
        </fieldset>
        {mode === 'revise' ? (
          <label className="full-field">
            Motivo de revisión
            <textarea
              onChange={(event) =>
                setDraft((current) => ({ ...current, revisionReason: event.target.value }))
              }
              rows={2}
              value={draft.revisionReason}
            />
            {errors.revisionReason ? (
              <span className="field-error">{errors.revisionReason}</span>
            ) : null}
          </label>
        ) : null}
        <fieldset className="quote-fieldset full-field">
          <legend>Constructor por categorías</legend>
          <div className="tabs" role="tablist">
            {quoteCategories.map((category) => (
              <button
                aria-selected={activeCategory === category.value}
                className={`tab ${activeCategory === category.value ? 'active' : ''}`}
                data-action-id={
                  category.value === 'MEDICATIONS' ? 'QUOTE-MEDICATION-CATEGORY' : undefined
                }
                key={category.value}
                onClick={() => {
                  setActiveCategory(category.value);
                  setItem(emptyItem(category.value));
                  setCatalogQuery('');
                  setErrors((current) => ({ ...current, item: '' }));
                }}
                role="tab"
                type="button"
              >
                {category.label}
              </button>
            ))}
          </div>
          <div className="form-grid form-grid-compact quote-item-editor">
            {activeCategory === 'SERVICES' ? (
              <>
                <label className="full-field">
                  <input
                    checked={inventoryOnly}
                    data-action-id="QUOTE-INVENTORY-ONLY"
                    onChange={(event) => {
                      setInventoryOnly(event.target.checked);
                      if (event.target.checked && item.name === serviceCatalog[1].label)
                        setItem((current) => ({ ...current, name: '' }));
                    }}
                    type="checkbox"
                  />{' '}
                  Solo disponibles en inventario
                </label>
                <label>
                  Socio de negocios
                  <select
                    data-action-id="QUOTE-BUSINESS-PARTNER"
                    onChange={(event) =>
                      setItem((current) => ({
                        ...current,
                        businessPartnerLabel: event.target.value || undefined,
                      }))
                    }
                    value={item.businessPartnerLabel ?? ''}
                  >
                    <option value="">Seleccione un socio</option>
                    {businessPartners.map((partner) => (
                      <option key={partner} value={partner}>
                        {partner}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Servicios
                  <select
                    data-action-id="QUOTE-SERVICE-CATALOG"
                    onChange={(event) =>
                      setItem((current) => ({ ...current, name: event.target.value }))
                    }
                    value={
                      serviceCatalog.some((service) => service.label === item.name) ? item.name : ''
                    }
                  >
                    <option value="">Seleccione un servicio</option>
                    {serviceCatalog
                      .filter((service) => !inventoryOnly || service.inventoryAvailable)
                      .map((service) => (
                        <option key={service.id} value={service.label}>
                          {service.label}
                        </option>
                      ))}
                  </select>
                </label>
              </>
            ) : null}
            {activeCategory === 'SUPPLIES' || activeCategory === 'STUDIES' ? (
              <>
                <label className="full-field">
                  <input
                    checked={inventoryOnly}
                    data-action-id={
                      activeCategory === 'SUPPLIES'
                        ? 'QUOTE-SUPPLY-INVENTORY-ONLY'
                        : 'QUOTE-STUDY-INVENTORY-ONLY'
                    }
                    onChange={(event) => {
                      setInventoryOnly(event.target.checked);
                      if (
                        event.target.checked &&
                        activeCatalog.some(
                          (entry) => entry.label === item.name && !entry.inventoryAvailable,
                        )
                      )
                        setItem((current) => ({ ...current, name: '' }));
                    }}
                    type="checkbox"
                  />{' '}
                  Solo disponibles en inventario
                </label>
                <label>
                  Socio de negocios
                  <select
                    data-action-id={
                      activeCategory === 'SUPPLIES'
                        ? 'QUOTE-SUPPLY-BUSINESS-PARTNER'
                        : 'QUOTE-STUDY-BUSINESS-PARTNER'
                    }
                    onChange={(event) =>
                      setItem((current) => ({
                        ...current,
                        businessPartnerLabel: event.target.value || undefined,
                      }))
                    }
                    value={item.businessPartnerLabel ?? ''}
                  >
                    <option value="">Seleccione un socio</option>
                    {businessPartners.map((partner) => (
                      <option key={partner} value={partner}>
                        {partner}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Buscar {activeCategory === 'SUPPLIES' ? 'insumos' : 'estudios'}
                  <input
                    aria-label={
                      activeCategory === 'SUPPLIES' ? 'Buscar insumos' : 'Buscar estudios'
                    }
                    data-action-id={
                      activeCategory === 'SUPPLIES' ? 'QUOTE-SUPPLY-SEARCH' : 'QUOTE-STUDY-SEARCH'
                    }
                    onChange={(event) => setCatalogQuery(event.target.value)}
                    value={catalogQuery}
                  />
                </label>
                <div
                  aria-label={
                    activeCategory === 'SUPPLIES'
                      ? 'Resultados de insumos'
                      : 'Resultados de estudios'
                  }
                  className="catalog-results full-field"
                  role="listbox"
                >
                  {catalogResults.map((entry) => (
                    <button
                      data-action-id={
                        activeCategory === 'SUPPLIES' ? 'QUOTE-SUPPLY-SELECT' : 'QUOTE-STUDY-SELECT'
                      }
                      key={entry.id}
                      onClick={() => setItem((current) => ({ ...current, name: entry.label }))}
                      role="option"
                      type="button"
                    >
                      {entry.label}
                    </button>
                  ))}
                  {!catalogResults.length ? <p role="status">No results found</p> : null}
                </div>
              </>
            ) : null}
            <label>
              Concepto
              <input
                onChange={(event) =>
                  setItem((current) => ({ ...current, name: event.target.value }))
                }
                value={item.name}
              />
            </label>
            {activeCategory === 'FEES' ? (
              <>
                <label>
                  Socio de negocios
                  <select
                    data-action-id="QUOTE-FEE-BUSINESS-PARTNER"
                    onChange={(event) =>
                      setItem((current) => ({
                        ...current,
                        businessPartnerLabel: event.target.value || undefined,
                      }))
                    }
                    value={item.businessPartnerLabel ?? ''}
                  >
                    <option value="">Seleccione un socio</option>
                    {businessPartners.map((partner) => (
                      <option key={partner} value={partner}>
                        {partner}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Servicio de honorario
                  <select
                    data-action-id="QUOTE-FEE-SERVICE-CATALOG"
                    onChange={(event) =>
                      setItem((current) => ({ ...current, name: event.target.value }))
                    }
                    value={
                      feeServiceCatalog.some((service) => service.label === item.name)
                        ? item.name
                        : ''
                    }
                  >
                    <option value="">Seleccione un servicio</option>
                    {feeServiceCatalog.map((service) => (
                      <option key={service.id} value={service.label}>
                        {service.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Médico
                  <select
                    data-action-id="QUOTE-FEE-DOCTOR-SELECT"
                    onChange={(event) => selectFeeDoctor(event.target.value)}
                    value={item.doctorId ?? ''}
                  >
                    <option value="">Seleccione un médico</option>
                    {doctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.fullName}
                      </option>
                    ))}
                  </select>
                  <span className="field-help">
                    Honorario médico: importe manual, sin tarifa inferida.
                  </span>
                </label>
              </>
            ) : null}
            <label>
              Cantidad <span aria-hidden="true">*</span>
              <input
                aria-required="true"
                min="0.01"
                onChange={(event) => setNumber('quantity', event.target.value)}
                step="0.01"
                type="number"
                value={Number.isFinite(item.quantity) ? item.quantity : ''}
              />
            </label>
            <label>
              {activeCategory === 'FEES' ? 'Honorario médico (manual)' : 'Precio manual'}
              <input
                data-action-id={activeCategory === 'FEES' ? 'QUOTE-FEE-AMOUNT' : undefined}
                min="0"
                onChange={(event) => setNumber('unitPrice', event.target.value)}
                step="0.01"
                type="number"
                value={Number.isFinite(item.unitPrice) ? item.unitPrice : ''}
              />
            </label>
            <label>
              Descuento manual
              <input
                min="0"
                onChange={(event) => setNumber('discountAmount', event.target.value)}
                step="0.01"
                type="number"
                value={Number.isFinite(item.discountAmount) ? item.discountAmount : ''}
              />
            </label>
            <div className="quote-item-total">
              <span>Subtotal de línea</span>
              <strong>
                {itemError ? '—' : money(item.quantity * item.unitPrice - item.discountAmount)}
              </strong>
            </div>
            <div className="quote-item-actions">
              <Button
                data-action-id={editingItemId ? 'QUOTE-ITEM-EDIT' : 'QUOTE-ITEM-ADD'}
                onClick={addOrUpdateItem}
                type="button"
              >
                {editingItemId ? 'Actualizar línea' : 'Agregar línea'}
              </Button>
              {editingItemId ? (
                <Button
                  className="button-secondary"
                  onClick={() => {
                    setItem(emptyItem(activeCategory));
                    setEditingItemId(null);
                  }}
                  type="button"
                >
                  Cancelar edición
                </Button>
              ) : null}
            </div>
          </div>
        {activeCategory === 'SERVICES' || activeCategory === 'MEDICATIONS' ? (
            <div className="form-grid form-grid-compact quote-item-catalog">
              <label className="full-field">
                {activeCategory === 'SERVICES' ? 'Buscar servicios' : 'Buscar medicamentos'}
                <input
                  aria-controls="quote-item-catalog"
                  data-action-id={
                    activeCategory === 'SERVICES'
                      ? 'QUOTE-SERVICE-SEARCH'
                      : 'QUOTE-MEDICATION-SEARCH'
                  }
                  onChange={(event) => setCatalogQuery(event.target.value)}
                  placeholder="Buscar en catálogo sintético"
                  value={catalogQuery}
                />
                {catalogQuery ? (
                  <div
                    aria-label={
                      activeCategory === 'SERVICES'
                        ? 'Resultados de servicios'
                        : 'Resultados de medicamentos'
                    }
                    className="referral-catalog"
                    id="quote-item-catalog"
                    role="listbox"
                  >
                    {catalogResults.length ? (
                      catalogResults.map((entry) => (
                        <button
                          data-action-id={
                            activeCategory === 'SERVICES'
                              ? 'QUOTE-SERVICE-SELECT'
                              : 'QUOTE-MEDICATION-SELECT'
                          }
                          key={entry.id}
                          onClick={() => {
                            setItem((current) => ({ ...current, name: entry.label }));
                            setCatalogQuery(entry.label);
                          }}
                          role="option"
                          type="button"
                        >
                          {entry.label}
                        </button>
                      ))
                    ) : (
                      <p className="field-help" role="status">
                        No results found
                      </p>
                    )}
                  </div>
                ) : null}
              </label>
              {activeCategory === 'MEDICATIONS' ? (
                <>
                  <label>
                    Socio de negocios
                    <select
                      data-action-id="QUOTE-MEDICATION-BUSINESS-PARTNER"
                      onChange={(event) =>
                        setItem((current) => ({
                          ...current,
                          businessPartnerLabel: event.target.value || undefined,
                        }))
                      }
                      value={item.businessPartnerLabel ?? ''}
                    >
                      <option value="">Seleccione un socio</option>
                      {businessPartners.map((partner) => (
                        <option key={partner} value={partner}>
                          {partner}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="full-field">
                    <input
                      checked={inventoryOnly}
                      data-action-id="QUOTE-MEDICATION-INVENTORY-ONLY"
                      onChange={(event) => setInventoryOnly(event.target.checked)}
                      type="checkbox"
                    />{' '}
                    Solo disponibles en inventario
                  </label>
                </>
              ) : null}
              <p className="field-help full-field">
                El catálogo es sintético: seleccionar un concepto no asigna precio, disponibilidad
                real, reserva, dosificación, impuestos ni cobertura.
              </p>
            </div>
          ) : null}
          {processingItem ? (
            <div aria-live="polite" className="quote-processing" role="status">
              Procesando...
            </div>
          ) : null}
          {errors.item ? (
            <p className="field-error" role="alert">
              {errors.item}
            </p>
          ) : null}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Cantidad</th>
                  <th>Precio</th>
                  <th>Descuento</th>
                  <th>Subtotal</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {draft.items
                  .filter((candidate) => candidate.category === activeCategory)
                  .map((candidate) => (
                    <tr key={candidate.id}>
                      <td>
                        {candidate.name}
                        {candidate.doctorName ? (
                          <>
                            <br />
                            <small>Médico: {candidate.doctorName}</small>
                          </>
                        ) : null}
                        {candidate.businessPartnerLabel ? (
                          <>
                            <br />
                            <small>Socio: {candidate.businessPartnerLabel}</small>
                          </>
                        ) : null}
                      </td>
                      <td>{candidate.quantity}</td>
                      <td>{money(candidate.unitPrice)}</td>
                      <td>{money(candidate.discountAmount)}</td>
                      <td>
                        {money(candidate.quantity * candidate.unitPrice - candidate.discountAmount)}
                      </td>
                      <td>
                        <div className="action-row">
                          <Button
                            className="button-secondary"
                            data-action-id="QUOTE-ITEM-EDIT"
                            onClick={() => editItem(candidate)}
                            type="button"
                          >
                            Editar
                          </Button>
                          <Button
                            className="button-secondary"
                            data-action-id="QUOTE-ITEM-REMOVE"
                            onClick={() => removeItem(candidate.id)}
                            type="button"
                          >
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                {!draft.items.some((candidate) => candidate.category === activeCategory) ? (
                  <tr>
                    <td colSpan={6}>No hay conceptos en esta categoría.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </fieldset>
        <fieldset className="quote-fieldset full-field">
          <legend>Descuento general manual</legend>
          <div className="form-grid form-grid-compact">
            <label>
              Tipo
              <select
                data-action-id="QUOTE-DISCOUNT-UPDATE"
                onChange={(event) =>
                  updateDiscount({
                    type: event.target.value as QuoteDiscount['type'],
                    value: 0,
                    categories: undefined,
                  })
                }
                value={draft.discount?.type ?? 'PERCENT'}
              >
                <option value="PERCENT">Porcentaje</option>
                <option value="FIXED">Monto fijo</option>
                <option value="CATEGORY_PERCENTAGES">Por categoría</option>
              </select>
            </label>
            {draft.discount?.type !== 'CATEGORY_PERCENTAGES' ? (
              <label>
                {draft.discount?.type === 'FIXED'
                  ? 'Monto de descuento'
                  : 'Porcentaje de descuento'}
                <input
                  data-action-id="QUOTE-DISCOUNT-UPDATE"
                  min="0"
                  onChange={(event) => updateDiscount({ value: Number(event.target.value) })}
                  step="0.01"
                  type="number"
                  value={draft.discount?.value ?? 0}
                />
              </label>
            ) : (
              quoteCategories.map((category) => (
                <label key={category.value}>
                  {category.label} (%)
                  <input
                    data-action-id="QUOTE-DISCOUNT-UPDATE"
                    max="100"
                    min="0"
                    onChange={(event) =>
                      updateDiscount({
                        categories: updatedCategoryPercentages(
                          draft.discount?.categories,
                          category.value,
                          Number(event.target.value),
                        ),
                      })
                    }
                    step="0.01"
                    type="number"
                    value={draft.discount?.categories?.[category.value] ?? 0}
                  />
                </label>
              ))
            )}
            <label>
              Responsabilidad explícita de aseguradora
              <input
                min="0"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, insurerAmount: Number(event.target.value) }))
                }
                step="0.01"
                type="number"
                value={draft.insurerAmount}
              />
            </label>
          </div>
        </fieldset>
        <section className="quote-totals full-field" aria-label="Totales de cotización">
          <div>
            <span>Subtotal</span>
            <strong>{money(totals.subtotal)}</strong>
          </div>
          <div>
            <span>Descuento</span>
            <strong>{money(totals.discountAmount)}</strong>
          </div>
          <div>
            <span>Total</span>
            <strong>{money(totals.total)}</strong>
          </div>
          <div>
            <span>Aseguradora</span>
            <strong>{money(totals.insurerAmount)}</strong>
          </div>
          <div>
            <span>Paciente</span>
            <strong>{money(totals.patientAmount)}</strong>
          </div>
        </section>
        {errors.totals ? (
          <p className="field-error full-field" role="alert">
            {errors.totals}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

export default function QuotesPage() {
  const { patients, payments, quotes } = useWorkspace();
  const { can } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [draftFilters, setDraftFilters] = useState({
    status: '' as Quote['status'] | '',
    createdDate: '',
  });
  const [appliedFilters, setAppliedFilters] = useState({
    status: '' as Quote['status'] | '',
    createdDate: '',
  });
  const [page, setPage] = useState(1);
  const editId = searchParams.get('edit');
  const reviseId = searchParams.get('revise');
  const source = quotes.find((quote) => quote.id === (editId ?? reviseId));
  const mode: EditorMode | null =
    searchParams.get('create') === '1'
      ? 'create'
      : editId && source
        ? 'edit'
        : reviseId && source
          ? 'revise'
          : null;
  const visibleQuotes = filterQuotes(searchQuotes(quotes, patients, query), appliedFilters);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(visibleQuotes.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedQuotes = visibleQuotes.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  function close() {
    router.push('/quotes');
  }
  function saved(nextMessage: string) {
    setMessage(nextMessage);
    router.push('/quotes');
  }
  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Facturación</p>
          <h1>Cotizaciones</h1>
          <p>
            Constructor manual con valores sintéticos, versiones inmutables al enviar y
            responsabilidades explícitas. No se infieren precios, impuestos ni cobertura.
          </p>
        </div>
        {can('quotes:write') ? (
          <Button
            data-action-id="QUOTE-CREATE"
            onClick={() => router.push('/quotes?create=1')}
            type="button"
          >
            + Nuevo
          </Button>
        ) : null}
      </header>
      {message ? (
        <p className="notice success" role="status">
          {message}
        </p>
      ) : null}
      <Panel>
        <div className="table-heading">
          <div>
            <h2>Listado de cotizaciones</h2>
            <p>{quotes.length} registros persistidos</p>
          </div>
          <StatusTag>{visibleQuotes.length} visibles</StatusTag>
        </div>
        <div className="form-grid">
          <label>
            Estado
            <select
              data-action-id="QUOTE-FILTER-STATUS"
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  status: event.target.value as Quote['status'] | '',
                }))
              }
              value={draftFilters.status}
            >
              <option value="">Todos</option>
              <option value="DRAFT">Borrador</option>
              <option value="SENT">Enviada</option>
            </select>
          </label>
          <label>
            Fecha de creación
            <input
              data-action-id="QUOTE-FILTER-CREATED-DATE"
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, createdDate: event.target.value }))
              }
              type="date"
              value={draftFilters.createdDate}
            />
          </label>
          <div className="action-row">
            <Button
              data-action-id="QUOTE-FILTER-APPLY"
              onClick={() => {
                setAppliedFilters(draftFilters);
                setPage(1);
              }}
              type="button"
            >
              Aplicar
            </Button>
            <Button
              className="button-secondary"
              data-action-id="QUOTE-FILTER-CLEAR"
              onClick={() => {
                const cleared = { status: '' as Quote['status'] | '', createdDate: '' };
                setDraftFilters(cleared);
                setAppliedFilters(cleared);
                setPage(1);
              }}
              type="button"
            >
              Limpiar
            </Button>
          </div>
          <label className="full">
            Buscar cotización
            <input
              data-action-id="QUOTE-SEARCH"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="ID, paciente, caso o estado"
              type="search"
              value={query}
            />
          </label>
        </div>
        {query ? (
          <Button
            className="button-secondary"
            data-action-id="QUOTE-SEARCH-CLEAR"
            onClick={() => {
              setQuery('');
              setPage(1);
            }}
            type="button"
          >
            Limpiar búsqueda
          </Button>
        ) : null}
      </Panel>
      <Panel>
        {visibleQuotes.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cotización</th>
                    <th>Paciente / caso</th>
                    <th>Creación</th>
                    <th>Total</th>
                    <th>Seguro</th>
                    <th>Paciente</th>
                    <th>Saldo</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedQuotes.map((quote) => {
                    const balance = calculateQuoteBalance(quote, payments);
                    return (
                      <tr key={quote.id}>
                        <td>
                          {quote.id}
                          <br />
                          <small>v{quote.version}</small>
                        </td>
                        <td>
                          {patients.find((patient) => patient.id === quote.patientId)?.fullName ??
                            'No disponible'}
                          <br />
                          <small>{quote.caseId}</small>
                        </td>
                        <td>{new Date(quote.createdAt).toLocaleString('es-SV')}</td>
                        <td>{money(quote.total)}</td>
                        <td>{money(quote.insurerAmount)}</td>
                        <td>{money(quote.patientAmount)}</td>
                        <td>{money(balance.balance)}</td>
                        <td>
                          <StatusTag tone={quote.immutable ? 'success' : 'warning'}>
                            {quote.immutable ? 'Enviada' : 'Borrador'}
                          </StatusTag>
                        </td>
                        <td>
                          <Link data-action-id="QUOTE-DETAIL-NAVIGATE" href={`/quotes/${quote.id}`}>
                            Consultar
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="table-heading">
              <span>
                Página {currentPage} de {totalPages}
              </span>
              <div>
                <Button
                  className="button-secondary"
                  data-action-id="QUOTE-PAGE-PREV"
                  disabled={currentPage === 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  type="button"
                >
                  Anterior
                </Button>
                <Button
                  className="button-secondary"
                  data-action-id="QUOTE-PAGE-NEXT"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  type="button"
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            detail={
              query || appliedFilters.status || appliedFilters.createdDate
                ? 'Ajuste o limpie los filtros para ver cotizaciones.'
                : 'Cree una cotización para comenzar.'
            }
            title="Sin cotizaciones"
          />
        )}
      </Panel>
      {mode ? (
        <QuoteEditor
          key={`${mode}-${source?.id ?? 'new'}`}
          mode={mode}
          onClose={close}
          onSaved={saved}
          open
          source={source}
        />
      ) : null}
    </div>
  );
}
