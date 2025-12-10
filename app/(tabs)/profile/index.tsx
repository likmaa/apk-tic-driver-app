// screens/driver/ProfileScreen.tsx
import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, TouchableOpacity, ScrollView, Image, Switch, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../../theme'; // Assurez-vous que ces imports sont corrects
import { Fonts } from '../../../font';
import { useDriverStore } from '../../providers/DriverProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';

// Données mock pour l'exemple (fallback si l'API ne répond pas)
const fallbackDriverData = {
  name: 'Chauffeur Porto',
  rating: 0,
  avatarLocal: require('../../../assets/images/LOGO_OR.png') as any,
  avatarUrl: '' as string | null,
  vehicle: 'Véhicule non renseigné',
  licensePlate: '---',
  documents: [
    { name: 'Permis de conduire', status: 'valid' as const, expiry: 'À compléter' },
    { name: 'Assurance véhicule', status: 'pending' as const, expiry: 'En attente' },
    { name: 'Carte grise', status: 'expired' as const, expiry: 'À mettre à jour' },
  ],
};

// Helper pour le style des statuts (icône typée pour MaterialCommunityIcons)
type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const getStatusStyle = (
  status: 'valid' | 'pending' | 'expired'
): { icon: MCIconName; color: string } => {
  switch (status) {
    case 'valid':
      return { icon: 'check-circle', color: '#4CAF50' };
    case 'pending':
      return { icon: 'clock-time-eight', color: '#FFC107' };
    case 'expired':
      return { icon: 'alert-circle', color: '#F44336' };
    default:
      return { icon: 'help-circle', color: Colors.gray };
  }
};

