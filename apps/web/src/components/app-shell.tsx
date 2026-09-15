'use client';
import { isServerDataMode } from '@/lib/data-mode';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PropsWithChildren,
} from 'react';
import { useAuth } from '@/components/providers';
import { permissionForPath, type Permission } from '@/lib/permissions';
import { isCoreRelease, isReleasedPath } from '@/lib/release-profile';
import { isRegistrationEnabled } from '@/lib/registration';

type NavigationItem = { label: string; href: string; permission: Permission; actionId: string };
type NavigationGroup = {
  label: string;
  href?: string;
  permission?: Permission;
  actionId?: string;
  children?: NavigationItem[];
};

const navigation: NavigationGroup[] = [
  ...(isRegistrationEnabled()
    ? [
        {
          label: 'Mi espacio',
          href: '/onboarding',
          permission: 'settings:write' as const,
          actionId: 'WORKSPACE-SETUP-NAVIGATE',
        },
      ]
    : []),
  {
    label: 'Dashboard',
    href: '/dashboard',
    permission: 'dashboard:read',
    actionId: 'DASHBOARD-NAVIGATE',
  },
  {
    label: 'Pacientes',
    href: '/patients',
    permission: 'patients:read',
    actionId: 'PATIENT-NAVIGATE',
  },
  { label: 'Agenda', href: '/agenda', permission: 'agenda:read', actionId: 'AGENDA-NAVIGATE' },
  {
    label: 'Financiero',
    children: [
      {
        label: 'Hospitalización',
        href: '/hospitalizations',
        permission: 'cases:read',
        actionId: 'HOSPITALIZATION-NAVIGATE',
      },
      {
        label: 'Cuentas por cobrar',
        href: '/receivables',
        permission: 'payments:read',
        actionId: 'RECEIVABLES-NAVIGATE',
      },
      {
        label: 'Cuentas por pagar',
        href: '/payables',
        permission: 'payments:read',
        actionId: 'PAYABLES-NAVIGATE',
      },
      {
        label: 'Preautorizaciones y reclamos',
        href: '/insurance',
        permission: 'insurance:read',
        actionId: 'INSURANCE-NAVIGATE',
      },
      {
        label: 'Cotizaciones',
        href: '/quotes',
        permission: 'quotes:read',
        actionId: 'QUOTE-NAVIGATE',
      },
    ],
  },
  { label: 'Pagos', href: '/payments', permission: 'payments:read', actionId: 'PAYMENT-NAVIGATE' },
  {
    label: 'Clínico',
    children: [
      {
        label: 'Balance hídrico',
        href: '/clinical/balance',
        permission: 'clinical:read',
        actionId: 'BALANCE-NAVIGATE',
      },
      {
        label: 'Administración de medicamentos',
        href: '/clinical/administrations',
        permission: 'clinical:read',
        actionId: 'MEDICATION-ADMINISTRATION-NAVIGATE',
      },
      {
        label: 'Expediente clínico',
        href: '/clinical',
        permission: 'clinical:read',
        actionId: 'CLINICAL-HOME-NAVIGATE',
      },
      {
        label: 'Hospitalizaciones clínicas',
        href: '/clinical/hospitalizations',
        permission: 'clinical:read',
        actionId: 'CLINICAL-HOSPITALIZATIONS-NAVIGATE',
      },
      {
        label: 'Reporte de salud',
        href: '/clinical/reports',
        permission: 'clinical:read',
        actionId: 'HEALTH-REPORT-NAVIGATE',
      },
      {
        label: 'Órdenes y acciones',
        href: '/clinical/orders',
        permission: 'clinical:read',
        actionId: 'MEDICAL-ORDER-NAVIGATE',
      },
      {
        label: 'Tarjetas de medicamentos',
        href: '/clinical/medication-cards',
        permission: 'clinical:read',
        actionId: 'MEDICATION-CARD-NAVIGATE',
      },
      {
        label: 'Planes de cuidado',
        href: '/clinical/care-plans',
        permission: 'clinical:read',
        actionId: 'CARE-PLAN-NAVIGATE',
      },
      {
        label: 'Evoluciones',
        href: '/clinical/evolutions',
        permission: 'clinical:read',
        actionId: 'EVOLUTION-NAVIGATE',
      },
      {
        label: 'Tablero de enfermería',
        href: '/clinical/nursing',
        permission: 'clinical:read',
        actionId: 'NURSING-RESOURCE-NAVIGATE',
      },
    ],
  },
  {
    label: 'Inventario',
    children: [
      {
        label: 'Existencias',
        href: '/inventory',
        permission: 'inventory:read',
        actionId: 'INVENTORY-NAVIGATE',
      },
      {
        label: 'Movimientos',
        href: '/inventory/movements',
        permission: 'inventory:read',
        actionId: 'INVENTORY-MOVEMENTS-NAVIGATE',
      },
      {
        label: 'Kárdex',
        href: '/inventory/kardex',
        permission: 'inventory:read',
        actionId: 'KARDEX-NAVIGATE',
      },
    ],
  },
  {
    label: 'Catálogos',
    href: '/catalogs',
    permission: 'catalogs:read',
    actionId: 'CATALOG-NAVIGATE',
  },
  {
    label: 'Administración',
    children: [
      {
        label: 'Equipo y cuentas de enfermería',
        href: '/nursing-team',
        permission: 'nurses:manage',
        actionId: 'NURSE-TEAM-NAVIGATE',
      },
      {
        label: 'Catálogos operativos',
        href: '/catalogs/operational',
        permission: 'catalogs:read',
        actionId: 'OPERATIONAL-CATALOG-NAVIGATE',
      },
      {
        label: 'Médicos y recursos',
        href: '/doctors',
        permission: 'settings:write',
        actionId: 'DOCTOR-NAVIGATE',
      },
      {
        label: 'Recursos de enfermería',
        href: '/clinical/nursing',
        permission: 'clinical:read',
        actionId: 'NURSING-RESOURCE-NAVIGATE',
      },
    ],
  },
  {
    label: 'Compras',
    href: '/purchases',
    permission: 'purchases:read',
    actionId: 'PURCHASE-NAVIGATE',
  },
  {
    label: 'Reportes',
    children: [
      {
        label: 'Visitas y metas',
        href: '/reports/visits-goals',
        permission: 'reports:read',
        actionId: 'VISITS-GOALS-NAVIGATE',
      },
      {
        label: 'Horas de enfermería',
        href: '/reports/nurse-hours',
        permission: 'reports:read',
        actionId: 'NURSE-HOURS-NAVIGATE',
      },
    ],
  },
  { label: 'Auditoría', href: '/audit', permission: 'audit:read', actionId: 'AUDIT-NAVIGATE' },
  { label: 'Ayuda', href: '/help', permission: 'dashboard:read', actionId: 'HELP-NAVIGATE' },
  {
    label: 'Cambios solicitados',
    href: '/changes',
    permission: 'dashboard:read',
    actionId: 'CLIENT-CHANGES-NAVIGATE',
  },
];

