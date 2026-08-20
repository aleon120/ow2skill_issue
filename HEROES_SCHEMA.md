# Esquema técnico de `heroes.json`

Este documento explica, campo por campo, qué significa cada palabra dentro de
`backend/src/data/heroes.json`, para que puedas editar, corregir o agregar
héroes sin romper el motor de recomendación (`backend/src/logic/recommend.js`).

El archivo es un array de objetos. Cada objeto es un héroe. Ejemplo completo real:

```json
{
  "id": "dva",
  "name": "D.Va",
  "role": "tank",
  "archetype": ["dive", "brawl"],
  "range": ["close", "mid"],
  "mobility": 5,
  "tags": ["anti-dive-defuser", "flying-target", "mobile", "protects-backline"],
  "counters": ["pharah", "echo", "widowmaker", "hanzo"],
  "counteredBy": ["zarya", "reaper", "junkrat"],
  "synergizesWith": ["orisa", "lucio", "zenyatta"],
  "mapPreference": ["open", "flank_routes"],
  "metaWeight": 1.3,
  "metaTier": "S",
  "playstyle": "aggressive"
}
```

---

## Campos obligatorios

### `id` (string, único)

Identificador interno del héroe. **No se muestra al usuario.** Se usa para:
- Referenciarlo desde `counters`, `counteredBy`, `synergizesWith` de otros héroes.
- Referenciarlo desde el frontend (`allyIds`, `enemyIds` que viajan a la API).

Reglas:
- Minúsculas, sin espacios, separado por `_` si tiene más de una palabra (ej: `wrecking_ball`, `junker_queen`, `jetpack_cat`).
- Debe ser único en todo el archivo.
- Si le cambiás el `id` a un héroe existente, tenés que actualizar **todas** las referencias a ese id en el campo `counters`/`counteredBy`/`synergizesWith` de los demás héroes, o esa relación queda rota silenciosamente (deja de aplicar, pero no tira error).

### `name` (string)

Nombre visible en la interfaz (el que ve el usuario en los botones, tablas, etc.). Puede tener tildes, mayúsculas, símbolos (`Soldier: 76`, `Lúcio`).

### `role` (string, uno de: `"tank"`, `"dps"`, `"support"`)

El rol del héroe en el juego. Define:
- En qué columna aparece en los selectores del frontend.
- Contra qué límite de composición se lo cuenta (`ROLE_LIMITS_BY_MODE` en `recommend.js`: 1-2-2 en modo `5v5`, 2-2-2 en modo `6v6`).
- Qué fila de `ROLE_MATCHUP_WEIGHT` se usa para pesar sus counters (ver más abajo).
- Contra qué vocabulario de `playstyle` se valida (ver campo `playstyle`).

### `archetype` (array de strings)

El o los **estilos de combate** del héroe. Vocabulario usado actualmente:
`"dive"` (buscar flancos/aislar), `"brawl"` (pelea cuerpo a cuerpo sostenida),
`"poke"` (daño a distancia, hostigar antes de comprometerse), `"zone"` (control
de área/denegación de espacio).

Un héroe puede tener 1 o 2. Se usa en:
- `synergyScore()`: si dos héroes comparten un arquetipo, suman puntos de sinergia por "comp coherente" (ej: dos héroes `dive` combinan bien).
- El chequeo de `anti-dive` en `counterScore()`: si el enemigo tiene el tag `"anti-dive"` y el héroe tiene `"dive"` en su `archetype`, recibe una pequeña penalización.

Este campo **no** es lo mismo que `playstyle` (ver más abajo) — `archetype` es más genérico y alimenta la lógica de sinergia; `playstyle` es la clasificación específica que ve y elige el usuario en el panel de preferencias.

### `range` (array de strings, subconjunto de `"close"`, `"mid"`, `"long"`)

