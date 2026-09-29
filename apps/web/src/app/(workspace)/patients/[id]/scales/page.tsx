import { PatientScaleWorkspace } from '@/components/patient-scale-workspace';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ scale?: string }>;
};

export default async function PatientScalesPage({ params, searchParams }: Props) {
  const [{ id }, { scale }] = await Promise.all([params, searchParams]);
  return <PatientScaleWorkspace patientId={id} initialScaleId={scale ?? null} />;
}
