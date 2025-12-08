import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../theme';
import { Fonts } from '../font';
import { API_URL } from './config';
import { validatePhoneNumber } from './utils/validation';
import { handleApiError } from './utils/errorHandler';

export default function DriverExistingAccountScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const cleaned = phone.replace(/\s/g, '');
    
    // Validation côté client
    const phoneValidation = validatePhoneNumber(cleaned);
    if (!phoneValidation.isValid) {
      setError(phoneValidation.error || 'Numéro de téléphone invalide');
      Alert.alert('Erreur de validation', phoneValidation.error || 'Numéro de téléphone invalide');
      return;
    }

    if (!API_URL) {
      setError('API_URL non configurée');
      Alert.alert('Erreur de configuration', "L'URL de l'API n'est pas configurée.");
      return;
    }

    const e164 = `+229${cleaned}`;

    try {
      setLoading(true);
      setError(null);

      // Envoyer l'OTP - l'API envoie toujours un OTP, même si le compte existe
      const res = await fetch(`${API_URL}/auth/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ phone: e164, force_new: false }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json) {
        await handleApiError(null, res, "Impossible d'envoyer le code de vérification.");
        const msg = (json && (json.message || json.error)) || "Impossible d'envoyer le code de vérification.";
        setError(msg);
        return;
      }

      // Si l'OTP est envoyé avec succès, stocker les infos et rediriger vers la vérification
      if (json.status === 'otp_sent' || json.provider?.reason === 'success' || json.provider?.reason === 'already_exists') {
        // Stocker le numéro et la clé OTP pour la vérification
        await AsyncStorage.setItem('pendingPhone', e164);
        if (json.otp_key) {
          await AsyncStorage.setItem('pendingOtpKey', json.otp_key);
        } else if (json.provider?.key) {
          await AsyncStorage.setItem('pendingOtpKey', json.provider.key);
        }
        
        // Rediriger vers la page de connexion qui gère la vérification OTP
        // On passe le numéro en paramètre pour pré-remplir le champ
        // Utiliser replace pour éviter l'empilement des écrans
        router.replace({
          pathname: '/driver-phone-login' as any,
          params: { phone: cleaned, useExistingAccount: 'true' }
        } as any);
        return;
      }

      // Si le statut n'est pas reconnu, afficher une erreur
      const msg = "Impossible d'envoyer le code de vérification. Veuillez réessayer.";
      setError(msg);
      Alert.alert('Erreur', msg);
    } catch (e: any) {
      const errorMessage = await handleApiError(e, undefined, 'Erreur réseau lors de l\'envoi du code.', false);
      setError(errorMessage);
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
