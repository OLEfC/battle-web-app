import os
import grpc
import random
from dotenv import load_dotenv
from django.conf import settings

# Import generated ChirpStack API modules
try:
    from chirpstack_api.api.device_pb2 import (
        CreateDeviceRequest, 
        Device, 
        GetDeviceRequest,
        DeviceKeys,
        CreateDeviceKeysRequest
    )
    from chirpstack_api.api.device_pb2_grpc import DeviceServiceStub
    CHIRPSTACK_API_AVAILABLE = True
except ImportError:
    CHIRPSTACK_API_AVAILABLE = False

# Load environment variables
load_dotenv()

# ChirpStack connection settings
CHIRPSTACK_HOST = os.getenv('CHIRPSTACK_HOST', 'localhost:8080')
API_TOKEN = os.getenv('API_TOKEN', '')
APPLICATION_ID = os.getenv('APPLICATION_ID', '')
DEVICE_PROFILE_ID = os.getenv('DEVICE_PROFILE_ID', '')

# Development mode flag
DEVELOPMENT_MODE = os.getenv('DEVELOPMENT_MODE', 'True').lower() in ('true', '1', 't')

def generate_random_hex(length: int) -> str:
    """Generate random hex string of specified length"""
    return ''.join(random.choice('0123456789abcdef') for _ in range(length))

def generate_app_key() -> str:
    """Generate a random Application Key (16 bytes = 32 hex chars)"""
    return generate_random_hex(32)

def format_hex_field(value: str, expected_length: int, field_name: str) -> str:
    """Format and validate hex field"""
    if not value:
        raise ValueError(f"{field_name} cannot be empty")
    
    # Remove any non-hex characters
    clean_value = ''.join(c for c in value if c in '0123456789abcdefABCDEF')
    # Ensure lowercase
    clean_value = clean_value.lower()
    
    if len(clean_value) != expected_length:
        raise ValueError(f"{field_name} must be {expected_length} characters long, got {len(clean_value)}")
    
    return clean_value

def is_dev_eui_available(dev_eui: str) -> bool:
    """Check if DEV_EUI is available"""
    # In development mode, always return True
    if DEVELOPMENT_MODE or not CHIRPSTACK_API_AVAILABLE:
        print("WARNING: Running in development mode - skipping actual ChirpStack API call")
        return True

    channel = grpc.insecure_channel(CHIRPSTACK_HOST)
    client = DeviceServiceStub(channel)
    
    try:
        metadata = [('authorization', f'Bearer {API_TOKEN}')]
        req = GetDeviceRequest(dev_eui=dev_eui)
        client.Get(req, metadata=metadata)
        return False  # If we get here, device exists
    except grpc.RpcError as e:
        if e.code() == grpc.StatusCode.NOT_FOUND:
            return True  # Device not found, EUI is available
        raise  # Other error occurred
    finally:
        channel.close()

def create_chirpstack_device(dev_eui: str, name: str, join_eui: str = None, app_key: str = None) -> bool:
    """
    Create a new device in ChirpStack
    Returns True if successful, False otherwise
    """
    try:
        # Format DEV_EUI
        dev_eui = format_hex_field(dev_eui, 16, "DEV_EUI")
        
        # Generate JoinEUI (EUI64) if not provided
        if not join_eui:
            join_eui = generate_random_hex(16)
        else:
            join_eui = format_hex_field(join_eui, 16, "JOIN_EUI")
        
        # Use provided APP_KEY or generate a new one
        if not app_key:
            app_key = generate_app_key()
        else:
            app_key = format_hex_field(app_key, 32, "APP_KEY")
        
        # In development mode, skip the actual API call
        if DEVELOPMENT_MODE or not CHIRPSTACK_API_AVAILABLE:
            print(f"WARNING: Running in development mode - skipping actual ChirpStack API call")
            print(f"Would have created device: {name} with DEV_EUI: {dev_eui}")
            print(f"Generated JoinEUI (EUI64): {join_eui}")
            print(f"APP_KEY: {app_key}")
            return True

        # Check if device already exists
        if not is_dev_eui_available(dev_eui):
            raise ValueError(f"Device with DEV_EUI {dev_eui} already exists")

        # Create gRPC channel
        channel = grpc.insecure_channel(CHIRPSTACK_HOST)
        client = DeviceServiceStub(channel)
        
        # Create metadata with API token
        metadata = [('authorization', f'Bearer {API_TOKEN}')]
        
        # Create device request
        device = Device(
            dev_eui=dev_eui,
            name=name,
            application_id=APPLICATION_ID,
            device_profile_id=DEVICE_PROFILE_ID,
            description=f"Soldier tracking device for {name}",
            join_eui=join_eui  # Add JoinEUI to device creation
        )
        
        req = CreateDeviceRequest(device=device)
        
        # Create device
        response = client.Create(req, metadata=metadata)
        
        # Set device keys using the provided or generated app_key
        keys = DeviceKeys(
            dev_eui=dev_eui,
            nwk_key=app_key,
            app_key=app_key,
        )
        
        keys_req = CreateDeviceKeysRequest(device_keys=keys)
        client.CreateKeys(keys_req, metadata=metadata)
        
        return True
        
    except Exception as e:
        print(f"Error creating ChirpStack device: {str(e)}")
        return False
    finally:
        if 'channel' in locals():
            channel.close() 