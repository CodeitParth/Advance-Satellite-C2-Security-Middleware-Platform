// Assembles a minimal valid CCSDS hex packet for a given command type. T-026
// Uses fixture packets from docs/ccsds_packets.json — the backend validates real structure.

// Static lookup: command_type → fixture packet_hex (CRC-validated, from docs/ccsds_packets.json)
const PACKET_FIXTURES: Record<string, string> = {
  // TM subsystem (APID 0x100, 0x101)
  REQUEST_TELEMETRY:  "1900C0000000012A4B",
  SET_BEACON_RATE:    "190180000001020A6B21",

  // OBC subsystem (APID 0x102, 0x200–0x205)
  REQUEST_STATUS:     "19028000000103A1F2",
  UPDATE_PARAMETER:   "1A008000000120050A3C7D",
  RESET_SUBSYSTEM:    "1A018000000121030192B4",
  UPDATE_AUTH_KEY:    "1A028000000122AABBCCDD44F1",
  RESET_OBC:          "1A038000000123E5D3",
  DISABLE_WATCHDOG:   "1A048000000124F2A1",
  FORCE_REBOOT:       "1A058000000125C7B9",

  // EPS subsystem (APID 0x18F, 0x18E)
  ENABLE_SAFE_MODE:   "198FC000000110D4E7",
  DISABLE_SAFE_MODE:  "198EC000000111B3A2",

  // ADCS subsystem (APID 0x300–0x302)
  SCHEDULE_MANOEUVRE: "1B008000000130001E00003C81D2",
  ATTITUDE_MANOEUVRE: "1B018000000131000F0000001E3F5A",
  THRUSTER_FIRE:      "1B028000000132000A00001492B1",

  // PAYLOAD subsystem (APID 0x400)
  PAYLOAD_ACTIVATE:   "1C008000000140019A43",
};

export const SUBSYSTEM_COMMANDS: Record<string, string[]> = {
  EPS:     ["ENABLE_SAFE_MODE", "DISABLE_SAFE_MODE"],
  OBC:     ["REQUEST_STATUS", "UPDATE_PARAMETER", "RESET_OBC", "DISABLE_WATCHDOG", "RESET_SUBSYSTEM", "FORCE_REBOOT", "UPDATE_AUTH_KEY"],
  ADCS:    ["ATTITUDE_MANOEUVRE", "SCHEDULE_MANOEUVRE", "THRUSTER_FIRE"],
  TM:      ["REQUEST_TELEMETRY", "SET_BEACON_RATE"],
  PAYLOAD: ["PAYLOAD_ACTIVATE"],
};

export function buildCcsdsPacket(commandType: string): string {
  return PACKET_FIXTURES[commandType] ?? PACKET_FIXTURES["REQUEST_STATUS"]!;
}

// Human-readable descriptions for the UI
export const COMMAND_DESCRIPTIONS: Record<string, string> = {
  ENABLE_SAFE_MODE:   "Engage protective safe mode — limits operations",
  DISABLE_SAFE_MODE:  "Disengage safe mode — restore full operations",
  REQUEST_STATUS:     "Query OBC health and operational status",
  UPDATE_PARAMETER:   "Set an OBC runtime configuration parameter",
  RESET_OBC:          "Perform soft reset of the on-board computer",
  DISABLE_WATCHDOG:   "Disable OBC watchdog timer (maintenance only)",
  RESET_SUBSYSTEM:    "Reset a satellite subsystem by ID",
  FORCE_REBOOT:       "Hard reboot of OBC (last resort)",
  UPDATE_AUTH_KEY:    "Update the command authentication key",
  ATTITUDE_MANOEUVRE: "Execute an attitude control manoeuvre",
  SCHEDULE_MANOEUVRE: "Schedule a future attitude manoeuvre",
  THRUSTER_FIRE:      "Fire RCS thrusters for orbital manoeuvre",
  REQUEST_TELEMETRY:  "Request telemetry beacon transmission",
  SET_BEACON_RATE:    "Adjust telemetry beacon transmission frequency",
  PAYLOAD_ACTIVATE:   "Activate the primary science payload",
};

// Risk tier hints for UX — server score is authoritative
export const COMMAND_RISK_HINT: Record<string, "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"> = {
  ENABLE_SAFE_MODE:   "LOW",
  DISABLE_SAFE_MODE:  "HIGH",
  REQUEST_STATUS:     "LOW",
  UPDATE_PARAMETER:   "MEDIUM",
  RESET_OBC:          "HIGH",
  DISABLE_WATCHDOG:   "HIGH",
  RESET_SUBSYSTEM:    "HIGH",
  FORCE_REBOOT:       "CRITICAL",
  UPDATE_AUTH_KEY:    "CRITICAL",
  ATTITUDE_MANOEUVRE: "MEDIUM",
  SCHEDULE_MANOEUVRE: "MEDIUM",
  THRUSTER_FIRE:      "HIGH",
  REQUEST_TELEMETRY:  "LOW",
  SET_BEACON_RATE:    "LOW",
  PAYLOAD_ACTIVATE:   "MEDIUM",
};
