import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { format } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import { checkInAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { colors } from '../styles/colors';

export const HistoryScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [checkIns, setCheckIns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const loadHistory = async () => {
    try {
      const response = await checkInAPI.getHistory();
      setCheckIns(response.data);
    } catch (error) {
      alert('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const getMoodEmoji = (mood) => {
    const emojis = ['😢', '😕', '😐', '🙂', '😊'];
    return emojis[mood - 1] || '😐';
  };

  const handleDelete = async (checkInId) => {
    Alert.alert(
      'Confirm',
      'Are you sure you want to delete this check-in?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            try {
              await checkInAPI.delete(checkInId);
              setCheckIns(prev => prev.filter(c => c.id !== checkInId));
            } catch (error) {
              alert('Failed to delete check-in');
            }
          }
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (checkIns.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyTitle}>No records yet</Text>
        <Text style={styles.emptyText}>Start recording</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.displayName}>{user?.displayName || user?.email || 'Not set'}</Text>
        <Text style={styles.pageName}>History</Text>
      </View>

          {checkIns.map((checkIn) => (
        <View key={checkIn.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardDate}>
                {format(new Date(checkIn.date), 'MMM dd, EEEE')}
              </Text>
              <Text style={styles.cardTime}>
                {checkIn.time ? format(new Date(checkIn.time), 'HH:mm') : 'Not set'}
              </Text>
              <View style={styles.metricsRow}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Mood</Text>
                  <Text style={styles.metricValue}>{checkIn.mood}</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Energy</Text>
                  <Text style={styles.metricValue}>{checkIn.energy}</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Stress</Text>
                  <Text style={styles.metricValue}>{checkIn.stress}</Text>
                </View>
              </View>
            </View>
            <Text style={styles.moodEmoji}>{getMoodEmoji(checkIn.mood)}</Text>
          </View>

          {checkIn.tags && checkIn.tags.length > 0 && (
            <View style={styles.tagsRow}>
              <Text style={styles.tagsLabel}>Tags</Text>
              {checkIn.tags.map((tag, index) => (
                <Text key={index} style={styles.tag}>{tag}</Text>
              ))}
            </View>
          )}

          {checkIn.actions && checkIn.actions.length > 0 && (
            <View style={styles.actionsRow}>
              <Text style={styles.actionsLabel}>Used</Text>
              {checkIn.actions.map((action, index) => (
                <Text key={index} style={styles.actionName}>{action.actionName}</Text>
              ))}
            </View>
          )}
          <View style={styles.cardToolbar}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                handleDelete(checkIn.id);
              }}
              style={styles.deleteButton}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  header: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 2,
    marginTop: 20,
  },
  pageName: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardDate: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  cardTime: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  metric: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  moodEmoji: {
    fontSize: 32,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  tagsLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  tag: {
    fontSize: 12,
    color: colors.secondary,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  actionsLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  actionName: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  cardToolbar: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    gap: 12,
  },
  editButton: {
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  editText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '700',
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  deleteText: {
    fontSize: 14,
    color: colors.error,
    fontWeight: '600',
  },
});
