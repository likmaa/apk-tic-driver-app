import React from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useNavigation, useLocalSearchParams } from 'expo-router';

export default function CompleteRide() {
  const navigation = useNavigation();
  const params = useLocalSearchParams();

  const amount = params.amount ? parseFloat(params.amount as string) : 0;
  const distanceKm = params.distance ? parseFloat(params.distance as string) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Course terminée</Text>

      <View style={styles.card}>
        <View style={styles.row}><Text style={styles.label}>Distance</Text><Text style={styles.value}>{distanceKm.toFixed(1)} km</Text></View>
        <View style={styles.row}><Text style={styles.label}>Montant</Text><Text style={styles.value}>FCFA {amount.toLocaleString('fr-FR')}</Text></View>
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('/(tabs)' as never)}>
        <Text style={styles.primaryText}>Retour</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f6f6f6' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#eee' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { color: '#666' },
  value: { fontWeight: '600' },
  primaryBtn: { marginTop: 18, backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
});
