'use client';

import { useEffect, useState } from 'react';

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const listener = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', listener);
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js');
    return () => window.removeEventListener('beforeinstallprompt', listener);
  }, []);
  return <div><button className="button button-secondary" data-action-id="AUTH-INSTALL" onClick={() => {
    if (!prompt) { setNotice('La instalación no está disponible en este navegador. Use el menú del navegador para instalar la aplicación cuando esté habilitado.'); return; }
    void prompt.prompt().then(async () => { const choice = await prompt.userChoice; setNotice(choice.outcome === 'accepted' ? 'El navegador confirmó la instalación.' : 'La instalación fue cancelada en el navegador.'); setPrompt(null); });
  }} type="button">Instalar en dispositivo</button>{notice ? <p className="field-help" role="status">{notice}</p> : null}</div>;
}
