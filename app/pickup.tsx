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
import MapView, { Marker, Polyline } from 'react-native-maps';

export default function PickupScreen() {
  const router = useRouter();
  const { currentRide, setPickupDone, navPref, syncCurrentRide } = useDriverStore();

  const [eta, setEta] = React.useState(6);
  const [myLoc, setMyLoc] = React.useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoords, setRouteCoords] = React.useState<{ latitude: number; longitude: number }[]>([]);
  const [loadingAction, setLoadingAction] = React.useState(false);

  const mapRef = React.useRef<MapView>(null);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setEta((e) => (e > 1 ? e - 1 : 1));
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      syncCurrentRide().catch(() => {});
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

        if (coords.length > 0 && mapRef.current) {
          mapRef.current.fitToCoordinates([...coords, position], {
            edgePadding: { top: 100, right: 80, bottom: 300, left: 80 },
            animated: true,
          });
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Prise en charge</Text>
          <View style={styles.etaBadge}>
            <Ionicons name="time-outline" size={20} color="#fbbf24" />
            <Text style={styles.etaText}>~{eta} min</Text>
          </View>
        </View>

        {/* Carte */}
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            showsUserLocation
            followsUserLocation
            showsMyLocationButton={false}
            initialRegion={{
              latitude: pickupCoord?.latitude ?? myLoc?.latitude ?? 6.37,
              longitude: pickupCoord?.longitude ?? myLoc?.longitude ?? 2.39,
              latitudeDelta: 0.03,
              longitudeDelta: 0.03,
            }}
          >
            {pickupCoord && (
              <>
                <Marker coordinate={pickupCoord} pinColor="#10b981" />
                {routeCoords.length > 0 && (
                  <Polyline
                    coordinates={routeCoords}
                    strokeColor="#3b82f6"
                    strokeWidth={5}
                  />
                )}
              </>
            )}
          </MapView>
        </View>

        {/* Carte info passager */}
        <View style={styles.infoCard}>
          <View style={styles.passengerHeader}>
            <View>
              <Text style={styles.passengerName}>{passengerName}</Text>
              <Text style={styles.pickupAddress}>{pickupAddress}</Text>
            </View>
            {passengerPhone && (
              <View style={styles.contactRow}>
                <TouchableOpacity style={[styles.contactBtn, styles.callButton]} onPress={callPassenger}>
                  <Ionicons name="call" size={18} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.contactText}>Appeler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.contactBtn, styles.whatsButton]} onPress={whatsappPassenger}>
                  <Ionicons name="logo-whatsapp" size={18} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.contactText}>WhatsApp</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.destinationRow}>
            <Ionicons name="location" size={20} color="#ef4444" />
            <Text style={styles.destinationText}>Destination : {dropoffAddress}</Text>
          </View>

          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Course estimée</Text>
            <Text style={styles.fareAmount}>
              {fareDisplay}
            </Text>
          </View>
        </View>

        {/* Boutons d'action */}
        <View style={styles.bottomActions}>
          {pickupCoord && (
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => openExternalNav(pickupCoord.latitude, pickupCoord.longitude)}
            >
              <Ionicons name="navigate" size={24} color="#fff" />
              <Text style={styles.navButtonText}>Ouvrir Waze / Google Maps</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.confirmButton, loadingAction && styles.confirmButtonLoading]}
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
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={28} color="#fff" />
                <Text style={styles.confirmText}>Passager à bord</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { paddingBottom: 40 },

  emptyContainer: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', padding: 30 },
  emptyTitle: { color: '#0f172a', fontSize: 22, fontWeight: '700', marginTop: 20, marginBottom: 30 },
  homeBtn: { backgroundColor: '#1d4ed8', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16 },
  homeBtnText: { color: '#fff', fontWeight: '700' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  screenTitle: { fontSize: 26, fontWeight: '800', color: '#0f172a' },
  etaBadge: { flexDirection: 'row', backgroundColor: '#fde68a', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, alignItems: 'center', gap: 8 },
  etaText: { color: '#b45309', fontSize: 18, fontWeight: '700' },

  mapContainer: { height: 380, borderRadius: 24, overflow: 'hidden', marginHorizontal: 16, marginBottom: 16 },
  map: { flex: 1 },

  infoCard: { marginHorizontal: 20, backgroundColor: '#f1f5f9', borderRadius: 20, padding: 20 },
  passengerHeader: { marginBottom: 16 },
  passengerName: { color: '#0f172a', fontSize: 22, fontWeight: '800' },
  pickupAddress: { color: '#64748b', fontSize: 15, marginTop: 4, marginBottom: 10 },
  contactRow: { flexDirection: 'row', gap: 10 },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 12,
  },
  callButton: { backgroundColor: '#2563eb' },
  whatsButton: { backgroundColor: '#0f9d58' },
  contactText: { color: '#fff', fontWeight: '700' },

  destinationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  destinationText: { color: '#0f172a', fontSize: 16 },

  fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fareLabel: { color: '#64748b', fontSize: 15 },
  fareAmount: { color: '#16a34a', fontSize: 24, fontWeight: '900' },

  bottomActions: { padding: 20, gap: 14, marginTop: 'auto' },
  navButton: {
    flexDirection: 'row',
    backgroundColor: '#1d4ed8',
    paddingVertical: 16,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  navButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  confirmButton: {
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    paddingVertical: 18,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  confirmButtonLoading: { opacity: 0.7 },
  confirmText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
