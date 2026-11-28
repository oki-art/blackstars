-- 045 · Entradas del sorteo en Caja: el sorteo se une a un evento con un precio por entrada.
-- Cada alumna apuntada tiene su venta de entradas en ese evento (pendiente de pago) y se cobra con "Cobrar"
-- (el mismo cobro de siempre: crea el ingreso en Caja). Para cerrar la lista tienen que estar todas pagadas,
-- salvo que la administración lo autorice. Solo añade columnas y funciones; no toca datos existentes
-- (las alumnas ya apuntadas pasan a Caja en cuanto el sorteo tenga evento y precio). Se puede pegar más de una vez.

alter table public.sorteos add column if not exists precio_entrada numeric(10,2) check (precio_entrada is null or precio_entrada >= 0);
alter table public.sorteos add column if not exists articulo_id uuid references public.evento_articulos(id) on delete set null;
alter table public.sorteos add column if not exists cerrar_sin_pagar boolean not null default false;
alter table public.sorteos add column if not exists autorizado_en timestamptz;
alter table public.sorteos add column if not exists autorizado_nombre text;
alter table public.sorteo_participantes add column if not exists reserva_id uuid references public.evento_reservas(id) on delete set null;

-- Protección de la 044 + lo nuevo: la autorización solo la pone su función; evento y precio no cambian con la lista cerrada
create or replace function public.sorteo_protegido()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('bs.sorteo_rpc', true), '') = '1' then return new; end if;
  if tg_op = 'INSERT' then
    new.estado := 'abierto'; new.huella := null; new.alumnas_n := null; new.entradas_n := null;
    new.cerrado_en := null; new.cerrado_por := null; new.cerrado_nombre := null;
    new.numero_inicio := null; new.sorteado_en := null; new.sorteado_por := null; new.sorteado_nombre := null;
    new.articulo_id := null; new.cerrar_sin_pagar := false; new.autorizado_en := null; new.autorizado_nombre := null;
    return new;
  end if;
  new.estado := old.estado; new.huella := old.huella; new.alumnas_n := old.alumnas_n; new.entradas_n := old.entradas_n;
  new.cerrado_en := old.cerrado_en; new.cerrado_por := old.cerrado_por; new.cerrado_nombre := old.cerrado_nombre;
  new.numero_inicio := old.numero_inicio; new.sorteado_en := old.sorteado_en; new.sorteado_por := old.sorteado_por; new.sorteado_nombre := old.sorteado_nombre;
  new.articulo_id := old.articulo_id; new.cerrar_sin_pagar := old.cerrar_sin_pagar; new.autorizado_en := old.autorizado_en; new.autorizado_nombre := old.autorizado_nombre;
  if old.estado <> 'abierto' then
    new.butacas := old.butacas; new.por_fila := old.por_fila; new.evento_id := old.evento_id; new.precio_entrada := old.precio_entrada;
  end if;
  -- Con alguna ya pagada, el evento y el precio ya no se pueden cambiar
  if (new.evento_id is distinct from old.evento_id or new.precio_entrada is distinct from old.precio_entrada)
     and exists (select 1 from public.sorteo_participantes sp join public.evento_reservas r on r.id = sp.reserva_id
                 where sp.sorteo_id = old.id and r.estado = 'pagada') then
    raise exception 'Ya hay entradas pagadas: el evento y el precio no se pueden cambiar.';
  end if;
  return new;
end $$;

