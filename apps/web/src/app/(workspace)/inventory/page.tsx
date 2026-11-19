'use client';

import { currentInventoryBalance } from '@analiza/domain';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { InventoryTransferDialog, WarehouseManagement } from '@/components/warehouse-management';
import { stockByWarehouse } from '@/lib/inventory-ledger';
import './stock.css';
import { useAuth, useWorkspace } from '@/components/providers';
import { useOperations } from '@/lib/use-operations';

const demoItemCatalog: Record<string, { name: string; sku: string; category?: string }> = {
  'inventory-demo-kit': { name: 'Kit operativo demo', sku: 'KIT-DEMO-001' },
  'inventory-demo-supplies': { name: 'Insumos demo', sku: 'INS-DEMO-001' },
};
const demoWarehouses: Record<string, string> = {
  'warehouse-demo-central': 'Bodega central demo',
  'warehouse-demo-north': 'Bodega norte demo',
};
type Surface = 'ITEMS' | 'WAREHOUSES';

export default function InventoryPage() {
  const { inventoryMovements, catalogItems, providerMode, refreshWorkspace } = useWorkspace();
  const { can } = useAuth();
  const operations = useOperations();
  const visibleWarehouses = useMemo(
    () =>
      providerMode === 'mock'
        ? Object.entries(demoWarehouses).map(([id, name]) => ({
            id,
            code: id,
            name,
            description: 'Bodega de datos sintéticos para demostración.',
            status: 'ACTIVE' as const,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          }))
        : operations.warehouses,
    [operations.warehouses, providerMode],
  );
  const warehouseNames = useMemo(
    () => ({
      ...(providerMode === 'mock' ? demoWarehouses : {}),
      ...Object.fromEntries(visibleWarehouses.map((warehouse) => [warehouse.id, warehouse.name])),
    }),
    [providerMode, visibleWarehouses],
  );
  const itemCatalog = useMemo(
    () => ({
      ...(providerMode === 'mock' ? demoItemCatalog : {}),
      ...Object.fromEntries(
        catalogItems.map((item) => [
          item.id,
          { name: item.name, sku: item.sku, category: item.category },
        ]),
      ),
    }),
    [catalogItems, providerMode],
  );
  const [surface, setSurface] = useState<Surface>('ITEMS');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [warehouseQuery, setWarehouseQuery] = useState('');
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [transferRow, setTransferRow] = useState<{ itemId: string; warehouseId: string } | null>(
    null,
  );
  const stock = useMemo(
    () => stockByWarehouse(inventoryMovements, operations.traceRecords, operations.homeCustodies),
    [inventoryMovements, operations.traceRecords, operations.homeCustodies],
  );
  const rows = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('es');
    return stock
      .map((position) => {
        const item = itemCatalog[position.itemId];
        const type =
          (
            { MEDICATIONS: 'Medicamento', SUPPLIES: 'Insumo', EQUIPMENT: 'Equipo' } as Record<
              string,
              string
            >
          )[item?.category ?? ''] ?? 'Otro';
        return {
          ...position,
          type,
          code: item?.sku ?? position.itemId,
          name: item?.name ?? position.itemId,
          warehouse: warehouseNames[position.warehouseId] ?? position.warehouseId,
        };
      })
      .filter(
        (row) =>
          !search ||
          [row.type, row.code, row.name, row.warehouse]
            .join(' ')
            .toLocaleLowerCase('es')
            .includes(search),
      );
  }, [stock, query, itemCatalog, warehouseNames]);
  const lastPage = Math.max(0, Math.ceil(rows.length / 50) - 1);
  const currentPage = Math.min(page, lastPage);
  const activeWarehouses = useMemo(
    () => new Set(visibleWarehouses.filter((w) => w.status === 'ACTIVE').map((w) => w.id)),
    [visibleWarehouses],
  );
  const historyItem =
    rows.find((row) => row.itemId === historyItemId) ??
    (historyItemId
      ? {
          itemId: historyItemId,
          type: 'Sintético',
          code: itemCatalog[historyItemId]?.sku ?? historyItemId,
          name: itemCatalog[historyItemId]?.name ?? historyItemId,
          warehouse: 'Sin bodega documentada',
          available: currentInventoryBalance(inventoryMovements, historyItemId),
        }
      : null);
  const historyRows = useMemo(
    () =>
      inventoryMovements
        .filter((movement) => movement.itemId === historyItemId)
        .filter((movement) => !historyFrom || movement.createdAt.slice(0, 10) >= historyFrom)
        .filter((movement) => !historyTo || movement.createdAt.slice(0, 10) <= historyTo)
        .slice()
        .sort(
          (left, right) =>
            right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id),
        ),
    [historyFrom, historyItemId, historyTo, inventoryMovements],
  );
  const openHistory = (itemId: string) => {
    setHistoryItemId(itemId);
    setHistoryFrom('');
    setHistoryTo('');
  };
  const closeHistory = () => {
    setHistoryItemId(null);
    setHistoryFrom('');
    setHistoryTo('');
  };
  const movementLabel = (movement: (typeof inventoryMovements)[number]) =>
    movement.kind === 'ENTRY' ||
    movement.kind === 'RETURN' ||
    (movement.kind === 'TRANSFER' && movement.transferDirection === 'IN') ||
    (movement.kind === 'ADJUSTMENT' && movement.adjustmentDirection !== 'OUT')
      ? 'Entrada'
      : 'Salida';
  return (
    <div className="page-stack stock-workspace">
      <header className="page-header">
        <p className="eyebrow">Inventario y compras</p>
        <h1>Existencias</h1>
      </header>
      <nav aria-label="Secciones de existencias" className="tabs">
        <Button
          aria-current={surface === 'ITEMS' ? 'page' : undefined}
          className={surface === 'ITEMS' ? 'tab active' : 'tab'}
          data-action-id="INVENTORY-ITEMS-OPEN"
          onClick={() => setSurface('ITEMS')}
        >
          Ítems
        </Button>
        <Link className="tab" data-action-id="INVENTORY-SUPPLIERS-OPEN" href="/inventory/suppliers">
          Proveedores
        </Link>
        <Button
          aria-current={surface === 'WAREHOUSES' ? 'page' : undefined}
          className={surface === 'WAREHOUSES' ? 'tab active' : 'tab'}
          data-action-id="INVENTORY-WAREHOUSES-OPEN"
          onClick={() => setSurface('WAREHOUSES')}
        >
          Bodegas
        </Button>
      </nav>
      {surface === 'ITEMS' ? (
        <Panel>
          <div className="table-heading">
            <div>
              <h2>Todas las bodegas</h2>
              <p className="field-help">
                Disponible es el saldo liberado y vigente. Retenido y vencido muestran recepciones
                físicas que aún no pueden entregarse.
              </p>
            </div>
            <StatusTag>{rows.length} visibles</StatusTag>
          </div>
          <div className="filter-grid">
            <label>
              Buscar inventario
              <input
                data-action-id="INVENTORY-ITEM-SEARCH"
                onChange={(event) => {
                  setPage(0);
                  setQuery(event.target.value);
                }}
                placeholder="Buscar tipo, código, nombre o bodega"
                type="search"
                value={query}
              />
            </label>
          </div>
          <div className="table-wrap">
            <table className="stock-cards">
              <thead>
                <tr>
                  <th>Acciones</th>
                  <th>Tipo</th>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Bodega</th>
                  <th>Disponible</th>
                  <th>Retenido</th>
                  <th>Vencido</th>
                  <th>Total físico</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(currentPage * 50, (currentPage + 1) * 50).map((row) => (
                  <tr key={JSON.stringify([row.itemId, row.warehouseId])}>
                    <td data-stock-label="Acciones">
                      <Button
                        className="button-secondary"
                        data-action-id="INVENTORY-ITEM-HISTORY-OPEN"
                        onClick={() => openHistory(row.itemId)}
                        type="button"
                      >
                        Movimientos del ítem
                      </Button>
                      {can('inventory:write') && (
                        <Button
                          className="button-secondary"
                          data-action-id="INVENTORY-TRANSFERS"
                          disabled={
                            !operations.connected ||
                            operations.busy ||
                            row.available <= 0 ||
                            activeWarehouses.size < 2 ||
                            !activeWarehouses.has(row.warehouseId)
                          }
                          onClick={() => setTransferRow(row)}
                          type="button"
                        >
                          Generar traslado
                        </Button>
                      )}
                    </td>
                    <td data-stock-label="Tipo">{row.type}</td>
                    <td data-stock-label="Código">
                      <code>{row.code}</code>
                    </td>
                    <td data-stock-label="Nombre">{row.name}</td>
                    <td data-stock-label="Bodega">{row.warehouse}</td>
                    <td data-stock-label="Disponible">{row.available}</td>
                    <td data-stock-label="Retenido">{row.held}</td>
                    <td data-stock-label="Vencido">{row.expired}</td>
                    <td data-stock-label="Total físico">
                      {row.available + row.held + row.expired}
                    </td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState
                        detail={
                          query
                            ? `No hay ítems que coincidan con “${query}”.`
                            : 'No hay existencias ni recepciones registradas.'
                        }
                        title="Sin ítems documentados"
                      />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {lastPage > 0 && (
            <nav className="action-row" aria-label="Páginas de existencias">
              <Button
                className="button-secondary"
                disabled={!currentPage}
                onClick={() => setPage(currentPage - 1)}
              >
                Anterior
              </Button>
              <span>
                Página {currentPage + 1} de {lastPage + 1}
              </span>
              <Button
                className="button-secondary"
                disabled={currentPage >= lastPage}
                onClick={() => setPage(currentPage + 1)}
              >
                Siguiente
              </Button>
            </nav>
          )}
        </Panel>
      ) : (
        <WarehouseManagement
          busy={operations.busy}
          canWrite={can('inventory:write')}
          connected={operations.connected}
          error={operations.error}
          execute={operations.execute}
          query={warehouseQuery}
          setQuery={setWarehouseQuery}
          warehouses={visibleWarehouses}
        />
      )}
      <Dialog
        description="Historial local de movimientos existentes. No crea, reclasifica ni modifica inventario."
        footer={
          <Button
            className="button-secondary"
            data-action-id="INVENTORY-ITEM-HISTORY-CLOSE"
            onClick={closeHistory}
            type="button"
          >
            Cerrar
          </Button>
        }
        onClose={closeHistory}
        open={Boolean(historyItem)}
        title="Movimientos del ítem"
      >
        {historyItem ? (
          <div className="page-stack">
            <div className="filter-grid">
              <label>
                Tipo
                <input readOnly value={historyItem.type} />
              </label>
              <label>
                Código
                <input readOnly value={historyItem.code} />
              </label>
              <label className="full">
                Nombre
                <input readOnly value={historyItem.name} />
              </label>
              <label>
                Desde
                <input
                  data-action-id="INVENTORY-ITEM-HISTORY-FROM"
                  onChange={(event) => setHistoryFrom(event.target.value)}
                  type="date"
                  value={historyFrom}
                />
              </label>
              <label>
                Hasta
                <input
                  data-action-id="INVENTORY-ITEM-HISTORY-TO"
                  onChange={(event) => setHistoryTo(event.target.value)}
                  type="date"
                  value={historyTo}
                />
              </label>
            </div>
            <p className="field-help">
              Rango de fechas sobre movimientos locales. Las recepciones, cambios de estado y
              asignaciones FEFO conservan lote o serie y bodega.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Fecha</th>
                    <th>Lote / Serie</th>
                    <th>Origen</th>
                    <th>Destino</th>
                    <th>Cantidad</th>
                    <th>Movimiento</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((movement) => (
                    <tr key={movement.id}>
                      <td>{movement.kind}</td>
                      <td>{new Date(movement.createdAt).toLocaleString('es-SV')}</td>
                      <td>{movement.traceNumber ?? 'No trazado'}</td>
                      <td>
                        {movement.kind === 'TRANSFER' && movement.transferDirection === 'OUT'
                          ? (warehouseNames[movement.warehouseId ?? ''] ?? movement.warehouseId)
                          : movement.kind === 'TRANSFER'
                            ? (warehouseNames[movement.counterpartWarehouseId ?? ''] ??
                              movement.counterpartWarehouseId)
                            : 'No aplica'}
                      </td>
                      <td>
                        {movement.kind === 'TRANSFER' && movement.transferDirection === 'IN'
                          ? (warehouseNames[movement.warehouseId ?? ''] ?? movement.warehouseId)
                          : movement.kind === 'TRANSFER'
                            ? (warehouseNames[movement.counterpartWarehouseId ?? ''] ??
                              movement.counterpartWarehouseId)
                            : 'No aplica'}
                      </td>
                      <td>{movement.quantity}</td>
                      <td>{movementLabel(movement)}</td>
                      <td>{movement.traceRecordId ? 'Trazado' : 'Movimiento histórico'}</td>
                    </tr>
                  ))}
                  {!historyRows.length ? (
                    <tr>
                      <td colSpan={8}>
                        <EmptyState
                          detail="Ajuste el rango de fechas para revisar movimientos locales."
                          title="Sin movimientos en el rango"
                        />
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Dialog>
      {transferRow && (
        <InventoryTransferDialog
          selected={transferRow}
          busy={operations.busy}
          error={operations.error}
          execute={operations.execute}
          items={catalogItems}
          movements={inventoryMovements}
          traceRecords={operations.traceRecords}
          onClose={() => setTransferRow(null)}
          open
          refreshWorkspace={refreshWorkspace}
          warehouses={visibleWarehouses}
        />
      )}
    </div>
  );
}
