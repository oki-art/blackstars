# Academia Blackstars · app de gestión

App web instalable (PWA) para gestionar la Academia Blackstars: alumnas, clases, caja por días,
incidencias, eventos, profesoras, normas, inscripciones, formularios por WhatsApp y escuelas amigas,
con permisos por persona y módulo.

- Datos: Supabase (proyecto `black-star`, región UE, plan gratuito). Protegidos con reglas de seguridad (RLS).
- Alojamiento: GitHub Pages (gratis). Sin paso de compilación: HTML, CSS y JavaScript tal cual.
- `config.js` lleva la URL y la clave pública (anon) de Supabase; es pública por diseño.

## Instalar en el móvil
Abre el enlace en Chrome (Android) o Safari (iPhone) y elige "Añadir a pantalla de inicio".

## Formularios públicos
`https://…/?f=<código>` abre un formulario sin cuenta. Solo puede leer el formulario abierto y enviar una respuesta.
