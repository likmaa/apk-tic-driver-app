import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import {
  TitilliumWeb_400Regular,
  TitilliumWeb_600SemiBold,
} from '@expo-google-fonts/titillium-web';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

import { DriverProvider } from './providers/DriverProvider';

// Configure notification handler for foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Onboarding chauffeur en première étape
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
    TitilliumWeb_400Regular,
    TitilliumWeb_600SemiBold,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const router = useRouter();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data.type === 'new_ride' && data.ride_id) {
        // Navigate to the incoming ride screen
        router.push({
          pathname: '/incoming',
          params: { ride_id: String(data.ride_id) }
        });
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <ThemeProvider value={DefaultTheme}>
      <DriverProvider>
        <Stack>
          {/* Onboarding / pré-flux */}
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="driver-onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="driver-location-permission" options={{ headerShown: false }} />
          <Stack.Screen name="driver-login-intro" options={{ headerShown: false }} />
          <Stack.Screen name="driver-phone-login" options={{ headerShown: false }} />
          <Stack.Screen name="driver-login-otp" options={{ headerShown: false }} />
          <Stack.Screen name="driver-existing-account" options={{ headerShown: false }} />
          <Stack.Screen name="driver-existing-details" options={{ headerShown: false }} />
          <Stack.Screen name="driver-pending-approval" options={{ headerShown: false }} />
          <Stack.Screen name="driver-approved-success" options={{ headerShown: false }} />
          <Stack.Screen name="driver-application-rejected" options={{ headerShown: false }} />
          <Stack.Screen name="driver-contract" options={{ headerShown: false }} />

          {/* App principale */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="driver-menu"
            options={{
              headerShown: false,
              presentation: 'transparentModal',
              animation: 'fade',
            }}
          />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          <Stack.Screen
            name="incoming"
            options={{
              title: 'Demande entrante',
              presentation: 'modal',
              headerShown: false,
            }}
          />
          <Stack.Screen name="pickup" options={{ title: 'Prise en charge' }} />
          <Stack.Screen name="ride-ongoing" options={{ title: 'Course en cours' }} />
          <Stack.Screen name="complete" options={{ title: 'Terminer' }} />
          <Stack.Screen name="notifications" options={{ headerShown: false }} />
          <Stack.Screen name="help" options={{ headerShown: false }} />
        </Stack>
      </DriverProvider>
    </ThemeProvider>
  );
}
