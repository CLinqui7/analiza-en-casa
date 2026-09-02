'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { useAuth } from '@/components/providers';
import { permissionForPath, type Permission } from '@/lib/permissions';

type NavigationItem = { label: string; href: string; permission: Permission; actionId: string };
type NavigationGroup = { label: string; href?: string; permission?: Permission; actionId?: string; children?: NavigationItem[] };

const navigation: NavigationGroup[] = [
  { label: 'Inicio', href: '/dashboard', permission: 'dashboard:read', actionId: 'DASHBOARD-NAVIGATE' },
  { label: 'Pacientes', href: '/patients', permission: 'patients:read', actionId: 'PATIENT-NAVIGATE' },
  { label: 'Agenda', href: '/agenda', permission: 'agenda:read', actionId: 'AGENDA-NAVIGATE' },
  {
    label: 'Financiero',
    children: [
      { label: 'Hospitalización', href: '/hospitalizations', permission: 'cases:read', actionId: 'HOSPITALIZATION-NAVIGATE' },
      { label: 'Cuentas por cobrar', href: '/receivables', permission: 'payments:read', actionId: 'RECEIVABLES-NAVIGATE' },
      { label: 'Cuentas por pagar', href: '/payables', permission: 'payments:read', actionId: 'PAYABLES-NAVIGATE' },
      { label: 'Preautorizaciones y reclamos', href: '/insurance', permission: 'insurance:read', actionId: 'INSURANCE-NAVIGATE' },
      { label: 'Cotizaciones', href: '/quotes', permission: 'quotes:read', actionId: 'QUOTE-NAVIGATE' },
    ],
  },
  { label: 'Pagos', href: '/payments', permission: 'payments:read', actionId: 'PAYMENT-NAVIGATE' },
  {
    label: 'Clínico',
    children: [
      { label: 'Expediente clínico', href: '/clinical', permission: 'clinical:read', actionId: 'CLINICAL-HOME-NAVIGATE' },
      { label: 'Hospitalizaciones clínicas', href: '/clinical/hospitalizations', permission: 'clinical:read', actionId: 'CLINICAL-HOSPITALIZATIONS-NAVIGATE' },
      { label: 'Reporte de salud', href: '/clinical/reports', permission: 'clinical:read', actionId: 'HEALTH-REPORT-NAVIGATE' },
      { label: 'Órdenes y acciones', href: '/clinical/orders', permission: 'clinical:read', actionId: 'MEDICAL-ORDER-NAVIGATE' },
      { label: 'Tarjetas de medicamentos', href: '/clinical/medication-cards', permission: 'clinical:read', actionId: 'MEDICATION-CARD-NAVIGATE' },
      { label: 'Planes de cuidado', href: '/clinical/care-plans', permission: 'clinical:read', actionId: 'CARE-PLAN-NAVIGATE' },
      { label: 'Evoluciones', href: '/clinical/evolutions', permission: 'clinical:read', actionId: 'EVOLUTION-NAVIGATE' },
      { label: 'Tablero de enfermería', href: '/clinical/nursing', permission: 'clinical:read', actionId: 'NURSING-RESOURCE-NAVIGATE' },
    ],
  },
  {
    label: 'Inventario',
    children: [
      { label: 'Existencias', href: '/inventory', permission: 'inventory:read', actionId: 'INVENTORY-NAVIGATE' },
      { label: 'Movimientos', href: '/inventory/movements', permission: 'inventory:read', actionId: 'INVENTORY-MOVEMENTS-NAVIGATE' },
      { label: 'Kárdex', href: '/inventory/kardex', permission: 'inventory:read', actionId: 'KARDEX-NAVIGATE' },
    ],
  },
  { label: 'Catálogos', href: '/catalogs', permission: 'catalogs:read', actionId: 'CATALOG-NAVIGATE' },
  {
    label: 'Administración',
    children: [
      { label: 'Médicos y recursos', href: '/doctors', permission: 'settings:write', actionId: 'DOCTOR-NAVIGATE' },
      { label: 'Recursos de enfermería', href: '/clinical/nursing', permission: 'clinical:read', actionId: 'NURSING-RESOURCE-NAVIGATE' },
    ],
  },
  { label: 'Compras', href: '/purchases', permission: 'purchases:read', actionId: 'PURCHASE-NAVIGATE' },
  {
    label: 'Reportes',
    children: [{ label: 'Horas de enfermería', href: '/reports/nurse-hours', permission: 'reports:read', actionId: 'NURSE-HOURS-NAVIGATE' }],
  },
  { label: 'Auditoría', href: '/audit', permission: 'audit:read', actionId: 'AUDIT-NAVIGATE' },
  { label: 'Ayuda', href: '/help', permission: 'dashboard:read', actionId: 'HELP-NAVIGATE' },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== '/dashboard' && href !== '/clinical' && pathname.startsWith(`${href}/`));
}

