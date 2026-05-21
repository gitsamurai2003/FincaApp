import { useFocusEffect, useRouter } from 'expo-router';
import { ClipboardList, Database, LayoutGrid, PlusCircle } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Conexión a la BD, Operadores y Esquemas
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { animales, fincas, produccionLeche } from '../../db/schema';
import { fechaLocalISO } from '../../utils/fecha';

export default function HomeScreen() {
  const router = useRouter();
  
  // Estados para controlar los datos reales de la BD
  const [cargando, setCargando] = useState(true);
  const [fincaActiva, setFincaActiva] = useState<{ id: string; nombre: string } | null>(null);
  const [totalAnimales, setTotalAnimales] = useState(0);
  const [litrosHoy, setLitrosHoy] = useState(0);

  // Función de consulta centralizada para poder re-ejecutarla al cambiar de finca
  const consultarDatosDeFinca = useCallback(async () => {
    try {
      setCargando(true);

      // 1. MULTI-FINCA: Buscamos la finca que tenga la bandera activa = 1
      const listaFincas = await db.select().from(fincas).where(eq(fincas.activa, 1)).limit(1);
      
      if (listaFincas.length > 0) {
        const finca = listaFincas[0];
        setFincaActiva({ id: finca.id, nombre: finca.nombre });

        // 2. Contar animales de esta finca específica
        const conteoAnimales = await db
          .select({ count: sql<number>`count(*)` })
          .from(animales)
          .where(and(eq(animales.fincaId, finca.id), eq(animales.estado, 'Activo')));
        setTotalAnimales(conteoAnimales[0]?.count || 0);

        // 3. Sumar producción de leche del día de hoy (Formato YYYY-MM-DD)
        const hoy = fechaLocalISO();
        const { total } = (await db
          .select({ total: sql<number>`sum(litros)` })
          .from(produccionLeche)
          .where(sql`fecha = ${hoy} AND animal_id IN (SELECT id FROM animales WHERE finca_id = ${finca.id})`))[0] || { total: 0 };
        
        setLitrosHoy(total || 0);

      } else {
        // No hay proyectos activos o la tabla está vacía
        setFincaActiva(null);
        setTotalAnimales(0);
        setLitrosHoy(0);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudieron sincronizar los datos locales.");
    } finally {
      setCargando(false);
    }
  }, []);

  // Carga de datos al enfocar la pantalla
  useFocusEffect(
    useCallback(() => {
      consultarDatosDeFinca();
    }, [consultarDatosDeFinca])
  );

  // FUNCIÓN PARA CAMBIAR DE FINCA (Desplegable dinámico nativo)
  const manejarSeleccionFinca = async () => {
    try {
      // Consultamos todos los predios guardados en SQLite
      const todosLosPredios = await db.select().from(fincas);

      if (todosLosPredios.length === 0) {
        // Si no hay ninguna, lo mandamos directo al formulario de registro
        router.push('/crear-finca');
        return;
      }

      // Mapeamos las opciones para el Alert de selección
      const opciones = todosLosPredios.map((predio) => ({
        text: predio.id === fincaActiva?.id ? `Seleccionado: ${predio.nombre}` : predio.nombre,
        onPress: async () => {
          try {
            setCargando(true);
            // Transacción secuencial local: Desactivamos todas y activamos la elegida
            await db.update(fincas).set({ activa: 0 });
            await db.update(fincas).set({ activa: 1 }).where(eq(fincas.id, predio.id));
            
            // Recargamos el tablero completo con la nueva información
            await consultarDatosDeFinca();
          } catch (e) {
            console.error(e);
            Alert.alert("Error", "No se pudo cambiar de predio.");
          }
        }
      }));

      if (fincaActiva) {
        opciones.unshift({
          text: `Editar: ${fincaActiva.nombre}`,
          onPress: () => router.push('/editar-finca'),
        });
      }

      opciones.push({
        text: "+ Registrar Nueva Finca",
        onPress: async () => { await router.push('/crear-finca'); }
      });

      // Añadimos el botón clásico de cancelar
      opciones.push({
        text: "Cancelar",
        onPress: () => {},
      } as any);

      Alert.alert(
        "Cambiar de Predio",
        "Selecciona la unidad de producción que deseas gestionar en este momento:",
        optionsMapCancel(opciones),
        { cancelable: true }
      );

    } catch (error) {
      console.error(error);
    }
  };

  function optionsMapCancel(arr: any[]) {
    return arr;
  }

  const navegarModulo = (ruta: string) => {
    if (!fincaActiva) {
      Alert.alert("Finca Requerida", "Primero debes crear o seleccionar una Finca para gestionar datos.");
      return;
    }
    router.push(ruta as any); 
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      
      {/* HEADER DE BIENVENIDA */}
      <View style={styles.header}>
        <Text style={styles.headerSubtitle}>Panel de Control</Text>
        <Text style={styles.headerTitle}>
          {fincaActiva ? fincaActiva.nombre : 'Finca Pro'}
        </Text>
        <View style={styles.badgeContainer}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>
            {fincaActiva ? 'Proyecto Activo Offline' : 'Sin Finca Seleccionada'}
          </Text>
        </View>
      </View>

      {/* CONTENIDO DEL MENÚ */}
      <View style={styles.menuContent}>
        
        {/* BOTÓN PRINCIPAL: SELECTOR INTERACTIVO */}
        <TouchableOpacity 
          activeOpacity={0.8}
          style={styles.mainButton}
          onPress={manejarSeleccionFinca}
        >
          <View style={styles.iconContainerMain}>
            <PlusCircle color="#065f46" size={28} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mainButtonTitle}>
              {fincaActiva ? 'Cambiar de Finca' : 'Crear tu primera Finca'}
            </Text>
            <Text style={styles.mainButtonSubtitle}>
              {fincaActiva ? 'Toca para alternar entre tus proyectos agropecuarios' : 'Inicia el registro del inventario'}
            </Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Gestión de Datos</Text>

        {/* INDICADOR DE CARGA LOCAL */}
        {cargando ? (
          <View style={{ padding: 20 }}>
            <ActivityIndicator size="small" color="#065f46" />
          </View>
        ) : (
          /* REJILLA DE BOTONES SECUNDARIOS */
          <View style={styles.gridContainer}>
            
            {/* Botón: Inventario */}
            <TouchableOpacity 
              style={styles.gridButton}
              onPress={() => navegarModulo('/inventario')}
            >
              <LayoutGrid color="#1e293b" size={24} />
              <Text style={styles.gridButtonTitle}>Inventario</Text>
              <Text style={styles.gridButtonSubtitle}>
                {fincaActiva ? `${totalAnimales} Animales registrados` : 'Ver todos los animales'}
              </Text>
            </TouchableOpacity>

            {/* Botón: Resúmenes / Producción */}
            <TouchableOpacity 
              style={styles.gridButton}
              onPress={() => navegarModulo('/produccion')}
            >
              <ClipboardList color="#1e293b" size={24} />
              <Text style={styles.gridButtonTitle}>Producción</Text>
              <Text style={styles.gridButtonSubtitle}>
                {fincaActiva ? `${litrosHoy} Lts producidos hoy` : 'Leche y Pesajes'}
              </Text>
            </TouchableOpacity>

            {/* Botón: Respaldos (Ancho Completo) */}
            <TouchableOpacity 
              style={styles.fullWidthButton}
              onPress={() => router.push('/respaldo')}
            >
              <View style={styles.rowCentered}>
                <Database color="#64748b" size={20} />
                <Text style={styles.fullWidthButtonTitle}>Copia de Seguridad</Text>
              </View>
              <View style={styles.badgeSqlite}>
                <Text style={styles.badgeSqliteText}>SQLITE</Text>
              </View>
            </TouchableOpacity>

          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#065f46',
    paddingTop: 64, paddingBottom: 40, paddingHorizontal: 24,
    borderBottomLeftRadius: 40, borderBottomRightRadius: 40,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1, shadowRadius: 15, elevation: 5,
  },
  headerSubtitle: { color: '#a7f3d0', fontWeight: '700', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1.5 },
  headerTitle: { color: '#ffffff', fontSize: 30, fontWeight: '900', marginTop: 4 },
  badgeContainer: {
    flexDirection: 'row', alignItems: 'center', marginTop: 16,
    backgroundColor: 'rgba(2, 45, 34, 0.5)', alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999,
    borderWidth: 1, borderColor: '#047857',
  },
  badgeDot: { width: 8, height: 8, backgroundColor: '#34d399', borderRadius: 4, marginRight: 8 },
  badgeText: { color: '#d1fae5', fontSize: 12, fontWeight: '500' },
  menuContent: { paddingHorizontal: 24, marginTop: -24 },
  mainButton: {
    backgroundColor: '#ffffff', padding: 24, borderRadius: 24,
    borderWidth: 1, borderColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2,
  },
  iconContainerMain: { backgroundColor: '#d1fae5', padding: 12, borderRadius: 16, marginRight: 16 },
  mainButtonTitle: { color: '#1e293b', fontWeight: '700', fontSize: 18 },
  mainButtonSubtitle: { color: '#64748b', fontSize: 12, marginTop: 2 },
  sectionTitle: { color: '#94a3b8', fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 32, marginBottom: 16, marginLeft: 8 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridButton: {
    backgroundColor: '#ffffff', width: '48%', padding: 20, borderRadius: 24,
    borderWidth: 1, borderColor: '#f1f5f9', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2,
  },
  gridButtonTitle: { color: '#1e293b', fontWeight: '700', fontSize: 14, marginTop: 12 },
  gridButtonSubtitle: { color: '#94a3b8', fontSize: 10, marginTop: 4 },
  fullWidthButton: {
    backgroundColor: '#ffffff', width: '100%', padding: 20, borderRadius: 24,
    borderWidth: 1, borderColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2,
  },
  rowCentered: { flexDirection: 'row', alignItems: 'center' },
  fullWidthButtonTitle: { color: '#475569', fontWeight: '700', fontSize: 14, marginLeft: 12 },
  badgeSqlite: { backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeSqliteText: { color: '#059669', fontWeight: '700', fontSize: 10 }
});