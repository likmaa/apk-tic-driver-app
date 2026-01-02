import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Image, Animated, StatusBar } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../theme';
import { API_URL } from './config';

export default function SplashScreen() {
    const router = useRouter();
    const segments = useSegments();
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const prepareAndNavigate = async () => {
            try {
                // Délai minimum de 3 secondes ET vérification complète
                const verificationPromise = verifySession();
                const minDelayPromise = new Promise(resolve => setTimeout(resolve, 3000));

                // Attendre que les deux soient terminés
                await Promise.all([verificationPromise, minDelayPromise]);

                setIsChecking(false);

            } catch (e) {
                // Attendre quand même le délai minimum avant de naviguer
                await new Promise(resolve => setTimeout(resolve, 3000));
                setIsChecking(false);
                router.replace('/driver-onboarding');
            }
        };

        const verifySession = async () => {
            try {
                const token = await AsyncStorage.getItem('authToken');

                if (!token) {
                    router.replace('/driver-onboarding');
                    return;
                }

                // Si pas d'API_URL configurée, on laisse passer (mode dév / secours)
                if (!API_URL) {
                    router.replace('/(tabs)');
                    return;
                }

                // Vérification auprès du backend
                const res = await fetch(`${API_URL}/driver/profile`, {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (res.status === 401) {
                    // Token expiré ou invalide
                    await AsyncStorage.removeItem('authToken');
                    await AsyncStorage.removeItem('authUser');
                    await AsyncStorage.removeItem('hasSeenApprovalSuccess');
                    router.replace('/driver-onboarding');
                    return;
                }

                const json = await res.json().catch(() => null);

                // Si erreur serveur autre que 401
                if (!res.ok || !json?.profile) {
                    if (json && !json.profile) {
                        router.replace('/driver-onboarding');
                        return;
                    }
                    router.replace('/(tabs)');
                    return;
                }

                const status = json.profile.status;
                const contractAcceptedAt = json.profile.contract_accepted_at;

                // Logique de redirection selon le statut
                if (status === 'pending') {
                    router.replace('/driver-pending-approval');
                    return;
                }

                if (status === 'rejected') {
                    router.replace('/driver-application-rejected');
                    return;
                }

                if (status === 'approved') {
                    // Vérifier si l'écran de succès a déjà été affiché
                    const hasSeenSuccess = await AsyncStorage.getItem('hasSeenApprovalSuccess');

                    if (!hasSeenSuccess) {
                        // Première fois approuvé → Afficher l'écran de succès
                        router.replace('/driver-approved-success');
                        return;
                    }

                    // Success déjà vu, vérifier le contrat
                    if (!contractAcceptedAt) {
                        router.replace('/driver-contract');
                        return;
                    }

                    // Contrat accepté → Dashboard
                    router.replace('/(tabs)');
                    return;
                }

                // Par défaut, dashboard
                router.replace('/(tabs)');

            } catch (error) {
                // Erreur réseau probable → on laisse entrer, le dashboard gérera l'état offline
                router.replace('/(tabs)');
            }
        };

        prepareAndNavigate();
    }, []);

    // Bloquer le rendu de tout autre écran tant que la vérification n'est pas terminée
    if (isChecking || segments.length === 0 || segments[0] === 'index') {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={Colors.primary} translucent />
                <Animated.View style={[
                    styles.contentContainer,
                    {
                        opacity: fadeAnim,
                        transform: [{ scale: scaleAnim }]
                    }
                ]}>
                    <Image
                        source={require('../assets/images/Logo blanc.png')}
                        style={{ width: 150, height: 150, resizeMode: 'contain' }}
                    />
                    <ActivityIndicator size="large" color="white" style={{ marginTop: 20 }} />
                </Animated.View>
            </View>
        );
    }

    // Ne rien afficher si on n'est plus sur l'index
    return null;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.primary, // Fond Bleu
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 20
    }
});
