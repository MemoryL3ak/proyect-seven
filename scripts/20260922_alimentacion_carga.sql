-- Carga de la alimentación del evento (planillas de Ariel, 22-09-2026).
--
-- GENERADO. Sale de tres planillas: "Almuerzo y Cena", "Desayuno" y
-- "Bloques Horarios". Si cambian, conviene regenerarlo antes que editarlo a
-- mano, para que el archivo siga calzando con la planilla.
--
-- Corre después de 20260922_bloques_horarios_comida.sql.
--
-- Decisiones de la carga:
--  * Una entrada por categoría y no por plato: "Ensaladas", "Fondos" y
--    "Postres" con sus platos en la descripción. El modelo no tiene columna
--    de categoría y así el menú se lee agrupado sin tocar el esquema.
--  * El gramaje de la planilla ("Ganso 200 grs.") va entre paréntesis pegado
--    al plato: es del plato y no del día.
--  * Sin hotel ni tipo de cliente: el menú es el mismo para los dos comedores
--    y para todos los participantes. Vacío = lo ve todo el mundo.
--  * El desayuno es la misma oferta todos los días y se repite por fecha,
--    porque el portal arma el menú del día filtrando por fecha. No se carga
--    el 22-09 (día de llegada, la planilla sólo trae cena) y sí el 04-10
--    (día de salida, los bloques traen su extensión de desayuno).
--
-- Es reentrante: borra primero lo del rango del evento y vuelve a insertar,
-- así correrlo dos veces no duplica.

begin;

-- ── Menús ─────────────────────────────────────────────────────────────────
delete from logistics.food_menus
 where date between '2026-09-22' and '2026-10-04';