Rango(s) de combate en los que el héroe rinde bien. **Ahora es un array**, no un solo valor: hay héroes que solo sirven en un rango (ej. Widowmaker → `["long"]`, Reinhardt → `["close"]`), y héroes versátiles que se adaptan a dos o incluso los tres (ej. Ana → `["mid", "long"]`, Zarya → `["close", "mid"]`).

Se usa en `rangeScore()`: por cada rango que el héroe comparte con el `range` del mapa elegido, suma **1.3 puntos**. Un héroe versátil en 2-3 rangos tiene naturalmente más chances de coincidir con el mapa que uno de un solo rango — eso es intencional, refleja que se adapta mejor a distintas situaciones dentro del mismo mapa.

### `mobility` (número, 1 a 5)

Qué tan móvil es el héroe (1 = casi estático como Torbjörn/Symmetra, 5 = movilidad total como Tracer/Genji/D.Va).

Se usa en dos lugares:
1. **`mobilityScore()`**: si el equipo **enemigo** tiene algún héroe con `mobility >= 4` (una "amenaza móvil": dive, flanqueo, tanque agresivo), el héroe candidato suma `mobility × 0.6` puntos — **salvo que ese candidato ya sea un counter directo** de esa amenaza específica (está en su `counters`, o la amenaza lo tiene en su `counteredBy`), en cuyo caso no se suma nada extra para no duplicar el bonus que ya da `counterScore()`. Ejemplo: si el rival juega D.Va, Cassidy (que la contrarresta directamente) no recibe este bonus, pero Genji o Sombra (que no tienen a D.Va en su lista de counters) sí, proporcional a su propia movilidad.
2. Es informativo también fuera de eso (no tiene otro efecto en el motor hoy).

### `tags` (array de strings, vocabulario libre pero con algunos valores especiales)

Etiquetas descriptivas cortas del kit del héroe. La mayoría son solo documentación/color (ej: `"self-heal"`, `"burst"`, `"stealth"`), pero **tres valores tienen efecto real en el motor** y hay que respetarlos si los usás:

| Tag especial | Efecto en `counterScore()` |
|---|---|
| `"flying"` | Marca al héroe como volador. Si el enemigo tiene un dps con tag `"hitscan"` o `"sniper"`, este héroe recibe **-3 puntos** de penalización posicional (queda expuesto en el aire). Hoy solo lo tienen Pharah, Echo y Jetpack Cat. |
| `"anti-flyer"` | Si el héroe tiene este tag y el enemigo tiene el tag `"flying"`, suma un bonus de counter (siempre que no haya ya un counter directo registrado). Lo tienen Winston, Soldier: 76 y Widowmaker. |
| `"anti-dive"` | Si el enemigo tiene este tag y el héroe tiene `"dive"` en su `archetype`, resta una pequeña penalización (siempre que no haya ya un counter directo). Lo tiene, por ejemplo, Ana. |
| `"hitscan"` / `"sniper"` | Se usan junto con `"flying"` de arriba: si un dps enemigo tiene cualquiera de estos dos tags, penaliza a los voladores propios. |

El resto de los tags (`"burst"`, `"mobile"`, `"self-heal"`, etc.) son libres — agregalos para documentar el kit, no rompen nada, pero tampoco hacen nada por sí solos a menos que en el futuro se agregue una regla que los lea.

### `counters` (array de `id`s)

Lista de `id`s de héroes a los que **este héroe le gana** en un 1-a-1 típico (ej: Winston `counters` a Widowmaker porque la puede saltar y matar antes de que dispare). Es la mitad "ofensiva" de la relación.

Se usa en `counterScore()`: si el héroe tiene a un enemigo del draft actual en su `counters`, o si ese enemigo lo tiene a él en su `counteredBy`, suma **+5 puntos** (antes de aplicar el peso por rol, ver `ROLE_MATCHUP_WEIGHT` más abajo).

⚠️ No hace falta declarar la relación en los dos sentidos a la vez — con que un héroe tenga al otro en `counters` (o el otro lo tenga en `counteredBy`), ya cuenta. Pero para que quede prolijo y fácil de leer, en este archivo se declaró en ambos lados cuando fue posible.

