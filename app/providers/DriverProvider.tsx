import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { API_URL } from '../config';
import { getPusherClient, unsubscribeChannel, getPusherConnectionState } from '../services/pusherClient';

const LOCATION_TASK_NAME = 'background-location-task';

// Définition de la tâche en dehors du composant (obligatoire pour TaskManager)
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error('[BackgroundLocation] Task error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      const location = locations[0];
      const { latitude, longitude } = location.coords;

      try {
        const token = await AsyncStorage.getItem('authToken');
        const savedRide = await AsyncStorage.getItem('current_ride_id');

        if (!token) return;

        const body: any = { lat: latitude, lng: longitude };
        if (savedRide) {
          body.ride_id = Number(savedRide);
        }

        // Utilisation de fetch direct pour éviter les dépendances de contexte
        await fetch(`${API_URL}/driver/location`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        console.log('[BackgroundLocation] Update sent:', latitude, longitude);
      } catch (err) {
        console.warn('[BackgroundLocation] Failed to send update:', err);
      }
    }
  }
});

export type RideStatus = 'incoming' | 'pickup' | 'arrived' | 'ongoing' | 'completed' | 'cancelled';
export type Ride = {
  id: string;
  pickup: string;
  dropoff: string;
  fare: number;
  driverEarnings?: number; // Earnings after commission
  status: RideStatus;
  startedAt?: number;
  completedAt?: number;
  pickupLat?: number;
  pickupLon?: number;
  dropoffLat?: number;
  dropoffLon?: number;
  riderId?: string;
  riderName?: string;
  riderPhone?: string;
  duration_s?: number;
  vehicle_type?: 'standard' | 'vip';
  has_baggage?: boolean;
  service_type?: 'course' | 'livraison' | 'deplacement';
  recipient_name?: string;
  recipient_phone?: string;
  package_description?: string;
  package_weight?: string;
  is_fragile?: boolean;
  total_stop_duration_s?: number;
  stop_started_at?: string;
  arrived_at?: string;
};

export type NavPref = 'auto' | 'waze' | 'gmaps';

export type DriverState = {
  online: boolean;
  currentRide: Ride | null;
  availableOffers: Ride[];
  history: Ride[];
  navPref: NavPref;
  lastLat: number | null;
  lastLng: number | null;
  setOnline: (v: boolean) => void;
  updateLocation: (lat: number, lng: number) => void;
  receiveRequest: (ride: Omit<Ride, 'status' | 'startedAt' | 'completedAt'>) => void;
  acceptRequest: (rideId?: string) => Promise<void>;
  declineRequest: (rideId?: string) => Promise<void>;
  signalArrival: () => Promise<void>;
  setPickupDone: () => Promise<void>;
  completeRide: () => Promise<Ride | null>;
  startStop: () => Promise<void>;
  endStop: () => Promise<void>;
  loadHistoryFromBackend: () => Promise<void>;
  setNavPref: (p: NavPref) => void;
  checkForIncomingOffer: () => Promise<void>;
  driverProfile: any | null;
  refreshProfile: () => Promise<void>;
  syncCurrentRide: () => Promise<void>;
  clearOffer: (rideId: string) => void;
};

const Ctx = createContext<DriverState | null>(null);

import { useRouter } from 'expo-router';

// ... imports

