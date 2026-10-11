-- black-star · ajustes aplicados después del esquema v3 (2026-10-11)
alter extension btree_gist set schema extensions;
alter function public.auditar() set search_path = public;
revoke all on function public.auditar() from public, anon, authenticated;
revoke all on function public.crear_perfil_nuevo() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['public.es_admin()','public.puede_ver(text)','public.puede_escribir(text)',
                           'public.solo_propias(text)','public.mis_clases()','public.mis_alumnas()','public.mis_eventos()']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon;
