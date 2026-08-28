# QA local temporal

GitHub Actions está deshabilitado temporalmente para este repositorio: el workflow se conserva en `ci.github-actions.disabled.yml`, fuera de `.github/workflows/`, para evitar ejecuciones sin runner confiable y notificaciones de ruido.

El gate canónico mientras dure esta medida es:

```sh
npm run qa:local
```

Incluye el preflight de repositorio, las pruebas unitarias, las comprobaciones de QA, el build autónomo y la verificación del ledger de video. Las pruebas de navegador y Selenium se ejecutarán explícitamente en sus gates de regresión correspondientes.

Para reactivar CI, devolver el archivo guardado a `.github/workflows/ci.yml`, revisar la disponibilidad del runner y confirmar que el comando anterior sigue verde localmente. No se debe crear un workflow alternativo hasta entonces.
