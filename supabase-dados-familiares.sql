-- Executar antes de publicar o formulário atualizado. Currículos antigos permanecem sem resposta.
alter table public.job_applications
  add column if not exists marital_status text,
  add column if not exists receives_aid boolean,
  add column if not exists has_children boolean,
  add column if not exists children_count integer check (children_count >= 0);
