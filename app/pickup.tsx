import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useDriverStore } from './providers/DriverProvider';
import * as Location from 'expo-location';
import { fetchRouteOSRM } from './utils/osrm';
import { Ionicons } from '@expo/vector-icons';
import Mapbox from '@rnmapbox/maps';
import { Colors } from '../theme';
import { Fonts } from '../font';

// Initialisation Mapbox
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || null);

function WaitTimer({ arrivedAt }: { arrivedAt: string }) {
  const [seconds, setSeconds] = React.useState(0);

  React.useEffect(() => {
    const start = new Date(arrivedAt).getTime();
    const interval = setInterval(() => {
      setSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [arrivedAt]);

  const grace = 5 * 60; // 5 min
  const isOverGrace = seconds > grace;
  const displaySeconds = isOverGrace ? seconds - grace : grace - seconds;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}:${rs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.timerCard, isOverGrace && styles.timerCardAlert]}>
      <Ionicons
        name={isOverGrace ? "warning" : "hourglass-outline"}
        size={24}
        color={isOverGrace ? Colors.error : Colors.primary}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.timerLabel}>
          {isOverGrace ? "Attente facturée" : "Délai de grâce"}
        </Text>
        <Text style={[styles.timerValue, isOverGrace && styles.timerValueAlert]}>
          {formatTime(displaySeconds)}
        </Text>
      </View>
      {isOverGrace && (
        <View style={styles.feeBadge}>
          <Text style={styles.feeText}>+{Math.floor(displaySeconds / 60) * 10} F</Text>
        </View>
      )}
    </View>
  );
}

