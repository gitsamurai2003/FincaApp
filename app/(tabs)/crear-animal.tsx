// screens/CrearAnimalScreen.tsx
import { eq } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, Calendar, FileText, Hash, Scale, Tag, Users, Zap } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  CATEGORIAS_AGRUPADAS,
  type CategoriaAnimal,
  categoriaSugeridaPorEspecie,
} from '../../constants/categoriasAnimal';
import { db } from '../../db/client';
import { animales, especies, fincas, lotes, razas } from '../../db/schema';
import { areteExisteEnFinca } from '../../db/validarArete';
import { fechaLocalISO } from '../../utils/fecha';

interface EspecieDB {
  id: number;
  nombre: string;
}

interface RazaDB {
  id: number;
  especieId: number;
  nombre: string;
}

interface LoteDB {
  id: string;
  nombre: string;
}

export default function CrearAnimalScreen() {
  const router = useRouter();
 
  const areteInputRef = useRef<TextInput>(null);

  const [listaEspecies, setListaEspecies] = useState<EspecieDB[]>([]);
  const [listaRazas, setListaRazas] = useState<RazaDB[]>([]);
  const [listaLotes, setListaLotes] = useState<LoteDB[]>([]);
  const [razasFiltradas, setRazasFiltradas] = useState<RazaDB[]>([]);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);

  const [areteCodigo, setAreteCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState(fechaLocalISO());
  const [pesoInicial, setPesoInicial] = useState('');
  const [proposito, setProposito] = useState('Doble_Proposito');
  const [notas, setNotas] = useState('');
  const [sexo, setSexo] = useState<'F' | 'M'>('F');
  const [especieSeleccionada, setEspecieSeleccionada] = useState<number | null>(null);
  const [razaSeleccionada, setRazaSeleccionada] = useState<number | null>(null);
  const [loteSeleccionado, setLoteSeleccionado] = useState<string | null>(null);
  const [madreId, setMadreId] = useState('');
  const [padreId, setPadreId] = useState('');
 
  const [fincaActivaId, setFincaActivaId] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<CategoriaAnimal>('Becerra');
  
  // ⚡ Estados Modo Rápido y Guardado
  const [guardando, setGuardando] = useState(false);
  const [modoRapido, setModoRapido] = useState(false);
  const [guardadosHoy, setGuardadosHoy] = useState(0);

  const propositosOpciones = ['Leche', 'Carne', 'Doble_Proposito', 'Trabajo', 'Genetica_Pura'];

  // 1. Foco e Inicialización
  useFocusEffect(
    useCallback(() => {
      async function cargarDatosFincaYCatalogos() {
        try {
          const fincaActiva = await db.select().from(fincas).where(eq(fincas.activa, 1)).limit(1);
          if (fincaActiva.length === 0) {
            Alert.alert('Atención', 'No hay ninguna finca activa seleccionada. Por favor activa una finca primero.');
            router.back();
            return;
          }
          
          const fId = fincaActiva[0].id;
          setFincaActivaId(fId);

          const [dbEspecies, dbRazas, dbLotes] = await Promise.all([
            db.select().from(especies),
            db.select().from(razas),
            db.select().from(lotes).where(eq(lotes.fincaId, fId))
          ]);

          setListaEspecies(dbEspecies);
          setListaRazas(dbRazas);
          setListaLotes(dbLotes);

          if (dbEspecies.length > 0 && especieSeleccionada === null) {
            const primerEspecieId = dbEspecies[0].id;
            setEspecieSeleccionada(primerEspecieId);

            const filtradasIniciales = dbRazas.filter(r => Number(r.especieId) === Number(primerEspecieId));
            setRazasFiltradas(filtradasIniciales);

            if (filtradasIniciales.length > 0) {
              setRazaSeleccionada(filtradasIniciales[0].id);
            }
            
            const sugerida = categoriaSugeridaPorEspecie(dbEspecies[0].nombre, sexo);
            setCategoria(sugerida);
          }
        } catch (error) {
          console.error(error);
          Alert.alert('Error', 'No se pudieron recuperar los catálogos relacionales.');
        } finally {
          setCargandoCatalogos(false);
        }
      }

      cargarDatosFincaYCatalogos();
    }, [sexo])
  );

  // 2. Reactividad al cambiar de especie
  useEffect(() => {
    if (especieSeleccionada !== null && listaRazas.length > 0) {
      const filtradas = listaRazas.filter(r => Number(r.especieId) === Number(especieSeleccionada));
      setRazasFiltradas(filtradas);
      
      const yaEstaSeleccionadaValida = filtradas.some(r => r.id === razaSeleccionada);
      if (!yaEstaSeleccionadaValida) {
        setRazaSeleccionada(filtradas.length > 0 ? filtradas[0].id : null);
      }
      
      const esp = listaEspecies.find((e) => Number(e.id) === Number(especieSeleccionada));
      if (esp) {
        const sugerida = categoriaSugeridaPorEspecie(esp.nombre, sexo);
        setCategoria(sugerida);
      }
    }
  }, [especieSeleccionada, listaRazas]); 

  const obtenerNombreEspecieActual = (): string => {
    const esp = listaEspecies.find((e) => e.id === especieSeleccionada);
    return esp ? esp.nombre.toLowerCase() : '';
  };

  const validarAretesPadres = async (): Promise<boolean> => {
    if (!fincaActivaId) return false;
    const propio = areteCodigo.trim().toUpperCase();
    if (madreId.trim()) {
      const m = madreId.trim().toUpperCase();
      if (m === propio) {
        Alert.alert('Arete inválido', 'El arete de la madre no puede ser igual al del animal.');
        return false;
      }
      if (!(await areteExisteEnFinca(fincaActivaId, m))) {
        Alert.alert('Madre no encontrada', `No hay animal con arete ${m} en esta finca.`);
        return false;
      }
    }
    if (padreId.trim()) {
      const p = padreId.trim().toUpperCase();
      if (p === propio) {
        Alert.alert('Arete inválido', 'El arete del padre no puede ser igual al del animal.');
        return false;
      }
      if (!(await areteExisteEnFinca(fincaActivaId, p))) {
        Alert.alert('Padre no encontrado', `No hay animal con arete ${p} en esta finca.`);
        return false;
      }
    }
    return true;
  };

  // ── Guardar y Lógica del Modo Rápido ──
  const handleGuardar = async () => {
    if (!fincaActivaId) {
      Alert.alert('Error', 'No se detectó una finca activa para asociar este animal.');
      return;
    }

    if (!areteCodigo.trim()) {
      Alert.alert('Faltan Datos', 'El código del arete es obligatorio.');
      return;
    }

    if (especieSeleccionada === null || razaSeleccionada === null) {
      Alert.alert('Faltan Datos', 'Debes seleccionar una especie y una raza válidas.');
      return;
    }

    if (!fechaNacimiento.trim() || fechaNacimiento.length !== 10) {
      Alert.alert('Dato Inválido', 'Por favor ingresa una fecha válida en formato YYYY-MM-DD.');
      return;
    }

    let pesoNum: number | null = parseFloat(pesoInicial);
    if (pesoInicial.trim() !== '') {
      if (isNaN(pesoNum) || pesoNum <= 0) {
        Alert.alert('Dato Inválido', 'Por favor ingresa un peso inicial válido.');
        return;
      }
    } else {
      pesoNum = null;
    }

    if (!(await validarAretesPadres())) return;

    // Verificar si el arete ya está en uso antes de guardarlo en BD (Extra capa de seguridad)
    if (await areteExisteEnFinca(fincaActivaId, areteCodigo.trim().toUpperCase())) {
      Alert.alert('Arete Duplicado', `El arete ${areteCodigo.trim().toUpperCase()} ya está registrado en esta finca.`);
      return;
    }

    try {
      setGuardando(true);

      const values: any = {
        id: Crypto.randomUUID(),
        fincaId: fincaActivaId,
        especieId: especieSeleccionada,
        razaId: razaSeleccionada,
        loteId: loteSeleccionado,
        areteCodigo: areteCodigo.trim().toUpperCase(),
        nombre: nombre.trim() || null,
        fechaNacimiento: fechaNacimiento.trim(),
        sexo: sexo,
        pesoInicial: pesoNum,
        categoria: categoria as any,
        proposito: proposito as any,
        estado: 'Activo',
        madreId: madreId.trim().toUpperCase() || null,
        padreId: padreId.trim().toUpperCase() || null,
        notas: notas.trim() || null,
      };

      await db.insert(animales).values(values);

      setGuardadosHoy((prev) => prev + 1);

      if (modoRapido) {
        // En modo rápido mantenemos fecha, lote, especie y categoria por conveniencia para registro en lotes.
        // Solo limpiamos los datos "individuales":
        setAreteCodigo('');
        setNombre('');
        setPesoInicial('');
        setMadreId('');
        setPadreId('');
        setNotas('');
        
        // Devolvemos el foco para tipeo inmediato
        setTimeout(() => {
          areteInputRef.current?.focus();
        }, 100);
      } else {
        Alert.alert('¡Éxito!', `Animal con arete ${areteCodigo.toUpperCase()} registrado correctamente.`, [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar el animal. Verifica tu conexión a la base de datos.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargandoCatalogos) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#065f46" />
      </View>
    );
  }

  const especieActualKey = obtenerNombreEspecieActual();
  const gruposCategoriasFiltrados = Object.entries(CATEGORIAS_AGRUPADAS).filter(([grupo]) => {
    const grupoLimpio = grupo
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z\s]/g, ' ');      

    if (especieActualKey === 'ovino') {
      return grupoLimpio.includes('ovino') && !grupoLimpio.includes('bovino');
    }

    if (especieActualKey === 'bovino') {
      return grupoLimpio.includes('bovino');
    }

    return grupoLimpio.includes(especieActualKey);
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#1e293b" size={22} />
        </TouchableOpacity>
        
        <View style={{ flex: 1, paddingLeft: 12 }}>
          <Text style={styles.headerTitle}>Nuevo Animal</Text>
          {modoRapido && guardadosHoy > 0 && (
            <Text style={styles.headerBadge}>⚡ {guardadosHoy} registrados hoy</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.modoRapidoBtn, modoRapido && styles.modoRapidoBtnOn]}
          onPress={() => setModoRapido((v) => !v)}
        >
          <Zap size={14} color={modoRapido ? '#fff' : '#065f46'} />
          <Text style={[styles.modoRapidoText, modoRapido && { color: '#fff' }]}>Rápido</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
       
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Código del Arete / Identificación</Text>
          <View style={styles.inputWrapper}>
            <Hash color="#64748b" size={20} style={styles.inputIcon} />
            <TextInput
              ref={areteInputRef}
              style={styles.input}
              placeholder="Ej. BUF-0102"
              placeholderTextColor="#94a3b8"
              value={areteCodigo}
              onChangeText={setAreteCodigo}
              autoCapitalize="characters"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nombre (Opcional)</Text>
          <View style={styles.inputWrapper}>
            <Tag color="#64748b" size={20} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Ej. Mariposa"
              placeholderTextColor="#94a3b8"
              value={nombre}
              onChangeText={setNombre}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Fecha de Nacimiento / Edad Aparente</Text>
          <View style={styles.inputWrapper}>
            <Calendar color="#64748b" size={20} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94a3b8"
              value={fechaNacimiento}
              onChangeText={setFechaNacimiento}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Especie</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorScroll}>
            {listaEspecies.map((esp) => (
              <TouchableOpacity
                key={esp.id}
                style={[styles.chip, especieSeleccionada === esp.id && styles.chipActive]}
                onPress={() => setEspecieSeleccionada(esp.id)}
              >
                <Text style={[styles.chipText, especieSeleccionada === esp.id && styles.chipTextActive]}>
                  {esp.nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Raza</Text>
          {razasFiltradas.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorScroll}>
              {razasFiltradas.map((raz) => (
                <TouchableOpacity
                  key={raz.id}
                  style={[styles.chip, razaSeleccionada === raz.id && styles.chipActive]}
                  onPress={() => setRazaSeleccionada(raz.id)}
                >
                  <Text style={[styles.chipText, razaSeleccionada === raz.id && styles.chipTextActive]}>
                    {raz.nombre}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.noDataText}>No hay razas registradas para esta especie.</Text>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Categoría zootécnica</Text>
          {gruposCategoriasFiltrados.length > 0 ? (
            gruposCategoriasFiltrados.map(([grupo, opciones]) => (
              <View key={grupo} style={{ marginBottom: 10 }}>
                <Text style={styles.groupLabel}>{grupo.replace('_', ' & ')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorScroll}>
                  {opciones.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.chip, categoria === cat && styles.chipActive]}
                      onPress={() => setCategoria(cat)}
                    >
                      <Text style={[styles.chipText, categoria === cat && styles.chipTextActive]}>
                        {cat.replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>Selecciona una especie para ver sus categorías.</Text>
          )}
        </View>

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

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Lote / Potrero</Text>
          {listaLotes.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorScroll}>
              {listaLotes.map((l) => (
                <TouchableOpacity
                  key={l.id}
                  style={[styles.chip, loteSeleccionado === l.id && styles.chipActive]}
                  onPress={() => setLoteSeleccionado(l.id)}
                >
                  <Text style={[styles.chipText, loteSeleccionado === l.id && styles.chipTextActive]}>
                    {l.nombre}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.chip, loteSeleccionado === null && styles.chipActive]}
                onPress={() => setLoteSeleccionado(null)}
              >
                <Text style={[styles.chipText, loteSeleccionado === null && styles.chipTextActive]}>
                  Sin Lote
                </Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <View>
              <Text style={styles.noDataText}>No hay lotes configurados en esta finca.</Text>
              <TouchableOpacity onPress={() => router.push('/gestionar-lotes')} style={styles.linkLotes}>
                <Text style={styles.linkLotesText}>+ Crear lote / potrero</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Peso Inicial (Kg) Opcional</Text>
          <View style={styles.inputWrapper}>
            <Scale color="#64748b" size={20} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Ej. 450"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={pesoInicial}
              onChangeText={setPesoInicial}
            />
          </View>
        </View>

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

        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Arete Madre</Text>
            <View style={styles.inputWrapper}>
              <Users color="#64748b" size={16} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Opcional"
                placeholderTextColor="#94a3b8"
                value={madreId}
                onChangeText={setMadreId}
                autoCapitalize="characters"
              />
            </View>
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Arete Padre</Text>
            <View style={styles.inputWrapper}>
              <Users color="#64748b" size={16} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Opcional"
                placeholderTextColor="#94a3b8"
                value={padreId}
                onChangeText={setPadreId}
                autoCapitalize="characters"
              />
            </View>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Notas u Observaciones</Text>
          <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
            <FileText color="#64748b" size={20} style={[styles.inputIcon, { marginTop: 14 }]} />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Observaciones de salud o procedencia..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
              value={notas}
              onChangeText={setNotas}
            />
          </View>
        </View>

        {modoRapido && (
          <View style={styles.hintCard}>
            <Zap size={14} color="#065f46" />
            <Text style={styles.hintText}>
              Modo rápido activo: Solo se limpiarán datos únicos (Arete, nombre, peso, padres) para registrar varios animales ágilmente en el mismo lote y categoría.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.btnGuardar, guardando && styles.btnDeshabilitado]}
          onPress={handleGuardar}
          disabled={guardando}
        >
          <Text style={styles.btnGuardarText}>
            {guardando ? 'Guardando...' : modoRapido ? '⚡ Registrar y Continuar' : 'Registrar Animal'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  headerBadge: { fontSize: 11, color: '#065f46', fontWeight: '600', marginTop: 2 },
  modoRapidoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#065f46',
    backgroundColor: '#ecfdf5',
  },
  modoRapidoBtnOn: { backgroundColor: '#065f46', borderColor: '#065f46' },
  modoRapidoText: { fontSize: 12, fontWeight: '700', color: '#065f46' },
  spacer: { width: 40 },
  scrollContent: { flex: 1, padding: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: 48, color: '#1e293b', fontSize: 14 },
  textAreaWrapper: { alignItems: 'flex-start' },
  textArea: { height: 70, paddingTop: 12, textAlignVertical: 'top' },
  selectorScroll: { gap: 8, paddingVertical: 4 },
  chip: { paddingHorizontal: 16, height: 38, borderRadius: 20, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
  chipActive: { backgroundColor: '#065f46', borderColor: '#065f46' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  chipTextActive: { color: '#ffffff' },
  noDataText: { fontSize: 13, color: '#94a3b8', paddingVertical: 4 },
  linkLotes: { marginTop: 8, alignSelf: 'flex-start' },
  linkLotesText: { fontSize: 14, fontWeight: '700', color: '#065f46' },
  groupLabel: { fontSize: 11, fontWeight: '600', color: '#64748b', marginBottom: 6, fontStyle: 'italic' },
  selectorContainer: { flexDirection: 'row', gap: 12 },
  selectorOption: { flex: 1, height: 44, borderRadius: 12, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
  selectorActive: { backgroundColor: '#065f46', borderColor: '#065f46' },
  selectorText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  selectorTextActive: { color: '#ffffff' },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#ecfdf5',
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  hintText: { flex: 1, fontSize: 12, color: '#065f46', lineHeight: 17 },
  btnGuardar: {
    backgroundColor: '#065f46',
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#065f46',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  btnDeshabilitado: { opacity: 0.6 },
  btnGuardarText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});