function NavigationGlyph({ label }: { label: string }) {
  const path =
    label === 'Dashboard'
      ? 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z'
      : label === 'Pacientes'
        ? 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8'
        : label === 'Agenda'
          ? 'M4 5h16v16H4z M16 3v4 M8 3v4 M4 11h16 M8 15h3'
          : label === 'Inventario' || label === 'Compras'
            ? 'M12 3 3 8v9l9 5 9-5V8z M3 8l9 5 9-5 M12 13v9 M7 5l9 5'
            : label === 'Clínico'
              ? 'M2 12h4l3-8 6 16 3-8h4'
              : label === 'Reportes'
                ? 'M4 3v18h18 M9 16V9 M14 16V5 M19 16v-5'
                : label === 'Financiero' || label === 'Pagos'
                  ? 'M12 2v20 M17 5H9a4 4 0 0 0 0 8h6a4 4 0 0 1 0 8H5'
                  : label === 'Auditoría'
                    ? 'M4 12l5 5L20 5'
                    : 'M5 3h10l4 4v14H5z M14 3v5h5 M8 12h8 M8 16h8';
  return (
    <span aria-hidden="true" className="nav-item-glyph">
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={path} />
      </svg>
    </span>
  );
}

function isActive(pathname: string, href: string) {
  return (
    pathname === href ||
    (href !== '/dashboard' && href !== '/clinical' && pathname.startsWith(`${href}/`))
  );
}

function currentPageLabel(pathname: string) {
  const items: Array<{ href: string; label: string }> = [];
  for (const group of navigation) {
    if (group.href) items.push({ href: group.href, label: group.label });
    for (const child of group.children ?? []) items.push({ href: child.href, label: child.label });
  }
  return (
    items
      .filter((item) => isActive(pathname, item.href))
      .sort((a, b) => b.href.length - a.href.length)[0]?.label ?? 'Analiza en Casa'
  );
}

