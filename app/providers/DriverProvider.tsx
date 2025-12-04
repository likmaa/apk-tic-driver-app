import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { getPusherClient, unsubscribeChannel } from '../services/pusherClient';

export type RideStatus = 'incoming' | 'pickup' | 'ongoing' | 'completed' | 'cancelled';
export type Ride = {
  id: string;
  pickup: string;
  dropoff: string;
  fare: number;
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
  syncCurrentRide: () => Promise<void>;
};

const Ctx = createContext<DriverState | null>(null);

export function DriverProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(false);
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
  const [history, setHistory] = useState<Ride[]>([]);
  const [navPref, setNavPref] = useState<NavPref>('auto');

  const mapBackendRideStatus = useCallback((status?: string | null): RideStatus => {
    switch (status) {
      case 'accepted':
        return 'pickup';
      case 'ongoing':
        return 'ongoing';
      case 'completed':
        return 'completed';
      case 'cancelled':
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
      status: mapBackendRideStatus(payload.status),
      startedAt: payload.started_at ? new Date(payload.started_at).getTime() : undefined,
      completedAt: payload.completed_at ? new Date(payload.completed_at).getTime() : undefined,
      pickupLat: payload.pickup_lat != null ? Number(payload.pickup_lat) : undefined,
      pickupLon: payload.pickup_lng != null ? Number(payload.pickup_lng) : undefined,
      dropoffLat: payload.dropoff_lat != null ? Number(payload.dropoff_lat) : undefined,
      dropoffLon: payload.dropoff_lng != null ? Number(payload.dropoff_lng) : undefined,
      riderId: payload.rider?.id ? String(payload.rider.id) : undefined,
      riderName: payload.rider?.name ?? undefined,
      riderPhone: payload.rider?.phone ?? undefined,
    };
  }, [mapBackendRideStatus]);

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

      if (res.status === 204) {
        setCurrentRide(null);
        return;
      }
      if (!res.ok) return;

      const json = await res.json().catch(() => null);
      const ride = mapApiRideToState(json);
      if (!ride) {
        setCurrentRide(null);
        return;
      }

      setCurrentRide(ride);
    } catch {
    }
  }, [mapApiRideToState]);

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

      if (!res.ok || res.status === 204) return;
      const json = await res.json().catch(() => null);
      const ride = mapApiRideToState(json);
      if (!ride) return;

      setCurrentRide((prev) => {
        if (prev && prev.id === ride.id) {
          return { ...prev, ...ride };
        }
        return ride;
      });
    } catch {
    }
  }, [API_URL, mapApiRideToState]);

  // Load persisted state on mount
  useEffect(() => {
    (async () => {
      try {
        const savedOnline = await AsyncStorage.getItem('driver_online');
        const savedHistory = await AsyncStorage.getItem('driver_history');
        const savedNavPref = await AsyncStorage.getItem('driver_nav_pref');
        if (savedOnline != null) setOnline(savedOnline === '1');
        if (savedHistory) setHistory(JSON.parse(savedHistory));
        if (savedNavPref === 'waze' || savedNavPref === 'gmaps' || savedNavPref === 'auto') setNavPref(savedNavPref);
      } catch {}
    })();
  }, []);

  // Persist online and history
  useEffect(() => {
    (async () => {
      try { await AsyncStorage.setItem('driver_online', online ? '1' : '0'); } catch {}
    })();
  }, [online]);
  useEffect(() => {
    (async () => {
      try { await AsyncStorage.setItem('driver_history', JSON.stringify(history)); } catch {}
    })();
  }, [history]);
  useEffect(() => {
    (async () => {
      try { await AsyncStorage.setItem('driver_nav_pref', navPref); } catch {}
    })();
  }, [navPref]);

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
            checkForIncomingOffer().catch(() => {});
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

  const value = useMemo<DriverState>(() => ({
    online,
    currentRide,
    history,
    navPref,
    syncCurrentRide,
    setOnline: (nextOnline: boolean) => {
      // Met à jour l'état local immédiatement pour une UI réactive
      setOnline(nextOnline);

      (async () => {
        try {
          if (!API_URL) return;
          const token = await AsyncStorage.getItem('authToken');
          if (!token) return;

          await fetch(`${API_URL}/driver/status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ online: nextOnline }),
          });
        } catch {
          // En cas d'erreur réseau/API, on laisse l'état local et on pourra améliorer plus tard (toast, revert...)
        }
      })();
    },
    updateLocation: (lat: number, lng: number) => {
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
    },
    setNavPref,
    checkForIncomingOffer,
    receiveRequest: (ride) => {
      setCurrentRide({ ...ride, status: 'incoming' });
    },
    acceptRequest: async () => {
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
    },
    declineRequest: async () => {
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
    },
    setPickupDone: async () => {
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
    },
    completeRide: async () => {
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
    },
    loadHistoryFromBackend: async () => {
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

        setHistory(mapped);
      } catch {
        // On conserve l'historique local si l'appel échoue
      }
    },
  }), [online, currentRide, history, navPref, syncCurrentRide, mapApiRideToState]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDriverStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDriverStore must be used within DriverProvider');
  return ctx;
}
