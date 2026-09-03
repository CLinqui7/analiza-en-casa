'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { ClinicalDocument } from '@analiza/contracts';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth, useWorkspace } from '@/components/providers';

const documentSchema = z.object({
  caseId: z.string().min(1, 'Seleccione una hospitalización.'),
  title: z.string().trim().min(1, 'Indique un título.'),
  summary: z.string().trim().min(1, 'Ingrese un resumen.'),
  author: z.string().trim().min(1, 'Indique el autor responsable.'),
});
const correctionSchema = z.object({
  reason: z.string().trim().min(1, 'El motivo de corrección es obligatorio.'),
  summary: z.string().trim().min(1, 'Ingrese el nuevo resumen.'),
  author: z.string().trim().min(1, 'Indique el autor responsable.'),
});
type DocumentForm = z.infer<typeof documentSchema>;
type CorrectionForm = z.infer<typeof correctionSchema>;
type DocumentType = ClinicalDocument['type'];

const labels: Record<
  DocumentType,
  { heading: string; description: string; create: string; actionId: string }
> = {
  CARE_PLAN: {
    heading: 'Planes de cuidado',
    description:
      'Versiones sintéticas con firma explícita y correcciones auditadas. No establece intervenciones ni frecuencias sin reglas aprobadas.',
    create: 'Nuevo plan de cuidado',
    actionId: 'CARE-PLAN-CREATE',
  },
  CLINICAL_EVOLUTION: {
    heading: 'Evoluciones',
    description:
      'Seguimiento clínico sintético con firma explícita y correcciones auditadas. No clasifica ni infiere reglas clínicas.',
    create: 'Nueva evolución',
    actionId: 'EVOLUTION-CREATE',
  },
};

function statusLabel(status: ClinicalDocument['status']) {
  return status === 'SIGNED' ? 'Firmado e inmutable' : 'Borrador';
}

