-- ==============================================================================
-- ADD ORDERS & WARRANTS PDF BRANDING SETTINGS
-- ==============================================================================

-- 1. Insert default keys for Orders & Warrants PDF Branding
INSERT INTO public.app_settings (key, value)
VALUES 
  ('branding_orders_nav_label', 'Órdenes'),
  ('branding_orders_web_title', 'ÓRDENES Y SENTENCIAS JUDICIALES'),
  ('branding_orders_web_subtitle', 'SHERIFF CRIMINAL UNIT BUREAU • Registro y consulta de expedientes'),
  ('branding_orders_pdf_header', 'SHERIFF CRIMINAL UNIT BUREAU'),
  ('branding_orders_pdf_subtitle', 'SHERIFF CRIMINAL UNIT BUREAU • SOLICITUD Y EXPEDIENTE'),
  ('branding_orders_pdf_doj_line', 'DEPARTMENT OF JUSTICE • ESTADO DE SAN ANDREAS'),
  ('branding_orders_unit_name', 'Sheriff Criminal Unit Bureau'),
  ('branding_orders_pdf_signature_dept', 'Sheriff Criminal Unit Bureau, LSSD'),
  ('branding_orders_pdf_judge_name', 'FISCAL JOHN ROXTON'),
  ('branding_orders_pdf_judge_title', 'Fiscalía General • Corte Superior de Justicia'),
  ('branding_orders_pdf_footer_legal', 'VALIDADO POR LA CORTE SUPERIOR Y DEPARTAMENTO DE JUSTICIA'),
  ('branding_orders_pdf_left_logo', '/logowebp/dojlogo.webp'),
  ('branding_orders_pdf_right_logo', '/logowebp/sanandreas.webp')
ON CONFLICT (key) DO NOTHING;
