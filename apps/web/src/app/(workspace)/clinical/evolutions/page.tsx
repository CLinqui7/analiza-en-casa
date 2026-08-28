import { Panel, StatusTag } from '@analiza/ui';

export default function EvolutionsPage() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Clínico</p>
          <h1>Evoluciones</h1>
          <p>Vista de trazabilidad preparada para versiones firmadas y correcciones autorizadas.</p>
        </div>
        <StatusTag tone="warning">Reglas de firma pendientes</StatusTag>
      </header>
      <Panel>
        <h2>Protección de registros</h2>
        <p>
          Una evolución firmada no se edita en silencio: cualquier corrección deberá preservar la
          versión firmada, registrar autorización, razón y nueva evidencia de auditoría. La captura
          de contenido clínico permanece bloqueada hasta conectar el flujo autorizado y sus
          políticas de retención.
        </p>
      </Panel>
    </div>
  );
}