### `counteredBy` (array de `id`s)

Lo opuesto: lista de `id`s de héroes que **le ganan a este héroe**. Es la mitad "defensiva". Resta **-5 puntos** (antes del peso por rol) cuando el enemigo elegido está en esta lista.

### `synergizesWith` (array de `id`s)

Lista de `id`s de héroes con los que **este héroe combina bien** en el mismo equipo (ej: Zarya `synergizesWith` Mei, porque el hielo agrupa enemigos para la direccional de Zarya). Se usa en `synergyScore()`: si un aliado del draft actual está en esta lista (o él te tiene a vos en la suya), suma **+3 puntos**.

### `mapPreference` (array de strings, vocabulario cerrado)

Etiquetas de tipo de mapa donde el héroe rinde bien. **Tiene que usar exactamente estos valores** (son los mismos tags que usan los mapas en `maps.json`):

```
"open"           mapa abierto, mucho espacio
"close"          combate cerrado, distancias cortas
"mixed"          mezcla de distancias
"long"           líneas de visión largas
"chokepoints"    cuellos de botella / pasillos angostos
"flank_routes"   rutas de flanqueo marcadas
"high_ground"    terreno elevado relevante
```

Se usa en `mapScore()`: por cada tag que coincide entre `mapPreference` del héroe y `tags` del mapa elegido, suma **1.5 puntos**.

### `metaWeight` (número, uno de: `1.3`, `1.15`, `1.0`, `0.85`, `0.7`)

Qué tan fuerte es el héroe en el parche/tier list actual, **independiente del draft**. Se calibra directamente a partir de una tier list de 5 escalones (S / A+ / A / B / C), con esta correspondencia fija:

| Tier | `metaWeight` | Puntos que suma `metaScore()` |
|---|---|---|
| S | `1.3` | `+3` |
| A+ | `1.15` | `+1.5` |
| A | `1.0` | `0` |
| B | `0.85` | `-1.5` |
| C | `0.7` | `-3` |

Se usa en `metaScore()`, que lo convierte a puntos así: `(metaWeight - 1) * 10`. **Este es el campo que vas a querer revisar y actualizar más seguido**, porque el meta cambia con cada parche. No hay ninguna llamada a una API externa de Blizzard/Overwatch — es 100% el número que pongas acá.

Para recalibrar todos los héroes de una sola vez a partir de una tier list nueva, lo más simple es pasarme la lista S/A+/A/B/C (los 53 nombres, tier por tier) y yo aplico la tabla de arriba con un script — así evitamos errores de tipeo manuales en el JSON.

### `metaTier` (string, uno de: `"S"`, `"A+"`, `"A"`, `"B"`, `"C"`)

Campo informativo que guarda de qué escalón de la tier list salió el `metaWeight` actual. **No lo lee ninguna función del motor** — existe solo para que cuando abras el archivo sepas de un vistazo el tier de cada héroe sin tener que traducir el número de `metaWeight` mentalmente, y para que si actualizás la tier list en el futuro sea más fácil detectar qué cambió.

### `playstyle` (string, un solo valor, vocabulario cerrado **por rol**)

El estilo de juego específico del héroe, usado por el panel de preferencias del frontend para **filtrar (descartar) candidatos**, no solo puntuarlos. A diferencia de `archetype` (que puede tener varios valores y es más general), `playstyle` es un único valor por héroe y tiene un vocabulario distinto según el `role`:

