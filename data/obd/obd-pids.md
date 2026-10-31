---
id: obd-pids
title: OBD-II PIDs
source: https://en.wikipedia.org/wiki/OBD-II_PIDs
revision: https://en.wikipedia.org/w/index.php?oldid=1374011962
fetched: 2026-10-31
license: CC BY-SA 4.0 (Wikipedia contributors)
---

# OBD-II PIDs

Codes used for on-board diagnostics

OBD-II PIDs (On-board diagnostics Parameter IDs) are codes used to request data from a vehicle, used as a diagnostic tool.

SAE standard J1979 defines many OBD-II PIDs. All on-road vehicles and trucks sold in North America are required to support a subset of these codes, primarily for state mandated emissions inspections. Manufacturers also define additional PIDs specific to their vehicles. Though not mandated, many motorcycles also support OBD-II PIDs.

In 1996, light-duty vehicles (less than 8,500 lb or 3,900 kg) were the first to be mandated followed by medium duty vehicles (8,500–14,000 lb or 3,900–6,400 kg) in 2005. They are both required to be accessed through a standardized data link connector defined by SAE J1962.

Heavy-duty vehicles (greater than 14,000 lb or 6,400 kg) made after 2010, for sale in the US are allowed to support OBD-II diagnostics through SAE standard J1939-13 (a round diagnostic connector) according to CARB in title 13 CCR 1971.1. Some heavy-duty trucks in North America use the SAE J1962 OBD-II diagnostic connector that is common with passenger cars, notably Mack and Volvo Trucks, however they use 29 bit CAN identifiers (unlike 11 bit headers used by passenger cars).

## Services / Modes

There are 10 diagnostic services described in the latest OBD-II standard SAE J1979. Before 2002, J1979 referred to these services as "modes". They are as follows:

Service / Mode (hex) | Description
01 | Show current data
02 | Show freeze frame data
03 | Show stored Diagnostic Trouble Codes
04 | Clear Diagnostic Trouble Codes and stored values
05 | Test results, oxygen sensor monitoring (non CAN only)
06 | Test results, other component/system monitoring (Test results, oxygen sensor monitoring for CAN only)
07 | Show pending Diagnostic Trouble Codes (detected during current or last driving cycle)
08 | Control operation of on-board component/system
09 | Request vehicle information
0A | Permanent Diagnostic Trouble Codes (DTCs) (Cleared DTCs)

Vehicle manufacturers are not required to support all services. Each manufacturer may define additional services above #9 (e.g.: service 22 as defined by SAE J2190 for Ford/GM, service 21 for Toyota) for other information e.g. the voltage of the traction battery in a hybrid electric vehicle (HEV).

The nonOBD UDS services start at 0x10 to avoid overlap of ID-range.

## Standard PIDs

The table below shows the standard OBD-II PIDs as defined by SAE J1979. The expected response for each PID is given, along with information on how to translate the response into meaningful data. Again, not all vehicles will support all PIDs and there can be manufacturer-defined custom PIDs that are not defined in the OBD-II standard.

Note that services 01 and 02 are basically identical, except that service 01 provides current information, whereas service 02 provides a snapshot of the same data taken at the point when the last diagnostic trouble code was set. The exceptions are PID 01, which is only available in service 01, and PID 02, which is only available in service 02. If service 02 PID 02 returns zero, then there is no snapshot and all other service 02 data is meaningless.

When using Bit-Encoded-Notation, quantities like C4 means bit 4 from data byte C. Each bit is numbered from 0 to 7, so 7 is the most significant bit and 0 is the least significant bit (See below).

A | B | C | D
A7 | A6 | A5 | A4 | A3 | A2 | A1 | A0 | B7 | B6 | B5 | B4 | B3 | B2 | B1 | B0 | C7 | C6 | C5 | C4 | C3 | C2 | C1 | C0 | D7 | D6 | D5 | D4 | D3 | D2 | D1 | D0

### Service 01 - Show current data

