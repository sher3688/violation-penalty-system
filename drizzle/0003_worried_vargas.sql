CREATE TABLE `case_photo_objects` (
	`storageKey` varchar(255) NOT NULL,
	`data` mediumblob NOT NULL,
	`mimeType` varchar(80) NOT NULL,
	`size` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `case_photo_objects_storageKey` PRIMARY KEY(`storageKey`)
);
