'use client';
import { isServerDataMode } from '@/lib/data-mode';

import { isCoreRelease } from '@/lib/release-profile';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Doctor } from '@analiza/contracts';
import { Button, Dialog, EmptyState, Panel } from '@analiza/ui';
import Link from 'next/link';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { SearchableSelect } from '@/components/common/searchable-select';
import { useAuth, useWorkspace } from '@/components/providers';
import { doctorSpecialtyOptions, toDoctorAttachmentMetadata } from '@/lib/doctor-catalog';
import { useOperations } from '@/lib/use-operations';
import {
  privateFileDownloadHref,
  type PrivateFileMetadata,
  uploadPrivateFiles,
} from '@/lib/private-files';

const optionalEmailSchema = z
  .string()
  .trim()
  .refine(
    (value) => !value || z.string().email().safeParse(value).success,
    'Ingrese un correo electrónico válido.',
  );

const doctorFormSchema = z.object({
  fullName: z.string().trim().min(1, 'Ingrese el nombre del médico.'),
  jvpm: z.string().trim(),
  conadem: z.string().trim(),
  medicalFee: z
    .string()
    .trim()
    .refine((value) => !value || Number(value) >= 0, 'Ingrese un honorario válido.'),
  documentId: z.string().trim().min(1, 'Ingrese el DUI.'),
  specialty: z.string().trim().min(1, 'Seleccione una especialidad o profesión.'),
  phone: z.string().trim(),
  email: optionalEmailSchema,
  address: z.string().trim().min(1, 'Ingrese la dirección.'),
});
type DoctorForm = z.infer<typeof doctorFormSchema>;

const emptyDoctor: DoctorForm = {
  fullName: '',
  jvpm: '',
  conadem: '',
  medicalFee: '',
  documentId: '',
  specialty: '',
  phone: '',
  email: '',
  address: '',
};

