import app from "@/firebaseConfig";
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
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    Alert,
    FlatList,
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
 
  // READ — Fetch all notes
  const fetchNotes = async () => {
    try {
      const q = query(collection(db, "notes"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const items: Note[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        title: doc.data().title,
        body: doc.data().body,
      }));
      setNotes(items);
    } catch (error: any) {
      Alert.alert("Error fetching notes", error.message);
    }
  };
 
  useEffect(() => {
    fetchNotes();
  }, []);
 
  // CREATE — Add a new note
  const handleAdd = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Title is required");
      return;
    }
    try {
      await addDoc(collection(db, "notes"), {
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
    Alert.alert("Delete Note", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "notes", id));
            fetchNotes();
          } catch (error: any) {
            Alert.alert("Error deleting note", error.message);
          }
        },
      },
    ]);
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
          <TouchableOpacity
            style={styles.noteCard}
            onPress={() => startEdit(item)}
          >
            <View style={styles.noteContent}>
              <ThemedText type="defaultSemiBold">{item.title}</ThemedText>
              {item.body ? (
                <ThemedText style={styles.noteBody}>{item.body}</ThemedText>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDelete(item.id)}
            >
              <ThemedText style={styles.deleteText}>X</ThemedText>
            </TouchableOpacity>
          </TouchableOpacity>
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
 