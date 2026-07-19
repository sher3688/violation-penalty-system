CREATE TABLE `violation_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`defaultDescription` text NOT NULL,
	`defaultPenaltyAmount` int NOT NULL DEFAULT 0,
	`regulationBasis` varchar(255) NOT NULL DEFAULT '住戶規約',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `violation_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `violation_templates_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `violation_cases` ADD `templateId` int;--> statement-breakpoint
ALTER TABLE `violation_templates` ADD CONSTRAINT `violation_templates_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `templates_active_idx` ON `violation_templates` (`isActive`,`name`);--> statement-breakpoint
ALTER TABLE `violation_cases` ADD CONSTRAINT `violation_cases_templateId_violation_templates_id_fk` FOREIGN KEY (`templateId`) REFERENCES `violation_templates`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cases_template_idx` ON `violation_cases` (`templateId`);