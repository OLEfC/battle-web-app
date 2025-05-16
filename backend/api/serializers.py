from rest_framework import serializers
from .models import Soldier, MedicalData, Alert, Evacuation, UserProfile
from django.utils import timezone
from django.contrib.auth.models import User, Group
from django.contrib.auth.password_validation import validate_password

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
    role_display = serializers.SerializerMethodField()
    
    class Meta:
        model = UserProfile
        fields = ['id', 'role', 'role_display', 'phone', 'position', 'unit', 'last_activity']
    
    def get_role_display(self, obj):
        return obj.get_role_display()

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(required=False)
    groups = GroupSerializer(many=True, read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'groups', 'is_staff', 'is_active', 'profile', 'last_login']
        read_only_fields = ['is_staff', 'groups', 'last_login']
    
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
    profile = UserProfileSerializer(required=False)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'password', 'password2', 'email', 'first_name', 'last_name', 'profile']
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Паролі не співпадають"})
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password2', None)
        profile_data = validated_data.pop('profile', None)
        
        user = User.objects.create(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        
        user.set_password(validated_data['password'])
        user.save()
        
        # Створюємо профіль користувача з роллю за замовчуванням
        if profile_data:
            UserProfile.objects.create(user=user, **profile_data)
        else:
            UserProfile.objects.create(user=user, role='VIEWER')
        
        return user

class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password2 = serializers.CharField(required=True)
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password2']:
            raise serializers.ValidationError({"new_password": "Нові паролі не співпадають"})
        return attrs 