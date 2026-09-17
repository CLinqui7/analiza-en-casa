'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { mongoMutationHeaders } from '@/lib/auth';
import {
  importDatasetDefinitions,
  importOverviewSchema,
  importPreviewSchema,
  type ImportOverview,
  type ImportPreview,
} from '@/lib/information-import';
import './information-import.css';

const MAX_WORKBOOK_BYTES = 5 * 1024 * 1024;

async function responsePayload(response: Response): Promise<unknown> {
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String(payload.error)
        : 'No pudimos procesar el archivo.';
    throw new Error(message);
  }
  return payload;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export function InformationImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [overview, setOverview] = useState<ImportOverview>();
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<ImportPreview>();
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<'preview' | 'import'>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  async function fetchOverview(signal?: AbortSignal) {
    const payload = await responsePayload(
      await fetch('/api/information-import', { cache: 'no-store', signal }),
    );
    return importOverviewSchema.parse(payload);
  }

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void (async () => {
      try {
        const next = await fetchOverview(controller.signal);
        if (active) setOverview(next);
      } catch (cause) {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
          setError(cause instanceof Error ? cause.message : 'No pudimos cargar las importaciones.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  function chooseFile(next: File | undefined) {
    setError(undefined);
    setNotice(undefined);
    setPreview(undefined);
    if (!next) {
      setFile(undefined);
      return;
    }
    if (!next.name.toLowerCase().endsWith('.xlsx') || next.size > MAX_WORKBOOK_BYTES) {
      setFile(undefined);
      if (inputRef.current) inputRef.current.value = '';
      setError('Selecciona un archivo .xlsx de máximo 5 MB.');
      return;
    }
    setFile(next);
  }

  async function submit(action: 'preview' | 'import') {
    if (!file) {
      setError('Selecciona primero la plantilla que deseas importar.');
      return;
    }
    setWorking(action);
    setError(undefined);
    setNotice(undefined);
    try {
      const body = new FormData();
      body.set('action', action);
      body.set('file', file);
      const payload = await responsePayload(
        await fetch('/api/information-import', {
          method: 'POST',
          credentials: 'same-origin',
          headers: mongoMutationHeaders(),
          body,
        }),
      );
      if (action === 'preview') {
        const checked = importPreviewSchema.parse(payload);
        setPreview(checked);
        setNotice(
          checked.ready
            ? 'Archivo revisado. Ya puedes importarlo a la base de datos.'
            : 'Encontramos datos que debes corregir antes de importar.',
        );
      } else {
        const imported = importOverviewSchema.parse(payload);
        const total = imported.batches[0]?.totalRows ?? 0;
        setOverview(await fetchOverview());
        setPreview(undefined);
        setFile(undefined);
        if (inputRef.current) inputRef.current.value = '';
        setNotice(`${total} registros quedaron guardados en la base de datos.`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos procesar la plantilla.');
    } finally {
      setWorking(undefined);
    }
  }

  return (
    <div className="page-stack information-import-page">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Administración · base de datos</p>
          <h1>Importar información</h1>
          <p>
            Carga servicios, proveedores, seguros, productos, tarifas, compras y personal desde la
            plantilla oficial.
          </p>
        </div>
        <a
          className="button button-secondary"
          data-action-id="INFORMATION-TEMPLATE-DOWNLOAD"
          download
          href="/templates/plantilla_carga_analiza_en_casa.xlsx"
        >
          Descargar plantilla
        </a>
      </header>

      <ol className="import-guide" aria-label="Pasos para importar">
        <li>
          <span>1</span>
          <div>
            <strong>Completa la plantilla</strong>
            <small>No cambies las hojas ni los encabezados.</small>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <strong>Revisa el archivo</strong>
            <small>Validaremos campos, IDs y relaciones.</small>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <strong>Confirma la importación</strong>
            <small>Los datos se guardarán o actualizarán.</small>
          </div>
        </li>
      </ol>

      {error ? (
        <p className="notice" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p
          className={`notice${preview?.ready || (!preview && notice.includes('guardados')) ? ' success' : ''}`}
          role="status"
        >
          {notice}
        </p>
      ) : null}

      <Panel className="import-composer">
        <div className="import-heading">
          <div>
            <h2>Selecciona el documento</h2>
            <p>Solo se acepta Excel .xlsx, máximo 5 MB y 2,000 registros por archivo.</p>
          </div>
          <StatusTag tone="success">Base compartida conectada</StatusTag>
        </div>
        <label className="import-dropzone">
          <span className="import-file-icon" aria-hidden="true">
            XLSX
          </span>
          <strong>{file ? file.name : 'Elige la plantilla completa'}</strong>
          <small>
            {file
              ? `${(file.size / 1024).toFixed(1)} KB seleccionados`
              : 'Puedes reemplazar el archivo antes de confirmar.'}
          </small>
          <input
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => chooseFile(event.target.files?.[0])}
            ref={inputRef}
            type="file"
          />
          <span className="button button-secondary">Seleccionar archivo</span>
        </label>
        <div className="import-actions">
          <Button
            data-action-id="INFORMATION-IMPORT-PREVIEW"
            disabled={!file || Boolean(working)}
            loading={working === 'preview'}
            onClick={() => void submit('preview')}
            type="button"
            variant="secondary"
          >
            {working === 'preview' ? 'Revisando…' : 'Revisar archivo'}
          </Button>
          <Button
            data-action-id="INFORMATION-IMPORT-COMMIT"
            disabled={!preview?.ready || Boolean(working)}
            loading={working === 'import'}
            onClick={() => void submit('import')}
            type="button"
          >
            {working === 'import' ? 'Importando…' : 'Importar a la base de datos'}
          </Button>
        </div>
      </Panel>

      {preview ? (
        <section className="import-preview" aria-labelledby="import-preview-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Vista previa</p>
              <h2 id="import-preview-title">Resultado de la revisión</h2>
            </div>
            <StatusTag tone={preview.ready ? 'success' : 'danger'}>
              {preview.ready ? 'Listo para importar' : 'Requiere correcciones'}
            </StatusTag>
          </div>
          <div className="import-summary-grid">
            <Panel>
              <span>Registros</span>
              <strong>{preview.totalRows}</strong>
              <small>Leídos en el archivo</small>
            </Panel>
            <Panel>
              <span>Nuevos</span>
              <strong>{preview.creates}</strong>
              <small>Se crearán</small>
            </Panel>
            <Panel>
              <span>Actualizaciones</span>
              <strong>{preview.updates}</strong>
              <small>Coinciden por ID</small>
            </Panel>
            <Panel>
              <span>Observaciones</span>
              <strong>{preview.issues.length}</strong>
              <small>Deben quedar en cero</small>
            </Panel>
          </div>
          {preview.issues.length ? (
            <Panel>
              <div className="table-heading">
                <h3>Correcciones necesarias</h3>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Hoja</th>
                      <th>Fila</th>
                      <th>Campo</th>
                      <th>Qué corregir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.issues.map((issue, index) => (
                      <tr key={`${issue.sheet}-${issue.row}-${issue.column ?? ''}-${index}`}>
                        <td>
                          <strong>{issue.sheet}</strong>
                        </td>
                        <td>{issue.row || '—'}</td>
                        <td>{issue.column ?? '—'}</td>
                        <td>{issue.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}
          <div className="import-sheet-grid">
            {preview.sheets.map((sheet) => (
              <Panel key={sheet.dataset}>
                <div className="import-sheet-title">
                  <h3>{sheet.label}</h3>
                  <StatusTag tone={sheet.rows ? 'success' : 'neutral'}>
                    {sheet.rows} filas
                  </StatusTag>
                </div>
                <p>
                  {sheet.creates} nuevas · {sheet.updates} actualizaciones
                </p>
                {sheet.samples.length ? (
                  <small>
                    Ejemplo:{' '}
                    {Object.values(sheet.samples[0])
                      .filter((value) => value !== null)
                      .slice(0, 3)
                      .join(' · ')}
                  </small>
                ) : (
                  <small>Sin datos en esta hoja.</small>
                )}
              </Panel>
            ))}
          </div>
        </section>
      ) : null}

      <section className="import-history" aria-labelledby="import-history-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Base de datos</p>
            <h2 id="import-history-title">Información importada</h2>
          </div>
        </div>
        <div className="import-sheet-grid">
          {importDatasetDefinitions.map((definition) => (
            <Panel key={definition.dataset}>
              <span>{definition.label}</span>
              <strong className="import-database-count">
                {loading ? '…' : (overview?.records[definition.dataset] ?? 0)}
              </strong>
              <small>registros guardados</small>
            </Panel>
          ))}
        </div>
        {overview?.batches.length ? (
          <Panel>
            <div className="table-heading">
              <h3>Importaciones recientes</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Archivo</th>
                    <th>Fecha</th>
                    <th>Responsable</th>
                    <th>Registros</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.batches.map((batch) => (
                    <tr key={batch.id}>
                      <td>
                        <strong>{batch.fileName}</strong>
                      </td>
                      <td>{formatDate(batch.importedAt)}</td>
                      <td>{batch.importedBy}</td>
                      <td>{batch.totalRows}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : !loading ? (
          <EmptyState
            title="Aún no hay importaciones"
            detail="La primera carga aparecerá aquí con su fecha y responsable."
          />
        ) : null}
      </section>
    </div>
  );
}
