'use client';

import { currentInventoryBalance } from '@analiza/domain';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useWorkspace } from '@/components/providers';

const demoItemCatalog: Record<string, { name: string; sku: string }> = {
  'inventory-demo-kit': { name: 'Kit operativo demo', sku: 'KIT-DEMO-001' },
  'inventory-demo-supplies': { name: 'Insumos demo', sku: 'INS-DEMO-001' },
};
const warehouses: Record<string, string> = {
  'warehouse-demo-central': 'Bodega central demo',
  'warehouse-demo-north': 'Bodega norte demo',
};
type Surface =
  'ITEMS' | 'ACKNOWLEDGEMENTS' | 'CLOSURES' | 'SUPPLIERS' | 'WAREHOUSES' | 'LOTS' | 'KITS';
type AcknowledgementTab = 'PATIENTS' | 'RESOURCES' | 'UNAVAILABLE' | 'REQUESTS' | 'TASKS';
type ClosureTab = 'PENDING' | 'TOTALS' | 'CLOSED' | 'RESOURCES';
const acknowledgementTabs: Array<{ id: AcknowledgementTab; label: string; actionId: string }> = [
  { id: 'PATIENTS', label: 'Pacientes', actionId: 'INVENTORY-ACK-TAB-PATIENTS' },
  { id: 'RESOURCES', label: 'Recursos', actionId: 'INVENTORY-ACK-TAB-RESOURCES' },
  { id: 'UNAVAILABLE', label: 'No disponible', actionId: 'INVENTORY-ACK-TAB-UNAVAILABLE' },
  { id: 'REQUESTS', label: 'Solicitudes 0', actionId: 'INVENTORY-ACK-TAB-REQUESTS' },
  { id: 'TASKS', label: 'Tareas 0', actionId: 'INVENTORY-ACK-TAB-TASKS' },
];
const emptyAcknowledgementCopy: Record<
  Exclude<AcknowledgementTab, 'PATIENTS'>,
  { title: string; detail: string }
> = {
  RESOURCES: {
    title: 'Sin recursos documentados',
    detail: 'No hay una colección autorizada de recursos para acuses en el modelo actual.',
  },
  UNAVAILABLE: {
    title: 'Sin registros no disponibles',
    detail: 'La disponibilidad y sus reglas no están documentadas; no se deriva un estado local.',
  },
  REQUESTS: {
    title: 'Sin solicitudes documentadas',
    detail: 'No existe una fuente autorizada de solicitudes de acuse.',
  },
  TASKS: {
    title: 'Sin tareas documentadas',
    detail: 'No existe una fuente autorizada de tareas de acuse.',
  },
};
const closureTabs: Array<{ id: ClosureTab; label: string; actionId: string }> = [
  { id: 'PENDING', label: 'Pendientes', actionId: 'INVENTORY-CLOSURES-TAB-PENDING' },
  { id: 'TOTALS', label: 'Cierres totales', actionId: 'INVENTORY-CLOSURES-TAB-TOTALS' },
  { id: 'CLOSED', label: 'Cerrados', actionId: 'INVENTORY-CLOSURES-TAB-CLOSED' },
  { id: 'RESOURCES', label: 'Recursos', actionId: 'INVENTORY-CLOSURES-TAB-RESOURCES' },
];
const emptyClosureCopy: Record<
  Exclude<ClosureTab, 'PENDING'>,
  { title: string; detail: string }
> = {
  TOTALS: {
    title: 'Sin cierres totales documentados',
    detail: 'No existe una fuente autorizada de cierres totales en el modelo actual.',
  },
  CLOSED: {
    title: 'Sin cierres cerrados documentados',
    detail: 'El estado Cerrado no se deriva ni se modifica sin la definición aprobada.',
  },
  RESOURCES: {
    title: 'Sin recursos de cierre documentados',
    detail: 'No existe una fuente autorizada de recursos de cierre en el modelo actual.',
  },
};

