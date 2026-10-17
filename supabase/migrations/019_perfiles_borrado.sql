-- 019 · Personas borradas del equipo
-- Al borrar a alguien (servicio borrar-acceso) su perfil no se elimina: se marca la fecha
-- para que deje de salir en Equipo, y lo que apuntó sigue diciendo quién lo hizo.
alter table public.perfiles add column if not exists borrado_en timestamptz;
