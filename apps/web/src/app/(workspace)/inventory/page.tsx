'use client';

import Link from 'next/link';
import { Panel, StatusTag } from '@analiza/ui';
import { currentInventoryBalance } from '@analiza/domain';
import { useWorkspace } from '@/components/providers';

export default function InventoryPage() {
  const { inventoryMovements } = useWorkspace();
  const itemIds = [...new Set(inventoryMovements.map((movement) => movement.itemId))];
  const balance = itemIds.reduce((total, itemId) => total + currentInventoryBalance(inventoryMovements, itemId), 0);
  return <div className="page-stack"><header className="page-header"><div><p className="eyebrow">Inventario</p><h1>Existencias</h1><p>Resumen sintético derivado del historial de movimientos; no permite editar saldos ni inventa reglas de reserva, lote o cierre.</p></div><StatusTag>{itemIds.length} ítems</StatusTag></header><div className="metrics-grid"><Panel><p className="eyebrow">Movimientos</p><h2>{inventoryMovements.length}</h2><p>Persistentes y auditables.</p></Panel><Panel><p className="eyebrow">Saldo derivado</p><h2>{balance}</h2><p>Suma de existencias sintéticas.</p></Panel></div><div className="module-grid"><Link className="module-card" href="/inventory/movements"><div><h2>Movimientos</h2><p>Registre entradas, salidas, traslados, devoluciones y ajustes sin permitir saldo negativo.</p></div><span aria-hidden="true">›</span></Link><Link className="module-card" href="/inventory/kardex"><div><h2>Kárdex</h2><p>Filtre y audite el historial cronológico reproducible por ítem.</p></div><span aria-hidden="true">›</span></Link></div></div>;
}
