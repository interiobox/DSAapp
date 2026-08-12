CREATE TABLE `attendance_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employee_id` int NOT NULL,
	`attendance_date` date NOT NULL,
	`status` varchar(20) NOT NULL,
	`reason` text,
	`recorded_by` int NOT NULL,
	`latitude` double,
	`longitude` double,
	`accuracy_meters` double,
	`self_checkin_at` datetime,
	`recorded_at` datetime NOT NULL DEFAULT (now()),
	`updated_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `attendance_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `attendance_employee_date_unique` UNIQUE(`employee_id`,`attendance_date`)
);
--> statement-breakpoint
CREATE TABLE `drawing_activity` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` text NOT NULL,
	`message` text NOT NULL,
	`drawing_id` int,
	`actor` text,
	`created_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `drawing_activity_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `drawing_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`drawing_id` int NOT NULL,
	`comment` text NOT NULL,
	`author` text NOT NULL,
	`author_id` int,
	`deleted_at` datetime,
	`created_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `drawing_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `drawing_uploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`drawing_id` int NOT NULL,
	`file_path` text NOT NULL,
	`file_name` text NOT NULL,
	`file_size` int NOT NULL,
	`content_type` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`deleted_at` datetime,
	`uploaded_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `drawing_uploads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `drawings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`drawing_number` text NOT NULL,
	`title` text NOT NULL,
	`discipline` varchar(100) NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'draft',
	`assigned_to` text,
	`assigned_to_user_id` int,
	`revision` text NOT NULL DEFAULT ('A'),
	`project_name` varchar(255) NOT NULL,
	`sheet_size` varchar(20) NOT NULL DEFAULT 'A1',
	`author` text NOT NULL,
	`description` text,
	`due_date` date,
	`issued_date` date,
	`attachment_path` text,
	`attachment_name` text,
	`attachment_size` int,
	`attachment_content_type` text,
	`deleted_at` datetime,
	`updated_at` datetime NOT NULL DEFAULT (now()),
	`created_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `drawings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`deleted_at` datetime,
	`created_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `portal_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`user_id` int NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `portal_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `portal_sessions_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`username` varchar(255),
	`password_hash` text,
	`role` varchar(50) NOT NULL DEFAULT 'user',
	`active` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`created_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_name_unique` UNIQUE(`name`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `google_drive_connections` (
`id` int NOT NULL,
`account_email` varchar(255),
`display_name` varchar(255),
`refresh_token_encrypted` text NOT NULL,
`access_token_encrypted` text,
`access_token_expires_at` datetime,
`root_folder_id` varchar(255) NOT NULL,
`created_by_user_id` int NOT NULL,
`created_at` datetime NOT NULL DEFAULT (now()),
`updated_at` datetime NOT NULL DEFAULT (now()),
CONSTRAINT `google_drive_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `disciplines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`deleted_at` datetime,
	`created_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `disciplines_id` PRIMARY KEY(`id`),
	CONSTRAINT `disciplines_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `checklist_template_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`template_id` int NOT NULL,
	`title` text NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	CONSTRAINT `checklist_template_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `checklist_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`created_by` int NOT NULL,
	`deleted_at` datetime,
	`created_at` datetime NOT NULL DEFAULT (now()),
	`updated_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `checklist_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `checklist_templates_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `project_checklist_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_checklist_id` int NOT NULL,
	`title` text NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`completed` boolean NOT NULL DEFAULT false,
	`completed_by` int,
	`completed_at` datetime,
	CONSTRAINT `project_checklist_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_checklists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_name` varchar(255) NOT NULL,
	`template_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`created_by` int NOT NULL,
	`deleted_at` datetime,
	`created_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `project_checklists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_channels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`created_by` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_channels_id` PRIMARY KEY(`id`),
	CONSTRAINT `chat_channels_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channel_id` int NOT NULL,
	`author_id` int NOT NULL,
	`author_name` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`created_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipient_id` int NOT NULL,
	`type` varchar(100) NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`link` text,
	`read_at` datetime,
	`created_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contact_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contact_id` int NOT NULL,
	`project_name` varchar(255) NOT NULL,
	`role` text,
	`notes` text,
	`deleted_at` datetime,
	`created_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `contact_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_name` varchar(255) NOT NULL,
	`contact_name` text,
	`type` varchar(100) NOT NULL DEFAULT 'consultant',
	`service` text,
	`email` text,
	`phone` text,
	`website` text,
	`address` text,
	`notes` text,
	`created_by` int,
	`deleted_at` datetime,
	`created_at` datetime NOT NULL DEFAULT (now()),
	`updated_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `personal_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`author_name` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL DEFAULT 'Personal note',
	`content` text NOT NULL,
	`deleted_at` datetime,
	`created_at` datetime NOT NULL DEFAULT (now()),
	`updated_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `personal_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_name` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`author_id` int NOT NULL,
	`author_name` varchar(255) NOT NULL,
	`deleted_at` datetime,
	`created_at` datetime NOT NULL DEFAULT (now()),
	`updated_at` datetime NOT NULL DEFAULT (now()),
	CONSTRAINT `project_notes_id` PRIMARY KEY(`id`)
);
