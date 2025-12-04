import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { Fonts } from '../font';

export default function DriverMenuScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ route?: string }>();

  const close = () => router.back();

  const MenuItem = ({ icon, label, route }: { icon: keyof typeof Ionicons.glyphMap; label: string; route: string }) => (
    <TouchableOpacity
      style={styles.menuItem}
      activeOpacity={0.8}
      onPress={() => {
        router.push(route as any);
      }}
    >
      <View style={styles.menuIconWrapper}>
        <Ionicons name={icon} size={22} color={Colors.primary} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={Colors.gray} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.overlay}>
      <TouchableWithoutFeedback onPress={close}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <SafeAreaView style={styles.panel}>
        <View style={styles.panelHeader}>
          {/* <Text style={styles.panelTitle}>Menu chauffeur</Text> */}
          <TouchableOpacity onPress={close} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.black} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <MenuItem icon="time-outline" label="Course en attente" route="/incoming" />
          <MenuItem icon="wallet-outline" label="Portefeuille" route="/wallet" />
          <MenuItem icon="stats-chart" label="Statistiques" route="/stats" />
          <MenuItem icon="person-outline" label="Profil" route="/profile" />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  panel: {
    width: '70%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: -2, height: 0 },
    shadowRadius: 6,
    elevation: 6,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  panelTitle: {
    fontFamily: Fonts.unboundedBold,
    fontSize: 20,
    color: Colors.black,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  menuIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontFamily: Fonts.titilliumWebBold,
    fontSize: 16,
    color: Colors.black,
  },
});
