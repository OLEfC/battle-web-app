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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle
} from '@mui/material';
import Navigation from '../components/Navigation';
import { userService } from '../utils/api';

const Profile = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [profile, setProfile] = useState(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Форма редагування профілю
  const [profileFormData, setProfileFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
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

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await userService.getProfile();
      setProfile(response.data);
      setProfileFormData({
        email: response.data.email || '',
        first_name: response.data.first_name || '',
        last_name: response.data.last_name || '',
        profile: {
          phone: response.data.profile?.phone || '',
          position: response.data.profile?.position || '',
          unit: response.data.profile?.unit || ''
        }
      });
    } catch (err) {
      console.error('Помилка завантаження профілю:', err);
      setError('Не вдалося завантажити дані профілю');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileFormChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('profile.')) {
      const fieldName = name.replace('profile.', '');
      setProfileFormData({
        ...profileFormData,
        profile: {
          ...profileFormData.profile,
          [fieldName]: value
        }
      });
    } else {
      setProfileFormData({
        ...profileFormData,
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

  const handleSaveProfile = async () => {
    setLoading(true);
    setError('');
    setFormErrors({});

    try {
      await userService.updateProfile(profileFormData);
      setSuccessMessage('Профіль успішно оновлено');
      fetchProfile();
    } catch (err) {
      console.error('Помилка оновлення профілю:', err);
      if (err.response?.data) {
        const backendErrors = err.response.data;
        const newErrors = {};
        
        Object.keys(backendErrors).forEach(key => {
          if (key.startsWith('profile.')) {
            newErrors[key] = backendErrors[key];
          } else {
            newErrors[key] = Array.isArray(backendErrors[key]) 
              ? backendErrors[key][0] 
              : backendErrors[key];
          }
        });
        
        setFormErrors(newErrors);
      } else {
        setError(err.response?.data?.error || 'Не вдалося оновити профіль');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSavePassword = async () => {
    if (passwordData.new_password !== passwordData.new_password2) {
      setError('Паролі не співпадають');
      return;
    }

    if (!passwordData.old_password) {
      setError('Введіть поточний пароль');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Перевіряємо, чи користувач вводить свій поточний пароль
      await userService.changePassword(
        passwordData.old_password,
        passwordData.new_password,
        passwordData.new_password2
      );
      setSuccessMessage('Пароль успішно змінено');
      setPasswordDialogOpen(false);
      setPasswordData({
        old_password: '',
        new_password: '',
        new_password2: ''
      });
    } catch (err) {
      console.error('Помилка зміни пароля:', err);
      if (err.response?.status === 400) {
        setError('Невірний поточний пароль');
      } else {
        setError(err.response?.data?.error || 'Не вдалося змінити пароль');
      }
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
            Мій профіль
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

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Особиста інформація
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Ім'я користувача"
                    value={profile?.username}
                    disabled
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Електронна пошта"
                    name="email"
                    value={profileFormData.email}
                    onChange={handleProfileFormChange}
                    error={!!formErrors.email}
                    helperText={formErrors.email}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Ім'я"
                    name="first_name"
                    value={profileFormData.first_name}
                    onChange={handleProfileFormChange}
                    error={!!formErrors.first_name}
                    helperText={formErrors.first_name}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Прізвище"
                    name="last_name"
                    value={profileFormData.last_name}
                    onChange={handleProfileFormChange}
                    error={!!formErrors.last_name}
                    helperText={formErrors.last_name}
                  />
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Додаткова інформація
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Роль"
                    value={getRoleDisplay(profile?.profile?.role)}
                    disabled
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Посада"
                    name="profile.position"
                    value={profileFormData.profile.position}
                    onChange={handleProfileFormChange}
                    error={!!formErrors['profile.position']}
                    helperText={formErrors['profile.position']}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Підрозділ"
                    name="profile.unit"
                    value={profileFormData.profile.unit}
                    onChange={handleProfileFormChange}
                    error={!!formErrors['profile.unit']}
                    helperText={formErrors['profile.unit']}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Телефон"
                    name="profile.phone"
                    value={profileFormData.profile.phone}
                    onChange={handleProfileFormChange}
                    error={!!formErrors['profile.phone']}
                    helperText={formErrors['profile.phone']}
                  />
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleSaveProfile}
                  disabled={loading}
                >
                  {loading ? <CircularProgress size={24} /> : 'Зберегти зміни'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setPasswordDialogOpen(true)}
                >
                  Змінити пароль
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Container>

      {/* Діалог зміни пароля */}
      <Dialog open={passwordDialogOpen} onClose={() => {
        setPasswordDialogOpen(false);
        setPasswordData({
          old_password: '',
          new_password: '',
          new_password2: ''
        });
        setError('');
      }}>
        <DialogTitle>Змінити пароль</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="password"
                label="Поточний пароль"
                name="old_password"
                value={passwordData.old_password}
                onChange={handlePasswordChange}
                required
                error={!!error && error.includes('поточний пароль')}
                helperText={error && error.includes('поточний пароль') ? error : ''}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="password"
                label="Новий пароль"
                name="new_password"
                value={passwordData.new_password}
                onChange={handlePasswordChange}
                required
                error={!!error && error.includes('співпадають')}
                helperText={error && error.includes('співпадають') ? error : ''}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="password"
                label="Підтвердження пароля"
                name="new_password2"
                value={passwordData.new_password2}
                onChange={handlePasswordChange}
                required
                error={!!error && error.includes('співпадають')}
                helperText={error && error.includes('співпадають') ? error : ''}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setPasswordDialogOpen(false);
            setPasswordData({
              old_password: '',
              new_password: '',
              new_password2: ''
            });
            setError('');
          }}>Скасувати</Button>
          <Button 
            onClick={handleSavePassword} 
            variant="contained"
            disabled={loading || !passwordData.old_password || !passwordData.new_password || !passwordData.new_password2}
          >
            {loading ? <CircularProgress size={24} /> : 'Зберегти'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Profile; 