import Link from 'next/link';
import { Panel, StatusTag } from '@analiza/ui';

const whatsappSupportUrl = process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_URL;

export default function HelpPage() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Ayuda</p>
          <h1>Centro de ayuda</h1>
          <p>Rutas determinísticas para uso local, QA y configuración segura.</p>
        </div>
      </header>
      <section className="card-grid">
        <Panel>
          <h2>Registrar y buscar pacientes</h2>
          <p>
            Use la búsqueda normalizada o abra el formulario de registro. Los duplicados por tipo y
            número de documento se bloquean antes de guardar.
          </p>
          <Link className="text-link" href="/patients">
            Abrir pacientes
          </Link>
        </Panel>
        <Panel>
          <h2>Reporte de salud</h2>
          <p>
            Las mediciones se cargan de forma individual, con fuente y bitácora. La aplicación no
            interpreta resultados ni emite recomendaciones.
          </p>
          <Link className="text-link" href="/clinical/reports">
            Abrir reporte
          </Link>
        </Panel>
        <Panel>
          <h2>Inventario y kárdex</h2>
          <p>
            El saldo se deriva de un historial de entradas, salidas y ajustes. Un movimiento que
            deja saldo negativo se rechaza.
          </p>
          <Link className="text-link" href="/inventory/kardex">
            Abrir kárdex
          </Link>
        </Panel>
        <Panel>
          <h2>Canal de WhatsApp</h2>
          {whatsappSupportUrl ? (
            <a className="text-link" href={whatsappSupportUrl} rel="noreferrer" target="_blank">
              Abrir canal configurado
            </a>
          ) : (
            <>
              <p>
                No hay un canal de WhatsApp configurado en este entorno. Solicite al administrador
                una URL pública aprobada; no se muestra ni inventa un número.
              </p>
              <StatusTag tone="warning">No configurado</StatusTag>
            </>
          )}
        </Panel>
        <Panel>
          <h2>Preguntas frecuentes</h2>
          <dl className="definition-list">
            <div>
              <dt>¿Los datos son reales?</dt>
              <dd>No. Este entorno emplea únicamente datos sintéticos.</dd>
            </div>
            <div>
              <dt>¿Dónde se configuran las reglas?</dt>
              <dd>
                Las reglas clínicas, de seguros y de documentos oficiales requieren una decisión del
                cliente antes de automatizarse.
              </dd>
            </div>
          </dl>
        </Panel>
        <Panel>
          <h2>Soporte de acceso</h2>
          <p>
            El portal de pacientes debe usar token con expiración, verificación secundaria y
            respuestas anti-enumeración. Este demo no habilita recuperación basada sólo en DUI.
          </p>
        </Panel>
      </section>
    </div>
  );
}
