import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { API_URL } from '../config';
import { getPusherClient, unsubscribeChannel } from '../services/pusherClient';

export type RideStatus = 'incoming' | 'pickup' | 'ongoing' | 'completed' | 'cancelled';
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
};

export type NavPref = 'auto' | 'waze' | 'gmaps';

export type DriverState = {
  online: boolean;
  currentRide: Ride | null;
  history: Ride[];
  navPref: NavPref;
  setOnline: (v: boolean) => void;
  updateLocation: (lat: number, lng: number) => void;
  receiveRequest: (ride: Omit<Ride, 'status' | 'startedAt' | 'completedAt'>) => void;
  acceptRequest: () => Promise<void>;
  declineRequest: () => Promise<void>;
  setPickupDone: () => Promise<void>;
  completeRide: () => Promise<void>;
  loadHistoryFromBackend: () => Promise<void>;
  setNavPref: (p: NavPref) => void;
  checkForIncomingOffer: () => Promise<void>;
  driverProfile: any | null;
  refreshProfile: () => Promise<void>;
  syncCurrentRide: () => Promise<void>;
};

const Ctx = createContext<DriverState | null>(null);

import { useRouter } from 'expo-router';

// ... imports

export function DriverProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [online, setOnline] = useState(false);
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
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

  // Helper pour gérer les 401
  const handleUnauthorized = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove(['authToken', 'authUser']);
      setOnline(false);
      router.replace('/driver-onboarding');
    } catch { }
  }, [router]);

  const mapBackendRideStatus = useCallback((status?: string | null): RideStatus => {
    const s = status?.trim().toLowerCase();
    switch (s) {
      case 'accepted':
      case 'acceptée':
        return 'pickup';
      case 'ongoing':
      case 'en cours':
        return 'ongoing';
      case 'completed':
      case 'terminée':
      case 'payé':
      case 'payée':
        return 'completed';
      case 'cancelled':
      case 'annulée':
        return 'cancelled';
      default:
        return 'incoming';
    }
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
      riderName: payload.passenger_name || payload.passenger?.name || payload.rider?.name || undefined,
      riderPhone: payload.passenger_phone || payload.passenger?.phone || payload.rider?.phone || undefined,
      vehicle_type: payload.vehicle_type,
      has_baggage: !!payload.has_baggage,
    };
  }, [mapBackendRideStatus]);

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

      if (!res.ok || res.status === 204) return;
      const json = await res.json().catch(() => null);
      const ride = mapApiRideToState(json);
      if (!ride) {
        return;
      }

      console.log(`[DriverStore] Incoming offer found: ${ride.id}`);

      setCurrentRide((prev) => {
        // Safeguard: Never overwrite an active ride (pickup/ongoing) with a new offer
        if (prev && (prev.status === 'pickup' || prev.status === 'ongoing')) {
          console.log(`[DriverStore] Ignoring offer ${ride.id}, already in ${prev.status}`);
          return prev;
        }

        if (prev && prev.id === ride.id && prev.status !== 'incoming') {
          console.log(`[DriverStore] Updating status of ${ride.id} to ${ride.status}`);
          return { ...prev, ...ride };
        }
        return ride;
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

  const acceptRequest = useCallback(async () => {
    const rideSnapshot = currentRide;
    if (!rideSnapshot) {
      throw new Error('Aucune course à accepter');
    }

    const optimisticRide: Ride = {
      ...rideSnapshot,
      status: 'pickup',
      startedAt: rideSnapshot.startedAt ?? Date.now(),
    };

    const applyOptimistic = () => setCurrentRide(optimisticRide);
    const rollback = () => setCurrentRide(rideSnapshot);

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

      await fetch(`${API_URL}/driver/trips/${rideSnapshot.id}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }).then((res) => {
        if (!res.ok) {
          throw new Error('Le serveur a refusé la confirmation');
        }
      });
    } catch (error) {
      rollback();
      throw error;
    }
  }, [currentRide]);

  const declineRequest = useCallback(async () => {
    const rideSnapshot = currentRide;

    setCurrentRide((r) => (r ? { ...r, status: 'cancelled' } : r));
    setHistory((h) => {
      const r = rideSnapshot;
      return r ? [...h, { ...r, status: 'cancelled', completedAt: Date.now() }] : h;
    });
    setCurrentRide(null);

    try {
      if (!API_URL) return;
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;
      if (!rideSnapshot?.id) return;

      await fetch(`${API_URL}/driver/trips/${rideSnapshot.id}/decline`, {
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
  }, [currentRide]);

  const setPickupDone = useCallback(async () => {
    setCurrentRide((r) => r ? { ...r, status: 'ongoing' } : r);

    try {
      if (!API_URL) return;
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;
      const rideId = currentRide?.id;
      if (!rideId) return;

      await fetch(`${API_URL}/driver/trips/${rideId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // On garde l'état local même en cas d'erreur réseau pour le moment
    }
  }, [currentRide?.id]);

  const completeRide = useCallback(async () => {
    // Utiliser l'état courant pour construire la course finale
    const ride = currentRide;
    if (!ride) return;

    const finalRide: Ride = {
      ...ride,
      status: 'completed',
      completedAt: Date.now(),
    };

    // Mettre à jour l'état local (historique + currentRide null)
    setCurrentRide(null);
    setHistory((h) => [...h, finalRide]);

    // Informer le backend
    try {
      if (!API_URL) return;
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;
      const rideId = finalRide.id;
      if (!rideId) return;

      await fetch(`${API_URL}/driver/trips/${rideId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // On ignore l'erreur réseau pour le moment, l'historique local reste
    }
  }, [currentRide]);

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
            setCurrentRide(prev => {
              if (prev && String(prev.id) === String(data.rideId)) {
                // Return null if the cancelled ride is the current active or offered ride
                return null;
              }
              return prev;
            });
            // If the driver was on the incoming screen or pickup screen, they might need to be redirected
            // Note: Use a global router or check current path if needed, but clearing state usually triggers UI changes
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
    if (!online) return;

    let subscription: Location.LocationSubscription | null = null;
    let isMounted = true;

    const startWatching = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('Location permission denied');
          return;
        }

        if (!isMounted) return;

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 10000, // Mise à jour toutes les 10 secondes
            distanceInterval: 10, // Ou tous les 10 mètres
          },
          (location) => {
            if (isMounted) {
              // Extraction correcte des coordonnées selon la version d'expo-location
              const { latitude, longitude } = location.coords;
              updateLocation(latitude, longitude);
            }
          }
        );
      } catch (error) {
        console.warn('Error starting location watch:', error);
      }
    };

    startWatching();

    return () => {
      isMounted = false;
      if (subscription) {
        subscription.remove();
      }
    };
  }, [online, updateLocation]);

  // Polling périodique des offres si en ligne et pas de course
  useEffect(() => {
    if (!online || currentRide) return;

    const interval = setInterval(() => {
      checkForIncomingOffer().catch(() => { });
    }, 10000); // Toutes les 10 secondes

    return () => clearInterval(interval);
  }, [online, currentRide, checkForIncomingOffer]);

  const value = useMemo<DriverState>(() => ({
    online,
    currentRide,
    history,
    navPref,
    syncCurrentRide,
    setOnline: toggleOnline,
    updateLocation,
    setNavPref,
    checkForIncomingOffer,
    receiveRequest: (ride) => {
      setCurrentRide({ ...ride, status: 'incoming' });
    },
    acceptRequest,
    declineRequest,
    setPickupDone,
    completeRide,
    loadHistoryFromBackend,
    driverProfile,
    refreshProfile,
  }), [
    online,
    currentRide,
    history,
    navPref,
    syncCurrentRide,
    toggleOnline,
    updateLocation,
    checkForIncomingOffer,
    acceptRequest,
    declineRequest,
    setPickupDone,
    completeRide,
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
