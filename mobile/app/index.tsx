import { useRouter } from 'expo-router';
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type PortalCard = {
  route: '/usuario' | '/conductor' | '/vehiculo';
  title: string;
  subtitle: string;
  description: string;
  color: string;
  emoji: string;
};

const PORTALS: PortalCard[] = [
  {
    route: '/usuario',
    title: 'Portal de Usuario',
    subtitle: 'Atletas y participantes',
    description: 'Consulta tu itinerario: vuelo, hotel, transporte y check-ins.',
    color: '#0ea5e9',
    emoji: '🏅',
  },
  {
    route: '/conductor',
    title: 'Portal Conductor',
    subtitle: 'Conductores y transportistas',
    description: 'Revisa tus viajes asignados y reporta cada etapa del traslado.',
    color: '#10b981',
    emoji: '🚐',
  },
  {
    route: '/vehiculo',
    title: 'Solicitud de Vehículo',
    subtitle: 'Solicita un traslado',
    description: 'Pide transporte hacia cualquier sede y sigue el estado de tu viaje.',
    color: '#f59e0b',
    emoji: '📍',
  },
];

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>SEVEN</Text>
          <Text style={styles.tagline}>Plataforma logística de eventos</Text>
        </View>

        {/* Portal cards */}
        <View style={styles.cards}>
          {PORTALS.map((portal) => (
            <TouchableOpacity
              key={portal.route}
              style={[styles.card, { borderLeftColor: portal.color }]}
              activeOpacity={0.8}
              onPress={() => router.push(portal.route)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardEmoji}>{portal.emoji}</Text>
                <View style={[styles.cardBadge, { backgroundColor: portal.color + '20' }]}>
                  <Text style={[styles.cardBadgeText, { color: portal.color }]}>
                    {portal.subtitle}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardTitle}>{portal.title}</Text>
              <Text style={styles.cardDescription}>{portal.description}</Text>
              <View style={[styles.cardButton, { backgroundColor: portal.color }]}>
                <Text style={styles.cardButtonText}>Entrar →</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.footer}>Seven · Logistic Core Platform</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
    marginTop: 16,
  },
  brand: {
    fontSize: 36,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: 6,
  },
  tagline: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
    letterSpacing: 1,
  },
  cards: {
    gap: 16,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    borderLeftWidth: 4,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardEmoji: {
    fontSize: 28,
  },
  cardBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  cardBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
    marginBottom: 16,
  },
  cardButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  cardButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  footer: {
    textAlign: 'center',
    color: '#475569',
    fontSize: 12,
    marginTop: 40,
  },
});
