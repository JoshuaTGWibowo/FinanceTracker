-- Mission Database Seed (Timezone-Aware Version)
-- Populates the missions table with initial daily, weekly, and monthly missions
-- Uses NOW() instead of CURRENT_DATE for better timezone handling

-- Daily Missions (24-hour goals from current time)
INSERT INTO missions (title, description, mission_type, goal_type, goal_target, points_reward, starts_at, ends_at, is_active)
VALUES
  -- Transaction logging missions
  ('Daily Logger', 'Log 3 transactions today', 'individual', 'transactions_logged', 3, 15, NOW(), NOW() + INTERVAL '24 hours', true),
  ('Active Tracker', 'Log 5 transactions today', 'individual', 'transactions_logged', 5, 25, NOW(), NOW() + INTERVAL '24 hours', true),
  
  -- Budget adherence missions
  ('Budget Conscious', 'Stay within budget today', 'individual', 'budget_adherence', 100, 20, NOW(), NOW() + INTERVAL '24 hours', true),
  
  -- Savings rate missions
  ('Daily Saver', 'Save at least 10% of your income today', 'individual', 'savings_rate', 10, 30, NOW(), NOW() + INTERVAL '24 hours', true),
  ('Super Saver', 'Save at least 20% of your income today', 'individual', 'savings_rate', 20, 50, NOW(), NOW() + INTERVAL '24 hours', true)
ON CONFLICT DO NOTHING;

-- Weekly Missions (7-day goals from Sunday)
INSERT INTO missions (title, description, mission_type, goal_type, goal_target, points_reward, starts_at, ends_at, is_active)
VALUES
  -- Streak missions
  ('Week Warrior', 'Maintain a 7-day logging streak', 'individual', 'streak', 7, 100, 
   DATE_TRUNC('week', NOW()), DATE_TRUNC('week', NOW()) + INTERVAL '7 days', true),
  
  -- Transaction volume missions
  ('Weekly Tracker', 'Log 20 transactions this week', 'individual', 'transactions_logged', 20, 75, 
   DATE_TRUNC('week', NOW()), DATE_TRUNC('week', NOW()) + INTERVAL '7 days', true),
  ('Transaction Master', 'Log 35 transactions this week', 'individual', 'transactions_logged', 35, 125, 
   DATE_TRUNC('week', NOW()), DATE_TRUNC('week', NOW()) + INTERVAL '7 days', true),
  
  -- Budget adherence missions
  ('Budget Week', 'Stay within budget all week', 'individual', 'budget_adherence', 100, 150, 
   DATE_TRUNC('week', NOW()), DATE_TRUNC('week', NOW()) + INTERVAL '7 days', true),
  
  -- Savings rate missions
  ('Weekly Savings Goal', 'Save 15% of your weekly income', 'individual', 'savings_rate', 15, 100, 
   DATE_TRUNC('week', NOW()), DATE_TRUNC('week', NOW()) + INTERVAL '7 days', true),
  ('Aggressive Saver', 'Save 25% of your weekly income', 'individual', 'savings_rate', 25, 175, 
   DATE_TRUNC('week', NOW()), DATE_TRUNC('week', NOW()) + INTERVAL '7 days', true)
ON CONFLICT DO NOTHING;

-- Monthly Missions (30-day goals from 1st of month)
INSERT INTO missions (title, description, mission_type, goal_type, goal_target, points_reward, starts_at, ends_at, is_active)
VALUES
  -- Streak missions
  ('Month Dedication', 'Maintain a 30-day logging streak', 'individual', 'streak', 30, 500, 
   DATE_TRUNC('month', NOW()), DATE_TRUNC('month', NOW()) + INTERVAL '1 month', true),
  ('Streak Legend', 'Maintain a 60-day logging streak', 'individual', 'streak', 60, 1000, 
   DATE_TRUNC('month', NOW()), DATE_TRUNC('month', NOW()) + INTERVAL '1 month', true),
  
  -- Transaction volume missions
  ('Monthly Tracker', 'Log 100 transactions this month', 'individual', 'transactions_logged', 100, 300, 
   DATE_TRUNC('month', NOW()), DATE_TRUNC('month', NOW()) + INTERVAL '1 month', true),
  ('Transaction Legend', 'Log 200 transactions this month', 'individual', 'transactions_logged', 200, 600, 
   DATE_TRUNC('month', NOW()), DATE_TRUNC('month', NOW()) + INTERVAL '1 month', true),
  
  -- Budget adherence missions
  ('Budget Master', 'Stay within budget all month', 'individual', 'budget_adherence', 100, 750, 
   DATE_TRUNC('month', NOW()), DATE_TRUNC('month', NOW()) + INTERVAL '1 month', true),
  
  -- Savings rate missions
  ('Monthly Savings Target', 'Save 20% of your monthly income', 'individual', 'savings_rate', 20, 400, 
   DATE_TRUNC('month', NOW()), DATE_TRUNC('month', NOW()) + INTERVAL '1 month', true),
  ('Savings Champion', 'Save 30% of your monthly income', 'individual', 'savings_rate', 30, 750, 
   DATE_TRUNC('month', NOW()), DATE_TRUNC('month', NOW()) + INTERVAL '1 month', true),
  ('Ultimate Saver', 'Save 40% of your monthly income', 'individual', 'savings_rate', 40, 1200, 
   DATE_TRUNC('month', NOW()), DATE_TRUNC('month', NOW()) + INTERVAL '1 month', true)
ON CONFLICT DO NOTHING;

-- Crew Missions (example weekly crew challenges)
INSERT INTO missions (title, description, mission_type, goal_type, goal_target, points_reward, starts_at, ends_at, is_active)
VALUES
  ('Crew Logger Challenge', 'Your crew logs 100 transactions this week', 'crew', 'transactions_logged', 100, 200, 
   DATE_TRUNC('week', NOW()), DATE_TRUNC('week', NOW()) + INTERVAL '7 days', true),
  ('Crew Savings Goal', 'Your crew saves 20% collectively this week', 'crew', 'savings_rate', 20, 250, 
   DATE_TRUNC('week', NOW()), DATE_TRUNC('week', NOW()) + INTERVAL '7 days', true),
  ('Crew Budget Masters', 'All crew members stay within budget this week', 'crew', 'budget_adherence', 100, 300, 
   DATE_TRUNC('week', NOW()), DATE_TRUNC('week', NOW()) + INTERVAL '7 days', true)
ON CONFLICT DO NOTHING;

-- Notes:
-- 1. NOW() uses the database's timezone setting, which should be configured in Supabase settings
-- 2. Daily missions now use 24-hour periods from NOW() instead of calendar days
-- 3. Weekly missions start on Sunday using DATE_TRUNC('week', NOW())
-- 4. Monthly missions start on the 1st of each month using DATE_TRUNC('month', NOW())
-- 5. Point rewards scale with difficulty
-- 6. Crew missions require crew_id assignment (handled in app logic when user joins crew)
-- 7. Use ON CONFLICT DO NOTHING to allow safe re-running of this seed script

-- To set your Supabase database timezone to your local timezone:
-- ALTER DATABASE postgres SET timezone TO 'Asia/Jakarta';  -- Replace with your timezone
-- Or configure in Supabase Dashboard > Settings > Database
