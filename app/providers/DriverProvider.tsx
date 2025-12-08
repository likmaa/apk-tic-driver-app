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
  pendingNavigation: string | null;
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
  setPendingNavigation: (route: string | null) => void;
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
      case 'requested':
        return 'incoming';
      default:
        if (status) {
          console.warn(`[DriverProvider] Statut de course inconnu depuis le backend: "${status}", utilisation de "incoming" par défaut`);
        }
        return 'incoming';
    }
  }, []);

  const mapApiRideToState = useCallback((payload: any): Ride | null => {
    if (!payload || !payload.id) {
      console.warn('[DriverProvider] Payload invalide ou manquant pour mapApiRideToState');
      return null;
    }

    const mappedStatus = mapBackendRideStatus(payload.status);
    const ride: Ride = {
      id: String(payload.id),
      pickup: payload.pickup_address ?? payload.pickup_label ?? 'Point de départ',
      dropoff: payload.dropoff_address ?? payload.dropoff_label ?? 'Destination',
      fare: Number(payload.fare_amount ?? payload.fare ?? 0),
      status: mappedStatus,
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

    // Vérification que le statut est valide
    const validStatuses: RideStatus[] = ['incoming', 'pickup', 'ongoing', 'completed', 'cancelled'];
    if (!validStatuses.includes(mappedStatus)) {
      console.error(`[DriverProvider] Statut invalide après mapping: "${mappedStatus}" pour la course ${ride.id}`);
    }

    return ride;
  }, [mapBackendRideStatus]);

  const syncCurrentRide = useCallback(async () => {
    try {
      if (!API_URL) {
        console.warn('[DriverProvider] API_URL non défini, impossible de synchroniser la course');
        return;
      }
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.warn('[DriverProvider] Token d\'authentification manquant');
        return;
      }

      console.log('[DriverProvider] Synchronisation de la course actuelle...');
      
      // Timeout de 8 secondes pour éviter les blocages
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`${API_URL}/driver/current-ride`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.status === 204) {
        console.log('[DriverProvider] Aucune course en cours (204)');
        setCurrentRide(null);
        return;
      }
      if (!res.ok) {
        console.warn(`[DriverProvider] Erreur HTTP ${res.status} lors de la synchronisation`);
        return;
      }

      const json = await res.json().catch((error) => {
        console.error('[DriverProvider] Erreur lors du parsing JSON:', error);
        return null;
      });
      const ride = mapApiRideToState(json);
      if (!ride) {
        console.warn('[DriverProvider] Impossible de mapper la course depuis l\'API');
        setCurrentRide(null);
        return;
      }

      console.log('[DriverProvider] Course synchronisée:', { id: ride.id, status: ride.status });
      setCurrentRide(ride);
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.warn('[DriverProvider] Timeout lors de la synchronisation de la course');
        } else {
          console.error('[DriverProvider] Erreur lors de la synchronisation de la course:', error);
          // Ne pas afficher d'alerte pour les erreurs de synchronisation automatique
          // pour éviter de spammer l'utilisateur
        }
      }
  }, [mapApiRideToState]);

  const checkForIncomingOffer = useCallback(async () => {
    try {
      if (!API_URL) return;
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      // Timeout de 5 secondes pour éviter les blocages
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${API_URL}/driver/next-offer`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.warn('[DriverProvider] Erreur lors de la vérification des offres:', error);
        // Ne pas afficher d'alerte pour les erreurs de vérification automatique
        // Le WebSocket gère les notifications en temps réel
      }
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
        const token = await AsyncStorage.getItem('authToken');
        if (!token) return;

        // Récupérer l'ID du chauffeur depuis le profil utilisateur
        let driverId: string | null = null;
        try {
          const userStr = await AsyncStorage.getItem('authUser');
          if (userStr) {
            const user = JSON.parse(userStr);
            driverId = user.id ? String(user.id) : null;
          }
        } catch (e) {
          console.warn('[DriverProvider] Erreur lors de la récupération de l\'ID utilisateur:', e);
        }

        // S'abonner au canal privé du chauffeur pour recevoir les offres directement
        if (driverId) {
          channel = client.subscribe(`private-driver.${driverId}`);
          console.log(`[DriverProvider] Abonnement au canal private-driver.${driverId}`);
        } else {
          // Fallback sur le canal presence si pas d'ID
          channel = client.subscribe('presence-drivers');
          console.log('[DriverProvider] Abonnement au canal presence-drivers (fallback)');
        }

        // Écouter l'événement ride.requested avec les données de la course
        channel.bind('ride.requested', (data: any) => {
          if (!cancelled && data) {
            // Si les données de la course sont incluses dans l'événement, les utiliser directement
            const ride = mapApiRideToState(data.ride || data);
            if (ride) {
              setCurrentRide((prev) => {
                if (prev && prev.id === ride.id) {
                  return { ...prev, ...ride };
                }
                return ride;
              });
            } else {
              // Sinon, fallback sur checkForIncomingOffer
              checkForIncomingOffer().catch(() => {});
            }
          }
        });

        // Écouter les mises à jour de statut de course
        channel.bind('ride.status.updated', (data: any) => {
          if (!cancelled && data?.ride_id && currentRide?.id === String(data.ride_id)) {
            syncCurrentRide().catch(() => {});
          }
        });

        // Gérer les erreurs de connexion
        client.connection.bind('error', (err: any) => {
          console.warn('[DriverProvider] Erreur WebSocket:', err);
        });

        client.connection.bind('connected', () => {
          console.log('[DriverProvider] WebSocket connecté');
        });

        client.connection.bind('disconnected', () => {
          console.warn('[DriverProvider] WebSocket déconnecté');
        });
      } catch (error) {
        console.warn('[DriverProvider] Échec de l\'abonnement WebSocket:', error);
        // En cas d'échec WebSocket, on continue avec le polling comme fallback
      }
    })();

    return () => {
      cancelled = true;
      unsubscribeChannel(channel);
    };
  }, [online, checkForIncomingOffer, mapApiRideToState, syncCurrentRide, currentRide]);

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

          // Timeout de 5 secondes pour éviter les blocages
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          await fetch(`${API_URL}/driver/status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ online: nextOnline }),
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
        } catch (error: any) {
          // En cas d'erreur réseau/API (y compris timeout), on laisse l'état local
          if (error.name !== 'AbortError') {
            console.warn('[DriverProvider] Erreur lors de la mise à jour du statut online:', error);
            // Ne pas afficher d'alerte, l'état local est préservé pour une meilleure UX
          }
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
        } catch (error) {
          // Erreur silencieuse pour la mise à jour de localisation
          // pour éviter de spammer l'utilisateur avec des erreurs réseau
          console.warn('[DriverProvider] Erreur lors de la mise à jour de localisation:', error);
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
      } catch (error) {
        // Erreur silencieuse pour le refus de course
        // L'état local est déjà mis à jour
        console.warn('[DriverProvider] Erreur lors du refus de course:', error);
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
      } catch (error) {
        // On garde l'état local même en cas d'erreur réseau
        console.warn('[DriverProvider] Erreur lors de la confirmation de prise en charge:', error);
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
      } catch (error) {
        // On ignore l'erreur réseau, l'historique local reste
        console.warn('[DriverProvider] Erreur lors de la finalisation de course:', error);
      }
    },
    loadHistoryFromBackend: async () => {
      try {
        if (!API_URL) return;
        const token = await AsyncStorage.getItem('authToken');
        if (!token) return;

        // Timeout de 8 secondes pour éviter les blocages
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(`${API_URL}/driver/rides?status=completed&per_page=50`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

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
      } catch (error) {
        // On conserve l'historique local si l'appel échoue
        console.warn('[DriverProvider] Erreur lors du chargement de l\'historique:', error);
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
