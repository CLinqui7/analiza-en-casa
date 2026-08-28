# Remediación GitGuardian

GitGuardian señaló un `Generic Password` histórico en `app/store.js`. Era la contraseña sintética del modo demo, no una credencial de paciente, proveedor ni entorno productivo.

La contraseña en texto plano se eliminó del código de aplicación. El modo demo conserva el acceso sólo mediante comparación de un hash SHA-256 local, limitado al adaptador `mock`; los entornos Supabase siguen usando su autenticación remota. No se añadieron credenciales reales.

El incidente puede continuar apareciendo mientras GitGuardian revise commits históricos. No se reescribió el historial, no se eliminaron commits ni se realizó force-push. Cualquier hallazgo nuevo en esta rama debe investigarse antes de fusionar.
