"use client";
// CommandTerminal — command authoring form with subsystem/type dropdowns. T-026
import { useState, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { clsx } from "clsx";
import { Send, RefreshCw, FileText, ChevronDown, AlertCircle } from "lucide-react";
import { api } from "../lib/api";
import {
  buildCcsdsPacket,
  SUBSYSTEM_COMMANDS,
  COMMAND_DESCRIPTIONS,
  COMMAND_RISK_HINT,
} from "../lib/ccsds_builder";
import { RiskTierBadge } from "./ui/StatusBadge";
import type { CommandSubmitResponse } from "../lib/types";

const SUBSYSTEMS = Object.keys(SUBSYSTEM_COMMANDS) as (keyof typeof SUBSYSTEM_COMMANDS)[];

interface CommandTemplate {
  commandType: string;
  subsystem: string;
  label: string;
}

const SAFE_TEMPLATES: CommandTemplate[] = [
  { commandType: "ENABLE_SAFE_MODE",  subsystem: "EPS", label: "Enable Safe Mode" },
  { commandType: "REQUEST_TELEMETRY", subsystem: "TM",  label: "Request Telemetry" },
  { commandType: "REQUEST_STATUS",    subsystem: "OBC", label: "Request OBC Status" },
];

const OPS_TEMPLATES: CommandTemplate[] = [
  { commandType: "UPDATE_PARAMETER",   subsystem: "OBC",  label: "Update Parameter" },
  { commandType: "ATTITUDE_MANOEUVRE", subsystem: "ADCS", label: "Attitude Manoeuvre" },
  { commandType: "SET_BEACON_RATE",    subsystem: "TM",   label: "Set Beacon Rate" },
  { commandType: "DISABLE_SAFE_MODE",  subsystem: "EPS",  label: "Disable Safe Mode" },
  { commandType: "PAYLOAD_ACTIVATE",   subsystem: "PAYLOAD", label: "Activate Payload" },
];

interface CommandTerminalProps {
  onScoreResult?: (result: CommandSubmitResponse) => void;
}

export function CommandTerminal({ onScoreResult }: CommandTerminalProps) {
  const [subsystem, setSubsystem] = useState("TM");
  const [commandType, setCommandType] = useState("REQUEST_TELEMETRY");
  const [packetHex, setPacketHex] = useState("");
  const [nonce, setNonce] = useState(uuidv4);
  const [justificationNote, setJustificationNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHex, setShowHex] = useState(false);

  // Rebuild hex when command changes
  useEffect(() => {
    setPacketHex(buildCcsdsPacket(commandType));
  }, [commandType]);

  // When subsystem changes, reset commandType to first in list
  useEffect(() => {
    const cmds = SUBSYSTEM_COMMANDS[subsystem] ?? [];
    if (!cmds.includes(commandType)) {
      setCommandType(cmds[0] ?? "");
    }
  }, [subsystem, commandType]);

  const availableCommands = SUBSYSTEM_COMMANDS[subsystem] ?? [];
  const riskHint = COMMAND_RISK_HINT[commandType];
  const description = COMMAND_DESCRIPTIONS[commandType] ?? "";

  function applyTemplate(tpl: CommandTemplate) {
    setSubsystem(tpl.subsystem);
    setCommandType(tpl.commandType);
  }

  function regenerateNonce() {
    setNonce(uuidv4());
  }

  const handleSubmit = useCallback(async () => {
    if (!commandType || !packetHex) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await api.submitCommand({ packet_hex: packetHex, nonce });
      onScoreResult?.(result);
      // Rotate nonce after successful submission
      setNonce(uuidv4());
    } catch (err) {
      const e = err as Error & { code?: string };
      if (e.code === "REPLAY_DETECTED") {
        setError("Replay attack detected — duplicate command nonce. Regenerating nonce.");
        setNonce(uuidv4());
      } else if (e.code === "INVALID_CCSDS_PACKET") {
        setError("Packet validation failed: " + e.message);
      } else {
        setError(e.message ?? "Submission failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [commandType, packetHex, nonce, onScoreResult]);

  return (
    <div className="flex flex-col gap-4">

      {/* Command Definition card */}
      <div className="card p-4 space-y-4">
        <h3 className="text-md font-semibold text-content-primary">Command Definition</h3>

        {/* Subsystem */}
        <div>
          <label className="block text-xs font-medium text-content-secondary mb-1.5">Subsystem</label>
          <div className="relative">
            <select
              value={subsystem}
              onChange={(e) => setSubsystem(e.target.value)}
              className="input-base appearance-none pr-8"
            >
              {SUBSYSTEMS.map((s) => (
                <option key={s} value={s}>{s} — {s === "EPS" ? "Electrical Power System" : s === "OBC" ? "On-Board Computer" : s === "ADCS" ? "Attitude & Orbit Control" : s === "TM" ? "Telemetry & Communications" : "Science Payload"}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
          </div>
        </div>

        {/* Command Type */}
        <div>
          <label className="block text-xs font-medium text-content-secondary mb-1.5">Command Type</label>
          <div className="relative">
            <select
              value={commandType}
              onChange={(e) => setCommandType(e.target.value)}
              className="input-base appearance-none pr-8"
            >
              {availableCommands.map((cmd) => (
                <option key={cmd} value={cmd}>{cmd}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
          </div>
          {description && (
            <p className="text-2xs text-content-muted mt-1.5 leading-relaxed">{description}</p>
          )}
        </div>

        {/* Risk hint */}
        {riskHint && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-content-muted">Expected risk:</span>
            <RiskTierBadge tier={riskHint} />
            <span className="text-2xs text-content-disabled">(server score is authoritative)</span>
          </div>
        )}

        {/* CCSDS Hex (collapsible) */}
        <div>
          <button
            type="button"
            onClick={() => setShowHex((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-content-muted hover:text-content-secondary transition-colors mb-1"
          >
            <ChevronDown className={clsx("w-3.5 h-3.5 transition-transform", showHex && "rotate-180")} />
            CCSDS Packet Hex
          </button>
          {showHex && (
            <textarea
              value={packetHex}
              onChange={(e) => setPacketHex(e.target.value.toUpperCase().replace(/[^0-9A-F]/g, ""))}
              rows={2}
              spellCheck={false}
              className="input-base font-mono text-xs resize-none"
              placeholder="CCSDS packet hex…"
              maxLength={2048}
            />
          )}
        </div>

        {/* Nonce */}
        <div>
          <label className="block text-xs font-medium text-content-secondary mb-1.5">
            Replay-Prevention Nonce
          </label>
          <div className="flex gap-2">
            <input
              value={nonce}
              onChange={(e) => setNonce(e.target.value.slice(0, 64))}
              spellCheck={false}
              className="input-base font-mono text-xs flex-1"
              title="Editable for replay-attack demos — reuse a previous nonce to trigger REPLAY_DETECTED"
            />
            <button
              type="button"
              onClick={regenerateNonce}
              className="btn-secondary shrink-0 px-2.5"
              title="Regenerate nonce"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Optional note */}
        <div>
          <label className="block text-xs font-medium text-content-secondary mb-1.5">
            Operator Note <span className="text-content-disabled">(optional)</span>
          </label>
          <textarea
            value={justificationNote}
            onChange={(e) => setJustificationNote(e.target.value)}
            rows={2}
            className="input-base text-xs resize-none"
            placeholder="Operational justification for this command…"
            maxLength={500}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-2.5 rounded bg-danger-subtle border border-danger-border text-danger text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !commandType}
          className="btn-primary w-full"
        >
          {isSubmitting ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              Run AI Analysis
            </>
          )}
        </button>
      </div>

      {/* Command Templates */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-content-muted" />
          <h3 className="text-md font-semibold text-content-primary">Command Templates</h3>
        </div>

        <div>
          <div className="section-label mb-2">Safe Operations</div>
          <div className="space-y-1">
            {SAFE_TEMPLATES.map((tpl) => (
              <button
                key={tpl.commandType}
                onClick={() => applyTemplate(tpl)}
                className={clsx(
                  "w-full flex items-center justify-between px-3 py-2 rounded text-left",
                  "hover:bg-surface-2 transition-colors border border-transparent hover:border-border",
                  commandType === tpl.commandType && "bg-accent-subtle border-accent-border",
                )}
              >
                <div>
                  <div className="text-xs font-medium text-content-primary">{tpl.label}</div>
                  <div className="text-2xs text-content-muted font-mono">{tpl.commandType}</div>
                </div>
                <RiskTierBadge tier={COMMAND_RISK_HINT[tpl.commandType] ?? "LOW"} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="section-label mb-2">Subsystem Operations</div>
          <div className="space-y-1">
            {OPS_TEMPLATES.map((tpl) => (
              <button
                key={tpl.commandType}
                onClick={() => applyTemplate(tpl)}
                className={clsx(
                  "w-full flex items-center justify-between px-3 py-2 rounded text-left",
                  "hover:bg-surface-2 transition-colors border border-transparent hover:border-border",
                  commandType === tpl.commandType && "bg-accent-subtle border-accent-border",
                )}
              >
                <div>
                  <div className="text-xs font-medium text-content-primary">{tpl.label}</div>
                  <div className="text-2xs text-content-muted font-mono">{tpl.commandType}</div>
                </div>
                <RiskTierBadge tier={COMMAND_RISK_HINT[tpl.commandType] ?? "MEDIUM"} />
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

export default CommandTerminal;
