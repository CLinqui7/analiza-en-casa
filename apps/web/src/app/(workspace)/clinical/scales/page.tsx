import Image from 'next/image';
import Link from 'next/link';
import { clinicalScaleReferences } from '@/lib/clinical-scale-references';

export default function ClinicalScalesPage() {
  const conflicts = clinicalScaleReferences.filter((reference) => reference.conflict).length;

  return (
    <main className="page-stack clinical-scales-page">
      <header className="page-header clinical-scales-hero">
        <div>
          <p className="eyebrow">Clínico · material original</p>
          <h1>Escalas clínicas</h1>
          <p>
            Consulta las diez capturas incluidas en el HTML inicial, con su fila y denominación
            original. Este catálogo permite revisar la fuente, pero todavía no registra puntuaciones
            ni sustituye los formularios clínicos aprobados.
          </p>
        </div>
        <Link className="button button-secondary" href="/clinical/reports">
          Volver a reportes
        </Link>
      </header>

      <section className="clinical-scales-summary" aria-label="Estado de las escalas">
        <div>
          <strong>{clinicalScaleReferences.length}</strong>
          <span>capturas del HTML</span>
        </div>
        <div>
          <strong>{conflicts}</strong>
          <span>fuentes por aclarar</span>
        </div>
        <div>
          <strong>0</strong>
          <span>versiones clínicas aprobadas</span>
        </div>
      </section>

      <p className="notice" role="note">
        Antes de habilitar captura, cálculos o uso con pacientes reales, el equipo responsable debe
        confirmar la versión y los criterios de cada escala. Las imágenes se muestran tal como se
        recibieron, incluidos sus errores o nombres distintos.
      </p>

      <section className="clinical-scales-grid" aria-label="Escalas del archivo original">
        {clinicalScaleReferences.map((reference) => (
          <article className="clinical-scale-card" id={reference.id} key={reference.id}>
            <div className="clinical-scale-card-top">
              <span className="clinical-scale-row">Hoja1 · fila {reference.row}</span>
              <span className={reference.conflict ? 'scale-state conflict' : 'scale-state'}>
                {reference.conflict ? 'Fuente por aclarar' : 'Versión por validar'}
              </span>
            </div>
            <h2>{reference.title}</h2>
            <p>{reference.note}</p>
            <details className="clinical-scale-source">
              <summary>Ver imagen original</summary>
              <div>
                <p>Texto del Excel: {reference.sourceLabel}</p>
                <Image
                  alt={`Captura original de ${reference.sourceLabel}, Hoja1 fila ${reference.row}`}
                  height={820}
                  sizes="(max-width: 740px) 92vw, (max-width: 1180px) 80vw, 700px"
                  src={reference.image}
                  width={1100}
                />
              </div>
            </details>
          </article>
        ))}
      </section>
    </main>
  );
}
