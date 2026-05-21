import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, FileText, Milk, Plus, Scale } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Conexión e Inserciones con Drizzle
import { and, desc, eq, sql } from 'drizzle-orm';
import { turnoLecheLabel, turnoLecheToCodigo, type TurnoLecheUi } from '../../constants/turnoLeche';
import { db } from '../../db/client';
import { animales, fincas, pesajes, produccionLeche } from '../../db/schema';
import { fechaLocalISO } from '../../utils/fecha';

export default function ProduccionScreen() {
  const router = useRouter();
  
  // Control de UI (Pestaña activa: 'leche' o 'pesaje')
  const [tabActiva, setTabActiva] = useState<'leche' | 'pesaje'>('leche');
  const [cargando, setCargando] = useState(true);
  const [fincaId, setFincaId] = useState<string | null>(null);
  const [fincaNombre, setFincaNombre] = useState('Cargando...');

  // Estados del Formulario
  const [arete, setArete] = useState('');
  const [valorMétrica, setValorMétrica] = useState(''); // Litros o Kilos
  const [turno, setTurno] = useState<TurnoLecheUi>('Mañana');
  const [condicionCorporal, setCondicionCorporal] = useState(''); // Exclusivo Pesaje (1-5)
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Estados para Listados de auditoría rápida (Últimos 5 del día)
  const [ultimosRegistros, setUltimosRegistros] = useState<any[]>([]);

  // Obtener la finca activa y precargar registros históricos del día
  const cargarDatosPantalla = useCallback(async () => {
    try {
      setCargando(true);
      const actualFinca = await db.select().from(fincas).where(eq(fincas.activa, 1)).limit(1);
      
      if (actualFinca.length > 0) {
        const fId = actualFinca[0].id;
        setFincaId(fId);
        setFincaNombre(actualFinca[0].nombre);

        const fechaHoy = fechaLocalISO();

        if (tabActiva === 'leche') {
          const registrosLeche = await db
            .select({
              id: produccionLeche.id,
              arete: animales.areteCodigo,
              litros: produccionLeche.litros,
              turno: produccionLeche.turno,
            })
            .from(produccionLeche)
            .innerJoin(animales, eq(produccionLeche.animalId, animales.id))
            .where(
              sql`${animales.fincaId} = ${fId} AND ${produccionLeche.fecha} = ${fechaHoy}`
            )
            .orderBy(desc(produccionLeche.id))
            .limit(5);
          setUltimosRegistros(registrosLeche);
        } else {
          const registrosPesajes = await db
            .select({
              id: pesajes.id,
              arete: animales.areteCodigo,
              peso: pesajes.peso,
              cc: pesajes.condicionCorporal,
            })
            .from(pesajes)
            .innerJoin(animales, eq(pesajes.animalId, animales.id))
            .where(
              sql`${animales.fincaId} = ${fId} AND ${pesajes.fechaPesaje} = ${fechaHoy}`
            )
            .orderBy(desc(pesajes.id))
            .limit(5);
          setUltimosRegistros(registrosPesajes);
        }
      } else {
        setFincaId(null);
        setFincaNombre('Sin Finca Activa');
        setUltimosRegistros([]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setCargando(false);
    }
  }, [tabActiva]);

  useFocusEffect(
    useCallback(() => {
      cargarDatosPantalla();
    }, [cargarDatosPantalla])
  );

  const handleGuardarRegistro = async () => {
    if (!fincaId) {
      Alert.alert('Finca No Detectada', 'Debes activar una finca desde los ajustes antes de inyectar datos.');
      return;
    }

    if (!arete.trim() || !valorMétrica.trim()) {
      Alert.alert('Campos vacíos', 'El código de arete y la medición numérica son obligatorios.');
      return;
    }

    const valorNumerico = parseFloat(valorMétrica);
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      Alert.alert('Dato inválido', 'Por favor ingresa un número válido mayor a 0.');
      return;
    }

    try {
      setGuardando(true);

      // 1. Validar si el animal existe específicamente en la finca activa actual
      const animalExiste = await db
        .select()
        .from(animales)
        .where(
          sql`${animales.fincaId} = ${fincaId} AND ${animales.areteCodigo} = ${arete.trim().toUpperCase()}`
        )
        .limit(1);

      if (animalExiste.length === 0) {
        Alert.alert('No encontrado', `El arete #${arete.toUpperCase()} no existe en el inventario de la finca actual (${fincaNombre}).`);
        setGuardando(false);
        return;
      }

      const animal = animalExiste[0];
      const fechaHoy = fechaLocalISO();

      // 2. Insertar según la pestaña activa
      if (tabActiva === 'leche') {
        const turnoCodigo = turnoLecheToCodigo(turno);
        const duplicado = await db
          .select({ id: produccionLeche.id })
          .from(produccionLeche)
          .where(
            and(
              eq(produccionLeche.animalId, animal.id),
              eq(produccionLeche.fecha, fechaHoy),
              eq(produccionLeche.turno, turnoCodigo)
            )
          )
          .limit(1);

        if (duplicado.length > 0) {
          Alert.alert(
            'Registro duplicado',
            `Ya existe una pesada de leche para este animal hoy en turno ${turnoLecheLabel(turnoCodigo)}.`
          );
          setGuardando(false);
          return;
        }

        await db.insert(produccionLeche).values({
          id: await getRandomUUID(), // Inyectado usando expo-crypto si lo requieres, o autogenerado según tu app
          animalId: animal.id,
          fecha: fechaHoy,
          litros: valorNumerico,
          turno: turnoCodigo,
          notas: notas.trim() || null,
        });
      } else {
        const ccNum = parseInt(condicionCorporal);
        await db.insert(pesajes).values({
          id: await getRandomUUID(),
          animalId: animal.id,
          peso: valorNumerico,
          fechaPesaje: fechaHoy,
          condicionCorporal: isNaN(ccNum) ? null : ccNum,
          notes: notas.trim() || null, // Mapeado a 'notes' por la compatibilidad de tu schema
        });
      }

      setArete('');
      setValorMétrica('');
      setCondicionCorporal('');
      setNotas('');
      Alert.alert('Guardado', 'Registro almacenado localmente con éxito.');
      cargarDatosPantalla();

    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Ocurrió un error al guardar en la base de datos.');
    } finally {
      setGuardando(false);
    }
  };

  // Helper auxiliar para mantener la consistencia de inserciones por IDs en la app
  async function getRandomUUID() {
    const Crypto = require('expo-crypto');
    return Crypto.randomUUID();
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#1e293b" size={24} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={styles.headerTitle}>Producción y Pesaje</Text>
          <Text style={styles.headerSubtitle}>{fincaNombre}</Text>
        </View>
        <View style={styles.spacer} />
      </View>

      {/* TABS SELECTORAS */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, tabActiva === 'leche' && styles.tabActiva]}
          onPress={() => setTabActiva('leche')}
        >
          <Milk color={tabActiva === 'leche' ? '#065f46' : '#64748b'} size={20} />
          <Text style={[styles.tabText, tabActiva === 'leche' && styles.tabTextActiva]}>Control Lechero</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, tabActiva === 'pesaje' && styles.tabActiva]}
          onPress={() => setTabActiva('pesaje')}
        >
          <Scale color={tabActiva === 'pesaje' ? '#065f46' : '#64748b'} size={20} />
          <Text style={[styles.tabText, tabActiva === 'pesaje' && styles.tabTextActiva]}>Pesaje de Carne</Text>
        </TouchableOpacity>
      </View>

      {/* FORMULARIO DE CAPTURA RÁPIDA */}
      <View style={styles.cardForm}>
        <Text style={styles.formTitle}>
          {tabActiva === 'leche' ? 'Añadir Pesada de Leche' : 'Registrar Nuevo Pesaje'}
        </Text>

        {/* INPUT: ARETE */}
        <Text style={styles.label}>Código del Arete</Text>
        <TextInput 
          style={styles.input}
          placeholder="Ej. BUF-042, 115"
          placeholderTextColor="#94a3b8"
          autoCapitalize="characters"
          value={arete}
          onChangeText={setArete}
        />

        {/* INPUT DINÁMICO: LITROS O PESO */}
        <Text style={styles.label}>
          {tabActiva === 'leche' ? 'Cantidad de Litros' : 'Peso Actual (Kg)'}
        </Text>
        <TextInput 
          style={styles.input}
          placeholder={tabActiva === 'leche' ? 'Ej. 14.5' : 'Ej. 420'}
          placeholderTextColor="#94a3b8"
          keyboardType="numeric"
          value={valorMétrica}
          onChangeText={setValorMétrica}
        />

        {/* CAMPOS CONDICIONALES LECHE: TURNO */}
        {tabActiva === 'leche' && (
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.label}>Ordeño / Turno</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['Mañana', 'Tarde', 'Noche'] as TurnoLecheUi[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.selectorBtn, turno === t && styles.selectorBtnActivo]}
                  onPress={() => setTurno(t)}
                >
                  <Text style={[styles.selectorBtnText, turno === t && styles.selectorBtnTextActivo]}>
                    {t === 'Mañana' ? 'AM' : t === 'Tarde' ? 'PM' : 'Noche'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* CAMPOS CONDICIONALES PESAJE: CONDICIÓN CORPORAL */}
        {tabActiva === 'pesaje' && (
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.label}>Condición Corporal (Escala 1 al 5)</Text>
            <TextInput 
              style={styles.input}
              placeholder="Opcional (Ej. 3 o 4)"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              maxLength={1}
              value={condicionCorporal}
              onChangeText={setCondicionCorporal}
            />
          </View>
        )}

        {/* INPUT: NOTAS */}
        <Text style={styles.label}>Observaciones / Notas</Text>
        <TextInput 
          style={[styles.input, { height: 70, paddingTop: 10 }]}
          placeholder="Ej. Mastitis leve, post-parto, bosta líquida..."
          placeholderTextColor="#94a3b8"
          multiline
          value={notas}
          onChangeText={setNotas}
        />

        {/* BOTÓN SUBMIT */}
        <TouchableOpacity 
          style={[styles.btnGuardar, guardando && { backgroundColor: '#a7f3d0' }]}
          onPress={handleGuardarRegistro}
          disabled={guardando}
        >
          <Plus color="#fff" size={20} style={{ marginRight: 6 }} />
          <Text style={styles.btnGuardarText}>{guardando ? 'Guardando...' : 'Inyectar Datos'}</Text>
        </TouchableOpacity>
      </View>

      {/* AUDITORÍA RÁPIDA (ÚLTIMOS REGISTROS) */}
      <View style={styles.auditoriaContainer}>
        <Text style={styles.sectionTitle}>Últimos Registros Guardados Hoy</Text>
        {cargando ? (
          <ActivityIndicator size="small" color="#065f46" style={{ marginTop: 12 }} />
        ) : ultimosRegistros.length === 0 ? (
          <Text style={styles.txtVacio}>No has ingresado registros en esta sección hoy.</Text>
        ) : (
          getFiltradosPorTurnoU()
        )}
      </View>
    </ScrollView>
  );

  function getFiltradosPorTurnoU() {
    return ultimosRegistros.map((reg) => (
      <View key={reg.id} style={styles.rowAuditoria}>
        <View style={styles.rowInfoLeft}>
          <FileText color="#64748b" size={16} />
          <Text style={styles.txtAreteAuditoria}>Arete #{reg.arete}</Text>
        </View>
        <Text style={styles.txtDatoAuditoria}>
          {tabActiva === 'leche' ? `${reg.litros} Lts (${turnoLecheLabel(reg.turno)})` : `${reg.peso} Kg`}
        </Text>
      </View>
    ));
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 60, paddingBottom: 16, paddingHorizontal: 16,
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderColor: '#e2e8f0',
  },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  headerSubtitle: { fontSize: 12, color: '#065f46', fontWeight: '600', marginTop: 2 },
  spacer: { width: 40 },
  tabsContainer: { flexDirection: 'row', padding: 16, gap: 12 },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#ffffff', paddingVertical: 12, borderRadius: 16,
    borderWidth: 1, borderColor: '#e2e8f0'
  },
  tabActiva: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tabTextActiva: { color: '#065f46', fontWeight: '700' },
  cardForm: { backgroundColor: '#ffffff', marginHorizontal: 16, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#f1f5f9', elevation: 1 },
  formTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, height: 48, paddingHorizontal: 14, color: '#1e293b', marginBottom: 16, fontSize: 14 },
  selectorBtn: { flex: 1, height: 44, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
  selectorBtnActivo: { backgroundColor: '#065f46', borderColor: '#065f46' },
  selectorBtnText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  selectorBtnTextActivo: { color: '#ffffff', fontWeight: '700' },
  btnGuardar: { backgroundColor: '#065f46', height: 50, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  btnGuardarText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  auditoriaContainer: { padding: 20 },
  sectionTitle: { color: '#94a3b8', fontWeight: '700', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 },
  txtVacio: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', paddingLeft: 4 },
  rowAuditoria: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 14, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  rowInfoLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  txtAreteAuditoria: { fontSize: 14, fontWeight: '700', color: '#334155' },
  txtDatoAuditoria: { fontSize: 14, fontWeight: '700', color: '#065f46' }
});