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
create or replace function public.create_new_personnel(
    email text,
    password text,
    nombre text,
    apellido text,
    no_placa text,
    rango public.rango_enum,
    rol public.rol_enum,
    fecha_ingreso date,
    fecha_ultimo_ascenso date,
    profile_image text default null
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
  encrypted_pw := crypt(password, gen_salt('bf'));
  
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (
    new_user_id,
    email,
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
    nombre = create_new_personnel.nombre,
    apellido = create_new_personnel.apellido,
    no_placa = create_new_personnel.no_placa,
    rango = create_new_personnel.rango,
    rol = create_new_personnel.rol,
    fecha_ingreso = create_new_personnel.fecha_ingreso,
    fecha_ultimo_ascenso = create_new_personnel.fecha_ultimo_ascenso,
    profile_image = create_new_personnel.profile_image
  where id = new_user_id;
  
  return new_user_id;
end;
$$ language plpgsql security definer;