PIDs; (hex) | PID; (Dec) | Data bytes returned | Description | Min value | Max value | Units | Formula
00 | 0 | 4 | PIDs supported [$01 - $20] | | | | Bit encoded [A7..D0] == [PID $01..PID $20] See below
01 | 1 | 4 | Monitor status since DTCs cleared. (Includes malfunction indicator lamp (MIL), status and number of DTCs, components tests, DTC readiness checks) | | | | Bit encoded. See below
02 | 2 | 2 | DTC that caused freeze frame to be stored. | | | | Decoded as in service 3
03 | 3 | 2 | Fuel system status | | | | Bit encoded. See below
04 | 4 | 1 | Calculated engine load | 0 | 100 | % | {\displaystyle {\tfrac {100}{255}}A} (or {\displaystyle {\tfrac {A}{2.55}}} )
05 | 5 | 1 | Engine coolant temperature | -40 | 215 | °C | {\displaystyle A-40}
06 | 6 | 1 | Short term fuel trim (STFT)—Bank 1 | -100 (Reduce Fuel: Too Rich) | 99.2 (Add Fuel: Too Lean) | % | {\displaystyle {\frac {100}{128}}A-100} (or {\displaystyle {\tfrac {A}{1.28}}-100} )
07 | 7 | 1 | Long term fuel trim (LTFT)—Bank 1
08 | 8 | 1 | Short term fuel trim (STFT)—Bank 2
09 | 9 | 1 | Long term fuel trim (LTFT)—Bank 2
0A | 10 | 1 | Fuel pressure (gauge pressure) | 0 | 765 | kPa | {\displaystyle 3A}
0B | 11 | 1 | Intake manifold absolute pressure | 0 | 255 | kPa | {\displaystyle A}
0C | 12 | 2 | Engine speed | 0 | 16,383.75 | rpm | {\displaystyle {\frac {256A+B}{4}}}
0D | 13 | 1 | Vehicle speed | 0 | 255 | km/h | {\displaystyle A}
0E | 14 | 1 | Timing advance | -64 | 63.5 | ° before TDC | {\displaystyle {\frac {A}{2}}-64}
0F | 15 | 1 | Intake air temperature | -40 | 215 | °C | {\displaystyle A-40}
10 | 16 | 2 | Mass air flow sensor (MAF) air flow rate | 0 | 655.35 | g/s | {\displaystyle {\frac {256A+B}{100}}}
11 | 17 | 1 | Throttle position | 0 | 100 | % | {\displaystyle {\tfrac {100}{255}}A}
12 | 18 | 1 | Commanded secondary air status | | | | Bit encoded. See below
13 | 19 | 1 | Oxygen sensors present (in 2 banks) | | | | [A0..A3] == Bank 1, Sensors 1-4. [A4..A7] == Bank 2...
14 | 20 | 2 | Oxygen Sensor 1; A: Voltage; B: Short term fuel trim | 0; -100 | 1.275; 99.2 | V % | {\displaystyle {\frac {A}{200}}} {\displaystyle {\frac {100}{128}}B-100} (if B==$FF, sensor is not used in trim calculation)
15 | 21 | 2 | Oxygen Sensor 2; A: Voltage; B: Short term fuel trim
16 | 22 | 2 | Oxygen Sensor 3; A: Voltage; B: Short term fuel trim
17 | 23 | 2 | Oxygen Sensor 4; A: Voltage; B: Short term fuel trim
18 | 24 | 2 | Oxygen Sensor 5; A: Voltage; B: Short term fuel trim
19 | 25 | 2 | Oxygen Sensor 6; A: Voltage; B: Short term fuel trim
1A | 26 | 2 | Oxygen Sensor 7; A: Voltage; B: Short term fuel trim
1B | 27 | 2 | Oxygen Sensor 8; A: Voltage; B: Short term fuel trim
1C | 28 | 1 | OBD standards this vehicle conforms to | 1 | 250 | | enumerated. See below
1D | 29 | 1 | Oxygen sensors present (in 4 banks) | | | | Similar to PID $13, but [A0..A7] == [B1S1, B1S2, B2S1, B2S2, B3S1, B3S2, B4S1, B4S2]
1E | 30 | 1 | Auxiliary input status | | | | A0 == Power Take Off (PTO) status (1 == active); [A1..A7] not used
1F | 31 | 2 | Run time since engine start | 0 | 65,535 | s | {\displaystyle 256A+B}
20 | 32 | 4 | PIDs supported [$21 - $40] | | | | Bit encoded [A7..D0] == [PID $21..PID $40] See below
21 | 33 | 2 | Distance traveled with malfunction indicator lamp (MIL) on | 0 | 65,535 | km | {\displaystyle 256A+B}
22 | 34 | 2 | Fuel Rail Pressure (relative to manifold vacuum) | 0 | 5177.265 | kPa | {\displaystyle 0.079(256A+B)}
23 | 35 | 2 | Fuel Rail Gauge Pressure (diesel, or gasoline direct injection) | 0 | 655,350 | kPa | {\displaystyle 10(256A+B)}
24 | 36 | 4 | Oxygen Sensor 1; AB: Air-Fuel Equivalence Ratio (lambda,λ); CD: Voltage | 0; 0

### Service 02 - Show freeze frame data

Service 02 accepts the same PIDs as service 01, with the same meaning, but information given is from when the freeze frame was created. Note that PID $02 is used to obtain the DTC that triggered the freeze frame.

A person has to send the frame number in the data section of the message.

### Service 03 - Show stored Diagnostic Trouble Codes (DTCs)

