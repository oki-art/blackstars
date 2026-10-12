-- 009 · Normas: orden propio para poder subirlas y bajarlas en la app.
-- Las nuevas van al final (por la hora en que se crean); las que ya hay mantienen su orden actual.
alter table public.normas add column if not exists orden double precision not null default extract(epoch from now());
update public.normas set orden = extract(epoch from creado_en) where orden is not null;
