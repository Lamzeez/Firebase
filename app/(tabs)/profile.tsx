import app, { auth } from '../../firebaseConfig';
import { signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { Alert, StyleSheet, TouchableOpacity, View, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const db = getFirestore(app);

export default function ProfileScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Listen for real-time profile updates
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const userData = snapshot.data();
        setProfileImage(userData.profileImage || null);
      }
    });

    return unsubscribe;
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const pickImage = async () => {
    // No permissions request is necessary for launching the image library
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5, // Reduced quality for base64 storage
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      uploadProfileImage(result.assets[0].base64);
    }
  };

  const uploadProfileImage = async (base64: string) => {
    if (!user) return;
    setUploading(true);

    try {
      // For this simple version, we store the image as a Base64 string in Firestore.
      // A data URL format is used: data:image/jpeg;base64,...
      const imageData = `data:image/jpeg;base64,${base64}`;
      
      await updateDoc(doc(db, 'users', user.uid), {
        profileImage: imageData,
      });

      Alert.alert('Success', 'Profile picture updated!');
    } catch (error: any) {
      Alert.alert('Error uploading image', error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.heading}>My Profile</ThemedText>

      <View style={styles.profileCard}>
        <TouchableOpacity onPress={pickImage} disabled={uploading} style={styles.avatarContainer}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.avatarLarge} />
          ) : (
            <View style={styles.avatarLargePlaceholder}>
              <ThemedText style={styles.avatarTextLarge}>
                {user?.email ? user.email[0].toUpperCase() : '?'}
              </ThemedText>
            </View>
          )}
          {uploading && (
            <View style={styles.uploadOverlay}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
          <View style={styles.editBadge}>
            <ThemedText style={styles.editBadgeText}>Edit</ThemedText>
          </View>
        </TouchableOpacity>
        
        <ThemedText type="subtitle" style={styles.emailText}>{user?.email}</ThemedText>
        <ThemedText style={styles.instructionText}>Tap the icon to change photo</ThemedText>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <ThemedText style={styles.signOutText}>Sign Out</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  heading: {
    marginBottom: 30,
    alignSelf: 'flex-start',
  },
  profileCard: {
    width: '100%',
    backgroundColor: 'rgba(0,102,204,0.05)',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarLargePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#0066CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTextLarge: {
    color: '#fff',
    fontSize: 40,
    fontWeight: 'bold',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0066CC',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
  },
  editBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emailText: {
    marginBottom: 5,
  },
  instructionText: {
    fontSize: 12,
    opacity: 0.5,
  },
  signOutButton: {
    backgroundColor: '#cc0000',
    width: '100%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  signOutText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
