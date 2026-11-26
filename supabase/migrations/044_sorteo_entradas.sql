-- 044 · Sorteo de entradas: cada alumna se apunta con las entradas que quiere y recibe un número (1, 2, 3…).
-- Se cierra la lista (ya no se puede tocar y queda un código de la lista), se sortea el número de inicio
-- y desde ahí se sigue en orden (al llegar al último se vuelve al 1). Las butacas se reparten seguidas en la app.
-- Permisos nuevos: "sorteos" (ver y apuntar) y "sorteos_sortear" (cerrar la lista y sortear). La administración siempre.
-- Se dan a Adela los dos. María no ve nada del sorteo hasta que Raúl se lo dé en Equipo y permisos.
-- Solo añade tablas; no toca datos existentes. Se puede pegar más de una vez.

create table if not exists public.sorteos (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null check (length(titulo) between 1 and 200),
  evento_id     uuid references public.eventos(id) on delete set null,
  butacas       int  not null default 140 check (butacas between 1 and 2000),
  por_fila      int  not null default 10  check (por_fila between 1 and 60),
  estado        text not null default 'abierto' check (estado in ('abierto','cerrado','sorteado')),
  huella        text,             -- código de la lista al cerrarla (cambiaría si alguien la tocara)
  alumnas_n     int,
  entradas_n    int,
  cerrado_en    timestamptz,
  cerrado_por   uuid references public.perfiles(id) on delete set null,
  cerrado_nombre text,
  numero_inicio int,
  sorteado_en   timestamptz,
  sorteado_por  uuid references public.perfiles(id) on delete set null,
  sorteado_nombre text,
  creado_por    uuid default auth.uid() references public.perfiles(id) on delete set null,
  creado_en     timestamptz not null default now(),
  modificado_por uuid references public.perfiles(id) on delete set null,
  modificado_en  timestamptz
);

create table if not exists public.sorteo_participantes (
  id         uuid primary key default gen_random_uuid(),
  sorteo_id  uuid not null references public.sorteos(id) on delete cascade,
  numero     int  not null,
  alumna_id  uuid references public.alumnas(id) on delete set null,
  nombre     text not null check (length(nombre) between 1 and 200),
  clase      text,
  entradas   int  not null default 1 check (entradas between 1 and 50),
  creado_por uuid default auth.uid() references public.perfiles(id) on delete set null,
  creado_en  timestamptz not null default now(),
  modificado_por uuid references public.perfiles(id) on delete set null,
  modificado_en  timestamptz,
  constraint sorteo_numero_unico unique (sorteo_id, numero) deferrable initially deferred
);
create index if not exists sorteo_participantes_sorteo on public.sorteo_participantes (sorteo_id, numero);

drop trigger if exists auditar_sorteos on public.sorteos;
create trigger auditar_sorteos before insert or update on public.sorteos
  for each row execute function public.auditar();
drop trigger if exists auditar_sorteo_participantes on public.sorteo_participantes;
create trigger auditar_sorteo_participantes before insert or update on public.sorteo_participantes
  for each row execute function public.auditar();

-- El cierre y el sorteo solo los pueden poner las funciones de abajo (nadie los puede escribir a mano)
create or replace function public.sorteo_protegido()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('bs.sorteo_rpc', true), '') = '1' then return new; end if;
  if tg_op = 'INSERT' then
    new.estado := 'abierto'; new.huella := null; new.alumnas_n := null; new.entradas_n := null;
    new.cerrado_en := null; new.cerrado_por := null; new.cerrado_nombre := null;
    new.numero_inicio := null; new.sorteado_en := null; new.sorteado_por := null; new.sorteado_nombre := null;
    return new;
  end if;
  new.estado := old.estado; new.huella := old.huella; new.alumnas_n := old.alumnas_n; new.entradas_n := old.entradas_n;
  new.cerrado_en := old.cerrado_en; new.cerrado_por := old.cerrado_por; new.cerrado_nombre := old.cerrado_nombre;
  new.numero_inicio := old.numero_inicio; new.sorteado_en := old.sorteado_en; new.sorteado_por := old.sorteado_por; new.sorteado_nombre := old.sorteado_nombre;
  if old.estado <> 'abierto' then new.butacas := old.butacas; new.por_fila := old.por_fila; end if;
  return new;
end $$;
drop trigger if exists sorteo_protegido on public.sorteos;
create trigger sorteo_protegido before insert or update on public.sorteos
  for each row execute function public.sorteo_protegido();

