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
      'Detective III'
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
  updated_at timestamptz default now()
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
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