export function DriverProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [online, setOnline] = useState(false);
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
  const [availableOffers, setAvailableOffers] = useState<Ride[]>([]);
  const [history, setHistoryState] = useState<Ride[]>([]);

  // Centralized history updater with deduplication
  const setHistory = useCallback((updater: Ride[] | ((prev: Ride[]) => Ride[])) => {
    setHistoryState((prev) => {
      const newList = typeof updater === 'function' ? updater(prev) : updater;
      if (!Array.isArray(newList)) return prev;

      return newList.reduce((acc: Ride[], current: Ride) => {
        if (!current || !current.id) return acc;
        const currentId = String(current.id);
        const alreadyExists = acc.find(item => String(item.id) === currentId);
        if (!alreadyExists) {
          return [...acc, current];
        }
        // Update existing item if the new one has a terminal status
        const isTerminal = (s: string) => s === 'completed' || s === 'cancelled';
        return acc.map(item =>
          String(item.id) === currentId ? (isTerminal(current.status) ? current : item) : item
        );
      }, []);
    });
  }, []);
  const [navPref, setNavPref] = useState<NavPref>('auto');
  const [driverProfile, setDriverProfile] = useState<any | null>(null);
  const [lastLat, setLastLat] = useState<number | null>(null);
  const [lastLng, setLastLng] = useState<number | null>(null);

  // Helper pour gérer les 401
  const handleUnauthorized = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove(['authToken', 'authUser']);
      setOnline(false);
      router.replace('/driver-onboarding');
    } catch { }
  }, [router]);

  const mapBackendRideStatus = useCallback((status?: string | null): RideStatus => {
    if (!status) return 'incoming';
    const s = status.trim().toLowerCase();

    // Exact English match (preferred)
    if (s === 'requested') return 'incoming';
    if (s === 'accepted') return 'pickup';
    if (s === 'arrived') return 'arrived';
    if (s === 'pickup') return 'pickup';
    if (s === 'ongoing') return 'ongoing';
    if (s === 'completed' || s === 'payed' || s === 'paid') return 'completed';
    if (s === 'cancelled') return 'cancelled';

    // French legacy fallback
    if (s === 'demandée') return 'incoming';
    if (s === 'acceptée') return 'pickup';
    if (s === 'arrivé' || s === 'arrivée') return 'arrived';
    if (s === 'en cours') return 'ongoing';
    if (s === 'terminée' || s === 'payé' || s === 'payée') return 'completed';
    if (s === 'annulée') return 'cancelled';

    return 'incoming';
  }, []);

  const mapApiRideToState = useCallback((payload: any): Ride | null => {
    if (!payload || !payload.id) return null;

    return {
      id: String(payload.id),
      pickup: payload.pickup_address ?? payload.pickup_label ?? 'Point de départ',
      dropoff: payload.dropoff_address ?? payload.dropoff_label ?? 'Destination',
      fare: Number(payload.fare_amount ?? payload.fare ?? 0),
      driverEarnings: payload.driver_earnings_amount != null ? Number(payload.driver_earnings_amount) : undefined,
      status: mapBackendRideStatus(payload.status),
      startedAt: payload.started_at ? new Date(payload.started_at).getTime() : undefined,
      completedAt: payload.completed_at ? new Date(payload.completed_at).getTime() : undefined,
      pickupLat: payload.pickup_lat != null ? Number(payload.pickup_lat) : undefined,
      pickupLon: payload.pickup_lng != null ? Number(payload.pickup_lng) : undefined,
      dropoffLat: payload.dropoff_lat != null ? Number(payload.dropoff_lat) : undefined,
      dropoffLon: payload.dropoff_lng != null ? Number(payload.dropoff_lng) : undefined,
      riderId: payload.rider_id ? String(payload.rider_id) : (payload.rider?.id ? String(payload.rider.id) : undefined),
      riderName: (payload.passenger_name || payload.passenger?.name || payload.rider?.name) ?? undefined,
      riderPhone: (payload.passenger_phone || payload.passenger?.phone || payload.rider?.phone) ?? undefined,
      vehicle_type: payload.vehicle_type,
      has_baggage: !!payload.has_baggage,
      service_type: payload.service_type,
      recipient_name: payload.recipient_name,
      recipient_phone: payload.recipient_phone,
      package_description: payload.package_description,
      package_weight: payload.package_weight,
      is_fragile: !!payload.is_fragile,
      total_stop_duration_s: payload.total_stop_duration_s != null ? Number(payload.total_stop_duration_s) : undefined,
      stop_started_at: payload.stop_started_at ?? undefined,
    };
  }, [mapBackendRideStatus]);

  const startStop = useCallback(async () => {
    try {
      if (!API_URL || !currentRide) return;

      // Optimistic Update
      const stopTime = new Date().toISOString();
      setCurrentRide(prev => prev ? { ...prev, stop_started_at: stopTime } : null);

      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const res = await fetch(`${API_URL}/driver/trips/${currentRide.id}/start-stop`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        if (res.status === 422 && errorJson.message === 'Stop already started') {
          // If already started, we should sync our state instead of rolling back
          // We don't have the timestamp here, but we can keep it as is or refresh
          console.warn('Stop already started on server, keeping local state');
        } else {
          // Rollback on other errors
          setCurrentRide(prev => prev ? { ...prev, stop_started_at: undefined } : null);
          console.error('Failed to start stop on server:', errorJson.message);
        }
      } else {
        const json = await res.json();
        // Sync with server's exact timestamp
        setCurrentRide(prev => prev ? { ...prev, stop_started_at: json.stop_started_at } : null);
      }
    } catch (e) {
      console.error('Error starting stop:', e);
      setCurrentRide(prev => prev ? { ...prev, stop_started_at: undefined } : null);
    }
  }, [currentRide]);

  const endStop = useCallback(async () => {
    const rideSnapshot = currentRide;
    try {
      if (!API_URL || !rideSnapshot || !rideSnapshot.stop_started_at) return;

      // Optimistic Update
      const duration = Math.floor((Date.now() - new Date(rideSnapshot.stop_started_at).getTime()) / 1000);
      setCurrentRide(prev => prev ? {
        ...prev,
        stop_started_at: undefined,
        total_stop_duration_s: (prev.total_stop_duration_s || 0) + duration
      } : null);

      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const res = await fetch(`${API_URL}/driver/trips/${rideSnapshot.id}/end-stop`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        if (res.status === 422 && errorJson.message === 'Invalid state') {
          // Likely already ended or status mismatch, we should refresh to sync
          console.warn('Stop ending failed (Invalid state), syncing with server');
        } else {
          // Rollback
          setCurrentRide(rideSnapshot);
          console.error('Failed to end stop on server:', errorJson.message);
        }
      } else {
        const json = await res.json();
        // Sync with exact server total
        setCurrentRide(prev => prev ? {
          ...prev,
          stop_started_at: undefined,
          total_stop_duration_s: json.total_stop_duration_s
        } : null);
      }
    } catch (e) {
      console.error('Error ending stop:', e);
      setCurrentRide(rideSnapshot);
    }
  }, [currentRide]);

  const refreshProfile = useCallback(async () => {
    try {
      if (!API_URL) return;
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const res = await fetch(`${API_URL}/driver/profile`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      const json = await res.json().catch(() => null);
      if (res.ok && json?.profile) {
        setDriverProfile(json.profile);
      }
    } catch (e) {
      console.error('Error refreshing profile:', e);
    }
  }, [handleUnauthorized]);

  const syncCurrentRide = useCallback(async () => {
    try {
      if (!API_URL) return;
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const res = await fetch(`${API_URL}/driver/current-ride`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      console.log(`[DriverStore] syncCurrentRide: ${res.status}`);
      if (res.status === 204) {
        setCurrentRide(prev => {
          if (prev && (prev.status === 'incoming' || prev.status === 'pickup' || prev.status === 'ongoing')) {
            console.log(`[DriverStore] Preserving active ride: ${prev.id} (${prev.status})`);
            return prev;
          }
          return null;
        });
        return;
      }

      if (!res.ok) {
        console.warn(`[DriverStore] syncCurrentRide failed: ${res.status}`);
        return;
      }

      const json = await res.json().catch(() => null);
      const ride = mapApiRideToState(json);
      if (!ride) {
        setCurrentRide(prev => {
          if (prev && (prev.status === 'incoming' || prev.status === 'pickup' || prev.status === 'ongoing')) {
            console.log(`[DriverStore] No ride from API, preserving active: ${prev.id} (${prev.status})`);
            return prev;
          }
          return null;
        });
        return;
      }

      console.log(`[DriverStore] syncCurrentRide success: ${ride.id} (${ride.status})`);
      setCurrentRide(ride);
    } catch (e) {
      console.error('[DriverStore] syncCurrentRide error:', e);
    }
  }, [mapApiRideToState, handleUnauthorized]);

  const checkForIncomingOffer = useCallback(async () => {
    try {
      if (!API_URL) return;
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const res = await fetch(`${API_URL}/driver/next-offer`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      if (!Array.isArray(json)) return;

      const rides = json.map(r => mapApiRideToState(r)).filter((r): r is Ride => !!r);

      setAvailableOffers(prev => {
        // Merge without duplicates
        const existingIds = new Set(prev.map(p => p.id));
        const newRides = rides.filter(r => !existingIds.has(r.id));
        return [...prev, ...newRides];
      });
    } catch {
    }
  }, [API_URL, mapApiRideToState, handleUnauthorized]);

  // Load persisted state on mount
  useEffect(() => {
    (async () => {
      try {
        // ONE-TIME RESET (v2): Clear corrupted history data
        const resetDone = await AsyncStorage.getItem('driver_history_reset_v2');
        if (!resetDone) {
          console.log('[DriverStore] One-time history reset triggered');
          await AsyncStorage.removeItem('driver_history');
          await AsyncStorage.setItem('driver_history_reset_v2', '1');
        }

        const savedOnline = await AsyncStorage.getItem('driver_online');
        const savedHistory = await AsyncStorage.getItem('driver_history');
        const savedNavPref = await AsyncStorage.getItem('driver_nav_pref');
        if (savedOnline != null) setOnline(savedOnline === '1');
        if (savedHistory) {
          const parsed = JSON.parse(savedHistory);
          if (Array.isArray(parsed)) {
            // Sanitize history: only keep completed rides and remove duplicates
            const sanitized = parsed
              .filter((r: any) => r.status === 'completed' && r.id)
              .reduce((acc: any[], current: any) => {
                const currentId = String(current.id);
                const x = acc.find(item => String(item.id) === currentId);
                if (!x) return acc.concat([current]);
                else return acc;
              }, []);
            setHistory(sanitized);
          }
        }
        if (savedNavPref === 'waze' || savedNavPref === 'gmaps' || savedNavPref === 'auto') setNavPref(savedNavPref);
      } catch { }
    })();
    refreshProfile().catch(() => { });
  }, [refreshProfile]);

  // Persist online and history
  useEffect(() => {
    (async () => {
      try { await AsyncStorage.setItem('driver_online', online ? '1' : '0'); } catch { }
    })();
  }, [online]);
  useEffect(() => {
    (async () => {
      try { await AsyncStorage.setItem('driver_history', JSON.stringify(history)); } catch { }
    })();
  }, [history]);
  useEffect(() => {
    (async () => {
      try { await AsyncStorage.setItem('driver_nav_pref', navPref); } catch { }
    })();
  }, [navPref]);

  const updateLocation = useCallback((lat: number, lng: number) => {
    (async () => {
      try {
        if (!API_URL) return;
        const token = await AsyncStorage.getItem('authToken');
        if (!token) return;

        const body: Record<string, number> = { lat, lng };
        if (currentRide?.id) {
          body.ride_id = Number(currentRide.id);
          // Persister l'ID de la course pour le TaskManager en arrière-plan
          await AsyncStorage.setItem('current_ride_id', String(currentRide.id));
        } else {
          await AsyncStorage.removeItem('current_ride_id');
        }

        await fetch(`${API_URL}/driver/location`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        // Update local state for UI distance calculations
        setLastLat(lat);
        setLastLng(lng);
      } catch {
        // On ignore l'erreur réseau pour le moment
      }
    })();
  }, [currentRide?.id]);

  const toggleOnline = useCallback((nextOnline: boolean) => {
    (async () => {
      try {
        setOnline(nextOnline);
        if (!nextOnline) {
          // Si on se déconnecte, on efface les offres entrantes qui ne sont pas acceptées
          setAvailableOffers([]);
          setCurrentRide(prev => {
            if (prev && prev.status === 'incoming') return null;
            return prev;
          });
        }

        const token = await AsyncStorage.getItem('authToken');
        if (!token) return;

        // Perform location and status updates in parallel to reduce perceived latency
        const updatePromises: Promise<any>[] = [];

        if (nextOnline) {
          // 1. Fast Location Sync: Use last known position if available
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const lastPos = await Location.getLastKnownPositionAsync();
            if (lastPos) {
              updatePromises.push(
                fetch(`${API_URL}/driver/location`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    lat: lastPos.coords.latitude,
                    lng: lastPos.coords.longitude,
                    is_fast_fallback: true
                  }),
                }).catch(() => { })
              );
            }

            // Trigger an accurate sync in the background without blocking the status update
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
              .then((pos) => {
                fetch(`${API_URL}/driver/location`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                }).catch(() => { });
              })
              .catch(() => { });
          }
        }

        // 2. Status Update
        const statusPromise = fetch(`${API_URL}/driver/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ online: nextOnline }),
        });

        updatePromises.push(statusPromise);

        // Wait for essential updates (at least status)
        const [_, statusRes] = await Promise.all([
          updatePromises[0], // Either location fallback or just the status if no location
          statusPromise
        ]);

        if (!statusRes.ok) {
          if (statusRes.status === 401) {
            handleUnauthorized();
            return;
          }
          setOnline(!nextOnline);
          Alert.alert('Erreur', 'Impossible de mettre à jour le statut. (Erreur serveur)');
          return;
        }

        if (nextOnline) {
          // 4. Trigger an immediate poll as soon as we are online
          checkForIncomingOffer().catch(() => { });
        }
      } catch (e) {
        setOnline(!nextOnline);
        Alert.alert('Erreur', 'Impossible de se connecter au serveur. Vérifiez votre connexion.');
      }
    })();
  }, [handleUnauthorized, checkForIncomingOffer, API_URL]);

  const clearOffer = useCallback((rideId: string) => {
    setAvailableOffers(prev => prev.filter(r => r.id !== rideId));
  }, []);

  const acceptRequest = useCallback(async (rideId?: string) => {
    // If no rideId provided, use the first available offer if currentRide is null
    const targetId = rideId || (currentRide?.id);
    const rideSnapshot = availableOffers.find(r => r.id === targetId) || currentRide;

    if (!rideSnapshot || rideSnapshot.id !== targetId) {
      throw new Error('Aucune course à accepter');
    }

    const optimisticRide: Ride = {
      ...rideSnapshot,
      status: 'pickup',
      startedAt: rideSnapshot.startedAt ?? Date.now(),
    };

    const applyOptimistic = () => {
      setCurrentRide(optimisticRide);
      setAvailableOffers(prev => prev.filter(r => r.id !== targetId));
    };
    const rollback = () => {
      setCurrentRide(null);
      setAvailableOffers(prev => [rideSnapshot, ...prev]);
    };

    if (!API_URL) {
      applyOptimistic();
      return;
    }

    applyOptimistic();

    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentification requise');
      }

      const res = await fetch(`${API_URL}/driver/trips/${targetId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Le serveur a refusé la confirmation');
      }
    } catch (error) {
      rollback();
      throw error;
    }
  }, [availableOffers, currentRide, API_URL]);

  const declineRequest = useCallback(async (rideId?: string) => {
    const targetId = rideId || currentRide?.id;
    const rideSnapshot = availableOffers.find(r => r.id === targetId) || currentRide;

    if (!targetId || !rideSnapshot) return;

    // Optimistic: Remove from list
    setAvailableOffers(prev => prev.filter(r => r.id !== targetId));
    if (currentRide?.id === targetId) {
      setCurrentRide(null);
    }

    try {
      if (!API_URL) return;
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      await fetch(`${API_URL}/driver/trips/${targetId}/decline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // ignore failure for now
    }
  }, [availableOffers, currentRide, API_URL]);

  const signalArrival = useCallback(async () => {
    const rideSnapshot = currentRide;
    if (!rideSnapshot) return;

    const nowStr = new Date().toISOString();
    // Optimistic Update
    setCurrentRide((r) => r ? { ...r, status: 'arrived', arrived_at: nowStr } : r);

    try {
      if (!API_URL) return;
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        setCurrentRide(rideSnapshot);
        return;
      }

      const res = await fetch(`${API_URL}/driver/trips/${rideSnapshot.id}/arrived`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('[DriverStore] signalArrival failed:', err);
        setCurrentRide(rideSnapshot); // Rollback
        Alert.alert('Erreur', err.message || 'Impossible de signaler votre arrivée sur le serveur.');
      }
    } catch (error) {
      console.error('[DriverStore] signalArrival error:', error);
      setCurrentRide(rideSnapshot); // Rollback
      Alert.alert('Erreur réseau', 'Impossible de signaler votre arrivée.');
    }
  }, [currentRide, API_URL]);

  const setPickupDone = useCallback(async () => {
    const rideSnapshot = currentRide;
    if (!rideSnapshot) return;

    // Optimistic Update
    setCurrentRide((r) => r ? { ...r, status: 'ongoing' } : r);

    try {
      if (!API_URL) return;
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        setCurrentRide(rideSnapshot);
        return;
      }

      const res = await fetch(`${API_URL}/driver/trips/${rideSnapshot.id}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('[DriverStore] start trip failed:', err);
        setCurrentRide(rideSnapshot); // Rollback
        Alert.alert('Erreur', err.message || 'Impossible de démarrer la course sur le serveur.');
      }
    } catch (error) {
      console.error('[DriverStore] start trip error:', error);
      setCurrentRide(rideSnapshot); // Rollback
      Alert.alert('Erreur réseau', 'Impossible de contacter le serveur pour démarrer la course.');
    }
  }, [currentRide, API_URL]);

  const completeRide = useCallback(async () => {
    const ride = currentRide;
    if (!ride) return null;

    try {
      if (!API_URL) return null;
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return null;
      const rideId = ride.id;
      if (!rideId) return null;

      const res = await fetch(`${API_URL}/driver/trips/${rideId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const json = await res.json();
        let finalRide: Ride = {
          ...ride,
          status: 'completed',
          completedAt: Date.now(),
        };

        // Update finalRide with backend values
        if (json.ride) {
          finalRide = { ...finalRide, ...json.ride };
        }
        if (json.payment_link) {
          // @ts-ignore - Adding dynamic property for now, ideally update Ride type
          finalRide.paymentLink = json.payment_link;
        }
        // If 'earned' or other fields:
        if (json.earned !== undefined) {
          // @ts-ignore
          finalRide.earned = json.earned;
        }

        setCurrentRide(null);
        setHistory((h) => [...h, finalRide]);
        return finalRide;
      } else {
        const err = await res.json().catch(() => ({}));
        console.error('[DriverStore] complete trip failed:', err);
        Alert.alert('Erreur', err.message || 'Impossible de terminer la course sur le serveur.');
        return null;
      }
    } catch (error) {
      console.error('[DriverStore] complete trip error:', error);
      Alert.alert('Erreur réseau', 'Impossible de terminer la course. Vérifiez votre connexion.');
      return null;
    }
  }, [currentRide, API_URL]);

  const loadHistoryFromBackend = useCallback(async () => {
    try {
      if (!API_URL) return;
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const res = await fetch(`${API_URL}/driver/rides?status=completed&per_page=50`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      if (!json || !Array.isArray(json.data)) return;

      const mapped: Ride[] = json.data.reduce((acc: Ride[], item: any) => {
        const ride = mapApiRideToState(item);
        if (ride) {
          acc.push({ ...ride, status: ride.status ?? 'completed' });
        }
        return acc;
      }, []);

      // Merge with local history instead of replacing to preserve local-only rides
      setHistory((prev) => [...prev, ...mapped]);
    } catch {
      // On conserve l'historique local si l'appel échoue
    }
  }, [mapApiRideToState]);

  useEffect(() => {
    if (!online) return;

    let channel: any = null;
    let cancelled = false;

    (async () => {
      try {
        const client = await getPusherClient();
        channel = client.subscribe('presence-drivers');
        channel.bind('ride.requested', () => {
          if (!cancelled) {
            checkForIncomingOffer().catch(() => { });
          }
        });
        channel.bind('ride.cancelled', (data: { rideId: string | number }) => {
          if (!cancelled) {
            const rideIdStr = String(data.rideId);
            setAvailableOffers(prev => prev.filter(r => String(r.id) !== rideIdStr));
            setCurrentRide(prev => (prev && String(prev.id) === rideIdStr ? null : prev));
          }
        });
      } catch (error) {
        console.warn('Realtime driver subscription failed', error);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribeChannel(channel);
    };
  }, [online, checkForIncomingOffer]);

  // Suivi de la position du chauffeur lorsqu'il est en ligne
  useEffect(() => {
    if (!online) {
      Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).then(started => {
        if (started) Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      });
      return;
    }

    let foregroundSubscription: Location.LocationSubscription | null = null;
    let isMounted = true;

    const startWatching = async () => {
      try {
        // Demande des permissions de premier plan
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') {
          console.warn('Location foreground permission denied');
          return;
        }

        if (!isMounted) return;

        // Suivi au premier plan (haute précision, intervalle court)
        foregroundSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000,
            distanceInterval: 10,
          },
          (location) => {
            if (isMounted) {
              const { latitude, longitude } = location.coords;
              updateLocation(latitude, longitude);
            }
          }
        );

        // Demande des permissions d'arrière-plan (optionnel mais recommandé pour background-location)
        if (Platform.OS === 'android' || Platform.OS === 'ios') {
          const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
          if (bgStatus === 'granted') {
            await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 10000, // Toutes les 10 secondes en arrière-plan
              distanceInterval: 20,
              foregroundService: {
                notificationTitle: "TIC Driver est actif",
                notificationBody: "Suivi de votre position pour les courses TIC",
                notificationColor: "#FF7B00",
              },
              pausesUpdatesAutomatically: false,
            });
            console.log('[Location] Background tracking started');
          } else {
            console.warn('Background location permission denied');
          }
        }
      } catch (error) {
        console.warn('Error starting location watch:', error);
      }
    };

    startWatching();

    return () => {
      isMounted = false;
      if (foregroundSubscription) {
        foregroundSubscription.remove();
      }
      // On ne stoppe pas forcément ici si on veut que ça continue en arrière-plan,
      // mais si Online passe à false, le début du useEffect s'en charge.
    };
  }, [online, updateLocation]);

  // Polling périodique des offres si en ligne et pas de course
  useEffect(() => {
    if (!online || currentRide) return;

    const interval = setInterval(() => {
      const state = getPusherConnectionState();
      const isConnected = state === 'connected';

      // If connected via Pusher, we only need a slow fallback poll (e.g., 60s)
      // Otherwise, we poll faster (10s) to ensure ride reception
      const now = Date.now();
      const lastPoll = (window as any)._lastDriverPoll || 0;
      const elapsed = now - lastPoll;
      const threshold = isConnected ? 60000 : 10000;

      if (elapsed >= threshold) {
        (window as any)._lastDriverPoll = now;
        checkForIncomingOffer().catch(() => { });
        console.log(`[DriverStore] Adaptive poll triggered (State: ${state}, Threshold: ${threshold}ms)`);
      }
    }, 5000); // Check state every 5s

    return () => clearInterval(interval);
  }, [online, currentRide, checkForIncomingOffer]);

  const value = useMemo<DriverState>(() => ({
    online,
    currentRide,
    availableOffers,
    history,
    navPref,
    lastLat,
    lastLng,
    syncCurrentRide,
    clearOffer,
    setOnline: toggleOnline,
    updateLocation,
    setNavPref,
    checkForIncomingOffer,
    receiveRequest: (rideText) => {
      // Used for manual debugging/override
      // @ts-ignore
      setAvailableOffers(prev => [rideText, ...prev]);
    },
    acceptRequest,
    declineRequest,
    signalArrival,
    setPickupDone,
    completeRide,
    startStop,
    endStop,
    loadHistoryFromBackend,
    driverProfile,
    refreshProfile,
  }), [
    online,
    currentRide,
    availableOffers,
    history,
    navPref,
    lastLat,
    lastLng,
    syncCurrentRide,
    clearOffer,
    toggleOnline,
    updateLocation,
    checkForIncomingOffer,
    acceptRequest,
    declineRequest,
    signalArrival,
    setPickupDone,
    completeRide,
    startStop,
    endStop,
    loadHistoryFromBackend,
    driverProfile,
    refreshProfile
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDriverStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDriverStore must be used within DriverProvider');
  return ctx;
}
