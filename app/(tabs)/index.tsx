import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Switch, Alert, Linking, ScrollView, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { useDriverStore, RideStatus } from '../providers/DriverProvider';
import { RideActions } from '../components/RideActions';
import { API_URL } from '../config';

export default function DriverDashboardScreen() {
  const router = useRouter();
  const { currentRide, history, online, loadHistoryFromBackend, setOnline, checkForIncomingOffer, acceptRequest, declineRequest, updateLocation, syncCurrentRide, setPickupDone, completeRide } = useDriverStore();
  const [locationWarningShown, setLocationWarningShown] = useState(false);
  const [incomingSeconds, setIncomingSeconds] = useState<number | null>(null);
  const incomingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sanitizedPassengerPhone = currentRide?.riderPhone?.replace(/[^\d+]/g, '');
  const [driverName, setDriverName] = useState<string>('Chauffeur');
  const [driverPhoto, setDriverPhoto] = useState<string | null>(null);
  const [hasNotifications, setHasNotifications] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;



  // Fonction de debug pour nettoyer AsyncStorage
  const clearStorage = async () => {
    Alert.alert(
      '🧹 Nettoyer AsyncStorage',
      'Voulez-vous vraiment supprimer toutes les données locales ? Cela vous déconnectera.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Nettoyer',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                'authToken',
                'authUser',
                'driver_has_seen_onboarding',
                'driverAcceptedContract',
                'driver_online',
                'driver_history',
                'driver_nav_pref',
              ]);
              Alert.alert('✅ Succès', 'AsyncStorage nettoyé ! Redirection...', [
                {
                  text: 'OK',
                  onPress: () => {
                    router.replace('/driver-onboarding' as any);
                  },
                },
              ]);
            } catch (error) {
              Alert.alert('❌ Erreur', 'Impossible de nettoyer AsyncStorage: ' + error);
            }
          },
        },
      ]
    );
  };

  // Charger les informations du chauffeur
  useEffect(() => {
    const loadDriverInfo = async () => {
      try {
        const userStr = await AsyncStorage.getItem('authUser');
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user.name) {
            // Extraire le prénom seulement
            const firstName = user.name.split(' ')[0];
            setDriverName(firstName);
          }
          if (user.photo) {
            setDriverPhoto(user.photo);
          }
        }
      } catch (error) {
        console.error('Erreur lors du chargement des infos du chauffeur:', error);
      }
    };
    loadDriverInfo();
  }, []);

  // Animation de pulsation pour la Power Card quand en ligne
  useEffect(() => {
    if (online) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [online, pulseAnim]);

  // Reset de l'avertissement lorsque le chauffeur repasse hors ligne
  useEffect(() => {
    if (!online) {
      setLocationWarningShown(false);
    }
  }, [online]);

  // Synchronisation unique de la course actuelle
  useEffect(() => {
    syncCurrentRide().catch((error) => {
      console.warn('[Dashboard] Erreur lors de la synchronisation de la course:', error);
    });
  }, [syncCurrentRide, online]);

  useEffect(() => {
    loadHistoryFromBackend().catch(() => {});
  }, [loadHistoryFromBackend]);

  // Le polling a été remplacé par WebSocket dans DriverProvider
  // On garde juste un check initial au démarrage pour récupérer les offres manquées
  useEffect(() => {
    if (!online) {
      console.log('[Dashboard] Chauffeur hors ligne');
      return;
    }

    console.log('[Dashboard] Chauffeur en ligne, vérification initiale des offres');
    // Vérification unique au démarrage (WebSocket gère le reste)
    checkForIncomingOffer().catch((error) => {
      console.warn('[Dashboard] Erreur lors de la vérification initiale des offres:', error);
    });
  }, [online, checkForIncomingOffer]);

  // Quand le chauffeur est en ligne, on envoie périodiquement sa position au backend
  useEffect(() => {
    if (!online) {
      console.log('[Dashboard] Chauffeur hors ligne, arrêt de la boucle de localisation');
      return;
    }

    console.log('[Dashboard] Chauffeur en ligne, démarrage de la boucle de localisation');
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

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
          // Ne pas appeler updateLocation() sans permission pour éviter d'écraser la vraie position
          console.warn('[Dashboard] Permission de localisation refusée, arrêt de la boucle de localisation');
          return;
        }

        const tick = async () => {
          if (cancelled) return;
          try {
            // Timeout de 10 secondes pour éviter que getCurrentPositionAsync reste bloqué
            const locationPromise = locationModule.getCurrentPositionAsync({
              accuracy: locationModule.Accuracy.Balanced,
            });
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('Timeout de localisation (10s)')), 10000);
            });
            
            const loc = await Promise.race([locationPromise, timeoutPromise]);
            updateLocation(loc.coords.latitude, loc.coords.longitude);
            console.log('[Dashboard] Position mise à jour:', loc.coords.latitude, loc.coords.longitude);
          } catch (error) {
            console.warn('[Dashboard] Erreur lors de la récupération de la position:', error);
            // Ne pas utiliser fallbackCoords automatiquement - laisser l'utilisateur corriger
          }
        };

        // premier envoi immédiat
        await tick();
        interval = setInterval(tick, 15000);
      } catch (error) {
        console.error('[Dashboard] Erreur dans startLocationLoop:', error);
        // Ne pas envoyer de position de secours automatiquement
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

    console.log('[Dashboard] Course incoming détectée, démarrage du timer de 5 minutes');
    setIncomingSeconds(300);
    if (incomingTimerRef.current) {
      clearInterval(incomingTimerRef.current);
    }

    incomingTimerRef.current = setInterval(() => {
      setIncomingSeconds((prev) => {
        if (prev === null) return prev;
        return prev > 0 ? prev - 1 : 0;
      });
    }, 1000);

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
      console.log('[Dashboard] Timer de course incoming expiré, refus automatique');
      declineRequest().catch((error) => {
        Alert.alert('Erreur', 'Impossible de refuser la course. Veuillez réessayer.');
        console.error('[Dashboard] Erreur lors du refus de la course:', error);
      });
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

    // Calculer l'objectif (par exemple 80% de l'objectif de 20000 FCFA)
    const dailyGoal = 20000;
    const goalProgress = Math.min((totalEarnings / dailyGoal) * 100, 100);

    return { totalRides, totalEarnings, goalProgress, dailyGoal };
  }, [history]);

  // Récupérer les 3 dernières courses pour "Activités récentes"
  const recentActivities = useMemo(() => {
    return history
      .filter((r) => r.status === 'completed')
      .sort((a, b) => {
        const dateA = new Date(a.completedAt || a.createdAt || 0).getTime();
        const dateB = new Date(b.completedAt || b.createdAt || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 3);
  }, [history]);

const rideStatusMeta: Record<RideStatus, { label: string; helper: string; tone: string; bg: string }> = {
  incoming: { label: 'Course en attente', helper: 'Accepte ou refuse cette proposition', tone: '#f97316', bg: '#fff7ed' },
  pickup: { label: 'En route vers le passager', helper: 'Confirme lorsque le passager est à bord', tone: '#0284c7', bg: '#e0f2fe' },
  ongoing: { label: 'Course en cours', helper: 'Termine la course à l’arrivée', tone: '#16a34a', bg: '#dcfce7' },
  completed: { label: 'Course terminée', helper: 'Course archivée', tone: '#0f172a', bg: '#e2e8f0' },
  cancelled: { label: 'Course annulée', helper: 'Course indisponible', tone: '#b91c1c', bg: '#fee2e2' },
};

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      
      {/* HEADER ÉPURÉ */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Bonjour,</Text>
            <Text style={styles.driverName}>{driverName}</Text>
          </View>

          <View style={styles.headerRight}>
            {hasNotifications && (
              <View style={styles.notificationBadge}>
                <View style={styles.notificationDot} />
              </View>
            )}
            <TouchableOpacity
              style={styles.profileImageContainer}
              onPress={() => router.push('/(tabs)/driver-menu')}
              activeOpacity={0.7}
            >
              {driverPhoto ? (
                <Image source={{ uri: driverPhoto }} style={styles.profileImage} />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Ionicons name="person" size={20} color={Colors.primary} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* CONTENT */}
      <ScrollView 
        contentContainerStyle={styles.content} 
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* POWER CARD - Zone de Contrôle */}
        <Animated.View
          style={[
            styles.powerCard,
            online ? styles.powerCardOnline : styles.powerCardOffline,
            online && { transform: [{ scale: pulseAnim }] }
          ]}
        >
          <TouchableOpacity
            onPress={() => setOnline(!online)}
            activeOpacity={0.9}
            style={styles.powerCardTouchable}
          >
            {online ? (
              <>
                <View style={styles.powerCardContent}>
                <Text style={styles.powerCardTitle}>En ligne</Text>
                <Text style={styles.powerCardSubtitle}>Recherche de course...</Text>
                </View>
                <View style={styles.powerButton}>
                  <Ionicons name="power" size={28} color="#FFFFFF" />
                </View>
                <View style={styles.pulseIndicator} />
              </>
            ) : (
              <>
                <View style={styles.powerCardContent}>
                  <Text style={styles.powerCardTitleOffline}>Hors ligne</Text>
                </View>
                <View style={styles.powerButtonOffline}>
                  <Ionicons name="power" size={28} color="#FFFFFF" />
                </View>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* STATISTIQUES - Grille */}
        <View style={styles.statsGrid}>
          {/* Carte Principale - Gains */}
          <View style={styles.earningsCard}>
            <Text style={styles.earningsLabel}>Gains du jour</Text>
            <View style={styles.earningsRow}>
              <Text style={styles.earningsAmount}>
                {todaySummary.totalEarnings.toLocaleString('fr-FR')} FCFA
              </Text>
              <View style={styles.earningsTrend}>
                <Ionicons name="trending-up" size={16} color="#10B981" />
                <Text style={styles.earningsTrendText}>+12%</Text>
              </View>
            </View>
          </View>

          {/* Carte Objectif */}
          <View style={styles.goalCard}>
            <Text style={styles.goalLabel}>Objectif journalier</Text>
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { width: `${todaySummary.goalProgress}%` }
                  ]} 
                />
              </View>
            </View>
            <Text style={styles.goalProgressText}>
              {Math.round(todaySummary.goalProgress)}% atteint
            </Text>
          </View>
        </View>

        {/* COURSE ACTUELLE */}
        {currentRide ? (
          <View style={styles.rideCard}>
            <View style={styles.rideCardHeader}>
              <View style={styles.rideStatusContainer}>
                <View style={[styles.rideStatusBadge, { backgroundColor: rideStatusMeta[currentRide.status]?.bg || '#F3F4F6' }]}>
                  <Text style={[styles.rideStatusText, { color: rideStatusMeta[currentRide.status]?.tone || '#6B7280' }]}>
                    {rideStatusMeta[currentRide.status]?.label ?? currentRide.status}
                  </Text>
                </View>
              </View>
              {currentRide.status === 'incoming' && (
                <View style={styles.timerContainer}>
                  <Ionicons name="time" size={16} color="#F59E0B" />
                  <Text style={styles.timerText}>{formatCountdown(incomingSeconds)}</Text>
                </View>
              )}
            </View>

            <View style={styles.rideDetails}>
              <View style={styles.locationRow}>
                <View style={[styles.locationDot, styles.pickupDot]} />
                <View style={styles.locationContent}>
                  <Text style={styles.locationLabel}>Départ</Text>
                  <Text style={styles.locationAddress}>{currentRide.pickup}</Text>
                </View>
              </View>

              <View style={styles.locationDivider} />

              <View style={styles.locationRow}>
                <View style={[styles.locationDot, styles.dropoffDot]} />
                <View style={styles.locationContent}>
                  <Text style={styles.locationLabel}>Destination</Text>
                  <Text style={styles.locationAddress}>{currentRide.dropoff}</Text>
                </View>
              </View>
            </View>

            {currentRide.riderName && (
              <View style={styles.passengerSection}>
                <View style={styles.passengerInfo}>
                  <View style={styles.passengerAvatar}>
                    <Ionicons name="person" size={20} color={Colors.primary} />
                  </View>
                  <View style={styles.passengerDetails}>
                    <Text style={styles.passengerName}>{currentRide.riderName}</Text>
                    {currentRide.riderPhone && (
                      <Text style={styles.passengerPhone}>{currentRide.riderPhone}</Text>
                    )}
                  </View>
                </View>
                {currentRide.riderPhone && (
                  <View style={styles.contactButtons}>
                    <TouchableOpacity style={styles.contactButton} onPress={callPassenger}>
                      <Ionicons name="call" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.contactButton, styles.whatsappButton]} onPress={whatsappPassenger}>
                      <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
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
                    syncCurrentRide().catch((error) => {
                      console.warn('Erreur lors de la synchronisation de la course:', error);
                    });
                  }
                }}
                onDecline={async () => {
                  await declineRequest();
                }}
              />
            ) : currentRide.status === 'pickup' ? (
              <TouchableOpacity style={styles.actionButton} onPress={setPickupDone}>
                <Text style={styles.actionButtonText}>Passager à bord</Text>
              </TouchableOpacity>
            ) : currentRide.status === 'ongoing' ? (
              <TouchableOpacity style={[styles.actionButton, styles.actionButtonSuccess]} onPress={completeRide}>
                <Text style={styles.actionButtonText}>Terminer la course</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <>
            {/* CARTE DES COURSES DISPONIBLES */}
            {online && (
              <View style={styles.availableRidesCard}>
                <View style={styles.availableRidesHeader}>
                  <View style={styles.availableRidesHeaderLeft}>
                    <Ionicons name="car" size={24} color={Colors.primary} />
                    <Text style={styles.availableRidesTitle}>Courses disponibles</Text>
                  </View>
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        await checkForIncomingOffer();
                      } catch (error) {
                        console.error('Erreur lors de la vérification des courses:', error);
                      }
                    }}
                    style={styles.refreshButton}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="refresh" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.availableRidesDescription}>
                  Restez en ligne pour recevoir des demandes de course. Les nouvelles demandes apparaîtront ici.
                </Text>
                <View style={styles.availableRidesStatus}>
                  <View style={styles.statusIndicator}>
                    <View style={styles.statusIndicatorDot} />
                  </View>
                  <Text style={styles.availableRidesStatusText}>
                    En attente de nouvelles demandes...
                  </Text>
                </View>
              </View>
            )}

            {/* ACTIVITÉS RÉCENTES */}
            <View style={styles.activitiesSection}>
              <Text style={styles.activitiesTitle}>Activités récentes</Text>
            
            {recentActivities.length > 0 ? (
              <View style={styles.activitiesList}>
                {recentActivities.map((ride, index) => {
                  const date = new Date(ride.completedAt || ride.createdAt || 0);
                  const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                  
                  return (
                    <View key={ride.id || index} style={styles.activityItem}>
                      <View style={styles.activityIcon}>
                        <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                      </View>
                      <View style={styles.activityContent}>
                        <Text style={styles.activityDescription}>
                          Course terminée • {timeStr}
                        </Text>
                        <Text style={styles.activityAmount}>
                          {ride.fare?.toLocaleString('fr-FR') || '0'} FCFA
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.tipCard}>
                <View style={styles.tipIcon}>
                  <Ionicons name="flash" size={24} color={Colors.secondary} />
                </View>
                <View style={styles.tipContent}>
                  <Text style={styles.tipTitle}>Conseil du jour</Text>
                  <Text style={styles.tipText}>
                    Les zones à forte demande sont actuellement à Cinquantenaire. Déplacez-vous pour plus de gains.
                  </Text>
                </View>
              </View>
            )}
          </View>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

/* ------------------------------------------
   STYLES — DESIGN ÉPURÉ & PROFESSIONNEL
   Spécifications détaillées
------------------------------------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FD',
  },

  /* HEADER ÉPURÉ */
  header: {
    backgroundColor: '#F8F9FD',
    paddingBottom: 16,
    paddingTop: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 15,
    color: Colors.gray,
    marginBottom: 2,
  },
  driverName: {
    fontFamily: Fonts.unboundedBold,
    fontSize: 22,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: 48,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  notificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.secondary,
  },
  profileImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profileImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* CONTENT */
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
  },

  /* POWER CARD - Zone de Contrôle */
  powerCard: {
    borderRadius: 20,
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 100,
  },
  powerCardTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    minHeight: 100,
  },
  powerCardOnline: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  powerCardOffline: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  powerCardContent: {
    flex: 1,
  },
  powerCardTitle: {
    fontFamily: Fonts.unboundedBold,
    fontSize: 24,
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: 1,
  },
  powerCardTitleOffline: {
    fontFamily: Fonts.unboundedBold,
    fontSize: 24,
    color: Colors.black,
    letterSpacing: 1,
  },
  powerCardSubtitle: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: '#FFFFFF',
    fontStyle: 'italic',
    opacity: 0.9,
  },
  powerButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  powerButtonOffline: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.secondary,
    opacity: 0.8,
  },

  /* STATISTIQUES - Grille */
  statsGrid: {
    gap: 16,
    marginBottom: 20,
  },
  earningsCard: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 20,
    shadowColor: Colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  earningsLabel: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  earningsAmount: {
    fontFamily: Fonts.unboundedBold,
    fontSize: 32,
    color: '#FFFFFF',
    lineHeight: 38,
  },
  earningsTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  earningsTrendText: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  goalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  goalLabel: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 11,
    color: Colors.gray,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  progressBarContainer: {
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.secondary,
    borderRadius: 4,
  },
  goalProgressText: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.black,
    fontWeight: '600',
  },

  /* RIDE CARD */
  rideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  rideCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  rideStatusContainer: {
    flex: 1,
  },
  rideStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  rideStatusText: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 13,
    fontWeight: '600',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  timerText: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: '#D97706',
    fontWeight: '600',
  },
  rideDetails: {
    marginBottom: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
    marginTop: 6,
  },
  pickupDot: {
    backgroundColor: '#3B82F6',
  },
  dropoffDot: {
    backgroundColor: '#10B981',
  },
  locationContent: {
    flex: 1,
    paddingBottom: 16,
  },
  locationLabel: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 12,
    color: Colors.gray,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  locationAddress: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 15,
    color: Colors.black,
    lineHeight: 22,
    fontWeight: '600',
  },
  locationDivider: {
    height: 20,
    width: 2,
    backgroundColor: '#E5E7EB',
    marginLeft: 5,
    marginBottom: 4,
  },
  passengerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginBottom: 16,
  },
  passengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  passengerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  passengerDetails: {
    flex: 1,
  },
  passengerName: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 16,
    color: Colors.black,
    marginBottom: 2,
    fontWeight: '600',
  },
  passengerPhone: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.gray,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  contactButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  actionButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  actionButtonSuccess: {
    backgroundColor: '#10B981',
  },
  actionButtonText: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  /* CARTE DES COURSES DISPONIBLES */
  availableRidesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  availableRidesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  availableRidesHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  availableRidesTitle: {
    fontFamily: Fonts.unboundedBold,
    fontSize: 18,
    color: Colors.black,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  availableRidesDescription: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.gray,
    lineHeight: 20,
    marginBottom: 16,
  },
  availableRidesStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  availableRidesStatusText: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.gray,
    flex: 1,
  },

  /* ACTIVITÉS RÉCENTES */
  activitiesSection: {
    marginBottom: 20,
  },
  activitiesTitle: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 18,
    color: Colors.black,
    marginBottom: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  activitiesList: {
    gap: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityDescription: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 4,
  },
  activityAmount: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 16,
    color: Colors.black,
    fontWeight: '600',
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  tipIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontFamily: Fonts.unboundedBold,
    fontSize: 16,
    color: Colors.black,
    marginBottom: 6,
  },
  tipText: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.gray,
    lineHeight: 20,
  },

  /* RACCOURCIS (si nécessaire) */
  quickActionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    fontFamily: Fonts.unboundedBold,
    fontSize: 18,
    color: Colors.black,
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionItem: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quickActionLabel: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.black,
    textAlign: 'center',
    fontWeight: '600',
  },
});
