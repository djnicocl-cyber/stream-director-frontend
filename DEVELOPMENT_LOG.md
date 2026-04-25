# DEVELOPMENT LOG — Stream Director

> Historial completo de desarrollo del proyecto Stream Director.  
> Última actualización: Abril 2026

---

## Stack Tecnológico

| Componente | Tecnología | URL |
|-----------|-----------|-----|
| Frontend | HTML/CSS/JS + Vercel | https://stream-director-frontend.vercel.app |
| Backend | Node.js + Express + Railway | https://stream-director-backend-v2-production.up.railway.app |
| WebRTC | LiveKit | wss://stream-director-13gpu9p5.livekit.cloud |
| Storage | Upstash Redis | — |
| Repos | GitHub (djnicocl-cyber) | — |

---

## Repositorios

- **Frontend:** https://github.com/djnicocl-cyber/stream-director-frontend
- **Backend:** https://github.com/djnicocl-cyber/stream-director-backend-v2

---

## Archivos Clave

| Archivo | Descripción |
|---------|-------------|
| `public/operator.html` | Panel del operador (contraseña + control de streamers) |
| `public/streamer.html` | Vista del streamer (cámara + micrófono) |
| `public/screen.html` | Vista pantalla/proyección del streamer seleccionado |
| `public/goodbye-bg.jpg` | Imagen de fondo pantalla de despedida |
| `index.js` (backend) | Servidor Express con endpoints LiveKit + Redis |

---

## Respaldos

| Repo | Rama | Tag/Release |
|------|------|-------------|
| Frontend | `backup/stable-v1` | `v1.0-stable` |
| Backend | `backup/stable-v1` | `v1.0-stable` |

---

## Variables de Entorno (Railway — Backend)

