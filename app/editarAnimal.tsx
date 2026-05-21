import { eq } from 'drizzle-orm';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Calendar, FileText, Hash, Scale, Tag, Users } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
    ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { CATEGORIAS_AGRUPADAS } from '../constants/categoriasAnimal';
import { db } from '../db/client';
import { areteExisteEnFinca } from '../db/validarArete';
import { animales, especies, fincas, lotes, razas } from '../db/schema';

// ─── Types para los catálogos ──────────────────────────────────────────────
interface EspecieDB { id: number; nombre: string; }
interface RazaDB { id: number; especieId: number; nombre: string; }
interface LoteDB { id: string; nombre: string; }

import type { CategoriaAnimal } from '../constants/categoriasAnimal';

export default function EditarAnimalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // ─── Estados para los campos del animal ──────────────────────────────────
  const [arete, setArete] = useState('');
  const [nombre, setNombre] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [pesoInicial, setPesoInicial] = useState('');
  const [proposito, setProposito] = useState('Doble_Proposito');
  const [madreId, setMadreId] = useState('');
  const [padreId, setPadreId] = useState('');
  const [notas, setNotas] = useState('');
  
  // ← Campos relacionales y de estado (EDITABLES)
  const [especieId, setEspecieId] = useState<number | null>(null);
  const [razaId, setRazaId] = useState<number | null>(null);
  const [loteId, setLoteId] = useState<string | null>(null);
  const [sexo, setSexo] = useState<'F' | 'M'>('F');
  const [categoria, setCategoria] = useState<CategoriaAnimal | ''>('');
  const [fincaIdAnimal, setFincaIdAnimal] = useState<string | null>(null);
  const [estado, setEstado] = useState('Activo');

  // ─── Estados para catálogos ──────────────────────────────────────────────
  const [listaEspecies, setListaEspecies] = useState<EspecieDB[]>([]);
  const [listaRazas, setListaRazas] = useState<RazaDB[]>([]);
  const [listaLotes, setListaLotes] = useState<LoteDB[]>([]);
  const [razasFiltradas, setRazasFiltradas] = useState<RazaDB[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const propositosOpciones = ['Leche', 'Carne', 'Doble_Proposito', 'Trabajo', 'Genetica_Pura'];
  const estadosOpciones = ['Activo', 'Vendido', 'Fallecido', 'Consumo_Interno'];

  // ─── Cargar datos del animal + catálogos al montar ───────────────────────
  useEffect(() => {
    async function cargarTodo() {
      if (!id) return;
      setCargando(true);

      try {
        // 1. Obtener finca activa (para filtrar lotes)
        const fincaActiva = await db.select().from(fincas).where(eq(fincas.activa, 1)).limit(1);
        const fincaActivaId = fincaActiva[0]?.id;

        // 2. Cargar catálogos
        const [dbEspecies, dbRazas, dbLotes] = await Promise.all([
          db.select().from(especies),
          db.select().from(razas),
          fincaActivaId 
            ? db.select().from(lotes).where(eq(lotes.fincaId, fincaActivaId))
            : Promise.resolve([])
        ]);

        setListaEspecies(dbEspecies);
        setListaRazas(dbRazas);
        setListaLotes(dbLotes);

        // 3. Cargar datos del animal
        const res = await db.select().from(animales).where(eq(animales.id, id)).limit(1);
        if (res[0]) {
          const a = res[0];
          setArete(a.areteCodigo || '');
          setNombre(a.nombre || '');
          setFechaNacimiento(a.fechaNacimiento || '');
          setPesoInicial(a.pesoInicial?.toString() || '');
          setProposito(a.proposito || 'Doble_Proposito');
          setMadreId(a.madreId || '');
          setPadreId(a.padreId || '');
          setNotas(a.notas || '');
          setEspecieId(a.especieId);
          setRazaId(a.razaId);
          setLoteId(a.loteId);
          setSexo(a.sexo || 'F');
          setCategoria((a.categoria as CategoriaAnimal) || '');
          setFincaIdAnimal(a.fincaId);
          setEstado(a.estado || 'Activo');
        }
      } catch (error) {
        console.error('Error cargando datos:', error);
        Alert.alert('Error', 'No se pudieron cargar los datos del animal.');
      } finally {
        setCargando(false);
      }
    }
    cargarTodo();
  }, [id]);

  // ─── Filtrar razas cuando cambia la especie ──────────────────────────────
  useEffect(() => {
    if (especieId !== null) {
      const filtradas = listaRazas.filter(r => r.especieId === especieId);
      setRazasFiltradas(filtradas);
      if (razaId && !filtradas.some(r => r.id === razaId)) {
        setRazaId(filtradas[0]?.id || null);
      }
    }
  }, [especieId, listaRazas, razaId]);

  // ─── Guardar cambios ─────────────────────────────────────────────────────
  async function handleSave() {
    if (!arete.trim()) {
      Alert.alert('Faltan Datos', 'El código del arete es obligatorio.');
      return;
    }
    if (especieId === null || razaId === null) {
      Alert.alert('Faltan Datos', 'Debes seleccionar especie y raza.');
      return;
    }
    if (!categoria) {
      Alert.alert('Faltan Datos', 'Debes seleccionar una categoría válida.');
      return;
    }

    if (fincaIdAnimal) {
      const propio = arete.trim().toUpperCase();
      if (madreId.trim()) {
        const m = madreId.trim().toUpperCase();
        if (m === propio || !(await areteExisteEnFinca(fincaIdAnimal, m))) {
          Alert.alert(
            'Madre no válida',
            m === propio ? 'El arete de la madre no puede ser el mismo.' : `Arete ${m} no existe en esta finca.`
          );
          return;
        }
      }
      if (padreId.trim()) {
        const p = padreId.trim().toUpperCase();
        if (p === propio || !(await areteExisteEnFinca(fincaIdAnimal, p))) {
          Alert.alert(
            'Padre no válido',
            p === propio ? 'El arete del padre no puede ser el mismo.' : `Arete ${p} no existe en esta finca.`
          );
          return;
        }
      }
    }

    try {
      setGuardando(true);
      
      await db.update(animales)
        .set({ 
          areteCodigo: arete.trim().toUpperCase(),
          nombre: nombre.trim() || null,
          fechaNacimiento: fechaNacimiento.trim(),
          pesoInicial: parseFloat(pesoInicial) || 0,
          proposito: proposito as any,
          madreId: madreId.trim().toUpperCase() || null,
          padreId: padreId.trim().toUpperCase() || null,
          notas: notas.trim() || null,
          especieId,
          razaId,
          loteId: loteId || null,
          sexo,
          categoria: categoria as any,  // ← Guardar categoría seleccionada (enum válido)
          estado: estado as any,
        })
        .where(eq(animales.id, id));
        
      Alert.alert("Éxito", "Hoja de vida actualizada correctamente");
      router.back();
    } catch (e) {
      console.error('Error guardando:', e);
      Alert.alert("Error", "No se pudo actualizar. Verifica que el arete no esté duplicado.");
    } finally {
      setGuardando(false);
    }
  }

  // ─── Eliminar animal ─────────────────────────────────────────────────────
  async function handleDelete() {
    Alert.alert(
      "Confirmar eliminación", 
      "¿Estás seguro? Esta acción eliminará permanentemente al animal y sus registros asociados.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Eliminar", 
          style: "destructive", 
          onPress: async () => {
            try {
              await db.delete(animales).where(eq(animales.id, id));
              router.replace('/inventario');
            } catch (e) {
              Alert.alert("Error", "No se pudo eliminar el registro");
            }
          } 
        }
      ]
    );
  }

  // ─── Loading state ───────────────────────────────────────────────────────
  if (cargando) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#065f46" />
      </View>
    );
  }

  // ─── UI Principal ────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
