# Product Requirements Document
# Satellite Command Security Platform (SCSP)

---

## §1 — Document Header & Metadata

| Field | Value |
|---|---|
| **Document Title** | Satellite Command Security Platform — Product Requirements Document |
| **Version** | 1.0.0 |
| **Status** | Draft — Planning Phase |
| **Category** | Space & Aerospace |
| **Classification** | Internal — Hackathon Planning |
| **Created** | 2026-06-10 |
| **Last Updated** | 2026-06-10 |

### AI-Agent Usage Notes

This document is structured for direct consumption by AI coding agents. Each feature section includes:
- Explicit input/output specifications
- Acceptance criteria in testable format
- Database schema with field-level types
- Prompt templates where relevant
- Phase tags (`[MVP]`, `[PHASE_2]`, `[ROADMAP]`) on every feature

Agents should treat phase-tagged features as independent, buildable units. The `[MVP]` tag indicates the feature must be present in the 4-day build. `[PHASE_2]` features are fully specified and should be scaffolded but not fully implemented. `[ROADMAP]` features are architecturally described only.

---

## §2 — Executive Summary

### The Problem

Every satellite ground control system in existence today — from open-source OpenC3 COSMOS to Lockheed Martin's Compass — treats security as a transmission problem. The question each system asks is: *"Is this a valid, authenticated packet from a credentialed operator?"* If yes, the command executes. No existing system asks the semantically more important question: *"Should this command execute right now, given the satellite's current state, the operator's behavioral history, and the known threat landscape?"*

This gap is not theoretical. In 2022, the Viasat AcidRain attack disabled over 40,000 satellite modems across Europe by exploiting ground-segment vulnerabilities — not the satellite hardware itself. CISA's 2023 Space Systems advisory explicitly states that even encrypted uplinks do not protect against commands injected through legitimate but compromised operator infrastructure. Oxford's 2025 CubeSat security audit found that no general defense against signal injection into satellite systems has been proposed.

### The Solution

The **Satellite Command Security Platform (SCSP)** is a ground-station security middleware layer that intercepts every command between a ground operator and a satellite, applies a semantic AI risk score using live telemetry context, routes the command through a tiered multi-party authorization chain proportional to its risk, cryptographically signs and logs every decision in a tamper-evident hash-chained ledger, and detects replay attacks and anomalous command sequences before transmission.

SCSP does not replace existing C2 systems. It sits between them and the uplink as an intelligent, auditable security proxy.

### Three Primary Novelty Claims

1. **Semantic + telemetry-aware AI risk scoring** — commands are scored not as packets but as intents, in the context of the satellite's live operational state. No existing tool does this.
2. **Tiered multi-party authorization proportional to risk** — approval requirements scale dynamically with the AI risk score, creating a consequential enforcement layer that existing systems entirely lack.
3. **Hash-chained non-repudiable command ledger** — every command, approval, and rejection is cryptographically chained, making tampering detectable and providing non-repudiation that no open tool currently offers.

### Expected Outcome

A fully demo-able MVP in 4 days that closes the semantic security gap in satellite command infrastructure, with a working ground-station UI, simulated satellite OBC, live AI risk scoring, real-time multi-party approval workflow, and tamper-evident audit trail — all backed by five peer-reviewed research papers documenting the exact gaps this platform fills.

---

## §3 — Problem Statement & Market Context

### 3.1 The Binary Trust Problem in Satellite C2 Systems

The foundational security assumption in every current satellite command and control (C2) system is binary: an operator who has authenticated successfully is a trusted operator, and any syntactically valid command they submit will be transmitted to the satellite. This model was designed for an era where ground stations were physically isolated facilities with a small number of vetted personnel operating purpose-built hardware.

That era is over. Ground stations are now cloud-hosted. Operators work remotely. CubeSats are launched by universities and startups with no dedicated security team. The attack surface has expanded dramatically while the trust model has not changed.

The binary trust model fails against three concrete threat scenarios:
- **Insider threat**: A credentialed operator sends a destructive command intentionally or under coercion. The system has no mechanism to require a second opinion on high-risk actions.
- **Compromised credentials**: An attacker with stolen operator credentials sends commands through legitimate authenticated channels. Encryption protects the channel but not the decision.
- **False-data injection**: An attacker manipulates the ground-side data the operator sees, causing them to issue a command that is valid in syntax but catastrophic given the satellite's actual state.

### 3.2 Real-World Incidents

**Viasat AcidRain — February 2022**
A destructive cyberattack targeted Viasat's KA-SAT ground segment on the day of Russia's invasion of Ukraine. The attackers exploited a misconfiguration in the satellite ground station network to deploy the AcidRain wiper malware, permanently disabling over 40,000 satellite modems across Europe and disrupting wind farm control networks, emergency services, and military communications. The attack vector was the ground segment — not the space segment. Source: CISA Advisory AA22-076A.

**CISA Space Systems Advisory — 2023**
The US Cybersecurity and Infrastructure Security Agency published explicit guidance on space system threats, noting that "once an attacker gains access through a successful compromise of a space system, an encrypted link doesn't help — the attacker can control the system using its own legitimate command infrastructure." This directly invalidates the argument that CCSDS SDLS encryption solves the problem.

**Hong Dark Supply Chain Scandal**
Counterfeit and compromised components sourced from a single supplier were found in Traffic Alert and Collision Avoidance Systems across multiple US military aircraft platforms including the C-5AMP, C-12, and RQ-4 Global Hawk. While primarily a supply chain incident, it demonstrated the reality of insider-adjacent threat vectors in aerospace systems.

**OPS-SAT Vulnerability Findings — 2023**
Willbold et al.'s IEEE S&P 2023 analysis of ESA's OPS-SAT and five other satellites found security-critical vulnerabilities in every single satellite analyzed, including unprotected telecommand interfaces, missing encryption on command uplinks, and debug interfaces left open in production firmware.

### 3.3 CubeSat-Specific Vulnerabilities

The CubeSat ecosystem presents a particularly acute version of this problem. CubeSats use legacy communication protocols designed decades before cybersecurity was a concern:

**AX.25 Protocol**: The default link-layer protocol for amateur and small satellite communications. AX.25 has zero authentication, zero encryption, and zero command integrity protection. Any attacker within radio range of the ground station — or able to spoof the RF link — can inject arbitrary commands. The protocol was designed in 1984 for amateur radio and has not been updated for security.

**CCSDS Telecommand Standard**: The Consultative Committee for Space Data Systems telecommand standard is widely used for small satellite operations. While CCSDS has a Space Data Link Security (SDLS) extension, it is not widely implemented in CubeSat missions due to power and computational constraints. The base CCSDS profile has no authentication layer.

**Resource Constraints**: CubeSats typically operate at 1-3U form factors with severe power budgets (often under 2W for communications). This constrains the on-board security capabilities and means that security must be enforced on the ground side — precisely where SCSP operates.

Shelby's 2025 Oxford analysis introduced the concept of "Security-per-Watt" as a heuristic for CubeSat security design, noting that ground-segment security controls are the most power-efficient countermeasure available because they impose zero cost on the satellite.

### 3.4 Regulatory and Compliance Landscape

**NIST IR 8401 — Satellite Ground System Security**
NIST's Interagency Report 8401 provides cybersecurity guidance specifically for satellite ground systems. Key requirements relevant to SCSP:
- Non-repudiation of commands (directly addressed by the hash-chained ledger)
- Multi-factor authorization for safety-critical commands (addressed by the tiered auth chain)
- Audit logging with integrity protection (addressed by the tamper-evident ledger)
- Anomaly detection on command streams (addressed by replay detection and behavioral drift)

**CISA Space Systems Cybersecurity Guidelines**
CISA's guidelines for space systems explicitly identify ground segment command integrity as a priority area, noting the absence of semantic-level command validation in current tools.

**MITRE ATT&CK for Space (ICS)**
The MITRE ATT&CK framework's space systems extension (under ICS) catalogs attack techniques relevant to satellite C2, including:
- `T0836` — Modify Parameter (manipulating command parameters)
- `T0855` — Unauthorized Command Message (injecting unauthenticated commands)
- `T0873` — Project File Infection (compromising ground-side tooling)

SCSP's AI risk scoring engine maps detected command patterns to MITRE ATT&CK techniques as part of its SPARTA threat model integration.

### 3.5 Why Existing Encryption (SDLS) Is Insufficient

A common counterargument to the problem statement is: "CCSDS Space Data Link Security (SDLS) already encrypts and authenticates the uplink — isn't that enough?" The answer is no, for four reasons:

1. **SDLS addresses the channel, not the command.** Once a command is authenticated and transmitted through SDLS, it executes unconditionally. SDLS provides no mechanism to ask whether the command *should* execute.
2. **SDLS does not address insider threat.** An authenticated operator who has passed SDLS authentication can send any command. SDLS provides no second-opinion mechanism.
3. **SDLS adoption is low in CubeSat missions.** Due to power constraints and implementation complexity, most CubeSat operators use base CCSDS without SDLS.
4. **CISA explicitly confirmed this.** As noted above, CISA's advisory states that encrypted links do not protect against attacks operating through legitimate command infrastructure.

SCSP is designed to be layered on top of any existing security measures including SDLS — it is additive, not a replacement.

---

## §4 — Research Foundation

### 4.1 Willbold et al. — Space Odyssey: An Experimental Software Security Analysis of Satellites

**Citation**: Willbold, J., Schloegel, M., Vögele, M., Gerhardt, M., Holz, T., & Abbasi, A. (2023). *Space Odyssey: An Experimental Software Security Analysis of Satellites*. IEEE Symposium on Security and Privacy (S&P 2023). **Distinguished Paper Award.**

**Link**: https://ieeexplore.ieee.org/document/10179464

**Summary**: The authors conducted the first large-scale empirical security analysis of real satellite firmware, analyzing firmware from ESA's OPS-SAT mission and five additional satellite platforms. They used binary analysis, fuzzing, and manual review.

**Key Findings**:
- Security-critical vulnerabilities were found in every single satellite analyzed
- Unprotected telecommand interfaces were present in multiple satellites
- Missing encryption on command uplinks was common
- Debug interfaces (UART, JTAG) were left accessible in production firmware
- Memory corruption vulnerabilities were found in command parsing routines

**Direct Feature Justification for SCSP**:
This paper is the core motivation document. The finding that telecommand interfaces are routinely unprotected validates the need for ground-segment enforcement. The command parsing vulnerabilities justify the CCSDS validation layer in SCSP's parser module. This paper should be cited in the opening of any SCSP pitch.

---

### 4.2 Shelby — Cybersecurity Risk Assessment for CubeSat Missions

**Citation**: Shelby, N. (2025). *Cybersecurity Risk Assessment for CubeSat Missions*. Oxford University Cybersecurity Research. arXiv:2604.00303.

**Link**: https://arxiv.org/abs/2604.00303

**Summary**: Introduces a comprehensive 42-entry vulnerability register for CubeSat missions using STRIDE threat modeling, MITRE ATT&CK, and CVSS v3.1 scoring. Proposes the "Security-per-Watt" heuristic for resource-constrained environments and explicitly notes that incident response for CubeSat constellations must be reimagined at the constellation level rather than per-satellite.

**Key Findings**:
- 42 distinct vulnerability categories identified across CubeSat ground and space segments
- AX.25 and base CCSDS profiles provide zero authentication — uplink spoofing is a realistic low-barrier attack
- Security-per-Watt analysis shows ground-segment controls are the most efficient countermeasure
- Incident response must move from per-satellite to constellation-level function
- No general defense against signal injection into satellite systems has been proposed (as of 2025)

**Direct Feature Justification for SCSP**:
The STRIDE + MITRE ATT&CK + CVSS v3.1 framework directly informs SCSP's threat model and risk scoring rubric. The Security-per-Watt finding validates the ground-segment middleware approach. The open gap on signal injection defense is the research gap SCSP directly addresses. The constellation-level incident response finding justifies the roadmap constellation correlation feature.

---

### 4.3 Pavur & Martinovic — SoK: Building a Launchpad for Satellite Cyber-Security Research

