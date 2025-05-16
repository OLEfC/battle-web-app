import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  TextField, 
  Dialog, 
  DialogActions, 
  DialogContent, 
  DialogContentText, 
  DialogTitle,
  Typography,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  InputAdornment,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import RefreshIcon from '@mui/icons-material/Refresh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import { soldierService } from '../utils/api';

// Функція для генерації випадкового девайс ID (DEV EUI)
const generateRandomDevEui = () => {
  const hexChars = '0123456789ABCDEF';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += hexChars[Math.floor(Math.random() * 16)];
  }
  return result;
};

// Функція для генерації випадкового JoinEUI (EUI64)
const generateRandomJoinEui = () => {
  const hexChars = '0123456789ABCDEF';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += hexChars[Math.floor(Math.random() * 16)];
  }
  return result;
};

// Функція для генерації App Key
const generateAppKey = () => {
  const hexChars = '0123456789ABCDEF';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += hexChars[Math.floor(Math.random() * 16)];
  }
  return result;
};

// Функція для перетворення HEX рядка у формат байтів для Arduino
const hexToLittleEndianFormat = (hexString) => {
  // Видаляємо пробіли та іншi символи, якщо вони є
  hexString = hexString.replace(/[^0-9A-Fa-f]/g, '');
  
  // Перевіряємо довжину
  if (hexString.length % 2 !== 0) {
    throw new Error('Довжина HEX рядка має бути парною');
  }
  
  // Розбиваємо на пари і перевертаємо масив
  const bytes = [];
  for (let i = 0; i < hexString.length; i += 2) {
    bytes.push(hexString.substr(i, 2));
  }
  
  return bytes.reverse().map(byte => '0x' + byte.toUpperCase());
};

// Функція для форматування HEX рядка з пробілами для відображення
const formatHexWithSpaces = (hexString) => {
  // Видаляємо пробіли, якщо вони є
  hexString = hexString.replace(/\s/g, '');
  
  // Додаємо пробіли кожні 2 символи
  let result = '';
  for (let i = 0; i < hexString.length; i += 2) {
    result += hexString.substr(i, 2) + ' ';
  }
  
  return result.trim().toUpperCase();
};

// Функція для генерації файлу з налаштуваннями
const generateCredentialsFile = (devEui, joinEui, appKey) => {
  try {
    // Форматуємо для відображення (MSB)
    const formattedDevEui = formatHexWithSpaces(devEui);
    const formattedJoinEui = formatHexWithSpaces(joinEui);
    const formattedAppKey = formatHexWithSpaces(appKey);
    
    // Перетворюємо у формат little-endian для Arduino
    const leDevEui = hexToLittleEndianFormat(devEui);
    const leJoinEui = hexToLittleEndianFormat(joinEui);
    
    // APP KEY залишаємо у форматі MSB (не перетворюємо в little-endian)
    // Розбиваємо на пари для прямого формату (MSB)
    const msbAppKeyBytes = [];
    for (let i = 0; i < appKey.length; i += 2) {
      msbAppKeyBytes.push('0x' + appKey.substr(i, 2).toUpperCase());
    }
    
    // Форматуємо байти для Arduino коду
    const devEuiStr = leDevEui.join(', ');
    const joinEuiStr = leJoinEui.join(', ');
    const appKeyStr = msbAppKeyBytes.join(', ');
    
    // Створюємо вміст файлу
    const fileContent = `#ifndef CREDENTIALS_H
#define CREDENTIALS_H

#include <lmic.h>
#include <hal/hal.h>
#include <Arduino.h>

// Твої значення (MSB):
// Device EUI: ${formattedDevEui}
// Join  EUI:  ${formattedJoinEui}
// AppKey:     ${formattedAppKey}

// У little-endian треба перевернути кожен масив для DevEUI та JoinEUI:

static const u1_t PROGMEM DEVEUI[8]  = { ${devEuiStr} };
void os_getDevEui(u1_t* buf) { memcpy_P(buf, DEVEUI, 8); }

static const u1_t PROGMEM APPEUI[8]  = { ${joinEuiStr} };
void os_getArtEui(u1_t* buf) { memcpy_P(buf, APPEUI, 8); }

// AppKey — 16 байтів, використовуємо у прямому порядку (MSB):
static const u1_t PROGMEM APPKEY[16] = {
    ${appKeyStr}
};
void os_getDevKey(u1_t* buf) { memcpy_P(buf, APPKEY, 16); }

#endif
`;
    
    return fileContent;
  } catch (error) {
    console.error('Помилка генерації файлу налаштувань:', error);
    return null;
  }
};

