CREATE TABLE `animales` (
	`id` text PRIMARY KEY NOT NULL,
	`finca_id` text NOT NULL,
	`especie_id` integer NOT NULL,
	`raza_id` integer NOT NULL,
	`lote_id` text,
	`arete_codigo` text NOT NULL,
	`nombre` text,
	`fecha_nacimiento` text NOT NULL,
	`sexo` text NOT NULL,
	`peso_inicial` real NOT NULL,
	`categoria` text NOT NULL,
	`proposito` text NOT NULL,
	`estado` text DEFAULT 'Activo' NOT NULL,
	`madre_id` text,
	`padre_id` text,
	`notas` text,
	`creado_en` integer,
	FOREIGN KEY (`finca_id`) REFERENCES `fincas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`especie_id`) REFERENCES `especies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`raza_id`) REFERENCES `razas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lote_id`) REFERENCES `lotes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_arete_finca` ON `animales` (`finca_id`,`arete_codigo`);--> statement-breakpoint
CREATE INDEX `idx_animal_lote` ON `animales` (`lote_id`);--> statement-breakpoint
CREATE INDEX `idx_animal_categoria` ON `animales` (`categoria`);--> statement-breakpoint
CREATE TABLE `especies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `especies_nombre_unique` ON `especies` (`nombre`);--> statement-breakpoint
CREATE TABLE `eventos_reproductivos` (
	`id` text PRIMARY KEY NOT NULL,
	`animal_id` text NOT NULL,
	`tipo_evento` text NOT NULL,
	`fecha_evento` text NOT NULL,
	`resultado_palpacion` text,
	`toro_o_pajuela` text,
	`fecha_probable_parto` text,
	`detalles_parto` text,
	`notas` text,
	FOREIGN KEY (`animal_id`) REFERENCES `animales`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fincas` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`ubicacion` text,
	`activa` integer DEFAULT 0,
	`creado_en` integer
);
--> statement-breakpoint
CREATE TABLE `historial_medico` (
	`id` text PRIMARY KEY NOT NULL,
	`animal_id` text NOT NULL,
	`tipo_manejo` text NOT NULL,
	`diagnostico` text,
	`medicamento` text NOT NULL,
	`dosis` text,
	`fecha_aplicacion` text NOT NULL,
	`dias_retiro_leche` integer DEFAULT 0 NOT NULL,
	`dias_retiro_carne` integer DEFAULT 0 NOT NULL,
	`notas` text,
	FOREIGN KEY (`animal_id`) REFERENCES `animales`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `lotes` (
	`id` text PRIMARY KEY NOT NULL,
	`finca_id` text NOT NULL,
	`nombre` text NOT NULL,
	`descripcion` text,
	FOREIGN KEY (`finca_id`) REFERENCES `fincas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `pesajes` (
	`id` text PRIMARY KEY NOT NULL,
	`animal_id` text NOT NULL,
	`peso` real NOT NULL,
	`fecha_pesaje` text NOT NULL,
	`condicion_corporal` integer,
	`notas` text,
	FOREIGN KEY (`animal_id`) REFERENCES `animales`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `produccion_leche` (
	`id` text PRIMARY KEY NOT NULL,
	`animal_id` text NOT NULL,
	`fecha` text NOT NULL,
	`litros` real NOT NULL,
	`turno` text NOT NULL,
	`notas` text,
	FOREIGN KEY (`animal_id`) REFERENCES `animales`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `razas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`especie_id` integer NOT NULL,
	`nombre` text NOT NULL,
	FOREIGN KEY (`especie_id`) REFERENCES `especies`(`id`) ON UPDATE no action ON DELETE cascade
);
