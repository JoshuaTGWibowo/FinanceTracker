-- Mission Database Seed
-- Populates the missions table with initial daily, weekly, and monthly missions

-- Daily Missions (24-hour goals)
INSERT INTO missions (title, description, mission_type, goal_type, goal_target, points_reward, starts_at, ends_at, is_active)
VALUES
  -- Transaction logging missions
  ('Daily Logger', 'Log 3 transactions today', 'individual', 'transactions_logged', 3, 15, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day', true),
  ('Active Tracker', 'Log 5 transactions today', 'individual', 'transactions_logged', 5, 25, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day', true),
  
  -- Budget adherence missions
  ('Budget Conscious', 'Stay within budget today', 'individual', 'budget_adherence', 100, 20, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day', true),
  
  -- Savings rate missions
  ('Daily Saver', 'Save at least 10% of your income today', 'individual', 'savings_rate', 10, 30, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day', true),
  ('Super Saver', 'Save at least 20% of your income today', 'individual', 'savings_rate', 20, 50, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day', true)
ON CONFLICT DO NOTHING;

-- Weekly Missions (7-day goals)
INSERT INTO missions (title, description, mission_type, goal_type, goal_target, points_reward, starts_at, ends_at, is_active)
VALUES
  -- Streak missions
  ('Week Warrior', 'Maintain a 7-day logging streak', 'individual', 'streak', 7, 100, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER + INTERVAL '7 days', true),
  
  -- Transaction volume missions
  ('Weekly Tracker', 'Log 20 transactions this week', 'individual', 'transactions_logged', 20, 75, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER + INTERVAL '7 days', true),
  ('Transaction Master', 'Log 35 transactions this week', 'individual', 'transactions_logged', 35, 125, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER + INTERVAL '7 days', true),
  
  -- Budget adherence missions
  ('Budget Week', 'Stay within budget all week', 'individual', 'budget_adherence', 100, 150, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER + INTERVAL '7 days', true),
  
  -- Savings rate missions
  ('Weekly Savings Goal', 'Save 15% of your weekly income', 'individual', 'savings_rate', 15, 100, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER + INTERVAL '7 days', true),
  ('Aggressive Saver', 'Save 25% of your weekly income', 'individual', 'savings_rate', 25, 175, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER + INTERVAL '7 days', true)
ON CONFLICT DO NOTHING;

-- Monthly Missions (30-day goals)
INSERT INTO missions (title, description, mission_type, goal_type, goal_target, points_reward, starts_at, ends_at, is_active)
VALUES
  -- Streak missions
  ('Month Dedication', 'Maintain a 30-day logging streak', 'individual', 'streak', 30, 500, DATE_TRUNC('month', CURRENT_DATE), DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month', true),
  ('Streak Legend', 'Maintain a 60-day logging streak', 'individual', 'streak', 60, 1000, DATE_TRUNC('month', CURRENT_DATE), DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month', true),
  
  -- Transaction volume missions
  ('Monthly Tracker', 'Log 100 transactions this month', 'individual', 'transactions_logged', 100, 300, DATE_TRUNC('month', CURRENT_DATE), DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month', true),
  ('Transaction Legend', 'Log 200 transactions this month', 'individual', 'transactions_logged', 200, 600, DATE_TRUNC('month', CURRENT_DATE), DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month', true),
  
  -- Budget adherence missions
  ('Budget Master', 'Stay within budget all month', 'individual', 'budget_adherence', 100, 750, DATE_TRUNC('month', CURRENT_DATE), DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month', true),
  
  -- Savings rate missions
  ('Monthly Savings Target', 'Save 20% of your monthly income', 'individual', 'savings_rate', 20, 400, DATE_TRUNC('month', CURRENT_DATE), DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month', true),
  ('Savings Champion', 'Save 30% of your monthly income', 'individual', 'savings_rate', 30, 750, DATE_TRUNC('month', CURRENT_DATE), DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month', true),
  ('Ultimate Saver', 'Save 40% of your monthly income', 'individual', 'savings_rate', 40, 1200, DATE_TRUNC('month', CURRENT_DATE), DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month', true)
ON CONFLICT DO NOTHING;

-- Crew Missions (example weekly crew challenges)
INSERT INTO missions (title, description, mission_type, goal_type, goal_target, points_reward, starts_at, ends_at, is_active)
VALUES
  ('Crew Logger Challenge', 'Your crew logs 100 transactions this week', 'crew', 'transactions_logged', 100, 200, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER + INTERVAL '7 days', true),
  ('Crew Savings Goal', 'Your crew saves 20% collectively this week', 'crew', 'savings_rate', 20, 250, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER + INTERVAL '7 days', true),
  ('Crew Budget Masters', 'All crew members stay within budget this week', 'crew', 'budget_adherence', 100, 300, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER, CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER + INTERVAL '7 days', true)
ON CONFLICT DO NOTHING;

-- Notes:
-- 1. Daily missions reset every 24 hours (can be updated with a cron job or app logic)
-- 2. Weekly missions start on Sunday (EXTRACT(DOW FROM CURRENT_DATE) = 0)
-- 3. Monthly missions start on the 1st of each month
-- 4. Point rewards scale with difficulty
-- 5. Crew missions require crew_id assignment (handled in app logic when user joins crew)
-- 6. Use ON CONFLICT DO NOTHING to allow safe re-running of this seed script
