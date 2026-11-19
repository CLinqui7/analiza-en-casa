'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Native disclosure semantics, with keyboard navigation and predictable dismissal. */
export function ActionMenu({
  className,
  label,
  trigger,
  children,
}: {
  className: string;
  label: string;
  trigger: ReactNode;
  children: ReactNode;
}) {
  const root = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) root.current?.removeAttribute('open');
    };
    const position = () => {
      const element = root.current;
      const triggerBox = element?.querySelector('summary')?.getBoundingClientRect();
      const panel = element?.querySelector<HTMLElement>('[data-action-menu-panel]');
      if (!element || !triggerBox || !panel) return;
      const needed = Math.min(panel.scrollHeight, 360, innerHeight / 2);
      element.dataset.side =
        triggerBox.bottom + needed + 16 > innerHeight && triggerBox.top > needed + 16
          ? 'top'
          : 'bottom';
    };
    position();
    document.addEventListener('pointerdown', closeOutside);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open]);

  return (
    <details
      ref={root}
      className={className}
      data-action-menu="true"
      onToggle={(event) => {
        const element = event.currentTarget;
        setOpen(element.open);
        if (element.open) {
          document
            .querySelectorAll<HTMLDetailsElement>('details[data-action-menu][open]')
            .forEach((other) => {
              if (other !== element) other.open = false;
            });
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
      }}
      onKeyDown={(event) => {
        const element = event.currentTarget;
        const summary = element.querySelector('summary');
        if (event.key === 'Escape' && element.open) {
          event.preventDefault();
          event.stopPropagation();
          element.open = false;
          summary?.focus();
        }
        const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
        if (!keys.includes(event.key)) return;
        event.preventDefault();
        element.open = true;
        const items = Array.from(
          element.querySelectorAll<HTMLElement>(
            '[data-action-menu-panel] :is(button:not(:disabled), a[href])',
          ),
        );
        if (!items.length) return;
        const current = items.indexOf(document.activeElement as HTMLElement);
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : event.key === 'ArrowUp'
                ? current <= 0
                  ? items.length - 1
                  : current - 1
                : (current + 1) % items.length;
        items[next]?.focus();
      }}
    >
      <summary aria-label={label}>{trigger}</summary>
      <div
        data-action-menu-panel="true"
        onClickCapture={(event) => {
          if ((event.target as Element).closest('button:not(:disabled), a[href]')) {
            root.current?.removeAttribute('open');
            root.current?.querySelector('summary')?.focus();
          }
        }}
      >
        {children}
      </div>
    </details>
  );
}