insert into logistics.food_menus (date, meal_type, title, description)
values
  ('2026-09-22', 'CENA', 'Ensaladas', 'Mix Lechuga / repollo morado / zanahoria · Tomate con ciboullete'),
  ('2026-09-22', 'CENA', 'Fondos', 'Asado de res al jugo con spaghetti a la mantequilla (Ganso 200 grs.) · Pollo asado al horno con gratín de papas (Pechuga de pollo deshuesada 200 grs.)'),
  ('2026-09-22', 'CENA', 'Postres', 'Fruta Natural · Jalea de Piña · Flan de Chocolate · Panna Cotta con salsa de frambuesa'),
  ('2026-09-23', 'ALMUERZO', 'Ensaladas', 'Mix repollo blanco / zanahoria · Betarraga / zanahoria'),
  ('2026-09-23', 'ALMUERZO', 'Fondos', 'Escalopa de res con papas salteadas (Posta Negra 180 grs.) · Strogonoff de pollo con puré de papas (Pechuga de pollo 150 grs.)'),
  ('2026-09-23', 'ALMUERZO', 'Postres', 'Fruta Natural · Creme Caramel · Jalea Roja (frambuesa - guinda) · Leche Asada'),
  ('2026-09-23', 'CENA', 'Ensaladas', 'Mix 4 variedades · Lechuga / choclo'),
  ('2026-09-23', 'CENA', 'Fondos', 'Pollo asado con arroz chino (1/4 de Pollo. Pierna entera o media pechuga) · Lasagna Boloñesa (Tártaro Molido 110 grs.)'),
  ('2026-09-23', 'CENA', 'Postres', 'Fruta Natural · Compota de Duraznos · Sémola con leche y salsa de caramelo · Mousse de Manjar'),
  ('2026-09-24', 'ALMUERZO', 'Ensaladas', 'Tomate con ciboullete · Mix repollo blanco / zanahoria'),
  ('2026-09-24', 'ALMUERZO', 'Fondos', 'Pollo arvejado con arroz pilaf (1/4 de Pollo. Pierna entera o media pechuga) · Carne mechada con tallarines a la mantequilla (Ganso 200 grs. Producto terminado)'),
  ('2026-09-24', 'ALMUERZO', 'Postres', 'Fruta Natural · Flan de vainilla con salsa de caramelo · Arroz con leche · Jalea de piña'),
  ('2026-09-24', 'CENA', 'Ensaladas', 'Mix 4 variedades · Lechuga con aceitunas'),
  ('2026-09-24', 'CENA', 'Fondos', 'Suprema de pollo grillada con flan de zapallo italiano y zanahoria (Pechuga de pollo 150 grs.) · Asado alemán con puré de papas (Tártaro Molido 150 grs.)'),
  ('2026-09-24', 'CENA', 'Postres', 'Fruta Natural · Compota de Manzanas · Leche asada · Macedonia'),
  ('2026-09-25', 'ALMUERZO', 'Ensaladas', 'Mix Lechuga / repollo morado / zanahoria · Tomate con ciboullete'),
  ('2026-09-25', 'ALMUERZO', 'Fondos', 'Asado de res al jugo con spaghetti a la mantequilla (Ganso 200 grs. Producto terminado) · Pavo asado al horno con gratín de papas (Pechuga de pavo deshuesada 200 grs. Producto)'),
  ('2026-09-25', 'ALMUERZO', 'Postres', 'Fruta Natural · Jalea de Piña · Flan de Chocolate · Panna Cotta con salsa de frambuesa'),
  ('2026-09-25', 'CENA', 'Ensaladas', 'Mix 4 variedades · Lechuga con aceitunas'),
  ('2026-09-25', 'CENA', 'Fondos', 'Spaghetti con strogonoff de carne de cerdo · Pechuga de pollo a la plancha con puré rústico (Pechuga de pollo deshuesada 200 grs)'),
  ('2026-09-25', 'CENA', 'Postres', 'Fruta Natural · Macedonia de frutas · Leche asada · Macedonia'),
  ('2026-09-26', 'ALMUERZO', 'Ensaladas', 'Mix Lechuga / repollo morado / zanahoria · Tomate con ciboullete'),
  ('2026-09-26', 'ALMUERZO', 'Fondos', 'Pastel de papas con carne (Tártaro Molido 110 grs.) · Chapsui de pollo con fetuccini'),
  ('2026-09-26', 'ALMUERZO', 'Postres', 'Fruta Natural · Helado · Mousse de frutilla · Panna Cotta con salsa de frambuesa'),
  ('2026-09-26', 'CENA', 'Ensaladas', 'Tomate con ciboullete · Mix repollo blanco / zanahoria'),
  ('2026-09-26', 'CENA', 'Fondos', 'Cerdo al horno con papas rústicas (150gr de lomo de cerdo.) · Milanesa de pollo con arroz árabe (Pechuga de pollo 150 grs.)'),
  ('2026-09-26', 'CENA', 'Postres', 'Fruta Natural · Flan de vainilla con salsa de caramelo · Durazno en conserva · Jalea de piña'),
  ('2026-09-27', 'ALMUERZO', 'Ensaladas', 'Mix repollo blanco / zanahoria · Betarraga / zanahoria'),
  ('2026-09-27', 'ALMUERZO', 'Fondos', 'Escalopa de res con papas salteadas (Posta Negra 180 grs.) · Strogonoff de pollo con puré de papas (Pechuga de pollo 150 grs.)'),
  ('2026-09-27', 'ALMUERZO', 'Postres', 'Fruta Natural · Creme Caramel · Jalea Roja (frambuesa - guinda) · Leche Asada'),
  ('2026-09-27', 'CENA', 'Ensaladas', 'Mix 4 variedades · Lechuga / choclo'),
  ('2026-09-27', 'CENA', 'Fondos', 'Pollo asado con arroz chino (1/4 de Pollo. Pierna entera o media pechuga) · Lasagna Boloñesa (Tártaro Molido 110 grs.)'),
  ('2026-09-27', 'CENA', 'Postres', 'Fruta Natural · Compota de Duraznos · Sémola con leche y salsa de caramelo · Mousse de Manjar'),
  ('2026-09-28', 'ALMUERZO', 'Ensaladas', 'Tomate con ciboullete · Mix repollo blanco / zanahoria'),
  ('2026-09-28', 'ALMUERZO', 'Fondos', 'Pollo arvejado con arroz pilaf (1/4 de Pollo. Pierna entera o media pechuga) · Carne mechada con tallarines a la mantequilla (Ganso 200 grs. Producto terminado)'),
  ('2026-09-28', 'ALMUERZO', 'Postres', 'Fruta Natural · Flan de vainilla con salsa de caramelo · Arroz con leche · Jalea de piña'),
  ('2026-09-28', 'CENA', 'Ensaladas', 'Mix 4 variedades · Lechuga con aceitunas'),
  ('2026-09-28', 'CENA', 'Fondos', 'Suprema de pollo grillada con flan de zapallo italiano y zanahoria (Pechuga de pollo 150 grs.) · Asado alemán con puré de papas (Tártaro Molido 150 grs.)'),
  ('2026-09-28', 'CENA', 'Postres', 'Fruta Natural · Compota de Manzanas · Leche asada · Macedonia'),
  ('2026-09-29', 'ALMUERZO', 'Ensaladas', 'Mix Lechuga / repollo morado / zanahoria · Tomate con ciboullete'),
  ('2026-09-29', 'ALMUERZO', 'Fondos', 'Asado de res al jugo con spaghetti a la mantequilla (Ganso 200 grs. Producto terminado) · Pavo asado al horno con gratín de papas (Pechuga de pavo deshuesada 200 grs. Producto)'),
  ('2026-09-29', 'ALMUERZO', 'Postres', 'Fruta Natural · Jalea de Piña · Flan de Chocolate · Panna Cotta con salsa de frambuesa'),
  ('2026-09-29', 'CENA', 'Ensaladas', 'Mix 4 variedades · Lechuga con aceitunas'),
  ('2026-09-29', 'CENA', 'Fondos', 'Spaghetti con strogonoff de carne de cerdo · Pechuga de pollo a la plancha con puré rústico (Pechuga de pollo deshuesada 200 grs)'),
  ('2026-09-29', 'CENA', 'Postres', 'Fruta Natural · Macedonia de frutas · Leche asada · Macedonia'),
  ('2026-09-30', 'ALMUERZO', 'Ensaladas', 'Mix Lechuga / repollo morado / zanahoria · Tomate con ciboullete'),
  ('2026-09-30', 'ALMUERZO', 'Fondos', 'Pastel de papas con carne (Tártaro Molido 110 grs.) · Chapsui de pollo con fetuccini'),
  ('2026-09-30', 'ALMUERZO', 'Postres', 'Fruta Natural · Helado · Mousse de frutilla · Panna Cotta con salsa de frambuesa'),
  ('2026-09-30', 'CENA', 'Ensaladas', 'Tomate con ciboullete · Mix repollo blanco / zanahoria'),
  ('2026-09-30', 'CENA', 'Fondos', 'Cerdo al horno con papas rústicas (150gr de lomo de cerdo.) · Milanesa de pollo con arroz árabe (Pechuga de pollo 150 grs.)'),
  ('2026-09-30', 'CENA', 'Postres', 'Fruta Natural · Flan de vainilla con salsa de caramelo · Durazno en conserva · Jalea de piña'),
  ('2026-10-01', 'ALMUERZO', 'Ensaladas', 'Mix repollo blanco / zanahoria · Betarraga / zanahoria'),
  ('2026-10-01', 'ALMUERZO', 'Fondos', 'Escalopa de res con papas salteadas (Posta Negra 180 grs.) · Strogonoff de pollo con puré de papas (Pechuga de pollo 150 grs.)'),
  ('2026-10-01', 'ALMUERZO', 'Postres', 'Fruta Natural · Creme Caramel · Jalea Roja (frambuesa - guinda) · Leche Asada'),
  ('2026-10-01', 'CENA', 'Ensaladas', 'Mix 4 variedades · Lechuga / choclo'),
  ('2026-10-01', 'CENA', 'Fondos', 'Pollo asado con arroz chino (1/4 de Pollo. Pierna entera o media pechuga) · Lasagna Boloñesa (Tártaro Molido 110 grs.)'),
  ('2026-10-01', 'CENA', 'Postres', 'Fruta Natural · Compota de Duraznos · Sémola con leche y salsa de caramelo · Mousse de Manjar'),
  ('2026-10-02', 'ALMUERZO', 'Ensaladas', 'Tomate con ciboullete · Mix repollo blanco / zanahoria'),
  ('2026-10-02', 'ALMUERZO', 'Fondos', 'Pollo arvejado con arroz pilaf (1/4 de Pollo. Pierna entera o media pechuga) · Carne mechada con tallarines a la mantequilla (Ganso 200 grs. Producto terminado)'),
  ('2026-10-02', 'ALMUERZO', 'Postres', 'Fruta Natural · Flan de vainilla con salsa de caramelo · Arroz con leche · Jalea de piña'),
  ('2026-10-02', 'CENA', 'Ensaladas', 'Mix 4 variedades · Lechuga con aceitunas'),
  ('2026-10-02', 'CENA', 'Fondos', 'Suprema de pollo grillada con flan de zapallo italiano y zanahoria (Pechuga de pollo 150 grs.) · Asado alemán con puré de papas (Tártaro Molido 150 grs.)'),
  ('2026-10-02', 'CENA', 'Postres', 'Fruta Natural · Compota de Manzanas · Leche asada · Macedonia'),
  ('2026-10-03', 'ALMUERZO', 'Ensaladas', 'Mix Lechuga / repollo morado / zanahoria · Tomate con ciboullete'),
  ('2026-10-03', 'ALMUERZO', 'Fondos', 'Asado de res al jugo con spaghetti a la mantequilla (Ganso 200 grs. Producto terminado) · Pavo asado al horno con gratín de papas (Pechuga de pavo deshuesada 200 grs. Producto)'),
  ('2026-10-03', 'ALMUERZO', 'Postres', 'Fruta Natural · Jalea de Piña · Flan de Chocolate · Panna Cotta con salsa de frambuesa'),
  ('2026-10-03', 'CENA', 'Ensaladas', 'Mix 4 variedades · Lechuga con aceitunas'),
  ('2026-10-03', 'CENA', 'Fondos', 'Spaghetti con strogonoff de carne de cerdo · Pechuga de pollo a la plancha con puré rústico (Pechuga de pollo deshuesada 200 grs)'),
  ('2026-10-03', 'CENA', 'Postres', 'Fruta Natural · Macedonia de frutas · Leche asada · Macedonia'),
  ('2026-09-23', 'DESAYUNO', 'Carbohidratos', 'Pan Blanco/Integral (Marraqueta, Hallullas, Molde) · Avena · Fruta natural · Mermelada · Mantequilla'),
  ('2026-09-23', 'DESAYUNO', 'Proteínas', 'Huevos revueltos · Queso laminado · Queso fresco · Salame laminado · Jamón laminado'),
  ('2026-09-23', 'DESAYUNO', 'Líquidos', 'Té variedades · Café · Aguas · Jugos de fruta'),
  ('2026-09-23', 'DESAYUNO', 'Leche', 'Leche entera · Leche descremada · Leche semidescremada · Leche Sin lactosa'),
  ('2026-09-23', 'DESAYUNO', 'Yogurt', 'Yogurt entero · Yogurt Sin gluten · Yogurt sin lactosa'),
  ('2026-09-23', 'DESAYUNO', 'Cereales', 'De maíz · De chocolate · Granola'),
  ('2026-09-24', 'DESAYUNO', 'Carbohidratos', 'Pan Blanco/Integral (Marraqueta, Hallullas, Molde) · Avena · Fruta natural · Mermelada · Mantequilla'),
  ('2026-09-24', 'DESAYUNO', 'Proteínas', 'Huevos revueltos · Queso laminado · Queso fresco · Salame laminado · Jamón laminado'),
  ('2026-09-24', 'DESAYUNO', 'Líquidos', 'Té variedades · Café · Aguas · Jugos de fruta'),
  ('2026-09-24', 'DESAYUNO', 'Leche', 'Leche entera · Leche descremada · Leche semidescremada · Leche Sin lactosa'),
  ('2026-09-24', 'DESAYUNO', 'Yogurt', 'Yogurt entero · Yogurt Sin gluten · Yogurt sin lactosa'),
  ('2026-09-24', 'DESAYUNO', 'Cereales', 'De maíz · De chocolate · Granola'),
  ('2026-09-25', 'DESAYUNO', 'Carbohidratos', 'Pan Blanco/Integral (Marraqueta, Hallullas, Molde) · Avena · Fruta natural · Mermelada · Mantequilla'),
  ('2026-09-25', 'DESAYUNO', 'Proteínas', 'Huevos revueltos · Queso laminado · Queso fresco · Salame laminado · Jamón laminado'),
  ('2026-09-25', 'DESAYUNO', 'Líquidos', 'Té variedades · Café · Aguas · Jugos de fruta'),
  ('2026-09-25', 'DESAYUNO', 'Leche', 'Leche entera · Leche descremada · Leche semidescremada · Leche Sin lactosa'),
  ('2026-09-25', 'DESAYUNO', 'Yogurt', 'Yogurt entero · Yogurt Sin gluten · Yogurt sin lactosa'),
  ('2026-09-25', 'DESAYUNO', 'Cereales', 'De maíz · De chocolate · Granola'),
  ('2026-09-26', 'DESAYUNO', 'Carbohidratos', 'Pan Blanco/Integral (Marraqueta, Hallullas, Molde) · Avena · Fruta natural · Mermelada · Mantequilla'),
  ('2026-09-26', 'DESAYUNO', 'Proteínas', 'Huevos revueltos · Queso laminado · Queso fresco · Salame laminado · Jamón laminado'),
  ('2026-09-26', 'DESAYUNO', 'Líquidos', 'Té variedades · Café · Aguas · Jugos de fruta'),
  ('2026-09-26', 'DESAYUNO', 'Leche', 'Leche entera · Leche descremada · Leche semidescremada · Leche Sin lactosa'),
  ('2026-09-26', 'DESAYUNO', 'Yogurt', 'Yogurt entero · Yogurt Sin gluten · Yogurt sin lactosa'),
  ('2026-09-26', 'DESAYUNO', 'Cereales', 'De maíz · De chocolate · Granola'),
  ('2026-09-27', 'DESAYUNO', 'Carbohidratos', 'Pan Blanco/Integral (Marraqueta, Hallullas, Molde) · Avena · Fruta natural · Mermelada · Mantequilla'),
  ('2026-09-27', 'DESAYUNO', 'Proteínas', 'Huevos revueltos · Queso laminado · Queso fresco · Salame laminado · Jamón laminado'),
  ('2026-09-27', 'DESAYUNO', 'Líquidos', 'Té variedades · Café · Aguas · Jugos de fruta'),
  ('2026-09-27', 'DESAYUNO', 'Leche', 'Leche entera · Leche descremada · Leche semidescremada · Leche Sin lactosa'),
  ('2026-09-27', 'DESAYUNO', 'Yogurt', 'Yogurt entero · Yogurt Sin gluten · Yogurt sin lactosa'),
  ('2026-09-27', 'DESAYUNO', 'Cereales', 'De maíz · De chocolate · Granola'),
  ('2026-09-28', 'DESAYUNO', 'Carbohidratos', 'Pan Blanco/Integral (Marraqueta, Hallullas, Molde) · Avena · Fruta natural · Mermelada · Mantequilla'),
  ('2026-09-28', 'DESAYUNO', 'Proteínas', 'Huevos revueltos · Queso laminado · Queso fresco · Salame laminado · Jamón laminado'),
  ('2026-09-28', 'DESAYUNO', 'Líquidos', 'Té variedades · Café · Aguas · Jugos de fruta'),
  ('2026-09-28', 'DESAYUNO', 'Leche', 'Leche entera · Leche descremada · Leche semidescremada · Leche Sin lactosa'),
  ('2026-09-28', 'DESAYUNO', 'Yogurt', 'Yogurt entero · Yogurt Sin gluten · Yogurt sin lactosa'),
  ('2026-09-28', 'DESAYUNO', 'Cereales', 'De maíz · De chocolate · Granola'),
  ('2026-09-29', 'DESAYUNO', 'Carbohidratos', 'Pan Blanco/Integral (Marraqueta, Hallullas, Molde) · Avena · Fruta natural · Mermelada · Mantequilla'),
  ('2026-09-29', 'DESAYUNO', 'Proteínas', 'Huevos revueltos · Queso laminado · Queso fresco · Salame laminado · Jamón laminado'),
  ('2026-09-29', 'DESAYUNO', 'Líquidos', 'Té variedades · Café · Aguas · Jugos de fruta'),
  ('2026-09-29', 'DESAYUNO', 'Leche', 'Leche entera · Leche descremada · Leche semidescremada · Leche Sin lactosa'),
  ('2026-09-29', 'DESAYUNO', 'Yogurt', 'Yogurt entero · Yogurt Sin gluten · Yogurt sin lactosa'),
  ('2026-09-29', 'DESAYUNO', 'Cereales', 'De maíz · De chocolate · Granola'),
  ('2026-09-30', 'DESAYUNO', 'Carbohidratos', 'Pan Blanco/Integral (Marraqueta, Hallullas, Molde) · Avena · Fruta natural · Mermelada · Mantequilla'),
  ('2026-09-30', 'DESAYUNO', 'Proteínas', 'Huevos revueltos · Queso laminado · Queso fresco · Salame laminado · Jamón laminado'),
  ('2026-09-30', 'DESAYUNO', 'Líquidos', 'Té variedades · Café · Aguas · Jugos de fruta'),
  ('2026-09-30', 'DESAYUNO', 'Leche', 'Leche entera · Leche descremada · Leche semidescremada · Leche Sin lactosa'),
  ('2026-09-30', 'DESAYUNO', 'Yogurt', 'Yogurt entero · Yogurt Sin gluten · Yogurt sin lactosa'),
  ('2026-09-30', 'DESAYUNO', 'Cereales', 'De maíz · De chocolate · Granola'),
  ('2026-10-01', 'DESAYUNO', 'Carbohidratos', 'Pan Blanco/Integral (Marraqueta, Hallullas, Molde) · Avena · Fruta natural · Mermelada · Mantequilla'),
  ('2026-10-01', 'DESAYUNO', 'Proteínas', 'Huevos revueltos · Queso laminado · Queso fresco · Salame laminado · Jamón laminado'),
  ('2026-10-01', 'DESAYUNO', 'Líquidos', 'Té variedades · Café · Aguas · Jugos de fruta'),
  ('2026-10-01', 'DESAYUNO', 'Leche', 'Leche entera · Leche descremada · Leche semidescremada · Leche Sin lactosa'),
  ('2026-10-01', 'DESAYUNO', 'Yogurt', 'Yogurt entero · Yogurt Sin gluten · Yogurt sin lactosa'),
  ('2026-10-01', 'DESAYUNO', 'Cereales', 'De maíz · De chocolate · Granola'),
  ('2026-10-02', 'DESAYUNO', 'Carbohidratos', 'Pan Blanco/Integral (Marraqueta, Hallullas, Molde) · Avena · Fruta natural · Mermelada · Mantequilla'),
  ('2026-10-02', 'DESAYUNO', 'Proteínas', 'Huevos revueltos · Queso laminado · Queso fresco · Salame laminado · Jamón laminado'),
  ('2026-10-02', 'DESAYUNO', 'Líquidos', 'Té variedades · Café · Aguas · Jugos de fruta'),
  ('2026-10-02', 'DESAYUNO', 'Leche', 'Leche entera · Leche descremada · Leche semidescremada · Leche Sin lactosa'),
  ('2026-10-02', 'DESAYUNO', 'Yogurt', 'Yogurt entero · Yogurt Sin gluten · Yogurt sin lactosa'),
  ('2026-10-02', 'DESAYUNO', 'Cereales', 'De maíz · De chocolate · Granola'),
  ('2026-10-03', 'DESAYUNO', 'Carbohidratos', 'Pan Blanco/Integral (Marraqueta, Hallullas, Molde) · Avena · Fruta natural · Mermelada · Mantequilla'),
  ('2026-10-03', 'DESAYUNO', 'Proteínas', 'Huevos revueltos · Queso laminado · Queso fresco · Salame laminado · Jamón laminado'),
  ('2026-10-03', 'DESAYUNO', 'Líquidos', 'Té variedades · Café · Aguas · Jugos de fruta'),
  ('2026-10-03', 'DESAYUNO', 'Leche', 'Leche entera · Leche descremada · Leche semidescremada · Leche Sin lactosa'),
  ('2026-10-03', 'DESAYUNO', 'Yogurt', 'Yogurt entero · Yogurt Sin gluten · Yogurt sin lactosa'),
  ('2026-10-03', 'DESAYUNO', 'Cereales', 'De maíz · De chocolate · Granola'),
  ('2026-10-04', 'DESAYUNO', 'Carbohidratos', 'Pan Blanco/Integral (Marraqueta, Hallullas, Molde) · Avena · Fruta natural · Mermelada · Mantequilla'),
  ('2026-10-04', 'DESAYUNO', 'Proteínas', 'Huevos revueltos · Queso laminado · Queso fresco · Salame laminado · Jamón laminado'),
  ('2026-10-04', 'DESAYUNO', 'Líquidos', 'Té variedades · Café · Aguas · Jugos de fruta'),
  ('2026-10-04', 'DESAYUNO', 'Leche', 'Leche entera · Leche descremada · Leche semidescremada · Leche Sin lactosa'),
  ('2026-10-04', 'DESAYUNO', 'Yogurt', 'Yogurt entero · Yogurt Sin gluten · Yogurt sin lactosa'),
  ('2026-10-04', 'DESAYUNO', 'Cereales', 'De maíz · De chocolate · Granola');

