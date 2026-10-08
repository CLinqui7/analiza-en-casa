'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Dialog } from '@analiza/ui';

type Step = { title: string; detail: string; target?: string };
type Guide = { title: string; steps: Step[] };

const guides: Array<{ path: string; guide: Guide }> = [
  {
    path: '/inventory/home-deliveries',
    guide: {
      title: 'Entregas a domicilio',
      steps: [
        {
          title: 'Qué muestra esta pantalla',
          detail:
            'Cada despacho quita unidades de la bodega y crea una custodia por paciente y dirección.',
          target: '.studio-metrics',
        },
        {
          title: 'Enviar insumos o medicamentos',
          detail:
            'Pulse Registrar despacho, elija paciente, dirección, artículo, bodega y cantidad. Guarde una referencia de entrega.',
          target: '[data-action-id="HOME-DISPATCH-CREATE"]',
        },
        {
          title: 'Cierre y devolución',
          detail:
            'Al recibir sobrantes, pulse Cerrar y recibir. Lo devuelto queda en cuarentena; no aumenta el stock disponible.',
          target: '[data-action-id="HOME-DISPATCH-CLOSE"]',
        },
      ],
    },
  },
  {
    path: '/inventory/movements',
    guide: {
      title: 'Movimientos entre bodegas',
      steps: [
        {
          title: 'Ubicaciones',
          detail: 'Revise el artículo y la bodega de origen antes de mover unidades.',
        },
        {
          title: 'Registrar traslado',
          detail:
            'Indique origen, destino, cantidad y referencia. El traslado se registra como una operación atómica.',
        },
        {
          title: 'Verificar',
          detail: 'Compruebe el movimiento en el Kárdex y las existencias por ubicación.',
        },
      ],
    },
  },
  {
    path: '/inventory',
    guide: {
      title: 'Inventario',
      steps: [
        {
          title: 'Existencias',
          detail:
            'El balance disponible proviene de los movimientos confirmados, no de la cantidad enviada a casas.',
        },
        {
          title: 'Acciones',
          detail:
            'Use Movimientos para bodegas y Entregas a domicilio para pacientes; son flujos distintos.',
        },
        {
          title: 'Revisión',
          detail: 'Revise Kárdex, lotes y cuarentena antes de interpretar la disponibilidad.',
        },
      ],
    },
  },
  {
    path: '/reports/visits-goals',
    guide: {
      title: 'Visitas y metas · venta de equipos',
      steps: [
        {
          title: 'Elija el período',
          detail: 'Cambie entre semana (desde lunes) y mes. Los gráficos usan hora de El Salvador.',
          target: '.studio-toolbar',
        },
        {
          title: 'Registrar actividad',
          detail:
            'Claudia registra visitas a médicos; Sissy define metas y confirma ventas con referencia. Un ingreso se vincula a una hospitalización existente.',
          target: '.header-actions',
        },
        {
          title: 'Leer el resultado',
          detail:
            'Los médicos se cuentan una vez por período. Las ventas son registros confirmados vinculados a una visita; no son utilidad ni factura.',
          target: '.commercial-goal-bars',
        },
      ],
    },
  },
  {
    path: '/reports/home-visits',
    guide: {
      title: 'Visitas clínicas',
      steps: [
        {
          title: 'Actividad clínica',
          detail:
            'Esta pantalla conserva el registro anterior de atención domiciliaria por enfermera o médico.',
        },
        {
          title: 'Registrar visita',
          detail:
            'Elija profesional, paciente y fecha. No use esta pantalla para las visitas comerciales de Claudia.',
        },
        {
          title: 'Revisar metas',
          detail: 'Filtre por mes y profesión para ver la actividad registrada.',
        },
      ],
    },
  },
  {
    path: '/sales',
    guide: {
      title: 'Ventas confirmadas',
      steps: [
        {
          title: 'Qué cuenta',
          detail:
            'Sólo registros con monto y referencia verificable. No son cotizaciones, pagos aplicados, utilidad ni facturación fiscal.',
          target: '.studio-metrics',
        },
        {
          title: 'Confirmar una venta',
          detail:
            'Pulse Confirmar venta, indique fecha, categoría, monto y referencia. Puede vincular una cotización enviada.',
          target: '.header-actions',
        },
        {
          title: 'Verificar',
          detail:
            'Revise la nueva fila y las cifras semanales y mensuales. Una referencia repetida no debe crear otra venta.',
          target: 'table',
        },
      ],
    },
  },
  {
    path: '/dashboard',
    guide: {
      title: 'Dashboard',
      steps: [
        {
          title: 'Resumen',
          detail:
            'Lea los indicadores de operación y el período mostrado; los importes de cotizaciones y cobros están separados.',
          target: '.dashboard-kpi-grid',
        },
        {
          title: 'Ventas confirmadas',
          detail:
            'Las cifras semanales y mensuales provienen sólo de ventas con referencia. Abra Ver registros para comprobarlas.',
          target: '.dashboard-sales-overview',
        },
        {
          title: 'Actuar',
          detail: 'Use los accesos rápidos o las tarjetas para abrir el módulo correspondiente.',
          target: '.studio-shortcuts',
        },
      ],
    },
  },
  {
    path: '/hospitalizations',
    guide: {
      title: 'Hospitalizaciones',
      steps: [
        {
          title: 'Buscar un caso',
          detail:
            'Localice al paciente y abra su hospitalización para revisar su estado y los datos administrativos.',
          target: '.page-header',
        },
        {
          title: 'Cotizaciones vinculadas',
          detail:
            'En el detalle puede adjuntar una cotización del mismo paciente y caso; la versión enviada no se modifica.',
        },
        {
          title: 'Guardar',
          detail:
            'Revise los campos y el mensaje de resultado antes de salir. Los errores de validación deben aparecer en pantalla.',
        },
      ],
    },
  },
  {
    path: '/quotes',
    guide: {
      title: 'Cotizaciones',
      steps: [
        {
          title: 'Preparar',
          detail:
            'Elija paciente y conceptos. Compruebe cantidades, precios y descuento antes de enviar.',
        },
        {
          title: 'Versiones',
          detail: 'Una versión enviada es inmutable; cualquier cambio posterior crea otra versión.',
        },
        {
          title: 'Compartir',
          detail:
            'Revise el PDF antes de entregarlo al paciente. La cotización no equivale a una venta confirmada.',
        },
      ],
    },
  },
  {
    path: '/feedback',
    guide: {
      title: 'Preguntas y errores',
      steps: [
        {
          title: 'Revisar solicitudes',
          detail: 'Filtre por estado y lea la descripción y el adjunto de cada reporte.',
        },
        {
          title: 'Gestionar',
          detail:
            'Registre la respuesta y el estado con evidencia; «resuelto» requiere que el cambio esté verificado.',
        },
        {
          title: 'Dar seguimiento',
          detail:
            'Las integraciones y reglas sin definición permanecen abiertas hasta contar con la confirmación necesaria.',
        },
      ],
    },
  },
  {
    path: '/patients',
    guide: {
      title: 'Pacientes',
      steps: [
        {
          title: 'Localizar',
          detail:
            'Use búsqueda y filtros para encontrar un expediente existente antes de crear otro.',
        },
        {
          title: 'Registrar',
          detail: 'Complete los datos requeridos; sólo use información autorizada.',
        },
        {
          title: 'Continuar',
          detail: 'Abra el paciente para revisar hospitalizaciones, documentos y seguimiento.',
        },
      ],
    },
  },
  {
    path: '/payments',
    guide: {
      title: 'Pagos',
      steps: [
        {
          title: 'Identificar saldo',
          detail: 'Abra una cuenta pendiente y verifique monto y referencia.',
        },
        {
          title: 'Aplicar pago',
          detail: 'Seleccione medio y guarde. Las referencias evitan aplicar pagos duplicados.',
        },
        {
          title: 'Distinguir métricas',
          detail: 'Un cobro aplicado no se suma automáticamente como venta confirmada.',
        },
      ],
    },
  },
];

