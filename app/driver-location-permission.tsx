import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../theme';
import { Fonts } from '../font';
import { Ionicons } from '@expo/vector-icons';

export default function DriverLocationPermissionScreen() {
  const router = useRouter();

  const handleContinue = async () => {
    // Demander la permission
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status === 'granted') {
      router.push('/driver-login-intro');
    } else {
      // Alerte en cas de refus
      Alert.alert(
        'Permission requise',
        'La localisation est nécessaire pour recevoir des courses et naviguer. Veuillez l\'autoriser dans les réglages.',
        [
          { text: 'Plus tard', style: 'cancel', onPress: () => router.push('/driver-login-intro') },
          { text: 'Réessayer', onPress: handleContinue }
        ]
      );
    }
  };

  const handleSkip = () => {
    router.push('/driver-login-intro');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Header / Illustration */}
        <View style={styles.header}>
          <View style={styles.iconWrapper}>
            <Ionicons name="location-outline" size={42} color={Colors.primary} />
          </View>

          <Text style={styles.title}>Activer la localisation</Text>
          <Text style={styles.subtitle}>
            Pour vous envoyer des courses proches et suivre vos trajets en toute
            sécurité, TIC MITON a besoin d’accéder à votre position.
          </Text>
        </View>

        {/* Pourquoi */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Pourquoi c'est nécessaire :</Text>

          <View style={styles.row}>
            <Ionicons name="navigate-outline" size={18} color={Colors.primary} />
            <Text style={styles.infoText}>Trouver des clients autour de vous</Text>
          </View>

          <View style={styles.row}>
            <Ionicons name="time-outline" size={18} color={Colors.primary} />
            <Text style={styles.infoText}>Calculer les trajets et durées</Text>
          </View>

          <View style={styles.row}>
            <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary} />
            <Text style={styles.infoText}>Garantir votre sécurité</Text>
          </View>
        </View>

        {/* CTA */}
        <View>
          <TouchableOpacity
            style={styles.ctaButton}
            activeOpacity={0.85}
            onPress={handleContinue}
          >
            <Text style={styles.ctaText}>Autoriser la localisation</Text>
            <Ionicons name="arrow-forward" size={20} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.8}
            onPress={handleSkip}
          >
            <Text style={styles.secondaryText}>Plus tard</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },

  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: 40,
    justifyContent: 'space-between',
  },

  header: {
    alignItems: 'center',
    marginTop: 20,
  },

  iconWrapper: {
    backgroundColor: Colors.primary + '15',
    padding: 18,
    borderRadius: 50,
    marginBottom: 20,
  },

  title: {
    fontFamily: Fonts.unboundedBold,
    fontSize: 26,
    color: Colors.black,
    textAlign: 'center',
    marginBottom: 10,
  },

  subtitle: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 15,
    color: Colors.gray,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 14,
  },

  infoBox: {
    backgroundColor: Colors.background,
    padding: 20,
    borderRadius: 16,
    marginTop: 16,
  },

  infoTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 15,
    color: Colors.black,
    marginBottom: 14,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  infoText: {
    fontFamily: Fonts.titilliumWebSemiBold,
    fontSize: 15,
    color: Colors.black,
    marginLeft: 10,
  },

  ctaButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },

  ctaText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 17,
    color: 'white',
  },

  secondaryButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',

    backgroundColor: Colors.secondary
  },

  secondaryText: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.white,
  },
});