PID; (hex) | Data bytes returned | Description | Min value | Max value | Units | Formula
N/A | n*6 | Request trouble codes | | | | 3 codes per message frame. See below

### Service 04 - Clear Diagnostic Trouble Codes and stored values

PID; (hex) | Data bytes returned | Description | Min value | Max value | Units | Formula
N/A | 0 | Clear trouble codes / Malfunction indicator lamp (MIL) / Check engine light | | | | Clears all stored trouble codes and turns the MIL off.

### Service 05 - Test results, oxygen sensor monitoring (non CAN only)

PID; (hex) | Data bytes returned | Description | Min value | Max value | Units | Formula
0100 | 4 | OBD Monitor IDs supported ($01 – $20) | 0x0 | 0xffffffff |
0101 | 2 | O2 Sensor Monitor Bank 1 Sensor 1 | 0.00 | 1.275 | V | 0.005 Rich to lean sensor threshold voltage
0102 | | O2 Sensor Monitor Bank 1 Sensor 2 | 0.00 | 1.275 | V | 0.005 Rich to lean sensor threshold voltage
0103 | | O2 Sensor Monitor Bank 1 Sensor 3 | 0.00 | 1.275 | V | 0.005 Rich to lean sensor threshold voltage
0104 | | O2 Sensor Monitor Bank 1 Sensor 4 | 0.00 | 1.275 | V | 0.005 Rich to lean sensor threshold voltage
0105 | | O2 Sensor Monitor Bank 2 Sensor 1 | 0.00 | 1.275 | V | 0.005 Rich to lean sensor threshold voltage
0106 | | O2 Sensor Monitor Bank 2 Sensor 2 | 0.00 | 1.275 | V | 0.005 Rich to lean sensor threshold voltage
0107 | | O2 Sensor Monitor Bank 2 Sensor 3 | 0.00 | 1.275 | V | 0.005 Rich to lean sensor threshold voltage
0108 | | O2 Sensor Monitor Bank 2 Sensor 4 | 0.00 | 1.275 | V | 0.005 Rich to lean sensor threshold voltage
0109 | | O2 Sensor Monitor Bank 3 Sensor 1 | 0.00 | 1.275 | V | 0.005 Rich to lean sensor threshold voltage
010A | | O2 Sensor Monitor Bank 3 Sensor 2 | 0.00 | 1.275 | V | 0.005 Rich to lean sensor threshold voltage
010B | | O2 Sensor Monitor Bank 3 Sensor 3 | 0.00 | 1.275 | V | 0.005 Rich to lean sensor threshold voltage
010C | | O2 Sensor Monitor Bank 3 Sensor 4 | 0.00 | 1.275 | V | 0.005 Rich to lean sensor threshold voltage
010D | | O2 Sensor Monitor Bank 4 Sensor 1 | 0.00 | 1.275 | V | 0.005 Rich to lean sensor threshold voltage
010E | | O2 Sensor Monitor Bank 4 Sensor 2 | 0.00 | 1.275 | V | 0.005 Rich to lean sensor threshold voltage
010F | | O2 Sensor Monitor Bank 4 Sensor 3 | 0.00 | 1.275 | V | 0.005 Rich to lean sensor threshold voltage
0110 | | O2 Sensor Monitor Bank 4 Sensor 4 | 0.00 | 1.275 | V | 0.005 Rich to lean sensor threshold voltage
0201 | | O2 Sensor Monitor Bank 1 Sensor 1 | 0.00 | 1.275 | V | 0.005 Lean to Rich sensor threshold voltage
0202 | | O2 Sensor Monitor Bank 1 Sensor 2 | 0.00 | 1.275 | V | 0.005 Lean to Rich sensor threshold voltage
0203 | | O2 Sensor Monitor Bank 1 Sensor 3 | 0.00 | 1.275 | V | 0.005 Lean to Rich sensor threshold voltage
0204 | | O2 Sensor Monitor Bank 1 Sensor 4 | 0.00 | 1.275 | V | 0.005 Lean to Rich sensor threshold voltage
0205 | | O2 Sensor Monitor Bank 2 Sensor 1 | 0.00 | 1.275 | V | 0.005 Lean to Rich sensor threshold voltage
0206 | | O2 Sensor Monitor Bank 2 Sensor 2 | 0.00 | 1.275 | V | 0.005 Lean to Rich sensor threshold voltage
0207 | | O2 Sensor Monitor Bank 2 Sensor 3 | 0.00 | 1.275 | V | 0.005 Lean to Rich sensor threshold voltage
0208 | | O2 Sensor Monitor Bank 2 Sensor 4 | 0.00 | 1.275 | V | 0.005 Lean to Rich sensor threshold voltage
0209 | | O2 Sensor Monitor Bank 3 Sensor 1 | 0.00 | 1.275 | V | 0.005 Lean to Rich sensor threshold voltage
020A | | O2 Sensor Monitor Bank 3 Sensor 2 | 0.00 | 1.275 | V | 0.005 Lean to Rich sensor threshold voltage
020B | | O2 Sensor Monitor Bank 3 Sensor 3 | 0.00 | 1.275 | V | 0.005 Lean to Rich sensor threshold voltage
020C | | O2 Sensor Monitor Bank 3 Sensor 4 | 0.00 | 1.275 | V | 0.005 Lean to Rich sensor threshold voltage
020D | | O2 Sensor Monitor Bank 4 Sensor 1 | 0.00 | 1.275 | V | 0.005 Lean to Rich sensor threshold voltage
020E | | O2 Sensor Monitor Bank 4 Sensor 2 | 0.00 | 1.275 | V | 0.005 Lean to Rich sensor threshold voltage
020F | | O2 Sensor Monitor Bank 4 Sensor 3 | 0.00 | 1.275 | V | 0.005 Lean to Rich sensor threshold voltage
0210 | | O2 Sensor Monitor Bank 4 Sensor 4 | 0.00 | 1.275 | V | 0.005 Lean to Rich sensor threshold voltage
PID; (hex) | Data bytes returned | Description | Min value | Max value | Units | Formula

