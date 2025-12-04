import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../theme';
import { Fonts } from '../font';
import { API_URL } from './config';

export default function DriverExistingAccountScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const cleaned = phone.replace(/\s/g, '');
    if (!cleaned) {
      setError('Veuillez entrer votre numéro de téléphone.');
      return;
    }
    if (!API_URL) {
      setError('API_URL non configurée');
      return;
    }

    const e164 = `+229${cleaned}`;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_URL}/auth/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ phone: e164 }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json) {
        const msg = (json && (json.message || json.error)) || "Impossible de vérifier le compte.";
        setError(msg);
        Alert.alert('Erreur', msg);
        return;
      }

      if (json.status === 'already_verified' && json.token) {
        try {
          await AsyncStorage.setItem('authToken', json.token);
          if (json.user) {
            await AsyncStorage.setItem('authUser', JSON.stringify(json.user));
          }
          const role = json.user?.role as string | undefined;

          // Si le compte est un passager, on bloque l'accès à l'app chauffeur
          if (role && role !== 'driver') {
            await AsyncStorage.removeItem('authToken');
            await AsyncStorage.removeItem('authUser');
            Alert.alert(
              'Compte passager',
              "Ce compte est un compte passager. Pour devenir chauffeur, utilisez l’option \"Devenir chauffeur\" dans l’application passager."
            );
            return;
          }

        } catch {}

        try {
          const token = await AsyncStorage.getItem('authToken');
          if (token && API_URL) {
            const resProfile = await fetch(`${API_URL}/driver/profile`, {
              method: 'GET',
              headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${token}`,
              },
            });

            const jsonProfile = await resProfile.json().catch(() => null);
            const status = jsonProfile?.profile?.status as string | undefined;
            const role = jsonProfile?.user?.role as string | undefined;

            if (status === 'pending') {
              router.replace('/driver-pending-approval' as any);
              return;
            }

            if (status === 'approved' && role === 'driver') {
              router.replace('/driver-contract' as any);
              return;
            }
          }
        } catch {}

        router.push('/driver-existing-details' as any);
        return;
      }

      const msg = "Nous n'avons pas trouvé de compte existant vérifié pour ce numéro. Veuillez utiliser l'autre option de connexion.";
      setError(msg);
      Alert.alert('Information', msg);
    } catch (e: any) {
      const msg = e?.message || 'Erreur réseau lors de la vérification du compte.';
      setError(msg);
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.topBlock}>
          <Text style={styles.title}>Utiliser mon compte existant</Text>
          <Text style={styles.subtitle}>
            Saisissez le numéro de téléphone que vous utilisez déjà sur TIC MITON.
          </Text>
           <View style={styles.bottomBlock}>
          <Text style={styles.label}>Numéro de téléphone</Text>

          <View style={styles.phoneRow}>
            <View style={styles.countryBadge}>
              <Text style={styles.flag}>🇧🇯</Text>
              <Text style={styles.countryCode}>+229</Text>
            </View>

            <TextInput
              style={styles.phoneInput}
              placeholder="00 00 00 00"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          {error && <Text style={{ color: '#B91C1C', marginBottom: 8 }}>{error}</Text>}

          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={submit}
            disabled={loading}
          >
            <Text style={styles.primaryText}>{loading ? 'Vérification...' : 'Continuer'}</Text>
          </TouchableOpacity>
        </View>
        </View>

       
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: 32,
    justifyContent: 'space-between',
  },
  topBlock: {
    marginTop: 50,
  },
  title: {
    fontFamily: Fonts.unboundedBold,
    fontSize: 26,
    color: Colors.black,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 16,
    color: Colors.gray,
    lineHeight: 24,
  },
  bottomBlock: {
    paddingVertical: 100,
  },
  label: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 15,
    color: Colors.black,
    marginBottom: 10,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  countryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.lightGray,
    marginRight: 10,
  },
  flag: {
    fontSize: 18,
    marginRight: 6,
  },
  countryCode: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 15,
    color: Colors.black,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    fontFamily: Fonts.titilliumWeb,
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
    marginTop: 8,
  },
  primaryText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: 'white',
  },
});
