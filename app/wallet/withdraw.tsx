import React from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';

export default function WithdrawScreen() {
  const router = useRouter();
  const [amount, setAmount] = React.useState('');
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Retirer mes gains</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Montant</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="Ex: 10000"
          keyboardType="number-pad"
          style={styles.input}
        />
        <TouchableOpacity style={styles.primary} onPress={() => router.back()}>
          <Text style={styles.primaryText}>Confirmer le retrait (placeholder)</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7F9', padding: 16 },
  header: { marginBottom: 10 },
  title: { fontSize: 20, fontWeight: '700', color: '#111' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  label: { color: '#666', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, marginBottom: 12, backgroundColor: '#fff' },
  primary: { backgroundColor: '#111827', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
});
