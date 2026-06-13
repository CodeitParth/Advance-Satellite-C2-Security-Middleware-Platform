# SCSP Shim Plugin for OpenC3 COSMOS 5+

Routes every command COSMOS writes for a target through the SCSP security
pipeline instead of sending it straight to the radio. Telemetry is untouched —
only the command path is intercepted.

```
COSMOS cmd() ──► HttpClientInterface ──► SCSP /api/v1/c2/forward ──► uplink
                     (this plugin)         parse → score → authorize
```

## Files
- `plugin.txt` — COSMOS plugin definition (interface + variables)
- `targets/SCSP_SHIM/lib/scsp_forward_protocol.rb` — write protocol that
  hex-encodes each outgoing packet and POSTs it to the SCSP proxy

## Install
```bash
# from this directory, with the COSMOS toolchain available
openc3cli rake build VERSION=1.0.0
# upload the generated .gem in the COSMOS Admin → Plugins UI, setting:
#   SCSP_HOST     → host running the SCSP backend
#   SCSP_PORT     → 8000
#   SCSP_API_KEY  → value of C2_PROXY_API_KEY from backend/.env
```

## Behavior
- `FORWARDED` → command was approved (LOW risk / override) and dispatched.
- `PENDING_AUTHORIZATION` → held for safety-officer approval; the protocol
  raises a COSMOS write error containing the SCSP `command_id` so the script
  can poll `/api/v1/c2/command/<id>` and retry/inform the operator.
- `REJECTED` / `BLOCKED` / 4xx → surfaced as a write error with the SCSP
  justification text.

See `docs/C2_INTEGRATION.md` for the REST contract.
