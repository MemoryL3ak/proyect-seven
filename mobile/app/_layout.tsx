import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f8fafc',
          headerTitleStyle: { fontWeight: '600', fontSize: 16 },
          contentStyle: { backgroundColor: '#f1f5f9' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="usuario" options={{ title: 'Portal de Usuario' }} />
        <Stack.Screen name="conductor" options={{ title: 'Portal Conductor' }} />
        <Stack.Screen name="vehiculo" options={{ title: 'Solicitud de Vehículo' }} />
      </Stack>
    </>
  );
}
