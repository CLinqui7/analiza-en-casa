import { LoginForm } from '@/components/login-form';
import { Suspense } from 'react';

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="access-denied">Cargando acceso…</main>}>
      <LoginForm />
    </Suspense>
  );
}
