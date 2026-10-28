-- =====================================================================
-- Académie UNIS Togo : schéma de la base Supabase
-- À exécuter une seule fois dans Supabase > SQL Editor > New query.
--
-- Principe de sécurité :
--   * le site ne peut RIEN écrire directement dans les tables ;
--   * toute écriture passe par des fonctions qui vérifient les droits,
--     l'ordre des étapes et les bonnes réponses côté serveur ;
--   * les bonnes réponses (answer_keys) ne sont jamais lisibles depuis le site.
-- =====================================================================

-- ---------- Tables ----------

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  structure   text not null default '',
  fonction    text not null default '',
  role        text not null default 'apprenant' check (role in ('apprenant','admin')),
  approved    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.progress (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  module_id    text not null,
  seq          boolean[] not null default array[false,false,false,false,false],
  quiz_passed  boolean not null default false,
  quiz_best    int,
  attest_date  date,
  attest_name  text,
  attest_code  text unique,
  updated_at   timestamptz not null default now(),
  primary key (user_id, module_id)
);

-- Bonnes réponses. kind = 'seq' (idx 0 à 4) ou 'quiz' (idx 0, 1, 2…).
-- answer = position de la bonne option dans content.json, en comptant à partir de 0.
create table if not exists public.answer_keys (
  module_id  text not null,
  kind       text not null check (kind in ('seq','quiz')),
  idx        int  not null,
  answer     int  not null,
  primary key (module_id, kind, idx)
);

alter table public.profiles    enable row level security;
alter table public.progress    enable row level security;
alter table public.answer_keys enable row level security;

-- ---------- Fonctions utilitaires ----------

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin' and approved);
$$;

create or replace function public._require_approved() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Vous n''êtes pas connecté.'; end if;
  if not exists (select 1 from public.profiles where id = uid and approved) then
    raise exception 'Votre compte n''est pas encore validé.';
  end if;
  return uid;
end $$;

-- ---------- Lecture : chacun voit ses données, les admins voient tout ----------

drop policy if exists "profils lisibles par soi ou admin" on public.profiles;
create policy "profils lisibles par soi ou admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists "progression lisible par soi ou admin" on public.progress;
create policy "progression lisible par soi ou admin" on public.progress
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Aucune policy sur answer_keys, et aucune policy d'écriture nulle part :
-- ces opérations sont donc refusées depuis le site.

-- ---------- Création automatique du profil à l'inscription ----------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, structure, fonction)
  values (
    new.id, new.email,
    left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120),
    left(coalesce(new.raw_user_meta_data->>'structure', ''), 120),
    left(coalesce(new.raw_user_meta_data->>'fonction',  ''), 120)
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Valider une séquence ----------

create or replace function public.submit_sequence(p_module text, p_seq int, p_choice int)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  uid  uuid := public._require_approved();
  good int;
  s    boolean[];
begin
  if p_seq < 0 or p_seq > 4 then raise exception 'Séquence invalide.'; end if;

  select answer into good from public.answer_keys
   where module_id = p_module and kind = 'seq' and idx = p_seq;
  if good is null then raise exception 'Question inconnue pour ce module.'; end if;

  insert into public.progress (user_id, module_id) values (uid, p_module)
  on conflict do nothing;

  select seq into s from public.progress
   where user_id = uid and module_id = p_module for update;

  if p_seq > 0 and not coalesce(s[p_seq], false) then
    raise exception 'Validez d''abord la séquence précédente.';
  end if;

  if p_choice is distinct from good then return false; end if;

  s[p_seq + 1] := true;
  update public.progress set seq = s, updated_at = now()
   where user_id = uid and module_id = p_module;
  return true;
end $$;

-- ---------- Corriger le quiz ----------
-- Renvoie le score et, pour chaque question, juste ou faux
-- (sans révéler la bonne réponse).

create or replace function public.submit_quiz(p_module text, p_answers int[])
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid    uuid := public._require_approved();
  s      boolean[];
  total  int;
  score  int := 0;
  res    boolean[] := '{}';
  k      record;
  needed int;
  passed boolean;
begin
  select seq into s from public.progress where user_id = uid and module_id = p_module;
  if s is null or not (true = all(s)) then
    raise exception 'Validez les cinq séquences avant le quiz.';
  end if;

  select count(*) into total from public.answer_keys
   where module_id = p_module and kind = 'quiz';
  if total = 0 then raise exception 'Quiz introuvable pour ce module.'; end if;
  if coalesce(array_length(p_answers, 1), 0) <> total then
    raise exception 'Répondez à toutes les questions.';
  end if;

  for k in select idx, answer from public.answer_keys
            where module_id = p_module and kind = 'quiz' order by idx loop
    if p_answers[k.idx + 1] = k.answer then
      score := score + 1; res := res || true;
    else
      res := res || false;
    end if;
  end loop;

  needed := ceil(total * 0.75);
  passed := score >= needed;

  update public.progress
     set quiz_passed = quiz_passed or passed,
         quiz_best   = greatest(coalesce(quiz_best, 0), score),
         updated_at  = now()
   where user_id = uid and module_id = p_module;

  return jsonb_build_object('score', score, 'total', total, 'needed', needed,
                            'passed', passed, 'correct', to_jsonb(res));
