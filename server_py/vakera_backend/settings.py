"""
Django settings for Vakera Ganaderia Backend (Python Module).
Diseñado para coexistir con el backend principal de Node.js y Express.
"""
from pathlib import Path
import os
import urllib.parse
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent

# Cargar variables de entorno desde la raíz del proyecto
env_paths = [ROOT_DIR / ".env", BASE_DIR / ".env"]
for env_path in env_paths:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        break

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "vakera-django-secret-key-production-dev-2026")
DEBUG = os.getenv("DJANGO_DEBUG", "True").lower() in ("true", "1")
ALLOWED_HOSTS = ["*"]

# Clave compartida para verificar tokens emitidos por Node.js / Express
JWT_SECRET = os.getenv("JWT_SECRET", "vakera_super_secret_jwt_key_2026")
JWT_ALGORITHM = "HS256"

INSTALLED_APPS = [
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "core",
    "legacy_models",
    "reportes",
    "nutricion",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "vakera_backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
            ],
        },
    },
]

WSGI_APPLICATION = "vakera_backend.wsgi.application"

# -----------------------------------------------------------------------------
# Base de Datos: Conexión con PostgreSQL (Gestionado principalmente por Prisma)
# -----------------------------------------------------------------------------
database_url = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5433/vakera_db?schema=public",
)

try:
    parsed_url = urllib.parse.urlparse(database_url)
    db_engine = "django.db.backends.postgresql" if "postgres" in parsed_url.scheme else "django.db.backends.sqlite3"
    db_name = parsed_url.path.lstrip("/").split("?")[0] if parsed_url.path else "vakera_db"
    
    DATABASES = {
        "default": {
            "ENGINE": db_engine,
            "NAME": db_name,
            "USER": parsed_url.username or "postgres",
            "PASSWORD": parsed_url.password or "postgres",
            "HOST": parsed_url.hostname or "localhost",
            "PORT": str(parsed_url.port or 5433),
            "CONN_MAX_AGE": 60,
        }
    }
except Exception as e:
    # Fallback seguro para tests aislados
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "dev_fallback.sqlite3",
        }
    }

# -----------------------------------------------------------------------------
# Django REST Framework & Seguridad
# -----------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "core.authentication.UnifiedJWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "EXCEPTION_HANDLER": "core.exceptions.vakera_exception_handler",
    "UNAUTHENTICATED_USER": None,
}

# -----------------------------------------------------------------------------
# Configuración CORS
# -----------------------------------------------------------------------------
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# Internacionalización
LANGUAGE_CODE = "es-ar"
TIME_ZONE = "America/Argentina/Buenos_Aires"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
