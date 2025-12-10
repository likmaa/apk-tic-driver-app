import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Image, Animated, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../theme';
import { API_URL } from './config';

export default function SplashScreen() {
    const router = useRouter();
    const fadeAnim = useRef(new Animated.Value(1)).current; // Opacité initiale à 1
    const scaleAnim = useRef(new Animated.Value(1)).current; // Échelle initiale à 1

    useEffect(() => {
        const prepareAndNavigate = async () => {
            try {
                // Attente minimale de 1.5 secondes pour afficher le splash
                await new Promise(resolve => setTimeout(resolve, 1500));

                // Vérification de la session (le loader bleu reste affiché)
                await verifySession();

            } catch (e) {
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
                    router.replace('/driver-onboarding');
                    return;
                }

                const json = await res.json().catch(() => null);

                // Si erreur serveur autre que 401, on peut décider de laisser entrer 
                // en mode "hors ligne" ou de bloquer. Pour la stabilité, bloquons si le profil est introuvable.
                if (!res.ok || !json?.profile) {
                    // Si on a json mais pas profile -> prob de structure -> login
                    if (json && !json.profile) {
                        router.replace('/driver-onboarding');
                        return;
                    }

                    // Si erreur réseau (fetch throw), catch le gère. Ici c'est HTTP error.
                    // On laisse passer vers le dashboard qui s'affichera en mode "Sync failed"
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
                    if (!contractAcceptedAt) {
                        router.replace('/driver-contract');
                        return;
                    }
                    router.replace('/(tabs)');
                    return;
                }

                // Par défaut, dashboard
                router.replace('/(tabs)');

            } catch (error) {
                // Erreur réseau probable -> on laisse entrer, le dashboard gérera l'état offline
                router.replace('/(tabs)');
            }
        };

        prepareAndNavigate();
    }, []);

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