-- Lista cerrada = no se puede añadir, quitar ni cambiar a nadie. El número lo pone el servidor (el siguiente libre).
create or replace function public.sorteo_lista_bloqueada()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_estado text; v_sorteo uuid := case when tg_op = 'DELETE' then old.sorteo_id else new.sorteo_id end;
begin
  select estado into v_estado from public.sorteos where id = v_sorteo for update;
  if v_estado is null then   -- el sorteo entero se está borrando
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if v_estado <> 'abierto' then
    raise exception 'La lista de este sorteo está cerrada: ya no se puede cambiar.';
  end if;
  if tg_op = 'INSERT' then
    select coalesce(max(numero), 0) + 1 into new.numero from public.sorteo_participantes where sorteo_id = new.sorteo_id;
  elsif tg_op = 'UPDATE' then
    new.sorteo_id := old.sorteo_id;
    if coalesce(current_setting('bs.renumerar', true), '') <> '1' then new.numero := old.numero; end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists sorteo_lista_bloqueada on public.sorteo_participantes;
create trigger sorteo_lista_bloqueada before insert or update or delete on public.sorteo_participantes
  for each row execute function public.sorteo_lista_bloqueada();

-- Si se quita a alguien antes de cerrar, las de detrás corren un puesto (los números siguen 1, 2, 3… sin huecos)
create or replace function public.sorteo_renumerar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.sorteos where id = old.sorteo_id) then return old; end if;
  perform set_config('bs.renumerar', '1', true);
  update public.sorteo_participantes set numero = numero - 1 where sorteo_id = old.sorteo_id and numero > old.numero;
  perform set_config('bs.renumerar', '', true);
  return old;
end $$;
drop trigger if exists sorteo_renumerar on public.sorteo_participantes;
create trigger sorteo_renumerar after delete on public.sorteo_participantes
  for each row execute function public.sorteo_renumerar();

