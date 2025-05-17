from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SoldierViewSet, 
    MedicalDataViewSet, 
    AlertViewSet, 
    EvacuationViewSet,
    ProfileViewSet,
    UserProfileView,
    UserManagementView,
    UserDetailView,
    UserPasswordChangeView,
    SecurityView
)

router = DefaultRouter()
router.register(r'soldiers', SoldierViewSet)
router.register(r'medical-data', MedicalDataViewSet)
router.register(r'alerts', AlertViewSet)
router.register(r'evacuations', EvacuationViewSet)
router.register(r'profiles', ProfileViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('user/profile/', UserProfileView.as_view(), name='user-profile'),
    path('user/management/', UserManagementView.as_view(), name='user-management'),
    path('user/<int:pk>/', UserDetailView.as_view(), name='user-detail'),
    path('user/<int:pk>/password/', UserPasswordChangeView.as_view(), name='user-password-change'),
    path('security/', SecurityView.as_view(), name='security'),
] 