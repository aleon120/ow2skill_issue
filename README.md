# OW2 Draft Advisor

Herramienta web para elegir héroes en Overwatch 2 según el mapa, analizar counters contra el equipo enemigo, ver sinergias con tu propio equipo, y sugerir el mejor héroe siguiente cuando ya elegiste el resto del equipo. Soporta dos modos de draft: **5vs5** (formación actual, 1 tanque / 2 daño / 2 soporte) y **6vs6** (formación clásica, 2 tanques / 2 daño / 2 soporte).

## Cómo correrlo

Requiere Docker y Docker Compose.

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend (API): http://localhost:4000/health

## Cómo funciona el motor de recomendación

Cada héroe tiene, en `backend/src/data/heroes.json`:
- `mapPreference`: tags de tipo de mapa donde rinde bien (ej: `open`, `chokepoints`, `flank_routes`, `long`, `close`, `high_ground`, `mixed`).
- `counters` / `counteredBy`: relaciones directas de counter conocidas.
- `synergizesWith`: héroes con los que combina bien.
- `archetype`: estilo de juego (dive, brawl, poke, zone) usado para detectar coherencia de composición.

El endpoint `POST /api/recommend` recibe `{ mapId, allyIds, enemyIds, mode }` y calcula, para cada héroe candidato:

1. **Puntaje de mapa**: coincidencia entre los tags del héroe y los tags del mapa elegido.
2. **Puntaje de counters**: bonifica si el héroe contrarresta a alguno del equipo enemigo, penaliza si es contrarrestado por ellos.
3. **Puntaje de sinergia**: bonifica si combina bien con los héroes ya elegidos en tu equipo, o si comparte arquetipo de juego (comps coherentes).

Cuando ya se llenaron todos los roles salvo uno (`allyIds.length === rosterSize(mode) - 1`, es decir 4/5 en 5v5 o 5/6 en 6v6), el backend detecta automáticamente el rol que falta según la composición del modo elegido y filtra las recomendaciones a solo ese rol: es la función de "mejor último héroe".

### Modo de draft (`mode: "5v5" | "6v6"`)

`GET /api/modes` devuelve, para cada modo, su composición de roles (`roleLimits`) y el tamaño total del plantel (`rosterSize`). Es la fuente única de verdad que usa tanto el motor de recomendación como el frontend (evita hardcodear "1 tanque" o "5 héroes" en dos lugares que se puedan desalinear).

| Modo | Tanque | Daño | Soporte | Plantel total |
|---|---|---|---|---|
| `5v5` | 1 | 2 | 2 | 5 |
| `6v6` | 2 | 2 | 2 | 6 |

`POST /api/recommend` y `POST /api/team-check` reciben `mode` en el body (default `"5v5"` si se omite, por compatibilidad) y validan que `allyIds`/`enemyIds` no superen el `rosterSize` de ese modo.

### Peso de los counters según el rol

No todos los matchups pesan igual. Un tanque se preocupa sobre todo del tanque rival, un dps del dps rival, y un soporte de tanque y dps rival por igual (y poco de otros soportes). **El peso tanque-vs-tanque además depende del modo**: en 6v6 hay dos tanques por equipo, así que la responsabilidad de pelear al tanque rival se reparte entre ambos y cada matchup individual pesa un poco menos (`1.5 → 1.3`). El resto de los pesos no cambia entre modos:

| Rol aliado | vs. tanque (5v5) | vs. tanque (6v6) | vs. dps | vs. soporte |
|---|---|---|---|---|
| Tanque | ×1.5 | ×1.3 | ×0.6 | ×0.5 |
| Dps | ×0.6 | ×0.6 | ×1.4 | ×0.7 |
| Soporte | ×1.0 | ×1.0 | ×1.0 | ×0.5 |

Además, cualquier héroe volador (dps o soporte, ej. Pharah, Echo, Jetpack Cat) recibe una penalización extra si el equipo enemigo tiene un dps hitscan o francotirador (ej. Widowmaker, Soldier: 76, Ashe), ya que queda muy expuesto en el aire.

### Sinergias entre tanques (6v6)

