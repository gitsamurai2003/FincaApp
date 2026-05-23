import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Dna, HeartPulse, ShieldCheck, Sprout } from 'lucide-react-native';
import React from 'react';
import {
  Image, ScrollView, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { ENCICLOPEDIA } from '../../constants/enciclopedia';

export default function AnimalDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const animal = ENCICLOPEDIA[id as string];
  const [imageError, setImageError] = React.useState(false);

  if (!animal) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Animal no encontrado</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButtonSmall}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const Seccion = ({ titulo, contenido, Icono }: { titulo: string, contenido: string, Icono: any }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Icono color="#d97706" size={20} />
        <Text style={styles.sectionTitle}>{titulo}</Text>
      </View>
      <Text style={styles.sectionText}>{contenido}</Text>
    </View>
  );

  // Determinar si usar imagen local (require) o remota (uri)
  const getImageSource = () => {
    if (!animal.imagen || imageError) return null;
    
    // Si es un require() de Expo, ya es un objeto válido para Image
    if (typeof animal.imagen === 'number') {
      return animal.imagen;
    }
    // Si es una URL string
    return { uri: animal.imagen };
  };

  const imageSource = getImageSource();

  return (
    
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
              <Stack.Screen options={{ headerShown: false }} />
        
      {/* Header con imagen de fondo opcional */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{animal.nombre}</Text>
      </View>

      {/* Imagen principal del animal */}
      {imageSource ? (
        <View style={styles.imageContainer}>
          <Image
            source={imageSource}
            style={styles.animalImage}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
          {/* Overlay degradado para mejor legibilidad del título si se superpone */}
          <View style={styles.imageOverlay} />
        </View>
      ) : (
        /* Fallback: mostrar icono grande si no hay imagen */
        <View style={styles.iconFallback}>
          <Text style={styles.fallbackIcon}>🐄</Text>
          <Text style={styles.fallbackText}>Imagen no disponible</Text>
        </View>
      )}

      <View style={styles.content}>
        <Text style={styles.descripcion}>{animal.descripcion}</Text>
        
        {/* Info rápida: clima y peso (si existen) */}
        {(animal.climaIdeal || animal.pesoPromedio) && (
          <View style={styles.quickInfo}>
            {animal.climaIdeal && (
              <View style={styles.quickInfoItem}>
                <Text style={styles.quickInfoLabel}>Clima ideal</Text>
                <Text style={styles.quickInfoValue}>{animal.climaIdeal}</Text>
              </View>
            )}
            {animal.pesoPromedio && (
              <View style={styles.quickInfoItem}>
                <Text style={styles.quickInfoLabel}>Peso promedio</Text>
                <Text style={styles.quickInfoValue}>{animal.pesoPromedio}</Text>
              </View>
            )}
          </View>
        )}
        
        <Seccion titulo="Alimentación" contenido={animal.alimentacion} Icono={Sprout} />
        <Seccion titulo="Reproducción" contenido={animal.reproduccion} Icono={HeartPulse} />
        <Seccion titulo="Razas y Variedades" contenido={animal.variedades} Icono={Dna} />
        <Seccion titulo="Aprovechamiento Holístico" contenido={animal.aprovechamiento} Icono={ShieldCheck} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontSize: 16, color: '#ef4444', marginBottom: 16, textAlign: 'center' },
  backButtonSmall: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#065f46', borderRadius: 12 },
  backButtonText: { color: '#fff', fontWeight: '600' },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#065f46',
  },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', marginRight: 16 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff', flex: 1 },
  
  /* Estilos para la imagen */
  imageContainer: {
    height: 220,
    width: '100%',
    backgroundColor: '#e2e8f0',
    position: 'relative',
  },
  animalImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.2)',  // Overlay sutil
  },
  
  /* Fallback cuando no hay imagen */
  iconFallback: {
    height: 220,
    width: '100%',
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  fallbackIcon: { fontSize: 64, marginBottom: 8 },
  fallbackText: { fontSize: 12, color: '#64748b' },
  
  content: { padding: 16 },
  descripcion: { fontSize: 15, color: '#475569', lineHeight: 24, marginBottom: 24, paddingHorizontal: 4 },
  
  /* Info rápida */
  quickInfo: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  quickInfoItem: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  quickInfoLabel: { fontSize: 10, color: '#64748b', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  quickInfoValue: { fontSize: 13, color: '#1e293b', fontWeight: '500' },
  
  /* Secciones */
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginLeft: 8 },
  sectionText: { fontSize: 14, color: '#64748b', lineHeight: 22 },
});