export default function DriverProfileScreen() {
  const router = useRouter();
  const { online, setOnline, navPref, setNavPref } = useDriverStore();

  const [driverName, setDriverName] = useState(fallbackDriverData.name);
  const [rating, setRating] = useState(fallbackDriverData.rating);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(fallbackDriverData.avatarUrl);
  const [documents, setDocuments] = useState(fallbackDriverData.documents);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const initials = React.useMemo(() => {
    const parts = (driverName || '').trim().split(/\s+/);
    if (!parts.length) return '';
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
    return (first + last).toUpperCase();
  }, [driverName]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!API_URL) return;
        setLoading(true);
        setError(null);

        const token = await AsyncStorage.getItem('authToken');
        if (!token) {
          setError("Connexion requise pour charger votre profil.");
          return;
        }

        const res = await fetch(`${API_URL}/driver/profile`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const msg = body?.message || "Impossible de charger votre profil.";
          setError(msg);
          return;
        }

        const json = await res.json();
        if (cancelled) return;

        const user = json.user ?? {};
        const profile = json.profile ?? null;

        setDriverName(user.name ?? fallbackDriverData.name);
        // Pour l'instant, on garde une note fixe tant qu'on n'a pas branché les avis chauffeur
        setRating(fallbackDriverData.rating);

        const userPhoto: string | null = user.photo ?? null;
        const profilePhoto: string | null = profile?.photo ?? null;
        setAvatarUrl(profilePhoto || userPhoto || null);

        if (Array.isArray(profile?.documents)) {
          const mappedDocs = profile.documents.map((d: any) => ({
            name: String(d.name ?? 'Document'),
            status: (d.status ?? 'pending') as 'valid' | 'pending' | 'expired',
            expiry: String(d.expiry ?? ''),
          }));
          setDocuments(mappedDocs.length ? mappedDocs : fallbackDriverData.documents);
        }
      } catch {
        if (!cancelled) {
          setError("Erreur réseau lors du chargement de votre profil.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpenPersonalInfo = () => router.push('/driver-existing-details' as any);
  const handleOpenVehicle = () => router.push('/driver-existing-account' as any);
  const handleOpenHelp = () => router.push('/help');

  const navPrefLabel = (() => {
    switch (navPref) {
      case 'waze':
        return 'Waze';
      case 'gmaps':
        return 'Google Maps';
      default:
        return 'Automatique';
    }
  })();

  const handleChooseNavPref = () => {
    Alert.alert(
      'Navigation',
      'Choisis l’application par défaut',
      [
        { text: 'Automatique', onPress: () => setNavPref('auto') },
        { text: 'Waze', onPress: () => setNavPref('waze') },
        { text: 'Google Maps', onPress: () => setNavPref('gmaps') },
        { text: 'Annuler', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const performLogout = async () => {
    try {
      setLogoutLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      if (token && API_URL) {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => { });
      }
      await AsyncStorage.removeItem('authToken');
      setOnline(false);
      router.replace('/driver-phone-login');
    } finally {
      setLogoutLoading(false);
    }
  };

  const handleLogout = () => {
    if (logoutLoading) return;
    Alert.alert(
      'Se déconnecter',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se déconnecter', style: 'destructive', onPress: performLogout },
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mon Profil</Text>
        <View style={styles.statusRow}>
          <View style={styles.statusTextBlock}>
            <Text style={styles.statusLabel}>Statut</Text>
            <Text style={[styles.statusValue, online ? styles.statusOnline : styles.statusOffline]}>
              {online ? 'En ligne' : 'Hors ligne'}
            </Text>
          </View>
          <Switch
            value={online}
            onValueChange={setOnline}
            trackColor={{ false: Colors.lightGray, true: Colors.primary + '55' }}
            thumbColor={online ? Colors.primary : '#f4f3f4'}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Carte d'Identité du Chauffeur */}
        <View style={styles.profileCard}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          <Text style={styles.driverName}>{driverName}</Text>
          <View style={styles.ratingContainer}>
            <MaterialCommunityIcons name="star" size={16} color="#FFC107" />
            <Text style={styles.ratingText}>{rating.toFixed(2)}</Text>
          </View>
        </View>

        {error && (
          <Text style={{ fontFamily: Fonts.titilliumWeb, fontSize: 13, color: 'red', marginBottom: 8 }}>
            {error}
          </Text>
        )}

        {/* Section Compte */}
        <Text style={styles.sectionTitle}>Compte</Text>
        <View style={styles.menuCard}>
          <TouchableOpacity style={styles.menuRow} onPress={handleOpenPersonalInfo}>
            <MaterialCommunityIcons name="account-edit-outline" size={24} color={Colors.primary} style={styles.menuIcon} />
            <Text style={styles.menuText}>Informations personnelles</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.gray} />
          </TouchableOpacity>
          <View style={styles.separator} />
          <TouchableOpacity style={styles.menuRow} onPress={handleOpenVehicle}>
            <MaterialCommunityIcons name="car-outline" size={24} color={Colors.primary} style={styles.menuIcon} />
            <Text style={styles.menuText}>Mon véhicule</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.gray} />
          </TouchableOpacity>
        </View>

        {/* Section Documents */}
        <Text style={styles.sectionTitle}>Documents</Text>
        <View style={styles.menuCard}>
          {documents.map((doc, index) => {
            const { icon, color } = getStatusStyle(doc.status as any);
            return (
              <React.Fragment key={doc.name}>
                <TouchableOpacity style={styles.menuRow}>
                  <MaterialCommunityIcons name={icon} size={24} color={color} style={styles.menuIcon} />
                  <View style={styles.docDetails}>
                    <Text style={styles.menuText}>{doc.name}</Text>
                    <Text style={[styles.docStatus, { color }]}>{doc.expiry}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.gray} />
                </TouchableOpacity>
                {index < documents.length - 1 && <View style={styles.separator} />}
              </React.Fragment>
            );
          })}
        </View>

        {/* Section Préférences */}
        <Text style={styles.sectionTitle}>Préférences</Text>
        <View style={styles.menuCard}>
          <TouchableOpacity style={styles.menuRow} onPress={handleChooseNavPref}>
            <MaterialCommunityIcons name="navigation-variant-outline" size={24} color={Colors.primary} style={styles.menuIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.menuText}>Application de navigation</Text>
              <Text style={styles.menuSubText}>{navPrefLabel}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.gray} />
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View style={{ marginTop: 24 }}>
          <TouchableOpacity
            style={[styles.menuRow, styles.actionButton]}
            onPress={() => router.push('/become-driver')}
          >
            <MaterialCommunityIcons name="steering" size={24} color={Colors.primary} style={styles.menuIcon} />
            <Text style={styles.menuText}>Compléter mon profil chauffeur</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.gray} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuRow, styles.actionButton]} onPress={handleOpenHelp}>
            <MaterialCommunityIcons name="help-circle-outline" size={24} color={Colors.primary} style={styles.menuIcon} />
            <Text style={styles.menuText}>Aide et Support</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.gray} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuRow, styles.actionButton, { marginTop: 12, opacity: logoutLoading ? 0.6 : 1 }]}
            onPress={handleLogout}
            disabled={logoutLoading}
          >
            <MaterialCommunityIcons name="logout" size={24} color="#F44336" style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: '#F44336' }]}>
              {logoutLoading ? 'Déconnexion…' : 'Se déconnecter'}
            </Text>
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
  },
  header: {
    padding: 20,
    paddingBottom: 10,
    backgroundColor: 'white',
  },
  headerTitle: {
    fontFamily: Fonts.unboundedBold,
    fontSize: 24,
    color: Colors.black,
  },
  statusRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusTextBlock: {
    flexDirection: 'column',
  },
  statusLabel: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 13,
    color: Colors.gray,
  },
  statusValue: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 15,
  },
  statusOnline: {
    color: '#16a34a',
  },
  statusOffline: {
    color: '#b91c1c',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  profileCard: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: Colors.primary,
    marginBottom: 12,
  },
  driverName: {
    fontFamily: Fonts.unboundedBold,
    fontSize: 22,
    color: Colors.black,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 14,
    color: '#FFA000',
    marginLeft: 6,
  },
  sectionTitle: {
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: Colors.gray,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  menuCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 24,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  menuIcon: {
    marginRight: 16,
  },
  menuText: {
    flex: 1,
    fontFamily: Fonts.titilliumWebSemiBold,
    fontSize: 16,
    color: Colors.black,
  },
  menuSubText: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 13,
    color: Colors.gray,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.lightGray,
    marginLeft: 56, // Aligné avec le début du texte
  },
  docDetails: {
    flex: 1,
  },
  docStatus: {
    fontFamily: Fonts.titilliumWeb,
    fontSize: 13,
    marginTop: 2,
  },
  actionButton: {
    backgroundColor: 'white',
    borderRadius: 16,
  },
  avatarFallback: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: Fonts.unboundedBold,
    fontSize: 32,
    color: 'white',
  },
});
