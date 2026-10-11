-- =====================================================================
-- ESCUELA DE BAILE · Esquema Supabase
-- v3 · Roles: admin (todo + gestiona permisos) y el resto del equipo
-- (gestión y profesoras) con permisos por módulo (ver / escribir) que el
-- admin da y quita. Incluye auditoría (quién registró y modificó cada
-- dato), eventos con equipo, formularios públicos para alumnas y escuelas
-- amigas que dan clases en la academia (cuota mensual según horas semanales).
-- Ejecutar en el SQL Editor de un proyecto NUEVO (región UE).
-- =====================================================================

create extension if not exists btree_gist;   -- para impedir choques de sala

-- ---------- 1. PERFILES Y PERMISOS ----------------------------------

create table public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  rol        text not null default 'usuaria' check (rol in ('admin','usuaria')),
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

-- Un registro por persona y módulo. El admin lo edita desde la pantalla "Permisos".
create table public.permisos (
  perfil_id       uuid not null references public.perfiles(id) on delete cascade,
  modulo          text not null check (modulo in (
                    'alumnas','profesoras','clases','inscripciones',
                    'incidencias','normas','caja','eventos','formularios','escuelas_amigas')),
  puede_ver       boolean not null default false,
  puede_escribir  boolean not null default false,
  -- true = solo ve lo suyo (sus clases, sus alumnas, sus eventos). Pensado para profesoras.
  solo_propias    boolean not null default false,
  primary key (perfil_id, modulo),
  check (not puede_escribir or puede_ver)   -- escribir implica ver
);

-- Al registrarse un usuario en Auth se crea su perfil SIN permisos.
create or replace function public.crear_perfil_nuevo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo();

-- ---------- 2. FUNCIONES DE PERMISO ---------------------------------

create or replace function public.es_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin' and activo
  );
$$;

