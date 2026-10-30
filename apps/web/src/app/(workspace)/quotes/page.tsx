'use client';

import type { Quote, QuoteItem, QuoteItemCategory } from '@analiza/contracts';
import {
  calculateQuoteBalance,
  calculateQuoteTotals,
  createQuoteRevision,
  currentInventoryBalance,
  filterQuotes,
  quoteDisplayCode,
  quoteCategories,
  searchPatients,
  searchQuotes,
  validateQuoteItem,
} from '@analiza/domain';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth, useWorkspace } from '@/components/providers';
import { SearchableSelect } from '@/components/common/searchable-select';
import { quoteMedicalFeeOptions } from '@/lib/quote-medical-fees';
import { mongoMutationHeaders } from '@/lib/auth';
import { quoteFormDraftSchema } from '@/lib/quote-form-draft';
import { quoteDecisionSchema, type QuoteDecision } from '@/lib/quote-decision';

type EditorMode = 'create' | 'edit' | 'revise';
type QuoteDraft = Pick<
  Quote,
  | 'summary'
  | 'careSetting'
  | 'diagnosisSummary'
  | 'primaryDoctorId'
  | 'secondaryDoctorId'
  | 'insurer'
  | 'admissionDate'
  | 'dischargeDate'
  | 'accountType'
  | 'manager'
  | 'priority'
  | 'deductibleAmount'
  | 'coinsuranceAmount'
  | 'comments'
  | 'paymentCondition'
  | 'items'
  | 'discount'
  | 'insurerAmount'
  | 'invoiceDate'
  | 'invoiceDocumentType'
  | 'discountGroup'
  | 'referralLabel'
  | 'referralSelections'
