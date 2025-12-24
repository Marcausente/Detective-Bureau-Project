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
begin
  -- Check permissions (Optional: enforce here or via RLS, but RPC usually runs as owner so we check role manually or rely on frontend + RLS of invoker)
  -- ideally we check if the executing user has role 'Administrador', 'Comisionado' etc.
  -- For now, we trust the app logic or add a check:
  if not exists (
    select 1 from public.users 
    where id = auth.uid() 
    and rol in ('Administrador', 'Comisionado', 'Coordinador')
  ) then
      raise exception 'Unauthorized: Insufficient privileges';
  end if;

  -- 1. Create auth user
  new_user_id := gen_random_uuid();
  encrypted_pw := crypt(p_password, gen_salt('bf'));
  
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (
    new_user_id,
    p_email,
    encrypted_pw,
    now(), -- Auto confirm email
    '{"provider":"email","providers":["email"]}',
    '{}',
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

