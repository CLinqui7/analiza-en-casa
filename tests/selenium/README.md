# Suite Selenium con Chrome

`smoke.py` ejecuta flujos WebDriver sin autenticación contra la app React local:
acordeón y ruta clínica, rechazo de documento duplicado y ayuda sin un contacto de
WhatsApp inventado. Inicia Next sólo si `http://127.0.0.1:4174` no está disponible.

Instalación local: `py -m pip install --user -r tests/selenium/requirements.txt`.
Ejecución: `npm run test:selenium`. Selenium Manager resuelve ChromeDriver compatible
con el Chrome instalado; no hay credenciales ni datos clínicos en la suite.
