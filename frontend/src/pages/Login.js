import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Paper, 
  TextField, 
  Button, 
  Typography, 
  Box, 
  Alert,
  CircularProgress
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { authService } from '../utils/api';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [csrfReady, setCsrfReady] = useState(false);
  const navigate = useNavigate();
  
  // При завантаженні сторінки отримуємо CSRF токен
  useEffect(() => {
    const getCSRFToken = async () => {
      try {
        setLoading(true);
        const baseURL = 'http://localhost:8000';
        // Робимо запит до ендпоінта, який встановлює CSRF cookie
        await axios.get(`${baseURL}/api/auth/`, { withCredentials: true });
        setCsrfReady(true);
      } catch (err) {
        console.error('Помилка отримання CSRF токену:', err);
        setError('Не вдалося з\'єднатися з сервером. Спробуйте пізніше.');
      } finally {
        setLoading(false);
      }
    };
    
    getCSRFToken();
  }, []);
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // Використовуємо authService з нашого API утіліти для логіну
      const response = await authService.login(username, password);
      
      if (response.success) {
        // Зберігаємо інформацію про статус адміністратора
        localStorage.setItem('isAdmin', response.is_admin.toString());
        navigate('/map');
      } else {
        setError(response.message || 'Помилка входу');
      }
    } catch (err) {
      console.error('Помилка логінації:', err);
      setError('Неправильне ім\'я користувача або пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box 
        sx={{ 
          mt: 8, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center' 
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography component="h1" variant="h5" align="center" sx={{ mb: 3 }}>
            Бойовий Медичний Дашборд
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}
          
          <Box component="form" onSubmit={handleLogin} noValidate>
            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              label="Ім'я користувача"
              name="username"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading || !csrfReady}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Пароль"
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || !csrfReady}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading || !csrfReady}
            >
              Увійти
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login; 