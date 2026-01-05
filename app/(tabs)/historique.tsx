import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useDriverStore } from '../providers/DriverProvider';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../../font';

export default function DriverActivityTab() {
  const { history, loadHistoryFromBackend } = useDriverStore();

  useEffect(() => {
    loadHistoryFromBackend();
  }, [loadHistoryFromBackend]);

  const renderItem = ({ item }: { item: any }) => {
    const date = new Date(item.completedAt || item.createdAt).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    const isSuccess = item.status === 'completed' || item.status === 'payé';

    return (
      <View style={styles.card}>
        {/* En-tête avec date et statut */}
        <View style={styles.header}>
          <Text style={styles.date}>{date}</Text>
          <View style={[styles.statusBadge, isSuccess ? styles.success : styles.cancelled]}>
            <Text style={styles.statusText}>
              {isSuccess ? 'Terminée' : item.status === 'cancelled' ? 'Annulée' : 'Expirée'}
            </Text>
          </View>
        </View>

        {/* Trajet */}
        <View style={styles.route}>
          <View style={styles.pointRow}>
            <View style={[styles.dot, styles.pickupDot]} />
            <Text style={styles.address} numberOfLines={1}>{item.pickup}</Text>
          </View>
          <View style={styles.line} />
          <View style={styles.pointRow}>
            <View style={[styles.dot, styles.dropoffDot]} />
            <Text style={styles.address} numberOfLines={1}>{item.dropoff}</Text>
          </View>
        </View>

        {/* Pied de carte */}
        <View style={styles.footer}>
          <Text style={styles.fare}>
            {item.fare.toLocaleString('fr-FR')} FCFA
          </Text>
          {item.paymentMethod && (
            <View style={styles.paymentRow}>
              <Ionicons
                name={item.paymentMethod === 'cash' ? 'cash-outline' : 'card-outline'}
                size={18}
                color="#64748b"
              />
              <Text style={styles.paymentText}>
                {item.paymentMethod === 'cash' ? 'Espèces' : 'Mobile Money'}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      <View style={styles.headerContainer}>
        <Text style={styles.title}>Historique des courses</Text>
        <Text style={styles.subtitle}>{history.length} course{history.length > 1 ? 's' : ''}</Text>
      </View>

      {history.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="car-sport-outline" size={64} color="#475569" />
          <Text style={styles.emptyTitle}>Aucune course terminée</Text>
          <Text style={styles.emptySubtitle}>
            Vos courses apparaîtront ici une fois terminées.
          </Text>
        </View>
      ) : (
        <FlatList
          data={history.slice().reverse()}
          keyExtractor={(item, index) => item.id ? `${item.id}-${index}` : index.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.titilliumWebBold,
    color: 'black',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: 'black',
    marginTop: 6,
  },

  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  date: {
    color: 'black',
    fontSize: 14,
    fontFamily: Fonts.titilliumWebBold,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  success: {
    backgroundColor: '#065f46',
  },
  cancelled: {
    backgroundColor: '#7f1d1d',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: Fonts.titilliumWebBold,
  },

  route: {
    marginLeft: 4,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 7,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 14,
  },
  pickupDot: { backgroundColor: '#34d399' },
  dropoffDot: { backgroundColor: '#f87171' },
  address: {
    color: 'black',
    fontSize: 16,
    flex: 1,
    fontFamily: Fonts.titilliumWeb,
  },
  line: {
    width: 2,
    height: 28,
    backgroundColor: '#475569',
    marginLeft: 6,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
  },
  fare: {
    fontSize: 22,
    fontFamily: Fonts.titilliumWebBold,
    color: 'black',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paymentText: {
    color: '#94a3b8',
    fontSize: 14,
    fontFamily: Fonts.titilliumWebBold,
  },

  // État vide
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: Fonts.titilliumWebBold,
    color: '#e2e8f0',
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
  },
});