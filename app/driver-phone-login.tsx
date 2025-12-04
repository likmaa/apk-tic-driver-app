import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../theme';
import { Fonts } from '../font';
import { API_URL } from './config';

export default function DriverPhoneLoginScreen() {
  const router = useRouter();
  const [useExistingAccount, setUseExistingAccount] = useState<boolean | null>(null);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [otpKey, setOtpKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePostLoginRouting = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token || !API_URL) {
        router.push('/driver-contract' as any);
        return;
      }

      const res = await fetch(`${API_URL}/driver/profile`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        router.push('/driver-contract' as any);
        return;
      }

      const status = json?.profile?.status as string | undefined;
      const role = json?.user?.role as string | undefined;
      const contractAcceptedAt = json?.profile?.contract_accepted_at as string | undefined;

      if (status === 'pending') {
        router.replace('/driver-pending-approval' as any);
        return;
      }

      if (status === 'rejected') {
        router.replace('/driver-application-rejected' as any);
        return;
      }

      if (status === 'approved' && role === 'driver' && contractAcceptedAt) {
        router.replace('/(tabs)' as any);
        return;
      }

      // approved sans contrat accepté ou pas encore de profil driver : continuer le flow normal
      router.push('/driver-contract' as any);
    } catch {
      router.push('/driver-contract' as any);
    }
  };

  const handleUseExisting = async () => {
    router.push('/driver-existing-account' as any);
  };

  const sendOtp = async () => {
    const cleaned = phone.replace(/\s/g, '');
    if (!cleaned) return;
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
        const msg = (json && (json.message || json.error)) || "Impossible d’envoyer le code OTP.";
        setError(msg);
        Alert.alert('Erreur', msg);
        return;
      }

      // Cas où le numéro est déjà vérifié : connexion directe
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

        // Rôle correct (driver) → on peut continuer le flux chauffeur
        await handlePostLoginRouting();
        return;
      }

      if (json.status !== 'otp_sent') {
        const msg = (json && (json.message || json.error)) || "Impossible d’envoyer le code OTP.";
        setError(msg);
        Alert.alert('Erreur', msg);
        return;
      }

      // On mémorise la clé OTP renvoyée par le backend pour la vérification
      if (json.otp_key) {
        setOtpKey(json.otp_key as string);
      } else {
        setOtpKey(null);
      }

      setUseExistingAccount(false);
      Alert.alert('Code envoyé', 'Un code OTP vous a été envoyé.');
    } catch (e: any) {
      const msg = e?.message || 'Erreur réseau lors de la demande de code.';
      setError(msg);
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    const cleaned = phone.replace(/\s/g, '');
    if (!cleaned || !code.trim() || code.trim().length !== 6) {
      Alert.alert('Information', 'Veuillez entrer un numéro et un code de 6 chiffres.');
      return;
    }
    if (!API_URL) {
      Alert.alert('Erreur', 'API_URL non configurée');
      return;
    }

    const e164 = `+229${cleaned}`;
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          phone: e164,
          code: code.trim(),
          otp_key: otpKey,
          role: 'driver',
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        const msg = (json && (json.message || json.error)) || 'Vérification OTP échouée';
        setError(msg);
        Alert.alert('Erreur', msg);
        return;
      }

      if (!json.token) {
        const msg = json?.message || 'Token manquant dans la réponse';
        setError(msg);
        Alert.alert('Erreur', msg);
        return;
      }

      try {
        await AsyncStorage.setItem('authToken', json.token);
        if (json.user) {
          await AsyncStorage.setItem('authUser', JSON.stringify(json.user));
        }

        // Vérifier le rôle via /auth/me pour bloquer les comptes passager
        const token = json.token as string;
        const resMe = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (resMe.ok) {
          const me = await resMe.json().catch(() => null);
          const role = me?.role as string | undefined;

          if (role && role !== 'driver') {
            await AsyncStorage.removeItem('authToken');
            await AsyncStorage.removeItem('authUser');
            Alert.alert(
              'Compte passager',
              "Ce compte est un compte passager. Pour devenir chauffeur, utilisez l’option \"Devenir chauffeur\" dans l’application passager."
            );
            return;
          }
        }

        // Rôle correct (driver) → on peut continuer le flux chauffeur
        await handlePostLoginRouting();

      } catch {}
    } catch (e: any) {
      const msg = e?.message || 'Erreur réseau lors de la vérification';
      setError(msg);
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* TOP */}
        <View style={styles.topBlock}>
          <Text style={styles.title}>Connexion chauffeur</Text>

          <Text style={styles.subtitle}>
            Identifiez-vous avec votre numéro de téléphone.  
            Si vous êtes déjà passager TIC MITON, vous pouvez utiliser le même compte.
          </Text>
        </View>

        {/* OPTIONS */}
        <View style={styles.bottomBlock}>
          {useExistingAccount === null && (
            <>
              <TouchableOpacity
                style={styles.primaryButton}
                activeOpacity={0.85}
                onPress={handleUseExisting}
              >
                <Text style={styles.primaryText}>Utiliser mon compte existant</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                activeOpacity={0.85}
                onPress={() => setUseExistingAccount(false)}
              >
                <Text style={styles.secondaryText}>Utiliser un autre numéro</Text>
              </TouchableOpacity>
            </>
          )}

          {/* PHONE ENTRY */}
          {useExistingAccount === false && (
            <View style={styles.phoneBlock}>
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

              {error && (
                <Text style={{ color: 'red', marginBottom: 8 }}>{error}</Text>
              )}

              {phone.trim().length > 0 && (
                <>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    activeOpacity={0.85}
                    onPress={sendOtp}
                    disabled={loading}
                  >
                    <Text style={styles.primaryText}>{loading ? 'Envoi...' : 'Envoyer le code'}</Text>
                  </TouchableOpacity>

                  <View style={styles.codeBlock}>
                    <Text style={styles.label}>Code de vérification</Text>

                    <TextInput
                      style={styles.codeInput}
                      placeholder="● ● ● ● ● ●"
                      keyboardType="number-pad"
                      value={code}
                      onChangeText={setCode}
                      maxLength={6}
                    />

                    <TouchableOpacity
                      style={styles.primaryButton}
                      activeOpacity={0.85}
                      onPress={verifyOtp}
                      disabled={loading}
                    >
                      <Text style={styles.primaryText}>
                        {loading ? 'Vérification...' : 'Valider le code reçu par SMS'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          )}
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

  // TOP
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

  // BOTTOM
  bottomBlock: {
    paddingVertical: 100,
  },

  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',

    // Ombre premium
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,

    marginBottom: 12,
  },

  primaryText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: 'white',
  },

  secondaryButton: {
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 14,
    marginTop: 4,
    backgroundColor: Colors.secondary
  },

  secondaryText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 15,
    color: Colors.white,
  },

  // PHONE INPUT BLOCK
  phoneBlock: {
    marginTop: 15,
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

  // CODE
  codeBlock: {
    marginTop: 24,
  },

  codeInput: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    textAlign: 'center',
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 18,
    letterSpacing: 8,
    marginBottom: 16,
  },
});