// Функція для завантаження файлу
const downloadFile = (content, filename) => {
  const element = document.createElement('a');
  const file = new Blob([content], {type: 'text/plain'});
  element.href = URL.createObjectURL(file);
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

const AddSoldierForm = ({ onSoldierAdded }) => {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [unit, setUnit] = useState('');
  const [devEui, setDevEui] = useState(generateRandomDevEui());
  const [joinEui, setJoinEui] = useState(generateRandomJoinEui());
  const [appKey, setAppKey] = useState(generateAppKey());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState({ devEui: false, joinEui: false, appKey: false });
  const [credentialsFile, setCredentialsFile] = useState(null);

  const handleOpen = () => {
    setOpen(true);
    setError('');
    setSuccess(false);
    setCopied({ devEui: false, joinEui: false, appKey: false });
    setDevEui(generateRandomDevEui());
    setJoinEui(generateRandomJoinEui());
    setAppKey(generateAppKey());
    setCredentialsFile(null);
  };

  const handleClose = () => {
    if (!loading) {
      setOpen(false);
      setFirstName('');
      setLastName('');
      setUnit('');
    }
  };

  const handleRegenerateDevEui = () => {
    setDevEui(generateRandomDevEui());
  };

  const handleRegenerateJoinEui = () => {
    setJoinEui(generateRandomJoinEui());
  };

  const handleRegenerateAppKey = () => {
    setAppKey(generateAppKey());
  };

  const handleCopyDevEui = () => {
    navigator.clipboard.writeText(devEui).then(() => {
      setCopied({ ...copied, devEui: true });
      setTimeout(() => setCopied(prev => ({ ...prev, devEui: false })), 2000);
    });
  };

  const handleCopyJoinEui = () => {
    navigator.clipboard.writeText(joinEui).then(() => {
      setCopied({ ...copied, joinEui: true });
      setTimeout(() => setCopied(prev => ({ ...prev, joinEui: false })), 2000);
    });
  };

  const handleCopyAppKey = () => {
    navigator.clipboard.writeText(appKey).then(() => {
      setCopied({ ...copied, appKey: true });
      setTimeout(() => setCopied(prev => ({ ...prev, appKey: false })), 2000);
    });
  };

  const handleDownloadCredentials = () => {
    const content = generateCredentialsFile(devEui, joinEui, appKey);
    if (content) {
      downloadFile(content, 'credentials.h');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!firstName || !lastName || !unit || !devEui) {
      setError('Будь ласка, заповніть всі поля');
      return;
    }
    
    if (devEui.length !== 16) {
      setError('DEV EUI повинен містити 16 символів');
      return;
    }
    
    if (joinEui.length !== 16) {
      setError('JOIN EUI (EUI64) повинен містити 16 символів');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Створюємо нового солдата
      await soldierService.createSoldier({
        devEui,
        join_eui: joinEui,
        app_key: appKey,
        first_name: firstName,
        last_name: lastName,
        unit
      });
      
      // Генеруємо файл з налаштуваннями
      const fileContent = generateCredentialsFile(devEui, joinEui, appKey);
      setCredentialsFile(fileContent);
      
      // Показуємо повідомлення про успіх
      setSuccess(true);
      
      // Сповіщаємо батьківський компонент про оновлення
      if (onSoldierAdded) {
        onSoldierAdded();
      }
      
    } catch (err) {
      console.error('Помилка створення профілю:', err);
      
      const errorMessage = err.response?.data?.error || 
                           err.response?.data?.detail || 
                           'Помилка при створенні профілю військового';
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button 
        variant="contained" 
        color="primary" 
        onClick={handleOpen}
        startIcon={<PersonAddIcon />}
      >
        Додати військового
      </Button>
      
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Створення профілю військового</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Профіль військового успішно створено!
            </Alert>
          )}
          
          <DialogContentText sx={{ mb: 2 }}>
            Заповніть дані для створення профілю нового військового. Система автоматично створить 
            пристрій у ChirpStack з вказаним DEV EUI.
          </DialogContentText>
          
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              margin="normal"
              required
              fullWidth
              label="Ім'я"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={loading}
            />
            
            <TextField
              margin="normal"
              required
              fullWidth
              label="Прізвище"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={loading}
            />
            
            <TextField
              margin="normal"
              required
              fullWidth
              label="Підрозділ"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              disabled={loading}
            />
            
            <TextField
              margin="normal"
              required
              fullWidth
              label="DEV EUI (ID пристрою)"
              helperText="16-ти символьний ідентифікатор пристрою у HEX форматі"
              value={devEui}
              onChange={(e) => setDevEui(e.target.value.toUpperCase())}
              disabled={loading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Згенерувати новий DEV EUI">
                      <IconButton
                        onClick={handleRegenerateDevEui}
                        edge="end"
                        disabled={loading}
                      >
                        <RefreshIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={copied.devEui ? "Скопійовано!" : "Копіювати DEV EUI"}>
                      <IconButton
                        onClick={handleCopyDevEui}
                        edge="end"
                        disabled={loading}
                      >
                        <ContentCopyIcon />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                )
              }}
            />
            
            <TextField
              margin="normal"
              required
              fullWidth
              label="JOIN EUI (EUI64)"
              helperText="16-ти символьний ідентифікатор для приєднання до мережі"
              value={joinEui}
              onChange={(e) => setJoinEui(e.target.value.toUpperCase())}
              disabled={loading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Згенерувати новий JOIN EUI">
                      <IconButton
                        onClick={handleRegenerateJoinEui}
                        edge="end"
                        disabled={loading}
                      >
                        <RefreshIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={copied.joinEui ? "Скопійовано!" : "Копіювати JOIN EUI"}>
                      <IconButton
                        onClick={handleCopyJoinEui}
                        edge="end"
                        disabled={loading}
                      >
                        <ContentCopyIcon />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                )
              }}
            />
            
            <TextField
              margin="normal"
              required
              fullWidth
              label="APP KEY"
              helperText="32-ти символьний ключ шифрування для пристрою"
              value={appKey}
              onChange={(e) => setAppKey(e.target.value.toUpperCase())}
              disabled={loading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Згенерувати новий APP KEY">
                      <IconButton
                        onClick={handleRegenerateAppKey}
                        edge="end"
                        disabled={loading}
                      >
                        <RefreshIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={copied.appKey ? "Скопійовано!" : "Копіювати APP KEY"}>
                      <IconButton
                        onClick={handleCopyAppKey}
                        edge="end"
                        disabled={loading}
                      >
                        <ContentCopyIcon />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                )
              }}
            />
            
            <Card variant="outlined" sx={{ mt: 2, mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  ChirpStack інформація
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  При створенні профілю буде автоматично згенеровано:
                </Typography>
                <ul>
                  <li>
                    <Typography variant="body2">
                      Пристрій у ChirpStack з DEV EUI: <strong>{devEui}</strong>
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body2">
                      JOIN EUI (EUI64): <strong>{joinEui}</strong>
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body2">
                      APP KEY: <strong>{appKey}</strong>
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body2">
                      Параметри LoRaWAN
                    </Typography>
                  </li>
                </ul>
                
                {credentialsFile && (
                  <Box sx={{ mt: 2 }}>
                    <Divider sx={{ mb: 2 }} />
                    <Typography variant="subtitle2" color="success.main" gutterBottom>
                      Пристрій успішно створено!
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      onClick={handleDownloadCredentials}
                      sx={{ mt: 1 }}
                    >
                      Завантажити credentials.h
                    </Button>
                    <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                      Цей файл містить налаштування для Arduino з LoRaWAN LMIC
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Скасувати
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            color="primary" 
            disabled={loading}
            startIcon={loading && <CircularProgress size={20} />}
          >
            {loading ? 'Створення...' : 'Створити'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AddSoldierForm; 