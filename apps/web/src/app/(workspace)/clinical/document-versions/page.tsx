import { ClinicalDocumentsPage } from '@/components/clinical-documents-page';
export default function Page() {
  return (
    <>
      <ClinicalDocumentsPage type="CARE_PLAN" />
      <ClinicalDocumentsPage type="CLINICAL_EVOLUTION" />
    </>
  );
}