| Si `role` es... | Valores válidos de `playstyle` | Significado |
|---|---|---|
| `"tank"` | `"aggressive"` | Tanque que se mete al frente, dive o brawl directo (D.Va, Doomfist, Winston, Reinhardt...) |
| | `"defensive"` | Tanque que pelea desde atrás/a distancia, poke o control de zona (Orisa, Sigma, Ramattra, Zarya, Domina) |
| `"dps"` | `"hitscan"` | Arma de impacto instantáneo (Ashe, Cassidy, Soldier: 76, Sojourn, Sierra, Shion, Emre) |
| | `"flanker"` | Busca flancos, aísla al equipo enemigo (Genji, Tracer, Sombra, Venture, Anran, Vendetta, Reaper, Echo) |
| | `"sniper"` | Francotirador puro (Widowmaker) |
| | `"projectile"` | Proyectil con arco/velocidad, no hitscan (Hanzo, Junkrat, Pharah, Freja) |
| | `"zone"` | Control de área / denegación de espacio (Mei, Bastion, Symmetra, Torbjörn) |
| `"support"` | `"healer"` | Sanación como prioridad principal del kit (Mercy, Baptiste, Illari, Lifeweaver, Juno, Wuyang) |
| | `"hybrid"` | Balance entre sanar y hacer daño (Ana, Moira, Mizuki, Zenyatta) |
| | `"enabler"` | Utilidad, peel, control de masas, movilidad de equipo por encima de la sanación bruta (Brigitte, Lúcio, Kiriko, Jetpack Cat) |

⚠️ **Importante:** si le ponés a un héroe un `playstyle` que no está en la lista de su `role` (ej: `"aggressive"` a un dps), el filtro del frontend simplemente nunca lo va a mostrar cuando alguien elija ese estilo — no tira error, pero el héroe "desaparece" de esa combinación. El endpoint `GET /api/playstyles` devuelve el vocabulario válido tal como lo lee el backend, es la fuente de verdad si tenés dudas.

Si un héroe te parece que debería poder aparecer en más de un estilo (ej. Reaper como "flanker" pero también un poco "brawler"), hoy el esquema solo permite **un valor por héroe**. Si querés soportar varios, avisame y adapto `matchesPreference()` en `recommend.js` para que acepte arrays en vez de un string.

### `tankType` (string, solo para `role: "tank"`, uno de: `"dive"`, `"brawl"`, `"poke"`)

Subtipo de tanque según su forma de jugar. Es un campo **nuevo y distinto de `archetype`** (que puede tener varios valores y es más laxo): `tankType` es un único valor curado a mano para los 3 sistemas que dependen de él:

| Subtipo | Significado | Héroes actuales |
|---|---|---|
| `"dive"` | Movilidad aérea/de asalto rápido, salta a la backline | D.Va, Doomfist, Hazard, Winston, Wrecking Ball |
| `"brawl"` | Movilidad terrestre, pelea sostenida junto al equipo | Reinhardt, Junker Queen, Mauga, Zarya, D.Mon |
| `"poke"` | Sin movilidad de asalto, control de zona a distancia | Domina, Roadhog, Sigma, Orisa, Ramattra |

> Ramattra no venía en la clasificación original pedida por el usuario — se asignó a `"poke"` por su kit (zone/control a distancia, sin dash/salto propio, `playstyle: "defensive"`). Corregir si no calza.

Se usa en tres lugares de `recommend.js`:
1. **`mapScore()`**: los tanques `"dive"` reciben `+2` extra en mapas con el tag `"high_ground"` (su movilidad les deja aprovechar el desnivel).
2. **`tankTypeScore()`** (dentro de `counterScore()`): triángulo de counters `poke > brawl > dive > poke`, ver la sección dedicada más abajo.
3. **`tankArchetypeSynergyScore()`**: bonus de composición según qué acompañe a cada subtipo (dps flex de alta movilidad o soporte de curación a distancia para dive; dps flex flanqueador o soporte con `"speed-boost"` para brawl; cualquier héroe con rango mid/long para poke), ver la sección dedicada más abajo.

### `dpsRole` (string, solo para `role: "dps"`, uno de: `"hitscan"`, `"flex"`)

Clasificación de composición del dps, **distinta del `playstyle`** (que tiene 5 valores: hitscan/flanker/sniper/projectile/zone) y de los tags técnicos `"hitscan"`/`"sniper"` (que solo afectan la penalización de voladores). `dpsRole` es binario y agrupa por función de equipo:

