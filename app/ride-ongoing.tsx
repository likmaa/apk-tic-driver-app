import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
  ScrollView,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../theme';
import { Fonts } from '../font';
import { useDriverStore, Ride } from './providers/DriverProvider';
import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { fetchRouteOSRM } from './utils/osrm';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  subscribeToNetworkChanges,
  saveRideState,
  showNetworkErrorAlert,
  checkNetworkConnection
} from './utils/networkHandler';

// Initialisation Mapbox
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || null);

export default function DriverRideOngoing() {
  const router = useRouter();
  const { currentRide, completeRide, syncCurrentRide, startStop, endStop } = useDriverStore();
  const [loadingComplete, setLoadingComplete] = React.useState(false);

  React.useEffect(() => {
    if (!currentRide) {
      router.replace('/(tabs)');
    }
  }, [currentRide, router]);

  const [eta, setEta] = React.useState<number | null>(null);
  const [distance, setDistance] = React.useState<number | null>(null);
  const [myLoc, setMyLoc] = React.useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoords, setRouteCoords] = React.useState<{ latitude: number; longitude: number }[]>([]);
  const [isOnline, setIsOnline] = React.useState(true);
  const [liveStopSeconds, setLiveStopSeconds] = React.useState<number>(0);

  const cameraRef = React.useRef<Mapbox.Camera>(null);

  const openExternalNav = async (lat: number, lon: number) => {
    try {
      const schemes = [
        `waze://?ll=${lat},${lon}&navigate=yes`,
        `comgooglemaps://?daddr=${lat},${lon}&directionsmode=driving`,
      ];
      for (const url of schemes) {
        if (await Linking.canOpenURL(url)) return Linking.openURL(url);
      }
      return Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`);
    } catch { }
  };

  React.useEffect(() => {
    const t = setInterval(() => {
      if (eta && eta > 1) setEta((e) => (e ? Math.max(1, e - 1) : e));
    }, 60000);
    return () => clearInterval(t);
  }, [eta]);

  React.useEffect(() => {
    checkNetworkConnection().then(state => setIsOnline(state.isConnected));
    const unsubscribe = subscribeToNetworkChanges((state) => {
      const wasOnline = isOnline;
      setIsOnline(state.isConnected);
      if (!state.isConnected && wasOnline && currentRide) {
        saveRideState(currentRide).catch(() => { });
        showNetworkErrorAlert(true);
      } else if (state.isConnected && !wasOnline && currentRide) {
        syncCurrentRide().catch(() => { });
      }
    });
    return unsubscribe;
  }, [isOnline, currentRide, syncCurrentRide]);

  React.useEffect(() => {
    if (!currentRide) return;
    const syncInterval = setInterval(() => {
      if (isOnline) {
        syncCurrentRide().catch(() => { });
      }
      saveRideState(currentRide).catch(() => { });
    }, 30000);
    return () => clearInterval(syncInterval);
  }, [currentRide, isOnline, syncCurrentRide]);

  React.useEffect(() => {
    let interval: any;
    if (currentRide?.stop_started_at) {
      const start = new Date(currentRide.stop_started_at).getTime();
      interval = setInterval(() => {
        const now = Date.now();
        setLiveStopSeconds(Math.floor((now - start) / 1000));
      }, 1000);
    } else {
      setLiveStopSeconds(0);
    }
    return () => clearInterval(interval);
  }, [currentRide?.stop_started_at]);

  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  React.useEffect(() => {
    // Set ETA immediately from backend data as fallback
    if (currentRide?.duration_s && !eta) {
      setEta(Math.ceil(currentRide.duration_s / 60));
    }
    // Set Distance immediately from backend data if available
    if (currentRide?.distance_m && !distance) {
      setDistance(currentRide.distance_m / 1000);
    }

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({});
        const me = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setMyLoc(me);

        if (currentRide?.dropoffLat && currentRide?.dropoffLon) {
          // If no distance yet (backend returned 0 or null), calculate straight-line as secondary fallback
          if (!distance) {
            const dx = currentRide.dropoffLon - me.longitude;
            const dy = currentRide.dropoffLat - me.latitude;
            const straightLineKm = Math.sqrt(dx * dx + dy * dy) * 111;
            setDistance(straightLineKm * 1.3); // ~30% road factor
          }

          try {
            const result = await fetchRouteOSRM(me, {
              latitude: currentRide.dropoffLat,
              longitude: currentRide.dropoffLon,
            });
            setRouteCoords(result);
            if (result.length > 1) {
              const estimatedDistanceKm = result.reduce((acc: number, curr: any, idx: number, arr: any[]) => {
                if (idx === 0) return 0;
                const prev = arr[idx - 1];
                const rdx = curr.longitude - prev.longitude;
                const rdy = curr.latitude - prev.latitude;
                return acc + Math.sqrt(rdx * rdx + rdy * rdy);
              }, 0) * 111;
              setDistance(estimatedDistanceKm);
            }
          } catch {
            console.log('[RideOngoing] OSRM route fetch failed, using straight-line distance');
          }

          if (currentRide.duration_s) {
            setEta(Math.ceil(currentRide.duration_s / 60));
          }
        }
      } catch {
        console.log('[RideOngoing] Location/route calculation failed');
      }
    })();
  }, [currentRide?.dropoffLat, currentRide?.dropoffLon, currentRide?.duration_s]);

  if (!currentRide) return null;

  const routeSource = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: routeCoords.map(c => [c.longitude, c.latitude]),
    },
  } as any;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Premium */}
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>Course en cours</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10B981' : Colors.error }]} />
            <Text style={styles.statusText}>{isOnline ? 'En ligne' : 'Hors ligne'}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={() => Share.share({ message: `Je conduis ${currentRide?.riderName || 'un passager'}. Dest: ${currentRide?.dropoff}` })}
        >
          <Ionicons name="share-social-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Map Contextualized */}
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
                myLoc?.longitude ?? currentRide.dropoffLon ?? 2.39,
                myLoc?.latitude ?? currentRide.dropoffLat ?? 6.37
              ]}
              animationMode="flyTo"
              animationDuration={2000}
            />

            <Mapbox.UserLocation />

            {currentRide.dropoffLat && (
              <Mapbox.PointAnnotation
                id="dropoff"
                coordinate={[currentRide.dropoffLon!, currentRide.dropoffLat!]}
              >
                <View style={[styles.markerContainer, { borderColor: Colors.secondary }]}>
                  <View style={[styles.markerInner, { backgroundColor: Colors.secondary }]} />
                </View>
              </Mapbox.PointAnnotation>
            )}

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
          </Mapbox.MapView>

          <TouchableOpacity
            style={styles.floatingNav}
            onPress={() => openExternalNav(currentRide.dropoffLat!, currentRide.dropoffLon!)}
          >
            <Ionicons name="navigate" size={24} color={Colors.white} />
          </TouchableOpacity>
        </View>

        {/* Info Card Premium */}
        <View style={styles.infoCard}>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>ARRIVÉE</Text>
              <Text style={styles.statValue}>{eta ? `${eta} min` : 'Calcul...'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>DISTANCE</Text>
              <Text style={styles.statValue}>{distance ? `${distance.toFixed(1)} km` : 'Calcul...'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>PRIX ACTUEL</Text>
              <Text style={[styles.statValue, { color: '#10B981' }]}>{(currentRide.fare || 0).toLocaleString('fr-FR')} F</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Stop Timer Section */}
          <View style={[styles.stopSection, currentRide.stop_started_at && styles.stopSectionActive]}>
            <View style={styles.stopTextContainer}>
              <Text style={styles.stopLabel}>TEMPS D'ARRÊT TOTAL</Text>
              <Text style={styles.stopValue}>
                {Math.floor(((currentRide.total_stop_duration_s ?? 0) + (currentRide.stop_started_at ? liveStopSeconds : 0)) / 60)} min
              </Text>
              {currentRide.stop_started_at && (
                <Text style={styles.liveTimerText}>
                  En cours: {formatDuration(liveStopSeconds)}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.stopActionBtn, currentRide.stop_started_at ? styles.resumeBtn : styles.pauseBtn]}
              onPress={() => currentRide.stop_started_at ? endStop() : startStop()}
            >
              <Ionicons name={currentRide.stop_started_at ? "play" : "pause"} size={22} color={Colors.white} />
              <Text style={styles.stopActionText}>
                {currentRide.stop_started_at ? 'REPRENDRE' : 'ARRÊT'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Route details */}
          <View style={styles.locationRow}>
            <View style={styles.dotLine}>
              <View style={[styles.dot, { backgroundColor: Colors.primary }]} />
              <View style={styles.line} />
              <View style={[styles.dot, { backgroundColor: Colors.secondary }]} />
            </View>
            <View style={{ flex: 1, gap: 12 }}>
              <View>
                <Text style={styles.locLabel}>DÉPART</Text>
                <Text style={styles.locValue} numberOfLines={1}>{currentRide.pickup}</Text>
              </View>
              <View>
                <Text style={styles.locLabel}>DESTINATION</Text>
                <Text style={styles.locValue} numberOfLines={1}>{currentRide.dropoff}</Text>
              </View>
            </View>
          </View>

          {currentRide.service_type === 'livraison' && (
            <>
              <View style={styles.divider} />
              <View style={styles.deliveryInfoCard}>
                <View style={styles.deliveryInfoHeader}>
                  <MaterialCommunityIcons name="package-variant" size={20} color={Colors.primary} />
                  <Text style={styles.deliveryInfoTitle}>DÉTAILS DU COLIS</Text>
                </View>

                <View style={styles.deliveryInfoRow}>
                  <View style={styles.deliveryInfoItem}>
                    <Text style={styles.deliveryInfoLabel}>Destinataire</Text>
                    <Text style={styles.deliveryInfoValue}>{currentRide.recipient_name || 'Non précisé'}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deliveryCallBtn}
                    onPress={() => {
                      if (currentRide.recipient_phone) {
                        Linking.openURL(`tel:${currentRide.recipient_phone}`);
                      } else {
                        Alert.alert('Info', 'Aucun numéro de téléphone pour le destinataire.');
                      }
                    }}
                  >
                    <Ionicons name="call" size={18} color={Colors.white} />
                  </TouchableOpacity>
                </View>

                {currentRide.package_description && (
                  <View style={styles.deliveryInfoItem}>
                    <Text style={styles.deliveryInfoLabel}>Description</Text>
                    <Text style={styles.deliveryInfoValue}>{currentRide.package_description}</Text>
                  </View>
                )}

                <View style={styles.deliveryInfoMeta}>
                  <View style={styles.deliveryMetaItem}>
                    <MaterialCommunityIcons name="weight-kilogram" size={16} color={Colors.gray} />
                    <Text style={styles.deliveryMetaText}>{currentRide.package_weight || 'Poids N/A'}</Text>
                  </View>
                  {currentRide.is_fragile && (
                    <View style={[styles.deliveryMetaItem, styles.fragileBadge]}>
                      <MaterialCommunityIcons name="alert-octagon" size={16} color="#B45309" />
                      <Text style={[styles.deliveryMetaText, { color: '#B45309' }]}>FRAGILE</Text>
                    </View>
                  )}
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Action bar bottom */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.primaryActionBtn, (!isOnline || loadingComplete) && styles.disabledBtn]}
          disabled={!isOnline || loadingComplete}
          onPress={async () => {
            setLoadingComplete(true);
            try {
              if (currentRide.stop_started_at) await endStop();
              const finalRide = await completeRide();
              if (finalRide) {
                router.replace({
                  pathname: '/ride/end',
                  params: {
                    fare: finalRide.fare,
                    rideId: finalRide.id,
                    // @ts-ignore
                    paymentLink: finalRide.paymentLink
                  }
                });
              } else {
                router.replace('/(tabs)');
              }
            } catch {
              Alert.alert('Erreur', 'Impossible de terminer la course.');
            } finally {
              setLoadingComplete(false);
            }
          }}
        >
          {loadingComplete ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.primaryActionText}>TERMINER LA COURSE</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 110 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: Fonts.titilliumWeb,
    color: Colors.gray,
  },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4FB',
    justifyContent: 'center',
    alignItems: 'center',
  },

  mapContainer: {
    height: 320,
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
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  markerInner: {
    height: 10,
    width: 10,
    borderRadius: 5,
  },

  infoCard: {
    marginTop: -30,
    marginHorizontal: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },

  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.lightGray,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.gray,
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 16,
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.black,
    marginTop: 4,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.lightGray,
    marginVertical: 15,
  },

  stopSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
  },
  stopSectionActive: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  stopTextContainer: {
    flex: 1,
  },
  stopLabel: {
    fontSize: 9,
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.gray,
  },
  stopValue: {
    fontSize: 18,
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.black,
  },
  liveTimerText: {
    fontSize: 11,
    fontFamily: Fonts.titilliumWebSemiBold,
    color: '#D97706',
  },
  stopActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  pauseBtn: { backgroundColor: '#F59E0B' },
  resumeBtn: { backgroundColor: '#10B981' },
  stopActionText: {
    color: Colors.white,
    fontSize: 12,
    fontFamily: Fonts.titilliumWebBold,
  },

  locationRow: {
    flexDirection: 'row',
    gap: 15,
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
    fontSize: 14,
    fontFamily: Fonts.titilliumWebSemiBold,
    color: Colors.black,
    marginTop: 2,
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
    backgroundColor: Colors.error, // Terminer est une action forte, souvent rouge ou noir
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  primaryActionText: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: Fonts.titilliumWebBold,
    letterSpacing: 1,
  },
  disabledBtn: {
    backgroundColor: Colors.gray,
    elevation: 0,
  },
  deliveryInfoCard: {
    marginTop: 10,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  deliveryInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  deliveryInfoTitle: {
    fontSize: 12,
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.gray,
    letterSpacing: 1,
  },
  deliveryInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  deliveryInfoItem: {
    marginBottom: 10,
  },
  deliveryInfoLabel: {
    fontSize: 10,
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.gray,
  },
  deliveryInfoValue: {
    fontSize: 14,
    fontFamily: Fonts.titilliumWebSemiBold,
    color: Colors.black,
    marginTop: 2,
  },
  deliveryCallBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryInfoMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  deliveryMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  deliveryMetaText: {
    fontSize: 11,
    fontFamily: Fonts.titilliumWebBold,
    color: Colors.black,
  },
  fragileBadge: {
    borderColor: '#FED7AA',
    backgroundColor: '#FFF7ED',
  },
});