### Service 09 - Request vehicle information

PID; (hex) | Data bytes returned | Description | Min value | Max value | Units | Formula
00 | 4 | Service 9 supported PIDs ($01 to $20) | | | | Bit encoded. [A7..D0] = [PID $01..PID $20] See below
01 | 1 | VIN Message Count in PID 02. Only for ISO 9141-2, ISO 14230-4 and SAE J1850. | | | | Usually the value will be 5.
02 | 17 | Vehicle Identification Number (VIN) | | | | 17-char VIN, ASCII-encoded and left-padded with null chars (0x00) if needed to.
03 | 1 | Calibration ID message count for PID 04. Only for ISO 9141-2, ISO 14230-4 and SAE J1850. | | | | It will be a multiple of 4 (4 messages are needed for each ID).
04 | 16,32,48,64.. | Calibration ID | | | | Up to 16 ASCII chars. Data bytes not used will be reported as null bytes (0x00). Several CALID can be output (16 bytes each)
05 | 1 | Calibration verification numbers (CVN) message count for PID 06. Only for ISO 9141-2, ISO 14230-4 and SAE J1850. | | |
06 | 4,8,12,16 | Calibration Verification Numbers (CVN) Several CVN can be output (4 bytes each) the number of CVN and CALID must match | | | | Raw data left-padded with null characters (0x00). Usually displayed as hex string.
07 | 1 | In-use performance tracking message count for PID 08 and 0B. Only for ISO 9141-2, ISO 14230-4 and SAE J1850. | 8 | 10 | | 8 if sixteen values are required to be reported, 9 if eighteen values are required to be reported, and 10 if twenty values are required to be reported (one message reports two values, each one consisting in two bytes).
08 | 4 | In-use performance tracking for spark ignition vehicles | | | | 4 or 5 messages, each one containing 4 bytes (two values). See below
09 | 1 | ECU name message count for PID 0A | | |
0A | 20 | ECU name | | | | ASCII-coded. Right-padded with null chars (0x00).
0B | 4 | In-use performance tracking for compression ignition vehicles | | | | 5 messages, each one containing 4 bytes (two values). See below
PID; (hex) | Data bytes returned | Description | Min value | Max value | Units | Formula

### Bitwise encoded PIDs

Some of the PIDs in the above table cannot be explained with a simple formula. A more elaborate explanation of these data is provided here:

#### Service 01 PID 00 - Show PIDs supported

A request for this PID returns 4 bytes of data (Big-endian). Each bit, from MSB to LSB, represents one of the next 32 PIDs and specifies whether that PID is supported.

For example, if the car response is BE1FA813, it can be decoded like this:

Hexadecimal | B | E | 1 | F | A | 8 | 1 | 3
Binary | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 1 | 1
Supported? | Yes | No | Yes | Yes | Yes | Yes | Yes | No | No | No | No | Yes | Yes | Yes | Yes | Yes | Yes | No | Yes | No | Yes | No | No | No | No | No | No | Yes | No | No | Yes | Yes
PID number | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 0A | 0B | 0C | 0D | 0E | 0F | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 1A | 1B | 1C | 1D | 1E | 1F | 20

So, supported PIDs are: 01, 03, 04, 05, 06, 07, 0C, 0D, 0E, 0F, 10, 11, 13, 15, 1C, 1F and 20

#### Service 01 PID 01 - Monitor status since DTCs cleared