function DeniedRoute({ pathname }: { pathname: string }) {
  const router = useRouter();
  useEffect(() => {
    const redirect = window.setTimeout(() => router.replace(`/login?next=${encodeURIComponent(pathname)}`), 0);
    return () => window.clearTimeout(redirect);
  }, [pathname, router]);
  return <main className="access-denied" role="alert">El acceso directo a esta ruta requiere una sesión autorizada.</main>;
}

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const { can, loading, logout, session } = useAuth();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userProfileOpen, setUserProfileOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    Financiero: pathname.startsWith('/hospitalizations') || pathname.startsWith('/receivables') || pathname.startsWith('/payables') || pathname.startsWith('/insurance') || pathname.startsWith('/quotes'), Clínico: pathname.startsWith('/clinical'), Inventario: pathname.startsWith('/inventory'), Reportes: pathname.startsWith('/reports'),
  });
  const required = permissionForPath(pathname);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setUserMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setUserMenuOpen(false); setUserProfileOpen(false); } };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);
  if (loading) return <main className="access-denied" role="status">Validando sesión…</main>;
  if (!session) return <DeniedRoute pathname={pathname} />;
  if (required && !can(required)) {
    return <main className="access-denied" role="alert">Acceso restringido para el rol {session.role}.</main>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegación principal">
        <Link className="brand" data-action-id="DASHBOARD-NAVIGATE" href="/dashboard">
          <span className="brand-mark" aria-hidden="true">A</span>
          <span>Analiza en Casa</span>
        </Link>
        <p className="environment-label">{session.mode === 'supabase' ? 'Supabase' : 'Demo persistente'} · {session.role}</p>
        <nav>
          <ul className="nav-list">
            {navigation.map((group) => {
              if (group.href && group.permission && group.actionId) {
                if (!can(group.permission)) return null;
                return <li key={group.href}><Link aria-current={isActive(pathname, group.href) ? 'page' : undefined} className="nav-link" data-action-id={group.actionId} href={group.href}>{group.label}</Link></li>;
              }
              const children = group.children?.filter((child) => can(child.permission)) ?? [];
              if (!children.length) return null;
              const open = expanded[group.label] ?? false;
              const hasCurrentChild = children.some((child) => isActive(pathname, child.href));
              return (
                <li key={group.label} className="nav-group">
                  <button aria-expanded={open} className={`nav-group-trigger${hasCurrentChild ? ' current-group' : ''}`} data-action-id={`${group.label.toUpperCase()}-TOGGLE`} onClick={() => setExpanded((current) => ({ ...current, [group.label]: !open }))} type="button"><span>{group.label}</span><span aria-hidden="true">{open ? '⌄' : '›'}</span></button>
                  {open ? <ul className="nav-sublist">{children.map((child) => <li key={child.href}><Link aria-current={isActive(pathname, child.href) ? 'page' : undefined} className="nav-sublink" data-action-id={child.actionId} href={child.href}>{child.label}</Link></li>)}</ul> : null}
                </li>
              );
            })}
          </ul>
        </nav>
        <footer className="sidebar-footer">
          <p>Desarrollado por Interactive Core</p>
          <div ref={userMenuRef} className="user-menu">
            <button aria-expanded={userMenuOpen} className="button button-secondary" data-action-id="USER-MENU-OPEN" onClick={() => setUserMenuOpen((open) => !open)} type="button">Mi cuenta</button>
            {userMenuOpen ? <div className="user-menu-popover" role="menu"><p><strong>Organización</strong><br />Analiza en Casa · ámbito sintético</p><p><strong>Mi usuario</strong><br />{session.userId} · {session.role}</p><button data-action-id="USER-PROFILE-OPEN" onClick={() => { setUserMenuOpen(false); setUserProfileOpen(true); }} role="menuitem" type="button">Mi usuario</button><button data-action-id="AUTH-LOGOUT" onClick={() => void logout().then(() => router.replace('/login'))} role="menuitem" type="button">Cerrar sesión</button><button data-action-id="USER-MENU-CLOSE" onClick={() => setUserMenuOpen(false)} type="button">Cerrar menú</button></div> : null}
          </div>
          <button className="button button-secondary" data-action-id="AUTH-LOGOUT" onClick={() => void logout().then(() => router.replace('/login'))} type="button">Cerrar sesión</button>
        </footer>
      </aside>
      <main className="main-content">{children}</main>
      {userProfileOpen ? <div aria-label="Mi usuario" className="dialog-backdrop" role="dialog"><section className="dialog"><h2>Mi usuario</h2><dl className="definition-list"><div><dt>Usuario</dt><dd>{session.userId}</dd></div><div><dt>Rol</dt><dd>{session.role}</dd></div><div><dt>Organización</dt><dd>Analiza en Casa · ámbito sintético</dd></div></dl><button className="button button-secondary" data-action-id="USER-PROFILE-CLOSE" onClick={() => setUserProfileOpen(false)} type="button">Cerrar</button></section></div> : null}
    </div>
  );
}