- `"hitscan"`: Shion, Ashe, Bastion, Cassidy, Emre, Freja, Hanzo, Sierra, Sojourn, Soldier: 76, Widowmaker.
- `"flex"`: Pharah, Echo, Tracer, Genji, Reaper, Junkrat, Sombra, Venture, Symmetra, Mei, Torbjörn, Vendetta, Anran.

Se usa en `dpsBalanceScore()`: ver la sección "Balance de composición dps/soporte" más abajo.

### `supportRole` (string, solo para `role: "support"`, uno de: `"main"`, `"flex"`)

Clasificación de composición del soporte:

- `"flex"`: Ana, Baptiste, Kiriko, Illari, Moira, Juno.
- `"main"`: Mercy, Lúcio, Zenyatta, Wuyang, Jetpack Cat, Mizuki, Lifeweaver, Brigitte.

Se usa en `supportBalanceScore()`: ver la sección "Balance de composición dps/soporte" más abajo.

---

## Resumen: qué campo usa cada parte del motor

| Campo | Usado en | Efecto |
|---|---|---|
| `mapPreference` | `mapScore()` | +1.5 por tag de mapa coincidente |
| `range` | `rangeScore()` | +1.3 por cada rango que comparte con el `range` del mapa |
| `counters` / `counteredBy` | `counterScore()` | ±5 por matchup directo, luego multiplicado por `ROLE_MATCHUP_WEIGHT[rol_héroe][rol_enemigo]` |
| `tags: flying/anti-flyer/anti-dive/hitscan/sniper` | `counterScore()` | bonus/penalización por tags (ver tabla de arriba) |
| `synergizesWith` / `archetype` | `synergyScore()` | +3 por sinergia declarada, +1 por arquetipo compartido |
| `tankType` | `mapScore()`, `tankTypeScore()`, `tankArchetypeSynergyScore()` | bonus de high_ground para dive, triángulo poke/brawl/dive, combos de composición por subtipo |
| `dpsRole` | `dpsBalanceScore()` | bonus si el 2do dps mezcla hitscan+flex, penalización si repite (salvo doble hitscan en mapas `"long"`) |
| `supportRole` | `supportBalanceScore()` | penalización si los dos soportes son `"main"` (Zenyatta exento) |
| `metaWeight` | `metaScore()` | ±10 puntos por cada 1.0 de diferencia respecto al neutral (ver tabla S/A+/A/B/C arriba) |
| `metaTier` | — | informativo, refleja de qué tier salió el `metaWeight` |
| `mobility` | `mobilityScore()` | si el rival tiene una amenaza móvil (mobility ≥ 4) que este héroe no contrarresta directamente, suma `mobility × 0.6` |
| `playstyle` | `matchesPreference()` | descarta (filtra) al héroe si no calza con la preferencia elegida por el usuario para ese rol |
| `role` | todo lo anterior | determina límites de composición, fila de pesos de matchup y vocabulario de `playstyle` |
| `id` / `name` | — | identidad del héroe, sin lógica de puntaje |

## Peso de los counters según el rol (`ROLE_MATCHUP_WEIGHT_BY_MODE`)

Este multiplicador vive en `recommend.js`, no en `heroes.json`, pero como afecta directamente cómo se leen `counters`/`counteredBy`, conviene tenerlo presente al calibrar relaciones. **Depende del modo de draft** (`"5v5"` o `"6v6"`, parámetro `mode` que reciben `/api/recommend` y `/api/team-check`): en 6v6 hay dos tanques por equipo, así que cada matchup individual tanque-vs-tanque pesa un poco menos que en 5v5 (la responsabilidad de pelear al tanque rival se reparte entre dos héroes en vez de uno solo). El resto de los pesos es igual en ambos modos.

| Rol del héroe | vs. tanque enemigo (5v5) | vs. tanque enemigo (6v6) | vs. dps enemigo | vs. soporte enemigo |
|---|---|---|---|---|
| `tank` | ×1.5 | ×1.3 | ×0.6 | ×0.5 |
| `dps` | ×0.6 | ×0.6 | ×1.4 | ×0.7 |
| `support` | ×1.0 | ×1.0 | ×1.0 | ×0.5 |

