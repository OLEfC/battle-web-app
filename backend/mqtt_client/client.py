import paho.mqtt.client as mqtt
from django.conf import settings
import json
from api.models import Soldier, MedicalData
import logging
import base64
import ssl
import os
import socket
import threading
import time
from datetime import datetime, timezone as dt_timezone

# Налаштування логування
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Вимкнути логування для MQTT клієнта
logging.getLogger('paho.mqtt.client').setLevel(logging.WARNING)

class MQTTClient:
    def __init__(self):
        logger.info("Initializing MQTT client...")
        self.client = mqtt.Client()
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
        
        # Логуємо шляхи до сертифікатів
        logger.info(f"Certificate paths:")
        logger.info(f"CA: {settings.MQTT_CA_CERT}")
        logger.info(f"Client Cert: {settings.MQTT_CLIENT_CERT}")
        logger.info(f"Client Key: {settings.MQTT_CLIENT_KEY}")
        
        try:
            # Налаштування TLS/SSL
            self.client.tls_set(
                ca_certs=settings.MQTT_CA_CERT,
                certfile=settings.MQTT_CLIENT_CERT,
                keyfile=settings.MQTT_CLIENT_KEY,
                cert_reqs=ssl.CERT_REQUIRED,
                tls_version=ssl.PROTOCOL_TLS,
                ciphers=None
            )
            
            # В режимі розробки можна вимкнути перевірку сертифіката
            if settings.DEBUG:
                self.client.tls_insecure_set(True)
                logger.warning("TLS certificate verification is disabled in DEBUG mode!")
            else:
                self.client.tls_insecure_set(False)
                logger.info("TLS certificate verification is enabled")
                
            # Встановлюємо ідентифікацію по сертифікату
            self.client.username_pw_set(None, None)
            
        except Exception as e:
            logger.error(f"Error setting up TLS: {str(e)}")
            raise

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            logger.info("Connected to MQTT Broker!")
            
            # Підписуємось на топики ChirpStack
            topics = [
                "application/+/device/+/event/up",
                "application/+/device/+/event/join",
                "application/+/device/+/event/ack",
                "application/+/device/+/event/error"
            ]
            
            for topic in topics:
                client.subscribe(topic)
                logger.info(f"Subscribed to topic: {topic}")
        else:
            logger.error(f"Failed to connect, return code {rc}")

    def on_message(self, client, userdata, msg):
        try:
            # Обробляємо повідомлення від ChirpStack
            if msg.topic.startswith("application/"):
                try:
                    data = json.loads(msg.payload.decode())
                    event_type = msg.topic.split('/')[-1]
                    
                    if event_type == "up":
                        self.process_uplink(data)
                    elif event_type == "join":
                        self.process_join(data)
                    elif event_type == "ack":
                        self.process_ack(data)
                    elif event_type == "error":
                        self.process_error(data)
                        
                except json.JSONDecodeError as e:
                    logger.error(f"Error decoding JSON: {e}")
        except Exception as e:
            logger.error(f"Error processing message: {e}")

    def decode_payload(self, payload_base64):
        """Декодує base64 payload в байти"""
        try:
            return base64.b64decode(payload_base64)
        except Exception as e:
            logger.error(f"Error decoding payload: {e}")
            return None

    def parse_payload(self, payload_bytes):
        """Парсить бінарні дані від пристрою
        
        Формат даних:
        - Перший байт: SpO2 (uint8)
        - Другий байт: Пульс (uint8)
        - Байти 3-6: Широта (int32_t, множник 1000000)
        - Байти 7-10: Довгота (int32_t, множник 1000000)
        - Байти 11-14: Unix timestamp (uint32_t)
        """
        try:
            if len(payload_bytes) < 14:
                raise ValueError("Payload too short")

            spo2 = payload_bytes[0]
            heart_rate = payload_bytes[1]
            
            # Конвертуємо координати з int32_t в float
            import struct
            latitude_int = struct.unpack('>i', payload_bytes[2:6])[0]
            longitude_int = struct.unpack('>i', payload_bytes[6:10])[0]
            
            # Ділимо на 1000000 для отримання правильних координат
            latitude = latitude_int / 1000000.0
            longitude = longitude_int / 1000000.0
            
            # Отримуємо timestamp
            timestamp = struct.unpack('>I', payload_bytes[10:14])[0]

            return {
                'spo2': spo2,
                'heart_rate': heart_rate,
                'latitude': latitude,
                'longitude': longitude,
                'timestamp': timestamp
            }
        except Exception as e:
            logger.error(f"Error parsing payload: {e}")
            return None

    def process_uplink(self, data):
        """Обробка uplink повідомлення від пристрою"""
        try:
            # Отримуємо метадані пристрою
            device_info = data.get('deviceInfo', {})
            device_id = device_info.get('devEui')
            if not device_id:
                logger.error("No device ID in message")
                return

            # Отримуємо payload з поля data
            payload_base64 = data.get('data')
            if not payload_base64:
                logger.error("No payload in uplink message")
                return

            # Декодуємо та парсимо payload
            payload_bytes = self.decode_payload(payload_base64)
            if not payload_bytes:
                return

            parsed_data = self.parse_payload(payload_bytes)
            if not parsed_data:
                return

            # Конвертуємо timestamp в datetime
            timestamp = datetime.fromtimestamp(parsed_data['timestamp'], dt_timezone.utc)

            # Створюємо або оновлюємо запис солдата
            soldier, created = Soldier.objects.get_or_create(
                devEui=device_id,
                defaults={
                    'first_name': device_info.get('name', 'Unknown').split()[0] if device_info.get('name') else 'Unknown',
                    'last_name': device_info.get('name', 'Unknown').split()[-1] if device_info.get('name') else 'Unknown',
                    'unit': device_info.get('tags', {}).get('unit', 'Unknown')
                }
            )
            
            # Створюємо запис медичних даних
            MedicalData.objects.create(
                device=soldier,
                spo2=parsed_data['spo2'],
                heart_rate=parsed_data['heart_rate'],
                latitude=parsed_data['latitude'],
                longitude=parsed_data['longitude'],
                timestamp=timestamp
            )
            
            logger.info(f"Processed data for device {device_id}")
        except Exception as e:
            logger.error(f"Error processing uplink: {e}")

    def process_join(self, data):
        """Обробка приєднання пристрою"""
        try:
            device_info = data.get('deviceInfo', {})
            device_name = device_info.get('name', 'Unknown Device')
            device_id = device_info.get('devEui', 'unknown')
            
            logger.info(f"Device {device_name} ({device_id}) joined the network")
            
        except Exception as e:
            logger.error(f"Error processing join: {e}")

    def process_ack(self, data):
        """Обробка підтвердження"""
        try:
            device_info = data.get('deviceInfo', {})
            device_name = device_info.get('name', 'Unknown Device')
            device_id = device_info.get('devEui', 'unknown')
            
            logger.info(f"Received ACK from device {device_name} ({device_id})")
            
        except Exception as e:
            logger.error(f"Error processing ACK: {e}")

    def process_error(self, data):
        """Обробка помилки"""
        try:
            device_info = data.get('deviceInfo', {})
            device_name = device_info.get('name', 'Unknown Device')
            device_id = device_info.get('devEui', 'unknown')
            error = data.get('error', 'Unknown error')
            
            logger.error(f"Error from device {device_name} ({device_id}): {error}")
            
        except Exception as e:
            logger.error(f"Error processing error message: {e}")

    def on_disconnect(self, client, userdata, rc):
        if rc != 0:
            logger.error(f"Unexpected disconnection with code {rc}")

    def start(self):
        try:
            port = 8883
            logger.info(f"Connecting to MQTT broker at {settings.MQTT_BROKER}:{port}")
            self.client.connect(settings.MQTT_BROKER, port, 60)
            self.client.loop_forever()
        except Exception as e:
            logger.error(f"Error connecting to MQTT broker: {e}")
            raise

# Синглтон для MQTT клієнта
mqtt_client = None

def get_mqtt_client():
    global mqtt_client
    if mqtt_client is None:
        mqtt_client = MQTTClient()
    return mqtt_client 