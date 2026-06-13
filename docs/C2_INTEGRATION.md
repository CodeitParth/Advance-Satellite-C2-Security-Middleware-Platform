# C2 Integration — SCSP as a Transparent Security Proxy

SCSP sits between your existing ground-station C2 software and the satellite
uplink. The C2 system keeps building and sending CCSDS telecommands exactly as
it does today; SCSP intercepts them, runs the full security pipeline (parse →
replay/sequence/drift checks → AI risk scoring → tiered authorization), and
forwards **approved packets verbatim** to the uplink. Zero changes to the C2
system, zero changes to satellite firmware.

## REST Proxy Adapter (any C2 system)

### Setup
1. Set `C2_PROXY_API_KEY` in `backend/.env` (empty = proxy disabled).
2. Ensure the `c2_gateway` service account exists (`python scripts/seed_operators.py`
   creates it — it has no usable interactive password; the API key maps onto it).
3. Point the C2 system's command output at the proxy endpoint instead of the
   radio/uplink driver.

### Forward a command
```bash
curl -X POST http://<scsp-host>:8000/api/v1/c2/forward \
  -H "X-API-Key: $C2_PROXY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "packet_hex": "1900C0000000012A4B",
        "source_system": "COSMOS-GS1"
      }'
```
The `nonce` field is optional — SCSP generates one when omitted, since external
C2 systems don't manage SCSP replay nonces. Supplying your own enables
end-to-end replay protection from inside the C2.

### Response dispositions
| `disposition` | Meaning | C2 action |
|---|---|---|
| `FORWARDED` | LOW risk auto-approved (or override window) — already dispatched to the uplink | Done — treat as sent |
| `PENDING_AUTHORIZATION` | MEDIUM/HIGH risk — held for safety-officer approval | Poll `status_url` until `FORWARDED` / `REJECTED` / `BLOCKED` |
| `REJECTED` | A safety officer rejected the command | Surface the `justification` to the operator |
| `BLOCKED` | Approval window (5 min) expired | Resubmit if still operationally valid |
| HTTP 400 `INVALID_CCSDS_PACKET` | Packet failed structural/CRC validation | Fix and resubmit |
| HTTP 409 `REPLAY_DETECTED` | Duplicate nonce | Investigate — possible replay attack |

### Poll a held command
```bash
curl http://<scsp-host>:8000/api/v1/c2/command/<command_id> \
  -H "X-API-Key: $C2_PROXY_API_KEY"
```

## OpenC3 COSMOS

COSMOS routes commands through interface classes. Two integration options:

**Option A — Interface override (recommended).** Replace the target's uplink
interface with an HTTP client interface that POSTs each command packet to
`/api/v1/c2/forward`. COSMOS ≥ 5 ships `HttpClientInterface`; configure it in
`plugin.txt`:

```ruby
# plugin.txt of the SCSP shim plugin
INTERFACE SCSP_PROXY_INT http_client_interface.rb <scsp-host> 8000 http false
  NAMED_WRITE_PROTOCOL scsp_forward
MAP_TARGET SAT_ALPHA
```

with a ~30-line `scsp_forward` write protocol that hex-encodes the packet
buffer, wraps it as `{"packet_hex": ..., "source_system": "COSMOS"}` and sets
the `X-API-Key` header. Telemetry continues to flow over the existing TLM
interface — SCSP only intercepts the command path.

**Option B — cmd hook.** Keep the existing interface but route `cmd()` calls
through a COSMOS script-runner wrapper that calls the REST adapter and only
releases the original `cmd()` once disposition is `FORWARDED`. Less invasive,
but blocks the script while authorization is pending.

## Security notes
- The API key is compared with `hmac.compare_digest` (timing-safe) and maps to
  a dedicated least-privilege `operator`-role account — proxy-ingested
  commands can never approve anything.
- Proxy submissions get the full pipeline: AI scoring with live telemetry,
  replay nonce window, sequence rules, behavioral drift, constellation
  elevation, hash-chained ledger entries.
- Rate limit: shares the command-submission bucket (60/min by default).
- For production, terminate TLS in front of the proxy and rotate the API key
  via your secrets manager (see docs/HARDENING.md).