> & {
  caseId: string;
  revisionReason: string;
  patientId: string;
  patientQuery: string;
  referralQuery: string;
  doctorQuery: string;
};

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
  doctorQuery: '',
  summary: '',
  careSetting: 'HOSPITALIZATION',
  diagnosisSummary: '',
  primaryDoctorId: '',
  secondaryDoctorId: '',
  insurer: '',
  admissionDate: new Date().toISOString().slice(0, 10),
  dischargeDate: '',
  accountType: 'PARTICULAR',
  manager: '',
  priority: 'MEDIUM',
  deductibleAmount: 0,
  coinsuranceAmount: 0,
  comments: '',
  paymentCondition: '',
  invoiceDate: new Date().toISOString().slice(0, 10),
  invoiceDocumentType: 'INVOICE',
  discountGroup: 'Regular',
  referralLabel: '',
  referralSelections: [],
  items: [],
  discount: undefined,
  insurerAmount: 0,
  revisionReason: '',
});
type CatalogEntry = {
  id: string;
  label: string;
  inventoryAvailable: boolean;
  salePriceExcludingTax?: number;
};
const feeServiceCatalog: CatalogEntry[] = [
  { id: 'fee-visit', label: 'Visita', inventoryAvailable: true },
  { id: 'fee-follow-up', label: 'Seguimiento', inventoryAvailable: true },
];
const money = (value: number) => `USD ${value.toFixed(2)}`;
function cloneDraft(quote: Quote): QuoteDraft {
  return {
    caseId: quote.caseId ?? '',
    patientId: quote.patientId,
    patientQuery: '',
    referralQuery: quote.referralLabel ?? '',
    doctorQuery: '',
    summary: quote.summary,
    careSetting: quote.careSetting ?? 'HOSPITALIZATION',
    diagnosisSummary: quote.diagnosisSummary ?? '',
    primaryDoctorId: quote.primaryDoctorId ?? '',
    secondaryDoctorId: quote.secondaryDoctorId ?? '',
    insurer: quote.insurer ?? '',
    admissionDate: quote.admissionDate ?? quote.createdAt.slice(0, 10),
    dischargeDate: quote.dischargeDate ?? '',
    accountType: quote.accountType ?? 'PARTICULAR',
    manager: quote.manager ?? '',
    priority: quote.priority ?? 'MEDIUM',
    deductibleAmount: quote.deductibleAmount ?? 0,
    coinsuranceAmount: quote.coinsuranceAmount ?? 0,
    comments: quote.comments ?? '',
    paymentCondition: quote.paymentCondition ?? '',
    invoiceDate: quote.invoiceDate ?? quote.createdAt.slice(0, 10),
    invoiceDocumentType: quote.invoiceDocumentType ?? 'INVOICE',
    discountGroup: quote.discountGroup ?? 'Regular',
    referralLabel: quote.referralLabel ?? '',
    referralSelections: quote.referralSelections ?? [],
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
  const { session } = useAuth();
  const {
    addQuote,
    catalogItems,
    doctors,
    error: workspaceError,
    hospitalizations,
    inventoryMovements,
    patients,
    refreshPatients,
    updateQuote,
  } = useWorkspace();
  const [draft, setDraft] = useState<QuoteDraft>(() =>
    source ? cloneDraft(source) : emptyDraft(),
  );
  const [item, setItem] = useState<QuoteItem>(() => emptyItem());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<QuoteItemCategory>('SERVICES');
  const [processingItem, setProcessingItem] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [refreshingPatients, setRefreshingPatients] = useState(false);
  const [patientRefreshNotice, setPatientRefreshNotice] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [draftRecovered, setDraftRecovered] = useState(false);
  const [autosaveError, setAutosaveError] = useState(false);
  const draftDiscarded = useRef(false);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const draftKey = session
    ? `analiza.form-draft.v1.${session.mode}.${session.userId}.quote.${mode}.${source?.id ?? 'new'}`
    : null;
  const serverDraftUrl =
    session?.mode === 'postgresql'
      ? `/api/quotes/form-draft?key=${encodeURIComponent(`quote.${mode}.${source?.id ?? 'new'}`)}`
      : null;

  useEffect(() => {
    if (!draftKey) return;
    let cancelled = false;
    async function restore() {
      if (draftDiscarded.current || !draftKey) return;
      let localSavedAt = 0;
      try {
        const stored = window.sessionStorage.getItem(draftKey);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (parsed && typeof parsed === 'object' && 'draft' in parsed) {
            const recovered = parsed as { draft: QuoteDraft; savedAt?: number };
            const valid = quoteFormDraftSchema.safeParse(recovered.draft);
            if (valid.success) {
              setDraft(valid.data);
              setDraftRecovered(true);
              localSavedAt = recovered.savedAt ?? 0;
            }
          }
        }
      } catch {
        try {
          window.sessionStorage.removeItem(draftKey);
        } catch {
          // El borrador remoto sigue disponible cuando el navegador bloquea almacenamiento local.
        }
      }
      if (serverDraftUrl) {
        try {
          const response = await fetch(serverDraftUrl, {
            cache: 'no-store',
            signal: AbortSignal.timeout(5000),
          });
          if (!response.ok) throw new Error('Draft load failed');
          const remote = (await response.json()) as { draft?: QuoteDraft; updatedAt?: string };
          const valid = quoteFormDraftSchema.safeParse(remote.draft);
          if (!cancelled && valid.success && Date.parse(remote.updatedAt ?? '') > localSavedAt) {
            setDraft(valid.data);
            setDraftRecovered(true);
          }
        } catch {
          if (!cancelled) setAutosaveError(true);
        }
      }
      if (!cancelled) setDraftReady(true);
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, [draftKey, serverDraftUrl]);

  useEffect(() => {
    if (!draftKey || !draftReady) return;
    const timer = window.setTimeout(() => {
      if (draftDiscarded.current) return;
      try {
        window.sessionStorage.setItem(draftKey, JSON.stringify({ draft, savedAt: Date.now() }));
      } catch {
        // La escritura temporal puede fallar por cuota o política del navegador.
      }
      if (serverDraftUrl) {
        saveChain.current = saveChain.current
          .catch(() => undefined)
          .then(async () => {
            if (draftDiscarded.current) return;
            const response = await fetch(serverDraftUrl, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', ...mongoMutationHeaders() },
              body: JSON.stringify(draft),
              signal: AbortSignal.timeout(5000),
            });
            if (!response.ok) throw new Error('Draft save failed');
            setAutosaveError(false);
          })
          .catch(() => {
            setAutosaveError(true);
          });
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, draftKey, draftReady, serverDraftUrl]);

  async function clearDraft(): Promise<boolean> {
    draftDiscarded.current = true;
    if (draftKey) {
      try {
        window.sessionStorage.removeItem(draftKey);
      } catch {
        // La limpieza remota no depende del almacenamiento del navegador.
      }
    }
    if (!serverDraftUrl) return true;
    try {
      await saveChain.current;
      const response = await fetch(serverDraftUrl, {
        method: 'DELETE',
        headers: mongoMutationHeaders(),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error('Draft cleanup failed');
      return true;
    } catch {
      setAutosaveError(true);
      return false;
    }
  }

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
  const linkedInventoryItem = catalogItems.find(
    (candidate) => candidate.id === item.inventoryItemId,
  );
  const linkedInventoryBalance = linkedInventoryItem
    ? currentInventoryBalance(inventoryMovements, linkedInventoryItem.id)
    : undefined;
  const catalogCategory = {
    SERVICES: 'SERVICES',
    STUDIES: 'LABORATORY',
    MEDICATIONS: 'MEDICATIONS',
    SUPPLIES: 'SUPPLIES',
    EQUIPMENT: 'EQUIPMENT',
    FEES: undefined,
    EXTRAS: 'PHYSIOTHERAPY',
    IMAGING: 'IMAGING',
  }[activeCategory];
  const activeCatalog =
    activeCategory === 'FEES'
      ? feeServiceCatalog
      : catalogCategory
        ? catalogItems
            .filter(
              (candidate) =>
                candidate.status === 'ACTIVE' &&
                candidate.category === catalogCategory &&
                typeof candidate.salePriceExcludingTax === 'number',
            )
            .map((candidate) => ({
              id: candidate.id,
              label: `${candidate.sku} | ${candidate.name}`,
              inventoryAvailable:
                !['MEDICATIONS', 'SUPPLIES', 'EQUIPMENT'].includes(activeCategory) ||
                currentInventoryBalance(inventoryMovements, candidate.id) > 0,
              salePriceExcludingTax: candidate.salePriceExcludingTax,
            }))
        : [];

  function setNumber(key: 'quantity' | 'unitPrice', value: string) {
    setItem((current) => ({ ...current, [key]: Number(value) }));
  }
  async function refreshPatientOptions() {
    setRefreshingPatients(true);
    const refreshed = await refreshPatients();
    setRefreshingPatients(false);
    setPatientRefreshNotice(
      refreshed
        ? 'Lista de pacientes actualizada desde el origen autorizado.'
        : 'No fue posible actualizar la lista. Su selección no se modificó.',
    );
  }
  function addOrUpdateItem() {
    const validation = validateQuoteItem(item);
    if (validation) {
      setErrors((current) => ({ ...current, item: validation }));
      return;
    }
    if (activeCategory === 'FEES') {
      const doctor = doctors.find((candidate) => candidate.id === draft.primaryDoctorId);
      if (!doctor) {
        setErrors((current) => ({
          ...current,
          item: 'Seleccione el médico tratante principal al inicio de la cotización.',
        }));
        return;
      }
    }
    if (activeCategory !== 'FEES' && !editingItemId && !item.inventoryItemId) {
      setErrors((current) => ({
        ...current,
        item: 'Seleccione un ítem del catálogo antes de agregarlo.',
      }));
      return;
    }
    const feeDoctor = doctors.find((candidate) => candidate.id === draft.primaryDoctorId);
    const persisted = {
      ...item,
      id: editingItemId ?? crypto.randomUUID(),
      ...(activeCategory === 'FEES'
        ? { doctorId: feeDoctor?.id, doctorName: feeDoctor?.fullName }
        : {}),
    };
    setDraft((current) => ({
      ...current,
      items: editingItemId
        ? current.items.map((candidate) => (candidate.id === editingItemId ? persisted : candidate))
        : [...current.items, persisted],
    }));
    setItem(emptyItem(activeCategory));
    setEditingItemId(null);
    setErrors((current) => ({ ...current, item: '' }));
    setProcessingItem(true);
    window.setTimeout(() => setProcessingItem(false), 300);
  }
  function editItem(candidate: QuoteItem) {
    setItem({ ...candidate });
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
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!selectedPatient) nextErrors.patientId = 'Seleccione un paciente válido.';
    if (draft.caseId && !selectedCase)
      nextErrors.caseId = 'La hospitalización seleccionada no corresponde al paciente.';
    if (draft.careSetting === 'HOSPITALIZATION' && !draft.primaryDoctorId)
      nextErrors.primaryDoctorId = 'Seleccione el médico tratante principal.';
    if (draft.primaryDoctorId && !doctors.some((doctor) => doctor.id === draft.primaryDoctorId))
      nextErrors.primaryDoctorId = 'Seleccione un médico registrado.';
    if (draft.secondaryDoctorId && !doctors.some((doctor) => doctor.id === draft.secondaryDoctorId))
      nextErrors.secondaryDoctorId = 'Seleccione un médico registrado.';
    if (draft.dischargeDate && draft.admissionDate && draft.dischargeDate < draft.admissionDate)
      nextErrors.dischargeDate = 'El alta no puede ser anterior al ingreso.';
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
      ...(selectedCase ? { caseId: selectedCase.id } : {}),
      patientId: selectedPatient!.id,
      summary: draft.summary.trim() || `Cotización de ${selectedPatient!.fullName}`,
      careSetting: draft.careSetting,
      diagnosisSummary: draft.diagnosisSummary?.trim() || undefined,
      primaryDoctorId: draft.primaryDoctorId || undefined,
      secondaryDoctorId: draft.secondaryDoctorId || undefined,
      insurer: draft.insurer?.trim() || undefined,
      admissionDate: draft.admissionDate || undefined,
      dischargeDate: draft.dischargeDate || undefined,
      accountType: draft.accountType,
      manager: draft.manager?.trim() || undefined,
      priority: draft.priority,
      deductibleAmount: draft.deductibleAmount ?? 0,
      coinsuranceAmount: draft.coinsuranceAmount ?? 0,
      ...(source
        ? {
            invoiceDate: draft.invoiceDate,
            invoiceDocumentType: draft.invoiceDocumentType,
            discountGroup: draft.discountGroup,
            referralLabel: draft.referralLabel,
            referralSelections: draft.referralSelections,
            paymentCondition: draft.paymentCondition,
          }
        : {}),
      comments: draft.comments?.trim() || undefined,
      items: draft.items,
      discount: draft.discount,
      insurerAmount: draft.insurerAmount,
    };
    if (mode === 'create') {
      const id = crypto.randomUUID();
      const saved = await addQuote({
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
      if (saved) {
        const cleared = await clearDraft();
        onSaved(
          cleared
            ? 'Borrador de cotización persistido.'
            : 'Borrador de cotización persistido. La copia automática pendiente deberá descartarse al volver al formulario.',
        );
      }
    } else if (mode === 'edit' && source) {
      const saved = await updateQuote({ ...source, ...common });
      if (saved) {
        const cleared = await clearDraft();
        onSaved(
          cleared
            ? 'Borrador de cotización actualizado y persistido.'
            : 'Cotización actualizada. La copia automática pendiente deberá descartarse al volver al formulario.',
        );
      }
    } else if (mode === 'revise' && source) {
      const revision = createQuoteRevision(source, crypto.randomUUID(), draft.revisionReason, now);
      const saved = await addQuote({ ...revision, ...common });
      if (saved) {
        const cleared = await clearDraft();
        onSaved(
          cleared
            ? 'Nueva versión de cotización creada como borrador.'
            : 'Nueva versión creada. La copia automática pendiente deberá descartarse al volver al formulario.',
        );
      }
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
      description="Ingrese los importes, descuentos y responsabilidad de seguro. Confirme las reglas, impuestos y cobertura antes de enviar."
      footer={
        <>
          <Button
            className="button-secondary"
            data-action-id="QUOTE-DRAFT-DISCARD"
            onClick={() => {
              void clearDraft().then((cleared) => {
                if (cleared) onClose();
              });
            }}
            type="button"
          >
            Descartar cambios
          </Button>
          <Button
            className="button-secondary"
            data-action-id={cancelAction}
            onClick={onClose}
            type="button"
          >
            Cancelar
          </Button>
          <Button
            data-action-id={saveAction}
            disabled={!draftReady}
            form="quote-editor-form"
            type="submit"
          >
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
      <p className="field-help">
        {!draftReady
          ? 'Recuperando el formulario pendiente…'
          : draftRecovered
            ? 'Se recuperó el formulario pendiente. Revíselo antes de guardar la cotización.'
            : serverDraftUrl
              ? 'El formulario se guarda automáticamente en su cuenta mientras lo completa. La cotización se crea al pulsar Guardar borrador.'
              : 'Los cambios de este formulario se conservan temporalmente en esta pestaña al cambiar de pantalla hasta que los guarde.'}
      </p>
      {autosaveError ? (
        <p className="notice danger" role="status">
          No se pudo sincronizar el formulario con la base de datos. Compruebe la conexión antes de
          cerrar esta pestaña.
        </p>
      ) : null}
      <form
        aria-busy={!draftReady}
        className="form-grid"
        id="quote-editor-form"
        inert={!draftReady}
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <fieldset className="quote-fieldset full-field">
          <legend>Datos del paciente</legend>
          <div className="form-grid form-grid-compact">
            <label htmlFor="quote-patient-search">
              Buscar paciente
              <input
                aria-label="Buscar paciente"
                data-action-id="QUOTE-PATIENT-SEARCH"
                disabled={mode !== 'create'}
                id="quote-patient-search"
                list="quote-patient-options"
                onChange={(event) => {
                  const patientQuery = event.target.value;
                  const normalizedQuery = patientQuery.trim().toLocaleLowerCase('es-SV');
                  const exactPatient = patients.find(
                    (candidate) =>
                      candidate.fullName.trim().toLocaleLowerCase('es-SV') === normalizedQuery ||
                      candidate.documentId.trim().toLocaleLowerCase('es-SV') === normalizedQuery,
                  );
                  setDraft((current) => ({
                    ...current,
                    patientQuery,
                    ...(exactPatient
                      ? {
                          patientId: exactPatient.id,
                          caseId: '',
                          diagnosisSummary: exactPatient.diagnosis ?? '',
                          primaryDoctorId: exactPatient.primaryDoctorId ?? '',
                          secondaryDoctorId: exactPatient.secondaryDoctorId ?? '',
                        }
                      : {}),
                  }));
                  if (exactPatient) setErrors((current) => ({ ...current, caseId: '' }));
                }}
                placeholder="Nombre o documento"
                value={draft.patientQuery}
              />
            </label>
            <div className="quote-patient-refresh">
              <Button
                className="button-secondary"
                data-action-id="QUOTE-PATIENT-REFRESH"
                disabled={mode !== 'create' || refreshingPatients}
                onClick={() => {
                  void refreshPatientOptions();
                }}
                type="button"
              >
                {refreshingPatients ? 'Actualizando…' : 'Actualizar pacientes'}
              </Button>
            </div>
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
                onChange={(event) => {
                  const patient = patients.find((candidate) => candidate.id === event.target.value);
                  setDraft((current) => ({
                    ...current,
                    patientId: event.target.value,
                    caseId: '',
                    diagnosisSummary: patient?.diagnosis ?? '',
                    primaryDoctorId: patient?.primaryDoctorId ?? '',
                    secondaryDoctorId: patient?.secondaryDoctorId ?? '',
                  }));
                }}
                value={draft.patientId}
              >
                <option value="">Seleccione un paciente</option>
                {patientOptions.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.documentId} · {patient.fullName}
                  </option>
                ))}
              </select>
              {errors.patientId ? <span className="field-error">{errors.patientId}</span> : null}
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
          {patientRefreshNotice ? (
            <p className="field-help" role="status">
              {patientRefreshNotice}
            </p>
          ) : null}
        </fieldset>
        <fieldset className="quote-fieldset full-field">
          <legend>Datos clínicos y administrativos de la cotización</legend>
          <div className="form-grid form-grid-compact">
            <label className="full-field">
              Diagnóstico
              <textarea
                data-action-id="QUOTE-DIAGNOSIS"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, diagnosisSummary: event.target.value }))
                }
                rows={2}
                value={draft.diagnosisSummary ?? ''}
              />
            </label>
            <label>
              Buscar médico por nombre
              <input
                data-action-id="QUOTE-DOCTOR-SEARCH"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, doctorQuery: event.target.value }))
                }
                type="search"
                value={draft.doctorQuery}
              />
            </label>
            <label>
              Médico tratante principal
              <select
                data-action-id="QUOTE-PRIMARY-DOCTOR"
                onChange={(event) => {
                  const doctorId = event.target.value;
                  const doctorName = doctors.find((doctor) => doctor.id === doctorId)?.fullName;
                  setDraft((current) => ({
                    ...current,
                    primaryDoctorId: doctorId,
                    items: current.items.map((line) =>
                      line.category === 'FEES' ? { ...line, doctorId, doctorName } : line,
                    ),
                  }));
                }}
                value={draft.primaryDoctorId ?? ''}
              >
                <option value="">Seleccione un médico</option>
                {doctors
                  .filter(
                    (doctor) =>
                      doctor.fullName
                        .toLocaleLowerCase('es-SV')
                        .includes(draft.doctorQuery.toLocaleLowerCase('es-SV')) ||
                      doctor.id === draft.primaryDoctorId ||
                      doctor.id === draft.secondaryDoctorId,
                  )
                  .map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.fullName}
                    </option>
                  ))}
              </select>
              {errors.primaryDoctorId ? (
                <span className="field-error" role="alert">
                  {errors.primaryDoctorId}
                </span>
              ) : null}
            </label>
            <label>
              Médico tratante secundario
              <select
                data-action-id="QUOTE-SECONDARY-DOCTOR"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, secondaryDoctorId: event.target.value }))
                }
                value={draft.secondaryDoctorId ?? ''}
              >
                <option value="">Sin asignar</option>
                {doctors
                  .filter(
                    (doctor) =>
                      doctor.fullName
                        .toLocaleLowerCase('es-SV')
                        .includes(draft.doctorQuery.toLocaleLowerCase('es-SV')) ||
                      doctor.id === draft.secondaryDoctorId,
                  )
                  .map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.fullName}
                    </option>
                  ))}
              </select>
              {errors.secondaryDoctorId ? (
                <span className="field-error" role="alert">
                  {errors.secondaryDoctorId}
                </span>
              ) : null}
            </label>
            <label>
              Tipo de cuenta
              <select
                data-action-id="QUOTE-ACCOUNT-TYPE"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    accountType: event.target.value as Quote['accountType'],
                  }))
                }
                value={draft.accountType ?? 'PARTICULAR'}
              >
                <option value="PARTICULAR">Particular</option>
                <option value="SEGURO">Seguro</option>
                <option value="EMPRESA">Empresa</option>
              </select>
            </label>
            <label>
              Aseguradora
              <select
                data-action-id="QUOTE-INSURER"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, insurer: event.target.value }))
                }
                value={draft.insurer ?? ''}
              >
                <option value="">Sin aseguradora</option>
                {catalogItems
                  .filter((entry) => entry.status === 'ACTIVE' && entry.category === 'INSURERS')
                  .map((entry) => (
                    <option key={entry.id} value={entry.name}>
                      {entry.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Fecha de ingreso
              <input
                data-action-id="QUOTE-ADMISSION-DATE"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, admissionDate: event.target.value }))
                }
                type="date"
                value={draft.admissionDate ?? ''}
              />
            </label>
            <label>
              Fecha de egreso
              <input
                data-action-id="QUOTE-DISCHARGE-DATE"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, dischargeDate: event.target.value }))
                }
                type="date"
                value={draft.dischargeDate ?? ''}
              />
              {errors.dischargeDate ? (
                <span className="field-error" role="alert">
                  {errors.dischargeDate}
                </span>
              ) : null}
            </label>
            <label>
              Responsable administrativo
              <input
                data-action-id="QUOTE-MANAGER"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, manager: event.target.value }))
                }
                value={draft.manager ?? ''}
              />
            </label>
            <label>
              Prioridad
              <select
                data-action-id="QUOTE-PRIORITY"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    priority: event.target.value as Quote['priority'],
                  }))
                }
                value={draft.priority ?? 'MEDIUM'}
              >
                <option value="LOW">Baja</option>
                <option value="MEDIUM">Media</option>
                <option value="HIGH">Alta</option>
              </select>
            </label>
            {draft.accountType === 'SEGURO' ? (
              <>
                <label>
                  Deducible declarado (USD)
                  <input
                    data-action-id="QUOTE-DEDUCTIBLE"
                    min="0"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        deductibleAmount: Number(event.target.value),
                      }))
                    }
                    step="0.01"
                    type="number"
                    value={draft.deductibleAmount ?? 0}
                  />
                </label>
                <label>
                  Coaseguro declarado (USD)
                  <input
                    data-action-id="QUOTE-COINSURANCE"
                    min="0"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        coinsuranceAmount: Number(event.target.value),
                      }))
                    }
                    step="0.01"
                    type="number"
                    value={draft.coinsuranceAmount ?? 0}
                  />
                </label>
              </>
            ) : null}
          </div>
          <p className="field-help">
            Deducible y coaseguro son importes declarados para esta versión. El equipo confirma la
            responsabilidad de pago; no se aplica ninguna regla automática de cobertura.
          </p>
        </fieldset>
        <label>
          Ingreso clínico
          <select
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                careSetting: event.target.value as Quote['careSetting'],
              }))
            }
            value={draft.careSetting ?? 'HOSPITALIZATION'}
          >
            <option value="HOSPITALIZATION">Hospitalización</option>
            <option value="HOME_OUTPATIENT">Ambulatorio en domicilio del paciente</option>
            <option value="CLINIC_OUTPATIENT">Ambulatorio en Analiza en Casa</option>
          </select>
        </label>
        <label>
          Hospitalización vinculada (opcional)
          <select
            disabled={mode !== 'create'}
            onChange={(event) =>
              setDraft((current) => ({ ...current, caseId: event.target.value }))
            }
            value={draft.caseId}
          >
            <option value="">Sin hospitalización · atención nueva</option>
            {compatibleCases.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.id} · {candidate.status}
              </option>
            ))}
          </select>
          <span className="field-help">
            Para pacientes nuevos puede guardar la cotización sin crear una hospitalización. Vincule
            una existente sólo cuando la cotización amplíe una atención ya registrada.
          </span>
          {errors.caseId ? <span className="field-error">{errors.caseId}</span> : null}
        </label>
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
              <p className="field-help full-field">
                Seleccione un servicio ya creado en el catálogo.
              </p>
            ) : null}
            {catalogCategory ? (
              <label>
                {activeCategory === 'SERVICES'
                  ? 'Servicio'
                  : activeCategory === 'STUDIES'
                    ? 'Servicio de Analiza Lab'
                    : activeCategory === 'EXTRAS'
                      ? 'Servicio de Analiza Fisio'
                      : activeCategory === 'IMAGING'
                        ? 'Servicio de Analiza Imágenes'
                        : activeCategory === 'MEDICATIONS'
                          ? 'Medicamento'
                          : activeCategory === 'SUPPLIES'
                            ? 'Insumo'
                            : 'Equipo'}
                <SearchableSelect
                  actionId="QUOTE-CATALOG-ITEM-SELECT"
                  ariaLabel={`Buscar ${
                    activeCategory === 'MEDICATIONS'
                      ? 'medicamento'
                      : activeCategory === 'SUPPLIES'
                        ? 'insumo'
                        : activeCategory === 'EQUIPMENT'
                          ? 'equipo'
                          : 'ítem de catálogo'
                  } por código o nombre`}
                  onChange={(value) => {
                    const selected = activeCatalog.find((entry) => entry.id === value);
                    setItem((current) => ({
                      ...current,
                      name: selected?.label ?? '',
                      inventoryItemId: selected?.id,
                      unitPrice: selected?.salePriceExcludingTax ?? 0,
                    }));
                  }}
                  options={activeCatalog.map((entry) => ({
                    value: entry.id,
                    label: entry.label,
                  }))}
                  placeholder="Escribe las iniciales, código o nombre"
                  value={item.inventoryItemId ?? ''}
                />
                {!activeCatalog.length ? (
                  <span className="field-help">Primero cree servicios activos en Catálogos.</span>
                ) : null}
              </label>
            ) : activeCategory !== 'FEES' ? (
              <label>
                Concepto
                <input
                  onChange={(event) =>
                    setItem((current) => ({ ...current, name: event.target.value }))
                  }
                  value={item.name}
                />
              </label>
            ) : null}
            {activeCategory === 'FEES' ? (
              <>
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
                  <input
                    readOnly
                    value={
                      doctors.find((doctor) => doctor.id === draft.primaryDoctorId)?.fullName ??
                      'Seleccione el médico tratante principal'
                    }
                  />
                </label>
              </>
            ) : null}
            {activeCategory === 'MEDICATIONS' ? (
              <div className="full-field">
                <span className="field-help">
                  {linkedInventoryItem
                    ? `${item.quantity} unidades indicadas · existencia actual ${linkedInventoryBalance ?? 0}. La presentación ya forma parte del nombre del catálogo.`
                    : 'Seleccione un medicamento para ver su existencia. La presentación se toma del catálogo.'}
                </span>
              </div>
            ) : null}
            <label>
              Cantidad <span aria-hidden="true">*</span>
              <input
                aria-required="true"
                inputMode="numeric"
                min="1"
                onChange={(event) => setNumber('quantity', event.target.value)}
                step="1"
                type="number"
                value={Number.isFinite(item.quantity) ? item.quantity : ''}
              />
              <span className="field-help">Use únicamente números enteros positivos.</span>
            </label>
            <label>
              {activeCategory === 'FEES' ? 'Honorario médico' : 'Precio de venta sin IVA'}
              {activeCategory === 'FEES' ? (
                <select
                  data-action-id="QUOTE-FEE-AMOUNT"
                  onChange={(event) => setNumber('unitPrice', event.target.value)}
                  value={item.unitPrice}
                >
                  {quoteMedicalFeeOptions.map((amount) => (
                    <option key={amount} value={amount}>
                      USD {amount.toFixed(2)}
                    </option>
                  ))}
                  {editingItemId &&
                  !(quoteMedicalFeeOptions as readonly number[]).includes(item.unitPrice) ? (
                    <option value={item.unitPrice}>
                      Histórico: USD {item.unitPrice.toFixed(2)}
                    </option>
                  ) : null}
                </select>
              ) : (
                <input
                  readOnly
                  type="text"
                  value={
                    item.inventoryItemId || editingItemId
                      ? money(item.unitPrice)
                      : 'Seleccione un ítem'
                  }
                />
              )}
              {activeCategory !== 'FEES' ? (
                <span className="field-help">
                  El precio proviene del catálogo y queda fijado al agregar la línea.
                </span>
              ) : null}
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
          <div
            aria-label="Todos los ítems anexados"
            className="table-wrap"
            role="region"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Concepto</th>
                  <th>Cantidad</th>
                  <th>Precio</th>
                  <th>Descuento de línea</th>
                  <th>Importe base</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {draft.items.map((candidate) => (
                  <tr key={candidate.id}>
                    <td>
                      {quoteCategories.find((category) => category.value === candidate.category)
                        ?.label ?? candidate.category}
                    </td>
                    <td>
                      {candidate.name}
                      {candidate.doctorName ? (
                        <>
                          <br />
                          <small>Médico: {candidate.doctorName}</small>
                        </>
                      ) : null}
                      {candidate.inventoryItemId ? (
                        <>
                          <br />
                          <small>
                            Catálogo:{' '}
                            {catalogItems.find(
                              (catalogItem) => catalogItem.id === candidate.inventoryItemId,
                            )?.sku ?? candidate.inventoryItemId}
                          </small>
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
                {!draft.items.length ? (
                  <tr>
                    <td colSpan={7}>Aún no hay ítems anexados a la cotización.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </fieldset>
        <fieldset className="quote-fieldset full-field">
          <legend>Descuento por categoría</legend>
          <div className="discount-preview" aria-live="polite">
            <span>Descuento aplicado</span>
            <strong>{money(totals.generalDiscountAmount)}</strong>
            <span>
              Total de la cotización <strong>{money(totals.total)}</strong>
            </span>
          </div>
          {draft.discount?.type === 'CATEGORY_PERCENTAGES' &&
          (draft.discount.value ?? 0) > 0 &&
          !draft.items.some((line) => (draft.discount?.categories?.[line.category] ?? 0) > 0) ? (
            <p className="field-help" role="status">
              El descuento es cero porque aún no hay líneas en las categorías seleccionadas.
              Seleccione una categoría con líneas o agregue los artículos correspondientes.
            </p>
          ) : null}
          {draft.discount && draft.discount.type !== 'CATEGORY_PERCENTAGES' ? (
            <p className="field-help">
              Descuento histórico conservado:{' '}
              {draft.discount.type === 'FIXED' ? 'monto fijo' : 'porcentaje'}. Al definir un
              porcentaje por categorías se reemplazará en esta nueva versión.
            </p>
          ) : null}
          <div className="form-grid form-grid-compact">
            <label>
              Porcentaje único
              <input
                data-action-id="QUOTE-DISCOUNT-UPDATE"
                inputMode="numeric"
                max="100"
                min="0"
                onChange={(event) => {
                  const percentage = Number(event.target.value);
                  setDraft((current) => ({
                    ...current,
                    discount: {
                      type: 'CATEGORY_PERCENTAGES',
                      value: percentage,
                      categories: Object.fromEntries(
                        Object.keys(current.discount?.categories ?? {}).map((key) => [
                          key,
                          percentage,
                        ]),
                      ) as Record<QuoteItemCategory, number>,
                    },
                  }));
                }}
                step="1"
                type="number"
                value={
                  draft.discount?.type === 'CATEGORY_PERCENTAGES' ? (draft.discount.value ?? 0) : 0
                }
              />
            </label>
            <fieldset className="full-field checkbox-fieldset discount-categories">
              <legend>Aplicar a estas categorías</legend>
              <div className="checkbox-grid">
                {quoteCategories.map((category) => (
                  <label className="checkbox-option" key={category.value}>
                    <input
                      checked={Object.prototype.hasOwnProperty.call(
                        draft.discount?.categories ?? {},
                        category.value,
                      )}
                      data-action-id="QUOTE-DISCOUNT-CATEGORY"
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setDraft((current) => {
                          const categories = { ...current.discount?.categories } as Record<
                            QuoteItemCategory,
                            number
                          >;
                          if (checked) categories[category.value] = current.discount?.value ?? 0;
                          else delete categories[category.value];
                          return {
                            ...current,
                            discount: {
                              type: 'CATEGORY_PERCENTAGES',
                              value:
                                current.discount?.type === 'CATEGORY_PERCENTAGES'
                                  ? (current.discount.value ?? 0)
                                  : 0,
                              categories,
                            },
                          };
                        });
                      }}
                      type="checkbox"
                    />{' '}
                    <span>
                      {category.label}
                      <small>
                        {draft.items.filter((line) => line.category === category.value).length}{' '}
                        líneas
                      </small>
                    </span>
                  </label>
                ))}
              </div>
              <p className="field-help">
                Seleccione las categorías de las líneas que desea descontar. Las demás conservan su
                precio.
              </p>
            </fieldset>
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
        {workspaceError ? (
          <p className="notice danger full-field" role="alert">
            No pudimos guardar: {workspaceError}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

export default function QuotesPage() {
  const { patients, payments, providerMode, quotes, refreshWorkspace } = useWorkspace();
  const { can, session } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('search') ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionBusy, setDecisionBusy] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, QuoteDecision>>({});
  const [rejecting, setRejecting] = useState<Quote | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const decisionKeys = useRef<Record<string, string>>({});
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
  useEffect(() => {
    if (providerMode !== 'postgresql' || !session) return;
    let active = true;
    void fetch('/api/quote-decisions', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudo cargar el estado de las cotizaciones.');
        const payload = (await response.json()) as { decisions: unknown[] };
        if (active)
          setDecisions(
            Object.fromEntries(
              payload.decisions.map((entry) => {
                const decision = quoteDecisionSchema.parse(entry);
                return [decision.quoteId, decision];
              }),
            ),
          );
      })
      .catch(() => {
        if (active) setDecisionError('No se pudo cargar el estado de aprobación.');
      });
    return () => {
      active = false;
    };
  }, [providerMode, session]);
  async function decide(quote: Quote, decision: 'APPROVED' | 'NOT_APPROVED', reason?: string) {
    if (providerMode !== 'postgresql' || !session) return;
    const key = decisionKeys.current[quote.id] ?? crypto.randomUUID();
    decisionKeys.current[quote.id] = key;
    setDecisionBusy(quote.id);
    setDecisionError(null);
    try {
      const response = await fetch(`/api/quotes/${encodeURIComponent(quote.id)}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...mongoMutationHeaders() },
        body: JSON.stringify({
          id: key,
          decision,
          reason: decision === 'APPROVED' ? null : reason,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? 'No se pudo guardar la decisión.');
      }
      const saved = quoteDecisionSchema.parse(await response.json());
      setDecisions((current) => ({ ...current, [quote.id]: saved }));
      setRejecting(null);
      setRejectionReason('');
      delete decisionKeys.current[quote.id];
      await refreshWorkspace();
      setMessage(
        decision === 'APPROVED'
          ? 'Cotización aprobada; la cuenta y, si corresponde, el ingreso clínico fueron actualizados.'
          : 'Motivo de rechazo guardado en el historial de la cotización.',
      );
    } catch (error) {
      setDecisionError(error instanceof Error ? error.message : 'No se pudo guardar la decisión.');
    } finally {
      setDecisionBusy(null);
    }
  }
  function close() {
    router.push('/quotes');
  }
  function saved(nextMessage: string) {
    setMessage(nextMessage);
    router.push('/quotes');
  }
  return (
    <div className="page-stack quotes-page">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Facturación</p>
          <h1>Cotizaciones</h1>
          <p>
            Crea, edita y envía cotizaciones con precios del catálogo e historial de versiones.
            Confirme precios, impuestos y cobertura antes de enviarlas.
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
      {decisionError ? (
        <p className="notice danger" role="alert">
          {decisionError}
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
                          <span title={quote.id}>{quoteDisplayCode(quote.id)}</span>
                          <br />
                          <small>v{quote.version}</small>
                        </td>
                        <td>
                          {patients.find((patient) => patient.id === quote.patientId)?.fullName ??
                            'No disponible'}
                          <br />
                          <small>{quote.caseId ?? 'Atención nueva sin hospitalización'}</small>
                        </td>
                        <td>{new Date(quote.createdAt).toLocaleString('es-SV')}</td>
                        <td>{money(quote.total)}</td>
                        <td>{money(quote.insurerAmount)}</td>
                        <td>{money(quote.patientAmount)}</td>
                        <td>{money(balance.balance)}</td>
                        <td>
                          <StatusTag
                            tone={
                              decisions[quote.id]?.decision === 'APPROVED' ? 'success' : 'warning'
                            }
                          >
                            {decisions[quote.id]?.decision === 'APPROVED'
                              ? 'Aprobada'
                              : decisions[quote.id]?.decision === 'NOT_APPROVED'
                                ? 'Rechazada'
                                : quote.immutable
                                  ? 'Enviada'
                                  : 'Borrador'}
                          </StatusTag>
                        </td>
                        <td>
                          <div className="action-row">
                            <Link
                              className="action-link-button action-link-button--compact"
                              data-action-id="QUOTE-DETAIL-NAVIGATE"
                              href={`/quotes/${quote.id}`}
                            >
                              Editar
                            </Link>
                            {providerMode === 'postgresql' ? (
                              <>
                                <Button
                                  data-action-id="QUOTE-APPROVE"
                                  disabled={
                                    Boolean(decisions[quote.id]) || decisionBusy === quote.id
                                  }
                                  onClick={() => void decide(quote, 'APPROVED')}
                                  type="button"
                                >
                                  Aprobada
                                </Button>
                                <Button
                                  className="button-secondary"
                                  data-action-id="QUOTE-REJECT"
                                  disabled={
                                    Boolean(decisions[quote.id]) || decisionBusy === quote.id
                                  }
                                  onClick={() => {
                                    setRejecting(quote);
                                    setRejectionReason('');
                                  }}
                                  type="button"
                                >
                                  Rechazada
                                </Button>
                              </>
                            ) : null}
                          </div>
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
      <Dialog
        description="Escriba el motivo del rechazo. Quedará registrado con usuario y fecha."
        onClose={() => setRejecting(null)}
        open={Boolean(rejecting)}
        title="Rechazar cotización"
      >
        <label>
          Motivo
          <textarea
            data-action-id="QUOTE-REJECTION-REASON"
            maxLength={1000}
            onChange={(event) => setRejectionReason(event.target.value)}
            rows={4}
            value={rejectionReason}
          />
        </label>
        <div className="action-row">
          <Button
            data-action-id="QUOTE-REJECTION-CONFIRM"
            disabled={!rejectionReason.trim() || Boolean(decisionBusy)}
            onClick={() => {
              if (rejecting) void decide(rejecting, 'NOT_APPROVED', rejectionReason.trim());
            }}
            type="button"
          >
            Guardar rechazo
          </Button>
        </div>
      </Dialog>
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
