from django.contrib import admin
from .models import Soldier, MedicalData, Alert, Evacuation, UserProfile
from django.contrib.auth.models import User
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

class MedicalDataInline(admin.TabularInline):
    model = MedicalData
    extra = 0
    readonly_fields = ('timestamp', 'spo2', 'heart_rate', 'latitude', 'longitude', 'issue_type')
    ordering = ('-timestamp',)
    max_num = 10
    can_delete = False

class AlertInline(admin.TabularInline):
    model = Alert
    extra = 0
    readonly_fields = ('alert_type', 'message', 'created_at', 'is_read')
    ordering = ('-created_at',)
    max_num = 5
    can_delete = False

class EvacuationInline(admin.StackedInline):
    model = Evacuation
    extra = 0
    can_delete = False

@admin.register(Soldier)
class SoldierAdmin(admin.ModelAdmin):
    list_display = ('devEui', 'last_name', 'first_name', 'unit', 'is_evacuated', 'last_update')
    list_filter = ('unit', 'last_update')
    search_fields = ('devEui', 'first_name', 'last_name', 'unit')
    ordering = ('last_name', 'first_name')
    inlines = [EvacuationInline, MedicalDataInline, AlertInline]
    readonly_fields = ('is_evacuated', 'last_update', 'created_at')

@admin.register(Evacuation)
class EvacuationAdmin(admin.ModelAdmin):
    list_display = ('soldier', 'status', 'priority', 'evacuation_started', 'evacuation_time', 'last_update')
    list_filter = ('status', 'evacuation_started', 'evacuation_time')
    search_fields = ('soldier__first_name', 'soldier__last_name', 'evacuation_team', 'notes')
    ordering = ('status', '-priority', 'evacuation_started')
    readonly_fields = ('last_update',)

@admin.register(MedicalData)
class MedicalDataAdmin(admin.ModelAdmin):
    list_display = ('device', 'timestamp', 'spo2', 'heart_rate', 'issue_type')
    list_filter = ('issue_type', 'timestamp')
    search_fields = ('device__devEui', 'device__first_name', 'device__last_name')
    ordering = ('-timestamp',)
    readonly_fields = ('id',)

@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ('soldier', 'alert_type', 'created_at', 'is_read', 'read_at')
    list_filter = ('alert_type', 'is_read', 'created_at')
    search_fields = ('soldier__first_name', 'soldier__last_name', 'message')
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)

# Розширення адміністративного інтерфейсу для користувачів
class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'Профіль'

class UserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff', 'get_role')
    list_filter = BaseUserAdmin.list_filter + ('profile__role',)
    
    def get_role(self, obj):
        try:
            return obj.profile.get_role_display()
        except UserProfile.DoesNotExist:
            return "Не встановлено"
    get_role.short_description = 'Роль'

# Перереєстрація моделі User з розширеним класом UserAdmin
admin.site.unregister(User)
admin.site.register(User, UserAdmin)

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'position', 'unit', 'phone', 'last_activity')
    list_filter = ('role', 'unit')
    search_fields = ('user__username', 'user__email', 'phone', 'position', 'unit')
    readonly_fields = ('last_activity',)