-- ── Bloques horarios ──────────────────────────────────────────────────────
delete from logistics.meal_time_blocks
 where event_id = (select id from core.events where name like 'Final Nacional sub 14%' limit 1);

insert into logistics.meal_time_blocks (event_id, meal_type, date, starts_at, ends_at, note)
select e.id, v.meal_type, v.date, v.starts_at, v.ends_at, v.note
  from (select id from core.events where name like 'Final Nacional sub 14%' limit 1) e
 cross join (values
  ('DESAYUNO', null::date, '07:00'::time, '11:00'::time, null::text),
  ('DESAYUNO', '2026-09-24'::date, '06:30'::time, '11:00'::time, 'Extensión excepcional'),
  ('DESAYUNO', '2026-09-30'::date, '06:30'::time, '11:00'::time, 'Extensión excepcional'),
  ('DESAYUNO', '2026-10-03'::date, '06:30'::time, '11:00'::time, 'Extensión excepcional'),
  ('DESAYUNO', '2026-10-04'::date, '06:30'::time, '11:00'::time, 'Extensión excepcional'),
  ('ALMUERZO', null::date, '12:00'::time, '16:00'::time, null::text),
  ('COLACION', null::date, '12:00'::time, '16:00'::time, null::text),
  ('CENA', null::date, '19:00'::time, '23:00'::time, null::text),
  ('CENA', '2026-09-22'::date, '18:30'::time, '23:45'::time, 'Extensión excepcional'),
  ('CENA', '2026-09-23'::date, '19:00'::time, '23:45'::time, 'Extensión excepcional'),
  ('CENA', '2026-09-24'::date, '19:00'::time, '23:30'::time, 'Extensión excepcional'),
  ('CENA', '2026-09-27'::date, '19:00'::time, '23:30'::time, 'Extensión excepcional'),
  ('CENA', '2026-09-30'::date, '19:00'::time, '23:30'::time, 'Extensión excepcional'),
  ('CENA', '2026-10-03'::date, '19:00'::time, '23:30'::time, 'Extensión excepcional')
 ) as v(meal_type, date, starts_at, ends_at, note);

commit;

-- Control: 25 servicios de almuerzo/cena (3 filas cada uno) + 12 días de
-- desayuno (6 filas cada uno), y 14 bloques horarios.
select meal_type, count(*)::int as filas, count(distinct date)::int as dias
  from logistics.food_menus group by meal_type order by meal_type;

select meal_type,
       count(*) filter (where date is null)::int as general,
       count(*) filter (where date is not null)::int as extensiones
  from logistics.meal_time_blocks group by meal_type order by meal_type;
