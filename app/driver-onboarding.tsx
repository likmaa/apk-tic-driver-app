import React, { useEffect } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../theme';
import { Fonts } from '../font';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../config';

export default function DriverOnboardingScreen() {
  const router = useRouter();


  // La redirection automatique a été déplacée dans app/index.tsx (Splash Screen)
  // Cet écran sert uniquement à présenter l'application quand on est déconnecté.

  return (
    <SafeAreaView style={styles.container}>

      {/* Bloc principal */}
      <View style={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconWrapper}>
            <Ionicons name="car-sport-outline" size={42} color={Colors.primary} />
          </View>

          <Text style={styles.title}>Devenez Chauffeur TIC MITON</Text>
          <Text style={styles.subtitle}>
            Recevez des courses, optimisez vos trajets et augmentez vos revenus
            grâce à une plateforme moderne et intuitive.
          </Text>
        </View>

        {/* Avantages */}
        <View style={styles.featuresBox}>
          <View style={styles.featureRow}>
            <Ionicons name="flash-outline" size={20} color={Colors.primary} />
            <Text style={styles.featureText}>Demandes de courses en temps réel</Text>
          </View>

          <View style={styles.featureRow}>
            <Ionicons name="wallet-outline" size={20} color={Colors.primary} />
            <Text style={styles.featureText}>Suivi des gains et historique</Text>
          </View>

          <View style={styles.featureRow}>
            <Ionicons name="headset-outline" size={20} color={Colors.primary} />
            <Text style={styles.featureText}>Assistance continue TIC MITON</Text>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={styles.ctaButton}
          activeOpacity={0.85}
          onPress={() => router.push('/driver-location-permission')}
        >
          <Text style={styles.ctaText}>Commencer maintenant</Text>
          <Ionicons name="arrow-forward" size={20} color="white" />
        </TouchableOpacity>

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
    marginTop: 30,
  },

  iconWrapper: {
    backgroundColor: Colors.primary + '15',
    padding: 18,
    borderRadius: 50,
    marginBottom: 16,
  },

  title: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 26,
    color: Colors.black,
    textAlign: 'center',
    marginBottom: 12,
  },

  subtitle: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 15,
    color: Colors.gray,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },

  featuresBox: {
    backgroundColor: Colors.background,
    padding: 20,
    borderRadius: 16,
    marginTop: 16,
  },

  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  featureText: {
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
});
