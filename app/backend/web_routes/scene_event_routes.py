"""WebSocket route that streams live scene events to the browser.

All connections share the single process-wide SceneEventBroadcaster, which holds
one dedicated gRPC stream to the SDK server. See scene_events/broadcaster.py.
"""
from fastapi import WebSocket, WebSocketDisconnect

from scene_events.broadcaster import get_broadcaster


def register_scene_event_routes(app, get_service, error_response):
    """Register the scene-event WebSocket route."""

    @app.websocket('/api/scene-events/ws')
    async def scene_events_ws(websocket: WebSocket):
        # get_service() yields (NebulaServices, target); we only need the target
        # so the broadcaster's dedicated client points at the same server.
        _, target = get_service()
        broadcaster = get_broadcaster(target)
        await broadcaster.add_client(websocket)
        try:
            # Block until the client disconnects; the broadcaster pushes events.
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            broadcaster.remove_client(websocket)
