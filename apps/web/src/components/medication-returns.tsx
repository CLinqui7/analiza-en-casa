'use client';
import Link from 'next/link';
import { useOperations } from '@/lib/use-operations';
import { useWorkspace } from './providers';
import { Panel } from '@analiza/ui';
export function MedicationReturns({ compact = false }: { compact?: boolean }) {
  const operations = useOperations();
  const { patients, quotes } = useWorkspace();
  if (compact && !operations.medicationReturns.length) return null;
  return (
    <Panel>
      <div className="table-heading">
        <h2>Medicamentos no aplicados</h2>
        {compact ? (
          <Link className="action-link-button" href="/reports/returns">
            Ver devoluciones <span aria-hidden="true">↗</span>
          </Link>
        ) : null}
      </div>
      <p>
        Revise si corresponde retirar el cargo. Las cotizaciones enviadas requieren una nueva
        versión; este reporte no cambia los importes automáticamente.
      </p>
      {operations.error ? <p role="alert">{operations.error}</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Paciente</th>
              <th>Medicamento</th>
              <th>Motivo</th>
              <th>Cuenta</th>
            </tr>
          </thead>
          <tbody>
            {operations.medicationReturns.map((item) => {
              const quote = quotes.find((quote) => quote.id === item.quoteId);
              return (
                <tr key={item.id}>
                  <td>{item.date}</td>
                  <td>
                    {patients.find((patient) => patient.id === item.patientId)?.fullName ??
                      item.patientId}
                  </td>
                  <td>{item.medication}</td>
                  <td>{item.reason}</td>
                  <td>
                    <Link
                      className="action-link-button"
                      href={`/quotes?${quote?.status === 'DRAFT' ? 'edit' : 'revise'}=${encodeURIComponent(item.quoteId)}`}
                    >
                      Revisar cotización
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!operations.medicationReturns.length ? (
        <p>No hay medicamentos no aplicados reportados.</p>
      ) : null}
    </Panel>
  );
}
