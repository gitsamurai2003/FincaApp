import AsyncStorage from '@react-native-async-storage/async-storage';
import Mapbox from '@rnmapbox/maps';
import Constants from 'expo-constants';
import * as Sharing from 'expo-sharing';
import {
  BookOpen,
  Camera, Check, ChevronDown, ChevronUp,
  Eye, Map as MapIcon, MapPin, Pencil, RotateCcw, Ruler,
  Split, Target, Trash2, Undo,
  X
} from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Animated,
  Modal,
  PanResponder, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity,
  TouchableWithoutFeedback, View
} from 'react-native';
import ViewShot from 'react-native-view-shot';

const mapboxToken = Constants.expoConfig?.extra?.MAPBOX;
Mapbox.setAccessToken(mapboxToken);

interface Coordenada {
  latitude: number;
  longitude: number;
}

type ModoDibujo = 'FINCA' | 'SELECCION' | 'VISTA';
type ModoDivision = 'POR_CANTIDAD';

interface BackupTrabajo {
  puntosFinca: Coordenada[];
  potrerosGenerados: Coordenada[][];
  areaSeleccionada: Coordenada[];
  historialPotreros: Coordenada[][][];
  historialAreasSeleccionadas: Coordenada[][];
  mergedGroups: string[][]; // Respaldar diseño visual de agrupaciones
}

interface DisplayLado {
  id: string; 
  medio: Coordenada;
  metros: number;
  esFusionado: boolean;
  originalIds: string[]; 
  tipo: 'FINCA' | 'POTRERO';
  referencias?: { potreroIdx: number; startIdx: number }[]; 
}

interface PosicionEtiquetaPantalla {
  id: string;
  x: number;
  y: number;
  metros: number;
  esFusionado: boolean;
  tipo: 'FINCA' | 'POTRERO';
  ladoOriginal: DisplayLado;
}

// 📐 Cálculo de área en hectáreas (fórmula geodésica)
const calcularAreaHectareas = (puntos: Coordenada[]): number => {
  if (puntos.length < 3) return 0;
  let area = 0;
  const R = 6378137;
  for (let i = 0; i < puntos.length; i++) {
    const j = (i + 1) % puntos.length;
    const lon1 = puntos[i].longitude * Math.PI / 180;
    const lon2 = puntos[j].longitude * Math.PI / 180;
    const lat1 = puntos[i].latitude * Math.PI / 180;
    const lat2 = puntos[j].latitude * Math.PI / 180;
    area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return Math.abs(area * R * R / 2) / 10000;
};

// 📏 Distancia entre dos puntos en metros (Haversine)
const calcularDistanciaMetros = (p1: Coordenada, p2: Coordenada): number => {
  const R = 6378137;
  const dLat = (p2.latitude - p1.latitude) * Math.PI / 180;
  const dLon = (p2.longitude - p1.longitude) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(p1.latitude * Math.PI / 180) * Math.cos(p2.latitude * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

// 🎯 Centroide de un polígono
const calcularCentroide = (puntos: Coordenada[]): Coordenada => {
  if (puntos.length < 3) return puntos[0] || { latitude: 0, longitude: 0 };
  let latSum = 0, lonSum = 0;
  for (const p of puntos) {
    latSum += p.latitude;
    lonSum += p.longitude;
  }
  return { latitude: latSum / puntos.length, longitude: lonSum / puntos.length };
};

// 🎯 Punto medio entre dos coordenadas
const calcularPuntoMedio = (p1: Coordenada, p2: Coordenada): Coordenada => ({
  latitude: (p1.latitude + p2.latitude) / 2,
  longitude: (p1.longitude + p2.longitude) / 2,
});

// 🎯 Proyección de un punto sobre un segmento de recta
const proyectarSobreSegmento = (p: Coordenada, a: Coordenada, b: Coordenada): Coordenada => {
  const dx = b.longitude - a.longitude;
  const dy = b.latitude - a.latitude;
  const t = ((p.longitude - a.longitude) * dx + (p.latitude - a.latitude) * dy) / (dx * dx + dy * dy);
  const tClamped = Math.max(0, Math.min(1, t));
  return {
    latitude: a.latitude + tClamped * dy,
    longitude: a.longitude + tClamped * dx,
  };
};

// 🧲 Rango de atracción del autofijador
const RANGO_SNAPPING_METROS = 120;

// 🧲 Atrae el punto seleccionado al borde
const atraerAlBorde = (punto: Coordenada, poligono: Coordenada[]): Coordenada => {
  if (poligono.length < 3) return punto;
  let mejorDist = Infinity;
  let mejorPunto = punto;
  
  for (let i = 0; i < poligono.length; i++) {
    const a = poligono[i];
    const b = poligono[(i + 1) % poligono.length];
    
    const proyeccion = proyectarSobreSegmento(punto, a, b);
    const dist = calcularDistanciaMetros(punto, proyeccion);
    
    if (dist < mejorDist && dist < RANGO_SNAPPING_METROS) {
      mejorDist = dist;
      mejorPunto = proyeccion;
    }
  }
  return mejorPunto;
};

// 🔄 Rotar un punto
const rotarPunto = (p: Coordenada, centro: Coordenada, anguloGrados: number): Coordenada => {
  const rad = (anguloGrados * Math.PI) / 180;
  const dx = p.longitude - centro.longitude;
  const dy = p.latitude - centro.latitude;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    latitude: centro.latitude + dy * cos - dx * sin,
    longitude: centro.longitude + dy * sin + dx * cos,
  };
};

// ✂️ Recorta un polígono
const clipPoligonoHorizontal = (poligono: Coordenada[], yNivel: number, mantenerSuperior: boolean): Coordenada[] => {
  const listaSalida: Coordenada[] = [];
  if (poligono.length === 0) return [];

  const estaAdentro = (p: Coordenada) => {
    return mantenerSuperior ? p.latitude >= yNivel : p.latitude <= yNivel;
  };

  const calcularInterseccion = (p1: Coordenada, p2: Coordenada): Coordenada => {
    const dy = p2.latitude - p1.latitude;
    if (Math.abs(dy) < 1e-9) {
      return { latitude: yNivel, longitude: p1.longitude };
    }
    const t = (yNivel - p1.latitude) / dy;
    const x = p1.longitude + t * (p2.longitude - p1.longitude);
    return { latitude: yNivel, longitude: x };
  };

  let s = poligono[poligono.length - 1];
  for (let i = 0; i < poligono.length; i++) {
    const p = poligono[i];
    if (estaAdentro(p)) {
      if (!estaAdentro(s)) {
        listaSalida.push(calcularInterseccion(s, p));
      }
      listaSalida.push(p);
    } else if (estaAdentro(s)) {
      listaSalida.push(calcularInterseccion(s, p));
    }
    s = p;
  }
  return listaSalida;
};

// 🧩 Divide un polígono
const dividirPoligonoConAngulo = (
  area: Coordenada[],
  cantidad: number,
  anguloGrados: number
): Coordenada[][] => {
  if (cantidad < 1 || area.length < 3) return [];

  const centroide = calcularCentroide(area);
  const areaRotada = area.map(p => rotarPunto(p, centroide, -anguloGrados));
  
  const ys = areaRotada.map(p => p.latitude);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const obtenerAreaBajoY = (poligono: Coordenada[], yNivel: number): number => {
    const recortado = clipPoligonoHorizontal(poligono, yNivel, false);
    return calcularAreaHectareas(recortado);
  };

  const areaTotal = calcularAreaHectareas(areaRotada);
  const areaObjetivo = areaTotal / cantidad;
  const cortesY: number[] = [minY];

  for (let i = 1; i < cantidad; i++) {
    const areaRequerida = i * areaObjetivo;
    let limiteInferior = minY;
    let limiteSuperior = maxY;
    let pivoteY = (limiteInferior + limiteSuperior) / 2;

    for (let iter = 0; iter < 25; iter++) {
      pivoteY = (limiteInferior + limiteSuperior) / 2;
      const areaActual = obtenerAreaBajoY(areaRotada, pivoteY);
      if (areaActual < areaRequerida) {
        limiteInferior = pivoteY;
      } else {
        limiteSuperior = pivoteY;
      }
    }
    cortesY.push(pivoteY);
  }
  cortesY.push(maxY);
  
  const potrerosRotados: Coordenada[][] = [];
  
  for (let i = 0; i < cantidad; i++) {
    const yInferior = cortesY[i];
    const ySuperior = cortesY[i + 1];
    
    const recortadoParcial = clipPoligonoHorizontal(areaRotada, yInferior, true); 
    const potreroRecortado = clipPoligonoHorizontal(recortadoParcial, ySuperior, false); 
    
    if (potreroRecortado.length >= 3) {
      const potreroOriginal = potreroRecortado.map(p => rotarPunto(p, centroide, anguloGrados));
      potrerosRotados.push(potreroOriginal);
    }
  }
  
  return potrerosRotados;
};

// 📍 Utilidad MAPBOX: Adapta las Coordenadas al estándar GeoJSON que requiere Mapbox
const parseToGeoJSON = (puntos: Coordenada[]): any => {
  if (puntos.length < 3) return null;
  // Mapbox usa [longitud, latitud]
  const coordenadas = puntos.map(p => [p.longitude, p.latitude]);
  coordenadas.push([puntos[0].longitude, puntos[0].latitude]); // Cerrar el anillo para el polígono
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coordenadas] }
  };
};