export default function DoctorsPage() {
  const operations = useOperations();
  const { can } = useAuth();
  const { addDoctor, doctors, providerMode, updateDoctor } = useWorkspace();
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [attachments, setAttachments] = useState<Doctor['attachments']>([]);
  const [pendingPrivateFiles, setPendingPrivateFiles] = useState<File[]>([]);
  const [privateFiles, setPrivateFiles] = useState<Record<string, PrivateFileMetadata[]>>({});
  const [isOpen, setOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [doctorQuery, setDoctorQuery] = useState('');
  const form = useForm<DoctorForm>({
    resolver: zodResolver(doctorFormSchema),
    defaultValues: emptyDoctor,
  });
  const mongoMode = isServerDataMode(providerMode);
  const visibleDoctors = doctors.filter((doctor) =>
    `${doctor.fullName} ${doctor.documentId} ${doctor.jvpm ?? ''} ${doctor.conadem ?? ''}`
      .toLocaleLowerCase('es')
      .includes(doctorQuery.trim().toLocaleLowerCase('es')),
  );

  function closeDialog() {
    form.reset(emptyDoctor);
    setAttachments([]);
    setPendingPrivateFiles([]);
    setEditingDoctor(null);
    setOpen(false);
  }
  function openCreate() {
    setResult(null);
    setActionError(null);
    form.reset(emptyDoctor);
    setAttachments([]);
    setEditingDoctor(null);
    setOpen(true);
  }
  function openEdit(doctor: Doctor) {
    setResult(null);
    setActionError(null);
    form.reset({
      fullName: doctor.fullName,
      jvpm: doctor.jvpm ?? '',
      conadem: doctor.conadem ?? '',
      medicalFee: doctor.medicalFee?.toString() ?? '',
      documentId: doctor.documentId,
      specialty: doctor.specialty,
      phone: doctor.phone ?? '',
      email: doctor.email ?? '',
      address: doctor.address,
    });
    setAttachments(doctor.attachments);
    setEditingDoctor(doctor);
    setOpen(true);
  }
  async function submit(values: DoctorForm) {
    const doctor: Doctor = {
      id: editingDoctor?.id ?? crypto.randomUUID(),
      ...values,
      jvpm: values.jvpm || undefined,
      conadem: values.conadem || undefined,
      medicalFee: values.medicalFee ? Number(values.medicalFee) : undefined,
      phone: values.phone || undefined,
      email: values.email || undefined,
      attachments: mongoMode ? [] : attachments,
    };
    const saved = editingDoctor ? await updateDoctor(doctor) : await addDoctor(doctor);
    if (!saved) return;
    if (mongoMode && pendingPrivateFiles.length) {
      try {
        const uploaded = await uploadPrivateFiles('doctor', doctor.id, pendingPrivateFiles);
        setPrivateFiles((current) => ({
          ...current,
          [doctor.id]: [...(current[doctor.id] ?? []), ...uploaded],
        }));
      } catch (cause) {
        setActionError(
          `El médico fue guardado, pero los archivos privados no se cargaron: ${
            cause instanceof Error ? cause.message : 'intente nuevamente desde Editar médico.'
          }`,
        );
      }
    }
    setResult(
      editingDoctor
        ? `Médico ${doctor.fullName} actualizado.`
        : `Médico ${doctor.fullName} registrado.`,
    );
    closeDialog();
  }

  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Administración · médicos y recursos</p>
          <h1>Médicos y recursos</h1>
          <p>Las altas de recursos y médicos son independientes.</p>
        </div>
        <div className="header-actions">
          <Link
            className="button button-secondary"
            data-action-id="DOCTOR-RESOURCE-CREATE"
            href={isCoreRelease ? '/nursing-team' : '/clinical/nursing'}
          >
            Nuevo recurso
          </Link>
          {can('settings:write') ? (
            <Button data-action-id="DOCTOR-CREATE" onClick={openCreate} type="button">
              Nuevo médico
            </Button>
          ) : null}
        </div>
      </header>
      {providerMode === 'mock' ? (
        <p className="notice warning">
          Los médicos y archivos en este modo son datos demo locales. No se presentan como
          integración compartida ni como almacenamiento privado.
        </p>
      ) : mongoMode ? (
        <p className="notice warning">
          En Mongo, guarde primero el médico. Los adjuntos privados se cargan por bytes mediante la
          ruta autorizada y no se registran sólo por nombre.
        </p>
      ) : null}
      {result ? (
        <p className="notice success" role="status">
          {result}
        </p>
      ) : null}
      {actionError ? (
        <p className="notice error" role="alert">
          {actionError}
        </p>
      ) : null}
      <label>
        Buscar médico por nombre, DUI, JVPM o CONADEM
        <input
          onChange={(event) => setDoctorQuery(event.target.value)}
          type="search"
          value={doctorQuery}
        />
      </label>
      {visibleDoctors.length ? (
        <Panel>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>JVPM</th>
                  <th>CONADEM</th>
                  <th>Honorario médico</th>
                  <th>DUI</th>
                  <th>Especialidad / profesión</th>
                  <th>Archivos</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {visibleDoctors.map((doctor) => (
                  <tr key={doctor.id}>
                    <td>{doctor.fullName}</td>
                    <td>{doctor.jvpm || 'No registrado'}</td>
                    <td>{doctor.conadem || 'No registrado'}</td>
                    <td>
                      {doctor.medicalFee === undefined
                        ? 'No registrado'
                        : `USD ${doctor.medicalFee.toFixed(2)}`}
                    </td>
                    <td>{doctor.documentId}</td>
                    <td>{doctor.specialty}</td>
                    <td>
                      {mongoMode && privateFiles[doctor.id]?.length
                        ? privateFiles[doctor.id].map((file) => (
                            <span key={file.id}>
                              <a href={privateFileDownloadHref(file.id)}>{file.name}</a>{' '}
                            </span>
                          ))
                        : doctor.attachments.length
                          ? doctor.attachments.map((attachment) => attachment.name).join(', ')
                          : 'Sin archivos'}
                    </td>
                    <td>
                      {can('settings:write') ? (
                        <Button
                          data-action-id="DOCTOR-EDIT"
                          onClick={() => openEdit(doctor)}
                          type="button"
                        >
                          Editar médico
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
        </Panel>
      ) : (
        <Panel>
          <EmptyState
            detail="Registre un médico o abra la alta independiente de recursos."
            title="Sin médicos registrados"
          />
        </Panel>
      )}
      <Dialog
        description={
          mongoMode
            ? 'Guarde el médico antes de cargar archivos privados. Un nombre de archivo no acredita una carga.'
            : 'Los archivos demo conservan únicamente nombre, tipo y tamaño; su contenido no se carga a un almacenamiento privado.'
        }
        footer={
          <>
            <Button className="button-secondary" onClick={closeDialog} type="button">
              Cancelar
            </Button>
            <Button
              data-action-id={editingDoctor ? 'DOCTOR-EDIT-SAVE' : 'DOCTOR-SAVE'}
              form="doctor-form"
              type="submit"
            >
              {editingDoctor ? 'Guardar cambios' : 'Guardar médico'}
            </Button>
          </>
        }
        onClose={closeDialog}
        open={isOpen}
        title={editingDoctor ? 'Editar médico' : 'Nuevo médico'}
      >
        <form
          className="form-grid"
          id="doctor-form"
          noValidate
          onSubmit={form.handleSubmit(submit)}
        >
          <label>
            Nombre completo
            <input {...form.register('fullName')} />
            {form.formState.errors.fullName ? (
              <span className="field-error" role="alert">
                {form.formState.errors.fullName.message}
              </span>
            ) : null}
          </label>
          <label>
            Honorario médico
            <input {...form.register('medicalFee')} min="0" step="0.01" type="number" />
            {form.formState.errors.medicalFee ? (
              <span className="field-error">{form.formState.errors.medicalFee.message}</span>
            ) : null}
          </label>
          <label>
            JVPM (opcional)
            <input {...form.register('jvpm')} />
            {form.formState.errors.jvpm ? (
              <span className="field-error" role="alert">
                {form.formState.errors.jvpm.message}
              </span>
            ) : null}
          </label>
          <label>
            CONADEM (opcional)
            <input {...form.register('conadem')} />
          </label>
          <label>
            DUI
            <input {...form.register('documentId')} />
            {form.formState.errors.documentId ? (
              <span className="field-error" role="alert">
                {form.formState.errors.documentId.message}
              </span>
            ) : null}
          </label>
          <Controller
            control={form.control}
            name="specialty"
            render={({ field }) => (
              <SearchableSelect
                allowCustom
                actionId="DOCTOR-SPECIALTY-SELECT"
                ariaLabel="Especialidad o profesión"
                onChange={field.onChange}
                options={[
                  ...doctorSpecialtyOptions,
                  ...(isServerDataMode(providerMode)
                    ? operations.configuration
                        .filter((entry) => entry.category === 'SPECIALTY' && entry.active)
                        .map((entry) => ({ value: entry.label, label: entry.label }))
                    : []),
                ].filter(
                  (option, index, all) =>
                    all.findIndex((candidate) => candidate.value === option.value) === index,
                )}
                placeholder="Buscar especialidad o profesión"
                value={field.value}
              />
            )}
          />
          {form.formState.errors.specialty ? (
            <span className="field-error" role="alert">
              {form.formState.errors.specialty.message}
            </span>
          ) : null}
          <label>
            Teléfono
            <input {...form.register('phone')} type="tel" />
          </label>
          <label>
            Correo
            <input {...form.register('email')} type="email" />
            {form.formState.errors.email ? (
              <span className="field-error" role="alert">
                {form.formState.errors.email.message}
              </span>
            ) : null}
          </label>
          <label>
            Dirección
            <textarea {...form.register('address')} rows={3} />
            {form.formState.errors.address ? (
              <span className="field-error" role="alert">
                {form.formState.errors.address.message}
              </span>
            ) : null}
          </label>
          {!mongoMode ? (
            <label>
              Archivos administrativos (demo)
              <input
                data-action-id="DOCTOR-ATTACHMENTS"
                multiple
                onChange={(event) =>
                  setAttachments(toDoctorAttachmentMetadata(event.currentTarget.files ?? []))
                }
                type="file"
              />
            </label>
          ) : (
            <label>
              Archivos administrativos privados
              <input
                data-action-id="DOCTOR-ATTACHMENTS"
                multiple
                onChange={(event) =>
                  setPendingPrivateFiles(Array.from(event.currentTarget.files ?? []))
                }
                type="file"
              />
              <span className="field-help">
                Los bytes se cargan después de guardar el médico y cada descarga vuelve a comprobar
                autorización.
              </span>
            </label>
          )}
          {attachments.length ? (
            <ul aria-label="Archivos seleccionados">
              {attachments.map((attachment) => (
                <li key={attachment.id}>
                  {attachment.name} ({attachment.size} bytes){' '}
                  <Button
                    aria-label={`Quitar ${attachment.name}`}
                    className="button-secondary"
                    onClick={() =>
                      setAttachments((current) =>
                        current.filter((item) => item.id !== attachment.id),
                      )
                    }
                    type="button"
                  >
                    Quitar
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="field-help">Sin archivos seleccionados.</p>
          )}
        </form>
      </Dialog>
    </div>
  );
}
