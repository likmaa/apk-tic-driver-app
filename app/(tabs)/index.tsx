import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Platform, Linking, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors, Gradients, Shadows } from '../../theme';
import { Fonts } from '../../font';
import { useDriverStore } from '../providers/DriverProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

// Nouveaux composants
import { ActionCard } from '../components/ActionCard';
import { StatCard } from '../components/StatCard';
import { OnlineToggle } from '../components/OnlineToggle';
import { MonthlyEarningsModal } from '../components/MonthlyEarningsModal';

// Constantes de spacing
const SPACING = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
};

export default function DriverDashboardScreen() {
  const router = useRouter();
  const { currentRide, availableOffers, lastLat, lastLng, history, online, setOnline, syncCurrentRide, acceptRequest, loadHistoryFromBackend } = useDriverStore();
  const [driverName, setDriverName] = useState<string>('Chauffeur');
  const [isTogglingOnline, setIsTogglingOnline] = useState(false);
  const [showMonthlyEarningsModal, setShowMonthlyEarningsModal] = useState(false);

  const [apiStats, setApiStats] = useState<{
    todayRides: number;
    todayEarnings: number;
    monthRides: number;
    monthEarnings: number;
  }>({ todayRides: 0, todayEarnings: 0, monthRides: 0, monthEarnings: 0 });
  const [walletBalance, setWalletBalance] = useState<number>(0);

  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  // Récupération du nom du chauffeur et stats depuis l'API
  useFocusEffect(
    useCallback(() => {
      const fetchDriverInfo = async () => {
        try {
          const userStr = await AsyncStorage.getItem('authUser');
          if (userStr) {
            const user = JSON.parse(userStr);
            if (user.name) {
              setDriverName(user.name);
            } else if (user.phone) {
              setDriverName(user.phone);
            }
          }
        } catch (error) {
          console.error('Erreur récupération profil:', error);
        }
      };

      // Fetch stats from backend API (source of truth)
      const fetchStatsFromAPI = async () => {
        try {
          if (!API_URL) return;
          const token = await AsyncStorage.getItem('authToken');
          if (!token) return;

          const now = new Date();

          // Today's date range
          const todayStr = now.toISOString().split('T')[0];

          // Month's date range
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
          const monthEnd = todayStr;

          // Fetch today stats
          const todayRes = await fetch(
            `${API_URL}/driver/stats?from=${encodeURIComponent(todayStr)}&to=${encodeURIComponent(todayStr)}`,
            {
              headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${token}`,
              },
            }
          );

          // Fetch month stats
          const monthRes = await fetch(
            `${API_URL}/driver/stats?from=${encodeURIComponent(monthStart)}&to=${encodeURIComponent(monthEnd)}`,
            {
              headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${token}`,
              },
            }
          );

          let todayData = { total_rides: 0, total_earnings: 0 };
          let monthData = { total_rides: 0, total_earnings: 0 };

          if (todayRes.ok) {
            todayData = await todayRes.json();
          }
          if (monthRes.ok) {
            monthData = await monthRes.json();
          }

          setApiStats({
            todayRides: todayData.total_rides || 0,
            todayEarnings: todayData.total_earnings || 0,
            monthRides: monthData.total_rides || 0,
            monthEarnings: monthData.total_earnings || 0,
          });
        } catch (error) {
          console.error('Erreur récupération stats API:', error);
        }
      };

      // Fetch wallet balance
      const fetchWalletBalance = async () => {
        try {
          if (!API_URL) return;
          const token = await AsyncStorage.getItem('authToken');
          if (!token) return;

          const res = await fetch(`${API_URL}/driver/wallet`, {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });

          if (res.ok) {
            const data = await res.json();
            setWalletBalance(Number(data.balance) || 0);
          }
        } catch (error) {
          console.error('Erreur récupération wallet:', error);
        }
      };

      fetchDriverInfo();
      fetchStatsFromAPI();
      fetchWalletBalance();
      loadHistoryFromBackend().catch(() => { }); // Sync history for modal
    }, [API_URL, loadHistoryFromBackend])
  );

  // Sync de la course actuelle
  useEffect(() => {
    syncCurrentRide().catch(() => { });
  }, [syncCurrentRide]);

  // Helper pour la distance locale
  const getDistanceToPickup = useCallback((pickupLat?: number, pickupLng?: number) => {
    if (!lastLat || !lastLng || !pickupLat || !pickupLng) return null;
    const R = 6371; // Radius of the earth in km
    const dLat = (pickupLat - lastLat) * Math.PI / 180;
    const dLon = (pickupLng - lastLng) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lastLat * Math.PI / 180) * Math.cos(pickupLat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d.toFixed(1);
  }, [lastLat, lastLng]);

  // État pour le timer visuel (simulation)
  const [timerProgress, setTimerProgress] = useState(1);
  useEffect(() => {
    if (availableOffers.length > 0) {
      const interval = setInterval(() => {
        setTimerProgress(p => Math.max(0, p - (1 / (300 * 10)))); // 5 mins
      }, 100);
      return () => clearInterval(interval);
    } else {
      setTimerProgress(1);
    }
  }, [availableOffers.length]);

  // Statistiques combinées (API values + live course status)
  const todayStats = useMemo(() => {
    // Courses en attente : on compte la course actuelle acceptée + les offres disponibles
    const acceptedRideCount = (currentRide && (currentRide.status === 'pickup' || currentRide.status === 'incoming' || currentRide.status === 'ongoing')) ? 1 : 0;
    const pendingOffersCount = availableOffers.length;
    const scheduledRides = acceptedRideCount + pendingOffersCount;

    return {
      completedRides: apiStats.todayRides,
      scheduledRides,
      totalEarnings: apiStats.todayEarnings,
      monthlyEarnings: apiStats.monthEarnings,
    };
  }, [apiStats, currentRide, availableOffers]);

  // Toggle en ligne/hors ligne avec loading state
  const handleToggleOnline = useCallback(async () => {
    try {
      setIsTogglingOnline(true);
      await setOnline(!online);
    } catch (error) {
      console.error('Erreur toggle online:', error);
    } finally {
      setIsTogglingOnline(false);
    }
  }, [online, setOnline]);

  // Navigation vers les différentes sections (mémorisées)
  const navigateToLocation = useCallback(async () => {
    console.log('🗺️ navigateToLocation appelée');
    try {
      // Récupérer la position actuelle
      console.log('📍 Demande de permission...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('📍 Status permission:', status);

      if (status !== 'granted') {
        console.log('❌ Permission refusée');
        Alert.alert(
          'Permission requise',
          'Activez la localisation pour voir votre position sur Google Maps.',
          [{ text: 'OK' }]
        );
        return;
      }

      console.log('📍 Récupération position...');
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      console.log('📍 Position:', latitude, longitude);

      // Ouvrir Google Maps avec la position actuelle
      const url = Platform.OS === 'ios'
        ? `http://maps.apple.com/?q=${latitude},${longitude}`
        : `geo:${latitude},${longitude}?q=${latitude},${longitude}`;

      console.log('🔗 URL:', url);
      console.log('📱 Platform:', Platform.OS);

      const canOpen = await Linking.canOpenURL(url);
      console.log('✅ Can open URL:', canOpen);

      if (canOpen) {
        console.log('🚀 Ouverture de l\'URL...');
        await Linking.openURL(url);
      } else {
        // Fallback vers Google Maps web
        const webUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
        console.log('🌐 Fallback web URL:', webUrl);
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error('❌ Erreur navigateToLocation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      Alert.alert(
        'Erreur',
        `Impossible d'ouvrir Google Maps: ${errorMessage}`,
        [{ text: 'OK' }]
      );
    }
  }, []);

  const navigateToRides = useCallback(() => {
    router.push('/historique');
  }, [router]);

  const navigateToMonthlyEarnings = useCallback(() => {
    setShowMonthlyEarningsModal(true);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header Premium */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.push('/driver-menu')}
          style={styles.headerAvatar}
        >
          <LinearGradient
            colors={Gradients.primary}
            style={styles.avatarIcon}
          >
            <Ionicons name="person" size={20} color="white" />
          </LinearGradient>
          <View>
            <Text style={styles.headerGreeting}>Bonjour,</Text>
            <Text style={styles.headerName}>{driverName}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/notifications')}
          style={styles.iconButton}
        >
          <Ionicons name="notifications-outline" size={24} color={Colors.black} />
          <View style={styles.dotIndicator} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.mainContent}>

          {/* Section Statut & Gains */}
          <View style={styles.topSection}>
            <ActionCard
              icon="wallet-outline"
              label="TIC Wallet"
              value={`${walletBalance.toLocaleString('fr-FR')} FCFA`}
              onPress={() => router.push('/screens/wallet')}
              fullWidth
              isWallet={true}
            />
          </View>

          {/* Statistiques du jour */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Aujourd'hui</Text>
          </View>
          <View style={styles.statsGrid}>
            <StatCard
              icon="car-sport"
              value={todayStats.completedRides}
              label="Courses"
              color={Colors.primary}
            />
            <StatCard
              icon="time"
              value={todayStats.scheduledRides}
              label="En attente"
              color={Colors.warning}
            />
            <StatCard
              icon="cash"
              value={`${todayStats.totalEarnings.toLocaleString('fr-FR')} F`}
              label="Gains"
              color={Colors.success}
            />
          </View>

          {/* Toggle Online principal */}
          <View style={styles.toggleWrapper}>
            <OnlineToggle
              isOnline={online}
              onToggle={handleToggleOnline}
              loading={isTogglingOnline}
            />
          </View>

          {/* Actions Rapides */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Actions rapides</Text>
          </View>
          <View style={styles.fastActions}>
            <ActionCard
              icon="map-outline"
              label="Carte"
              onPress={navigateToLocation}
            />
            <ActionCard
              icon="time-outline"
              label="Historique"
              onPress={navigateToRides}
            />
          </View>

          {/* OFFRES DISPONIBLES */}
          {!currentRide && availableOffers.length > 0 && (
            <View style={styles.offersSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Offres à proximité ({availableOffers.length})</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.offersScroll}
                snapToInterval={width - 40}
                decelerationRate="fast"
              >
                {availableOffers.map((offer) => {
                  const dist = getDistanceToPickup(offer.pickupLat, offer.pickupLon);
                  return (
                    <TouchableOpacity
                      key={offer.id}
                      style={[styles.offerCard, Shadows.md]}
                      onPress={() => router.push({ pathname: '/incoming', params: { rideId: offer.id } })}
                    >
                      <View style={styles.offerTimer}>
                        <View style={[styles.timerIndicator, { width: `${timerProgress * 100}%` }]} />
                      </View>

                      <View style={styles.offerBody}>
                        <View style={styles.offerInfo}>
                          <View style={styles.offerMainRow}>
                            <Text style={styles.offerTitle}>Nouvelle Offre</Text>
                            <Text style={styles.offerPrice}>{offer.fare.toLocaleString('fr-FR')} F</Text>
                          </View>
                          <Text style={styles.offerType}>
                            {offer.service_type === 'livraison' ? 'Livraison' : 'Course standard'} • {dist || '?'} km
                          </Text>
                        </View>

                        <View style={styles.offerRoute}>
                          <View style={styles.routePoint}>
                            <View style={styles.dotGreen} />
                            <Text style={styles.routeText} numberOfLines={1}>{offer.pickup}</Text>
                          </View>
                          <View style={styles.routePoint}>
                            <View style={styles.dotOrange} />
                            <Text style={styles.routeText} numberOfLines={1}>{offer.dropoff}</Text>
                          </View>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.offerAcceptBtn}
                        onPress={() => acceptRequest(offer.id)}
                      >
                        <LinearGradient
                          colors={Gradients.success}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.acceptBtnGradient}
                        >
                          <Text style={styles.acceptBtnText}>ACCEPTER L'OFFRE</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* COURSE ACTIVE */}
          {currentRide && (
            <TouchableOpacity
              style={[styles.activeRideBox, Shadows.lg]}
              onPress={() => {
                if (currentRide.status === 'incoming') {
                  router.push({ pathname: '/incoming', params: { rideId: currentRide.id } });
                } else if (currentRide.status === 'pickup' || currentRide.status === 'arrived') {
                  router.push('/pickup');
                } else if (currentRide.status === 'ongoing') {
                  router.push('/ride-ongoing');
                }
              }}
            >
              <LinearGradient
                colors={Gradients.primary}
                style={styles.activeRideGradient}
              >
                <View style={styles.activeRideHeader}>
                  <View style={styles.activeIconCircle}>
                    <Ionicons name="car-sport" size={24} color="white" />
                  </View>
                  <View style={styles.activeInfo}>
                    <Text style={styles.activeStatus}>COURSE EN COURS</Text>
                    <Text style={styles.activeMsg}>Appuyez pour voir les détails</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.5)" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* MODALE GAINS MENSUELS */}
      <MonthlyEarningsModal
        visible={showMonthlyEarningsModal}
        onClose={() => setShowMonthlyEarningsModal(false)}
        monthlyEarnings={apiStats.monthEarnings}
        totalRevenue={0} // Not needed with API-based earnings
        completedRidesCount={apiStats.monthRides}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  /* HEADER PREMIUM */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 15,
    backgroundColor: 'white',
  },
  headerAvatar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerGreeting: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 13,
    color: Colors.gray,
  },
  headerName: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: Colors.black,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
    borderWidth: 2,
    borderColor: 'white',
  },

  /* CONTENT */
  scrollContent: {
    flexGrow: 1,
  },
  mainContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },

  /* SECTIONS */
  topSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: Colors.black,
  },

  /* GRID STATS */
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },

  /* TOGGLE */
  toggleWrapper: {
    marginBottom: 24,
  },

  /* FAST ACTIONS */
  fastActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },

  /* OFFERS SECTION */
  offersSection: {
    marginBottom: 24,
  },
  offersScroll: {
    gap: 15,
    paddingBottom: 10,
  },
  offerCard: {
    width: width - 40,
    backgroundColor: 'white',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  offerTimer: {
    height: 4,
    backgroundColor: Colors.lightGray,
  },
  timerIndicator: {
    height: '100%',
    backgroundColor: Colors.secondary,
  },
  offerBody: {
    padding: 20,
  },
  offerInfo: {
    marginBottom: 15,
  },
  offerMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  offerTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 18,
    color: Colors.black,
  },
  offerPrice: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 20,
    color: Colors.secondary,
  },
  offerType: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 13,
    color: Colors.gray,
  },
  offerRoute: {
    gap: 10,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.success,
  },
  dotOrange: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.secondary,
  },
  routeText: {
    flex: 1,
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.black,
  },
  offerAcceptBtn: {
    height: 56,
  },
  acceptBtnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 15,
    color: 'white',
    letterSpacing: 1,
  },

  /* ACTIVE RIDE */
  activeRideBox: {
    marginVertical: 10,
    borderRadius: 24,
    overflow: 'hidden',
  },
  activeRideGradient: {
    padding: 20,
  },
  activeRideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  activeIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeInfo: {
    flex: 1,
  },
  activeStatus: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 14,
    color: 'white',
    letterSpacing: 1,
  },
  activeMsg: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
});
