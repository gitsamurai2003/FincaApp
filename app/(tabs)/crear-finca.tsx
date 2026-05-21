import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { ArrowLeft, Landmark, MapPin } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../../db/client';
import { fincas } from '../../db/schema';

export default function CrearFincaScreen() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [guardando, setGuardando] = useState(false);

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      Alert.alert('Faltan Datos', 'El nombre de la finca es obligatorio.');
      return;
    }

    try {
      setGuardando(true);
      
      // 1. Verificamos atómicamente si el usuario ya tiene fincas registradas
      const fincasExistentes = await db.select().from(fincas);
      const esPrimeraFinca = fincasExistentes.length === 0;

      // 2. Insertamos el registro incluyendo el estado de activación correspondiente
      await db.insert(fincas).values({
        id: Crypto.randomUUID(),
        nombre: nombre.trim(),
        ubicacion: ubicacion.trim() || null,
        activa: esPrimeraFinca ? 1 : 0, // Si está vacía la tabla, se activa de una vez
      });

      Alert.alert('¡Éxito!', 'Finca registrada correctamente.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo guardar la finca en el almacenamiento local.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      {/* BARRA SUPERIOR / HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#1e293b" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nueva Finca</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.content}>
        <Text style={styles.instructions}>
          Ingresa los datos del nuevo predio o proyecto para comenzar a gestionar su inventario local.
        </Text>

        {/* INPUT: NOMBRE */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nombre de la Finca / Unidad de Producción</Text>
          <View style={styles.inputWrapper}>
            <Landmark color="#64748b" size={20} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Ej. Hacienda El Toro, Finca La Victoria"
              placeholderTextColor="#94a3b8"
              value={nombre}
              onChangeText={setNombre}
            />
          </View>
        </View>

        {/* INPUT: UBICACIÓN */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ubicación / Sector</Text>
          <View style={styles.inputWrapper}>
            <MapPin color="#64748b" size={20} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Ej. Machiques, Perijá, Km 40"
              placeholderTextColor="#94a3b8"
              value={ubicacion}
              onChangeText={setUbicacion}
            />
          </View>
        </View>

        {/* BOTÓN DE ACCIÓN */}
        <TouchableOpacity 
          style={[styles.btnGuardar, guardando && styles.btnDeshabilitado]} 
          onPress={handleGuardar}
          disabled={guardando}
        >
          <Text style={styles.btnGuardarText}>
            {guardando ? 'Guardando...' : 'Registrar Finca'}
          </Text>
        </TouchableOpacity>
      </View>
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
  },
  backButton: { 
    padding: 8, 
    borderRadius: 12, 
    backgroundColor: '#f1f5f9', 
    width: 40, 
    height: 40, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  spacer: { width: 40 },
  content: { flex: 1, padding: 24 },
  instructions: { color: '#64748b', fontSize: 14, marginBottom: 32, lineHeight: 20 },
  inputGroup: { marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrapper: {
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#ffffff',
    borderWidth: 1, 
    borderColor: '#cbd5e1', 
    borderRadius: 16, 
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: 50, color: '#1e293b', fontSize: 15 },
  btnGuardar: {
    backgroundColor: '#065f46', 
    height: 54, 
    borderRadius: 16,
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: 16,
    shadowColor: '#065f46', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 5, 
    elevation: 3,
  },
  btnDeshabilitado: { backgroundColor: '#a7f3d0' },
  btnGuardarText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});