# E02 handoff — edición de hospitalización

## Cambio focal

El caso Selenium `Hospitalizations.test_edit` ya validaba el registro segmentado persistido y
el detalle antes de la recarga. Su última lectura de `body` ocurría inmediatamente tras
`driver.refresh()`, y podía observar el shell React sin hidratar. Ahora espera que la próxima
acción editada sea visible en el detalle antes de mantener la misma aserción de texto.

## Pruebas ejecutadas

- `npm.cmd run test --workspace=@analiza/web -- hospitalization-periods.test.ts` — 3/3.
- `& $env:ANALIZA_PYTHON -m py_compile tests/selenium/test_hospitalizations.py` — aprobado.

## Entrega pendiente de verificación del owner

El worker no inició navegador porque su capacidad es `NOT_REQUIRED_NOT_CERTIFIED`. Reejecutar el
gate Selenium focal proporcionado para E02 y conservar su log/traces actuales; debe pasar el
detalle recargado y la persistencia sin deshabilitar ninguna aserción.

No se modifica `docs/release/REQUIREMENTS_IMPLEMENTATION.json`: el registro no existe en este
checkout y no se pueden acreditar requisitos mediante la plantilla de INPUTS. Tampoco se reclaman
capturas reales nuevas; permanecen pendientes de la verificación de navegador del owner.