-- Crea o pone al día la venta de entradas de una alumna del sorteo. Devuelve la reserva (o null si el sorteo no cobra).
create or replace function public.sorteo_reserva_de(p public.sorteo_participantes)
returns uuid language plpgsql security definer set search_path = public as $$
declare s public.sorteos; r public.evento_reservas; v_art uuid;
begin
  select * into s from public.sorteos where id = p.sorteo_id;
  if s.id is null or s.evento_id is null or s.precio_entrada is null then return p.reserva_id; end if;
  -- El artículo "Entrada" del evento (se crea la primera vez)
  v_art := s.articulo_id;
  if v_art is not null and not exists (select 1 from public.evento_articulos where id = v_art and evento_id = s.evento_id) then v_art := null; end if;
  if v_art is null then
    insert into public.evento_articulos (evento_id, nombre, precio, con_talla) values (s.evento_id, 'Entrada', s.precio_entrada, false) returning id into v_art;
    perform set_config('bs.sorteo_rpc', '1', true);
    update public.sorteos set articulo_id = v_art where id = s.id;
    perform set_config('bs.sorteo_rpc', '', true);
  elsif (select precio from public.evento_articulos where id = v_art) is distinct from s.precio_entrada then
    update public.evento_articulos set precio = s.precio_entrada where id = v_art;
  end if;
  if p.reserva_id is not null then select * into r from public.evento_reservas where id = p.reserva_id; end if;
  if r.id is not null and r.estado = 'pagada' then return r.id; end if;   -- pagada: no se toca
  if r.id is not null and r.articulo_id = v_art then
    update public.evento_reservas set alumna_id = p.alumna_id, comprador = case when p.alumna_id is null then p.nombre end,
      cantidad = p.entradas, importe = p.entradas * s.precio_entrada, estado = 'reservada', nota = 'Sorteo de entradas'
    where id = r.id;
    return r.id;
  end if;
  if r.id is not null then delete from public.evento_reservas where id = r.id; end if;   -- era de otro evento
  insert into public.evento_reservas (evento_id, articulo_id, alumna_id, comprador, cantidad, importe, nota)
  values (s.evento_id, v_art, p.alumna_id, case when p.alumna_id is null then p.nombre end, p.entradas, p.entradas * s.precio_entrada, 'Sorteo de entradas')
  returning id into r.id;
  return r.id;
end $$;

-- Al apuntar o cambiar a alguien, su venta se crea o se pone al día. Si ya pagó, sus entradas no cambian.
create or replace function public.sorteo_part_reserva()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_estado text;
begin
  if tg_op = 'UPDATE' then
    if coalesce(current_setting('bs.renumerar', true), '') = '1' then return new; end if;
    if new.reserva_id is distinct from old.reserva_id and coalesce(current_setting('bs.sorteo_sync', true), '') <> '1' then new.reserva_id := old.reserva_id; end if;
    select estado into v_estado from public.evento_reservas where id = old.reserva_id;
    if v_estado = 'pagada' and new.entradas <> old.entradas then
      raise exception 'Ya ha pagado sus entradas: para cambiarlas, primero hay que deshacer el pago (solo la administración).';
    end if;
  else
    new.reserva_id := null;
  end if;
  new.reserva_id := public.sorteo_reserva_de(new);
  return new;
end $$;
drop trigger if exists sorteo_part_reserva on public.sorteo_participantes;
create trigger sorteo_part_reserva before insert or update on public.sorteo_participantes
  for each row execute function public.sorteo_part_reserva();

-- Quitar a alguien: si ya pagó, no se puede; si no, se quita también su venta pendiente
create or replace function public.sorteo_part_quitar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.sorteos where id = old.sorteo_id) then return old; end if;   -- se borra el sorteo entero
  if exists (select 1 from public.evento_reservas where id = old.reserva_id and estado = 'pagada') then
    raise exception 'Ya ha pagado sus entradas: para quitarla, primero hay que deshacer el pago (solo la administración).';
  end if;
  return old;
end $$;
drop trigger if exists sorteo_part_quitar on public.sorteo_participantes;
create trigger sorteo_part_quitar before delete on public.sorteo_participantes
  for each row execute function public.sorteo_part_quitar();
create or replace function public.sorteo_part_quitada()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.evento_reservas where id = old.reserva_id and estado = 'reservada';
  return old;
end $$;
drop trigger if exists sorteo_part_quitada on public.sorteo_participantes;
create trigger sorteo_part_quitada after delete on public.sorteo_participantes
  for each row execute function public.sorteo_part_quitada();

-- Al poner o cambiar el evento o el precio, todas las apuntadas pasan (o se ponen al día) en Caja
create or replace function public.sorteo_resincronizar()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.sorteo_participantes;
begin
  if new.evento_id is not distinct from old.evento_id and new.precio_entrada is not distinct from old.precio_entrada then return new; end if;
  if new.evento_id is distinct from old.evento_id or new.precio_entrada is null then
    -- Cambia de evento o deja de cobrar: fuera las ventas pendientes de antes
    delete from public.evento_reservas where id in (select reserva_id from public.sorteo_participantes where sorteo_id = new.id) and estado = 'reservada';
  end if;
  for p in select * from public.sorteo_participantes where sorteo_id = new.id order by numero loop
    perform set_config('bs.sorteo_sync', '1', true);
    update public.sorteo_participantes set reserva_id = public.sorteo_reserva_de(p) where id = p.id;
    perform set_config('bs.sorteo_sync', '', true);
  end loop;
  return new;
