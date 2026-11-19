# Correcciones extras1 · publicación del 18/11/2026

Las tres observaciones de `extras1parte_.docx` están publicadas: responsable administrativo estable, consulta actualizada de cotizaciones del paciente en Precotización y proveedores en tabla. Se corrigió también la invalidación de formularios abiertos al consultar CSRF desde otra pestaña. [Fuente, implementación y QA](../qa/CLIENT_EXTRAS1_2026-11-17.md).

| Evidencia | Valor |
|---|---|
| Release activo | `614b1b4bca2f93de4b85414504581ffe9803b3e2` |
| Código funcional probado | `3e2080cb71340449d2379f36a134c7d4f8be7936` |
| Ajuste visual final probado | `de81fbcbd6e1cddfb30b3a5e10688488e6938cdb` |
| Archivo de publicación SHA256, local/remoto | `72c9886d4a2d40ff621fd63870a758698ad147adb40025beb49feb49e57a02a3` |
| Imagen nueva | `sha256:ceb4fe64e37a3343c3dfef78526efbba8910962e0f5030c5f768bc5aeb75a797` |
| Release anterior conservado | `e1f0935b5111c78c2769486bda96098e93e8b8e1` |
| Imagen anterior conservada | `sha256:5aacf82dac47ffcff3bffd47612684079e458c058b8bf3ae1fd3e7a666c38b3f` |
| Respaldo previo | `c66924995bcea3071a1ba3a5eec7e99d6bb7cb0979cd44810c925999dc66c0af` |
| Hora del respaldo | 18/11/2026 00:13:20 El Salvador; 18/11/2026 07:13:20 CET |
| Base activa | `analiza_live_20261014` |
| Migraciones nuevas | Ninguna; esquema hasta 041 |
| PR abierto, sin fusionar | https://github.com/CLinqui7/analiza-en-casa/pull/20 |

Se verificó el SHA publicado en GitHub antes de transferir el archivo. El despliegue compiló la imagen, creó el respaldo con validación del volcado de la base activa y publicó el release. El código de aplicación de la publicación coincide con el ajuste visual final probado; el commit posterior sólo añade certificación y verificador. No se ejecutaron GitHub Actions ni se fusionó el PR.

QA: 376 pruebas unitarias/servidor, 16 grupos PostgreSQL aislados (diez del flujo y seis financieros), 54 escenarios mock iniciales con 31 repetidos tras el ajuste de sesión/formulario, seis escenarios conectados y repetición focalizada de asignación/entrega/proveedores. También pasaron 144 pruebas legacy, 76 controles QA, TypeScript, ESLint, formato, compilación, seguridad y trazabilidad. Los fallos iniciales, correcciones y límites están registrados en el informe de QA; no se declara una nueva revisión completa de los 17 vídeos.

La comprobación pública de sólo lectura pasó con una cuenta de organización sintética: CSRF estable en consultas concurrentes, perfil disponible, API por solicitud con validación de entrada y cinco páginas (`/quotes`, `/clinical/prequotes`, `/receivables`, `/inventory/suppliers`, `/inventory/received-orders`) a 1440/768/390 px, sin errores JavaScript ni desbordamiento de página. No había solicitudes pendientes en esa organización; el guardado completo, ampliaciones y CRUD se comprobaron en QA aislado. No se crearon cargos, entregas ni proveedores ficticios en producción. [Resultado público](../feedback/evidence/extras1-nov17/public-release.json).

Se retiraron los dos contenedores de QA `analiza-clinical-qa-1794980708151`, su red, las tres imágenes/source de QA y los archivos privados remotos. Se comprobaron sus montajes tmpfs antes de retirarlos; no se tocaron volúmenes de producción. Se cerraron ambos túneles SSH locales. La revisión automática bloqueó el borrado de `C:/Temp/analiza-extras1-qa-private`; se conserva fuera de Git, sin reutilizar sus credenciales efímeras. No se intentó eludir el bloqueo. La aplicación y PostgreSQL quedaron saludables, con revisión correcta y salud HTTP 200.

La imagen anterior se conserva para recuperación de aplicación. No restaurar ni borrar datos automáticamente: las cotizaciones, pagos y entregas posteriores deben preservarse. No se actualizó Ubuntu/Docker ni se reinició el host. La copia externa y restauración del nuevo snapshot no se verificaron en este lote. El aviso preexistente de espera de red al arranque permanece documentado en la entrega anterior, con conectividad operativa.
