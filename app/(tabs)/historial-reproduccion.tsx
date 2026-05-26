import { and, desc, eq, gte, like, lte } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { ArrowLeft, Baby, FileText, Filter, Plus, Search } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../../db/client';
import { obtenerFincaActiva } from '../../db/fincaActiva';
import { animales, especies, eventosReproductivos, lotes, razas } from '../../db/schema';
import { fechaLocalISO, haceDiasLocal } from '../../utils/fecha';

type EventoRow = {
  id: string;
  fechaEvento: string;
  tipoEvento: string;
  areteCodigo: string;
  animalNombre: string | null;
  resultadoPalpacion: string | null;
  fechaProbableParto: string | null;
  detallesParto: string | null;
  notas: string | null;
};

const PAGE_SIZE = 25;

const TIPO_COLORES: Record<string, { bg: string; text: string }> = {
  Celo_Detectado:          { bg: '#fef3c7', text: '#92400e' },
  Monta_Natural:            { bg: '#ede9fe', text: '#5b21b6' },
  Inseminacion_Artificial:  { bg: '#dbeafe', text: '#1e40af' },
  Palpacion_Diagnostico:    { bg: '#d1fae5', text: '#065f46' },
  Parto:                    { bg: '#fee2e2', text: '#991b1b' },
};

const EventoCard = memo(({ item, onLongPress }: { item: EventoRow; onLongPress: (item: EventoRow) => void }) => {
  const colores = TIPO_COLORES[item.tipoEvento] ?? { bg: '#f1f5f9', text: '#475569' };
  return (
    <TouchableOpacity
      style={styles.card}
      onLongPress={() => onLongPress(item)}
      delayLongPress={400}
    >
      <View style={styles.cardTop}>
        <View style={styles.areteBadge}>
          <Text style={styles.areteText}>#{item.areteCodigo}</Text>
        </View>
        <View style={[styles.tipoBadge, { backgroundColor: colores.bg }]}>
          <Text style={[styles.tipoText, { color: colores.text }]}>
            {item.tipoEvento.replace(/_/g, ' ')}
          </Text>
        </View>
      </View>

      {item.animalNombre && (
        <Text style={styles.animalNombreText}>{item.animalNombre}</Text>
      )}
      <Text style={styles.fechaText}>{item.fechaEvento}</Text>

      {item.resultadoPalpacion && (
        <Text style={styles.detText}>Resultado: {item.resultadoPalpacion}</Text>
      )}
      {item.fechaProbableParto && (
        <Text style={styles.detText}>🤰 Parto estimado: {item.fechaProbableParto}</Text>
      )}
      {item.detallesParto && (
        <Text style={styles.detText}>Detalle: {item.detallesParto.replace(/_/g, ' ')}</Text>
      )}
      {item.notas && (
        <Text style={styles.notasText} numberOfLines={2}>{item.notas}</Text>
      )}
      <Text style={styles.hintText}>Mantén presionado para editar o eliminar</Text>
    </TouchableOpacity>
  );
});

