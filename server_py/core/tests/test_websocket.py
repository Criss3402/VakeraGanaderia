"""
Tests unitarios para Django Channels WebSocket (autenticación JWT, presencia, ping/pong y /api/py/ws/emit).
"""
import asyncio
import json
from datetime import UTC, datetime, timedelta

import jwt
from channels.testing import WebsocketCommunicator
from django.conf import settings
from django.test import SimpleTestCase
from rest_framework.test import APIClient
from vakera_backend.asgi import application


def _crear_token(user_id="usr-ws-1", email="ws@vakera.com", rol="dueno"):
    payload = {
        "id": user_id,
        "email": email,
        "rol": rol,
        "exp": datetime.now(UTC) + timedelta(minutes=30),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


class WebSocketRealtimeTests(SimpleTestCase):
    def test_rechaza_conexion_sin_token(self):
        async def escenario():
            communicator = WebsocketCommunicator(application, "/ws/realtime/")
            connected, _ = await communicator.connect()
            self.assertFalse(connected)

        asyncio.run(escenario())

    def test_conecta_con_jwt_valido_presencia_y_ping_pong(self):
        token = _crear_token()

        async def escenario():
            communicator = WebsocketCommunicator(application, f"/ws/realtime/?token={token}")
            connected, _ = await communicator.connect()
            self.assertTrue(connected)

            presencia = json.loads(await communicator.receive_from())
            self.assertEqual(presencia["event"], "presence_update")
            self.assertEqual(presencia["user_id"], "usr-ws-1")
            self.assertEqual(presencia["status"], "online")

            await communicator.send_to(text_data=json.dumps({"type": "ping"}))
            pong = json.loads(await communicator.receive_from())
            self.assertEqual(pong, {"event": "pong"})

            await communicator.disconnect()

        asyncio.run(escenario())

    def test_endpoint_interno_emit_requiere_secreto_y_despacha(self):
        client = APIClient()

        res_sin_secreto = client.post(
            "/api/py/ws/emit",
            {"targetUserIds": ["usr-ws-1"], "payload": {"event": "chat_message"}},
            format="json",
        )
        self.assertEqual(res_sin_secreto.status_code, 403)

        res_ok = client.post(
            "/api/py/ws/emit",
            {"targetUserIds": ["usr-ws-1"], "payload": {"event": "chat_message"}},
            format="json",
            HTTP_X_INTERNAL_SECRET=settings.INTERNAL_WS_SECRET,
        )
        self.assertEqual(res_ok.status_code, 200)
        self.assertTrue(res_ok.json()["ok"])
