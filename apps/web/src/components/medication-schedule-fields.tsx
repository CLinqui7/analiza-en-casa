'use client';
import { Button } from '@analiza/ui';

export type MedicationScheduleDraft = { times: string[]; dilution: string };

export function MedicationScheduleFields({
  name,
  value,
  onChange,
}: {
  name: string;
  value: MedicationScheduleDraft;
  onChange: (value: MedicationScheduleDraft) => void;
}) {
  return (
    <fieldset className="medication-schedule-card">
      <legend>{name}</legend>
      <div className="medication-schedule-heading">
        <div>
          <strong>Horas de aplicación</strong>
          <p className="field-help">Registre las horas indicadas para este medicamento.</p>
        </div>
        <Button
          type="button"
          className="button-secondary"
          disabled={value.times.length >= 48}
          onClick={() => onChange({ ...value, times: [...value.times, ''] })}
        >
          Agregar hora
        </Button>
      </div>
      <div className="medication-time-list">
        {value.times.map((time, index) => (
          <div className="medication-time-field" key={index}>
            <label>
              Hora {index + 1}
              <input
                aria-label={`Hora ${index + 1} · ${name}`}
                type="time"
                required
                value={time}
                onChange={(event) =>
                  onChange({
                    ...value,
                    times: value.times.map((v, i) => (i === index ? event.target.value : v)),
                  })
                }
              />
            </label>
            {value.times.length > 1 ? (
              <Button
                type="button"
                className="button-secondary"
                aria-label={`Quitar hora ${index + 1} de ${name}`}
                onClick={() =>
                  onChange({ ...value, times: value.times.filter((_, i) => i !== index) })
                }
              >
                Quitar
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      <label>
        Dilución
        <textarea
          aria-label={`Dilución · ${name}`}
          rows={2}
          maxLength={8000}
          value={value.dilution}
          placeholder="Escriba la dilución indicada, si corresponde"
          onChange={(event) => onChange({ ...value, dilution: event.target.value })}
        />
      </label>
    </fieldset>
  );
}
