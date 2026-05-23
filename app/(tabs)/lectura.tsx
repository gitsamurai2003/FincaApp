import { useRouter } from 'expo-router';
import { BookOpen, ChevronRight } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LISTA_ANIMALES } from '../../constants/enciclopedia';

export default function LecturaScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>
      <View style={styles.header}>
        <View style={styles.iconBg}>
          <BookOpen color="#1e293b" size={24} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Biblioteca</Text>
          <Text style={styles.sub}>Manual holístico de especies</Text>
        </View>
      </View>

      <View style={styles.listContainer}>
        {LISTA_ANIMALES.map((animal) => (
          <TouchableOpacity
            key={animal.id}
            style={styles.card}
            onPress={() =>
              router.push({ pathname: '/animal/[id]', params: { id: String(animal.id) } })
            }
          >
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{animal.nombre}</Text>
              <Text style={styles.cardDesc} numberOfLines={2}>
                {animal.descripcion}
              </Text>
            </View>
            <ChevronRight color="#cbd5e1" size={20} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  iconBg: { padding: 10, borderRadius: 12, backgroundColor: '#f1f5f9' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  sub: { fontSize: 13, color: '#065f46', fontWeight: '500', marginTop: 2 },
  listContainer: { padding: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardContent: { flex: 1, paddingRight: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#64748b', lineHeight: 18 },
});