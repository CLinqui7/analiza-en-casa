import { MedicationReturns } from '@/components/medication-returns';
export default function Page() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <h1>Devoluciones</h1>
      </header>
      <MedicationReturns />
    </div>
  );
}
