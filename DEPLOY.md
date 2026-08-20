# Cómo desplegar OW2 Draft Advisor a producción (Render)

Guía paso a paso. La app no tiene base de datos ni estado, así que el despliegue es simple:
el **backend** (API Express) se corre en un contenedor Docker, y el **frontend** (React/Vite)
se sirve como archivos estáticos (build de producción, no el servidor de desarrollo de Vite).

## 0. Qué se preparó ya en el repo

- `frontend/src/api/client.js`: ahora usa `VITE_API_URL` (si existe) en vez de asumir siempre `/api`.
  Esto es necesario porque en producción el frontend y el backend viven en dominios distintos
  (no hay proxy de Vite dev-server que reescriba `/api` como en local).
- `render.yaml`: blueprint que define los dos servicios (backend Docker + frontend static site)
  para que Render los cree juntos con un click.

## 1. Subir el proyecto a GitHub

Render despliega desde un repo de Git. Si el proyecto todavía no es un repo:

```bash
git init
git add .
git commit -m "Initial commit"
```

Creá un repo vacío en GitHub (desde la web, tu cuenta) y luego:

```bash
git remote add origin https://github.com/<tu-usuario>/ow2-advisor.git
git branch -M main
git push -u origin main
```

## 2. Crear cuenta en Render y conectar el repo

1. Entrá a https://render.com y creá una cuenta (podés usar tu cuenta de GitHub para loguearte).
2. En el dashboard: **New +** → **Blueprint**.
3. Elegí el repo `ow2-advisor` que acabás de subir. Render va a detectar automáticamente
   el archivo `render.yaml` y proponerte los dos servicios (`ow2-advisor-backend` y
   `ow2-advisor-frontend`).
4. Confirmá la creación. El primer deploy va a tardar unos minutos.

## 3. Verificar el backend

Cuando termine el deploy del backend, Render le asigna una URL pública, algo como:

```
https://ow2-advisor-backend.onrender.com
```

Verificá que responde entrando a `https://ow2-advisor-backend.onrender.com/health` — debería
devolver `{"status":"ok"}`.

## 4. Apuntar el frontend al backend real

El `render.yaml` trae un valor de ejemplo para `VITE_API_URL`. Reemplazalo por la URL real:

1. En el dashboard de Render, entrá al servicio `ow2-advisor-frontend`.
2. Andá a **Environment**.
3. Editá `VITE_API_URL` con el valor `https://ow2-advisor-backend.onrender.com/api`
   (con la URL real del paso 3, terminada en `/api`).
4. Guardá — esto dispara un rebuild del frontend (el valor se usa en build-time, no en runtime,
   por eso hace falta rebuildear).

## 5. Listo

Entrá a la URL pública del `ow2-advisor-frontend` (algo como
`https://ow2-advisor-frontend.onrender.com`) y probá el draft completo.

## Notas

- **Plan free de Render**: los servicios free "duermen" tras ~15 min sin tráfico y tardan unos
  segundos en despertar en el próximo request. Normal para un proyecto hobby; si molesta, se
  puede pasar a un plan pago más adelante.
- **`WEB_CONCURRENCY=1`**: el backend usa `cluster` para repartir carga entre varios procesos
  (ver la sección de rendimiento más abajo). En un contenedor compartido como el plan free,
  `os.cpus()` reporta los núcleos del host físico, no la porción real que te tocó — levantar
  muchos workers ahí no ayuda (no hay CPU real detrás) y solo gasta memoria. Por eso
  `render.yaml` fija `WEB_CONCURRENCY=1`. Si más adelante pasás a un plan con CPU dedicada y
  el tráfico crece, subir este número.
- **CORS**: el backend usa `cors()` sin restricciones (acepta requests de cualquier origen).
  Es razonable para este proyecto (sin datos sensibles ni auth), pero si en algún momento querés
  restringirlo al dominio del frontend, es un cambio de una línea en `backend/src/index.js`.
- Cambios futuros: cada `git push` a `main` dispara un redeploy automático en Render.
