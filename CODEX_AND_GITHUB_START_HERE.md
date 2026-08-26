# Ejecutar, subir a GitHub y delegar a Codex

## 1. Ejecutar localmente en Windows

Desde la carpeta raíz:

```powershell
npm install
npm run check
npm start
```

Abre `http://localhost:4173`.

También puedes abrir `Analiza_en_Casa_Demo_QA.html` con doble clic, pero Codex y las pruebas deben trabajar sobre el repositorio completo.

## 2. Subir a GitHub en un solo proceso

El repositorio debe ser **privado** porque contiene material operativo de referencia, aunque los datos sean sintéticos.

Instala una sola vez:

```powershell
winget install --id Git.Git -e
winget install --id GitHub.cli -e
winget install --id OpenJS.NodeJS.LTS -e
```

Después ejecuta:

```text
UPLOAD_TO_GITHUB.bat
```

El script:

1. revisa herramientas, secretos y archivos demasiado grandes;
2. ejecuta las pruebas;
3. inicia Git;
4. crea el commit inicial;
5. inicia sesión en GitHub si hace falta;
6. crea un repositorio privado;
7. agrega `origin` y hace `push` de `main`.

El primer push puede tardar porque el repositorio incluye la evidencia visual completa de los 17 capítulos.

## 3. Conectar el repositorio a Codex cloud

1. Abre Codex.
2. Conecta GitHub y autoriza el repositorio recién creado.
3. Crea un entorno para ese repositorio.
4. Usa este setup script:

```bash
set -euxo pipefail
node --version
python3 --version
npm ci
npm run codex:preflight
```

5. No agregues claves reales de Supabase, Vercel, WhatsApp, SMS ni correo durante la auditoría nocturna.
6. Selecciona la rama `main` como base.
7. Pega el contenido completo de `codex/PROMPT_OVERNIGHT_MASTER.md`.
8. Permite que la tarea continúe en segundo plano.

## 4. Qué debe producir Codex

Codex trabajará en `codex/overnight-audit-hardening`, no en `main`, y deberá:

- auditar los 17 capítulos;
- completar todos los ledgers de eventos;
- construir la matriz video vs. plataforma;
- corregir P0 no bloqueados;
- probar la aplicación;
- volver a revisar los 17 capítulos;
- mejorar UX, accesibilidad, rendimiento y seguridad;
- abrir un pull request sin fusionarlo.

## 5. Revisión por la mañana

1. Abre el PR.
2. Confirma que CI esté verde.
3. Comenta `@codex review` si Code Review está habilitado.
4. En Codex también puedes usar `/review` contra `main`.
5. No hagas merge mientras `docs/overnight/FINAL_REPORT.md` reporte P0 abiertos o capítulos sin verificación.

## 6. Opción recomendada de un solo clic

Después de extraer completamente el ZIP, ejecuta:

```text
TODO_EN_UNO_GITHUB_Y_CODEX.bat
```

El script muestra la cuenta de GitHub activa para evitar subir el proyecto con credenciales antiguas, ejecuta todos los preflights, crea un repositorio privado, hace push de `main`, copia el prompt de inicio y abre GitHub y Codex.

## 7. Si Codex se detiene por límite, tiempo o interrupción

Ejecuta `CONTINUAR_CODEX.bat`, abre la misma rama o tarea y pega el prompt copiado. Codex deberá reanudar desde `docs/overnight/PROGRESS.md` sin repetir los capítulos ya verificados.

## 8. Verificación de la mañana

Ejecuta `REVISAR_POR_LA_MANANA.bat` y revisa `docs/overnight/MORNING_CHECKLIST.md`. Un resultado verde no sustituye la revisión del PR ni la validación funcional humana.
