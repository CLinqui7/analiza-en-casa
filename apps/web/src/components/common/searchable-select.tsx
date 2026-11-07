'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { searchOptions, type SearchableOption } from '@/lib/patient-form';

type Props = {
  actionId?: string;
  allowCustom?: boolean;
  ariaLabel: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  options: readonly SearchableOption[];
  placeholder?: string;
  value: string;
};

export function SearchableSelect({
  actionId,
  allowCustom = false,
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
  const customValue = query.trim();
  const showCustom =
    allowCustom &&
    customValue.length > 1 &&
    !options.some(
      (option) => option.label.toLocaleLowerCase('es') === customValue.toLocaleLowerCase('es'),
    );
  const optionCount = visible.length + (showCustom ? 1 : 0);
  const focusedIndex = Math.min(activeIndex, Math.max(0, optionCount - 1));
  const activeOptionId = optionCount ? `${listId}-option-${focusedIndex}` : undefined;

  useEffect(() => {
    if (open && activeOptionId) {
      document.getElementById(activeOptionId)?.scrollIntoView({ block: 'nearest' });
    }
  }, [open, activeOptionId, query]);

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
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key === 'Tab') setOpen(false);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(open ? Math.min(focusedIndex + 1, Math.max(optionCount - 1, 0)) : 0);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(open ? Math.max(focusedIndex - 1, 0) : Math.max(optionCount - 1, 0));
    }
    if ((event.key === 'Home' || event.key === 'End') && open) {
      event.preventDefault();
      setActiveIndex(event.key === 'Home' ? 0 : Math.max(optionCount - 1, 0));
    }
    if (event.key === 'Enter' && open && optionCount) {
      event.preventDefault();
      choose(visible[focusedIndex]?.value ?? customValue);
    }
  }

  return (
    <div
      className="searchable-select"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <div className="searchable-select-input">
        <input
          aria-autocomplete="list"
          aria-activedescendant={open ? activeOptionId : undefined}
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
            if (allowCustom && query.trim() && !selected) onChange(query.trim());
          }}
          onKeyDown={onKeyDown}
          placeholder={selected?.label ?? (value || placeholder)}
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
                className={index === focusedIndex ? 'active' : undefined}
                id={`${listId}-option-${index}`}
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
          ) : !showCustom ? (
            <li aria-disabled="true" aria-selected="false" className="empty" role="option">
              Sin resultados
            </li>
          ) : null}
          {showCustom ? (
            <li
              aria-selected="false"
              className={focusedIndex === visible.length ? 'active' : undefined}
              id={`${listId}-option-${visible.length}`}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(customValue);
              }}
              role="option"
            >
              Usar “{customValue}” como nueva opción
            </li>
          ) : null}
        </ul>
      ) : null}
      {value ? <span className="field-help">Seleccionado: {selected?.label ?? value}</span> : null}
    </div>
  );
}
