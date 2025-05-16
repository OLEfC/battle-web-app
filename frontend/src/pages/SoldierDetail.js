import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Tooltip,
  Tab,
  Tabs,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import DevicesIcon from '@mui/icons-material/Devices';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import RefreshIcon from '@mui/icons-material/Refresh';
import { soldierService } from '../utils/api';
import Navigation from '../components/Navigation';
// Import Chart.js components
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend
);

// Function to format date for display
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString('uk-UA', {
    timeZone: 'Europe/Kiev'
  });
};

const SoldierDetail = () => {
  const { devEui } = useParams();
  const navigate = useNavigate();
  const [soldier, setSoldier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [action, setAction] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [medicalHistory, setMedicalHistory] = useState(null);
  const [medicalHistoryLoading, setMedicalHistoryLoading] = useState(false);
  const [timeFilter, setTimeFilter] = useState('7'); // Default to 7 days

  const fetchSoldierData = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setRefreshing(true);
      } else if (!soldier) {
        setLoading(true);
      }
      
      const response = await soldierService.getSoldierById(devEui);
      setSoldier(response.data);
      setLastUpdate(new Date());
      
      if (showRefreshIndicator) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
      
      setError(null);
    } catch (err) {
      console.error('Помилка завантаження даних:', err);
      setError('Не вдалося завантажити дані про військового');
      setLoading(false);
      setRefreshing(false);
      
      if (err.response && err.response.status === 401) {
        localStorage.removeItem('isAuthenticated');
        navigate('/login');
      }
    }
  }, [devEui, navigate, soldier]);

  useEffect(() => {
    if (devEui) {
      fetchSoldierData();
      
      const interval = setInterval(() => fetchSoldierData(true), 10000);
      
      return () => clearInterval(interval);
    }
  }, [devEui, fetchSoldierData]);

  const handleRefresh = () => {
    fetchSoldierData(true);
  };

  const handleConfirmAction = (actionType) => {
    setAction(actionType);
    setConfirmDialog(true);
  };

  const executeAction = async () => {
    try {
      setLoading(true);
      
      if (action === 'start-evacuation') {
        await soldierService.startEvacuation(devEui);
      } else if (action === 'complete-evacuation') {
        await soldierService.completeEvacuation(devEui);
      } else if (action === 'cancel-evacuation') {
        await soldierService.cancelEvacuation(devEui);
      }
      
      await fetchSoldierData();
      
      setLoading(false);
      setConfirmDialog(false);
    } catch (err) {
      console.error('Помилка виконання дії:', err);
      setError('Не вдалося виконати дію');
      setLoading(false);
      setConfirmDialog(false);
    }
  };

  const getStatusChip = (issue_type) => {
    if (!issue_type) return <Chip label="Невідомий стан" color="default" />;
    
    switch (issue_type) {
      case 'BOTH':
        return <Chip label="Критичний стан" color="error" />;
      case 'SPO2':
        return <Chip label="Критичний SpO2" color="error" />;
      case 'HR':
        return <Chip label="Критичний пульс" color="warning" />;
      case 'SENSOR_ERROR':
        return <Chip label="Помилка датчиків" color="default" />;
      default:
        return <Chip label="Нормальний стан" color="success" />;
    }
  };

  const getEvacuationStatusChip = (evacuation) => {
    if (!evacuation) return <Chip label="Не евакуйований" color="default" />;
    
    switch (evacuation.status) {
      case 'NEEDED':
        return <Chip label="Потребує евакуації" color="warning" />;
      case 'IN_PROGRESS':
        return <Chip label="В процесі евакуації" color="primary" />;
      case 'EVACUATED':
        return <Chip label="Евакуйований" color="success" />;
      default:
        return <Chip label="Статус невідомий" color="default" />;
    }
  };

  // New function to fetch medical history
  const fetchMedicalHistory = useCallback(async () => {
    if (!devEui) return;
    
    try {
      setMedicalHistoryLoading(true);
      const response = await soldierService.getSoldierMedicalHistory(devEui, timeFilter);
      setMedicalHistory(response.data);
      setMedicalHistoryLoading(false);
    } catch (err) {
      console.error('Помилка завантаження медичної історії:', err);
      setMedicalHistoryLoading(false);
    }
  }, [devEui, timeFilter]);

  // Fetch medical history when tab changes to history or time filter changes
  useEffect(() => {
    if (tabValue === 1) {
      fetchMedicalHistory();
    }
  }, [tabValue, fetchMedicalHistory]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleTimeFilterChange = (event) => {
    setTimeFilter(event.target.value);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <Navigation />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <Navigation />
        <Container maxWidth="lg" sx={{ mt: 8, p: 3 }}>
          <Alert 
            severity="error" 
            action={
              <Button color="inherit" size="small" onClick={handleRefresh}>
                Спробувати знову
              </Button>
            }
          >
            {error}
          </Alert>
        </Container>
      </Box>
    );
  }

  if (!soldier) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <Navigation />
        <Container maxWidth="lg" sx={{ mt: 8, p: 3 }}>
          <Alert severity="info">
            Не знайдено даних про військового з ID: {devEui}
          </Alert>
          <Button 
            startIcon={<ArrowBackIcon />} 
            onClick={() => navigate('/soldiers')}
            sx={{ mt: 2 }}
          >
            Повернутися до списку
          </Button>
        </Container>
      </Box>
    );
  }

  // Add this section to render the medical history tab
  const renderMedicalHistory = () => {
    if (medicalHistoryLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (!medicalHistory || !medicalHistory.medical_records || medicalHistory.medical_records.length === 0) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          Немає медичних даних для відображення
        </Alert>
      );
    }

    // Prepare data for the chart
    const medicalRecords = [...medicalHistory.medical_records].reverse(); // Reverse to show oldest to newest
    const labels = medicalRecords.map(record => formatDate(record.timestamp));
    const spo2Data = medicalRecords.map(record => record.spo2);
    const hrData = medicalRecords.map(record => record.heart_rate);

    const chartData = {
      labels,
      datasets: [
        {
          label: 'SpO2 (%)',
          data: spo2Data,
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          yAxisID: 'y',
        },
        {
          label: 'Пульс (уд/хв)',
          data: hrData,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
          yAxisID: 'y1',
        },
      ],
    };

    const chartOptions = {
      responsive: true,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      stacked: false,
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'SpO2 (%)',
          },
          min: Math.max(0, Math.min(...spo2Data) - 5),
          max: 100,
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Пульс (уд/хв)',
          },
          min: Math.max(0, Math.min(...hrData) - 10),
          max: Math.max(...hrData) + 10,
          grid: {
            drawOnChartArea: false,
          },
        },
      },
    };

    return (
      <>
        <Box sx={{ mb: 3, mt: 2 }}>
          <FormControl variant="outlined" size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Період часу</InputLabel>
            <Select
              value={timeFilter}
              onChange={handleTimeFilterChange}
              label="Період часу"
            >
              <MenuItem value="7">7 днів</MenuItem>
              <MenuItem value="14">14 днів</MenuItem>
              <MenuItem value="30">30 днів</MenuItem>
              <MenuItem value="90">90 днів</MenuItem>
              <MenuItem value="">Весь час</MenuItem>
            </Select>
          </FormControl>
          <Button 
            variant="outlined" 
            size="medium" 
            onClick={fetchMedicalHistory}
            sx={{ ml: 2 }}
          >
            Оновити
          </Button>
        </Box>

        {medicalHistory.statistics && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Статистика
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="body2" color="text.secondary">
                    Середній SpO2:
                  </Typography>
                  <Typography variant="h6">
                    {medicalHistory.statistics.avg_spo2}%
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="body2" color="text.secondary">
                    Середній пульс:
                  </Typography>
                  <Typography variant="h6">
                    {medicalHistory.statistics.avg_heart_rate} уд/хв
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="body2" color="text.secondary">
                    Записів:
                  </Typography>
                  <Typography variant="h6">
                    {medicalHistory.statistics.records_count}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="body2" color="text.secondary">
                    Критичних станів:
                  </Typography>
                  <Typography variant="h6">
                    {medicalHistory.statistics.critical_stats.critical_both_count + 
                      medicalHistory.statistics.critical_stats.critical_spo2_count + 
                      medicalHistory.statistics.critical_stats.critical_hr_count}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Add the chart card */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Графік медичних показників
            </Typography>
            <Box sx={{ height: 400 }}>
              <Line options={chartOptions} data={chartData} />
            </Box>
          </CardContent>
        </Card>

        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Дата</TableCell>
                <TableCell>SpO2</TableCell>
                <TableCell>Пульс</TableCell>
                <TableCell>Стан</TableCell>
                <TableCell>Координати</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {medicalHistory.medical_records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{formatDate(record.timestamp)}</TableCell>
                  <TableCell>{record.spo2}%</TableCell>
                  <TableCell>{record.heart_rate} уд/хв</TableCell>
                  <TableCell>
                    {getStatusChip(record.issue_type)}
                  </TableCell>
                  <TableCell>
                    {record.latitude.toFixed(5)}, {record.longitude.toFixed(5)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navigation />
      
      <Container maxWidth="lg" sx={{ mt: 8, p: 3 }}>
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Button 
              startIcon={<ArrowBackIcon />} 
              onClick={() => navigate('/soldiers')}
              sx={{ mr: 2 }}
            >
              Назад
            </Button>
            <Typography variant="h5" component="h1">
              Профіль військового
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {refreshing && <CircularProgress size={24} sx={{ mr: 1 }} />}
            <Tooltip title="Оновити дані">
              <IconButton onClick={handleRefresh} disabled={refreshing || loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            {lastUpdate && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                Оновлено: {lastUpdate.toLocaleTimeString('uk-UA', {
                  timeZone: 'Europe/Kiev'
                })}
              </Typography>
            )}
          </Box>
        </Box>
        
        <Box sx={{ mb: 2 }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Інформація" />
            <Tab label="Історія медичних показників" />
          </Tabs>
        </Box>
        
        {tabValue === 0 ? (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <PersonIcon sx={{ fontSize: 40, mr: 2 }} />
                    <Typography variant="h5">
                      {soldier.first_name} {soldier.last_name}
                    </Typography>
                  </Box>
                  
                  <Divider sx={{ mb: 2 }} />
                  
                  <Typography variant="body1" gutterBottom>
                    <strong>Підрозділ:</strong> {soldier.unit || 'Не вказано'}
                  </Typography>
                  
                  <Typography variant="body1" gutterBottom>
                    <strong>ID пристрою (DEV EUI):</strong> {soldier.devEui}
                  </Typography>
                  
                  <Typography variant="body1" gutterBottom>
                    <strong>Дата створення профілю:</strong> {formatDate(soldier.created_at)}
                  </Typography>
                  
                  <Typography variant="body1" gutterBottom>
                    <strong>Останнє оновлення:</strong> {formatDate(soldier.last_update)}
                  </Typography>
                  
                  {soldier.time_since_last_update && (
                    <Typography variant="body1" gutterBottom>
                      <strong>Час з останнього оновлення:</strong> {soldier.time_since_last_update}
                    </Typography>
                  )}
                  
                  <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {soldier.latest_medical_data ? 
                      getStatusChip(soldier.latest_medical_data.issue_type) : 
                      <Chip label="Немає медичних даних" color="default" />
                    }
                    {getEvacuationStatusChip(soldier.evacuation)}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <HealthAndSafetyIcon sx={{ fontSize: 30, mr: 2 }} />
                    <Typography variant="h6">
                      Медичні показники
                    </Typography>
                  </Box>
                  
                  {soldier.latest_medical_data ? (
                    <>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <LocalHospitalIcon sx={{ mr: 1 }} />
                        <Typography variant="body1">
                          <strong>SpO2:</strong> {soldier.latest_medical_data.spo2}%
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <LocalHospitalIcon sx={{ mr: 1 }} />
                        <Typography variant="body1">
                          <strong>Пульс:</strong> {soldier.latest_medical_data.heart_rate} уд/хв
                        </Typography>
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Дані оновлено: {formatDate(soldier.latest_medical_data.timestamp)}
                      </Typography>
                      
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2">
                          <strong>Координати:</strong> {soldier.latest_medical_data.latitude.toFixed(5)}, {soldier.latest_medical_data.longitude.toFixed(5)}
                        </Typography>
                      </Box>
                    </>
                  ) : (
                    <Typography variant="body1" color="text.secondary">
                      Немає медичних даних для цього військового
                    </Typography>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <DirectionsCarIcon sx={{ fontSize: 30, mr: 2 }} />
                    <Typography variant="h6">
                      Управління евакуацією
                    </Typography>
                  </Box>
                  
                  {soldier.evacuation ? (
                    <>
                      <Typography variant="body1" gutterBottom>
                        <strong>Статус:</strong> {
                          soldier.evacuation.status === 'NEEDED' ? 'Потребує евакуації' :
                          soldier.evacuation.status === 'IN_PROGRESS' ? 'В процесі евакуації' :
                          soldier.evacuation.status === 'EVACUATED' ? 'Евакуйований' : 'Невідомо'
                        }
                      </Typography>
                      
                      {soldier.evacuation.evacuation_started && (
                        <Typography variant="body1" gutterBottom>
                          <strong>Початок евакуації:</strong> {formatDate(soldier.evacuation.evacuation_started)}
                        </Typography>
                      )}
                      
                      {soldier.evacuation.evacuation_time && (
                        <Typography variant="body1" gutterBottom>
                          <strong>Завершення евакуації:</strong> {formatDate(soldier.evacuation.evacuation_time)}
                        </Typography>
                      )}
                      
                      {soldier.evacuation.evacuation_team && (
                        <Typography variant="body1" gutterBottom>
                          <strong>Евакуаційна команда:</strong> {soldier.evacuation.evacuation_team}
                        </Typography>
                      )}
                    </>
                  ) : (
                    <Typography variant="body1" color="text.secondary" gutterBottom>
                      Немає даних про евакуацію
                    </Typography>
                  )}
                  
                  <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {!soldier.evacuation || soldier.evacuation.status === 'NOT_NEEDED' ? (
                      <Button 
                        variant="contained" 
                        color="warning"
                        onClick={() => handleConfirmAction('start-evacuation')}
                      >
                        Почати евакуацію
                      </Button>
                    ) : soldier.evacuation.status === 'NEEDED' ? (
                      <Button 
                        variant="contained" 
                        color="primary"
                        onClick={() => handleConfirmAction('start-evacuation')}
                      >
                        Почати евакуацію
                      </Button>
                    ) : soldier.evacuation.status === 'IN_PROGRESS' ? (
                      <>
                        <Button 
                          variant="contained" 
                          color="success"
                          onClick={() => handleConfirmAction('complete-evacuation')}
                        >
                          Завершити евакуацію
                        </Button>
                        <Button 
                          variant="outlined" 
                          color="error"
                          onClick={() => handleConfirmAction('cancel-evacuation')}
                        >
                          Скасувати евакуацію
                        </Button>
                      </>
                    ) : null}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <DevicesIcon sx={{ fontSize: 30, mr: 2 }} />
                    <Typography variant="h6">
                      ChirpStack інформація
                    </Typography>
                  </Box>
                  
                  <Typography variant="body1" gutterBottom>
                    <strong>DEV EUI:</strong> {soldier.devEui}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary">
                    Цей профіль пов'язаний з пристроєм у ChirpStack, який передає дані через LoRaWAN.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        ) : (
          <Box>
            {renderMedicalHistory()}
          </Box>
        )}
      </Container>

      <Dialog
        open={confirmDialog}
        onClose={() => setConfirmDialog(false)}
      >
        <DialogTitle>
          {action === 'start-evacuation' 
            ? 'Почати евакуацію' 
            : action === 'complete-evacuation'
              ? 'Завершити евакуацію'
              : 'Скасувати евакуацію'
          }
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {action === 'start-evacuation' 
              ? 'Ви дійсно бажаєте почати евакуацію цього військового?' 
              : action === 'complete-evacuation'
                ? 'Ви дійсно бажаєте позначити евакуацію як завершену?'
                : 'Ви дійсно бажаєте скасувати евакуацію?'
            }
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(false)} color="primary">
            Скасувати
          </Button>
          <Button 
            onClick={executeAction} 
            color={
              action === 'start-evacuation' 
                ? 'primary' 
                : action === 'complete-evacuation'
                  ? 'success'
                  : 'error'
            } 
            variant="contained"
            autoFocus
          >
            Підтвердити
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SoldierDetail; 