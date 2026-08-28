'use client';

import { Button, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { toCsv } from '@analiza/domain';
import { useWorkspace } from '@/components/providers';

export default function AuditPage() {
  const { auditEntries } = useWorkspace();
  function exportAudit() {
    const csv = toCsv([['Fecha', 'Acción', 'Referencia'], ...auditEntries.map((entry) => [entry.at, entry.action, entry.subject])]);
    const href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = 'auditoria-sintetica.csv';
    link.click();
    URL.revokeObjectURL(href);
  }
  return <div className="page-stack"><header className="page-header page-header-actions"><div><p className="eyebrow">Gobierno</p><h1>Auditoría</h1><p>Bitácora sintética de mutaciones persistidas. No contiene diagnósticos, tratamiento ni información enviada por canales inseguros.</p></div><Button data-action-id="AUDIT-EXPORT" onClick={exportAudit} type="button">Exportar auditoría</Button></header><Panel><div className="table-heading"><h2>Eventos</h2><StatusTag>{auditEntries.length} registros</StatusTag></div>{auditEntries.length ? <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Acción</th><th>Referencia</th></tr></thead><tbody>{auditEntries.map((entry) => <tr key={entry.id}><td>{new Date(entry.at).toLocaleString('es-SV')}</td><td>{entry.action}</td><td><code>{entry.subject}</code></td></tr>)}</tbody></table></div> : <EmptyState detail="Las mutaciones persistidas aparecerán aquí." title="Sin eventos" />}</Panel></div>;
}
