import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Colors } from '../theme';
import { Fonts } from '../font';
import { API_URL } from './config';

export default function BecomeDriverScreen() {
  const router = useRouter();

  const [vehicleNumber, setVehicleNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehiclePhoto, setVehiclePhoto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    if (!vehicleNumber.trim() || !licenseNumber.trim()) {
      setError('Veuillez renseigner le numéro de plaque et le numéro de permis.');
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (!API_URL) {
      setError('API_URL non configurée');
      return;
    }
    if (!validate()) return;

    try {
      setLoading(true);
      setError(null);

      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        setError('Vous devez être connecté pour faire la demande.');
        return;
      }

      const res = await fetch(`${API_URL}/driver/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          vehicle_number: vehicleNumber.trim(),
          license_number: licenseNumber.trim(),
          photo: vehiclePhoto || null,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json) {
        const msg = json?.message || "Impossible d'envoyer la demande pour le moment.";
        setError(msg);
        Alert.alert('Erreur', msg);
        return;
      }

      Alert.alert(
        'Demande envoyée',
        "Votre demande de profil chauffeur est en cours de validation.",
        [
          {
            text: 'OK',
            onPress: () => {
              router.back();
            },
          },
        ],
      );
    } catch (e: any) {
      const msg = e?.message || 'Erreur réseau lors de la demande.';
      setError(msg);
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
    >
      <Text style={{ fontFamily: Fonts.titilliumWebBold, fontSize: 24, color: Colors.black, marginBottom: 4 }}>
        Devenir chauffeur TIC MITON
      </Text>
      <Text style={{ fontFamily: Fonts.titilliumWeb, fontSize: 14, color: Colors.gray, marginBottom: 16 }}>
        Complétez ces informations. Votre profil sera vérifié avant d’être activé.
      </Text>

      <Text style={{ fontFamily: Fonts.titilliumWebBold, fontSize: 16, color: Colors.black, marginBottom: 8 }}>
        Informations véhicule
      </Text>

      <Text style={{ fontFamily: Fonts.titilliumWeb, fontSize: 13, color: Colors.gray, marginBottom: 4 }}>
        Numéro de plaque (immatriculation)
      </Text>
      <TextInput
        value={vehicleNumber}
        onChangeText={setVehicleNumber}
        placeholder="AA-1234-BB"
        autoCapitalize="characters"
        style={{
          borderWidth: 1,
          borderColor: Colors.lightGray,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          marginBottom: 12,
          backgroundColor: 'white',
          fontFamily: Fonts.titilliumWeb,
        }}
      />

      <Text style={{ fontFamily: Fonts.titilliumWeb, fontSize: 13, color: Colors.gray, marginBottom: 4 }}>
        Numéro de permis
      </Text>
      <TextInput
        value={licenseNumber}
        onChangeText={setLicenseNumber}
        placeholder="PERMIS-XXXX"
        autoCapitalize="characters"
        style={{
          borderWidth: 1,
          borderColor: Colors.lightGray,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          marginBottom: 12,
          backgroundColor: 'white',
          fontFamily: Fonts.titilliumWeb,
        }}
      />

      <Text style={{ fontFamily: Fonts.titilliumWeb, fontSize: 13, color: Colors.gray, marginBottom: 4 }}>
        Photo du véhicule (URL provisoire)
      </Text>
      <TextInput
        value={vehiclePhoto}
        onChangeText={setVehiclePhoto}
        placeholder="https://…"
        autoCapitalize="none"
        style={{
          borderWidth: 1,
          borderColor: Colors.lightGray,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          marginBottom: 16,
          backgroundColor: 'white',
          fontFamily: Fonts.titilliumWeb,
        }}
      />

      {error && (
        <Text style={{ color: '#B91C1C', fontSize: 13, marginBottom: 12, fontFamily: Fonts.titilliumWeb }}>
          {error}
        </Text>
      )}

      <TouchableOpacity
        onPress={submit}
        disabled={loading}
        style={{
          backgroundColor: loading ? Colors.mediumGray : Colors.primary,
          borderRadius: 999,
          paddingVertical: 14,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
        }}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={{ color: 'white', fontFamily: Fonts.titilliumWebBold, fontSize: 15 }}>
            Envoyer ma demande
          </Text>
        )}
      </TouchableOpacity>

      <Text style={{ fontSize: 12, color: Colors.gray, marginTop: 12, fontFamily: Fonts.titilliumWeb }}>
        Après validation, vous verrez votre statut mis à jour et pourrez recevoir des courses.
      </Text>
    </ScrollView>
  );
}
