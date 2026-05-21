import { eq } from 'drizzle-orm';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Calendar, FileText, Hash, Heart, Info, Milk, Scale, Stethoscope, Tag, Users } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../db/client';
import { animales, especies, lotes, razas } from '../db/schema';

export default function DetalleAnimalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [animal, setAnimal] = useState<any>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargarDatos() {
      if (!id) return;
      try {
        // Obtenemos el animal incluyendo nombres de especie, raza y lote mediante joins
        const res = await db
          .select({
            animal: animales,
            especieNombre: especies.nombre,
            razaNombre: razas.nombre,
            loteNombre: lotes.nombre
          })
          .from(animales)
          .leftJoin(especies, eq(animales.especieId, especies.id))
          .leftJoin(razas, eq(animales.razaId, razas.id))
          .leftJoin(lotes, eq(animales.loteId, lotes.id))
          .where(eq(animales.id, id))
          .limit(1);

        if (res.length > 0) setAnimal(res[0]);
      } catch (e) {
        console.error(e);
      } finally {
        setCargando(false);
      }
    }
    cargarDatos();
  }, [id]);

  if (cargando) return <View style={styles.center}><ActivityIndicator size="large" color="#065f46" /></View>;
  if (!animal) return <View style={styles.center}><Text>Animal no encontrado.</Text></View>;

  const { animal: a, especieNombre, razaNombre, loteNombre } = animal;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <ArrowLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.title}>Hoja de Vida</Text>
        <TouchableOpacity onPress={() => router.push({ pathname: '/editarAnimal', params: { id: a.id } })}>
          <Text style={styles.editText}>Editar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Card Principal */}
        <View style={styles.card}>
          <Text style={styles.arete}>#{a.areteCodigo}</Text>
          <Text style={styles.nombre}>{a.nombre || 'Sin nombre'}</Text>
          <Text style={styles.categoria}>{a.categoria.replace('_', ' ')}</Text>
        </View>

        {/* Detalles Técnicos */}
        <View style={styles.detailsGrid}>
          <DetailItem icon={<Calendar size={18} />} label="Nacimiento" value={a.fechaNacimiento} />
          <DetailItem icon={<Tag size={18} />} label="Especie" value={especieNombre} />
          <DetailItem icon={<Tag size={18} />} label="Raza" value={razaNombre} />
          <DetailItem icon={<Scale size={18} />} label="Peso Inicial" value={`${a.pesoInicial} kg`} />
          <DetailItem icon={<Info size={18} />} label="Propósito" value={a.proposito} />
          <DetailItem icon={<Hash size={18} />} label="Lote" value={loteNombre || 'N/A'} />
          <DetailItem icon={<Info size={18} />} label="Sexo" value={a.sexo === 'F' ? 'Hembra' : 'Macho'} />
          <DetailItem icon={<Info size={18} />} label="Estado" value={a.estado?.replace('_', ' ') || 'Activo'} />
        </View>

        {/* Genética */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Información Genética</Text>
          <DetailItem icon={<Users size={16} />} label="Arete Madre" value={a.madreId || 'No registrado'} />
          <DetailItem icon={<Users size={16} />} label="Arete Padre" value={a.padreId || 'No registrado'} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Historial</Text>
          <TouchableOpacity
            style={styles.histLink}
            onPress={() =>
              router.push({ pathname: '/historial-leche', params: { arete: a.areteCodigo } })
            }
          >
            <Milk color="#065f46" size={18} />
            <Text style={styles.histLinkText}>Producción de leche</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.histLink}
            onPress={() =>
              router.push({ pathname: '/historial-pesajes', params: { arete: a.areteCodigo } })
            }
          >
            <Scale color="#d97706" size={18} />
            <Text style={styles.histLinkText}>Pesajes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.histLink}
            onPress={() =>
              router.push({
                pathname: '/registrar-reproduccion',
                params: { arete: a.areteCodigo },
              })
            }
          >
            <Heart color="#7c3aed" size={18} />
            <Text style={styles.histLinkText}>Evento reproductivo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.histLink}
            onPress={() =>
              router.push({
                pathname: '/registrar-sanidad',
                params: { arete: a.areteCodigo },
              })
            }
          >
            <Stethoscope color="#dc2626" size={18} />
            <Text style={styles.histLinkText}>Tratamiento sanitario</Text>
          </TouchableOpacity>
        </View>

        {a.notas && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}><FileText size={16} /> Notas</Text>
            <Text style={styles.noteText}>{a.notas}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function DetailItem({ icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <View style={styles.detailRow}>
      {icon}
      <View style={{marginLeft: 10}}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingTop: 60, backgroundColor: '#fff', alignItems: 'center' },
  scroll: { padding: 20 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 15, marginBottom: 15, borderWidth: 1, borderColor: '#f1f5f9' },
  arete: { fontSize: 18, fontWeight: 'bold', color: '#065f46' },
  nombre: { fontSize: 22, fontWeight: '700', marginVertical: 4 },
  categoria: { fontSize: 14, color: '#64748b', fontWeight: '600', textTransform: 'uppercase' },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  detailRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, width: '48%', marginBottom: 10, borderWidth: 1, borderColor: '#f1f5f9' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#1e293b' },
  label: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' },
  value: { fontSize: 14, fontWeight: '600', color: '#334155' },
  noteText: { color: '#475569', fontStyle: 'italic' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { flex: 1, fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  iconButton: { width: 40 },
  editText: { color: '#065f46', fontWeight: 'bold' },
  histLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  histLinkText: { fontSize: 15, fontWeight: '600', color: '#334155' },
});