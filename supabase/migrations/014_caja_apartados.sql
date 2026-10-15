-- 014 · Apartados de la caja: de dónde viene cada ingreso y en qué se va cada gasto.
-- Ingresos: mensualidad, evento, ventas (camisetas…), escuela amiga, otro.
-- Gastos: limpieza, papelería, material, local (alquiler, luz, agua), evento, otro.
-- Un movimiento de un evento se liga al evento: así cada evento tiene su propia caja.
-- No se borra nada: solo se añaden dos columnas y se rellenan las de los movimientos que ya hay.

alter table public.caja
  add column apartado  text check (apartado in ('mensualidad','evento','ventas','escuela_amiga','limpieza','papeleria','material','local','otro')),
  add column evento_id uuid references public.eventos(id) on delete set null;

update public.caja set apartado = case
  when escuela_amiga_id is not null then 'escuela_amiga'
  when tipo = 'ingreso' and clase_id is not null then 'mensualidad'
  else 'otro' end
where apartado is null;

create index caja_evento_idx on public.caja (evento_id) where evento_id is not null;

-- La vista con autor se rehace para que incluya las columnas nuevas
drop view if exists public.caja_con_autor;
create view public.caja_con_autor with (security_invoker = true) as
  select c.*, p.nombre as registrado_por
  from public.caja c left join public.perfiles p on p.id = c.creado_por;
grant select on public.caja_con_autor to authenticated;
revoke all on public.caja_con_autor from anon;
