import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Linking,
  Alert,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useDriverStore } from '../providers/DriverProvider';
import { Audio } from 'expo-av';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  Easing,
  withRepeat,
  withSequence,
  FadeInDown,
  FadeIn
} from 'react-native-reanimated';
import { Fonts } from '../../font';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function IncomingRequest() {
  const router = useRouter();
  const { currentRide, acceptRequest, declineRequest, syncCurrentRide } = useDriverStore();
  const [seconds, setSeconds] = useState(300);
  const soundRef = useRef<Audio.Sound | null>(null);
  const declineCalledRef = useRef(false);

  const rideId = currentRide?.id ?? null;
  const isIncoming = currentRide?.status === 'incoming';

  // Reset timer and flags when ride changes
  useEffect(() => {
    if (rideId && isIncoming) {
      setSeconds(300);
      declineCalledRef.current = false;
      console.log(`[IncomingRequest] New ride detected: ${rideId}. Timer reset.`);
    }
  }, [rideId, isIncoming]);

  // Animations
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.5);

  useEffect(() => {
    ringScale.value = withRepeat(
      withTiming(1.5, { duration: 1500, easing: Easing.out(Easing.quad) }),
      -1,
      false
    );
    ringOpacity.value = withRepeat(
      withTiming(0, { duration: 1500, easing: Easing.out(Easing.quad) }),
      -1,
      false
    );
  }, []);

  const animatedRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const formattedTime = useMemo(() => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [seconds]);

  // === Gestion du son et timer ===
  const stopRingtone = useCallback(async () => {
    try {
      await soundRef.current?.stopAsync();
      await soundRef.current?.unloadAsync();
    } catch { }
    soundRef.current = null;
  }, []);

  useEffect(() => {
    if (!currentRide) {
      syncCurrentRide().catch(() => { });
    }
  }, [currentRide, syncCurrentRide]);

  useEffect(() => {
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

  useEffect(() => {
    if (seconds === 0 && rideId && isIncoming && !declineCalledRef.current) {
      declineCalledRef.current = true;
      console.log(`[IncomingRequest] Timer expired for ride: ${rideId}. Auto-declining.`);
      declineRequest().catch(() => { });
      stopRingtone();
      router.replace('/(tabs)');
    }
  }, [seconds, rideId, isIncoming, declineRequest, stopRingtone, router]);

  useEffect(() => {
    if (currentRide?.status === 'pickup') {
      router.replace('/pickup');
    } else if (!currentRide && !isIncoming) {
      router.replace('/(tabs)');
    }
  }, [currentRide?.status, currentRide, isIncoming, router]);

  if (!rideId || !currentRide) {
    return (
      <View style={styles.emptyContainer}>
        <StatusBar barStyle="dark-content" />
        <Ionicons name="notifications-off-outline" size={80} color={Colors.lightGray} />
        <Text style={styles.emptyText}>Aucune demande en cours</Text>
        <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.homeBtnText}>Retour au tableau de bord</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pickup = currentRide.pickup ?? 'Point de départ inconnu';
  const dropoff = currentRide.dropoff ?? 'Destination inconnue';
  const fare = `${currentRide.fare.toLocaleString('fr-FR')} F`;
  const passengerName = currentRide.riderName ?? 'Passager';
  const passengerPhone = currentRide.riderPhone;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[Colors.primary, '#1e2d7d']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Top Section: Timer */}
        <View style={styles.timerSection}>
          <View style={styles.timerOuter}>
            <Animated.View style={[styles.pulseRing, animatedRingStyle]} />
            <View style={styles.timerInner}>
              <Text style={styles.timerLabel}>EXPIRE DANS</Text>
              <Text style={styles.timerValue}>{formattedTime}</Text>
            </View>
          </View>
        </View>

        {/* Middle Section: Ride Info Card */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={styles.mainCard}
        >
          {/* Fare & Service */}
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.fareLabel}>Gain estimé</Text>
              <Text style={styles.fareValue}>{fare}</Text>
            </View>
            <View style={[
              styles.badge,
              currentRide.service_type === 'livraison' ? styles.deliveryBadge :
                currentRide.service_type === 'deplacement' ? styles.ticBadge :
                  currentRide.vehicle_type === 'vip' ? styles.vipBadge :
                    styles.standardBadge
            ]}>
              <MaterialCommunityIcons
                name={
                  currentRide.service_type === 'livraison' ? "package-variant" :
                    currentRide.service_type === 'deplacement' ? "bus-clock" :
                      currentRide.vehicle_type === 'vip' ? "crown" : "car"
                }
                size={16}
                color={
                  currentRide.service_type === 'livraison' ? "#F97316" :
                    currentRide.service_type === 'deplacement' ? Colors.secondary :
                      currentRide.vehicle_type === 'vip' ? "#FFD700" : Colors.primary
                }
              />
              <Text style={[
                styles.badgeText,
                currentRide.service_type === 'livraison' ? styles.deliveryText :
                  currentRide.service_type === 'deplacement' ? styles.ticText :
                    currentRide.vehicle_type === 'vip' ? styles.vipText :
                      styles.standardText
              ]}>
                {
                  currentRide.service_type === 'livraison' ? 'LIVRAISON' :
                    currentRide.service_type === 'deplacement' ? 'DÉPLACEMENT TIC' :
                      currentRide.vehicle_type === 'vip' ? 'VIP LUXE' : 'STANDARD'
                }
              </Text>
            </View>
          </View>

          {/* Route Section */}
          <View style={styles.routeSection}>
            <View style={styles.routeItem}>
              <View style={[styles.routeIcon, { backgroundColor: '#10B981' }]}>
                <Ionicons name="location" size={14} color="#fff" />
              </View>
              <View style={styles.routeContent}>
                <Text style={styles.routeLabel}>DÉPART</Text>
                <Text style={styles.routeAddress} numberOfLines={2}>{pickup}</Text>
              </View>
            </View>

            <View style={styles.routeConnector}>
              <View style={styles.connectorLine} />
            </View>

            <View style={styles.routeItem}>
              <View style={[styles.routeIcon, { backgroundColor: Colors.secondary }]}>
                <Ionicons name="flag" size={14} color="#fff" />
              </View>
              <View style={styles.routeContent}>
                <Text style={styles.routeLabel}>DESTINATION</Text>
                <Text style={styles.routeAddress} numberOfLines={2}>{dropoff}</Text>
              </View>
            </View>
          </View>

          {/* Special Requests */}
          {currentRide.has_baggage && (
            <View style={styles.baggageNote}>
              <MaterialCommunityIcons name="bag-checked" size={18} color={Colors.secondary} />
              <Text style={styles.baggageNoteText}>Le passager a des bagages</Text>
            </View>
          )}

          {/* Passenger Preview */}
          <View style={styles.passengerPreview}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{passengerName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.passengerInfo}>
              <Text style={styles.passengerNameText}>{passengerName}</Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color="#F59E0B" />
                <Text style={styles.ratingText}>4.9 • Nouveau client</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(600)}
          style={styles.actionSection}
        >
          <TouchableOpacity
            style={styles.declineBtn}
            onPress={async () => {
              await declineRequest();
              stopRingtone();
              router.replace('/(tabs)');
            }}
          >
            <Ionicons name="close" size={28} color="#fff" />
            <Text style={styles.actionText}>Ignorer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => {
              if (!isIncoming) return;
              stopRingtone();
              router.replace('/pickup');
              acceptRequest().catch(() => {
                Alert.alert('Erreur', 'L’offre n’est plus disponible.');
              });
            }}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.acceptGradient}
            >
              <Ionicons name="checkmark-sharp" size={32} color="#fff" />
              <Text style={styles.acceptBtnText}>ACCEPTER</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: 20 },

  // Empty State
  emptyContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: Colors.black,
    marginTop: 20,
    textAlign: 'center',
  },
  homeBtn: {
    marginTop: 30,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  homeBtnText: {
    color: '#fff',
    fontFamily: Fonts.bold,
    fontSize: 16,
  },

  // Timer Section
  timerSection: {
    alignItems: 'center',
    marginVertical: 30,
  },
  timerOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  timerInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  timerValue: {
    color: '#fff',
    fontSize: 28,
    fontFamily: Fonts.bold,
    fontVariant: ['tabular-nums'],
  },

  // Main Card
  mainCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  fareLabel: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.gray,
    marginBottom: 2,
  },
  fareValue: {
    fontFamily: Fonts.bold,
    fontSize: 32,
    color: Colors.black,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 5,
  },
  vipBadge: { backgroundColor: '#FFF9E6' },
  standardBadge: { backgroundColor: '#F0F4FF' },
  deliveryBadge: { backgroundColor: '#FFF7ED' },
  ticBadge: { backgroundColor: '#EEF2FF' },
  badgeText: { fontSize: 11, fontFamily: Fonts.bold },
  vipText: { color: '#B45309' },
  standardText: { color: Colors.primary },
  deliveryText: { color: '#F97316' },
  ticText: { color: Colors.secondary },

  // Route Section
  routeSection: {
    marginBottom: 15,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 15,
  },
  routeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  routeContent: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: Colors.gray,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  routeAddress: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.black,
    lineHeight: 20,
  },
  routeConnector: {
    width: 28,
    alignItems: 'center',
    marginVertical: 4,
  },
  connectorLine: {
    width: 2,
    height: 25,
    backgroundColor: '#F3F4F6',
    borderStyle: 'dashed',
    borderRadius: 1,
  },

  // Extras
  baggageNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    padding: 12,
    borderRadius: 12,
    gap: 10,
    marginBottom: 20,
  },
  baggageNoteText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#9A3412',
  },

  // Passenger Preview
  passengerPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 15,
    borderRadius: 18,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: Fonts.bold,
  },
  passengerInfo: {
    flex: 1,
  },
  passengerNameText: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.black,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    fontSize: 12,
    color: Colors.gray,
    fontFamily: Fonts.regular,
  },

  // Actions
  actionSection: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 25,
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
  },
  declineBtn: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: Fonts.bold,
    marginTop: 4,
  },
  acceptBtn: {
    flex: 1,
    height: 80,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8,
  },
  acceptGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  acceptBtnText: {
    color: '#fff',
    fontSize: 20,
    fontFamily: Fonts.bold,
    letterSpacing: 1,
  },
});