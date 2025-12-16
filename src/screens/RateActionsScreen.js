import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { checkInAPI } from '../services/api';
import { colors } from '../styles/colors';
import { Button } from '../components/Button';

export const RateActionsScreen = ({ route, navigation }) => {
  const { user, triggerInsightsReload } = useAuth();
  const checkInId = route.params?.checkInId || null;
  const [actions, setActions] = useState([]);
  const [ratings, setRatings] = useState({});
  const [loading, setLoading] = useState(false);

  const handleRate = (actionId, value) => {
    setRatings(prev => ({ ...prev, [actionId]: value }));
  };

  const handleSubmit = async () => {
    if (!checkInId) {
      alert('Please save today’s check-in before rating actions.');
      return false;
    }
    setLoading(true);
    try {
      const updatePromises = actions.map(action => {
        const actionId = action.copingActionId || action.id;
        const rating = ratings[actionId] || 3;
        return checkInAPI.updateActionRating(actionId, rating, checkInId);
      });
      await Promise.all(updatePromises);

      try {
        const fresh = await checkInAPI.getById(checkInId);
        const log = fresh?.data || {};
        const ids = Array.isArray(log.actionIds) ? log.actionIds : [];
        const ratingsMap = log.ratings || {};
        const allActions = Array.isArray(log.actions) ? log.actions : [];
        const filtered = ids.map(id => {
          const match = allActions.find(a => (a.copingActionId || a.id) === id) || { copingActionId: id, actionName: id };
          return {
            ...match,
            copingActionId: id,
            actionName: match.actionName || match.name || id,
            helpfulnessRating: ratingsMap[id] ?? match.helpfulnessRating ?? null,
          };
        });
        setActions(filtered);
      } catch {
      }

      setActions(prev => prev.map(action => {
        const actionId = action.copingActionId || action.id;
        return { ...action, helpfulnessRating: ratings[actionId] || 3 };
      }));
      // Delay triggering insights reload slightly so backend aggregations can settle
      try { setTimeout(() => { try { triggerInsightsReload?.(); } catch (e) {} }, 150); } catch (e) {}
      alert('Ratings saved');
      return true;
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to save ratings';
      alert(message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndEditToday = async () => {
    const ok = await handleSubmit();
    if (!ok) return;
    if (checkInId) {
      try {
        const fresh = await checkInAPI.getById(checkInId);
        if (fresh?.data) {
          // Jump back to Today tab with the updated check-in loaded for editing
          navigation.navigate('Tabs', {
            screen: 'Today',
            params: { editCheckIn: fresh.data },
            merge: true,
          });
          return;
        }
      } catch (e) {
      }
    
      navigation.navigate('Tabs', {
        screen: 'Today',
        params: { editCheckIn: { id: checkInId, actions, time: new Date().toISOString() } },
        merge: true,
      });
      return;
    }
    navigation.navigate('Tabs', { screen: 'Today' });
  };

  const renderedActions = useMemo(() => actions, [actions]);

  const loadCheckInActions = async () => {
    if (!checkInId) return;
    try {
      const response = await checkInAPI.getById(checkInId);
      const log = response?.data || {};
      const ids = Array.isArray(log.actionIds) ? log.actionIds : [];
      const ratingsMap = log.ratings || {};
      const allActions = Array.isArray(log.actions) ? log.actions : [];
      const filtered = ids.map(id => {
        const match = allActions.find(a => (a.copingActionId || a.id) === id) || { copingActionId: id, actionName: id };
        return {
          ...match,
          copingActionId: id,
          actionName: match.actionName || match.name || id,
          helpfulnessRating: ratingsMap[id] ?? match.helpfulnessRating ?? null,
        };
      });
      setActions(filtered);
      const initial = {};
      filtered.forEach(action => {
        const id = action.copingActionId || action.id;
        initial[id] = action.helpfulnessRating ?? ratingsMap[id] ?? 3;
      });
      setRatings(initial);
    } catch (error) {
      const initial = {};
      initialActions.forEach(action => {
        const id = action.copingActionId || action.id;
        initial[id] = action.helpfulnessRating || 3;
      });
      setRatings(initial);
    }
  };

  useEffect(() => {
    if (route.params?.actions && !checkInId) {
      const incoming = route.params.actions || [];
      setActions(incoming);
      const initial = {};
      incoming.forEach(action => {
        const id = action.copingActionId || action.id;
        initial[id] = action.helpfulnessRating || 3;
      });
      setRatings(initial);
    }
  }, [route.params?.actions, checkInId]);

  useFocusEffect(
    useCallback(() => {
      loadCheckInActions();
    }, [checkInId])
  );

  useFocusEffect(
    useCallback(() => {
      const initial = {};
      actions.forEach(action => {
        const id = action.copingActionId || action.id;
        initial[id] = action.helpfulnessRating || 3;
      });
      setRatings(initial);
    }, [actions])
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.displayName}>{user?.displayName || user?.email || 'Not set'}</Text>
        <Text style={styles.pageName}>Rate Actions</Text>
        <Text style={styles.subtitle}>Tell us how helpful each action was.</Text>
      </View>
      <Text style={styles.hint}>Select a score from 1-5 (higher means more helpful).</Text>

      {renderedActions.map(action => {
        const actionId = action.copingActionId || action.id;
        const current = ratings[actionId] || 3;
        return (
          <View key={actionId} style={styles.card}>
            <Text style={styles.actionName}>{action.actionName || action.name}</Text>
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map(value => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.ratingChip,
                    current === value && styles.ratingChipActive
                  ]}
                  onPress={() => handleRate(actionId, value)}
                >
                  <Text
                    style={[
                      styles.ratingText,
                      current === value && styles.ratingTextActive
                    ]}
                  >
                    {value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      })}

      <Button
        title="Save & Edit Today's Log"
        onPress={handleSaveAndEditToday}
        loading={loading}
        style={styles.submitButton}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 24,
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 2,
  },
  pageName: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 4,
  },
  hint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  actionName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ratingChip: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  ratingChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryLight,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  ratingTextActive: {
    color: '#FFFFFF',
  },
  submitButton: {
    marginTop: 8,
  },
});
