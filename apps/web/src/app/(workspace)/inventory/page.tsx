'use client';

import { currentInventoryBalance } from '@analiza/domain';
import { Button, EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useWorkspace } from '@/components/providers';

const itemCatalog: Record<string, { name: string; sku: string }> = {
  'inventory-demo-kit': { name: 'Kit operativo demo', sku: 'KIT-DEMO-001' },
  'inventory-demo-supplies': { name: 'Insumos demo', sku: 'INS-DEMO-001' },
};

const warehouses: Record<string, string> = {
  'warehouse-demo-central': 'Bodega central demo',
  'warehouse-demo-north': 'Bodega norte demo',
};

export default function InventoryPage() {
  const { inventoryMovements } = useWorkspace();
  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    const itemIds = [...new Set(inventoryMovements.map((movement) => movement.itemId))];
    return itemIds.map((itemId) => {
      const movements = inventoryMovements.filter((movement) => movement.itemId === itemId);
      const warehouseIds = [...new Set(movements.map((movement) => movement.warehouseId).filter(Boolean))] as string[];
      return {
        itemId,
        type: 'Sintético',
        code: itemCatalog[itemId]?.sku ?? itemId,
        name: itemCatalog[itemId]?.name ?? itemId,
        warehouse: warehouseIds.map((id) => warehouses[id] ?? id).join(', ') || 'Sin bodega documentada',
        available: currentInventoryBalance(inventoryMovements, itemId),
      };
    }).filter((row) => `${row.type} ${row.code} ${row.name} ${row.warehouse}`.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')));
  }, [inventoryMovements, query]);

  return <div className="page-stack">
    <header className="page-header page-header-actions">
      <div><p className="eyebrow">Inventario</p><h1>Gestión de inventario</h1><p>Listado factual derivado de movimientos sintéticos. No calcula compromisos, reservas, lotes, traslados ni reglas de bodega sin una definición aprobada.</p></div>
      <div className="action-row"><Button aria-describedby="inventory-export-help" className="button-secondary" data-action-id="INVENTORY-ITEM-EXPORT" disabled type="button">Excel</Button><Button aria-describedby="inventory-transfer-help" data-action-id="INVENTORY-TRANSFERS" disabled type="button">Traslados</Button></div>
    </header>
    <nav aria-label="Secciones de gestión de inventario" className="tabs">
      <span aria-current="page" className="tab active">Items</span><Link className="tab" href="/inventory/kardex">Movimientos</Link><button aria-describedby="inventory-commitments-help" className="tab" disabled type="button">Comprometido</button><button aria-describedby="inventory-lots-help" className="tab" disabled type="button">Lotes</button>
    </nav>
    <Panel><div className="table-heading"><div><h2>Bodega: Todas las bodegas sintéticas</h2><p className="field-help">Disponible es el saldo cronológico de los movimientos locales. Comprometido y Total requieren CH14-Q001.</p></div><StatusTag>{rows.length} visibles</StatusTag></div>
      <p className="field-help" id="inventory-export-help">La exportación requiere columnas, minimización y autorización aprobadas (CH14-Q015).</p><p className="field-help" id="inventory-transfer-help">Los traslados requieren bodega de origen/destino, autorización y auditoría aprobadas (CH14-Q001).</p><p className="field-help" id="inventory-commitments-help">La regla de inventario comprometido requiere definición aprobada (CH14-Q001).</p><p className="field-help" id="inventory-lots-help">Lotes y series requieren reglas de trazabilidad aprobadas (CH14-Q001).</p>
      <div className="filter-grid"><label>Registros<select aria-label="Registros por página" disabled value="50"><option value="50">50</option></select></label><label>Buscar inventario<input data-action-id="INVENTORY-ITEM-SEARCH" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tipo, código, nombre o bodega" type="search" value={query} /></label></div>
      <div className="table-wrap"><table><thead><tr><th>Acciones</th><th>Tipo</th><th>Código</th><th>Nombre</th><th>Bodega</th><th>Disp</th><th>Comp</th><th>Total</th></tr></thead><tbody>{rows.map((row) => <tr key={row.itemId}><td>—</td><td>{row.type}</td><td><code>{row.code}</code></td><td>{row.name}</td><td>{row.warehouse}</td><td>{row.available}</td><td>No definido</td><td>No calculable</td></tr>)}{!rows.length ? <tr><td colSpan={8}><EmptyState detail={query ? `No hay ítems sintéticos que coincidan con “${query}”.` : 'No hay movimientos sintéticos registrados.'} title="Sin ítems documentados" /></td></tr> : null}</tbody></table></div>
      <p className="field-help">Mostrando página 1 de 1 · Anterior · Siguiente</p>
    </Panel>
  </div>;
}
