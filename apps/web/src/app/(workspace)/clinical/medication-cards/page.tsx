import Link from 'next/link';

const safeguards = [
  {
    icon: '✓',
    title: 'Autorización clínica',
    detail: 'Cada tarjeta deberá conservar el responsable y la autorización correspondiente.',
  },
  {
    icon: 'Rx',
    title: 'Dosis y frecuencia',
    detail: 'La información se mostrará únicamente desde catálogos y registros aprobados.',
  },
  {
    icon: '↺',
    title: 'Historial de cambios',
    detail: 'Las correcciones mantendrán la versión anterior y su evidencia de auditoría.',
  },
];

export default function MedicationCardsPage() {
  return (
    <div className="page-stack medication-cards-page">
      <header className="medication-cards-hero">
        <div className="medication-cards-hero-copy">
          <span className="medication-cards-icon" aria-hidden="true">
            Rx
          </span>
          <div>
            <p className="eyebrow">Gestión de medicamentos</p>
            <h1>Tarjetas de medicamentos</h1>
            <p>
              Un espacio seguro para consultar dosis, horarios, vigencia y correcciones cuando el
              contrato clínico sea aprobado.
            </p>
          </div>
        </div>
        <span className="medication-cards-status">
          <span aria-hidden="true">●</span> Configuración pendiente
        </span>
      </header>

      <section className="medication-cards-state" aria-labelledby="medication-state-heading">
        <div className="medication-cards-state-copy">
          <span className="medication-cards-state-mark" aria-hidden="true">
            ◇
          </span>
          <div>
            <p className="eyebrow">Protección clínica activa</p>
            <h2 id="medication-state-heading">La captura permanece protegida</h2>
            <p>
              Todavía no se permite crear ni comunicar tarjetas. Así evitamos registrar dosis,
              frecuencias o autorizaciones incompletas mientras se terminan las reglas clínicas.
            </p>
          </div>
        </div>
        <Link className="medication-cards-back" href="/clinical">
          Volver al expediente <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section className="medication-cards-safeguards" aria-labelledby="safeguards-heading">
        <div className="medication-cards-section-heading">
          <div>
            <p className="eyebrow">Antes de habilitar</p>
            <h2 id="safeguards-heading">Controles que protegerán cada tarjeta</h2>
          </div>
          <span>3 controles previstos</span>
        </div>
        <div className="medication-cards-grid">
          {safeguards.map((item) => (
            <article key={item.title}>
              <span aria-hidden="true">{item.icon}</span>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="medication-cards-next" aria-label="Alternativas disponibles">
        <div>
          <span aria-hidden="true">✚</span>
          <div>
            <strong>Mientras tanto puedes continuar con la atención</strong>
            <p>Consulta hospitalizaciones o registra administraciones ya realizadas.</p>
          </div>
        </div>
        <nav aria-label="Accesos clínicos relacionados">
          <Link href="/clinical/hospitalizations">Hospitalizaciones</Link>
          <Link href="/clinical/administrations">Administraciones</Link>
        </nav>
      </section>
    </div>
  );
}