A request for this PID returns 4 bytes of data, labeled A, B, C and D.

The first byte (A) contains two pieces of information. Bit A7 (MSB of byte A) indicates whether or not the MIL (malfunction indicator light, aka. check engine light) is illuminated. Bits A6 through A0 represent the number of diagnostic trouble codes currently flagged in the ECU.

The second, third, and fourth bytes (B, C and D) give information about the availability and completeness of certain on-board tests ("OBD readiness checks"). The third and fourth bytes are to be interpreted differently depending upon whether the engine is spark ignition (e.g. Otto or Wankel engines) or compression ignition (e.g. Diesel engines). In the second byte (B), bit 3 indicates the engine type and thus how to interpret bytes C and D, with 0 being spark (Otto or Wankel) and 1 (set) being compression (Diesel). Bits B6 to B4 and B2 to B0 are used for information about tests that not engine-type specific, and thus termed common tests. Note that for bits indicating test availability a bit set to 1 indicates available, whilst for bits indicating test completeness a bit set to 0 indicates complete.

Bits | Definition
A7 | State of the CEL/MIL (on/off).
A6-A0 | Number of confirmed emissions-related DTCs available for display.
B7 | Reserved (should be 0)
B6-B4 | Bitmap indicating completeness of common tests.
B3 | Indication of engine type; 0 = Spark ignition (e.g. Otto or Wankel engines); 1 = Compression ignition (e.g. Diesel engines)
B2-B0 | Bitmap indicating availability of common tests.
C7-C0 | Bitmap indicating availability of engine-type specific tests.
D7-D0 | Bitmap indicating completeness of engine-type specific tests.

Bits from byte B representing common test indicators (those not engine-type specific) are mapped as follows:

| Test availability | Test completeness
Components | B2 | B6
Fuel System | B1 | B5
Misfire | B0 | B4

Bytes C and D are mapped as follows for spark ignition engine types (e.g. Otto or Wankel engines):

| Test availability | Test completeness
EGR and/or VVT System | C7 | D7
Oxygen Sensor Heater | C6 | D6
Oxygen Sensor | C5 | D5
Gasoline Particulate Filter | C4 | D4
Secondary Air System | C3 | D3
Evaporative System | C2 | D2
Heated Catalyst | C1 | D1
Catalyst | C0 | D0

Bytes C and D are alternatively mapped as follows for compression ignition engine types (Diesel engines):

| Test availability | Test completeness
EGR and/or VVT System | C7 | D7
PM filter monitoring | C6 | D6
Exhaust Gas Sensor | C5 | D5
- Reserved - | C4 | D4
Boost Pressure | C3 | D3
- Reserved - | C2 | D2
NOx/SCR Monitor | C1 | D1
NMHC Catalyst | C0 | D0

#### Service 01 PID 41 - Monitor status this drive cycle

A request for this PID returns 4 bytes of data. The data returned is of an identical form to that returned for PID 01, with one exception - the first byte is always zero.

#### Service 01 PID 78 and 79 - Exhaust Gas temperature (EGT) Bank 1 and Bank 2

A request for one of these two PIDs will return 9 bytes of data. PID 78 returns data relating to EGT sensors for bank 1, whilst PID 79 similarly returns data for bank 2. The first byte is a bit encoded field indicating which EGT sensors are supported for the respective bank.

Bytes | Description
A | EGT sensor support
B-C | Temperature read by EGT sensor 1
D-E | Temperature read by EGT sensor 2
F-G | Temperature read by EGT sensor 3
H-I | Temperature read by EGT sensor 4

The first byte is bit-encoded as follows:

Bits | Description
A7-A4 | Reserved
A3 | EGT sensor 4 supported?
A2 | EGT sensor 3 supported?
A1 | EGT sensor 2 supported?
A0 | EGT sensor 1 supported?

Bytes B through I provide 16-bit integers indicating the temperatures of the sensors. The temperature values are interpreted in degrees Celsius in the range -40 to 6513.5 (scale 0.1), using the usual {\displaystyle (A\times 256+B)/10-40} formula (MSB is A, LSB is B). Only values for which the corresponding sensor is supported are meaningful.

#### Service 03 (no PID required) - Show stored Diagnostic Trouble Codes

A request for this service returns a list of the DTCs that have been set. The list is encapsulated using the ISO 15765-2 protocol.

If there are two or fewer DTCs (up to 4 bytes) then they are returned in an ISO-TP Single Frame (SF). Three or more DTCs in the list are reported in multiple frames, with the exact count of frames dependent on the communication type and addressing details.

Each trouble code requires 2 bytes to describe. Encoded in these bytes are a category and a number. It is typically shown decoded into a five-character form like "U0158", where the first character (here 'U') represents the category the DTC belongs to, and the remaining four characters are a hexadecimal representation of the number under that category. The first two bits (A7 and A6) of the first byte (A) represent the category. The remaining 14 bits represent the number. Of note is that since the second character is formed from only two bits, it can thus only be within the range 0-3.