create or replace function public.puede_ver(p_modulo text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.es_admin() or exists (
    select 1
    from public.permisos pe
    join public.perfiles pr on pr.id = pe.perfil_id
    where pe.perfil_id = auth.uid()
      and pe.modulo = p_modulo
      and pe.puede_ver
      and pr.activo
  );
$$;

create or replace function public.puede_escribir(p_modulo text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.es_admin() or exists (
    select 1
    from public.permisos pe
    join public.perfiles pr on pr.id = pe.perfil_id
    where pe.perfil_id = auth.uid()
      and pe.modulo = p_modulo
      and pe.puede_escribir
      and pr.activo
  );
$$;

-- ---------- 3. TABLAS DE DATOS --------------------------------------

create table public.profesoras (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  telefono   text,
  email      text,
  activa     boolean not null default true,
  notas      text,
  -- Si la profesora tiene acceso a la app, aquí se enlaza con su perfil.
  perfil_id  uuid unique references public.perfiles(id) on delete set null,
  creado_por uuid default auth.uid() references public.perfiles(id),
  creado_en  timestamptz not null default now()
);

create table public.alumnas (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  apellidos        text,
  fecha_nacimiento date,
  telefono         text,
  email            text,
  tutor_nombre     text,      -- para alumnas menores
  tutor_telefono   text,
  estado           text not null default 'activa' check (estado in ('activa','baja')),
  fecha_alta       date not null default current_date,
  notas            text,
  creado_por       uuid default auth.uid() references public.perfiles(id),
  creado_en        timestamptz not null default now()
);

-- Escuelas amigas: dan sus clases en nuestra sala y pagan una cuota mensual
-- según las horas semanales (horas por semana x tarifa). Solo se registran
-- sus clases, su profesora (texto) y el número de alumnas.
create table public.escuelas_amigas (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  contacto            text,
  telefono            text,
  email               text,
  tarifa_hora_semana  numeric(10,2) not null default 0 check (tarifa_hora_semana >= 0),  -- € al mes por cada hora semanal
  activa              boolean not null default true,
  notas               text,
  creado_por          uuid default auth.uid() references public.perfiles(id),
  creado_en           timestamptz not null default now()
);

create table public.clases (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  dia_semana    smallint not null check (dia_semana between 1 and 7),  -- 1 = lunes
  hora_inicio   time not null,
  hora_fin      time not null,
  nivel         text,
  profesora_id  uuid references public.profesoras(id) on delete set null,
  sala          text,
  -- Clase de una escuela amiga (vacío = clase propia de la academia)
  escuela_amiga_id   uuid references public.escuelas_amigas(id) on delete restrict,
  profesora_externa  text,
  alumnas_externas   integer check (alumnas_externas is null or alumnas_externas >= 0),
  activa        boolean not null default true,
  creado_por    uuid default auth.uid() references public.perfiles(id),
  creado_en     timestamptz not null default now(),
  check (hora_fin > hora_inicio),
  check (escuela_amiga_id is not null or (profesora_externa is null and alumnas_externas is null)),
  -- Dos clases activas no pueden coincidir a la vez en la misma sala (propias o de escuela amiga).
  exclude using gist (
    sala with =,
    dia_semana with =,
    tsrange(timestamp '2000-01-01' + hora_inicio, timestamp '2000-01-01' + hora_fin) with &&
  ) where (activa and sala is not null)
);

-- Alumna <-> clase. Dar de baja = rellenar fecha_baja (se conserva el histórico).
create table public.inscripciones (
  id          uuid primary key default gen_random_uuid(),
  alumna_id   uuid not null references public.alumnas(id) on delete cascade,
  clase_id    uuid not null references public.clases(id) on delete cascade,
  fecha_alta  date not null default current_date,
  fecha_baja  date,
  creado_por  uuid default auth.uid() references public.perfiles(id),
  creado_en   timestamptz not null default now(),
  check (fecha_baja is null or fecha_baja >= fecha_alta)
);
-- Una alumna no puede estar inscrita dos veces a la vez en la misma clase.
create unique index inscripcion_activa_unica
  on public.inscripciones (alumna_id, clase_id) where fecha_baja is null;

create table public.incidencias (
  id          uuid primary key default gen_random_uuid(),
  fecha       date not null default current_date,
  clase_id    uuid references public.clases(id) on delete set null,
  alumna_id   uuid references public.alumnas(id) on delete set null,
  descripcion text not null,
  escuela_amiga_id uuid references public.escuelas_amigas(id) on delete set null,
  creado_por  uuid default auth.uid() references public.perfiles(id),
  creado_en   timestamptz not null default now()
);

create table public.normas (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  contenido  text not null,
  activa     boolean not null default true,
  creado_por uuid default auth.uid() references public.perfiles(id),
  creado_en  timestamptz not null default now()
);

create table public.caja (
  id          uuid primary key default gen_random_uuid(),
  fecha       date not null default current_date,
  tipo        text not null check (tipo in ('ingreso','gasto')),
  concepto    text not null,
  importe     numeric(10,2) not null check (importe > 0),
  metodo      text check (metodo in ('efectivo','tarjeta','bizum','transferencia')),
  alumna_id   uuid references public.alumnas(id) on delete set null,
  clase_id    uuid references public.clases(id) on delete set null,  -- p. ej. pago de Salsa
  escuela_amiga_id uuid references public.escuelas_amigas(id) on delete set null,  -- cuota de una escuela amiga
  creado_por  uuid default auth.uid() references public.perfiles(id),
  creado_en   timestamptz not null default now()
);

create table public.eventos (
  id               uuid primary key default gen_random_uuid(),
  titulo           text not null,
  fecha            date not null,
  hora             time,
  lugar            text,
  descripcion      text,
  coordinadora_id  uuid references public.profesoras(id) on delete set null,
  normas           text,            -- normas del evento
  condiciones      text,            -- precio, plazos, vestuario...
  inscripcion_hasta date,
  precio_alumna    numeric(10,2),
  creado_por  uuid default auth.uid() references public.perfiles(id),
  creado_en   timestamptz not null default now()
);

create table public.inscripciones_evento (
  id         uuid primary key default gen_random_uuid(),
  evento_id  uuid not null references public.eventos(id) on delete cascade,
  alumna_id  uuid not null references public.alumnas(id) on delete cascade,
  estado     text not null default 'inscrita' check (estado in ('inscrita','cancelada')),
  creado_por uuid default auth.uid() references public.perfiles(id),
  creado_en  timestamptz not null default now(),
  unique (evento_id, alumna_id)
);


-- Profesoras que participan en un evento (la coordinadora va en eventos.coordinadora_id).
create table public.evento_profesoras (
  evento_id     uuid not null references public.eventos(id) on delete cascade,
  profesora_id  uuid not null references public.profesoras(id) on delete cascade,
  primary key (evento_id, profesora_id)
);

-- Alumnas nuestras que también van a clases de una escuela amiga ("coincidencias").
create table public.alumnas_escuela_amiga (
  alumna_id         uuid not null references public.alumnas(id) on delete cascade,
  escuela_amiga_id  uuid not null references public.escuelas_amigas(id) on delete cascade,
  clase_id          uuid references public.clases(id) on delete set null,  -- la clase de la escuela amiga
  notas             text,
  creado_por        uuid default auth.uid() references public.perfiles(id),
  creado_en         timestamptz not null default now(),
  primary key (alumna_id, escuela_amiga_id)
);

-- Anotaciones sobre una escuela amiga (acuerdos, avisos, cosas a recordar).
create table public.notas_escuela_amiga (
  id                uuid primary key default gen_random_uuid(),
  escuela_amiga_id  uuid not null references public.escuelas_amigas(id) on delete cascade,
  fecha             date not null default current_date,
  texto             text not null,
  creado_por        uuid default auth.uid() references public.perfiles(id),
  creado_en         timestamptz not null default now()
);

-- Formularios que se envían por enlace (WhatsApp) a las alumnas.
-- 'campos' es una lista de preguntas, p. ej.:
--  [{"id":"nombre","tipo":"texto","etiqueta":"Nombre","obligatorio":true},
--   {"id":"clase","tipo":"opciones","etiqueta":"Clase","opciones":["Salsa","Urbano"]}]
create table public.formularios (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  descripcion   text,
  campos        jsonb not null default '[]'::jsonb,
  slug          text not null unique default encode(gen_random_bytes(9), 'hex'),  -- va en el enlace
  estado        text not null default 'borrador' check (estado in ('borrador','abierto','cerrado')),
  abierto_hasta timestamptz,
  texto_privacidad text,       -- aviso de protección de datos que ve la alumna
  creado_por    uuid default auth.uid() references public.perfiles(id),
  creado_en     timestamptz not null default now()
);

create table public.respuestas_formulario (
  id             uuid primary key default gen_random_uuid(),
  formulario_id  uuid not null references public.formularios(id) on delete cascade,
  datos          jsonb not null,
  acepta_privacidad boolean not null default false,
  revisada       boolean not null default false,
  alumna_id      uuid references public.alumnas(id) on delete set null,  -- si se enlaza luego
  enviada_en     timestamptz not null default now(),
  -- sin creado_por: la envía una alumna sin cuenta
  check (octet_length(datos::text) <= 20000)
);
create index on public.respuestas_formulario (formulario_id, enviada_en desc);

-- ---------- 3b. AUDITORÍA: quién registró y quién modificó ----------
-- creado_por / creado_en los pone el servidor (no se pueden falsear desde la app).
do $$
declare t text;
begin
  foreach t in array array['profesoras','alumnas','clases','inscripciones','incidencias',
                           'normas','caja','eventos','inscripciones_evento','formularios',
                           'escuelas_amigas','alumnas_escuela_amiga','notas_escuela_amiga']
  loop
    execute format('alter table public.%I add column if not exists modificado_por uuid references public.perfiles(id)', t);
    execute format('alter table public.%I add column if not exists modificado_en  timestamptz', t);
  end loop;
end;
$$;

create or replace function public.auditar()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.creado_por := coalesce(auth.uid(), new.creado_por);
    new.creado_en  := now();
  else
    new.creado_por := old.creado_por;
    new.creado_en  := old.creado_en;
    new.modificado_por := auth.uid();
    new.modificado_en  := now();
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profesoras','alumnas','clases','inscripciones','incidencias',
                           'normas','caja','eventos','inscripciones_evento','formularios',
                           'escuelas_amigas','alumnas_escuela_amiga','notas_escuela_amiga']
  loop
    execute format('create trigger auditar_%1$s before insert or update on public.%1$I
                    for each row execute function public.auditar()', t);
  end loop;
end;
$$;

-- Vista cómoda para el admin: "registró X el día Y" en cualquier pantalla.
-- (Solo el admin puede leer los nombres de todos los perfiles.)
create or replace view public.caja_con_autor with (security_invoker = true) as
  select c.*, p.nombre as registrado_por
  from public.caja c left join public.perfiles p on p.id = c.creado_por;
create or replace view public.incidencias_con_autor with (security_invoker = true) as
  select i.*, p.nombre as registrado_por
  from public.incidencias i left join public.perfiles p on p.id = i.creado_por;
create or replace view public.eventos_con_autor with (security_invoker = true) as
  select e.*, p.nombre as registrado_por
  from public.eventos e left join public.perfiles p on p.id = e.creado_por;

-- Resumen por escuela amiga: horas semanales, clases, alumnas y cuota mensual.
create or replace view public.escuela_amiga_resumen with (security_invoker = true) as
  select e.id, e.nombre, e.tarifa_hora_semana, e.activa,
         coalesce(h.horas_semana, 0)               as horas_semana,
         coalesce(h.n_clases, 0)                   as n_clases,
         coalesce(h.n_alumnas, 0)                  as n_alumnas,
         round(coalesce(h.horas_semana, 0) * e.tarifa_hora_semana, 2) as cuota_mensual
  from public.escuelas_amigas e
  left join (
    select c.escuela_amiga_id,
           sum(extract(epoch from (c.hora_fin - c.hora_inicio)) / 3600.0) as horas_semana,
           count(*)                                                     as n_clases,
           sum(coalesce(c.alumnas_externas, 0))                         as n_alumnas
    from public.clases c
    where c.activa and c.escuela_amiga_id is not null
    group by c.escuela_amiga_id
  ) h on h.escuela_amiga_id = e.id;

-- Coincidencias: alumnas nuestras que también van a una escuela amiga.
create or replace view public.coincidencias_escuela_amiga with (security_invoker = true) as
  select a.id as alumna_id, a.nombre, a.apellidos, e.id as escuela_amiga_id, e.nombre as escuela,
         c.nombre as clase_externa, x.notas
  from public.alumnas_escuela_amiga x
  join public.alumnas a on a.id = x.alumna_id
  join public.escuelas_amigas e on e.id = x.escuela_amiga_id
  left join public.clases c on c.id = x.clase_id;

-- Totales de caja por día (para la pantalla "Caja por días").
create or replace view public.caja_por_dia with (security_invoker = true) as
  select fecha,
         sum(importe) filter (where tipo = 'ingreso') as ingresos,
         sum(importe) filter (where tipo = 'gasto')   as gastos,
         count(*)     filter (where tipo = 'ingreso') as n_ingresos,
         count(*)     filter (where tipo = 'gasto')   as n_gastos
  from public.caja
  group by fecha;

-- ---------- 3c. "SOLO LO MÍO" PARA PROFESORAS -----------------------
create or replace function public.solo_propias(p_modulo text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select not public.es_admin() and coalesce((
    select pe.solo_propias from public.permisos pe
    where pe.perfil_id = auth.uid() and pe.modulo = p_modulo), false);
$$;

create or replace function public.mis_clases()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select c.id from public.clases c
  join public.profesoras pr on pr.id = c.profesora_id
  where pr.perfil_id = auth.uid();
$$;

create or replace function public.mis_alumnas()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select i.alumna_id from public.inscripciones i
  where i.fecha_baja is null and i.clase_id in (select public.mis_clases());
$$;

create or replace function public.mis_eventos()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select ep.evento_id from public.evento_profesoras ep
  join public.profesoras pr on pr.id = ep.profesora_id
  where pr.perfil_id = auth.uid()
  union
  select e.id from public.eventos e
  join public.profesoras pr on pr.id = e.coordinadora_id
  where pr.perfil_id = auth.uid();
$$;

-- Índices útiles
create index on public.inscripciones (clase_id);
create index on public.inscripciones (alumna_id);
create index on public.incidencias (fecha desc);
create index on public.caja (fecha desc);

-- ---------- 4. SEGURIDAD (RLS) --------------------------------------

alter table public.perfiles enable row level security;
alter table public.permisos enable row level security;

-- Cada persona ve su propio perfil y permisos; solo el admin ve y cambia todo.
create policy perfiles_select on public.perfiles
  for select using (id = auth.uid() or public.es_admin());
create policy perfiles_admin_insert on public.perfiles
  for insert with check (public.es_admin());
create policy perfiles_admin_update on public.perfiles
  for update using (public.es_admin()) with check (public.es_admin());
create policy perfiles_admin_delete on public.perfiles
  for delete using (public.es_admin());

create policy permisos_select on public.permisos
  for select using (perfil_id = auth.uid() or public.es_admin());
create policy permisos_admin_insert on public.permisos
  for insert with check (public.es_admin());
create policy permisos_admin_update on public.permisos
  for update using (public.es_admin()) with check (public.es_admin());
create policy permisos_admin_delete on public.permisos
  for delete using (public.es_admin());

-- Tablas de datos: ver / crear / editar según permisos del módulo;
-- borrar definitivamente solo el admin (lo normal es dar de baja, no borrar).
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('profesoras',           'profesoras'),
      ('alumnas',              'alumnas'),
      ('clases',               'clases'),
      ('inscripciones',        'inscripciones'),
      ('incidencias',          'incidencias'),
      ('normas',               'normas'),
      ('caja',                 'caja'),
      ('eventos',              'eventos'),
      ('inscripciones_evento', 'eventos'),
      ('evento_profesoras',    'eventos'),
      ('formularios',          'formularios'),
      ('respuestas_formulario','formularios'),
      ('escuelas_amigas',      'escuelas_amigas'),
      ('alumnas_escuela_amiga','escuelas_amigas'),
      ('notas_escuela_amiga',  'escuelas_amigas')
    ) as t(tabla, modulo)
  loop
    execute format('alter table public.%I enable row level security', r.tabla);

    -- Las tablas con "solo lo mío" tienen su política de lectura más abajo.
    if r.tabla not in ('alumnas','clases','inscripciones','incidencias',
                       'eventos','inscripciones_evento','evento_profesoras') then
      execute format(
        'create policy %I on public.%I for select using (public.puede_ver(%L))',
        r.tabla || '_select', r.tabla, r.modulo);
    end if;

    execute format(
      'create policy %I on public.%I for insert with check (public.puede_escribir(%L))',
      r.tabla || '_insert', r.tabla, r.modulo);

    execute format(
      'create policy %I on public.%I for update using (public.puede_escribir(%L)) with check (public.puede_escribir(%L))',
      r.tabla || '_update', r.tabla, r.modulo, r.modulo);

    execute format(
      'create policy %I on public.%I for delete using (public.es_admin())',
      r.tabla || '_delete', r.tabla);
  end loop;
end;
$$;

-- Lectura con "solo lo mío": una profesora con solo_propias ve únicamente
-- sus clases, las alumnas inscritas en ellas, sus incidencias y sus eventos.
create policy clases_select on public.clases for select using (
  public.puede_ver('clases')
  and (not public.solo_propias('clases') or id in (select public.mis_clases())));

create policy inscripciones_select on public.inscripciones for select using (
  public.puede_ver('inscripciones')
  and (not public.solo_propias('inscripciones') or clase_id in (select public.mis_clases())));

create policy alumnas_select on public.alumnas for select using (
  public.puede_ver('alumnas')
  and (not public.solo_propias('alumnas') or id in (select public.mis_alumnas())));

create policy incidencias_select on public.incidencias for select using (
  public.puede_ver('incidencias')
  and (not public.solo_propias('incidencias')
       or creado_por = auth.uid() or clase_id in (select public.mis_clases())));

create policy eventos_select on public.eventos for select using (
  public.puede_ver('eventos')
  and (not public.solo_propias('eventos') or id in (select public.mis_eventos())));

create policy inscripciones_evento_select on public.inscripciones_evento for select using (
  public.puede_ver('eventos')
  and (not public.solo_propias('eventos') or evento_id in (select public.mis_eventos())));

create policy evento_profesoras_select on public.evento_profesoras for select using (
  public.puede_ver('eventos')
  and (not public.solo_propias('eventos') or evento_id in (select public.mis_eventos())));

-- ---------- 4b. FORMULARIOS PÚBLICOS (alumnas, sin cuenta) ----------
-- La alumna NO toca las tablas: solo puede llamar a estas dos funciones.
-- Así no puede leer respuestas de otras ni formularios cerrados.
create or replace function public.formulario_publico(p_slug text)
returns table (titulo text, descripcion text, campos jsonb, texto_privacidad text)
language sql stable security definer
set search_path = public
as $$
  select f.titulo, f.descripcion, f.campos, f.texto_privacidad
  from public.formularios f
  where f.slug = p_slug and f.estado = 'abierto'
    and (f.abierto_hasta is null or f.abierto_hasta > now());
$$;

create or replace function public.enviar_respuesta(p_slug text, p_datos jsonb, p_acepta boolean)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare v_id uuid;
begin
  select f.id into v_id from public.formularios f
  where f.slug = p_slug and f.estado = 'abierto'
    and (f.abierto_hasta is null or f.abierto_hasta > now());
  if v_id is null then
    raise exception 'Formulario cerrado o inexistente';
  end if;
  if not coalesce(p_acepta, false) then
    raise exception 'Hay que aceptar el aviso de privacidad';
  end if;
  if octet_length(p_datos::text) > 20000 then
    raise exception 'Respuesta demasiado grande';
  end if;
  insert into public.respuestas_formulario (formulario_id, datos, acepta_privacidad)
  values (v_id, p_datos, true);
end;
$$;

revoke all on function public.formulario_publico(text) from public;
revoke all on function public.enviar_respuesta(text, jsonb, boolean) from public;
grant execute on function public.formulario_publico(text) to anon, authenticated;
grant execute on function public.enviar_respuesta(text, jsonb, boolean) to anon, authenticated;

-- ---------- 5. PUESTA EN MARCHA (ejecutar a mano, una vez) ----------
-- 1) Crea tu usuario y el de las otras dos en Authentication > Users.
-- 2) Hazte administradora (cambia el correo):
--
--   update public.perfiles set rol = 'admin'
--   where id = (select id from auth.users where email = 'tu@correo.com');
--
-- 3) Ejemplo: segunda persona con acceso completo salvo caja.
--
--   insert into public.permisos (perfil_id, modulo, puede_ver, puede_escribir)
--   select (select id from auth.users where email = 'persona2@correo.com'), m, true, true
--   from unnest(array['alumnas','profesoras','clases','inscripciones',
--                     'incidencias','normas','eventos','formularios']) as m;
--
-- 4) Ejemplo: tercera persona solo consulta alumnas, clases y normas, y
--    puede registrar incidencias.
--
--   insert into public.permisos (perfil_id, modulo, puede_ver, puede_escribir) values
--     ((select id from auth.users where email = 'persona3@correo.com'), 'alumnas',    true, false),
--     ((select id from auth.users where email = 'persona3@correo.com'), 'clases',     true, false),
--     ((select id from auth.users where email = 'persona3@correo.com'), 'normas',     true, false),
--     ((select id from auth.users where email = 'persona3@correo.com'), 'incidencias', true, true);

--
-- 5) Ejemplo: una profesora que solo ve lo suyo (sus clases, alumnas,
--    incidencias y eventos). Antes enlaza su perfil con su ficha:
--
--   update public.profesoras set perfil_id =
--     (select id from auth.users where email = 'profe@correo.com')
--   where nombre = 'Marta';
--
--   insert into public.permisos (perfil_id, modulo, puede_ver, puede_escribir, solo_propias)
--   select (select id from auth.users where email = 'profe@correo.com'), m, true, w, true
--   from (values ('clases', false), ('alumnas', false),
--                ('incidencias', true), ('eventos', false)) as v(m, w);
--
-- 6) Para quien registra pagos en caja: damos 'caja' (ver y escribir).
--    El admin ve siempre quién registró cada cosa (columnas creado_por y
--    creado_en, y las vistas *_con_autor).
--
-- 7) Escuela amiga: se da de alta, se le ponen sus clases (con sala y horas) y la
--    cuota mensual sale sola en la vista escuela_amiga_resumen (horas x tarifa).
--    Ejemplo: 2,5 h semanales x 40 € = 100 € al mes. Al cobrarla, se registra en
--    caja con escuela_amiga_id. Sus profesoras no tienen acceso a la app.
