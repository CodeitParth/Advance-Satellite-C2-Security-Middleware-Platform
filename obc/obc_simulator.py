#!/usr/bin/env python3
"""Mock satellite OBC — standalone UDP server on port 9000. Run: python obc_simulator.py"""
import json
import socket
from datetime import datetime, timezone

HOST = "0.0.0.0"
PORT = 9000
BUFSIZE = 4096

satellite_state = {
    "battery_percent": 8.0,
    "safe_mode_active": False,
    "thermal_status": "NOMINAL",
    "orbital_phase": "SUNLIT",
    "link_margin_db": 12.5,
    "attitude": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0},
    "subsystem_status": {
        "EPS": "NOMINAL", "ADCS": "NOMINAL",
        "TM": "NOMINAL", "OBC": "NOMINAL", "PAYLOAD": "NOMINAL",
    },
}


def _handle(command_type: str, parameters: dict) -> None:
    s = satellite_state
    handlers = {
        "REQUEST_TELEMETRY":  lambda _: None,
        "DISABLE_SAFE_MODE":  lambda _: s.update({"safe_mode_active": False}),
        "ENABLE_SAFE_MODE":   lambda _: s.update({"safe_mode_active": True}),
        "ATTITUDE_MANOEUVRE": lambda p: s["attitude"].update(p),
        "RESET_SUBSYSTEM":    lambda p: s["subsystem_status"].update(
            {p["subsystem"]: "NOMINAL"}) if "subsystem" in p else None,
        "THRUSTER_FIRE":      lambda p: s["attitude"].update(
            {"yaw": s["attitude"]["yaw"] + p.get("delta_yaw", 0)}),
        "UPDATE_PARAMETER":   lambda _: None,
        "RESET_OBC":          lambda _: s.update(
            {"subsystem_status": {k: "NOMINAL" for k in s["subsystem_status"]}}),
        "PAYLOAD_ACTIVATE":   lambda _: s["subsystem_status"].update({"PAYLOAD": "ACTIVE"}),
    }
    fn = handlers.get(command_type)
    if fn:
        fn(parameters)


def _process(data: bytes) -> dict:
    try:
        req = json.loads(data.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        return {"status": "ERROR", "message": f"Bad request: {exc}"}

    command_type = req.get("command_type", "UNKNOWN")
    parameters   = req.get("parameters", {})
    command_id   = req.get("command_id", "unknown")

    satellite_state["battery_percent"] = round(
        max(0.0, satellite_state["battery_percent"] - 0.1), 2
    )

    _handle(command_type, parameters)

    if satellite_state["battery_percent"] < 5.0:
        satellite_state["safe_mode_active"] = True

    return {
        "status": "ACK",
        "command_id": command_id,
        "executed_command": command_type,
        "telemetry": {
            "battery_percent":  satellite_state["battery_percent"],
            "safe_mode_active": satellite_state["safe_mode_active"],
            "thermal_status":   satellite_state["thermal_status"],
            "orbital_phase":    satellite_state["orbital_phase"],
            "link_margin_db":   satellite_state["link_margin_db"],
            "attitude":         dict(satellite_state["attitude"]),
            "subsystem_status": dict(satellite_state["subsystem_status"]),
        },
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def run() -> None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind((HOST, PORT))
    except OSError as exc:
        print(f"OBC simulator: cannot bind UDP {HOST}:{PORT} — {exc}")
        print("Another OBC instance is probably already running. Stop it and retry.")
        return
    print(f"OBC simulator listening on UDP {HOST}:{PORT}")
    try:
        while True:
            try:
                data, addr = sock.recvfrom(BUFSIZE)
                response = _process(data)
                sock.sendto(json.dumps(response).encode("utf-8"), addr)
                if response.get("status") == "ACK":
                    print(f"[{response['timestamp']}] ACK {response['executed_command']} "
                          f"(battery {satellite_state['battery_percent']}%)")
                else:
                    print(f"REJECTED malformed packet from {addr}: {response.get('message')}")
            except KeyboardInterrupt:
                raise
            except Exception as exc:  # one bad packet must never kill the simulator
                print(f"OBC handler error (recovered): {exc!r}")
    except KeyboardInterrupt:
        print("\nOBC simulator stopped.")
    finally:
        sock.close()


if __name__ == "__main__":
    run()