Es decir: un counter de tanque-contra-tanque vale `5 × 1.5 = 7.5` puntos en 5v5, pero solo `5 × 1.3 = 6.5` puntos en 6v6, mientras que ese mismo tanque contra un dps enemigo (aunque esté declarado en `counters`) vale `5 × 0.6 = 3` puntos en cualquiera de los dos modos.

### Sinergias tanque-tanque (relevantes sobre todo en 6v6)

`synergizesWith` no distingue por rol: si dos tanques están declarados como sinérgicos entre sí (ej. `reinhardt` tiene `zarya` en su lista, o viceversa), `synergyScore()` suma los mismos +3 puntos que sumaría cualquier otra pareja aliada, sin necesidad de código adicional — simplemente hace falta que ambos estén en `allyIds` a la vez, lo cual en la práctica solo pasa en modo 6v6 (en 5v5 solo hay un tanque por equipo). El dataset actual incluye, entre otras, estas parejas: `reinhardt`↔`dva`, `reinhardt`↔`orisa`, `reinhardt`↔`winston`, `reinhardt`↔`roadhog`, `reinhardt`↔`hazard`, `zarya`↔`doomfist`, `zarya`↔`winston`, `zarya`↔`mauga`, `zarya`↔`wrecking_ball`, `zarya`↔`sigma`, `orisa`↔`junker_queen`, `orisa`↔`mauga`, `orisa`↔`domina`, `junker_queen`↔`roadhog`.

## Triángulo de subtipos de tanque (`tankTypeScore()`)

Además de las relaciones de `counters`/`counteredBy` puntuales entre héroes, hay una regla general por **subtipo** de tanque (`tankType`):

```
poke  vence a  brawl   (el poke desgasta antes de que el brawl llegue a pegar)
brawl vence a  dive    (el brawl tiene sustain/cc para aguantar y castigar el salto)
dive  vence a  poke    (el dive salta directo a la backline, que no tiene defensa de cerca)
```

Vale `±4 × ROLE_MATCHUP_WEIGHT["tank"]["tank"]` — es decir `±6` en 5v5 (`4 × 1.5`) y `±5.2` en 6v6 (`4 × 1.3`), usando el mismo peso tanque-vs-tanque de la tabla de arriba. Es más chico que un counter curado (`±5 × peso`, o sea `±7.5`/`±6.5`) a propósito, para que las relaciones puntuales sigan pesando más que la regla general cuando ambas aplicarían.

**⚠️ Es un *fallback*, no se suma junto a un counter curado.** Si esos dos héroes puntuales ya tienen una relación explícita en `counters`/`counteredBy` (por ejemplo, `reinhardt` cuenta a `domina` en su `counters` aunque el triángulo diría que poke le gana a brawl), esa relación curada **gana sola, sin diluirse**: el triángulo genérico directamente no se calcula para ese par. Solo se aplica el triángulo cuando esos dos tanques específicos no tienen ninguna relación curada entre sí. Es el mismo criterio (`directHit`) que ya usaba `counterScore()` para sus ajustes genéricos por tag (`anti-flyer`, `anti-dive`).

## Sinergias de composición por subtipo de tanque (`tankArchetypeSynergyScore()`)

Puntaje de sinergia adicional (separado de `synergyScore()`, aparece como `archetypeSynergyScore` en el breakdown) que premia acompañar a cada subtipo de tanque con el rol/perfil que mejor le funciona. Es simétrico: no importa si el tanque ya está en el equipo y se evalúa el acompañante, o al revés.

