'use client';
import { isServerDataMode } from '@/lib/data-mode';

import { useCallback, useEffect, useState } from 'react';
import { emptyOperations, type OperationsSnapshot } from '@analiza/contracts';
import { useAuth } from '@/components/providers';
import { mongoMutationHeaders } from './auth';
import { demoOperationsConfiguration } from './demo-data';

export function useOperations() {
  const { session } = useAuth();
  const [data, setData] = useState<OperationsSnapshot>(emptyOperations);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const connected = isServerDataMode(session?.mode);
  const reload = useCallback(async () => {
    if (!connected) return;
    const response = await fetch('/api/operations', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'No se pudieron cargar los registros.');
    setData(body);
    setError(null);
  }, [connected]);
  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController();
    void fetch('/api/operations', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'No se pudieron cargar los registros.');
        return body as OperationsSnapshot;
      })
      .then((body) => {
        if (!controller.signal.aborted) {
          setData(body);
          setError(null);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause.message);
      });
    return () => controller.abort();
  }, [connected]);
  const execute = async (command: unknown): Promise<boolean> => {
    if (!connected) {
      setError('Esta operación necesita la conexión MongoDB. No se guardó en este navegador.');
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...mongoMutationHeaders() },
        body: JSON.stringify(command),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se guardó el registro.');
      await reload();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se guardó el registro.');
      return false;
    } finally {
      setBusy(false);
    }
  };
  const visibleData = connected
    ? data
    : { ...emptyOperations(), configuration: demoOperationsConfiguration };
  return { ...visibleData, error, busy, connected, execute, reload };
}
