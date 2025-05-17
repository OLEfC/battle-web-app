from rest_framework import serializers
from .models import Soldier, MedicalData, Alert, Evacuation, UserProfile
from django.utils import timezone
from django.contrib.auth.models import User, Group
from django.contrib.auth.password_validation import validate_password
from django.db import transaction

class MedicalDataSerializer(serializers.ModelSerializer):
    issue_type_display = serializers.SerializerMethodField()
    
    class Meta:
        model = MedicalData
        fields = ['id', 'device', 'spo2', 'heart_rate', 'latitude', 'longitude', 'timestamp', 'issue_type', 'issue_type_display']
    
    def get_issue_type_display(self, obj):
        descriptions = {
            'SPO2': 'Критичний рівень кисню у крові',
            'HR': 'Критичний пульс',
            'BOTH': 'Критичні SpO2 та пульс',
            'SENSOR_ERROR': 'Помилка датчиків',
            'NORMAL': 'Показники в нормі'
        }
        return descriptions.get(obj.issue_type, '')

class EvacuationSerializer(serializers.ModelSerializer):
    status_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Evacuation
        fields = ['id', 'soldier', 'status', 'status_display', 'evacuation_time', 'evacuation_started', 'evacuation_team', 'priority', 'notes', 'last_update']
    
    def get_status_display(self, obj):
        return obj.get_status_display()

class SoldierSerializer(serializers.ModelSerializer):
    is_evacuated = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Soldier
        fields = ['devEui', 'first_name', 'last_name', 'unit', 'is_evacuated', 'last_update', 'created_at']

class SoldierDetailSerializer(serializers.ModelSerializer):
    evacuation = EvacuationSerializer(read_only=True)
    latest_medical_data = serializers.SerializerMethodField()
    time_since_last_update = serializers.SerializerMethodField()
    priority_info = serializers.SerializerMethodField()
    critical_duration = serializers.SerializerMethodField()
    
    class Meta:
        model = Soldier
        fields = ['devEui', 'first_name', 'last_name', 'unit', 'evacuation', 'latest_medical_data', 'time_since_last_update', 'priority_info', 'critical_duration', 'last_update', 'created_at']
    
    def get_latest_medical_data(self, obj):
        latest_data = MedicalData.objects.filter(device=obj).order_by('-timestamp').first()
        if latest_data:
            return MedicalDataSerializer(latest_data).data
        return None
    
    def get_time_since_last_update(self, obj):
        latest_data = MedicalData.objects.filter(device=obj).order_by('-timestamp').first()
        if not latest_data:
            return "Немає даних"
            
        time_diff = timezone.now() - latest_data.timestamp
        hours = time_diff.seconds // 3600
        minutes = (time_diff.seconds % 3600) // 60
        
        if time_diff.days > 0:
            return f"{time_diff.days} д {hours} год"
        elif hours > 0:
            return f"{hours} год {minutes} хв"
        else:
            return f"{minutes} хв"
    
    def get_priority_info(self, obj):
        try:
            evacuation = obj.evacuation
            return evacuation.priority if evacuation else 0
        except Evacuation.DoesNotExist:
            return 0
    
    def get_critical_duration(self, obj):
        # Час у критичному стані
        latest_data = MedicalData.objects.filter(
            device=obj, 
            issue_type__in=['SPO2', 'HR', 'BOTH']
        ).order_by('-timestamp').first()
        
        if not latest_data:
            return 0
            
        time_diff = timezone.now() - latest_data.timestamp
        return time_diff.seconds // 60  # Повертаємо хвилини

class MedicalHistorySerializer(serializers.ModelSerializer):
    medical_history = serializers.SerializerMethodField()
    
    class Meta:
        model = Soldier
        fields = ['devEui', 'first_name', 'last_name', 'medical_history']
    
    def get_medical_history(self, obj):
        medical_data = MedicalData.objects.filter(device=obj).order_by('-timestamp')[:10]  # Останні 10 записів
        return MedicalDataSerializer(medical_data, many=True).data

class AlertSerializer(serializers.ModelSerializer):
    soldier_name = serializers.SerializerMethodField()
    alert_type_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Alert
        fields = ['id', 'soldier', 'soldier_name', 'alert_type', 'alert_type_display', 'message', 'details', 'created_at', 'is_read', 'read_at']
    
    def get_soldier_name(self, obj):
        return f"{obj.soldier.first_name} {obj.soldier.last_name}"
    
    def get_alert_type_display(self, obj):
        return obj.get_alert_type_display()

class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ['id', 'name']

