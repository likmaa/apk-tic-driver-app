import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { DriverProvider } from './providers/DriverProvider';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Onboarding chauffeur en première étape
  initialRouteName: 'driver-onboarding',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
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
  return (
    <ThemeProvider value={DefaultTheme}>
      <DriverProvider>
        <Stack>
          {/* Onboarding / pré-flux */}
          <Stack.Screen name="driver-onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="driver-location-permission" options={{ headerShown: false }} />
          <Stack.Screen name="driver-login-intro" options={{ headerShown: false }} />
          <Stack.Screen name="driver-phone-login" options={{ headerShown: false }} />
          <Stack.Screen name="driver-existing-account" options={{ headerShown: false }} />
          <Stack.Screen name="driver-existing-details" options={{ headerShown: false }} />
          <Stack.Screen name="driver-pending-approval" options={{ headerShown: false }} />
          <Stack.Screen name="driver-contract" options={{ headerShown: false }} />

          {/* App principale */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="driver-menu"
            options={{
              headerShown: false,
              presentation: 'transparentModal',
              animation: 'slide_from_right',
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
        </Stack>
      </DriverProvider>
    </ThemeProvider>
  );
}
