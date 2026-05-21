import { useFocusEffect, useRouter } from 'expo-router';
import {
  Award,
  Calculator,
  ChevronRight,
  ClipboardList,
  Heart,
  Landmark,
  MapPin,
  Milk,
  Scale,
  ShieldAlert,
  Stethoscope,
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Conexión con SQLite y Drizzle para mostrar conteos reales en tiempo real
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { animales, fincas, pesajes, produccionLeche } from '../../db/schema';
import { fechaLocalISO } from '../../utils/fecha';

export default function RegistrosScreen() {
  const router = useRouter();
  
  // Estados para métricas rápidas del día
  const [fincaNombre, setFincaNombre] = useState('Cargando...');
  const [totalAnimales, setTotalAnimales] = useState(0);
  const [conteoLecheHoy, setConteoLecheHoy] = useState(0);
  const [conteoPesajesTotal, setConteoPesajesTotal] = useState(0);
  const [cargando, setCargando] = useState(true);

  const cargarMetricas = useCallback(async () => {
  try {
    setCargando(true);
    
    // CORRECCIÓN: Filtramos específicamente por la finca activa
    const actualFinca = await db
      .select()
      .from(fincas)
      .where(eq(fincas.activa, 1)) // <-- AGREGADO
      .limit(1);
    
    if (actualFinca.length > 0) {
      const fId = actualFinca[0].id;
      setFincaNombre(actualFinca[0].nombre);

      // 2. Conteo de animales (Usando Drizzle de forma más limpia)
      const resAnimales = await db
        .select({ count: sql<number>`count(*)` })
        .from(animales)
        .where(and(eq(animales.fincaId, fId), eq(animales.estado, 'Activo')));
      setTotalAnimales(resAnimales[0]?.count || 0);

      // 3. Conteo de leche hoy
      const hoy = fechaLocalISO();
      const resLeche = await db
        .select({ count: sql<number>`count(*)` })
        .from(produccionLeche)
        .innerJoin(animales, eq(produccionLeche.animalId, animales.id)) // <-- MEJORADO
        .where(sql`${animales.fincaId} = ${fId} AND ${produccionLeche.fecha} = ${hoy}`);
      setConteoLecheHoy(resLeche[0]?.count || 0);

      // 4. Conteo de pesajes
      const resPesajes = await db
        .select({ count: sql<number>`count(*)` })
        .from(pesajes)
        .innerJoin(animales, eq(pesajes.animalId, animales.id)) // <-- MEJORADO
        .where(eq(animales.fincaId, fId)); // <-- MEJORADO
      setConteoPesajesTotal(resPesajes[0]?.count || 0);
      
    } else {
      setFincaNombre('Sin finca activa');
      setTotalAnimales(0);
      setConteoLecheHoy(0);
      setConteoPesajesTotal(0);
    }
  } catch (error) {
    console.error("Error cargando métricas:", error);
  } finally {
    setCargando(false);
  }
}, []);

  useFocusEffect(
    useCallback(() => {
      cargarMetricas();
    }, [cargarMetricas])
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* HEADER PRINCIPAL */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Histórico de Registros</Text>
        <Text style={styles.headerSubtitle}>{fincaNombre}</Text>
      </View>

      {/* FILAS DE SELECCIÓN DE GRUPOS */}
      <View style={styles.menuGroup}>
        <Text style={styles.sectionLabel}>Módulos Operativos</Text>

        {/* ACCESO: LOTES */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/gestionar-lotes')}
        >
          <View style={[styles.iconWrapper, { backgroundColor: '#f0fdf4' }]}>
            <MapPin color="#059669" size={22} />
          </View>
          <View style={styles.menuItemText}>
            <Text style={styles.menuItemTitle}>Lotes / Potreros</Text>
            <Text style={styles.menuItemSubtitle}>Crear y administrar potreros de la finca activa</Text>
          </View>
          <ChevronRight color="#cbd5e1" size={20} />
        </TouchableOpacity>

        {/* ACCESO: INVENTARIO GLOBAL */}
        <TouchableOpacity 
          style={styles.menuItem} 
          onPress={() => router.push('/inventario')}
        >
          <View style={[styles.iconWrapper, { backgroundColor: '#eff6ff' }]}>
            <ClipboardList color="#3b82f6" size={22} />
          </View>
          <View style={styles.menuItemText}>
            <Text style={styles.menuItemTitle}>Inventario Animal</Text>
            <Text style={styles.menuItemSubtitle}>
              {cargando ? '...' : `${totalAnimales} ejemplares registrados`}
            </Text>
          </View>
          <ChevronRight color="#cbd5e1" size={20} />
        </TouchableOpacity>

        {/* ACCESO: RANKING LECHERO */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/ranking-leche')}
        >
          <View style={[styles.iconWrapper, { backgroundColor: '#ede9fe' }]}>
            <Award color="#7c3aed" size={22} />
          </View>
          <View style={styles.menuItemText}>
            <Text style={styles.menuItemTitle}>Ranking Lechero</Text>
            <Text style={styles.menuItemSubtitle}>
              Promedio L/día o L/pesada por animal en un período
            </Text>
          </View>
          <ChevronRight color="#cbd5e1" size={20} />
        </TouchableOpacity>

        {/* ACCESO: REGISTROS DE LECHE */}
        <TouchableOpacity 
          style={styles.menuItem} 
          onPress={() => router.push('/historial-leche')}        >
          <View style={[styles.iconWrapper, { backgroundColor: '#ecfdf5' }]}>
            <Milk color="#065f46" size={22} />
          </View>
          <View style={styles.menuItemText}>
            <Text style={styles.menuItemTitle}>Producción Lechera</Text>
            <Text style={styles.menuItemSubtitle}>
              {cargando ? '...' : `${conteoLecheHoy} pesadas registradas hoy`}
            </Text>
          </View>
          <ChevronRight color="#cbd5e1" size={20} />
        </TouchableOpacity>

        {/* ACCESO: REGISTROS DE PESAJE */}
        <TouchableOpacity 
          style={styles.menuItem} 
          onPress={() => router.push('/historial-pesajes')}        >
          <View style={[styles.iconWrapper, { backgroundColor: '#fef3c7' }]}>
            <Scale color="#d97706" size={22} />
          </View>
          <View style={styles.menuItemText}>
            <Text style={styles.menuItemTitle}>Pesajes de Carne</Text>
            <Text style={styles.menuItemSubtitle}>
              {cargando ? '...' : `${conteoPesajesTotal} registros históricos`}
            </Text>
          </View>
          <ChevronRight color="#cbd5e1" size={20} />
        </TouchableOpacity>

        {/* ACCESO: RENDIMIENTO QUESERO */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/rendimiento-queso')}
        >
          <View style={[styles.iconWrapper, { backgroundColor: '#fef9c3' }]}>
            <Calculator color="#ca8a04" size={22} />
          </View>
          <View style={styles.menuItemText}>
            <Text style={styles.menuItemTitle}>Rendimiento Quesero</Text>
            <Text style={styles.menuItemSubtitle}>
              Litros de leche por kg de queso en un período
            </Text>
          </View>
          <ChevronRight color="#cbd5e1" size={20} />
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Peso y engorde</Text>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/ranking-peso')}>
          <View style={[styles.iconWrapper, { backgroundColor: '#fef3c7' }]}>
            <Scale color="#d97706" size={22} />
          </View>
          <View style={styles.menuItemText}>
            <Text style={styles.menuItemTitle}>Ranking GDP (peso)</Text>
            <Text style={styles.menuItemSubtitle}>Ganancia diaria de peso por animal</Text>
          </View>
          <ChevronRight color="#cbd5e1" size={20} />
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Salud y reproducción</Text>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/historial-reproduccion')}>
          <View style={[styles.iconWrapper, { backgroundColor: '#ede9fe' }]}>
            <Heart color="#7c3aed" size={22} />
          </View>
          <View style={styles.menuItemText}>
            <Text style={styles.menuItemTitle}>Reproducción</Text>
            <Text style={styles.menuItemSubtitle}>Celos, palpaciones, partos</Text>
          </View>
          <ChevronRight color="#cbd5e1" size={20} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/registrar-sanidad')}>
          <View style={[styles.iconWrapper, { backgroundColor: '#fee2e2' }]}>
            <Stethoscope color="#dc2626" size={22} />
          </View>
          <View style={styles.menuItemText}>
            <Text style={styles.menuItemTitle}>Registrar tratamiento</Text>
            <Text style={styles.menuItemSubtitle}>Vacunas, medicamentos y retiros</Text>
          </View>
          <ChevronRight color="#cbd5e1" size={20} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/retiro-sanidad')}>
          <View style={[styles.iconWrapper, { backgroundColor: '#fef2f2' }]}>
            <ShieldAlert color="#dc2626" size={22} />
          </View>
          <View style={styles.menuItemText}>
            <Text style={styles.menuItemTitle}>Animales en retiro</Text>
            <Text style={styles.menuItemSubtitle}>Leche o carne bloqueadas por tratamiento</Text>
          </View>
          <ChevronRight color="#cbd5e1" size={20} />
        </TouchableOpacity>
      </View>

      {/* NOTA METODOLÓGICA PIE DE PÁGINA */}
      <View style={styles.footerNote}>
        <Landmark color="#94a3b8" size={16} />
        <Text style={styles.footerNoteText}>
          Toda la data zootécnica se procesa e indexa de manera local y descentralizada en el almacenamiento interno de este dispositivo.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentContainer: {
    paddingBottom: 100, // Espacio suficiente para no chocar con tu barra flotante absoluta
  },
  header: {
    paddingTop: 65,
    paddingHorizontal: 24,
    paddingBottom: 24,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#065f46',
    fontWeight: '600',
    marginTop: 2,
  },
  menuGroup: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
    paddingLeft: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.01,
    shadowRadius: 2,
    elevation: 1,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemText: {
    flex: 1,
    marginLeft: 14,
  },
  menuItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  footerNote: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginTop: 24,
    gap: 8,
    alignItems: 'flex-start',
  },
  footerNoteText: {
    flex: 1,
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
  },
});