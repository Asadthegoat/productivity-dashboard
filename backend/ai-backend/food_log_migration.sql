-- Create the food_log table for calorie tracking
CREATE TABLE IF NOT EXISTS food_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  food_name TEXT NOT NULL,
  calories NUMERIC NOT NULL,
  protein NUMERIC NOT NULL,
  carbs NUMERIC NOT NULL,
  fat NUMERIC NOT NULL,
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Update eating_goals to support a writable daily calorie target.
ALTER TABLE eating_goals
  ADD COLUMN IF NOT EXISTS daily_calorie_goal INTEGER DEFAULT 2200;
