import app, { auth } from "../../firebaseConfig";
import {
  addDoc,
  collection,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";
import { useEffect, useState, useRef } from "react";
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

const db = getFirestore(app);

type UserProfile = {
  uid: string;
  email: string;
  pushToken?: string;
};

type Message = {
  id: string;
  senderId: string;
  receiverId: string;
  participants: string[];
  text: string;
  createdAt: any;
};

export default function MessagesScreen() {
  const currentUser = auth.currentUser;
  const [searchEmail, setSearchEmail] = useState("");
  const [targetUser, setTargetUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [recentChats, setRecentChats] = useState<UserProfile[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  // SEARCH — Find a user by email
  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    if (searchEmail.toLowerCase() === currentUser?.email?.toLowerCase()) {
      Alert.alert("Error", "You cannot message yourself.");
      return;
    }

    try {
      const q = query(
        collection(db, "users"),
        where("email", "==", searchEmail.trim().toLowerCase()),
        limit(1)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        Alert.alert("Not Found", "No user found with that email.");
        setTargetUser(null);
      } else {
        const userData = snapshot.docs[0].data() as UserProfile;
        setTargetUser(userData);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  // FETCH RECENT CHATS — Listen for messages to build a list of people you've talked to
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, "messages"),
      where("participants", "array-contains", currentUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const allMessages = snapshot.docs.map(doc => doc.data() as Message);
      
      // Get unique partner IDs
      const partnerIds = new Set<string>();
      allMessages.forEach(msg => {
        const partnerId = msg.participants.find(id => id !== currentUser.uid);
        if (partnerId) partnerIds.add(partnerId);
      });

      // Fetch user profiles for these partners
      const profiles: UserProfile[] = [];
      for (const id of partnerIds) {
        try {
          const userDoc = await getDoc(doc(db, "users", id));
          if (userDoc.exists()) {
            profiles.push(userDoc.data() as UserProfile);
          }
        } catch (e) {
          console.error("Error fetching profile", e);
        }
      }
      setRecentChats(profiles);
      setLoadingChats(false);
    });

    return unsubscribe;
  }, [currentUser]);

  // LISTEN — Real-time messages between currentUser and targetUser
  useEffect(() => {
    if (!currentUser || !targetUser) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, "messages"),
      where("participants", "array-contains", currentUser.uid),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allMsgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];

      const filtered = allMsgs.filter(msg => 
        msg.participants.includes(targetUser.uid)
      );

      setMessages(filtered);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return unsubscribe;
  }, [targetUser, currentUser]);

  // PUSH NOTIFICATION — Send a push notification via Expo
  const sendPushNotification = async (targetToken: string, senderEmail: string, messageText: string) => {
    const message = {
      to: targetToken,
      sound: 'default',
      title: `New message from ${senderEmail}`,
      body: messageText,
      data: { someData: 'goes here' },
    };

    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
    } catch (error) {
      console.error("Error sending push notification:", error);
    }
  };

  // SEND — Send a new message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUser || !targetUser) return;

    const messageText = newMessage.trim();

    try {
      await addDoc(collection(db, "messages"), {
        senderId: currentUser.uid,
        receiverId: targetUser.uid,
        participants: [currentUser.uid, targetUser.uid],
        text: messageText,
        createdAt: serverTimestamp(),
      });
      
      // Trigger Push Notification if the target user has a token
      if (targetUser.pushToken) {
        sendPushNotification(targetUser.pushToken, currentUser.email || 'Someone', messageText);
      }

      setNewMessage("");
    } catch (error: any) {
      Alert.alert("Error sending message", error.message);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.heading}>Private Messages</ThemedText>

      {/* Main View: Search + Recent Chats */}
      {!targetUser ? (
        <View style={{ flex: 1 }}>
          <View style={styles.searchSection}>
            <ThemedText style={styles.instruction}>Search for a user by email:</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="user@example.com"
              placeholderTextColor="#888"
              value={searchEmail}
              onChangeText={setSearchEmail}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.button} onPress={handleSearch}>
              <ThemedText style={styles.buttonText}>Search User</ThemedText>
            </TouchableOpacity>
          </View>

          <ThemedText type="subtitle" style={styles.recentHeading}>Recent Chats</ThemedText>
          {loadingChats ? (
            <ActivityIndicator size="large" color="#0066CC" />
          ) : (
            <FlatList
              data={recentChats}
              keyExtractor={(item) => item.uid}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.chatListItem} 
                  onPress={() => setTargetUser(item)}
                >
                  <View style={styles.avatarPlaceholder}>
                    <ThemedText style={styles.avatarText}>{item.email[0].toUpperCase()}</ThemedText>
                  </View>
                  <ThemedText style={styles.chatListEmail}>{item.email}</ThemedText>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <ThemedText style={styles.emptyText}>No recent messages. Start a new chat!</ThemedText>
              }
            />
          )}
        </View>
      ) : (
        /* Individual Chat View */
        <View style={{ flex: 1 }}>
          <View style={styles.chatHeader}>
            <ThemedText type="defaultSemiBold">Chatting with: {targetUser.email}</ThemedText>
            <TouchableOpacity onPress={() => {setTargetUser(null); setSearchEmail("");}}>
              <ThemedText style={styles.changeUser}>Back</ThemedText>
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"} 
            style={styles.chatContainer}
            keyboardVerticalOffset={100}
          >
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={[
                  styles.messageBubble, 
                  item.senderId === currentUser?.uid ? styles.sentBubble : styles.receivedBubble
                ]}>
                  <ThemedText style={item.senderId === currentUser?.uid ? styles.sentText : styles.receivedText}>
                    {item.text}
                  </ThemedText>
                </View>
              )}
              contentContainerStyle={styles.messageList}
            />

            <View style={styles.inputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder="Type a message..."
                placeholderTextColor="#888"
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
              />
              <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
                <ThemedText style={styles.sendButtonText}>Send</ThemedText>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  heading: {
    marginBottom: 20,
  },
  searchSection: {
    gap: 12,
    marginBottom: 30,
  },
  instruction: {
    opacity: 0.7,
    marginBottom: 4,
  },
  recentHeading: {
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#0066CC",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  chatListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'rgba(0,102,204,0.05)',
    borderRadius: 12,
    marginBottom: 10,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0066CC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  chatListEmail: {
    fontSize: 16,
  },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    marginBottom: 10,
  },
  changeUser: {
    color: "#0066CC",
    fontSize: 14,
    fontWeight: 'bold',
  },
  chatContainer: {
    flex: 1,
  },
  messageList: {
    paddingVertical: 10,
  },
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 18,
    marginBottom: 8,
  },
  sentBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#007AFF",
  },
  receivedBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#E5E5EA",
  },
  sentText: {
    color: "#fff",
  },
  receivedText: {
    color: "#000",
  },
  messageText: {
    color: "#fff",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingVertical: 10,
    backgroundColor: "transparent",
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 100,
    backgroundColor: "#fff",
    color: "#000",
  },
  sendButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    justifyContent: "center",
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  emptyText: {
    textAlign: "center",
    opacity: 0.5,
    marginTop: 20,
  },
});