Bits | Definition
A7-A6 | Category; 00: P - Powertrain; 01: C - Chassis; 10: B - Body; 11: U - Network
A5-B0 | Number (within category)

An example DTC of "U0158" would be decoded as follows:

Bit | A7 | A6 | A5 | A4 | A3 | A2 | A1 | A0 | B7 | B6 | B5 | B4 | B3 | B2 | B1 | B0
Binary | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 1 | 1 | 0 | 0 | 0
Hexadecimal | C | 1 | 5 | 8
Decoded DTC | U | 0 | 1 | 5 | 8

The resulting five-character code, e.g. "U0158", can be looked up in a table of OBD-II DTCs to get an actual description of what it represents. Of note, whilst some blocks of DTC code ranges have generic meanings that apply to all vehicles and manufacturers, the meanings of others can vary per manufacturer or even model.

It is also worth noting that DTCs may sometimes be encountered in a four-character form, e.g. "C158", which is simply the plain hexadecimal representation of the two bytes, with proper decoding with respect to the category not having been performed.

#### Service 09 PID 08 - In-use performance tracking for spark ignition engines

It provides information about track in-use performance for catalyst banks, oxygen sensor banks, evaporative leak detection systems, EGR systems and secondary air system.

The numerator for each component or system tracks the number of times that all conditions necessary for a specific monitor to detect a malfunction have been encountered.
The denominator for each component or system tracks the number of times that the vehicle has been operated in the specified conditions.

The count of data items should be reported at the beginning (the first byte).

All data items of the In-use Performance Tracking record consist of two bytes and are reported in this order (each message contains two items, hence the message length is 4).

Mnemonic | Description
OBDCOND | OBD Monitoring Conditions Encountered Counts
IGNCNTR | Ignition Counter
CATCOMP1 | Catalyst Monitor Completion Counts Bank 1
CATCOND1 | Catalyst Monitor Conditions Encountered Counts Bank 1
CATCOMP2 | Catalyst Monitor Completion Counts Bank 2
CATCOND2 | Catalyst Monitor Conditions Encountered Counts Bank 2
O2SCOMP1 | O2 Sensor Monitor Completion Counts Bank 1
O2SCOND1 | O2 Sensor Monitor Conditions Encountered Counts Bank 1
O2SCOMP2 | O2 Sensor Monitor Completion Counts Bank 2
O2SCOND2 | O2 Sensor Monitor Conditions Encountered Counts Bank 2
EGRCOMP | EGR Monitor Completion Condition Counts
EGRCOND | EGR Monitor Conditions Encountered Counts
AIRCOMP | AIR Monitor Completion Condition Counts (Secondary Air)
AIRCOND | AIR Monitor Conditions Encountered Counts (Secondary Air)
EVAPCOMP | EVAP Monitor Completion Condition Counts
EVAPCOND | EVAP Monitor Conditions Encountered Counts
SO2SCOMP1 | Secondary O2 Sensor Monitor Completion Counts Bank 1
SO2SCOND1 | Secondary O2 Sensor Monitor Conditions Encountered Counts Bank 1
SO2SCOMP2 | Secondary O2 Sensor Monitor Completion Counts Bank 2
SO2SCOND2 | Secondary O2 Sensor Monitor Conditions Encountered Counts Bank 2

#### Service 09 PID 0B - In-use performance tracking for compression ignition engines

It provides information about track in-use performance for NMHC catalyst, NOx catalyst monitor, NOx adsorber monitor, PM filter monitor, exhaust gas sensor monitor, EGR/ VVT monitor, boost pressure monitor and fuel system monitor.

All data items consist of two bytes and are reported in this order (each message contains two items, hence message length is 4):

Mnemonic | Description
OBDCOND | OBD Monitoring Conditions Encountered Counts
IGNCNTR | Ignition Counter
HCCATCOMP | NMHC Catalyst Monitor Completion Condition Counts
HCCATCOND | NMHC Catalyst Monitor Conditions Encountered Counts
NCATCOMP | NOx/SCR Catalyst Monitor Completion Condition Counts
NCATCOND | NOx/SCR Catalyst Monitor Conditions Encountered Counts
NADSCOMP | NOx Adsorber Monitor Completion Condition Counts
NADSCOND | NOx Adsorber Monitor Conditions Encountered Counts
PMCOMP | PM Filter Monitor Completion Condition Counts
PMCOND | PM Filter Monitor Conditions Encountered Counts
EGSCOMP | Exhaust Gas Sensor Monitor Completion Condition Counts
EGSCOND | Exhaust Gas Sensor Monitor Conditions Encountered Counts
EGRCOMP | EGR and/or VVT Monitor Completion Condition Counts
EGRCOND | EGR and/or VVT Monitor Conditions Encountered Counts
BPCOMP | Boost Pressure Monitor Completion Condition Counts
BPCOND | Boost Pressure Monitor Conditions Encountered Counts
FUELCOMP | Fuel Monitor Completion Condition Counts
FUELCOND | Fuel Monitor Conditions Encountered Counts

