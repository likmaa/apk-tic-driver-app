import React from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, Share, Alert, Linking } from 'react-native';
import { useNavigation } from 'expo-router';
import { useDriverStore } from './providers/DriverProvider';
import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { fetchRouteOSRM } from './utils/osrm';
import {
  subscribeToNetworkChanges,
  saveRideState,
  showNetworkErrorAlert,
  checkNetworkConnection
} from './utils/networkHandler';

// Initialisation Mapbox
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || null);

export default function DriverRideOngoing() {
  const navigation = useNavigation();
  const { currentRide, completeRide, syncCurrentRide, startStop, endStop } = useDriverStore();

  React.useEffect(() => {
    if (!currentRide) {
      navigation.navigate('(tabs)' as never);
    }
  }, [currentRide, navigation]);
  const [eta, setEta] = React.useState<number | null>(null);
  const [distance, setDistance] = React.useState<number | null>(null);

  const [myLoc, setMyLoc] = React.useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoords, setRouteCoords] = React.useState<{ latitude: number; longitude: number }[]>([]);
  const [isOnline, setIsOnline] = React.useState(true);

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

  // Surveiller la connexion réseau
  React.useEffect(() => {
    // Vérifier l'état initial
    checkNetworkConnection().then(state => setIsOnline(state.isConnected));

    // S'abonner aux changements de connexion
    const unsubscribe = subscribeToNetworkChanges((state) => {
      const wasOnline = isOnline;
      setIsOnline(state.isConnected);

      // Si on perd la connexion pendant une course active
      if (!state.isConnected && wasOnline && currentRide) {
        // Sauvegarder l'état de la course
        saveRideState(currentRide).catch(() => { });
        // Afficher une alerte informative (non bloquante)
        showNetworkErrorAlert(true);
      } else if (state.isConnected && !wasOnline && currentRide) {
        // Reconnexion : synchroniser immédiatement
        syncCurrentRide().catch(() => { });
      }
    });

    return unsubscribe;
  }, [isOnline, currentRide, syncCurrentRide]);

  // Synchroniser la course périodiquement et sauvegarder l'état
  React.useEffect(() => {
    if (!currentRide) return;

    const syncInterval = setInterval(() => {
      if (isOnline) {
        syncCurrentRide().catch(() => { });
      }
      // Sauvegarder l'état même hors ligne
      saveRideState(currentRide).catch(() => { });
    }, 30000); // Toutes les 30 secondes

    return () => clearInterval(syncInterval);
  }, [currentRide, isOnline, syncCurrentRide]);

  // Load current location and route to dropoff
  React.useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission refusée', "L'accès à la position est requis.");
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        const me = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setMyLoc(me);

        if (currentRide?.dropoffLat && currentRide?.dropoffLon) {
          const result = await fetchRouteOSRM(me, {
            latitude: currentRide.dropoffLat,
            longitude: currentRide.dropoffLon,
          });
          setRouteCoords(result);
          if (result.length > 1) {
            const estimatedDistanceKm = result.reduce((acc: number, curr: { latitude: number; longitude: number }, idx: number, arr: { latitude: number; longitude: number }[]) => {
              if (idx === 0) return 0;
              const prev = arr[idx - 1];
              const dx = curr.longitude - prev.longitude;
              const dy = curr.latitude - prev.latitude;
              return acc + Math.sqrt(dx * dx + dy * dy);
            }, 0) * 111;
            setDistance(estimatedDistanceKm);
          }
          if (currentRide.duration_s) {
            setEta(Math.ceil(currentRide.duration_s / 60));
          }
        }
      } catch { }
    })();
  }, [currentRide?.dropoffLat, currentRide?.dropoffLon, currentRide?.duration_s, syncCurrentRide]);

  const routeSource = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: routeCoords.map(c => [c.longitude, c.latitude]),
    },
  } as any;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Course en cours</Text>
        {!isOnline && (
          <View style={styles.offlineBadge}>
            <Text style={styles.offlineText}>Hors ligne</Text>
          </View>
        )}
      </View>

      <View style={styles.mapBox}>
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
              myLoc?.longitude ?? 2.3912362,
              myLoc?.latitude ?? 6.3702931
            ]}
            animationMode="flyTo"
            animationDuration={2000}
          />

          <Mapbox.UserLocation />

          {currentRide?.dropoffLat && currentRide?.dropoffLon && (
            <Mapbox.PointAnnotation
              id="dropoff"
              coordinate={[currentRide.dropoffLon, currentRide.dropoffLat]}
            >
              <View style={{ height: 30, width: 30, backgroundColor: '#f59e0b', borderRadius: 15, borderWidth: 2, borderColor: '#fff' }} />
            </Mapbox.PointAnnotation>
          )}

          {routeCoords.length > 0 && (
            <Mapbox.ShapeSource id="routeSource" shape={routeSource}>
              <Mapbox.LineLayer
                id="routeLine"
                style={{
                  lineColor: '#2563eb',
                  lineWidth: 4,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            </Mapbox.ShapeSource>
          )}
        </Mapbox.MapView>
      </View>


      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Arrivée estimée</Text>
          <Text style={styles.value}>{eta ? `${eta} min` : '--'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Distance restante</Text>
          <Text style={styles.value}>{distance ? `${distance.toFixed(1)} km` : '--'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Temps d'arrêt</Text>
          <Text style={[styles.value, currentRide?.stop_started_at ? { color: '#f59e0b' } : {}]}>
            {Math.floor((currentRide?.total_stop_duration_s ?? 0) / 60)} min
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Départ</Text>
          <Text style={styles.value}>{currentRide?.pickup || '-'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Destination</Text>
          <Text style={styles.value}>{currentRide?.dropoff || '-'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Tarif</Text>
          <Text style={styles.value}>{currentRide ? `${currentRide.fare.toLocaleString('fr-FR')} FCFA` : '-'}</Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        {currentRide?.dropoffLat && currentRide?.dropoffLon && (
          <TouchableOpacity style={[styles.btn, styles.external, { flex: 0.6 }]} onPress={() => openExternalNav(currentRide.dropoffLat!, currentRide.dropoffLon!)}>
            <Text style={styles.externalText}>Waze/Maps</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.btn, currentRide?.stop_started_at ? styles.resumeBtn : styles.stopBtn, { flex: 0.4 }]}
          onPress={() => currentRide?.stop_started_at ? endStop() : startStop()}
        >
          <Text style={styles.externalText}>{currentRide?.stop_started_at ? 'Reprendre' : 'Arrêt'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={() => Share.share({ message: 'Suivez ma course: https://example.com/driver/ride' })}>
          <Text style={styles.secondaryText}>Partager</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.primary, !isOnline && styles.primaryDisabled]}
          onPress={async () => {
            if (!isOnline) {
              Alert.alert(
                'Connexion requise',
                'Une connexion internet est nécessaire pour terminer la course. Veuillez vérifier votre connexion.',
                [{ text: 'OK' }]
              );
              return;
            }
            try {
              if (currentRide?.stop_started_at) {
                await endStop();
              }
              await completeRide();
              navigation.navigate('ride/end' as never);
            } catch (error) {
              Alert.alert(
                'Erreur',
                'Impossible de terminer la course. Veuillez réessayer.',
                [{ text: 'OK' }]
              );
            }
          }}
          disabled={!isOnline}
        >
          <Text style={styles.primaryText}>Terminer</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f6f6f6' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  offlineBadge: { backgroundColor: '#F59E0B', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  offlineText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  mapBox: { height: 300, borderRadius: 12, overflow: 'hidden', marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#eee', backgroundColor: '#e5e7eb' },
  map: { width: '100%', height: '100%' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#eee' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { color: '#666' },
  value: { fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  secondaryText: { color: '#111827', fontWeight: '700' },
  primary: { backgroundColor: '#2563eb' },
  primaryDisabled: { backgroundColor: '#9CA3AF', opacity: 0.6 },
  primaryText: { color: '#fff', fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  external: { backgroundColor: '#0EA5E9' },
  externalText: { color: '#fff', fontWeight: '700' },
  stopBtn: { backgroundColor: '#f59e0b' },
  resumeBtn: { backgroundColor: '#10b981' },
});
