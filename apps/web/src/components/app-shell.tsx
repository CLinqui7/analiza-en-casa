'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type PropsWithChildren } from 'react';

type NavigationItem = { label: string; href: string };
type NavigationGroup = { label: string; href?: string; children?: NavigationItem[] };

const navigation: NavigationGroup[] = [
  { label: 'Inicio', href: '/dashboard' },
  { label: 'Pacientes', href: '/patients' },
  {
    label: 'Clínico',
    children: [
      { label: 'Reporte de salud', href: '/clinical/reports' },
      { label: 'Órdenes y acciones', href: '/clinical/orders' },
      { label: 'Evoluciones', href: '/clinical/evolutions' },
      { label: 'Tablero de enfermería', href: '/clinical/nursing' },
    ],
  },
  { label: 'Seguros', href: '/insurance' },
  {
    label: 'Inventario',
    children: [{ label: 'Kárdex', href: '/inventory/kardex' }],
  },
  {
    label: 'Reportes',
    children: [{ label: 'Horas de enfermería', href: '/reports/nurse-hours' }],
  },
  { label: 'Ayuda', href: '/help' },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
}

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    Clínico: pathname.startsWith('/clinical'),
    Inventario: pathname.startsWith('/inventory'),
    Reportes: pathname.startsWith('/reports'),
  });

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegación principal">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark" aria-hidden="true">
            A
          </span>
          <span>Analiza en Casa</span>
        </Link>
        <p className="environment-label">React · datos sintéticos</p>
        <nav>
          <ul className="nav-list">
            {navigation.map((group) => {
              if (group.href) {
                return (
                  <li key={group.href}>
                    <Link
                      aria-current={isActive(pathname, group.href) ? 'page' : undefined}
                      className="nav-link"
                      href={group.href}
                    >
                      {group.label}
                    </Link>
                  </li>
                );
              }
              const open = expanded[group.label] ?? false;
              const hasCurrentChild = group.children?.some((child) =>
                isActive(pathname, child.href),
              );
              return (
                <li key={group.label} className="nav-group">
                  <button
                    aria-expanded={open}
                    className={`nav-group-trigger${hasCurrentChild ? ' current-group' : ''}`}
                    onClick={() => setExpanded((current) => ({ ...current, [group.label]: !open }))}
                    type="button"
                  >
                    <span>{group.label}</span>
                    <span aria-hidden="true">{open ? '⌄' : '›'}</span>
                  </button>
                  {open ? (
                    <ul className="nav-sublist">
                      {group.children?.map((child) => (
                        <li key={child.href}>
                          <Link
                            aria-current={isActive(pathname, child.href) ? 'page' : undefined}
                            className="nav-sublink"
                            href={child.href}
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
