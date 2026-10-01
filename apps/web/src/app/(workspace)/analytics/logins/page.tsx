'use client';

import { useMemo, useState } from 'react';
import { Button, Panel } from '@analiza/ui';
import { useQuery } from '@tanstack/react-query';

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

const dateTime = new Intl.DateTimeFormat('es-SV', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/El_Salvador',
});

function formatDate(value: string | null) {
  return value ? dateTime.format(new Date(value)) : 'Sin accesos registrados';
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

  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Analiza en Casa Analytics</p>
          <h1>Bitácora de accesos</h1>
          <p>
            Inicios de sesión exitosos por usuario y frecuencia. Se actualiza automáticamente cada
            minuto y no registra contraseñas, direcciones IP ni información clínica.
          </p>
        </div>
        <Button
          className="button-secondary"
          data-action-id="LOGIN-ANALYTICS-REFRESH"
          disabled={loading || refreshing}
          onClick={() => void refetch()}
          type="button"
        >
          {refreshing ? 'Actualizando…' : 'Actualizar ahora'}
        </Button>
      </header>

      {error ? (
        <p className="notice danger" role="alert">
          {error.message}
        </p>
      ) : null}
      {loading && !snapshot ? <p className="notice">Cargando bitácora segura…</p> : null}

      <section aria-label="Resumen de accesos" className="metric-grid">
        <article className="metric-card">
          <span>Usuarios observados</span>
          <strong>{totals.users}</strong>
        </article>
        <article className="metric-card">
          <span>Con actividad en 30 días</span>
          <strong>{totals.activeLast30}</strong>
        </article>
        <article className="metric-card">
          <span>Accesos en 7 días</span>
          <strong>{totals.last7}</strong>
        </article>
        <article className="metric-card">
          <span>Accesos registrados</span>
          <strong>{totals.all}</strong>
        </article>
      </section>

      <Panel>
        <div className="panel-heading page-header-actions">
          <div>
            <h2>Frecuencia por usuario</h2>
            <p>
              El historial empieza con la activación de esta bitácora; los accesos anteriores no se
              reconstruyen.
            </p>
          </div>
          <label>
            Buscar usuario
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nombre, correo o rol"
              type="search"
              value={query}
            />
          </label>
        </div>
        <div className="table-wrap">
          <table>
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
                    <strong>{user.displayName}</strong>
                    <p className="field-help">{user.email}</p>
                    <p className="field-help">{user.role}</p>
                  </td>
                  <td>{user.active ? 'Activo' : 'Desactivado'}</td>
                  <td>{formatDate(user.lastLoginAt)}</td>
                  <td>{user.loginsLast7Days}</td>
                  <td>{user.loginsLast30Days}</td>
                  <td>{user.activeDaysLast30Days}</td>
                  <td>{user.totalLogins}</td>
                </tr>
              ))}
              {!visibleUsers.length ? (
                <tr>
                  <td className="empty-state" colSpan={7}>
                    {query
                      ? 'No hay usuarios que coincidan con la búsqueda.'
                      : 'No hay usuarios registrados.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <div className="panel-heading">
          <h2>Accesos recientes</h2>
          <p>Los 100 eventos exitosos más recientes, ordenados del más nuevo al más antiguo.</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Usuario</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {(snapshot?.recentLogins ?? []).map((event) => (
                <tr key={event.id}>
                  <td>{formatDate(event.occurredAt)}</td>
                  <td>
                    {event.displayName}
                    <p className="field-help">{event.email}</p>
                  </td>
                  <td>Acceso exitoso</td>
                </tr>
              ))}
              {!snapshot?.recentLogins.length ? (
                <tr>
                  <td className="empty-state" colSpan={3}>
                    Aún no hay accesos posteriores a la activación de la bitácora.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      {snapshot ? (
        <p className="field-help" role="status">
          Última actualización: {formatDate(snapshot.generatedAt)} · Seguimiento desde:{' '}
          {formatDate(snapshot.trackingSince)}
        </p>
      ) : null}
    </div>
  );
}
