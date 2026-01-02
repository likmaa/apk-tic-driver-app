import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../theme';
import { Fonts } from '../font';
import { Ionicons } from "@expo/vector-icons";

export default function DriverApprovedSuccessScreen() {
    const router = useRouter();

    const handleContinue = async () => {
        // Marquer que l'écran de succès a été vu
        await AsyncStorage.setItem('hasSeenApprovalSuccess', 'true');
        // Rediriger vers l'écran de contrat
        router.replace('/driver-contract');
    };

    return (
        <SafeAreaView style={styles.container}>

            {/* HEADER */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Validation réussie</Text>
            </View>

            <View style={styles.content}>

                {/* CARD */}
                <View style={styles.card}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="checkmark-circle" size={80} color="#10B981" />
                    </View>

                    <Text style={styles.title}>Félicitations !</Text>

                    <Text style={styles.subtitle}>
                        Votre candidature a été approuvée par notre équipe.
                        Vous pouvez maintenant accepter le contrat pour commencer à conduire avec TIC MITON.
                    </Text>

                    <View style={styles.infoBox}>
                        <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
                        <Text style={styles.infoText}>
                            Vous êtes à une étape de devenir chauffeur partenaire
                        </Text>
                    </View>
                </View>

                {/* BUTTON */}
                <TouchableOpacity
                    style={styles.primaryButton}
                    activeOpacity={0.85}
                    onPress={handleContinue}
                >
                    <Text style={styles.primaryText}>Continuer</Text>
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
        fontSize: 24,
        color: Colors.black,
        marginBottom: 12,
    },

    subtitle: {
        textAlign: "center",
        fontFamily: Fonts.titilliumWeb,
        fontSize: 15,
        color: Colors.gray,
        lineHeight: 22,
        marginBottom: 20,
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
