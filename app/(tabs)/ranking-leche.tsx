import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import * as Print from 'expo-print';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { ArrowLeft, FileText, Medal, Milk } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../../db/client';
import { obtenerFincaActiva } from '../../db/fincaActiva';
import { animales, produccionLeche } from '../../db/schema';
import { fechaLocalISO, haceDiasLocal, validarRangoFechas } from '../../utils/fecha';

type RankingRow = {
  animalId: string;
  areteCodigo: string;
  nombre: string | null;
  totalLitros: number;
  diasOrdeño: number;
  pesadas: number;
  promedioDia: number;
  promedioPesada: number;
};

type CriterioOrden = 'promedioDia' | 'totalLitros' | 'promedioPesada';

export default function RankingLecheScreen() {
  const router = useRouter();
  const [fincaNombre, setFincaNombre] = useState('');
  const [fechaInicio, setFechaInicio] = useState(haceDiasLocal(6));
  const [fechaFin, setFechaFin] = useState(fechaLocalISO());
  const [soloActivos, setSoloActivos] = useState(true);
  const [soloLeche, setSoloLeche] = useState(true);
  
  const [criterio, setCriterio] = useState<CriterioOrden>('promedioDia');
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [calculando, setCalculando] = useState(false);
  const [calculado, setCalculado] = useState(false);
  const [exportandoPdf, setExportandoPdf] = useState(false);

  useEffect(() => {
    const backAction = () => {
      router.replace('/registros'); 
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, []);
    
  const aplicarPreset = (dias: number) => {
    setFechaInicio(haceDiasLocal(dias - 1));
    setFechaFin(fechaLocalISO());
  };

  const handleCalcular = useCallback(async () => {
    const rango = validarRangoFechas(fechaInicio, fechaFin);
    if (!rango.ok) {
      Alert.alert('Fechas inválidas', rango.mensaje);
      return;
    }

    try {
      setCalculando(true);
      setCalculado(false);

      const finca = await obtenerFincaActiva();
      if (!finca) {
        Alert.alert('Sin finca activa', 'Activa una finca en Inicio primero.');
        setRanking([]);
        return;
      }
      setFincaNombre(finca.nombre);

      const condiciones = [
        eq(animales.fincaId, finca.id),
        gte(produccionLeche.fecha, fechaInicio),
        lte(produccionLeche.fecha, fechaFin),
      ];

      if (soloActivos) condiciones.push(eq(animales.estado, 'Activo'));
      if (soloLeche) {
        condiciones.push(inArray(animales.proposito, ['Leche', 'Doble_Proposito']));
      }

      const filtro = and(...condiciones);

      const rows = await db
        .select({
          animalId: animales.id,
          areteCodigo: animales.areteCodigo,
          nombre: animales.nombre,
          totalLitros: sql<string>`sum(${produccionLeche.litros})`.mapWith(String),
          diasOrdeño: sql<number>`count(distinct ${produccionLeche.fecha})`.mapWith(Number),
          pesadas: sql<number>`count(*)`.mapWith(Number),
        })
        .from(produccionLeche)
        .innerJoin(animales, eq(produccionLeche.animalId, animales.id))
        .where(filtro)
        .groupBy(animales.id, animales.areteCodigo, animales.nombre);

      const lista: RankingRow[] = rows
        .map((r) => {
          const total = parseFloat(r.totalLitros) || 0;
          const dias = r.diasOrdeño || 0;
          const pesadas = r.pesadas || 0;
          return {
            animalId: r.animalId,
            areteCodigo: r.areteCodigo,
            nombre: r.nombre,
            totalLitros: total,
            diasOrdeño: dias,
            pesadas,
            promedioDia: dias > 0 ? total / dias : 0,
            promedioPesada: pesadas > 0 ? total / pesadas : 0,
          };
        })
        .filter((r) => r.pesadas > 0);

      lista.sort((a, b) => {
        if (criterio === 'totalLitros') return b.totalLitros - a.totalLitros;
        if (criterio === 'promedioPesada') return b.promedioPesada - a.promedioPesada;
        return b.promedioDia - a.promedioDia;
      });

      setRanking(lista);
      setCalculado(true);
    } catch (e) {
      console.error('Error calculando ranking:', e);
      Alert.alert('Error', 'No se pudo calcular el ranking.');
    } finally {
      setCalculando(false);
    }
  }, [fechaInicio, fechaFin, soloActivos, soloLeche, criterio]);

  const etiquetaCriterio =
    criterio === 'totalLitros'
      ? 'Total litros'
      : criterio === 'promedioPesada'
        ? 'Promedio L/pesada'
        : 'Promedio L/día';

  // NUEVA FUNCIÓN: Generación e impresión/compartición del PDF
  const handleExportarPDF = async () => {
    if (ranking.length === 0) {
      Alert.alert('Sin datos', 'No hay registros en el ranking actual para exportar.');
      return;
    }

    try {
      setExportandoPdf(true);

      const filasHtml = ranking.map((row, index) => `
        <tr class="${index < 3 ? 'top-row' : ''}">
          <td style="text-align: center; font-weight: bold;">${index + 1}</td>
          <td style="font-weight: bold;">#${row.areteCodigo}</td>
          <td>${row.nombre || '<em>Sin nombre</em>'}</td>
          <td style="text-align: right;">${row.totalLitros.toFixed(1)} L</td>
          <td style="text-align: center;">${row.diasOrdeño}</td>
          <td style="text-align: center;">${row.pesadas}</td>
          <td style="text-align: right; font-weight: bold; color: #065f46;">${row.promedioDia.toFixed(2)} L</td>
          <td style="text-align: right;">${row.promedioPesada.toFixed(2)} L</td>
        </tr>
      `).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; margin: 30px; font-size: 12px; }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 20px; }
            .title { fontSize: 24px; font-weight: bold; color: #1e293b; margin: 0; }
            .subtitle { font-size: 14px; color: #065f46; margin: 4px 0 0 0; font-weight: 600; }
            
            .params-box { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; borderRadius: 8px; margin-bottom: 20px; }
            .params-title { font-weight: bold; text-transform: uppercase; font-size: 10px; color: #64748b; margin-bottom: 6px; letter-spacing: 0.5px; }
            .params-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
            .param-item { font-size: 11px; }
            .param-label { font-weight: bold; color: #475569; }

            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #065f46; color: white; padding: 8px; text-align: left; font-size: 11px; text-transform: uppercase; }
            td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .top-row { background-color: #fef9c3 !important; }
            
            .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">Ranking Lechero</h1>
            <p class="subtitle">${fincaNombre || 'Reporte de Producción'}</p>
          </div>

          <div class="params-box">
            <div class="params-title">Parámetros del Reporte</div>
            <div class="params-grid">
              <div class="param-item"><span class="param-label">Rango:</span> ${fechaInicio} hasta ${fechaFin}</div>
              <div class="param-item"><span class="param-label">Ordenado por:</span> ${etiquetaCriterio}</div>
              <div class="param-item"><span class="param-label">Solo Activos:</span> ${soloActivos ? 'Sí' : 'No'}</div>
              <div class="param-item"><span class="param-label">Solo Propósito Leche:</span> ${soloLeche ? 'Sí' : 'No'}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align: center; width: 40px;">Pos</th>
                <th>Arete</th>
                <th>Nombre</th>
                <th style="text-align: right;">Total Litros</th>
                <th style="text-align: center;">Días Ord.</th>
                <th style="text-align: center;">Pesadas</th>
                <th style="text-align: right;">Prom L/Día</th>
                <th style="text-align: right;">Prom L/Psd</th>
              </tr>
            </thead>
            <tbody>
              ${filasHtml}
            </tbody>
          </table>

          <div class="footer">
            Reporte generado automáticamente · ${new Date().toLocaleDateString()}
          </div>
        </body>
        </html>
      `;

      // Genera el archivo PDF temporal
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      
      // Abre el menú nativo para compartir o guardar el archivo
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Ranking_Lechero_${fechaInicio}_${fechaFin}`,
        UTI: 'com.adobe.pdf',
      });

    } catch (e) {
      console.error('Error generando PDF:', e);
      Alert.alert('Error', 'No se pudo exportar el reporte en PDF.');
    } finally {
      setExportandoPdf(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/registros')}>          
          <ArrowLeft color="#1e293b" size={22} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Ranking Lechero</Text>
          <Text style={styles.headerSubtitle}>{fincaNombre || 'Promedio de producción'}</Text>
        </View>
        <View style={styles.spacer} />
      </View>

      <View style={styles.card}>
        <Text style={styles.formTitle}>Período</Text>
        <View style={styles.presetRow}>
          <TouchableOpacity style={styles.presetChip} onPress={() => aplicarPreset(7)}>
            <Text style={styles.presetText}>7 días</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetChip} onPress={() => aplicarPreset(14)}>
            <Text style={styles.presetText}>14 días</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetChip} onPress={() => aplicarPreset(30)}>
            <Text style={styles.presetText}>30 días</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Fecha inicio</Text>
        <TextInput
          style={styles.input}
          value={fechaInicio}
          onChangeText={setFechaInicio}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94a3b8"
        />
        <Text style={styles.label}>Fecha fin</Text>
        <TextInput
          style={styles.input}
          value={fechaFin}
          onChangeText={setFechaFin}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94a3b8"
        />

        <Text style={styles.label}>Ordenar por</Text>
        <View style={styles.presetRow}>
          {(
            [
              ['promedioDia', 'L/día'],
              ['promedioPesada', 'L/pesada'],
              ['totalLitros', 'Total L'],
            ] as const
          ).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.presetChip, criterio === key && styles.presetChipActive]}
              onPress={() => setCriterio(key)}
            >
              <Text style={[styles.presetText, criterio === key && styles.presetTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Filtros</Text>
        <FiltroToggle label="Solo activos" value={soloActivos} onToggle={() => setSoloActivos((v) => !v)} />
        <FiltroToggle label="Solo propósito leche / doble" value={soloLeche} onToggle={() => setSoloLeche((v) => !v)} />

        <TouchableOpacity
          style={[styles.btnCalcular, calculando && styles.btnDisabled]}
          onPress={handleCalcular}
          disabled={calculando}
        >
          {calculando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Milk color="#fff" size={20} style={{ marginRight: 8 }} />
              <Text style={styles.btnText}>Calcular ranking</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {calculado && (
        <View style={styles.listSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              {etiquetaCriterio} · {fechaInicio} → {fechaFin}
            </Text>
            
            {/* BOTÓN DE EXPORTACIÓN PDF */}
            {ranking.length > 0 && (
              <TouchableOpacity 
                style={styles.btnPdf} 
                onPress={handleExportarPDF}
                disabled={exportandoPdf}
              >
                {exportandoPdf ? (
                  <ActivityIndicator color="#065f46" size="small" />
                ) : (
                  <>
                    <FileText color="#065f46" size={16} style={{ marginRight: 4 }} />
                    <Text style={styles.btnPdfText}>Exportar PDF</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {ranking.length === 0 ? (
            <Text style={styles.empty}>No hay producción de leche en este período con los filtros elegidos.</Text>
          ) : (
            ranking.map((row, index) => (
              <TouchableOpacity
                key={row.animalId}
                style={styles.rankCard}
                onPress={() =>
                  router.push({ pathname: '/historial-leche', params: { arete: row.areteCodigo } })
                }
              >
                <View style={styles.rankLeft}>
                  <View style={[styles.rankBadge, index < 3 && styles.rankBadgeTop]}>
                    {index < 3 ? (
                      <Medal color={index === 0 ? '#ca8a04' : '#94a3b8'} size={18} />
                    ) : (
                      <Text style={styles.rankNum}>{index + 1}</Text>
                    )}
                  </View>
                  <View>
                    <Text style={styles.rankArete}>#{row.areteCodigo}</Text>
                    <Text style={styles.rankNombre}>{row.nombre || 'Sin nombre'}</Text>
                    <Text style={styles.rankMeta}>
                      {row.totalLitros.toFixed(1)} L total · {row.diasOrdeño} días · {row.pesadas} pesadas
                    </Text>
                  </View>
                </View>
                <View style={styles.rankRight}>
                  <Text style={styles.rankValor}>
                    {criterio === 'totalLitros'
                      ? row.totalLitros.toFixed(1)
                      : criterio === 'promedioPesada'
                        ? row.promedioPesada.toFixed(2)
                        : row.promedioDia.toFixed(2)}
                  </Text>
                  <Text style={styles.rankUnidad}>
                    {criterio === 'totalLitros' ? 'litros' : 'L'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

function FiltroToggle({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity style={styles.filtroRow} onPress={onToggle}>
      <View style={[styles.checkbox, value && styles.checkboxOn]} />
      <Text style={styles.filtroLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { paddingBottom: 100 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' },
  headerText: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  headerSubtitle: { fontSize: 12, color: '#065f46', fontWeight: '600', marginTop: 2 },
  spacer: { width: 40 },
  card: {
    margin: 16,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  formTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetChipActive: { backgroundColor: '#065f46', borderColor: '#065f46' },
  presetText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  presetTextActive: { color: '#fff' },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 12,
    marginBottom: 12,
    color: '#1e293b',
  },
  filtroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    marginRight: 10,
  },
  checkboxOn: { backgroundColor: '#065f46', borderColor: '#065f46' },
  filtroLabel: { fontSize: 14, color: '#334155' },
  btnCalcular: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#065f46',
    height: 48,
    borderRadius: 14,
    marginTop: 8,
  },
  btnDisabled: { backgroundColor: '#a7f3d0' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  listSection: { paddingHorizontal: 16 },
  sectionHeaderRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 12 
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    flex: 1,
    marginRight: 8,
  },
  btnPdf: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f4ea',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0'
  },
  btnPdfText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '700'
  },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 16 },
  rankCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  rankLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankBadgeTop: { backgroundColor: '#fef9c3' },
  rankNum: { fontWeight: '800', color: '#64748b' },
  rankArete: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  rankNombre: { fontSize: 12, color: '#64748b' },
  rankMeta: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  rankRight: { alignItems: 'flex-end' },
  rankValor: { fontSize: 20, fontWeight: '800', color: '#065f46' },
  rankUnidad: { fontSize: 10, color: '#64748b', fontWeight: '600' },
});