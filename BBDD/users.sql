-- Create the custom users table
-- Note: Supabase handles auth.users automatically. This table is for additional profile data.

-- Safely create types (ignore if they already exist)
do $$ begin
    create type public.rango_enum as enum (
      'Oficial II',
      'Oficial III',
      'Oficial III+',
      'Detective I',
      'Detective II',
      'Detective III',
      'Teniente',
      'Capitan'
    );
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type public.rol_enum as enum (
      'Externo',
      'Ayudante',
      'Detective',
      'Coordinador',
      'Comisionado',
      'Administrador'
    );
exception
    when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  nombre text not null,
  apellido text not null,
  no_placa text unique,
  rango public.rango_enum,
  rol public.rol_enum default 'Externo'::public.rol_enum,
  profile_image text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  fecha_ingreso date,
  fecha_ultimo_ascenso date
);

-- Enable Row Level Security (RLS)
alter table public.users enable row level security;

-- Policies
drop policy if exists "Users can view their own profile" on public.users;
create policy "Users can view their own profile" 
on public.users for select 
using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.users;
create policy "Users can update their own profile" 
on public.users for update 
using (auth.uid() = id);

-- Allow everyone to read profiles (needed for Personnel page)
drop policy if exists "Anyone can view profiles" on public.users;
create policy "Anyone can view profiles"
on public.users for select
using (true);

-- Function to handle new user creation
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.users (id, email, nombre, apellido)
  values (new.id, new.email, '', ''); -- Start with empty name/surname or default
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call the function on new auth user
create or replace trigger on_auth_user_created
  after insert on auth.users --test
  for each row execute procedure public.handle_new_user();

-- Enable pgcrypto for password hashing
create extension if not exists pgcrypto;

-- RPC to create a new user with profile data
-- This function mimics the Supabase Auth generic sign up but updates the profile immediately with extra data

-- Drop old function signature if it exists to allow parameter renaming
drop function if exists public.create_new_personnel(text,text,text,text,text,public.rango_enum,public.rol_enum,date,date,text);

create or replace function public.create_new_personnel(
    p_email text,
    p_password text,
    p_nombre text,
    p_apellido text,
    p_no_placa text,
    p_rango public.rango_enum,
    p_rol public.rol_enum,
    p_fecha_ingreso date,
    p_fecha_ultimo_ascenso date,
    p_profile_image text default null
)
returns uuid as $$
declare
  new_user_id uuid;
  encrypted_pw text;
  v_instance_id uuid;
begin
  -- Check permissions
  if not exists (
    select 1 from public.users 
    where id = auth.uid() 
    and rol in ('Administrador', 'Comisionado', 'Coordinador')
  ) then
      raise exception 'Unauthorized: Insufficient privileges';
  end if;

  -- Get the correct instance_id from an existing user (e.g. the admin invoking this, or just any user)
  -- This ensures we match the project's instance_id.
  select instance_id into v_instance_id from auth.users limit 1;
  
  if v_instance_id is null then
    -- Fallback to default if table is empty (unlikely if admin exists)
    v_instance_id := '00000000-0000-0000-0000-000000000000';
  end if;

  -- 1. Create auth user
  new_user_id := gen_random_uuid();
  encrypted_pw := crypt(p_password, gen_salt('bf'));
  
  insert into auth.users (
    id, 
    instance_id,
    email, 
    encrypted_password, 
    email_confirmed_at, 
    aud, 
    role,
    raw_app_meta_data, 
    raw_user_meta_data, 
    created_at, 
    updated_at
  )
  values (
    new_user_id,
    v_instance_id,
    p_email,
    encrypted_pw,
    now(), 
    'authenticated', -- aud
    'authenticated', -- role
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  );

  -- 1b. Create identity (Required for login to work)
  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', p_email), -- Ensure UUID is text in JSON
    'email',
    p_email, -- provider_id for 'email' provider is the email address
    now(),
    now(),
    now()
  );
  
  -- The trigger 'on_auth_user_created' will fire and create the row in public.users with empty fields.
  -- We need to update that row with the specific details provided.
  
  update public.users
  set 
    nombre = p_nombre,
    apellido = p_apellido,
    no_placa = p_no_placa,
    rango = p_rango,
    rol = p_rol,
    fecha_ingreso = p_fecha_ingreso,
    fecha_ultimo_ascenso = p_fecha_ultimo_ascenso,
    profile_image = p_profile_image
  where id = new_user_id;
  
  return new_user_id;
end;
$$ language plpgsql security definer;


-- RPC to delete a user (and their auth account)
create or replace function public.delete_personnel(target_user_id uuid)
returns void as $$
begin
  -- Permission check
  if not exists (
    select 1 from public.users 
    where id = auth.uid() 
    and rol in ('Administrador', 'Comisionado', 'Coordinador')
  ) then
      raise exception 'Unauthorized: Insufficient privileges';
  end if;

  -- Delete from auth.users (Cascades to public.users)
  delete from auth.users where id = target_user_id;
end;
$$ language plpgsql security definer;

-- Drop old update signature if exists
drop function if exists public.update_personnel_admin(uuid,text,text,text,text,text,public.rango_enum,public.rol_enum,date,date,text);

-- RPC to update user profile as admin
create or replace function public.update_personnel_admin(
    p_user_id uuid,
    p_email text,
    p_password text, -- Pass NULL or empty string if not changing
    p_nombre text,
    p_apellido text,
    p_no_placa text,
    p_rango public.rango_enum,
    p_rol public.rol_enum,
    p_fecha_ingreso date,
    p_fecha_ultimo_ascenso date,
    p_profile_image text
)
returns void as $$
declare
  encrypted_pw text;
