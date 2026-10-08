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
import { landingPath, type AuthSession } from '@/lib/auth';
import { permissionForPath, type Permission } from '@/lib/permissions';
import { isCoreRelease, isReleasedPath } from '@/lib/release-profile';
import { ScreenHelp } from './screen-help';
import type { AccountProfile } from '@/lib/account-profile';

const navigationIconPaths = {
  analytics: 'M4 19V10 M10 19V5 M16 19v-7 M22 19H2',
  dashboard: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
  patients:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  agenda: 'M4 5h16v16H4z M16 3v4 M8 3v4 M4 11h16 M8 15h3',
  insurers: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
  finance: 'M3 6h18v12H3z M3 10h18 M7 15h3',
  hospital: 'M3 21V5h18v16 M3 13h18 M9 5v8 M15 5v8 M7 17h2 M15 17h2',
  receivables: 'M3 7h18v12H3z M3 11h18 M8 15h4 M18 4v5 M15 7l3 3 3-3',
  payables: 'M3 7h18v12H3z M3 11h18 M8 15h4 M18 10V5 M15 7l3-3 3 3',
  insurance: 'M12 3v18 M3 12a9 9 0 0 1 18 0H3z M7 12v2a2 2 0 0 0 4 0v-2 M15 12v2a2 2 0 0 0 4 0v-2',
  quotes: 'M6 2h9l5 5v15H6z M14 2v6h6 M9 13h6 M9 17h4',
  payments: 'M3 6h18v12H3z M3 10h18 M7 15h2 M15 15h2',
  clinical: 'M2 12h4l3-8 6 16 3-8h4',
  balance: 'M12 2s6 6.2 6 12a6 6 0 1 1-12 0c0-5.8 6-12 6-12z M9 15c.8 1 1.8 1.5 3 1.5',
  medication: 'M10 4l10 10a4.24 4.24 0 0 1-6 6L4 10a4.24 4.24 0 0 1 6-6z M7 13l6-6',
  clinicalRecord: 'M9 5h6 M9 3h6v4H9z M6 5H4v16h16V5h-2 M8 12h8 M8 16h5',
  clinicalHospital: 'M3 21v-8h18v8 M5 13V8h6v5 M13 13V6h6v7 M7 17h2 M15 17h2',
  healthReport: 'M5 3h14v18H5z M9 8h6 M9 12h3 M9 16h6 M15 12h2',
  orders: 'M9 5h6 M9 3h6v4H9z M6 5H4v16h16V5h-2 M8 13l2 2 5-5',
  medicationCards: 'M12 3v18 M3 12h18 M5 5l14 14',
  carePlans: 'M12 20s-7-4.35-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.65-7 10-7 10z',
  evolutions: 'M3 17l6-6 4 4 8-9 M15 6h6v6',
  nursing: 'M6 3v6a6 6 0 0 0 12 0V3 M8 3v5a4 4 0 0 0 8 0V3 M12 15v6 M9 21h6',
  inventory: 'M12 3 3 8v9l9 5 9-5V8z M3 8l9 5 9-5 M12 13v9 M7 5l9 5',
  stock: 'M4 7l8-4 8 4v10l-8 4-8-4z M4 7l8 4 8-4 M12 11v10 M9 16l2 2 4-5',
  supplyRequests: 'M5 3h14v18H5z M9 7h6 M9 11h6 M9 15h4 M16 17l2 2 3-4',
  movements: 'M4 7h15 M16 4l3 3-3 3 M20 17H5 M8 14l-3 3 3 3',
  kardex: 'M5 3h14v18H5z M9 8h6 M9 12h6 M9 16h4 M3 7h2 M19 7h2 M3 17h2 M19 17h2',
  catalogs: 'M4 4h7v16H4z M13 4h7v16h-7z M7 8h1 M16 8h1 M7 12h1 M16 12h1',
  administration:
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M19.4 15l1.6 1-2 3.5-1.8-.8a7.8 7.8 0 0 1-2.2 1.3L15 22h-4l-.2-2a7.8 7.8 0 0 1-2.2-1.3l-1.8.8-2-3.5 1.6-1a8 8 0 0 1 0-2L4.8 12l2-3.5 1.8.8A7.8 7.8 0 0 1 10.8 8L11 6h4l.2 2a7.8 7.8 0 0 1 2.2 1.3l1.8-.8 2 3.5-1.6 1a8 8 0 0 1 0 2z',
  nurseTeam:
    'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M18 8v6 M15 11h6',
  operational: 'M4 7h10 M18 7h2 M14 4v6 M4 17h2 M10 17h10 M6 14v6 M4 12h6 M14 12h6 M10 9v6',
  doctors: 'M11 17a6 6 0 1 0-6-6 6 6 0 0 0 6 6z M9.5 15.5 14 20 M17 17h5 M19.5 14.5v5',
  import: 'M12 3v12 M7 10l5 5 5-5 M5 21h14',
  purchases:
    'M3 4h2l2 11h10l2-8H6 M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2 M17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2',
  reports: 'M4 3v18h18 M8 16v-5 M13 16V7 M18 16v-8',
  visits: 'M12 2v3 M12 19v3 M2 12h3 M19 12h3 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  nurseHours: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
  audit: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M8 12l2.5 2.5L16 9',
  tutorial: 'M3 7l9-4 9 4-9 4z M5 10v6c4 3 10 3 14 0v-6 M21 7v7',
  help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M9.5 9a2.7 2.7 0 1 1 4.3 2.2c-1.3.9-1.8 1.4-1.8 2.8 M12 18h.01',
  feedback: 'M4 4h16v12H8l-4 4z M12 8v4 M12 14h.01',
  changes: 'M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5 M12 7v5l3 2',
} as const;

