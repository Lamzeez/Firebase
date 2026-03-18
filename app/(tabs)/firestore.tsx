import app, { auth } from "../../firebaseConfig";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    getFirestore,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    Alert,
    FlatList,
    Platform,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
 
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
 
const db = getFirestore(app);
 
type Note = {
  id: string;
  title: string;
  body: string;
};
 
export default function FirestoreScreen() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
 
  // READ — Fetch all notes for the current user
  const fetchNotes = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      // Create a query that filters by userId and sorts by creation time
      const q = query(
        collection(db, "notes"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      const items: Note[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        title: doc.data().title,
        body: doc.data().body,
      }));
      setNotes(items);
    } catch (error: any) {
      console.error("Error fetching notes:", error);
      // Note: If you see an error about needing an index, Firestore will provide a link in the browser console.
      Alert.alert("Error fetching notes", error.message);
    }
  };
 
  useEffect(() => {
    fetchNotes();
  }, []);
 
  // CREATE — Add a new note with the current user's ID
  const handleAdd = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Error", "You must be logged in to add notes");
      return;
    }

    if (!title.trim()) {
      Alert.alert("Error", "Title is required");
      return;
    }
    try {
      await addDoc(collection(db, "notes"), {
        userId: user.uid, // Save the owner's ID
        title: title.trim(),
        body: body.trim(),
        createdAt: serverTimestamp(),
      });
      setTitle("");
      setBody("");
      fetchNotes();
    } catch (error: any) {
      Alert.alert("Error adding note", error.message);
    }
  };
 
  // UPDATE — Edit an existing note
  const handleUpdate = async () => {
    if (!editingId || !title.trim()) return;
    try {
      await updateDoc(doc(db, "notes", editingId), {
        title: title.trim(),
        body: body.trim(),
      });
      setTitle("");
      setBody("");
      setEditingId(null);
      fetchNotes();
    } catch (error: any) {
      Alert.alert("Error updating note", error.message);
    }
  };
 
  // DELETE — Remove a note
  const handleDelete = (id: string) => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Are you sure you want to delete this note?");
      if (confirmed) {
        performDelete(id);
      }
    } else {
      Alert.alert("Delete Note", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => performDelete(id),
        },
      ]);
    }
  };

  const performDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "notes", id));
      fetchNotes();
    } catch (error: any) {
      if (Platform.OS === "web") {
        alert("Error deleting note: " + error.message);
      } else {
        Alert.alert("Error deleting note", error.message);
      }
    }
  };
 
  // Tap a note to edit it
  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setTitle(note.title);
    setBody(note.body);
  };
 
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.heading}>
        Firestore CRUD
      </ThemedText>
 
      {/* Form */}
      <TextInput
        style={styles.input}
        placeholder="Note title"
        placeholderTextColor="#888"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={[styles.input, styles.bodyInput]}
        placeholder="Note body"
        placeholderTextColor="#888"
        value={body}
        onChangeText={setBody}
        multiline
      />
 
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, editingId && styles.updateButton]}
          onPress={editingId ? handleUpdate : handleAdd}
        >
          <ThemedText style={styles.buttonText}>
            {editingId ? "Update" : "Add Note"}
          </ThemedText>
        </TouchableOpacity>
        {editingId && (
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => {
              setEditingId(null);
              setTitle("");
              setBody("");
            }}
          >
            <ThemedText style={styles.buttonText}>Cancel</ThemedText>
          </TouchableOpacity>
        )}
      </View>
 
      {/* Notes List */}
      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        style={styles.list}
        renderItem={({ item }) => (
          <View style={styles.noteCard}>
            <TouchableOpacity
              style={styles.noteContent}
              onPress={() => startEdit(item)}
            >
              <ThemedText type="defaultSemiBold">{item.title}</ThemedText>
              {item.body ? (
                <ThemedText style={styles.noteBody}>{item.body}</ThemedText>
              ) : null}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDelete(item.id)}
              activeOpacity={0.7}
            >
              <ThemedText style={styles.deleteText}>X</ThemedText>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>
            No notes yet. Add one above!
          </ThemedText>
        }
      />
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
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#fff",
  },
  bodyInput: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    backgroundColor: "#0066CC",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  updateButton: {
    backgroundColor: "#FF6600",
  },
  cancelButton: {
    backgroundColor: "#888",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  list: {
    flex: 1,
  },
  noteCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,102,204,0.08)",
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
  },
  noteContent: {
    flex: 1,
  },
  noteBody: {
    opacity: 0.7,
    marginTop: 4,
  },
  deleteButton: {
    backgroundColor: "#cc0000",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  deleteText: {
    color: "#fff",
    fontWeight: "bold",
  },
  emptyText: {
    textAlign: "center",
    opacity: 0.5,
    marginTop: 30,
  },
});
 