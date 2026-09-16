'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers';
import { mongoMutationHeaders } from '@/lib/auth';
import { demoPatients } from '@/lib/demo-data';
import { can } from '@/lib/permissions';

export function DemoDataButton() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  if (!can(session?.role, 'patients:write')) return null;

  async function loadExamples() {
    if (!session || loading) return;
    setLoading(true);
    setMessage('');
    let created = 0;
    try {
      for (const patient of demoPatients.slice(0, 3)) {
        const response = await fetch('/api/patients', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', ...mongoMutationHeaders() },
          body: JSON.stringify(patient),
        });
        if (response.status === 201) created += 1;
        else if (response.status !== 400) throw new Error();
      }
      setMessage(
        created
          ? `Se agregaron ${created} pacientes identificados como demostración.`
          : 'Los datos de prueba ya estaban cargados.',
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
