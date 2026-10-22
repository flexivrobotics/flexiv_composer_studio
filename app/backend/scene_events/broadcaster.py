"""App-wide broadcaster that streams server SceneEvents to WebSocket clients.

Exactly ONE :class:`SceneEventBroadcaster` exists per process (see
:func:`get_broadcaster`). It owns a single, dedicated ``flexiv.pdk.Client`` +
``watch.Subscriber`` used only for the ``WatchSceneEvents`` server stream.

Why a dedicated client (and not ``NebulaServiceBase._create_client()``): that
helper serializes every call under a class-level ``RLock`` and tears the client
down per operation. A ``WatchSceneEvents`` iterator is long-lived and blocking —
holding the shared lock for its lifetime would deadlock all other RPCs. So the
stream gets its own client. It is a strict singleton: one instance, one client,
shared by every WebSocket connection (never one-per-request or one-per-socket).

No geometry/config lookups happen here — events are translated to plain JSON and
forwarded. The frontend fetches geometry/pose via the normal REST endpoints.
"""
from __future__ import annotations

import asyncio
import importlib
import json
import logging
from typing import Optional

from fastapi import WebSocket

log = logging.getLogger(__name__)


def _enum_name(enum_wrapper, value):
    """Readable enum label, falling back to the raw int on any mismatch."""
    try:
        return enum_wrapper.Name(value)
    except Exception:
        return str(value)


class SceneEventBroadcaster:
    """Owns the single scene-event stream and the set of WebSocket subscribers."""

    def __init__(self, target: str) -> None:
        self._target = target
        self._clients: list[WebSocket] = []
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._client = None          # dedicated flexiv.pdk.Client
        self._subscriber = None      # flexiv.pdk.watch.Subscriber
        self._subscription = None
        self._started = False

    # ── WebSocket clients ──────────────────────────────────────────────────

    async def add_client(self, ws: WebSocket) -> None:
        await ws.accept()
        self._clients.append(ws)
        self._ensure_started()

    def remove_client(self, ws: WebSocket) -> None:
        if ws in self._clients:
            self._clients.remove(ws)

    # ── Subscription lifecycle ──────────────────────────────────────────────

    def _ensure_started(self) -> None:
        """Open the single scene-event stream on first use (idempotent)."""
        if self._started:
            return
        self._started = True
        self._loop = asyncio.get_running_loop()

        try:
            nebula = importlib.import_module("flexiv.pdk")
            watch = importlib.import_module("flexiv.pdk.watch")
            scene_event_pb2 = importlib.import_module(
                "flexiv.pdk.scene_event_service_pb2")
        except ModuleNotFoundError:
            self._started = False
            log.exception("flexiv.pdk not importable; scene-event stream disabled")
            return

        self._client = nebula.Client(self._target)
        self._subscriber = watch.Subscriber()
        request = scene_event_pb2.WatchSceneEventsRequest()  # all origins/types
        # Subscriber runs a background thread with auto-reconnect (Options
        # defaults reconnect=True), so a not-yet-running server is fine.
        self._subscription = self._subscriber.subscribe(
            lambda: self._client.scene_event.stub.WatchSceneEvents(request),
            self._on_event,
        )
        log.info("SceneEventBroadcaster subscribed to %s", self._target)

    def _on_event(self, event) -> None:
        """Called on the Subscriber's background thread for each event."""
        payload = self._event_to_dict(event)
        loop = self._loop
        if loop is not None:
            asyncio.run_coroutine_threadsafe(self._broadcast(payload), loop)

    @staticmethod
    def _event_to_dict(event) -> dict:
        scene_event_pb2 = importlib.import_module(
            "flexiv.pdk.scene_event_service_pb2")
        config_pb2 = importlib.import_module("flexiv.pdk.config_service_pb2")
        scene_event = scene_event_pb2.SceneEvent
        data = {
            "change": _enum_name(scene_event.Change, event.change),
            "origin": _enum_name(scene_event.Origin, event.origin),
            "frames": list(event.frames),
            "new_name": event.new_name,
            "entity": None,
        }
        if event.HasField("entity"):
            data["entity"] = {
                "type": _enum_name(config_pb2.ConfigType, event.entity.type),
                "name": event.entity.name,
            }
        return data

    async def _broadcast(self, payload: dict) -> None:
        if not self._clients:
            return
        text = json.dumps(payload)
        dead: list[WebSocket] = []
        for ws in self._clients:
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.remove_client(ws)

    def shutdown(self) -> None:
        if self._subscription is not None:
            self._subscription.close()
        if self._client is not None:
            self._client.close()


_broadcaster: Optional[SceneEventBroadcaster] = None


def get_broadcaster(target: str) -> SceneEventBroadcaster:
    """Return the process-wide singleton broadcaster, creating it on first use."""
    global _broadcaster
    if _broadcaster is None:
        _broadcaster = SceneEventBroadcaster(target)
    return _broadcaster
