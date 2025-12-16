import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../services/api';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { colors } from '../styles/colors';

const getMainReasons = () => [
    { id: 'stress', label: 'Manage Stress', icon: '💆'},
    { id: 'patterns', label: 'Understand Patterns', icon: '📊' },
    { id: 'coping', label: 'Build Toolbox', icon: '🧰' },
  ];

export const SettingsScreen = () => {
  const { user, logout, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [mainReason, setMainReason] = useState('');
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUserSettings();
  }, []);

  const loadUserSettings = async () => {
    try {
      const response = await userAPI.getInfo();
      const userData = response.data;
      setDisplayName(userData.displayName || '');
      setMainReason(userData.mainReason || '');
      setDailyReminderEnabled(userData.dailyReminderEnabled || false);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await userAPI.updateSettings({
        displayName,
        mainReason,
        dailyReminderEnabled,
      });

      await updateUser(response.data);
      alert('Settings Saved');
    } catch (error) {
      alert('Failed to Save Settings');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log out?',
      '',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ],
      { cancelable: true }
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.displayName}>{user?.displayName || user?.email || 'Not set'}</Text>
        <Text style={styles.pageName}>Settings</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Display Name</Text>
        <Input
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Optional"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Main Reason</Text>
        <View style={styles.reasonOptions}>
          {getMainReasons().map(reason => (
            <TouchableOpacity
              key={reason.id}
              style={[
                styles.reasonCard,
                mainReason === reason.id && styles.selectedCard,
              ]}
              onPress={() => setMainReason(reason.id)}
            >
            <Text style={styles.reasonIcon}>{reason.icon}</Text>
            <Text style={[
              styles.reasonText,
              mainReason === reason.id && styles.selectedText,
            ]}>
              {reason.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily Reminder</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Remind Me</Text>
          <Switch
            value={dailyReminderEnabled}
            onValueChange={setDailyReminderEnabled}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={dailyReminderEnabled ? colors.primary : colors.surface}
          />
        </View>
      </View>

      <Button
        title="Save Settings"
        onPress={handleSave}
        loading={loading}
        style={styles.button}
      />

      <Button
        title="Logout"
        onPress={handleLogout}
        variant="secondary"
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
  header: {
    paddingVertical: 12,
    marginBottom: 8,
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
    marginTop: 20,
  },
  pageName: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  reasonOptions: {
    flexDirection: 'column',
    gap: 8,
  },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: colors.border,
  },
  selectedCard: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  reasonIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  reasonText: {
    fontSize: 16,
    color: colors.text,
  },
  selectedText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  button: {
    marginBottom: 16,
  },
});
