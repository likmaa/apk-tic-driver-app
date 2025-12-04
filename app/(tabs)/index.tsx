import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Switch, Alert, Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { useDriverStore, RideStatus } from '../providers/DriverProvider';
import { RideActions } from '../components/RideActions';

export default function DriverDashboardScreen() {
  const router = useRouter();
  const { currentRide, history, online, loadHistoryFromBackend, setOnline, checkForIncomingOffer, acceptRequest, declineRequest, updateLocation, syncCurrentRide, setPickupDone, completeRide } = useDriverStore();
  const [locationWarningShown, setLocationWarningShown] = useState(false);
  const [incomingSeconds, setIncomingSeconds] = useState<number | null>(null);
  const incomingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sanitizedPassengerPhone = currentRide?.riderPhone?.replace(/[^\d+]/g, '');

  // Reset de l'avertissement lorsque le chauffeur repasse hors ligne
  useEffect(() => {
    if (!online) {
      setLocationWarningShown(false);
    }
  }, [online]);

  useEffect(() => {
    syncCurrentRide().catch(() => {});
  }, [syncCurrentRide]);

  useEffect(() => {
    if (!online) return;
    syncCurrentRide().catch(() => {});
  }, [online, syncCurrentRide]);

  useEffect(() => {
    loadHistoryFromBackend().catch(() => {});
  }, [loadHistoryFromBackend]);

  useEffect(() => {
    if (!online) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      await checkForIncomingOffer();
    };

    // Premier check immédiat
    tick();

    const interval = setInterval(tick, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [online, checkForIncomingOffer]);

  // Quand le chauffeur est en ligne, on envoie périodiquement sa position au backend
  useEffect(() => {
    if (!online) return;

    let cancelled = false;
    let interval: number | null = null;

    const startLocationLoop = async () => {
      try {
        const locationModule = await import('expo-location');
        const fallbackCoords = { lat: 6.367, lng: 2.425 };

        const ensurePermission = async () => {
          let perm = await locationModule.getForegroundPermissionsAsync();
          if (perm.status !== 'granted') {
            perm = await locationModule.requestForegroundPermissionsAsync();
          }
          return perm.status === 'granted';
        };

        const hasPermission = await ensurePermission();
        if (!hasPermission) {
          if (!locationWarningShown) {
            Alert.alert(
              'Localisation requise',
              "Activez la localisation pour recevoir des courses à proximité.",
              [
                { text: 'Plus tard', style: 'cancel' },
                { text: 'Ouvrir les réglages', onPress: () => { try { Linking.openSettings?.(); } catch {} } },
              ]
            );
            setLocationWarningShown(true);
          }

          // Même sans permission, on envoie une position approximative pour rester éligible côté backend.
          updateLocation(fallbackCoords.lat, fallbackCoords.lng);
          return;
        }

        const tick = async () => {
          if (cancelled) return;
          try {
            const loc = await locationModule.getCurrentPositionAsync({});
            updateLocation(loc.coords.latitude, loc.coords.longitude);
          } catch {
            updateLocation(fallbackCoords.lat, fallbackCoords.lng);
          }
        };

        // premier envoi immédiat
        await tick();
        interval = setInterval(tick, 15000) as unknown as number;
      } catch {
        // Même en cas d'erreur inattendue, on pousse une position de secours
        updateLocation(6.367, 2.425);
      }
    };

    startLocationLoop();

    return () => {
      cancelled = true;
      if (interval !== null) clearInterval(interval);
    };
  }, [online, updateLocation]);

  useEffect(() => {
    if (currentRide?.status !== 'incoming') {
      if (incomingTimerRef.current) {
        clearInterval(incomingTimerRef.current);
        incomingTimerRef.current = null;
      }
      setIncomingSeconds(null);
      return;
    }

    setIncomingSeconds(300);
    if (incomingTimerRef.current) {
      clearInterval(incomingTimerRef.current);
    }

    incomingTimerRef.current = setInterval(() => {
      setIncomingSeconds((prev) => {
        if (prev === null) return prev;
        return prev > 0 ? prev - 1 : 0;
      });
    }, 1000) as unknown as NodeJS.Timeout;

    return () => {
      if (incomingTimerRef.current) {
        clearInterval(incomingTimerRef.current);
        incomingTimerRef.current = null;
      }
    };
  }, [currentRide?.id, currentRide?.status]);

  useEffect(() => {
    if (!currentRide || currentRide.status !== 'incoming') return;
    if (incomingSeconds === 0) {
      declineRequest().catch(() => {});
    }
  }, [incomingSeconds, currentRide, declineRequest]);

  const formatCountdown = (value: number | null) => {
    if (value === null) return '--:--';
    const minutes = Math.floor(value / 60);
    const seconds = value % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const callPassenger = () => {
    if (!sanitizedPassengerPhone) return;
    Linking.openURL(`tel:${sanitizedPassengerPhone}`).catch(() =>
      Alert.alert('Erreur', "Impossible d'ouvrir l'application Téléphone.")
    );
  };

  const whatsappPassenger = () => {
    if (!sanitizedPassengerPhone) return;
    const digits = sanitizedPassengerPhone.replace(/[^\d]/g, '');
    if (!digits.length) return;
    const url = `https://wa.me/${digits}?text=${encodeURIComponent("Bonjour, je suis votre chauffeur.")}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Erreur', "Impossible d'ouvrir WhatsApp.")
    );
  };

  const todaySummary = useMemo(() => {
    const now = new Date();
    const sameDay = (t: Date | string | number | null | undefined) => {
      if (!t) return false;
      const d = new Date(t);
      return d.getFullYear() === now.getFullYear() &&
             d.getMonth() === now.getMonth() &&
             d.getDate() === now.getDate();
    };

    const todayRides = history.filter((r) => sameDay(r.completedAt));
    const totalRides = todayRides.length;
    const totalEarnings = todayRides.reduce((sum, r) => sum + (r.fare || 0), 0);

    return { totalRides, totalEarnings };
  }, [history]);

const rideStatusMeta: Record<RideStatus, { label: string; helper: string; tone: string; bg: string }> = {
  incoming: { label: 'Course en attente', helper: 'Accepte ou refuse cette proposition', tone: '#f97316', bg: '#fff7ed' },
  pickup: { label: 'En route vers le passager', helper: 'Confirme lorsque le passager est à bord', tone: '#0284c7', bg: '#e0f2fe' },
  ongoing: { label: 'Course en cours', helper: 'Termine la course à l’arrivée', tone: '#16a34a', bg: '#dcfce7' },
  completed: { label: 'Course terminée', helper: 'Course archivée', tone: '#0f172a', bg: '#e2e8f0' },
  cancelled: { label: 'Course annulée', helper: 'Course indisponible', tone: '#b91c1c', bg: '#fee2e2' },
};

  return (
    <SafeAreaView style={styles.container}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require('../../assets/images/LOGO_OR.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => router.push('/driver-menu')}
          activeOpacity={0.7}
        >
          <Ionicons name="menu" size={22} color="#222" />
        </TouchableOpacity>
      </View>

      {/* CONTENT */}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* STATUS CARD */}
        <View style={[styles.card, styles.statusCard]}>
          <View style={styles.statusHeader}>
            <Text style={styles.cardLabel}>Disponibilité</Text>
            <View style={[styles.statusBadge, online ? styles.statusBadgeOnline : styles.statusBadgeOffline]}>
              <View style={[styles.statusDot, online ? styles.onlineDot : styles.offlineDot]} />
              <Text style={[styles.statusBadgeText, online ? styles.online : styles.offline]}>
                {online ? 'En ligne' : 'Hors ligne'}
              </Text>
            </View>
          </View>
          <Text style={styles.statusSubtitle}>
            {online
              ? 'Vous êtes visible par les passagers proches.'
              : 'Repassez en ligne pour recevoir de nouvelles demandes.'}
          </Text>
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.statusLabel}>Basculer mon statut</Text>
              <Text style={styles.statusHelper}>Activez ou coupez les demandes en un geste.</Text>
            </View>
            <View style={styles.statusSwitchWrapper}>
              <Switch
                value={online}
                onValueChange={(value) => setOnline(value)}
                thumbColor={online ? '#22c55e' : '#f4f4f5'}
                trackColor={{ false: '#e5e7eb', true: '#bbf7d0' }}
              />
            </View>
          </View>
        </View>

        {/* QUICK METRICS */}
        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Courses ajd</Text>
            <Text style={styles.metricValue}>{todaySummary.totalRides}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Gains ajd</Text>
            <Text style={styles.metricValue}>{todaySummary.totalEarnings.toLocaleString('fr-FR')} FCFA</Text>
          </View>
        </View>

        {/* NEXT / CURRENT RIDE */}
        <View style={styles.card}>
          {currentRide ? (
            <>
              <View style={styles.cardHeader}>
                <Text style={styles.cardLabel}>{rideStatusMeta[currentRide.status].label}</Text>
                <View style={[styles.badge, { backgroundColor: rideStatusMeta[currentRide.status].bg }]}>
                  <Text style={[styles.badgeText, { color: rideStatusMeta[currentRide.status].tone }]}>
                    {currentRide.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.helperText}>{rideStatusMeta[currentRide.status].helper}</Text>

              <View style={styles.infoBlock}>
                <Text style={styles.line}>Départ</Text>
                <Text style={styles.value}>{currentRide.pickup}</Text>
                <Text style={[styles.line, { marginTop: 12 }]}>Destination</Text>
                <Text style={styles.value}>{currentRide.dropoff}</Text>
              </View>

              {currentRide.status === 'incoming' && (
                <View style={styles.incomingMeta}>
                  <View style={styles.incomingTimer}>
                    <Ionicons name="time-outline" size={18} color="#b45309" />
                    <Text style={styles.incomingTimerText}>
                      Expire dans {formatCountdown(incomingSeconds)}
                    </Text>
                  </View>
                  <Text style={styles.incomingHint}>
                    Réponds rapidement pour maximiser tes chances.
                  </Text>
                </View>
              )}

              {currentRide.riderName && (
                <View style={styles.passengerCard}>
                  <Text style={styles.passengerLabel}>Passager</Text>
                  <Text style={styles.passengerName}>
                    {currentRide.riderName}
                    {currentRide.riderPhone ? ` (${currentRide.riderPhone})` : ''}
                  </Text>
                  {currentRide.riderPhone && (
                    <View style={styles.contactRow}>
                      <TouchableOpacity style={[styles.contactBtn, styles.contactCall]} onPress={callPassenger}>
                        <Ionicons name="call" size={16} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={styles.contactText}>Appeler</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.contactBtn, styles.contactWhats]} onPress={whatsappPassenger}>
                        <Ionicons name="logo-whatsapp" size={16} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={styles.contactText}>WhatsApp</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {currentRide.status === 'incoming' ? (
                <RideActions
                  onAccept={async () => {
                    try {
                      await acceptRequest();
                    } finally {
                      syncCurrentRide().catch(() => {});
                    }
                  }}
                  onDecline={async () => {
                    await declineRequest();
                  }}
                />
              ) : currentRide.status === 'pickup' ? (
                <TouchableOpacity style={[styles.primaryAction, { backgroundColor: '#2563eb' }]} onPress={setPickupDone}>
                  <Text style={styles.primaryActionText}>Passager à bord</Text>
                </TouchableOpacity>
              ) : currentRide.status === 'ongoing' ? (
                <TouchableOpacity style={[styles.primaryAction, { backgroundColor: '#16a34a' }]} onPress={completeRide}>
                  <Text style={styles.primaryActionText}>Terminer la course</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.cardLabel}>Aucune course en cours</Text>
              <Text style={styles.empty}>Reste en ligne pour recevoir de nouvelles demandes.</Text>
            </>
          )}
        </View>

        {/* QUICK ACTIONS */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Raccourcis</Text>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(tabs)/two' as never)}>
              <Ionicons name="time-outline" size={20} color="#0f172a" />
              <View>
                <Text style={styles.quickActionLabel}>Historique</Text>
                <Text style={styles.quickActionHelper}>Consulte tes dernières courses</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(tabs)/wallet' as never)}>
              <Ionicons name="wallet-outline" size={20} color="#0f172a" />
              <View>
                <Text style={styles.quickActionLabel}>Portefeuille</Text>
                <Text style={styles.quickActionHelper}>Paiements et retraits</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* SUMMARY */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Résumé du jour</Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Courses</Text>
              <Text style={styles.summaryValue}>{todaySummary.totalRides}</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Gains</Text>
              <Text style={styles.summaryValue}>
                {todaySummary.totalEarnings.toLocaleString('fr-FR')} FCFA
              </Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

/* ------------------------------------------
   STYLES — UI/UX ÉPURÉ + PREMIUM
------------------------------------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  /* HEADER */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 14,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    elevation: 2,
  },

  headerLeft: {
    flex: 1,
  },

  logo: {
    width: 130,
    height: 36,
  },

  menuButton: {
    backgroundColor: '#fff',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 3,
  },

  /* CONTENT */
  content: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 40,
  },

  /* CARDS */
  card: {
    backgroundColor: 'white',
    width: '100%',
    padding: 18,
    borderRadius: 20,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLabel: {
    fontFamily: Fonts.unboundedBold,
    fontSize: 16,
    marginBottom: 4,
    color: Colors.black,
  },
  statusCard: {
    gap: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  statusBadgeOnline: {
    backgroundColor: '#dcfce7',
  },
  statusBadgeOffline: {
    backgroundColor: '#fee2e2',
  },
  statusBadgeText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 13,
  },
  statusSubtitle: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.gray,
  },
  helperText: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 16,
  },
  statusLabel: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 15,
    color: Colors.black,
  },
  statusHelper: {
    fontFamily: Fonts.titilliumWeb,
    color: Colors.gray,
    marginTop: 4,
    maxWidth: 200,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 18,
    padding: 16,
  },
  metricLabel: {
    fontFamily: Fonts.titilliumWeb,
    color: '#cbd5f5',
  },
  metricValue: {
    fontFamily: Fonts.unboundedBold,
    fontSize: 20,
    color: '#fff',
    marginTop: 6,
  },
  incomingMeta: {
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#fed7aa',
  },
  incomingTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  incomingTimerText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: '#b45309',
  },
  incomingHint: {
    marginTop: 6,
    fontFamily: Fonts.titilliumWeb,
    color: '#92400e',
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  badgeText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 12,
  },

  /* STATUS */
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  onlineDot: { backgroundColor: '#16a34a' },
  offlineDot: { backgroundColor: '#e11d48' },

  statusText: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 15,
  },
  online: { color: '#15803d' },
  offline: { color: '#be123c' },

  statusSwitchWrapper: {
    marginLeft: 12,
  },

  /* LINES */
  line: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    marginBottom: 4,
    color: Colors.black,
  },
  value: {
    color: Colors.primary,
    fontFamily: Fonts.titilliumWeb,
    flexWrap: 'wrap',
    flex: 1,
  },
  infoBlock: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
  },
  passengerCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  contactRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 10,
  },
  contactCall: { backgroundColor: '#2563eb' },
  contactWhats: { backgroundColor: '#0f9d58' },
  contactText: { color: '#fff', fontFamily: Fonts.titilliumWebBold },
  passengerLabel: {
    fontFamily: Fonts.titilliumWeb,
    color: Colors.gray,
    marginBottom: 4,
  },
  passengerName: {
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.black,
    marginBottom: 10,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1d4ed8',
    borderRadius: 999,
    paddingVertical: 10,
  },
  callButtonText: {
    color: '#fff',
    fontFamily: Fonts.titilliumWebBold,
  },
  primaryAction: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryActionText: {
    color: '#fff',
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
  },

  empty: {
    fontFamily: Fonts.titilliumWeb,
    color: Colors.gray,
    fontSize: 14,
  },

  /* SUMMARY */
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 20,
  },

  summaryItem: {
    flex: 1,
  },

  summaryLabel: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 13,
    color: Colors.gray,
    marginBottom: 4,
  },

  summaryValue: {
    fontFamily: Fonts.unboundedBold,
    fontSize: 20,
    color: Colors.black,
  },
  quickActionsRow: {
    marginTop: 10,
    gap: 12,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  quickActionLabel: {
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.black,
  },
  quickActionHelper: {
    fontFamily: Fonts.titilliumWeb,
    color: Colors.gray,
  },
});