-- Código de la lista: resumen de "número|nombre|entradas" de todas, en orden
create or replace function public.sorteo_huella_de(p_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select upper(substr(h, 1, 4) || '-' || substr(h, 5, 4))
  from (select md5(coalesce(string_agg(numero || '|' || nombre || '|' || entradas, E'\n' order by numero), '')) h
        from public.sorteo_participantes where sorteo_id = p_id) x;
$$;

create or replace function public.puede_sortear()
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin() or public.puede_escribir('sorteos_sortear');
$$;

create or replace function public.cerrar_lista_sorteo(p_id uuid)
returns public.sorteos language plpgsql security definer set search_path = public as $$
declare s public.sorteos; v_n int; v_e int;
begin
  if not public.puede_sortear() then raise exception 'No tienes permiso para cerrar la lista.'; end if;
  select * into s from public.sorteos where id = p_id for update;
  if s.id is null then raise exception 'Ese sorteo no existe.'; end if;
  if s.estado <> 'abierto' then raise exception 'La lista ya estaba cerrada.'; end if;
  select count(*), coalesce(sum(entradas), 0) into v_n, v_e from public.sorteo_participantes where sorteo_id = p_id;
  if v_n < 1 then raise exception 'No hay nadie apuntado.'; end if;
  perform set_config('bs.sorteo_rpc', '1', true);
  update public.sorteos set estado = 'cerrado', huella = public.sorteo_huella_de(p_id), alumnas_n = v_n, entradas_n = v_e,
    cerrado_en = now(), cerrado_por = auth.uid(), cerrado_nombre = (select nombre from public.perfiles where id = auth.uid())
  where id = p_id returning * into s;
  perform set_config('bs.sorteo_rpc', '', true);
  return s;
end $$;

-- Antes de sortear se puede volver a abrir (por si faltaba alguien). Después, nunca.
create or replace function public.reabrir_lista_sorteo(p_id uuid)
returns public.sorteos language plpgsql security definer set search_path = public as $$
declare s public.sorteos;
begin
  if not public.puede_sortear() then raise exception 'No tienes permiso para abrir la lista.'; end if;
  select * into s from public.sorteos where id = p_id for update;
  if s.estado is distinct from 'cerrado' then raise exception 'Solo se puede abrir una lista cerrada que aún no se ha sorteado.'; end if;
  perform set_config('bs.sorteo_rpc', '1', true);
  update public.sorteos set estado = 'abierto', huella = null, alumnas_n = null, entradas_n = null,
    cerrado_en = null, cerrado_por = null, cerrado_nombre = null where id = p_id returning * into s;
  perform set_config('bs.sorteo_rpc', '', true);
  return s;
end $$;

-- El sorteo: un número al azar entre 1 y el número de alumnas. Una sola vez; queda guardado quién y cuándo.
create or replace function public.hacer_sorteo(p_id uuid)
returns public.sorteos language plpgsql security definer set search_path = public as $$
declare s public.sorteos; v_ini int;
begin
  if not public.puede_sortear() then raise exception 'No tienes permiso para sortear.'; end if;
  select * into s from public.sorteos where id = p_id for update;
  if s.id is null then raise exception 'Ese sorteo no existe.'; end if;
  if s.estado = 'sorteado' then raise exception 'Este sorteo ya se hizo: no se puede repetir.'; end if;
  if s.estado <> 'cerrado' then raise exception 'Primero hay que cerrar la lista.'; end if;
  if s.huella is distinct from public.sorteo_huella_de(p_id) then raise exception 'La lista ha cambiado desde que se cerró. Ábrela y ciérrala otra vez.'; end if;
  -- Azar del servidor (gen_random_uuid usa el generador seguro de la base de datos)
  v_ini := (('x' || substr(md5(gen_random_uuid()::text), 1, 8))::bit(32)::bigint % s.alumnas_n)::int + 1;
  perform set_config('bs.sorteo_rpc', '1', true);
  update public.sorteos set estado = 'sorteado', numero_inicio = v_ini, sorteado_en = now(), sorteado_por = auth.uid(),
    sorteado_nombre = (select nombre from public.perfiles where id = auth.uid())
  where id = p_id returning * into s;
  perform set_config('bs.sorteo_rpc', '', true);
  return s;
end $$;

alter table public.sorteos enable row level security;
alter table public.sorteo_participantes enable row level security;
drop policy if exists sorteos_select on public.sorteos;
create policy sorteos_select on public.sorteos for select using ((select public.puede_ver('sorteos')) or (select public.puede_sortear()));
drop policy if exists sorteos_insert on public.sorteos;
create policy sorteos_insert on public.sorteos for insert with check ((select public.puede_escribir('sorteos')) or (select public.puede_sortear()));
drop policy if exists sorteos_update on public.sorteos;
create policy sorteos_update on public.sorteos for update
  using ((select public.puede_escribir('sorteos')) or (select public.puede_sortear()))
  with check ((select public.puede_escribir('sorteos')) or (select public.puede_sortear()));
drop policy if exists sorteos_delete on public.sorteos;
create policy sorteos_delete on public.sorteos for delete using ((select public.es_admin()));

drop policy if exists sorteo_part_select on public.sorteo_participantes;
create policy sorteo_part_select on public.sorteo_participantes for select using ((select public.puede_ver('sorteos')) or (select public.puede_sortear()));
drop policy if exists sorteo_part_insert on public.sorteo_participantes;
create policy sorteo_part_insert on public.sorteo_participantes for insert with check ((select public.puede_escribir('sorteos')) or (select public.puede_sortear()));
drop policy if exists sorteo_part_update on public.sorteo_participantes;
create policy sorteo_part_update on public.sorteo_participantes for update
  using ((select public.puede_escribir('sorteos')) or (select public.puede_sortear()))
  with check ((select public.puede_escribir('sorteos')) or (select public.puede_sortear()));
drop policy if exists sorteo_part_delete on public.sorteo_participantes;
create policy sorteo_part_delete on public.sorteo_participantes for delete using ((select public.puede_escribir('sorteos')) or (select public.puede_sortear()));

revoke all on public.sorteos, public.sorteo_participantes from anon;
grant select, insert, update, delete on public.sorteos, public.sorteo_participantes to authenticated;
revoke all on function public.sorteo_protegido(), public.sorteo_lista_bloqueada(), public.sorteo_renumerar() from public, anon;
revoke all on function public.sorteo_huella_de(uuid), public.puede_sortear(), public.cerrar_lista_sorteo(uuid), public.reabrir_lista_sorteo(uuid), public.hacer_sorteo(uuid) from public, anon;
grant execute on function public.sorteo_huella_de(uuid), public.puede_sortear(), public.cerrar_lista_sorteo(uuid), public.reabrir_lista_sorteo(uuid), public.hacer_sorteo(uuid) to authenticated;

-- Módulos nuevos en Permisos (misma lista que la 042 + sorteos)
alter table public.permisos drop constraint if exists permisos_modulo_check;
alter table public.permisos add constraint permisos_modulo_check check (modulo in (
  'alumnas','profesoras','clases','inscripciones','incidencias','normas','caja',
  'eventos','formularios','escuelas_amigas','logros','iniciativas','documentos','pilates','contabilidad','limpieza','limpieza_informe','agenda',
  'sorteos','sorteos_sortear'));

-- Adela: apuntar y sortear.
insert into public.permisos (perfil_id, modulo, puede_ver, puede_escribir, solo_propias)
select p.id, m.modulo, true, true, false
from public.perfiles p join auth.users u on u.id = p.id
cross join (values ('sorteos'), ('sorteos_sortear')) m(modulo)
where lower(u.email) = 'adela.sof@gmail.com'
on conflict (perfil_id, modulo) do update set puede_ver = true, puede_escribir = true, solo_propias = false;
-- María: de partida sin sorteo (si una versión anterior de este archivo se lo dio, se le quita). Raúl se lo da cuando quiera.
delete from public.permisos p using auth.users u
where u.id = p.perfil_id and lower(u.email) = 'mariquillapgv@gmail.com' and p.modulo in ('sorteos', 'sorteos_sortear');

notify pgrst, 'reload schema';