**Citation**: Pavur, J., & Martinovic, I. (2020). *SoK: Building a Launchpad for Satellite Cyber-Security Research*. IEEE Security & Privacy Workshop on Security of Space and Satellite Systems (S4).

**Link**: https://ieeexplore.ieee.org/document/9155098

**Summary**: The foundational taxonomy paper for satellite cybersecurity research. Maps attack surfaces across all four segments: ground segment, space segment, communication link, and user segment. Introduces standardized terminology and attack classification used by virtually all subsequent papers in this space.

**Key Findings**:
- Ground segment is the highest-risk attack surface due to IT/OT convergence
- Communication link attacks (spoofing, replay, jamming) are underaddressed
- No unified framework exists for evaluating ground-segment command security
- Replay attacks are classified as a primary threat vector but rarely defended against in practice

**Direct Feature Justification for SCSP**:
The attack surface taxonomy directly informs SCSP's threat model. The replay attack classification justifies Layer 5 (replay detection). The ground segment risk finding validates the middleware positioning. This paper is cited as the baseline taxonomy by all subsequent research and should be cited as foundational context in SCSP documentation.

---

### 4.4 Cyber Attacks on Space Information Networks — Comprehensive Review

**Citation**: (2025). *Cyber Attacks on Space Information Networks: A Comprehensive Review*. MDPI Remote Sensing / Aerospace, 2025.

**Link**: https://www.mdpi.com/aerospace

**Summary**: A 2025 comprehensive review classifying cyber threats to space systems into active and passive categories. Includes real-world case studies on DoS attacks against ground stations, message modification attacks, eavesdropping on telemetry downlinks, and satellite transponder hijacking. Surveys AI-driven intrusion detection approaches and quantum-resistant encryption countermeasures.

**Key Findings**:
- Active attacks (command injection, message modification, replay) are the primary threat to mission integrity
- Passive attacks (eavesdropping) are a secondary concern for most CubeSat missions
- AI-driven anomaly detection is identified as a promising but underdeveloped countermeasure
- Quantum-resistant encryption is a future requirement but not yet practical for constrained platforms
- No existing tool integrates AI anomaly detection with command-level authorization

**Direct Feature Justification for SCSP**:
The active attack classification validates the threat model for Layers 1–5. The identification of AI anomaly detection as underdeveloped directly positions SCSP's AI scoring engine as addressing a known research gap. The absence of integrated AI + authorization tools validates SCSP's combined approach as novel.

---

### 4.5 Salim, Moustafa & Reisslein — Cybersecurity of Satellite Communications Systems

**Citation**: Salim, M., Moustafa, N., & Reisslein, M. (2025). *Cybersecurity of Satellite Communications Systems*. IEEE Communications Surveys & Tutorials, 2025.

**Link**: https://ieeexplore.ieee.org/document/

**Summary**: A comprehensive 2025 survey covering the full cybersecurity stack for satellite communications — space segment, ground segment, and communication link. Covers attack taxonomies, existing defenses, and open research problems. Published in IEEE Communications Surveys & Tutorials, one of the highest-impact venues in communications research.

**Key Findings**:
- Ground segment remains the weakest link in satellite security architecture
- Insider threat is identified as a top-priority unresolved problem
- Command authentication exists but command authorization (semantic validation) does not
- Non-repudiation of commands is a compliance requirement that current tools fail to meet
- The recency of this 2025 publication signals to reviewers that this is an active, unsolved research area

**Direct Feature Justification for SCSP**:
The insider threat finding justifies Layer 6 (behavioral drift detection). The command authorization gap directly justifies SCSP's entire semantic scoring approach. The non-repudiation finding justifies Layer 4 (hash-chained ledger) as a compliance requirement, not just a nice-to-have. The 2025 publication date signals topicality to judges.

---

## §5 — Existing Solutions Analysis

### 5.1 Parsons Ace CtrlPoint

**Type**: Commercial TT&C (Telemetry, Tracking & Command) ground station software  
**Vendor**: Parsons Corporation  
**Link**: https://www.parsons.com/capabilities/space/

**What It Does**:
Ace CtrlPoint is a full-featured ground station command and control platform providing TT&C operations, contact scheduling, telemetry monitoring, anomaly alerting, and RMF (Risk Management Framework) compliance reporting. It is used by US government and military satellite programs.

**Pros**:
- RMF-compliant — meets US DoD security requirements
- Mature, battle-tested platform with real operational history
- Strong telemetry monitoring and alert capabilities
- Role-based access control for operators
- Integration with government security frameworks

**Cons**:
- Anomaly detection is threshold-based, not semantic — it flags "battery below 10%" but cannot reason about whether a specific command is dangerous given the current battery state
- No AI-based command risk scoring
- No multi-party approval workflow per command — a single authenticated operator can execute any command
- No hash-chained audit trail — log files are not tamper-evident
- Commercial and closed-source — inaccessible for research or small satellite operators
- No replay attack detection

**Where SCSP Improves**:
SCSP adds the semantic intelligence layer that CtrlPoint lacks. While CtrlPoint can alert that battery is low, it cannot assess whether a proposed command is dangerous *because* the battery is low and block it accordingly. SCSP's tiered approval chain also adds the multi-party authorization that CtrlPoint's single-operator trust model omits.

---

### 5.2 Lockheed Martin Compass / Astrolabe

**Type**: Commercial mission planning and constellation C2  
**Vendor**: Lockheed Martin Space  
**Link**: https://www.lockheedmartin.com/en-us/products/compass.html

**What It Does**:
Compass (and its successor Astrolabe) is Lockheed Martin's mission planning and satellite constellation management platform. It provides pass scheduling, command sequencing, telemetry archiving, and a REST API for integration with other ground systems. Used in both commercial and government satellite programs.

**Pros**:
- REST API enables programmatic integration — SCSP can integrate via this API
- Constellation-level visibility — manages multiple satellites in a single interface
- Strong mission planning and scheduling capabilities
- Mature operator workflow design

**Cons**:
- Single-operator trust model — no per-command authorization chain
- No semantic risk scoring on commands
- No behavioral anomaly detection on operators
- Telemetry data is available but not fed into command-level security decisions
- No tamper-evident command audit log
- No replay detection

**Where SCSP Improves**:
SCSP can sit in front of Compass as a security proxy. Commands authored in Compass's interface pass through SCSP's risk scoring and authorization chain before reaching the uplink. SCSP adds the entire security intelligence layer that Compass explicitly does not provide.

---

### 5.3 ATLAS Space GSaaS

**Type**: Commercial cloud-based ground station as a service  
**Vendor**: ATLAS Space Operations  
**Link**: https://atlasspace.com/

**What It Does**:
ATLAS provides cloud-hosted ground station infrastructure and pass scheduling as a service. Satellite operators schedule contact windows, and ATLAS handles the RF link, telemetry downlink, and command uplink through their network of ground stations.

**Pros**:
- Cloud-based — accessible to small satellite operators without physical ground station infrastructure
- Global network of ground stations — maximizes contact windows
- Competitive pricing for CubeSat operators
- Simple API for scheduling and command submission

**Cons**:
- No security layer at all — focuses entirely on uptime and connectivity
- No command validation, risk scoring, or authorization workflow
- Commands submitted via API are transmitted as received — no inspection
- No audit trail beyond basic access logs
- Particularly vulnerable to API-level attacks — no semantic inspection of submitted commands
- No telemetry integration into security decisions

**Where SCSP Improves**:
ATLAS represents the worst-case security posture in the existing market. SCSP as a middleware layer between an operator and ATLAS's API would add every security capability ATLAS lacks. The ATLAS integration path (REST API → SCSP → ATLAS API) is one of SCSP's primary integration targets.

---

### 5.4 OpenC3 COSMOS (Open Source)

**Type**: Open-source ground station command and control software  
**Maintainer**: OpenC3, Inc. (formerly Ball Aerospace COSMOS)  
**Link**: https://openc3.com/

**What It Does**:
OpenC3 COSMOS is the leading open-source ground station software platform, widely used in CubeSat research, university satellite programs, and NASA's NOS3 simulation environment. It provides a complete C2 suite including command authoring, telemetry display, scripting, and a plugin architecture for extensibility.

**Pros**:
- Open-source and free — accessible to all operators regardless of budget
- Widely adopted — large community, extensive documentation
- Plugin architecture — SCSP can integrate as a COSMOS plugin
- NOS3 integration — works with NASA's open-source satellite simulation
- Supports CCSDS command formatting natively
- Active development community

**Cons**:
- No authentication on command interfaces by default — operators at the terminal can send any command
- AX.25 / base CCSDS with no authentication is the default communication profile
- No command risk scoring or semantic analysis
- No multi-party approval workflow
- Log files are plain text — not tamper-evident
- Replay attack vectors are well-documented in academic literature (arXiv 2312.01330) and unaddressed in COSMOS
- Security is explicitly listed as outside COSMOS's current scope by maintainers

**Where SCSP Improves**:
COSMOS is SCSP's primary integration target. SCSP can be deployed as a COSMOS plugin or as a proxy that intercepts the COSMOS command API. The COSMOS community represents the primary user base for SCSP — small satellite operators who have the most exposure and the least security infrastructure.

---

### 5.5 CCSDS Space Data Link Security (SDLS)

**Type**: International standard for satellite communication link security  
**Body**: Consultative Committee for Space Data Systems  
**Link**: https://public.ccsds.org/Pubs/355x0b1.pdf

**What It Does**:
CCSDS SDLS is the standardized security extension for CCSDS Space Data Link protocols. It provides authentication and encryption at the communication link layer using AES-256 and HMAC-based authentication codes. It is the only widely-recognized security standard specifically for satellite command links.

**Pros**:
- International standard — widely recognized and accepted by space agencies
- Provides genuine cryptographic protection of the communication channel
- Prevents eavesdropping and man-in-the-middle attacks on the RF link
- Published and freely available specification

**Cons**:
- Addresses transmission security only — does nothing for command-level semantic risk
- Does not address insider threat — an authenticated operator using SDLS can still send any command
- Does not address operator error — a valid but dangerous command passes SDLS inspection
- Adoption is low in CubeSat missions due to power and computational overhead
- No authorization workflow — no concept of requiring multiple approvers
- No audit trail — SDLS secures the channel but does not log decisions in a tamper-evident way
- Does not protect against replay of legitimately-encrypted commands (replay window is optional and rarely configured)

**Where SCSP Improves**:
SCSP is explicitly designed to be complementary to SDLS, not competitive with it. SCSP handles everything above the transport layer — semantic scoring, authorization, logging — while SDLS handles channel security. SCSP + SDLS together provide defense in depth: SDLS secures the channel, SCSP secures the decision.

---

### 5.6 Competitive Gap Summary

| Capability | CtrlPoint | Compass | ATLAS | COSMOS | SDLS | **SCSP** |
|---|---|---|---|---|---|---|
| Semantic AI command risk scoring | ✗ | ✗ | ✗ | ✗ | ✗ | **✓** |
| Telemetry-aware dynamic scoring | ✗ | ✗ | ✗ | ✗ | ✗ | **✓** |
| Tiered multi-party authorization | ✗ | ✗ | ✗ | ✗ | ✗ | **✓** |
| Hash-chained tamper-evident ledger | ✗ | ✗ | ✗ | ✗ | ✗ | **✓** |
| Replay attack detection | ✗ | ✗ | ✗ | ✗ | Partial | **✓** |
| Operator behavioral drift detection | ✗ | ✗ | ✗ | ✗ | ✗ | **✓** |
| Emergency safety override | Partial | ✗ | ✗ | ✗ | ✗ | **✓** |
| COSMOS / C2 middleware integration | ✗ | ✓ | ✓ | N/A | N/A | **✓** |
| Open source / accessible | ✗ | ✗ | ✗ | ✓ | ✓ | **✓** |
| CubeSat / small sat compatible | ✗ | ✗ | ✓ | ✓ | Partial | **✓** |
| NIST IR 8401 non-repudiation | ✗ | ✗ | ✗ | ✗ | ✗ | **✓** |