class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    is_active = serializers.BooleanField(source='user.is_active', read_only=True)
    last_login = serializers.DateTimeField(source='user.last_login', read_only=True)
    
    class Meta:
        model = UserProfile
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'phone', 'position', 'unit', 'is_active',
            'last_login', 'last_activity'
        ]
        read_only_fields = ['id', 'last_activity']
        extra_kwargs = {
            'role': {'required': True},
            'phone': {'required': False, 'allow_blank': True},
            'position': {'required': False, 'allow_blank': True},
            'unit': {'required': False, 'allow_blank': True}
        }
    
    def validate_phone(self, value):
        """Validate phone number format"""
        if value and not value.replace('+', '').replace('-', '').replace(' ', '').isdigit():
            raise serializers.ValidationError("Phone number must contain only digits, spaces, hyphens, and plus sign")
        return value
    
    def validate_role(self, value):
        """Перевіряє, чи є роль допустимою"""
        valid_roles = [role[0] for role in UserProfile.ROLE_CHOICES]
        if value not in valid_roles:
            raise serializers.ValidationError(f"Недопустима роль. Дозволені ролі: {', '.join(valid_roles)}")
        return value

class UserProfileCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['role', 'phone', 'position', 'unit']
        extra_kwargs = {
            'role': {'required': True},
            'phone': {'required': False, 'allow_blank': True},
            'position': {'required': False, 'allow_blank': True},
            'unit': {'required': False, 'allow_blank': True}
        }
    
    def validate_phone(self, value):
        """Validate phone number format"""
        if value and not value.replace('+', '').replace('-', '').replace(' ', '').isdigit():
            raise serializers.ValidationError("Phone number must contain only digits, spaces, hyphens, and plus sign")
        return value
    
    def validate_role(self, value):
        """Перевіряє, чи є роль допустимою"""
        valid_roles = [role[0] for role in UserProfile.ROLE_CHOICES]
        if value not in valid_roles:
            raise serializers.ValidationError(f"Недопустима роль. Дозволені ролі: {', '.join(valid_roles)}")
        return value

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(required=False)
    groups = GroupSerializer(many=True, read_only=True)
    is_admin = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'groups', 'is_staff', 'is_active', 'profile', 'last_login', 'is_admin']
        read_only_fields = ['is_staff', 'groups', 'last_login', 'is_admin']
    
    def get_is_admin(self, obj):
        """Визначає, чи є користувач адміністратором"""
        return obj.is_superuser or (hasattr(obj, 'profile') and obj.profile.role == 'ADMIN')
    
    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', None)
        
        # Оновлюємо поля користувача
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Оновлюємо профіль, якщо надано дані
        if profile_data:
            UserProfile.objects.update_or_create(
                user=instance,
                defaults=profile_data
            )
        
        return instance

class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)
    profile = UserProfileCreateSerializer(required=True)
    
    class Meta:
        model = User
        fields = ['username', 'password', 'password2', 'email', 'first_name', 'last_name', 'profile']
        extra_kwargs = {
            'email': {'required': False, 'allow_blank': True},
            'first_name': {'required': False, 'allow_blank': True},
            'last_name': {'required': False, 'allow_blank': True}
        }
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Паролі не співпадають"})
        return attrs
    
    def create(self, validated_data):
        """Створює нового користувача та його профіль"""
        # Видаляємо password2, оскільки він нам більше не потрібен
        validated_data.pop('password2')
        
        # Отримуємо дані профілю
        profile_data = validated_data.pop('profile')
        
        try:
            with transaction.atomic():
                # Створюємо користувача
                user = User.objects.create(
                    username=validated_data['username'],
                    email=validated_data.get('email', ''),
                    first_name=validated_data.get('first_name', ''),
                    last_name=validated_data.get('last_name', '')
                )
                
                # Встановлюємо пароль
                user.set_password(validated_data['password'])
                user.save()
                
                # Створюємо профіль користувача
                profile = UserProfile.objects.create(
                    user=user,
                    role=profile_data.get('role', 'VIEWER'),
                    phone=profile_data.get('phone', ''),
                    position=profile_data.get('position', ''),
                    unit=profile_data.get('unit', '')
                )
                
                # Оновлюємо групи користувача відповідно до ролі
                profile.update_user_groups()
                
                return user
        except Exception as e:
            raise serializers.ValidationError(f"Помилка при створенні користувача: {str(e)}")

class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password2 = serializers.CharField(required=True)
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password2']:
            raise serializers.ValidationError({"new_password": "Нові паролі не співпадають"})
        return attrs 