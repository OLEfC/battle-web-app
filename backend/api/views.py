from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import action, permission_classes
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Soldier, MedicalData, Alert, Evacuation
from .serializers import SoldierSerializer, SoldierDetailSerializer, MedicalDataSerializer, AlertSerializer, EvacuationSerializer, MedicalHistorySerializer, UserSerializer, UserCreateSerializer, UserProfileSerializer, PasswordChangeSerializer
from math import sin, cos, sqrt, atan2, radians
from rest_framework.permissions import IsAuthenticated, BasePermission
from .security import log_action, log_security_action
from django.contrib.auth import logout
from django.db.models import Q
from django.contrib.auth.models import User, Group
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from .services.chirpstack import create_chirpstack_device
from django.db import models, transaction
from datetime import datetime, timedelta
from django.db.models import Count, Avg, F, Q
import random
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken

# Користувацькі права доступу
class IsMedicalStaff(BasePermission):
    """Перевірка чи користувач належить до медичного персоналу"""
    def has_permission(self, request, view):
        return request.user.groups.filter(name='medical_staff').exists()

class IsEvacuationTeam(BasePermission):
    """Перевірка чи користувач належить до групи евакуації"""
    def has_permission(self, request, view):
        return request.user.groups.filter(name='evacuation_team').exists()

class IsAnalyst(BasePermission):
    """Перевірка чи користувач є аналітиком"""
    def has_permission(self, request, view):
        return request.user.groups.filter(name='analysts').exists()

class IsAdmin(BasePermission):
    """Перевірка чи користувач є адміністратором"""
    def has_permission(self, request, view):
        return request.user.is_superuser or (hasattr(request.user, 'profile') and request.user.profile.role == 'ADMIN')