En 6v6 hay que elegir dos tanques que combinen entre sí, así que `heroes.json` incluye parejas de tanques curadas en `synergizesWith` (funciona con el mismo mecanismo que ya usaban dps/soporte, +3 puntos por sinergia declarada): por ejemplo Reinhardt + D.Va/Orisa/Winston/Roadhog/Hazard, Zarya + Doomfist/Winston/Mauga/Wrecking Ball/Sigma, Orisa + Junker Queen/Mauga/Domina, y Junker Queen + Roadhog. Esto se suma automáticamente cuando ambos tanques de esas parejas están en `allyIds`, sin lógica adicional en el motor — `synergyScore()` ya recorre todos los aliados sin importar el rol.

### Subtipos de tanque: triángulo de counters y combos de composición

Cada tanque tiene un `tankType` (`dive` / `brawl` / `poke`, ver detalle completo en [`HEROES_SCHEMA.md`](./HEROES_SCHEMA.md)). Además de los counters curados puntuales, hay una regla general por subtipo: **poke vence a brawl, brawl vence a dive, dive vence a poke**. Es un *fallback*: solo se aplica entre dos tanques que no tengan ya una relación de counter explícita declarada entre ellos — si la tienen, esa relación curada gana sola, sin diluirse ni sumarse con el triángulo.

Los tanques `dive` también reciben un bonus en mapas con el tag `high_ground` (aprovechan el desnivel para saltar/escapar), y cada subtipo tiene combos de composición que suman puntos de sinergia (`archetypeSynergyScore` en el breakdown):

- **Dive**: se beneficia de un dps flex de alta movilidad (ej. Tracer) o un soporte que cura a distancia (rango `long`, ej. Ana, Illari, Zenyatta, Wuyang).
- **Brawl**: se beneficia de un dps flex flanqueador o un soporte que da velocidad al equipo (ej. Lúcio).
- **Poke**: se beneficia de cualquier héroe, de cualquier rol, que juegue a distancia (rango mid o long) — el equipo entero se mueve a su ritmo.

### Balance de composición: dps hitscan/flex y soporte main/flex

Cada dps tiene un `dpsRole` (`hitscan` / `flex`) y cada soporte un `supportRole` (`main` / `flex`), también en [`HEROES_SCHEMA.md`](./HEROES_SCHEMA.md). Al elegir el 2do dps o el 2do soporte del equipo (`compositionScore` en el breakdown):

- **Dps**: mezclar hitscan + flex suma puntos; repetir el mismo rol resta, salvo doble hitscan en mapas con tag `long` (ahí se permite sin penalizar).
- **Soporte**: dos main support resta puntos (falta flexibilidad) — excepto si Zenyatta es uno de los dos, que está exento de la penalización.

`POST /api/team-check` además devuelve `compositionWarnings`: detecta estos mismos dos problemas ya en el equipo elegido (no solo mientras se está por elegir el 2do) y sugiere hasta 4 alternativas del tipo complementario.

### Sugerencia de cambios (`POST /api/team-check`)

Recibe `{ mapId, allyIds, enemyIds, mode }` y devuelve, por cada héroe ya elegido en tu equipo, su puntaje de matchup contra el enemigo (usando los pesos de la tabla de arriba según el `mode`), un estado (`risk` / `ok` / `strong`) y, si está en riesgo, hasta 2 alternativas del mismo rol que mejoran ese matchup específico — más el array `compositionWarnings` explicado arriba. Esto es lo que se muestra en el panel "Sugerencia de cambios" del frontend.

### Preferencias de estilo de juego (`GET /api/playstyles`)

Cada héroe tiene un campo `playstyle` (ej: tanque `aggressive`/`defensive`, dps `hitscan`/`flanker`/`sniper`/`projectile`/`zone`, soporte `healer`/`hybrid`/`enabler`). En el panel "Tu estilo de juego" del frontend podés marcar, por rol, qué estilo preferís. Esto **no es una simple bonificación**: es un filtro duro — si marcás "Flanqueador" en daño, un héroe como Widowmaker (francotirador) queda directamente descartado de las recomendaciones y de las sugerencias de cambio, aunque puntúe bien por otros motivos. Sin ninguna preferencia marcada, no se filtra nada. Este filtro es el mismo en ambos modos.

### Meta actual (tier list)

El campo `metaWeight` de cada héroe sale de una tier list de 5 escalones (S / A+ / A / B / C → `+3` / `+1.5` / `0` / `-1.5` / `-3` puntos en `metaScore()`). Está cargada a mano en `heroes.json` con el campo `metaTier` como referencia legible y es la misma para 5v5 y 6v6 (no hay tier list separada por modo hoy). Si el meta cambia, lo más simple es pasarme la lista S/A+/A/B/C completa (los 53 héroes, tier por tier) para recalibrar todo de una — ver el detalle exacto en [`HEROES_SCHEMA.md`](./HEROES_SCHEMA.md).