type NavigationIconName = keyof typeof navigationIconPaths;
type NavigationItem = {
  label: string;
  href: string;
  permission: Permission;
  actionId: string;
  icon: NavigationIconName;
};
type NavigationGroup = {
  label: string;
  icon: NavigationIconName;
  href?: string;
  permission?: Permission;
  actionId?: string;
  children?: NavigationItem[];
};

const navigation: NavigationGroup[] = [
  {
    label: 'Inicio',
    icon: 'dashboard',
    children: [
      {
        label: 'Dashboard',
        icon: 'dashboard',
        href: '/dashboard',
        permission: 'dashboard:read',
        actionId: 'DASHBOARD-NAVIGATE',
      },
      {
        label: 'Pacientes',
        icon: 'patients',
        href: '/patients',
        permission: 'patients:read',
        actionId: 'PATIENT-NAVIGATE',
      },
      {
        label: 'Agenda',
        icon: 'agenda',
        href: '/agenda',
        permission: 'agenda:read',
        actionId: 'AGENDA-NAVIGATE',
      },
    ],
  },
  {
    label: 'Financiero',
    icon: 'finance',
    children: [
      {
        label: 'Hospitalización',
        icon: 'hospital',
        href: '/hospitalizations',
        permission: 'cases:read',
        actionId: 'HOSPITALIZATION-NAVIGATE',
      },
      {
        label: 'Cuentas por cobrar',
        icon: 'receivables',
        href: '/receivables',
        permission: 'payments:read',
        actionId: 'RECEIVABLES-NAVIGATE',
      },
      {
        label: 'Pagos',
        icon: 'payments',
        href: '/payments',
        permission: 'payments:read',
        actionId: 'PAYMENT-NAVIGATE',
      },
      {
        label: 'Ventas confirmadas',
        icon: 'finance',
        href: '/sales',
        permission: 'payments:read',
        actionId: 'SALES-NAVIGATE',
      },
      {
        label: 'Cuentas por pagar',
        icon: 'payables',
        href: '/payables',
        permission: 'payments:read',
        actionId: 'PAYABLES-NAVIGATE',
      },
      {
        label: 'Preautorizaciones y reclamos',
        icon: 'insurance',
        href: '/insurance',
        permission: 'insurance:read',
        actionId: 'INSURANCE-NAVIGATE',
      },
      {
        label: 'Cotizaciones',
        icon: 'quotes',
        href: '/quotes',
        permission: 'quotes:read',
        actionId: 'QUOTE-NAVIGATE',
      },
      {
        label: 'Aseguradoras',
        icon: 'insurers',
        href: '/insurers',
        permission: 'catalogs:read',
        actionId: 'INSURER-NAVIGATE',
      },
    ],
  },
  {
    label: 'Clínico',
    icon: 'clinical',
    children: [
      {
        label: 'Expediente clínico',
        icon: 'clinicalRecord',
        href: '/clinical',
        permission: 'clinical:read',
        actionId: 'CLINICAL-HOME-NAVIGATE',
      },
      {
        label: 'Hospitalizaciones clínicas',
        icon: 'clinicalHospital',
        href: '/clinical/hospitalizations',
        permission: 'clinical:read',
        actionId: 'CLINICAL-HOSPITALIZATIONS-NAVIGATE',
      },
      {
        label: 'Órdenes y acciones',
        icon: 'orders',
        href: '/clinical/orders',
        permission: 'clinical:read',
        actionId: 'MEDICAL-ORDER-NAVIGATE',
      },
      {
        label: 'Administración de medicamentos',
        icon: 'medication',
        href: '/clinical/administrations',
        permission: 'clinical:read',
        actionId: 'MEDICATION-ADMINISTRATION-NAVIGATE',
      },
      {
        label: 'Tarjetas de medicamentos',
        icon: 'medicationCards',
        href: '/clinical/medication-cards',
        permission: 'clinical:read',
        actionId: 'MEDICATION-CARD-NAVIGATE',
      },
      {
        label: 'Balance hídrico',
        icon: 'balance',
        href: '/clinical/balance',
        permission: 'clinical:read',
        actionId: 'BALANCE-NAVIGATE',
      },
      {
        label: 'Planes de cuidado',
        icon: 'carePlans',
        href: '/clinical/care-plans',
        permission: 'clinical:read',
        actionId: 'CARE-PLAN-NAVIGATE',
      },
      {
        label: 'Evoluciones',
        icon: 'evolutions',
        href: '/clinical/evolutions',
        permission: 'clinical:read',
        actionId: 'EVOLUTION-NAVIGATE',
      },
      {
        label: 'Reporte de salud',
        icon: 'healthReport',
        href: '/clinical/reports',
        permission: 'clinical:read',
        actionId: 'HEALTH-REPORT-NAVIGATE',
      },
      {
        label: 'Tablero de enfermería',
        icon: 'nursing',
        href: '/clinical/nursing',
        permission: 'clinical:read',
        actionId: 'NURSING-RESOURCE-NAVIGATE',
      },
    ],
  },
  {
    label: 'Inventario y compras',
    icon: 'inventory',
    children: [
      {
        label: 'Solicitudes de insumos',
        icon: 'supplyRequests',
        href: '/supply-requests',
        permission: 'supply-requests:read',
        actionId: 'SUPPLY-REQUESTS-NAVIGATE',
      },
      {
        label: 'Existencias',
        icon: 'stock',
        href: '/inventory',
        permission: 'inventory:read',
        actionId: 'INVENTORY-NAVIGATE',
      },
      {
        label: 'Movimientos',
        icon: 'movements',
        href: '/inventory/movements',
        permission: 'inventory:read',
        actionId: 'INVENTORY-MOVEMENTS-NAVIGATE',
      },
      {
        label: 'Entregas a domicilio',
        icon: 'movements',
        href: '/inventory/home-deliveries',
        permission: 'inventory:read',
        actionId: 'HOME-DELIVERIES-NAVIGATE',
      },
      {
        label: 'Kárdex',
        icon: 'kardex',
        href: '/inventory/kardex',
        permission: 'inventory:read',
        actionId: 'KARDEX-NAVIGATE',
      },
      {
        label: 'Compras',
        icon: 'purchases',
        href: '/purchases',
        permission: 'purchases:read',
        actionId: 'PURCHASE-NAVIGATE',
      },
    ],
  },
  {
    label: 'Administración',
    icon: 'administration',
    children: [
      {
        label: 'Equipo y cuentas de enfermería',
        icon: 'nurseTeam',
        href: '/nursing-team',
        permission: 'nurses:manage',
        actionId: 'NURSE-TEAM-NAVIGATE',
      },
      {
        label: 'Catálogos operativos',
        icon: 'operational',
        href: '/catalogs/operational',
        permission: 'catalogs:read',
        actionId: 'OPERATIONAL-CATALOG-NAVIGATE',
      },
      {
        label: 'Médicos y recursos',
        icon: 'doctors',
        href: '/doctors',
        permission: 'settings:write',
        actionId: 'DOCTOR-NAVIGATE',
      },
      {
        label: 'Catálogos',
        icon: 'catalogs',
        href: '/catalogs',
        permission: 'catalogs:read',
        actionId: 'CATALOG-NAVIGATE',
      },
      {
        label: 'Importar información',
        icon: 'import',
        href: '/import',
        permission: 'settings:write',
        actionId: 'INFORMATION-IMPORT-NAVIGATE',
      },
    ],
  },
  {
    label: 'Reportes y control',
    icon: 'reports',
    children: [
      {
        label: 'Analítica de accesos',
        icon: 'analytics',
        href: '/analytics/logins',
        permission: 'login-analytics:read',
        actionId: 'LOGIN-ANALYTICS-NAVIGATE',
      },
      {
        label: 'Visitas y metas · venta de equipos',
        icon: 'visits',
        href: '/reports/visits-goals',
        permission: 'reports:read',
        actionId: 'VISITS-GOALS-NAVIGATE',
      },
      {
        label: 'Visitas clínicas',
        icon: 'visits',
        href: '/reports/home-visits',
        permission: 'reports:read',
        actionId: 'HOME-VISITS-NAVIGATE',
      },
      {
        label: 'Horas de enfermería',
        icon: 'nurseHours',
        href: '/reports/nurse-hours',
        permission: 'reports:read',
        actionId: 'NURSE-HOURS-NAVIGATE',
      },
      {
        label: 'Auditoría',
        icon: 'audit',
        href: '/audit',
        permission: 'audit:read',
        actionId: 'AUDIT-NAVIGATE',
      },
    ],
  },
  {
    label: 'Ayuda y seguimiento',
    icon: 'help',
    children: [
      {
        label: 'Tutorial',
        icon: 'tutorial',
        href: '/tutorial',
        permission: 'dashboard:read',
        actionId: 'TUTORIAL-NAVIGATE',
      },
      {
        label: 'Ayuda',
        icon: 'help',
        href: '/help',
        permission: 'dashboard:read',
        actionId: 'HELP-NAVIGATE',
      },
      {
        label: 'Preguntas o errores encontrados',
        icon: 'feedback',
        href: '/feedback',
        permission: 'dashboard:read',
        actionId: 'FEEDBACK-NAVIGATE',
      },
      {
        label: 'Cambios solicitados',
        icon: 'changes',
        href: '/changes',
        permission: 'dashboard:read',
        actionId: 'CLIENT-CHANGES-NAVIGATE',
      },
    ],
  },
];

