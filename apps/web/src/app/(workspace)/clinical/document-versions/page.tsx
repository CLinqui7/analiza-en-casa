'use client';
import { useState } from 'react';
import { ClinicalDocumentsPage } from '@/components/clinical-documents-page';
export default function Page() {
  const [type, setType] = useState<'CARE_PLAN' | 'CLINICAL_EVOLUTION'>('CARE_PLAN');
  return (
    <>
      <nav className="action-row" aria-label="Documentos anteriores">
        <button
          className="button button-secondary"
          aria-pressed={type === 'CARE_PLAN'}
          onClick={() => setType('CARE_PLAN')}
        >
          Planes de cuidado anteriores
        </button>
        <button
          className="button button-secondary"
          aria-pressed={type === 'CLINICAL_EVOLUTION'}
          onClick={() => setType('CLINICAL_EVOLUTION')}
        >
          Evoluciones anteriores
        </button>
      </nav>
      <ClinicalDocumentsPage key={type} type={type} />
    </>
  );
}
