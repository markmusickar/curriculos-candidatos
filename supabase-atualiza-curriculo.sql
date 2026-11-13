-- Quando alguém envia um currículo com um telefone que já existe, o cadastro antigo é ATUALIZADO
-- (em vez de criar um segundo). A versão anterior fica guardada em "previous_versions" (últimas 5).
-- Precisa ter rodado antes: supabase.sql, supabase-seguranca-curriculos.sql e supabase-novas-perguntas.sql.

alter table public.job_applications
  add column if not exists updated_at timestamptz,
  add column if not exists update_count integer not null default 0,
  add column if not exists previous_versions jsonb not null default '[]'::jsonb;

-- Telefone só com números, sem o 55 do Brasil (para (81) 99999-9999 e +55 81 99999-9999 contarem como o mesmo).
alter table public.job_applications
  add column if not exists phone_key text generated always as (
    case
      when length(regexp_replace(phone, '\D', '', 'g')) > 11 and regexp_replace(phone, '\D', '', 'g') like '55%'
        then substr(regexp_replace(phone, '\D', '', 'g'), 3)
      else regexp_replace(phone, '\D', '', 'g')
    end
  ) stored;

create index if not exists job_applications_phone_key_idx on public.job_applications (phone_key);

create or replace function public.merge_duplicate_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row public.job_applications%rowtype;
  snapshot jsonb;
  history jsonb;
begin
  -- Evita que dois envios ao mesmo tempo com o mesmo telefone criem duplicata.
  perform pg_advisory_xact_lock(hashtext(new.phone_key));

  select * into old_row
  from public.job_applications
  where phone_key = new.phone_key and id <> new.id
  order by created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  snapshot := to_jsonb(old_row) - 'previous_versions' - 'phone_key';
  history := old_row.previous_versions || jsonb_build_array(snapshot);
  select coalesce(jsonb_agg(e order by i), '[]'::jsonb) into history
  from (select e, i from jsonb_array_elements(history) with ordinality as t(e, i) order by i desc limit 5) s;

  update public.job_applications set
    full_name = new.full_name,
    phone = new.phone,
    age = new.age,
    city = new.city,
    neighborhood = new.neighborhood,
    desired_role = new.desired_role,
    market_experience = new.market_experience,
    availability = new.availability,
    requirements = new.requirements,
    experience = new.experience,
    notes = new.notes,
    education = new.education,
    start_availability = new.start_availability,
    experience_time = new.experience_time,
    store_experience = new.store_experience,
    last_job = new.last_job,
    skills = new.skills,
    references_info = new.references_info,
    how_found = new.how_found,
    lgpd_consent = new.lgpd_consent,
    photo_path = new.photo_path,
    photo_url = new.photo_url,
    updated_at = now(),
    update_count = old_row.update_count + 1,
    previous_versions = history
  where id = old_row.id;

  -- O envio novo já passou pelas regras de segurança; agora ele só serve para atualizar o antigo.
  delete from public.job_applications where id = new.id;
  return null;
end;
$$;

revoke all on function public.merge_duplicate_application() from public, anon, authenticated;

drop trigger if exists merge_duplicate_application on public.job_applications;
create trigger merge_duplicate_application
after insert on public.job_applications
for each row execute function public.merge_duplicate_application();
