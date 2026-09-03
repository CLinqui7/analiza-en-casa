'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { searchOptions, type SearchableOption } from '@/lib/patient-form';

type Props = {
  actionId?: string;
  ariaLabel: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  options: readonly SearchableOption[];
  placeholder?: string;
  value: string;
};

export function SearchableSelect({
  actionId,
  ariaLabel,
  disabled,
  onChange,
  options,
  placeholder = 'Buscar en catálogo demo',
  value,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const visible = useMemo(() => searchOptions(options, query), [options, query]);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function choose(next: string) {
    onChange(next);
    setQuery('');
    setOpen(false);
  }
  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, Math.max(visible.length - 1, 0)));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.max(index - 1, 0));
    }
    if (event.key === 'Enter' && open && visible[activeIndex]) {
      event.preventDefault();
      choose(visible[activeIndex].value);
    }
  }

  return (
    <div className="searchable-select" ref={root}>
      <div className="searchable-select-input">
        <input
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          aria-label={ariaLabel}
          data-action-id={actionId}
          disabled={disabled}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            if (query.trim() && !selected) onChange(query.trim());
          }}
          onKeyDown={onKeyDown}
          placeholder={selected?.label ?? placeholder}
          role="combobox"
          value={query}
        />
        {value ? (
          <button
            aria-label={`Limpiar ${ariaLabel}`}
            className="icon-button"
            onClick={() => choose('')}
            type="button"
          >
            ×
          </button>
        ) : null}
      </div>
      {open ? (
        <ul className="searchable-select-options" id={listId} role="listbox">
          {visible.length ? (
            visible.map((option, index) => (
              <li
                aria-selected={option.value === value}
                className={index === activeIndex ? 'active' : undefined}
                key={option.value}
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(option.value);
                }}
                role="option"
              >
                {option.label}
              </li>
            ))
          ) : (
            <li aria-disabled="true" aria-selected="false" className="empty" role="option">
              Sin resultados
            </li>
          )}
        </ul>
      ) : null}
      {value ? <span className="field-help">Seleccionado: {selected?.label ?? value}</span> : null}
    </div>
  );
}
