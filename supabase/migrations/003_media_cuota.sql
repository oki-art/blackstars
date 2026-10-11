-- 003 · Alumnas que pagan media mensualidad (solo añade una columna; no borra nada).
alter table public.alumnas
  add column if not exists cuota text not null default 'completa' check (cuota in ('completa', 'media'));
comment on column public.alumnas.cuota is 'completa = mensualidad entera; media = paga medio mes';
