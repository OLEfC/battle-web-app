import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box, IconButton } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import MapIcon from '@mui/icons-material/Map';
import PeopleIcon from '@mui/icons-material/People';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';

import { authService } from '../utils/api';

const Navigation = ({ toggleDrawer }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  
  const handleLogout = async () => {
    try {
      await authService.logout();
      navigate('/login');
    } catch (err) {
      console.error('Помилка виходу:', err);
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('username');
      localStorage.removeItem('isAdmin');
      navigate('/login');
    }
  };

  return (
    <AppBar position="fixed">
      <Toolbar>
        {toggleDrawer && (
          <IconButton
            color="inherit"
            edge="start"
            onClick={toggleDrawer}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
        )}
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Бойовий Медичний Дашборд
        </Typography>
        
        <Box sx={{ mr: 2 }}>
          <Button 
            color="inherit" 
            startIcon={<MapIcon />}
            onClick={() => navigate('/map')}
            sx={{ 
              mr: 1,
              bgcolor: location.pathname === '/map' ? 'rgba(255,255,255,0.2)' : 'transparent',
            }}
          >
            Карта
          </Button>
          <Button 
            color="inherit" 
            startIcon={<PeopleIcon />}
            onClick={() => navigate('/soldiers')}
            sx={{ 
              mr: 1,
              bgcolor: location.pathname === '/soldiers' ? 'rgba(255,255,255,0.2)' : 'transparent',
            }}
          >
            Військові
          </Button>
          <Button 
            color="inherit" 
            startIcon={<AccountCircleIcon />}
            onClick={() => navigate('/profile')}
            sx={{ 
              mr: 1,
              bgcolor: location.pathname === '/profile' ? 'rgba(255,255,255,0.2)' : 'transparent',
            }}
          >
            Профіль
          </Button>
          {isAdmin && (
            <Button 
              color="inherit" 
              startIcon={<AdminPanelSettingsIcon />}
              onClick={() => navigate('/admin/users')}
              sx={{ 
                mr: 1,
                bgcolor: location.pathname === '/admin/users' ? 'rgba(255,255,255,0.2)' : 'transparent',
              }}
            >
              Адміністрування
            </Button>
          )}
        </Box>
        
        <Button color="inherit" onClick={handleLogout} startIcon={<LogoutIcon />}>
          Вихід
        </Button>
      </Toolbar>
    </AppBar>
  );
};

export default Navigation; 