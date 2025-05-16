"""
URL configuration for battle_dashboard project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from api.views import (
    SoldierViewSet, MedicalDataViewSet, AlertViewSet, EvacuationViewSet, 
    UserProfileView, SecurityView, UserManagementView, UserDetailView, 
    UserPasswordChangeView
)
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.auth import views as auth_views
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from django.http import JsonResponse

# Функція для логіну через API
@csrf_exempt
def api_login(request):
    """API-орієнтований логін для фронтенду"""
    if request.method == 'POST':
        from django.contrib.auth import authenticate, login
        import json
        
        data = json.loads(request.body)
        username = data.get('username')
        password = data.get('password')
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            login(request, user)
            return JsonResponse({
                'success': True,
                'username': username,
                'user_id': user.id
            })
        else:
            return JsonResponse({
                'success': False,
                'message': 'Неправильне ім\'я користувача або пароль'
            }, status=401)
    
    return JsonResponse({'detail': 'Method not allowed'}, status=405)

# Функція для отримання CSRF токену
@ensure_csrf_cookie
def get_csrf_token(request):
    """Повертає CSRF токен для фронтенду"""
    return JsonResponse({'detail': 'CSRF cookie set'})

# Функція для виходу через API
def api_logout(request):
    """API-орієнтований вихід для фронтенду"""
    from django.contrib.auth import logout
    
    if request.method == 'POST':
        logout(request)
        return JsonResponse({'success': True})
    
    return JsonResponse({'detail': 'Method not allowed'}, status=405)

router = DefaultRouter()
router.register(r'soldiers', SoldierViewSet)
router.register(r'medical-data', MedicalDataViewSet)
router.register(r'alerts', AlertViewSet)
router.register(r'evacuations', EvacuationViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    # Нові API-орієнтовані URL для автентифікації
    path('api/auth/', get_csrf_token, name='csrf-token'),
    path('api/auth/login/', api_login, name='api-login'),
    path('api/auth/logout/', api_logout, name='api-logout'),
    # Стандартні URL для DRF interface
    path('api-auth/', include('rest_framework.urls')),
    path('api/profile/', UserProfileView.as_view(), name='user-profile'),
    path('api/security/', SecurityView.as_view(), name='security-info'),
    # Нові URL для керування користувачами
    path('api/users/', UserManagementView.as_view(), name='user-management'),
    path('api/users/<int:pk>/', UserDetailView.as_view(), name='user-detail'),
    path('api/users/<int:pk>/change-password/', UserPasswordChangeView.as_view(), name='user-change-password'),
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
