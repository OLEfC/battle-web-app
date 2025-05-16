import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  Snackbar,
  Tabs,
  Tab,
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
  IconButton
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import Navigation from '../components/Navigation';
import { userService } from '../utils/api';

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Форма редагування власного профілю
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    profile: {
      phone: '',
      position: '',
      unit: ''
    }
  });

  // Форма зміни пароля
  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    new_password2: ''
  });

  // Стан для діалогів
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Форма створення/редагування користувача (для адміністраторів)
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

  // Форма зміни пароля користувача (для адміністраторів)
  const [adminPasswordData, setAdminPasswordData] = useState({
    user_id: null,
    new_password: '',
    new_password2: ''
  });

  // Завантаження профілю
  useEffect(() => {
    fetchProfile();
  }, []);

  // Встановлюємо дані форми при завантаженні профілю
  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        email: profile.email || '',
        profile: {
          phone: profile.profile?.phone || '',
          position: profile.profile?.position || '',
          unit: profile.profile?.unit || ''
        }
      });

      // Перевіряємо, чи користувач адміністратор
      const adminGroup = profile.groups.find(group => group.name === 'admin' || profile.is_superuser);
      setIsAdmin(!!adminGroup || profile.is_superuser);

      // Якщо користувач адміністратор, завантажуємо список всіх користувачів
      if (adminGroup || profile.is_superuser) {
        fetchAllUsers();
      }
    }
  }, [profile]);

  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await userService.getProfile();
      setProfile(response.data);
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
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('profile.')) {
      const fieldName = name.replace('profile.', '');
      setFormData({
        ...formData,
        profile: {
          ...formData.profile,
          [fieldName]: value
        }
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData({
      ...passwordData,
      [name]: value
    });
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleUpdateProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await userService.updateProfile(formData);
      setProfile(response.data);
      setSuccessMessage('Профіль успішно оновлено');
      setEditMode(false);
    } catch (err) {
      console.error('Помилка оновлення профілю:', err);
      setError('Не вдалося оновити профіль');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (passwordData.new_password !== passwordData.new_password2) {
      setError('Паролі не співпадають');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await userService.changePassword(
        passwordData.old_password,
        passwordData.new_password,
        passwordData.new_password2
      );
      setSuccessMessage('Пароль успішно змінено');
      setPasswordData({
        old_password: '',
        new_password: '',
        new_password2: ''
      });
    } catch (err) {
      console.error('Помилка зміни пароля:', err);
      setError(err.response?.data?.error || 'Не вдалося змінити пароль');
    } finally {
      setLoading(false);
    }
  };

  // Функції для адміністративного інтерфейсу
  const handleUserFormChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('profile.')) {
      const fieldName = name.replace('profile.', '');
      setUserFormData({
        ...userFormData,
        profile: {
          ...userFormData.profile,
          [fieldName]: value
        }
      });
    } else {
      setUserFormData({
        ...userFormData,
        [name]: value
      });
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
    if (userFormData.password && userFormData.password !== userFormData.password2) {
      setError('Паролі не співпадають');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (userFormData.id) {
        // Оновлення існуючого користувача
        const userData = { ...userFormData };
        delete userData.password;
        delete userData.password2;
        
        await userService.updateUser(userFormData.id, userData);
        setSuccessMessage('Користувача успішно оновлено');
      } else {
        // Створення нового користувача
        await userService.createUser(userFormData);
        setSuccessMessage('Користувача успішно створено');
      }
      
      // Оновлюємо список користувачів
      fetchAllUsers();
      setUserDialogOpen(false);
    } catch (err) {
      console.error('Помилка збереження користувача:', err);
      setError(err.response?.data?.error || 'Не вдалося зберегти користувача');
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
    const roles = {
      'ADMIN': 'Адміністратор',
      'MEDICAL': 'Медичний персонал',
      'EVACUATION': 'Евакуаційна команда',
      'ANALYST': 'Аналітик',
      'VIEWER': 'Спостерігач'
    };
    return roles[role] || role;
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

  return (
    <>
      <Navigation />
      <Container sx={{ mt: 10, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h4" gutterBottom>
            Профіль користувача
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

          <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 2 }}>
            <Tab label="Мій профіль" />
            {isAdmin && <Tab label="Керування користувачами" />}
          </Tabs>

          {tabValue === 0 && (
            <Box>
              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardHeader title="Особисті дані" />
                <CardContent>
                  {!editMode ? (
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle1">Ім'я користувача:</Typography>
                        <Typography variant="body1">{profile?.username}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle1">Електронна пошта:</Typography>
                        <Typography variant="body1">{profile?.email || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle1">Ім'я:</Typography>
                        <Typography variant="body1">{profile?.first_name || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle1">Прізвище:</Typography>
                        <Typography variant="body1">{profile?.last_name || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle1">Посада:</Typography>
                        <Typography variant="body1">{profile?.profile?.position || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle1">Підрозділ:</Typography>
                        <Typography variant="body1">{profile?.profile?.unit || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle1">Телефон:</Typography>
                        <Typography variant="body1">{profile?.profile?.phone || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle1">Роль:</Typography>
                        <Typography variant="body1">
                          {profile?.profile?.role_display || getRoleDisplay(profile?.profile?.role) || '-'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sx={{ mt: 2 }}>
                        <Button 
                          variant="contained" 
                          onClick={() => setEditMode(true)}
                          startIcon={<EditIcon />}
                        >
                          Редагувати профіль
                        </Button>
                      </Grid>
                    </Grid>
                  ) : (
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Ім'я"
                          name="first_name"
                          value={formData.first_name}
                          onChange={handleInputChange}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Прізвище"
                          name="last_name"
                          value={formData.last_name}
                          onChange={handleInputChange}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Електронна пошта"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Посада"
                          name="profile.position"
                          value={formData.profile.position}
                          onChange={handleInputChange}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Підрозділ"
                          name="profile.unit"
                          value={formData.profile.unit}
                          onChange={handleInputChange}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Телефон"
                          name="profile.phone"
                          value={formData.profile.phone}
                          onChange={handleInputChange}
                        />
                      </Grid>
                      <Grid item xs={12} sx={{ mt: 2 }}>
                        <Button 
                          variant="contained" 
                          onClick={handleUpdateProfile}
                          disabled={loading}
                          sx={{ mr: 1 }}
                        >
                          Зберегти
                        </Button>
                        <Button 
                          variant="outlined" 
                          onClick={() => setEditMode(false)}
                          disabled={loading}
                        >
                          Скасувати
                        </Button>
                      </Grid>
                    </Grid>
                  )}
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardHeader title="Зміна пароля" />
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        type="password"
                        label="Поточний пароль"
                        name="old_password"
                        value={passwordData.old_password}
                        onChange={handlePasswordChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="password"
                        label="Новий пароль"
                        name="new_password"
                        value={passwordData.new_password}
                        onChange={handlePasswordChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="password"
                        label="Повторіть новий пароль"
                        name="new_password2"
                        value={passwordData.new_password2}
                        onChange={handlePasswordChange}
                      />
                    </Grid>
                    <Grid item xs={12} sx={{ mt: 2 }}>
                      <Button
                        variant="contained"
                        onClick={handleUpdatePassword}
                        disabled={loading || !passwordData.old_password || !passwordData.new_password || !passwordData.new_password2}
                        startIcon={<VpnKeyIcon />}
                      >
                        Змінити пароль
                      </Button>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Box>
          )}

          {tabValue === 1 && isAdmin && (
            <Box>
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Управління користувачами</Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddUserClick}
                >
                  Додати користувача
                </Button>
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
                          
                          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                            <IconButton 
                              color="primary" 
                              onClick={() => handleEditUserClick(user)}
                              title="Редагувати"
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton 
                              color="secondary" 
                              onClick={() => handleChangeUserPasswordClick(user)}
                              title="Змінити пароль"
                            >
                              <VpnKeyIcon />
                            </IconButton>
                            <IconButton 
                              color="error" 
                              onClick={() => handleDeleteUserClick(user)}
                              title="Видалити"
                              disabled={user.id === profile?.id}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}
        </Paper>
      </Container>

      {/* Діалог створення/редагування користувача */}
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
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Електронна пошта"
                name="email"
                value={userFormData.email}
                onChange={handleUserFormChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Ім'я"
                name="first_name"
                value={userFormData.first_name}
                onChange={handleUserFormChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Прізвище"
                name="last_name"
                value={userFormData.last_name}
                onChange={handleUserFormChange}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Роль</InputLabel>
                <Select
                  name="profile.role"
                  value={userFormData.profile.role}
                  label="Роль"
                  onChange={handleUserFormChange}
                >
                  <MenuItem value="ADMIN">Адміністратор</MenuItem>
                  <MenuItem value="MEDICAL">Медичний персонал</MenuItem>
                  <MenuItem value="EVACUATION">Евакуаційна команда</MenuItem>
                  <MenuItem value="ANALYST">Аналітик</MenuItem>
                  <MenuItem value="VIEWER">Спостерігач</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Посада"
                name="profile.position"
                value={userFormData.profile.position}
                onChange={handleUserFormChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Підрозділ"
                name="profile.unit"
                value={userFormData.profile.unit}
                onChange={handleUserFormChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Телефон"
                name="profile.phone"
                value={userFormData.profile.phone}
                onChange={handleUserFormChange}
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
                    required={!userFormData.id}
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
                    required={!userFormData.id}
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

      {/* Діалог зміни пароля користувача */}
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
          <Button onClick={handleSaveUserPassword} variant="contained">Змінити пароль</Button>
        </DialogActions>
      </Dialog>

      {/* Діалог підтвердження видалення користувача */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Видалення користувача</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Ви дійсно хочете видалити користувача "{selectedUser?.username}"? Ця дія не може бути скасована.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Скасувати</Button>
          <Button onClick={handleDeleteUser} color="error" variant="contained">Видалити</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Profile; 