**The one-sentence summary**: Every existing solution treats command authorization as a binary — authenticated operator equals trusted command. SCSP adds the missing semantic intelligence layer between "authenticated" and "executed" that no existing tool provides.

---

## §6 — Product Vision & Goals

### 6.1 Mission Statement

To make every satellite command a justified, auditable, and contextually-aware decision — transforming ground-station security from a binary gatekeeping function into an intelligent, adaptive, and non-repudiable authorization system.

### 6.2 Primary Goals and Success Metrics

| Goal | Metric | Target |
|---|---|---|
| Semantic risk scoring | All commands receive a 0–100 risk score with justification | 100% command coverage |
| Telemetry context | Risk score incorporates live telemetry state | All 4 telemetry fields (battery, safe-mode, thermal, orbital phase) |
| Authorization enforcement | HIGH-risk commands require dual approval before transmission | Zero HIGH-risk commands transmitted without quorum |
| Audit integrity | Every command traceable in tamper-evident ledger | SHA-256 chain integrity check passes on full history |
| Replay prevention | Duplicate and sequence attacks detected before transmission | Zero replay commands transmitted |
| Demo latency | Gemini scoring completes within 2 seconds | p95 latency under 2s |
| Integration | Platform operates as proxy without modifying existing C2 workflow | Zero changes required to upstream C2 system |

### 6.3 Core Design Principles

**Additive, not disruptive**: SCSP never breaks an existing workflow. It sits in the command path as a transparent proxy. If SCSP is removed, the existing C2 system continues to function normally.

**Ground-side only**: All SCSP logic runs on the ground segment. Zero changes to satellite firmware, on-board software, or communication protocols are required.

**Fail-secure with override**: If SCSP is unavailable, commands are held — not passed through — until SCSP is restored or a safety officer activates the emergency bypass. This is the correct fail-safe default per NIST IR 8401.

**Non-repudiability as a first-class requirement**: Every action in the system — command submission, AI scoring, approval, rejection, override — is logged in the tamper-evident ledger. There is no action that leaves no trace.

**Transparency of AI decisions**: The AI risk score is always accompanied by a human-readable justification. Operators are never blocked by an opaque AI decision they cannot understand or contest.

**Separation of roles**: The operator who submits a command cannot also be the approver for that same command. This is enforced at the token level.

---

## §7 — User Personas & Use Cases

### 7.1 Mission Operator

**Role**: The primary user of the platform. Authors and submits commands to the satellite.

**Background**: Aerospace engineer or systems engineer with domain knowledge of the satellite's subsystems. Familiar with CCSDS command structures. May be operating remotely. Typically works in shifts at a ground station or from a mission control room.

**Goals**:
- Submit commands to the satellite efficiently without disrupting the mission timeline
- Understand why a command has been flagged as high-risk
- Track the status of pending approvals in real time
- Access the command history and audit log for operational reference

**Pain Points (current state)**:
- No feedback on whether a command is dangerous before submission
- No awareness of what the satellite's current state is when authoring a command
- No visibility into whether a co-worker has already sent a conflicting command
- Manual paper-based or email-based approval processes for sensitive operations

**Primary Interactions with SCSP**:
- Log in with operator credentials
- Author a CCSDS command from the command terminal
- View the AI risk score and justification before confirming submission
- See the real-time approval status on pending HIGH/MEDIUM commands
- View the command ledger for their session

---

### 7.2 Safety / Security Officer (Approver)

**Role**: The second-party approver in the multi-party authorization chain. Reviews and approves or rejects HIGH and MEDIUM risk commands.

**Background**: Senior mission controller, safety officer, or designated security personnel. Has authority to override normal operating procedures in emergencies.

**Goals**:
- Review pending high-risk commands quickly with enough context to make a decision
- Approve or reject commands from any device (including mobile)
- Activate emergency bypass for time-critical operations when necessary
- Receive immediate alerts when a HIGH-risk command is submitted

**Pain Points (current state)**:
- No system exists to notify them of high-risk operator actions in real time
- No formal authorization workflow — approval is informal or post-hoc
- Cannot see the satellite's current state alongside the command being reviewed

**Primary Interactions with SCSP**:
- Receive real-time push notification when a command enters PENDING_APPROVAL state
- Review command details, AI justification, and current telemetry context
- Approve or reject with mandatory justification text for HIGH-risk commands
- Activate emergency safety override with time-bounded token
- View behavioral drift alerts on operator sessions

---

### 7.3 Mission Controller (Admin)

**Role**: System administrator for SCSP. Manages operator accounts, configures risk policies, and monitors system health.

**Background**: Senior mission operations personnel or IT security administrator.

**Goals**:
- Configure risk tier thresholds and approval policies
- Manage operator roles and credentials
- Monitor system-wide command activity
- Export audit logs for compliance reporting

**Primary Interactions with SCSP**:
- Manage user accounts and role assignments
- Configure risk scoring thresholds (LOW/MEDIUM/HIGH boundaries)
- View the full mission command ledger with integrity verification
- Export signed audit reports

---

### 7.4 Primary Use Case Flows

#### UC-01: Standard Low-Risk Command

```
1. Operator logs in → selects satellite → opens command terminal
2. Operator selects command type: "Request Telemetry Beacon" (subsystem: TM)
3. Operator submits command
4. SCSP CCSDS Parser validates packet structure → PASS
5. SCSP injects live telemetry context (battery: 78%, safe-mode: OFF, orbital: nominal)
6. Gemini scoring engine evaluates → score: 12 / 100 → tier: LOW
7. Justification: "Telemetry request is read-only, no subsystem state change, nominal satellite state"
8. Command auto-approved → cryptographically signed → logged to ledger
9. CCSDS packet dispatched to uplink → OBC receives → telemetry response returned
10. Operator sees confirmation + ledger entry
```

#### UC-02: High-Risk Command Requiring Dual Approval

```
1. Operator selects command: "Disable Safe Mode" (subsystem: EPS/OBC)
2. Current telemetry: battery: 9%, thermal: elevated, orbital: eclipse
3. Gemini scoring engine evaluates → score: 87 / 100 → tier: HIGH
4. Justification: "Safe mode disable during low battery (9%) and thermal stress in eclipse phase
   poses risk of power failure and permanent loss of attitude control"
5. SPARTA mapping: T0836 — Modify Parameter, CVSS: 8.4
6. Command enters PENDING_DUAL_APPROVAL state
7. Push notification sent to both registered safety officers
8. Safety Officer A reviews command + telemetry + AI justification on their device
9. Safety Officer A approves with justification: "Required for payload test window — engineer confirmed"
10. Safety Officer B approves within 5-minute window
11. Quorum achieved → command cryptographically signed with both approver tokens
12. Logged to ledger with full approval chain → dispatched to uplink
```

#### UC-03: Replay Attack Detected

```
1. Attacker captures legitimate "Attitude Manoeuvre — Yaw +15°" command from earlier in session
2. Attacker replays the same CCSDS packet 8 minutes later
3. SCSP ingress parser extracts nonce from command header
4. Nonce lookup against rolling 100-command window → DUPLICATE DETECTED
5. Command blocked → alert raised → ledger entry created: "REPLAY_BLOCKED"
6. Safety officer notified: "Duplicate command nonce detected — possible replay attack"
7. Operator session flagged for elevated scrutiny
```

#### UC-04: Emergency Safety Override

```
1. Satellite enters unexpected safe mode during critical orbital manoeuvre window
2. Mission controller needs to send "Force Exit Safe Mode" command immediately
3. AI scores command: 91 / 100 → HIGH → awaiting dual approval
4. Mission controller cannot reach second safety officer within contact window
5. Safety officer activates Emergency Bypass: enters reason "Contact window closing — 
   single-operator override authorized under Mission Rule 7.3"
6. Bypass token generated: valid for 10 minutes
7. Command executed under bypass token
8. Bypass activation logged with full justification → system auto-restores normal policy after 10 minutes
9. Audit entry flags this command for mandatory post-event review
```

---

## §8 — Feature Specifications — Innovation & Novelty

### 8.1 Feature Index — All Features with Phase Tags

| ID | Feature | Phase | Innovation Tier | Complexity |
|---|---|---|---|---|
| F-01 | Semantic AI risk scoring engine | `[MVP]` | Primary novelty | Low–Medium |
| F-02 | Telemetry-aware dynamic risk adjustment | `[MVP]` | Primary novelty | Low |
| F-03 | Tiered multi-party authorization chain | `[MVP]` | Primary novelty | Medium |
| F-04 | Hash-chained tamper-evident ledger | `[MVP]` | Primary novelty | Low |
| F-05 | Replay & command sequence anomaly detection | `[MVP]` | Supporting | Low |
| F-06 | Emergency safety officer override | `[MVP]` | Supporting | Low |
| F-07 | CCSDS command parser & validator | `[MVP]` | Foundation | Low |
| F-08 | Mock satellite OBC (simulated) | `[MVP]` | Demo enabler | Low |
| F-09 | Real-time approval notification (WebSocket) | `[MVP]` | UX | Medium |
| F-10 | Operator behavioral baseline & drift detection | `[PHASE_2]` | Extension | Medium |
| F-11 | Constellation-level threat correlation | `[ROADMAP]` | Advanced novelty | High |
| F-12 | Docker containerization | `[PHASE_2]` | DevOps | Low |
| F-13 | Real CCSDS hardware integration | `[PHASE_2]` | Integration | Medium |
| F-14 | Compliance export (NIST IR 8401 reports) | `[PHASE_2]` | Compliance | Low |
| F-15 | Quantum-resistant command signing | `[ROADMAP]` | Future security | High |

---

### 8.2 F-01 — Semantic AI Risk Scoring Engine `[MVP]`

**Novelty Claim**: No existing satellite C2 tool evaluates commands as semantic intents. All existing tools perform syntactic validation (is this a valid CCSDS packet?) but none perform semantic evaluation (should this command execute given what we know about the satellite and this operator?).

**Description**: An LLM-based scoring pipeline that accepts a structured command object, enriches it with live telemetry context and operator session metadata, and returns a structured risk assessment including a 0–100 score, risk tier, human-readable justification, SPARTA threat mapping, and CVSS score estimate.

**LLM**: Gemini 2.5 Flash (chosen for sub-2-second latency on scoring-length prompts)

**Inputs**:
```json
{
  "command": {
    "type": "DISABLE_SAFE_MODE",
    "subsystem": "EPS",
    "parameters": {},
    "apid": "0x18F",
    "sequence_count": 1042
  },
  "telemetry": {
    "battery_percent": 9,
    "safe_mode_active": true,
    "thermal_status": "ELEVATED",
    "orbital_phase": "ECLIPSE",
    "last_contact_min": 12
  },
  "operator": {
    "id": "op_004",
    "role": "OPERATOR",
    "session_duration_min": 47,
    "commands_this_session": 14
  },
  "mission_rules": ["SR-001: Safe mode shall not be disabled below 15% battery",
                    "SR-002: Attitude manoeuvres prohibited during eclipse"]
}
```

**Output Schema**:
```json
{
  "risk_score": 87,
  "risk_tier": "HIGH",
  "justification": "Disabling safe mode at 9% battery during eclipse phase violates SR-001 and creates risk of irreversible power failure. Thermal elevation compounds risk. SPARTA maps to T0836.",
  "sparta_technique": "T0836",
  "cvss_estimate": "8.4",
  "affected_subsystems": ["EPS", "OBC", "ADCS"],
  "recommended_action": "BLOCK_PENDING_DUAL_APPROVAL",
  "confidence": 0.94
}
```

**Prompt Template Structure**:
```
You are a satellite command security analyst. Evaluate the following command for risk.

COMMAND: {command_json}
CURRENT SATELLITE STATE: {telemetry_json}
OPERATOR CONTEXT: {operator_json}
MISSION RULES: {mission_rules}

SCORING RUBRIC:
- 0-30 (LOW): Read-only, no state change, nominal satellite state
- 31-70 (MEDIUM): State change, non-critical subsystem, or minor telemetry concern
- 71-100 (HIGH): Safety-critical state change, mission rule violation, anomalous context, or
  dangerous telemetry state

Respond ONLY with valid JSON matching this schema: {output_schema}
Do not include markdown, preamble, or explanation outside the JSON object.
```

