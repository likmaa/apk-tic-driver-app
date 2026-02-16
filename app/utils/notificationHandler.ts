import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';

export async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#0008ff85',
        });
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return null;
        }

        token = (await Notifications.getDevicePushTokenAsync()).data;
    } else {
        console.log('Must use physical device for Push Notifications');
    }

    return token;
}

export async function registerTokenWithBackend(token: string, authToken: string) {
    if (!API_URL) return;

    try {
        const response = await fetch(`${API_URL}/auth/fcm/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({
                token,
                device_type: Platform.OS,
            }),
        });

        if (response.ok) {
            console.log('FCM Token registered successfully');
            await AsyncStorage.setItem('fcmToken', token);
        } else {
            console.error('Failed to register FCM Token', await response.text());
        }
    } catch (error) {
        console.error('Error registering FCM Token:', error);
    }
}