### Rango de combate

Tanto los héroes como los mapas tienen un campo `range` (subconjunto de `close`/`mid`/`long`). Muchos héroes rinden bien en más de un rango (ej. Ana en `mid` y `long`), y eso los hace más adaptables: `rangeScore()` suma puntos por cada rango que el héroe comparte con el mapa elegido, así que un héroe versátil en 2-3 rangos tiene más chances de encajar bien en cualquier mapa que uno de rango único (ej. Widowmaker, solo `long`).

### Movilidad contextual

La `mobility` (1-5) de cada héroe entra al cálculo solo cuando importa: si el equipo enemigo tiene algún héroe muy móvil (`mobility >= 4` — dive, flanqueo, tanque agresivo, ej. D.Va, Genji, Tracer), los candidatos que **no** contrarrestan directamente a esa amenaza reciben un bonus proporcional a su propia movilidad (para poder perseguir, escapar o reposicionarse). Si el candidato ya es un counter directo de esa amenaza, no se suma este bonus extra (para no duplicar lo que ya premia el counter).

## Documentación técnica de `heroes.json`

Si vas a editar el dataset de héroes a mano, mirá **[`HEROES_SCHEMA.md`](./HEROES_SCHEMA.md)**: ahí está explicado campo por campo (qué significa cada palabra, qué vocabulario acepta, y en qué parte del motor de recomendación se usa cada uno).

## Imágenes de héroes y mapas

Los selectores de héroe y mapa ahora muestran solo la imagen (sin nombre visible; el nombre queda como tooltip al pasar el mouse). Las imágenes van en:

- `frontend/public/heroes/<id>.png` — un archivo por héroe.
- `frontend/public/maps/<id>.png` — un archivo por mapa.

El `<id>` tiene que ser exactamente el `id` de `heroes.json` / `maps.json` (ej: `dva.png`, `junker_queen.png`, `circuit_royal.png`). Dentro de cada carpeta hay un `LEEME.md` generado directamente desde los datos actuales, con la tabla completa de qué nombre de archivo espera cada héroe/mapa — así no hay que adivinar ni arriesgarse a un typo. **La pestaña 6vs6 reutiliza exactamente el mismo set de imágenes que 5vs5** (mismo componente `ImageTile`, mismo `frontend/public/heroes/<id>.png`): no hace falta subir fotos nuevas.

No hace falta subir todas las imágenes de una: si un héroe o mapa todavía no tiene `.png`, el tile muestra automáticamente sus iniciales en vez de un ícono roto. Basta con dejar caer el archivo en la carpeta correspondiente (con Vite en modo `dev`, el navegador lo recoge sin reiniciar nada).

Formato sugerido: `.png` cuadrado, 256×256px o más (se recorta a cuadrado automáticamente en la interfaz).

## Estructura

```
ow2-advisor/
├── backend/          # API Express (Node)
│   └── src/
│       ├── data/      # heroes.json, maps.json
│       ├── logic/     # recommend.js (motor de puntaje, con soporte 5v5/6v6)
│       ├── routes/    # api.js
│       └── index.js
├── frontend/         # React + Vite
│   └── src/
│       ├── api/       # cliente fetch al backend
│       ├── components/
│       └── pages/
│           ├── DraftPage.jsx      # lógica compartida de draft, parametrizada por `mode`
│           ├── CalculatorPage.jsx # wrapper: <DraftPage mode="5v5" />  (pestaña "5vs5")
│           ├── SixVSixPage.jsx    # wrapper: <DraftPage mode="6v6" />  (pestaña "6vs6")
│           ├── StadiumPage.jsx    # placeholder
│           └── PersonajesPage.jsx # placeholder
└── docker-compose.yml
```

## Nota importante sobre los datos

El roster de héroes, los mapas y las relaciones de counter/sinergia fueron armados a partir de conocimiento general del juego (no de una fuente en vivo), pensado como punto de partida editable. Si Overwatch 2 recibe nuevos héroes, mapas o rebalanceos, hay que actualizar `backend/src/data/heroes.json` y `maps.json` a mano — no se consulta ninguna API externa de Blizzard.

