---
id: uds
title: Unified Diagnostic Services
source: https://en.wikipedia.org/wiki/Unified_Diagnostic_Services
revision: https://en.wikipedia.org/w/index.php?oldid=1334951853
fetched: 2026-10-31
license: CC BY-SA 4.0 (Wikipedia contributors)
---

# Unified Diagnostic Services

Diagnostic communication protocol

Unified Diagnostic Services (UDS) is a diagnostic communication protocol used by electronic control units (ECUs) in automotive electronics. UDS is defined by ISO 14229 and evolved from ISO 14230 (KWP2000), which is now largely obsolete. UDS specifies functionality at the session, presentation, and application layers (layers 5–7) of the OSI model. Because of this, it can operate on different physical and data link layers such as CAN (ISO 11898), LIN (ISO 17987), Ethernet (ISO 13400), FlexRay (ISO 17458), and K-Line (ISO 14230). In practice, UDS is most commonly used over CAN via Diagnostic over CAN (DoCAN), defined in ISO 15765.

The term "unified" refers to the fact that UDS is an international standard rather than a manufacturer-specific protocol. Today, nearly all Tier 1 suppliers implement UDS in ECUs developed for automotive original equipment manufacturers (OEMs). UDS is also integrated into larger software architectures, including AUTOSAR.

Modern vehicles have a diagnostic interface for on-board diagnostics, which makes it possible to connect a computer (client) or diagnostics tool, which is referred to as tester, to the communication system of the vehicle. Thus, UDS requests can be sent to the controllers which provide responses (this may be positive or negative). This makes it possible to interrogate the fault memory of the individual control units, to update them with new firmware, have low-level interaction with their hardware (e.g. to turn a specific output on or off), or to make use of special functions (referred to as routines) to attempt to understand the environment and operating conditions of an ECU to be able to diagnose faulty or otherwise undesirable behavior.

## Services

SID (Service Identifier)

Request Service Identifier (SID) | Response Service Identifier (RSID) | Service name | Description
0x10 | 0x50 | DiagnosticSessionControl | DiagnosticSessionControl service is used to change diagnostic sessions in the server(s). In each diagnostic session a different set of diagnostic services (and/or functionalities) is enabled in the server. Server shall always be in exactly one diagnostic session.
0x11 | 0x51 | ECUReset | ECUReset service is used by the client to request that the server perform a reset. The server, after receiving this request, performs the specified type of reset (either before or after transmitting the positive response).
0x14 | 0x54 | ClearDiagnosticInformation | ClearDiagnosticInformation service is used by the client to clear Diagnostic Trouble Codes (DTCs) and related data stored in one or more server memories.
0x19 | 0x59 | ReadDTCInformation | ReadDTCInformation service allows the client to request current Diagnostic Trouble Code (DTC) information from one or more servers within the vehicle.
0x22 | 0x62 | ReadDataByIdentifier | ReadDataByIdentifier service allows the client to request data record values from the server identifier by one or more DataIdentifiers (DIDs).
0x23 | 0x63 | ReadMemoryByAddress | ReadMemoryByAddress service allows the client to request server's memory data stored under provided memory address.
0x24 | 0x64 | ReadScalingDataByIdentifier | ReadScalingDataByIdentifier service allows the client to request the scaling information associated with a Data Identifier (DID). Scaling data provides information required to correctly interpret the actual data value, such as: data encoding type (e.g. integer, floating-point, ASCII) units and formats conversion formulas and coefficients bit mappings, and other interpretation details
0x27 | 0x67 | SecurityAccess | SecurityAccess service allows the client to unlock functions/services with restricted access. Unlocking sequence: The client requests a seed from the server. The server responds with a positive response that includes a randomly generated seed value. Both the client and server compute a key value based on the seed (using a secret algorithm). The client sends the computed key to the server. The server validates the client by comparing the received key with its own calculated key. If they match, the client is granted access to the protected functionality for the corresponding security level.
0x28 | 0x68 | CommunicationControl | CommunicationControl service allows the client to switch on/off the transmission and/or the reception of certain messages on the server(s).
0x29 | 0x69 | Authentication | Authentication service provides a mechanism for the client to prove its identity, allowing access to data and/or diagnostic services that have restricted access due to security, emissions, or safety requirements. It is an alternative for SecurityAccess service.
0x2A | 0x6A | ReadDataByPeriodicIdentifier | ReadDataByPeriodicIdentifier service allows the client to request periodic transmission of data record values from the server. Each periodic data record is identified by Periodic DID (the second byte of a DID with a fixed first byte 0xF2).
0x2C | 0x6C | DynamicallyDefineDataIdentifier | DynamicallyDefineDataIdentifier service allows the client to define Data Identifiers.
0x2E | 0x6E | WriteDataByIdentifier | WriteDataByIdentifier service allows the client to set data values stored under given Data Identifier.
0x2F | 0x6F | InputOutputControlByIdentifier | InputOutputControlByIdentifier service allows the client to take temporary control over Data Identifier values.
0x31 | 0x71 | RoutineControl | RoutineControl service allows the client to execute any sequence of actions that are defined as routines. Each routine has Routine Identifier assigned.
0x34 | 0x74 | RequestDownload | RequestDownload service allows the client to initiate data transfer from the client to the server.
0x35 | 0x75 | RequestUpload | RequestUpload service allows the client to initiate data transfer from the server to the client.
0x36 | 0x76 | TransferData | TransferData service transfers the actual data that were earlier requested by either RequestDownload, RequestUpload or RequestFileTransfer service.
0x37 | 0x77 | RequestTransferExit | RequestTransferExit services ends the data transmission using TransferData service.
0x38 | 0x78 | RequestFileTransfer | RequestFileTransfer service allows the client to initiate a file transfer (either download or upload). It is an alternative for RequestDownload and RequestUpload services.
0x3D | 0x7D | WriteMemoryByAddress | WriteMemoryByAddress service allows the client to set values directly in the server's memory.
0x3E | 0x7E | TesterPresent | TesterPresent service informs server(s) that the diagnostic tester device (client) is connected and server(s) shall not exit their current diagnostic session.
0x83 | 0xC3 | AccessTimingParameter | AccessTimingParameter was withdrawn in ISO 14229-1:2020.
0x84 | 0xC4 | SecuredDataTransmission | SecuredDataTransmission service allows the client to secure UDS communication using either encryption or signature.
0x85 | 0xC5 | ControlDTCSettings | ControlDTCSettings service allows the client to manage DTCs' statuses updating.
0x86 | 0xC6 | ResponseOnEvent | ResponseOnEvent service allows the client to define events and request messages that the server is supposed to respond to when the event occurs. This can be used to diagnose complicated issues. For example the client can request from the server to respond to ReadMemoryByAddress request (to provide detailed information about the reason for DTC reporting) when testFailed bit of a certain DTC is set.
0x87 | 0xC7 | LinkControl | LinkControl service allows the client to change physical connection parameters. As an example, for CAN bus, the client could change baudrate and version of CAN protocol (e.g. from CAN-FD to Classical CAN).

