import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput } from 'react-native';
import { colors } from '../styles/colors';

export const TagSelector = ({ selectedTags, onChange, availableTags = [], onAddTag, onEditTag, onDeleteTag }) => {
  const scrollRef = useRef(null);
  const [localTags, setLocalTags] = useState([...availableTags]);
  const [newTag, setNewTag] = useState('');
  const [editingTagId, setEditingTagId] = useState(null);

  useEffect(() => {
    // Keep local list in sync with parent-provided tags and ensure selected ones stay visible
    // Normalize to objects
    const normalize = (tag) =>
      typeof tag === 'string' ? { id: tag, name: tag } : { id: tag.id || tag.name, name: tag.name };
    const merged = [...(availableTags || []), ...(selectedTags || []).map(normalize)];
    const deduped = Array.from(
      merged.reduce((acc, tag) => acc.set(tag.name, { id: tag.id || tag.name, name: tag.name }), new Map()).values()
    );
    setLocalTags(deduped);
  }, [availableTags, selectedTags]);

  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter(t => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    if (editingTagId) {
      const prevName = localTags.find(t => t.id === editingTagId)?.name;
      const updatedTags = localTags.map(t => t.id === editingTagId ? { ...t, name: trimmed } : t);
      setLocalTags(updatedTags);
      // Update selection if the old name was selected
      if (prevName && selectedTags.includes(prevName)) {
        onChange(selectedTags.map(t => (t === prevName ? trimmed : t)));
      }
      onEditTag?.(editingTagId, trimmed, prevName);
      setEditingTagId(null);
      setNewTag('');
      return;
    }
    // Optimistically show the new tag immediately
    setLocalTags(prev => {
      const next = [...prev, { id: trimmed, name: trimmed }];
      return Array.from(new Map(next.map(t => [t.name, t])).values());
    });
    if (!selectedTags.includes(trimmed)) {
      onChange([...selectedTags, trimmed]);
    }
    // Let parent persist and push into available list
    onAddTag?.(trimmed);
    setNewTag('');
  };

  const startEdit = (tag) => {
    setEditingTagId(tag.id);
    setNewTag(tag.name);
  };

  const handleDelete = (tag) => {
    setLocalTags(prev => prev.filter(t => t.name !== tag.name));
    if (selectedTags.includes(tag.name)) {
      onChange(selectedTags.filter(t => t !== tag.name));
    }
    onDeleteTag?.(tag);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Tags</Text>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={newTag}
          onChangeText={setNewTag}
          placeholder="Add new tag"
          returnKeyType="done"
          onSubmitEditing={handleAddTag}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddTag}>
          <Text style={styles.addButtonText}>{editingTagId ? 'Save' : 'Add'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.tagsContainer} ref={scrollRef}>
        {localTags.map((tag) => (
          <TouchableOpacity
            key={`${tag.id || tag.name}-${tag.name}`}
            style={[
              styles.tag,
              selectedTags.includes(tag.name) && styles.selectedTag,
            ]}
            onPress={() => toggleTag(tag.name)}
          >
            <Text
              style={[
                styles.tagText,
                selectedTags.includes(tag.name) && styles.selectedTagText,
              ]}
            >
              {tag.name}
            </Text>
            <View style={styles.tagActions}>
              <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); startEdit(tag); }}>
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); handleDelete(tag); }}>
                <Text style={styles.actionText}>×</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedTag: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryLight,
  },
  tagText: {
    fontSize: 14,
    color: colors.text,
  },
  selectedTagText: {
    color: colors.text,
    fontWeight: '600',
  },
  tagActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
