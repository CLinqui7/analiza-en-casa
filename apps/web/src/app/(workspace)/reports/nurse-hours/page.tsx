'use client';

import { toCsv } from '@analiza/domain';
import { Button, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useMemo, useState } from 'react';
import { useWorkspace } from '@/components/providers';

type Filters = { from: string; to: string; month: string; resourceId: string; status: string };

function scheduledHours(startsAt: string, endsAt: string) {
  return Math.max(0, (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 3_600_000);
}
function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}
const statusLabel = { SCHEDULED: 'Programado', CANCELLED: 'Cancelado', COMPLETED: 'Completado' };

export default function NurseHoursPage() {
  const { nursingResources, shifts } = useWorkspace();
  const [filters, setFilters] = useState<Filters>({ from: '', to: '', month: '', resourceId: '', status: '' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = useMemo(() => shifts.filter((shift) => {
    const date = shift.startsAt.slice(0, 10); const month = shift.startsAt.slice(0, 7);
    return (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to) && (!filters.month || month === filters.month) && (!filters.resourceId || shift.resourceId === filters.resourceId) && (!filters.status || shift.status === filters.status);
  }).map((shift) => ({ ...shift, hours: scheduledHours(shift.startsAt, shift.endsAt) })), [filters, shifts]);
  const totals = { shifts: rows.length, scheduled: rows.filter((row) => row.status === 'SCHEDULED').reduce((sum, row) => sum + row.hours, 0), cancelled: rows.filter((row) => row.status === 'CANCELLED').reduce((sum, row) => sum + row.hours, 0), valid: rows.filter((row) => row.status !== 'CANCELLED').reduce((sum, row) => sum + row.hours, 0) };
  const selected = rows.find((row) => row.id === selectedId);
  function update(name: keyof Filters, value: string) { setFilters((current) => ({ ...current, [name]: value })); }
  function reset() { setFilters({ from: '', to: '', month: '', resourceId: '', status: '' }); setSelectedId(null); }
  function exportReport() { downloadCsv('reporte-horas-programadas.csv', toCsv([['Turno', 'Enfermera', 'Inicio', 'Fin', 'Estado', 'Horas programadas'], ...rows.map((row) => [row.id, nursingResources.find((resource) => resource.id === row.resourceId)?.displayName ?? 'No disponible', row.startsAt, row.endsAt, statusLabel[row.status], String(row.hours)])])); }
  return <div className="page-stack"><header className="page-header page-header-actions"><div><p className="eyebrow">Reportes</p><h1>Horas de enfermería</h1><p>Derivado de Agenda y turnos. Sin check-in/out, los valores son horas programadas, nunca horas trabajadas.</p></div><Button className="button-secondary" data-action-id="NURSE-HOURS-EXPORT" onClick={exportReport} type="button">Exportar CSV</Button></header><Panel><div className="filter-grid"><label>Desde<input data-action-id="NURSE-HOURS-FILTER-FROM" onChange={(event) => update('from', event.target.value)} type="date" value={filters.from} /></label><label>Hasta<input data-action-id="NURSE-HOURS-FILTER-TO" onChange={(event) => update('to', event.target.value)} type="date" value={filters.to} /></label><label>Mes<input data-action-id="NURSE-HOURS-FILTER-MONTH" onChange={(event) => update('month', event.target.value)} type="month" value={filters.month} /></label><label>Enfermera<select data-action-id="NURSE-HOURS-FILTER-NURSE" onChange={(event) => update('resourceId', event.target.value)} value={filters.resourceId}><option value="">Todas</option>{nursingResources.map((resource) => <option key={resource.id} value={resource.id}>{resource.displayName}</option>)}</select></label><label>Estado<select data-action-id="NURSE-HOURS-FILTER-STATUS" onChange={(event) => update('status', event.target.value)} value={filters.status}><option value="">Todos</option>{Object.entries(statusLabel).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div><Button className="button-secondary" data-action-id="NURSE-HOURS-FILTER-RESET" onClick={reset} type="button">Restablecer</Button></Panel><section className="metric-grid"><Panel><span>Turnos</span><strong>{totals.shifts}</strong></Panel><Panel><span>Horas programadas</span><strong>{totals.scheduled}</strong></Panel><Panel><span>Horas canceladas</span><strong>{totals.cancelled}</strong></Panel><Panel><span>Horas válidas programadas</span><strong>{totals.valid}</strong></Panel></section><Panel><div className="table-heading"><h2>Detalle de turnos</h2><StatusTag>{rows.length} visibles</StatusTag></div>{rows.length ? <div className="table-wrap"><table><thead><tr><th>Turno</th><th>Enfermera</th><th>Inicio</th><th>Fin</th><th>Estado</th><th>Horas programadas</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.id}</td><td>{nursingResources.find((resource) => resource.id === row.resourceId)?.displayName ?? 'No disponible'}</td><td>{new Date(row.startsAt).toLocaleString('es-SV')}</td><td>{new Date(row.endsAt).toLocaleString('es-SV')}</td><td>{statusLabel[row.status]}</td><td>{row.hours}</td><td><Button className="button-secondary" data-action-id="NURSE-HOURS-DRILL-DOWN" onClick={() => setSelectedId(row.id)} type="button">Ver</Button></td></tr>)}</tbody></table></div> : <EmptyState detail="Ajuste el rango o cree un turno en Agenda." title="Sin turnos" />}</Panel>{selected ? <Panel><h2>Detalle: {selected.id}</h2><p>{selected.note ?? 'Sin notas adicionales.'}</p><p>Este turno registra {selected.hours} horas programadas; no hay evidencia de check-in/out para etiquetarlas como trabajadas.</p></Panel> : null}</div>;
}
