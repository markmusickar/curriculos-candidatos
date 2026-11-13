-- Novas perguntas do formulário "Trabalhe conosco". Rode no SQL Editor do Supabase, ANTES de publicar o site novo.
-- Pode rodar mais de uma vez. Rode depois do arquivo supabase-seguranca-curriculos.sql (este refaz os limites com as colunas novas).

alter table public.job_applications
  add column if not exists education text,
  add column if not exists start_availability text,
  add column if not exists experience_time text,
  add column if not exists worked_here_before text,
  add column if not exists last_job text,
  add column if not exists skills text,
  add column if not exists references_info text,
  add column if not exists how_found text,
  add column if not exists lgpd_consent boolean not null default false;

-- Limites de tamanho (NOT VALID: vale para os novos envios, sem travar os currículos antigos).
alter table public.job_applications drop constraint if exists job_applications_limites;
alter table public.job_applications
  add constraint job_applications_limites check (
    char_length(full_name) between 1 and 120
    and char_length(phone) between 1 and 30
    and char_length(city) between 1 and 80
    and (neighborhood is null or char_length(neighborhood) <= 80)
    and char_length(desired_role) between 1 and 60
    and (market_experience is null or char_length(market_experience) <= 20)
    and char_length(availability) between 1 and 40
    and (requirements is null or char_length(requirements) <= 800)
    and (experience is null or char_length(experience) <= 2000)
    and (notes is null or char_length(notes) <= 2000)
    and (marital_status is null or char_length(marital_status) <= 40)
    and (photo_path is null or char_length(photo_path) <= 200)
    and (age is null or age between 14 and 90)
    and (children_count is null or children_count <= 30)
    and (education is null or char_length(education) <= 60)
    and (start_availability is null or char_length(start_availability) <= 60)
    and (experience_time is null or char_length(experience_time) <= 60)
    and (worked_here_before is null or char_length(worked_here_before) <= 10)
    and (last_job is null or char_length(last_job) <= 150)
    and (skills is null or char_length(skills) <= 600)
    and (references_info is null or char_length(references_info) <= 400)
    and (how_found is null or char_length(how_found) <= 60)
  ) not valid;
