-- 040 · Escuela amiga: enlace para la historia de Instagram
-- La chica toca el enlace de la historia, pone su nombre y su teléfono, acepta la privacidad y ve la información.
-- Entra sola en Interesadas (con la etiqueta Instagram) y llega un aviso a quien ve Escuelas amigas (Raúl, Adela…).
-- Después, desde la app, «Enviar información» abre el WhatsApp normal de quien lo pulsa con el mensaje ya escrito.
-- Solo se añaden columnas y funciones nuevas. No se toca ningún dato.

-- Enlace corto de cada código (ej. ?r=ritmo-latino)
alter table public.escuela_codigos add column if not exists enlace text;
create unique index if not exists escuela_codigos_enlace on public.escuela_codigos (enlace);

-- De dónde viene cada interesada y si aceptó la privacidad
alter table public.escuela_interesadas add column if not exists origen text;
alter table public.escuela_interesadas add column if not exists acepta_privacidad boolean;

-- El enlace se crea solo con el nombre de la clase (o el código) si está vacío
create or replace function public.escuela_codigos_enlace() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_base text; v_enlace text; n int := 1;
begin
  if new.enlace is null or trim(new.enlace) = '' then
    v_base := lower(translate(coalesce(nullif(trim(new.clase), ''), new.codigo), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'));
    v_base := trim(both '-' from regexp_replace(v_base, '[^a-z0-9]+', '-', 'g'));
    if v_base = '' then v_base := 'clase'; end if;
    v_enlace := left(v_base, 40);
    while exists (select 1 from public.escuela_codigos where enlace = v_enlace and id <> new.id) loop
      n := n + 1; v_enlace := left(v_base, 37) || '-' || n;
    end loop;
    new.enlace := v_enlace;
  end if;
  return new;
end $$;
drop trigger if exists escuela_codigos_enlace on public.escuela_codigos;
create trigger escuela_codigos_enlace before insert or update on public.escuela_codigos
  for each row execute function public.escuela_codigos_enlace();
update public.escuela_codigos set enlace = null where enlace is null;   -- crea el enlace de los códigos que ya existen

-- Página pública: datos de la clase (sin cuenta). Solo devuelve lo que se ve en la página.
create or replace function public.escuela_registro_publico(p_enlace text)
returns table (clase text, profesora text, codigo text, euros numeric, quedan int)
language sql stable security definer set search_path = public as $$
  select c.clase, c.profesora, c.codigo, c.euros,
         greatest(0, c.plazas - (select count(*) from public.escuela_interesadas i
                                  where i.escuela_amiga_id = c.escuela_amiga_id and i.inscrita_en is not null))::int
  from public.escuela_codigos c
  where c.enlace = p_enlace and c.activo;
$$;

-- Página pública: apuntarse. Nunca toca las tablas directamente.
create or replace function public.escuela_apuntarse(p_enlace text, p_nombre text, p_telefono text, p_acepta boolean)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare c public.escuela_codigos; v_nombre text := trim(coalesce(p_nombre, '')); v_tel text := regexp_replace(coalesce(p_telefono, ''), '[^0-9+]', '', 'g');
begin
  select * into c from public.escuela_codigos where enlace = p_enlace and activo;
  if c.id is null then raise exception 'Este enlace ya no está disponible'; end if;
  if not coalesce(p_acepta, false) then raise exception 'Hay que aceptar el aviso de privacidad'; end if;
  if length(v_nombre) < 2 or length(v_nombre) > 80 then raise exception 'Escribe tu nombre'; end if;
  if length(regexp_replace(v_tel, '\D', '', 'g')) not between 9 and 15 then raise exception 'Revisa el teléfono'; end if;
  -- Freno contra envíos en masa
  if (select count(*) from public.escuela_interesadas where escuela_amiga_id = c.escuela_amiga_id and origen = 'instagram'
      and creado_en > now() - interval '1 hour') >= 60 then
    raise exception 'Ahora mismo hay muchas solicitudes. Inténtalo en un rato';
  end if;
  -- Si ya estaba apuntada con ese teléfono, no se repite
  if exists (select 1 from public.escuela_interesadas where escuela_amiga_id = c.escuela_amiga_id
             and regexp_replace(coalesce(telefono, ''), '\D', '', 'g') = regexp_replace(v_tel, '\D', '', 'g')) then
    return;
  end if;
  insert into public.escuela_interesadas (escuela_amiga_id, nombre, telefono, origen, acepta_privacidad)
  values (c.escuela_amiga_id, v_nombre, v_tel, 'instagram', true);
  perform public.avisar_modulo('escuelas_amigas', 'aviso', 'Nueva interesada en ' || coalesce(nullif(c.clase, ''), 'la escuela amiga'),
    v_nombre || ' · ' || v_tel || ' · desde Instagram. Envíale la información por WhatsApp.', '#/escuela/' || c.escuela_amiga_id);
end $$;

revoke all on function public.escuela_codigos_enlace() from public, anon;
revoke all on function public.escuela_registro_publico(text) from public;
revoke all on function public.escuela_apuntarse(text, text, text, boolean) from public;
grant execute on function public.escuela_registro_publico(text) to anon, authenticated;
grant execute on function public.escuela_apuntarse(text, text, text, boolean) to anon, authenticated;
