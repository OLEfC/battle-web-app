import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Circle } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Paper, 
  Typography, 
  CircularProgress,
  Container,
  Alert,
  Button,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Chip,
  TextField,
  Slider,
  Tooltip,
  ButtonGroup
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PersonIcon from '@mui/icons-material/Person';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ListIcon from '@mui/icons-material/List';
import ClearIcon from '@mui/icons-material/Clear';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Імпорт сервісів API і компонентів
import { soldierService } from '../utils/api';
import Navigation from '../components/Navigation';

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

// Компонент для керування видимою областю карти
const MapController = ({ center, zoom }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, map]);
  
  return null;
};

// Хелпер для отримання статусу за типом проблеми
const getStatusChipText = (issue_type) => {
  switch (issue_type) {
    case 'BOTH':
      return "Критичний стан";
    case 'SPO2':
      return "Критичний SpO2";
    case 'HR':
      return "Критичний пульс";
    case 'SENSOR_ERROR':
      return "Помилка датчиків";
    default:
      return "Нормальний стан";
  }
};

// Маркер з автоматичним відкриттям Popup при фокусі
const AutoOpenMarker = ({ position, icon, isActive, soldier, onMarkerClick }) => {
  const popupRef = useRef(null);
  
  useEffect(() => {
    if (isActive && popupRef.current) {
      // Відкриваємо Popup, якщо маркер активний
      popupRef.current.openPopup();
    }
  }, [isActive]);
  
  return (
    <Marker 
      position={position}
      icon={icon}
      eventHandlers={{
        click: () => onMarkerClick(soldier)
      }}
    >
      <Popup ref={popupRef}>
        <Typography variant="subtitle1">
          {soldier.first_name} {soldier.last_name}
        </Typography>
        <Typography variant="body2">
          Підрозділ: {soldier.unit}
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold' }}>
          {getStatusChipText(soldier.latest_data.issue_type)}
        </Typography>
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
  );
};

// Компонент для відстеження кліків на карті
const MapClickHandler = ({ onMapClick, isSearchMode }) => {
  const map = useMapEvents({
    click: (e) => {
      if (isSearchMode) {
        onMapClick(e.latlng);
      }
    }
  });
  
  return null;
};

