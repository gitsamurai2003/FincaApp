// constants/enciclopedia.ts

// constants/enciclopedia.ts

export type AnimalData = {
  id: string;
  nombre: string;
  icono: string;
  imagen?: string;  // ← NUEVO: ruta de imagen local (require) o URL remota
  descripcion: string;
  alimentacion: string;
  reproduccion: string;
  variedades: string;
  aprovechamiento: string;
  climaIdeal?: string;
  pesoPromedio?: string;
};

export const ENCICLOPEDIA: Record<string, AnimalData> = {
  // ─────────────────────────────────────────────────────────────────────
  // 🐃 BUFALINOS (Expandido)
  // ─────────────────────────────────────────────────────────────────────
  bufalos: {
    id: 'bufalos',
    nombre: 'Búfalos de Agua',
    icono: 'Droplets',
    imagen: require('@/assets/images/bufalo.png'),
    descripcion: 'Bovino rústico altamente adaptado a zonas trópico-húmedas y humedales. Poseen una excelente capacidad de conversión alimenticia, alta resistencia a enfermedades, ectoparásitos y estrés calórico. Su piel gruesa y glándulas sudorípas les permiten termorregular eficientemente.',
    alimentacion: 'Pastoreo rotacional en forrajes de baja calidad que otros bovinos rechazan. Aprovechan eficientemente pasturas inundables, vegetación acuática (buchón, lechuga de agua) y residuos agrícolas. Requieren acceso permanente a agua para baños y termorregulación.',
    reproduccion: 'Gestación de 310-315 días. Presentan estacionalidad reproductiva marcada (mayor fertilidad en época de lluvias). Excelente longevidad: hembras productivas hasta 15+ años. Primer parto a los 30-36 meses en condiciones óptimas.',
    variedades: 'Murrah (lechera por excelencia, India), Mediterránea (doble propósito, Italia), Nili-Ravi (lechera, Pakistán), Jafarabadi (carne, India), Carabao (trabajo, Filipinas). En Venezuela: predominio Murrah y Mediterránea.',
    aprovechamiento: 'Leche de alto rendimiento quesero (7-9% grasa, 4-5% proteína, ideal para mozzarella, mantequilla, yogurt). Carne magra con bajo colesterol. Cuero de alta calidad para marroquinería. Fuerza de tracción en zonas inundables. Control biológico de malezas acuáticas.',
    climaIdeal: 'Trópico húmedo, zonas inundables, humedales. Toleran 25-35°C con acceso a agua.',
    pesoPromedio: 'Hembras: 500-700 kg | Machos: 700-900 kg',
  },

  // ─────────────────────────────────────────────────────────────────────
  // 🐄 BOVINOS (Expandido)
  // ─────────────────────────────────────────────────────────────────────
  bovinos: {
    id: 'bovinos',
    nombre: 'Bovinos',
    icono: 'Beef',
    imagen: require('@/assets/images/bovino.jpg'),
    descripcion: 'Rumiantes domesticados fundamentales para la producción ganadera mundial. Se dividen en Bos taurus (europeos, adaptados a climas templados) y Bos indicus (cebuinos, adaptados a trópicos). Base de la seguridad alimentaria en múltiples culturas.',
    alimentacion: 'Base de gramíneas (guinea, pangola, braquiaria) y leguminosas (kudzu, maní forrajero). Suplementación mineral (P, Ca, Mg) y proteica (torta de algodón, urea) según etapa: cría, levante, ceba o lactancia. Sistemas: extensivo, semi-estabulado, estabulado.',
    reproduccion: 'Gestación: 283 días promedio. Ciclo estral: 21 días (18-24). Pubertad: 12-18 meses (hembras), 14-20 meses (machos). Intervalo entre partos ideal: 12-14 meses. Detección de celo: observación 2x/día, uso de toros marcadores o sincronización hormonal.',
    variedades: 'Leche: Holstein (alta producción), Jersey (alta grasa), Pardo Suizo (doble propósito). Carne: Brahman (rusticidad), Angus (calidad de carne), Nelore (adaptación tropical). Doble Propósito: Carora, Girolando, Brahman-Leche. Criollos: Limonero, Carora, San Martinero (Venezuela).',
    aprovechamiento: 'Leche fluida y procesada (quesos, yogurt, mantequilla). Carne en canal y cortes. Cuero para calzado y marroquinería. Estiércol para biogás y fertilizante. Genética para mejoramiento. Tracción animal en sistemas tradicionales.',
    climaIdeal: 'Bos taurus: 10-25°C. Bos indicus: 20-35°C con tolerancia a humedad.',
    pesoPromedio: 'Leche: 500-700 kg (H) / 800-1000 kg (M) | Carne: 400-600 kg (H) / 700-900 kg (M)',
  },

  // ─────────────────────────────────────────────────────────────────────
  // 🐴 EQUINOS (Expandido)
  // ─────────────────────────────────────────────────────────────────────
  equinos: {
    id: 'equinos',
    nombre: 'Equinos',
    icono: 'Tractor', // Metáfora de fuerza de trabajo
    imagen: require('@/assets/images/equino.png'),
    descripcion: 'Mamíferos perisodáctilos domesticados hace ~6,000 años. Históricamente fundamentales para transporte, agricultura y guerra. Hoy destacan en deporte, terapia, turismo y vaquería tradicional. Poseen inteligencia social, memoria excepcional y capacidad de vínculo con humanos.',
    alimentacion: 'Herbívoros monogástricos con digestión hindgut. Base: forrajes de alta calidad (alfalfa, gramíneas tiernas). Suplementación con concentrados (avena, cebada, maíz) según carga de trabajo. Mineralización específica (Ca:P 2:1, cobre, zinc). Agua limpia ad libitum (30-50 L/día).',
    reproduccion: 'Gestación: 340 días promedio (320-370). Ciclo estral: 21 días (5-7 días de celo). Estacionalidad: mayor fertilidad en días largos (primavera-verano). Pubertad: 12-18 meses. Manejo reproductivo: detección de celo, monta natural o inseminación artificial.',
    variedades: 'Trabajo/Vaquería: Cuarto de Milla, Appaloosa, Criollo Venezolano. Paso: Paso Fino Venezolano, Peruano, Colombiano. Tiro: Percherón, Clydesdale, Bretón. Deporte: Pura Sangre Inglés (carreras), Holsteiner (salto), Lusitano (doma).',
    aprovechamiento: 'Trabajo de llano y vaquería (arreo, manejo de ganado). Transporte en zonas de difícil acceso. Deporte ecuestre (coleo, salto, doma, carreras). Equinoterapia para rehabilitación física y emocional. Turismo ecológico y cultural. Producción de yegua de cría para venta.',
    climaIdeal: 'Adaptables a múltiples climas. Óptimo: 10-25°C con protección contra lluvia intensa y calor extremo.',
    pesoPromedio: '350-600 kg según raza y uso',
  },

  // ─────────────────────────────────────────────────────────────────────
  // 🐑 OVINOS (Nuevo)
  // ─────────────────────────────────────────────────────────────────────
  ovinos: {
    id: 'ovinos',
    nombre: 'Ovinos (Ovejas)',
    icono: 'Cloud',
    imagen: require('@/assets/images/ovino.jpg'),
    descripcion: 'Rumiantes pequeños altamente eficientes en conversión alimenticia. Destacan por su rusticidad, fertilidad y capacidad de aprovechar pasturas marginales. Producción de lana, carne y leche con bajo impacto ambiental.',
    alimentacion: 'Pastoreo selectivo de gramíneas tiernas, leguminosas y arbustos forrajeros. Suplementación mineral (especialmente cobre con precaución) y energética en épocas secas o lactancia. Toleran forrajes de baja calidad mejor que bovinos.',
    reproduccion: 'Gestación: 150 días promedio. Ciclo estral: 17 días. Estacionalidad: mayor fertilidad en otoño-invierno (razas templadas) o poliéstricas (tropicales). Prolificidad: 1.2-2.5 corderos/parto según raza. Pubertad: 6-8 meses.',
    variedades: 'Carne: Dorper, Pelibuey, Blackbelly (tropicales, sin lana). Lana: Merino, Corriedale, Romney (templadas). Leche: Lacaune, East Friesian. Doble propósito: Suffolk, Hampshire. Criollos: Oveja Criolla Venezolana (rusticidad extrema).',
    aprovechamiento: 'Carne de cordero (alta demanda gourmet, bajo colesterol). Lana para textiles (merino: fina; cruzada: alfombras). Leche para quesos artesanales (alto valor agregado). Cuero para guantes y marroquinería. Control de malezas en sistemas silvopastoriles.',
    climaIdeal: 'Adaptables. Razas tropicales: 20-35°C. Razas laneras: prefieren <25°C con sombra.',
    pesoPromedio: 'Hembras: 40-70 kg | Machos: 60-100 kg',
  },

  // ─────────────────────────────────────────────────────────────────────
  // 🐐 CAPRINOS (Nuevo)
  // ─────────────────────────────────────────────────────────────────────
  caprinos: {
    id: 'caprinos',
    nombre: 'Caprinos (Cabras)',
    icono: 'Mountain',
    imagen: require('@/assets/images/caprino.png'),
    descripcion: 'Rumiantes browsers (ramoneadores) excepcionales para zonas áridas, semiáridas y de ladera. Alta eficiencia reproductiva, rusticidad extrema y capacidad de convertir vegetación leñosa en proteína de alto valor.',
    alimentacion: 'Ramoneo selectivo de arbustos, árboles forrajeros (guácimo, matarratón), malezas y residuos agrícolas. Suplementación mineral (especialmente selenio en suelos deficientes) y energética en lactancia. Toleran taninos y compuestos secundarios que otros rumiantes rechazan.',
    reproduccion: 'Gestación: 150 días. Ciclo estral: 21 días. Poliéstricas estacionales (mayor fertilidad en días cortos). Prolificidad alta: 1.5-2.5 cabritos/parto. Pubertad temprana: 4-6 meses. Manejo: destete a 2-3 meses, primer parto a 12-14 meses.',
    variedades: 'Leche: Saanen, Alpine, Toggenburg (alta producción). Carne: Boer (crecimiento rápido), Kiko (rusticidad). Doble propósito: Nubia, La Mancha. Criollos: Cabra Criolla Venezolana (adaptación extrema a sequía).',
    aprovechamiento: 'Leche para quesos artesanales (alto valor: cabra, mezcla con vaca). Carne de cabrito (demanda en festividades, bajo grasa). Cuero fino para guantes y libros. Fibras: Mohair (Angora), Cashmere (alta valorización). Control biológico de malezas invasoras.',
    climaIdeal: 'Excelente adaptación a sequía: 15-40°C. Requieren sombra y agua limpia. Sensibles a humedad excesiva (podredumbre de pezuña).',
    pesoPromedio: 'Hembras: 35-60 kg | Machos: 50-80 kg',
  },

  // ─────────────────────────────────────────────────────────────────────
  // 🐖 PORCINOS (Nuevo)
  // ─────────────────────────────────────────────────────────────────────
  porcinos: {
    id: 'porcinos',
    nombre: 'Porcinos (Cerdos)',
    icono: 'CircleDot',
    imagen: require('@/assets/images/porcino.jpg'),
    descripcion: 'Monogástricos omnívoros de alta eficiencia conversora (3:1 alimento:carne). Ciclos productivos cortos y alta prolificidad. Ideales para sistemas intensivos, semi-intensivos o familiares con residuos agroindustriales.',
    alimentacion: 'Raciones balanceadas con maíz, sorgo, soya, suplementos vitamínicos-minerales. Aprovechan subproductos: suero de leche, pulpa de café, residuos de cocina (cocinados). Evitar alimentos con micotoxinas o altos en fibra.',
    reproduccion: 'Gestación: 114 días (3 meses, 3 semanas, 3 días). Ciclo estral: 21 días. Prolificidad: 10-14 lechones/camada. Destete: 21-28 días. Primer parto: 8-10 meses. Manejo por lotes para optimizar instalaciones.',
    variedades: 'Carne magra: Landrace, Large White, Duroc, Pietrain. Rusticidad: Criollo, Pelón, Piau. Líneas híbridas comerciales para producción intensiva.',
    aprovechamiento: 'Carne fresca (magna, lomo, pernil) y procesada (jamón, salchichón, chorizo). Manteca para cocina y cosmética. Cuero para calzado. Subproductos: sangre para harina, vísceras para alimentación animal. Estiércol para biogás.',
    climaIdeal: 'Termoneutralidad: 18-22°C. Requieren sombra, ventilación y baños en calor. Sensibles a estrés calórico (>30°C reduce fertilidad y crecimiento).',
    pesoPromedio: 'Hembras reproductoras: 200-250 kg | Machos: 250-300 kg | Sacrificio: 90-110 kg',
  },

  // ─────────────────────────────────────────────────────────────────────
  // 🐓 AVES DE CORRAL (Nuevo)
  // ─────────────────────────────────────────────────────────────────────
  aves_corral: {
    id: 'aves_corral',
    nombre: 'Aves de Corral',
    icono: 'Bird',
    imagen: require('@/assets/images/aves_corral.png'),
    descripcion: 'Grupo diverso que incluye gallinas, pavos, patos y codornices. Ciclos productivos ultracortos, alta densidad por m² y eficiencia en conversión proteína animal. Ideales para producción familiar, comercial o de nicho (huevos orgánicos, razas criollas).',
    alimentacion: 'Raciones balanceadas según etapa: inicio (20-22% proteína), crecimiento (16-18%), postura (15-17% + Ca). Suplementación con greens, insectos, residuos de cocina (cocinados). Agua limpia constante crítica para productividad.',
    reproduccion: 'Gallinas: puesta inicia a 18-22 semanas, pico a 30-40 semanas (280-320 huevos/año en líneas comerciales). Incubación: 21 días (gallina), 28 días (pato), 17 días (codorniz). Manejo de luz crítico para estimular postura.',
    variedades: 'Ponedoras: White Leghorn, Isa Brown, Rhode Island Red. Carne: Cornish Cross, Cobb, Ross. Doble propósito: Plymouth Rock, Sussex. Criollas: Gallina Criolla Venezolana (rusticidad, sabor). Exóticas: Pavos, Patos Pekín, Codorniz Japonesa.',
    aprovechamiento: 'Huevos para consumo directo, procesamiento (mayonesa, pastelería) o incubación. Carne de pollo, pavo, pato (cortes y entero). Plumas para artesanías, almohadas. Estiércol como fertilizante de alta calidad (NPK concentrado).',
    climaIdeal: 'Termoneutralidad: 18-24°C. Ventilación crítica para evitar estrés calórico (>30°C reduce postura). Protección contra lluvia y depredadores.',
    pesoPromedio: 'Gallinas ponedoras: 1.5-2.5 kg | Pollos de engorde: 2.0-2.8 kg a 6-8 semanas',
  },

  // ─────────────────────────────────────────────────────────────────────
  // 🐰 CONEJOS (Nuevo)
  // ─────────────────────────────────────────────────────────────────────
  conejos: {
    id: 'conejos',
    nombre: 'Conejos',
    icono: 'CircleHelp',
    imagen: require('@/assets/images/conejo.jpg'),
    descripcion: 'Lagomorfos de alta eficiencia reproductiva y conversión alimenticia (3:1). Ciclos cortos, bajo espacio requerido y producción de proteína magra. Ideales para micro-producción familiar, educativa o comercial de nicho.',
    alimentacion: 'Base: forrajes verdes (alfalfa, diente de león, morera), heno de calidad. Suplementación con concentrado pelletizado (16-18% proteína). Agua limpia constante crítica. Evitar cambios bruscos de dieta (sensible a enteritis).',
    reproduccion: 'Gestación: 31 días. Prolificidad: 6-12 gazapos/camada. Destete: 28-35 días. Primer parto: 5-6 meses. Manejo por lotes: inseminación o monta controlada. Fertilidad alta: concepción post-parto posible (pero no recomendado por salud de la hembra).',
    variedades: 'Carne: Nueva Zelanda Blanco, Californiano, Chinchilla. Piel: Rex, Angora (fibra). Ornamentales: Enano Holandés, Lop. Criollos: Conejo Criollo Tropical (adaptación a calor).',
    aprovechamiento: 'Carne magra, baja en colesterol y grasa (alta demanda gourmet/saludable). Piel para marroquinería (Rex: terciopelo). Angora: fibra para tejidos de lujo. Estiércol como fertilizante frío (no quema plantas). Producción de gazapos para venta como reproductores.',
    climaIdeal: 'Termoneutralidad: 15-21°C. Sensibles a calor >30°C (requieren sombra, ventilación, pisos frescos). Toleran frío moderado con protección contra corrientes.',
    pesoPromedio: 'Hembras reproductoras: 3.5-5.5 kg | Machos: 4.0-6.0 kg | Sacrificio: 2.0-2.8 kg a 10-12 semanas',
  },

  // ─────────────────────────────────────────────────────────────────────
  // 🦃 PAVOS (Nuevo)
  // ─────────────────────────────────────────────────────────────────────
  pavos: {
    id: 'pavos',
    nombre: 'Pavos',
    icono: 'Bird',
    imagen: require('@/assets/images/pavo.jpg'),
    descripcion: 'Aves de corral de gran tamaño, valoradas por su carne magra y sabor distintivo. Producción estacional (alta demanda en festividades) o comercial continua. Requieren manejo sanitario riguroso y nutrición específica.',
    alimentacion: 'Raciones balanceadas con alto contenido proteico en inicio (28-30%), crecimiento (20-22%), engorde (16-18%). Suplementación con vitaminas (especialmente E y selenio para prevenir miopatía). Agua limpia constante crítica.',
    reproduccion: 'Gestación (incubación): 28 días. Puesta: 80-100 huevos/año en líneas comerciales. Fertilidad: 85-95% con manejo adecuado. Manejo reproductivo: inseminación artificial común en producción comercial por tamaño de machos.',
    variedades: 'Carne blanca: Broad Breasted White (comercial), Bronze (rusticidad, sabor tradicional). Criollos: Pavo Criollo Venezolano (menor tamaño, mayor rusticidad, sabor intenso).',
    aprovechamiento: 'Carne fresca (pechuga, muslo, entero) para consumo directo o procesamiento (jamón de pavo, embutidos). Huevos para incubación o consumo (mayor tamaño y sabor intenso que gallina). Plumas para artesanías y decoración.',
    climaIdeal: 'Similar a gallinas: 18-24°C. Sensibles a corrientes de aire y humedad excesiva. Requieren espacio amplio por su tamaño y comportamiento.',
    pesoPromedio: 'Hembras: 8-12 kg | Machos: 15-25 kg (comerciales) | Sacrificio: 6-10 kg a 16-20 semanas',
  },

  // ─────────────────────────────────────────────────────────────────────
  // 🦆 PATOS (Nuevo)
  // ─────────────────────────────────────────────────────────────────────
  patos: {
    id: 'patos',
    nombre: 'Patos',
    icono: 'Droplets',
    imagen: require('@/assets/images/pato.jpg'),
    descripcion: 'Anátidos adaptados a ambientes acuáticos y húmedos. Alta resistencia a enfermedades, eficiencia en conversión y producción de carne magra, huevos y plumas. Ideales para sistemas integrados con acuicultura o arrozales.',
    alimentacion: 'Omnívoros oportunistas: pastos acuáticos, insectos, caracoles, granos, residuos de cocina. Suplementación con concentrado (16-18% proteína) en producción intensiva. Acceso a agua para limpieza de ojos y fosas nasales esencial.',
    reproduccion: 'Incubación: 28 días (Pekín), 35 días (Muscovy). Puesta: 150-200 huevos/año en líneas ponedoras. Fertilidad alta con presencia de agua para monta. Manejo: nidos secos y limpios, recolección diaria de huevos.',
    variedades: 'Carne: Pekín (crecimiento rápido), Muscovy (sabor intenso, sin grasa subcutánea). Huevos: Khaki Campbell (alta postura). Ornamentales: Mandarín, Carolino. Criollos: Pato Criollo Tropical (rusticidad, adaptación a humedales).',
    aprovechamiento: 'Carne magra con sabor distintivo (alta demanda en gastronomía). Huevos para consumo directo o procesamiento (mayor tamaño y yema rica). Plumón para relleno de edredones, almohadas (alto valor). Control biológico de caracoles y plagas en arrozales.',
    climaIdeal: 'Prefieren ambientes húmedos con acceso a agua. Toleran 15-30°C. Requieren sombra en climas cálidos. Sensibles a sequía prolongada sin acceso a agua.',
    pesoPromedio: 'Hembras: 2.5-3.5 kg | Machos: 3.0-4.5 kg | Sacrificio: 2.0-3.0 kg a 8-10 semanas',
  },
};

// Lista plana para iteración en UI
export const LISTA_ANIMALES = Object.values(ENCICLOPEDIA);

// Helpers útiles para la app
export const getCategoriaAnimal = (id: string): string => {
  const categorias: Record<string, string> = {
    bufalos: 'Bufalinos',
    bovinos: 'Bovinos',
    equinos: 'Equinos',
    ovinos: 'Ovinos',
    caprinos: 'Caprinos',
    porcinos: 'Porcinos',
    aves_corral: 'Aves',
    conejos: 'Lagomorfos',
    pavos: 'Aves',
    patos: 'Anátidos',
  };
  return categorias[id] || 'Otros';
};

export const buscarAnimales = (termino: string): AnimalData[] => {
  if (!termino.trim()) return LISTA_ANIMALES;
  const t = termino.toLowerCase();
  return LISTA_ANIMALES.filter(
    (a) =>
      a.nombre.toLowerCase().includes(t) ||
      a.descripcion.toLowerCase().includes(t) ||
      a.variedades.toLowerCase().includes(t)
  );
};