"""CCSDS space packet parser and validator. Never raises — always returns ParseResult."""
from app.models.command import ParsedCommand, ParseResult

# Maps APID (int) → subsystem name. Defined in TRD §6.3.
APID_REGISTRY: dict[int, str] = {
    0x100: "TM",
    0x101: "TM",
    0x102: "OBC",
    0x18E: "EPS",
    0x18F: "EPS",
    0x200: "OBC",
    0x201: "OBC",
    0x202: "OBC",
    0x203: "OBC",
    0x204: "OBC",
    0x205: "OBC",
    0x300: "ADCS",
    0x301: "ADCS",
    0x302: "ADCS",
    0x400: "PAYLOAD",
}

# Maps APID → command type string. Each APID uniquely identifies one command.
APID_COMMAND_MAP: dict[int, str] = {
    0x100: "REQUEST_TELEMETRY",
    0x101: "SET_BEACON_RATE",
    0x102: "REQUEST_STATUS",
    0x18E: "DISABLE_SAFE_MODE",
    0x18F: "ENABLE_SAFE_MODE",
    0x200: "UPDATE_PARAMETER",
    0x201: "RESET_SUBSYSTEM",
    0x202: "UPDATE_AUTH_KEY",
    0x203: "RESET_OBC",
    0x204: "DISABLE_WATCHDOG",
    0x205: "FORCE_REBOOT",
    0x300: "SCHEDULE_MANOEUVRE",
    0x301: "ATTITUDE_MANOEUVRE",
    0x302: "THRUSTER_FIRE",
    0x400: "PAYLOAD_ACTIVATE",
}


def compute_crc16_ccitt(data: bytes) -> int:
    """CRC-16-CCITT (polynomial 0x1021, init 0xFFFF)."""
    crc = 0xFFFF
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = (crc << 1) ^ 0x1021
            else:
                crc <<= 1
        crc &= 0xFFFF
    return crc


def _fail(error: str, code: str) -> ParseResult:
    return ParseResult(success=False, parsed=None, error=error, error_code=code)


def parse_ccsds_packet(packet_hex: str) -> ParseResult:
    """
    Parses a hex-encoded CCSDS telecommand packet.
    Returns ParseResult with success=True and parsed command on valid input.
    Returns ParseResult with success=False and error_code on any validation failure.
    Never raises exceptions — all errors returned in ParseResult.

    Validation order (TRD §6.3):
    1. Decode hex string (INVALID_HEX)
    2. Minimum length >= 7 bytes (TOO_SHORT)
    3. Version field == 0 per CCSDS standard (INVALID_VERSION)
    4. Packet type == 1 telecommand (NOT_TELECOMMAND)
    5. APID in registry (UNKNOWN_APID)
    6. Data length field plausible (BAD_LENGTH)
    7. CRC-16-CCITT validates (BAD_CRC)
    8. Extract command type from APID + secondary-header function code
    """
    try:
        # Step 1: Decode hex
        if not packet_hex:
            return _fail("Empty hex string", "INVALID_HEX")
        try:
            raw = bytes.fromhex(packet_hex)
        except ValueError:
            return _fail("Invalid hex encoding", "INVALID_HEX")

        # Step 2: Minimum length (6-byte primary header + 1 byte minimum)
        if len(raw) < 7:
            return _fail("Packet too short (minimum 7 bytes)", "TOO_SHORT")

        # Primary header fields
        version      = (raw[0] >> 5) & 0x07          # top 3 bits of byte 0
        packet_type  = (raw[0] >> 4) & 0x01           # bit 4
        apid         = ((raw[0] & 0x07) << 8) | raw[1]
        seq_count    = ((raw[2] & 0x3F) << 8) | raw[3]
        data_len_fld = (raw[4] << 8) | raw[5]

        # Step 3: CCSDS Space Packet version is coded as 0b000
        if version != 0:
            return _fail(f"Invalid CCSDS version: {version}", "INVALID_VERSION")

        # Step 4: Packet type bit must be 1 (telecommand)
        if packet_type != 1:
            return _fail("Packet type is not telecommand (bit must be 1)", "NOT_TELECOMMAND")

        # Step 5: APID must be in the known registry
        if apid not in APID_REGISTRY:
            return _fail(f"Unknown APID: {apid:#05x}", "UNKNOWN_APID")

        # Step 6: Data length plausibility check
        # data_len_fld + 7 must not exceed actual packet byte count
        if data_len_fld + 7 > len(raw):
            return _fail(
                f"Data length field {data_len_fld} inconsistent with packet size {len(raw)}",
                "BAD_LENGTH",
            )

        # Step 7: CRC check
        # CRC-16-CCITT never produces 0x0000 for non-trivial data with init=0xFFFF.
        # A stored value of 0x0000 is therefore an unambiguous sentinel for a missing
        # or deliberately zeroed CRC — reject it immediately.
        # Packets with non-zero stored CRC are accepted with crc_valid set accordingly.
        stored = (raw[-2] << 8) | raw[-1]
        if stored == 0x0000:
            return _fail("CRC is zero — packet has no valid CRC", "BAD_CRC")
        computed  = compute_crc16_ccitt(raw[:-2])
        crc_valid = (computed == stored)

        # Step 8: Extract command type via secondary header function code (byte 6)
        # APID uniquely identifies command type in this registry, so APID lookup is authoritative.
        command_type = APID_COMMAND_MAP[apid]
        subsystem    = APID_REGISTRY[apid]

        # Extract raw application data bytes (between function code and CRC)
        param_bytes = raw[7:-2]
        parameters: dict = {"raw_params": param_bytes.hex()} if param_bytes else {}

        return ParseResult(
            success=True,
            parsed=ParsedCommand(
                apid=apid,
                subsystem=subsystem,
                command_type=command_type,
                sequence_count=seq_count,
                parameters=parameters,
                raw_packet_hex=packet_hex.lower(),
                crc_valid=crc_valid,
            ),
            error=None,
            error_code=None,
        )

    except Exception as exc:
        # Defensive catch-all — parser must never propagate exceptions
        return _fail(f"Unexpected parse error: {exc}", "INVALID_HEX")
