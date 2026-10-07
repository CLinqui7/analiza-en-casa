'use client';

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Button } from '@analiza/ui';
import { useQuery } from '@tanstack/react-query';
import styles from './login-analytics.module.css';

type AnalyticsUser = {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  active: boolean;
  totalLogins: number;
  loginsLast7Days: number;
  loginsLast30Days: number;
  activeDaysLast30Days: number;
  firstLoginAt: string | null;
  lastLoginAt: string | null;
};

type RecentLogin = {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  occurredAt: string;
};

type LoginAnalytics = {
  generatedAt: string;
  trackingSince: string | null;
  users: AnalyticsUser[];
  recentLogins: RecentLogin[];
};

type IconName = 'activity' | 'calendar' | 'check' | 'clock' | 'search' | 'shield' | 'users';

const dateTime = new Intl.DateTimeFormat('es-SV', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/El_Salvador',
});

const roleLabels: Record<string, string> = {
  ADMIN: 'Administración',
  ANALYTICS: 'Analítica',
  AUDITOR: 'Auditoría',
  DOCTOR: 'Medicina',
  FINANCE: 'Finanzas',
  INVENTORY: 'Inventario',
  MANAGER: 'Gerencia',
  NURSE: 'Enfermería',
  NURSE_MANAGER: 'Jefatura de enfermería',
  WEBMASTER: 'Webmaster',
};

function AnalyticsIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    activity: <path d="M4 13h3l2.5-7 4 13 2.5-6H20" />,
    calendar: (
      <>
        <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z" />
        <path d="M8 13h2M14 13h2M8 17h2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m16 16 4 4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19v-1.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V19M15.5 5.5a3 3 0 0 1 0 5M17 13a4 4 0 0 1 3.5 4v2" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[name]}
      </g>
    </svg>
  );
}

function formatDate(value: string | null) {
  return value ? dateTime.format(new Date(value)) : 'Sin accesos registrados';
}

function initials(name: string) {
  const characters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('es-SV'))
    .join('');
  return characters || 'U';
}

async function loadLoginAnalytics(signal: AbortSignal): Promise<LoginAnalytics> {
  const response = await fetch('/api/login-analytics', {
    cache: 'no-store',
    credentials: 'same-origin',
    signal,
  });
  const payload = (await response.json()) as LoginAnalytics | { error?: string };
  if (!response.ok) {
    throw new Error('error' in payload ? payload.error : 'No fue posible cargar la bitácora.');
  }
  return payload as LoginAnalytics;
}

