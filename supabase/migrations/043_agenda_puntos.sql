-- 043 · Agenda: "Puntos a tratar" dentro de cada tema (lista de notas con casilla de hecho).
-- Solo añade una columna. No toca datos existentes.
-- Formato: [{"t": "Hora de salida al escenario", "ok": false}, ...]

alter table public.agenda_temas add column if not exists puntos jsonb not null default '[]'::jsonb;
alter table public.agenda_temas drop constraint if exists agenda_temas_puntos_lista;
alter table public.agenda_temas add constraint agenda_temas_puntos_lista check (jsonb_typeof(puntos) = 'array' and jsonb_array_length(puntos) <= 200);

notify pgrst, 'reload schema';
