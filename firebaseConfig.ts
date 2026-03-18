import { initializeApp } from "firebase/app";
import { 
  initializeAuth, 
  getReactNativePersistence, 
  getAuth, 
  browserLocalPersistence 
} from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDEK_XkTGFcj-qNbsL9QWS3OzXa_AWpk-k",
  authDomain: "myapp-9a39a.firebaseapp.com",
  projectId: "myapp-9a39a",
  storageBucket: "myapp-9a39a.firebasestorage.app",
  messagingSenderId: "109635760618",
  appId: "1:109635760618:web:ab9d468eab215311a88293"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with platform-specific persistence
let auth;

if (Platform.OS === 'web') {
  // For Web: Use standard browser persistence
  auth = getAuth(app);
} else {
  // For Native (Android/iOS): Use AsyncStorage persistence
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
}

export { auth };
export default app;
