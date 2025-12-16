import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { insightAPI, checkInAPI } from '../services/api';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { colors } from '../styles/colors';

export const InsightsScreen = () => {
  const { user, loading: authLoading, insightsReloadCounter } = useAuth();
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [todaysCheckIn, setTodaysCheckIn] = useState(null);
  const isLoadingRef = useRef(false);
  const pendingReloadRef = useRef(false);
  const retryCounterRef = useRef(0);
  const isPermissionDenied = (error) => {
    const message = error?.response?.data?.message || error?.message || '';
    return message.toLowerCase().includes('insufficient permissions') || message.toLowerCase().includes('missing or insufficient');
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    loadInsights();
    return () => {};
  }, [authLoading, user]);

  // react to global reload counter from AuthContext
  useEffect(() => {
    if (!user || authLoading) return;
    if (typeof insightsReloadCounter === 'number') {
      if (isLoadingRef.current) {
        pendingReloadRef.current = true;
      } else {
        loadInsights();
      }
    }
  }, [insightsReloadCounter, user, authLoading]);

  useFocusEffect(
    useCallback(() => {
      if (!user || authLoading) return;
      setLoading(true);
      loadInsights();
    }, [user, authLoading])
  );

  const loadInsights = async () => {
    // prevent overlapping loads
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    let todayData = null;
    let insightsData = null;
    try {
      setLoading(true);
      try {
        const response = await insightAPI.get();
        insightsData = response?.data || { topActions: [], insights: [] };
      } catch (error) {
        if (isPermissionDenied(error)) {
          insightsData = { topActions: [], insights: [] };
        } else {
          console.error('Error loading insights:', error);
          alert('Failed to load insights');
        }
      }

      try {
        const today = format(new Date(), 'yyyy-MM-dd');
        const todayResp = await checkInAPI.getByDate(today);
        todayData = todayResp?.data || null;
      } catch (e) {
        todayData = null;
      }

      setInsights(insightsData || { topActions: [], insights: [] });
      setTodaysCheckIn(todayData);
    } catch (error) {
      // Fallback already handled in inner try/catch
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
      if (pendingReloadRef.current) {
        pendingReloadRef.current = false;
        setTimeout(() => loadInsights(), 50);
      }
      try {
        const todayActions = todayData?.actions || [];
        const hasUnrated = todayActions.some(a => {
          const id = a.copingActionId || a.id || null;
          const ratedInEntry = typeof a.helpfulnessRating === 'number';
          const ratedInMap = todayData?.ratings && id && Object.prototype.hasOwnProperty.call(todayData.ratings, id);
          return !ratedInEntry && !ratedInMap;
        });
        if (hasUnrated && retryCounterRef.current < 2) {
          retryCounterRef.current += 1;
          setTimeout(() => loadInsights(), 300);
        } else {
          retryCounterRef.current = 0;
        }
      } catch (e) {
        // ignore
      }
    }
  };

  const getAverageRating = (action) => {
    if (typeof action.averageHelpfulness === 'number') return action.averageHelpfulness;
    if (typeof action.averageRating === 'number') return action.averageRating;
    return 0;
  };

  const getTimesUsed = (action) => action.timesUsed ?? action.usageCount ?? action.count ?? 0;

  const getDisplayName = (action) => action.actionName || action.name || action.displayName || 'Action';

  const topActions = insights?.topActions || [];
  const overallAverageMap = useMemo(() => {
    const m = {};
    (topActions || []).forEach(a => {
      if (a.id) m[a.id] = a.averageRating ?? a.averageHelpfulness ?? 0;
    });
    return m;
  }, [topActions]);

  const todaysActions = useMemo(() => {
    if (!todaysCheckIn) return [];
    const normalized = Array.isArray(todaysCheckIn.actions)
      ? todaysCheckIn.actions.map(a => ({
          name: a.actionName || a.name || a.displayName || 'Action',
          id: a.copingActionId || a.id || null,
          rating: typeof a.helpfulnessRating === 'number' ? a.helpfulnessRating : null,
        }))
      : [];
    const ratingsMap = todaysCheckIn.ratings || {};
    return normalized.map(a => ({ ...a, rating: a.rating ?? (a.id && Object.prototype.hasOwnProperty.call(ratingsMap, a.id) ? ratingsMap[a.id] : null) }));
  }, [todaysCheckIn]);

  const combinedActions = useMemo(() => {
    const all = (topActions || []).map(a => ({ id: a.id || null, name: a.name || a.displayName || '', average: a.averageRating ?? a.averageHelpfulness ?? 0, timesUsed: a.timesUsed ?? a.usageCount ?? 0 }));
    const todayById = {};
    (todaysActions || []).forEach(a => { if (a.id) todayById[a.id] = a.rating; });
    return all.map(a => ({ ...a, ratingToday: Object.prototype.hasOwnProperty.call(todayById, a.id) ? todayById[a.id] : null }));
  }, [topActions, todaysActions]);
  const additionalInsights = (insights?.insights || []).filter(
    note => !note.startsWith("If you'd like")
  );
  const buildRecommendationCopy = (name, average, timesUsed) => {
    if (average >= 4.5) {
      return `${name} is a standout (${average.toFixed(1)}/5). Keep it as a first choice when you need support.`;
    }
    if (average >= 4) {
      return `${name} is working well (${average.toFixed(1)}/5). Try scheduling it more often (${timesUsed} uses so far).`;
    }
    if (average >= 3) {
      return `${name} is moderately helpful (${average.toFixed(1)}/5). Keep refining how you use it.`;
    }
    return `${name} is rated ${average.toFixed(1)}/5. Consider pairing it with another action or adjusting your approach.`;
  };

  const sortedRecommendations = useMemo(() => {
    const sorted = [...topActions].sort((a, b) => getAverageRating(b) - getAverageRating(a));
    return sorted.map((action, index) => {
      const average = getAverageRating(action);
      const timesUsed = getTimesUsed(action);
      const name = getDisplayName(action);
      const hasRating = typeof action.ratingCount === 'number' ? action.ratingCount > 0 : average > 0;
      return {
        rank: index + 1,
        name,
        average,
        timesUsed,
        hasRating,
        copy: buildRecommendationCopy(name, average, timesUsed),
      };
    });
  }, [topActions]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>{'Loading...'}</Text>
      </View>
    );
  }

  const hasTopActions = topActions.length > 0;
  const hasTodaysActions = todaysActions.length > 0;

  if (!insights && !hasTodaysActions) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>💡</Text>
        <Text style={styles.emptyTitle}>{'Not enough data'}</Text>
        <Text style={styles.emptyText}>{'Keep recording to see insights'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.displayName}>{user?.displayName || user?.email || 'Not Set'}</Text>
        <Text style={styles.pageName}>{'Insights'}</Text>
      </View>

      <View style={styles.section}>
        {todaysActions.length > 0 && (
          <View style={{ marginBottom: 18 }}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionIcon}>📝</Text>
              <Text style={styles.sectionTitle}>{"Today's actions"}</Text>
            </View>
            <Text style={styles.sectionSubtitle}>{'Actions you used today and their usefulness'}</Text>
            {todaysActions.map((a, i) => {
              const overallAvg = a.id ? (overallAverageMap[a.id] ?? 0) : 0;
              const displayScore = (typeof a.rating === 'number') ? `${a.rating.toFixed(1)}/5` : (overallAvg > 0 ? `${overallAvg.toFixed(1)}/5 (avg)` : 'N/A');
              return (
                <View key={`today-${i}`} style={styles.actionCard}>
                  <View style={styles.actionHeader}>
                    <Text style={styles.actionName}>{a.name}</Text>
                    <View style={styles.ratingBadge}><Text style={styles.ratingText}>{displayScore}</Text></View>
                  </View>
                  <Text style={styles.actionStats}>{a.rating ? 'Rated today' : 'Used today'}</Text>
                </View>
              );
            })}
          </View>
        )}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionIcon}>💡</Text>
          <Text style={styles.sectionTitle}>{'What Helps'}</Text>
        </View>
        <Text style={styles.sectionSubtitle}>
          {'Based On Your Action Ratings'}
        </Text>
        {hasTopActions ? (
          <>
            {sortedRecommendations[0] && (
              <Text style={styles.topSuggestion}>
                {`If you'd like, you can try more ${sortedRecommendations[0].name} (${sortedRecommendations[0].average.toFixed(1)}/5).`}
              </Text>
            )}

            {sortedRecommendations.map((item, index) => {
              const progressWidth = Math.max(0, Math.min(100, (item.average / 5) * 100));
              
              return (
              <View key={index} style={styles.actionCard}>
                <View style={styles.actionHeader}>
                  <Text style={styles.actionName}>{item.name}</Text>
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingText}>
                      {item.hasRating ? `${item.average.toFixed(1)}/5` : 'N/A'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.actionStats}>
                  {'Times Used'} {item.timesUsed} {'Times'}
                </Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${item.hasRating ? progressWidth : 0}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.recommendationCopy}>{item.copy}</Text>
              </View>
            );
            })}
          </>
        ) : (
          <View style={styles.insightCard}>
            <Text style={styles.insightText}>Rate today&apos;s actions to unlock personalized insights.</Text>
          </View>
        )}

        {additionalInsights.map((insight, index) => (
          <View key={`note-${index}`} style={styles.insightCard}>
            <Text style={styles.insightText}>{insight}</Text>
          </View>
        ))}
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
    marginTop: 20,
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
  section: {
    marginBottom: 32,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionIcon: {
    fontSize: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  topSuggestion: {
    fontSize: 13,
    color: colors.text,
    marginBottom: 12,
  },
  actionCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  ratingBadge: {
    backgroundColor: colors.primary,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionStats: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  recommendationCopy: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  insightCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.info,
  },
  insightText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
});
