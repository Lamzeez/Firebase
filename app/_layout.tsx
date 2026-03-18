import app, { auth } from '@/firebaseConfig';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp, updateDoc, collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

const db = getFirestore(app);

// Initialize notification handler only on native platforms
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const segments = useSegments();
  const router = useRouter();
  
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>('');
  const [notification, setNotification] = useState<Notifications.Notification | undefined>(
    undefined
  );
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const messageListenerUnsubscribe = useRef<any>(null);

  // Request Web Notification Permission
  useEffect(() => {
    if (Platform.OS === 'web' && 'Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }
  }, []);

  // Function to register for push notifications and get the token
  async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'web') return; // Not supported in web app version

    let token;
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        alert('Failed to get push token for push notification!');
        return;
      }
      
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.expoConfig?.slug;
      if (!projectId) {
        console.warn("No Project ID found for push tokens");
        return;
      }

      token = (await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      })).data;
      console.log("Push Token:", token);
    } else {
      console.log('Must use physical device for Push Notifications');
    }

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return token;
  }

  // Listen for auth state changes and register notifications
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Save user to Firestore
        try {
          await setDoc(doc(db, 'users', firebaseUser.uid), {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            lastSeen: serverTimestamp(),
          }, { merge: true });

          // Register for push notifications (Native Only)
          if (Platform.OS !== 'web') {
            const token = await registerForPushNotificationsAsync();
            if (token) {
              setExpoPushToken(token);
              // Save the token to the user's document in Firestore
              await updateDoc(doc(db, 'users', firebaseUser.uid), {
                pushToken: token,
              });
            }
          }

          // Listen for new incoming messages globally (Web In-App Notification)
          const q = query(
            collection(db, 'messages'),
            where('receiverId', '==', firebaseUser.uid),
            orderBy('createdAt', 'desc'),
            limit(1)
          );
          
          let isInitialLoad = true;
          messageListenerUnsubscribe.current = onSnapshot(q, (snapshot) => {
            if (isInitialLoad) {
              isInitialLoad = false;
              return;
            }
            
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                const messageData = change.doc.data();
                
                // Show Web Notification
                if (Platform.OS === 'web' && 'Notification' in window) {
                  if (Notification.permission === 'granted') {
                    new Notification("New Message!", {
                      body: messageData.text,
                    });
                  } else {
                    // Fallback to standard alert if permission wasn't granted
                    alert(`New Message: ${messageData.text}`);
                  }
                }
              }
            });
          });

        } catch (error) {
          console.error("Error updating user Firestore:", error);
        }
      } else {
        // Clean up message listener on logout
        if (messageListenerUnsubscribe.current) {
          messageListenerUnsubscribe.current();
          messageListenerUnsubscribe.current = null;
        }
      }
      setReady(true);
    });

    // Notification Listeners (Native Only)
    if (Platform.OS !== 'web') {
      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        setNotification(notification);
      });

      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        console.log("Notification Response:", response);
      });
    }

    return () => {
      unsubscribeAuth();
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
      if (messageListenerUnsubscribe.current) {
        messageListenerUnsubscribe.current();
      }
    };
  }, []);

  // Redirect based on auth state
  useEffect(() => {
    if (!ready) return;

    const onLoginScreen = segments[0] === 'login';

    if (!user && !onLoginScreen) {
      router.replace('/login');
    } else if (user && onLoginScreen) {
      router.replace('/(tabs)');
    }
  }, [user, ready, segments]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
