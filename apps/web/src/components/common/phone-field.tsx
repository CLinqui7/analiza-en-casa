'use client';

import { useState } from 'react';
import {
  composePhone,
  formatNationalPhone,
  phoneCountries,
  splitPhone,
  type PhoneCountry,
} from '@/lib/phone-number';

type PhoneFieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  required?: boolean;
};

export function PhoneField({
  label,
  name,
  value,
  onChange,
  onBlur,
  error,
  required = false,
}: PhoneFieldProps) {
  const parsed = splitPhone(value);
  const [countrySelection, setCountrySelection] = useState<{
    sourceValue: string;
    country: PhoneCountry | '';
  } | null>(null);
  const country = countrySelection?.sourceValue === value ? countrySelection.country : parsed.country;
  // An unrecognized international prefix cannot safely be treated as national digits.
  const unknownInternationalPrefix = value.trim().startsWith('+') && !parsed.country;
  const national = unknownInternationalPrefix ? '' : parsed.national;
  const inputId = `phone-${name.replace(/[^a-z0-9]/gi, '-')}`;
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;

  return (
    <div className="phone-field">
      <label htmlFor={inputId}>
        {label} {required ? <span className="required-marker">*</span> : null}
      </label>
      <div className="phone-field-controls">
        <select
          aria-label={`${label}: país`}
          onChange={(event) => {
            const selected = event.target.value as PhoneCountry | '';
            setCountrySelection({ sourceValue: value, country: selected });
            if (selected) onChange(composePhone(selected, national));
          }}
          value={country}
        >
          <option value="">Seleccione país</option>
          {phoneCountries.map((entry) => (
            <option key={entry.iso} value={entry.iso}>
              {entry.name} (+{entry.code})
            </option>
          ))}
        </select>
        <input
          aria-describedby={`${helpId}${error ? ` ${errorId}` : ''}`}
          aria-invalid={Boolean(error)}
          autoComplete="tel-national"
          disabled={!country}
          id={inputId}
          inputMode="tel"
          name={name}
          onBlur={onBlur}
          onChange={(event) => {
            if (!country) return;
            const next = composePhone(country, event.target.value);
            if (!next) setCountrySelection({ sourceValue: '', country });
            onChange(next);
          }}
          placeholder="Solo números"
          type="tel"
          value={formatNationalPhone(national)}
        />
      </div>
      <small className="field-help" id={helpId}>
        Elige el país; el prefijo y los guiones se agregan automáticamente.
        {unknownInternationalPrefix
          ? ` El prefijo anterior de ${value} no está en la lista: elige el país y escribe el número nacional de nuevo.`
          : !country && value
            ? ' Este número antiguo necesita un país confirmado antes de guardarse.'
            : ''}
      </small>
      {error ? (
        <span className="field-error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
