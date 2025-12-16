// Firebase-based API service - maintains same interface as before
import { authService, checkInService, actionService, tagService, insightService, userService, migrationService } from './firebaseService';
import { auth } from '../config/firebase';

// Helper to get current user ID
const getCurrentUserId = () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user.uid;
};

// Auth API - maintains same interface
export const authAPI = {
  register: async (email, password) => {
    return await authService.register(email, password);
  },
  
  login: async (email, password) => {
    return await authService.login(email, password);
  },
  
  completeOnboarding: async (data) => {
    const userId = getCurrentUserId();
    return await userService.completeOnboarding(userId, data);
  },
};

// CheckIn API - maintains same interface
export const checkInAPI = {
  create: async (data) => {
    const userId = getCurrentUserId();
    return await checkInService.create(data, userId);
  },
  
  getHistory: async () => {
    const userId = getCurrentUserId();
    return await checkInService.getHistory(userId);
  },
  
  getByDate: async (date) => {
    const userId = getCurrentUserId();
    return await checkInService.getByDate(date, userId);
  },

  getById: async (checkInId) => {
    const userId = getCurrentUserId();
    return await checkInService.getById(checkInId, userId);
  },

  createOrUpdateForHour: async (data) => {
    const userId = getCurrentUserId();
    return await checkInService.createOrUpdateForHour(data, userId);
  },
  
  delete: async (id) => {
    const userId = getCurrentUserId();
    return await checkInService.delete(id, userId);
  },
  
  updateActionRating: async (actionLogId, rating, checkInId) => {
    // If checkInId is not provided, we need to find the check-in that contains this action
    const userId = getCurrentUserId();
    
    if (!checkInId) {
      // Find check-in containing this action
      const history = await checkInService.getHistory(userId);
      const checkIn = history.data.find(ci => 
        ci.actions && ci.actions.some(a => 
          a.copingActionId === actionLogId || a.id === actionLogId
        )
      );
      
      if (!checkIn) {
        throw new Error('Check-in not found for this action');
      }
      checkInId = checkIn.id;
    }
    
    return await checkInService.updateActionRating(checkInId, actionLogId, rating, userId);
  },
};

// Action API - maintains same interface
export const actionAPI = {
  getAll: async () => {
    const userId = getCurrentUserId();
    return await actionService.getAll(userId);
  },
  
  create: async (name, category) => {
    const userId = getCurrentUserId();
    return await actionService.create(name, category, userId);
  },
  
  update: async (id, name, category) => {
    const userId = getCurrentUserId();
    return await actionService.update(id, name, category, userId);
  },
  
  deactivate: async (id) => {
    const userId = getCurrentUserId();
    return await actionService.deactivate(id, userId);
  },
  // Migration helper: link legacy action name to an existing action id
  linkLegacyByName: async (legacyName, actionId) => {
    const userId = getCurrentUserId();
    return await migrationService.linkLegacyActionByName(legacyName, actionId, userId);
  },
};

// Tag API
export const tagAPI = {
  getAll: async () => {
    const userId = getCurrentUserId();
    return await tagService.getAll(userId);
  },

  create: async (name) => {
    const userId = getCurrentUserId();
    return await tagService.create(name, userId);
  },

  update: async (id, name, previousName) => {
    const userId = getCurrentUserId();
    return await tagService.update(id, name, userId, previousName);
  },

  deactivate: async (id) => {
    const userId = getCurrentUserId();
    return await tagService.deactivate(id, userId);
  },
};

// Insight API - maintains same interface
export const insightAPI = {
  get: async () => {
    const userId = getCurrentUserId();
    return await insightService.get(userId);
  },
};

// User API - maintains same interface
export const userAPI = {
  getInfo: async () => {
    const userId = getCurrentUserId();
    return await userService.getInfo(userId);
  },
  
  updateSettings: async (data) => {
    const userId = getCurrentUserId();
    return await userService.updateSettings(userId, data);
  },
};

// Migration API (exposed at top-level for convenience)
export const migrationAPI = {
  linkLegacyByName: async (legacyName, actionId) => {
    const userId = getCurrentUserId();
    return await migrationService.linkLegacyActionByName(legacyName, actionId, userId);
  }
};

// Default export for compatibility
export default {
  authAPI,
  checkInAPI,
  actionAPI,
  tagAPI,
  insightAPI,
  userAPI
};