export function ClinicalDocumentsPage({ type }: { type: DocumentType }) {
  const {
    addClinicalDocument,
    clinicalDocuments,
    correctClinicalDocument,
    hospitalizations,
    patients,
    signClinicalDocument,
  } = useWorkspace();
  const { can } = useAuth();
  const copy = labels[type];
  const documents = clinicalDocuments
    .filter((document) => document.type === type)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const [createOpen, setCreateOpen] = useState(false);
  const [correcting, setCorrecting] = useState<ClinicalDocument | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<DocumentForm>({
    resolver: zodResolver(documentSchema),
    defaultValues: { caseId: hospitalizations[0]?.id ?? '', title: '', summary: '', author: '' },
  });
  const correctionForm = useForm<CorrectionForm>({
    resolver: zodResolver(correctionSchema),
    defaultValues: { reason: '', summary: '', author: '' },
  });
  const closeCreate = () => {
    setCreateOpen(false);
    form.reset({ caseId: hospitalizations[0]?.id ?? '', title: '', summary: '', author: '' });
  };
  const closeCorrection = () => {
    setCorrecting(null);
    correctionForm.reset();
  };
  const submit = (values: DocumentForm) => {
    const hospitalization = hospitalizations.find((candidate) => candidate.id === values.caseId);
    if (!hospitalization) {
      form.setError('caseId', {
        type: 'validate',
        message: 'La hospitalización no está disponible.',
      });
      return;
    }
    addClinicalDocument({
      id: crypto.randomUUID(),
      caseId: hospitalization.id,
      patientId: hospitalization.patientId,
      type,
      title: values.title,
      summary: values.summary,
      author: values.author,
      status: 'DRAFT',
      version: 1,
      createdAt: new Date().toISOString(),
    });
    setMessage('Documento clínico sintético persistido como borrador con evidencia de auditoría.');
    closeCreate();
  };
  const sign = (documentId: string) => {
    signClinicalDocument(documentId);
    setMessage(
      'Documento firmado e inmutable. Las correcciones crearán una nueva versión con motivo.',
    );
  };
  const submitCorrection = (values: CorrectionForm) => {
    if (!correcting) return;
    correctClinicalDocument(correcting.id, values.reason, values.summary, values.author);
    setMessage('Corrección creada como nuevo borrador; la versión firmada original se conserva.');
    closeCorrection();
  };
  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Clínico</p>
          <h1>{copy.heading}</h1>
          <p>{copy.description}</p>
        </div>
        {can('clinical:write') ? (
          <Button
            data-action-id={copy.actionId}
            onClick={() => {
              setMessage(null);
              setCreateOpen(true);
            }}
            type="button"
          >
            {copy.create}
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
          <h2>Versiones</h2>
          <StatusTag>{documents.length} registros</StatusTag>
        </div>
        {documents.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Paciente / hospitalización</th>
                  <th>Autor</th>
                  <th>Versión</th>
                  <th>Estado</th>
                  <th>Corrección</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td>
                      <strong>{document.title}</strong>
                      <br />
                      <span>{document.summary}</span>
                    </td>
                    <td>
                      {patients.find((patient) => patient.id === document.patientId)?.fullName ??
                        'No disponible'}
                      <br />
                      <code>{document.caseId}</code>
                    </td>
                    <td>{document.author}</td>
                    <td>v{document.version}</td>
                    <td>
                      <StatusTag tone={document.status === 'SIGNED' ? 'success' : 'warning'}>
                        {statusLabel(document.status)}
                      </StatusTag>
                    </td>
                    <td>{document.correctionOf ? `Motivo: ${document.correctionReason}` : '—'}</td>
                    <td>
                      {document.status === 'DRAFT' && can('clinical:sign') ? (
                        <Button
                          data-action-id="CLINICAL-DOCUMENT-SIGN"
                          className="button-secondary"
                          onClick={() => sign(document.id)}
                          type="button"
                        >
                          Firmar
                        </Button>
                      ) : document.status === 'SIGNED' && can('clinical:sign') ? (
                        <Button
                          data-action-id="CLINICAL-DOCUMENT-CORRECT"
                          className="button-secondary"
                          onClick={() => {
                            correctionForm.reset({
                              reason: '',
                              summary: document.summary,
                              author: document.author,
                            });
                            setCorrecting(document);
                          }}
                          type="button"
                        >
                          Corregir
                        </Button>
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
            detail="Cree un borrador dentro de una hospitalización sintética autorizada."
            title="Sin documentos"
          />
        )}
      </Panel>
      <Dialog
        description="La creación no infiere diagnósticos, tratamientos, dosis, frecuencias ni reglas clínicas."
        footer={
          <>
            <Button className="button-secondary" onClick={closeCreate} type="button">
              Cancelar
            </Button>
            <Button form="clinical-document-form" type="submit">
              Guardar borrador
            </Button>
          </>
        }
        onClose={closeCreate}
        open={createOpen}
        title={copy.create}
      >
        <form
          className="form-grid"
          id="clinical-document-form"
          noValidate
          onSubmit={form.handleSubmit(submit)}
        >
          <label>
            Hospitalización
            <select {...form.register('caseId')}>
              {hospitalizations.map((hospitalization) => (
                <option key={hospitalization.id} value={hospitalization.id}>
                  {hospitalization.id} ·{' '}
                  {patients.find((patient) => patient.id === hospitalization.patientId)?.fullName ??
                    'Paciente no disponible'}
                </option>
              ))}
            </select>
            {form.formState.errors.caseId ? (
              <span className="field-error">{form.formState.errors.caseId.message}</span>
            ) : null}
          </label>
          <label>
            Título
            <input {...form.register('title')} />
            {form.formState.errors.title ? (
              <span className="field-error">{form.formState.errors.title.message}</span>
            ) : null}
          </label>
          <label>
            Resumen sintético
            <textarea {...form.register('summary')} rows={4} />
            {form.formState.errors.summary ? (
              <span className="field-error">{form.formState.errors.summary.message}</span>
            ) : null}
          </label>
          <label>
            Autor responsable
            <input {...form.register('author')} />
            {form.formState.errors.author ? (
              <span className="field-error">{form.formState.errors.author.message}</span>
            ) : null}
          </label>
        </form>
      </Dialog>
      <Dialog
        description="La corrección crea una nueva versión en borrador. La versión firmada original no se altera."
        footer={
          <>
            <Button className="button-secondary" onClick={closeCorrection} type="button">
              Cancelar
            </Button>
            <Button form="clinical-correction-form" type="submit">
              Crear corrección
            </Button>
          </>
        }
        onClose={closeCorrection}
        open={Boolean(correcting)}
        title="Corrección autorizada"
      >
        <form
          className="form-grid"
          id="clinical-correction-form"
          noValidate
          onSubmit={correctionForm.handleSubmit(submitCorrection)}
        >
          <label>
            Motivo de corrección
            <textarea {...correctionForm.register('reason')} rows={2} />
            {correctionForm.formState.errors.reason ? (
              <span className="field-error">{correctionForm.formState.errors.reason.message}</span>
            ) : null}
          </label>
          <label>
            Nuevo resumen sintético
            <textarea {...correctionForm.register('summary')} rows={4} />
            {correctionForm.formState.errors.summary ? (
              <span className="field-error">{correctionForm.formState.errors.summary.message}</span>
            ) : null}
          </label>
          <label>
            Autor responsable
            <input {...correctionForm.register('author')} />
            {correctionForm.formState.errors.author ? (
              <span className="field-error">{correctionForm.formState.errors.author.message}</span>
            ) : null}
          </label>
        </form>
      </Dialog>
    </div>
  );
}
