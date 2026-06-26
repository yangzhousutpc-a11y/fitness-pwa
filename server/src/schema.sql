CREATE TABLE IF NOT EXISTS custom_plans (
  id VARCHAR(128) PRIMARY KEY,
  coach_name VARCHAR(128) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  source_url TEXT NOT NULL,
  plan_type VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_plan_days (
  id VARCHAR(128) PRIMARY KEY,
  plan_id VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  focus_json JSON NOT NULL,
  source_url TEXT NOT NULL,
  sort_order INT NOT NULL,
  CONSTRAINT fk_custom_plan_days_plan
    FOREIGN KEY (plan_id) REFERENCES custom_plans(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS custom_plan_day_exercises (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  day_id VARCHAR(128) NOT NULL,
  exercise_id VARCHAR(128) NOT NULL,
  sort_order INT NOT NULL,
  CONSTRAINT fk_custom_plan_day_exercises_day
    FOREIGN KEY (day_id) REFERENCES custom_plan_days(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workout_sessions (
  id VARCHAR(128) PRIMARY KEY,
  date VARCHAR(64) NOT NULL,
  plan_id VARCHAR(128) NOT NULL,
  day_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workout_exercise_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(128) NOT NULL,
  exercise_id VARCHAR(128) NOT NULL,
  note TEXT NOT NULL,
  sort_order INT NOT NULL,
  CONSTRAINT fk_workout_exercise_logs_session
    FOREIGN KEY (session_id) REFERENCES workout_sessions(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workout_set_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  exercise_log_id BIGINT UNSIGNED NOT NULL,
  set_number INT NOT NULL,
  weight DECIMAL(8, 2) NULL,
  reps INT NULL,
  completed BOOLEAN NOT NULL,
  CONSTRAINT fk_workout_set_logs_exercise_log
    FOREIGN KEY (exercise_log_id) REFERENCES workout_exercise_logs(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_preferences (
  preference_key VARCHAR(128) PRIMARY KEY,
  preference_value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