export function ScreenHelp({ pathname, pageLabel }: { pathname: string; pageLabel: string }) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const guide = useMemo(
    () =>
      guides.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
        ?.guide ?? {
        title: pageLabel,
        steps: [
          {
            title: 'Orientación',
            detail: `Esta es la pantalla ${pageLabel}. Revise el encabezado y los filtros para ubicar la información.`,
          },
          {
            title: 'Acción principal',
            detail:
              'Use los botones visibles para iniciar una operación. Complete los campos obligatorios y confirme antes de guardar.',
          },
          {
            title: 'Resultado',
            detail:
              'Compruebe el aviso de éxito o error y el registro actualizado antes de salir de la pantalla.',
          },
        ],
      },
    [pathname, pageLabel],
  );
  useEffect(() => {
    if (!open) return;
    const selector = guide.steps[stepIndex]?.target;
    if (!selector) return;
    const node = document.querySelector(selector);
    node?.classList.add('screen-help-target');
    return () => node?.classList.remove('screen-help-target');
  }, [open, stepIndex, guide]);
  return (
    <>
      <Button
        className="button-secondary screen-help-trigger"
        data-action-id="SCREEN-HELP"
        onClick={() => {
          setStepIndex(0);
          setOpen(true);
        }}
        type="button"
      >
        Ayuda de esta pantalla
      </Button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <Dialog
              open={open}
              onClose={() => setOpen(false)}
              title={guide.title}
              description={`Guía ${stepIndex + 1} de ${guide.steps.length}`}
              footer={
                <>
                  <Button className="button-secondary" onClick={() => setOpen(false)}>
                    Cerrar
                  </Button>
                  <Button
                    className="button-secondary"
                    disabled={stepIndex === 0}
                    onClick={() => setStepIndex((value) => value - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    onClick={() =>
                      stepIndex + 1 === guide.steps.length
                        ? setOpen(false)
                        : setStepIndex((value) => value + 1)
                    }
                  >
                    {stepIndex + 1 === guide.steps.length ? 'Terminar' : 'Siguiente'}
                  </Button>
                </>
              }
            >
              <div className="screen-help-step" role="status">
                <span>
                  Paso {stepIndex + 1} / {guide.steps.length}
                </span>
                <h3>{guide.steps[stepIndex].title}</h3>
                <p>{guide.steps[stepIndex].detail}</p>
              </div>
            </Dialog>,
            document.body,
          )
        : null}
    </>
  );
}
