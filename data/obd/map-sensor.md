---
id: map-sensor
title: MAP sensor
source: https://en.wikipedia.org/wiki/MAP_sensor
revision: https://en.wikipedia.org/w/index.php?oldid=1342552674
fetched: 2026-10-31
license: CC BY-SA 4.0 (Wikipedia contributors)
---

# MAP sensor

Sensor in an internal combustion engine's electronic control system

MAP sensor
Manifold pressure gauge
Uses | Internal combustion engine's electronic control system

The examples and descriptions in this article apply strictly to four-stroke cycle gasoline engines. Other engine types such as diesel, or two-stroke cycle can differ in the exact implementation, but the general ideas still apply.

The manifold absolute pressure sensor (MAP sensor) is one of the sensors used in an internal combustion engine's electronic control system.

Engines that use a MAP sensor are typically fuel injected. The manifold absolute pressure sensor provides instantaneous manifold pressure information to the engine's electronic control unit (ECU). The data is used to calculate air density and determine the engine's air mass flow rate, which in turn determines the required fuel metering for optimum combustion (see stoichiometry) and influence the advance or retard of ignition timing. A fuel-injected engine may alternatively use a mass airflow sensor (MAF sensor) to detect the intake airflow. A typical naturally aspirated engine configuration employs one or the other, whereas forced induction engines typically use both; a MAF sensor on the cold air intake leading to the turbo and a MAP sensor on the intake tract post-turbo before the throttle body on the intake manifold.

MAP sensor data can be converted to air mass data by using a second variable coming from an IAT Sensor (intake air temperature sensor). This is called the speed-density method. Engine speed (RPM) is also used to determine where on a look up table to determine fuelling, hence speed-density (engine speed / air density). The MAP sensor can also be used in OBD II (on-board diagnostics) applications to test the EGR (exhaust gas recirculation) valve for functionality, an application typical in OBD II equipped General Motors engines.

## Example

The following example assumes the same engine speed and air temperature in a naturally aspirated engine.

- Condition 1:

An engine operating at wide open throttle (WOT) on top of a very high mountain has a manifold pressure of about 50 kPa (essentially equal to the barometer at that high altitude).

- Condition 2:

The same engine at sea level will achieve that same 50 kPa (7.25 psi, 14.7 inHG) of manifold pressure at less than (before reaching) WOT due to the higher barometric pressure.

The engine requires the same mass of fuel in both conditions because the mass of air entering the cylinders is the same.

If the throttle is opened all the way in condition 2, the manifold absolute pressure will increase from 50 kPa to nearly 100 kPa (14.5 psi, 29.53 inHG), about equal to the local barometer, which in condition 2 is sea level. The higher absolute pressure in the intake manifold increases the air's density, and in turn more fuel can be burned resulting in higher output.

Another example is varying rpm and engine loads. Where an engine may have 60kPa of manifold pressure at 1800 rpm in an unloaded condition, introducing load with a further throttle opening will change the final manifold pressure to 100kPa, engine will still be at 1800 rpm but its loading will require a different spark and fueling delivery.

## Vacuum comparison

Engine vacuum is the difference between the pressures in the intake manifold and ambient atmospheric pressure. Engine vacuum is a "gauge" pressure, since gauges by nature measure a pressure difference, not an absolute pressure. The engine fundamentally responds to air mass, not vacuum, and absolute pressure is necessary to calculate mass. The mass of air entering the engine is directly proportional to the air density, which is proportional to the absolute pressure, and inversely proportional to the absolute temperature.

Note: Carburetors are largely dependent on air volume flow and vacuum, and neither directly infers mass. Consequently, carburetors are precise, but not accurate fuel metering devices. Carburetors were replaced by more accurate fuel metering methods, such as fuel injection in combination with an air mass flow sensor (MAF).

## EGR testing

With OBD II standards, vehicle manufacturers were required to test the exhaust gas recirculation (EGR) valve for functionality during driving. Some manufacturers use the MAP sensor to accomplish this. In these vehicles, they have a MAF sensor for their primary load sensor. The MAP sensor is then used for rationality checks and to test the EGR valve. The way they do this is during a deceleration of the vehicle when there is low absolute pressure in the intake manifold (i.e., a high vacuum present in the intake manifold relative to the outside air) the powertrain control module (PCM) will open the EGR valve and then monitor the MAP sensor's values. If the EGR is functioning properly, the manifold absolute pressure will increase as exhaust gases enter.

### Common confusion with boost sensors and gauges

MAP sensors measure absolute pressure. Boost sensors or gauges measure the amount of pressure above a set absolute pressure. That set absolute pressure is usually 100 kPa. This is commonly referred to as gauge pressure. Boost pressure is relative to absolute pressure - as one increases or decreases, so does the other. It is a one-to-one relationship with an offset of -100 kPa for boost pressure. Thus, a MAP sensor will always read 100 kPa more than a boost sensor measuring the same conditions. A MAP sensor will never display a negative reading because it is measuring absolute pressure, where zero is the total absence of pressure. Vacuum is measured as a negative pressure relative to normal atmospheric pressure. Vacuum-Boost sensors can display negative readings, indicating vacuum or suction (a condition of lower pressure than the surrounding atmosphere). In forced induction engines (supercharged or turbocharged), a negative boost reading indicates that the engine is drawing air faster than it is being supplied, creating suction. The suction is caused by throttling in spark ignition engines and is not present in diesel engines. This is often called vacuum pressure when referring to internal combustion engines.

In short, in a standard atmosphere most boost sensors will read one atmosphere less than a MAP sensor reads. At sea level one can convert boost to MAP by adding approximately 100 kPa. One can convert from MAP to boost by subtracting 100 kPa.
