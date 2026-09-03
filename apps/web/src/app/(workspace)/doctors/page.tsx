'use client';

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

const optionalEmailSchema = z
  .string()
  .trim()
  .refine(
    (value) => !value || z.string().email().safeParse(value).success,
    'Ingrese un correo electrónico válido.',
  );

const doctorFormSchema = z.object({
  fullName: z.string().trim().min(1, 'Ingrese el nombre del médico.'),
  jvpm: z.string().trim().min(1, 'Ingrese el número de JVPM.'),
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
  documentId: '',
  specialty: '',
  phone: '',
  email: '',
  address: '',
};

export default function DoctorsPage() {
  const { can } = useAuth();
  const { addDoctor, doctors, providerMode, updateDoctor } = useWorkspace();
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [attachments, setAttachments] = useState<Doctor['attachments']>([]);
  const [isOpen, setOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const form = useForm<DoctorForm>({
    resolver: zodResolver(doctorFormSchema),
    defaultValues: emptyDoctor,
  });
  const demoOnly = providerMode !== 'mock';

  function closeDialog() {
    form.reset(emptyDoctor);
    setAttachments([]);
    setEditingDoctor(null);
    setOpen(false);
  }
  function openCreate() {
    setResult(null);
    form.reset(emptyDoctor);
    setAttachments([]);
    setEditingDoctor(null);
    setOpen(true);
  }
  function openEdit(doctor: Doctor) {
    setResult(null);
    form.reset({
      fullName: doctor.fullName,
      jvpm: doctor.jvpm,
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
  function submit(values: DoctorForm) {
    const doctor: Doctor = {
      id: editingDoctor?.id ?? crypto.randomUUID(),
      ...values,
      phone: values.phone || undefined,
      email: values.email || undefined,
      attachments,
    };
    if (editingDoctor) updateDoctor(doctor);
    else addDoctor(doctor);
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
            href="/clinical/nursing"
          >
            Nuevo recurso
          </Link>
          {can('settings:write') && !demoOnly ? (
            <Button data-action-id="DOCTOR-CREATE" onClick={openCreate} type="button">
              Nuevo médico
            </Button>
          ) : null}
        </div>
      </header>
      {demoOnly ? (
        <p className="notice warning" role="status">
          El alta de médicos está disponible en el modo demo. La integración de Supabase requiere el
          mapeo organizacional y almacenamiento privado de archivos.
        </p>
      ) : null}
      {result ? (
        <p className="notice success" role="status">
          {result}
        </p>
      ) : null}
      {doctors.length ? (
        <Panel>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>JVPM</th>
                  <th>DUI</th>
                  <th>Especialidad / profesión</th>
                  <th>Archivos</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {doctors.map((doctor) => (
                  <tr key={doctor.id}>
                    <td>{doctor.fullName}</td>
                    <td>{doctor.jvpm}</td>
                    <td>{doctor.documentId}</td>
                    <td>{doctor.specialty}</td>
                    <td>
                      {doctor.attachments.length
                        ? doctor.attachments.map((attachment) => attachment.name).join(', ')
                        : 'Sin archivos'}
                    </td>
                    <td>
                      {can('settings:write') && !demoOnly ? (
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
        description="Los archivos conservan únicamente nombre, tipo y tamaño en el modo demo; su contenido requiere almacenamiento privado configurado."
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
            JVPM
            <input {...form.register('jvpm')} />
            {form.formState.errors.jvpm ? (
              <span className="field-error" role="alert">
                {form.formState.errors.jvpm.message}
              </span>
            ) : null}
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
                actionId="DOCTOR-SPECIALTY-SELECT"
                ariaLabel="Especialidad o profesión"
                onChange={field.onChange}
                options={doctorSpecialtyOptions}
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