### Enumerated PIDs

Some PIDs are to be interpreted specially, and aren't necessarily exactly bitwise encoded, or in any scale.
The values for these PIDs are enumerated.

#### Service 01 PID 03 - Fuel system status

A request for this PID returns 2 bytes of data. The first byte describes fuel system #1. The second byte describes fuel system #2 (if it exists) and is encoded identically to the first byte. The meaning assigned to the value of each byte is as follows:

Value | Description
0 | The motor is off
1 | Open loop due to insufficient engine temperature
2 | Closed loop, using oxygen sensor feedback to determine fuel mix
4 | Open loop due to engine load OR fuel cut due to deceleration
8 | Open loop due to system failure
16 | Closed loop, using at least one oxygen sensor but there is a fault in the feedback system

Any other value is an invalid response.

#### Service 01 PID 12 - Commanded secondary air status

A request for this PID returns a single byte of data which describes the secondary air status.

Value | Description
1 | Upstream
2 | Downstream of catalytic converter
4 | From the outside atmosphere or off
8 | Pump commanded on for diagnostics

Any other value is an invalid response.

#### Service 01 PID 1C - OBD standards this vehicle conforms to

A request for this PID returns a single byte of data which describes which OBD standards this ECU was designed to comply with. The different values the data byte can hold are shown below, next to what they mean:

Value (dec) | Description
1 | OBD-II as defined by the CARB
2 | OBD as defined by the EPA
3 | OBD and OBD-II
4 | OBD-I
5 | Not OBD compliant
6 | EOBD (Europe)
7 | EOBD and OBD-II
8 | EOBD and OBD
9 | EOBD, OBD and OBD II
10 | JOBD (Japan)
11 | JOBD and OBD II
12 | JOBD and EOBD
13 | JOBD, EOBD, and OBD II
14 | OBD, EOBD, and KOBD
15 | OBD, OBD II, EOBD, and KOBD
16 | Reserved
17 | Engine Manufacturer Diagnostics (EMD)
18 | Engine Manufacturer Diagnostics Enhanced (EMD+)
19 | Heavy Duty On-Board Diagnostics (Child/Partial) (HD OBD-C)
20 | Heavy Duty On-Board Diagnostics (HD OBD)
21 | World Wide Harmonized OBD (WWH OBD)
22 | Reserved
23 | Heavy Duty Euro OBD Stage I without NOx control (HD EOBD-I)
24 | Heavy Duty Euro OBD Stage I with NOx control (HD EOBD-I N)
25 | Heavy Duty Euro OBD Stage II without NOx control (HD EOBD-II)
26 | Heavy Duty Euro OBD Stage II with NOx control (HD EOBD-II N)
27 | Heavy Duty ZEV
28 | Brazil OBD Phase 1 (OBDBr-1)
29 | Brazil OBD Phase 2 (OBDBr-2)
30 | Korean OBD (KOBD)
31 | India OBD I (IOBD I)
32 | India OBD II (IOBD II)
33 | Heavy Duty Euro OBD Stage VI (HD EOBD-IV)
34 | OBD, OBD-II, and HD OBD
35 | Brazil OBD Phase 3 (OBDBr-3)
53-250 | Reserved
251-255 | Not available for assignment (SAE J1939 special meaning)

#### Service 01 PID 51 - Fuel Type Coding

This PID returns a value from an enumerated list giving the fuel type of the vehicle. The fuel type is returned as a single byte, and the value is given by the following table:

Value | Description
0 | Not available
1 | Gasoline
2 | Methanol
3 | Ethanol
4 | Diesel
5 | LPG
6 | CNG
7 | Propane
8 | Electric
9 | Bifuel running Gasoline
10 | Bifuel running Methanol
11 | Bifuel running Ethanol
12 | Bifuel running LPG
13 | Bifuel running CNG
14 | Bifuel running Propane
15 | Bifuel running Electricity
16 | Bifuel running electric and combustion engine
17 | Hybrid gasoline
18 | Hybrid Ethanol
19 | Hybrid Diesel
20 | Hybrid Electric
21 | Hybrid running electric and combustion engine
22 | Hybrid Regenerative
23 | Bifuel running diesel

Any other value is reserved by ISO/SAE. There are currently no definitions for flexible-fuel vehicle.

