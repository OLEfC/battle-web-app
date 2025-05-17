import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

// Функція для отримання CSRF токену з cookies
const getCSRFToken = () => {
  const csrfCookie = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrftoken='));
  
  return csrfCookie ? csrfCookie.split('=')[1] : '';
};

// Функція для отримання CSRF токену з сервера
const fetchCSRFToken = async () => {
  try {
    // Запит до endpoint, який встановлює CSRF cookie
    await axios.get(`${API_BASE_URL}/api/auth/`, {
      withCredentials: true
    });
    return getCSRFToken();
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    return '';
  }
};

// Створюємо екземпляр axios з налаштуваннями за замовчуванням
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Додаємо інтерцептор для додавання CSRF токена до запитів
api.interceptors.request.use(
  async (config) => {
    // Додаємо CSRF токен тільки для методів, які змінюють стан (POST, PUT, DELETE)
    // Але не для шляху /api/auth/login/, який працює без CSRF
    if (['post', 'put', 'delete', 'patch'].includes(config.method) && 
        !config.url.includes('/api/auth/login/')) {
      // Отримуємо токен з cookies
      let csrfToken = getCSRFToken();
      
      // Якщо токен не знайдено, спробуємо отримати його з сервера
      if (!csrfToken) {
        csrfToken = await fetchCSRFToken();
      }
      
      config.headers['X-CSRFToken'] = csrfToken;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Інтерцептор для обробки відповідей
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Якщо помилка авторизації (401), перенаправляємо на сторінку логінації
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('isAuthenticated');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Функції для роботи з аутентифікацією
const authService = {
  // Отримання CSRF токену та перевірка сесії
  checkAuth: async () => {
    try {
      // Явно отримуємо CSRF токен перед перевіркою аутентифікації
      await fetchCSRFToken();
      // Робимо запит до профілю для перевірки сесії
      await api.get('/api/profile/');
      return true;
    } catch (error) {
      return false;
    }
  },
  
  login: async (username, password) => {
    try {
      const response = await api.post('/api/auth/login/', { username, password });
      
      if (response.data.success) {
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('username', response.data.username);
        
        // Встановлюємо статус адміністратора в localStorage
        const isAdmin = response.data.is_admin === true;
        localStorage.setItem('isAdmin', isAdmin.toString());
      }
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  logout: async () => {
    try {
      await api.post('/api/auth/logout/');
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('username');
      localStorage.removeItem('isAdmin');
    } catch (error) {
      throw error;
    }
  },
  
  getUserProfile: async () => {
    return api.get('/api/profile/');
  }
};

// Функції для роботи з солдатами
const soldierService = {
  getAllSoldiers: async () => {
    return api.get('/api/soldiers/');
  },
  
  getPrioritizedSoldiers: async (timestamp = null) => {
    let url = '/api/soldiers/prioritized/';
    // Додаємо timestamp для уникнення кешування
    if (timestamp) {
      url += `?t=${timestamp}`;
    }
    return api.get(url);
  },
  
  getSoldiersByUnit: async (unit) => {
    return api.get(`/api/soldiers/search/?unit=${unit}`);
  },
  
  getSoldierById: async (id) => {
    // Додаємо timestamp для уникнення кешування
    const timestamp = new Date().getTime();
    return api.get(`/api/soldiers/${id}/?t=${timestamp}`);
  },
  
  getSoldierMedicalHistory: async (id, days = null) => {
    let url = `/api/soldiers/${id}/medical_history/`;
    const timestamp = new Date().getTime();
    const params = [];
    
    if (days) {
      params.push(`days=${days}`);
    }
    
    // Додаємо timestamp для уникнення кешування
    params.push(`t=${timestamp}`);
    
    if (params.length > 0) {
      url += '?' + params.join('&');
    }
    
    return api.get(url);
  },
  
  createSoldier: async (soldierData) => {
    return api.post('/api/soldiers/', soldierData);
  },
  
  getNearbySoldiers: async (latitude, longitude, radius = 0.5) => {
    return api.get(`/api/soldiers/nearby/?lat=${latitude}&lon=${longitude}&radius=${radius}`);
  },
  
  getCriticalVitalsSoldiers: async () => {
    return api.get('/api/soldiers/critical_vitals/');
  },
  
  startEvacuation: async (soldierId) => {
    return api.post(`/api/soldiers/${soldierId}/start_evacuation/`);
  },
  
  completeEvacuation: async (soldierId) => {
    return api.post(`/api/soldiers/${soldierId}/complete_evacuation/`);
  },
  
  cancelEvacuation: async (soldierId) => {
    return api.post(`/api/soldiers/${soldierId}/cancel_evacuation/`);
  },
  
  // Видалення військового
  deleteSoldier: async (devEui) => {
    try {
      const response = await api.delete(`/api/soldiers/${devEui}/`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

// Функції для роботи з евакуаціями
const evacuationService = {
  getAllEvacuations: async () => {
    return api.get('/api/evacuations/');
  },
  
  getNeedsEvacuationSoldiers: async () => {
    return api.get('/api/evacuations/needs_evacuation/');
  },
  
  getEvacuationById: async (id) => {
    return api.get(`/api/evacuations/${id}/`);
  },
  
  startEvacuation: async (evacuationId, teamInfo) => {
    return api.post(`/api/evacuations/${evacuationId}/start_evacuation/`, teamInfo);
  },
  
  completeEvacuation: async (evacuationId) => {
    return api.post(`/api/evacuations/${evacuationId}/complete_evacuation/`);
  },
  
  getNearSoldiers: async (evacuationId, radius = 0.5) => {
    return api.get(`/api/evacuations/${evacuationId}/near_soldiers/?radius=${radius}`);
  }
};

// Функції для роботи з медичними даними
const medicalDataService = {
  getAllMedicalData: async () => {
    return api.get('/api/medical-data/');
  },
  
  getSoldierMedicalData: async (soldierId) => {
    return api.get(`/api/medical-data/?device=${soldierId}`);
  },
  
  getMedicalDataByIssueType: async (issueType) => {
    return api.get(`/api/medical-data/?issue_type=${issueType}`);
  },
  
  getRecentMedicalData: async (days = 7) => {
    return api.get(`/api/medical-data/?days=${days}`);
  }
};

// Функції для роботи з сповіщеннями
const alertService = {
  getAllAlerts: async () => {
    return api.get('/api/alerts/');
  },
  
  getUnreadAlerts: async () => {
    return api.get('/api/alerts/unread/');
  },
  
  markAlertAsRead: async (alertId) => {
    return api.post(`/api/alerts/${alertId}/mark_as_read/`);
  },
  
  markAllAlertsAsRead: async () => {
    return api.post('/api/alerts/mark_all_as_read/');
  }
};

// Додаємо новий функціонал для роботи з користувачами
const userService = {
  // Отримати дані власного профілю
  getProfile: async () => {
    return api.get('/api/profile/');
  },
  
  // Оновити дані власного профілю
  updateProfile: async (profileData) => {
    return api.put('/api/profile/', profileData);
  },
  
  // Зміна власного пароля
  changePassword: async (oldPassword, newPassword, newPassword2) => {
    return api.post('/api/profile/', {
      old_password: oldPassword,
      new_password: newPassword,
      new_password2: newPassword2
    });
  },
  
  // Отримати список всіх користувачів (тільки для адміністраторів)
  getAllUsers: async () => {
    return api.get('/api/users/');
  },
  
  // Створити нового користувача (тільки для адміністраторів)
  createUser: async (userData) => {
    console.log(userData);
    return api.post('/api/users/', userData);
  },
  
  // Отримати дані користувача за ID (тільки для адміністраторів)
  getUserById: async (userId) => {
    return api.get(`/api/users/${userId}/`);
  },
  
  // Оновити дані користувача (тільки для адміністраторів)
  updateUser: async (userId, userData) => {
    return api.put(`/api/users/${userId}/`, userData);
  },
  
  // Видалити користувача (тільки для адміністраторів)
  deleteUser: async (userId) => {
    return api.delete(`/api/users/${userId}/`);
  },
  
  // Адміністративна зміна пароля користувача (тільки для адміністраторів)
  adminChangePassword: async (userId, newPassword, newPassword2) => {
    return api.post(`/api/users/${userId}/change-password/`, {
      new_password: newPassword,
      new_password2: newPassword2
    });
  }
};

export {
  api,
  authService,
  soldierService,
  evacuationService,
  medicalDataService,
  alertService,
  userService
}; 