end $$;
drop trigger if exists sorteo_resincronizar on public.sorteos;
create trigger sorteo_resincronizar after update on public.sorteos
  for each row execute function public.sorteo_resincronizar();
-- (un sorteo nuevo que ya trae evento y precio no tiene a nadie todavía: no hace falta nada al crearlo)

-- Autorización de la administración para cerrar la lista aunque falte alguna por pagar
create or replace function public.autorizar_cierre_sin_pagar(p_id uuid, p_si boolean default true)
returns public.sorteos language plpgsql security definer set search_path = public as $$
declare s public.sorteos;
begin
  if not public.es_admin() then raise exception 'Solo la administración puede autorizarlo.'; end if;
  select * into s from public.sorteos where id = p_id for update;
  if s.estado is distinct from 'abierto' then raise exception 'La lista ya está cerrada.'; end if;
  perform set_config('bs.sorteo_rpc', '1', true);
  update public.sorteos set cerrar_sin_pagar = p_si,
    autorizado_en = case when p_si then now() end,
    autorizado_nombre = case when p_si then (select nombre from public.perfiles where id = auth.uid()) end
  where id = p_id returning * into s;
  perform set_config('bs.sorteo_rpc', '', true);
  return s;
end $$;

-- Cerrar la lista: como en la 044, y además todas pagadas (o autorizado)
create or replace function public.cerrar_lista_sorteo(p_id uuid)
returns public.sorteos language plpgsql security definer set search_path = public as $$
declare s public.sorteos; v_n int; v_e int; v_sin int;
begin
  if not public.puede_sortear() then raise exception 'No tienes permiso para cerrar la lista.'; end if;
  select * into s from public.sorteos where id = p_id for update;
  if s.id is null then raise exception 'Ese sorteo no existe.'; end if;
  if s.estado <> 'abierto' then raise exception 'La lista ya estaba cerrada.'; end if;
  select count(*), coalesce(sum(entradas), 0) into v_n, v_e from public.sorteo_participantes where sorteo_id = p_id;
  if v_n < 1 then raise exception 'No hay nadie apuntado.'; end if;
  if s.precio_entrada is not null and s.evento_id is not null and not s.cerrar_sin_pagar then
    select count(*) into v_sin from public.sorteo_participantes sp left join public.evento_reservas r on r.id = sp.reserva_id
    where sp.sorteo_id = p_id and coalesce(r.estado, '') <> 'pagada';
    if v_sin > 0 then raise exception 'Faltan % por pagar. Cóbralas o pide a la administración que autorice cerrar igualmente.', v_sin; end if;
  end if;
  perform set_config('bs.sorteo_rpc', '1', true);
  update public.sorteos set estado = 'cerrado', huella = public.sorteo_huella_de(p_id), alumnas_n = v_n, entradas_n = v_e,
    cerrado_en = now(), cerrado_por = auth.uid(), cerrado_nombre = (select nombre from public.perfiles where id = auth.uid())
  where id = p_id returning * into s;
  perform set_config('bs.sorteo_rpc', '', true);
  return s;
end $$;

-- Al volver a abrir una lista, la autorización se quita (hay que darla otra vez si hace falta)
create or replace function public.reabrir_lista_sorteo(p_id uuid)
returns public.sorteos language plpgsql security definer set search_path = public as $$
declare s public.sorteos;
begin
  if not public.puede_sortear() then raise exception 'No tienes permiso para abrir la lista.'; end if;
  select * into s from public.sorteos where id = p_id for update;
  if s.estado is distinct from 'cerrado' then raise exception 'Solo se puede abrir una lista cerrada que aún no se ha sorteado.'; end if;
  perform set_config('bs.sorteo_rpc', '1', true);
  update public.sorteos set estado = 'abierto', huella = null, alumnas_n = null, entradas_n = null,
    cerrado_en = null, cerrado_por = null, cerrado_nombre = null,
    cerrar_sin_pagar = false, autorizado_en = null, autorizado_nombre = null where id = p_id returning * into s;
  perform set_config('bs.sorteo_rpc', '', true);
  return s;
end $$;

revoke all on function public.sorteo_reserva_de(public.sorteo_participantes), public.sorteo_part_reserva(), public.sorteo_part_quitar(),
  public.sorteo_part_quitada(), public.sorteo_resincronizar() from public, anon, authenticated;
revoke all on function public.autorizar_cierre_sin_pagar(uuid, boolean) from public, anon;
grant execute on function public.autorizar_cierre_sin_pagar(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
