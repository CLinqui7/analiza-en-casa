import { Panel, StatusTag } from '@analiza/ui';

export default function InsurancePage() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Seguros</p>
          <h1>Seguros y coberturas</h1>
          <p>
            La integración conserva datos sintéticos y no calcula cobertura, tarifas ni
            autorizaciones sin reglas aprobadas.
          </p>
        </div>
        <StatusTag tone="warning">Reglas del cliente pendientes</StatusTag>
      </header>
      <section className="two-column">
        <Panel>
          <h2>Estado de integración</h2>
          <p>
            El modelo admite una aseguradora como dato de referencia del paciente. Las reglas de
            elegibilidad, cobertura y conciliación deben configurarse por organización y conservar
            evidencia de auditoría.
          </p>
        </Panel>
        <Panel>
          <h2>Guardas financieras</h2>
          <p>
            Las cotizaciones enviadas se tratarán como versiones inmutables; pagos, conciliaciones y
            trabajos externos requerirán claves de idempotencia y transacciones autorizadas.
          </p>
        </Panel>
      </section>
    </div>
  );
}
