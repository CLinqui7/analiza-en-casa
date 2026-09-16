'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers';
import { can } from '@/lib/permissions';
import { useOperations } from '@/lib/use-operations';
import { isServerDataMode } from '@/lib/data-mode';

export function DemoDataButton() {
  const { session } = useAuth();
  const operations = useOperations();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  if (!can(session?.role, 'patients:write')) return null;

  async function loadExamples() {
    if (!session || loading) return;
    setLoading(true);
    setMessage('');
    try {
      if (!isServerDataMode(session.mode)) {
        setMessage('Los datos de prueba ya están disponibles en este modo.');
        setLoading(false);
        return;
      }
      const saved = await operations.execute({ command: 'workspace.seed-demo' });
      if (!saved) throw new Error(operations.error || 'No se pudo preparar el escenario.');
      setMessage(
        'Escenario de prueba listo: pacientes, enfermería, hospitalización, agenda y cotización.',
      );
      window.setTimeout(() => window.location.reload(), 900);
    } catch {
      setMessage('No fue posible cargar los datos de prueba. Intenta nuevamente.');
      setLoading(false);
    }
  }

  return (
    <span id="datos-prueba">
      <button
        className="button button-ghost"
        disabled={loading}
        onClick={loadExamples}
        type="button"
      >
        {loading ? 'Cargando…' : 'Datos de prueba'}
      </button>
      {message ? (
        <span className="sr-only" role="status">
          {message}
        </span>
      ) : null}
    </span>
  );
}
