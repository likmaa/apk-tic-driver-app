import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Switch, Alert, Linking, ScrollView, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors } from '../../theme';
import { Fonts } from '../../font';
import { useDriverStore, RideStatus } from '../providers/DriverProvider';
import { RideActions } from '../components/RideActions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { API_URL } from '../config';

export default function DriverDashboardScreen() {
  const router = useRouter();
  const { currentRide, history, online, loadHistoryFromBackend, setOnline, checkForIncomingOffer, acceptRequest, declineRequest, updateLocation, syncCurrentRide, setPickupDone, completeRide } = useDriverStore();
  const [locationWarningShown, setLocationWarningShown] = useState(false);
  const [driverIdentifier, setDriverIdentifier] = useState<string>('Chauffeur');
  const [incomingSeconds, setIncomingSeconds] = useState<number | null>(null);
  const incomingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sanitizedPassengerPhone = currentRide?.riderPhone?.replace(/[^\d+]/g, '');

  // Animation pulsation pour la Power Card En Ligne
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (online) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
      pulseAnim.stopAnimation();
    }
  }, [online]);

  // Récupération du profil (téléphone) - Fallback initial
  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const userStr = await AsyncStorage.getItem('authUser');
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user.phone) {
            setDriverIdentifier(user.phone);
          }
        }
      } catch { }
    };
    fetchInfo();
  }, []);

  // Récupération du profil (Nom > Téléphone) à chaque focus
  useFocusEffect(
    useCallback(() => {
      const fetchInfo = async () => {
        try {
          const userStr = await AsyncStorage.getItem('authUser');
          if (userStr) {
            const user = JSON.parse(userStr);
            // On privilégie le nom, sinon le téléphone
            if (user.name) {
              setDriverIdentifier(user.name);
            } else if (user.phone) {
              setDriverIdentifier(user.phone);
            }
          }
        } catch { }
      };
      fetchInfo();
    }, [])
  );

  // Reset de l'avertissement lorsque le chauffeur repasse hors ligne
  useEffect(() => {
    if (!online) {
      setLocationWarningShown(false);
    }
  }, [online]);

  useEffect(() => {
    syncCurrentRide().catch(() => { });
  }, [syncCurrentRide]);

  useEffect(() => {
    if (!online) return;
    syncCurrentRide().catch(() => { });
  }, [online, syncCurrentRide]);

  useEffect(() => {
    loadHistoryFromBackend().catch(() => { });
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
                { text: 'Ouvrir les réglages', onPress: () => { try { Linking.openSettings?.(); } catch { } } },
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
      declineRequest().catch(() => { });
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
    // Use driver's actual earnings (after commission) instead of total fare
    const totalEarnings = todayRides.reduce((sum, r) => sum + ((r.driverEarnings ?? r.fare) || 0), 0);

    return { totalRides, totalEarnings };
  }, [history]);

  const rideStatusMeta: Record<RideStatus, { label: string; helper: string; tone: string; bg: string }> = {
    incoming: { label: 'Course en attente', helper: 'Accepte ou refuse cette proposition', tone: '#f97316', bg: '#fff7ed' },
    pickup: { label: 'En route vers le passager', helper: 'Confirme lorsque le passager est à bord', tone: '#0284c7', bg: '#e0f2fe' },
    ongoing: { label: 'Course en cours', helper: 'Termine la course à l’arrivée', tone: '#16a34a', bg: '#dcfce7' },
    completed: { label: 'Course terminée', helper: 'Course archivée', tone: '#0f172a', bg: '#e2e8f0' },
    cancelled: { label: 'Course annulée', helper: 'Course indisponible', tone: '#b91c1c', bg: '#fee2e2' },
  };

  // Toggle Power
  const toggleOnline = async () => {
    try {
      if (!online) {
        // Vérification stricte de la localisation avant de passer en ligne
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
          if (newStatus !== 'granted') {
            Alert.alert(
              'Localisation requise',
              'Tic Miton a besoin de votre position pour vous attribuer des courses. Activez-la dans les réglages.',
              [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Ouvrir les réglages', onPress: () => Linking.openSettings() }
              ]
            );
            return;
          }
        }
      }
      setOnline(!online);
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'activation.');
    }
  };

  // Pour la démo, on simule 3 dernières activités si vide
  const recentActivities = history.length > 0 ? history.slice(0, 3) : [];

  // Liste de conseils dynamiques (fallback)
  const DAILY_TIPS = [
    "Les zones à forte demande sont actuellement à Cocody. Déplacez-vous pour plus de gains.",
    "Un client satisfait note souvent 5 étoiles. N'oubliez pas le sourire !",
    "Vérifiez la propreté de votre véhicule pour offrir une meilleure expérience.",
    "Les heures de pointe (7h-9h et 17h-19h) rapportent souvent plus.",
    "Proposez de la musique à vos passagers pour une course plus agréable.",
    "En cas de bouchons, restez calme et informez le passager.",
    "Pensez à faire une pause toutes les 2 heures pour rester vigilant."
  ];

  const [dynamicTip, setDynamicTip] = useState<string | null>(null);

  // Fallback local
  const localTip = useMemo(() => {
    const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
    return DAILY_TIPS[dayOfYear % DAILY_TIPS.length];
  }, []);

  // Fetch API Tip
  useEffect(() => {
    let cancelled = false;
    const fetchTip = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        // On tente de fetch même sans token si l'API est publique, 
        // mais ici la route est protégée, donc on a besoin du token.
        // Si pas de token, on reste sur le fallback.
        if (token) {
          const res = await fetch(`${API_URL}/driver/daily-tip`, {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`
            }
          });
          if (res.ok) {
            const json = await res.json();
            if (!cancelled && json.tip) {
              setDynamicTip(json.tip);
            }
          }
        }
      } catch (e) {
        // En cas d'erreur, on garde le fallback
      }
    };

    fetchTip();
    return () => { cancelled = true; };
  }, []);

  const currentTip = dynamicTip || localTip;

  return (
    <SafeAreaView style={styles.container}>

      {/* HEADER : LOGO À GAUCHE, NOTIF + BURGER À DROITE */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require('../../assets/images/LOGO_OR.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.headerRight}>
          {/* Bouton Notification */}
          <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications-outline" size={24} color={Colors.black} />
            <View style={styles.notifBadge} />
          </TouchableOpacity>

          {/* Bouton Menu Burger */}
          <TouchableOpacity
            style={[styles.iconButton, { marginLeft: 12 }]}
            onPress={() => router.push('/driver-menu')}
            activeOpacity={0.7}
          >
            <Ionicons name="menu" size={24} color={Colors.black} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* WELCOME SECTION */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>Bonjour,</Text>
          <Text style={styles.driverNameText}>{driverIdentifier}</Text>
        </View>

        {/* POWER CARD (En Ligne / Hors Ligne) */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={toggleOnline}
          style={styles.powerCardContainer}
        >
          <Animated.View style={[
            styles.powerCard,
            online ? styles.powerCardOnline : styles.powerCardOffline,
            online && { transform: [{ scale: pulseAnim }] } // Pulsation si en ligne
          ]}>
            <View style={styles.powerContent}>
              <View>
                {/* Texte Blanc dans les deux cas (Bleu ou Orange) */}
                <Text style={[styles.powerStatusText, styles.textWhite]}>
                  {online ? 'En ligne' : 'Hors ligne'}
                </Text>
                {online && (
                  <Text style={styles.powerSubText}>Recherche de course...</Text>
                )}
                {!online && (
                  <Text style={styles.powerSubText}>Vous êtes invisible</Text>
                )}
              </View>

              {/* Cercle toujours blanc pour le contraste */}
              <View style={[styles.powerIconCircle, styles.iconCircleCommon]}>
                <Ionicons
                  name="power"
                  size={28}
                  color={online ? Colors.primary : Colors.secondary}
                />
              </View>
            </View>

            {/* Barre de chargement fine en bas pour l'état en ligne */}
            {online && <View style={styles.loadingBar} />}
          </Animated.View>
        </TouchableOpacity>

        {/* STATS GRID (Toujours visible désormais) */}
        <View style={styles.statsGrid}>
          {/* Carte Gains */}
          <View style={[styles.statCard, styles.mainStatCard]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={[styles.statLabel, { color: 'white', opacity: 0.9 }]}>Gains du jour</Text>
              <View style={[styles.growthBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Ionicons name="arrow-up" size={12} color="white" />
                <Text style={[styles.growthText, { color: 'white' }]}>+0%</Text>
              </View>
            </View>
            <Text style={[styles.statValueMain, { color: 'white' }]}>
              {todaySummary.totalEarnings.toLocaleString('fr-FR')} <Text style={{ fontSize: 16, color: 'white', opacity: 0.8 }}>FCFA</Text>
            </Text>
          </View>

          {/* Carte Objectif avec Graphique */}
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Objectif journalier</Text>

            <View style={styles.graphContainer}>
              <Svg height="40" width="100%">
                <Path
                  d="M0 30 Q 30 10, 60 25 T 120 15 T 180 30"
                  fill="none"
                  stroke={Colors.secondary}
                  strokeWidth="2"
                />
                <Path
                  d="M0 30 Q 30 10, 60 25 T 120 15 T 180 30 V 40 H 0 Z"
                  fill={Colors.secondary}
                  fillOpacity="0.2"
                />
              </Svg>
            </View>

            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '0%' }]} />
            </View>
            <Text style={styles.objectiveText}>0% atteint</Text>
          </View>
        </View>

        {/* COURSE ACTIVE ou RECHERCHE (Prioritaire) */}
        {online && !currentRide ? (
          <View style={[styles.activeRideCard, { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 }]}>
            <View style={[styles.powerIconCircle, { backgroundColor: '#F3F4F6', marginBottom: 12 }]}>
              <Ionicons name="radio-outline" size={32} color={Colors.primary} />
            </View>
            <Text style={[styles.cardLabel, { fontSize: 18 }]}>Recherche de courses...</Text>
            <Text style={[styles.helperText, { textAlign: 'center', marginBottom: 0 }]}>
              Restez sur cet écran pour recevoir les demandes instantanément.
            </Text>
            {/* Animation de chargement simulée ou barre */}
            <View style={{ width: '60%', height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, marginTop: 16, overflow: 'hidden' }}>
              <View style={{ width: '30%', height: '100%', backgroundColor: Colors.primary, borderRadius: 2 }} />
            </View>
          </View>
        ) : currentRide ? (
          <View style={styles.activeRideCard}>
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
                    syncCurrentRide().catch(() => { });
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
          </View>
        ) : null}

        {/* ACTIVITÉS RÉCENTES / CONSEIL (Uniquement si HORS LIGNE et pas de course) */}
        {!online && !currentRide && (
          <View style={styles.VibeProSection}>
            <Text style={styles.sectionTitle}>Activités récentes</Text>

            {recentActivities.length > 0 ? (
              recentActivities.map((ride, index) => (
                <View key={index} style={styles.activityItem}>
                  <View style={styles.activityIcon}>
                    <Ionicons name="car-sport" size={20} color={Colors.gray} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityDest} numberOfLines={1}>{ride.dropoff}</Text>
                    <Text style={styles.activityDate}>Hier</Text>
                  </View>
                  <Text style={styles.activityPrice}>{ride.fare} FCFA</Text>
                </View>
              ))
            ) : (
              <View style={styles.tipCard}>
                <View style={styles.tipHeader}>
                  <Ionicons name="flash" size={20} color={Colors.secondary} />
                  <Text style={styles.tipTitle}>Conseil du jour</Text>
                </View>
                <Text style={styles.tipText}>
                  {currentTip}
                </Text>
              </View>
            )}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA', // Fond très clair
  },

  /* HEADER */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: 'white',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 32,
  },
  iconButton: {
    width: 40,
    height: 40,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'red',
    borderWidth: 1,
    borderColor: 'white',
  },

  /* CONTENT */
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  /* WELCOME */
  welcomeSection: {
    marginBottom: 20,
  },
  welcomeText: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 16,
    color: Colors.gray,
  },
  driverNameText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 24,
    color: Colors.primary, // #3650D0
  },

  /* POWER CARD */
  powerCardContainer: {
    marginBottom: 24,
  },
  powerCard: {
    borderRadius: 24,
    padding: 20,
    height: 120, // Grande carte
    justifyContent: 'center',
    overflow: 'hidden',
  },
  powerCardOffline: {
    backgroundColor: Colors.secondary, // Orange
    // Box Shadow
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 10,
  },
  powerCardOnline: {
    backgroundColor: Colors.primary, // #3650D0
    // Box Shadow
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 10,
  },
  powerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  powerStatusText: {
    fontFamily: Fonts.unboundedBold,
    fontSize: 22,
    letterSpacing: 1,
  },
  textWhite: { color: 'white' },
  textDark: { color: Colors.black },

  powerSubText: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: 'white',
    fontStyle: 'italic',
    marginTop: 4,
    opacity: 0.9,
  },

  powerIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Unified Circle Style (White background for both)
  iconCircleCommon: {
    backgroundColor: 'white',
  },
  iconCircleOffline: {
    backgroundColor: 'white', // Changed to white
  },
  iconCircleOnline: {
    backgroundColor: 'white',
  },
  loadingBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: Colors.secondary,
  },

  /* STATS GRID */
  statsGrid: {
    flexDirection: 'row', // Si on veut une grille, ou une colonne cartes
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1, // Prend la largeur dispo
    minWidth: '45%', // Une carte par ligne selon la demande ou 48% si grille
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  mainStatCard: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  statLabel: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 11,
    color: Colors.gray,
    marginBottom: 8,
  },
  statValueMain: {
    fontFamily: Fonts.unboundedBold,
    fontSize: 26,
    color: '#1E3A8A', // Bleu foncé
    marginTop: 4,
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  growthText: {
    fontSize: 12,
    color: '#166534',
    marginLeft: 2,
    fontWeight: 'bold',
  },

  // Objectif Orange
  graphContainer: {
    height: 40,
    marginBottom: 4,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.secondary, // Orange
    borderRadius: 4,
  },
  objectiveText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 14,
    color: Colors.black,
    textAlign: 'right',
  },

  /* VIBE PRO SECTION */
  VibeProSection: {
    marginTop: 10,
  },
  sectionTitle: {
    fontFamily: Fonts.unboundedBold, // Ou Titillium selon préference, Unbounded demandé
    fontSize: 18,
    color: Colors.black,
    marginBottom: 16,
  },
  tipCard: {
    backgroundColor: '#F0F9FF', // Bleu très clair
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  tipTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: '#0C4A6E',
  },
  tipText: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: '#075985',
    lineHeight: 20,
  },

  // Activités récentes skeleton stye
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  activityIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityDest: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 14,
    color: Colors.black,
  },
  activityDate: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 12,
    color: Colors.gray,
  },
  activityPrice: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 14,
    color: Colors.primary,
  },

  // Active Ride Card Styles (Recopiés de l'ancien pour ne rien casser)
  activeRideCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 20,
    marginBottom: 20,
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
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
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  badgeText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 12,
  },
  helperText: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 16,
  },
  infoBlock: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
  },
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
  passengerCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
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
});
