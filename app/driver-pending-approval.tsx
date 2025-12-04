import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../theme';
import { Fonts } from '../font';
import { Ionicons } from "@expo/vector-icons";

export default function DriverPendingApprovalScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.black} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Validation en cours</Text>
      </View>

      <View style={styles.content}>

        {/* CARD */}
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons name="checkmark-circle" size={70} color={Colors.primary} />
          </View>

          <Text style={styles.title}>Demande envoyée</Text>

          <Text style={styles.subtitle}>
            Votre demande pour devenir chauffeur TIC MITON a été envoyée avec succès.
            Nos équipes vont vérifier vos documents et activer votre profil.
          </Text>
        </View>

        {/* BUTTON */}
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.85}
          onPress={() => router.replace('/driver-login-intro')}
        >
          <Text style={styles.primaryText}>Retour à l'accueil chauffeur</Text>
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
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  backBtn: {
    padding: 5,
    marginRight: 8,
  },
  headerTitle: {
    fontFamily: Fonts.unboundedBold,
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
    fontFamily: Fonts.unboundedBold,
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
  },

  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
  },

  primaryText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: 'white',
  },
});
