-- Run once on a fresh Supabase project. No admin user or password is hardcoded.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.admin_users (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
create policy "read own admin membership" on public.admin_users for select to authenticated using (user_id=auth.uid());
grant select on public.admin_users to authenticated;
revoke all on public.admin_users from anon;
revoke insert,update,delete on public.admin_users from authenticated;

create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.admin_users where user_id=(select auth.uid()));
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon,authenticated,service_role;

create function public.web_url(value text) returns boolean language sql immutable set search_path='' as $$
 select value = '' or (length(value)<=2000 and value ~ '^https?://[^[:space:]<>]+$');
$$;
create function public.valid_skills(value jsonb) returns boolean language sql immutable set search_path='' as $$
 select case when jsonb_typeof(value)<>'object' then false else
  not exists(select 1 from jsonb_each(value) e where jsonb_typeof(e.value)<>'array')
  and not exists(select 1 from jsonb_each(value) e cross join lateral jsonb_array_elements(case when jsonb_typeof(e.value)='array' then e.value else '[]'::jsonb end) a where jsonb_typeof(a.value)<>'string') end;
$$;
create function public.touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now();return new;end;$$;

create table public.profile (
 id boolean primary key default true check(id=true),
 name text not null check(length(name) between 1 and 200),
 title text not null check(length(title) between 1 and 500),
 introduction text not null check(length(introduction) between 1 and 5000),
 location text not null, degree text not null, institution text not null, current_year text not null,
 github text not null default '' check(public.web_url(github)),
 linkedin text not null default '' check(public.web_url(linkedin)),
 leetcode text not null default '' check(public.web_url(leetcode)),
 email text not null default '' check(email='' or (length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
 skills jsonb not null default '{}' check(public.valid_skills(skills) and octet_length(skills::text)<65536),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.projects (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 200),
 subtitle text not null default '', description text not null check(length(description) between 1 and 5000),
 technologies text[] not null default '{}', features text[] not null default '{}',
 github_url text not null default '' check(public.web_url(github_url)), demo_url text not null default '' check(public.web_url(demo_url)),
 thumbnail_path text unique, visual text not null default 'signal' check(visual in ('signal','orb','nodes')),
 featured boolean not null default false, published boolean not null default true, sort_order integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.certificate_categories (
 id uuid primary key default gen_random_uuid(),name text unique not null check(length(trim(name)) between 1 and 80)
);
create table public.certificates (
 id uuid primary key default gen_random_uuid(),title text not null check(length(title) between 1 and 200),
 issuer text not null check(length(issuer) between 1 and 500),issue_date date not null,
 certificate_id text not null default '',category text not null references public.certificate_categories(name) on update cascade on delete restrict,
 verification_url text not null default '' check(public.web_url(verification_url)),
 file_path text unique not null, file_name text not null,
 mime_type text not null check(mime_type in ('application/pdf','image/png','image/jpeg','image/webp')),
 published boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.achievements (
 id uuid primary key default gen_random_uuid(),title text not null check(length(title) between 1 and 200),
 description text not null check(length(description) between 1 and 5000),
 category text not null check(category in ('Hackathons','Coding competitions','Academic achievements','Technical events','Workshops','Internships')),
 date date not null,organization text not null default '',url text not null default '' check(public.web_url(url)),
 published boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.resumes (
 id boolean primary key default true check(id=true),title text not null check(length(title) between 1 and 200),
 file_path text unique not null,file_name text not null,mime_type text not null default 'application/pdf' check(mime_type='application/pdf'),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.messages (
 id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 100),
 email text not null check(length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 subject text not null check(length(subject) between 1 and 160),message text not null check(length(message) between 10 and 5000),
 created_at timestamptz not null default now()
);
create index certificates_category_date_idx on public.certificates(category,issue_date desc);
create index projects_order_idx on public.projects(featured desc,sort_order);
create index achievements_date_idx on public.achievements(date desc);
create index messages_date_idx on public.messages(created_at desc);

do $$ declare t text; begin
 foreach t in array array['profile','projects','certificates','achievements','resumes','certificate_categories','messages'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('create policy "administrators manage content" on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',t);
  if t<>'messages' then
   execute format('grant select on public.%I to anon',t);
   if t in ('projects','certificates','achievements') then
    execute format('create policy "public reads published content" on public.%I for select to anon,authenticated using (published=true)',t);
   else
    execute format('create policy "public reads profile and metadata" on public.%I for select to anon,authenticated using (true)',t);
   end if;
  else
   execute 'revoke all on public.messages from anon';
  end if;
  if t not in ('messages','certificate_categories') then
   execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',t);
  end if;
 end loop;
end $$;
-- Explicitly grant the service role the table privileges its Edge Functions need.
grant select,insert,update,delete on public.profile,public.projects,public.certificates,public.achievements,public.resumes,public.certificate_categories,public.messages,public.admin_users to service_role;

insert into public.profile(name,title,introduction,location,degree,institution,current_year,github,skills)
values ('Amman Kumar D.','Aspiring Software Engineer | Machine Learning Engineer',
'I’m a second-year Computer Science and Engineering student at Chennai Institute of Technology, exploring how thoughtful software and intelligent systems can solve practical problems. My interests span software engineering, artificial intelligence, machine learning, data science, full stack development, problem solving, and natural language processing. I’m building my foundations through programming and hands-on projects, with the goal of becoming an engineer who turns complex ideas into useful, dependable technology.',
'Avadi, Chennai, India','B.E. Computer Science and Engineering','Chennai Institute of Technology','2nd Year','https://github.com/AMMANKUMARD100',
'{"Programming Languages":["C","C++","Python","Java"],"Web Development":["HTML","CSS","JavaScript"],"Database":["MySQL"],"Machine Learning & Data Science":["NumPy","Pandas","Matplotlib","Scikit-learn","Machine Learning Algorithms","Natural Language Processing"],"Other Areas":["Data Structures and Algorithms","Problem Solving","Git","GitHub"]}'::jsonb);
insert into public.projects(title,subtitle,description,technologies,features,github_url,featured,visual,sort_order) values
('EchoGuard','AI scam voice detector','An AI-powered voice deepfake detection system designed to identify whether an audio recording is genuine or AI-generated.',array['Machine Learning','Deep Learning','Audio Analysis'],array['Real versus AI-generated voice detection','Machine learning and deep learning','Audio analysis','Voice authenticity prediction','Explainable AI integration'],'https://github.com/AMMANKUMARD100/ML-PROJECT',true,'signal',0),
('Alexa AI Assistant','Intelligence, made personal','An AI-powered personal assistant designed to provide intelligent responses and automate everyday tasks.',array['Artificial Intelligence','Task Automation'],'{}','https://github.com/AMMANKUMARD100/alexa',false,'orb',1),
('Digital Twin Parkinson’s Prediction','Exploring predictive intelligence','A machine learning-based Parkinson’s prediction project that explores digital twin concepts and interactive data-driven prediction.',array['Machine Learning','Digital Twin','Prediction'],'{}','',false,'nodes',2);
insert into public.certificate_categories(name) values ('Artificial Intelligence'),('Machine Learning'),('Cloud Computing'),('AWS'),('Data Science'),('Programming'),('Web Development'),('Database'),('Other');
-- No certificates, achievements, or resume are fabricated.

-- All objects remain PRIVATE, with no authenticated/anonymous object policies.
-- Edge Functions alone use the server key for magic-byte-validated uploads,
-- 10-minute signed reads of published records, and admin-only deletion.
-- Direct browser storage reads/writes are deliberately denied.

create table private.contact_rate_limits (key text primary key,hits integer not null,expires_at timestamptz not null);
create function public.take_contact_slot(email_hash text) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;begin
 delete from private.contact_rate_limits where expires_at < now();
 insert into private.contact_rate_limits(key,hits,expires_at) values(email_hash,1,now()+interval '15 minutes')
 on conflict(key) do update set hits=private.contact_rate_limits.hits+1
 where private.contact_rate_limits.hits<5 returning hits into n;
 return n is not null;
end;$$;
revoke all on function public.take_contact_slot(text) from public,anon,authenticated;
grant execute on function public.take_contact_slot(text) to service_role;

-- Publish only public content tables, never inbox or admin membership.
do $$ declare t text; begin
 foreach t in array array['profile','projects','certificates','achievements','resumes','certificate_categories'] loop
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
   execute format('alter publication supabase_realtime add table public.%I',t);
  end if;
 end loop;
end $$;
commit;
