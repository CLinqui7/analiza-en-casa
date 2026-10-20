import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Encuesta de satisfacción · Analiza en Casa',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function SurveyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
