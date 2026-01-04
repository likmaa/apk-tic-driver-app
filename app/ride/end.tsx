import React from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useDriverStore } from '../providers/DriverProvider';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function EndRideScreen() {
  const router = useRouter();
  const { currentRide } = useDriverStore();

  const fare = currentRide?.fare || 0;
  // For now, tip and rating are placeholders as they might be updated asynchronously
  const tip = 0;
  const rating = 5.0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.successIconContainer}>
          <MaterialCommunityIcons name="check-circle" size={80} color="#22c55e" />
        </View>

        <Text style={styles.mainTitle}>Course terminée avec succès !</Text>
        <Text style={styles.subTitle}>Excellent travail. Voici le résumé de vos gains.</Text>

        <View style={styles.card}>
          <View style={styles.earningsRow}>
            <Text style={styles.label}>Montant reçu</Text>
            <Text style={styles.amountValue}>{fare.toLocaleString('fr-FR')} FCFA</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.otherStats}>
            <View style={styles.statBox}>
              <MaterialCommunityIcons name="hand-coin-outline" size={24} color="#f59e0b" />
              <Text style={styles.statLabel}>Pourboire</Text>
              <Text style={styles.statValue}>{tip > 0 ? `${tip} FCFA` : '--'}</Text>
            </View>

            <View style={styles.verticalDivider} />

            <View style={styles.statBox}>
              <MaterialCommunityIcons name="star" size={24} color="#fbbf24" />
              <Text style={styles.statLabel}>Note reçue</Text>
              <Text style={styles.statValue}>{rating.toFixed(1)}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.primaryBtnText}>Retour au tableau de bord</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  successIconContainer: { marginBottom: 20 },
  mainTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A', textAlign: 'center', marginBottom: 8 },
  subTitle: { fontSize: 16, color: '#64748B', textAlign: 'center', marginBottom: 32 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 8, marginBottom: 32 },
  earningsRow: { alignItems: 'center', marginBottom: 20 },
  label: { fontSize: 14, color: '#64748B', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  amountValue: { fontSize: 32, fontWeight: '900', color: '#1E293B' },

  divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 20 },

  otherStats: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  statBox: { alignItems: 'center', flex: 1 },
  statLabel: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  statValue: { fontSize: 18, fontWeight: '700', color: '#334155', marginTop: 2 },

  verticalDivider: { width: 1, height: 40, backgroundColor: '#F1F5F9' },

  primaryBtn: { backgroundColor: '#0F172A', width: '100%', borderRadius: 16, paddingVertical: 18, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
