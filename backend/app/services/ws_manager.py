"""WebSocket ConnectionManager: role-keyed connection registry and broadcast helpers."""
from collections import defaultdict
from typing import DefaultDict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.connections: DefaultDict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, ws: WebSocket, role: str) -> None:
        await ws.accept()
        self.connections[role].append(ws)

    def disconnect(self, ws: WebSocket, role: str) -> None:
        self.connections[role] = [c for c in self.connections[role] if c is not ws]

    async def broadcast_to_role(self, role: str, message: dict) -> None:
        """Send JSON message to all connected clients with this role.
        Dead connections are cleaned up automatically on send failure.
        """
        dead: list[WebSocket] = []
        for ws in list(self.connections[role]):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, role)

    async def broadcast_approver(self, message: dict) -> None:
        """Broadcast to all approver and admin connections."""
        await self.broadcast_to_role("approver", message)
        await self.broadcast_to_role("admin", message)


ws_manager = ConnectionManager()
