-- 017 · Caja: apartado "Cambio" (dinero que recepción saca de la caja para tener cambio y repone a fin de mes)
-- y apartado "Decoración" en gastos. El cambio no cuenta como gasto: se ve aparte hasta que se marca "Devuelto".
-- No se borra nada: se amplía la lista de apartados y se añade una columna.

alter table public.caja drop constraint if exists caja_apartado_check;
alter table public.caja add constraint caja_apartado_check
  check (apartado in ('mensualidad','evento','ventas','escuela_amiga','limpieza','papeleria','decoracion','material','local','cambio','otro'));
alter table public.caja add column if not exists devuelto_en date;

-- La vista con autor se rehace para que incluya la columna nueva
drop view if exists public.caja_con_autor;
create view public.caja_con_autor with (security_invoker = true) as
  select c.*, p.nombre as registrado_por
  from public.caja c left join public.perfiles p on p.id = c.creado_por;
grant select on public.caja_con_autor to authenticated;
revoke all on public.caja_con_autor from anon;
