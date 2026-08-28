# Respaldo temporal del demo heredado

El demo previo a React sigue íntegro en la raíz durante la migración para que sus
pruebas y evidencia de paridad permanezcan reproducibles. Se ejecuta con
`npm run start:legacy`; sus pruebas de navegador conservan la configuración raíz
de Playwright. No se carga desde la aplicación React, no usa iframe y no forma
parte de su árbol de ejecución.

Cuando los flujos hayan alcanzado paridad verificable, estos archivos se moverán
como una unidad a este directorio y las rutas de QA se actualizarán juntas.
