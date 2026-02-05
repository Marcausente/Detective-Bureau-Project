# Instrucciones de Instalación Base de Datos - DOJ

## Resumen

Para que el sistema DOJ (Department of Justice) funcione correctamente, necesitas ejecutar los siguientes archivos SQL en tu base de datos Supabase **en este orden exacto**:

## Orden de Ejecución

### 1. Schema Principal

```sql
-- Ejecuta primero: BBDD/create_doj_schema.sql
```

Este archivo crea las tablas principales:

- `doj_cases` - Casos DOJ
- `doj_case_assignments` - Asignaciones de agentes a casos
- `doj_case_updates` - Actualizaciones/logs de casos
- `doj_sanctions` - Sanciones (será modificado por el siguiente archivo)
- `doj_interrogations` - Interrogaciones

### 2. Funciones RPC Principales

```sql
-- Ejecuta segundo: BBDD/create_doj_rpcs.sql
```

Crea las funciones principales para manejar casos:

- `create_doj_case()` - Crear nuevo caso
- `get_doj_cases()` - Obtener listado de casos
- `get_doj_case_details()` - Detalles de un caso
- `add_doj_case_update()` - Añadir actualización a un caso
- `update_doj_case_assignments()` - Gestionar asignaciones
- Funciones para sanciones e interrogaciones básicas

### 3. Sistema de Sanciones Completo

```sql
-- Ejecuta tercero: BBDD/create_doj_sanctions_system.sql
```

Este archivo reemplaza la tabla `doj_sanctions` anterior con el sistema completo de perfiles y sanciones:

- `doj_subject_profiles` - Perfiles de oficiales sancionados
- `doj_sanctions` - Tabla renovada de sanciones
- RPCs para gestionar perfiles y sanciones

### 4. Sistema de Documentación

```sql
-- Ejecuta cuarto: BBDD/create_doj_docs.sql
```

Crea la tabla y funciones para documentación:

- `doj_documentation` - Documentos y recursos DOJ
- `manage_doj_documentation()` - CRUD de documentos

### 5. Sistema de TODO Lists

```sql
-- Ejecuta quinto: BBDD/create_doj_todo_system.sql
```

Sistema de tareas para casos:

- `doj_case_todo_categories` - Categorías de tareas
- `doj_case_todos` - Tareas individuales
- RPCs para gestionar categorías y tareas

### 6. Upgrade del Sistema de Interrogaciones

```sql
-- Ejecuta sexto: BBDD/upgrade_doj_interrogations.sql
```

Actualiza la tabla de interrogaciones con campos adicionales y funciones mejoradas:

- Añade campos: `interrogation_date`, `agents_present`, `transcription`, `media_url`
- `manage_doj_interrogation()` - CRUD completo de interrogaciones
- `get_doj_interrogations()` - Obtener interrogaciones
- `get_available_doj_interrogations_to_link()` - Para vincular a casos

## Comando Rápido (Opcional)

Si prefieres ejecutar todos los archivos de una vez desde psql o Supabase SQL Editor, puedes copiar y pegar este comando:

```sql
-- 1. Schema
\i BBDD/create_doj_schema.sql

-- 2. RPCs principales
\i BBDD/create_doj_rpcs.sql

-- 3. Sistema de sanciones
\i BBDD/create_doj_sanctions_system.sql

-- 4. Documentación
\i BBDD/create_doj_docs.sql

-- 5. TODO system
\i BBDD/create_doj_todo_system.sql

-- 6. Upgrade interrogaciones
\i BBDD/upgrade_doj_interrogations.sql
```

## Verificación

Después de ejecutar todos los archivos, verifica que se crearon correctamente con:

```sql
-- Ver todas las tablas DOJ
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'doj_%';

-- Ver todas las funciones DOJ
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%doj%';
```

Deberías ver:

- **Tablas**: doj_cases, doj_case_assignments, doj_case_updates, doj_interrogations, doj_subject_profiles, doj_sanctions, doj_documentation, doj_case_todo_categories, doj_case_todos
- **Funciones**: create_doj_case, get_doj_cases, get_doj_case_details, add_doj_case_update, update_doj_case_assignments, manage_doj_interrogation, get_doj_interrogations, get_available_doj_interrogations_to_link, manage_doj_documentation, create_doj_subject_profile, get_doj_subjects, create_doj_sanction, get_doj_subject_details, get_doj_cases_simple, create_doj_todo_category, update_doj_todo_category, delete_doj_todo_category, create_doj_todo_task, toggle_doj_todo_task, delete_doj_todo_task, get_doj_case_todos, update_doj_subject_profile, delete_doj_subject_profile

## Permisos de Usuario

Para que un usuario pueda acceder a la sección DOJ:

```sql
-- Añadir división DOJ a un usuario
UPDATE users
SET divisions = ARRAY_APPEND(divisions, 'DOJ')
WHERE id = 'USER_UUID_AQUI';

-- O si el array está vacío/null:
UPDATE users
SET divisions = ARRAY['DOJ']
WHERE id = 'USER_UUID_AQUI';

-- Verificar divisiones de un usuario
SELECT nombre, apellido, divisions
FROM users
WHERE id = 'USER_UUID_AQUI';
```

## Notas Importantes

> **⚠️ ORDEN CRÍTICO**: Debes ejecutar los archivos en el orden especificado. El archivo `create_doj_sanctions_system.sql` hace un `DROP TABLE` de `doj_sanctions` porque necesita recrearla con una estructura diferente.

> **✅ Row Level Security**: Todos los archivos incluyen políticas RLS que permiten acceso a usuarios autenticados. El control de acceso fino se maneja en el frontend mediante las divisiones del usuario.
