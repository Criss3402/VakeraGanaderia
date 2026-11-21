"""
Django settings for Vakera Ganaderia Backend (Python Module).
Diseñado para coexistir con el backend principal de Node.js y Express.
"""
import os
import sys
import urllib.parse
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent

# Cargar variables de entorno desde la raíz del proyecto
env_paths = [ROOT_DIR / ".env", BASE_DIR / ".env"]
for env_path in env_paths:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        break

DEBUG = os.getenv("DJANGO_DEBUG", "False").lower() in ("true", "1")
_corriendo_tests_cli = "test" in sys.argv or "pytest" in sys.modules

SECRET_KEY = os.getenv(
    "DJANGO_SECRET_KEY",
    "vakera-django-dev-secret-key-2026-solo-desarrollo-local-50chars" if (DEBUG or _corriendo_tests_cli) else "",
)
JWT_SECRET = os.getenv(
    "JWT_SECRET",
    "vakera_super_secret_jwt_key_2026" if (DEBUG or _corriendo_tests_cli) else "",
)
if not DEBUG and not _corriendo_tests_cli and (not SECRET_KEY or not JWT_SECRET):
    raise RuntimeError("DJANGO_SECRET_KEY y JWT_SECRET son obligatorios cuando DJANGO_DEBUG=False.")

ALLOWED_HOSTS = [
    h.strip()
    for h in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,testserver").split(",")
    if h.strip()
]

JWT_ALGORITHM = "HS256"
INTERNAL_WS_SECRET = os.getenv("INTERNAL_WS_SECRET", JWT_SECRET)

INSTALLED_APPS = [
    "daphne",
    "django.contrib.staticfiles",
    "channels",
    "corsheaders",
    "rest_framework",
    "core",
    "legacy_models",
    "reportes",
    "nutricion",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
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
ASGI_APPLICATION = "vakera_backend.asgi.application"

# Channel Layer (Clase 9/10): Redis si REDIS_URL está configurado, sino InMemoryChannelLayer
_redis_url = os.getenv("REDIS_URL", "").strip()
if _redis_url:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {"hosts": [_redis_url]},
        }
    }
else:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }

# -----------------------------------------------------------------------------
# Base de Datos: Conexión con PostgreSQL (Gestionado principalmente por Prisma)
# -----------------------------------------------------------------------------
database_url = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5433/vakera_db?schema=public",
)

# DJANGO_TEST_DB controla la base usada al correr tests:
#   - "sqlite": fuerza SQLite en memoria (tests unitarios).
#   - "postgres": usa la conexión real definida por DATABASE_URL (tests de integración).
#   - sin definir: SQLite en memoria si se ejecuta `manage.py test` o pytest.
_modo_test_db = os.getenv("DJANGO_TEST_DB", "").lower()
_corriendo_tests = "test" in sys.argv or "pytest" in sys.modules

if _modo_test_db == "sqlite" or (_corriendo_tests and _modo_test_db != "postgres"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
else:
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
    except Exception:
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
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/minute",
        "user": "300/minute",
    },
    "EXCEPTION_HANDLER": "core.exceptions.vakera_exception_handler",
    "UNAUTHENTICATED_USER": None,
}

# -----------------------------------------------------------------------------
# Configuración CORS y Headers de Seguridad
# -----------------------------------------------------------------------------
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:5174,http://localhost:4000",
    ).split(",")
    if o.strip()
]
CORS_ALLOW_CREDENTIALS = True
X_FRAME_OPTIONS = "DENY"
SECURE_CONTENT_TYPE_NOSNIFF = True

if not DEBUG and not _corriendo_tests_cli:
    SECURE_SSL_REDIRECT = os.getenv("DJANGO_SECURE_SSL_REDIRECT", "True").lower() == "true"
    SECURE_HSTS_SECONDS = int(os.getenv("DJANGO_SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Internacionalización
LANGUAGE_CODE = "es-ar"
TIME_ZONE = "America/Argentina/Buenos_Aires"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
