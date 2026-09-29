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
            Consulta las diez capturas incluidas en el HTML inicial. Para registrar sus valores y
            revisar el historial, abre el expediente del paciente y entra en «Escalas».
          </p>
        </div>
        <Link className="button button-primary" href="/patients">
          Elegir paciente
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
        Los formularios por paciente guardan los valores seleccionados y su autor, pero no calculan
        riesgo, diagnóstico ni clasificación. El equipo responsable aún debe confirmar la versión
        clínica de cada escala; las imágenes conservan sus errores y nombres originales.
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
