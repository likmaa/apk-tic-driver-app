import React from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';

export default function HelpScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Centre d'aide</Text>
      <View style={styles.card}>
        <Text style={styles.text}>Besoin d'aide pour une course, un client, ou l'application ?</Text>
        <TouchableOpacity style={styles.primary} onPress={() => {}}>
          <Text style={styles.primaryText}>Signaler un problème</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.card}>
        <Text style={styles.text}>FAQ</Text>
        <Text style={styles.item}>• Comment accepter une course ?</Text>
        <Text style={styles.item}>• Comment retirer mes gains ?</Text>
        <Text style={styles.item}>• Que faire en cas de panne ?</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7F9', padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 },
  text: { color: '#111', marginBottom: 10 },
  item: { color: '#666', marginTop: 6 },
  primary: { backgroundColor: '#111827', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
});