| Variable | Descripción |
|----------|-------------|
| `LIVEKIT_API_KEY` | API Key de LiveKit |
| `LIVEKIT_API_SECRET` | API Secret de LiveKit |
| `LIVEKIT_HOST` | Host LiveKit (wss://...) |
| `REDIS_URL` | URL de conexión Upstash Redis |
| `PORT` | Puerto del servidor |
| `OPERATOR_PASSWORD_HASH` | Hash SHA-256 de la contraseña del operador |

> Para cambiar la contraseña del operador:
> 1. Ve a https://emn178.github.io/online-tools/sha256.html
> 2. Escribe la nueva contraseña y copia el hash SHA-256
> 3. En Railway → Variables → actualiza `OPERATOR_PASSWORD_HASH`

---

## Historial de Cambios

### Fix: SyntaxError en screen.html
- **Problema:** La pantalla no iniciaba (`missing ) after argument list` línea 84)
- **Causa:** `}` extra en el callback `TrackSubscribed` cerraba prematuramente la función
- **Fix:** Eliminación de la llave extra en posición 6144
- **Commit:** `fix(screen): corregir llave extra en TrackSubscribed que causaba SyntaxError`

---

### Feature: Campo sala readonly en streamer
- **Motivo:** Evitar que el streamer modifique el ID de sala y no pueda conectarse
- **Fix:** Atributo `readonly` + `cursor:not-allowed` en el input de roomId
- **Commit:** `fix(streamer): bloquear campo ID de sala como solo lectura para evitar errores`

---

### Feature: Botón Cerrar Sesión del operador
- **Descripción:** Botón rojo "⏹ Cerrar Sesión" en el panel del operador que notifica a todos los streamers que el servicio finalizó
- **Flujo:** Operador cierra → backend marca sala como `closed` en Redis → streamers hacen polling → al detectar `closed` muestran pantalla de despedida
- **Archivos modificados:** `operator.html`, `streamer.html`, `index.js` (backend)
- **Endpoint nuevo:** `POST /api/rooms/:roomId/close`
- **Commits:**
  - `feat(operator): agregar boton Cerrar Sesion y funcion closeSession`
  - `feat(backend): agregar endpoint POST /close y flag closed en sala`
  - `feat(streamer): mostrar pantalla de despedida cuando operador cierra sesion`

---

### Feature: Pantalla de despedida personalizada
- **Descripción:** Pantalla fullscreen que aparece en el dispositivo del streamer al cerrar sesión el operador
- **Contenido:** Imagen de fondo `goodbye-bg.jpg`, texto "GRACIAS POR CONECTARTE", marca "VIVOSTREAM.CL"
- **Archivo:** `public/goodbye-bg.jpg` (imagen morada/azul con íconos de streaming)
- **HTML de referencia:**
```html
<div id="goodbyeScreen" style="display:none; background:url('goodbye-bg.jpg') center center/cover no-repeat; ...">
  <div style="font-size:64px">📡</div>
  <h1 style="font-size:48px; font-weight:900; color:#fff">GRACIAS POR CONECTARTE</h1>
  <p style="font-size:18px; color:#aaa">La transmisión ha finalizado</p>
  <p style="font-size:13px; color:#555">Servicio creado por</p>
  <p style="font-size:22px; font-weight:700; color:#e74c3c">VIVOSTREAM.CL</p>
</div>
```
- **Commits:**
  - `feat(streamer): subir imagen goodbye-bg.jpg como fondo pantalla despedida`
  - `feat(streamer): usar imagen personalizada como fondo pantalla de despedida`

---

### Optimización: Bitrate adaptativo
- **Motivo:** Mejorar estabilidad en conexiones con ancho de banda limitado
- **Cambios:**
  - `adaptiveStream: true` — ajusta calidad según ancho de banda disponible
  - `dynacast: true` — publica solo las capas de video necesarias
  - Resolución limitada a 640x360, 24fps, máximo 600kbps
- **Archivo:** `streamer.html`
- **Commit:** `feat(streamer): adaptiveStream, dynacast y limite de bitrate para conexiones inestables`

---

### Optimización: Reducción de polling Redis
- **Motivo:** El plan gratuito de Upstash Redis tiene límite de 500K comandos/mes. Con polling cada 1-2 segundos se agotaba rápidamente.
- **Cambios:**
  - `streamer.html`: polling 1500ms → 5000ms
  - `screen.html`: polling 1000ms → 5000ms
  - `index.js` (backend): limpieza automática de la sala en Redis 30 segundos después del cierre
- **Commits:**
  - `perf(streamer): reducir polling de 1500ms a 5000ms para ahorrar comandos Redis`
  - `perf(screen): reducir polling de 1000ms a 5000ms para ahorrar comandos Redis`
  - `perf(backend): limpiar sala de Redis 30s despues de cerrar sesion`

---

### Feature: Autenticación con contraseña para el operador
- **Motivo:** Proteger el panel del operador de accesos no autorizados
- **Arquitectura de seguridad:**
  - La contraseña **nunca se almacena en el código fuente**
  - El frontend envía la contraseña al backend vía POST
  - El backend computa SHA-256 y compara con `OPERATOR_PASSWORD_HASH` usando `timingSafeEqual` (previene timing attacks)
  - Si es correcta, se muestra el panel de conexión
- **Archivos modificados:** `operator.html`, `index.js` (backend)
- **Endpoint nuevo:** `POST /api/auth/operator`
- **Contraseña actual:** configurada en Railway como `OPERATOR_PASSWORD_HASH`
- **Commits:**
  - `feat(operator): agregar pantalla de contrasena para proteger acceso al panel`
  - `feat(backend): auth endpoint con SHA-256 y timingSafeEqual para contraseña operador`
  - `feat(operator): validar contrasena contra backend en lugar de cliente`

---

## Límites de las Plataformas Gratuitas

| Plataforma | Límite relevante |
|-----------|-----------------|
| LiveKit Cloud | 100 GB transferencia/mes |
| Vercel Hobby | 100 GB transferencia/mes (solo uso no comercial) |
| Railway Trial | $4.93 USD crédito restante (Trial) |
| Upstash Redis Free | 500K comandos/mes, 256 MB storage |

> ⚠️ Railway está en plan Trial. Considerar upgrade para uso en producción continua.

---

## Identidad de Participantes LiveKit

- **Streamers:** `streamer_NOMBRE_timestamp` (ej: `streamer_Juan_1714012345678`)
- **Operador:** se conecta como observador sin publicar video/audio

---

## Notas de Arquitectura

- El operador **no se une a la sala LiveKit** como participante activo, solo observa el estado vía polling Redis
- La selección de streamer se guarda en Redis con la clave `room:{roomId}:selected`
- El flag de cierre se guarda en Redis con la clave `room:{roomId}:closed`
- Ambas claves se eliminan automáticamente 30 segundos después del cierre de sesión
- El intervalo de polling está en **5000ms** para optimizar el uso de Redis Free Tier
