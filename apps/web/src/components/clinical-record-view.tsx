'use client';
import {
  clinicalLabels,
  carePlanTypes,
  carePlanLabels,
  fluidColumns,
  fluidTotals,
  type ClinicalRecord,
} from '@analiza/contracts';

export function ClinicalRecordView({
  record,
  patientName,
  idPrefix = 'clinical-record',
}: {
  record: ClinicalRecord;
  patientName?: string;
  idPrefix?: string;
}) {
  const payload = record.payload;
  return (
    <article className="clinical-record-card" id={`${idPrefix}-${record.id}`}>
      <header>
        <div>
          <h3>
            {clinicalLabels[payload.kind]}
            {record.scaleDefinition ? ` · ${record.scaleDefinition.name}` : ''}
          </h3>
          <p>
            {patientName ?? record.patientId} · {record.caseId}
          </p>
          <p>
            {record.date} · {record.author} · Versión {record.version}
          </p>
        </div>
      </header>
      {payload.kind === 'CARE_PLAN' ? (
        <p className="clinical-plan-labels">
          {carePlanTypes(payload)
            .map((plan) => carePlanLabels[plan])
            .join(' · ')}
        </p>
      ) : null}
      {'summary' in payload && payload.summary ? (
        <p className="clinical-prose">{payload.summary}</p>
      ) : null}
      {payload.kind === 'MEDICATION_CARD' ? (
        <>
          <ul>
            {record.medications?.map((med) => (
              <li key={med.id}>
                {med.name}
                {med.chronic ? ' · Crónico' : ''}
              </li>
            ))}
          </ul>
          {payload.instructions ? <p className="clinical-prose">{payload.instructions}</p> : null}
        </>
      ) : null}
      {record.laboratories ? (
        <ul>
          {record.laboratories.map((name, i) => (
            <li key={i}>{name}</li>
          ))}
        </ul>
      ) : null}
      {payload.kind === 'FLUID_BALANCE' ? (
        <>
          <p>
            Diagnóstico: {payload.diagnosis || 'Sin registrar'} · Peso:{' '}
            {payload.weight || 'Sin registrar'}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Horario</th>
                  {fluidColumns.map((label) => (
                    <th key={label}>{label} (ml)</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payload.rows.map((row, i) => (
                  <tr key={i}>
                    <th>{row.time}</th>
                    {row.values.map((value, j) => (
                      <td key={j}>{value}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Agua endógena: {payload.endogenous} ml · Pérdidas insensibles: {payload.insensible} ml
          </p>
          <p>
            Ingresos: {fluidTotals(payload).intake} ml · Egresos: {fluidTotals(payload).output} ml ·
            BH en {payload.hours} horas: {fluidTotals(payload).balance} ml
          </p>
          <p>
            BH en 24 horas:{' '}
            {payload.hours === 24
              ? `${fluidTotals(payload).balance} ml`
              : 'Período parcial; no se extrapola.'}
          </p>
          <p>{payload.notes}</p>
        </>
      ) : null}
      {payload.kind === 'VITALS' ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {['Hora', 'FC', 'FR', 'SpO₂', 'Temperatura', 'PA', 'HGT'].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payload.rows.map((row, i) => (
                <tr key={i}>
                  {[
                    row.time,
                    row.heartRate,
                    row.respiratoryRate,
                    row.oxygen,
                    row.temperature,
                    row.pressure,
                    row.hgt,
                  ].map((value, j) => (
                    <td key={j}>{value || '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {payload.kind === 'NURSING_NOTE' ? (
        <>
          <p>JVPE: {record.jvpe || 'Pendiente en el perfil del autor'}</p>
          {payload.rows.map((row, i) => (
            <p className="clinical-prose" key={i}>
              <strong>{row.time}</strong> · {row.note}
            </p>
          ))}
        </>
      ) : null}
      {payload.kind === 'ADMINISTRATION' ? (
        <>
          <p>
            {payload.time} · Dosis registrada: {payload.dose} · {payload.presentation} · Vía{' '}
            {payload.route}
          </p>
          {payload.items.map((item) => (
            <p key={item.medicationId}>
              <strong>
                {record.medications?.find((med) => med.id === item.medicationId)?.name}
              </strong>{' '}
              · {item.applied ? 'Aplicado' : `No aplicado: ${item.reason}`}
            </p>
          ))}
        </>
      ) : null}
      {payload.kind === 'SCALE' ? (
        <>
          <dl className="clinical-values">
            {record.scaleDefinition?.items.map((item) => (
              <div key={item.id}>
                <dt>{item.label}</dt>
                <dd>
                  {payload.values[item.id]} ·{' '}
                  {item.options.find((option) => option.score === payload.values[item.id])?.label}
                </dd>
              </div>
            ))}
          </dl>
          {record.score !== null && record.score !== undefined ? (
            <p className="clinical-score">Puntuación: {record.score}</p>
          ) : (
            <p>Perfil por síntoma · sin suma global</p>
          )}
          <p>{payload.notes}</p>
          <small>Versión: {record.scaleDefinition?.version}</small>
        </>
      ) : null}
      {record.correctionOf ? (
        <p className="field-help">
          Corrección: {record.correctionReason}. Se conserva la versión anterior.
        </p>
      ) : null}
    </article>
  );
}
