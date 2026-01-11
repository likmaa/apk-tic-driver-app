import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Platform, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { useDriverStore } from '../providers/DriverProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const { currentRide, history, online, setOnline, syncCurrentRide } = useDriverStore();
  const [driverName, setDriverName] = useState<string>('Chauffeur');
  const [isTogglingOnline, setIsTogglingOnline] = useState(false);
  const [showMonthlyEarningsModal, setShowMonthlyEarningsModal] = useState(false);

  // Récupération du nom du chauffeur
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
      fetchDriverInfo();
    }, [])
  );

  // Sync de la course actuelle
  useEffect(() => {
    syncCurrentRide().catch(() => { });
  }, [syncCurrentRide]);

  // Calcul des statistiques du jour et du mois
  const todayStats = useMemo(() => {
    const now = new Date();
    const sameDay = (t: Date | string | number | null | undefined) => {
      if (!t) return false;
      const d = new Date(t);
      return d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
    };

    const sameMonth = (t: Date | string | number | null | undefined) => {
      if (!t) return false;
      const d = new Date(t);
      return d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth();
    };

    const completedRidesHistory = history.filter(r => r.status === 'completed');

    const todayRides = completedRidesHistory.filter((r) => sameDay(r.completedAt));
    const monthRides = completedRidesHistory.filter((r) => sameMonth(r.completedAt));

    const completedRidesCount = todayRides.length;

    // Courses en attente : on compte la course actuelle si elle n'est pas encore terminée
    const scheduledRides = (currentRide && (currentRide.status === 'pickup' || currentRide.status === 'incoming' || currentRide.status === 'ongoing')) ? 1 : 0;

    const totalEarnings = todayRides.reduce((sum, r) => sum + ((r.driverEarnings ?? r.fare) || 0), 0);

    // Calcul des gains du mois (15% des revenus totaux)
    const monthTotalRevenue = monthRides.reduce((sum, r) => sum + (r.fare || 0), 0);
    const monthlyEarnings = Math.round(monthTotalRevenue * 0.15);

    return { completedRides: completedRidesCount, scheduledRides, totalEarnings, monthlyEarnings };
  }, [history, currentRide]);

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

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.push('/driver-menu')}
          accessibilityLabel="Ouvrir le menu"
          accessibilityRole="button"
        >
          <Ionicons name="menu" size={26} color={Colors.black} />
        </TouchableOpacity>

        <Text style={styles.welcomeText}>Bonjour {driverName} !</Text>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.push('/notifications')}
          accessibilityLabel="Voir les notifications"
          accessibilityRole="button"
        >
          <Ionicons name="notifications-outline" size={26} color={Colors.black} />
          <View style={styles.notificationBadge} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* CONTENU PRINCIPAL */}
        <View style={styles.mainContent}>

          {/* ACTIONS RAPIDES */}
          <View style={styles.actionsContainer}>
            <View style={styles.actionsRow}>
              <ActionCard
                icon="location"
                label="Ma Position"
                onPress={navigateToLocation}
              />
              <ActionCard
                icon="list"
                label="Mes Courses"
                onPress={navigateToRides}
              />
            </View>
            <ActionCard
              icon="cash"
              label="Gains du mois"
              value={`${todayStats.monthlyEarnings.toLocaleString('fr-FR')} F`}
              onPress={navigateToMonthlyEarnings}
              fullWidth
            />
          </View>

          {/* STATISTIQUES */}
          <View style={styles.statsContainer}>
            <StatCard
              icon="checkmark-circle"
              value={todayStats.completedRides}
              label="Courses terminées"
              color="#10B981"
            />
            <StatCard
              icon="time-outline"
              value={todayStats.scheduledRides}
              label="En attente"
              color="#F59E0B"
            />
            <StatCard
              icon="cash-outline"
              value={`${todayStats.totalEarnings.toLocaleString('fr-FR')} F`}
              label="Gains du jour"
              color={Colors.primary}
            />
          </View>

          {/* TOGGLE EN LIGNE */}
          <View style={styles.toggleContainer}>
            <OnlineToggle
              isOnline={online}
              onToggle={handleToggleOnline}
              loading={isTogglingOnline}
            />
          </View>

          {/* COURSE ACTIVE (si existe) */}
          {currentRide && (
            <TouchableOpacity
              style={styles.activeRideCard}
              onPress={() => {
                if (currentRide.status === 'incoming') {
                  router.push('/incoming');
                } else if (currentRide.status === 'pickup' || currentRide.status === 'arrived') {
                  router.push('/pickup');
                } else if (currentRide.status === 'ongoing') {
                  router.push('/ride-ongoing');
                }
              }}
              accessibilityLabel="Voir les détails de la course"
              accessibilityRole="button"
            >
              <View style={styles.rideHeader}>
                <View style={styles.rideIconContainer}>
                  <Ionicons name="car-sport" size={24} color={Colors.primary} />
                </View>
                <View style={styles.rideInfo}>
                  <Text style={styles.rideTitle}>Course en cours</Text>
                  <Text style={styles.rideSubtitle}>
                    {currentRide.status === 'pickup' ? 'En route vers le passager' :
                      currentRide.status === 'arrived' ? 'Arrivé au point de prise en charge' :
                        'Course en cours'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={Colors.gray} />
              </View>

              <View style={styles.rideDetails}>
                <View style={styles.rideLocation}>
                  <Ionicons name="location" size={16} color={Colors.primary} />
                  <Text style={styles.rideLocationText} numberOfLines={1}>
                    {currentRide.pickup}
                  </Text>
                </View>
                <View style={styles.rideLocation}>
                  <Ionicons name="flag" size={16} color="#10B981" />
                  <Text style={styles.rideLocationText} numberOfLines={1}>
                    {currentRide.dropoff}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* ESPACE EN BAS */}
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* MODALE GAINS MENSUELS */}
      <MonthlyEarningsModal
        visible={showMonthlyEarningsModal}
        onClose={() => setShowMonthlyEarningsModal(false)}
        monthlyEarnings={todayStats.monthlyEarnings}
        totalRevenue={history
          .filter((r) => {
            const now = new Date();
            const d = new Date(r.completedAt || '');
            return r.status === 'completed' && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
          })
          .reduce((sum, r) => sum + (r.fare || 0), 0)
        }
        completedRidesCount={history
          .filter((r) => {
            const now = new Date();
            const d = new Date(r.completedAt || '');
            return r.status === 'completed' && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
          })
          .length
        }
      />
    </SafeAreaView>
  );
}

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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: Colors.primary,
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: 'white',
  },

  /* SCROLL CONTENT */
  scrollContent: {
    flexGrow: 1,
  },

  /* MAIN CONTENT */
  mainContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },

  /* ACTIONS */
  actionsContainer: {
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },

  /* STATS */
  statsContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },

  /* TOGGLE */
  toggleContainer: {
    marginBottom: SPACING.lg,
  },

  /* ACTIVE RIDE CARD */
  activeRideCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 20,
  },
  rideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rideIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(0,102,204,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rideInfo: {
    flex: 1,
  },
  rideTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 15,
    color: Colors.black,
    marginBottom: 2,
  },
  rideSubtitle: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 13,
    color: Colors.gray,
  },
  rideDetails: {
    gap: 8,
  },
  rideLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rideLocationText: {
    flex: 1,
    fontFamily: Fonts.titilliumWeb,
    fontSize: 13,
    color: Colors.black,
  },
});