**DEMO_MODE Fallback**:
When `DEMO_MODE=true` env flag is set, the scoring engine returns pre-seeded responses from a local JSON fixture file. Four preset commands are available: LOW (telemetry request), MEDIUM (subsystem parameter update), HIGH (safe mode disable), BLOCKED (replay attempt). This prevents live API failures from breaking the demo.

**Acceptance Criteria**:
- [ ] Every submitted command receives a score within 2 seconds (p95)
- [ ] Output JSON always validates against the output schema
- [ ] Score changes when telemetry inputs change for the same command type
- [ ] Justification text is human-readable and references specific telemetry values
- [ ] DEMO_MODE flag produces consistent, pre-verified outputs

---

### 8.3 F-02 — Telemetry-Aware Dynamic Risk Adjustment `[MVP]`

**Novelty Claim**: Every existing system scores commands in isolation. SCSP is the first system to dynamically adjust command risk based on the satellite's live operational state. The same command issued at 80% battery versus 8% battery receives a materially different risk score. This transforms SCSP from a static policy enforcer into a context-aware intelligence layer.

**Description**: A telemetry state service that maintains a live snapshot of the satellite's operational state and injects it into every AI scoring request. The telemetry state is updated via the mock OBC's response stream during the MVP phase, and via real downlink telemetry in production.

**Telemetry Fields (MVP)**:

| Field | Type | Range | Risk Sensitivity |
|---|---|---|---|
| `battery_percent` | integer | 0–100 | Critical below 15% |
| `safe_mode_active` | boolean | true/false | Any command in safe mode is elevated risk |
| `thermal_status` | enum | NOMINAL / ELEVATED / CRITICAL | Elevated/critical adds +15 to score |
| `orbital_phase` | enum | SUNLIT / ECLIPSE / PENUMBRA | Eclipse amplifies power-related risk |
| `link_margin_db` | float | -10 to +30 | Low margin indicates comms stress |
| `last_contact_min` | integer | 0–∞ | Long gap may indicate anomaly |

**Demo Interaction**: A slider-based telemetry control panel on the dashboard allows the presenter to adjust telemetry values live during the demo. The risk score for a staged command updates in real time as values change, demonstrating the dynamic scoring without requiring a real satellite.

**Acceptance Criteria**:
- [ ] Telemetry state is injected into every scoring prompt
- [ ] Changing battery from 80% to 8% changes the score for a safe-mode command by at least 30 points
- [ ] Dashboard shows all 6 telemetry fields with their current values
- [ ] Telemetry changes trigger a re-score notification for any command in PENDING state

---

### 8.4 F-03 — Tiered Multi-Party Authorization Chain `[MVP]`

**Novelty Claim**: No existing satellite C2 system enforces a per-command multi-party approval workflow tied to a dynamic risk assessment. CtrlPoint has role-based access but no per-command authorization. COSMOS has no authorization layer at all. SCSP's tiered chain makes the AI score consequential — a HIGH score doesn't just flag a command, it actively prevents execution until human judgment is applied.

**Description**: A state machine with three authorization tiers driven by the AI risk score. Approval tokens are time-bounded JWTs signed with the system's private key. The operator who submits a command cannot be an approver for that same command (enforced at token validation).

**Authorization Tiers**:

| Tier | Score Range | Authorization Required | Timeout | Escalation |
|---|---|---|---|---|
| LOW | 0–30 | Auto-approved | — | — |
| MEDIUM | 31–70 | Single approver | 5 minutes | Escalates to HIGH if expired |
| HIGH | 71–100 | Dual approver quorum | 5 minutes | Blocked if expired |

**Command State Machine**:
```
SUBMITTED → PARSING → SCORED →
  [LOW]    → AUTO_APPROVED → SIGNED → LOGGED → DISPATCHED
  [MEDIUM] → PENDING_SINGLE_APPROVAL → [approved] → SIGNED → LOGGED → DISPATCHED
                                     → [rejected] → REJECTED → LOGGED
                                     → [timeout]  → ESCALATED → PENDING_DUAL_APPROVAL
  [HIGH]   → PENDING_DUAL_APPROVAL → [quorum]   → SIGNED → LOGGED → DISPATCHED
                                   → [rejected]  → REJECTED → LOGGED
                                   → [timeout]   → BLOCKED → LOGGED
```

**Approval Token Structure**:
```json
{
  "token_id": "appr_uuid",
  "command_id": "cmd_uuid",
  "approver_id": "so_001",
  "approved_at": "2026-06-10T14:32:00Z",
  "expires_at": "2026-06-10T14:37:00Z",
  "justification": "Approved for scheduled maintenance window",
  "signature": "Ed25519_signature_bytes"
}
```

**Acceptance Criteria**:
- [ ] LOW commands are auto-approved and dispatched without human interaction
- [ ] MEDIUM commands block dispatch until single approval received or timeout
- [ ] HIGH commands block dispatch until two distinct approver tokens received
- [ ] An operator cannot approve their own submitted command (enforced server-side)
- [ ] Expired pending commands are escalated or blocked per tier rules
- [ ] All state transitions are logged to the ledger

---

### 8.5 F-04 — Hash-Chained Tamper-Evident Command Ledger `[MVP]`

**Novelty Claim**: Existing command logs are plain text files or standard database rows. They can be modified, deleted, or backdated without detection. SCSP's hash-chained ledger provides cryptographic non-repudiation: any tampering with any historical entry breaks the chain and is immediately detectable. This directly satisfies NIST IR 8401's non-repudiation requirement, which no existing open tool currently meets.

**Description**: An append-only log where each entry stores a SHA-256 hash of the concatenation of the previous entry's hash, the command payload, the timestamp, and the approver IDs. A separate integrity verification endpoint traverses the entire chain and returns a pass/fail result with the specific entry index of any detected tampering.

**Ledger Entry Structure**:
```json
{
  "entry_id": "led_001",
  "sequence": 1042,
  "prev_hash": "a3f2b1...",
  "entry_hash": "SHA256(prev_hash + command_payload + timestamp + approver_ids)",
  "command_id": "cmd_uuid",
  "command_type": "DISABLE_SAFE_MODE",
  "subsystem": "EPS",
  "risk_score": 87,
  "risk_tier": "HIGH",
  "status": "DISPATCHED",
  "operator_id": "op_004",
  "approver_ids": ["so_001", "so_002"],
  "timestamp": "2026-06-10T14:32:00Z",
  "telemetry_snapshot": { "battery_percent": 9, "safe_mode_active": true }
}
```

**Hash Computation**:
```python
import hashlib, json

def compute_entry_hash(prev_hash: str, payload: dict, timestamp: str, approver_ids: list) -> str:
    content = prev_hash + json.dumps(payload, sort_keys=True) + timestamp + ",".join(sorted(approver_ids))
    return hashlib.sha256(content.encode()).hexdigest()
```

**Integrity Verification**:
```python
def verify_chain(entries: list) -> dict:
    for i, entry in enumerate(entries[1:], 1):
        expected = compute_entry_hash(entries[i-1]["entry_hash"], ...)
        if expected != entry["entry_hash"]:
            return {"valid": False, "corrupted_at": i, "entry_id": entry["entry_id"]}
    return {"valid": True}
```

**Demo Tamper Scenario**: A pre-scripted admin function modifies one field in one ledger entry (e.g., changes `risk_score` from 87 to 12). The integrity checker is then run. It traverses the chain, detects the hash mismatch at the modified entry, and highlights it red in the UI. This 30-second demo moment requires zero extra infrastructure — it is pure local computation with a visible result.

**Acceptance Criteria**:
- [ ] Every command, approval, and rejection creates a ledger entry
- [ ] Chain integrity check passes on an unmodified ledger
- [ ] Chain integrity check fails and identifies the exact entry when any field is modified
- [ ] Ledger is append-only — no delete or update operations permitted on past entries
- [ ] Integrity check result is displayed in the UI with per-entry pass/fail status

---

### 8.6 F-05 — Replay & Command Sequence Anomaly Detection `[MVP]`

**Description**: Two complementary detection mechanisms that prevent replay attacks and flag dangerous command sequences before they are scored and transmitted.

**Replay Detection**:
Every command ingested by SCSP is assigned a nonce (UUID v4) on the client side and a server-side ingestion timestamp. A rolling window of the last 100 command nonces is maintained in memory. Any command whose nonce matches an existing entry in the window is flagged as a replay attempt, blocked before scoring, and logged as a security event.

```python
# Nonce deduplication
NONCE_WINDOW = {}  # nonce -> timestamp, max 100 entries

def check_replay(nonce: str) -> bool:
    if nonce in NONCE_WINDOW:
        return True  # Replay detected
    NONCE_WINDOW[nonce] = datetime.utcnow()
    if len(NONCE_WINDOW) > 100:
        # Evict oldest entry
        oldest = min(NONCE_WINDOW, key=NONCE_WINDOW.get)
        del NONCE_WINDOW[oldest]
    return False
```

**Sequence Anomaly Detection**:
A rule table of dangerous command sequences is maintained. If a command is submitted that matches the second element of a dangerous sequence within a configurable time window (default 60 seconds), an alert is raised and the command's risk score is elevated by +20 before proceeding through the authorization chain.

**Default Rule Table (MVP)**:

| Rule ID | Sequence | Window | Risk Elevation |
|---|---|---|---|
| SEQ-001 | DISABLE_SAFE_MODE → ATTITUDE_MANOEUVRE | 60s | +20 |
| SEQ-002 | DISABLE_SAFE_MODE → THRUSTER_FIRE | 60s | +25 |
| SEQ-003 | DISABLE_ENCRYPTION → ANY_COMMAND | 120s | +30 |
| SEQ-004 | RESET_OBC → DISABLE_WATCHDOG | 30s | +35 |
| SEQ-005 | PARAM_UPDATE(auth_key) → ANY_COMMAND | 300s | +40 |

**Acceptance Criteria**:
- [ ] Replayed commands (same nonce) are blocked before scoring
- [ ] Replay block is logged as a security event with attacker context
- [ ] SEQ-001 through SEQ-005 are enforced with correct time windows
- [ ] Sequence alerts are displayed on the operator dashboard in real time
- [ ] Risk elevation from sequence rules is reflected in the final AI score

---

### 8.7 F-06 — Emergency Safety Officer Override `[MVP]`

**Description**: A time-bounded emergency bypass mechanism that allows a safety officer to execute HIGH-risk commands without waiting for dual approval when time-critical mission requirements demand it. All overrides are logged with mandatory justification and automatically expire after a configurable window (default 10 minutes), after which normal policy is restored.

**Override Flow**:
```
Safety officer activates override → enters mandatory justification text →
system generates time-bounded bypass token (JWT, 10-min expiry) →
commands submitted during bypass window are auto-approved →
all bypass commands flagged in ledger as EMERGENCY_OVERRIDE →
bypass automatically expires → normal policy restored →
post-event review item created in ledger
```

**This feature exists because**: Any judge with operational experience will ask "what if your system blocks a legitimate emergency command?" Without a graceful override, SCSP appears dangerous rather than safe. The override demonstrates that the system has been designed with operational reality in mind, not just the happy path.

**Acceptance Criteria**:
- [ ] Override activation requires safety officer role (not operator)
- [ ] Justification text is mandatory and stored in the ledger
- [ ] Bypass token expires after 10 minutes and is not renewable without re-activation
- [ ] All commands dispatched under bypass are flagged `EMERGENCY_OVERRIDE` in ledger
- [ ] Override activation and deactivation are logged as security events

---

### 8.8 F-07 — CCSDS Command Parser & Validator `[MVP]`

**Description**: A ground-side CCSDS telecommand packet parser that validates the structural integrity of every command before it enters the scoring pipeline. Acts as the first gate in the security pipeline.

