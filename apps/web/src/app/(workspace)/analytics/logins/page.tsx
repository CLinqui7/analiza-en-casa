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
  dailyLogins: { day: string; count: number }[];
};

type LoginHistory = {
  userId: string;
  month: string;
  days: { day: string; count: number }[];
  events: { id: string; occurredAt: string }[];
};

type UserFilter = 'all' | 'recent' | 'never' | 'inactive';

type IconName = 'activity' | 'calendar' | 'check' | 'clock' | 'search' | 'shield' | 'users';

const dateTime = new Intl.DateTimeFormat('es-SV', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/El_Salvador',
});
const chartDate = new Intl.DateTimeFormat('es-SV', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const monthTitle = new Intl.DateTimeFormat('es-SV', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const fullDay = new Intl.DateTimeFormat('es-SV', { dateStyle: 'full', timeZone: 'UTC' });
const accessTime = new Intl.DateTimeFormat('es-SV', { timeStyle: 'short', timeZone: 'America/El_Salvador' });
const salvadorDay = new Intl.DateTimeFormat('en-US', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/El_Salvador',
});

function localDay(value: Date | string) {
  const parts = salvadorDay.formatToParts(new Date(value));
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function shiftMonth(month: string, delta: number) {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1 + delta, 1)).toISOString().slice(0, 7);
}

