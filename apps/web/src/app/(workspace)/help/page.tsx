'use client';

import Link from 'next/link';
import { Panel, StatusTag } from '@analiza/ui';
import { useMemo, useState } from 'react';
import { normalizeText } from '@analiza/domain';

const whatsappSupportUrl = process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_URL;
const knowledgeBase = [
  { id: 'quote', question: '¿Cómo creo una cotización?', answer: 'Abra Cotizaciones, elija Nueva cotización, seleccione el caso y guarde el borrador antes de enviarlo.', steps: ['Abrir Cotizaciones', 'Crear borrador', 'Validar y enviar la versión'], href: '/quotes', label: 'Abrir cotizaciones', terms: ['cotizacion', 'cotización', 'presupuesto'] },
  { id: 'patient', question: '¿Cómo agrego un paciente?', answer: 'Abra Pacientes, seleccione Agregar paciente y complete los datos sintéticos requeridos. El documento duplicado se rechaza.', steps: ['Abrir Pacientes', 'Agregar paciente', 'Guardar registro'], href: '/patients', label: 'Abrir pacientes', terms: ['agrego paciente', 'agregar paciente', 'paciente nuevo'] },
  { id: 'payment', question: '¿Cómo veo un pago?', answer: 'Abra Pagos o Cuentas por cobrar y seleccione el registro correspondiente. Los pagos requieren permiso financiero.', steps: ['Abrir Pagos', 'Buscar el caso', 'Consultar el historial'], href: '/payments', label: 'Abrir pagos', terms: ['pago', 'pagos', 'cobro'] },
  { id: 'movement', question: '¿Cómo hago un movimiento?', answer: 'Abra Kárdex, seleccione Registrar movimiento y elija ítem, bodega, tipo, cantidad, referencia y motivo.', steps: ['Abrir Kárdex', 'Registrar movimiento', 'Confirmar saldo derivado'], href: '/inventory/kardex', label: 'Abrir Kárdex', terms: ['movimiento', 'inventario', 'kardex', 'kárdex'] },
];

export default function HelpPage() {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const needle = normalizeText(query);
    if (!needle) return knowledgeBase;
    return knowledgeBase.filter((entry) => normalizeText([entry.question, entry.answer, ...entry.terms].join(' ')).includes(needle));
  }, [query]);
  return <div className="page-stack"><header className="page-header"><div><p className="eyebrow">Ayuda</p><h1>Centro de ayuda</h1><p>Respuestas determinísticas basadas en una base local del sistema.</p></div></header><Panel><label className="search-label" htmlFor="help-search">¿Qué necesitas hacer?</label><input data-action-id="HELP-SEARCH" id="help-search" onChange={(event) => setQuery(event.target.value)} placeholder="Ej.: ¿Cómo hago un movimiento?" type="search" value={query} /></Panel>{matches.length ? <section className="card-grid">{matches.map((entry) => <Panel key={entry.id}><h2>{entry.question}</h2><p>{entry.answer}</p><ol>{entry.steps.map((step) => <li key={step}>{step}</li>)}</ol><Link className="text-link" href={entry.href}>{entry.label}</Link></Panel>)}</section> : <Panel><h2>Sin resultados</h2><p>No se encontró una respuesta local para esa consulta.</p>{whatsappSupportUrl ? <a className="text-link" href={whatsappSupportUrl} rel="noreferrer" target="_blank">Abrir canal configurado</a> : <><p>No hay un canal de WhatsApp configurado en este entorno. Solicite al administrador una URL pública aprobada; no se muestra ni inventa un número.</p><StatusTag tone="warning">Canal no configurado</StatusTag></>}</Panel>}<Panel><h2>Seguridad del portal</h2><p>El portal requiere token con expiración, verificación secundaria y respuestas anti-enumeración; nunca usa sólo DUI.</p></Panel></div>;
}