class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        serializer = UserSerializer(user)
        data = serializer.data
        # Додаємо поле is_admin
        data['is_admin'] = user.is_superuser or (hasattr(user, 'profile') and user.profile.role == 'ADMIN')
        return Response(data)
    
    def put(self, request):
        user = request.user
        serializer = UserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            user = serializer.save()
            
            # Логування оновлення профілю
            log_action(request, "update_profile")(lambda: None)()
            
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def post(self, request):
        """Змінити власний пароль"""
        user = request.user
        serializer = PasswordChangeSerializer(data=request.data)
        
        if serializer.is_valid():
            # Перевірка поточного пароля
            if not user.check_password(serializer.validated_data['old_password']):
                return Response(
                    {"error": "Неправильний поточний пароль"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            # Встановлення нового пароля
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            
            # Логування зміни пароля
            log_security_action(request, f"Користувач {user.username} змінив свій пароль")
            
            return Response({"detail": "Пароль успішно змінено"})
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class SecurityView(APIView):
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def security_audit(self, request):
        """Аудит безпеки системи"""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        # Збираємо статистику по користувачах
        total_users = User.objects.count()
        active_users = User.objects.filter(is_active=True).count()
        staff_users = User.objects.filter(is_staff=True).count()
        
        # Аналіз груп
        groups_stats = {}
        for group in Group.objects.all():
            groups_stats[group.name] = {
                'user_count': group.user_set.count(),
                'active_users': group.user_set.filter(is_active=True).count()
            }
        
        # Статистика входів
        recent_logins = User.objects.filter(
            last_login__gte=timezone.now() - timezone.timedelta(days=7)
        ).count()
        
        return Response({
            'user_statistics': {
                'total_users': total_users,
                'active_users': active_users,
                'staff_users': staff_users,
                'recent_logins': recent_logins
            },
            'groups_statistics': groups_stats,
            'security_recommendations': self.get_security_recommendations()
        })
    
    def get_security_recommendations(self):
        """Генерація рекомендацій щодо безпеки"""
        recommendations = []
        
        # Перевірка користувачів без груп
        from django.contrib.auth import get_user_model
        User = get_user_model()
        users_without_groups = User.objects.filter(groups__isnull=True).count()
        if users_without_groups > 0:
            recommendations.append({
                'level': 'warning',
                'message': f'Found {users_without_groups} users without any group assignment'
            })
        
        # Перевірка неактивних адміністраторів
        inactive_admins = User.objects.filter(
            is_superuser=True,
            is_active=False
        ).count()
        if inactive_admins > 0:
            recommendations.append({
                'level': 'critical',
                'message': f'Found {inactive_admins} inactive admin accounts'
            })
        
        return recommendations

class SoldierViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Soldier.objects.all()
    serializer_class = SoldierSerializer

    def get_permissions(self):
        """Визначення прав доступу в залежності від дії"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsAuthenticated, IsMedicalStaff]
        elif self.action in ['start_evacuation', 'complete_evacuation', 'cancel_evacuation']:
            permission_classes = [IsAuthenticated, IsEvacuationTeam]
        elif self.action in ['analytics', 'issues_summary', 'evacuation_summary']:
            permission_classes = [IsAuthenticated, IsAnalyst]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return SoldierDetailSerializer
        return SoldierSerializer

    def perform_create(self, serializer):
        """Створення нового солдата з інтеграцією Chirpstack"""
        dev_eui = serializer.validated_data.get('devEui')
        name = f"{serializer.validated_data.get('first_name')} {serializer.validated_data.get('last_name')}"
        
        # Отримуємо join_eui, якщо він переданий
        join_eui = serializer.initial_data.get('join_eui')
        
        # Отримуємо app_key, якщо він переданий
        app_key = serializer.initial_data.get('app_key')
        
        # Спроба створити пристрій в Chirpstack
        chirpstack_result = create_chirpstack_device(dev_eui, name, join_eui, app_key)
        
        # Логуємо результат, але не блокуємо створення солдата
        if not chirpstack_result:
            print(f"WARNING: Failed to create ChirpStack device for {name} with DEV EUI {dev_eui}, but continuing anyway")
        
        # Зберігаємо солдата в будь-якому випадку
        serializer.save()

    def perform_update(self, serializer):
        """Оновлення даних солдата"""
        # Перевіряємо чи змінився devEui
        if 'devEui' in serializer.validated_data and serializer.instance.devEui != serializer.validated_data['devEui']:
            raise ValidationError("Зміна devEui не дозволена")
        
        serializer.save()

    @action(detail=False, methods=['get'])
    def search(self, request):
        """Розширений пошук поранених за різними критеріями"""
        queryset = self.get_queryset()

        # Базовий текстовий пошук
        search_query = request.query_params.get('q', '')
        if search_query:
            queryset = queryset.filter(
                Q(first_name__icontains=search_query) |
                Q(last_name__icontains=search_query) |
                Q(unit__icontains=search_query) |
                Q(devEui__icontains=search_query)
            )

        # Фільтр за статусом евакуації
        evacuation_status = request.query_params.get('evacuation_status')
        if evacuation_status:
            queryset = queryset.filter(evacuation_status=evacuation_status)

        # Фільтр за підрозділом
        unit = request.query_params.get('unit')
        if unit:
            queryset = queryset.filter(unit__icontains=unit)

        # Фільтр за критичністю стану
        critical_state = request.query_params.get('critical_state')
        if critical_state:
            if critical_state == 'any':
                queryset = queryset.filter(
                    medicaldata__issue_type__in=['SPO2', 'HR', 'BOTH']
                ).distinct()
            else:
                queryset = queryset.filter(
                    medicaldata__issue_type=critical_state
                ).distinct()

        # Фільтр за часом останнього оновлення
        time_frame = request.query_params.get('time_frame')  # в хвилинах
        if time_frame:
            time_threshold = timezone.now() - timezone.timedelta(minutes=int(time_frame))
            queryset = queryset.filter(last_update__gte=time_threshold)

        # Фільтр за географічною зоною
        lat = request.query_params.get('lat')
        lon = request.query_params.get('lon')
        radius = request.query_params.get('radius')  # в кілометрах
        if all([lat, lon, radius]):
            # Створюємо список ID поранених в радіусі
            soldiers_in_radius = []
            for soldier in queryset:
                latest_data = soldier.medicaldata_set.order_by('-timestamp').first()
                if latest_data:
                    distance = self.calculate_distance(
                        float(lat), float(lon),
                        latest_data.latitude, latest_data.longitude
                    )
                    if distance <= float(radius):
                        soldiers_in_radius.append(soldier.devEui)
            queryset = queryset.filter(devEui__in=soldiers_in_radius)

        # Сортування результатів
        sort_by = request.query_params.get('sort_by', 'priority')
        if sort_by == 'priority':
            # Спочатку отримуємо всі результати
            results = self.get_serializer(queryset, many=True).data
            # Сортуємо за пріоритетом
            priority_order = {
                'CRITICAL': 0,
                'HIGH': 1,
                'WARNING': 2,
                'NORMAL': 3,
                'UNKNOWN': 4
            }
            sorted_results = sorted(
                results,
                key=lambda x: (
                    priority_order.get(x['priority_info']['level'], 999),
                    -(x.get('critical_duration', 0) or 0)  # Від більшого до меншого
                )
            )
            return Response({
                'count': len(sorted_results),
                'results': sorted_results
            })
        elif sort_by == 'last_update':
            queryset = queryset.order_by('-last_update')
        elif sort_by == 'name':
            queryset = queryset.order_by('last_name', 'first_name')

        # Пагінація результатів
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'count': queryset.count(),
            'results': serializer.data
        })

    def calculate_distance(self, lat1, lon1, lat2, lon2):
        """Розрахунок відстані між координатами в кілометрах"""
        R = 6371  # Радіус Землі в км

        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        distance = R * c
        
        return distance

    @action(detail=False, methods=['get'])
    def issues_summary(self, request):
        """Зведення по всіх проблемах"""
        not_evacuated = Soldier.objects.exclude(evacuation_status='EVACUATED')
        summary = {
            'SPO2': [],
            'HR': [],
            'BOTH': [],
            'SENSOR_ERROR': [],
            'total_wounded': not_evacuated.count()
        }

        for soldier in not_evacuated:
            latest_data = soldier.medicaldata_set.order_by('-timestamp').first()
            if latest_data and latest_data.issue_type != 'NORMAL':
                summary[latest_data.issue_type].append({
                    'soldier': self.get_serializer(soldier).data,
                    'medical_data': MedicalDataSerializer(latest_data).data
                })

        return Response({
            'summary': {
                'spo2_issues': len(summary['SPO2']),
                'hr_issues': len(summary['HR']),
                'both_issues': len(summary['BOTH']),
                'sensor_errors': len(summary['SENSOR_ERROR']),
                'total_wounded': summary['total_wounded']
            },
            'details': summary
        })

    @action(detail=False, methods=['get'])
    def evacuation_summary(self, request):
        """Зведення по статусах евакуації"""
        # Get status choices from Evacuation model
        statuses = dict(Evacuation.EVACUATION_STATUS)
        summary = {status: [] for status in statuses.keys()}
        
        # Process all soldiers with evacuation data
        for evacuation in Evacuation.objects.all():
            soldier = evacuation.soldier
            latest_data = soldier.medicaldata_set.order_by('-timestamp').first()
            
            summary[evacuation.status].append({
                'soldier': self.get_serializer(soldier).data,
                'latest_data': MedicalDataSerializer(latest_data).data if latest_data else None,
                'evacuation_time': evacuation.evacuation_time,
                'evacuation_started': evacuation.evacuation_started
            })

        # Make summary counts by status
        status_summary = {
            status: {
                'count': len(summary[status]),
                'label': statuses[status]
            } for status in statuses.keys()
        }
        
        return Response({
            'summary': status_summary,
            'details': summary
        })

    @log_action("start_evacuation")
    @action(detail=True, methods=['post'])
    def start_evacuation(self, request, pk=None):
        """Позначити початок евакуації пораненого"""
        soldier = self.get_object()
        
        # Check if an Evacuation exists for this soldier, create if not
        evacuation, created = Evacuation.objects.get_or_create(
            soldier=soldier,
            defaults={'status': 'NEEDED'}
        )
        
        # Only update if not already evacuated or in progress
        if evacuation.status not in ['EVACUATED', 'IN_PROGRESS']:
            evacuation.status = 'IN_PROGRESS'
            evacuation.evacuation_started = timezone.now()
            evacuation.save()
            
        return Response(self.get_serializer(soldier).data)

    @log_action("complete_evacuation")
    @action(detail=True, methods=['post'])
    def complete_evacuation(self, request, pk=None):
        """Позначити завершення евакуації пораненого"""
        soldier = self.get_object()
        
        try:
            evacuation = Evacuation.objects.get(soldier=soldier)
            if evacuation.status == 'IN_PROGRESS':
                evacuation.status = 'EVACUATED'
                evacuation.evacuation_time = timezone.now()
                evacuation.save()
        except Evacuation.DoesNotExist:
            pass  # No evacuation to complete
            
        return Response(self.get_serializer(soldier).data)

    @action(detail=True, methods=['post'])
    def cancel_evacuation(self, request, pk=None):
        """Скасувати евакуацію пораненого"""
        soldier = self.get_object()
        
        try:
            evacuation = Evacuation.objects.get(soldier=soldier)
            if evacuation.status == 'IN_PROGRESS':
                evacuation.status = 'NEEDED'
                evacuation.evacuation_started = None
                evacuation.save()
        except Evacuation.DoesNotExist:
            pass  # No evacuation to cancel
            
        return Response(self.get_serializer(soldier).data)

    @action(detail=False, methods=['get'])
    def in_evacuation(self, request):
        """Отримати список поранених в процесі евакуації"""
        # Get soldiers that have evacuation with IN_PROGRESS status
        soldiers_in_progress = Soldier.objects.filter(evacuation__status='IN_PROGRESS')
        data = []
        
        for soldier in soldiers_in_progress:
            latest_data = soldier.medicaldata_set.order_by('-timestamp').first()
            evacuation_duration = None
            
            try:
                evacuation = soldier.evacuation
                if evacuation.evacuation_started:
                    diff = timezone.now() - evacuation.evacuation_started
                    evacuation_duration = round(diff.total_seconds() / 60, 1)  # в хвилинах
                
                data.append({
                    'soldier': self.get_serializer(soldier).data,
                    'evacuation_started': evacuation.evacuation_started,
                    'evacuation_duration_minutes': evacuation_duration,
                    'latest_data': MedicalDataSerializer(latest_data).data if latest_data else None
                })
            except Evacuation.DoesNotExist:
                continue
        
        return Response(sorted(data, key=lambda x: x['evacuation_started']))

    @action(detail=False, methods=['get'])
    def sensor_errors(self, request):
        """Список поранених з помилками датчиків"""
        soldiers_with_errors = []
        # Get soldiers that don't have evacuation with EVACUATED status
        for soldier in Soldier.objects.exclude(evacuation__status='EVACUATED'):
            latest_data = soldier.medicaldata_set.order_by('-timestamp').first()
            if latest_data and latest_data.issue_type == 'SENSOR_ERROR':
                soldiers_with_errors.append({
                    'soldier': self.get_serializer(soldier).data,
                    'medical_data': MedicalDataSerializer(latest_data).data,
                    'error_duration': self.get_time_since_last_update(latest_data)
                })
        return Response(soldiers_with_errors)

    @action(detail=False, methods=['get'])
    def critical_vitals(self, request):
        """Поранені з критичними показниками життєдіяльності"""
        critical_soldiers = []
        # Get soldiers that don't have evacuation with EVACUATED status
        for soldier in Soldier.objects.exclude(evacuation__status='EVACUATED'):
            latest_data = soldier.medicaldata_set.order_by('-timestamp').first()
            if latest_data and latest_data.issue_type in ['SPO2', 'HR', 'BOTH']:
                critical_soldiers.append({
                    'soldier': self.get_serializer(soldier).data,
                    'medical_data': MedicalDataSerializer(latest_data).data,
                    'issue_type': latest_data.issue_type
                })
        
        return Response(sorted(
            critical_soldiers,
            key=lambda x: x['issue_type'] == 'BOTH',
            reverse=True
        ))

    @action(detail=False, methods=['get'])
    def nearby(self, request):
        """Знаходження поранених поблизу заданих координат"""
        try:
            lat = float(request.query_params.get('lat'))
            lon = float(request.query_params.get('lon'))
            radius = float(request.query_params.get('radius', 1.0))  # км
        except (TypeError, ValueError):
            return Response(
                {"error": "Необхідно вказати правильні координати"},
                status=status.HTTP_400_BAD_REQUEST
            )

        nearby = []
        # Get soldiers that don't have evacuation with EVACUATED status
        for soldier in Soldier.objects.exclude(evacuation__status='EVACUATED'):
            latest_data = soldier.medicaldata_set.order_by('-timestamp').first()
            if latest_data:
                distance = self.calculate_distance(
                    lat, lon,
                    latest_data.latitude,
                    latest_data.longitude
                )
                if distance <= radius:
                    nearby.append({
                        'soldier': self.get_serializer(soldier).data,
                        'distance': round(distance, 2),
                        'medical_data': MedicalDataSerializer(latest_data).data
                    })
        
        return Response(sorted(nearby, key=lambda x: x['distance']))

    def get_time_since_last_update(self, medical_data):
        """Розрахунок часу з моменту останнього оновлення"""
        if medical_data.timestamp:
            now = timezone.now()
            diff = now - medical_data.timestamp
            minutes = diff.total_seconds() / 60
            return round(minutes, 1)
        return None

    @action(detail=False, methods=['get'])
    def prioritized(self, request):
        """Отримати список поранених, відсортований за пріоритетом"""
        try:
            # Виключаємо евакуйованих солдатів використовуючи is_evacuated
            soldiers = Soldier.objects.all()
            non_evacuated_soldiers = [s for s in soldiers if not s.is_evacuated]
            
            # Дані для фронтенду - потрібен плоский список
            result_list = []
            
            for soldier in non_evacuated_soldiers:
                # Отримуємо останні медичні дані
                try:
                    latest_data = MedicalData.objects.filter(device=soldier).order_by('-timestamp').first()
                    serialized_soldier = SoldierDetailSerializer(soldier).data
                    
                    if latest_data:
                        # Додаємо останні дані до даних солдата
                        serialized_soldier['latest_data'] = MedicalDataSerializer(latest_data).data
                        
                        # Додаємо пріоритет за типом проблеми
                        if latest_data.issue_type == 'BOTH':
                            serialized_soldier['priority'] = 1  # критичний
                        elif latest_data.issue_type in ['SPO2', 'HR']:
                            serialized_soldier['priority'] = 2  # високий
                        elif latest_data.issue_type == 'SENSOR_ERROR':
                            serialized_soldier['priority'] = 3  # попередження
                        else:
                            serialized_soldier['priority'] = 4  # нормальний
                    else:
                        # Якщо немає даних, додаємо порожні значення та найнижчий пріоритет
                        serialized_soldier['latest_data'] = None
                        serialized_soldier['priority'] = 5  # невідомий/немає даних
                    
                    # Додаємо дані евакуації, якщо вони є
                    try:
                        evacuation = soldier.evacuation
                        serialized_soldier['evacuation'] = EvacuationSerializer(evacuation).data
                    except Evacuation.DoesNotExist:
                        serialized_soldier['evacuation'] = None
                    
                    # Додаємо у загальний список
                    result_list.append(serialized_soldier)
                    
                except Exception as e:
                    # Логування помилки
                    print(f"Помилка при обробці солдата {soldier.devEui}: {str(e)}")
                    continue
            
            # Сортуємо за пріоритетом (спочатку критичні)
            result_list.sort(key=lambda x: x.get('priority', 5))
            
            return Response(result_list)
        except Exception as e:
            # Детальне логування помилки для відлагодження
            import traceback
            print(f"Глобальна помилка в prioritized: {str(e)}")
            print(traceback.format_exc())
            return Response(
                {"error": f"Internal server error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        """Розширена аналітика системи"""
        time_period = request.query_params.get('time_period', '24h')  # 24h, 7d, 30d
        
        # Визначаємо часовий період
        now = timezone.now()
        if time_period == '7d':
            start_time = now - timezone.timedelta(days=7)
        elif time_period == '30d':
            start_time = now - timezone.timedelta(days=30)
        else:  # 24h за замовчуванням
            start_time = now - timezone.timedelta(hours=24)

        # Статистика евакуації
        evacuation_stats = self.get_evacuation_analytics(start_time)
        
        # Аналіз часу реагування
        response_time_stats = self.get_response_time_analytics(start_time)
        
        # Географічний аналіз
        geo_stats = self.get_geographical_analytics(start_time)
        
        # Аналіз критичних станів
        critical_stats = self.get_critical_state_analytics(start_time)
        
        # Загальна статистика системи
        system_stats = self.get_system_performance_stats(start_time)
        
        return Response({
            'evacuation_statistics': evacuation_stats,
            'response_time_statistics': response_time_stats,
            'geographical_statistics': geo_stats,
            'critical_state_statistics': critical_stats,
            'system_performance': system_stats,
            'time_period': time_period,
            'generated_at': timezone.now()
        })

    def get_evacuation_analytics(self, start_time):
        """Аналітика евакуації"""
        evacuated = Soldier.objects.filter(
            evacuation_status='EVACUATED',
            evacuation_time__gte=start_time
        )
        
        total_evacuated = evacuated.count()
        avg_evacuation_time = 0
        evacuation_times = []
        
        for soldier in evacuated:
            if soldier.evacuation_time and soldier.evacuation_started:
                time_diff = soldier.evacuation_time - soldier.evacuation_started
                evacuation_times.append(time_diff.total_seconds() / 60)  # в хвилинах
        
        if evacuation_times:
            avg_evacuation_time = sum(evacuation_times) / len(evacuation_times)
        
        return {
            'total_evacuated': total_evacuated,
            'average_evacuation_time_minutes': round(avg_evacuation_time, 2),
            'evacuation_success_rate': round(
                total_evacuated / max(Soldier.objects.filter(
                    created_at__gte=start_time
                ).count(), 1) * 100, 2
            ),
            'evacuation_time_distribution': {
                'under_30min': len([t for t in evacuation_times if t <= 30]),
                '30_60min': len([t for t in evacuation_times if 30 < t <= 60]),
                'over_60min': len([t for t in evacuation_times if t > 60])
            }
        }

    def get_response_time_analytics(self, start_time):
        """Аналіз часу реагування на критичні стани"""
        alerts = Alert.objects.filter(created_at__gte=start_time)
        response_times = []
        
        for alert in alerts:
            if alert.is_read:
                response_time = (alert.read_at - alert.created_at).total_seconds() / 60
                response_times.append(response_time)
        
        return {
            'total_alerts': alerts.count(),
            'average_response_time_minutes': round(
                sum(response_times) / len(response_times) if response_times else 0, 2
            ),
            'response_time_distribution': {
                'under_5min': len([t for t in response_times if t <= 5]),
                '5_15min': len([t for t in response_times if 5 < t <= 15]),
                'over_15min': len([t for t in response_times if t > 15])
            },
            'unread_alerts': alerts.filter(is_read=False).count()
        }

    def get_geographical_analytics(self, start_time):
        """Географічний аналіз розподілу поранених"""
        medical_data = MedicalData.objects.filter(timestamp__gte=start_time)
        
        # Групуємо дані по координатах з округленням до 0.01 градуса
        location_clusters = {}
        for data in medical_data:
            key = (round(data.latitude, 2), round(data.longitude, 2))
            if key not in location_clusters:
                location_clusters[key] = {
                    'count': 0,
                    'critical_cases': 0,
                    'coordinates': {'lat': key[0], 'lng': key[1]}
                }
            location_clusters[key]['count'] += 1
            if data.issue_type in ['SPO2', 'HR', 'BOTH']:
                location_clusters[key]['critical_cases'] += 1
        
        return {
            'location_clusters': list(location_clusters.values()),
            'total_locations': len(location_clusters),
            'highest_concentration': max(
                [cluster['count'] for cluster in location_clusters.values()]
            ) if location_clusters else 0
        }

    def get_critical_state_analytics(self, start_time):
        """Аналіз критичних станів"""
        medical_data = MedicalData.objects.filter(timestamp__gte=start_time)
        
        critical_cases = medical_data.filter(issue_type__in=['SPO2', 'HR', 'BOTH'])
        total_cases = medical_data.count()
        
        return {
            'total_critical_cases': critical_cases.count(),
            'critical_rate': round(
                critical_cases.count() / max(total_cases, 1) * 100, 2
            ),
            'issue_distribution': {
                'spo2': medical_data.filter(issue_type='SPO2').count(),
                'heart_rate': medical_data.filter(issue_type='HR').count(),
                'both': medical_data.filter(issue_type='BOTH').count(),
                'sensor_errors': medical_data.filter(issue_type='SENSOR_ERROR').count()
            },
            'average_critical_duration_minutes': self.calculate_average_critical_duration(
                start_time
            )
        }

    def get_system_performance_stats(self, start_time):
        """Загальна статистика роботи системи"""
        total_soldiers = Soldier.objects.filter(created_at__gte=start_time).count()
        total_medical_records = MedicalData.objects.filter(timestamp__gte=start_time).count()
        
        # Аналіз активності датчиків
        active_sensors = Soldier.objects.filter(
            medicaldata__timestamp__gte=start_time
        ).distinct().count()
        
        # Статистика помилок датчиків
        sensor_errors = MedicalData.objects.filter(
            timestamp__gte=start_time,
            issue_type='SENSOR_ERROR'
        ).count()
        
        return {
            'total_soldiers_monitored': total_soldiers,
            'total_medical_records': total_medical_records,
            'records_per_soldier': round(
                total_medical_records / max(total_soldiers, 1), 2
            ),
            'active_sensors': active_sensors,
            'sensor_reliability': round(
                (1 - sensor_errors / max(total_medical_records, 1)) * 100, 2
            ),
            'system_coverage': round(
                active_sensors / max(total_soldiers, 1) * 100, 2
            )
        }

    def calculate_average_critical_duration(self, start_time):
        """Розрахунок середньої тривалості критичного стану"""
        soldiers = Soldier.objects.filter(
            medicaldata__timestamp__gte=start_time,
            medicaldata__issue_type__in=['SPO2', 'HR', 'BOTH']
        ).distinct()
        
        total_duration = 0
        count = 0
        
        for soldier in soldiers:
            _, duration = check_critical_duration(soldier)
            if duration > 0:
                total_duration += duration
                count += 1
        
        return round(total_duration / max(count, 1), 2)

    @action(detail=True, methods=['get'])
    def medical_history(self, request, pk=None):
        """Отримати історію медичних показників солдата"""
        soldier = self.get_object()  # Soldier object directly
        
        # Отримуємо всі медичні дані для солдата, відсортовані за часом (найновіші спочатку)
        medical_records = MedicalData.objects.filter(device=soldier).order_by('-timestamp')
        
        # Опційна фільтрація за часовим періодом
        days = request.query_params.get('days')
        if days:
            try:
                days = int(days)
                date_threshold = timezone.now() - timezone.timedelta(days=days)
                medical_records = medical_records.filter(timestamp__gte=date_threshold)
            except ValueError:
                return Response(
                    {"error": "Параметр 'days' повинен бути цілим числом"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Серіалізуємо дані для відповіді
        serializer = MedicalDataSerializer(medical_records, many=True)
        
        # Додаємо додаткову інформацію про статистику
        stats = {}
        if medical_records.exists():
            # Середні показники
            avg_spo2 = sum(record.spo2 for record in medical_records if record.spo2 > 0) / max(
                sum(1 for record in medical_records if record.spo2 > 0), 1
            )
            avg_heart_rate = sum(record.heart_rate for record in medical_records if record.heart_rate > 0) / max(
                sum(1 for record in medical_records if record.heart_rate > 0), 1
            )
            
            # Кількість критичних записів за типом
            critical_spo2_count = medical_records.filter(issue_type__in=['SPO2', 'BOTH']).count()
            critical_hr_count = medical_records.filter(issue_type__in=['HR', 'BOTH']).count()
            critical_both_count = medical_records.filter(issue_type='BOTH').count()
            
            stats = {
                'avg_spo2': round(avg_spo2, 1),
                'avg_heart_rate': round(avg_heart_rate, 1),
                'records_count': medical_records.count(),
                'first_record_date': medical_records.last().timestamp if medical_records.last() else None,
                'last_record_date': medical_records.first().timestamp if medical_records.first() else None,
                'critical_stats': {
                    'critical_spo2_count': critical_spo2_count,
                    'critical_hr_count': critical_hr_count,
                    'critical_both_count': critical_both_count,
                    'sensor_errors': medical_records.filter(issue_type='SENSOR_ERROR').count()
                }
            }
        
        # Також знаходимо дані евакуації, якщо є
        try:
            evacuation = Evacuation.objects.get(soldier=soldier)
            evacuation_data = EvacuationSerializer(evacuation).data
        except Evacuation.DoesNotExist:
            evacuation_data = None
        
        return Response({
            'soldier': SoldierDetailSerializer(soldier).data,
            'evacuation': evacuation_data,
            'statistics': stats,
            'medical_records': serializer.data
        })

def check_critical_duration(soldier):
    """Перевіряє тривалість критичного стану"""
    critical_records = MedicalData.objects.filter(
        device=soldier,
        issue_type__in=['SPO2', 'HR', 'BOTH']
    ).order_by('-timestamp')

    if critical_records.exists():
        first_critical = critical_records.last()
        duration = timezone.now() - first_critical.timestamp
        # Якщо в критичному стані більше 15 хвилин
        if duration.total_seconds() > 900:  # 15 хвилин = 900 секунд
            return True, duration.total_seconds() / 60
    return False, 0

def create_alert(soldier, medical_data, alert_type=None, message=None):
    """Створює сповіщення на основі медичних даних"""
    if not alert_type:
        # Якщо тип сповіщення не вказано, визначаємо його на основі даних
        if medical_data.issue_type in ['SPO2', 'HR', 'BOTH']:
            alert_type = 'CRITICAL_STATE'
        else:
            alert_type = 'NEW_CASUALTY'

    if not message:
        if alert_type == 'NEW_CASUALTY':
            message = f'Виявлено нового пораненого: {soldier.first_name} {soldier.last_name}'
        elif alert_type == 'CRITICAL_STATE':
            message = f'Критичний стан: {soldier.first_name} {soldier.last_name}'
        elif alert_type == 'CRITICAL_DURATION':
            message = f'Тривалий критичний стан: {soldier.first_name} {soldier.last_name}'

    # Перевіряємо чи не існує вже такого сповіщення
    if not Alert.objects.filter(
        soldier=soldier,
        alert_type=alert_type,
        is_read=False
    ).exists():
        Alert.objects.create(
            soldier=soldier,
            alert_type=alert_type,
            message=message,
            details={
                'location': {
                    'lat': medical_data.latitude,
                    'lng': medical_data.longitude
                },
                'vitals': {
                    'spo2': medical_data.spo2,
                    'heart_rate': medical_data.heart_rate
                },
                'issue_type': medical_data.issue_type
            }
        )

class MedicalDataViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MedicalData.objects.all().order_by('-timestamp')
    serializer_class = MedicalDataSerializer
    
    def get_queryset(self):
        queryset = MedicalData.objects.all().order_by('-timestamp')
        
        # Фільтрація за ідентифікатором пристрою
        device_id = self.request.query_params.get('device', None)
        if device_id:
            queryset = queryset.filter(device__devEui=device_id)
        
        # Фільтрація за типом проблеми
        issue_type = self.request.query_params.get('issue_type', None)
        if issue_type:
            queryset = queryset.filter(issue_type=issue_type)
        
        # Кількість днів для фільтрації
        days = self.request.query_params.get('days', None)
        if days:
            date_threshold = timezone.now() - timezone.timedelta(days=int(days))
            queryset = queryset.filter(timestamp__gte=date_threshold)
        
        return queryset

class AlertViewSet(viewsets.ModelViewSet):
    queryset = Alert.objects.all().order_by('-created_at')
    serializer_class = AlertSerializer
    
    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        alert = self.get_object()
        if not alert.is_read:
            alert.is_read = True
            alert.read_at = timezone.now()
            alert.save()
        return Response({'status': 'success'})
    
    @action(detail=False, methods=['post'])
    def mark_all_as_read(self, request):
        unread_alerts = Alert.objects.filter(is_read=False)
        current_time = timezone.now()
        for alert in unread_alerts:
            alert.is_read = True
            alert.read_at = current_time
            alert.save()
        return Response({'status': 'success', 'count': unread_alerts.count()})
    
    @action(detail=False, methods=['get'])
    def unread(self, request):
        unread_alerts = Alert.objects.filter(is_read=False).order_by('-created_at')
        serializer = self.get_serializer(unread_alerts, many=True)
        return Response(serializer.data)

class EvacuationViewSet(viewsets.ModelViewSet):
    queryset = Evacuation.objects.all()
    serializer_class = EvacuationSerializer
    
    @action(detail=False, methods=['get'])
    def needs_evacuation(self, request):
        # Повертає список поранених, які потребують евакуації
        evacuations = Evacuation.objects.filter(status='NEEDED').order_by('-priority')
        soldiers = []
        
        for evacuation in evacuations:
            soldier_data = SoldierDetailSerializer(evacuation.soldier).data
            soldiers.append(soldier_data)
        
        return Response(soldiers)
    
    @action(detail=True, methods=['post'])
    def start_evacuation(self, request, pk=None):
        evacuation = self.get_object()
        
        # Перевіряємо, чи евакуація вже не розпочата
        if evacuation.status in ['IN_PROGRESS', 'EVACUATED']:
            return Response(
                {"error": f"Евакуація вже {evacuation.get_status_display().lower()}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Оновлюємо статус та час початку евакуації
        evacuation.status = 'IN_PROGRESS'
        evacuation.evacuation_started = timezone.now()
        
        # Додаткові дані з запиту
        if 'evacuation_team' in request.data:
            evacuation.evacuation_team = request.data['evacuation_team']
        
        evacuation.save()
        
        # Логування дії
        log_action(request, f"Розпочато евакуацію пораненого {evacuation.soldier.first_name} {evacuation.soldier.last_name}")
        
        return Response(EvacuationSerializer(evacuation).data)
    
    @action(detail=True, methods=['post'])
    def complete_evacuation(self, request, pk=None):
        evacuation = self.get_object()
        
        # Перевіряємо, чи евакуація не завершена
        if evacuation.status == 'EVACUATED':
            return Response(
                {"error": "Евакуація вже завершена"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Оновлюємо статус та час завершення евакуації
        evacuation.status = 'EVACUATED'
        evacuation.evacuation_time = timezone.now()
        evacuation.save()
        
        # Логування дії
        log_action(request, f"Завершено евакуацію пораненого {evacuation.soldier.first_name} {evacuation.soldier.last_name}")
        
        return Response(EvacuationSerializer(evacuation).data)

    @action(detail=True, methods=['get'])
    def medical_history(self, request, pk=None):
        """Отримати історію медичних показників солдата прив'язаного до евакуації"""
        evacuation = self.get_object()
        soldier = evacuation.soldier
        
        # Отримуємо всі медичні дані для солдата, відсортовані за часом (найновіші спочатку)
        medical_records = MedicalData.objects.filter(device=soldier).order_by('-timestamp')
        
        # Опційна фільтрація за часовим періодом
        days = request.query_params.get('days')
        if days:
            try:
                days = int(days)
                date_threshold = timezone.now() - timezone.timedelta(days=days)
                medical_records = medical_records.filter(timestamp__gte=date_threshold)
            except ValueError:
                return Response(
                    {"error": "Параметр 'days' повинен бути цілим числом"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Серіалізуємо дані для відповіді
        serializer = MedicalDataSerializer(medical_records, many=True)
        
        # Додаємо додаткову інформацію про статистику
        stats = {}
        if medical_records.exists():
            # Середні показники
            avg_spo2 = sum(record.spo2 for record in medical_records if record.spo2 > 0) / max(
                sum(1 for record in medical_records if record.spo2 > 0), 1
            )
            avg_heart_rate = sum(record.heart_rate for record in medical_records if record.heart_rate > 0) / max(
                sum(1 for record in medical_records if record.heart_rate > 0), 1
            )
            
            # Кількість критичних записів за типом
            critical_spo2_count = medical_records.filter(issue_type__in=['SPO2', 'BOTH']).count()
            critical_hr_count = medical_records.filter(issue_type__in=['HR', 'BOTH']).count()
            critical_both_count = medical_records.filter(issue_type='BOTH').count()
            
            stats = {
                'avg_spo2': round(avg_spo2, 1),
                'avg_heart_rate': round(avg_heart_rate, 1),
                'records_count': medical_records.count(),
                'first_record_date': medical_records.last().timestamp if medical_records.last() else None,
                'last_record_date': medical_records.first().timestamp if medical_records.first() else None,
                'critical_stats': {
                    'critical_spo2_count': critical_spo2_count,
                    'critical_hr_count': critical_hr_count,
                    'critical_both_count': critical_both_count,
                    'sensor_errors': medical_records.filter(issue_type='SENSOR_ERROR').count()
                }
            }
        
        return Response({
            'soldier': SoldierDetailSerializer(soldier).data,
            'evacuation': EvacuationSerializer(evacuation).data,
            'statistics': stats,
            'medical_records': serializer.data
        })

    @action(detail=True, methods=['get'])
    def near_soldiers(self, request, pk=None):
        evacuation = self.get_object()
        
        # Отримуємо останні дані пораненого для визначення координат
        latest_data = MedicalData.objects.filter(device=evacuation.soldier).order_by('-timestamp').first()
        if not latest_data:
            return Response({"error": "Немає даних про місцезнаходження"}, status=status.HTTP_404_NOT_FOUND)
        
        # Радіус пошуку в кілометрах
        search_radius = float(request.query_params.get('radius', 0.5))
        
        # Список поранених, які знаходяться поруч
        nearby_soldiers = []
        
        # Перебираємо всіх поранених
        for other_soldier in Soldier.objects.all().exclude(devEui=evacuation.soldier.devEui):
            # Перевіряємо останні дані місцезнаходження
            other_latest = MedicalData.objects.filter(device=other_soldier).order_by('-timestamp').first()
            if not other_latest:
                continue
                
            # Визначаємо відстань між пораненими
            distance = self.calculate_distance(
                latest_data.latitude, latest_data.longitude,
                other_latest.latitude, other_latest.longitude
            )
            
            # Якщо відстань менша за радіус пошуку, додаємо до списку
            if distance <= search_radius:
                soldier_data = SoldierSerializer(other_soldier).data
                soldier_data['distance'] = round(distance * 1000, 1)  # Переводимо в метри
                soldier_data['coordinates'] = {
                    'latitude': other_latest.latitude,
                    'longitude': other_latest.longitude
                }
                nearby_soldiers.append(soldier_data)
        
        return Response(nearby_soldiers)
    
    def calculate_distance(self, lat1, lon1, lat2, lon2):
        # Радіус Землі в км
        R = 6371.0
        
        # Конвертуємо координати в радіани
        lat1_rad = radians(lat1)
        lon1_rad = radians(lon1)
        lat2_rad = radians(lat2)
        lon2_rad = radians(lon2)
        
        # Різниця між координатами
        dlon = lon2_rad - lon1_rad
        dlat = lat2_rad - lat1_rad
        
        # Формула гаверсинуса
        a = sin(dlat / 2)**2 + cos(lat1_rad) * cos(lat2_rad) * sin(dlon / 2)**2
        c = 2 * atan2(sqrt(a), sqrt(1 - a))
        
        # Відстань у кілометрах
        distance = R * c
        
        return distance

# Ролі користувачів
class UserManagementView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def get(self, request):
        """Отримати список всіх користувачів"""
        users = User.objects.all().order_by('username')
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)
    
    def post(self, request):
        """Створити нового користувача"""
        serializer = UserCreateSerializer(data=request.data)
        if serializer.is_valid():
            try:
                user = serializer.save()
                
                # Логування створення користувача
                log_security_action(request, f"Створено нового користувача: {user.username}")
                
                return Response(
                    UserSerializer(user).data,
                    status=status.HTTP_201_CREATED
                )
            except Exception as e:
                return Response(
                    {"error": f"Помилка при створенні користувача: {str(e)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def get_object(self, pk):
        try:
            return User.objects.get(pk=pk)
        except User.DoesNotExist:
            raise Http404
    
    def get(self, request, pk):
        """Отримати дані користувача"""
        user = self.get_object(pk)
        serializer = UserSerializer(user)
        return Response(serializer.data)
    
    def put(self, request, pk):
        """Оновити дані користувача"""
        user = self.get_object(pk)
        serializer = UserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            try:
                user = serializer.save()
                
                # Логування оновлення користувача
                log_security_action(request, f"Оновлено дані користувача: {user.username}")
                
                return Response(serializer.data)
            except Exception as e:
                return Response(
                    {"error": f"Помилка при оновленні користувача: {str(e)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def delete(self, request, pk):
        """Видалити користувача"""
        try:
            with transaction.atomic():
                user = self.get_object(pk)
                username = user.username
                
                # Не дозволяємо видаляти самого себе
                if user == request.user:
                    return Response(
                        {"error": "Неможливо видалити власний обліковий запис"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Видаляємо всі токени користувача
                OutstandingToken.objects.filter(user_id=user.id).delete()
                
                # Видаляємо профіль користувача
                if hasattr(user, 'profile'):
                    user.profile.delete()
                
                # Видаляємо користувача
                user.delete()
                
                # Логування видалення користувача
                log_security_action(request, f"Видалено користувача: {username}")
                
                return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            return Response(
                {"error": f"Помилка при видаленні користувача: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

class UserPasswordChangeView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    
    def get_object(self, pk):
        try:
            return User.objects.get(pk=pk)
        except User.DoesNotExist:
            raise Http404
    
    def post(self, request, pk):
        """Змінити пароль користувача (адміністративно)"""
        user = self.get_object(pk)
        
        # Для адміністративної зміни пароля не потрібен старий пароль
        if 'new_password' in request.data and 'new_password2' in request.data:
            if request.data['new_password'] != request.data['new_password2']:
                return Response(
                    {"error": "Паролі не співпадають"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            try:
                validate_password(request.data['new_password'], user)
            except ValidationError as e:
                return Response(
                    {"error": e.messages},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            user.set_password(request.data['new_password'])
            user.save()
            
            # Логування зміни пароля
            log_security_action(request, f"Адміністративно змінено пароль користувача: {user.username}")
            
            return Response({"detail": "Пароль успішно змінено"})
        
        return Response(
            {"error": "Будь ласка, надайте новий пароль"},
            status=status.HTTP_400_BAD_REQUEST
        )
