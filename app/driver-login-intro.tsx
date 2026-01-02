import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Colors } from '../theme';
import { Fonts } from '../font';
import { API_URL } from './config';

export default function DriverLoginIntroScreen() {
  const router = useRouter();

  useEffect(() => {
    const checkExistingDriver = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token || !API_URL) return;

        const res = await fetch(`${API_URL}/driver/profile`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await res.json().catch(() => null);
        if (!res.ok || !json) return;

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

        if (status === 'approved' && role === 'driver') {
          if (contractAcceptedAt) {
            router.replace('/(tabs)' as any);
          } else {
            router.replace('/driver-contract' as any);
          }
          return;
        }
      } catch { }
    };

    checkExistingDriver();
  }, [router]);

  const handleLogin = () => {
    router.push('/driver-phone-login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* TOP : LOGO & INTRO */}
        <View style={styles.topBlock}>
          <Image
            source={require('../assets/images/Logo blanc.png')}
            style={styles.logo}
          />

          <Text style={styles.title}>Connexion chauffeur</Text>

          <Text style={styles.subtitle}>
            Connectez-vous avec votre numéro de téléphone pour accéder à vos courses et commencer votre journée.
          </Text>
        </View>

        {/* BOTTOM */}
        <View style={styles.bottomBlock}>
          <TouchableOpacity
            style={styles.ctaButton}
            activeOpacity={0.85}
            onPress={handleLogin}
          >
            <Text style={styles.ctaText}>Se connecter avec un numéro</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary, // Fond Bleu
  },

  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: 32,
    justifyContent: 'space-between',
  },

  // TOP
  topBlock: {
    marginTop: 40,
    alignItems: 'center', // Centrer le logo
  },

  logo: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
    marginBottom: 30,
  },

  title: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 28,
    color: 'white', // Texte en blanc
    marginBottom: 14,
    letterSpacing: -0.5,
    textAlign: 'center',
  },

  subtitle: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)', // Blanc légèrement transparent
    lineHeight: 24,
    textAlign: 'center',
  },

  // BOTTOM
  bottomBlock: {
    paddingVertical: 24,
  },

  ctaButton: {
    marginTop: 24,
    backgroundColor: 'white', // Bouton blanc pour contraster
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',

    // Ombre
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },

  ctaText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 17,
    color: Colors.primary, // Texte bleu
  },
});
