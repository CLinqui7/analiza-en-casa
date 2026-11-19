'use client';

import Link from 'next/link';
import { InventoryTraceability } from '@/components/inventory-traceability';
import { useAuth, useWorkspace } from '@/components/providers';
import { useOperations } from '@/lib/use-operations';

export default function TraceabilityPage() {
  const { can } = useAuth();
  const { catalogItems, refreshWorkspace } = useWorkspace();
  const operations = useOperations();
  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Inventario y compras · Kárdex</p>
          <h1>Control de lotes y series</h1>
        </div>
        <Link className="button button-secondary" href="/inventory/kardex">
          Volver al Kárdex
        </Link>
      </header>
      <InventoryTraceability
        records={operations.traceRecords}
        items={catalogItems}
        warehouses={operations.warehouses}
        canWrite={can('inventory:write')}
        connected={operations.connected}
        busy={operations.busy}
        error={operations.error}
        execute={operations.execute}
        refreshWorkspace={refreshWorkspace}
      />
    </div>
  );
}
