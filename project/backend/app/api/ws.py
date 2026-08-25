from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websocket.manager import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            # Frontend doesn't need to send anything; just keep the socket open.
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