**Validation Checks**:
- Packet version number (expected: 0b001)
- Application Process Identifier (APID) against known subsystem registry
- Packet sequence count for out-of-order detection
- Packet data length field versus actual payload length
- Command function code against allowed function code table for the target APID
- Checksum / CRC validation (CRC-16-CCITT)

**Acceptance Criteria**:
- [ ] Invalid CCSDS packets are rejected before reaching the scoring engine
- [ ] Unknown APIDs are rejected with a clear error message
- [ ] Parser output is a normalized command object matching the scoring engine input schema

---

### 8.9 F-08 — Mock Satellite OBC `[MVP]`

**Description**: A lightweight Python UDP server simulating a satellite on-board computer. Accepts CCSDS-structured command packets dispatched by SCSP after full authorization, executes the command against an in-memory satellite state model, and returns simulated telemetry responses.

**Satellite State Model**:
```python
satellite_state = {
    "battery_percent": 78.0,
    "safe_mode_active": False,
    "thermal_status": "NOMINAL",
    "orbital_phase": "SUNLIT",
    "attitude": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0},
    "subsystem_status": {
        "EPS": "NOMINAL", "ADCS": "NOMINAL",
        "TM": "NOMINAL", "OBC": "NOMINAL"
    }
}
```

**Command Handlers (MVP)**:
- `REQUEST_TELEMETRY` → returns current satellite_state as JSON
- `DISABLE_SAFE_MODE` → sets `safe_mode_active: false`
- `ENABLE_SAFE_MODE` → sets `safe_mode_active: true`
- `ATTITUDE_MANOEUVRE` → updates attitude values
- `SUBSYSTEM_RESET` → resets named subsystem status to NOMINAL
- `UPDATE_PARAMETER` → updates a configurable parameter value

**Acceptance Criteria**:
- [ ] OBC receives CCSDS packets dispatched by SCSP via UDP
- [ ] Each command type updates the in-memory satellite state correctly
- [ ] Telemetry response is returned within 500ms of command receipt
- [ ] SCSP dashboard updates to reflect new telemetry state after command execution

---

### 8.10 F-10 — Operator Behavioral Baseline & Drift Detection `[PHASE_2]`

**Description**: Each operator builds a behavioral profile from their command history: typical subsystems accessed, command frequency distribution, working hour window, and session duration. A Z-score anomaly detector flags sessions where behavior deviates significantly from the operator's baseline. Flags elevate the scrutiny tier for that session — they do not automatically block commands.

**Baseline Metrics Per Operator**:
- Mean and standard deviation of commands per session
- Distribution of subsystems accessed (histogram)
- Typical session start time (± 2 hour window)
- Mean session duration
- Distribution of risk tiers submitted

**Drift Detection Trigger**: Z-score > 2.5 on any metric triggers a behavioral alert. The session is flagged and a notification is sent to the safety officer.

**Phase 2 Rationale**: This feature requires a pre-seeded operator history dataset to be meaningful in a demo. Without at least 20 sessions per operator, the baseline is too sparse to produce a convincing demo. This makes it unsuitable for a day-1 build but well-suited for Phase 2 when synthetic data generation is complete.

---

### 8.11 F-11 — Constellation-Level Threat Correlation `[ROADMAP]`

**Description**: A shared risk event bus across all satellites in a constellation. When any satellite's command stream triggers a HIGH-risk event or a security alert, an event is published to the shared bus. All other satellites in the constellation receive an elevated-alert signal and their minimum approval tier is raised from LOW to MEDIUM for a configurable window (default 30 minutes).

**Research Justification**: Shelby (2025) explicitly identifies constellation-level incident response as an open research problem: "incident response must be reimagined as a constellation-level function rather than ground-centric." This feature is the direct implementation of that recommendation. No existing tool implements cross-satellite risk correlation.

**Roadmap Rationale**: Requires multi-instance simulation infrastructure, a pub/sub event bus (Redis or similar), and a multi-satellite dashboard. This is a standalone engineering effort estimated at 12–16 hours beyond the MVP scope. It should be presented as a fully-specified roadmap item with architecture diagram during the hackathon demo.

---

### 8.12 F-Command Simulation — Sample Flow with Output Comparison

This section provides a concrete simulation of a single HIGH-risk command flowing through SCSP versus what would happen in an existing system (OpenC3 COSMOS without SCSP).

**Scenario**: Operator submits `DISABLE_SAFE_MODE` during low-battery eclipse pass.

**Telemetry State at Time of Command**:
```
Battery: 9%  |  Safe Mode: ON  |  Thermal: ELEVATED  |  Orbital: ECLIPSE
```

---

#### Without SCSP (OpenC3 COSMOS default behavior):

```
Step 1: Operator types command in COSMOS terminal
Step 2: COSMOS validates CCSDS packet structure → VALID
Step 3: Command transmitted immediately via UHF uplink
Step 4: Satellite OBC receives DISABLE_SAFE_MODE
Step 5: OBC disables safe mode at 9% battery in eclipse
Step 6: Battery drops below minimum threshold → power failure
Step 7: Satellite enters uncontrolled tumble
Step 8: Mission loss
```

**What COSMOS logged**: `[14:32:01] DISABLE_SAFE_MODE sent — OK`

**Security events detected**: None  
**Approvals required**: None  
**Recovery possible**: No

---

#### With SCSP (full pipeline):

```
Step 1:  Operator submits DISABLE_SAFE_MODE via SCSP operator terminal
Step 2:  CCSDS parser validates packet → VALID
Step 3:  Telemetry injected: battery 9%, safe_mode ON, thermal ELEVATED, orbital ECLIPSE
Step 4:  Gemini scoring engine evaluates command + context

         → SCORE: 87 / 100
         → TIER: HIGH
         → JUSTIFICATION: "Disabling safe mode at 9% battery during eclipse violates
           SR-001. Thermal elevation compounds power risk. Loss of attitude control is
           probable. SPARTA: T0836. CVSS: 8.4"

Step 5:  Command state: PENDING_DUAL_APPROVAL
Step 6:  Push notification sent to Safety Officers A and B
Step 7:  Safety Officer A reviews: sees command + telemetry + AI justification
Step 8:  Safety Officer A REJECTS: "Battery too low — reschedule for next pass"
Step 9:  Command state: REJECTED
Step 10: Ledger entry created:
         {
           "command": "DISABLE_SAFE_MODE",
           "risk_score": 87,
           "status": "REJECTED",
           "rejection_reason": "Battery too low — reschedule for next pass",
           "prev_hash": "a3f2b1...",
           "entry_hash": "SHA256(...)
         }
Step 11: Operator dashboard shows: "Command rejected — see safety officer note"
Step 12: Satellite remains in safe mode — mission preserved
```

**What SCSP logged**: Full tamper-evident entry with AI justification, telemetry snapshot, approver decision, and cryptographic chain link.

**Security events detected**: HIGH-risk command intercepted, pending approval notification sent  
**Approvals required**: 2 (quorum not reached — rejected at 1)  
**Mission outcome**: Preserved

---

**The difference in one sentence**: COSMOS asked "is this a valid packet?" and got "yes." SCSP asked "should this command execute right now?" and got "no, and here's why, and here's who decided, and here's the cryptographic proof that this record has not been altered."

---

## §9 — Existing System Integration

### 9.1 Middleware-as-Proxy Integration Model

SCSP's defining architectural decision is that it is a security proxy, not a replacement for existing C2 systems. Operators continue to use their existing ground station software. SCSP intercepts the command flow between the C2 system and the uplink, applies the security pipeline, and forwards approved commands in the original protocol format.

```
[Existing C2 System] → [SCSP Security Middleware] → [RF Uplink] → [Satellite]
                              ↑
                    No changes required to
                    existing C2 system or
                    satellite software
```

This design means:
- Zero changes required to the satellite's firmware or onboard software
- Zero changes required to the existing C2 system's configuration
- SCSP can be deployed, tested, and removed without affecting normal operations
- If SCSP goes offline, commands are held (fail-secure) until it is restored

### 9.2 OpenC3 COSMOS Integration

**Integration Method**: SCSP deploys as a COSMOS plugin that intercepts the command routing path.

**Integration Steps**:
1. SCSP provides a COSMOS plugin gem that registers a command router middleware
2. The plugin intercepts commands at the `cmd()` API call before COSMOS dispatches them
3. The plugin sends the command to SCSP's REST endpoint (`POST /api/v1/commands`)
4. SCSP scores, routes through authorization, and returns an approval token
5. On approval, the plugin releases the command to COSMOS's normal dispatch path
6. On rejection or block, the plugin surfaces the SCSP result in the COSMOS operator interface

**COSMOS API Integration Point**:
```ruby
# COSMOS plugin hook (pseudo-code)
class ScspCommandRouter
  def route(command)
    result = ScspClient.submit(command.to_ccsds_packet)
    if result.approved?
      super(command)  # Pass to normal COSMOS dispatch
    else
      raise ScspCommandBlocked, result.justification
    end
  end
end
```

**COSMOS Reference**: https://openc3.com/docs/v5/plugins

### 9.3 Generic CCSDS C2 Integration via REST Adapter

For ground station software that does not have a plugin architecture (ATLAS GSaaS, legacy systems), SCSP provides a REST adapter that acts as a transparent proxy:

- Operator's C2 system sends commands to `SCSP_HOST:8001/proxy/command` instead of the normal uplink endpoint
- SCSP processes the command through the full security pipeline
- If approved, SCSP forwards the original CCSDS packet to the configured upstream uplink endpoint
- The C2 system receives the same response it would from the uplink directly

**Configuration** (environment variables):
```bash
SCSP_UPSTREAM_ENDPOINT=https://uplink.groundstation.com/command
SCSP_PROXY_PORT=8001
SCSP_FORWARD_ON_APPROVE=true
SCSP_HOLD_ON_UNAVAILABLE=true
```

### 9.4 Ground Station RF / Uplink Passthrough

SCSP does not modify the CCSDS packet contents. After authorization, it forwards the original packet bytes verbatim to the configured uplink endpoint. This ensures:
- No modification to packet structure, timing, or encoding
- Full compatibility with any CCSDS-compliant uplink system (UHF, S-band, X-band)
- SDLS encryption, if configured in the original packet, is preserved intact

**SCSP adds only a wrapper authentication header at the HTTP/REST level** for the uplink API call — the CCSDS payload itself is untouched.

### 9.5 Integration Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        GROUND SEGMENT                           │
│                                                                 │
│  ┌──────────────┐     REST/Plugin    ┌─────────────────────┐   │
│  │  C2 System   │ ─────────────────→ │   SCSP Middleware   │   │
│  │ (COSMOS/     │                    │  ┌───────────────┐   │   │
│  │  Compass/    │ ←───────────────── │  │ CCSDS Parser  │   │   │
│  │  Custom)     │   Result + Token   │  │ AI Scorer     │   │   │
│  └──────────────┘                    │  │ Auth Chain    │   │   │
│                                      │  │ Hash Ledger   │   │   │
│  ┌──────────────┐                    │  │ Replay Det.   │   │   │
│  │  Approver    │ ←── WebSocket ───  │  └───────────────┘   │   │
│  │  Terminal    │ ──── Approval ──→  │                       │   │
│  └──────────────┘                    └──────────┬────────────┘   │
│                                                 │ Approved        │
│                                                 ↓ CCSDS packet   │
│                                      ┌─────────────────────┐     │
│                                      │   RF Uplink          │     │
│                                      │ (UHF/S-band/X-band) │     │
│                                      └──────────┬───────────┘     │
└─────────────────────────────────────────────────┼─────────────────┘
                                                  │
                                      ┌───────────▼───────────┐
                                      │    SPACE SEGMENT      │
                                      │  ┌─────────────────┐  │
                                      │  │   Satellite OBC  │  │
                                      │  │ (ADCS/EPS/TM)   │  │
                                      │  └────────┬────────┘  │
                                      │           │ Telemetry  │
                                      └───────────┼────────────┘
                                                  │
                                      ┌───────────▼───────────┐
                                      │   TM Downlink         │
                                      │ (feeds SCSP telemetry │
                                      │  state in production) │
                                      └───────────────────────┘
