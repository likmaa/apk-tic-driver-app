import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../theme';
import { Fonts } from '../font';
import { API_URL } from './config';
import { apiCall, handleApiError } from './utils/errorHandler';
import { validatePhoneNumber, validateOTP } from './utils/validation';

export default function DriverPhoneLoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [useExistingAccount, setUseExistingAccount] = useState<boolean | null>(null);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [otpKey, setOtpKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  // Vérifier si on a un token au chargement - si oui, rediriger
  // Sinon, afficher directement le champ téléphone
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (token && API_URL) {
          // Si on a un token, vérifier s'il est valide et rediriger
          // Timeout de 5 secondes pour éviter les blocages
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const res = await fetch(`${API_URL}/driver/profile`, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);

          if (res.ok) {
            const json = await res.json().catch(() => null);
            if (json?.profile?.status === 'approved' && json?.profile?.contract_accepted_at) {
              // Driver approuvé avec contrat → Dashboard
              router.replace('/(tabs)' as any);
              return;
            }
          } else {
            // Token invalide, nettoyer
            await AsyncStorage.removeItem('authToken');
            await AsyncStorage.removeItem('authUser');
          }
        }

        // Si pas de token, afficher directement le champ téléphone
        if (!token) {
          setUseExistingAccount(false);
        }

        // Charger les données depuis AsyncStorage si on vient de driver-existing-account
        const pendingPhone = await AsyncStorage.getItem('pendingPhone');
        const pendingOtpKey = await AsyncStorage.getItem('pendingOtpKey');
        
        if (pendingPhone) {
          // Extraire le numéro sans le préfixe +229
          const phoneNumber = pendingPhone.replace('+229', '');
          setPhone(phoneNumber);
          
          if (pendingOtpKey) {
            setOtpKey(pendingOtpKey);
            setOtpSent(true);
            setUseExistingAccount(true);
            // Nettoyer les données temporaires
            await AsyncStorage.removeItem('pendingPhone');
            await AsyncStorage.removeItem('pendingOtpKey');
          }
        } else if (params.phone) {
          // Si le numéro est passé en paramètre
          setPhone(params.phone as string);
          if (params.useExistingAccount === 'true') {
            setUseExistingAccount(true);
          } else {
            setUseExistingAccount(false);
          }
        }
      } catch (error: any) {
        // Gérer les erreurs de timeout et autres erreurs réseau
        if (error.name === 'AbortError') {
          console.warn('[driver-phone-login] Timeout lors de la vérification du profil');
        } else {
          console.error('Erreur lors de la vérification:', error);
        }
      }
    };

    checkAuth();
  }, [params, router]);

  const handlePostLoginRouting = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token || !API_URL) {
        // Pas de token : l'utilisateur n'est pas authentifié, ne pas rediriger
        // Il reste sur la page de connexion
        return;
      }

      // Timeout de 5 secondes pour éviter les blocages
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${API_URL}/driver/profile`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      // Si 401 ou 403, le token est invalide
      if (res.status === 401 || res.status === 403) {
        await AsyncStorage.removeItem('authToken');
        await AsyncStorage.removeItem('authUser');
        // L'utilisateur reste sur la page de connexion
        return;
      }

      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        // Erreur serveur ou réponse invalide
        // Si 404, le profil n'existe pas encore, on peut continuer vers le contrat
        if (res.status === 404) {
          router.replace('/driver-contract' as any);
          return;
        }
        // Pour les autres erreurs, rester sur la page de connexion
        return;
      }

      const status = json?.profile?.status as string | undefined;
      const role = json?.user?.role as string | undefined;
      const contractAcceptedAt = json?.profile?.contract_accepted_at as string | undefined;

      // Si le statut est 'pending', rediriger vers l'écran d'attente
      if (status === 'pending') {
        router.replace('/driver-pending-approval' as any);
        return;
      }

      // Si le statut est 'rejected', rediriger vers l'écran de rejet
      if (status === 'rejected') {
        router.replace('/driver-application-rejected' as any);
        return;
      }

      // Si le statut est 'approved' et le rôle est 'driver', vérifier le contrat
      if (status === 'approved' && role === 'driver') {
        if (contractAcceptedAt) {
          // Driver approuvé avec contrat accepté → Dashboard directement
          router.replace('/(tabs)' as any);
        } else {
          // Approuvé mais contrat non accepté → Accepter le contrat
          router.replace('/driver-contract' as any);
        }
        return;
      }

      // Si le rôle est 'driver' mais pas de profil ou statut inconnu
      // Cela peut arriver si le profil n'a pas encore été créé
      if (role === 'driver') {
        router.replace('/driver-contract' as any);
        return;
      }

      // Pas de profil driver ou statut inconnu : rediriger vers le contrat pour créer le profil
      router.replace('/driver-contract' as any);
    } catch (error) {
      // En cas d'erreur réseau, rester sur la page de connexion
      // L'utilisateur pourra réessayer
      console.error('Erreur lors de la vérification du profil:', error);
    }
  };

  const handleUseExisting = async () => {
    router.replace('/driver-existing-account' as any);
  };

  const sendOtp = async () => {
    const cleaned = phone.replace(/\s/g, '');
    
    // Validation côté client
    const phoneValidation = validatePhoneNumber(cleaned);
    if (!phoneValidation.isValid) {
      setError(phoneValidation.error || 'Numéro de téléphone invalide');
      Alert.alert('Erreur de validation', phoneValidation.error || 'Numéro de téléphone invalide');
      return;
    }

    if (!API_URL) {
      setError('API_URL non configurée');
      Alert.alert('Erreur de configuration', "L'URL de l'API n'est pas configurée.");
      return;
    }

    const e164 = `+229${cleaned}`;

    try {
      setLoading(true);
      setError(null);
      
      // Vérifier que l'API_URL est configurée
      if (!API_URL) {
        setError("Configuration API manquante. Veuillez configurer EXPO_PUBLIC_API_URL.");
        Alert.alert('Erreur de configuration', "L'URL de l'API n'est pas configurée.");
        setLoading(false);
        return;
      }
      
      // Avertir si on utilise localhost (ne fonctionnera pas sur téléphone physique)
      if (API_URL.includes('localhost') || API_URL.includes('127.0.0.1')) {
        console.warn('[DriverPhoneLogin] API_URL pointe vers localhost. Cela ne fonctionnera pas sur un téléphone physique.');
      }

      console.log('[DriverPhoneLogin] Envoi de la demande OTP pour:', e164);
      // Timeout de 20 secondes pour l'envoi d'OTP (augmenté pour les connexions lentes)
      const controllerOtp = new AbortController();
      const timeoutOtp = setTimeout(() => controllerOtp.abort(), 20000);
      
      let res: Response;
      try {
        res = await fetch(`${API_URL}/auth/request-otp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ phone: e164 }),
          signal: controllerOtp.signal,
        });
        clearTimeout(timeoutOtp);
      } catch (error: any) {
        clearTimeout(timeoutOtp);
        if (error.name === 'AbortError') {
          let msg = "La connexion a pris trop de temps.";
          if (API_URL && (API_URL.includes('localhost') || API_URL.includes('127.0.0.1'))) {
            msg += `\n\nL'application essaie de se connecter à : ${API_URL}\n\n'localhost' ne fonctionne pas sur un téléphone physique. Vous devez configurer l'adresse IP de votre ordinateur (ex: 192.168.x.x) dans le fichier .env`;
          } else {
            msg += `\n\nTentative de connexion à : ${API_URL}\nVérifiez que votre téléphone et votre ordinateur sont sur le même WiFi.`;
          }
          setError(msg);
          setOtpSent(false);
          setLoading(false);
          return;
        }
        throw error; // Re-lancer les autres erreurs
      }

      console.log('[DriverPhoneLogin] Réponse OTP - Status:', res.status, 'OK:', res.ok);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('[DriverPhoneLogin] Erreur HTTP lors de l\'envoi OTP:', res.status, errorText);
        await handleApiError(null, res, "Impossible d'envoyer le code OTP.");
        setError("Impossible d'envoyer le code OTP.");
        setOtpSent(false); // S'assurer que otpSent est false en cas d'erreur
        return;
      }

      const json = await res.json().catch((error) => {
        console.error('[DriverPhoneLogin] Erreur lors du parsing JSON de la réponse OTP:', error);
        return null;
      });
      
      console.log('[DriverPhoneLogin] Réponse JSON OTP:', json);
      
      if (!json) {
        const msg = "Impossible d'envoyer le code OTP.";
        setError(msg);
        Alert.alert('Erreur', msg);
        setOtpSent(false); // S'assurer que otpSent est false en cas d'erreur
        return;
      }

      // Cas où le numéro est déjà vérifié : connexion directe
      if (json.status === 'already_verified' && json.token) {
        try {
          await AsyncStorage.setItem('authToken', json.token);
          if (json.user) {
            await AsyncStorage.setItem('authUser', JSON.stringify(json.user));
          }

          // Vérifier d'abord le statut du profil driver
          const token = json.token as string;
          // Timeout de 5 secondes pour éviter les blocages
          const controller1 = new AbortController();
          const timeoutId1 = setTimeout(() => controller1.abort(), 5000);
          
          let resProfile: Response;
          try {
            resProfile = await fetch(`${API_URL}/driver/profile`, {
              method: 'GET',
              headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${token}`,
              },
              signal: controller1.signal,
            });
            clearTimeout(timeoutId1);
          } catch (error: any) {
            clearTimeout(timeoutId1);
            if (error.name === 'AbortError') {
              // En cas de timeout, continuer le flux normal
              await handlePostLoginRouting();
              return;
            }
            throw error;
          }

          if (resProfile.ok) {
            const jsonProfile = await resProfile.json().catch(() => null);
            if (jsonProfile && jsonProfile.profile) {
              const status = jsonProfile.profile?.status as string | undefined;
              
              // Si le statut est 'pending', rediriger vers l'écran pending
              if (status === 'pending') {
                router.replace('/driver-pending-approval' as any);
                return;
              }

              // Si le statut est 'rejected', rediriger vers l'écran rejected
              if (status === 'rejected') {
                router.replace('/driver-application-rejected' as any);
                return;
              }

              // Si le statut est 'approved', continuer le flux normal
              if (status === 'approved') {
                await handlePostLoginRouting();
                return;
              }
            }
          } else if (resProfile.status === 404) {
            // Pas de profil driver : c'est un compte passager sans demande de devenir chauffeur
            await AsyncStorage.removeItem('authToken');
            await AsyncStorage.removeItem('authUser');
            Alert.alert(
              'Compte passager',
              "Ce compte est un compte passager. Pour devenir chauffeur, utilisez l'option \"Devenir chauffeur\" dans l'application passager."
            );
            return;
          }

        } catch {}

        // Si on arrive ici, continuer le flux normal
        await handlePostLoginRouting();
        return;
      }

      if (json.status !== 'otp_sent') {
        const msg = (json && (json.message || json.error)) || "Impossible d’envoyer le code OTP.";
        setError(msg);
        Alert.alert('Erreur', msg);
        return;
      }

      // On mémorise la clé OTP renvoyée par le backend pour la vérification
      // La clé peut être dans json.otp_key ou json.provider.key
      if (json.otp_key) {
        setOtpKey(json.otp_key as string);
      } else if (json.provider?.key) {
        setOtpKey(json.provider.key as string);
      } else {
        setOtpKey(null);
        console.warn('[DriverPhoneLogin] Aucune clé OTP trouvée dans la réponse');
      }

      // Si on vient de driver-existing-account, garder useExistingAccount à true
      if (useExistingAccount === null) {
        setUseExistingAccount(false);
      }
      
      setOtpSent(true); // Marquer que l'OTP a été envoyé
      console.log('[DriverPhoneLogin] OTP envoyé avec succès, otpSent = true, otpKey =', otpKey || 'null');
      Alert.alert('Code envoyé', 'Un code OTP vous a été envoyé.');
    } catch (e: any) {
      // Gérer les erreurs de timeout et autres erreurs réseau
      let msg: string;
      if (e?.name === 'AbortError') {
        msg = "La connexion a pris trop de temps.";
        if (API_URL && (API_URL.includes('localhost') || API_URL.includes('127.0.0.1'))) {
          msg += `\n\nCible : ${API_URL}\n'localhost' ne fonctionne pas sur mobile. Utilisez l'IP de votre ordi.`;
        } else {
          msg += `\n\nCible : ${API_URL}\nVérifiez votre connexion internet.`;
        }
      } else if (e?.message?.includes('Network request failed') || e?.message?.includes('Failed to fetch')) {
        msg = `Impossible de se connecter au serveur (${API_URL}).`;
        if (API_URL && (API_URL.includes('localhost') || API_URL.includes('127.0.0.1'))) {
            msg += "\n\nERREUR : Vous utilisez 'localhost' sur un téléphone physique. Remplacez par l'IP de votre ordinateur.";
        } else {
            msg += "\n\nVérifiez que le serveur backend est lancé (php artisan serve --host=0.0.0.0) et que votre téléphone est sur le même WiFi.";
        }
      } else {
        msg = e?.message || 'Erreur réseau lors de la demande de code.';
      }
      setError(msg);
      // Ne pas afficher l'Alert pour les timeouts, le message est déjà affiché en rouge
      // Afficher l'Alert seulement pour les autres erreurs critiques
      if (e?.name !== 'AbortError' && !e?.message?.includes('Network request failed')) {
        Alert.alert('Erreur', msg);
      }
      setOtpSent(false); // S'assurer que otpSent est false en cas d'erreur
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    const cleaned = phone.replace(/\s/g, '');
    
    // Validation du numéro de téléphone
    const phoneValidation = validatePhoneNumber(cleaned);
    if (!phoneValidation.isValid) {
      setError(phoneValidation.error || 'Numéro de téléphone invalide');
      Alert.alert('Erreur de validation', phoneValidation.error || 'Numéro de téléphone invalide');
      return;
    }

    // Validation du code OTP
    const otpValidation = validateOTP(code);
    if (!otpValidation.isValid) {
      setError(otpValidation.error || 'Code OTP invalide');
      Alert.alert('Erreur de validation', otpValidation.error || 'Code OTP invalide');
      return;
    }

    if (!API_URL) {
      Alert.alert('Erreur', 'API_URL non configurée');
      return;
    }
    if (!otpKey) {
      Alert.alert('Erreur', 'Clé OTP manquante. Veuillez redemander un code.');
      return;
    }

    const e164 = `+229${cleaned}`;
    try {
      setLoading(true);
      setError(null);

      console.log('[DriverPhoneLogin] Vérification OTP avec clé:', otpKey);

      // Timeout de 20 secondes pour la vérification d'OTP (augmenté pour les connexions lentes)
      const controllerVerify = new AbortController();
      const timeoutVerify = setTimeout(() => controllerVerify.abort(), 20000);
      
      let res: Response;
      try {
        res = await fetch(`${API_URL}/auth/verify-otp`, {
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
          signal: controllerVerify.signal,
        });
        clearTimeout(timeoutVerify);
      } catch (error: any) {
        clearTimeout(timeoutVerify);
        if (error.name === 'AbortError') {
          let msg = "La vérification a pris trop de temps.";
          if (API_URL && (API_URL.includes('localhost') || API_URL.includes('127.0.0.1'))) {
            msg += " Vérifiez que le serveur backend est démarré.";
          } else {
            msg += " Vérifiez votre connexion internet et réessayez.";
          }
          setError(msg);
          setLoading(false);
          return;
        }
        throw error; // Re-lancer les autres erreurs
      }

      if (!res.ok) {
        await handleApiError(null, res, 'Vérification OTP échouée');
        setError('Vérification OTP échouée');
        return;
      }

      const json = await res.json().catch(() => null);
      if (!json) {
        const msg = 'Vérification OTP échouée';
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

        // Vérifier d'abord le statut du profil driver
        const token = json.token as string;
        // Timeout de 5 secondes pour éviter les blocages
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), 5000);
        
        let resProfile: Response;
        try {
          resProfile = await fetch(`${API_URL}/driver/profile`, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
            signal: controller2.signal,
          });
          clearTimeout(timeoutId2);
        } catch (error: any) {
          clearTimeout(timeoutId2);
          if (error.name === 'AbortError') {
            // En cas de timeout, continuer le flux normal sans bloquer
            console.warn('[DriverPhoneLogin] Timeout lors de la vérification du profil, continuation du flux');
            await handlePostLoginRouting();
            return;
          }
          throw error;
        }

        // Vérifier le statut du profil driver
        if (resProfile.ok) {
          const jsonProfile = await resProfile.json().catch(() => null);
          if (jsonProfile && jsonProfile.profile) {
            const status = jsonProfile.profile?.status as string | undefined;
            const role = jsonProfile.user?.role as string | undefined;
            const contractAcceptedAt = jsonProfile.profile?.contract_accepted_at as string | undefined;
            
            // Si le statut est 'pending', rediriger vers l'écran pending
            if (status === 'pending') {
              router.replace('/driver-pending-approval' as any);
              return;
            }

            // Si le statut est 'rejected', rediriger vers l'écran rejected
            if (status === 'rejected') {
              router.replace('/driver-application-rejected' as any);
              return;
            }

            // Si le statut est 'approved' et le rôle est 'driver', vérifier le contrat
            if (status === 'approved' && role === 'driver') {
              if (contractAcceptedAt) {
                // Driver approuvé avec contrat accepté → Dashboard directement
                router.replace('/(tabs)' as any);
              } else {
                // Approuvé mais contrat non accepté → Accepter le contrat
                router.replace('/driver-contract' as any);
              }
              return;
            }
          }
        } else if (resProfile.status === 404) {
          // Pas de profil driver : le backend a peut-être créé un profil avec status='pending'
          // si role='driver' était passé. Attendre un peu et vérifier à nouveau
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Timeout de 5 secondes pour éviter les blocages
          const controller3 = new AbortController();
          const timeoutId3 = setTimeout(() => controller3.abort(), 5000);
          
          let resProfileRetry: Response;
          try {
            resProfileRetry = await fetch(`${API_URL}/driver/profile`, {
              method: 'GET',
              headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${token}`,
              },
              signal: controller3.signal,
            });
            clearTimeout(timeoutId3);
          } catch (error: any) {
            clearTimeout(timeoutId3);
            if (error.name === 'AbortError') {
              // En cas de timeout, continuer le flux normal
              await handlePostLoginRouting();
              return;
            }
            throw error;
          }
          
          if (resProfileRetry.ok) {
            const jsonProfileRetry = await resProfileRetry.json().catch(() => null);
            if (jsonProfileRetry?.profile) {
              const statusRetry = jsonProfileRetry.profile?.status as string | undefined;
              const roleRetry = jsonProfileRetry.user?.role as string | undefined;
              const contractAcceptedAtRetry = jsonProfileRetry.profile?.contract_accepted_at as string | undefined;
              
              if (statusRetry === 'pending') {
                router.replace('/driver-pending-approval' as any);
                return;
              }
              if (statusRetry === 'rejected') {
                router.replace('/driver-application-rejected' as any);
                return;
              }
              if (statusRetry === 'approved' && roleRetry === 'driver') {
                if (contractAcceptedAtRetry) {
                  // Driver approuvé avec contrat accepté → Dashboard directement
                  router.replace('/(tabs)' as any);
                } else {
                  // Approuvé mais contrat non accepté → Accepter le contrat
                  router.replace('/driver-contract' as any);
                }
                return;
              }
            }
          }
          
          // Si toujours pas de profil, c'est un compte passager sans demande de devenir chauffeur
          await AsyncStorage.removeItem('authToken');
          await AsyncStorage.removeItem('authUser');
          Alert.alert(
            'Compte passager',
            "Ce compte est un compte passager. Pour devenir chauffeur, utilisez l'option \"Devenir chauffeur\" dans l'application passager."
          );
          return;
        }

        // Si on arrive ici, continuer le flux normal
        await handlePostLoginRouting();

      } catch {
        // Erreur silencieuse
      }
    } catch (e: any) {
      // Gérer les erreurs de timeout et autres erreurs réseau
      let msg: string;
      if (e?.name === 'AbortError') {
        msg = "La vérification a pris trop de temps.";
        if (API_URL && (API_URL.includes('localhost') || API_URL.includes('127.0.0.1'))) {
          msg += `\n\nCible : ${API_URL}\n'localhost' ne fonctionne pas sur mobile. Utilisez l'IP de votre ordi.`;
        } else {
          msg += `\n\nCible : ${API_URL}\nVérifiez votre connexion internet.`;
        }
      } else if (e?.message?.includes('Network request failed') || e?.message?.includes('Failed to fetch')) {
        msg = `Impossible de se connecter au serveur (${API_URL}).`;
        if (API_URL && (API_URL.includes('localhost') || API_URL.includes('127.0.0.1'))) {
            msg += "\n\nERREUR : Vous utilisez 'localhost' sur un téléphone physique. Remplacez par l'IP de votre ordinateur.";
        } else {
            msg += "\n\nVérifiez que le serveur backend est lancé et accessible.";
        }
      } else {
        msg = e?.message || 'Erreur réseau lors de la vérification';
      }
      setError(msg);
      // Ne pas afficher l'Alert pour les timeouts, le message est déjà affiché en rouge
      // Afficher l'Alert seulement pour les autres erreurs critiques
      if (e?.name !== 'AbortError' && !e?.message?.includes('Network request failed')) {
        Alert.alert('Erreur', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* TOP */}
        <View style={styles.topBlock}>
          <Text style={styles.title}>Connexion chauffeur</Text>

          <Text style={styles.subtitle}>
            Identifiez-vous avec votre numéro de téléphone.  
            Si vous êtes déjà passager TIC MITON, vous pouvez utiliser le même compte.
          </Text>
        </View>

        {/* CONTENU PRINCIPAL */}
        <View style={styles.bottomBlock}>
          {/* Afficher les options seulement si on n'a pas encore commencé le processus ET qu'on ne vient pas de driver-existing-account */}
          {useExistingAccount === null && !otpSent && (
            <>
              <TouchableOpacity
                style={styles.primaryButton}
                activeOpacity={0.85}
                onPress={handleUseExisting}
              >
                <Text style={styles.primaryText}>Utiliser mon compte existant</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                activeOpacity={0.85}
                onPress={() => {
                  setUseExistingAccount(false);
                }}
              >
                <Text style={styles.secondaryText}>Utiliser un autre numéro</Text>
              </TouchableOpacity>
            </>
          )}

          {/* PHONE ENTRY - Afficher si useExistingAccount === false OU si on a déjà envoyé l'OTP OU si on vient de driver-existing-account */}
          {(useExistingAccount === false || otpSent || useExistingAccount === true) && (
            <View style={styles.phoneBlock}>
              {/* Afficher le champ téléphone seulement si on n'a pas encore envoyé l'OTP */}
              {!otpSent && (
                <>
                  <Text style={styles.label}>Numéro de téléphone</Text>

                  <View style={styles.phoneRow}>
                    <View style={styles.countryBadge}>
                      <Text style={styles.flag}>🇧🇯</Text>
                      <Text style={styles.countryCode}>+229</Text>
                    </View>

                    <TextInput
                      style={styles.phoneInput}
                      placeholder="00 00 00 00"
                      keyboardType="phone-pad"
                      value={phone}
                      onChangeText={setPhone}
                    />
                  </View>

                  {error && (
                    <Text style={{ color: 'red', marginBottom: 8 }}>{error}</Text>
                  )}

                  {phone.trim().length > 0 && (
                    <TouchableOpacity
                      style={styles.primaryButton}
                      activeOpacity={0.85}
                      onPress={sendOtp}
                      disabled={loading}
                    >
                      <Text style={styles.primaryText}>{loading ? 'Envoi...' : 'Envoyer le code'}</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {/* Afficher le champ code OTP si l'OTP a été envoyé */}
              {otpSent && (
                <View style={styles.codeBlock}>
                  <Text style={styles.label}>Code de vérification</Text>
                  <Text style={styles.subtitleCode}>
                    Entrez le code à 6 chiffres que vous avez reçu par SMS
                  </Text>

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
                    <Text style={{ color: 'red', marginBottom: 8 }}>{error}</Text>
                  )}

                  <TouchableOpacity
                    style={styles.primaryButton}
                    activeOpacity={0.85}
                    onPress={verifyOtp}
                    disabled={loading || code.trim().length !== 6}
                  >
                    <Text style={styles.primaryText}>
                      {loading ? 'Vérification...' : 'Valider le code'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.resendButton}
                    activeOpacity={0.7}
                    onPress={async () => {
                      setOtpSent(false);
                      setCode('');
                      setOtpKey(null);
                      // Forcer l'envoi d'un nouveau code en passant force_new=true
                      const cleaned = phone.replace(/\s/g, '');
                      if (!cleaned || !API_URL) return;
                      const e164 = `+229${cleaned}`;
                      try {
                        setLoading(true);
                        // Timeout de 20 secondes pour l'envoi d'OTP (augmenté pour les connexions lentes)
                        const controllerOtp2 = new AbortController();
                        const timeoutOtp2 = setTimeout(() => controllerOtp2.abort(), 20000);
                        
                        let res: Response;
                        try {
                          res = await fetch(`${API_URL}/auth/request-otp`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              Accept: 'application/json',
                            },
                            body: JSON.stringify({ phone: e164, force_new: true }),
                            signal: controllerOtp2.signal,
                          });
                          clearTimeout(timeoutOtp2);
                        } catch (error: any) {
                          clearTimeout(timeoutOtp2);
                          setLoading(false);
                          if (error.name === 'AbortError') {
                            let msg = "La connexion a pris trop de temps.";
                            if (API_URL && (API_URL.includes('localhost') || API_URL.includes('127.0.0.1'))) {
                              msg += " Vérifiez que le serveur backend est démarré.";
                            } else {
                              msg += " Vérifiez votre connexion internet et réessayez.";
                            }
                            setError(msg);
                            return;
                          }
                          throw error;
                        }
                        const json = await res.json().catch(() => null);
                        if (res.ok && json?.status === 'otp_sent' && json?.otp_key) {
                          setOtpKey(json.otp_key);
                          setOtpSent(true);
                          Alert.alert('Code renvoyé', 'Un nouveau code OTP vous a été envoyé.');
                        } else {
                          // Si erreur, utiliser la méthode normale
                          sendOtp();
                        }
                      } catch {
                        sendOtp();
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                  >
                    <Text style={styles.resendText}>Renvoyer le code</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

      </View>
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
    justifyContent: 'space-between',
  },

  // TOP
  topBlock: {
    marginTop: 50,
  },

  title: {
    fontFamily: Fonts.unboundedBold,
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

  // BOTTOM
  bottomBlock: {
    paddingVertical: 100,
  },

  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',

    // Ombre premium
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

  secondaryButton: {
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 14,
    marginTop: 4,
    backgroundColor: Colors.secondary
  },

  secondaryText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 15,
    color: Colors.white,
  },

  // PHONE INPUT BLOCK
  phoneBlock: {
    marginTop: 15,
  },

  label: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 15,
    color: Colors.black,
    marginBottom: 10,
  },

  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },

  countryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.lightGray,
    marginRight: 10,
  },

  flag: {
    fontSize: 18,
    marginRight: 6,
  },

  countryCode: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 15,
    color: Colors.black,
  },

  phoneInput: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.lightGray,
    fontFamily: Fonts.titilliumWeb,
    fontSize: 15,
  },

  // CODE
  codeBlock: {
    marginTop: 24,
  },

  subtitleCode: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 16,
    textAlign: 'center',
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
    fontSize: 18,
    letterSpacing: 8,
    marginBottom: 16,
  },

  resendButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },

  resendText: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 14,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
});