interface LadoPotrero {
  id: string;
  inicio: Coordenada;
  fin: Coordenada;
  medio: Coordenada;
  metros: number;
  referencias: { potreroIdx: number; startIdx: number }[];
}

export default function MapaFincaAvanzadoScreen() {
  // Estados principales
  const [puntosFinca, setPuntosFinca] = useState<Coordenada[]>([]);
  const [modo, setModo] = useState<ModoDibujo>('FINCA');
  const [potrerosGenerados, setPotrerosGenerados] = useState<Coordenada[][]>([]);
  const [historialFiguras, setHistorialFiguras] = useState<{tipo: string, puntos: Coordenada[]}[]>([]);
  
  const [areaSeleccionada, setAreaSeleccionada] = useState<Coordenada[]>([]);
  const [areaSeleccionadaActual, setAreaSeleccionadaActual] = useState<Coordenada[]>([]);
  
  const [modoDivision, setModoDivision] = useState<ModoDivision>('POR_CANTIDAD');
  const [valorDivision, setValorDivision] = useState<string>('4');
  const [anguloRotacion, setAnguloRotacion] = useState<number>(0);
  const [previewDivision, setPreviewDivision] = useState<Coordenada[][]>([]);

  // Historial de divisiones
  const [historialPotreros, setHistorialPotreros] = useState<Coordenada[][][]>([]);
  const [historialAreasSeleccionadas, setHistorialAreasSeleccionadas] = useState<Coordenada[][]>([]);
  const [mergedGroups, setMergedGroups] = useState<string[][]>([]);
  const [posicionesEtiquetas, setPosicionesEtiquetas] = useState<PosicionEtiquetaPantalla[]>([]);
  const [primerLadoSeleccionado, setPrimerLadoSeleccionado] = useState<DisplayLado | null>(null);
  const [backup, setBackup] = useState<BackupTrabajo | null>(null);
  const [modalGuiaVisible, setModalGuiaVisible] = useState<boolean>(false);
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerAnim = useRef(new Animated.Value(0)).current;
  const DRAWER_HEIGHT = 560;
  const [ubicacionDispositivo, setUbicacionDispositivo] = useState<Coordenada | null>(null);
  const viewShotRef = useRef<any>(null);
  
  // Ref ahora apunta a Mapbox.MapView
  const mapRef = useRef<Mapbox.MapView>(null);

  // Posición en píxeles para la etiqueta central flotante
  const [posLabelCentral, setPosLabelCentral] = useState<{x: number, y: number} | null>(null);

  // Memoización
  const areaTotalFinca = useMemo(() => calcularAreaHectareas(puntosFinca), [puntosFinca]);
  const centroideFinca = useMemo(() => calcularCentroide(puntosFinca), [puntosFinca]);
  
  const ladosFinca = useMemo(() => {
    if (puntosFinca.length < 2) return [];
    return puntosFinca.map((p, i) => {
      const siguiente = puntosFinca[(i + 1) % puntosFinca.length];
      return {
        inicio: p, fin: siguiente,
        medio: calcularPuntoMedio(p, siguiente),
        metros: calcularDistanciaMetros(p, siguiente)
      };
    });
  }, [puntosFinca]);

  const ladosPotreros = useMemo<LadoPotrero[]>(() => {
    const mapaCaras = new Map<string, LadoPotrero>();
    
    potrerosGenerados.forEach((potrero, potreroIdx) => {
      if (potrero.length < 2) return;
      for (let i = 0; i < potrero.length; i++) {
        const p1 = potrero[i];
        const p2 = potrero[(i + 1) % potrero.length];
        
        const lat1 = p1.latitude.toFixed(6), lon1 = p1.longitude.toFixed(6);
        const lat2 = p2.latitude.toFixed(6), lon2 = p2.longitude.toFixed(6);
        
        const es1Menor = parseFloat(lat1) < parseFloat(lat2) || 
          (parseFloat(lat1) === parseFloat(lat2) && parseFloat(lon1) < parseFloat(lon2));
        
        const claveUnica = es1Menor ? `${lat1},${lon1}_${lat2},${lon2}` : `${lat2},${lon2}_${lat1},${lon1}`;
        const referencia = { potreroIdx, startIdx: i };
        const existente = mapaCaras.get(claveUnica);

        if (existente) {
          existente.referencias.push(referencia);
        } else {
          mapaCaras.set(claveUnica, {
            id: claveUnica, inicio: p1, fin: p2, medio: calcularPuntoMedio(p1, p2), metros: calcularDistanciaMetros(p1, p2), referencias: [referencia]
          });
        }
      }
    });
    
    return Array.from(mapaCaras.values());
  }, [potrerosGenerados]);

  const displayLadosFinca = useMemo<DisplayLado[]>(() => {
    const result: DisplayLado[] = [];
    const processedIds = new Set<string>();

    ladosFinca.forEach((lado, idx) => {
      const segmentId = `FINCA_${idx}`;
      if (processedIds.has(segmentId)) return;
      const group = mergedGroups.find(g => g.includes(segmentId));

      if (group) {
        const fincaGroup = group.filter(id => id.startsWith('FINCA_'));
        fincaGroup.forEach(id => processedIds.add(id));

        let totalMetros = 0, latSum = 0, lonSum = 0, count = 0;
        fincaGroup.forEach(id => {
          const lIdx = parseInt(id.replace('FINCA_', ''));
          const l = ladosFinca[lIdx];
          if (l) { totalMetros += l.metros; latSum += l.medio.latitude; lonSum += l.medio.longitude; count++; }
        });

        if (count > 0) {
          result.push({ id: fincaGroup.join('|'), medio: { latitude: latSum / count, longitude: lonSum / count }, metros: totalMetros, esFusionado: true, originalIds: fincaGroup, tipo: 'FINCA' });
        }
      } else {
        processedIds.add(segmentId);
        result.push({ id: segmentId, medio: lado.medio, metros: lado.metros, esFusionado: false, originalIds: [segmentId], tipo: 'FINCA' });
      }
    });

    return result;
  }, [ladosFinca, mergedGroups]);

  const displayLadosPotreros = useMemo<DisplayLado[]>(() => {
    const result: DisplayLado[] = [];
    const processedIds = new Set<string>();

    ladosPotreros.forEach((lado) => {
      const segmentId = `POTRERO_${lado.id}`;
      if (processedIds.has(segmentId)) return;
      const group = mergedGroups.find(g => g.includes(segmentId));

      if (group) {
        const potreroGroup = group.filter(id => id.startsWith('POTRERO_'));
        potreroGroup.forEach(id => processedIds.add(id));

        let totalMetros = 0, latSum = 0, lonSum = 0, count = 0;
        let mergedRefs: { potreroIdx: number; startIdx: number }[] = [];

        potreroGroup.forEach(id => {
          const lId = id.replace('POTRERO_', '');
          const l = ladosPotreros.find(lp => lp.id === lId);
          if (l) { totalMetros += l.metros; latSum += l.medio.latitude; lonSum += l.medio.longitude; count++; mergedRefs = [...mergedRefs, ...l.referencias]; }
        });

        if (count > 0) {
          result.push({ id: potreroGroup.join('|'), medio: { latitude: latSum / count, longitude: lonSum / count }, metros: totalMetros, esFusionado: true, originalIds: potreroGroup, tipo: 'POTRERO', referencias: mergedRefs });
        }
      } else {
        processedIds.add(segmentId);
        result.push({ id: segmentId, medio: lado.medio, metros: lado.metros, esFusionado: false, originalIds: [segmentId], tipo: 'POTRERO', referencias: lado.referencias });
      }
    });

    return result;
  }, [ladosPotreros, mergedGroups]);

  // Traducción Mapbox: Traduce coords a pixeles de la pantalla
  const actualizarPosicionesEtiquetas = async () => {
    if (!mapRef.current) return;

    try {
      if (puntosFinca.length >= 3) {
        const centroide = calcularCentroide(puntosFinca);
        const posCentro = await mapRef.current.getPointInView([centroide.longitude, centroide.latitude]);
        setPosLabelCentral({ x: posCentro[0], y: posCentro[1] });
      } else {
        setPosLabelCentral(null);
      }

      const promesasFinca = displayLadosFinca.map(async (lado) => {
        const pos = await mapRef.current!.getPointInView([lado.medio.longitude, lado.medio.latitude]);
        return {
          id: lado.id, x: pos[0], y: pos[1], metros: lado.metros, esFusionado: lado.esFusionado, tipo: 'FINCA' as const, ladoOriginal: lado
        };
      });

      const promesasPotreros = displayLadosPotreros.map(async (lado) => {
        const pos = await mapRef.current!.getPointInView([lado.medio.longitude, lado.medio.latitude]);
        return {
          id: lado.id, x: pos[0], y: pos[1], metros: lado.metros, esFusionado: lado.esFusionado, tipo: 'POTRERO' as const, ladoOriginal: lado
        };
      });

      const resultados = await Promise.all([...promesasFinca, ...promesasPotreros]);
      setPosicionesEtiquetas(resultados);
    } catch (error) {
      console.warn("No se pudieron proyectar las etiquetas en el mapa", error);
    }
  };

  useEffect(() => {
    const cargarBackupDeDisco = async () => {
      try {
        const datosGuardados = await AsyncStorage.getItem('@backup_trabajo_finca');
        if (datosGuardados) {
          const parsed = JSON.parse(datosGuardados);
          setBackup(parsed);
          if (parsed.mergedGroups) {
            setMergedGroups(parsed.mergedGroups);
          }
        }
      } catch (error) {
        console.warn("No se pudo cargar el respaldo desde el almacenamiento local", error);
      }
    };
    cargarBackupDeDisco();
  }, []);

  useEffect(() => {
    actualizarPosicionesEtiquetas();
  }, [puntosFinca, potrerosGenerados, mergedGroups, modo]);

  // Animaciones gaveta
  const toggleDrawer = () => {
    Animated.spring(drawerAnim, { toValue: drawerOpen ? 0 : 1, useNativeDriver: true, tension: 50, friction: 8 }).start();
    setDrawerOpen(!drawerOpen);
  };
  const closeDrawer = () => {
    if (drawerOpen) {
      Animated.spring(drawerAnim, { toValue: 0, useNativeDriver: true }).start();
      setDrawerOpen(false);
    }
  };
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 5,
      onPanResponderMove: (_, { dy }) => {
        if (drawerOpen && dy > 0) drawerAnim.setValue(Math.max(0, 1 - dy / DRAWER_HEIGHT));
      },
      onPanResponderRelease: (_, { dy }) => {
        dy > DRAWER_HEIGHT * 0.3 ? closeDrawer() : toggleDrawer();
      },
    })
  ).current;
  const drawerTranslateY = drawerAnim.interpolate({
    inputRange: [0, 1], outputRange: [DRAWER_HEIGHT + 20, 0]
  });
  const overlayOpacity = drawerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] });

  // 🧲 MAP PRESS ADAPTADO A MAPBOX
  const handleMapPress = (e: any) => {
    // Mapbox devuelve las coordenadas en un array [longitud, latitud] dentro de geometry
    const [longitud, latitud] = e.geometry.coordinates;
    let coord = { latitude: latitud, longitude: longitud };

    if (modo === 'SELECCION' && puntosFinca.length >= 3) {
      coord = atraerAlBorde(coord, puntosFinca);
    }

    if (modo === 'FINCA') setPuntosFinca([...puntosFinca, coord]);
    else if (modo === 'SELECCION') {
      const nuevaArea = [...areaSeleccionadaActual, coord];
      setAreaSeleccionadaActual(nuevaArea);
      const cantidad = parseInt(valorDivision) || 1;
      if (nuevaArea.length >= 3 && modoDivision === 'POR_CANTIDAD' && cantidad > 0) {
        const preview = dividirPoligonoConAngulo(nuevaArea, cantidad, anguloRotacion);
        setPreviewDivision(preview);
      }
    }
  };

  const actualizarPreview = (nuevaArea?: Coordenada[], nuevoAngulo?: number) => {
    const area = nuevaArea || areaSeleccionadaActual;
    const angulo = nuevoAngulo !== undefined ? nuevoAngulo : anguloRotacion;
    if (area.length >= 3 && modoDivision === 'POR_CANTIDAD') {
      const cantidad = parseInt(valorDivision) || 1;
      if (cantidad > 0) {
        const preview = dividirPoligonoConAngulo(area, cantidad, angulo);
        setPreviewDivision(preview);
      }
    }
  };

  const handleGenerarDivision = () => {
    if (areaSeleccionadaActual.length < 3) {
      Alert.alert("⚠️ Área incompleta", "Dibuja al menos 3 puntos.");
      return;
    }
    const valor = parseFloat(valorDivision);
    if (isNaN(valor) || valor <= 0) {
      Alert.alert("⚠️ Valor inválido", "Ingresa un número válido.");
      return;
    }
    if (modoDivision === 'POR_CANTIDAD') {
      const nuevosPotreros = dividirPoligonoConAngulo(
        areaSeleccionadaActual,
        Math.round(valor),
        anguloRotacion
      );
      if (nuevosPotreros.length > 0) {
        setHistorialPotreros(prev => [...prev, potrerosGenerados]);
        setHistorialAreasSeleccionadas(prev => [...prev, areaSeleccionada]);

        setPotrerosGenerados([...potrerosGenerados, ...nuevosPotreros]);
        setAreaSeleccionada([...areaSeleccionada, ...areaSeleccionadaActual]);
        setAreaSeleccionadaActual([]);
        setPreviewDivision([]);
        setModo('VISTA');
        Alert.alert("✓ División exitosa", `${nuevosPotreros.length} potreros creados.`);
      } else {
        Alert.alert("⚠️ Error", "No se pudieron calcular divisiones para este espacio.");
      }
    }
  };

  const deshacerUltimaDivision = () => {
    if (historialPotreros.length > 0) {
      Alert.alert(
        "🔄 ¿Deshacer última división?",
        "Se eliminará la última distribución generada y se restaurará el estado anterior. ¿Deseas continuar?",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Deshacer",
            style: "destructive",
            onPress: () => {
              const anteriorPotreros = historialPotreros[historialPotreros.length - 1];
              const anteriorAreas = historialAreasSeleccionadas[historialAreasSeleccionadas.length - 1];
              
              setPotrerosGenerados(anteriorPotreros);
              setAreaSeleccionada(anteriorAreas);
              
              setHistorialPotreros(prev => prev.slice(0, -1));
              setHistorialAreasSeleccionadas(prev => prev.slice(0, -1));
              Alert.alert("✓ Deshecho", "Se eliminó la última división de potreros.");
            }
          }
        ]
      );
    } else {
      Alert.alert("ℹ️ Información", "No hay más divisiones para deshacer.");
    }
  };

  const handleBorrarUltimoPunto = () => {
    if (modo === 'FINCA') {
      setPuntosFinca(p => p.slice(0, -1));
    } else if (modo === 'SELECCION') {
      if (areaSeleccionadaActual.length > 0) {
        setAreaSeleccionadaActual(p => {
          const nueva = p.slice(0, -1);
          if (nueva.length >= 3) actualizarPreview(nueva);
          else setPreviewDivision([]);
          return nueva;
        });
      } else {
        deshacerUltimaDivision();
      }
    } else if (modo === 'VISTA') {
      deshacerUltimaDivision();
    }
  };

  const handleFinalizarFinca = () => {
    if (puntosFinca.length < 3) {
      Alert.alert("⚠️ Perímetro incompleto", "Mínimo 3 puntos.");
      return;
    }
    setHistorialFiguras([...historialFiguras, { tipo: 'FINCA', puntos: [...puntosFinca] }]);
    Alert.alert("✓ Perímetro guardado", `Total: ${areaTotalFinca.toFixed(2)} Ha`);
  };

  const handleCapturarPantalla = async () => {
    if (!viewShotRef.current) return;
    try {
      const uri = await viewShotRef.current.capture({ format: "jpg", quality: 1.0 });
      if (uri) await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: '🗺️ Mapa de Potreros' });
    } catch { Alert.alert("Error", "No se pudo capturar"); }
  };

  const handleReiniciarTodo = () => {
    Alert.alert("🔄 ¿Reiniciar?", "Se perderán todos los datos.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Reiniciar", style: "destructive", onPress: () => {
        setPuntosFinca([]); setAreaSeleccionada([]);
        setPotrerosGenerados([]); setAreaSeleccionadaActual([]);
        setPreviewDivision([]); setModo('FINCA'); setAnguloRotacion(0);
        setHistorialPotreros([]); setHistorialAreasSeleccionadas([]);
        setPrimerLadoSeleccionado(null);
        setMergedGroups([]);
        closeDrawer();
      }}
    ]);
  };

  const handlePotreroPress = (idx: number, puntos: Coordenada[]) => {
    const area = calcularAreaHectareas(puntos);
    let perimetro = 0;
    const detallesLados: string[] = [];

    for (let i = 0; i < puntos.length; i++) {
      const p1 = puntos[i];
      const p2 = puntos[(i + 1) % puntos.length];
      const dist = calcularDistanciaMetros(p1, p2);
      perimetro += dist;
      detallesLados.push(`  • Cara ${i + 1}: ${Math.round(dist)} m`);
    }

    Alert.alert(
      `🌱 Potrero #${idx + 1}`,
      `• Área: ${area.toFixed(2)} Ha\n` +
      `• Perímetro Total: ${perimetro.toFixed(1)} m\n\n` +
      `📐 Medidas de sus Caras:\n${detallesLados.join('\n')}\n\n` +
      `• Vértices totales: ${puntos.length}`,
      [{ text: "Cerrar", style: "cancel" }]
    );
  };

  const handleLadoPress = (lado: DisplayLado) => {
    if (!primerLadoSeleccionado) {
      setPrimerLadoSeleccionado(lado);
      Alert.alert(
        "📐 Etiqueta Seleccionada",
        `Has seleccionado un tramo de ${Math.round(lado.metros)} m.\n\nToca otra etiqueta contigua del mismo tipo para agruparlas visualmente.`,
        [{ text: "Entendido", style: "default" }]
      );
    } else {
      if (primerLadoSeleccionado.tipo !== lado.tipo) {
        Alert.alert("⚠️ Error de compatibilidad", "No se pueden agrupar etiquetas del perímetro de la finca con las de los potreros internos.", [{ text: "Entendido", onPress: () => setPrimerLadoSeleccionado(null) }]);
        return;
      }
      if (primerLadoSeleccionado.id === lado.id) {
        setPrimerLadoSeleccionado(null);
        Alert.alert("ℹ️ Información", "Selección cancelada.");
        return;
      }

      let sonAdyacentes = false;
      if (lado.tipo === 'FINCA') {
        const indicesA = primerLadoSeleccionado.originalIds.map(id => parseInt(id.replace('FINCA_', '')));
        const indicesB = lado.originalIds.map(id => parseInt(id.replace('FINCA_', '')));
        const N = ladosFinca.length;
        for (const iA of indicesA) {
          for (const iB of indicesB) {
            if (iB === (iA + 1) % N || iA === (iB + 1) % N) { sonAdyacentes = true; break; }
          }
          if (sonAdyacentes) break;
        }
      } else {
        const ref1 = primerLadoSeleccionado.referencias || [];
        const ref2 = lado.referencias || [];
        for (const r1 of ref1) {
          const r2 = ref2.find(r => r.potreroIdx === r1.potreroIdx);
          if (r2) {
            const N = potrerosGenerados[r1.potreroIdx].length;
            if (r2.startIdx === (r1.startIdx + 1) % N || r1.startIdx === (r2.startIdx + 1) % N) { sonAdyacentes = true; break; }
          }
        }
      }

      if (!sonAdyacentes) {
        Alert.alert("⚠️ Linderos no adyacentes", "Solo puedes agrupar linderos continuos (que compartan un punto o vértice intermedio).", [{ text: "Entendido", onPress: () => setPrimerLadoSeleccionado(null) }]);
        return;
      }

      Alert.alert(
        "➕ ¿Fusionar etiquetas de distancia?",
        `¿Deseas unificar estas dos etiquetas visuales de distancia en un solo marcador central?\n\nLa etiqueta unificada mostrará la suma acumulada de ${Math.round(primerLadoSeleccionado.metros + lado.metros)} m.`,
        [
          { text: "Cancelar", style: "cancel", onPress: () => setPrimerLadoSeleccionado(null) },
          {
            text: "Fusionar",
            onPress: () => {
              const nuevoGrupo = [...primerLadoSeleccionado.originalIds, ...lado.originalIds];
              const gruposFiltrados = mergedGroups.filter(g => !g.some(id => nuevoGrupo.includes(id)));
              setMergedGroups([...gruposFiltrados, nuevoGrupo]);
              setPrimerLadoSeleccionado(null);
              Alert.alert("✓ Etiquetas fusionadas", "Se han unificado las etiquetas de distancia de forma visual en el mapa.");
            }
          }
        ]
      );
    }
  };

  const handleGuardarBackup = async () => {
    const datosBackup: BackupTrabajo = {
      puntosFinca: [...puntosFinca],
      potrerosGenerados: [...potrerosGenerados],
      areaSeleccionada: [...areaSeleccionada],
      historialPotreros: [...historialPotreros],
      historialAreasSeleccionadas: [...historialAreasSeleccionadas],
      mergedGroups: [...mergedGroups]
    };
    setBackup(datosBackup);
    try {
      await AsyncStorage.setItem('@backup_trabajo_finca', JSON.stringify(datosBackup));
      Alert.alert("💾 Respaldo permanente guardado", "Se ha guardado tu trabajo de forma permanente en tu dispositivo.");
    } catch (error) {
      Alert.alert("⚠️ Error", "No se pudo escribir el respaldo permanente.");
    }
  };

  const handleRestaurarBackup = () => {
    if (!backup) {
      Alert.alert("⚠️ Sin respaldos", "No hay ninguna versión guardada para restaurar.");
      return;
    }
    Alert.alert(
      "🔄 ¿Restaurar versión?",
      "Se reemplazará el trabajo actual por el respaldo de esta sesión. Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Restaurar",
          onPress: () => {
            setPuntosFinca(backup.puntosFinca);
            setPotrerosGenerados(backup.potrerosGenerados);
            setAreaSeleccionada(backup.areaSeleccionada);
            setHistorialPotreros(backup.historialPotreros);
            setHistorialAreasSeleccionadas(backup.historialAreasSeleccionadas);
            if (backup.mergedGroups) { setMergedGroups(backup.mergedGroups); }
            setAreaSeleccionadaActual([]);
            setPreviewDivision([]);
            setPrimerLadoSeleccionado(null);
            Alert.alert("✓ Versión restaurada", "Tu trabajo ha sido devuelto al estado respaldado.");
          }
        }
      ]
    );
  };

  // Ajustes de cámara dinámicos para Mapbox
  const mapboxCameraParams = () => {
    if (puntosFinca.length >= 3) {
      const lats = puntosFinca.map(p => p.latitude);
      const lons = puntosFinca.map(p => p.longitude);
      return {
        bounds: { 
          ne: [Math.max(...lons), Math.max(...lats)],
          sw: [Math.min(...lons), Math.min(...lats)],
          paddingTop: 80, paddingRight: 80, paddingBottom: 80, paddingLeft: 80
        }
      };
    }
    // Ubicación por defecto si no hay finca dibujada
    return { centerCoordinate: [-72.5447, 10.0644], zoomLevel: 14 };
  };

  const getColorActivo = (m: ModoDibujo) => modo === m ? '#ffffff' : '#334155';
  const getTextoActivo = (m: ModoDibujo) => modo === m ? '#ffffff' : '#334155';

  return (
    <View style={styles.container}>
      {drawerOpen && (
        <TouchableWithoutFeedback onPress={closeDrawer}>
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />
        </TouchableWithoutFeedback>
      )}

      <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 0.9 }} style={{ flex: 1 }}>
        <Mapbox.MapView
          ref={mapRef}
          style={styles.map}
          styleURL={Mapbox.StyleURL.SatelliteStreet}
          onPress={handleMapPress}
          onCameraChanged={actualizarPosicionesEtiquetas}
          surfaceView={false} // Necesario en true/false dependiendo de si sacas el ViewShot en Android/iOS, falso suele permitir tomar la foto de la vista nativa GL
        >
          <Mapbox.Camera {...mapboxCameraParams()} animationDuration={500} />

          {/* Perímetro con linderos de finca (MAPBOX SHAPE) */}
          {puntosFinca.length >= 3 && (
            <Mapbox.ShapeSource id="fincaSource" shape={parseToGeoJSON(puntosFinca)}>
              <Mapbox.FillLayer id="fincaFill" style={{ fillColor: 'rgba(37, 99, 235, 0.1)' }} />
              <Mapbox.LineLayer id="fincaLine" style={{ lineColor: '#2563eb', lineWidth: 3 }} />
            </Mapbox.ShapeSource>
          )}

          {/* Area de seleccion (MAPBOX SHAPE) */}
          {areaSeleccionadaActual.length >= 3 && (
            <Mapbox.ShapeSource id="seleccionSource" shape={parseToGeoJSON(areaSeleccionadaActual)}>
              <Mapbox.FillLayer id="seleccionFill" style={{ fillColor: 'rgba(139, 92, 246, 0.2)' }} />
              <Mapbox.LineLayer id="seleccionLine" style={{ lineColor: '#8b5cf6', lineWidth: 2, lineDasharray: [5, 5] }} />
            </Mapbox.ShapeSource>
          )}

          {/* Previews Verdes */}
          {previewDivision.map((potrero, idx) => parseToGeoJSON(potrero) && (
            <Mapbox.ShapeSource key={`previewSource-${idx}`} id={`previewSource-${idx}`} shape={parseToGeoJSON(potrero)}>
              <Mapbox.FillLayer id={`previewFill-${idx}`} style={{ fillColor: 'rgba(34, 197, 94, 0.25)' }} />
              <Mapbox.LineLayer id={`previewLine-${idx}`} style={{ lineColor: '#22c55e', lineWidth: 1 }} />
            </Mapbox.ShapeSource>
          ))}

          {/* Potreros Finales Generados */}
          {potrerosGenerados.map((potrero, idx) => parseToGeoJSON(potrero) && (
            <Mapbox.ShapeSource key={`potreroSource-${idx}`} id={`potreroSource-${idx}`} shape={parseToGeoJSON(potrero)} onPress={() => handlePotreroPress(idx, potrero)}>
              <Mapbox.FillLayer id={`potreroFill-${idx}`} style={{ fillColor: 'rgba(16, 185, 129, 0.4)' }} />
              <Mapbox.LineLayer id={`potreroLine-${idx}`} style={{ lineColor: '#ffffff', lineWidth: 1 }} />
            </Mapbox.ShapeSource>
          ))}

          {/* Puntos (Marcadores) dibujados manualmente */}
          {modo === 'FINCA' && puntosFinca.map((p, i) => (
            <Mapbox.PointAnnotation key={`f-${i}`} id={`f-${i}`} coordinate={[p.longitude, p.latitude]}>
              <View style={styles.markerAzul} />
            </Mapbox.PointAnnotation>
          ))}
          
          {modo === 'SELECCION' && areaSeleccionadaActual.map((p, i) => (
            <Mapbox.PointAnnotation key={`s-${i}`} id={`s-${i}`} coordinate={[p.longitude, p.latitude]}>
              <View style={styles.markerMorado} />
            </Mapbox.PointAnnotation>
          ))}
          
      <Mapbox.UserLocation 
            visible={true} 
            onUpdate={(location) => {
              // Solo actualizamos el estado la primera vez que capta el GPS
              // De esta forma el mapa vuela a ti, pero luego te permite mover el mapa con el dedo sin regresarte a la fuerza.
              if (!ubicacionDispositivo && location?.coords) {
                setUbicacionDispositivo({
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude
                });
              }
            }} 
          />
        
        </Mapbox.MapView>

        {/* Etiqueta central flotante (Ha) */}
        {posLabelCentral && puntosFinca.length >= 3 && (
          <View
            style={[
              styles.labelCentralFloat,
              { left: posLabelCentral.x - 60, top: posLabelCentral.y - 25 },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.labelCentralText}>{areaTotalFinca.toFixed(1)} Ha</Text>
          </View>
        )}

        {/* 🚀 ETIQUETAS DE METROS FLOTANTES NATIVAS FUERA DEL MAPVIEW */}
        {posicionesEtiquetas.map((pos) => {
          const esLadoSeleccionado = primerLadoSeleccionado && primerLadoSeleccionado.id === pos.id;
          const esFinca = pos.tipo === 'FINCA';
          return (
            <TouchableOpacity
              key={`float-lado-${pos.id}`}
              style={[
                styles.floatingLabelContainer,
                { left: pos.x - 50, top: pos.y - 15 }
              ]}
              onPress={() => handleLadoPress(pos.ladoOriginal)}
            >
              <View style={[
                esFinca ? styles.labelLado : styles.labelLadoPotrero, 
                esLadoSeleccionado && styles.labelLadoSeleccionado,
                pos.esFusionado && (esFinca ? styles.labelLadoFusionado : styles.labelLadoPotreroFusionado)
              ]}>
                <Text style={esFinca ? styles.labelLadoText : styles.labelLadoPotreroText}>
                  {Math.round(pos.metros)} m 
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={styles.overlayInfo} pointerEvents="none">
          <View style={styles.overlayTitleRow}>
            <MapIcon color="#fff" size={13} />
            <Text style={styles.overlayTitle}>Planificación Mapbox</Text>
          </View>
          {/* El centro y la escala dependen ahora de la cámara Mapbox, pero podemos mostrar área total */}
          <Text style={styles.overlayText}>
            <Ruler color="#fff" size={11} /> {areaTotalFinca.toFixed(1)} Ha total • {potrerosGenerados.length} potreros
          </Text>
        </View>
      </ViewShot>

      <TouchableOpacity style={[styles.fab, drawerOpen && styles.fabOpen]} onPress={toggleDrawer}>
        {drawerOpen ? <ChevronDown color="#fff" size={24} /> : <ChevronUp color="#fff" size={24} />}
        <Text style={styles.fabText}>{drawerOpen ? 'Ocultar' : 'Menú'}</Text>
      </TouchableOpacity>

      <Animated.View style={[styles.drawer, { transform: [{ translateY: drawerTranslateY }], height: DRAWER_HEIGHT }]} {...panResponder.panHandlers}>
        <View style={styles.drawerHandle}><View style={styles.handleBar} /></View>
        <ScrollView style={styles.drawerContent} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          <View style={styles.divisionModeRow}>
            <Text style={styles.divisionLabel}>Dividir por:</Text>
            <View style={styles.divisionToggle}>
              <TouchableOpacity
                style={[styles.toggleBtn, modoDivision === 'POR_CANTIDAD' && styles.toggleActive]}
                onPress={() => setModoDivision('POR_CANTIDAD')}
              >
                <Text style={[styles.toggleText, modoDivision === 'POR_CANTIDAD' && styles.toggleTextActive]}>
                  <Target color="#fff" size={12} /> Cantidad
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Número de potreros:</Text>
            <TextInput
              style={styles.input} keyboardType="numeric" value={valorDivision}
              onChangeText={setValorDivision} placeholder="4" placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.anguloRow}>
            <Text style={styles.inputLabel}>Ángulo de rotación:</Text>
            <View style={styles.anguloControl}>
              <TouchableOpacity style={styles.anguloBtn} onPress={() => { const nuevoAngulo = anguloRotacion - 15; setAnguloRotacion(nuevoAngulo); actualizarPreview(undefined, nuevoAngulo); }}>
                <Text style={styles.anguloBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.anguloValor}>{anguloRotacion}°</Text>
              <TouchableOpacity style={styles.anguloBtn} onPress={() => { const nuevoAngulo = anguloRotacion + 15; setAnguloRotacion(nuevoAngulo); actualizarPreview(undefined, nuevoAngulo); }}>
                <Text style={styles.anguloBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modoScroll}>
            {[
              { key: 'FINCA', icon: MapIcon, label: 'Perímetro' },
              { key: 'SELECCION', icon: Pencil, label: 'Seleccionar' },
              { key: 'VISTA', icon: Eye, label: 'Ver' },
            ].map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[styles.modeBtn, modo === m.key && styles.activeMode]}
                onPress={() => {
                  setModo(m.key as ModoDibujo);
                  if (m.key === 'SELECCION') { setAreaSeleccionadaActual([]); setPreviewDivision([]); }
                }}
              >
                <Text style={[styles.modeBtnText, { color: getTextoActivo(m.key as ModoDibujo) }]}>
                  <m.icon color={getColorActivo(m.key as ModoDibujo)} size={14} /> {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.rowAction}>
            {modo === 'FINCA' && puntosFinca.length >= 3 && (
              <TouchableOpacity style={[styles.btn, styles.btnFinalizar]} onPress={handleFinalizarFinca}>
                <Text style={styles.btnText}><Check color="#fff" size={14} /> Cerrar finca</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.rowAction}>
            <TouchableOpacity style={[styles.btn, styles.btnDeshacer]} onPress={handleBorrarUltimoPunto}>
              <Text style={styles.btnText}><Undo color="#fff" size={14} /> Deshacer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnBorrar]} onPress={() => {
              if (modo === 'SELECCION') { setAreaSeleccionadaActual([]); setPreviewDivision([]); }
            }}>
              <Text style={styles.btnText}><Trash2 color="#fff" size={14} /> Limpiar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rowAction}>
            <TouchableOpacity style={[styles.btn, styles.btnBackup]} onPress={handleGuardarBackup}>
              <Text style={styles.btnText}><Check color="#fff" size={14} /> Guardar versión</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnRestore, !backup && styles.btnDisabled]} onPress={handleRestaurarBackup} disabled={!backup}>
              <Text style={styles.btnText}><RotateCcw color="#fff" size={14} /> Restaurar versión</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rowAction}>
            <TouchableOpacity style={[styles.btn, styles.btnCalcular]} onPress={handleGenerarDivision}>
              <Text style={styles.btnText}><Split color="#fff" size={14} /> Dividir en partes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnCapturar]} onPress={handleCapturarPantalla}>
              <Text style={styles.btnText}><Camera color="#fff" size={14} /> Capturar</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={[styles.btn, styles.btnGuia]} onPress={() => setModalGuiaVisible(true)}>
            <Text style={styles.btnText}><BookOpen color="#fff" size={14} /> Guía de uso</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.btn, styles.btnLimpiar]} onPress={handleReiniciarTodo}>
            <Text style={styles.btnText}><RotateCcw color="#fff" size={14} /> Reiniciar todo</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      <Modal
        visible={modalGuiaVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalGuiaVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <BookOpen color="#1e40af" size={20} />
                <Text style={styles.modalTitle}>Guía de uso</Text>
              </View>
              <TouchableOpacity onPress={() => setModalGuiaVisible(false)} style={styles.modalCloseBtn}>
                <X color="#475569" size={18} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
              bounces={true}
            >
              <View style={styles.guiaSectionHeader}>
                <MapIcon color="#1e40af" size={15} />
                <Text style={styles.guiaSectionTitle}>Modos de trabajo</Text>
              </View>

              <View style={styles.guiaCard}>
                <View style={styles.guiaCardHeader}>
                  <MapPin color="#2563eb" size={15} />
                  <Text style={styles.guiaTitulo}>Modo Perímetro</Text>
                </View>
                <Text style={styles.guiaTexto}>
                  Toca el mapa para colocar los vértices del límite exterior de tu finca. Cada toque agrega un punto. Con 3 o más puntos puedes presionar{" "}
                  <Text style={styles.guiaNegrita}>"Cerrar finca"</Text> para registrar el perímetro oficial. El área total en hectáreas se calcula automáticamente.
                </Text>
              </View>

              <View style={styles.guiaCard}>
                <View style={styles.guiaCardHeader}>
                  <Pencil color="#7c3aed" size={15} />
                  <Text style={styles.guiaTitulo}>Modo Seleccionar</Text>
                </View>
                <Text style={styles.guiaTexto}>
                  Dibuja un polígono sobre la zona que deseas dividir en potreros. Los puntos se{" "}
                  <Text style={styles.guiaNegrita}>adhieren automáticamente</Text> al borde de la finca cuando están cerca (rango de 120 m). Con 3 o más puntos verás una{" "}
                  <Text style={styles.guiaNegrita}>vista previa verde</Text> de la división.
                </Text>
              </View>

              <View style={styles.guiaCard}>
                <View style={styles.guiaCardHeader}>
                  <Eye color="#0891b2" size={15} />
                  <Text style={styles.guiaTitulo}>Modo Ver</Text>
                </View>
                <Text style={styles.guiaTexto}>
                  Visualiza el resultado final sin agregar puntos. Puedes tocar cualquier potrero para ver su área, perímetro y medidas de cada cara.
                </Text>
              </View>

              <View style={styles.guiaSectionHeader}>
                <Split color="#1e40af" size={15} />
                <Text style={styles.guiaSectionTitle}>Herramientas de división</Text>
              </View>

              <View style={styles.guiaCard}>
                <View style={styles.guiaCardHeader}>
                  <Target color="#059669" size={15} />
                  <Text style={styles.guiaTitulo}>Número de potreros</Text>
                </View>
                <Text style={styles.guiaTexto}>
                  Define cuántas partes iguales en área quieres crear dentro del polígono seleccionado. La división garantiza áreas equivalentes usando búsqueda binaria geodésica de alta precisión.
                </Text>
              </View>

              <View style={styles.guiaCard}>
                <View style={styles.guiaCardHeader}>
                  <RotateCcw color="#d97706" size={15} />
                  <Text style={styles.guiaTitulo}>Ángulo de rotación</Text>
                </View>
                <Text style={styles.guiaTexto}>
                  Controla la dirección de los cortes internos. Con{" "}
                  <Text style={styles.guiaNegrita}>0°</Text> los cortes son horizontales. Ajusta en pasos de 15° con los botones{" "}
                  <Text style={styles.guiaNegrita}>– / +</Text> para alinear los linderos con el terreno real.
                </Text>
              </View>

              <View style={styles.guiaCard}>
                <View style={styles.guiaCardHeader}>
                  <Split color="#0891b2" size={15} />
                  <Text style={styles.guiaTitulo}>Dividir en partes</Text>
                </View>
                <Text style={styles.guiaTexto}>
                  Ejecuta la división del área seleccionada. Los nuevos potreros se agregan al mapa con relleno verde. Puedes hacer múltiples divisiones sobre distintas zonas.
                </Text>
              </View>

              <View style={styles.guiaSectionHeader}>
                <Ruler color="#1e40af" size={15} />
                <Text style={styles.guiaSectionTitle}>Etiquetas de distancia</Text>
              </View>

              <View style={styles.guiaCard}>
                <View style={styles.guiaCardHeader}>
                  <MapPin color="#7c3aed" size={15} />
                  <Text style={styles.guiaTitulo}>Etiquetas púrpuras</Text>
                </View>
                <Text style={styles.guiaTexto}>
                  Muestran la longitud en metros de cada lado del{" "}
                  <Text style={styles.guiaNegrita}>perímetro de la finca</Text>.
                </Text>
              </View>

              <View style={styles.guiaCard}>
                <View style={styles.guiaCardHeader}>
                  <MapPin color="#059669" size={15} />
                  <Text style={styles.guiaTitulo}>Etiquetas verdes</Text>
                </View>
                <Text style={styles.guiaTexto}>
                  Muestran la longitud en metros de los{" "}
                  <Text style={styles.guiaNegrita}>linderos internos de los potreros</Text>.
                </Text>
              </View>

              <View style={styles.guiaCard}>
                <View style={styles.guiaCardHeader}>
                  <Check color="#1e40af" size={15} />
                  <Text style={styles.guiaTitulo}>Fusionar etiquetas</Text>
                </View>
                <Text style={styles.guiaTexto}>
                  Toca una etiqueta y luego otra{" "}
                  <Text style={styles.guiaNegrita}>contigua del mismo tipo</Text> para unirlas en un solo marcador con la suma total. Solo funciona entre lados adyacentes. Útil para simplificar la vista cuando hay muchos linderos cortos seguidos.
                </Text>
              </View>

              <View style={styles.guiaSectionHeader}>
                <Check color="#1e40af" size={15} />
                <Text style={styles.guiaSectionTitle}>Respaldo y restauración</Text>
              </View>

              <View style={styles.guiaCard}>
                <View style={styles.guiaCardHeader}>
                  <Check color="#0f766e" size={15} />
                  <Text style={styles.guiaTitulo}>Guardar versión</Text>
                </View>
                <Text style={styles.guiaTexto}>
                  Guarda permanentemente en el dispositivo el estado actual: finca, potreros y agrupaciones de etiquetas. El respaldo sobrevive al cierre de la app.
                </Text>
              </View>

              <View style={styles.guiaCard}>
                <View style={styles.guiaCardHeader}>
                  <RotateCcw color="#4338ca" size={15} />
                  <Text style={styles.guiaTitulo}>Restaurar versión</Text>
                </View>
                <Text style={styles.guiaTexto}>
                  Vuelve al último estado guardado. Útil si borraste algo por error. Solo disponible si existe un respaldo previo.
                </Text>
              </View>

              <View style={styles.guiaSectionHeader}>
                <Target color="#1e40af" size={15} />
                <Text style={styles.guiaSectionTitle}>Acciones generales</Text>
              </View>

              <View style={styles.guiaCard}>
                <View style={styles.guiaCardHeader}>
                  <Undo color="#f59e0b" size={15} />
                  <Text style={styles.guiaTitulo}>Deshacer</Text>
                </View>
                <Text style={styles.guiaTexto}>
                  En modo <Text style={styles.guiaNegrita}>Perímetro</Text>: elimina el último vértice.{"\n"}
                  En modo <Text style={styles.guiaNegrita}>Seleccionar</Text>: borra el último punto, o deshace la última división si el área está vacía.{"\n"}
                  En modo <Text style={styles.guiaNegrita}>Ver</Text>: revierte la última división generada.
                </Text>
              </View>

              <View style={styles.guiaCard}>
                <View style={styles.guiaCardHeader}>
                  <Trash2 color="#dc2626" size={15} />
                  <Text style={styles.guiaTitulo}>Limpiar</Text>
                </View>
                <Text style={styles.guiaTexto}>
                  En modo Seleccionar, borra el área dibujada actualmente sin afectar los potreros ya generados.
                </Text>
              </View>

              <View style={styles.guiaCard}>
                <View style={styles.guiaCardHeader}>
                  <Camera color="#7c3aed" size={15} />
                  <Text style={styles.guiaTitulo}>Capturar</Text>
                </View>
                <Text style={styles.guiaTexto}>
                  Toma una captura del mapa completo con todos los potreros, etiquetas y datos visibles, y abre el menú para compartirla o guardarla.
                </Text>
              </View>

              <View style={[styles.guiaCard, { marginBottom: 8 }]}>
                <View style={styles.guiaCardHeader}>
                  <RotateCcw color="#475569" size={15} />
                  <Text style={styles.guiaTitulo}>Reiniciar todo</Text>
                </View>
                <Text style={styles.guiaTexto}>
                  Borra completamente todos los datos: finca, potreros, historial y agrupaciones. Esta acción{" "}
                  <Text style={styles.guiaNegrita}>no se puede deshacer</Text>. Usa "Guardar versión" antes si lo necesitas.
                </Text>
              </View>

            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#f8fafc', borderRadius: 20,
    width: '92%', maxHeight: '85%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 30,
    overflow: 'hidden',
    flex: 0,
    flexShrink: 1,
  },
  modalScroll: {
    flexGrow: 1,
    flexShrink: 1,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  modalHeaderLeft: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  modalTitle: {
    fontSize: 17, fontWeight: '800', color: '#0f172a',
  },
  modalCloseBtn: {
    backgroundColor: '#f1f5f9', borderRadius: 20,
    width: 34, height: 34, alignItems: 'center', justifyContent: 'center',
  },
  modalScrollContent: {
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 28,
  },
  guiaSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginTop: 20, marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1.5, borderBottomColor: '#dbeafe',
  },
  guiaSectionTitle: {
    fontSize: 12, fontWeight: '800', color: '#1e40af',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  guiaCard: {
    backgroundColor: '#fff', borderRadius: 12,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  guiaCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6,
  },
  guiaTitulo: {
    fontSize: 13, fontWeight: '700', color: '#0f172a',
  },
  guiaTexto: {
    fontSize: 12.5, color: '#475569', lineHeight: 19,
  },
  guiaNegrita: {
    fontWeight: '700', color: '#0f172a',
  },
  container: { flex: 1, backgroundColor: '#000' },
  map: { width: '100%', height: '100%' },
  // ESTILOS DE MAPBOX (REEMPLAZANDO EL pinColor DE GOOGLE)
  markerAzul: { width: 14, height: 14, backgroundColor: 'blue', borderRadius: 7, borderWidth: 2, borderColor: 'white' },
  markerMorado: { width: 14, height: 14, backgroundColor: 'purple', borderRadius: 7, borderWidth: 2, borderColor: 'white' },
  labelCentralFloat: {
    position: 'absolute',
    backgroundColor: 'rgba(30, 64, 175, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    zIndex: 100,
  },
  labelCentralText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'center',
  },
  labelLado: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 12, 
    paddingVertical: 5,
    borderRadius: 12, 
    borderWidth: 1.5, 
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  btnGuia: { backgroundColor: '#0369a1', marginTop: 8 },
  labelLadoText: { 
    color: '#ffffff', 
    fontWeight: '700',
    fontSize: 10,
    textAlign: 'center',
    paddingRight: 4, 
    includeFontPadding: false, 
    textAlignVertical: 'center',
  },
  labelLadoPotrero: {
    backgroundColor: 'rgba(6, 78, 59, 0.9)', 
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#34d399', 
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
  },
  labelLadoPotreroText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 8.5,
    textAlign: 'center',
    paddingRight: 3,
  },
  labelLadoFusionado: {
    backgroundColor: '#1e3a8a',
    borderColor: '#60a5fa',
    borderWidth: 1.5,
  },
  labelLadoPotreroFusionado: {
    backgroundColor: '#065f46',
    borderColor: '#34d399',
    borderWidth: 1.5,
  },
  overlayInfo: {
    position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 10, borderRadius: 10, minWidth: 200,
  },
  overlayTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 5,
  },
  overlayTitle: { color: '#fff', fontWeight: '700', fontSize: 13 },
  overlayText: { color: '#e2e8f0', fontSize: 11, flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', zIndex: 20 },
  drawer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.98)', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    elevation: 25, shadowColor: '#000', shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25, shadowRadius: 10, zIndex: 25,
  },
  drawerHandle: { paddingVertical: 12, alignItems: 'center' },
  handleBar: { width: 48, height: 5, backgroundColor: '#cbd5e1', borderRadius: 3 },
  drawerContent: { paddingHorizontal: 18, paddingVertical: 10 },
  divisionModeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  divisionLabel: { fontWeight: '700', color: '#0f172a', fontSize: 14 },
  divisionToggle: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 10, padding: 3 },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8 },
  toggleActive: { backgroundColor: '#1e40af' },
  toggleText: { fontSize: 11, fontWeight: '600', color: '#334155', flexDirection: 'row', alignItems: 'center', gap: 4 },
  toggleTextActive: { color: '#fff' },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  inputLabel: { fontWeight: '700', color: '#0f172a', fontSize: 14 },
  input: { borderWidth: 1.5, borderColor: '#cbd5e1', backgroundColor: '#fff', paddingVertical: 7, paddingHorizontal: 16, borderRadius: 12, width: 75, textAlign: 'center', fontWeight: '700', fontSize: 15 },
  anguloRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  anguloControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  anguloBtn: {
    backgroundColor: '#e2e8f0', width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center'
  },
  anguloBtnText: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  anguloValor: { fontSize: 16, fontWeight: '700', color: '#0f172a', minWidth: 40, textAlign: 'center' },
  modoScroll: { marginBottom: 14 },
  modeBtn: { paddingVertical: 9, paddingHorizontal: 16, marginRight: 8, backgroundColor: '#f1f5f9', borderRadius: 22, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  activeMode: { backgroundColor: '#1e40af', borderColor: '#1e40af' },
  modeBtnText: { fontWeight: '600', fontSize: 12, flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowAction: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginVertical: 5 },
  btn: { paddingVertical: 13, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 46 },
  btnDeshacer: { backgroundColor: '#f59e0b' },
  btnBorrar: { backgroundColor: '#dc2626' },
  btnFinalizar: { backgroundColor: '#059669' },
  btnBackup: { backgroundColor: '#0f766e' },
  btnRestore: { backgroundColor: '#4338ca' },
  btnDisabled: { backgroundColor: '#94a3b8', opacity: 0.65 },
  btnCalcular: { backgroundColor: '#0891b2' },
  btnCapturar: { backgroundColor: '#7c3aed' },
  btnLimpiar: { backgroundColor: '#475569', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 12, flexDirection: 'row', alignItems: 'center', gap: 5 },
  fab: {
    position: 'absolute', bottom: 28, right: 22,
    backgroundColor: '#1e40af', paddingVertical: 13, paddingHorizontal: 22,
    borderRadius: 32, flexDirection: 'row', alignItems: 'center', gap: 7,
    elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35, shadowRadius: 8, zIndex: 30,
  },
  fabOpen: { backgroundColor: '#64748b' },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  floatingLabelContainer: {
    position: 'absolute',
    width: 100, 
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  labelLadoSeleccionado: {
    backgroundColor: '#1d4ed8', 
    borderColor: '#ffffff',
    borderWidth: 1.5,
  },
});