function DeniedRoute({ pathname }: { pathname: string }) {
  const router = useRouter();
  useEffect(() => {
    const redirect = window.setTimeout(
      () => router.replace(`/login?next=${encodeURIComponent(pathname)}`),
      0,
    );
    return () => window.clearTimeout(redirect);
  }, [pathname, router]);
  return (
    <main className="access-denied" role="alert">
      El acceso directo a esta ruta requiere una sesión autorizada.
    </main>
  );
}

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const { can, loading, logout, session } = useAuth();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const navScrollRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const mobileMenuToggleRef = useRef<HTMLButtonElement>(null);
  const mobileMenuCloseRef = useRef<HTMLButtonElement>(null);
  const profileDialogRef = useRef<HTMLElement>(null);
  const profileReturnFocusRef = useRef<HTMLElement>(null);
  const globalSearchRef = useRef<HTMLInputElement>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userProfileOpen, setUserProfileOpen] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    Financiero: true,
    Clínico: true,
    Inventario: true,
    Reportes: true,
    Administración: true,
  });
  const required = permissionForPath(pathname);

  useEffect(() => {
    const restoreTimer = window.setTimeout(
      () =>
        setSidebarCollapsed(window.localStorage.getItem('analiza.sidebar.collapsed') === 'true'),
      0,
    );
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        globalSearchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', focusSearch);
    return () => {
      window.clearTimeout(restoreTimer);
      window.removeEventListener('keydown', focusSearch);
    };
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('analiza.sidebar.collapsed', String(next));
      return next;
    });
  }, []);

  function submitGlobalSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = globalSearch.trim();
    if (!query) return;
    const normalized = query
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const route = normalized.includes('cotiza')
      ? '/quotes'
      : normalized.includes('hospital') || normalized.includes('caso')
        ? '/hospitalizations'
        : normalized.includes('seguro') || normalized.includes('preautor')
          ? '/insurance'
          : normalized.includes('agenda') || normalized.includes('turno')
            ? '/agenda'
            : '/patients';
    router.push(
      `${isReleasedPath(route) ? route : '/patients'}?search=${encodeURIComponent(query)}`,
    );
  }

  const closeUserProfile = useCallback(() => {
    setUserProfileOpen(false);
    window.requestAnimationFrame(() => profileReturnFocusRef.current?.focus());
  }, []);

  const closeMobileNavigation = useCallback((restoreFocus = false) => {
    setMobileNavigationOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => mobileMenuToggleRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
        if (mobileNavigationOpen) closeMobileNavigation(true);
        if (userProfileOpen) closeUserProfile();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [closeMobileNavigation, closeUserProfile, mobileNavigationOpen, userProfileOpen]);

  useEffect(() => {
    const node = navScrollRef.current;
    if (!node) return;
    const saved = window.sessionStorage.getItem('analiza.sidebar.scrollTop');
    if (saved) {
      const value = Number(saved);
      window.requestAnimationFrame(() => {
        if (Number.isFinite(value)) node.scrollTop = value;
      });
    }
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavigationOpen) return;
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const previousOverflow = document.body.style.overflow;
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = Array.from(sidebar.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', trapFocus);
    window.requestAnimationFrame(() => mobileMenuCloseRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', trapFocus);
    };
  }, [mobileNavigationOpen]);

  useEffect(() => {
    if (!userProfileOpen) return;
    const dialog = profileDialogRef.current;
    if (!dialog) return;
    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trapFocus);
    window.requestAnimationFrame(() => {
      dialog.querySelector<HTMLElement>(focusableSelector)?.focus();
    });
    return () => document.removeEventListener('keydown', trapFocus);
  }, [userProfileOpen]);

  if (loading) {
    return (
      <main className="access-denied" role="status">
        Validando sesión…
      </main>
    );
  }
  if (!session) return <DeniedRoute pathname={pathname} />;
  if (required && !can(required)) {
    return (
      <main className="access-denied" role="alert">
        Acceso restringido para el rol {session.role}.
      </main>
    );
  }

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      {mobileNavigationOpen ? (
        <button
          aria-label="Cerrar menú de navegación"
          className="mobile-nav-overlay"
          data-action-id="MOBILE-NAV-CLOSE"
          onClick={() => closeMobileNavigation(true)}
          type="button"
        />
      ) : null}
      <aside
        aria-label="Navegación principal"
        className={`sidebar${mobileNavigationOpen ? ' mobile-navigation-open' : ''}`}
        id="main-navigation"
        ref={sidebarRef}
      >
        <div className="sidebar-header">
          <button
            aria-label="Cerrar menú"
            className="mobile-nav-close"
            data-action-id="MOBILE-NAV-CLOSE"
            onClick={() => closeMobileNavigation(true)}
            ref={mobileMenuCloseRef}
            type="button"
          >
            Cerrar
          </button>
          <Link
            aria-label="Ir al inicio de Analiza en Casa"
            className="brand"
            data-action-id="DASHBOARD-NAVIGATE"
            href="/dashboard"
            scroll={false}
          >
            <Image
              alt="Analiza en Casa"
              className="brand-logo"
              height={66}
              priority
              src="/brand/analiza-en-casa-logo.png"
              width={152}
            />
            <span className="brand-monogram" aria-hidden="true">
              AC
            </span>
            <span className="brand-copy">
              <strong>Analiza en Casa</strong>
              <small>Atención domiciliaria</small>
            </span>
          </Link>
          <p className="environment-label">
            <span className="environment-dot" aria-hidden="true" />
            {session.mode === 'supabase'
              ? 'Conectado a Supabase'
              : isServerDataMode(session.mode)
                ? 'Conectado al servidor'
                : 'Entorno demo'}{' '}
            · {session.role}
          </p>
        </div>

        <nav
          className="nav-scroll"
          ref={navScrollRef}
          onScroll={(event) =>
            window.sessionStorage.setItem(
              'analiza.sidebar.scrollTop',
              String(event.currentTarget.scrollTop),
            )
          }
        >
          <ul className="nav-list">
            {navigation.map((group) => {
              if (group.href && group.permission && group.actionId) {
                if (!can(group.permission) || !isReleasedPath(group.href)) return null;
                return (
                  <li key={group.href}>
                    <Link
                      aria-label={group.label}
                      aria-current={isActive(pathname, group.href) ? 'page' : undefined}
                      className="nav-link"
                      data-action-id={group.actionId}
                      href={group.href}
                      onClick={() => closeMobileNavigation()}
                      scroll={false}
                      title={sidebarCollapsed ? group.label : undefined}
                    >
                      <NavigationGlyph label={group.label} />
                      <span className="nav-item-label">{group.label}</span>
                    </Link>
                  </li>
                );
              }

              const childrenForRole =
                group.children?.filter(
                  (child) => can(child.permission) && isReleasedPath(child.href),
                ) ?? [];
              if (!childrenForRole.length) return null;
              const open = expanded[group.label] ?? false;
              const hasCurrentChild = childrenForRole.some((child) =>
                isActive(pathname, child.href),
              );

              return (
                <li key={group.label} className="nav-group">
                  <button
                    aria-label={`${open ? 'Contraer' : 'Expandir'} ${group.label}`}
                    aria-expanded={open}
                    className={`nav-group-trigger${hasCurrentChild ? ' current-group' : ''}`}
                    data-action-id={`${group.label.toUpperCase()}-TOGGLE`}
                    onClick={() => setExpanded((current) => ({ ...current, [group.label]: !open }))}
                    title={sidebarCollapsed ? group.label : undefined}
                    type="button"
                  >
                    <span className="nav-group-copy">
                      <NavigationGlyph label={group.label} />
                      <span>{group.label}</span>
                    </span>
                    <span className={`nav-chevron${open ? ' open' : ''}`} aria-hidden="true">
                      ›
                    </span>
                  </button>
                  <div
                    className={`nav-sublist-shell${open ? ' open' : ''}`}
                    inert={!open}
                    aria-hidden={!open}
                  >
                    <ul className="nav-sublist">
                      {childrenForRole.map((child) => (
                        <li key={child.href}>
                          <Link
                            aria-current={isActive(pathname, child.href) ? 'page' : undefined}
                            className="nav-sublink"
                            data-action-id={child.actionId}
                            href={child.href}
                            onClick={() => closeMobileNavigation()}
                            scroll={false}
                          >
                            <span aria-hidden="true" className="nav-subitem-mark" />
                            <span>{child.label}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>

        <footer className="sidebar-footer">
          <div className="sidebar-credit">
            <span>Analiza en Casa</span>
            <small>Desarrollado por Interactive Core</small>
          </div>
          <div ref={userMenuRef} className="user-menu">
            <button
              aria-label={`Abrir menú de mi cuenta. Rol ${session.role}`}
              aria-expanded={userMenuOpen}
              className="account-card"
              data-action-id="USER-MENU-OPEN"
              onClick={() => setUserMenuOpen((open) => !open)}
              ref={accountMenuTriggerRef}
              type="button"
            >
              <span className="account-avatar">{session.role.slice(0, 1)}</span>
              <span className="account-copy">
                <strong>Mi cuenta</strong>
                <small>{session.role}</small>
              </span>
              <span aria-hidden="true">•••</span>
            </button>
            {userMenuOpen ? (
              <div className="user-menu-popover" role="menu">
                <p>
                  <strong>Organización</strong>
                  <br />
                  Analiza en Casa · ámbito sintético
                </p>
                <p>
                  <strong>Mi usuario</strong>
                  <br />
                  {session.userId} · {session.role}
                </p>
                <button
                  data-action-id="USER-PROFILE-OPEN"
                  onClick={() => {
                    profileReturnFocusRef.current = accountMenuTriggerRef.current;
                    setUserMenuOpen(false);
                    setUserProfileOpen(true);
                  }}
                  role="menuitem"
                  type="button"
                >
                  Ver mi usuario
                </button>
                <button
                  data-action-id="AUTH-LOGOUT"
                  onClick={() => void logout().then(() => router.replace('/login'))}
                  role="menuitem"
                  type="button"
                >
                  Cerrar sesión
                </button>
                <button
                  data-action-id="USER-MENU-CLOSE"
                  onClick={() => setUserMenuOpen(false)}
                  type="button"
                >
                  Cerrar menú
                </button>
              </div>
            ) : null}
          </div>

          <button
            aria-label="Cerrar sesión"
            className="account-logout-quick"
            data-action-id="AUTH-LOGOUT"
            onClick={() => void logout().then(() => router.replace('/login'))}
            type="button"
          >
            <span aria-hidden="true" className="account-logout-icon">
              Salir
            </span>
            <span>Cerrar sesión</span>
          </button>
        </footer>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="topbar-leading">
            <button
              aria-controls="main-navigation"
              aria-expanded={!sidebarCollapsed}
              aria-label={sidebarCollapsed ? 'Expandir navegación' : 'Contraer navegación'}
              className="desktop-nav-toggle"
              data-action-id="DESKTOP-NAV-TOGGLE"
              onClick={toggleSidebar}
              type="button"
            >
              ☰
            </button>
            <button
              aria-controls="main-navigation"
              aria-expanded={mobileNavigationOpen}
              aria-label={
                mobileNavigationOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'
              }
              className="mobile-nav-toggle"
              data-action-id="MOBILE-NAV-TOGGLE"
              onClick={() => setMobileNavigationOpen((open) => !open)}
              ref={mobileMenuToggleRef}
              type="button"
            >
              Menú
            </button>
            <form className="global-search" onSubmit={submitGlobalSearch} role="search">
              <span aria-hidden="true">⌕</span>
              <input
                aria-label="Buscar en Analiza en Casa"
                onChange={(event) => setGlobalSearch(event.target.value)}
                placeholder={
                  isCoreRelease
                    ? 'Buscar paciente, hospitalización o turno…'
                    : 'Buscar paciente, caso, cotización o comando…'
                }
                ref={globalSearchRef}
                type="search"
                value={globalSearch}
              />
              <kbd>Ctrl K</kbd>
            </form>
          </div>
          <div className="topbar-actions">
            <span className="topbar-page-name">{currentPageLabel(pathname)}</span>
            <button
              className="topbar-profile"
              data-action-id="USER-PROFILE-OPEN"
              onClick={(event) => {
                profileReturnFocusRef.current = event.currentTarget;
                setUserProfileOpen(true);
              }}
              type="button"
            >
              <span className="account-avatar">{session.role.slice(0, 1)}</span>
              <span>
                <strong>Mi cuenta</strong>
                <small>{session.role}</small>
              </span>
              <span aria-hidden="true">⌄</span>
            </button>
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>

      {userProfileOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              aria-labelledby="user-profile-title"
              aria-modal="true"
              className="dialog-backdrop"
              role="dialog"
            >
              <section className="dialog" ref={profileDialogRef} role="document" tabIndex={-1}>
                <div className="dialog-header">
                  <div>
                    <p className="eyebrow">Cuenta</p>
                    <h2 id="user-profile-title">Mi usuario</h2>
                  </div>
                </div>
                <div className="dialog-content">
                  <dl className="definition-list">
                    <div>
                      <dt>Usuario</dt>
                      <dd>{session.userId}</dd>
                    </div>
                    <div>
                      <dt>Rol</dt>
                      <dd>{session.role}</dd>
                    </div>
                    <div>
                      <dt>Organización</dt>
                      <dd>Analiza en Casa · ámbito sintético</dd>
                    </div>
                  </dl>
                </div>
                <div className="dialog-footer">
                  <button
                    className="button button-secondary"
                    data-action-id="USER-PROFILE-CLOSE"
                    onClick={closeUserProfile}
                    type="button"
                  >
                    Cerrar
                  </button>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