```

---

## §10 — System Architecture Overview

### 10.1 Ground Segment Components

**Operator Terminal (Next.js frontend)**
- Command authoring interface with subsystem selector and parameter form
- Real-time risk score display with AI justification
- Live telemetry dashboard with slider controls (MVP) / live feed (production)
- Command history and ledger viewer
- Pending approval queue with status indicators

**C2 Software Interface**
- Plugin or REST proxy adapter connecting existing C2 software to SCSP
- OpenC3 COSMOS plugin (primary integration target)
- Generic REST proxy for other C2 systems

**Safety Officer Terminal (Next.js frontend, separate route)**
- Pending approval queue with full command context
- One-click approve/reject with mandatory justification for HIGH-risk
- Emergency override activation panel
- Behavioral drift alert feed
- Real-time notification via WebSocket

**Admin Dashboard (Next.js frontend, admin route)**
- User and role management
- Risk threshold configuration
- Full mission ledger with integrity verification button
- Session monitoring

### 10.2 Security Middleware Layer (The Innovation Layer)

This is the core of SCSP. All components run as a FastAPI application.

| Component | Function | Innovation |
|---|---|---|
| CCSDS Parser | Validates packet structure and extracts command metadata | Foundation |
| Telemetry State Service | Maintains live snapshot of satellite state | Enabler for F-02 |
| AI Risk Engine | Gemini 2.5 Flash scoring with telemetry context | Primary novelty |
| Authorization State Machine | Tiered approval routing based on risk score | Primary novelty |
| WebSocket Notification Service | Real-time push to approver terminals | UX enabler |
| Hash-Chain Ledger Service | Append-only cryptographic command log | Primary novelty |
| Replay Detection Service | Nonce dedup + sequence rule matching | Supporting novelty |
| Behavioral Drift Detector | Per-operator Z-score anomaly detection | Phase 2 |
| JWT Auth Service | Role-based token issuance and validation | Foundation |

### 10.3 Space Segment — Mock OBC

A Python UDP server simulating satellite on-board computer behavior. Accepts authorized CCSDS packets from SCSP, updates an in-memory satellite state model, and returns telemetry JSON. See F-08 for full specification.

### 10.4 End-to-End Command Flow

```
Operator Input
     ↓
CCSDS Parser + Validator
     ↓ [invalid → REJECTED, logged]
Telemetry Context Injection
     ↓
Replay Detection Check
     ↓ [replay → BLOCKED, logged]
Gemini AI Risk Scoring
     ↓
Risk Tier Determination
     ↓
Authorization State Machine
  LOW → Auto-Approve
  MEDIUM → Single Approver (5 min)
  HIGH → Dual Approver Quorum (5 min)
     ↓ [rejected → REJECTED, logged]
Cryptographic Signing (Ed25519)
     ↓
Hash-Chain Ledger Entry Created
     ↓
CCSDS Uplink Dispatch
     ↓
Satellite OBC Execution
     ↓
Telemetry Response
     ↓
SCSP Telemetry State Update
```

---

## §11 — Tech Stack & Implementation Decisions

### 11.1 Frontend — Next.js 14 App Router + Tailwind CSS

**Choice**: Next.js 14 with App Router over plain React

**Rationale**:
- App Router provides route-level authentication middleware — operator, approver, and admin routes are protected at the routing layer without custom auth wrappers on every page
- Server-side rendering for the dashboard provides faster initial load during demo
- Built-in API routes reduce the number of FastAPI endpoints needed for simple data fetching
- Tailwind CSS enables fast, consistent UI development without a component library dependency
- The team's full-stack proficiency means Next.js adds no learning curve

**Key Routes**:
```
/login                    — shared login page
/operator/dashboard       — command terminal + telemetry + pending queue
/operator/ledger          — command history and integrity viewer
/approver/queue           — pending approvals with full context
/approver/override        — emergency bypass activation
/admin/users              — user management
/admin/policy             — risk threshold configuration
/admin/ledger             — full mission ledger
```

### 11.2 Backend — Python FastAPI

**Choice**: Python FastAPI over Go

**Rationale**:
- Gemini SDK (`google-generativeai`) is Python-native — no HTTP wrapping needed
- `hashlib` (SHA-256), `PyJWT`, `bcrypt`, `asyncpg` are all first-class Python libraries
- FastAPI's native `WebSocket` support eliminates the need for a separate WebSocket server
- Async-first design handles concurrent operator + approver connections without threading complexity
- Go would provide better raw throughput but SCSP's bottleneck is Gemini API latency (200–800ms), not Python runtime performance — Go's advantage is irrelevant for this workload
- Go is the correct choice for a production hardened deployment (Phase 3)

**Key API Endpoints**:
```
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/commands              — submit command
GET    /api/v1/commands/{id}         — get command status
GET    /api/v1/commands/pending      — list pending approvals
POST   /api/v1/commands/{id}/approve — submit approval token
POST   /api/v1/commands/{id}/reject  — reject command
GET    /api/v1/telemetry/current     — get current satellite state
PUT    /api/v1/telemetry/update      — update telemetry (mock OBC feed)
GET    /api/v1/ledger                — get ledger entries
GET    /api/v1/ledger/verify         — run integrity check
POST   /api/v1/override/activate     — activate emergency bypass
WS     /ws/approvals                 — WebSocket channel for real-time notifications
```

### 11.3 Database — PostgreSQL (No S3 for MVP)

**Choice**: PostgreSQL only. S3 excluded from MVP.

**S3 Exclusion Rationale**: S3 would be appropriate for storing binary command payload archives, large telemetry exports, or compliance report PDFs. All MVP data — command records, ledger entries, operator profiles, approval tokens — is structured and small (sub-MB total for demo). Adding S3 introduces a second AWS service to configure, secure, and keep available during the demo without any demo-visible benefit.

**PostgreSQL chosen over SQLite because**:
- Concurrent write access from operator + approver + WebSocket service simultaneously requires proper transaction isolation
- JSONB column type natively stores telemetry snapshots and AI justification without serialization overhead
- `asyncpg` driver provides native async support for FastAPI without connection pool management

### 11.4 AI Layer — Gemini 2.5 Flash

**Choice**: Gemini 2.5 Flash over Gemini 1.5 Pro

**Rationale**:
- Flash provides p95 latency of 800ms–1.5s for scoring-length prompts vs 2–4s for Pro
- Demo latency is visible — a 3-second pause between "submit" and "score displayed" feels broken
- Flash's JSON output mode (`response_mime_type="application/json"`) produces consistent, parseable output without markdown fences
- Flash's cost is ~10x lower than Pro — relevant for rapid iteration during the 4-day build
- Pro-level reasoning is not required for the scoring task — a well-designed few-shot prompt achieves equivalent quality at Flash speed

**DEMO_MODE**: When `DEMO_MODE=true`, the Gemini API call is bypassed entirely and pre-seeded JSON responses are returned from a local fixture file. This eliminates live API dependency during the demo.

### 11.5 Auth — JWT + bcrypt + RBAC

**JWT Configuration**:
```python
ACCESS_TOKEN_EXPIRE_MINUTES = 60
ALGORITHM = "HS256"
APPROVAL_TOKEN_EXPIRE_MINUTES = 5  # Approval tokens are short-lived
OVERRIDE_TOKEN_EXPIRE_MINUTES = 10  # Emergency bypass tokens
```

**Roles**:
```python
class Role(Enum):
    OPERATOR = "operator"          # Submit commands, view own ledger
    APPROVER = "approver"          # Approve/reject commands, activate override
    ADMIN = "admin"                # Full access, user management, policy config
```

**Role Enforcement Rule**: An operator's JWT role is checked server-side on every approval endpoint. A user with `OPERATOR` role cannot access `/api/v1/commands/{id}/approve`. A user cannot approve a command they submitted (enforced by comparing `submitter_id` to the token's `sub` claim).

### 11.6 Real-Time — WebSockets + Polling Fallback

**WebSocket**: FastAPI native WebSocket at `/ws/approvals`. On command entering PENDING state, the server pushes a notification to all connected approver clients.

**Polling Fallback**: A `GET /api/v1/commands/pending` endpoint is polled every 3 seconds by the approver frontend if WebSocket connection is not established or drops. This is implemented as a 3-line addition to the frontend WebSocket hook:

```javascript
useEffect(() => {
  const ws = new WebSocket('/ws/approvals');
  ws.onerror = () => setPollingMode(true);
  // If pollingMode, useInterval(() => fetchPending(), 3000)
}, []);
```

**Demo Reliability**: The polling fallback means the demo never has visible dead time from a WebSocket failure. The approver panel continues to update — slightly slower — without any visible error.

### 11.7 Mock OBC — Python UDP

```python
import socket, json
from datetime import datetime

UDP_HOST = '127.0.0.1'
UDP_PORT = 9000

state = {
    "battery_percent": 78.0,
    "safe_mode_active": False,
    "thermal_status": "NOMINAL",
    "orbital_phase": "SUNLIT"
}

def handle_command(data: bytes) -> dict:
    cmd = json.loads(data.decode())
    if cmd["type"] == "DISABLE_SAFE_MODE":
        state["safe_mode_active"] = False
    elif cmd["type"] == "REQUEST_TELEMETRY":
        pass  # Return state as-is
    # ... other handlers
    state["battery_percent"] = max(0, state["battery_percent"] - 0.1)
    return {"status": "ACK", "telemetry": state, "timestamp": datetime.utcnow().isoformat()}

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind((UDP_HOST, UDP_PORT))
while True:
    data, addr = sock.recvfrom(4096)
    response = handle_command(data)
    sock.sendto(json.dumps(response).encode(), addr)
```

### 11.8 Demo Environment — Local + ngrok

**Setup**:
```bash
# Terminal 1: PostgreSQL (local install or Docker for dev)
pg_ctl start

# Terminal 2: FastAPI backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 3: Next.js frontend
npm run dev  # port 3000

# Terminal 4: Mock OBC
python obc_simulator.py  # port 9000

# Terminal 5: ngrok tunnel
ngrok http 3000
# → Provides public HTTPS URL for judge's device as approver
```

**ngrok Demo Value**: The ngrok URL is displayed as a QR code on screen. A judge scans it with their phone, logs in as the safety officer, and approves a HIGH-risk command from their device. This demonstrates genuine multi-party authorization without any cloud infrastructure — and is a compelling demo moment.

---

## §12 — Data Models & Database Schema

```sql
-- Operators and roles
CREATE TABLE operators (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(64) UNIQUE NOT NULL,
    password_hash   VARCHAR(256) NOT NULL,
    role            VARCHAR(32) NOT NULL CHECK (role IN ('operator', 'approver', 'admin')),
    full_name       VARCHAR(128),
    baseline_profile JSONB DEFAULT '{}',   -- behavioral baseline (Phase 2)
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    last_login      TIMESTAMPTZ
);

-- Commands (core table)
CREATE TABLE commands (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nonce               VARCHAR(64) UNIQUE NOT NULL,  -- replay detection
    ccsds_apid          VARCHAR(16) NOT NULL,
    command_type        VARCHAR(64) NOT NULL,
    subsystem           VARCHAR(32) NOT NULL,
    parameters          JSONB DEFAULT '{}',
    sequence_count      INTEGER NOT NULL,
    raw_packet_hex      TEXT,
    risk_score          INTEGER CHECK (risk_score BETWEEN 0 AND 100),
    risk_tier           VARCHAR(16) CHECK (risk_tier IN ('LOW','MEDIUM','HIGH')),
    ai_justification    TEXT,
    sparta_technique    VARCHAR(32),
    cvss_estimate       VARCHAR(8),
    affected_subsystems TEXT[],
    telemetry_snapshot  JSONB,            -- telemetry at time of scoring
    status              VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED'
                        CHECK (status IN ('SUBMITTED','PARSING','SCORED','PENDING_SINGLE_APPROVAL',
                               'PENDING_DUAL_APPROVAL','AUTO_APPROVED','REJECTED','BLOCKED',
                               'DISPATCHED','REPLAY_BLOCKED','EMERGENCY_OVERRIDE')),
    submitter_id        UUID REFERENCES operators(id),
    submitted_at        TIMESTAMPTZ DEFAULT NOW(),
    dispatched_at       TIMESTAMPTZ,
    demo_mode           BOOLEAN DEFAULT FALSE
);