<Stack.Screen 
  options={{ 
    title: 'Editar Ficha Animal',
    headerStyle: { 
      backgroundColor: '#ffffff', // Solo color de fondo
    },
    headerShadowVisible: true, // Esto crea la sombra/borde inferior estándar de iOS/Android
    headerTintColor: '#1e293b',
    headerTitleStyle: { fontWeight: '700', fontSize: 18 },
    headerLeft: () => (
      <TouchableOpacity 
        onPress={() => router.back()} 
        style={{ marginLeft: 8, padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' }}
      >
        <ArrowLeft color="#1e293b" size={24} />
      </TouchableOpacity>
    )
  }} 
/>

      <ScrollView style={styles.scrollContent} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* Código de Arete */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Código del Arete</Text>
          <View style={styles.inputWrapper}>
            <Hash color="#64748b" size={20} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={arete}
              onChangeText={setArete}
              autoCapitalize="characters"
              placeholder="Ej. BUF-0102"
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>

        {/* Nombre */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nombre (Opcional)</Text>
          <View style={styles.inputWrapper}>
            <Tag color="#64748b" size={20} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Ej. Mariposa"
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>

        {/* Fecha Nacimiento */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Fecha de Nacimiento</Text>
          <View style={styles.inputWrapper}>
            <Calendar color="#64748b" size={20} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={fechaNacimiento}
              onChangeText={setFechaNacimiento}
              keyboardType="numeric"
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>

        {/* Especie */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Especie</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorScroll}>
            {listaEspecies.map((esp) => (
              <TouchableOpacity
                key={esp.id}
                style={[styles.chip, especieId === esp.id && styles.chipActive]}
                onPress={() => setEspecieId(esp.id)}
              >
                <Text style={[styles.chipText, especieId === esp.id && styles.chipTextActive]}>
                  {esp.nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Raza */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Raza</Text>
          {razasFiltradas.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorScroll}>
              {razasFiltradas.map((raz) => (
                <TouchableOpacity
                  key={raz.id}
                  style={[styles.chip, razaId === raz.id && styles.chipActive]}
                  onPress={() => setRazaId(raz.id)}
                >
                  <Text style={[styles.chipText, razaId === raz.id && styles.chipTextActive]}>
                    {raz.nombre}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.noDataText}>Selecciona una especie primero.</Text>
          )}
        </View>

        {/* Propósito */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Propósito</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorScroll}>
            {propositosOpciones.map((prop) => (
              <TouchableOpacity
                key={prop}
                style={[styles.chip, proposito === prop && styles.chipActive]}
                onPress={() => setProposito(prop)}
              >
                <Text style={[styles.chipText, proposito === prop && styles.chipTextActive]}>
                  {prop.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ← NUEVO: Categoría (selector con enum agrupado) */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Categoría Zootécnica</Text>
          {Object.entries(CATEGORIAS_AGRUPADAS).map(([grupo, opciones]) => (
            <View key={grupo} style={{ marginBottom: 12 }}>
              <Text style={styles.groupLabel}>{grupo}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorScroll}>
                {opciones.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, categoria === cat && styles.chipActive]}
                    onPress={() => setCategoria(cat)}
                  >
                    <Text 
                      style={[styles.chipText, categoria === cat && styles.chipTextActive]}
                      numberOfLines={1}
                    >
                      {cat.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ))}
        </View>

        {/* Lote */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Lote / Potrero</Text>
          {listaLotes.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorScroll}>
              {listaLotes.map((l) => (
                <TouchableOpacity
                  key={l.id}
                  style={[styles.chip, loteId === l.id && styles.chipActive]}
                  onPress={() => setLoteId(l.id)}
                >
                  <Text style={[styles.chipText, loteId === l.id && styles.chipTextActive]}>
                    {l.nombre}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.chip, loteId === null && styles.chipActive]}
                onPress={() => setLoteId(null)}
              >
                <Text style={[styles.chipText, loteId === null && styles.chipTextActive]}>Sin Lote</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <View>
              <Text style={styles.noDataText}>No hay lotes configurados en esta finca.</Text>
              <TouchableOpacity onPress={() => router.push('/gestionar-lotes')} style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#065f46' }}>+ Crear lote / potrero</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Peso Inicial */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Peso Inicial (kg)</Text>
          <View style={styles.inputWrapper}>
            <Scale color="#64748b" size={20} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={pesoInicial}
              onChangeText={setPesoInicial}
              keyboardType="numeric"
              placeholder="Ej. 450"
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>

        {/* Sexo */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Sexo</Text>
          <View style={styles.selectorContainer}>
            <TouchableOpacity 
              style={[styles.selectorOption, sexo === 'F' && styles.selectorActive]} 
              onPress={() => setSexo('F')}
            >
              <Text style={[styles.selectorText, sexo === 'F' && styles.selectorTextActive]}>Hembra</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.selectorOption, sexo === 'M' && styles.selectorActive]} 
              onPress={() => setSexo('M')}
            >
              <Text style={[styles.selectorText, sexo === 'M' && styles.selectorTextActive]}>Macho</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Estado */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Estado</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorScroll}>
            {estadosOpciones.map((est) => (
              <TouchableOpacity
                key={est}
                style={[styles.chip, estado === est && styles.chipActive]}
                onPress={() => setEstado(est)}
              >
                <Text style={[styles.chipText, estado === est && styles.chipTextActive]}>
                  {est}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Madre / Padre */}
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Arete Madre</Text>
            <View style={styles.inputWrapper}>
              <Users color="#64748b" size={16} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={madreId}
                onChangeText={setMadreId}
                placeholder="Opcional"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Arete Padre</Text>
            <View style={styles.inputWrapper}>
              <Users color="#64748b" size={16} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={padreId}
                onChangeText={setPadreId}
                placeholder="Opcional"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>
        </View>

        {/* Notas */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Notas u Observaciones</Text>
          <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
            <FileText color="#64748b" size={20} style={[styles.inputIcon, { marginTop: 14 }]} />
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notas}
              onChangeText={setNotas}
              multiline
              numberOfLines={3}
              placeholder="Observaciones de salud o procedencia..."
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>

        {/* Botones de acción */}
        <TouchableOpacity 
          style={[styles.btnGuardar, guardando && styles.btnDeshabilitado]} 
          onPress={handleSave}
          disabled={guardando}
        >
          <Text style={styles.btnGuardarText}>
            {guardando ? 'Guardando...' : 'Actualizar Ficha'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.btnGuardar, styles.btnDelete, guardando && styles.btnDeshabilitado]} 
          onPress={handleDelete}
          disabled={guardando}
        >
          <Text style={styles.btnGuardarText}>Eliminar Animal</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Estilos (consistentes con CrearAnimalScreen) ─────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { padding: 24 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  groupLabel: { fontSize: 11, fontWeight: '600', color: '#64748b', marginBottom: 6, marginLeft: 2, fontStyle: 'italic' },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff',
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 16, paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: 50, color: '#1e293b', fontSize: 15 },
  textAreaWrapper: { alignItems: 'flex-start' },
  textArea: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  selectorScroll: { gap: 8, paddingVertical: 4 },
  chip: { 
    paddingHorizontal: 12, height: 36, borderRadius: 18, 
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', 
    justifyContent: 'center', alignItems: 'center' 
  },
  chipActive: { backgroundColor: '#065f46', borderColor: '#065f46' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  chipTextActive: { color: '#ffffff' },
  noDataText: { fontSize: 14, color: '#94a3b8', paddingVertical: 4 },
  selectorContainer: { flexDirection: 'row', gap: 12 },
  selectorOption: { 
    flex: 1, height: 48, borderRadius: 12, backgroundColor: '#ffffff', 
    borderWidth: 1, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' 
  },
  selectorActive: { backgroundColor: '#065f46', borderColor: '#065f46' },
  selectorText: { fontSize: 15, fontWeight: '600', color: '#475569' },
  selectorTextActive: { color: '#ffffff' },
  btnGuardar: {
    backgroundColor: '#065f46', height: 54, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginTop: 20,
    shadowColor: '#065f46', shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.2, shadowRadius: 5, elevation: 3,
  },
  btnDelete: { backgroundColor: '#ef4444', shadowColor: '#ef4444' },
  btnDeshabilitado: { backgroundColor: '#a7f3d0' },
  btnGuardarText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});