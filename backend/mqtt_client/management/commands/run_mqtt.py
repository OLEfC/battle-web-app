from django.core.management.base import BaseCommand
from mqtt_client.client import get_mqtt_client

class Command(BaseCommand):
    help = 'Запускає MQTT клієнт для отримання даних'
 
    def handle(self, *args, **options):
        self.stdout.write('Запуск MQTT клієнта...')
        client = get_mqtt_client()
        client.start() 