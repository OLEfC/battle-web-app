import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Paper, 
  Typography, 
  List, 
  ListItem, 
  ListItemText, 
  Divider, 
  Chip,
  CircularProgress,
  Container,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  Grid,
  Alert,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PersonIcon from '@mui/icons-material/Person';
import FilterListIcon from '@mui/icons-material/FilterList';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

import Navigation from '../components/Navigation';
import AddSoldierForm from '../components/AddSoldierForm';
import { soldierService } from '../utils/api';

const SoldierList = () => {
  const [soldiers, setSoldiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [tabValue, setTabValue] = useState(0); // 0 = всі, 1 = поранені
  const [refreshing, setRefreshing] = useState(false); // Додаємо стан для індикатора оновлення
  const [lastUpdate, setLastUpdate] = useState(null); // Додаємо стан для останнього оновлення
  const [showEvacuated, setShowEvacuated] = useState(true); // Додаємо стан для показу евакуйованих
  const [sortField, setSortField] = useState('status'); // Змінюємо з 'last_name' на 'status'
  const [sortDirection, setSortDirection] = useState('asc'); // Додаємо стан для напрямку сортування
  const navigate = useNavigate();

  // Виносимо fetchSoldiers у useCallback, щоб правильно використовувати у useEffect
  const fetchSoldiers = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setRefreshing(true);
      } else if (loading) {
        // Залишаємо loading=true тільки якщо він вже був
        // Це запобігає блоку екрану при фоновому оновленні
      }
      
      // Отримуємо дані з пріоритезованого API, додаємо timestamp для уникнення кешування
      const timestamp = new Date().getTime();
      const response = await soldierService.getPrioritizedSoldiers(timestamp);
      
      // Перевіряємо, чи отримали масив даних
      if (Array.isArray(response.data)) {
        setSoldiers(response.data);
        setLastUpdate(new Date()); // Оновлюємо час останнього оновлення
      } else {
        console.error('Unexpected API response format:', response.data);
        setError('Отримано неправильний формат даних з API');
      }
      
      if (showRefreshIndicator) {
        setRefreshing(false);
      } else if (loading) {
        setLoading(false);
      }
      
      setError(null);
    } catch (err) {
      console.error('Помилка отримання даних:', err);
      setError('Помилка завантаження даних');
      setLoading(false);
      setRefreshing(false);
      
      // Якщо помилка авторизації - перенаправляємо на сторінку логіну
      if (err.response && err.response.status === 401) {
        localStorage.removeItem('isAuthenticated');
        navigate('/login');
      }
    }
  }, [navigate, loading]); // Видаляємо залежність від soldiers.length

  useEffect(() => {
    // Перевіряємо авторизацію
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    fetchSoldiers();
    
    // Оновлення даних кожні 10 секунд замість 30
    const interval = setInterval(() => fetchSoldiers(true), 10000);
    
    return () => clearInterval(interval);
  }, [navigate, fetchSoldiers]);
  
  // Додаємо функцію ручного оновлення
  const handleRefresh = () => {
    fetchSoldiers(true);
  };
  
  const getStatusChip = (issue_type) => {
    if (!issue_type) return <Chip label="Невідомий" color="default" size="small" />;
    
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
  
  const getEvacuationStatus = (evacuation) => {
    if (!evacuation) return "Не евакуйований";
    
    switch (evacuation.status) {
      case 'NEEDED':
        return "Потребує евакуації";
      case 'IN_PROGRESS':
        return "В процесі евакуації";
      case 'EVACUATED':
        return "Евакуйований";
      default:
        return "Статус невідомий";
    }
  };
  
  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
  };
  
  const handleFilterChange = (event) => {
    setFilter(event.target.value);
  };
  
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // Фільтрація солдатів на поранених і звичайних
  const woundedSoldiers = soldiers.filter(soldier => soldier.latest_data);
  const allSoldiers = soldiers;
  
  // Додаємо функцію для сортування
  const sortSoldiers = (soldiersArray) => {
    return [...soldiersArray].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'last_name':
          comparison = a.last_name.localeCompare(b.last_name);
          break;
        case 'first_name':
          comparison = a.first_name.localeCompare(b.first_name);
          break;
        case 'unit':
          comparison = (a.unit || '').localeCompare(b.unit || '');
          break;
        case 'status':
          // Сортування за статусом (критичний стан має вищий пріоритет)
          const getStatusPriority = (soldier) => {
            if (!soldier.latest_data) return 0;
            switch (soldier.latest_data.issue_type) {
              case 'BOTH': return 3;
              case 'SPO2': return 2;
              case 'HR': return 1;
              default: return 0;
            }
          };
          comparison = getStatusPriority(b) - getStatusPriority(a);
          break;
        case 'evacuation':
          // Сортування за статусом евакуації
          const getEvacuationPriority = (soldier) => {
            if (!soldier.evacuation) return 0;
            switch (soldier.evacuation.status) {
              case 'IN_PROGRESS': return 3;
              case 'NEEDED': return 2;
              case 'EVACUATED': return 1;
              default: return 0;
            }
          };
          comparison = getEvacuationPriority(b) - getEvacuationPriority(a);
          break;
        default:
          comparison = 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  // Модифікуємо функцію фільтрації
  const getFilteredSoldiers = (soldiersArray) => {
    return soldiersArray.filter(soldier => {
      // Фільтруємо евакуйованих, якщо потрібно
      if (!showEvacuated && soldier.evacuation && soldier.evacuation.status === 'EVACUATED') {
        return false;
      }

      // Фільтруємо за пошуковим терміном
      const matchesSearch = 
        (soldier.first_name + ' ' + soldier.last_name).toLowerCase().includes(searchTerm.toLowerCase()) ||
        (soldier.unit && soldier.unit.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Фільтруємо за станом
      if (filter === 'all') return matchesSearch;
      if (filter === 'critical') {
        return matchesSearch && soldier.latest_data && 
          (soldier.latest_data.issue_type === 'BOTH' || 
           soldier.latest_data.issue_type === 'SPO2' || 
           soldier.latest_data.issue_type === 'HR');
      }
      if (filter === 'evacuation') {
        return matchesSearch && soldier.evacuation && 
               (soldier.evacuation.status === 'IN_PROGRESS' || 
                soldier.evacuation.status === 'EVACUATED');
      }
      if (filter === 'needs_evacuation') {
        return matchesSearch && soldier.evacuation && 
               soldier.evacuation.status === 'NEEDED';
      }
      if (filter === 'evacuated') {
        return matchesSearch && soldier.evacuation && 
               soldier.evacuation.status === 'EVACUATED';
      }
      return matchesSearch;
    });
  };
  
  const currentSoldiers = sortSoldiers(
    tabValue === 0 ? getFilteredSoldiers(allSoldiers) : getFilteredSoldiers(woundedSoldiers)
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navigation />
      
      <Box component="main" sx={{ flexGrow: 1, mt: 8, p: 3 }}>
        <Container maxWidth="lg">
          {error ? (
            <Alert 
              severity="error" 
              action={
                <Button 
                  color="inherit" 
                  size="small"
                  onClick={() => {
                    setError(null);
                    setLoading(true);
                    fetchSoldiers();
                  }}
                >
                  Оновити
                </Button>
              }
            >
              {error}
            </Alert>
          ) : (
            <>
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h5" component="h1">
                    Перелік військовослужбовців
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {refreshing && <CircularProgress size={24} sx={{ mr: 1 }} />}
                    <Button 
                      onClick={handleRefresh} 
                      disabled={refreshing}
                      startIcon={<RefreshIcon />}
                      variant="outlined"
                      color="primary"
                      size="small"
                      sx={{ mr: 2 }}
                    >
                      Оновити
                    </Button>
                    {lastUpdate && (
                      <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>
                        Оновлено: {lastUpdate.toLocaleTimeString('uk-UA')}
                      </Typography>
                    )}
                    <AddSoldierForm onSoldierAdded={fetchSoldiers} />
                  </Box>
                </Box>
                
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                  <Tabs value={tabValue} onChange={handleTabChange} aria-label="soldier tabs">
                    <Tab label={`Всі військовослужбовці (${allSoldiers.length})`} />
                    <Tab label={`Поранені (${woundedSoldiers.length})`} />
                  </Tabs>
                </Box>
                
                {/* Додаємо статистику */}
                <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip 
                    label={`Критичний стан: ${soldiers.filter(s => s.latest_data && s.latest_data.issue_type === 'BOTH' && (!s.evacuation || s.evacuation.status !== 'EVACUATED')).length}`} 
                    color="error" 
                    variant="outlined"
                  />
                  <Chip 
                    label={`Проблеми SpO2: ${soldiers.filter(s => s.latest_data && s.latest_data.issue_type === 'SPO2' && (!s.evacuation || s.evacuation.status !== 'EVACUATED')).length}`} 
                    color="error" 
                    variant="outlined"
                  />
                  <Chip 
                    label={`Проблеми пульсу: ${soldiers.filter(s => s.latest_data && s.latest_data.issue_type === 'HR' && (!s.evacuation || s.evacuation.status !== 'EVACUATED')).length}`} 
                    color="warning" 
                    variant="outlined"
                  />
                  <Chip 
                    label={`В евакуації: ${soldiers.filter(s => s.evacuation && s.evacuation.status === 'IN_PROGRESS').length}`} 
                    color="primary" 
                    variant="outlined"
                  />
                  <Chip 
                    label={`Евакуйовані: ${soldiers.filter(s => s.evacuation && s.evacuation.status === 'EVACUATED').length}`} 
                    color="success" 
                    variant="outlined"
                  />
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography color="text.secondary">
                      {tabValue === 0 ? 'Всі військовослужбовці' : 'Поранені військовослужбовці'}
                      : {currentSoldiers.length} записів
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <InputLabel id="sort-label">Сортування</InputLabel>
                      <Select
                        labelId="sort-label"
                        value={sortField}
                        label="Сортування"
                        onChange={(e) => setSortField(e.target.value)}
                      >
                        <MenuItem value="last_name">За прізвищем</MenuItem>
                        <MenuItem value="first_name">За ім'ям</MenuItem>
                        <MenuItem value="unit">За підрозділом</MenuItem>
                        <MenuItem value="status">За станом</MenuItem>
                        <MenuItem value="evacuation">За евакуацією</MenuItem>
                      </Select>
                    </FormControl>
                    <Button
                      size="small"
                      onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                      startIcon={sortDirection === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
                    >
                      {sortDirection === 'asc' ? 'За зростанням' : 'За спаданням'}
                    </Button>
                    <Button
                      variant={showEvacuated ? "contained" : "outlined"}
                      color="primary"
                      size="small"
                      onClick={() => setShowEvacuated(!showEvacuated)}
                    >
                      {showEvacuated ? "Приховати евакуйованих" : "Показати евакуйованих"}
                    </Button>
                    <TextField
                      placeholder="Пошук за ім'ям або підрозділом"
                      size="small"
                      value={searchTerm}
                      onChange={handleSearch}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <InputLabel id="filter-label">Фільтр</InputLabel>
                      <Select
                        labelId="filter-label"
                        value={filter}
                        label="Фільтр"
                        onChange={handleFilterChange}
                        startAdornment={
                          <InputAdornment position="start">
                            <FilterListIcon />
                          </InputAdornment>
                        }
                      >
                        <MenuItem value="all">Усі</MenuItem>
                        <MenuItem value="critical">Критичний стан</MenuItem>
                        <MenuItem value="evacuation">В евакуації</MenuItem>
                        <MenuItem value="needs_evacuation">Потребує евакуації</MenuItem>
                        <MenuItem value="evacuated">Евакуйовані</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                </Box>
              </Box>
              
              {currentSoldiers.length === 0 ? (
                <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
                  <Typography>Не знайдено військовослужбовців, що відповідають критеріям пошуку</Typography>
                </Paper>
              ) : (
                <Grid container spacing={2}>
                  {currentSoldiers.map((soldier) => (
                    <Grid item xs={12} md={6} lg={4} key={soldier.devEui}>
                      <Card 
                        sx={{ 
                          borderLeft: soldier.latest_data ? 
                            (soldier.latest_data.issue_type === 'BOTH' ? '4px solid #f44336' : 
                             soldier.latest_data.issue_type === 'SPO2' || soldier.latest_data.issue_type === 'HR' ? '4px solid #ff9800' :
                             '4px solid #4caf50') : 
                            'none',
                          '&:hover': {
                            boxShadow: 6,
                            cursor: 'pointer'
                          }
                        }}
                        onClick={() => navigate(`/soldiers/${soldier.devEui}`)}
                      >
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <PersonIcon sx={{ mr: 1 }} />
                            <Typography variant="h6">
                              {soldier.first_name} {soldier.last_name}
                            </Typography>
                          </Box>
                          
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            <strong>Підрозділ:</strong> {soldier.unit || 'Невідомо'}
                          </Typography>
                          
                          <Box sx={{ mb: 1 }}>
                            {soldier.latest_data ? getStatusChip(soldier.latest_data.issue_type) : 
                              <Chip label="Немає медичних даних" color="default" size="small" />
                            }
                            <Chip 
                              label={getEvacuationStatus(soldier.evacuation)} 
                              size="small" 
                              sx={{ ml: 1 }}
                              color={
                                !soldier.evacuation ? "default" :
                                soldier.evacuation.status === 'IN_PROGRESS' ? "primary" :
                                soldier.evacuation.status === 'NEEDED' ? "warning" :
                                "success"
                              }
                            />
                          </Box>
                          
                          {soldier.latest_data ? (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="body2">
                                <LocalHospitalIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                                <strong>SpO2:</strong> {soldier.latest_data.spo2}%,{' '}
                                <strong>Пульс:</strong> {soldier.latest_data.heart_rate} уд/хв
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                <strong>Останнє оновлення:</strong> {new Date(soldier.latest_data.timestamp).toLocaleString()}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mt: 2 }}>
                              Немає медичних даних
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </>
          )}
        </Container>
      </Box>
    </Box>
  );
};

export default SoldierList; 