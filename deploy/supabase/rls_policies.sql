-- Supabase RLS and policy examples for peacock-time-v2
-- Run these in the Supabase SQL editor (Project > SQL Editor)

-- 1) Enable Row-Level Security on tables
ALTER TABLE IF EXISTS public.baby_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory ENABLE ROW LEVEL SECURITY;

-- 2) Policies that allow a signed-in user to operate on rows in their family
-- Assumes there is a user_profiles table mapping user id (auth uid) -> family_code

-- baby_log
CREATE POLICY IF NOT EXISTS "select_baby_log_by_family" ON public.baby_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.family_code = public.baby_log.family_code
    )
  );

CREATE POLICY IF NOT EXISTS "insert_baby_log_if_member" ON public.baby_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.family_code = new.family_code
    )
  );

CREATE POLICY IF NOT EXISTS "update_baby_log_if_member" ON public.baby_log
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.family_code = public.baby_log.family_code
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.family_code = new.family_code
    )
  );

CREATE POLICY IF NOT EXISTS "delete_baby_log_if_member" ON public.baby_log
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.family_code = public.baby_log.family_code
    )
  );

-- checklist (same pattern)
CREATE POLICY IF NOT EXISTS "select_checklist_by_family" ON public.checklist
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.family_code = public.checklist.family_code
    )
  );

CREATE POLICY IF NOT EXISTS "insert_checklist_if_member" ON public.checklist
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.family_code = new.family_code
    )
  );

CREATE POLICY IF NOT EXISTS "update_checklist_if_member" ON public.checklist
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.family_code = public.checklist.family_code
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.family_code = new.family_code
    )
  );

CREATE POLICY IF NOT EXISTS "delete_checklist_if_member" ON public.checklist
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.family_code = public.checklist.family_code
    )
  );

-- inventory (same pattern)
CREATE POLICY IF NOT EXISTS "select_inventory_by_family" ON public.inventory
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.family_code = public.inventory.family_code
    )
  );

CREATE POLICY IF NOT EXISTS "insert_inventory_if_member" ON public.inventory
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.family_code = new.family_code
    )
  );

CREATE POLICY IF NOT EXISTS "update_inventory_if_member" ON public.inventory
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.family_code = public.inventory.family_code
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.family_code = new.family_code
    )
  );

CREATE POLICY IF NOT EXISTS "delete_inventory_if_member" ON public.inventory
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.family_code = public.inventory.family_code
    )
  );

-- Notes:
-- 1) The Supabase service_role key (server-side) bypasses RLS — keep it secret.
-- 2) Adjust policy logic if your user_profiles schema differs.
-- 3) Test these policies in Supabase SQL editor before applying to production.
