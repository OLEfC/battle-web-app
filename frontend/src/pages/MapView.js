import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Paper, 
  Typography, 
  Drawer, 
  List, 
  ListItem, 
  ListItemText, 
  Divider, 
  IconButton, 
  AppBar, 
  Toolbar, 
  Button, 
  Chip,
  CircularProgress 
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Імпорт сервісів API
import { authService, soldierService } from '../utils/api';

// Виправлення іконок Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Створення іконок для різних станів
const criticalIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

const warningIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

const evacuationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

const MapView = () => {
  const [soldiers, setSoldiers] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSoldier, setSelectedSoldier] = useState(null);
  const navigate = useNavigate();

  // Виносимо fetchSoldiers у useCallback, щоб правильно використовувати у useEffect
  const fetchSoldiers = useCallback(async () => {
    try {
      // Отримуємо дані з пріоритезованого API
      const response = await soldierService.getPrioritizedSoldiers();
      
      // Перевіряємо, чи отримали масив даних
      if (Array.isArray(response.data)) {
        // Фільтруємо відповідь, щоб відображати тільки записи з географічними даними
        const validSoldiers = response.data.filter(
          soldier => soldier.latest_data && 
                    soldier.latest_data.latitude && 
                    soldier.latest_data.longitude
        );
        
        setSoldiers(validSoldiers);
      } else {
        console.error('Unexpected API response format:', response.data);
        setError('Отримано неправильний формат даних з API');
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Помилка отримання даних:', err);
      setError('Помилка завантаження даних');
      setLoading(false);
      
      // Якщо помилка авторизації - перенаправляємо на сторінку логіну
      if (err.response && err.response.status === 401) {
        localStorage.removeItem('isAuthenticated');
        navigate('/login');
      }
    }
  }, [navigate]);

  useEffect(() => {
    // Перевіряємо авторизацію
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    // Первірка сесії на сервері
    const checkAuthAndLoadData = async () => {
      try {
        // Перевіряємо аутентифікацію та отримуємо CSRF токен
        const isAuth = await authService.checkAuth();
        if (!isAuth) {
          localStorage.removeItem('isAuthenticated');
          navigate('/login');
          return;
        }
        
        // Завантаження даних про поранених
        await fetchSoldiers();
      } catch (err) {
        console.error('Помилка авторизації:', err);
        localStorage.removeItem('isAuthenticated');
        navigate('/login');
      }
    };
    
    checkAuthAndLoadData();
    
    // Оновлення даних кожні 30 секунд
    const interval = setInterval(fetchSoldiers, 30000);
    
    return () => clearInterval(interval);
  }, [navigate, fetchSoldiers]); // Додаємо fetchSoldiers як залежність
  
  const handleLogout = async () => {
    try {
      await authService.logout();
      navigate('/login');
    } catch (err) {
      console.error('Помилка виходу:', err);
      // Навіть якщо є помилка, все одно виходимо
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('username');
      navigate('/login');
    }
  };
  
  const getMarkerIcon = (soldier) => {
    if (!soldier.latest_data) return DefaultIcon;
    
    // Якщо солдат у процесі евакуації
    if (soldier.evacuation && soldier.evacuation.status === 'IN_PROGRESS') {
      return evacuationIcon;
    }
    
    // Визначаємо тип іконки за типом проблеми або пріоритетом
    if (soldier.priority === 1 || soldier.latest_data.issue_type === 'BOTH') {
      return criticalIcon;
    } else if (soldier.priority === 2 || soldier.latest_data.issue_type === 'SPO2' || soldier.latest_data.issue_type === 'HR') {
      return warningIcon;
    } else {
      return DefaultIcon;
    }
  };
  
  const getStatusChip = (issue_type) => {
    switch (issue_type) {
      case 'BOTH':
        return <Chip label="Критичний стан" color="error" size="small" />;
      case 'SPO2':
        return <Chip label="Критичний SpO2" color="error" size="small" />;
      case 'HR':
        return <Chip label="Критичний пульс" color="warning" size="small" />;
      case 'SENSOR_ERROR':
        return <Chip label="Помилка датчиків" color="default" size="small" />;
      default:
        return <Chip label="Нормальний стан" color="success" size="small" />;
    }
  };
  
  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };
  
  const selectSoldier = (soldier) => {
    setSelectedSoldier(soldier);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <AppBar position="fixed">
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={toggleDrawer}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Бойовий Медичний Дашборд
          </Typography>
          <Button color="inherit" onClick={handleLogout} startIcon={<LogoutIcon />}>
            Вихід
          </Button>
        </Toolbar>
      </AppBar>
      
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={toggleDrawer}
        sx={{ width: 320 }}
      >
        <Box sx={{ width: 320, p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Поранені військовослужбовці
          </Typography>
          <List>
            {soldiers.length > 0 ? (
              soldiers.map((soldier) => (
                <React.Fragment key={soldier.devEui}>
                  <ListItem 
                    component="div"
                    onClick={() => {
                      selectSoldier(soldier);
                      toggleDrawer();
                    }}
                    sx={{ cursor: 'pointer' }}
                  >
                    <LocalHospitalIcon sx={{ mr: 2, color: 
                      soldier.latest_data && (
                        soldier.latest_data.issue_type === 'BOTH' || soldier.latest_data.issue_type === 'SPO2' 
                        ? 'error.main' 
                        : soldier.latest_data.issue_type === 'HR' 
                          ? 'warning.main' 
                          : 'success.main'
                      )
                    }} />
                    <ListItemText 
                      primary={`${soldier.first_name} ${soldier.last_name}`}
                      secondary={
                        <Box component="span" sx={{ display: 'block' }}>
                          {soldier.latest_data && getStatusChip(soldier.latest_data.issue_type)}
                          {soldier.latest_data && (
                            <Box component="span" sx={{ display: 'block', mt: 1 }}>
                              SpO2: {soldier.latest_data.spo2}%, Пульс: {soldier.latest_data.heart_rate}
                            </Box>
                          )}
                          {!soldier.latest_data && (
                            <Box component="span" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
                              Немає медичних даних
                            </Box>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                  <Divider />
                </React.Fragment>
              ))
            ) : (
              <ListItem>
                <ListItemText primary="Немає даних про поранених" />
              </ListItem>
            )}
          </List>
        </Box>
      </Drawer>
      
      <Box component="main" sx={{ flexGrow: 1, mt: 8 }}>
        {error ? (
          <Box sx={{ p: 3 }}>
            <Paper elevation={3} sx={{ p: 2, bgcolor: 'error.light' }}>
              <Typography color="error">{error}</Typography>
              <Button 
                variant="contained" 
                color="primary" 
                sx={{ mt: 2 }}
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  fetchSoldiers();
                }}
              >
                Спробувати знову
              </Button>
            </Paper>
          </Box>
        ) : soldiers.length === 0 ? (
          <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Paper elevation={3} sx={{ p: 2, maxWidth: '600px', width: '100%' }}>
              <Typography variant="h6" align="center" sx={{ mb: 2 }}>
                Немає даних для відображення на карті
              </Typography>
              <Typography variant="body1" align="center">
                Немає поранених військовослужбовців з географічними даними для відображення.
              </Typography>
            </Paper>
          </Box>
        ) : (
          <MapContainer 
            center={soldiers.length > 0 && soldiers[0].latest_data ? 
              [soldiers[0].latest_data.latitude, soldiers[0].latest_data.longitude] : 
              [49.841817, 24.031695]} // Львів за замовчуванням
            zoom={13} 
            style={{ height: 'calc(100vh - 64px)', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {soldiers.map((soldier) => soldier.latest_data && (
              <Marker 
                key={soldier.devEui}
                position={[soldier.latest_data.latitude, soldier.latest_data.longitude]}
                icon={getMarkerIcon(soldier)}
              >
                <Popup>
                  <Typography variant="subtitle1">
                    {soldier.first_name} {soldier.last_name}
                  </Typography>
                  <Typography variant="body2">
                    Підрозділ: {soldier.unit}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    {getStatusChip(soldier.latest_data.issue_type)}
                  </Box>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    SpO2: {soldier.latest_data.spo2}%
                  </Typography>
                  <Typography variant="body2">
                    Пульс: {soldier.latest_data.heart_rate} уд/хв
                  </Typography>
                  {soldier.evacuation && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Статус евакуації: {
                        soldier.evacuation.status === 'NEEDED' ? 'Потребує евакуації' :
                        soldier.evacuation.status === 'IN_PROGRESS' ? 'В процесі евакуації' :
                        soldier.evacuation.status === 'EVACUATED' ? 'Евакуйований' : 'Невідомо'
                      }
                    </Typography>
                  )}
                </Popup>
              </Marker>
            ))}
            
            {/* Перехід до виділеного солдата */}
            {selectedSoldier && selectedSoldier.latest_data && (
              <Marker 
                position={[selectedSoldier.latest_data.latitude, selectedSoldier.latest_data.longitude]}
                icon={getMarkerIcon(selectedSoldier)}
              >
                <Popup>
                  <Typography variant="subtitle1">
                    {selectedSoldier.first_name} {selectedSoldier.last_name}
                  </Typography>
                  <Typography variant="body2">
                    Підрозділ: {selectedSoldier.unit}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    {getStatusChip(selectedSoldier.latest_data.issue_type)}
                  </Box>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    SpO2: {selectedSoldier.latest_data.spo2}%
                  </Typography>
                  <Typography variant="body2">
                    Пульс: {selectedSoldier.latest_data.heart_rate} уд/хв
                  </Typography>
                  {selectedSoldier.evacuation && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Статус евакуації: {
                        selectedSoldier.evacuation.status === 'NEEDED' ? 'Потребує евакуації' :
                        selectedSoldier.evacuation.status === 'IN_PROGRESS' ? 'В процесі евакуації' :
                        selectedSoldier.evacuation.status === 'EVACUATED' ? 'Евакуйований' : 'Невідомо'
                      }
                    </Typography>
                  )}
                </Popup>
              </Marker>
            )}
          </MapContainer>
        )}
      </Box>
    </Box>
  );
};

export default MapView; 