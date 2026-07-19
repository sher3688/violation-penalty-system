CREATE TABLE `case_appeals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`content` text NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`result` text,
	`decidedAt` timestamp,
	`decidedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `case_appeals_id` PRIMARY KEY(`id`),
	CONSTRAINT `case_appeals_case_unique` UNIQUE(`caseId`)
);
--> statement-breakpoint
CREATE TABLE `case_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`amount` int NOT NULL,
	`paidAt` timestamp NOT NULL,
	`note` text,
	`receivedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `case_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `case_payments_case_unique` UNIQUE(`caseId`)
);
--> statement-breakpoint
CREATE TABLE `case_photos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`storageKey` varchar(255) NOT NULL,
	`originalName` varchar(255) NOT NULL,
	`mimeType` varchar(80) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `case_photos_id` PRIMARY KEY(`id`),
	CONSTRAINT `case_photos_storageKey_unique` UNIQUE(`storageKey`)
);
--> statement-breakpoint
CREATE TABLE `households` (
	`id` int AUTO_INCREMENT NOT NULL,
	`householdNo` varchar(64) NOT NULL,
	`residentName` varchar(120),
	`contactEmail` varchar(320),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `households_id` PRIMARY KEY(`id`),
	CONSTRAINT `households_householdNo_unique` UNIQUE(`householdNo`)
);
--> statement-breakpoint
CREATE TABLE `violation_cases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`noticeNo` varchar(40) NOT NULL,
	`householdNo` varchar(64) NOT NULL,
	`violationType` varchar(120) NOT NULL,
	`occurredAt` timestamp NOT NULL,
	`location` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`penaltyAmount` int NOT NULL DEFAULT 0,
	`status` enum('pending_payment','paid','appealing','closed') NOT NULL DEFAULT 'pending_payment',
	`regulationBasis` varchar(255) NOT NULL DEFAULT '住戶規約',
	`managementOfficeName` varchar(160) NOT NULL DEFAULT '社區管理委員會',
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `violation_cases_id` PRIMARY KEY(`id`),
	CONSTRAINT `violation_cases_noticeNo_unique` UNIQUE(`noticeNo`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `username` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `householdNo` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_username_unique` UNIQUE(`username`);--> statement-breakpoint
ALTER TABLE `case_appeals` ADD CONSTRAINT `case_appeals_caseId_violation_cases_id_fk` FOREIGN KEY (`caseId`) REFERENCES `violation_cases`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_appeals` ADD CONSTRAINT `case_appeals_decidedByUserId_users_id_fk` FOREIGN KEY (`decidedByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_payments` ADD CONSTRAINT `case_payments_caseId_violation_cases_id_fk` FOREIGN KEY (`caseId`) REFERENCES `violation_cases`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_payments` ADD CONSTRAINT `case_payments_receivedByUserId_users_id_fk` FOREIGN KEY (`receivedByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_photos` ADD CONSTRAINT `case_photos_caseId_violation_cases_id_fk` FOREIGN KEY (`caseId`) REFERENCES `violation_cases`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `violation_cases` ADD CONSTRAINT `violation_cases_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `case_photos_case_idx` ON `case_photos` (`caseId`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `households_active_idx` ON `households` (`isActive`,`householdNo`);--> statement-breakpoint
CREATE INDEX `cases_household_idx` ON `violation_cases` (`householdNo`);--> statement-breakpoint
CREATE INDEX `cases_status_idx` ON `violation_cases` (`status`);--> statement-breakpoint
CREATE INDEX `cases_occurred_at_idx` ON `violation_cases` (`occurredAt`);--> statement-breakpoint
CREATE INDEX `users_household_idx` ON `users` (`householdNo`);--> statement-breakpoint
CREATE INDEX `users_role_active_idx` ON `users` (`role`,`isActive`);