import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Snackbar,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  FormHelperText
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import Navigation from '../components/Navigation';
import { userService } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { NumericFormat } from 'react-number-format';

const AdminUsers = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [profile, setProfile] = useState(null);
  const [userRole, setUserRole] = useState(null);

  // Стан для діалогів
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Форма створення/редагування користувача
  const [userFormData, setUserFormData] = useState({
    id: null,
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    profile: {
      role: 'VIEWER',
      phone: '',
      position: '',
      unit: ''
    },
    password: '',
    password2: ''
  });

  // Форма зміни пароля користувача
  const [adminPasswordData, setAdminPasswordData] = useState({
    user_id: null,
    new_password: '',
    new_password2: ''
  });

  const [formErrors, setFormErrors] = useState({});

  // Визначення можливостей для кожної ролі
  const rolePermissions = {
    ADMIN: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canChangePassword: true,
      canAssignRoles: true,
      allowedRoles: ['ADMIN', 'RECRUITER', 'MEDICAL']
    },
    RECRUITER: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: false,
      canChangePassword: false,
      canAssignRoles: false,
      allowedRoles: ['MEDICAL']
    },
    MEDICAL: {
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canChangePassword: false,
      canAssignRoles: false,
      allowedRoles: []
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await userService.getProfile();
      setProfile(response.data);
      
      // Встановлюємо роль користувача
      const userRole = response.data.profile?.role;
      setUserRole(userRole);
      
      // Перевіряємо права доступу
      const permissions = rolePermissions[userRole];
      if (!permissions || !permissions.canView) {
        setError('У вас немає прав для доступу до цієї сторінки');
        navigate('/profile');
        return;
      }
      
      // Завантажуємо список користувачів, якщо є права на перегляд
      if (permissions.canView) {
        fetchAllUsers();
      }
    } catch (err) {
      console.error('Помилка завантаження профілю:', err);
      setError('Не вдалося завантажити дані профілю');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await userService.getAllUsers();
      setAllUsers(response.data);
    } catch (err) {
      console.error('Помилка завантаження користувачів:', err);
      setError('Не вдалося завантажити список користувачів');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleUserFormChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'profile.phone') {
      // Дозволяємо тільки цифри, +, (, ), пробіли та дефіс
      const cleanedValue = value.replace(/[^\d\s+()-]/g, '');
      
      // Додаємо +380 на початку, якщо його немає
      let formattedValue = cleanedValue;
      if (!formattedValue.startsWith('+380') && formattedValue.length > 0) {
        formattedValue = '+380' + formattedValue.replace('+380', '');
      }
      
      setUserFormData(prev => ({
        ...prev,
        profile: {
          ...prev.profile,
          phone: formattedValue
        }
      }));
    } else if (name.startsWith('profile.')) {
      const fieldName = name.replace('profile.', '');
      setUserFormData(prev => ({
        ...prev,
        profile: {
          ...prev.profile,
          [fieldName]: value
        }
      }));
    } else {
      setUserFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleAdminPasswordChange = (e) => {
    const { name, value } = e.target;
    setAdminPasswordData({
      ...adminPasswordData,
      [name]: value
    });
  };

  // Відкриття діалогу для створення нового користувача
  const handleAddUserClick = () => {
    setUserFormData({
      id: null,
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      profile: {
        role: 'VIEWER',
        phone: '',
        position: '',
        unit: ''
      },
      password: '',
      password2: ''
    });
    setUserDialogOpen(true);
  };

  // Відкриття діалогу для редагування користувача
  const handleEditUserClick = (user) => {
    setUserFormData({
      id: user.id,
      username: user.username,
      email: user.email || '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      profile: {
        role: user.profile?.role || 'VIEWER',
        phone: user.profile?.phone || '',
        position: user.profile?.position || '',
        unit: user.profile?.unit || ''
      },
      password: '',
      password2: ''
    });
    setUserDialogOpen(true);
  };

  // Відкриття діалогу для зміни пароля користувача
  const handleChangeUserPasswordClick = (user) => {
    setAdminPasswordData({
      user_id: user.id,
      new_password: '',
      new_password2: ''
    });
    setPasswordDialogOpen(true);
  };

  // Відкриття діалогу для підтвердження видалення користувача
  const handleDeleteUserClick = (user) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  // Створення/оновлення користувача
  const handleSaveUser = async () => {
    // Перевірка обов'язкових полів
    const requiredFields = {
      username: "Ім'я користувача",
      'profile.role': 'Роль',
      'profile.phone': 'Телефон',
      'profile.position': 'Посада',
      'profile.unit': 'Підрозділ'
    };

    const newErrors = {};
    let hasErrors = false;

    // Перевірка основних полів
    Object.entries(requiredFields).forEach(([field, label]) => {
      if (field.startsWith('profile.')) {
        const profileField = field.replace('profile.', '');
        if (!userFormData.profile[profileField]) {
          newErrors[field] = `Поле "${label}" обов'язкове`;
          hasErrors = true;
        }
      } else if (!userFormData[field]) {
        newErrors[field] = `Поле "${label}" обов'язкове`;
        hasErrors = true;
      }
    });

    // Перевірка формату телефону
    const phoneRegex = /^\+380\s?\(?\d{2}\)?\s?\d{3}\s?\d{2}\s?\d{2}$/;
    if (userFormData.profile.phone && !phoneRegex.test(userFormData.profile.phone)) {
      newErrors['profile.phone'] = 'Введіть коректний номер телефону у форматі +380 (XX) XXX XX XX';
      hasErrors = true;
    }

    // Додаткова перевірка ролі
    if (!userFormData.profile.role || !rolePermissions[userRole].allowedRoles.includes(userFormData.profile.role)) {
      newErrors['profile.role'] = 'Будь ласка, виберіть допустиму роль';
      hasErrors = true;
    }

    // Перевірка паролів для нового користувача
    if (!userFormData.id) {
      if (!userFormData.password) {
        newErrors.password = "Поле 'Пароль' обов'язкове";
        hasErrors = true;
      }
      if (!userFormData.password2) {
        newErrors.password2 = "Поле 'Підтвердження пароля' обов'язкове";
        hasErrors = true;
      }
    }

    // Перевірка співпадіння паролів
    if (userFormData.password && userFormData.password !== userFormData.password2) {
      newErrors.password = "Паролі не співпадають";
      newErrors.password2 = "Паролі не співпадають";
      hasErrors = true;
    }

    if (hasErrors) {
      setFormErrors(newErrors);
      setError('Будь ласка, заповніть всі обов\'язкові поля');
      return;
    }

    setLoading(true);
    setError('');
    setFormErrors({});

    try {
      const userData = {
        username: userFormData.username,
        email: userFormData.email || '',
        first_name: userFormData.first_name || '',
        last_name: userFormData.last_name || '',
        profile: {
          role: userFormData.profile.role,
          phone: userFormData.profile.phone || '',
          position: userFormData.profile.position || '',
          unit: userFormData.profile.unit || ''
        }
      };

      if (!userFormData.id) {
        userData.password = userFormData.password;
        userData.password2 = userFormData.password2;
        await userService.createUser(userData);
        setSuccessMessage('Користувача успішно створено');
      } else {
        await userService.updateUser(userFormData.id, userData);
        setSuccessMessage('Користувача успішно оновлено');
      }
      
      fetchAllUsers();
      setUserDialogOpen(false);
    } catch (err) {
      console.error('Помилка збереження користувача:', err);
      if (err.response?.data) {
        // Обробка помилок валідації з бекенду
        const backendErrors = err.response.data;
        const newErrors = {};
        
        // Перетворюємо помилки з бекенду у формат для полів форми
        Object.keys(backendErrors).forEach(key => {
          if (key === 'details') {
            // Обробка вкладених помилок
            Object.keys(backendErrors.details).forEach(nestedKey => {
              if (nestedKey.startsWith('profile.')) {
                newErrors[nestedKey] = Array.isArray(backendErrors.details[nestedKey]) 
                  ? backendErrors.details[nestedKey].join(', ') 
                  : backendErrors.details[nestedKey];
              } else {
                newErrors[nestedKey] = Array.isArray(backendErrors.details[nestedKey]) 
                  ? backendErrors.details[nestedKey].join(', ') 
                  : backendErrors.details[nestedKey];
              }
            });
          } else if (key.startsWith('profile.')) {
            newErrors[key] = Array.isArray(backendErrors[key]) 
              ? backendErrors[key].join(', ') 
              : backendErrors[key];
          } else {
            newErrors[key] = Array.isArray(backendErrors[key]) 
              ? backendErrors[key].join(', ') 
              : backendErrors[key];
          }
        });
        
        setFormErrors(newErrors);
        setError('Будь ласка, виправте помилки у формі');
      } else {
        setError(err.response?.data?.error || JSON.stringify(err.response?.data) || 'Не вдалося зберегти користувача');
      }
    } finally {
      setLoading(false);
    }
  };

  // Зміна пароля користувача (адміністративно)
  const handleSaveUserPassword = async () => {
    if (adminPasswordData.new_password !== adminPasswordData.new_password2) {
      setError('Паролі не співпадають');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await userService.adminChangePassword(
        adminPasswordData.user_id,
        adminPasswordData.new_password,
        adminPasswordData.new_password2
      );
      setSuccessMessage('Пароль користувача успішно змінено');
      setPasswordDialogOpen(false);
    } catch (err) {
      console.error('Помилка зміни пароля:', err);
      setError(err.response?.data?.error || 'Не вдалося змінити пароль');
    } finally {
      setLoading(false);
    }
  };

  // Видалення користувача
  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setLoading(true);
    setError('');

    try {
      await userService.deleteUser(selectedUser.id);
      setSuccessMessage('Користувача успішно видалено');
      // Оновлюємо список користувачів
      fetchAllUsers();
      setDeleteDialogOpen(false);
    } catch (err) {
      console.error('Помилка видалення користувача:', err);
      setError(err.response?.data?.error || 'Не вдалося видалити користувача');
    } finally {
      setLoading(false);
    }
  };

  // Відображення ролі користувача
  const getRoleDisplay = (role) => {
    const roleMap = {
      'ADMIN': 'Адміністратор',
      'RECRUITER': 'Рекрутер',
      'MEDICAL': 'Медичний персонал'
    };
    return roleMap[role] || role;
  };

  // Оновлюємо відображення кнопок в залежності від прав
  const renderUserActions = (user) => {
    const permissions = rolePermissions[userRole];
    if (!permissions) return null;

    return (
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
        {permissions.canEdit && (
          <IconButton 
            color="primary" 
            onClick={() => handleEditUserClick(user)}
            title="Редагувати"
          >
            <EditIcon />
          </IconButton>
        )}
        {permissions.canChangePassword && (
          <IconButton 
            color="secondary" 
            onClick={() => handleChangeUserPasswordClick(user)}
            title="Змінити пароль"
          >
            <VpnKeyIcon />
          </IconButton>
        )}
        {permissions.canDelete && (
          <IconButton 
            color="error" 
            onClick={() => handleDeleteUserClick(user)}
            title="Видалити"
            disabled={user.id === profile?.id}
          >
            <DeleteIcon />
          </IconButton>
        )}
      </Box>
    );
  };

  if (loading && !profile) {
    return (
      <>
        <Navigation />
        <Container sx={{ mt: 10, mb: 4 }}>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
            <CircularProgress />
          </Box>
        </Container>
      </>
    );
  }

  const permissions = rolePermissions[userRole];
  if (!permissions || !permissions.canView) {
    return (
      <>
        <Navigation />
        <Container sx={{ mt: 10, mb: 4 }}>
          <Alert severity="error">
            У вас немає прав для доступу до цієї сторінки
          </Alert>
        </Container>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <Container sx={{ mt: 10, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h4" gutterBottom>
            Управління користувачами
          </Typography>
          
          <Snackbar
            open={!!successMessage}
            autoHideDuration={6000}
            onClose={() => setSuccessMessage('')}
            message={successMessage}
          />
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Список користувачів</Typography>
              {permissions.canCreate && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddUserClick}
                >
                  Додати користувача
                </Button>
              )}
            </Box>
            
            {loadingUsers ? (
              <Box display="flex" justifyContent="center" my={4}>
                <CircularProgress />
              </Box>
            ) : (
              <Grid container spacing={2}>
                {allUsers.map(user => (
                  <Grid item xs={12} sm={6} md={4} key={user.id}>
                    <Card variant="outlined">
                      <CardHeader
                        title={`${user.username}`}
                        subheader={`${user.first_name} ${user.last_name}`}
                      />
                      <CardContent>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          Роль: {user.profile?.role_display || getRoleDisplay(user.profile?.role) || 'Не встановлено'}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          Пошта: {user.email || '-'}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          Підрозділ: {user.profile?.unit || '-'}
                        </Typography>
                        
                        {renderUserActions(user)}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </Paper>
      </Container>

      {/* Діалог створення/редагування користувача */}
      {permissions.canCreate && (
        <Dialog open={userDialogOpen} onClose={() => setUserDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>{userFormData.id ? 'Редагувати користувача' : 'Створити нового користувача'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Ім'я користувача"
                  name="username"
                  value={userFormData.username}
                  onChange={handleUserFormChange}
                  disabled={!!userFormData.id}
                  required
                  error={!!formErrors.username}
                  helperText={formErrors.username}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Електронна пошта"
                  name="email"
                  value={userFormData.email}
                  onChange={handleUserFormChange}
                  error={!!formErrors.email}
                  helperText={formErrors.email}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Ім'я"
                  name="first_name"
                  value={userFormData.first_name}
                  onChange={handleUserFormChange}
                  error={!!formErrors.first_name}
                  helperText={formErrors.first_name}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Прізвище"
                  name="last_name"
                  value={userFormData.last_name}
                  onChange={handleUserFormChange}
                  error={!!formErrors.last_name}
                  helperText={formErrors.last_name}
                />
              </Grid>
              {permissions.canAssignRoles && (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required error={!!formErrors['profile.role']}>
                    <InputLabel>Роль *</InputLabel>
                    <Select
                      name="profile.role"
                      value={userFormData.profile.role}
                      label="Роль *"
                      onChange={handleUserFormChange}
                    >
                      {permissions.allowedRoles.map(role => (
                        <MenuItem key={role} value={role}>
                          {getRoleDisplay(role)}
                        </MenuItem>
                      ))}
                    </Select>
                    {formErrors['profile.role'] && (
                      <FormHelperText error>{formErrors['profile.role']}</FormHelperText>
                    )}
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Посада"
                  name="profile.position"
                  value={userFormData.profile.position}
                  onChange={handleUserFormChange}
                  error={!!formErrors['profile.position']}
                  helperText={formErrors['profile.position']}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Підрозділ"
                  name="profile.unit"
                  value={userFormData.profile.unit}
                  onChange={handleUserFormChange}
                  error={!!formErrors['profile.unit']}
                  helperText={formErrors['profile.unit']}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Телефон *"
                  name="profile.phone"
                  value={userFormData.profile.phone}
                  onChange={handleUserFormChange}
                  placeholder="+380 (XX) XXX XX XX"
                  required
                  error={!!formErrors['profile.phone']}
                  helperText={formErrors['profile.phone'] || "Формат: +380 (XX) XXX XX XX"}
                />
              </Grid>
              {!userFormData.id && (
                <>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="password"
                      label="Пароль"
                      name="password"
                      value={userFormData.password}
                      onChange={handleUserFormChange}
                      required
                      error={!!formErrors.password}
                      helperText={formErrors.password}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="password"
                      label="Підтвердження пароля"
                      name="password2"
                      value={userFormData.password2}
                      onChange={handleUserFormChange}
                      required
                      error={!!formErrors.password2}
                      helperText={formErrors.password2}
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setUserDialogOpen(false)}>Скасувати</Button>
            <Button onClick={handleSaveUser} variant="contained">Зберегти</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Діалог зміни пароля користувача */}
      {permissions.canChangePassword && (
        <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)}>
          <DialogTitle>Змінити пароль користувача</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="password"
                  label="Новий пароль"
                  name="new_password"
                  value={adminPasswordData.new_password}
                  onChange={handleAdminPasswordChange}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="password"
                  label="Підтвердження пароля"
                  name="new_password2"
                  value={adminPasswordData.new_password2}
                  onChange={handleAdminPasswordChange}
                  required
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPasswordDialogOpen(false)}>Скасувати</Button>
            <Button onClick={handleSaveUserPassword} variant="contained">Зберегти</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Діалог підтвердження видалення користувача */}
      {permissions.canDelete && (
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Видалити користувача</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Ви дійсно бажаєте видалити користувача {selectedUser?.username}? Ця дія не може бути скасована.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Скасувати</Button>
            <Button onClick={handleDeleteUser} color="error" variant="contained">Видалити</Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
};

export default AdminUsers; 