function NavigationGlyph({
  icon,
  compact = false,
}: {
  icon: NavigationIconName;
  compact?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`nav-item-glyph${compact ? ' nav-item-glyph-compact' : ''}`}
      data-navigation-icon={icon}
    >
      <svg
        width={compact ? 15 : 18}
        height={compact ? 15 : 18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={navigationIconPaths[icon]} />
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
  if (pathname === '/profile') return 'Mi perfil';
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

function DashboardAccessRedirect({ session }: { session: AuthSession }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(landingPath(session));
  }, [router, session]);
  return (
    <main className="access-denied" role="status">
      Abriendo una pantalla disponible para tu cuenta…
    </main>
  );
}

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const { can, canOpenDashboard, loading, logout, session } = useAuth();
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
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [commercialGrant, setCommercialGrant] = useState<{
    userId: string;
    scope: 'REP' | 'MANAGER' | null;
  } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    Inicio: true,
  });
  const required = permissionForPath(pathname);
  const sessionUserId = session?.userId;
  const sessionMode = session?.mode;
  const commercialAccess =
    commercialGrant && commercialGrant.userId === sessionUserId ? commercialGrant.scope : null;

  useEffect(() => {
    if (!sessionUserId || !isServerDataMode(sessionMode)) return;
    const controller = new AbortController();
    void fetch('/api/profile', { cache: 'no-store', signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<AccountProfile>) : null))
      .then((profile) => {
        if (!controller.signal.aborted) setAccountProfile(profile);
      })
      .catch(() => undefined);
    const refresh = (event: Event) =>
      setAccountProfile((event as CustomEvent<AccountProfile>).detail);
    window.addEventListener('analiza:profile-updated', refresh);
    return () => {
      controller.abort();
      window.removeEventListener('analiza:profile-updated', refresh);
    };
  }, [sessionUserId, sessionMode]);

  useEffect(() => {
    if (!sessionUserId || !isServerDataMode(sessionMode)) return;
    const controller = new AbortController();
    void fetch('/api/operations/access', { cache: 'no-store', signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { commercialAccess: null }))
      .then((result) => {
        if (!controller.signal.aborted)
          setCommercialGrant({ userId: sessionUserId, scope: result.commercialAccess ?? null });
      })
      .catch(() => {
        if (!controller.signal.aborted) setCommercialGrant({ userId: sessionUserId, scope: null });
      });
    return () => controller.abort();
  }, [sessionUserId, sessionMode]);

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
  if (pathname.startsWith('/dashboard') && !canOpenDashboard) {
    return <DashboardAccessRedirect session={session} />;
  }
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
            href={canOpenDashboard ? '/dashboard' : '/patients'}
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
                      <NavigationGlyph icon={group.icon} />
                      <span className="nav-item-label">{group.label}</span>
                    </Link>
                  </li>
                );
              }

              const childrenForRole =
                group.children?.filter(
                  (child) =>
                    can(child.permission) &&
                    (child.href !== '/reports/visits-goals' || commercialAccess !== null) &&
                    (child.href !== '/dashboard' || canOpenDashboard) &&
                    isReleasedPath(child.href),
                ) ?? [];
              if (!childrenForRole.length) return null;
              const hasCurrentChild = childrenForRole.some((child) =>
                isActive(pathname, child.href),
              );
              const open = expanded[group.label] ?? hasCurrentChild;

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
                      <NavigationGlyph icon={group.icon} />
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
                            <NavigationGlyph compact icon={child.icon} />
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
              <span className="account-avatar">
                {accountProfile?.avatarVersion ? (
                  <Image
                    alt=""
                    height={34}
                    width={34}
                    unoptimized
                    src={`/api/profile/avatar?v=${accountProfile.avatarVersion}`}
                  />
                ) : (
                  (accountProfile?.displayName || session.role).slice(0, 1).toUpperCase()
                )}
              </span>
              <span className="account-copy">
                <strong>{accountProfile?.displayName || 'Mi cuenta'}</strong>
                <small>{session.role}</small>
              </span>
              <span aria-hidden="true">•••</span>
            </button>
            {userMenuOpen ? (
              <div className="user-menu-popover" role="menu">
                <p>
                  <strong>Organización</strong>
                  <br />
                  Analiza en Casa · espacio conectado
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
                  data-action-id="USER-PROFILE-EDIT"
                  onClick={() => {
                    setUserMenuOpen(false);
                    closeMobileNavigation();
                    router.push('/profile');
                  }}
                  role="menuitem"
                  type="button"
                >
                  Editar mi perfil
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
            {can('dashboard:read') ? (
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
            ) : null}
          </div>
          <div className="topbar-actions">
            <span className="topbar-page-name">{currentPageLabel(pathname)}</span>
            <ScreenHelp key={pathname} pathname={pathname} pageLabel={currentPageLabel(pathname)} />
            <button
              className="topbar-profile"
              data-action-id="USER-PROFILE-OPEN"
              onClick={(event) => {
                profileReturnFocusRef.current = event.currentTarget;
                setUserProfileOpen(true);
              }}
              type="button"
            >
              <span className="account-avatar">
                {accountProfile?.avatarVersion ? (
                  <Image
                    alt=""
                    height={34}
                    width={34}
                    unoptimized
                    src={`/api/profile/avatar?v=${accountProfile.avatarVersion}`}
                  />
                ) : (
                  (accountProfile?.displayName || session.role).slice(0, 1).toUpperCase()
                )}
              </span>
              <span>
                <strong>{accountProfile?.displayName || 'Mi cuenta'}</strong>
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
                      <dd>Analiza en Casa · espacio conectado</dd>
                    </div>
                  </dl>
                </div>
                <div className="dialog-footer">
                  <button
                    className="button button-primary"
                    data-action-id="USER-PROFILE-EDIT"
                    onClick={() => {
                      closeUserProfile();
                      router.push('/profile');
                    }}
                    type="button"
                  >
                    Editar mi perfil
                  </button>
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