export default function PickupScreen() {
  const router = useRouter();
  const { currentRide, setPickupDone, signalArrival, navPref, syncCurrentRide } = useDriverStore();

  React.useEffect(() => {
    if (!currentRide) {
      router.replace('/(tabs)');
    }
  }, [currentRide, router]);

  const [eta, setEta] = React.useState(6);
  const [myLoc, setMyLoc] = React.useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoords, setRouteCoords] = React.useState<{ latitude: number; longitude: number }[]>([]);
  const [loadingAction, setLoadingAction] = React.useState(false);

  const cameraRef = React.useRef<Mapbox.Camera>(null);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setEta((e) => (e > 1 ? e - 1 : 1));
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      syncCurrentRide().catch(() => { });
    }, [syncCurrentRide])
  );

  React.useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', "Activez la localisation pour continuer.");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const position = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setMyLoc(position);

      if (currentRide?.pickupLat && currentRide?.pickupLon) {
        const coords = await fetchRouteOSRM(position, {
          latitude: currentRide.pickupLat,
          longitude: currentRide.pickupLon,
        });
        setRouteCoords(coords);

        if (coords.length > 0 && cameraRef.current) {
          // Centrer la caméra sur les coordonnées
          const padding = [100, 80, 300, 80] as [number, number, number, number];
          cameraRef.current.fitBounds(
            [Math.min(...coords.map(c => c.longitude), position.longitude), Math.min(...coords.map(c => c.latitude), position.latitude)],
            [Math.max(...coords.map(c => c.longitude), position.longitude), Math.max(...coords.map(c => c.latitude), position.latitude)],
            60, // padding
            1000 // duration
          );
        }
      }
    })();
  }, [currentRide?.pickupLat, currentRide?.pickupLon]);

  const openExternalNav = async (lat: number, lon: number) => {
    const schemes = navPref === 'waze'
      ? [`waze://?ll=${lat},${lon}&navigate=yes`, `comgooglemaps://?daddr=${lat},${lon}&directionsmode=driving`]
      : [`comgooglemaps://?daddr=${lat},${lon}&directionsmode=driving`, `waze://?ll=${lat},${lon}&navigate=yes`];

    for (const url of schemes) {
      if (await Linking.canOpenURL(url)) {
        return Linking.openURL(url);
      }
    }
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`);
  };

  if (!currentRide) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#94a3b8" />
        <Text style={styles.emptyTitle}>Aucune course en cours</Text>
        <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.homeBtnText}>Retour au tableau de bord</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const pickupCoord = currentRide.pickupLat && currentRide.pickupLon
    ? { latitude: currentRide.pickupLat, longitude: currentRide.pickupLon }
    : null;
  const passengerName = currentRide.riderName ?? 'Passager';
  const passengerPhone = currentRide.riderPhone;
  const sanitizedPassengerPhone = passengerPhone?.replace(/[^\d+]/g, '');
  const pickupAddress = currentRide.pickup ?? 'Point de prise en charge';
  const dropoffAddress = currentRide.dropoff ?? 'Destination inconnue';
  const fareDisplay = `${currentRide.fare.toLocaleString('fr-FR')} FCFA`;

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

  const routeSource = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: routeCoords.map(c => [c.longitude, c.latitude]),
    },
  } as any;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header compact */}
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>
            {currentRide.service_type === 'livraison' ? 'Collecte Colis' : 'Prise en charge'}
          </Text>
          <Text style={styles.screenSub}>
            {currentRide.service_type === 'livraison' ? 'Allez chercher le colis' : 'Allez chercher votre passager'}
          </Text>
        </View>
        <View style={styles.etaBadge}>
          <Ionicons name="time" size={16} color={Colors.primary} />
          <Text style={styles.etaText}>{eta} min</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Carte minimaliste */}
        <View style={styles.mapContainer}>
          <Mapbox.MapView
            style={styles.map}
            styleURL={Mapbox.StyleURL.Street}
            logoEnabled={false}
            attributionEnabled={false}
          >
            <Mapbox.Camera
              ref={cameraRef}
              zoomLevel={14}
              centerCoordinate={[
                pickupCoord?.longitude ?? myLoc?.longitude ?? 2.39,
                pickupCoord?.latitude ?? myLoc?.latitude ?? 6.37
              ]}
              animationMode="flyTo"
              animationDuration={2000}
            />

            <Mapbox.UserLocation />

            {pickupCoord && (
              <>
                <Mapbox.PointAnnotation
                  id="pickup"
                  coordinate={[pickupCoord.longitude, pickupCoord.latitude]}
                >
                  <View style={styles.markerContainer}>
                    <View style={styles.markerInner} />
                  </View>
                </Mapbox.PointAnnotation>

                {routeCoords.length > 0 && (
                  <Mapbox.ShapeSource id="routeSource" shape={routeSource}>
                    <Mapbox.LineLayer
                      id="routeLine"
                      style={{
                        lineColor: Colors.primary,
                        lineWidth: 4,
                        lineCap: 'round',
                        lineJoin: 'round',
                      }}
                    />
                  </Mapbox.ShapeSource>
                )}
              </>
            )}
          </Mapbox.MapView>

          {pickupCoord && (
            <TouchableOpacity
              style={styles.floatingNav}
              onPress={() => openExternalNav(pickupCoord.latitude, pickupCoord.longitude)}
            >
              <Ionicons name="navigate" size={24} color={Colors.white} />
            </TouchableOpacity>
          )}
        </View>


        {/* Carte info passager épurée */}
        <View style={styles.infoCard}>
          <View style={styles.passengerHeader}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={24} color={Colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.passengerNameText}>{passengerName}</Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color="#FBBF24" />
                <Text style={styles.ratingText}>4.9 • Client régulier</Text>
              </View>
            </View>
            <View style={styles.actionIcons}>
              <TouchableOpacity style={styles.roundIconBtn} onPress={callPassenger}>
                <Ionicons name="call" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.roundIconBtn, { marginLeft: 10 }]} onPress={whatsappPassenger}>
                <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.locationRow}>
            <View style={styles.dotLine}>
              <View style={[styles.dot, { backgroundColor: Colors.primary }]} />
              <View style={styles.line} />
              <View style={[styles.dot, { backgroundColor: Colors.secondary }]} />
            </View>
            <View style={{ flex: 1, gap: 12 }}>
              <View>
                <Text style={styles.locLabel}>PRÉLÈVEMENT</Text>
                <Text style={styles.locValue} numberOfLines={1}>{pickupAddress}</Text>
              </View>
              <View>
                <Text style={styles.locLabel}>DESTINATION</Text>
                <Text style={styles.locValue} numberOfLines={1}>{dropoffAddress}</Text>
              </View>
            </View>
          </View>

          <View style={styles.fareHighlight}>
            <Text style={styles.fareLabelSmall}>PRIX ESTIMÉ</Text>
            <Text style={styles.fareAmountLarge}>{fareDisplay}</Text>
          </View>

          {currentRide.status === 'arrived' && currentRide.arrived_at && (
            <WaitTimer arrivedAt={currentRide.arrived_at} />
          )}
        </View>
      </ScrollView>

      {/* Barre d'action fixe en bas */}
      <View style={styles.bottomBar}>
        {currentRide.status === 'pickup' ? (
          <TouchableOpacity
            style={[styles.primaryActionBtn, loadingAction && styles.disabledBtn]}
            disabled={loadingAction}
            onPress={async () => {
              setLoadingAction(true);
              try {
                await signalArrival();
              } catch {
                Alert.alert('Erreur', "Impossible de signaler votre arrivée.");
              } finally {
                setLoadingAction(false);
              }
            }}
          >
            {loadingAction ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.primaryActionText}>JE SUIS ARRIVÉ</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.successActionBtn, loadingAction && styles.disabledBtn]}
            disabled={loadingAction}
            onPress={async () => {
              setLoadingAction(true);
              try {
                await setPickupDone();
                router.replace('/ride-ongoing');
              } catch {
                Alert.alert('Erreur', 'Impossible de confirmer la prise en charge.');
              } finally {
                setLoadingAction(false);
              }
            }}
          >
            {loadingAction ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.primaryActionText}>PASSAGER À BORD</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 100 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  screenTitle: {
    fontSize: 20,
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.black
  },
  screenSub: {
    fontSize: 13,
    fontFamily: Fonts.titilliumWeb,
    color: Colors.gray,
  },
  etaBadge: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
    gap: 6
  },
  etaText: {
    color: Colors.primary,
    fontSize: 14,
    fontFamily: Fonts.titilliumWebBold
  },

  mapContainer: {
    height: 380,
    backgroundColor: Colors.lightGray,
    position: 'relative'
  },
  map: { flex: 1 },
  floatingNav: {
    position: 'absolute',
    right: 15,
    bottom: 25,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },

  markerContainer: {
    height: 24,
    width: 24,
    backgroundColor: Colors.white,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  markerInner: {
    height: 12,
    width: 12,
    backgroundColor: Colors.primary,
    borderRadius: 6,
  },

  infoCard: {
    marginTop: -30,
    marginHorizontal: 15,
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  passengerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4FB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerNameText: {
    color: Colors.black,
    fontSize: 18,
    fontFamily: Fonts.titilliumWebBold
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    fontSize: 12,
    fontFamily: Fonts.titilliumWeb,
    color: Colors.gray,
  },
  actionIcons: {
    flexDirection: 'row',
  },
  roundIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.lightGray,
    marginBottom: 20,
  },
  locationRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20,
  },
  dotLine: {
    alignItems: 'center',
    paddingVertical: 5,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.lightGray,
    marginVertical: 4,
  },
  locLabel: {
    fontSize: 10,
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.gray,
    letterSpacing: 1,
  },
  locValue: {
    fontSize: 15,
    fontFamily: Fonts.titilliumWebSemiBold,
    color: Colors.black,
    marginTop: 2,
  },

  fareHighlight: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 15,
    alignItems: 'center',
  },
  fareLabelSmall: {
    fontSize: 11,
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.gray,
    letterSpacing: 0.5,
  },
  fareAmountLarge: {
    fontSize: 24,
    fontFamily: Fonts.titilliumWebBold,
    color: '#10B981',
    marginTop: 2,
  },

  timerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    padding: 16,
    marginTop: 15,
    gap: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  timerCardAlert: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  timerLabel: {
    color: Colors.gray,
    fontSize: 12,
    fontFamily: Fonts.titilliumWebSemiBold,
  },
  timerValue: {
    color: Colors.black,
    fontSize: 18,
    fontFamily: Fonts.titilliumWebBold,
  },
  timerValueAlert: {
    color: Colors.error,
  },
  feeBadge: {
    backgroundColor: Colors.white,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  feeText: {
    color: Colors.error,
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 13,
  },

  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30
  },
  emptyTitle: {
    color: Colors.black,
    fontSize: 20,
    fontFamily: Fonts.titilliumWebBold,
    marginTop: 20,
    marginBottom: 30
  },
  homeBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16
  },
  homeBtnText: {
    color: Colors.white,
    fontFamily: Fonts.titilliumWebBold
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 35,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
  },
  primaryActionBtn: {
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  successActionBtn: {
    backgroundColor: '#10B981',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  primaryActionText: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: Fonts.titilliumWebBold,
    letterSpacing: 1,
  },
  disabledBtn: {
    backgroundColor: Colors.mediumGray,
    elevation: 0,
    shadowOpacity: 0,
  }
});
