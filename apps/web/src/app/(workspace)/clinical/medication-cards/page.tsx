import { Panel, StatusTag } from '@analiza/ui';

export default function MedicationCardsPage() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Clínico</p>
          <h1>Tarjetas de medicamentos</h1>
          <p>
            La captura y administración permanecen bloqueadas hasta contar con un contrato clínico
            aprobado para autorización, dosis, frecuencia, vigencia y correcciones.
          </p>
        </div>
        <StatusTag tone="warning">Contrato pendiente</StatusTag>
      </header>
      <Panel>
        <h2>Protección clínica</h2>
        <p>
          No se crea, calcula ni comunica una tarjeta de medicamentos sin reglas y autorizaciones
          aprobadas. Esta ruta preserva la navegación y explica el bloqueo de forma explícita.
        </p>
      </Panel>
    </div>
  );
}
