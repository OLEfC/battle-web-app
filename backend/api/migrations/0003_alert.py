# Generated by Django 5.0.3 on 2025-05-13 20:44

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_alter_soldier_options_medicaldata_issue_type_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='Alert',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('alert_type', models.CharField(choices=[('NEW_CASUALTY', 'Новий поранений'), ('CRITICAL_STATE', 'Критичний стан'), ('CRITICAL_DURATION', 'Тривалий критичний стан')], max_length=20, verbose_name='Тип сповіщення')),
                ('message', models.TextField(verbose_name='Повідомлення')),
                ('details', models.JSONField(verbose_name='Деталі')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Час створення')),
                ('is_read', models.BooleanField(default=False, verbose_name='Прочитано')),
                ('soldier', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='api.soldier', verbose_name='Поранений')),
            ],
            options={
                'verbose_name': 'Сповіщення',
                'verbose_name_plural': 'Сповіщення',
                'ordering': ['-created_at'],
            },
        ),
    ]
