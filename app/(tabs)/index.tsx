import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Platform, Linking, Alert, Dimensions, Image } from 'react-native';
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
import { getImageUrl } from '../utils/images';

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
  const [driverPhoto, setDriverPhoto] = useState<string | null>(null);
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

          // Récupérer la photo depuis le profil driver
          if (API_URL) {
            const token = await AsyncStorage.getItem('authToken');
            if (token) {
              const profileRes = await fetch(`${API_URL}/driver/profile`, {
                headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
              });
              if (profileRes.ok) {
                const profileData = await profileRes.json();
                const user = profileData.user ?? {};
                const profile = profileData.profile ?? null;
                const photo = profile?.photo || user.photo || null;
                if (photo) {
                  setDriverPhoto(getImageUrl(photo));
                }
                // Aussi mettre à jour le nom si dispo
                if (user.name) setDriverName(user.name);
              }
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
            {driverPhoto ? (
              <Image source={{ uri: driverPhoto }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={20} color="white" />
            )}
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

          {/* Section Gains Mensuels */}
          <View style={styles.topSection}>
            <ActionCard
              icon="trending-up"
              label="Gains mensuels"
              value={`${apiStats.monthEarnings.toLocaleString('fr-FR')} FCFA`}
              onPress={() => setShowMonthlyEarningsModal(true)}
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

          {/* OFFRES DISPONIBLES */}
          {!currentRide && availableOffers.length > 0 && (
            <View style={styles.offersSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Offres à proximité</Text>
                <View style={styles.offerBadgeCount}>
                  <Text style={styles.offerBadgeCountText}>{availableOffers.length}</Text>
                </View>
              </View>

              {availableOffers.map((offer) => {
                const dist = getDistanceToPickup(offer.pickupLat, offer.pickupLon);
                const isLivraison = offer.service_type === 'livraison';
                return (
                  <View key={offer.id} style={styles.offerCard}>
                    {/* Timer bar */}
                    <View style={styles.offerTimer}>
                      <View style={[styles.timerIndicator, { width: `${timerProgress * 100}%` }]} />
                    </View>

                    {/* Header : message */}
                    <TouchableOpacity
                      style={styles.offerHeader}
                      activeOpacity={0.7}
                      onPress={() => router.push({ pathname: '/incoming', params: { rideId: offer.id } })}
                    >
                      <Text style={styles.offerHeaderText}>
                        {isLivraison ? 'Nouvelle livraison disponible' : `Hey! ${driverName} un passager vous attend`}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color={Colors.primary} />
                    </TouchableOpacity>

                    {/* Info passager : prix + distance */}
                    <View style={styles.offerInfoRow}>
                      <View style={styles.offerPassenger}>
                        <Text style={styles.offerServiceLabel}>
                          {isLivraison ? 'Livraison' : 'Course standard'}
                        </Text>
                      </View>
                      <View style={styles.offerPriceBlock}>
                        <Text style={styles.offerPrice}>{offer.fare.toLocaleString('fr-FR')} F</Text>
                        {dist ? <Text style={styles.offerDist}>{dist} km</Text> : null}
                      </View>
                    </View>

                    {/* Route : pickup → dropoff */}
                    <View style={styles.offerRoute}>
                      {/* Pickup */}
                      <View style={styles.routeRow}>
                        <View style={styles.routeDotCol}>
                          <View style={styles.dotDark} />
                          <View style={styles.routeConnector} />
                        </View>
                        <View style={styles.routeInfo}>
                          <Text style={styles.routeLabel}>Point de départ</Text>
                          <Text style={styles.routeAddress} numberOfLines={1}>{offer.pickup}</Text>
                        </View>
                      </View>

                      {/* Dropoff */}
                      <View style={styles.routeRow}>
                        <View style={styles.routeDotCol}>
                          <View style={styles.dotGreen} />
                        </View>
                        <View style={styles.routeInfo}>
                          <Text style={styles.routeLabel}>Destination</Text>
                          <Text style={styles.routeAddress} numberOfLines={1}>{offer.dropoff}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Boutons Refuser / Accepter */}
                    <View style={styles.offerButtons}>
                      <TouchableOpacity
                        style={styles.declineBtn}
                        activeOpacity={0.7}
                        onPress={() => router.push({ pathname: '/incoming', params: { rideId: offer.id } })}
                      >
                        <Text style={styles.declineBtnText}>Détails</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        activeOpacity={0.8}
                        onPress={() => acceptRequest(offer.id)}
                      >
                        <LinearGradient
                          colors={['#FF8C00', '#FF6B00']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.acceptBtnGradient}
                        >
                          <Text style={styles.acceptBtnText}>Accepter</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

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
        totalRevenue={apiStats.monthEarnings}
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    marginBottom: 8,
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
    marginBottom: 8,
  },

  /* FAST ACTIONS */
  fastActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },

  /* OFFERS SECTION */
  offersSection: {
    marginBottom: 16,
  },
  offerBadgeCount: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    minWidth: 24,
    alignItems: 'center' as const,
  },
  offerBadgeCountText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 12,
    color: 'white',
  },
  offerCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  offerTimer: {
    height: 3,
    backgroundColor: '#F5F5F5',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden' as const,
  },
  timerIndicator: {
    height: '100%' as any,
    backgroundColor: Colors.success,
    borderRadius: 2,
  },
  offerHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  offerHeaderText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 14,
    color: Colors.primary,
  },
  offerInfoRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  offerPassenger: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  offerAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  offerServiceLabel: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: Colors.black,
  },
  offerPriceBlock: {
    alignItems: 'flex-end' as const,
  },
  offerPrice: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 20,
    color: Colors.primary,
  },
  offerDist: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 13,
    color: Colors.gray,
    marginTop: 2,
  },
  offerRoute: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  routeRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
  },
  routeDotCol: {
    alignItems: 'center' as const,
    width: 20,
    paddingTop: 4,
  },
  dotDark: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.black,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  dotGreen: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: '#D1FAE5',
  },
  routeConnector: {
    width: 2,
    height: 24,
    backgroundColor: '#E0E0E0',
    marginVertical: 2,
  },
  routeInfo: {
    flex: 1,
    paddingBottom: 4,
  },
  routeLabel: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 12,
    color: Colors.gray,
    marginBottom: 2,
  },
  routeAddress: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 15,
    color: Colors.black,
  },
  offerButtons: {
    flexDirection: 'row' as const,
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 18,
    paddingTop: 6,
  },
  declineBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    paddingVertical: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  declineBtnText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 15,
    color: Colors.black,
  },
  acceptBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden' as const,
  },
  acceptBtnGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 14,
  },
  acceptBtnText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 15,
    color: 'white',
  },

  /* ACTIVE RIDE */
  activeRideBox: {
    marginVertical: 10,
    borderRadius: 24,
    overflow: 'hidden' as const,
  },
  activeRideGradient: {
    padding: 20,
  },
  activeRideHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 15,
  },
  activeIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
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