begin
  -- Permission check
  if not exists (
    select 1 from public.users 
    where id = auth.uid() 
    and rol in ('Administrador', 'Comisionado', 'Coordinador')
  ) then
      raise exception 'Unauthorized: Insufficient privileges';
  end if;

  -- Update public profile
  update public.users
  set 
    nombre = p_nombre,
    apellido = p_apellido,
    no_placa = p_no_placa,
    rango = p_rango,
    rol = p_rol,
    fecha_ingreso = p_fecha_ingreso,
    fecha_ultimo_ascenso = p_fecha_ultimo_ascenso,
    profile_image = p_profile_image,
    updated_at = now()
  where id = p_user_id;

  -- Update Auth Email if changed (be careful with confirmation flow, this forces it)
  update auth.users
  set email = p_email, updated_at = now()
  where id = p_user_id and email <> p_email;

  -- Update Password if provided
  if p_password is not null and length(p_password) > 0 then
      encrypted_pw := crypt(p_password, gen_salt('bf'));
      update auth.users
      set encrypted_password = encrypted_pw, updated_at = now()
      where id = p_user_id;
  end if;

end;
$$ language plpgsql security definer;


-- =============================================
-- EVALUATIONS SYSTEM
-- =============================================

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid references public.users(id) on delete cascade not null,
  author_user_id uuid references public.users(id) on delete set null,
  content text not null,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.evaluations enable row level security;

-- Helper to get numeric rank level for comparisons
create or replace function public.get_rank_level(rango public.rango_enum)
returns integer as $$
begin
  return case rango
    when 'Capitan' then 100
    when 'Teniente' then 90
    when 'Detective III' then 80
    when 'Detective II' then 70
    when 'Detective I' then 60
    -- All Oficial levels count as the same "tier" (cannot evaluate each other)
    when 'Oficial III+' then 30
    when 'Oficial III' then 30
    when 'Oficial II' then 30
    else 0
  end;
end;
$$ language plpgsql immutable;


-- RPC to Add Evaluation
create or replace function public.add_evaluation(p_target_user_id uuid, p_content text)
returns void as $$
declare
  v_author_rank public.rango_enum;
  v_target_rank public.rango_enum;
begin
  -- Get Author Rank
  select rango into v_author_rank from public.users where id = auth.uid();
  if v_author_rank is null then raise exception 'User profile not found'; end if;

  -- Get Target Rank
  select rango into v_target_rank from public.users where id = p_target_user_id;
  if v_target_rank is null then raise exception 'Target user not found'; end if;

  -- Rule: Tenientes and Capitanes cannot receive evaluations
  if v_target_rank in ('Teniente', 'Capitan') then
    raise exception 'High Command officers cannot be evaluated.';
  end if;

  -- Rule: Author must be HIGHER than Target
  if public.get_rank_level(v_author_rank) <= public.get_rank_level(v_target_rank) then
    raise exception 'Insufficient rank to evaluate this officer.';
  end if;

  -- Insert
  insert into public.evaluations (target_user_id, author_user_id, content)
  values (p_target_user_id, auth.uid(), p_content);
end;
$$ language plpgsql security definer;


-- RPC to Get Evaluations (with strict permission check)
create or replace function public.get_evaluations(p_target_user_id uuid)
returns table (
  id uuid,
  content text,
  created_at timestamptz,
  author_name text,
  author_rank public.rango_enum
) as $$
declare
  v_author_rank public.rango_enum;
  v_target_rank public.rango_enum;
  v_current_user_id uuid;
begin
  v_current_user_id := auth.uid();
  
  -- Get Requestor Rank
  select rango into v_author_rank from public.users where id = v_current_user_id;
  
  -- Get Target Rank
  select rango into v_target_rank from public.users where id = p_target_user_id;

  -- Rule: Viewer > Target.
  if public.get_rank_level(v_author_rank) <= public.get_rank_level(v_target_rank) then
    raise exception 'Insufficient privileges. You are % (%) and target is % (%).', 
      v_author_rank, 
      public.get_rank_level(v_author_rank), 
      v_target_rank, 
      public.get_rank_level(v_target_rank);
  end if;

  return query
  select 
    e.id,
    e.content,
    e.created_at,
    (u.nombre || ' ' || u.apellido) as author_name,
    u.rango as author_rank
  from public.evaluations e
  left join public.users u on e.author_user_id = u.id
  where e.target_user_id = p_target_user_id
  order by e.created_at desc;
end;
$$ language plpgsql security definer;

-- Grant permissions explicitly to be safe
grant execute on function public.get_rank_level to authenticated;
grant execute on function public.add_evaluation to authenticated;
grant execute on function public.get_evaluations to authenticated;
grant select, insert on public.evaluations to authenticated;


-- Debug function to inspect current user's auth details
create or replace function public.inspect_admin_user()
returns table (
  my_id uuid,
  my_instance_id uuid,
  my_aud text,
  my_role text,
  identity_provider text,
  identity_provider_id text,
  identity_data jsonb
) as $$
begin

  return query
  select 
    i.provider::text,
    i.provider_id::text,
    i.identity_data,
    u.id,
    u.instance_id,
    u.aud::text,
    u.role::text
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  limit 1;
end;
$$ language plpgsql security definer;
