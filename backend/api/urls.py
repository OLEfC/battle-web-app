from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SoldierViewSet, MedicalDataViewSet

router = DefaultRouter()
router.register(r'soldiers', SoldierViewSet)
router.register(r'medical-data', MedicalDataViewSet)

urlpatterns = [
    path('', include(router.urls)),
] 