# API Документація

## Зміст
1. [Загальна інформація](#загальна-інформація)
2. [Автентифікація](#автентифікація)
3. [Користувачі](#користувачі)
4. [Пристрої](#пристрої)
5. [Дані](#дані)
6. [Налаштування](#налаштування)
7. [Помилки](#помилки)

## Загальна інформація

### Базовий URL
```
https://api.battledashboard.com/v1
```

### Формати даних
- Всі запити та відповіді використовують формат JSON
- Кодування: UTF-8
- Тип контенту: `application/json`

### Заголовки
- `Authorization: Bearer <token>` - для автентифікованих запитів
- `Content-Type: application/json` - для запитів з тілом
- `Accept: application/json` - для всіх запитів

## Автентифікація

### Реєстрація
```http
POST /auth/register
```

#### Параметри запиту
```json
{
    "username": "string",
    "email": "string",
    "password": "string",
    "first_name": "string",
    "last_name": "string"
}
```

#### Відповідь
```json
{
    "id": "integer",
    "username": "string",
    "email": "string",
    "first_name": "string",
    "last_name": "string",
    "created_at": "datetime"
}
```

### Вхід
```http
POST /auth/login
```

#### Параметри запиту
```json
{
    "username": "string",
    "password": "string"
}
```

#### Відповідь
```json
{
    "access_token": "string",
    "refresh_token": "string",
    "expires_in": "integer"
}
```

### Оновлення токену
```http
POST /auth/token/refresh
```

#### Параметри запиту
```json
{
    "refresh_token": "string"
}
```

#### Відповідь
```json
{
    "access_token": "string",
    "expires_in": "integer"
}
```

## Користувачі

### Отримання профілю
```http
GET /users/me
```

#### Відповідь
```json
{
    "id": "integer",
    "username": "string",
    "email": "string",
    "first_name": "string",
    "last_name": "string",
    "role": "string",
    "created_at": "datetime",
    "last_login": "datetime"
}
```

### Оновлення профілю
```http
PUT /users/me
```

#### Параметри запиту
```json
{
    "first_name": "string",
    "last_name": "string",
    "email": "string"
}
```

#### Відповідь
```json
{
    "id": "integer",
    "username": "string",
    "email": "string",
    "first_name": "string",
    "last_name": "string",
    "updated_at": "datetime"
}
```

### Зміна паролю
```http
POST /users/me/change-password
```

#### Параметри запиту
```json
{
    "current_password": "string",
    "new_password": "string"
}
```

#### Відповідь
```json
{
    "message": "Password successfully changed"
}
```

## Пристрої

### Список пристроїв
```http
GET /devices
```

#### Параметри запиту
- `status` (string, optional) - фільтр за статусом
- `type` (string, optional) - фільтр за типом
- `page` (integer, optional) - номер сторінки
- `limit` (integer, optional) - кількість елементів на сторінці

#### Відповідь
```json
{
    "items": [
        {
            "id": "integer",
            "name": "string",
            "type": "string",
            "status": "string",
            "last_update": "datetime",
            "location": {
                "latitude": "float",
                "longitude": "float"
            }
        }
    ],
    "total": "integer",
    "page": "integer",
    "limit": "integer"
}
```

### Деталі пристрою
```http
GET /devices/{device_id}
```

#### Відповідь
```json
{
    "id": "integer",
    "name": "string",
    "type": "string",
    "status": "string",
    "last_update": "datetime",
    "location": {
        "latitude": "float",
        "longitude": "float"
    },
    "parameters": {
        "key": "value"
    },
    "settings": {
        "key": "value"
    }
}
```

### Оновлення статусу пристрою
```http
PATCH /devices/{device_id}/status
```

#### Параметри запиту
```json
{
    "status": "string"
}
```

#### Відповідь
```json
{
    "id": "integer",
    "status": "string",
    "updated_at": "datetime"
}
```

## Дані

### Отримання даних пристрою
```http
GET /devices/{device_id}/data
```

#### Параметри запиту
- `start_date` (datetime, optional) - початкова дата
- `end_date` (datetime, optional) - кінцева дата
- `type` (string, optional) - тип даних
- `limit` (integer, optional) - кількість записів

#### Відповідь
```json
{
    "device_id": "integer",
    "data": [
        {
            "timestamp": "datetime",
            "value": "float",
            "type": "string"
        }
    ],
    "total": "integer"
}
```

### Отримання статистики
```http
GET /devices/{device_id}/statistics
```

#### Параметри запиту
- `period` (string, required) - період (day, week, month)
- `type` (string, required) - тип статистики

#### Відповідь
```json
{
    "device_id": "integer",
    "period": "string",
    "type": "string",
    "statistics": {
        "min": "float",
        "max": "float",
        "avg": "float",
        "total": "float"
    },
    "data_points": [
        {
            "timestamp": "datetime",
            "value": "float"
        }
    ]
}
```

## Налаштування

### Отримання налаштувань
```http
GET /settings
```

#### Відповідь
```json
{
    "system": {
        "key": "value"
    },
    "user": {
        "key": "value"
    }
}
```

### Оновлення налаштувань
```http
PUT /settings
```

#### Параметри запиту
```json
{
    "key": "value"
}
```

#### Відповідь
```json
{
    "key": "value",
    "updated_at": "datetime"
}
```

## Помилки

### Формат помилки
```json
{
    "error": {
        "code": "string",
        "message": "string",
        "details": {
            "field": ["string"]
        }
    }
}
```

### Коди помилок
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Unprocessable Entity
- `429` - Too Many Requests
- `500` - Internal Server Error

### Приклади помилок

#### Неавторизований доступ
```json
{
    "error": {
        "code": "UNAUTHORIZED",
        "message": "Authentication required"
    }
}
```

#### Валідація даних
```json
{
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Invalid input data",
        "details": {
            "email": ["Invalid email format"],
            "password": ["Password too short"]
        }
    }
}
```

#### Ресурс не знайдено
```json
{
    "error": {
        "code": "NOT_FOUND",
        "message": "Resource not found"
    }
}
```

## Обмеження

### Rate Limiting
- 100 запитів на хвилину для автентифікованих користувачів
- 20 запитів на хвилину для неавтентифікованих користувачів

### Розмір запиту
- Максимальний розмір тіла запиту: 1MB
- Максимальна кількість елементів у масиві: 1000

## Версіонування

### Поточна версія
- Версія API: v1
- Статус: Active
- Підтримка до: 2025-12-31

### Історія версій
- v1.0.0 (2024-01-01) - Початковий реліз
- v1.1.0 (2024-02-01) - Додано нові ендпоінти
- v1.2.0 (2024-03-01) - Оновлено формат відповідей

## Безпека

### Автентифікація
- JWT токени
- Термін дії access token: 1 година
- Термін дії refresh token: 30 днів

### Шифрування
- HTTPS для всіх запитів
- TLS 1.2 або вище
- Шифрування паролів: bcrypt

### CORS
- Дозволені домени: https://battledashboard.com
- Методи: GET, POST, PUT, PATCH, DELETE
- Заголовки: Authorization, Content-Type 