create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  age integer,
  city text not null,
  neighborhood text,
  desired_role text not null,
  market_experience text,
  availability text not null,
  requirements text,
  experience text,
  notes text,
  photo_path text,
  photo_url text,
  source text not null default 'formulario_web',
  status text not null default 'novo',
  created_at timestamptz not null default now()
);

alter table public.job_applications
add column if not exists requirements text;

alter table public.job_applications enable row level security;

drop policy if exists "candidato envia curriculo" on public.job_applications;
create policy "candidato envia curriculo"
on public.job_applications for insert
to anon
with check (true);

drop policy if exists "admin ve curriculos" on public.job_applications;
create policy "admin ve curriculos"
on public.job_applications for select
to authenticated
using (public.my_role() = 'admin');

drop policy if exists "admin atualiza curriculos" on public.job_applications;
create policy "admin atualiza curriculos"
on public.job_applications for update
to authenticated
using (public.my_role() = 'admin')
with check (public.my_role() = 'admin');

insert into storage.buckets (id, name, public)
values ('candidato-fotos', 'candidato-fotos', true)
on conflict (id) do nothing;

drop policy if exists "candidato envia foto" on storage.objects;
create policy "candidato envia foto"
on storage.objects for insert
to anon
with check (bucket_id = 'candidato-fotos');

drop policy if exists "admin ve fotos candidato" on storage.objects;
create policy "admin ve fotos candidato"
on storage.objects for select
to authenticated
using (bucket_id = 'candidato-fotos' and public.my_role() = 'admin');
