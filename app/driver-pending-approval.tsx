import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../theme';
import { Fonts } from '../font';
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from '../config';

export default function DriverPendingApprovalScreen() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  const checkStatus = useCallback(async () => {
    try {
      setIsChecking(true);
      const token = await AsyncStorage.getItem('authToken');

      if (!token || !API_URL) {
        setIsChecking(false);
        return;
      }

      const res = await fetch(`${API_URL}/driver/profile`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        // Token invalide, rediriger vers login
        await AsyncStorage.removeItem('authToken');
        await AsyncStorage.removeItem('authUser');
        router.replace('/driver-onboarding');
        return;
      }

      const json = await res.json().catch(() => null);

      if (json?.profile) {
        const status = json.profile.status;

        if (status === 'approved') {
          // Rediriger vers l'écran de succès
          router.replace('/driver-approved-success');
          return;
        } else if (status === 'rejected') {
          // Rediriger vers l'écran de rejet
          router.replace('/driver-application-rejected');
          return;
        }
      }

      setLastCheck(new Date());
      setIsChecking(false);
    } catch (error) {
      console.error('Erreur lors de la vérification du statut:', error);
      setIsChecking(false);
    }
  }, [router]);

  useEffect(() => {
    // Vérification initiale
    checkStatus();

    // Polling toutes les 5 secondes
    const interval = setInterval(() => {
      checkStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [checkStatus]);

  const handleRefresh = () => {
    checkStatus();
  };

  return (
    <SafeAreaView style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Validation en cours</Text>
      </View>

      <View style={styles.content}>

        {/* CARD */}
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons name="time-outline" size={70} color={Colors.primary} />
          </View>

          <Text style={styles.title}>Demande envoyée</Text>

          <Text style={styles.subtitle}>
            Votre demande pour devenir chauffeur TIC MITON a été envoyée avec succès.
            Nos équipes vont vérifier vos documents et activer votre profil.
          </Text>

          {/* STATUS INDICATOR */}
          <View style={styles.statusContainer}>
            {isChecking ? (
              <View style={styles.checkingRow}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.checkingText}>Vérification en cours...</Text>
              </View>
            ) : (
              <View style={styles.checkingRow}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.lastCheckText}>
                  Dernière vérification: {lastCheck.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}
          </View>

          {/* INFO BOX */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>
              Vous recevrez une notification dès que votre profil sera validé
            </Text>
          </View>
        </View>

        {/* REFRESH BUTTON */}
        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.85}
          onPress={handleRefresh}
          disabled={isChecking}
        >
          <Ionicons name="refresh" size={20} color={Colors.primary} style={{ marginRight: 8 }} />
          <Text style={styles.secondaryText}>Rafraîchir le statut</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  headerTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 18,
    color: Colors.black,
  },

  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingBottom: 40,
    justifyContent: "space-between",
  },

  card: {
    backgroundColor: "white",
    padding: 26,
    borderRadius: 18,
    marginTop: 40,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },

  iconContainer: {
    alignItems: "center",
    marginBottom: 20,
  },

  title: {
    textAlign: "center",
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 22,
    color: Colors.black,
    marginBottom: 10,
  },

  subtitle: {
    textAlign: "center",
    fontFamily: Fonts.titilliumWeb,
    fontSize: 15,
    color: Colors.gray,
    lineHeight: 22,
    marginBottom: 20,
  },

  statusContainer: {
    marginBottom: 16,
  },

  checkingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  checkingText: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 13,
    color: Colors.primary,
  },

  lastCheckText: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 13,
    color: "#10B981",
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },

  infoText: {
    flex: 1,
    fontFamily: Fonts.titilliumWeb,
    fontSize: 13,
    color: Colors.primary,
    lineHeight: 18,
  },

  secondaryButton: {
    flexDirection: "row",
    backgroundColor: "white",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },

  secondaryText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: Colors.primary,
  },
});
