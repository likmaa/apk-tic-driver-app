import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Linking,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useDriverStore } from '../providers/DriverProvider';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, withTiming, useAnimatedStyle, Easing } from 'react-native-reanimated';
import { Fonts } from '../../font';

const { width } = Dimensions.get('window');

export default function IncomingRequest() {
  const router = useRouter();
  const { currentRide, acceptRequest, declineRequest, syncCurrentRide } = useDriverStore();
  const [seconds, setSeconds] = React.useState(300);
  const soundRef = React.useRef<Audio.Sound | null>(null);

  const rideId = currentRide?.id ?? null;
  const isIncoming = currentRide?.status === 'incoming';

  // Animation du timer (pulse)
  const pulse = useSharedValue(1);
  React.useEffect(() => {
    pulse.value = 0;
    pulse.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) });
  }, [seconds]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.08 }],
    opacity: 1 - pulse.value * 0.1,
  }));

  const formattedTime = React.useMemo(() => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [seconds]);

  // === Gestion du son et timer ===
  const stopRingtone = React.useCallback(async () => {
    try {
      await soundRef.current?.stopAsync();
      await soundRef.current?.unloadAsync();
    } catch { }
    soundRef.current = null;
  }, []);

  React.useEffect(() => {
    if (currentRide) return;
    syncCurrentRide().catch(() => { });
  }, [currentRide, syncCurrentRide]);

  React.useEffect(() => {
    if (!rideId || !isIncoming) {
      stopRingtone();
      return;
    }

    (async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_0d1bd2994c.mp3?filename=notification-109315.mp3' },
          { isLooping: true, volume: 1.0 }
        );
        soundRef.current = sound;
        await sound.playAsync();
      } catch (e) { }
    })();

    const interval = setInterval(() => {
      setSeconds(s => (s > 0 ? s - 1 : 0));
    }, 1000);

    return () => {
      clearInterval(interval);
      stopRingtone();
    };
  }, [rideId, isIncoming, stopRingtone]);

  React.useEffect(() => {
    if (seconds === 0 && rideId && isIncoming) {
      declineRequest().catch(() => { });
      stopRingtone();
      router.replace('/(tabs)');
    }
  }, [seconds, rideId, isIncoming]);

  React.useEffect(() => {
    if (currentRide?.status === 'pickup') {
      router.replace({ pathname: '/pickup' });
    }
  }, [currentRide?.status, router]);

  // === Cas vide ===
  if (!rideId || !currentRide) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Aucune demande en cours</Text>
        <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/(tabs)')}>
          <Ionicons name="home" size={24} color="#fff" />
          <Text style={styles.homeBtnText}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const pickup = currentRide.pickup ?? 'Point de départ inconnu';
  const dropoff = currentRide.dropoff ?? 'Destination inconnue';
  const fare = `${currentRide.fare.toLocaleString('fr-FR')} FCFA`;
  const passengerName = currentRide.riderName ?? 'Client';
  const passengerPhone = currentRide.riderPhone;
  const sanitizedPassengerPhone = passengerPhone?.replace(/[^\d+]/g, '');

  const openPhone = () => {
    if (!sanitizedPassengerPhone) return;
    Linking.openURL(`tel:${sanitizedPassengerPhone}`).catch(() =>
      Alert.alert('Erreur', "Impossible d'ouvrir l'application Téléphone.")
    );
  };

  const openWhatsApp = () => {
    if (!sanitizedPassengerPhone) return;
    const digits = sanitizedPassengerPhone.replace(/[^\d]/g, '');
    if (!digits.length) return;
    const url = `https://wa.me/${digits}?text=${encodeURIComponent("Bonjour, je suis votre chauffeur.")}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Erreur', "Impossible d'ouvrir WhatsApp.")
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header animé */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>NOUVELLE COURSE</Text>
        <Animated.View style={[styles.timerContainer, animatedStyle]}>
          <Text style={styles.timer}>{formattedTime}</Text>
        </Animated.View>
      </View>

      {/* Carte principale */}
      <View style={styles.glassCard}>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{fare}</Text>
          <View style={styles.priorityBadge}>
            <Text style={styles.priorityText}>PRIORITAIRE</Text>
          </View>
        </View>

        <View style={styles.routeContainer}>
          <View style={styles.point}>
            <View style={[styles.dot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.address} numberOfLines={2}>{pickup}</Text>
          </View>
          <View style={styles.line} />
          <View style={styles.point}>
            <View style={[styles.dot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.address} numberOfLines={2}>{dropoff}</Text>
          </View>
        </View>

        {passengerPhone && (
          <View style={styles.passengerSection}>
            <Text style={styles.passengerTitle}>Passager</Text>
            <Text style={styles.passengerName}>{passengerName}</Text>
            <View style={styles.contactRow}>
              <TouchableOpacity style={[styles.contactBtn, styles.callButton]} onPress={openPhone}>
                <Ionicons name="call" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.contactText}>Appeler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.contactBtn, styles.whatsButton]} onPress={openWhatsApp}>
                <Ionicons name="logo-whatsapp" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.contactText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Boutons d'action */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.declineButton]}
          onPress={async () => {
            await declineRequest();
            stopRingtone();
            router.replace('/(tabs)');
          }}
        >
          <Ionicons name="close" size={32} color="#ef4444" />
          <Text style={styles.declineText}>Refuser</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton, !isIncoming && styles.disabled]}
          disabled={!isIncoming}
          onPress={() => {
            if (!isIncoming) return;

            // OPTIMISTIC NAVIGATION: Don't await the network request
            // We want the UI to be snappy. DriverProvider handles the state update instantly.
            stopRingtone();
            router.replace({ pathname: '/pickup' });

            acceptRequest().catch(() => {
              Alert.alert('Erreur', 'Impossible d’accepter la course. Vérifiez votre connexion.');
              // Optionally navigate back if it fails, but DriverProvider rollback usually handles state
            });
          }}
        >
          <Ionicons name="checkmark" size={32} color="#fff" />
          <Text style={styles.acceptText}>Accepter</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 20, gap: 16 },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: { color: '#334155', fontSize: 20, marginBottom: 30 },
  homeBtn: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    gap: 10,
  },
  homeBtnText: { color: '#fff', fontFamily: Fonts.titilliumWebBold, fontSize: 16 },

  header: { alignItems: 'center', marginTop: 20, marginBottom: 20 },
  headerLabel: { color: '#475569', fontSize: 14, letterSpacing: 2, marginBottom: 12 },
  timerContainer: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 30,
  },
  timer: { color: '#b91c1c', fontSize: 32, fontFamily: Fonts.titilliumWebBold, fontVariant: ['tabular-nums'] },

  glassCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  price: { color: '#111827', fontSize: 24, fontFamily: Fonts.titilliumWebBold },
  priorityBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  priorityText: { color: '#b45309', fontFamily: Fonts.titilliumWebBold, fontSize: 12 },

  routeContainer: { marginBottom: 12 },
  point: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  address: { color: '#0f172a', fontSize: 15, flex: 1, fontFamily: Fonts.titilliumWebBold },
  line: {
    height: 30,
    width: 1,
    backgroundColor: '#e5e7eb',
    marginLeft: 4,
  },

  passengerSection: { marginTop: 10 },
  passengerTitle: { color: '#94a3b8', fontSize: 13, marginBottom: 6 },
  passengerName: { color: '#0f172a', fontSize: 20, fontFamily: Fonts.titilliumWebBold, marginBottom: 12 },
  contactRow: { flexDirection: 'row', gap: 10 },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 12,
  },
  callButton: { backgroundColor: '#2563eb' },
  whatsButton: { backgroundColor: '#0f9d58' },
  contactText: { color: '#fff', fontFamily: Fonts.titilliumWebBold, fontSize: 15 },

  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
    marginBottom: 12,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 18,
  },
  declineButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  declineText: { color: '#dc2626', marginTop: 4, fontFamily: Fonts.titilliumWebBold, fontSize: 14 },
  acceptButton: {
    backgroundColor: '#0ea5e9',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  acceptText: { color: '#fff', marginTop: 4, fontFamily: Fonts.titilliumWebBold, fontSize: 15 },
  disabled: { opacity: 0.4 },
});