"""
Servicio de emisión de eventos en tiempo real hacia el Channel Layer de Django Channels.
"""
import logging
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


class RealtimeNotificationService:
    """Publica eventos livianos a grupos de usuarios o al canal global."""

    @staticmethod
    def emit_to_users(user_ids, payload):
        channel_layer = get_channel_layer()
        if not channel_layer:
            return
        for uid in user_ids or []:
            if not uid:
                continue
            try:
                async_to_sync(channel_layer.group_send)(
                    f"user_{uid}",
                    {"type": "realtime_event", "payload": payload},
                )
            except Exception:
                logger.exception("No se pudo emitir evento WebSocket al usuario %s", uid)

    @staticmethod
    def emit_broadcast(payload):
        channel_layer = get_channel_layer()
        if not channel_layer:
            return
        try:
            async_to_sync(channel_layer.group_send)(
                "vakera_global",
                {"type": "realtime_event", "payload": payload},
            )
        except Exception:
            logger.exception("No se pudo emitir broadcast WebSocket global")