| Subtipo de tanque | Se beneficia de... | Cómo se detecta |
|---|---|---|
| `"dive"` | Un dps flex de alta movilidad (ej. Tracer) | `dpsRole === "flex"` y `mobility >= 4` |
| | Un soporte que cura a distancia | `range` incluye `"long"` (Ana, Illari, Zenyatta, Wuyang) |
| `"brawl"` | Un dps flex flanqueador | `dpsRole === "flex"` y `playstyle === "flanker"` |
| | Un soporte que da velocidad al equipo | tag `"speed-boost"` (hoy solo Lúcio) |
| `"poke"` | Cualquier héroe (de cualquier rol) que juegue a distancia | `range` incluye `"mid"` o `"long"` |

Cada match suma `+3` (dive/brawl) o `+1.5` (poke). El de poke es más chico a propósito: su condición es mucho más amplia (cualquier rol, dos rangos posibles) y sin moderar se acumularía demasiado rápido en un equipo de 5-6 héroes donde varios suelen tener rango mid/long.

## Balance de composición dps/soporte (`dpsBalanceScore()` / `supportBalanceScore()`)

Aparecen juntos como `compositionScore` en el breakdown de `recommend()` (un héroe solo puede ser dps o soporte, nunca los dos, así que en la práctica solo uno de los dos aplica por héroe). Solo se activan al elegir **exactamente el 2do** dps o soporte del equipo — con 0 o 2+ ya puestos no hay "segundo" claro contra el cual comparar.

**Dps** (`dpsRole`):
- 2do dps de rol **distinto** al 1ro (un hitscan + un flex) → **+3**.
- 2do dps del **mismo** rol → **-3**, excepto si ambos son `"hitscan"` **y** el mapa tiene el tag `"long"` (ahí se permite doble hitscan sin penalizar, tiene sentido en mapas de línea de visión larga).

**Soporte** (`supportRole`):
- 2do soporte también `"main"` → **-3**, **excepto si Zenyatta es uno de los dos** (él está exento de la penalización aunque el otro sea main).
- No hay bonus explícito por mezclar main+flex, solo se evita la penalización.

Además, `POST /api/team-check` devuelve un array `compositionWarnings` a nivel de equipo (no por héroe) que detecta estos mismos dos problemas **ya en el equipo elegido** (no solo mientras se está por elegir el 2do), con hasta 4 alternativas sugeridas del rol/tipo complementario.

---

## Apéndice: `maps.json`

Cada mapa tiene esta forma:

```json
{
  "id": "circuit_royal",
  "name": "Circuit Royal",
  "type": "Escort",
  "tags": ["open", "long", "chokepoints"],
  "range": ["mid", "long"]
}
```

- **`id` / `name`**: igual que en héroes — id interno, nombre visible.
- **`type`**: el modo de juego del mapa (`Control`, `Escort`, `Hybrid`, `Push`, `Flashpoint`). Se muestra agrupado en el selector de mapa del frontend; no tiene efecto en el puntaje. (`Clash` se sacó del dataset porque ese modo solo se juega en Stadium, no en Quick Play/Competitive normal.)
- **`tags`**: vocabulario cerrado (`open`, `close`, `mixed`, `long`, `chokepoints`, `flank_routes`, `high_ground`) que se cruza contra `mapPreference` de cada héroe en `mapScore()`. Describe características espaciales del mapa más allá del rango puro (por ejemplo, un mapa puede ser `"long"` y tener `"chokepoints"` al mismo tiempo).
- **`range`** *(nuevo)*: subconjunto de `["close", "mid", "long"]` — el/los rango(s) de enfrentamiento predominantes del mapa. Se cruza contra el `range` de cada héroe en `rangeScore()`. Es un campo curado a mano (no derivado automáticamente de `tags`), pensado para que un mapa como Circuit Royal quede marcado específicamente como `["mid", "long"]` y beneficie a hitscan/sniper/proyectil de larga distancia por sobre los flanqueadores de corto alcance, incluso si comparte otros tags con mapas más cerrados.

Si agregás un mapa nuevo o corregís uno existente, recordá completar los 5 campos — si te olvidás `range`, `rangeScore()` simplemente no suma nada para ese mapa (no rompe, pero pierde precisión).