export default function LoginAnalyticsPage() {
  const [query, setQuery] = useState('');
  const {
    data: snapshot,
    error,
    isFetching,
    isLoading: loading,
    refetch,
  } = useQuery<LoginAnalytics, Error>({
    queryKey: ['login-analytics'],
    queryFn: ({ signal }) => loadLoginAnalytics(signal),
    refetchInterval: 60_000,
    retry: 1,
    staleTime: 30_000,
  });
  const refreshing = isFetching && Boolean(snapshot);

  const visibleUsers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es-SV');
    if (!normalized) return snapshot?.users ?? [];
    return (snapshot?.users ?? []).filter((user) =>
      `${user.displayName} ${user.email} ${user.role}`
        .toLocaleLowerCase('es-SV')
        .includes(normalized),
    );
  }, [query, snapshot?.users]);

  const totals = useMemo(
    () => ({
      users: snapshot?.users.length ?? 0,
      activeLast30: snapshot?.users.filter((user) => user.loginsLast30Days > 0).length ?? 0,
      last7: snapshot?.users.reduce((sum, user) => sum + user.loginsLast7Days, 0) ?? 0,
      all: snapshot?.users.reduce((sum, user) => sum + user.totalLogins, 0) ?? 0,
    }),
    [snapshot?.users],
  );

  const activeRate = totals.users ? Math.round((totals.activeLast30 / totals.users) * 100) : 0;
  const maximumLogins = Math.max(1, ...visibleUsers.map((user) => user.totalLogins));
  const metrics = [
    {
      icon: 'users' as const,
      label: 'Usuarios observados',
      value: totals.users,
      detail: 'Cuentas activas y desactivadas',
      tone: styles.metricCoral,
    },
    {
      icon: 'calendar' as const,
      label: 'Activos en 30 días',
      value: totals.activeLast30,
      detail: `${activeRate}% de los usuarios observados`,
      tone: styles.metricTeal,
    },
    {
      icon: 'activity' as const,
      label: 'Accesos en 7 días',
      value: totals.last7,
      detail: 'Actividad de la última semana',
      tone: styles.metricBlue,
    },
    {
      icon: 'clock' as const,
      label: 'Accesos registrados',
      value: totals.all,
      detail: 'Desde que inició la bitácora',
      tone: styles.metricViolet,
    },
  ];

  return (
    <div className={styles.analyticsPage}>
      <header className={styles.hero}>
        <span aria-hidden="true" className={styles.heroOrbOne} />
        <span aria-hidden="true" className={styles.heroOrbTwo} />
        <div className={styles.heroContent}>
          <div>
            <span className={styles.privateBadge}>
              <span className={styles.liveDot} />
              Panel privado · actualización en vivo
            </span>
            <p className={styles.eyebrow}>Analiza en Casa Analytics</p>
            <h1>Bitácora de accesos</h1>
            <p className={styles.heroDescription}>
              Conoce quién entra a la plataforma y con qué frecuencia desde un espacio seguro, claro
              y siempre actualizado.
            </p>
            <div className={styles.heroMeta}>
              <span>
                <AnalyticsIcon name="shield" /> Solo tu organización
              </span>
              <span>
                <AnalyticsIcon name="clock" /> Actualización cada 60 segundos
              </span>
            </div>
          </div>
          <Button
            className={styles.refreshButton}
            data-action-id="LOGIN-ANALYTICS-REFRESH"
            disabled={loading || refreshing}
            onClick={() => void refetch()}
            type="button"
          >
            <span className={refreshing ? styles.spinning : undefined}>
              <AnalyticsIcon name="activity" />
            </span>
            {refreshing ? 'Actualizando…' : 'Actualizar ahora'}
          </Button>
        </div>
      </header>

      {error ? (
        <p className={styles.errorNotice} role="alert">
          {error.message}
        </p>
      ) : null}
      {loading && !snapshot ? (
        <p className={styles.loadingNotice} role="status">
          <span className={styles.loadingDot} /> Cargando bitácora segura…
        </p>
      ) : null}

      <section aria-label="Resumen de accesos" className={styles.metricsGrid}>
        {metrics.map((metric, index) => (
          <article
            className={`${styles.metricCard} ${metric.tone}`}
            key={metric.label}
            style={{ '--entrance-delay': `${index * 70}ms` } as CSSProperties}
          >
            <span className={styles.metricIcon}>
              <AnalyticsIcon name={metric.icon} />
            </span>
            <div>
              <span className={styles.metricLabel}>{metric.label}</span>
              <strong>{metric.value.toLocaleString('es-SV')}</strong>
              <span className={styles.metricDetail}>{metric.detail}</span>
            </div>
          </article>
        ))}
      </section>

      <div className={styles.contentGrid}>
        <section aria-labelledby="user-frequency-title" className={styles.mainPanel}>
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.sectionKicker}>Vista detallada</span>
              <h2 id="user-frequency-title">Frecuencia por usuario</h2>
              <p>
                El historial inicia al activar la bitácora; los accesos anteriores no se
                reconstruyen.
              </p>
            </div>
            <label className={styles.searchField}>
              <span className={styles.srOnly}>Buscar usuario</span>
              <AnalyticsIcon name="search" />
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre, correo o rol"
                type="search"
                value={query}
              />
              {query ? (
                <button aria-label="Limpiar búsqueda" onClick={() => setQuery('')} type="button">
                  ×
                </button>
              ) : null}
            </label>
          </div>

          <div
            aria-label="Tabla desplazable de frecuencia por usuario"
            className={styles.tableWrap}
            role="region"
            tabIndex={0}
          >
            <table className={styles.usersTable}>
              <caption className={styles.srOnly}>
                Frecuencia de inicio de sesión por usuario
              </caption>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Estado</th>
                  <th>Último acceso</th>
                  <th>7 días</th>
                  <th>30 días</th>
                  <th>Días activos</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => (
                  <tr key={user.userId}>
                    <td>
                      <div className={styles.userCell}>
                        <span aria-hidden="true" className={styles.avatar}>
                          {initials(user.displayName)}
                        </span>
                        <span>
                          <strong>{user.displayName}</strong>
                          <span className={styles.email}>{user.email}</span>
                          <span className={styles.roleLabel}>
                            {roleLabels[user.role] ?? user.role}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`${styles.statusPill} ${
                          user.active ? styles.statusActive : styles.statusInactive
                        }`}
                      >
                        <span /> {user.active ? 'Activo' : 'Desactivado'}
                      </span>
                    </td>
                    <td className={styles.dateCell}>{formatDate(user.lastLoginAt)}</td>
                    <td className={styles.numberCell}>{user.loginsLast7Days}</td>
                    <td className={styles.numberCell}>{user.loginsLast30Days}</td>
                    <td className={styles.numberCell}>{user.activeDaysLast30Days}</td>
                    <td>
                      <div className={styles.totalCell}>
                        <strong>{user.totalLogins}</strong>
                        <span aria-hidden="true" className={styles.frequencyTrack}>
                          <span
                            style={{
                              width: `${Math.max(7, (user.totalLogins / maximumLogins) * 100)}%`,
                            }}
                          />
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {!visibleUsers.length ? (
                  <tr>
                    <td className={styles.emptyState} colSpan={7}>
                      <span className={styles.emptyIcon}>
                        <AnalyticsIcon name="search" />
                      </span>
                      <strong>
                        {query ? 'No encontramos coincidencias' : 'Aún no hay usuarios'}
                      </strong>
                      <span>
                        {query
                          ? 'Prueba con otro nombre, correo o rol.'
                          : 'Los usuarios aparecerán cuando se registren.'}
                      </span>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <aside aria-labelledby="recent-logins-title" className={styles.activityPanel}>
          <div className={styles.activityHeading}>
            <div>
              <span className={styles.sectionKicker}>Actividad</span>
              <h2 id="recent-logins-title">Accesos recientes</h2>
            </div>
            <span className={styles.eventCount}>{snapshot?.recentLogins.length ?? 0}</span>
          </div>
          <p className={styles.activityIntro}>Los eventos exitosos más recientes.</p>

          <ol className={styles.timeline}>
            {(snapshot?.recentLogins ?? []).slice(0, 8).map((event) => (
              <li key={event.id}>
                <span className={styles.timelineMarker}>
                  <AnalyticsIcon name="check" />
                </span>
                <div>
                  <strong>{event.displayName}</strong>
                  <span className={styles.timelineEmail}>{event.email}</span>
                  <time dateTime={event.occurredAt}>{formatDate(event.occurredAt)}</time>
                </div>
              </li>
            ))}
          </ol>

          {!snapshot?.recentLogins.length ? (
            <div className={styles.emptyActivity}>
              <AnalyticsIcon name="clock" />
              <strong>Sin actividad reciente</strong>
              <span>Los próximos accesos aparecerán aquí.</span>
            </div>
          ) : null}

          {(snapshot?.recentLogins.length ?? 0) > 8 ? (
            <p className={styles.moreEvents}>
              +{(snapshot?.recentLogins.length ?? 0) - 8} eventos disponibles en la bitácora
            </p>
          ) : null}
        </aside>
      </div>

      {snapshot ? (
        <footer className={styles.statusFooter} aria-live="polite">
          <span>
            <AnalyticsIcon name="shield" />
            No se almacenan contraseñas, direcciones IP ni información clínica.
          </span>
          <span>
            Actualizado: {formatDate(snapshot.generatedAt)} · Seguimiento desde:{' '}
            {formatDate(snapshot.trackingSince)}
          </span>
        </footer>
      ) : null}
    </div>
  );
}
