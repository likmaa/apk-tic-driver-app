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
import './locales/i18n';

import { DriverProvider } from './providers/DriverProvider';

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