-- Approvals
CREATE TABLE approvals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    command_id      UUID REFERENCES commands(id) ON DELETE CASCADE,
    approver_id     UUID REFERENCES operators(id),
    decision        VARCHAR(16) NOT NULL CHECK (decision IN ('APPROVED','REJECTED')),
    justification   TEXT,
    token_hash      VARCHAR(256),         -- hash of the JWT approval token
    decided_at      TIMESTAMPTZ DEFAULT NOW(),
    token_expires   TIMESTAMPTZ,
    is_override     BOOLEAN DEFAULT FALSE
);

-- Hash-chained tamper-evident ledger
CREATE TABLE ledger (
    entry_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence        BIGSERIAL UNIQUE NOT NULL,
    prev_hash       VARCHAR(256) NOT NULL,
    entry_hash      VARCHAR(256) NOT NULL,
    command_id      UUID REFERENCES commands(id),
    event_type      VARCHAR(64) NOT NULL,  -- COMMAND_DISPATCHED, COMMAND_REJECTED, etc.
    event_detail    JSONB,
    operator_id     UUID REFERENCES operators(id),
    approver_ids    UUID[],
    timestamp       TIMESTAMPTZ DEFAULT NOW()
);

-- Telemetry state (latest snapshot + history)
CREATE TABLE telemetry_states (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    satellite_id    VARCHAR(32) DEFAULT 'SAT_ALPHA',
    battery_percent FLOAT NOT NULL,
    safe_mode_active BOOLEAN NOT NULL,
    thermal_status  VARCHAR(32) NOT NULL,
    orbital_phase   VARCHAR(32) NOT NULL,
    link_margin_db  FLOAT,
    last_contact_min INTEGER,
    recorded_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_commands_status ON commands(status);
CREATE INDEX idx_commands_submitter ON commands(submitter_id);
CREATE INDEX idx_commands_nonce ON commands(nonce);
CREATE INDEX idx_ledger_sequence ON ledger(sequence);
CREATE INDEX idx_approvals_command ON approvals(command_id);
```

---

## §13 — Synthetic Data Description

All data used in the MVP demo is synthetically generated. This section specifies the exact datasets required, their structure, volume, and generation logic.

### 13.1 Operator Profiles and Command History Baseline

**Purpose**: Populate the `operators` table with realistic profiles and pre-seed a command history for behavioral drift detection (Phase 2) and demo authenticity.

**Required Operators**:

| Username | Role | Specialty | Typical Session |
|---|---|---|---|
| `op_chen` | operator | EPS / Power systems | 08:00–16:00, 15–25 commands/session |
| `op_martinez` | operator | ADCS / Attitude control | 16:00–00:00, 20–35 commands/session |
| `op_patel` | operator | TM / Payload | 00:00–08:00, 10–18 commands/session |
| `so_kim` | approver | Safety officer A | On-call, approves 2–5 per shift |
| `so_okonkwo` | approver | Safety officer B | On-call, approves 1–3 per shift |
| `admin_root` | admin | System admin | Irregular, configuration only |

**Command History Volume**: 50 past commands per operator (300 total) across the past 30 days. Generated with realistic timestamp distributions matching each operator's typical session window.

**Seeding Script**: `scripts/seed_operators.py` — generates operators, hashes passwords with bcrypt, generates command history with realistic command type distributions, and inserts into PostgreSQL.

### 13.2 CCSDS Command Dataset

**Purpose**: Provide a library of realistic CCSDS-structured commands for demo use, testing, and scoring engine calibration.

**Required Command Types** (minimum 15):

| Command Type | Subsystem | APID | Default Risk | Notes |
|---|---|---|---|---|
| `REQUEST_TELEMETRY` | TM | 0x100 | LOW | Read-only, always safe |
| `SET_BEACON_RATE` | TM | 0x101 | LOW | Parameter update, low impact |
| `ENABLE_SAFE_MODE` | EPS/OBC | 0x18F | LOW | Protective action |
| `REQUEST_STATUS` | OBC | 0x102 | LOW | Read-only |
| `UPDATE_PARAMETER` | OBC | 0x200 | MEDIUM | State change, non-critical |
| `RESET_SUBSYSTEM` | OBC | 0x201 | MEDIUM | Service disruption possible |
| `SCHEDULE_MANOEUVRE` | ADCS | 0x300 | MEDIUM | Orbital change, planned |
| `ATTITUDE_MANOEUVRE` | ADCS | 0x301 | MEDIUM/HIGH | Context-dependent |
| `PAYLOAD_ACTIVATE` | PAYLOAD | 0x400 | MEDIUM | Power draw |
| `DISABLE_SAFE_MODE` | EPS/OBC | 0x18E | HIGH | Safety-critical |
| `THRUSTER_FIRE` | ADCS | 0x302 | HIGH | Irreversible orbital change |
| `UPDATE_AUTH_KEY` | OBC | 0x202 | HIGH | Security-critical |
| `RESET_OBC` | OBC | 0x203 | HIGH | Service loss risk |
| `DISABLE_WATCHDOG` | OBC | 0x204 | HIGH | Safety mechanism removal |
| `FORCE_REBOOT` | OBC | 0x205 | HIGH | Mission disruption |

**Dataset Format**: Each command stored as a JSON fixture with `command_type`, `apid`, `parameters`, `base_risk_description`, and a set of 3 telemetry contexts that produce LOW, MEDIUM, and HIGH scores respectively.

### 13.3 Telemetry State Snapshots

**Purpose**: Pre-defined telemetry states that produce predictable, demonstrable risk score differences when combined with the command dataset.

**Required Snapshots**:

```json
{
  "nominal": {
    "battery_percent": 78, "safe_mode_active": false,
    "thermal_status": "NOMINAL", "orbital_phase": "SUNLIT",
    "link_margin_db": 12.5, "last_contact_min": 4
  },
  "low_power_eclipse": {
    "battery_percent": 9, "safe_mode_active": true,
    "thermal_status": "ELEVATED", "orbital_phase": "ECLIPSE",
    "link_margin_db": 3.2, "last_contact_min": 18
  },
  "stress_state": {
    "battery_percent": 22, "safe_mode_active": false,
    "thermal_status": "CRITICAL", "orbital_phase": "PENUMBRA",
    "link_margin_db": 1.1, "last_contact_min": 35
  },
  "optimal": {
    "battery_percent": 95, "safe_mode_active": false,
    "thermal_status": "NOMINAL", "orbital_phase": "SUNLIT",
    "link_margin_db": 22.0, "last_contact_min": 1
  }
}
```

### 13.4 Attack Scenario Datasets

**Purpose**: Pre-scripted attack scenarios that SCSP detects and blocks during the demo.

**Scenario A — Replay Attack**:
```json
{
  "scenario": "replay_attack",
  "legitimate_command": {
    "type": "ATTITUDE_MANOEUVRE", "nonce": "abc-123", "timestamp": "T-00:08:00"
  },
  "replay_command": {
    "type": "ATTITUDE_MANOEUVRE", "nonce": "abc-123", "timestamp": "T-00:00:00"
  },
  "expected_outcome": "REPLAY_BLOCKED",
  "demo_narration": "Same nonce detected — command from 8 minutes ago replayed"
}
```

**Scenario B — High-Risk Command in Dangerous State**:
```json
{
  "scenario": "dangerous_state_command",
  "command": { "type": "DISABLE_SAFE_MODE", "subsystem": "EPS" },
  "telemetry": "low_power_eclipse",
  "expected_score": 85,
  "expected_tier": "HIGH",
  "expected_outcome": "PENDING_DUAL_APPROVAL"
}
```

**Scenario C — Dangerous Command Sequence**:
```json
{
  "scenario": "dangerous_sequence",
  "command_1": { "type": "DISABLE_SAFE_MODE", "timestamp": "T-00:00:45" },
  "command_2": { "type": "THRUSTER_FIRE", "timestamp": "T-00:00:00" },
  "rule_matched": "SEQ-002",
  "score_elevation": 25,
  "expected_outcome": "HIGH_RISK_ELEVATED_BY_SEQUENCE"
}
```

**Scenario D — Ledger Tamper**:
```json
{
  "scenario": "ledger_tamper",
  "target_entry_sequence": 42,
  "original_value": { "risk_score": 87 },
  "tampered_value": { "risk_score": 12 },
  "expected_integrity_check": "FAIL",
  "expected_fail_at_sequence": 42
}
```

### 13.5 Pre-Staged Demo Database State

The demo database is populated before the demo starts from a single seeding script (`scripts/seed_demo.py`) that creates:
- All 6 operators with known passwords
- 300 historical command records
- 4 telemetry history snapshots
- 1 command in `PENDING_DUAL_APPROVAL` state with 0 approvals (ready for instant demo)
- 1 ledger with 50 entries including 1 pre-tampered entry at sequence 42
- 4 pre-scored DEMO_MODE fixture responses

**Reset Command**: `make demo-reset` truncates all tables and re-runs the seed script. This ensures the demo always starts from a clean, known-good state.

---

## §14 — Security & Compliance Requirements

### 14.1 Authentication & Authorization Requirements

- All API endpoints except `/api/v1/auth/login` require a valid JWT in the `Authorization: Bearer` header
- JWT tokens expire after 60 minutes and must be refreshed
- Role enforcement is server-side — frontend role checks are UI convenience only
- An operator cannot approve their own command (enforced by comparing `sub` claim to `submitter_id`)
- Failed login attempts are rate-limited to 5 per minute per IP
- All auth events (login, logout, failed attempt, token refresh) are logged

### 14.2 Cryptographic Standards

| Component | Standard | Implementation |
|---|---|---|
| Password hashing | bcrypt, cost factor 12 | `passlib[bcrypt]` |
| JWT signing | HMAC-SHA256 (HS256) | `python-jose[cryptography]` |
| Approval token signing | Ed25519 | `cryptography` library |
| Ledger hash chain | SHA-256 | `hashlib` (stdlib) |
| CCSDS packet CRC | CRC-16-CCITT | Custom implementation |
| TLS (transport) | TLS 1.3 | ngrok / production reverse proxy |

### 14.3 NIST IR 8401 Alignment

| NIST IR 8401 Requirement | SCSP Implementation |
|---|---|
| AC-3: Access Enforcement | RBAC with JWT role claims |
| AU-9: Protection of Audit Information | Hash-chained tamper-evident ledger |
| AU-10: Non-repudiation | Ed25519-signed approval tokens in ledger |
| IA-3: Device Identification | CCSDS APID validation against subsystem registry |
| SC-8: Transmission Confidentiality | TLS 1.3 on all API endpoints |
| SI-3: Malicious Code Protection | CCSDS parser rejects malformed packets |
| SI-10: Information Input Validation | CCSDS validator + JSON schema validation on all inputs |

### 14.4 CISA Space Systems Advisory Compliance

The CISA 2023 Space Systems cybersecurity guidelines identify three priority areas for ground segment security. SCSP addresses all three:

1. **Command and control integrity**: Addressed by the semantic AI scoring engine and multi-party authorization chain — every command is evaluated and authorized before transmission.
2. **Audit and accountability**: Addressed by the hash-chained ledger — every command, approval, and security event is non-repudiably logged.
3. **Insider threat mitigation**: Addressed by the separation-of-roles enforcement (operators cannot approve their own commands) and the Phase 2 behavioral drift detection.

---

## §15 — Demo Plan & Fallback Strategy

### 15.1 Demo Environment Setup

```bash
# Pre-demo checklist (30 minutes before judging)
make demo-reset          # Reset database to clean demo state
make demo-seed           # Re-seed all demo data and pre-staged commands
python obc_simulator.py  # Start mock OBC on port 9000
uvicorn app.main:app --port 8000  # Start FastAPI
npm run start            # Start Next.js on port 3000
ngrok http 3000          # Start ngrok tunnel
# Display ngrok QR code on secondary monitor for judge's phone
```

### 15.2 Demo Moment 1 — Live Telemetry Score Shift (~90 seconds)

**Script**:
```
"Watch what happens when the same command is issued under different satellite states."

1. Set telemetry dashboard: battery 78%, safe-mode OFF, thermal NOMINAL, orbital SUNLIT
2. Submit DISABLE_SAFE_MODE command
3. Score appears: 24 / 100 — LOW — "Nominal satellite state, safe operation"
4. Command auto-approved, OBC telemetry updates on screen

"Now the same command — same operator — but the satellite just entered eclipse at 9% battery."

5. Update telemetry: battery 9%, thermal ELEVATED, orbital ECLIPSE
6. Submit DISABLE_SAFE_MODE again
7. Score appears: 87 / 100 — HIGH — "Violates SR-001, power failure risk, eclipse phase"
8. Command enters PENDING_DUAL_APPROVAL
9. Judge scans QR code on their phone — logs in as Safety Officer
10. Push notification appears on judge's phone
11. Judge approves from phone — approval token recorded
12. Second approver (team member) approves on laptop
13. Quorum achieved — command dispatched — OBC telemetry updates

"The exact same command. Different satellite state. Completely different outcome."
```

### 15.3 Demo Moment 2 — Ledger Tamper and Integrity Break (~30 seconds)

**Script**:
```
"Every command decision in this system is cryptographically chained.
 Watch what happens when someone tries to alter the history."

1. Open ledger view — 50 entries visible with hash values
2. Run integrity check: "All 50 entries verified — chain intact"

"Now I'm going to simulate an insider modifying a historical record —
 changing this command's risk score from 87 to 12 to hide a dangerous action."

3. Click "Tamper Entry 42" button (pre-scripted admin function)
4. Entry 42 updates on screen: risk_score 87 → 12

5. Run integrity check again
6. Checker traverses chain... stops at entry 42
7. Entry 42 highlighted RED: "Hash mismatch — entry corrupted"

"You can't alter history in this system. Every change leaves a mathematical proof."
```

### 15.4 Fallback Plans Per Layer

| Layer | Failure Mode | Fallback |
|---|---|---|
| AI scoring (Gemini) | API timeout or bad JSON | Set `DEMO_MODE=true` — returns pre-seeded fixtures |
| Auth chain (WebSocket) | Connection drops | 3-second polling auto-activates — approver panel still updates |
| Auth chain (approver) | Judge's phone can't connect | Team member plays approver on second laptop |
| Ledger tamper demo | UI bug | Open PostgreSQL terminal directly and run UPDATE + integrity check script |
| Mock OBC | UDP script crashes | Static telemetry panel shows pre-loaded values — command flow still visible |
| ngrok | Tunnel drops | Use localhost:3000 on second laptop for approver panel |

### 15.5 Pre-Staged Demo Dataset Requirements

The following must be true at demo start time (verified by `make demo-verify`):
- [ ] 6 operator accounts seeded with known credentials
- [ ] 50 ledger entries present with entry 42 pre-available for tamper demo
- [ ] 1 command in `PENDING_DUAL_APPROVAL` state with 0 approvals
- [ ] All 4 DEMO_MODE fixture responses present and validated
- [ ] Mock OBC running and responding to telemetry requests
- [ ] ngrok URL accessible and QR code generated

---

## §16 — Innovation Novelty Claims

### Claim 1 — Semantic + Telemetry-Aware AI Risk Scoring

**Claim**: SCSP is the first satellite command security system to evaluate commands as semantic intents in the context of live satellite operational state, rather than as syntactic packets against a fixed schema.

**What makes it novel**:
- Existing tools ask: "Is this packet valid?" SCSP asks: "Should this command execute right now?"
- The same command receives a materially different score depending on telemetry state — a capability no existing tool has
- The AI justification is human-readable and references specific telemetry values and mission rules — it is transparent, not a black box

**Research backing**: Oxford 2025 (Shelby) explicitly states "no general defense against signal injection into satellite systems has been proposed." This is the direct answer. Salim et al. 2025 identifies "command authorization (semantic validation)" as absent from all existing tools.

**Defensible under scrutiny**: A judge can ask "what model, what features?" — the prompt template, input schema, and output schema are fully specified and ready to show.

---

### Claim 2 — Tiered Multi-Party Authorization Proportional to AI Risk Score

**Claim**: SCSP is the first satellite C2 system to enforce a per-command multi-party authorization workflow where the required level of human authorization is dynamically determined by an AI risk assessment.

**What makes it novel**:
- Every existing C2 system uses a single-operator trust model — one authenticated person can send any command
- The authorization tier is consequential — a HIGH score doesn't just flag a command, it prevents execution until human judgment is applied
- The approval token is cryptographically signed and time-bounded — approvals cannot be forged or reused
- Role separation is enforced at the token level — operators cannot approve their own commands

**Research backing**: NIST IR 8401 requires multi-factor authorization for safety-critical commands — no open tool currently implements this. CISA's space advisory identifies single-operator trust as the primary insider threat vector.

---

### Claim 3 — Hash-Chained Non-Repudiable Command Ledger

**Claim**: SCSP provides the first hash-chained, cryptographically non-repudiable command audit trail for satellite ground station operations, satisfying NIST IR 8401's non-repudiation requirement that no existing open tool meets.

**What makes it novel**:
- Existing logs are plain text or database rows — modifiable without detection
- SCSP's chain means any modification to any historical entry is immediately detectable by the integrity checker
- The ledger records not just the command but the AI justification, telemetry snapshot, and approver decision — providing full context for post-event review
- Spoofing and tampering are identified in the CubeSat threat model (arXiv 2312.01330) as primary attack vectors against command logs — SCSP directly counters this

**Research backing**: Willbold et al. 2023 found that satellite firmware lacks non-repudiation mechanisms. Salim et al. 2025 identifies non-repudiation as a compliance requirement that current tools fail to meet.

---

## §17 — Future Roadmap — Post-MVP Phases

### 17.1 Phase 2 — Extension Features

**F-10 — Operator Behavioral Baseline & Drift Detection**
- Pre-seed 30 days of command history per operator
- Implement Z-score anomaly detection on session metrics
- Add behavioral alert feed to safety officer dashboard
- Estimated effort: 6–8 hours post-MVP

**F-11 — Constellation-Level Threat Correlation (partial)**
- Deploy Redis pub/sub event bus
- Run 3 mock satellite instances (SAT_ALPHA, SAT_BETA, SAT_GAMMA)
- Implement cross-satellite alert propagation
- Multi-satellite dashboard with individual and aggregate risk views
- Estimated effort: 12–16 hours post-MVP

**F-14 — Compliance Export**
- NIST IR 8401 aligned audit report generation
- PDF export of signed ledger with integrity certificate
- Operator activity report per session

### 17.2 Phase 3 — Production Hardening

**Containerization**:
- Docker Compose for local development (FastAPI + PostgreSQL + Next.js + OBC)
- Kubernetes manifests for cloud deployment
- Secrets management via HashiCorp Vault or AWS Secrets Manager

**Cloud Deployment**:
- FastAPI → AWS ECS or Google Cloud Run
- PostgreSQL → AWS RDS or Cloud SQL
- Next.js → Vercel or AWS Amplify
- Redis (Phase 2 event bus) → AWS ElastiCache

**Security Hardening**:
- Replace HMAC-SHA256 JWT signing with RS256 (asymmetric)
- Hardware Security Module (HSM) for approval token signing keys
- mTLS between SCSP components
- Rate limiting on all API endpoints
- Penetration testing against OWASP API Security Top 10

### 17.3 Phase 4 — Real Satellite Integration

**Real CCSDS Hardware Integration**:
- Replace mock OBC with NOS3 (NASA Open Source Satellite Simulation)
- Integration test with SDR (Software Defined Radio) for RF link simulation
- Certification path for operational CubeSat missions
- Partnership with university CubeSat programs for pilot deployment

**F-15 — Quantum-Resistant Command Signing**:
- Replace Ed25519 with CRYSTALS-Dilithium (NIST PQC standard)
- Post-quantum key exchange for approval token channels
- Timeline: when NIST PQC standards are finalized and hardware-supported

---

## §18 — References & External Links

### Research Papers

| # | Citation | Link |
|---|---|---|
| R-01 | Willbold et al., "Space Odyssey: An Experimental Software Security Analysis of Satellites," IEEE S&P 2023 | https://ieeexplore.ieee.org/document/10179464 |
| R-02 | Shelby, "Cybersecurity Risk Assessment for CubeSat Missions," Oxford 2025 | https://arxiv.org/abs/2604.00303 |
| R-03 | Pavur & Martinovic, "SoK: Building a Launchpad for Satellite Cyber-Security Research," IEEE S4 2020 | https://ieeexplore.ieee.org/document/9155098 |
| R-04 | "Cyber Attacks on Space Information Networks: A Comprehensive Review," MDPI 2025 | https://www.mdpi.com/aerospace |
| R-05 | Salim, Moustafa & Reisslein, "Cybersecurity of Satellite Communications Systems," IEEE Comm. Surveys & Tutorials 2025 | https://ieeexplore.ieee.org |
| R-06 | "LEO Satellite Adversarial Taxonomy," arXiv 2312.01330 | https://arxiv.org/abs/2312.01330 |

### Standards & Advisories

| # | Document | Link |
|---|---|---|
| S-01 | NIST IR 8401 — Satellite Ground System Security | https://nvlpubs.nist.gov/nistpubs/ir/2022/NIST.IR.8401.pdf |
| S-02 | CISA Space Systems Cybersecurity Guidelines 2023 | https://www.cisa.gov/resources-tools/resources/space-systems-critical-infrastructure |
| S-03 | CISA Advisory AA22-076A — Viasat KA-SAT Attack | https://www.cisa.gov/news-events/cybersecurity-advisories/aa22-076a |
| S-04 | CCSDS Space Data Link Security (SDLS) Standard | https://public.ccsds.org/Pubs/355x0b1.pdf |
| S-05 | CCSDS Telecommand Space Data Link Protocol | https://public.ccsds.org/Pubs/232x0b4.pdf |
| S-06 | MITRE ATT&CK for ICS — Space Systems | https://attack.mitre.org/matrices/ics/ |
| S-07 | SPARTA Satellite Threat Matrix | https://sparta.aerospace.org |

### Existing Solutions

| # | Solution | Link |
|---|---|---|
| E-01 | OpenC3 COSMOS Ground Station Software | https://openc3.com |
| E-02 | Parsons Ace CtrlPoint | https://www.parsons.com/capabilities/space/ |
| E-03 | Lockheed Martin Compass | https://www.lockheedmartin.com/en-us/products/compass.html |
| E-04 | ATLAS Space GSaaS | https://atlasspace.com |
| E-05 | NASA NOS3 Satellite Simulation | https://github.com/nasa/nos3 |

### Development References

| # | Resource | Link |
|---|---|---|
| D-01 | FastAPI WebSocket Documentation | https://fastapi.tiangolo.com/advanced/websockets/ |
| D-02 | Google Gemini Python SDK | https://ai.google.dev/api/python/google/generativeai |
| D-03 | Next.js 14 App Router Documentation | https://nextjs.org/docs/app |
| D-04 | asyncpg PostgreSQL Driver | https://magicstack.github.io/asyncpg/ |
| D-05 | PyJWT Documentation | https://pyjwt.readthedocs.io/ |
| D-06 | OpenC3 Plugin Development Guide | https://openc3.com/docs/v5/plugins |
| D-07 | CCSDS Telecommand Packet Format Reference | https://public.ccsds.org/Pubs/232x0b4.pdf |

---

*End of Product Requirements Document — Satellite Command Security Platform v1.0.0*
*Next document: Technical Requirements Document (TRD)*
