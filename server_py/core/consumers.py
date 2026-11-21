"""
Consumers WebSocket de tiempo real para Vakera (Django Channels).
Maneja autenticación por JWT, presencia online/offline y broadcast de eventos.
"""
import json

from channels.generic.websocket import AsyncWebsocketConsumer


class VakeraRealtimeConsumer(AsyncWebsocketConsumer):
    """Canal WebSocket autenticado para notificaciones, chat en vivo y presencia."""

    GLOBAL_GROUP = "vakera_global"

    async def connect(self):
        self.user = self.scope.get("user")
        if not self.user or not getattr(self.user, "is_authenticated", False):
            await self.close(code=4001)
            return

        self.user_group = f"user_{self.user.id}"
        await self.channel_layer.group_add(self.user_group, self.channel_name)
        await self.channel_layer.group_add(self.GLOBAL_GROUP, self.channel_name)
        await self.accept()
        self.joined = True

        await self.channel_layer.group_send(
            self.GLOBAL_GROUP,
            {
                "type": "presence_update",
                "payload": {
                    "event": "presence_update",
                    "user_id": self.user.id,
                    "email": self.user.email,
                    "rol": self.user.rol,
                    "status": "online",
                },
            },
        )

    async def disconnect(self, close_code):
        if not getattr(self, "joined", False):
            return

        await self.channel_layer.group_discard(self.user_group, self.channel_name)
        await self.channel_layer.group_discard(self.GLOBAL_GROUP, self.channel_name)
        await self.channel_layer.group_send(
            self.GLOBAL_GROUP,
            {
                "type": "presence_update",
                "payload": {
                    "event": "presence_update",
                    "user_id": self.user.id,
                    "email": self.user.email,
                    "rol": self.user.rol,
                    "status": "offline",
                },
            },
        )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except (TypeError, ValueError):
            return

        tipo = data.get("type")
        if tipo == "ping":
            await self.send(text_data=json.dumps({"event": "pong"}))
        elif tipo == "typing" and data.get("to_user_id"):
            await self.channel_layer.group_send(
                f"user_{data['to_user_id']}",
                {
                    "type": "realtime_event",
                    "payload": {
                        "event": "typing",
                        "from_user_id": self.user.id,
                    },
                },
            )

    async def realtime_event(self, event):
        await self.send(text_data=json.dumps(event["payload"]))

    async def presence_update(self, event):
        await self.send(text_data=json.dumps(event["payload"]))
