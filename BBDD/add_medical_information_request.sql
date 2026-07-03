-- Migration to add 'Solicitud de informacion medica' to the check constraint in public.judicial_orders

-- 1. Drop existing constraint
ALTER TABLE public.judicial_orders DROP CONSTRAINT IF EXISTS judicial_orders_order_type_check;

-- 2. Add the updated constraint including 'Solicitud de informacion medica'
ALTER TABLE public.judicial_orders ADD CONSTRAINT judicial_orders_order_type_check CHECK (order_type IN (
  'Orden de Registro (Casa)', 
  'Orden de Registro (Coche)', 
  'Orden de Arresto', 
  'Orden de Revision Telefonica', 
  'Orden de Revision Bancaria', 
  'Orden de Identificacion Red Social',
  'Orden de Identificacion Telefono Movil',
  'Orden de Decomiso', 
  'Orden de Alejamiento', 
  'Orden de Precinto',
  'Ley Rico',
  'Revision de Camaras',
  'Solicitud de informacion medica'
));
