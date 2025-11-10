CREATE TABLE IF NOT EXISTS assignment_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  platform VARCHAR(30) NOT NULL,
  external_assignment_id VARCHAR(191) NOT NULL,
  course_id VARCHAR(191) NULL,
  course_name VARCHAR(255) NULL,
  title VARCHAR(255) NULL,
  due_date DATETIME NULL,
  first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_notification_at DATETIME NULL,
  metadata JSON NULL,
  is_completed TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT uq_assignment_snapshot UNIQUE (user_id, platform, external_assignment_id),
  CONSTRAINT fk_assignment_snapshot_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