end $$;

-- ---------- Délivrer l'attestation ----------

create or replace function public.issue_attestation(p_module text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._require_approved();
  r   public.progress%rowtype;
begin
  select * into r from public.progress
   where user_id = uid and module_id = p_module for update;
  if not found or not r.quiz_passed then
    raise exception 'Réussissez le quiz avant de demander l''attestation.';
  end if;

  if r.attest_code is null then
    select full_name into r.attest_name from public.profiles where id = uid;
    r.attest_date := current_date;
    r.attest_code := 'UNIS-' || upper(p_module) || '-'
                     || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    update public.progress
       set attest_date = r.attest_date, attest_name = r.attest_name,
           attest_code = r.attest_code, updated_at = now()
     where user_id = uid and module_id = p_module;
  end if;

  return jsonb_build_object('date', r.attest_date, 'code', r.attest_code, 'name', r.attest_name);
end $$;

-- ---------- Vérification publique d'une attestation ----------

create or replace function public.verify_attestation(p_code text)
returns table (full_name text, module_id text, attest_date date)
language sql stable security definer set search_path = public as $$
  select g.attest_name, g.module_id, g.attest_date
    from public.progress g
   where g.attest_code = upper(trim(p_code))
   limit 1;
$$;

-- ---------- Administration des comptes ----------

create or replace function public.admin_set_user(p_user uuid, p_approved boolean, p_role text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Action réservée aux administrateurs.'; end if;
  if p_role not in ('apprenant','admin') then raise exception 'Rôle invalide.'; end if;
  if p_user = auth.uid() then raise exception 'Vous ne pouvez pas modifier votre propre compte.'; end if;
  update public.profiles
     set approved = p_approved,
         role     = case when p_approved then p_role else 'apprenant' end
   where id = p_user;
end $$;

-- ---------- Droits d'exécution ----------

revoke all on function public._require_approved()                    from public, anon, authenticated;
revoke all on function public.handle_new_user()                      from public, anon, authenticated;
revoke all on function public.is_admin()                             from public, anon;
revoke all on function public.submit_sequence(text, int, int)        from public, anon;
revoke all on function public.submit_quiz(text, int[])               from public, anon;
revoke all on function public.issue_attestation(text)                from public, anon;
revoke all on function public.admin_set_user(uuid, boolean, text)    from public, anon;

grant execute on function public.is_admin()                          to authenticated;
grant execute on function public.submit_sequence(text, int, int)     to authenticated;
grant execute on function public.submit_quiz(text, int[])            to authenticated;
grant execute on function public.issue_attestation(text)             to authenticated;
grant execute on function public.admin_set_user(uuid, boolean, text) to authenticated;
grant execute on function public.verify_attestation(text)            to anon, authenticated;

-- ---------- Bonnes réponses des modules rédigés ----------

insert into public.answer_keys (module_id, kind, idx, answer) values
  ('TC1','seq',0,1),('TC1','seq',1,2),('TC1','seq',2,3),('TC1','seq',3,0),('TC1','seq',4,1),
  ('TC1','quiz',0,1),('TC1','quiz',1,2),('TC1','quiz',2,3),('TC1','quiz',3,0),
  ('TC2','seq',0,2),('TC2','seq',1,3),('TC2','seq',2,0),('TC2','seq',3,1),('TC2','seq',4,2),
  ('TC2','quiz',0,2),('TC2','quiz',1,0),('TC2','quiz',2,3),('TC2','quiz',3,1),
  ('AN1','seq',0,2),('AN1','seq',1,1),('AN1','seq',2,3),('AN1','seq',3,2),('AN1','seq',4,0),
  ('AN1','quiz',0,0),('AN1','quiz',1,1),('AN1','quiz',2,2),('AN1','quiz',3,3)
on conflict (module_id, kind, idx) do update set answer = excluded.answer;

-- =====================================================================
-- APRÈS avoir créé votre propre compte sur le site, exécutez cette ligne
-- (avec votre email) pour devenir le premier administrateur :
--
--   update public.profiles set role = 'admin', approved = true
--    where email = 'votre.email@exemple.tg';
-- =====================================================================
