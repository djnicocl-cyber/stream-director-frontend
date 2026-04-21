# Stream Director - Frontend

Aplicacion web para dirigir streams en vivo desde moviles. El operador selecciona que participante se proyecta en pantalla en tiempo real usando LiveKit.

## Arquitectura

- **`/operator/[roomId]`** - Panel del operador: ve todos los streamers conectados y elige cual se proyecta
- - **`/join/[roomId]`** - Pagina para que los asistentes se unan con su camara (mobile-friendly)
  - - **`/screen/[roomId]`** - Pantalla de proyeccion: muestra el video del participante seleccionado
   
    - ## Stack
   
    - - [Next.js 14](https://nextjs.org/) (Pages Router)
      - - [LiveKit Client SDK](https://docs.livekit.io/client-sdk-js/)
        - - Deploy: [Vercel](https://vercel.com)
         
          - ## Setup local
         
          - ```bash
            # 1. Instalar dependencias
            npm install

            # 2. Configurar variables de entorno
            cp .env.example .env.local
            # Editar .env.local con tus valores

            # 3. Iniciar servidor de desarrollo
            npm run dev
            ```

            ## Variables de entorno

            | Variable | Descripcion | Ejemplo |
            |---|---|---|
            | `NEXT_PUBLIC_BACKEND_URL` | URL del backend API | `https://tu-backend.up.railway.app` |
            | `NEXT_PUBLIC_LIVEKIT_URL` | URL del servidor LiveKit (wss://) | `wss://tu-proyecto.livekit.cloud` |

            > Ver `.env.example` para mas detalles.
            >
            > ## Deploy en Vercel
            >
            > 1. Conectar el repositorio en [vercel.com](https://vercel.com)
            > 2. 2. Agregar las variables de entorno en **Settings > Environment Variables**:
            >    3.    - `NEXT_PUBLIC_BACKEND_URL`
            >          -    - `NEXT_PUBLIC_LIVEKIT_URL`
            >               - 3. Deploy automatico en cada push a `main`
            >                
            >                 4. ## Flujo de uso
            >                
            >                 5. 1. El operador entra a `/operator/[roomId]` y crea/abre una sala
            >                    2. 2. Los asistentes escanean el QR o entran a `/join/[roomId]` desde su movil
            >                       3. 3. El operador selecciona que participante se proyecta
            >                          4. 4. La pantalla en `/screen/[roomId]` muestra el video en tiempo real
