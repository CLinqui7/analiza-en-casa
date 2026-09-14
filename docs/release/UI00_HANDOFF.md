# UI00 · Base visual moderna y shell estable

Fecha: 2026-09-09  
Ámbito: shell compartido; modo demo local.

El shell móvil ahora usa un drawer con overlay, cierre, Escape, devolución de foco y
trap de teclado. El footer sigue dentro del drawer, por lo que cuenta y salida no se
ocultan a 390px. La restauración de scroll de la barra lateral es inmediata, sin animación.
El diálogo de cuenta se monta en `document.body`, conserva foco, se cierra con Escape y
no queda bajo contenido animado.

La evidencia de navegador no se fabricó: el worker no tiene navegador certificado. El
verificador propietario debe capturar Dashboard, Pacientes y el diálogo de cuenta en
390x844, 768x1024 y 1440x900 sobre este snapshot. El detalle y los límites se registran
en `docs/release/UI_PAGE_REVIEW.json`.

El registro `docs/release/REQUIREMENTS_IMPLEMENTATION.json` no existe en este checkout;
por tanto no se modificaron estados de los 210 requisitos de video ni de los 32 de Excel.
