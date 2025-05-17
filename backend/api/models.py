from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User

# Create your models here.

class Soldier(models.Model):
    devEui = models.CharField(max_length=100, unique=True, primary_key=True, verbose_name='ID пристрою')
    first_name = models.CharField(max_length=100, verbose_name='Ім\'я')
    last_name = models.CharField(max_length=100, verbose_name='Прізвище')
    unit = models.CharField(max_length=200, verbose_name='Підрозділ')
    last_update = models.DateTimeField(auto_now=True, verbose_name='Останнє оновлення')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='Створено')

    @property
    def is_evacuated(self):
        try:
            evacuation = self.evacuation
            return evacuation.status == 'EVACUATED'
        except Evacuation.DoesNotExist:
            return False

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.devEui})"

    class Meta:
        verbose_name = 'Поранений'
        verbose_name_plural = 'Поранені'
        ordering = ['last_name', 'first_name']

class Evacuation(models.Model):
    EVACUATION_STATUS = [
        ('NOT_NEEDED', 'Евакуація не потрібна'),
        ('NEEDED', 'Потребує евакуації'),
        ('IN_PROGRESS', 'В процесі евакуації'),
        ('EVACUATED', 'Евакуйований')
    ]
    
    soldier = models.OneToOneField(Soldier, on_delete=models.CASCADE, related_name='evacuation', verbose_name='Поранений')
    status = models.CharField(
        max_length=20,
        choices=EVACUATION_STATUS,
        default='NEEDED',
        verbose_name='Статус евакуації'
    )
    evacuation_time = models.DateTimeField(null=True, blank=True, verbose_name='Час евакуації')
    evacuation_started = models.DateTimeField(null=True, blank=True, verbose_name='Час початку евакуації')
    evacuation_team = models.CharField(max_length=200, blank=True, null=True, verbose_name='Евакуаційна команда')
    priority = models.IntegerField(default=0, verbose_name='Пріоритет евакуації')
    notes = models.TextField(blank=True, null=True, verbose_name='Примітки')
    last_update = models.DateTimeField(auto_now=True, verbose_name='Останнє оновлення')
    
    def __str__(self):
        return f"Евакуація: {self.soldier.first_name} {self.soldier.last_name} - {self.get_status_display()}"
    
    class Meta:
        verbose_name = 'Евакуація'
        verbose_name_plural = 'Евакуації'
        ordering = ['priority', 'evacuation_started']

class MedicalData(models.Model):
    ISSUE_TYPES = [
        ('SPO2', 'Критичний SpO2'),
        ('HR', 'Критичний пульс'),
        ('BOTH', 'Критичні SpO2 та пульс'),
        ('SENSOR_ERROR', 'Помилка датчиків'),
        ('NORMAL', 'Показники в нормі')
    ]

    id = models.AutoField(primary_key=True)
    device = models.ForeignKey(Soldier, on_delete=models.CASCADE, to_field='devEui', verbose_name='Пристрій')
    spo2 = models.IntegerField(verbose_name='SPO2')
    heart_rate = models.IntegerField(verbose_name='Пульс')
    latitude = models.FloatField(verbose_name='Широта')
    longitude = models.FloatField(verbose_name='Довгота')
    timestamp = models.DateTimeField(verbose_name='Час виміру')
    issue_type = models.CharField(
        max_length=20, 
        choices=ISSUE_TYPES,
        default='NORMAL',
        verbose_name='Тип проблеми'
    )

    def save(self, *args, **kwargs):
        # Визначення типу проблеми перед збереженням
        self.issue_type = self.determine_issue_type()
        super().save(*args, **kwargs)

    def determine_issue_type(self):
        """Визначає тип проблеми на основі показників"""
        # Перевірка на помилку датчиків
        if self.spo2 <= 0 or self.heart_rate <= 0:
            return 'SENSOR_ERROR'
        
        # Перевірка критичних показників
        spo2_critical = self.spo2 < 90
        hr_critical = self.heart_rate > 120 or self.heart_rate < 40

        if spo2_critical and hr_critical:
            return 'BOTH'
        elif spo2_critical:
            return 'SPO2'
        elif hr_critical:
            return 'HR'
        else:
            return 'NORMAL'

    class Meta:
        verbose_name = 'Медичні дані'
        verbose_name_plural = 'Медичні дані'
        ordering = ['-timestamp']

class Alert(models.Model):
    ALERT_TYPES = [
        ('NEW_CASUALTY', 'Новий поранений'),
        ('CRITICAL_STATE', 'Критичний стан'),
        ('CRITICAL_DURATION', 'Тривалий критичний стан'),
    ]

    soldier = models.ForeignKey(Soldier, on_delete=models.CASCADE, verbose_name='Поранений')
    alert_type = models.CharField(max_length=20, choices=ALERT_TYPES, verbose_name='Тип сповіщення')
    message = models.TextField(verbose_name='Повідомлення')
    details = models.JSONField(verbose_name='Деталі')  # Для збереження показників, координат тощо
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Час створення')
    is_read = models.BooleanField(default=False, verbose_name='Прочитано')
    read_at = models.DateTimeField(null=True, blank=True, verbose_name='Час прочитання')
    
    class Meta:
        verbose_name = 'Сповіщення'
        verbose_name_plural = 'Сповіщення'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_alert_type_display()} - {self.soldier} ({self.created_at.strftime('%Y-%m-%d %H:%M')})"

class UserProfile(models.Model):
    ROLE_CHOICES = [
        ('ADMIN', 'Адміністратор'),
        ('RECRUITER', 'Рекрутер'),
        ('MEDICAL', 'Медичний персонал')
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='MEDICAL')
    phone = models.CharField(max_length=20, blank=True, null=True)
    position = models.CharField(max_length=100, blank=True, null=True)
    unit = models.CharField(max_length=100, blank=True, null=True)
    last_activity = models.DateTimeField(auto_now=True, verbose_name='Остання активність')
    
    def __str__(self):
        return f"{self.user.username} - {self.get_role_display()}"
    
    class Meta:
        verbose_name = 'Профіль користувача'
        verbose_name_plural = 'Профілі користувачів'
        ordering = ['user__username']
    
    def save(self, *args, **kwargs):
        """Зберігає профіль користувача та оновлює його групи"""
        # При створенні/оновленні профілю, оновлюємо групи користувача
        super().save(*args, **kwargs)
        # Оновлюємо групи користувача після збереження профілю
        self.update_user_groups()
    
    def update_user_groups(self):
        """Оновлює групи користувача на основі ролі"""
        from django.contrib.auth.models import Group
        
        # Очищаємо всі поточні групи користувача
        self.user.groups.clear()
        
        # Додаємо відповідні групи згідно ролі
        if self.role == 'ADMIN':
            # Адміністратори отримують всі групи та прапорець is_staff
            groups = Group.objects.all()
            self.user.is_staff = True
            self.user.is_superuser = True
        elif self.role == 'RECRUITER':
            groups = Group.objects.filter(name__in=['recruiters'])
            self.user.is_staff = True
            self.user.is_superuser = False
        elif self.role == 'MEDICAL':
            groups = Group.objects.filter(name__in=['medical_staff'])
            self.user.is_staff = True
            self.user.is_superuser = False
        
        # Додаємо користувача до відповідних груп
        for group in groups:
            self.user.groups.add(group)
        
        # Зберігаємо зміни користувача
        self.user.save()