export default function HistorialReproduccionScreen() {
  const router = useRouter();

  const [lista, setLista] = useState<EventoRow[]>([]);
  const [partosProximos, setPartosProximos] = useState<EventoRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [paginaActual, setPaginaActual] = useState(0);
  const [hayMas, setHayMas] = useState(true);
  const [fincaNombre, setFincaNombre] = useState('');
  const [fincaId, setFincaId] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('Todos');
  
  const [listaEspecies, setListaEspecies] = useState<{ id: number; nombre: string }[]>([]);
  const [listaRazas, setListaRazas] = useState<{ id: number; nombre: string; especieId: number }[]>([]);
  const [listaLotes, setListaLotes] = useState<{ id: string; nombre: string }[]>([]);

  const [filtroEspecie, setFiltroEspecie] = useState<number | null>(null);
  const [filtroRaza, setFiltroRaza] = useState<number | null>(null);
  const [filtroLote, setFiltroLote] = useState<string | null>(null);
  
  const [filtroTiempo, setFiltroTiempo] = useState('3M');
  const [filtroDesde, setFiltroDesde] = useState(haceDiasLocal(89));
  const [filtroHasta, setFiltroHasta] = useState(fechaLocalISO());
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const [editando, setEditando] = useState<EventoRow | null>(null);
  const [editNotas, setEditNotas] = useState('');
  const [editFechaParto, setEditFechaParto] = useState('');
  const [guardandoEdit, setGuardandoEdit] = useState(false);


useEffect(() => {
  const backAction = () => {
    // Aquí defines a qué pantalla quieres que regrese
    router.replace('/registros'); 
    return true; // Importante: 'true' evita que el app se cierre o haga el comportamiento por defecto
  };

  const backHandler = BackHandler.addEventListener(
    'hardwareBackPress',
    backAction
  );

  // Esto limpia el evento al salir de la pantalla para no causar errores en otras partes
  return () => backHandler.remove();
}, []);

  const aplicarFiltroTiempo = (rango: string) => {
    setFiltroTiempo(rango);
    const hoy = fechaLocalISO();
    setFiltroHasta(hoy);
    if (rango === '1S') setFiltroDesde(haceDiasLocal(7));
    else if (rango === '1M') setFiltroDesde(haceDiasLocal(30));
    else if (rango === '6M') setFiltroDesde(haceDiasLocal(180));
    else if (rango === '1A') setFiltroDesde(haceDiasLocal(365));
  };

  const cargarDatos = useCallback(
    async (pagina: number, reset = false, textoBusqueda = busqueda) => {
      if (pagina === 0) setCargando(true); else setCargandoMas(true);
      try {
        const finca = await obtenerFincaActiva();
        if (!finca) { setLista([]); return; }
        setFincaNombre(finca.nombre);
        setFincaId(finca.id);

        if (pagina === 0) {
          const esp = await db.select().from(especies);
          const raz = await db.select().from(razas);
          const lotesFinca = await db.select().from(lotes).where(eq(lotes.fincaId, finca.id));
          
          setListaEspecies(esp);
          setListaRazas(raz);
          setListaLotes(lotesFinca);
        }

        const conds: any[] = [eq(animales.fincaId, finca.id)];
        
        if (textoBusqueda.trim() !== '') {
          conds.push(like(animales.areteCodigo, `%${textoBusqueda.trim()}%`));
        }

        if (filtroDesde) conds.push(gte(eventosReproductivos.fechaEvento, filtroDesde));
        if (filtroHasta) conds.push(lte(eventosReproductivos.fechaEvento, filtroHasta));
        if (filtroTipo !== 'Todos') conds.push(eq(eventosReproductivos.tipoEvento, filtroTipo as any));
        if (filtroEspecie !== null) conds.push(eq(animales.especieId, filtroEspecie));
        if (filtroRaza !== null) conds.push(eq(animales.razaId, filtroRaza));
        if (filtroLote !== null) conds.push(eq(animales.loteId, filtroLote));

        const rows = await db
          .select({
            id: eventosReproductivos.id,
            fechaEvento: eventosReproductivos.fechaEvento,
            tipoEvento: eventosReproductivos.tipoEvento,
            areteCodigo: animales.areteCodigo,
            animalNombre: animales.nombre,
            resultadoPalpacion: eventosReproductivos.resultadoPalpacion,
            fechaProbableParto: eventosReproductivos.fechaProbableParto,
            detallesParto: eventosReproductivos.detallesParto,
            notas: eventosReproductivos.notas,
          })
          .from(eventosReproductivos)
          .innerJoin(animales, eq(eventosReproductivos.animalId, animales.id))
          .where(and(...conds))
          .orderBy(desc(eventosReproductivos.fechaEvento))
          .limit(PAGE_SIZE + 1)
          .offset(pagina * PAGE_SIZE);

        const hayMasPaginas = rows.length > PAGE_SIZE;
        const datos = hayMasPaginas ? rows.slice(0, PAGE_SIZE) : rows;

        setHayMas(hayMasPaginas);
        setLista((prev) => (reset || pagina === 0 ? datos : [...prev, ...datos]));

        if (pagina === 0) {
          const hoyISO = fechaLocalISO();
          const en30 = new Date();
          en30.setDate(en30.getDate() + 30);
          const hasta30 = `${en30.getFullYear()}-${String(en30.getMonth() + 1).padStart(2, '0')}-${String(en30.getDate()).padStart(2, '0')}`;

          const proximos = await db
            .select({
              id: eventosReproductivos.id,
              fechaEvento: eventosReproductivos.fechaEvento,
              tipoEvento: eventosReproductivos.tipoEvento,
              areteCodigo: animales.areteCodigo,
              animalNombre: animales.nombre,
              resultadoPalpacion: eventosReproductivos.resultadoPalpacion,
              fechaProbableParto: eventosReproductivos.fechaProbableParto,
              detallesParto: eventosReproductivos.detallesParto,
              notas: eventosReproductivos.notas,
            })
            .from(eventosReproductivos)
            .innerJoin(animales, eq(eventosReproductivos.animalId, animales.id))
            .where(
              and(
                eq(animales.fincaId, finca.id),
                gte(eventosReproductivos.fechaProbableParto, hoyISO),
                lte(eventosReproductivos.fechaProbableParto, hasta30)
              )
            )
            .orderBy(eventosReproductivos.fechaProbableParto)
            .limit(20);
          setPartosProximos(proximos);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setCargando(false);
        setCargandoMas(false);
      }
    },
    [filtroDesde, filtroHasta, filtroTipo, filtroEspecie, filtroRaza, filtroLote, busqueda]
  );

  useFocusEffect(
    useCallback(() => {
      setPaginaActual(0);
      cargarDatos(0, true, busqueda);
    }, [cargarDatos, busqueda])
  );

  const cargarMas = () => {
    if (!hayMas || cargandoMas) return;
    const siguiente = paginaActual + 1;
    setPaginaActual(siguiente);
    cargarDatos(siguiente, false, busqueda);
  };

  const aplicarFiltros = () => {
    setMostrarFiltros(false);
    setPaginaActual(0);
    cargarDatos(0, true, busqueda);
  };

  const exportarPDF = async () => {
    if (lista.length === 0) {
      Alert.alert('Aviso', 'No hay registros para exportar con los filtros actuales.');
      return;
    }

    try {
      const fechaActual = fechaLocalISO();
      const nombreArchivo = `historial_reproductivo_${fechaActual}.pdf`;

      const filasHtml = lista.map((item) => {
        let detalles = '';
        if (item.resultadoPalpacion) detalles += `<strong>Res:</strong> ${item.resultadoPalpacion}<br>`;
        if (item.fechaProbableParto) detalles += `<strong>Parto est:</strong> ${item.fechaProbableParto}<br>`;
        if (item.detallesParto) detalles += `<strong>Detalle:</strong> ${item.detallesParto.replace(/_/g, ' ')}<br>`;
        if (item.notas) detalles += `<strong>Notas:</strong> ${item.notas}`;

        return `
          <tr>
            <td>${item.fechaEvento}</td>
            <td><strong>#${item.areteCodigo}</strong> ${item.animalNombre ? `<br>${item.animalNombre}` : ''}</td>
            <td>${item.tipoEvento.replace(/_/g, ' ')}</td>
            <td>${detalles}</td>
          </tr>
        `;
      }).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
              .header { text-align: center; margin-bottom: 30px; }
              .header h1 { margin: 0; color: #1e293b; font-size: 24px; }
              .header p { margin: 5px 0 0 0; color: #64748b; font-size: 14px; }
              .filtros { background-color: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 12px; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; }
              th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; vertical-align: top; }
              th { background-color: #f1f5f9; color: #475569; font-weight: bold; text-transform: uppercase; font-size: 11px; }
              tr:nth-child(even) { background-color: #f8fafc; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Historial Reproductivo</h1>
              <p>${fincaNombre}</p>
            </div>
            
            <div class="filtros">
              <strong>Filtros aplicados:</strong><br>
              Período: ${filtroDesde} hasta ${filtroHasta} | Tipo de evento: ${filtroTipo.replace(/_/g, ' ')}
            </div>

            <table>
              <thead>
                <tr>
                  <th width="15%">Fecha</th>
                  <th width="20%">Animal</th>
                  <th width="25%">Evento</th>
                  <th width="40%">Detalles</th>
                </tr>
              </thead>
              <tbody>
                ${filasHtml}
              </tbody>
            </table>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      
      const nuevaUri = `${FileSystem.documentDirectory}${nombreArchivo}`;
      await FileSystem.moveAsync({
        from: uri,
        to: nuevaUri,
      });

      const sePuedeCompartir = await Sharing.isAvailableAsync();
      if (sePuedeCompartir) {
        await Sharing.shareAsync(nuevaUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Exportar Historial Reproductivo',
          UTI: 'com.adobe.pdf'
        });
      } else {
        Alert.alert('Éxito', `El PDF se generó en: ${nuevaUri}`);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Hubo un problema al generar o compartir el PDF.');
    }
  };

  const abrirAcciones = useCallback((item: EventoRow) => {
    Alert.alert(
      `#${item.areteCodigo} · ${item.tipoEvento.replace(/_/g, ' ')}`,
      `Fecha: ${item.fechaEvento}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Editar notas/fecha parto',
          onPress: () => {
            setEditando(item);
            setEditNotas(item.notas || '');
            setEditFechaParto(item.fechaProbableParto || '');
          },
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => confirmarEliminar(item),
        },
      ]
    );
  }, []);

  const confirmarEliminar = (item: EventoRow) => {
    Alert.alert('Eliminar evento', '¿Borrar este registro reproductivo?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await db.delete(eventosReproductivos).where(eq(eventosReproductivos.id, item.id));
            setPaginaActual(0);
            cargarDatos(0, true, busqueda);
          } catch (e) {
            Alert.alert('Error', 'No se pudo eliminar.');
          }
        },
      },
    ]);
  };

  const guardarEdicion = async () => {
    if (!editando) return;
    try {
      setGuardandoEdit(true);
      await db
        .update(eventosReproductivos)
        .set({
          notas: editNotas.trim() || null,
          fechaProbableParto: editFechaParto.trim() || null,
        })
        .where(eq(eventosReproductivos.id, editando.id));
      setEditando(null);
      setPaginaActual(0);
      cargarDatos(0, true, busqueda);
    } catch (e) {
      Alert.alert('Error', 'No se pudo actualizar.');
    } finally {
      setGuardandoEdit(false);
    }
  };

  const renderItem = useCallback(({ item }: { item: EventoRow }) => (
    <EventoCard item={item} onLongPress={abrirAcciones} />
  ), [abrirAcciones]);

  const ListHeader = useCallback(() => (
    <>
      {partosProximos.length > 0 && (
        <View style={styles.alertaSection}>
          <View style={styles.alertaHeader}>
            <Baby color="#dc2626" size={18} />
            <Text style={styles.alertaTitle}>Partos próximos (30 días)</Text>
          </View>
          {partosProximos.map((p) => {
            const fechaParto = new Date(`${p.fechaProbableParto}T00:00:00`);
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            
            const diasRestantes = Math.round(
              (fechaParto.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
            );

            return (
              <View key={p.id} style={styles.alertaRow}>
                <View>
                  <Text style={styles.alertaArete}>#{p.areteCodigo}</Text>
                  <Text style={styles.alertaFecha}>{p.fechaProbableParto}</Text>
                </View>
                <View style={[styles.diasBadge, diasRestantes <= 7 && styles.diasBadgeUrgente]}>
                  <Text style={[styles.diasText, diasRestantes <= 7 && { color: '#fff' }]}>
                    {diasRestantes}d
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search color="#94a3b8" size={16} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar arete..."
            value={busqueda}
            onChangeText={(t) => {
              setBusqueda(t);
              setPaginaActual(0);
              cargarDatos(0, true, t);
            }}
            placeholderTextColor="#94a3b8"
          />
        </View>
        <TouchableOpacity
          style={[styles.filtroBtn, mostrarFiltros && styles.filtroBtnOn]}
          onPress={() => setMostrarFiltros((v) => !v)}
        >
          <Filter size={16} color={mostrarFiltros ? '#fff' : '#7c3aed'} />
        </TouchableOpacity>
      </View>

      {mostrarFiltros && (
        <View style={styles.filtroPanel}>
          <Text style={styles.filtroPanelLabel}>Periodo</Text>
          <View style={styles.chipRow}>
            {[
              { label: '1 Sem', val: '1S' },
              { label: '1 Mes', val: '1M' },
              { label: '6 Meses', val: '6M' },
              { label: '1 Año', val: '1A' },
              { label: 'Custom', val: 'Custom' },
            ].map((t) => (
              <TouchableOpacity
                key={t.val}
                style={[styles.chip, filtroTiempo === t.val && styles.chipOn]}
                onPress={() => aplicarFiltroTiempo(t.val)}
              >
                <Text style={[styles.chipText, filtroTiempo === t.val && styles.chipTextOn]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {filtroTiempo === 'Custom' && (
            <View style={styles.rowInputs}>
              <View style={styles.flex1}>
                <Text style={styles.filtroPanelLabel}>Desde</Text>
                <TextInput
                  style={styles.filtroInput}
                  value={filtroDesde}
                  onChangeText={setFiltroDesde}
                  placeholder="YYYY-MM-DD"
                />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.filtroPanelLabel}>Hasta</Text>
                <TextInput
                  style={styles.filtroInput}
                  value={filtroHasta}
                  onChangeText={setFiltroHasta}
                  placeholder="YYYY-MM-DD"
                />
              </View>
            </View>
          )}

          <Text style={styles.filtroPanelLabel}>Tipo de evento</Text>
          <View style={styles.chipRow}>
            {['Todos', ...Array.from(Object.keys(TIPO_COLORES))].map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, filtroTipo === t && styles.chipOn]}
                onPress={() => setFiltroTipo(t)}
              >
                <Text style={[styles.chipText, filtroTipo === t && styles.chipTextOn]}>
                  {t.replace(/_/g, ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.filtroPanelLabel}>Especie</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, filtroEspecie === null && styles.chipOn]}
              onPress={() => { setFiltroEspecie(null); setFiltroRaza(null); }}
            >
              <Text style={[styles.chipText, filtroEspecie === null && styles.chipTextOn]}>Todas</Text>
            </TouchableOpacity>
            {listaEspecies.map((e) => (
              <TouchableOpacity
                key={e.id}
                style={[styles.chip, filtroEspecie === e.id && styles.chipOn]}
                onPress={() => { setFiltroEspecie(e.id); setFiltroRaza(null); }}
              >
                <Text style={[styles.chipText, filtroEspecie === e.id && styles.chipTextOn]}>{e.nombre}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.filtroPanelLabel}>Raza</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, filtroRaza === null && styles.chipOn]}
              onPress={() => setFiltroRaza(null)}
            >
              <Text style={[styles.chipText, filtroRaza === null && styles.chipTextOn]}>Todas</Text>
            </TouchableOpacity>
            {listaRazas
              .filter((r) => !filtroEspecie || r.especieId === filtroEspecie)
              .map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.chip, filtroRaza === r.id && styles.chipOn]}
                  onPress={() => setFiltroRaza(r.id)}
                >
                  <Text style={[styles.chipText, filtroRaza === r.id && styles.chipTextOn]}>{r.nombre}</Text>
                </TouchableOpacity>
              ))}
          </View>

          <Text style={styles.filtroPanelLabel}>Lote</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, filtroLote === null && styles.chipOn]}
              onPress={() => setFiltroLote(null)}
            >
              <Text style={[styles.chipText, filtroLote === null && styles.chipTextOn]}>Todos</Text>
            </TouchableOpacity>
            {listaLotes.map((l) => (
              <TouchableOpacity
                key={l.id}
                style={[styles.chip, filtroLote === l.id && styles.chipOn]}
                onPress={() => setFiltroLote(l.id)}
              >
                <Text style={[styles.chipText, filtroLote === l.id && styles.chipTextOn]}>{l.nombre}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.filtroAplicar} onPress={aplicarFiltros}>
            <Text style={styles.filtroAplicarText}>Aplicar filtros</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionTitle}>Eventos · {fincaNombre}</Text>
    </>
  ), [partosProximos, busqueda, mostrarFiltros, filtroTiempo, filtroDesde, filtroHasta, filtroTipo, filtroEspecie, listaEspecies, filtroRaza, listaRazas, filtroLote, listaLotes, fincaNombre, cargarDatos]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/registros')}>
          <ArrowLeft color="#1e293b" size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Historial Reproductivo</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.exportBtn} onPress={exportarPDF}>
            <FileText color="#7c3aed" size={20} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/registrar-reproduccion')}
          >
            <Plus color="#fff" size={20} />
          </TouchableOpacity>
        </View>
      </View>

      {cargando ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#7c3aed" />
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={styles.listContent}
          onEndReached={cargarMas}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            cargandoMas ? (
              <ActivityIndicator color="#7c3aed" style={{ marginVertical: 12 }} />
            ) : !hayMas && lista.length > 0 ? (
              <Text style={styles.finLista}>— Fin del historial ({lista.length} registros) —</Text>
            ) : null
          }
          ListEmptyComponent={
            <Text style={styles.empty}>Sin eventos en el rango seleccionado.</Text>
          }
        />
      )}

      <Modal visible={editando !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar registro</Text>
            <Text style={styles.modalSub}>
              #{editando?.areteCodigo} · {editando?.tipoEvento.replace(/_/g, ' ')}
            </Text>

            <Text style={styles.label}>Notas</Text>
            <TextInput
              style={[styles.filtroInput, { height: 70 }]}
              value={editNotas}
              onChangeText={setEditNotas}
              multiline
              placeholder="Observaciones..."
            />

            {(editando?.tipoEvento === 'Palpacion_Diagnostico' ||
              editando?.tipoEvento === 'Monta_Natural' ||
              editando?.tipoEvento === 'Inseminacion_Artificial') && (
              <>
                <Text style={styles.label}>Fecha probable de parto</Text>
                <TextInput
                  style={styles.filtroInput}
                  value={editFechaParto}
                  onChangeText={setEditFechaParto}
                  placeholder="YYYY-MM-DD"
                />
              </>
            )}

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setEditando(null)}
              >
                <Text style={{ fontWeight: '600', color: '#475569' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnSave, guardandoEdit && { opacity: 0.5 }]}
                onPress={guardarEdicion}
                disabled={guardandoEdit}
              >
                <Text style={{ fontWeight: '700', color: '#fff' }}>
                  {guardandoEdit ? '...' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  backButton: { padding: 8, borderRadius: 12, backgroundColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exportBtn: { backgroundColor: '#faf5ff', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#e9d5ff' },
  addBtn: { backgroundColor: '#7c3aed', padding: 10, borderRadius: 12 },
  listContent: { padding: 16, paddingBottom: 80 },
  alertaSection: {
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  alertaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  alertaTitle: { fontWeight: '700', color: '#991b1b', fontSize: 14 },
  alertaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#fee2e2',
  },
  alertaArete: { fontWeight: '700', color: '#1e293b' },
  alertaFecha: { fontSize: 12, color: '#64748b' },
  diasBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  diasBadgeUrgente: { backgroundColor: '#dc2626' },
  diasText: { fontWeight: '800', fontSize: 13, color: '#1e293b' },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    height: 40,
    gap: 6,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1e293b' },
  filtroBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#faf5ff',
    borderWidth: 1,
    borderColor: '#e9d5ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtroBtnOn: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  filtroPanel: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filtroPanelLabel: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 8, textTransform: 'uppercase' },
  filtroInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    height: 40,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    marginBottom: 4,
    color: '#1e293b',
  },
  filtroAplicar: {
    backgroundColor: '#7c3aed',
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  filtroAplicarText: { color: '#fff', fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  chipOn: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  chipText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  chipTextOn: { color: '#fff' },
  rowInputs: { flexDirection: 'row', gap: 8, marginTop: 8 },
  flex1: { flex: 1 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  card: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  areteBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  areteText: { fontWeight: '700', color: '#1e293b', fontSize: 13 },
  tipoBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  tipoText: { fontSize: 11, fontWeight: '700' },
  animalNombreText: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 2 },
  fechaText: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  detText: { fontSize: 12, color: '#475569', marginTop: 2 },
  notasText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginTop: 4 },
  hintText: { fontSize: 10, color: '#cbd5e1', marginTop: 6 },
  empty: { textAlign: 'center', marginTop: 40, color: '#94a3b8' },
  finLista: { textAlign: 'center', color: '#cbd5e1', fontSize: 12, marginVertical: 12 },
  label: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 4, marginTop: 10, textTransform: 'uppercase' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  modalSub: { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 4 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtnCancel: { flex: 1, height: 44, borderRadius: 12, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  modalBtnSave: { flex: 1, height: 44, borderRadius: 12, backgroundColor: '#7c3aed', justifyContent: 'center', alignItems: 'center' },
});