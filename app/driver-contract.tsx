import React, { useEffect } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../theme';
import { Fonts } from '../font';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../config';

import { useDriverStore } from './providers/DriverProvider';

export default function DriverContractScreen() {
  const router = useRouter();
  const { refreshProfile } = useDriverStore();

  useEffect(() => {
    const checkAccepted = async () => {
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
        if (res.ok && json?.profile?.contract_accepted_at) {
          router.replace('/(tabs)' as any);
          return;
        }
      } catch { }
    };

    checkAccepted();
  }, [router]);

  const handleAccept = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token && API_URL) {
        const res = await fetch(`${API_URL}/driver/contract/accept`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          await refreshProfile();
          router.replace('/(tabs)' as any);
        } else {
          Alert.alert('Erreur', 'Impossible de valider le contrat. Veuillez réessayer.');
        }
      }
    } catch {
      Alert.alert('Erreur', 'Erreur réseau. Veuillez vérifier votre connexion.');
    }
  };

  const handleReject = async () => {
    // Si le chauffeur refuse le contrat, on le déconnecte pour qu'il revienne à l'onboarding
    await AsyncStorage.multiRemove(['authToken', 'authUser']);
    router.replace('/driver-onboarding' as any);
  };

  return (
    <SafeAreaView style={styles.container}>

      {/* ---------- HEADER ---------- */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleReject} style={styles.backButton}>
          <Ionicons name="chevron-back" size={26} color={Colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contrat Chauffeur</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* ---------- CONTENT ---------- */}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Contrat TIC MITON Chauffeur</Text>

        <Text style={styles.subtitle}>
          Veuillez lire attentivement les conditions suivantes.
        </Text>

        <View style={styles.card}>
          <Text style={styles.paragraph}>
            Ce contrat définit les obligations du chauffeur, les règles de sécurité,
            les conditions de rémunération, l'utilisation des données, ainsi que les
            responsabilités pour offrir un service de qualité conforme aux normes TIC MITON.
          </Text>

          <Text style={styles.paragraph}>
            En acceptant ce contrat, vous vous engagez à respecter le code de conduite,
            assurer la sécurité des passagers, maintenir un comportement professionnel
            et respecter les lois en vigueur dans votre pays.
          </Text>
        </View>

        {/* ---------- ACTION BUTTONS ---------- */}
        <View style={styles.buttonsRow}>

          <TouchableOpacity style={styles.rejectButton} activeOpacity={0.8} onPress={handleReject}>
            <Text style={styles.rejectText}>Utiliser un autre numéro</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.acceptButton} activeOpacity={0.8} onPress={handleAccept}>
            <Text style={styles.acceptText}>J'accepte</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 30
  },

  /* HEADER */
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 18,
    color: Colors.black,
  },

  /* CONTENT */
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },

  title: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 22,
    color: Colors.black,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 20,
  },

  /* CARD */
  card: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    marginBottom: 24,
  },

  paragraph: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.black,
    lineHeight: 22,
    marginBottom: 12,
  },

  /* BUTTONS */
  buttonsRow: {
    flexDirection: 'column',
    gap: 14,
  },

  rejectButton: {
    paddingVertical: 14,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
  },
  rejectText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 14,
    color: Colors.primary,
  },

  acceptButton: {
    paddingVertical: 14,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  acceptText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 15,
    color: 'white',
  },
});
