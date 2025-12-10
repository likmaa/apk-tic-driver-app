import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../theme';
import { Fonts } from '../font';
import { API_URL } from './config';

export default function DriverPhoneLoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendOtp = async (forceNew = false) => {
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
        body: JSON.stringify({
          phone: e164,
          force_new: forceNew
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        const msg = (json && (json.message || json.error)) || "Impossible d’envoyer le code OTP.";
        setError(msg);
        Alert.alert('Erreur', msg);
        return;
      }

      // Cas déjà vérifié
      if (json.status === 'already_verified' && json.token) {
        try {
          await AsyncStorage.setItem('authToken', json.token);
          if (json.user) {
            await AsyncStorage.setItem('authUser', JSON.stringify(json.user));
          }
          // Redirection directe si déjà connecté/vérifié (géré ici ou via un helper commun si besoin)
          // Pour l'instant on laisse la logique de redirection simple ici ou on pourrait appeler handlePostLoginRouting
          // Mais comme on supprime handlePostLoginRouting de ce fichier, on peut juste rediriger vers le dashboard
          // ou mieux : appeler la vérification de profil.
          // Pour simplifier : on redirige vers OTP screen quand même qui fera la vérif auto ? Non, mauvaise UX.
          // On va réimplémenter une mini redirection ou passer l'info.
          router.replace('/(tabs)' as any);
          return;
        } catch { }
      }

      const otpKey = json.otp_key || '';

      // Navigation vers l'écran OTP
      router.push({
        pathname: '/driver-login-otp',
        params: { phone: cleaned, otpKey }
      } as any);

    } catch (e: any) {
      const msg = e?.message || 'Erreur réseau lors de la demande de code.';
      setError(msg);
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <View style={styles.content}>

            {/* TOP */}
            <View style={styles.topBlock}>
              <Text style={styles.title}>Connexion chauffeur</Text>

              <Text style={styles.subtitle}>
                Identifiez-vous avec votre numéro de téléphone.
                Si vous êtes déjà passager TIC MITON, vous pouvez utiliser le même compte.
              </Text>
            </View>

            {/* FORM */}
            <View style={styles.bottomBlock}>

              {/* PHONE ENTRY */}
              <View style={styles.phoneBlock}>
                <Text style={styles.label}>Numéro de téléphone</Text>

                <View style={styles.phoneRow}>
                  <View style={styles.countryBadge}>
                    <Text style={styles.flag}>🇧🇯</Text>
                    <Text style={styles.countryCode}>+229</Text>
                  </View>

                  <TextInput
                    style={styles.phoneInput}
                    placeholder="01 00 00 00 00"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                    autoFocus={true}
                    maxLength={14} // Autorise les espaces
                  />
                </View>

                {error && (
                  <Text style={{ color: 'red', marginBottom: 8 }}>{error}</Text>
                )}

                <TouchableOpacity
                  style={styles.primaryButton}
                  activeOpacity={0.85}
                  onPress={() => sendOtp(false)}
                  // On vérifie la longueur nettoyée (sans espaces) -> doit être 10
                  disabled={loading || phone.replace(/\s/g, '').length < 10}
                >
                  <Text style={styles.primaryText}>{loading ? 'Envoi...' : 'Continuer'}</Text>
                </TouchableOpacity>

              </View>

            </View>

          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
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
    justifyContent: 'flex-start', // Changement de space-between à flex-start
  },

  // TOP
  topBlock: {
    marginTop: 40, // Réduit légèrement
    marginBottom: 40, // Ajout d'espacement avec le formulaire
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
    // paddingVertical supprimé pour éviter de pousser trop bas
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
    marginTop: 0,
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
    marginBottom: 24, // Augmenté un peu pour aérer
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

  resendButton: {
    marginTop: 10,
    alignItems: 'center',
    padding: 10,
  },

  resendText: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.gray,
    textDecorationLine: 'underline',
  },
});