const MapPage = () => {
  const [soldiers, setSoldiers] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSoldier, setSelectedSoldier] = useState(null);
  const [mapCenter, setMapCenter] = useState(null);
  const [mapZoom, setMapZoom] = useState(13);
  const [activeSoldierId, setActiveSoldierId] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  // Стан для функціоналу пошуку поблизу
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchPoint, setSearchPoint] = useState(null);
  const [searchRadius, setSearchRadius] = useState(1);
  const [showRadiusDialog, setShowRadiusDialog] = useState(false);
  const [isRadiusSelectionMode, setIsRadiusSelectionMode] = useState(false);
  const [nearbySoldiers, setNearbySoldiers] = useState([]);
  const [nearbyDrawerOpen, setNearbyDrawerOpen] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState(null);
  
  const navigate = useNavigate();

  // Функція для розрахунку оптимального центру карти та рівня збільшення
  const calculateMapBounds = useCallback((soldiersData) => {
    if (!soldiersData || soldiersData.length === 0) {
      return {
        center: [49.841817, 24.031695], // Львів за замовчуванням
        zoom: 13
      };
    }

    // Фільтруємо солдатів з валідними координатами
    const validSoldiers = soldiersData.filter(
      soldier => soldier.latest_data && 
                soldier.latest_data.latitude && 
                soldier.latest_data.longitude
    );

    if (validSoldiers.length === 0) {
      return {
        center: [49.841817, 24.031695],
        zoom: 13
      };
    }

    if (validSoldiers.length === 1) {
      return {
        center: [validSoldiers[0].latest_data.latitude, validSoldiers[0].latest_data.longitude],
        zoom: 15
      };
    }

    // Знаходимо мінімальні та максимальні координати
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    
    validSoldiers.forEach(soldier => {
      const lat = soldier.latest_data.latitude;
      const lng = soldier.latest_data.longitude;
      
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    });

    // Розраховуємо центр
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    // Розраховуємо відстань між крайніми точками
    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    
    // Конвертуємо градуси в кілометри (приблизно)
    const latDiffKm = latDiff * 111.32; // 1 градус широти ≈ 111.32 км
    const lngDiffKm = lngDiff * 111.32 * Math.cos(centerLat * Math.PI / 180); // Коригуємо довготу на широту
    
    // Беремо максимальну відстань
    const maxDiffKm = Math.max(latDiffKm, lngDiffKm);

    // Визначаємо оптимальний рівень збільшення на основі відстані в кілометрах
    let zoom;
    if (maxDiffKm > 100) zoom = 7;        // Дуже велика відстань
    else if (maxDiffKm > 50) zoom = 8;    // Велика відстань
    else if (maxDiffKm > 20) zoom = 9;    // Середньо-велика відстань
    else if (maxDiffKm > 10) zoom = 10;   // Середня відстань
    else if (maxDiffKm > 5) zoom = 11;    // Середньо-мала відстань
    else if (maxDiffKm > 2) zoom = 12;    // Мала відстань
    else if (maxDiffKm > 1) zoom = 13;    // Дуже мала відстань
    else if (maxDiffKm > 0.5) zoom = 14;  // Мінімальна відстань
    else zoom = 15;                       // Дуже близькі точки

    // Додаємо невеликий відступ для кращого відображення
    return {
      center: [centerLat, centerLng],
      zoom: Math.max(7, zoom - 1) // Обмежуємо мінімальний рівень збільшення
    };
  }, []);

  // Оголошуємо fetchSoldiers перед useEffect
  const fetchSoldiers = useCallback(async () => {
    try {
      const response = await soldierService.getPrioritizedSoldiers();
      
      if (Array.isArray(response.data)) {
        const validSoldiers = response.data.filter(
          soldier => soldier.latest_data && 
                    soldier.latest_data.latitude && 
                    soldier.latest_data.longitude
        );
        
        setSoldiers(validSoldiers);
        
        // Розраховуємо оптимальний центр та збільшення
        const { center, zoom } = calculateMapBounds(validSoldiers);
        setMapCenter(center);
        setMapZoom(zoom);
      } else {
        console.error('Unexpected API response format:', response.data);
        setError('Отримано неправильний формат даних з API');
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Помилка отримання даних:', err);
      setError('Помилка завантаження даних');
      setLoading(false);
      
      if (err.response && err.response.status === 401) {
        localStorage.removeItem('isAuthenticated');
        navigate('/login');
      }
    }
  }, [navigate, calculateMapBounds]);

  // useEffect після оголошення fetchSoldiers
  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    fetchSoldiers();
    
    // Оновлення даних кожні 30 секунд
    const interval = setInterval(fetchSoldiers, 30000);
    
    return () => clearInterval(interval);
  }, [navigate, fetchSoldiers]);
  
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
  
  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };
  
  const centerMapOnSoldier = (soldier) => {
    if (soldier && soldier.latest_data) {
      setMapCenter([soldier.latest_data.latitude, soldier.latest_data.longitude]);
      setActiveSoldierId(soldier.devEui);
    } else if (soldier && soldier.coordinates) { // Додаємо перевірку на наявність координат у результатах пошуку поблизу
      setMapCenter([soldier.coordinates.latitude, soldier.coordinates.longitude]);
      setActiveSoldierId(soldier.devEui);
    }
  };
  
  const selectSoldier = (soldier) => {
    setSelectedSoldier(soldier);
    
    // Центруємо карту на координатах пораненого, якщо вони є
    if (soldier && soldier.latest_data) {
      centerMapOnSoldier(soldier);
    }
  };

  const handleMarkerClick = (soldier) => {
    setActiveSoldierId(soldier.devEui);
  };

  const handleDetailsOpen = (soldier) => {
    // Якщо це солдат з результатів пошуку, підготуємо його дані
    if (soldier.medical_data === undefined && nearbySoldiers.length > 0) {
      // Шукаємо повні дані про солдата в результатах пошуку
      const foundItem = nearbySoldiers.find(item => item.soldier.devEui === soldier.devEui);
      if (foundItem && foundItem.medical_data) {
        // Створюємо копію солдата з даними з результатів пошуку
        const preparedSoldier = {
          ...soldier,
          latest_data: foundItem.medical_data // Додаємо медичні дані
        };
        setSelectedSoldier(preparedSoldier);
      } else {
        setSelectedSoldier(soldier);
      }
    } else {
      setSelectedSoldier(soldier);
    }
    setDetailsOpen(true);
  };
  
  const handleDetailsClose = () => {
    setDetailsOpen(false);
  };
  
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Невідомо';
    
    const date = new Date(timestamp);
    return date.toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const getEvacuationStatus = (evacuation) => {
    if (!evacuation) return 'Не евакуйований';
    
    switch(evacuation.status) {
      case 'NEEDED':
        return 'Потребує евакуації';
      case 'IN_PROGRESS':
        return 'В процесі евакуації';
      case 'EVACUATED':
        return 'Евакуйований';
      default:
        return 'Невідомо';
    }
  };
  
  const getEvacuationStatusColor = (evacuation) => {
    if (!evacuation) return 'default';
    
    switch(evacuation.status) {
      case 'NEEDED':
        return 'warning';
      case 'IN_PROGRESS':
        return 'primary';
      case 'EVACUATED':
        return 'success';
      default:
        return 'default';
    }
  };
  
  const getIssueTypeColor = (issue_type) => {
    switch(issue_type) {
      case 'BOTH':
        return 'error';
      case 'SPO2':
      case 'HR':
        return 'warning';
      case 'SENSOR_ERROR':
        return 'info';
      default:
        return 'success';
    }
  };

  // Функція для обробки кліків на карті в режимі пошуку
  const handleMapClick = (latlng) => {
    if (isSearchMode) {
      setSearchPoint(latlng);
      setIsSearchMode(false); // Вимикаємо режим пошуку після вибору точки
      setIsRadiusSelectionMode(true); // Вмикаємо режим вибору радіусу
    }
  };

  // Функція для скасування режиму пошуку
  const cancelSearchMode = () => {
    setIsSearchMode(false);
    setIsRadiusSelectionMode(false);
    setSearchPoint(null);
  };

  // Функція для пошуку поблизу по координатам
  const searchNearby = async () => {
    if (!searchPoint) return;
    
    setNearbyLoading(true);
    setNearbyError(null);
    setIsRadiusSelectionMode(false);
    
    try {
      const response = await soldierService.getNearbySoldiers(
        searchPoint.lat, 
        searchPoint.lng, 
        searchRadius
      );
      
      if (Array.isArray(response.data)) {
        setNearbySoldiers(response.data);
        setNearbyDrawerOpen(true);
      } else {
        console.error('Unexpected API response format:', response.data);
        setNearbyError('Отримано неправильний формат даних з API');
      }
    } catch (err) {
      console.error('Помилка пошуку поблизу:', err);
      setNearbyError(err.response?.data?.error || 'Помилка під час пошуку');
    } finally {
      setNearbyLoading(false);
    }
  };

  // Функція для переходу на сторінку профілю військового
  const navigateToSoldierProfile = (soldierId) => {
    // Відкриваємо сторінку в новій вкладці
    window.open(`/soldiers/${soldierId}`, '_blank');
  };

  // Функція для центрування карти на солдаті з результатів пошуку поблизу
  const centerMapOnNearbySoldier = (item) => {
    if (item.medical_data) {
      setMapCenter([item.medical_data.latitude, item.medical_data.longitude]);
      setActiveSoldierId(item.soldier.devEui);
      setNearbyDrawerOpen(false); // Закриваємо панель для кращого бачення карти
    }
  };

  // Функція для відкриття результатів пошуку
  const openNearbyResults = () => {
    if (nearbySoldiers.length > 0) {
      setNearbyDrawerOpen(true);
    }
  };

  // Функція для очищення результатів пошуку
  const clearSearch = () => {
    setSearchPoint(null);
    setNearbySoldiers([]);
    setNearbyDrawerOpen(false);
    setIsRadiusSelectionMode(false);
    setSearchRadius(1); // Скидаємо радіус до значення за замовчуванням
  };

  // Функція для відображення вікна зміни радіусу
  const openRadiusChangeDialog = () => {
    setIsRadiusSelectionMode(true);
  };

  // Функція для оновлення результатів пошуку
  const updateSearchResults = async () => {
    if (!searchPoint) return;
    
    setNearbyLoading(true);
    setNearbyError(null);
    setIsRadiusSelectionMode(false);
    
    try {
      const response = await soldierService.getNearbySoldiers(
        searchPoint.lat, 
        searchPoint.lng, 
        searchRadius
      );
      
      if (Array.isArray(response.data)) {
        setNearbySoldiers(response.data);
        setNearbyDrawerOpen(true);
      } else {
        console.error('Unexpected API response format:', response.data);
        setNearbyError('Отримано неправильний формат даних з API');
      }
    } catch (err) {
      console.error('Помилка пошуку поблизу:', err);
      setNearbyError(err.response?.data?.error || 'Помилка під час пошуку');
    } finally {
      setNearbyLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Navigation toggleDrawer={toggleDrawer} />
      
      {/* Спливаюче повідомлення для режиму пошуку */}
      {isSearchMode && (
        <Alert 
          severity="info" 
          sx={{ 
            position: 'fixed', 
            top: 70, 
            left: '50%', 
            transform: 'translateX(-50%)', 
            zIndex: 1500,
            boxShadow: 3
          }}
          action={
            <Button color="inherit" size="small" onClick={cancelSearchMode}>
              Скасувати
            </Button>
          }
        >
          Клікніть на карті для вибору точки пошуку
        </Alert>
      )}
      
      {/* Елементи керування радіусом пошуку прямо на карті */}
      {isRadiusSelectionMode && searchPoint && (
        <Paper
          elevation={3}
          sx={{
            position: 'fixed',
            bottom: 80,
            right: 20,
            zIndex: 1500,
            width: 300,
            p: 2,
            borderRadius: 2
          }}
        >
          <Typography gutterBottom sx={{ fontWeight: 'bold' }}>
            Радіус пошуку: {searchRadius} км
          </Typography>
          <Slider
            value={searchRadius}
            onChange={(e, newValue) => setSearchRadius(newValue)}
            aria-labelledby="search-radius-slider"
            step={0.5}
            marks={[
              { value: 1, label: '1 км' },
              { value: 3, label: '3 км' },
              { value: 5, label: '5 км' }
            ]}
            min={0.5}
            max={5}
            valueLabelDisplay="auto"
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => setIsRadiusSelectionMode(false)} size="small">
              Скасувати
            </Button>
            <Button 
              onClick={searchPoint && nearbySoldiers.length > 0 ? updateSearchResults : searchNearby} 
              variant="contained" 
              size="small"
            >
              {searchPoint && nearbySoldiers.length > 0 ? "Оновити результати" : "Шукати"}
            </Button>
          </Box>
        </Paper>
      )}
      
      {/* Бічна панель для результатів пошуку */}
      <Drawer
        anchor="right"
        open={nearbyDrawerOpen}
        onClose={() => setNearbyDrawerOpen(false)}
        sx={{ 
          width: 350,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 350,
            boxSizing: 'border-box',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Військові поблизу ({nearbySoldiers.length})
            </Typography>
            <IconButton onClick={() => setNearbyDrawerOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
          
          {nearbyError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {nearbyError}
            </Alert>
          )}
          
          {nearbyLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <List>
              {nearbySoldiers.length > 0 ? (
                nearbySoldiers.map((item) => (
                  <React.Fragment key={item.soldier.devEui}>
                    <ListItem>
                      <Box sx={{ width: '100%' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="subtitle1">
                            {item.soldier.first_name} {item.soldier.last_name}
                          </Typography>
                          <Chip label={`${item.distance} км`} size="small" color="primary" />
                        </Box>
                        <ListItemText
                          secondary={
                            <Box component="span" sx={{ display: 'block' }}>
                              <Typography variant="body2" component="span">
                                Підрозділ: {item.soldier.unit}
                              </Typography>
                              {item.medical_data && (
                                <Box component="span" sx={{ display: 'block', mt: 1 }}>
                                  <Box component="span" sx={{ fontWeight: 'bold' }}>
                                    {getStatusChipText(item.medical_data.issue_type)}
                                  </Box>
                                  <br />
                                  SpO2: {item.medical_data.spo2}%, Пульс: {item.medical_data.heart_rate}
                                </Box>
                              )}
                            </Box>
                          }
                        />
                        
                        <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', mt: 1 }}>
                          <ButtonGroup size="small">
                            <Button 
                              variant="outlined" 
                              startIcon={<InfoIcon />}
                              onClick={() => handleDetailsOpen(item.soldier)}
                            >
                              Деталі
                            </Button>
                            <Button 
                              variant="outlined" 
                              startIcon={<AccountCircleIcon />}
                              onClick={() => navigateToSoldierProfile(item.soldier.devEui)}
                            >
                              Профіль
                            </Button>
                          </ButtonGroup>
                          
                          <Button 
                            variant="contained" 
                            size="small"
                            startIcon={<MyLocationIcon />}
                            onClick={() => {
                              centerMapOnNearbySoldier(item);
                            }}
                          >
                            На карті
                          </Button>
                        </Box>
                      </Box>
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))
              ) : (
                <ListItem>
                  <ListItemText primary="Немає військових поблизу вказаної точки" />
                </ListItem>
              )}
            </List>
          )}
        </Box>
      </Drawer>
      
      {/* Бічна панель зі списком поранених */}
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
                    sx={{ 
                      cursor: 'pointer', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'flex-start',
                      bgcolor: activeSoldierId === soldier.devEui ? 'rgba(0, 0, 0, 0.04)' : 'transparent'
                    }}
                  >
                    <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-start' }}>
                      <LocalHospitalIcon sx={{ mr: 2, mt: 0.5, color: 
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
                            {soldier.latest_data && (
                              <Box component="span" sx={{ display: 'block', mt: 1 }}>
                                <Box component="span" sx={{ fontWeight: 'bold' }}>
                                  {getStatusChipText(soldier.latest_data.issue_type)}
                                </Box>
                                <br />
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
                    </Box>
                    
                    {/* Додаємо кнопки дій */}
                    <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', mt: 1 }}>
                      <ButtonGroup size="small">
                        <Button 
                          variant="outlined" 
                          startIcon={<InfoIcon />}
                          onClick={() => handleDetailsOpen(soldier)}
                        >
                          Деталі
                        </Button>
                        <Button 
                          variant="outlined" 
                          startIcon={<AccountCircleIcon />}
                          onClick={() => navigateToSoldierProfile(soldier.devEui)}
                        >
                          Профіль
                        </Button>
                      </ButtonGroup>
                      
                      {soldier.latest_data && (
                        <Button 
                          variant="contained" 
                          size="small"
                          color={activeSoldierId === soldier.devEui ? "success" : "primary"}
                          startIcon={<MyLocationIcon />}
                          onClick={(e) => {
                            e.stopPropagation(); // Запобігаємо закриттю drawer
                            centerMapOnSoldier(soldier);
                            setDrawerOpen(false); // Закриваємо бічну панель зі списком
                          }}
                        >
                          На карті
                        </Button>
                      )}
                    </Box>
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
      
      <Dialog 
        open={detailsOpen} 
        onClose={handleDetailsClose}
        maxWidth="md"
        fullWidth
      >
        {selectedSoldier && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">
                  {selectedSoldier.first_name} {selectedSoldier.last_name}
                </Typography>
                <IconButton onClick={handleDetailsClose}>
                  <CloseIcon />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Особиста інформація
                    </Typography>
                    <Typography variant="body1">
                      <strong>Підрозділ:</strong> {selectedSoldier.unit || 'Невідомо'}
                    </Typography>
                    <Typography variant="body1">
                      <strong>ID пристрою:</strong> {selectedSoldier.devEui}
                    </Typography>
                    <Typography variant="body1">
                      <strong>Створено:</strong> {formatTimestamp(selectedSoldier.created_at)}
                    </Typography>
                    <Typography variant="body1">
                      <strong>Останнє оновлення:</strong> {formatTimestamp(selectedSoldier.last_update)}
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Медичні показники
                    </Typography>
                    {selectedSoldier.latest_data ? (
                      <>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Typography variant="body1" sx={{ mr: 1 }}>
                            <strong>Стан:</strong>
                          </Typography>
                          <Chip 
                            label={getStatusChipText(selectedSoldier.latest_data.issue_type)} 
                            color={getIssueTypeColor(selectedSoldier.latest_data.issue_type)}
                            size="small"
                          />
                        </Box>
                        <Typography variant="body1">
                          <strong>SpO2:</strong> {selectedSoldier.latest_data.spo2}%
                        </Typography>
                        <Typography variant="body1">
                          <strong>Пульс:</strong> {selectedSoldier.latest_data.heart_rate} уд/хв
                        </Typography>
                        <Typography variant="body1">
                          <strong>Час виміру:</strong> {formatTimestamp(selectedSoldier.latest_data.timestamp)}
                        </Typography>
                        <Typography variant="body1">
                          <strong>Координати:</strong> {selectedSoldier.latest_data.latitude.toFixed(6)}, {selectedSoldier.latest_data.longitude.toFixed(6)}
                        </Typography>
                      </>
                    ) : (
                      <Typography variant="body1" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        Немає медичних даних
                      </Typography>
                    )}
                  </Box>
                </Grid>
                
                <Grid item xs={12}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Дані евакуації
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body1" sx={{ mr: 1 }}>
                        <strong>Статус евакуації:</strong>
                      </Typography>
                      <Chip 
                        label={getEvacuationStatus(selectedSoldier.evacuation)} 
                        color={getEvacuationStatusColor(selectedSoldier.evacuation)}
                        size="small"
                      />
                    </Box>
                    {selectedSoldier.evacuation && (
                      <>
                        {selectedSoldier.evacuation.status === 'IN_PROGRESS' && (
                          <Typography variant="body1">
                            <strong>Розпочато:</strong> {formatTimestamp(selectedSoldier.evacuation.evacuation_started)}
                          </Typography>
                        )}
                        {selectedSoldier.evacuation.status === 'EVACUATED' && (
                          <>
                            <Typography variant="body1">
                              <strong>Розпочато:</strong> {formatTimestamp(selectedSoldier.evacuation.evacuation_started)}
                            </Typography>
                            <Typography variant="body1">
                              <strong>Завершено:</strong> {formatTimestamp(selectedSoldier.evacuation.evacuation_time)}
                            </Typography>
                          </>
                        )}
                      </>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button 
                onClick={() => navigateToSoldierProfile(selectedSoldier.devEui)}
                variant="outlined"
                startIcon={<AccountCircleIcon />}
              >
                Перейти до профілю
              </Button>
              <Button 
                onClick={() => {
                  centerMapOnSoldier(selectedSoldier);
                  handleDetailsClose();
                }} 
                variant="contained" 
                startIcon={<MyLocationIcon />}
                disabled={!selectedSoldier.latest_data && !selectedSoldier.coordinates}
              >
                Показати на карті
              </Button>
              <Button onClick={handleDetailsClose} variant="outlined">
                Закрити
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
      
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
          <Box sx={{ position: 'relative', height: 'calc(100vh - 64px)' }}>
            {/* Плаваюча кнопка для пошуку поблизу */}
            <Tooltip title="Пошук військових поблизу">
              <Button
                variant="contained"
                color={isSearchMode ? "secondary" : "primary"}
                sx={{
                  position: 'absolute',
                  bottom: 20,
                  right: 20,
                  zIndex: 999,
                  borderRadius: '50%',
                  minWidth: 56,
                  width: 56,
                  height: 56
                }}
                onClick={() => setIsSearchMode(!isSearchMode)}
              >
                <SearchIcon />
              </Button>
            </Tooltip>
            
            {/* Кнопка для повернення до результатів пошуку */}
            {nearbySoldiers.length > 0 && !nearbyDrawerOpen && (
              <Tooltip title="Повернутися до результатів пошуку">
                <Button
                  variant="contained"
                  color="primary"
                  sx={{
                    position: 'absolute',
                    bottom: 20,
                    right: 85, // Розташування праворуч від кнопки пошуку
                    zIndex: 999,
                    borderRadius: '50%',
                    minWidth: 56,
                    width: 56,
                    height: 56
                  }}
                  onClick={openNearbyResults}
                >
                  <ListIcon />
                </Button>
              </Tooltip>
            )}
            
            {/* Кнопка для очищення пошуку */}
            {searchPoint && (
              <Tooltip title="Очистити пошук">
                <Button
                  variant="contained"
                  color="error"
                  sx={{
                    position: 'absolute',
                    bottom: 20,
                    right: nearbySoldiers.length > 0 && !nearbyDrawerOpen ? 150 : 85, // Правильне розташування залежно від наявності інших кнопок
                    zIndex: 999,
                    borderRadius: '50%',
                    minWidth: 56,
                    width: 56,
                    height: 56
                  }}
                  onClick={clearSearch}
                >
                  <ClearIcon />
                </Button>
              </Tooltip>
            )}
            
            <MapContainer 
              center={mapCenter || [49.841817, 24.031695]}
              zoom={mapZoom}
              style={{ height: '100%', width: '100%' }}
            >
              {/* Компонент для керування видимою областю карти */}
              <MapController center={mapCenter} zoom={mapZoom} />
              
              {/* Компонент для відстеження кліків на карті */}
              <MapClickHandler onMapClick={handleMapClick} isSearchMode={isSearchMode} />
              
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {/* Відображення кола радіусу пошуку */}
              {searchPoint && (
                <Circle 
                  center={[searchPoint.lat, searchPoint.lng]}
                  radius={searchRadius * 1000} // Конвертуємо км в метри
                  pathOptions={{ color: 'blue', fillColor: '#3388ff', fillOpacity: 0.2 }}
                />
              )}
              
              {/* Відображення маркера точки пошуку */}
              {searchPoint && (
                <Marker
                  position={[searchPoint.lat, searchPoint.lng]}
                  icon={new L.Icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
                    shadowUrl: iconShadow,
                    iconSize: [25, 41],
                    iconAnchor: [12, 41]
                  })}
                  eventHandlers={{
                    click: () => openRadiusChangeDialog()
                  }}
                >
                  <Popup>
                    <Typography variant="subtitle1">Точка пошуку</Typography>
                    <Typography variant="body2">
                      Радіус: {searchRadius} км
                    </Typography>
                  </Popup>
                </Marker>
              )}
              
              {soldiers.map((soldier) => soldier.latest_data && (
                <AutoOpenMarker
                  key={soldier.devEui}
                  position={[soldier.latest_data.latitude, soldier.latest_data.longitude]}
                  icon={getMarkerIcon(soldier)}
                  isActive={activeSoldierId === soldier.devEui}
                  soldier={soldier}
                  onMarkerClick={handleMarkerClick}
                />
              ))}
            </MapContainer>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default MapPage; 