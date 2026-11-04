'use client';
import { useState, type FormEvent } from 'react';
import { Button, Dialog } from '@analiza/ui';
import {
  clinicalLabels,
  clinicalRecordInputSchema,
  clinicalScales,
  currentClinicalRecords,
  fluidColumns,
  fluidTotals,
  medicationPresentations,
  medicationRoutes,
  scoreScale,
  type ClinicalKind,
  type ClinicalPayload,
  type ClinicalRecord,
  type OperationsSnapshot,
} from '@analiza/contracts';
import { useWorkspace, useAuth } from './providers';
import { caseQuotes, clinicalDate } from '@/lib/clinical-queries';

type Operations = OperationsSnapshot & {
  busy: boolean;
  error: string | null;
  execute: (input: unknown) => Promise<boolean>;
};
const fluidTimes = [
  'Día · 7–10',
  'Día · 11–2',
  'Día · 3–6',
  'Noche · 7–10',
  'Noche · 11–2',
  'Noche · 3–6',
];
export function ClinicalRecordEditor({
  kind,
  patient: initialPatient = '',
  original,
  operations,
  onClose,
  onSaved,
}: {
  kind: ClinicalKind;
  patient?: string;
  original?: ClinicalRecord;
  operations: Operations;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { patients, hospitalizations, quotes, nursingResources } = useWorkspace();
  const { session } = useAuth();
  const [patientId, setPatientId] = useState(original?.patientId ?? initialPatient);
  const [caseId, setCaseId] = useState(original?.caseId ?? '');
  const [caseQuery, setCaseQuery] = useState('');
  const [id] = useState(() => crypto.randomUUID());
  const [error, setError] = useState('');
  const [rowCount, setRowCount] = useState(
    original && 'rows' in original.payload ? original.payload.rows.length : 1,
  );
  const [scaleId, setScaleId] = useState(
    original?.payload.kind === 'SCALE' ? original.payload.scaleId : 'EVA',
  );
  const [scaleValues, setScaleValues] = useState<Record<string, number>>(
    original?.payload.kind === 'SCALE' ? original.payload.values : {},
  );
  const [plan, setPlan] = useState(
    original?.payload.kind === 'CARE_PLAN' ? original.payload.plan : 'DIET',
  );
  const [fluid, setFluid] = useState<Extract<ClinicalPayload, { kind: 'FLUID_BALANCE' }>>(
    original?.payload.kind === 'FLUID_BALANCE'
      ? original.payload
      : {
          kind: 'FLUID_BALANCE',
          diagnosis: '',
          weight: '',
          rows: fluidTimes.map((time) => ({ time, values: Array(9).fill(0) })),
          endogenous: 0,
          insensible: 0,
          hours: 24,
          notes: '',
        },
  );
  const hospitalization = hospitalizations.find(
    (record) => record.id === caseId && record.patientId === patientId,
  );
  const selectedQuotes = caseQuotes(quotes, hospitalization);
  const diagnosis =
    selectedQuotes[0]?.diagnosisSummary ??
    hospitalization?.diagnosisSummary ??
    patients.find((patient) => patient.id === patientId)?.diagnosis ??
    '';
  const quotedMeds = selectedQuotes.flatMap((quote) =>
    quote.items
      .filter((item) => item.category === 'MEDICATIONS')
      .map((item) => ({ ...item, key: `${quote.id}:${item.id}` })),
  );
  const laboratories = selectedQuotes.flatMap((quote) =>
    quote.items.filter((item) => item.category === 'STUDIES'),
  );
  const diagnosisConfig = operations.configuration.find(
    (entry) => entry.category === 'DIAGNOSIS' && entry.active && entry.label === diagnosis,
  );
  const scales = clinicalScales
    .map(
      (scale) =>
        operations.configuration.find(
          (entry) =>
            entry.active && entry.category === 'SCALE' && entry.scaleDefinition?.id === scale.id,
        )?.scaleDefinition ?? scale,
    )
    .filter(
      (scale) => !diagnosisConfig?.scaleIds?.length || diagnosisConfig.scaleIds.includes(scale.id),
    );
  const selectedScale = scales.find((scale) => scale.id === scaleId) ?? scales[0];
  const cards = currentClinicalRecords(operations.clinicalRecords).filter(
    (record) => record.caseId === caseId && record.payload.kind === 'MEDICATION_CARD',
  );
  const card = cards[0];
  const nurse = nursingResources.find((resource) => resource.userId === session?.userId);
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [jvpe, setJvpe] = useState(operations.currentJvpe || nurse?.boardRegistrationNumber || '');
  function changeCase(value: string) {
    setCaseId(value);
    setScaleValues({});
    setApplied({});
    setRowCount(1);
    setError('');
    if (!original)
      setFluid({
        kind: 'FLUID_BALANCE',
        diagnosis: '',
        weight: '',
        rows: fluidTimes.map((time) => ({ time, values: Array(9).fill(0) })),
        endogenous: 0,
        insensible: 0,
        hours: 24,
        notes: '',
      });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? '').trim();
    let payload: ClinicalPayload;
    if (kind === 'MEDICATION_CARD')
      payload = {
        kind,
        chronic: value('chronic'),
        instructions: value('instructions'),
        stock: quotedMeds
          .filter((med) => value(`stock-item-${med.key}`))
          .map((med) => ({
            quoteItemId: med.key,
            inventoryItemId: value(`stock-item-${med.key}`),
            warehouseId: value(`stock-warehouse-${med.key}`),
            unitsPerApplication: Number(value(`stock-units-${med.key}`)),
          })),
      };
    else if (kind === 'FLUID_BALANCE')
      payload = {
        ...fluid,
        diagnosis: value('diagnosis'),
        weight: value('weight'),
        notes: value('notes'),
      };
    else if (kind === 'CARE_PLAN') payload = { kind, plan, summary: value('summary') };
    else if (kind === 'VITALS')
      payload = {
        kind,
        rows: Array.from({ length: rowCount }, (_, i) => ({
          time: value(`time-${i}`),
          heartRate: value(`heartRate-${i}`),
          respiratoryRate: value(`respiratoryRate-${i}`),
          oxygen: value(`oxygen-${i}`),
          temperature: value(`temperature-${i}`),
          pressure: value(`pressure-${i}`),
          hgt: value(`hgt-${i}`),
        })),
      };
    else if (kind === 'NURSING_NOTE')
      payload = {
        kind,
        rows: Array.from({ length: rowCount }, (_, i) => ({
          time: value(`time-${i}`),
          note: value(`note-${i}`),
        })),
      };
    else if (kind === 'SCALE')
      payload = {
        kind,
        scaleId: selectedScale.id,
        definitionVersion: selectedScale.version,
        values: scaleValues,
        notes: value('notes'),
      };
    else if (kind === 'ADMINISTRATION')
      payload = {
        kind,
        cardId: card?.id ?? '',
        time: value('time'),
        dose: value('dose'),
        presentation: value('presentation') as (typeof medicationPresentations)[number],
        route: value('route') as (typeof medicationRoutes)[number],
        items: (card?.medications ?? [])
          .filter((medication) => applied[medication.id])
          .map((medication) => ({
            medicationId: medication.id,
            applied: applied[medication.id] === 'yes',
            reason: value(`reason-${medication.id}`),
          })),
      };
    else payload = { kind, summary: value('summary') };
    if (payload.kind === 'ADMINISTRATION' && (!card || !payload.items.length)) {
      setError(
        !card
          ? 'Cree y guarde la tarjeta de medicamentos de esta hospitalización antes de registrar una aplicación.'
          : 'Marque al menos un medicamento como aplicado o no aplicado.',
      );
      return;
    }
    if (
      payload.kind === 'MEDICATION_CARD' &&
      payload.stock.some(
        (entry) =>
          !entry.warehouseId ||
          !Number.isInteger(entry.unitsPerApplication) ||
          entry.unitsPerApplication < 1,
      )
    ) {
      setError(
        'Complete el origen y las unidades por aplicación de cada medicamento asignado al inventario.',
      );
      return;
    }
    const parsed = clinicalRecordInputSchema.safeParse({
      id,
      patientId,
      caseId,
      date: value('date'),
      payload,
      ...(original
        ? { correctionOf: original.id, correctionReason: value('correctionReason') }
        : {}),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (kind === 'SCALE') {
      try {
        scoreScale(selectedScale, scaleValues);
      } catch (cause) {
        setError((cause as Error).message);
        return;
      }
    }
    if (await operations.execute({ command: 'clinical.record', record: parsed.data })) onSaved();
  }
  return (
    <Dialog
      open
      title={`${original ? 'Actualizar' : 'Registrar'} · ${clinicalLabels[kind]}`}
      description="Seleccione el paciente y su hospitalización. Los datos quedarán disponibles en el expediente."
      onClose={() => !operations.busy && onClose()}
      footer={
        <>
          <Button className="button-secondary" onClick={onClose} disabled={operations.busy}>
            Cancelar
          </Button>
          <Button form="clinical-record-form" type="submit" disabled={operations.busy}>
            {operations.busy ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="clinical-record-form" className="clinical-editor" onSubmit={submit}>
        <fieldset className="form-grid">
          <legend>Paciente y atención</legend>
          <label>
            Paciente
            <select
              value={patientId}
              disabled={!!original}
              required
              onChange={(event) => {
                setPatientId(event.target.value);
                setCaseQuery('');
                changeCase('');
              }}
            >
              <option value="">Seleccione paciente</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.fullName} · {patient.documentId}
                </option>
              ))}
            </select>
          </label>
          <label>
            Filtrar hospitalizaciones por paciente, DUI o código
            <input
              type="search"
              value={caseQuery}
              onChange={(event) => setCaseQuery(event.target.value)}
            />
          </label>
          <label>
            Hospitalización
            <select
              value={caseId}
              disabled={!!original}
              required
              onChange={(event) => changeCase(event.target.value)}
            >
              <option value="">Seleccione hospitalización</option>
              {hospitalizations
                .filter(
                  (record) =>
                    record.patientId === patientId &&
                    (record.id === caseId ||
                      `${record.id} ${patients.find((p) => p.id === patientId)?.fullName ?? ''} ${patients.find((p) => p.id === patientId)?.documentId ?? ''}`
                        .toLocaleLowerCase('es')
                        .includes(caseQuery.toLocaleLowerCase('es'))),
                )
                .map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.id} · {record.startDate}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Fecha
            <input
              name="date"
              type="date"
              required
              defaultValue={original?.date ?? clinicalDate()}
            />
          </label>
          {original ? (
            <label>
              Motivo de actualización
              <input name="correctionReason" required maxLength={12000} />
            </label>
          ) : null}
        </fieldset>
        <div key={`${caseId}:${kind}`} className="clinical-editor-body">
          {['INDICATION', 'EVOLUTION', 'HISTORY', 'BACKGROUND'].includes(kind) ? (
            <label>
              Resumen
              <textarea
                name="summary"
                rows={7}
                required
                defaultValue={
                  original && 'summary' in original.payload ? original.payload.summary : ''
                }
              />
            </label>
          ) : null}
          {kind === 'MEDICATION_CARD' ? (
            <>
              <h3>Medicamentos de la cotización</h3>
              {quotedMeds.length ? (
                quotedMeds.map((med) => {
                  const stock =
                    original?.payload.kind === 'MEDICATION_CARD'
                      ? original.payload.stock.find((item) => item.quoteItemId === med.key)
                      : undefined;
                  return (
                    <fieldset key={med.key}>
                      <legend>{med.name}</legend>
                      <p className="field-help">
                        Configure el consumo de inventario por aplicación; la dosis se registra por
                        separado.
                      </p>
                      <div className="form-grid">
                        <label>
                          Artículo de inventario
                          <select
                            name={`stock-item-${med.key}`}
                            defaultValue={stock?.inventoryItemId ?? ''}
                          >
                            <option value="">Completar después</option>
                            {operations.clinicalStockItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Origen del inventario
                          <select
                            name={`stock-warehouse-${med.key}`}
                            defaultValue={stock?.warehouseId ?? ''}
                          >
                            <option value="">Seleccione origen</option>
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
                            name={`stock-units-${med.key}`}
                            type="number"
                            min={1}
                            step={1}
                            defaultValue={stock?.unitsPerApplication ?? ''}
                          />
                        </label>
                      </div>
                    </fieldset>
                  );
                })
              ) : (
                <p className="notice">
                  La hospitalización no tiene medicamentos cotizados. Puede registrar los crónicos.
                </p>
              )}
              <label>
                Crónicos
                <textarea
                  name="chronic"
                  rows={3}
                  placeholder="Un medicamento por línea"
                  defaultValue={
                    original?.payload.kind === 'MEDICATION_CARD' ? original.payload.chronic : ''
                  }
                />
              </label>
              <label>
                Indicaciones, dosis, horarios, inicio, duración o diluciones
                <textarea
                  name="instructions"
                  rows={4}
                  defaultValue={
                    original?.payload.kind === 'MEDICATION_CARD'
                      ? original.payload.instructions
                      : ''
                  }
                />
              </label>
            </>
          ) : null}
          {kind === 'FLUID_BALANCE' ? (
            <>
              <div className="form-grid">
                <label>
                  Diagnóstico
                  <input
                    name="diagnosis"
                    defaultValue={
                      original?.payload.kind === 'FLUID_BALANCE'
                        ? original.payload.diagnosis
                        : diagnosis
                    }
                  />
                </label>
                <label>
                  Peso
                  <input
                    name="weight"
                    defaultValue={
                      original?.payload.kind === 'FLUID_BALANCE' ? original.payload.weight : ''
                    }
                    placeholder="Ingrese valor y unidad"
                  />
                </label>
              </div>
              <div className="clinical-fluid-grid">
                {fluid.rows.map((row, i) => (
                  <fieldset key={i}>
                    <legend>{row.time}</legend>
                    <div className="clinical-volume-fields">
                      {fluidColumns.map((column, j) => (
                        <label key={column}>
                          {column} · ml
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.values[j]}
                            onChange={(event) =>
                              setFluid((current) => ({
                                ...current,
                                rows: current.rows.map((candidate, k) =>
                                  k === i
                                    ? {
                                        ...candidate,
                                        values: candidate.values.map((v, l) =>
                                          l === j ? Number(event.target.value) : v,
                                        ),
                                      }
                                    : candidate,
                                ),
                              }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
              <div className="form-grid">
                {(['endogenous', 'insensible', 'hours'] as const).map((key) => (
                  <label key={key}>
                    {
                      {
                        endogenous: 'Agua endógena · ml',
                        insensible: 'Pérdidas insensibles · ml',
                        hours: 'Horas del balance',
                      }[key]
                    }
                    <input
                      type="number"
                      min={key === 'hours' ? 1 : 0}
                      max={key === 'hours' ? 24 : 100000}
                      step="0.01"
                      value={fluid[key]}
                      onChange={(event) =>
                        setFluid((current) => ({ ...current, [key]: Number(event.target.value) }))
                      }
                    />
                  </label>
                ))}
              </div>
              <output className="clinical-totals">
                Ingresos: {fluidTotals(fluid).intake} ml · Egresos: {fluidTotals(fluid).output} ml ·
                Balance: {fluidTotals(fluid).balance} ml
              </output>
              <label>
                Observaciones
                <textarea name="notes" defaultValue={fluid.notes} />
              </label>
            </>
          ) : null}
          {kind === 'CARE_PLAN' ? (
            <>
              <label>
                Plan
                <select
                  value={plan}
                  onChange={(event) => setPlan(event.target.value as typeof plan)}
                >
                  <option value="DIET">Dieta</option>
                  <option value="NURSING">Cuidado de enfermería</option>
                  <option value="LABORATORY">Laboratorio</option>
                </select>
              </label>
              {plan === 'LABORATORY' ? (
                <ul>
                  {laboratories.length ? (
                    laboratories.map((item) => <li key={item.id}>{item.name}</li>)
                  ) : (
                    <li>No hay laboratorios en la cotización seleccionada.</li>
                  )}
                </ul>
              ) : (
                <label>
                  Descripción
                  <textarea
                    name="summary"
                    required
                    rows={6}
                    defaultValue={
                      original?.payload.kind === 'CARE_PLAN' ? original.payload.summary : ''
                    }
                  />
                </label>
              )}
            </>
          ) : null}
          {kind === 'VITALS' || kind === 'NURSING_NOTE' ? (
            <>
              {kind === 'NURSING_NOTE' ? (
                <p className="notice">
                  JVPE del autor:{' '}
                  {operations.currentJvpe ||
                    nurse?.boardRegistrationNumber ||
                    'Pendiente de completar en Equipo y cuentas'}
                  . Se obtiene de su perfil al guardar.
                </p>
              ) : null}
              {kind === 'NURSING_NOTE' ? (
                <div className="form-grid">
                  <label>
                    Completar mi JVPE
                    <input
                      inputMode="numeric"
                      pattern="[0-9]+"
                      value={jvpe}
                      onChange={(event) => setJvpe(event.target.value)}
                    />
                  </label>
                  <Button
                    type="button"
                    className="button-secondary clinical-add-row"
                    disabled={operations.busy || !/^\d{1,30}$/.test(jvpe)}
                    onClick={() => operations.execute({ command: 'clinical.jvpe.save', jvpe })}
                  >
                    Actualizar mi perfil
                  </Button>
                </div>
              ) : null}
              {Array.from({ length: rowCount }, (_, i) => {
                const previous =
                  original &&
                  (original.payload.kind === 'VITALS' || original.payload.kind === 'NURSING_NOTE')
                    ? original.payload.rows[i]
                    : undefined;
                return (
                  <fieldset key={i}>
                    <legend>Registro {i + 1}</legend>
                    <div className="form-grid">
                      <label>
                        Hora
                        <input
                          name={`time-${i}`}
                          type="time"
                          required
                          defaultValue={previous?.time}
                        />
                      </label>
                      {kind === 'VITALS' ? (
                        Object.entries({
                          heartRate: 'Frecuencia cardíaca',
                          respiratoryRate: 'Frecuencia respiratoria',
                          oxygen: 'Saturación de oxígeno',
                          temperature: 'Temperatura',
                          pressure: 'Presión arterial',
                          hgt: 'HGT',
                        }).map(([key, label]) => (
                          <label key={key}>
                            {label}
                            <input
                              name={`${key}-${i}`}
                              maxLength={100}
                              defaultValue={
                                previous && key in previous
                                  ? String(previous[key as keyof typeof previous])
                                  : ''
                              }
                            />
                          </label>
                        ))
                      ) : (
                        <label className="full-field">
                          Nota
                          <textarea
                            name={`note-${i}`}
                            required
                            rows={3}
                            defaultValue={previous && 'note' in previous ? previous.note : ''}
                          />
                        </label>
                      )}
                    </div>
                  </fieldset>
                );
              })}
              <Button
                type="button"
                className="button-secondary clinical-add-row"
                disabled={rowCount >= 100}
                onClick={() => setRowCount((count) => count + 1)}
              >
                Agregar registro
              </Button>
            </>
          ) : null}
          {kind === 'SCALE' ? (
            <>
              <p className="field-help">
                Diagnóstico: {diagnosis || 'Sin registrar'}.{' '}
                {diagnosisConfig?.scaleIds?.length
                  ? 'Se muestran las escalas vinculadas.'
                  : 'Sin vínculo configurado; puede elegir cualquier escala.'}
              </p>
              <label>
                Escala
                <select
                  value={selectedScale.id}
                  onChange={(event) => {
                    setScaleId(event.target.value as typeof scaleId);
                    setScaleValues({});
                  }}
                >
                  {scales.map((scale) => (
                    <option key={scale.id} value={scale.id}>
                      {scale.name}
                    </option>
                  ))}
                </select>
              </label>
              {selectedScale.items.map((item) => (
                <fieldset key={`${selectedScale.id}:${item.id}`}>
                  <legend>{item.label}</legend>
                  <div className="clinical-scale-options">
                    {item.options.map((option) => (
                      <label key={option.score}>
                        <input
                          type="radio"
                          name={`scale-${item.id}`}
                          required
                          checked={scaleValues[item.id] === option.score}
                          onChange={() =>
                            setScaleValues((current) => ({ ...current, [item.id]: option.score }))
                          }
                        />
                        <strong>{option.score}</strong>
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <output className="clinical-totals">
                {selectedScale.items.every((item) => scaleValues[item.id] !== undefined)
                  ? selectedScale.aggregation === 'PROFILE'
                    ? 'Perfil completo · sin suma global'
                    : `Puntuación: ${scoreScale(selectedScale, scaleValues)}`
                  : 'Complete los campos para ver la puntuación.'}
              </output>
              <label>
                Observaciones
                <textarea
                  name="notes"
                  defaultValue={original?.payload.kind === 'SCALE' ? original.payload.notes : ''}
                />
              </label>
            </>
          ) : null}
          {kind === 'ADMINISTRATION' ? (
            card ? (
              <>
                <p className="notice">
                  Los crónicos no modifican inventario ni cotización. Para modificar el origen o las
                  unidades, actualice la tarjeta de medicamentos.
                </p>
                <div className="form-grid">
                  <label>
                    Hora
                    <input type="time" name="time" required />
                  </label>
                  <label>
                    Dosis
                    <input name="dose" required />
                  </label>
                  <label>
                    Presentación
                    <select name="presentation" required>
                      <option value="">Seleccione</option>
                      {medicationPresentations.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Vía de administración
                    <select name="route" required>
                      <option value="">Seleccione</option>
                      {medicationRoutes.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <p>
                  Marque los medicamentos de esta administración. Los que deje sin registrar no se
                  modificarán.
                </p>
                {card.medications?.map((med) => (
                  <fieldset key={med.id}>
                    <legend>
                      {med.name}
                      {med.chronic ? ' · Crónico' : ''}
                    </legend>
                    <label>
                      Aplicación · {med.name}
                      <select
                        value={applied[med.id] ?? ''}
                        onChange={(event) =>
                          setApplied({ ...applied, [med.id]: event.target.value })
                        }
                      >
                        <option value="">Sin registrar en esta atención</option>
                        <option value="yes">Se aplicó</option>
                        <option value="no">No se aplicó</option>
                      </select>
                    </label>
                    {applied[med.id] === 'no' ? (
                      <label>
                        Motivo de no aplicación · {med.name}
                        <textarea name={`reason-${med.id}`} required />
                      </label>
                    ) : null}
                  </fieldset>
                ))}
              </>
            ) : (
              <p className="notice">
                Cree la tarjeta de medicamentos de esta hospitalización antes de registrar la
                aplicación.
              </p>
            )
          ) : null}
        </div>
        {error || operations.error ? (
          <p role="alert" className="notice error">
            {error || operations.error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
