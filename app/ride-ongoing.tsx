import React from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, Share, Alert, Linking } from 'react-native';
import { useNavigation } from 'expo-router';
import { useDriverStore } from './providers/DriverProvider';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { fetchRouteOSRM } from './utils/osrm';

export default function DriverRideOngoing() {
  const navigation = useNavigation();
  const { currentRide, completeRide, syncCurrentRide } = useDriverStore();

  React.useEffect(() => {
    if (!currentRide) {
      navigation.navigate('(tabs)' as never);
    }
  }, [currentRide, navigation]);
  const [eta, setEta] = React.useState<number | null>(null);
  const [distance, setDistance] = React.useState<number | null>(null);
  const [region, setRegion] = React.useState<Region>({
    latitude: 6.3702931,
    longitude: 2.3912362,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  });
  const [myLoc, setMyLoc] = React.useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoords, setRouteCoords] = React.useState<{ latitude: number; longitude: number }[]>([]);

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
    syncCurrentRide().catch(() => { });
  }, [syncCurrentRide]);

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
        setRegion(r => ({ ...r, latitude: me.latitude, longitude: me.longitude }));
        if (currentRide?.dropoffLat && currentRide?.dropoffLon) {
          const result = await fetchRouteOSRM(me, {
            latitude: currentRide.dropoffLat,
            longitude: currentRide.dropoffLon,
          });
          setRouteCoords(result);
          if (result.length > 1) {
            const estimatedDistanceKm = result.reduce((acc, curr, idx, arr) => {
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

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Course en cours</Text>

      <View style={styles.mapBox}>
        <MapView style={styles.map} initialRegion={region} onRegionChangeComplete={setRegion}>
          {myLoc && <Marker coordinate={myLoc} title="Moi" />}
          {currentRide?.dropoffLat && currentRide?.dropoffLon && (
            <Marker coordinate={{ latitude: currentRide.dropoffLat, longitude: currentRide.dropoffLon }} title="Destination" pinColor="#f59e0b" />
          )}
          {routeCoords.length > 0 && (
            <Polyline coordinates={routeCoords} strokeColor="#2563eb" strokeWidth={4} />
          )}
        </MapView>
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

      {currentRide?.dropoffLat && currentRide?.dropoffLon && (
        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.btn, styles.external]} onPress={() => openExternalNav(currentRide.dropoffLat!, currentRide.dropoffLon!)}>
            <Text style={styles.externalText}>Ouvrir Waze/Maps</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={() => Share.share({ message: 'Suivez ma course: https://example.com/driver/ride' })}>
          <Text style={styles.secondaryText}>Partager</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.primary]}
          onPress={async () => {
            await completeRide();
            navigation.navigate('ride/end' as never);
          }}
        >
          <Text style={styles.primaryText}>Terminer</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f6f6f6' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
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
  primaryText: { color: '#fff', fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  external: { backgroundColor: '#0EA5E9' },
  externalText: { color: '#fff', fontWeight: '700' },
});
