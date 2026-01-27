import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Alert,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../theme';
import { Fonts } from '../font';
import { API_URL } from './config';

export default function DriverLoginOtpScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const phoneParam = params.phone as string;
    const initialOtpKey = params.otpKey as string;

    const [code, setCode] = useState('');
    const [otpKey, setOtpKey] = useState<string | null>(initialOtpKey);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!phoneParam) {
            Alert.alert('Erreur', 'Numéro de téléphone manquant.');
            router.back();
        }
    }, [phoneParam]);

    const handlePostLoginRouting = async (): Promise<string> => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            if (!token || !API_URL) return '/driver-onboarding';

            const res = await fetch(`${API_URL}/driver/profile`, {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            });

            const json = await res.json().catch(() => null);
            if (!res.ok || !json) return '/(tabs)';

            const status = json?.profile?.status as string | undefined;
            const role = json?.user?.role as string | undefined;
            const contractAcceptedAt = json?.profile?.contract_accepted_at as string | undefined;

            if (status === 'pending') return '/driver-pending-approval';
            if (status === 'rejected') return '/driver-application-rejected';
            if (status === 'approved' && role === 'driver' && contractAcceptedAt) return '/(tabs)';

            return '/driver-contract';
        } catch {
            return '/(tabs)';
        }
    };

    const sendOtp = async (forceNew = false) => {
        const cleaned = phoneParam.replace(/\s/g, '');
        if (!cleaned) return;
        if (!API_URL) {
            setError('API_URL non configurée');
            return;
        }

        const e164 = `+229${cleaned}`;

        try {
            setLoading(true);
            setError(null);

            const res = await fetch(`${API_URL}/auth/request-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    phone: e164,
                    force_new: forceNew,
                }),
            });

            const json = await res.json().catch(() => null);
            if (!res.ok || !json) {
                const msg = (json && (json.message || json.error)) || "Impossible d’envoyer le code OTP.";
                setError(msg);
                Alert.alert('Erreur', msg);
                return;
            }

            if (json.otp_key) {
                setOtpKey(json.otp_key as string);
            }

            Alert.alert('Code envoyé', 'Un nouveau code OTP vous a été envoyé.');
        } catch (e: any) {
            const msg = e?.message || 'Erreur réseau lors de la demande de code.';
            setError(msg);
            Alert.alert('Erreur', msg);
        } finally {
            setLoading(false);
        }
    };

    const verifyOtp = async () => {
        const cleaned = phoneParam.replace(/\s/g, '');
        if (!cleaned || !code.trim() || code.trim().length !== 6) {
            Alert.alert('Information', 'Veuillez entrer le code de 6 chiffres.');
            return;
        }
        if (!API_URL) {
            Alert.alert('Erreur', 'API_URL non configurée');
            return;
        }

        const e164 = `+229${cleaned}`;
        try {
            setLoading(true);
            setError(null);

            const res = await fetch(`${API_URL}/auth/verify-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    phone: e164,
                    code: code.trim(),
                    otp_key: otpKey,
                    role: 'driver',
                }),
            });

            const json = await res.json().catch(() => null);
            if (!res.ok || !json) {
                const msg = (json && (json.message || json.error)) || 'Vérification OTP échouée';
                setError(msg);
                Alert.alert('Erreur', msg);
                return;
            }

            if (!json.token) {
                const msg = json?.message || 'Token manquant dans la réponse';
                setError(msg);
                Alert.alert('Erreur', msg);
                return;
            }

            try {
                await AsyncStorage.setItem('authToken', json.token);
                if (json.user) {
                    await AsyncStorage.setItem('authUser', JSON.stringify(json.user));
                }

                // Register Push Notifications
                try {
                    const { registerForPushNotificationsAsync, registerTokenWithBackend } = require('./utils/notificationHandler');
                    const fcmToken = await registerForPushNotificationsAsync();
                    if (fcmToken) {
                        await registerTokenWithBackend(fcmToken, json.token);
                    }
                } catch (notifyErr) {
                    console.warn('Push registration failed (skip if dev environment)', notifyErr);
                }
            } catch { }

            // Rôle correct (ou passager) → on continue
            const targetPath = await handlePostLoginRouting();
            router.replace(targetPath as any);

        } catch (e: any) {
            const msg = e?.message || 'Erreur réseau lors de la vérification';
            setError(msg);
            Alert.alert('Erreur', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.container}
                >
                    <View style={styles.content}>

                        {/* TOP */}
                        <View style={styles.topBlock}>
                            <Text style={styles.title}>Code de vérification</Text>
                            <Text style={styles.subtitle}>
                                Entrez le code envoyé au +229 {phoneParam}
                            </Text>
                        </View>

                        {/* FORM */}
                        <View style={styles.bottomBlock}>
                            <View style={styles.codeBlock}>
                                <Text style={styles.label}>Code OTP</Text>

                                <TextInput
                                    style={styles.codeInput}
                                    placeholder="● ● ● ● ● ●"
                                    keyboardType="number-pad"
                                    value={code}
                                    onChangeText={setCode}
                                    maxLength={6}
                                    autoFocus={true}
                                />

                                {error && (
                                    <Text style={{ color: 'red', marginBottom: 8, textAlign: 'center' }}>{error}</Text>
                                )}

                                <TouchableOpacity
                                    style={styles.primaryButton}
                                    activeOpacity={0.85}
                                    onPress={verifyOtp}
                                    disabled={loading}
                                >
                                    <Text style={styles.primaryText}>
                                        {loading ? 'Vérification...' : 'Valider'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.resendButton}
                                    activeOpacity={0.7}
                                    onPress={() => sendOtp(true)}
                                    disabled={loading}
                                >
                                    <Text style={styles.resendText}>Je n'ai pas reçu le code</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
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
        justifyContent: 'flex-start',
    },
    topBlock: {
        marginTop: 40,
        marginBottom: 40,
    },
    title: {
        fontFamily: Fonts.titilliumWebBold,
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
        // paddingVertical: 100, // Removed
        justifyContent: 'flex-start',
    },
    label: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 15,
        color: Colors.black,
        marginBottom: 10,
    },
    codeBlock: {
        marginTop: 24,
    },
    codeInput: {
        backgroundColor: '#fff',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.lightGray,
        textAlign: 'center',
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 24, // Plus grand pour les chiffres
        letterSpacing: 8,
        marginBottom: 24,
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
        marginBottom: 12,
    },
    primaryText: {
        fontFamily: Fonts.titilliumWebBold,
        fontSize: 16,
        color: 'white',
    },
    resendButton: {
        marginTop: 10,
        alignItems: 'center',
        padding: 10,
    },
    resendText: {
        fontFamily: Fonts.titilliumWeb,
        fontSize: 14,
        color: Colors.gray,
        textDecorationLine: 'underline',
    },
});