## Diagnostic Message

There are two types of diagnostic messages transmitted using UDS protocol:

- Request

- Response

### Request Message

Request messages are transmitted by a Client towards one or more Servers.

Service Identifier (SID) is the first byte in each request message.

### Response Message

Response messages are transmitted by Servers to a Client.

The first byte in the response message is usually Response Service Identifier (RSID) value (with the exception of following responses to ReadDataByPeriodicIdentifier service).

#### Positive Response Message

Format of each positive response message is specific for the diagnostic service it relates to.

#### Negative Response Message

Negative Response Message format

Byte | Value | Description
#1 | 0x7F | Negative Response SID
#2 | SID | SID value from request message
#3 | NRC | reason for the rejection

Negative Response Codes

Negative Response Codes (NRC in short) carry the information for request message rejection.

Negative Response Codes

Value | Name
0x10 | generalReject
0x11 | serviceNotSupported
0x12 | SubFunctionNotSupported
0x13 | incorrectMessageLengthOrInvalidFormat
0x14 | responseTooLong
0x21 | busyRepeatRequest
0x22 | conditionsNotCorrect
0x24 | requestSequenceError
0x25 | noResponseFromSubnetComponent
0x26 | FailurePreventsExecutionOfRequestedAction
0x31 | requestOutOfRange
0x33 | securityAccessDenied
0x34 | authenticationRequired
0x35 | invalidKey
0x36 | exceedNumberOfAttempts
0x37 | requiredTimeDelayNotExpired
0x38 | secureDataTransmissionRequired
0x39 | secureDataTransmissionNotAllowed
0x3A | secureDataVerificationFailed
0x50 | Certificate verification failed, Invalid Time Period
0x51 | Certificate verification failed, Invalid Signature
0x52 | Certificate verification failed, Invalid Chain of Trust
0x53 | Certificate verification failed, Invalid Type
0x54 | Certificate verification failed, Invalid Format
0x55 | Certificate verification failed, Invalid Content
0x56 | Certificate verification failed, Invalid Scope
0x57 | Certificate verification failed, Invalid Certificate (revoked)
0x58 | Ownership verification failed
0x59 | Challenge calculation failed
0x5A | Setting Access Rights failed
0x5B | Session key creation/derivation failed
0x5C | Configuration data usage failed
0x5D | DeAuthentication failed
0x70 | uploadDownloadNotAccepted
0x71 | transferDataSuspended
0x72 | generalProgrammingFailure
0x73 | wrongBlockSequenceCounter
0x78 | requestCorrectlyReceived-ResponsePending
0x7E | SubFunctionNotSupportedInActiveSession
0x7F | serviceNotSupportedInActiveSession
0x81 | rpmTooHigh
0x82 | rpmTooLow
0x83 | engineIsRunning
0x84 | engineIsNotRunning
0x85 | engineRunTimeTooLow
0x86 | temperatureTooHigh
0x87 | temperatureTooLow
0x88 | vehicleSpeedTooHigh
0x89 | vehicleSpeedTooLow
0x8A | throttle/PedalTooHigh
0x8B | throttle/PedalTooLow
0x8C | transmissionRangeNotInNeutral
0x8D | transmissionRangeNotInGear
0x8F | brakeSwitch(es)NotClosed (Brake Pedal not pressed or not applied)
0x90 | shifterLeverNotInPark
0x91 | torqueConverterClutchLocked
0x92 | voltageTooHigh
0x93 | voltageTooLow
0x94 | ResourceTemporarilyNotAvailable
