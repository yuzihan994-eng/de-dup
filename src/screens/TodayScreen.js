import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import { checkInAPI, actionAPI, tagAPI } from '../services/api';
import { auth } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { colors } from '../styles/colors';
import { DEFAULT_ACTIONS, DEFAULT_TAGS } from '../services/firebaseService';

const SCALE = [1, 2, 3, 4, 5];
const MOOD_COLORS = ['#FECACA', '#FDE68A', '#D9F99D', '#A7F3D0', '#6EE7B7'];
const CHIP_COLORS = ['#3A7F6A', '#F29C85', '#8FB8DE', '#EEC170', '#C08497'];

export const TodayScreen = ({ navigation, route }) => {
  const { user, triggerInsightsReload } = useAuth();
  const defaultActionObjects = DEFAULT_ACTIONS.map(name => ({ id: name, name }));
  const defaultTagObjects = DEFAULT_TAGS.map(name => ({ id: name, name }));
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [stress, setStress] = useState(3);
  const [note, setNote] = useState('');
  const [tags, setTags] = useState([]);
  const [selectedActions, setSelectedActions] = useState([]);
  const [checkInId, setCheckInId] = useState(null);
  const [checkInTime, setCheckInTime] = useState(null);
  const [availableActions, setAvailableActions] = useState(defaultActionObjects);
  const [editingActionId, setEditingActionId] = useState(null);
  const [availableTags, setAvailableTags] = useState(() => defaultTagObjects);
  const [loading, setLoading] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [editingTag, setEditingTag] = useState(null);
  const [newActionName, setNewActionName] = useState('');
  const [addingAction, setAddingAction] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [actionRatings, setActionRatings] = useState({});
  const warningsShown = useRef({ tags: false });
  const [todayEntries, setTodayEntries] = useState([]);
  const toTagObj = (tag) => typeof tag === 'string'
    ? { id: undefined, name: tag }
    : { id: tag.id || tag.name, name: tag.name };

  const dedupeTags = (list = []) =>
    Array.from(
      list.reduce((acc, tag) => acc.set(tag.name, { id: tag.id || tag.name, name: tag.name }), new Map()).values()
    );

  const isPermissionDenied = (error) => {
    const message = error?.response?.data?.message || error?.message || '';
    return message.toLowerCase().includes('insufficient permissions') || message.toLowerCase().includes('missing or insufficient');
  };

  const getScaleColor = (num, isMood) => {
    if (isMood) {
      const index = Math.max(0, Math.min(MOOD_COLORS.length - 1, num - 1));
      return MOOD_COLORS[index];
    }
    return colors.primary;
  };

  const getTagColor = (index) => {
    const paletteIndex = index % CHIP_COLORS.length;
    return CHIP_COLORS[paletteIndex];
  };

  useEffect(() => {
    if (!user || !auth.currentUser) return;
    hydrateFromRouteIfAny();
    loadActions();
    loadTags();
    loadTodayEntries();
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (!user || !auth.currentUser) return;
      hydrateFromRouteIfAny();
      loadActions();
      loadTags();
      loadTodayEntries();
    }, [user, route?.params?.editCheckIn])
  );

  const resetForm = () => {
    setMood(3);
    setEnergy(3);
    setStress(3);
    setNote('');
    setTags([]);
    setSelectedActions([]);
    setCheckInId(null);
    setCheckInTime(null);
    setHasCheckedIn(false);
  };

  const isWithinOneHour = (dateA, dateB) => {
    const diffMs = Math.abs(dateA.getTime() - dateB.getTime());
    return diffMs < 60 * 60 * 1000;
  };

  const hydrateFromCheckIn = (entry) => {
    setMood(entry.mood);
    setEnergy(entry.energy || 3);
    setStress(entry.stress || 3);
    setNote(entry.note || '');
    setTags(entry.tags || []);
    const normalizedActions = (entry.actions || []).map(a => ({
      ...a,
      copingActionId: a.copingActionId || a.id || a.actionName,
    }));
    setSelectedActions(normalizedActions);
    const ratingMap = {};
    normalizedActions.forEach(a => {
      if (typeof a.helpfulnessRating === 'number') {
        ratingMap[a.copingActionId] = a.helpfulnessRating;
      }
    });
    if (entry.ratings) {
      Object.entries(entry.ratings || {}).forEach(([id, score]) => {
        const val = typeof score === 'string' ? parseFloat(score) : score;
        if (typeof val === 'number' && !Number.isNaN(val)) ratingMap[id] = val;
      });
    }
    setActionRatings(ratingMap);
    setCheckInId(entry.id || null);
    setCheckInTime(entry.time ? new Date(entry.time) : null);
    setHasCheckedIn(true);
  };

  const hydrateFromRouteIfAny = async () => {
    const entry = route?.params?.editCheckIn;
    const todaysEntries = await loadTodayEntries();
    if (entry && entry.time) {
      hydrateFromCheckIn(entry);
      navigation.setParams?.({ editCheckIn: null });
      return;
    }
    if (todaysEntries && todaysEntries.length > 0) {
      hydrateFromCheckIn(todaysEntries[0]);
    } else {
      resetForm();
    }
  };

  const loadActions = async () => {
    try {
      const response = await actionAPI.getAll();
      setAvailableActions(response.data || defaultActionObjects);
    } catch (error) {
      if (isPermissionDenied(error)) {
        // Fall back to defaults when reads are blocked
        setAvailableActions(defaultActionObjects);
        return;
      }
      console.error('Error loading actions:', error);
      setAvailableActions(defaultActionObjects);
    }
  };

  const loadTodayEntries = async () => {
    try {
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      const history = await checkInAPI.getHistory();
      const todaysEntries = (history.data || [])
        .filter(entry => entry.date === today)
        .map(entry => ({
          ...entry,
          time: entry.time ? new Date(entry.time) : null,
        }))
        .sort((a, b) => {
          const aTime = a.time ? a.time.getTime() : 0;
          const bTime = b.time ? b.time.getTime() : 0;
          return bTime - aTime;
        });
      setTodayEntries(todaysEntries);
      return todaysEntries;
    } catch (error) {
      if (isPermissionDenied(error)) {
        setTodayEntries([]);
        return [];
      }
      console.warn('Unable to load today entries', error?.response?.data || error?.message);
      setTodayEntries([]);
      return [];
    }
  };

  const mergeTags = (incoming = []) => {
    setAvailableTags((prev) => {
      const combined = [...(prev || []), ...incoming.map(toTagObj)];
      return dedupeTags(combined);
    });
  };

  const loadTags = async () => {
    try {
      const response = await tagAPI.getAll();
      const fetched = (response.data || []).map(toTagObj);
      mergeTags(fetched);
    } catch (error) {
      if (!warningsShown.current.tags) {
        warningsShown.current.tags = true;
        if (!isPermissionDenied(error)) {
          console.warn('Falling back to default tags; tags collection not readable', error?.response?.data || error?.message);
        }
      }
      mergeTags(defaultTagObjects);
    }
  };

  const toggleTagSelection = (tagName) => {
    setTags(prev => prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]);
  };

  const startEditTag = (tag) => {
    setEditingTag(tag);
    setNewTagName(tag.name);
  };

  const handleTagSubmit = async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    if (editingTag) {
      await handleEditTag(editingTag.id, trimmed, editingTag.name);
    } else {
      await handleAddTag(trimmed);
    }
    setNewTagName('');
    setEditingTag(null);
  };

  const toggleAction = (action) => {
    const exists = selectedActions.find(a => a.copingActionId === action.id);
    if (exists) {
      setSelectedActions(selectedActions.filter(a => a.copingActionId !== action.id));
      setActionRatings(prev => {
        const next = { ...prev };
        delete next[action.id];
        return next;
      });
    } else {
      setSelectedActions([...selectedActions, {
        copingActionId: action.id,
        actionName: action.name,
        helpfulnessRating: actionRatings[action.id] ?? null,
      }]);
    }
  };

  const handleAddTag = async (tagName) => {
    const trimmed = tagName.trim();
    if (!trimmed) return;
    const newTagObj = toTagObj({ name: trimmed });
    mergeTags([newTagObj]);
    if (!tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
    }
    try {
      const created = await tagAPI.create(trimmed);
      if (created?.data?.id) {
        // Replace temp tag object with Firestore-backed ID
        mergeTags([{ id: created.data.id, name: trimmed }]);
      }
      // Refresh from Firestore so IDs stay in sync across sessions/devices (and to pick up IDs)
      loadTags();
    } catch (error) {
      console.warn('Tag saved locally but not persisted (permissions?)', error?.response?.data || error?.message);
    }
  };

  const handleEditTag = async (tagId, newName, oldName) => {
    const updated = toTagObj({ id: tagId, name: newName });
    // Replace old entry instead of adding a new one
    setAvailableTags(prev => {
      const filtered = (prev || []).filter(t => t.name !== oldName && t.id !== tagId);
      return dedupeTags([...filtered, updated]);
    });
    if (oldName && tags.includes(oldName)) {
      setTags(prev => prev.map(t => (t === oldName ? newName : t)));
    }
    try {
      const response = await tagAPI.update(tagId, newName, oldName);
      const returnedId = response?.data?.id;
      if (returnedId && returnedId !== tagId) {
        // Align local cache with new persisted ID
        const renamed = toTagObj({ id: returnedId, name: newName });
        setAvailableTags(prev => dedupeTags([...(prev || []).filter(t => t.name !== newName), renamed]));
      }
      loadTags();
    } catch (error) {
      console.warn('Tag rename not persisted (permissions?)', error?.response?.data || error?.message);
    }
  };

  const handleDeleteTag = async (tag) => {
    setAvailableTags(prev => prev.filter(t => t.name !== tag.name));
    setTags(prev => prev.filter(t => t !== tag.name));
    // Default/fallback tags use name as id and are not persisted in Firestore
    if (!tag.id || tag.id === tag.name) {
      // Default or unsynced tag: already removed locally, nothing to delete remotely
      return;
    }
    try {
      await tagAPI.deactivate(tag.id);
    } catch (error) {
      console.warn('Tag delete not persisted (permissions?)', error?.response?.data || error?.message);
    }
  };

  const handleAddAction = async () => {
    const trimmed = newActionName.trim();
    if (!trimmed) return;
    if (availableActions.find(a => a.name.toLowerCase() === trimmed.toLowerCase())) {
      // If editing, still clear state
      setEditingActionId(null);
      setNewActionName('');
      return;
    }
    setAddingAction(true);
    try {
      if (editingActionId) {
        await actionAPI.update(editingActionId, trimmed, null);
        setAvailableActions(prev => prev.map(a => a.id === editingActionId ? { ...a, name: trimmed } : a));
        setSelectedActions(prev => prev.map(a => a.copingActionId === editingActionId ? { ...a, actionName: trimmed } : a));
      } else {
        const response = await actionAPI.create(trimmed, null);
        const newAction = { id: response.data.id, name: trimmed };
        setAvailableActions(prev => [...prev, newAction]);
        setSelectedActions(prev => [...prev, { copingActionId: newAction.id, actionName: newAction.name, helpfulnessRating: null }]);
      }
      // Pull latest from Firestore to keep parity across sessions/devices
      loadActions();
      setNewActionName('');
      setEditingActionId(null);
    } catch (error) {
      alert('Failed to save action');
    } finally {
      setAddingAction(false);
    }
  };

  const handleEditActionStart = (action) => {
    setEditingActionId(action.id);
    setNewActionName(action.name);
  };

  const handleDeleteAction = async (action) => {
    setAvailableActions(prev => prev.filter(a => a.id !== action.id));
    setSelectedActions(prev => prev.filter(a => a.copingActionId !== action.id));
    try {
      await actionAPI.deactivate(action.id);
    } catch (error) {
      console.warn('Action delete not persisted (permissions?)', error?.response?.data || error?.message);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      const selectedIds = selectedActions.map(a => a.copingActionId);
      const ratings = {};
      selectedIds.forEach(id => {
        const val = actionRatings[id];
        if (typeof val === 'number' && !Number.isNaN(val)) {
          ratings[id] = val;
        }
      });
      const response = await checkInAPI.createOrUpdateForHour({
        date: today,
        time: now, // pass Date so service stores Timestamp
        mood,
        energy,
        stress,
        note,
        tags,
        actions: selectedActions.map(a => ({
          copingActionId: a.copingActionId,
          actionName: a.actionName,
          helpfulnessRating: ratings[a.copingActionId] ?? null,
        })),
        actionIds: selectedIds,
        ratings,
        checkInId,
      });

      const savedId = response?.data?.id || checkInId || null;
      setCheckInId(savedId);
      setCheckInTime(now);
      setHasCheckedIn(true);
      await loadTodayEntries();

    // small delay to let writes settle before requesting insights to reload
    try { setTimeout(() => { try { triggerInsightsReload?.(); } catch (e) {} }, 150); } catch (e) {}

      alert('Record saved');
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to save';
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCurrent = async () => {
    if (!checkInId) return;
    setLoading(true);
    try {
      await checkInAPI.delete(checkInId);
      resetForm();
      await loadTodayEntries();
      try { setTimeout(() => { try { triggerInsightsReload?.(); } catch (e) {} }, 150); } catch (e) {}
      alert('Record deleted');
    } catch (error) {
      alert('Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTodayEntry = (entry) => {
    if (!entry) return;
    hydrateFromCheckIn(entry);
  };

  const handleNewEntry = () => {
    if (todayEntries.length >= 4) {
      alert('You have reached the daily limit of 4 logs.');
      return;
    }
    resetForm();
    setCheckInTime(new Date());
  };

  const renderScaleRow = (label, value, setValue, isMood = false) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.sectionTitle}>{label}</Text>
        <Text style={styles.cardHint}>Current: {value}</Text>
      </View>
      <View style={styles.scaleRow}>
        {SCALE.map((num) => {
          const selected = value === num;
          const tint = getScaleColor(num, isMood);
          return (
            <TouchableOpacity
              key={num}
              style={[
                styles.scalePill,
                selected && { backgroundColor: tint, borderColor: tint },
              ]}
              onPress={() => setValue(num)}
            >
              <Text style={[styles.scaleNumber, selected && styles.scaleNumberSelected]}>
                {num}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.displayName}>{user?.displayName || user?.email || 'Today'}</Text>
        <Text style={styles.subtitle}>How are you feeling?</Text>
        <Text style={styles.date}>{format(new Date(), 'MMM dd, EEEE')}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.sectionTitle}>Today&apos;s logs (max 4)</Text>
          <TouchableOpacity
            style={[styles.secondaryPill, todayEntries.length >= 4 && styles.pillDisabled]}
            onPress={handleNewEntry}
            disabled={todayEntries.length >= 4}
          >
            <Text style={styles.secondaryPillText}>New log</Text>
          </TouchableOpacity>
        </View>
        {todayEntries.length === 0 && (
          <Text style={styles.cardHint}>No logs yet today.</Text>
        )}
        {todayEntries.map((entry) => {
          const timeLabel = entry.time ? format(entry.time, 'h:mm a') : 'No time';
          const isActive = checkInId === entry.id;
          return (
            <TouchableOpacity
              key={entry.id}
              style={[styles.logRow, isActive && styles.activeLogRow]}
              onPress={() => handleSelectTodayEntry(entry)}
            >
              <View>
                <Text style={styles.logTime}>{timeLabel}</Text>
                <Text style={styles.logMeta}>Mood {entry.mood} · Energy {entry.energy} · Stress {entry.stress}</Text>
              </View>
              <Text style={styles.logLink}>{isActive ? 'Editing' : 'Edit'}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {renderScaleRow('Mood', mood, setMood, true)}
      {renderScaleRow('Energy', energy, setEnergy)}
      {renderScaleRow('Stress', stress, setStress)}

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.sectionTitle}>Context tags</Text>
          <Text style={styles.cardHint}>Tap to select</Text>
        </View>
        <View style={styles.chipRow}>
          {availableTags.map((tag, index) => {
            const selected = tags.includes(tag.name);
            const tint = getTagColor(index);
            return (
              <TouchableOpacity
                key={tag.id || tag.name}
                style={[
                  styles.chip,
                  selected && { backgroundColor: tint, borderColor: tint },
                ]}
                onPress={() => toggleTagSelection(tag.name)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {tag.name}
                </Text>
                <View style={styles.chipActions}>
                  <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); startEditTag(tag); }}>
                    <Text style={styles.actionMetaText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); handleDeleteTag(tag); }}>
                    <Text style={styles.actionMetaText}>×</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.inlineInputRow}>
          <Input
            value={newTagName}
            onChangeText={setNewTagName}
            placeholder={editingTag ? 'Rename tag' : 'Add tag'}
            style={styles.inlineInput}
            returnKeyType="done"
            onSubmitEditing={handleTagSubmit}
          />
          <TouchableOpacity
            style={[styles.secondaryPill, (!newTagName.trim()) && styles.pillDisabled]}
            onPress={handleTagSubmit}
            disabled={!newTagName.trim()}
          >
            <Text style={styles.secondaryPillText}>{editingTag ? 'Save' : 'Add'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.sectionTitle}>What did you try?</Text>
          <Text style={styles.cardHint}>Tap to select</Text>
        </View>
        <View style={styles.inlineInputRow}>
          <Input
            value={newActionName}
            onChangeText={setNewActionName}
            placeholder={editingActionId ? 'Edit action' : 'Add new action'}
            style={styles.inlineInput}
            returnKeyType="done"
            onSubmitEditing={handleAddAction}
          />
          <TouchableOpacity
            style={[styles.secondaryPill, addingAction && styles.pillDisabled]}
            onPress={handleAddAction}
            disabled={addingAction}
          >
            <Text style={styles.secondaryPillText}>{editingActionId ? 'Save' : 'Add'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.actionsGrid}>
          {availableActions.map((action, index) => {
            const selected = selectedActions.find(a => a.copingActionId === action.id);
            const tint = getTagColor(index);
            return (
              <TouchableOpacity
                key={action.id}
                style={[
                  styles.actionChip,
                  selected && { backgroundColor: tint, borderColor: tint },
                ]}
                onPress={() => toggleAction(action)}
              >
                <Text style={[styles.actionText, selected && styles.selectedActionText]}>
                  {action.name}
                </Text>
                <View style={styles.tagActions}>
                  <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); handleEditActionStart(action); }}>
                    <Text style={styles.actionMetaText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); handleDeleteAction(action); }}>
                    <Text style={styles.actionMetaText}>×</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Note (optional)</Text>
        <Input
          value={note}
          onChangeText={setNote}
          placeholder={'Today\'s note'}
          multiline
          numberOfLines={3}
          style={styles.noteInput}
        />
      </View>

      <View style={styles.buttonStack}>
        <Button
          title={hasCheckedIn ? 'Save Changes' : 'Save Today\'s Log'}
          onPress={handleSave}
          loading={loading}
          style={styles.button}
        />

        {checkInId && (
          <Button
            title={'Delete This Log'}
            onPress={handleDeleteCurrent}
            variant="outline"
            loading={loading}
            style={styles.button}
          />
        )}

        {selectedActions.length > 0 && (
          <Button
            title={'Rate Actions'}
            onPress={() => {
              if (!checkInId) {
                alert('Please save today’s log before rating actions.');
                return;
              }
              navigation.navigate('RateActions', { checkInId });
            }}
            variant="outline"
            style={styles.button}
          />
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 20,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  displayName: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardHint: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  scalePill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 54,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  scaleNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  scaleNumberSelected: {
    color: '#0B1F1A',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: colors.surface,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  chipTextSelected: {
    color: '#0B1F1A',
  },
  chipActions: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  actionMetaText: {
    marginLeft: 8,
    fontSize: 12,
    color: colors.textSecondary,
  },
  inlineInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  inlineInput: {
    flex: 1,
    marginBottom: 0,
  },
  secondaryPill: {
    marginLeft: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  secondaryPillText: {
    color: colors.primary,
    fontWeight: '700',
  },
  pillDisabled: {
    opacity: 0.6,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  actionChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  selectedActionText: {
    color: '#0B1F1A',
  },
  tagActions: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  noteInput: {
    marginTop: 8,
    marginBottom: 0,
  },
  logRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeLogRow: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  logTime: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  logMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  logLink: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '700',
  },
  buttonStack: {
    marginTop: 18,
    marginBottom: 24,
  },
  button: {
    marginBottom: 12,
  },
});
