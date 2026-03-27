-- Add dietary_type to food_menus: associates a menu entry with a specific dietary requirement
alter table logistics.food_menus
  add column if not exists dietary_type text;

create index if not exists idx_food_menus_dietary_type on logistics.food_menus(dietary_type);