## Non-standard PIDs

The majority of all OBD-II PIDs in use are non-standard. For most modern vehicles, there are many more functions supported on the OBD-II interface than are covered by the standard PIDs, and there is relatively minor overlap between vehicle manufacturers for these non-standard PIDs.

There is very limited information available in the public domain for non-standard PIDs. The primary source of information on non-standard PIDs across different manufacturers is maintained by the US-based Equipment and Tool Institute and only available to members. The price of ETI membership for access to scan codes varies based on company size defined by annual sales of automotive tools and equipment in North America:

Annual Sales in North America | Annual Dues
Under $10,000,000 | $5,000
$10,000,000 - $50,000,000 | $7,500
Greater than $50,000,000 | $10,000

However, even ETI membership will not provide full documentation for non-standard PIDs. ETI states:

Some OEMs refuse to use ETI as a one-stop source of scan tool information. They prefer to do business with each tool company separately. These companies also require that you enter into a contract with them. The charges vary but here is a snapshot as of April 13th, 2015 of the per year charges:

GM | $50,000
Honda | $5,000
Suzuki | $1,000
BMW | $25,500 plus $2,000 per update. Updates occur annually.

## CAN (11-bit) bus format

As defined in ISO 15765-4, emissions protocols (including OBD-II, EOBD, UDS, etc.) use the ISO-TP transport layer (ISO 15765-2). All CAN frames sent using ISO-TP use a data length of 8 bytes (and DLC of 8). It is recommended to pad the unused data bytes with 0xCC.

The PID query and response occurs on the vehicle's CAN bus. Standard OBD requests and responses use functional addresses. The diagnostic reader initiates a query using CAN ID 7DFh, which acts as a broadcast address, and accepts responses from any ID in the range 7E8h to 7EFh. ECUs that can respond to OBD queries listen both to the functional broadcast ID of 7DFh and one assigned ID in the range 7E0h to 7E7h. Their response has an ID of their assigned ID plus 8 e.g. 7E8h through 7EFh.

This approach allows up to eight ECUs, each independently responding to OBD queries. The diagnostic reader can use the ID in the ECU response frame to continue communication with a specific ECU. In particular, multi-frame communication requires a response to the specific ECU ID rather than to ID 7DFh.

CAN bus may also be used for communication beyond the standard OBD messages. Physical addressing uses particular CAN IDs for specific modules (e.g., 720h for the instrument cluster in Fords) with proprietary frame payloads.

### Query

The functional PID query is sent to the vehicle on the CAN bus at ID 7DFh, using 8 data bytes. The bytes are:

| Byte
PID Type | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
SAE Standard | Number of; additional; data bytes:; 2 | Service; 01 = show current data;; 02 = freeze frame;; etc. | PID code; (e.g.: 05 = Engine coolant temperature) | not used; (ISO 15765-2 suggests CCh)
Vehicle specific | Number of; additional; data bytes:; 3 | Custom service: (e.g.: 22 = enhanced data) | PID code; (e.g.: 4980h) | not used; (ISO 15765-2 suggests CCh)

### Response

The vehicle responds to the PID query on the CAN bus with message IDs that depend on which module responded. Typically the engine or main ECU responds at ID 7E8h. Other modules, like the hybrid controller or battery controller in a Prius, respond at 07E9h, 07EAh, 07EBh, etc. These are 8h higher than the physical address the module responds to. Even though the number of bytes in the returned value is variable, the message uses 8 data bytes regardless (CAN bus protocol form Frameformat with 8 data bytes).
The bytes are:

| Byte
CAN Address | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
SAE Standard; 7E8h, ; 7E9h, ; 7EAh, ; etc. | Number of; additional; data bytes:; 3 to 6 | Custom service; Same as query, except that 40h is added to the service value. So:; 41h = show current data;; 42h = freeze frame;; etc. | PID code; (e.g.: 05 = Engine coolant temperature) | value of the specified parameter, byte 0 | value, byte 1 (optional) | value, byte 2 (optional) | value, byte 3 (optional) | not used; (may be 00h or 55h)
Vehicle specific; 7E8h, or 8h + physical ID of module. | Number of; additional; data bytes:; 4to 7 | Custom service: same as query, except that 40h is added to the service value.(e.g.: 62h = response to service 22h request) | PID code; (e.g.: 4980h) | value of the specified parameter, byte 0 | value, byte 1 (optional) | value, byte 2 (optional) | value, byte 3 (optional)
Vehicle specific; 7E8h, or 8h + physical ID of module. | Number of; additional; data bytes:; 3 | 7Fh this a general response usually indicating the module doesn't recognize the request. | Custom service: (e.g.: 22h = enhanced diagnostic data by PID, 21h = enhanced data by offset) | 31h | not used; (may be 00h)
