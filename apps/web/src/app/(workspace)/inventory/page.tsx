'use client';

import { currentInventoryBalance } from '@analiza/domain';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
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
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
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
  const historyItem = rows.find((row) => row.itemId === historyItemId) ?? (historyItemId ? {
    itemId: historyItemId,
    type: 'Sintético',
    code: itemCatalog[historyItemId]?.sku ?? historyItemId,
    name: itemCatalog[historyItemId]?.name ?? historyItemId,
    warehouse: 'Sin bodega documentada',
    available: currentInventoryBalance(inventoryMovements, historyItemId),
  } : null);
  const historyRows = useMemo(() => inventoryMovements
    .filter((movement) => movement.itemId === historyItemId)
    .filter((movement) => !historyFrom || movement.createdAt.slice(0, 10) >= historyFrom)
    .filter((movement) => !historyTo || movement.createdAt.slice(0, 10) <= historyTo)
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id)), [historyFrom, historyItemId, historyTo, inventoryMovements]);

  function openHistory(itemId: string) {
    setHistoryItemId(itemId);
    setHistoryFrom('');
    setHistoryTo('');
  }

  function closeHistory() {
    setHistoryItemId(null);
    setHistoryFrom('');
    setHistoryTo('');
  }

  function movementLabel(movement: typeof inventoryMovements[number]) {
    return movement.kind === 'ENTRY' || movement.kind === 'RETURN' || (movement.kind === 'ADJUSTMENT' && movement.adjustmentDirection !== 'OUT') ? 'Entrada' : 'Salida';
  }

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
      <div className="table-wrap"><table><thead><tr><th>Acciones</th><th>Tipo</th><th>Código</th><th>Nombre</th><th>Bodega</th><th>Disp</th><th>Comp</th><th>Total</th></tr></thead><tbody>{rows.map((row) => <tr key={row.itemId}><td><Button className="button-secondary" data-action-id="INVENTORY-ITEM-HISTORY-OPEN" onClick={() => openHistory(row.itemId)} type="button">Movimientos de item</Button></td><td>{row.type}</td><td><code>{row.code}</code></td><td>{row.name}</td><td>{row.warehouse}</td><td>{row.available}</td><td>No definido</td><td>No calculable</td></tr>)}{!rows.length ? <tr><td colSpan={8}><EmptyState detail={query ? `No hay ítems sintéticos que coincidan con “${query}”.` : 'No hay movimientos sintéticos registrados.'} title="Sin ítems documentados" /></td></tr> : null}</tbody></table></div>
      <p className="field-help">Mostrando página 1 de 1 · Anterior · Siguiente</p>
    </Panel>
    <Dialog description="Historial local de movimientos existentes. No crea, reclasifica ni modifica inventario." footer={<Button className="button-secondary" data-action-id="INVENTORY-ITEM-HISTORY-CLOSE" onClick={closeHistory} type="button">Cerrar</Button>} onClose={closeHistory} open={Boolean(historyItem)} title="Movimientos de item">
      {historyItem ? <div className="page-stack"><div className="filter-grid"><label>Tipo<input readOnly value={historyItem.type} /></label><label>Código<input readOnly value={historyItem.code} /></label><label className="full">Nombre<input readOnly value={historyItem.name} /></label><label>Desde<input data-action-id="INVENTORY-ITEM-HISTORY-FROM" onChange={(event) => setHistoryFrom(event.target.value)} type="date" value={historyFrom} /></label><label>Hasta<input data-action-id="INVENTORY-ITEM-HISTORY-TO" onChange={(event) => setHistoryTo(event.target.value)} type="date" value={historyTo} /></label></div><p className="field-help">Rango de fechas sobre movimientos locales. Lote/serie, origen, destino y estado no están documentados por el modelo actual (CH14-Q001).</p><div className="table-wrap"><table><thead><tr><th>Tipo</th><th>Fecha</th><th>Lote / Serie</th><th>Origen</th><th>Destino</th><th>Cantidad</th><th>Movimiento</th><th>Estado</th></tr></thead><tbody>{historyRows.map((movement) => <tr key={movement.id}><td>{movement.kind}</td><td>{new Date(movement.createdAt).toLocaleString('es-SV')}</td><td>No documentado</td><td>No documentado</td><td>No documentado</td><td>{movement.quantity}</td><td>{movementLabel(movement)}</td><td>No documentado</td></tr>)}{!historyRows.length ? <tr><td colSpan={8}><EmptyState detail="Ajuste el rango de fechas para revisar movimientos locales." title="Sin movimientos en el rango" /></td></tr> : null}</tbody></table></div></div> : null}
    </Dialog>
  </div>;
}
