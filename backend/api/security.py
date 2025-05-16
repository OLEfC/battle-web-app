from django.core.exceptions import PermissionDenied
from ipware import get_client_ip
from functools import wraps
import logging
import json
from datetime import datetime
import os

# Налаштування логера
logger = logging.getLogger('security')

class SecurityMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        # Список дозволених IP адрес
        self.allowed_ips = [
            '127.0.0.1',  # localhost
            # Додайте інші дозволені IP
        ]
        
        # Режим розробки - всі IP дозволені
        self.dev_mode = os.environ.get('DEBUG', 'True').lower() == 'true'

    def __call__(self, request):
        # Отримуємо IP клієнта
        client_ip, is_routable = get_client_ip(request)
        
        # Перевірка IP лише якщо не в режимі розробки
        if not self.dev_mode and client_ip not in self.allowed_ips:
            logger.warning(f"Unauthorized access attempt from IP: {client_ip}")
            # Не викликаємо PermissionDenied, щоб API повертав 401 замість 403
            response = self.get_response(request)
            if hasattr(response, 'status_code'):
                response.status_code = 401
            return response

        # Логування запиту
        self.log_request(request, client_ip)
        
        response = self.get_response(request)
        return response

    def log_request(self, request, client_ip):
        # Не логуємо паролі та конфіденційні дані
        safe_data = {}
        if request.POST:
            safe_data = request.POST.copy()
            if 'password' in safe_data:
                safe_data['password'] = '********'
        
        log_data = {
            'timestamp': datetime.now().isoformat(),
            'ip': client_ip,
            'method': request.method,
            'path': request.path,
            'user': str(request.user),
            'data': safe_data or request.GET
        }
        logger.info(json.dumps(log_data))

# Нова функція для прямого логування дій безпеки
def log_security_action(action_type, message, request=None):
    """
    Логування дій безпеки
    
    Args:
        action_type (str): Тип дії (напр., 'login_success', 'logout', тощо)
        message (str): Повідомлення з деталями події
        request (HttpRequest, optional): Об'єкт запиту Django
    """
    log_data = {
        'timestamp': datetime.now().isoformat(),
        'action_type': action_type,
        'message': message,
        'taskName': None
    }
    
    if request:
        client_ip, _ = get_client_ip(request)
        log_data.update({
            'ip': client_ip,
            'user': str(request.user),
            'method': request.method,
            'path': request.path
        })
    else:
        log_data.update({
            'ip': None,
            'user': None,
            'method': None,
            'path': None
        })
    
    logger.info(json.dumps(log_data))

def log_action(action_type):
    def decorator(func):
        @wraps(func)
        def wrapper(self, request, *args, **kwargs):
            # Логування дії
            log_data = {
                'action_type': action_type,
                'user': str(request.user),
                'timestamp': datetime.now().isoformat(),
                'method': request.method,
                'path': request.path,
            }
            logger.info(json.dumps(log_data))
            return func(self, request, *args, **kwargs)
        return wrapper
    return decorator 