function calendarCells(month: string) {
  const [year, number] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1));
  const leading = (first.getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`),
  ];
}

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

function formatChartDay(day: string) {
  return chartDate.format(new Date(`${day}T00:00:00.000Z`));
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

async function loadLoginHistory(userId: string, month: string, signal: AbortSignal): Promise<LoginHistory> {
  const params = new URLSearchParams({ userId, month });
  const response = await fetch(`/api/login-analytics/history?${params}`, {
    cache: 'no-store', credentials: 'same-origin', signal,
  });
  const payload = (await response.json()) as LoginHistory | { error?: string };
  if (!response.ok) throw new Error('error' in payload ? payload.error : 'No se pudo cargar el calendario.');
  return payload as LoginHistory;
}

function LoginCalendar({ user, onClose }: { user: AnalyticsUser; onClose: () => void }) {
  const [month, setMonth] = useState(() => localDay(user.lastLoginAt ?? new Date()).slice(0, 7));
  const [selectedDay, setSelectedDay] = useState<string | null>(() => user.lastLoginAt ? localDay(user.lastLoginAt) : null);
  const { data, error, isLoading } = useQuery<LoginHistory, Error>({
    queryKey: ['login-history', user.userId, month],
    queryFn: ({ signal }) => loadLoginHistory(user.userId, month, signal),
    staleTime: 30_000,
  });
  const counts = new Map(data?.days.map(({ day, count }) => [day, count]) ?? []);
  const dayEvents = selectedDay
    ? (data?.events ?? []).filter((event) => localDay(event.occurredAt) === selectedDay)
    : [];
  const firstMonth = user.firstLoginAt ? localDay(user.firstLoginAt).slice(0, 7) : localDay(new Date()).slice(0, 7);
  const currentMonth = localDay(new Date()).slice(0, 7);
  const changeMonth = (delta: number) => {
    setMonth((value) => shiftMonth(value, delta));
    setSelectedDay(null);
  };

  return (
    <section aria-label={`Calendario de accesos de ${user.displayName}`} className={styles.calendarPanel}>
      <div className={styles.calendarHeading}>
        <div>
          <span className={styles.sectionKicker}>Historial completo por mes</span>
          <h3>Accesos de {user.displayName}</h3>
          <p>Selecciona un día para ver cada hora de entrada. Horario de El Salvador.</p>
        </div>
        <button aria-label="Cerrar calendario" className={styles.calendarClose} onClick={onClose} type="button">×</button>
      </div>
      <div className={styles.calendarBody}>
        <div>
          <div className={styles.monthNavigation}>
            <button aria-label="Mes anterior" disabled={month <= firstMonth} onClick={() => changeMonth(-1)} type="button">‹</button>
            <strong>{monthTitle.format(new Date(`${month}-01T00:00:00.000Z`))}</strong>
            <button aria-label="Mes siguiente" disabled={month >= currentMonth} onClick={() => changeMonth(1)} type="button">›</button>
          </div>
          <div aria-label="Calendario mensual de accesos" className={styles.calendarGrid} role="group">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => <span className={styles.weekday} key={day}>{day}</span>)}
            {calendarCells(month).map((day, index) => day ? (
              <button
                aria-label={`${fullDay.format(new Date(`${day}T00:00:00.000Z`))}: ${counts.get(day) ?? 0} accesos`}
                aria-pressed={selectedDay === day}
                className={`${styles.calendarDay} ${counts.has(day) ? styles.calendarDayActive : ''} ${selectedDay === day ? styles.calendarDaySelected : ''}`}
                key={day}
                onClick={() => setSelectedDay(day)}
                type="button"
              >
                <span>{Number(day.slice(-2))}</span>
                {counts.has(day) ? <small>{counts.get(day)}</small> : null}
              </button>
            ) : <span aria-hidden="true" key={`empty-${index}`} />)}
          </div>
          <p className={styles.calendarFootnote}>
            {isLoading ? 'Cargando accesos…' : `${data?.events.length ?? 0} accesos en este mes · ${data?.days.length ?? 0} días con actividad`}
          </p>
        </div>
        <div className={styles.dayDetail}>
          <span className={styles.sectionKicker}>Detalle del día</span>
          <h4>{selectedDay ? fullDay.format(new Date(`${selectedDay}T00:00:00.000Z`)) : 'Elige una fecha'}</h4>
          {error ? <p className={styles.calendarError} role="alert">{error.message}</p> : null}
          {selectedDay && !isLoading && !error ? (
            dayEvents.length ? (
              <ol className={styles.dayEvents}>
                {dayEvents.map((event, index) => (
                  <li key={event.id}>
                    <span className={styles.eventSequence}>{String(index + 1).padStart(2, '0')}</span>
                    <span>Inicio de sesión exitoso</span>
                    <time dateTime={event.occurredAt}>{accessTime.format(new Date(event.occurredAt))}</time>
                  </li>
                ))}
              </ol>
            ) : <p className={styles.dayEmpty}>No hay accesos registrados en esta fecha.</p>
          ) : null}
          {!selectedDay ? <p className={styles.dayEmpty}>Los días resaltados indican actividad. Haz clic para ver las horas de entrada.</p> : null}
        </div>
      </div>
      <p className={styles.calendarCaveat}>Solo se muestran ingresos exitosos desde que se activó la bitácora; los anteriores no se pueden reconstruir.</p>
    </section>
  );
}

export default function LoginAnalyticsPage() {
  const [query, setQuery] = useState('');
  const [userFilter, setUserFilter] = useState<UserFilter>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
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
    return (snapshot?.users ?? []).filter((user) => {
      if (userFilter === 'recent' && user.loginsLast30Days === 0) return false;
      if (userFilter === 'never' && user.totalLogins !== 0) return false;
      if (userFilter === 'inactive' && user.active) return false;
      return (
        !normalized ||
        `${user.displayName} ${user.email} ${user.role}`
          .toLocaleLowerCase('es-SV')
          .includes(normalized)
      );
    });
  }, [query, snapshot?.users, userFilter]);
  const selectedUser = snapshot?.users.find((user) => user.userId === selectedUserId);

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
  const dailyLogins = snapshot?.dailyLogins ?? [];
  const maximumDaily = Math.max(1, ...dailyLogins.map(({ count }) => count));
  const previousWeek = dailyLogins.slice(0, 7).reduce((sum, day) => sum + day.count, 0);
  const currentWeek = dailyLogins.slice(7).reduce((sum, day) => sum + day.count, 0);
  const busiestDay = dailyLogins.reduce<(typeof dailyLogins)[number] | null>(
    (best, day) => (day.count > (best?.count ?? 0) ? day : best),
    null,
  );
  const maximumLogins = Math.max(1, ...visibleUsers.map((user) => user.totalLogins));
  const filters: { id: UserFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Todos', count: totals.users },
    { id: 'recent', label: 'Con acceso en 30 días', count: totals.activeLast30 },
    {
      id: 'never',
      label: 'Sin accesos',
      count: snapshot?.users.filter((user) => user.totalLogins === 0).length ?? 0,
    },
    {
      id: 'inactive',
      label: 'Desactivados',
      count: snapshot?.users.filter((user) => !user.active).length ?? 0,
    },
  ];
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
      label: 'Con acceso en 30 días',
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
              Panel privado · actualización automática
            </span>
            <p className={styles.eyebrow}>Analiza en Casa · Analíticas</p>
            <h1>Bitácora de accesos</h1>
            <p className={styles.heroDescription}>
              Una vista clara de los accesos de tu equipo: actividad diaria, frecuencia por usuario
              y últimos ingresos registrados.
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
              <strong>{snapshot ? metric.value.toLocaleString('es-SV') : '—'}</strong>
              <span className={styles.metricDetail}>{metric.detail}</span>
            </div>
          </article>
        ))}
      </section>

      <section aria-labelledby="access-trend-title" className={styles.trendPanel}>
        <div className={styles.trendHeading}>
          <div>
            <span className={styles.sectionKicker}>Actividad diaria</span>
            <h2 id="access-trend-title">Accesos en los últimos 14 días</h2>
            <p>Ingresos exitosos por día calendario, hora de El Salvador.</p>
            <p className={styles.mobileChartHint}>En móvil se muestran los 7 días más recientes.</p>
          </div>
          <div className={styles.trendSummary}>
            <strong>{snapshot ? currentWeek : '—'}</strong>
            <span>últimos 7 días calendario</span>
            {snapshot ? <small>7 anteriores: {previousWeek}</small> : null}
          </div>
        </div>
        {snapshot ? (
          <>
            <ol aria-label="Accesos diarios" className={styles.trendChart}>
              {dailyLogins.map(({ day, count }) => (
                <li aria-label={`${formatChartDay(day)}: ${count} accesos`} key={day}>
                  <strong>{count || ''}</strong>
                  <span className={styles.trendTrack}>
                    <span
                      className={styles.trendBar}
                      style={{
                        height: count ? `${Math.max(9, (count / maximumDaily) * 100)}%` : '0%',
                      }}
                    />
                  </span>
                  <time dateTime={day}>{formatChartDay(day)}</time>
                </li>
              ))}
            </ol>
            <p className={styles.trendFootnote}>
              {busiestDay
                ? `Día con más actividad: ${formatChartDay(busiestDay.day)} · ${busiestDay.count} accesos.`
                : 'Todavía no hay accesos registrados en este período.'}
            </p>
          </>
        ) : (
          <p className={styles.trendPlaceholder} role="status">
            {loading ? 'Preparando la tendencia de accesos…' : 'No se pudo mostrar la tendencia.'}
          </p>
        )}
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

          <div aria-label="Filtrar usuarios" className={styles.filterRow} role="group">
            {filters.map((filter) => (
              <button
                aria-pressed={userFilter === filter.id}
                className={`${styles.filterChip} ${userFilter === filter.id ? styles.filterChipActive : ''}`}
                key={filter.id}
                onClick={() => setUserFilter(filter.id)}
                type="button"
              >
                {filter.label} <span>{filter.count}</span>
              </button>
            ))}
            {snapshot ? (
              <span className={styles.resultCount}>{visibleUsers.length} visibles</span>
            ) : null}
          </div>
          <p className={styles.tableSwipeHint}>Desliza la tabla para ver todas las métricas →</p>

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
                          <button
                            aria-expanded={selectedUserId === user.userId}
                            className={styles.historyButton}
                            onClick={() => setSelectedUserId((current) => current === user.userId ? null : user.userId)}
                            type="button"
                          >
                            <AnalyticsIcon name="calendar" /> Ver calendario
                          </button>
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
                {!visibleUsers.length && snapshot ? (
                  <tr>
                    <td className={styles.emptyState} colSpan={7}>
                      <span className={styles.emptyIcon}>
                        <AnalyticsIcon name="search" />
                      </span>
                      <strong>
                        {query || userFilter !== 'all'
                          ? 'No encontramos coincidencias'
                          : 'Aún no hay usuarios'}
                      </strong>
                      <span>
                        {query || userFilter !== 'all'
                          ? 'Prueba con otro filtro, nombre, correo o rol.'
                          : 'Los usuarios aparecerán cuando se registren.'}
                      </span>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {selectedUser ? (
            <LoginCalendar key={selectedUser.userId} onClose={() => setSelectedUserId(null)} user={selectedUser} />
          ) : null}
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

          {snapshot && !snapshot.recentLogins.length ? (
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
