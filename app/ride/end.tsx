import React from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useDriverStore } from '../providers/DriverProvider';

export default function EndRideScreen() {
  const router = useRouter();
  const { currentRide } = useDriverStore();

  const fare = currentRide ? `${currentRide.fare.toLocaleString('fr-FR')} FCFA` : '--';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Course terminée</Text>
        <Text style={styles.label}>Montant perçu</Text>
        <Text style={styles.amount}>{fare}</Text>
        <TouchableOpacity style={styles.primary} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.primaryText}>Retour au tableau de bord</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7F9', padding: 16, justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  title: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 12 },
  label: { fontSize: 14, color: '#666' },
  amount: { fontSize: 28, fontWeight: '800', color: '#111', marginTop: 6 },
  starsRow: { paddingVertical: 6 },
  star: { fontSize: 22, color: '#f5a524' },
  primary: { backgroundColor: '#111827', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 18 },
  primaryText: { color: '#fff', fontWeight: '700' },
});
