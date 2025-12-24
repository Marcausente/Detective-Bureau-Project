-- Create the custom users table
-- Note: Supabase handles auth.users automatically. This table is for additional profile data.
-- You should set up a Trigger to automatically create a row here when a new user signs up via Auth.

create type public.rango_enum as enum (
  'Oficial II',
  'Oficial III',
  'Oficial III+',
  'Detective I',
  'Detective II',
  'Detective III'
);

create type public.rol_enum as enum (
  'Externo',
  'Ayudante',
  'Detective',
  'Coordinador',
  'Comisionado',
  'Administrador'
);

create table public.users (
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

-- Policies (Example: Users can read their own data)
create policy "Users can view their own profile" 
on public.users for select 
using (auth.uid() = id);

-- Policy for updating own profile
create policy "Users can update their own profile" 
on public.users for update 
using (auth.uid() = id);

-- (Optional) If you want admins to see everything, add policies for 'Administrador' role.
