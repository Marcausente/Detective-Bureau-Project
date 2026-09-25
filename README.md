# 🛡️ Detective Bureau & Law Enforcement Management System

Una plataforma web integral, moderna y modular de gestión policial, investigación criminal, inteligencia táctica y administración departamental, diseñada con una interfaz **macOS Glassmorphism** de alto rendimiento.

---

## 🌟 Características Principales & Módulos

### 1. 🎨 Personalización & White-Label en Tiempo Real
- **Configuración Centralizada desde Admin (`/admin`)**: Modifica títulos, nombres de división, logos, favicons y fondos de pantalla para todos los usuarios.
- **Plantillas Rápidas (1-Click Presets)**:
  - 🌟 **SCUB** (Sheriff Criminal Unit Bureau)
  - 🕵️ **DB** (Detective Bureau / Major Crimes Division)
  - 🛡️ **LSSD** (Los Santos County Sheriff's Department)
  - 🚓 **SAPD** (San Andreas Police Department)
- **Sincronización Inmediata**: Los cambios se transmiten en tiempo real vía WebSockets (*Supabase Realtime*) sin necesidad de recargar la página.
- **Optimización de Caché y Egress**: Compresión automática de imágenes a formato **WebP** y cabeceras `Cache-Control: immutable` (1 año) con carga instantánea vía *Stale-While-Revalidate* (`localStorage`).

---

### 2. 🏠 Panel de Inicio (Dashboard) & Búsqueda Universal
- **Centro de Mando**: Anuncios globales del departamento, estadísticas de actividad e indicadores clave de rendimiento.
- **Buscador Spotlight (`⌘K` / `Ctrl+K`)**: Búsqueda global instantánea en toda la base de datos (agentes, casos, bandas, vehículos, etc.).
- **Minijuegos Integrados**: Acceso a pasatiempos clásicos interactivos para tiempos de espera.

---

### 3. 📂 Casos e Investigaciones Criminales (`/cases`)
- **Gestión de Expedientes**: Control de estados (*Abierto*, *En Progreso*, *Cerrado*, *Archivado*), niveles de prioridad y detectives asignados.
- **Pizarra Táctica Interactiva (Whiteboard)**: Conexión visual de nodos con evidencias, sospechosos, vehículos, notas y grafos de investigación.
- **Generación de Informes en PDF**: Exportación oficial de expedientes con formato estructurado, sellos y firmas.

---

### 4. 📜 Registro de Denuncias (`/complaints`)
- Recepción, clasificación y seguimiento de denuncias ciudadanas y policiales.
- Vinculación directa con expedientes de casos e investigaciones abiertas.

---

### 5. 👥 Inteligencia de Bandas & Crimen Organizado (`/gangs`)
- **Fichas de Organizaciones**: Jerarquía criminal, zonas de influencia y nivel de amenaza.
- **Perfiles de Miembros**: Identificación de integrantes con foto, apodo, DNI y antecedentes.
- **Parque Móvil & Propiedades**: Registro de vehículos sospechosos e inmuebles vinculados.
- **Grafitis & Coordenadas GPS**: Registro fotográfico de marcas territoriales con geolocalización.
- **Registro de Patrullajes**: Control horario y recuento de sospechosos avistados.
- **Matriz de Conflictos**: Mapa de guerras, rivalidades y alianzas entre bandas.
- **Exportación Rápida**: Generación de informes PDF y plantillas de texto formateadas para Discord.

---

### 6. 🚨 Incidentes & Actuaciones Callejeras (`/incidents`)
- Registro cronológico de tiroteos, atracos, persecuciones e intervenciones en la vía pública.
- Vinculación de involucrados con evidencias balísticas y expedientes de bandas.

---

### 7. 🗺️ Mapa del Crimen Interactivo (`/crimemap`)
- Mapa satelital en alta resolución (HD) de San Andreas / Los Santos.
- Marcadores interactivos filtrables: grafitis, incidentes, domicilios de bandas y operativos.

---

### 8. 🔬 Balística & Armamento (`/ballistics`)
- Banco de datos balístico: registro de proyectiles, casquillos y marcas de estrías.
- Trazabilidad de armas, números de serie y vinculación con escenas del crimen.

---

### 9. 🎙️ Interrogatorios (`/interrogations`)
- Actas y transcripciones de declaraciones de sospechosos, testigos e informantes.
- Archivo de testimonios jurados clasificados por caso.

---

### 10. ⚖️ Órdenes Judiciales & Warrants (`/warrants`)
- Tramitación y validación de órdenes de registro, arresto e incautación.
- Exportación en formato oficial con sellos judiciales del DOJ.

---

### 11. 🏛️ Departamento de Justicia (DOJ) (`/doj`)
- Control de causas judiciales, antecedentes penales y régimen de sanciones legales.
- Sistema de verificación y revocación de licencias oficiales (armas, caza, vuelo, etc.).

---

### 12. 🛡️ SEB / SWAT - Unidad Táctica de Alto Riesgo (`/seb`)
- **Tablón de Operaciones**: Planificación y despliegue de asaltos tácticos, rescates de rehenes e intervenciones de alto riesgo.
- **Cuadrilla Táctica**: Asignación de agentes y especialistas por operativo.
- **Archivo Histórico**: Registro y análisis post-operativo de intervenciones.

---

### 13. 🚁 Air Support Division (ASD) (`/air-support`)
- **Cuadrilla de Vuelo**: Jerarquía de mandos y pilotos con sincronización a Discord vía Webhooks.
- **Habilitaciones Aeronáuticas**: Gestión de licencias de vuelo (H1, H2, NightSun, FLIR, etc.).
- **Libro de Vuelos (Flight Logs)**: Bitácora de horas de vuelo y estado de patrullaje aéreo.
- **Flota de Aeronaves**: Registro y mantenimiento de helicópteros y modelos tácticos.
- **Régimen Disciplinario**: Registro y control de infracciones aeronáuticas.

---

### 14. 🎓 Formación & Academia (DTP / FTO) (`/training`)
- **Archivo de Instrucción**: Documentación de protocolos, manuales y temarios de entrenamiento.
- **Planificación de Prácticas**: Calendario interactivo de sesiones prácticas y exámenes.
- **Control de Horas**: Registro del progreso, asistencia y calificaciones de los aspirantes.

---

### 15. ⚖️ Asuntos Internos (Internal Affairs) (`/internal-affairs`)
- **Investigaciones Disciplinarias**: Expedientes confidenciales sobre conducta de agentes.
- **Calculadora de Vigencia de Sanciones**: Gestión de sanciones (Leves, Medias, Graves) con cálculo automático de caducidad.
- **Receptor de Denuncias contra Oficiales**: Canal de denuncias internas y ciudadanas.
- **Publicación de Faltas a Discord**: Integración con Webhooks para publicación oficial y transparente de resoluciones sancionadoras.
- **Cuadrilla de IA**: Gestión de miembros y exportación de plantilla a Discord.

---

### 16. 🕶️ Undercover Division (UD / Infiltraciones) (`/undercover`)
- **Leyendas & Tapaderas**: Creación de identidades falsas, perfiles de Lifeinvader, vehículos tapadera y contactos.
- **Informes de Infiltración**: Traspaso directo de inteligencia confidencial al departamento de bandas.
- **Roster Confidencial**: Registro blindado de agentes encubiertos activos.

---

### 17. 📡 Coordinación & Alto Mando (`/coordination`)
- Gestión y configuración de la cuadrilla de mandos con publicación automática a Discord.
- Personalización de avatar de bot, enlaces webhook, banners y estructura de rangos.

---

### 18. 🎖️ Personal & Expedientes de Agentes (`/personnel`)
- Directorio general de oficiales, divisiones, rangos y números de placa.
- Perfil individual con historial de casos, condecoraciones, sanciones y conmutador de tema personal.

---

### 19. ⚙️ Panel de Administración (`/admin`)
- Control de acceso y asignación de roles jerárquicos (Detective, Coordinador, Comisionado, SysAdmin).
- Conmutador global de temática (LSPD / LSSD) y selector de idioma (Español / Inglés).
- Editor visual integral de White-Label con subida directa de imágenes.

---

## 🛠️ Stack Tecnológico & Arquitectura

| Componente | Tecnología / Librería |
| :--- | :--- |
| **Frontend** | React 18, Vite |
| **Estilos & UI** | Vanilla CSS, Glassmorphism macOS Design System |
| **Base de Datos & Auth** | Supabase (PostgreSQL, Row Level Security, RPCs) |
| **Almacenamiento** | Supabase Storage con compresión WebP en cliente |
| **Sincronización** | Supabase Realtime (WebSockets) |
| **Caché & Egress** | `localStorage` (*Stale-While-Revalidate*) + `Cache-Control: immutable` |
| **Generación de Documentos** | jsPDF, html2canvas |

---

## 🚀 Despliegue & Puesta en Marcha

1. **Instalar dependencias**:
   ```bash
   npm install