export default function InventoryPage() {
  const { inventoryMovements, catalogItems, providerMode } = useWorkspace();
  const itemCatalog = useMemo(
    () => ({
      ...(providerMode === 'mock' ? demoItemCatalog : {}),
      ...Object.fromEntries(
        catalogItems.map((item) => [item.id, { name: item.name, sku: item.sku }]),
      ),
    }),
    [catalogItems, providerMode],
  );
  const [surface, setSurface] = useState<Surface>('ITEMS');
  const [acknowledgementTab, setAcknowledgementTab] = useState<AcknowledgementTab>('PATIENTS');
  const [closureTab, setClosureTab] = useState<ClosureTab>('PENDING');
  const [query, setQuery] = useState('');
  const [supplierQuery, setSupplierQuery] = useState('');
  const [warehouseQuery, setWarehouseQuery] = useState('');
  const [kitQuery, setKitQuery] = useState('');
  const [lotTab, setLotTab] = useState<'LOTS' | 'SERIALS'>('LOTS');
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const rows = useMemo(() => {
    const itemIds = [...new Set(inventoryMovements.map((movement) => movement.itemId))];
    return itemIds
      .flatMap((itemId) => {
        const movements = inventoryMovements.filter((movement) => movement.itemId === itemId);
        const warehouseIds = [
          ...new Set(movements.map((movement) => movement.warehouseId).filter(Boolean)),
        ] as string[];
        return (warehouseIds.length ? warehouseIds : ['central']).map((warehouseId) => ({
          rowId: `${itemId}:${warehouseId}`,
          itemId,
          type: 'Sintético',
          code: itemCatalog[itemId]?.sku ?? itemId,
          name: itemCatalog[itemId]?.name ?? itemId,
          warehouse: warehouses[warehouseId] ?? warehouseId,
          available: currentInventoryBalance(inventoryMovements, itemId, warehouseId),
        }));
      })
      .filter((row) =>
        `${row.type} ${row.code} ${row.name} ${row.warehouse}`
          .toLocaleLowerCase('es')
          .includes(query.toLocaleLowerCase('es')),
      );
  }, [inventoryMovements, query, itemCatalog]);
  const supplierRows = useMemo(
    () =>
      catalogItems
        .filter((item) => item.category === 'PROVIDERS')
        .filter((item) =>
          `${item.sku} ${item.name} ${item.contactName ?? ''} ${item.landlinePhone ?? ''} ${item.mobilePhone ?? ''} ${item.email ?? ''}`
            .toLocaleLowerCase('es')
            .includes(supplierQuery.toLocaleLowerCase('es')),
        ),
    [catalogItems, supplierQuery],
  );
  const warehouseRows = useMemo(
    () =>
      [...new Set(inventoryMovements.map((movement) => movement.warehouseId).filter(Boolean))]
        .map((id) => {
          const movements = inventoryMovements.filter((movement) => movement.warehouseId === id);
          return {
            id: id!,
            name: warehouses[id!] ?? id!,
            createdAt: movements.map((movement) => movement.createdAt).sort()[0],
          };
        })
        .filter((item) =>
          `${item.name} ${item.id}`
            .toLocaleLowerCase('es')
            .includes(warehouseQuery.toLocaleLowerCase('es')),
        ),
    [inventoryMovements, warehouseQuery],
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
    (movement.kind === 'ADJUSTMENT' && movement.adjustmentDirection !== 'OUT')
      ? 'Entrada'
      : 'Salida';
  const openAcknowledgements = () => {
    setSurface('ACKNOWLEDGEMENTS');
    setAcknowledgementTab('PATIENTS');
  };
  const openClosures = () => {
    setSurface('CLOSURES');
    setClosureTab('PENDING');
  };
  const openSuppliers = () => {
    setSurface('SUPPLIERS');
    setSupplierQuery('');
  };
  const openWarehouses = () => {
    setSurface('WAREHOUSES');
    setWarehouseQuery('');
  };
  const openKits = () => {
    setSurface('KITS');
    setKitQuery('');
  };

  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Inventario</p>
          <h1>
            {surface === 'ACKNOWLEDGEMENTS'
              ? 'Inventario / Acuses'
              : surface === 'CLOSURES'
                ? 'Inventario / Cierres'
                : surface === 'SUPPLIERS'
                  ? 'Inventario / Proveedores'
                  : surface === 'WAREHOUSES'
                    ? 'Items / Bodegas'
                    : surface === 'LOTS'
                      ? 'Inventario / Lotes y números de serie'
                      : surface === 'KITS'
                        ? 'Inventario / Kit de insumos'
                        : 'Gestión de inventario'}
          </h1>
          <p>
            {surface === 'ACKNOWLEDGEMENTS'
              ? 'Superficie factual y de solo lectura. No crea acuses, cambia estados, reserva existencias ni consulta fuentes de pacientes o casos.'
              : surface === 'CLOSURES'
                ? 'Superficie factual y de solo lectura. No consulta pacientes ni casos, ni crea, aprueba, cancela, concilia o revierte cierres.'
                : surface === 'SUPPLIERS'
                  ? 'Superficie factual y de solo lectura. No consulta ni crea proveedores; los datos, identidades y ciclo de vida requieren definición aprobada.'
                  : surface === 'WAREHOUSES'
                    ? 'Superficie factual y de solo lectura. No consulta ni crea bodegas; la fuente, los permisos y los traslados requieren definición aprobada.'
                    : surface === 'LOTS'
                      ? 'Superficie factual observada. No crea lotes o series ni deriva vencimiento, disponibilidad o recepción desde borradores de compra.'
                      : surface === 'KITS'
                        ? 'Superficie factual y de solo lectura. No consulta ni crea kits; la composición, consumo, permisos y auditoría requieren definición aprobada.'
                        : 'Listado factual derivado de movimientos sintéticos. No calcula compromisos, reservas, lotes, traslados ni reglas de bodega sin una definición aprobada.'}
          </p>
        </div>
        {surface === 'ITEMS' ? (
          <div className="action-row">
            <Button
              aria-describedby="inventory-export-help"
              className="button-secondary"
              data-action-id="INVENTORY-ITEM-EXPORT"
              disabled
              type="button"
            >
              Excel
            </Button>
            <Button
              aria-describedby="inventory-transfer-help"
              data-action-id="INVENTORY-TRANSFERS"
              disabled
              type="button"
            >
              Traslados
            </Button>
          </div>
        ) : surface === 'SUPPLIERS' ? (
          <div className="action-row">
            <Button
              aria-describedby="inventory-suppliers-create-help"
              data-action-id="INVENTORY-SUPPLIERS-CREATE"
              disabled
              type="button"
            >
              Nuevo
            </Button>
          </div>
        ) : surface === 'KITS' ? (
          <div className="action-row">
            <Button
              aria-describedby="inventory-kits-export-help"
              className="button-secondary"
              data-action-id="INVENTORY-KITS-EXPORT"
              disabled
              type="button"
            >
              Excel
            </Button>
            <Button
              aria-describedby="inventory-kits-create-help"
              data-action-id="INVENTORY-KITS-CREATE"
              disabled
              type="button"
            >
              Nuevo
            </Button>
          </div>
        ) : null}
      </header>
      <nav aria-label="Secciones de gestión de inventario" className="tabs">
        <Button
          aria-current={surface === 'ITEMS' ? 'page' : undefined}
          className={surface === 'ITEMS' ? 'tab active' : 'tab'}
          data-action-id="INVENTORY-ITEMS-OPEN"
          onClick={() => setSurface('ITEMS')}
          type="button"
        >
          Items
        </Button>
        <Button
          aria-current={surface === 'ACKNOWLEDGEMENTS' ? 'page' : undefined}
          className={surface === 'ACKNOWLEDGEMENTS' ? 'tab active' : 'tab'}
          data-action-id="INVENTORY-ACKNOWLEDGEMENTS-OPEN"
          onClick={openAcknowledgements}
          type="button"
        >
          Acuses
        </Button>
        <Button
          aria-current={surface === 'CLOSURES' ? 'page' : undefined}
          className={surface === 'CLOSURES' ? 'tab active' : 'tab'}
          data-action-id="INVENTORY-CLOSURES-OPEN"
          onClick={openClosures}
          type="button"
        >
          Cierres
        </Button>
        <Button
          aria-current={surface === 'SUPPLIERS' ? 'page' : undefined}
          className={surface === 'SUPPLIERS' ? 'tab active' : 'tab'}
          data-action-id="INVENTORY-SUPPLIERS-OPEN"
          onClick={openSuppliers}
          type="button"
        >
          Proveedores
        </Button>
        <Button
          aria-current={surface === 'WAREHOUSES' ? 'page' : undefined}
          className={surface === 'WAREHOUSES' ? 'tab active' : 'tab'}
          data-action-id="INVENTORY-WAREHOUSES-OPEN"
          onClick={openWarehouses}
          type="button"
        >
          Bodegas
        </Button>
        <Button
          aria-current={surface === 'KITS' ? 'page' : undefined}
          className={surface === 'KITS' ? 'tab active' : 'tab'}
          data-action-id="INVENTORY-KITS-OPEN"
          onClick={openKits}
          type="button"
        >
          Kit de insumos
        </Button>
        <Link className="tab" href="/inventory/kardex">
          Movimientos
        </Link>
        <button
          aria-describedby="inventory-commitments-help"
          className="tab"
          disabled
          type="button"
        >
          Comprometido
        </button>
        <button
          aria-current={surface === 'LOTS' ? 'page' : undefined}
          className={surface === 'LOTS' ? 'tab active' : 'tab'}
          data-action-id="INVENTORY-LOTS-OPEN"
          onClick={() => setSurface('LOTS')}
          type="button"
        >
          Lotes
        </button>
      </nav>
      {surface === 'ITEMS' ? (
        <Panel>
          <div className="table-heading">
            <div>
              <h2>Bodega: Todas las bodegas sintéticas</h2>
              <p className="field-help">
                Disponible es el saldo cronológico de los movimientos locales. Comprometido y Total
                requieren CH14-Q001.
              </p>
            </div>
            <StatusTag>{rows.length} visibles</StatusTag>
          </div>
          <p className="field-help" id="inventory-export-help">
            La exportación requiere columnas, minimización y autorización aprobadas (CH14-Q015).
          </p>
          <p className="field-help" id="inventory-transfer-help">
            Los traslados requieren bodega de origen/destino, autorización y auditoría aprobadas
            (CH14-Q001).
          </p>
          <p className="field-help" id="inventory-commitments-help">
            La regla de inventario comprometido requiere definición aprobada (CH14-Q001).
          </p>
          <p className="field-help" id="inventory-lots-help">
            Lotes y series requieren reglas de trazabilidad aprobadas (CH14-Q001).
          </p>
          <div className="filter-grid">
            <label>
              Registros
              <select aria-label="Registros por página" disabled value="50">
                <option value="50">50</option>
              </select>
            </label>
            <label>
              Buscar inventario
              <input
                data-action-id="INVENTORY-ITEM-SEARCH"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar tipo, código, nombre o bodega"
                type="search"
                value={query}
              />
            </label>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Acciones</th>
                  <th>Tipo</th>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Bodega</th>
                  <th>Disp</th>
                  <th>Comp</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.rowId}>
                    <td>
                      <Button
                        className="button-secondary"
                        data-action-id="INVENTORY-ITEM-HISTORY-OPEN"
                        onClick={() => openHistory(row.itemId)}
                        type="button"
                      >
                        Movimientos de item
                      </Button>
                    </td>
                    <td>{row.type}</td>
                    <td>
                      <code>{row.code}</code>
                    </td>
                    <td>{row.name}</td>
                    <td>{row.warehouse}</td>
                    <td>{row.available}</td>
                    <td>No definido</td>
                    <td>No calculable</td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        detail={
                          query
                            ? `No hay ítems sintéticos que coincidan con “${query}”.`
                            : 'No hay movimientos sintéticos registrados.'
                        }
                        title="Sin ítems documentados"
                      />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="field-help">Mostrando página 1 de 1 · Anterior · Siguiente</p>
        </Panel>
      ) : surface === 'ACKNOWLEDGEMENTS' ? (
        <Panel>
          <div className="filter-grid">
            <label>
              Tipo Área
              <select
                aria-describedby="inventory-ack-area-help"
                data-action-id="INVENTORY-ACK-AREA"
                disabled
                value=""
              >
                <option value="">No documentado</option>
              </select>
            </label>
          </div>
          <p className="field-help" id="inventory-ack-area-help">
            El catálogo y efecto de Tipo Área no están documentados; el control permanece visible y
            no modifica datos.
          </p>
          <div aria-label="Pestañas de acuses" className="tabs" role="tablist">
            {acknowledgementTabs.map((tab) => (
              <Button
                aria-selected={acknowledgementTab === tab.id}
                className={acknowledgementTab === tab.id ? 'tab active' : 'tab'}
                data-action-id={tab.actionId}
                key={tab.id}
                onClick={() => setAcknowledgementTab(tab.id)}
                role="tab"
                type="button"
              >
                {tab.label}
              </Button>
            ))}
          </div>
          {acknowledgementTab === 'PATIENTS' ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Acciones</th>
                    <th>Identificación</th>
                    <th>Paciente</th>
                    <th>Empresa</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        detail="Esta superficie no consulta fuentes de pacientes ni casos; no hay registros de acuse documentados."
                        title="Sin pacientes documentados"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              detail={emptyAcknowledgementCopy[acknowledgementTab].detail}
              title={emptyAcknowledgementCopy[acknowledgementTab].title}
            />
          )}
          <p className="field-help">
            Los estados, acciones, solicitudes y tareas de acuse requieren la política de permisos,
            idempotencia y auditoría aprobada (CH14-Q002).
          </p>
        </Panel>
      ) : surface === 'SUPPLIERS' ? (
        <Panel>
          <div className="table-heading">
            <div>
              <h2>Proveedores</h2>
              <p className="field-help" id="inventory-suppliers-create-help">
                Nuevo, edición, desactivación, identidades, unicidad y auditoría de proveedores
                requieren definición aprobada (CH14-Q008).
              </p>
            </div>
          </div>
          <div className="filter-grid">
            <label>
              Registros
              <select
                aria-label="Registros de proveedores por página"
                data-action-id="INVENTORY-SUPPLIERS-PAGE-SIZE"
                disabled
                value="50"
              >
                <option value="50">50</option>
              </select>
            </label>
            <div aria-label="Paginación de proveedores" className="action-row">
              <Button data-action-id="INVENTORY-SUPPLIERS-PAGE-PREV" disabled type="button">
                Anterior
              </Button>
              <Button data-action-id="INVENTORY-SUPPLIERS-PAGE-NEXT" disabled type="button">
                Siguiente
              </Button>
            </div>
            <label>
              Buscar proveedores
              <input
                data-action-id="INVENTORY-SUPPLIERS-SEARCH"
                onChange={(event) => setSupplierQuery(event.target.value)}
                placeholder="Buscar código, empresa, contacto, teléfono, correo o dirección"
                type="search"
                value={supplierQuery}
              />
            </label>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Empresa</th>
                  <th>Contacto</th>
                  <th>Teléfono</th>
                  <th>Correo</th>
                  <th>Dirección</th>
                </tr>
              </thead>
              <tbody>
                {supplierRows.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      <code>{supplier.sku}</code>
                    </td>
                    <td>{supplier.name}</td>
                    <td>{supplier.contactName || 'No documentado'}</td>
                    <td>{supplier.mobilePhone || supplier.landlinePhone || 'No documentado'}</td>
                    <td>{supplier.email || 'No documentado'}</td>
                    <td>No documentada</td>
                  </tr>
                ))}
                {!supplierRows.length ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        detail={
                          supplierQuery
                            ? `No hay proveedores documentados que coincidan con “${supplierQuery}”.`
                            : 'No existe una fuente autorizada de proveedores en el modelo actual.'
                        }
                        title="Sin proveedores documentados"
                      />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="field-help">Mostrando página 1 de 1 · Anterior · Siguiente</p>
        </Panel>
      ) : surface === 'WAREHOUSES' ? (
        <Panel>
          <div className="table-heading">
            <div>
              <h2>Bodegas</h2>
              <p className="field-help" id="inventory-warehouses-active-help">
                Activo se muestra como control observado, pero no filtra ni deriva estados sin una
                definición aprobada (CH14-Q009).
              </p>
            </div>
          </div>
          <div className="filter-grid">
            <label>
              Activo
              <select
                aria-describedby="inventory-warehouses-active-help"
                aria-label="Estado de bodegas"
                data-action-id="INVENTORY-WAREHOUSES-ACTIVE-FILTER"
                disabled
                value="active"
              >
                <option value="active">Activo</option>
              </select>
            </label>
            <label>
              Registros
              <select
                aria-label="Registros de bodegas por página"
                data-action-id="INVENTORY-WAREHOUSES-PAGE-SIZE"
                disabled
                value="50"
              >
                <option value="50">50</option>
              </select>
            </label>
            <div aria-label="Paginación de bodegas" className="action-row">
              <Button data-action-id="INVENTORY-WAREHOUSES-PAGE-PREV" disabled type="button">
                Anterior
              </Button>
              <Button data-action-id="INVENTORY-WAREHOUSES-PAGE-NEXT" disabled type="button">
                Siguiente
              </Button>
            </div>
            <label>
              Buscar bodegas
              <input
                data-action-id="INVENTORY-WAREHOUSES-SEARCH"
                onChange={(event) => setWarehouseQuery(event.target.value)}
                placeholder="Buscar nombre o descripción"
                type="search"
                value={warehouseQuery}
              />
            </label>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th>Fecha de creación</th>
                </tr>
              </thead>
              <tbody>
                {warehouseRows.map((warehouse) => (
                  <tr key={warehouse.id}>
                    <td>{warehouse.name}</td>
                    <td>Identificador registrado: {warehouse.id}</td>
                    <td>
                      {warehouse.createdAt
                        ? new Date(warehouse.createdAt).toLocaleDateString('es-SV')
                        : 'No documentada'}
                    </td>
                  </tr>
                ))}
                {!warehouseRows.length ? (
                  <tr>
                    <td colSpan={3}>
                      <EmptyState
                        detail={
                          warehouseQuery
                            ? `No hay bodegas documentadas que coincidan con “${warehouseQuery}”.`
                            : 'No existe una fuente autorizada de bodegas en el modelo actual.'
                        }
                        title="Sin bodegas documentadas"
                      />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="field-help">Mostrando página 1 de 1 · Anterior · Siguiente</p>
        </Panel>
      ) : surface === 'LOTS' ? (
        <Panel>
          <div className="table-heading">
            <div>
              <h2>Lotes y números de serie</h2>
              <p className="field-help" id="inventory-lots-help">
                La recepción, unicidad, vencimiento, FEFO, cuarentena y corrección siguen pendientes
                de CH14-Q010/CH14-Q011. No se convierten borradores de compra en stock.
              </p>
            </div>
            <Button aria-describedby="inventory-lots-help" disabled type="button">
              Nuevo
            </Button>
          </div>
          <div aria-label="Tipo de trazabilidad" className="tabs" role="tablist">
            <Button
              aria-selected={lotTab === 'LOTS'}
              className={lotTab === 'LOTS' ? 'tab active' : 'tab'}
              data-action-id="INVENTORY-LOTS-TAB"
              onClick={() => setLotTab('LOTS')}
              role="tab"
              type="button"
            >
              Lotes
            </Button>
            <Button
              aria-selected={lotTab === 'SERIALS'}
              className={lotTab === 'SERIALS' ? 'tab active' : 'tab'}
              data-action-id="INVENTORY-SERIALS-TAB"
              onClick={() => setLotTab('SERIALS')}
              role="tab"
              type="button"
            >
              Nros de serie
            </Button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Acciones</th>
                  <th>Número</th>
                  <th>Descripción</th>
                  <th>Ítem</th>
                  <th>Fecha E</th>
                  <th>Fecha V</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title={
                        lotTab === 'LOTS' ? 'Sin lotes recibidos' : 'Sin números de serie recibidos'
                      }
                      detail="No existe una recepción de inventario autorizada que alimente esta tabla."
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
      ) : surface === 'KITS' ? (
        <Panel>
          <div className="table-heading">
            <div>
              <h2>Listado</h2>
              <p className="field-help" id="inventory-kits-create-help">
                Nuevo, Editar, Duplicar y Eliminar requieren versión, permisos, efectos y
                preservación de usos históricos aprobados (CH14-Q012).
              </p>
            </div>
          </div>
          <p className="field-help" id="inventory-kits-export-help">
            Excel requiere columnas, minimización y autorización aprobadas (CH14-Q015).
          </p>
          <div className="filter-grid">
            <label>
              Registros
              <select
                aria-label="Registros de kits por página"
                data-action-id="INVENTORY-KITS-PAGE-SIZE"
                disabled
                value="50"
              >
                <option value="50">50</option>
              </select>
            </label>
            <div aria-label="Paginación de kits" className="action-row">
              <Button data-action-id="INVENTORY-KITS-PAGE-PREV" disabled type="button">
                Anterior
              </Button>
              <Button data-action-id="INVENTORY-KITS-PAGE-NEXT" disabled type="button">
                Siguiente
              </Button>
            </div>
            <label>
              Buscar kits
              <input
                data-action-id="INVENTORY-KITS-SEARCH"
                onChange={(event) => setKitQuery(event.target.value)}
                placeholder="Buscar nombre de kit"
                type="search"
                value={kitQuery}
              />
            </label>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Acciones</th>
                  <th>Nombre</th>
                  <th>Actualizado por</th>
                  <th>Fecha actualización</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      detail={
                        kitQuery
                          ? `No hay kits documentados que coincidan con “${kitQuery}”.`
                          : 'No existe una fuente autorizada de kits en el modelo actual.'
                      }
                      title="Sin kits documentados"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="field-help">Mostrando página 1 de 1 · Anterior · Siguiente</p>
        </Panel>
      ) : (
        <Panel>
          <div aria-label="Pestañas de cierres" className="tabs" role="tablist">
            {closureTabs.map((tab) => (
              <Button
                aria-selected={closureTab === tab.id}
                className={closureTab === tab.id ? 'tab active' : 'tab'}
                data-action-id={tab.actionId}
                key={tab.id}
                onClick={() => setClosureTab(tab.id)}
                role="tab"
                type="button"
              >
                {tab.label}
              </Button>
            ))}
          </div>
          {closureTab === 'PENDING' ? (
            <div className="table-wrap">
              <h2>Pacientes activos</h2>
              <table>
                <thead>
                  <tr>
                    <th>Acciones</th>
                    <th>DUI/NIT</th>
                    <th>Paciente</th>
                    <th>Empresa</th>
                    <th>Estado</th>
                    <th>Fecha de inicio</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        detail="Esta superficie no consulta fuentes de pacientes ni casos; no hay cierres pendientes documentados."
                        title="Sin cierres documentados"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              detail={emptyClosureCopy[closureTab].detail}
              title={emptyClosureCopy[closureTab].title}
            />
          )}
          <p className="field-help">
            La fuente autorizada, roles, transiciones, aprobación, cancelación, conciliación y
            reversión de cierres requieren definición aprobada (CH14-Q007). Las pestañas no mutan
            datos.
          </p>
        </Panel>
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
        title="Movimientos de item"
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
              Rango de fechas sobre movimientos locales. Lote/serie, origen, destino y estado no
              están documentados por el modelo actual (CH14-Q001).
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
                      <td>No documentado</td>
                      <td>No documentado</td>
                      <td>No documentado</td>
                      <td>{movement.quantity}</td>
                      <td>{movementLabel(movement)}</td>
                      <td>No documentado</td>
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
    </div>
  );
}
