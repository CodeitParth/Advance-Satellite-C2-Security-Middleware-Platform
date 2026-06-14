"""Unit tests — CCSDS parser: valid parse + all validation failures. TRD §16.1"""
from app.services.ccsds_parser import (
    APID_COMMAND_MAP,
    APID_REGISTRY,
    compute_crc16_ccitt,
    parse_ccsds_packet,
)

# Known-good fixture (matches frontend lib/ccsds_builder.ts)
VALID_REQUEST_TELEMETRY = "1900C0000000012A4B"
VALID_DISABLE_SAFE_MODE = "198EC000000111B3A2"


def _build_packet(apid: int, version: int = 0, pkt_type: int = 1,
                  func_code: int = 0x01, crc_override: int | None = None) -> str:
    """Construct a syntactically valid telecommand packet for mutation tests."""
    b0 = ((version & 0x07) << 5) | ((pkt_type & 0x01) << 4) | ((apid >> 8) & 0x07)
    b1 = apid & 0xFF
    header = bytes([b0, b1, 0xC0, 0x00, 0x00, 0x00, func_code])
    crc = compute_crc16_ccitt(header) if crc_override is None else crc_override
    return (header + bytes([crc >> 8, crc & 0xFF])).hex().upper()


class TestValidParse:
    def test_valid_request_telemetry(self):
        result = parse_ccsds_packet(VALID_REQUEST_TELEMETRY)
        assert result.success
        assert result.parsed is not None
        assert result.parsed.command_type == "REQUEST_TELEMETRY"
        assert result.parsed.subsystem == "TM"

    def test_valid_disable_safe_mode(self):
        result = parse_ccsds_packet(VALID_DISABLE_SAFE_MODE)
        assert result.success
        assert result.parsed is not None
        assert result.parsed.command_type == "DISABLE_SAFE_MODE"
        assert result.parsed.subsystem == "EPS"

    def test_all_registry_apids_parse(self):
        for apid, expected_type in APID_COMMAND_MAP.items():
            result = parse_ccsds_packet(_build_packet(apid))
            assert result.success, f"APID {apid:#05x}: {result.error}"
            assert result.parsed is not None
            assert result.parsed.command_type == expected_type
            assert result.parsed.subsystem == APID_REGISTRY[apid]


class TestValidationFailures:
    def test_empty_hex(self):
        result = parse_ccsds_packet("")
        assert not result.success and result.error_code == "INVALID_HEX"

    def test_non_hex_characters(self):
        result = parse_ccsds_packet("ZZNOTHEX")
        assert not result.success and result.error_code == "INVALID_HEX"

    def test_too_short(self):
        result = parse_ccsds_packet("190001")  # 3 bytes < 7 minimum
        assert not result.success and result.error_code == "TOO_SHORT"

    def test_invalid_version(self):
        result = parse_ccsds_packet(_build_packet(0x100, version=2))
        assert not result.success and result.error_code == "INVALID_VERSION"

    def test_not_telecommand(self):
        result = parse_ccsds_packet(_build_packet(0x100, pkt_type=0))
        assert not result.success and result.error_code == "NOT_TELECOMMAND"

    def test_unknown_apid(self):
        result = parse_ccsds_packet(_build_packet(0x0FF))  # not in registry
        assert not result.success and result.error_code == "UNKNOWN_APID"

    def test_bad_length_field(self):
        # data length field claims more bytes than the packet contains
        raw = bytes.fromhex(VALID_REQUEST_TELEMETRY)
        mutated = raw[:4] + bytes([0xFF, 0xFF]) + raw[6:]
        result = parse_ccsds_packet(mutated.hex())
        assert not result.success and result.error_code == "BAD_LENGTH"

    def test_zero_crc_rejected(self):
        result = parse_ccsds_packet(_build_packet(0x100, crc_override=0x0000))
        assert not result.success and result.error_code == "BAD_CRC"

    def test_never_raises_on_garbage(self):
        for garbage in ["", "00", "GG", "F" * 5000, VALID_REQUEST_TELEMETRY[:-1]]:
            result = parse_ccsds_packet(garbage)  # must not raise
            assert result.success in (True, False)


def test_crc16_ccitt_known_vector():
    # CRC-16-CCITT (init 0xFFFF, poly 0x1021) of ASCII "123456789" is 0x29B1
    assert compute_crc16_ccitt(b"123456789") == 0x29B1
