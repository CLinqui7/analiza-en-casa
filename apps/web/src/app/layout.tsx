import type { Metadata } from 'next';
import { AppProviders } from '@/components/providers';
import './globals.css';
import './studio.css';
import './design-system.css';

export const metadata: Metadata = {
  title: {
    default: 'Analiza en Casa',
    template: '%s · Analiza en Casa',
  },
  description: 'Plataforma operativa de atención domiciliaria',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/brand/analiza-en-casa-logo.png',
    shortcut: '/brand/analiza-en-casa-logo.png',
    apple: '/brand/analiza-en-casa-logo.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
