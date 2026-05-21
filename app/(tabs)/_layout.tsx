import { Tabs } from 'expo-router';
import { Home, ListTree } from 'lucide-react-native';
import React from 'react';
import { Platform } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: '#065f46', // Verde esmeralda para el activo
      tabBarInactiveTintColor: '#94a3b8', // Color suave para los no seleccionados
      tabBarStyle: {
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0', // Una línea sutil y limpia arriba en vez de sombra
        
        // Al quitar position: 'absolute', 'bottom', 'left' y 'right',
        // la barra se pega automáticamente al fondo real de la pantalla.
        
        // Altura adaptativa al sistema para que no se corten los textos abajo
        height: Platform.OS === 'ios' ? 84 : 110,
      },
      tabBarItemStyle: {
        // Centramos los iconos verticalmente según el espacio de cada sistema
        paddingTop: Platform.OS === 'ios' ? 8 : 10,
        height: 54,
      },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: Platform.OS === 'ios' ? 0 : 6, // Ajuste fino para Android vs iOS
      },
      headerShown: false,
    }}>
      {/* 1. VISIBLE: INICIO */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <Home size={22} color={color} />,
        }}
      />
      
      {/* 2. VISIBLE: REGISTROS */}
      <Tabs.Screen
        name="registros" 
        options={{
          title: 'Registros',
          tabBarIcon: ({ color }) => <ListTree size={22} color={color} />,
        }}
      />

      {/* --- PANTALLAS CON BARRA FLOTANTE PERO OCULTAS DE LOS MENÚS SELECCIONABLES --- */}

      <Tabs.Screen
        name="crear-finca"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="editar-finca"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="inventario"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="produccion"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="crear-animal"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="gestionar-lotes"
        options={{
          href: null,
        }}
      />

     <Tabs.Screen
        name="respaldo"
        options={{
          href: null, 
        }}
      />

      <Tabs.Screen
        name="rendimiento-queso"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="ranking-leche"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen name="ranking-peso" options={{ href: null }} />
      <Tabs.Screen name="registrar-reproduccion" options={{ href: null }} />
      <Tabs.Screen name="historial-reproduccion" options={{ href: null }} />
      <Tabs.Screen name="registrar-sanidad" options={{ href: null }} />
      <Tabs.Screen name="retiro-sanidad" options={{ href: null }} />
    </Tabs>
    
  );
}