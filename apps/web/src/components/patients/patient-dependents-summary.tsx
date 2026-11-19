'use client';
import type { Patient } from '@analiza/contracts';
import { Panel } from '@analiza/ui';
import { useEffect, useState } from 'react';
import {
  listPrivateFiles,
  privateFileDownloadHref,
  type PrivateFileMetadata,
} from '@/lib/private-files';

export function PatientDependentsSummary({
  patient,
  serverMode,
}: {
  patient: Patient;
  serverMode: boolean;
}) {
  const [files, setFiles] = useState<PrivateFileMetadata[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!serverMode || !patient.dependents?.length) return;
    let active = true;
    void listPrivateFiles('patient', patient.id)
      .then((items) => {
        if (active) setFiles(items);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [patient.id, patient.dependents?.length, serverMode]);
  return (
    <Panel>
      <h2>Dependientes</h2>
      {!patient.dependents?.length ? (
        <p>No hay dependientes registrados.</p>
      ) : (
        <div className="dependent-summary-grid">
          {patient.dependents.map((dependent) => (
            <article className="dependent-card" key={dependent.id}>
              <h3>
                {dependent.firstNames} {dependent.lastNames}
              </h3>
              <p>
                {dependent.gender === 'F' ? 'Femenino' : 'Masculino'} · {dependent.birthDate}
              </p>
              {(['BIRTH_CERTIFICATE', 'CONSENT'] as const).map((kind) => {
                const documents = files.filter(
                  (file) => file.dependentId === dependent.id && file.documentKind === kind,
                );
                return (
                  <div key={kind}>
                    <strong>
                      {kind === 'BIRTH_CERTIFICATE' ? 'Partida de nacimiento' : 'Consentimiento'}
                    </strong>
                    {documents.length ? (
                      documents.map((file) => (
                        <p key={file.id}>
                          <a
                            className="button button-secondary"
                            href={privateFileDownloadHref(file.id)}
                          >
                            Descargar {file.name}
                          </a>
                        </p>
                      ))
                    ) : (
                      <p className="field-help">Sin archivo registrado</p>
                    )}
                  </div>
                );
              })}
            </article>
          ))}
        </div>
      )}
      {error ? (
        <p role="alert">No se pudieron consultar los documentos. Vuelva a cargar el expediente.</p>
      ) : null}
    </Panel>
  );
}
