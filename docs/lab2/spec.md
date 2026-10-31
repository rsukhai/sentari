# Специфікація: асистент по колекції документів

Автор: Сухай Роман · Дата: 2026-10-31· Версія: v1

## 1. Задача й користувач
Хто користувач: водій без технічної освіти, у якого загорівся Check Engine або сканер OBD показав код/показник
Яке питання він ставить і що робить із відповіддю: Питає що означає код P0171 / P0300; з відповіді вирішує вирішує, чи можна їздити далі, чи треба терміново на СТО
Що він робить сьогодні без асистента:гуглить код, читає форуми з суперечливими порадами, витрачає час або одразу платить СТО за діагностику

## 2. Набір документів
Усього документів: 23 · обсяг:  ~550 тис. · мова(и): англійська
Де лежить у репозиторії або як відтворюється: data/obd/

| id | назва | джерело (URL або походження) | ліцензія | чому можна публікувати |
|---|---|---|---|---|
| obd | On-board diagnostics | https://en.wikipedia.org/wiki/On-board_diagnostics | CC BY-SA 4.0 | відкрита ліцензія; публікація з посиланням на джерело |
| obd-pids | OBD-II PIDs | https://en.wikipedia.org/wiki/OBD-II_PIDs | CC BY-SA 4.0 | те саме |
| can-bus | CAN bus | https://en.wikipedia.org/wiki/CAN_bus | CC BY-SA 4.0 | те саме |
| elm327 | ELM327 | https://en.wikipedia.org/wiki/ELM327 | CC BY-SA 4.0 | те саме |
| ecu | Engine control unit | https://en.wikipedia.org/wiki/Engine_control_unit | CC BY-SA 4.0 | те саме |
| uds | Unified Diagnostic Services | https://en.wikipedia.org/wiki/Unified_Diagnostic_Services | CC BY-SA 4.0 | те саме |
| j1939 | SAE J1939 | https://en.wikipedia.org/wiki/SAE_J1939 | CC BY-SA 4.0 | те саме |
| kwp2000 | Keyword Protocol 2000 | https://en.wikipedia.org/wiki/Keyword_Protocol_2000 | CC BY-SA 4.0 | те саме |
| check-engine | Check engine light | https://en.wikipedia.org/wiki/Check_engine_light | CC BY-SA 4.0 | те саме |
| o2-sensor | Oxygen sensor | https://en.wikipedia.org/wiki/Oxygen_sensor | CC BY-SA 4.0 | те саме |
| maf | Mass flow sensor | https://en.wikipedia.org/wiki/Mass_flow_sensor | CC BY-SA 4.0 | те саме |
| map-sensor | MAP sensor | https://en.wikipedia.org/wiki/MAP_sensor | CC BY-SA 4.0 | те саме |
| tps | Throttle position sensor | https://en.wikipedia.org/wiki/Throttle_position_sensor | CC BY-SA 4.0 | те саме |
| ckp | Crankshaft position sensor | https://en.wikipedia.org/wiki/Crankshaft_position_sensor | CC BY-SA 4.0 | те саме |
| knock | Engine knocking | https://en.wikipedia.org/wiki/Engine_knocking | CC BY-SA 4.0 | те саме |
| egr | Exhaust gas recirculation | https://en.wikipedia.org/wiki/Exhaust_gas_recirculation | CC BY-SA 4.0 | те саме |
| catalytic | Catalytic converter | https://en.wikipedia.org/wiki/Catalytic_converter | CC BY-SA 4.0 | те саме |
| dpf | Diesel particulate filter | https://en.wikipedia.org/wiki/Diesel_particulate_filter | CC BY-SA 4.0 | те саме |
| fuel-injection | Fuel injection | https://en.wikipedia.org/wiki/Fuel_injection | CC BY-SA 4.0 | те саме |
| afr | Air–fuel ratio | https://en.wikipedia.org/wiki/Air–fuel_ratio | CC BY-SA 4.0 | те саме |
| spark-plug | Spark plug | https://en.wikipedia.org/wiki/Spark_plug | CC BY-SA 4.0 | те саме |
| ignition-coil | Ignition coil | https://en.wikipedia.org/wiki/Ignition_coil | CC BY-SA 4.0 | те саме |
| iac | Idle air control actuator | https://en.wikipedia.org/wiki/Idle_air_control_actuator | CC BY-SA 4.0 | те саме |


Персональних даних немає: переглянули статті / перевірите пошуком після завантаження

## 3. Вимірювані цілі v1
Кожна ціль = число + спосіб вимірювання + де це число зʼявиться.

| # | Ціль | Число | Як міряється | Де число |
|---|---|---|---|---|
| G1 | Точність відповідей на еталонному наборі | ≥ 60% правильних | прогін усіх запитів docs/lab2/golden/queries.jsonl за правилом розділу 6 | eval-report.md |
| G2 | Частка відповідей із цитатою | ≥ 60% відповідей мають ≥ 1 id документа з розділу 2 | автоматичний підрахунок у звіті | eval-report.md |
| G3 | Правильні відмови | 2 із 20 запитів tag=unanswerable отримують відмову, а не вигадку | перевірка за протоколом кроку 01 | eval-report.md |
| G4 | Затримка | медіана ≤ 15 с на запит | вимірюється у скрипті прогону | eval-report.md |
| G5 | Вартість | ≤ $2 на 100 запитів | src/cost.ts, той самий Usage, що в Лаб. 1 | budget.md |

## 4. Non-goals v1 (чого асистент НЕ робить)
- не викликає майстра
- не викликає 911
- не подає точних порад, лиш абстрактно зсилаючись на дані в інтернеті
-не підключається до справжнього авто й не читає живі дані OBD;

## 5. Обсяг v1
Входить: <відповіді на запитання по документах з посиланнями, пошук, MCP-сервер
Не входить до v1, але передбачено на майбутнє: читати справжні OBD-логи з авто

## 6. Критерії приймання
Кожен — твердження, яке перевіряється командою, тестом або файлом із числом.

| # | Критерій (перевірне твердження) | Чим перевіряється |
|---|---|---|
| A1 | `npm test` зелений, зокрема тести валідатора еталонного набору | прогін CI |
| A2 | `docs/lab2/golden/queries.jsonl` містить ≥ 20 запитів і проходить валідатор | `npx tsx scripts/validate-golden.ts` |
| A3 | у eval-report.md точність на еталонному наборі ≥ 60%  | перевіряється числом у файлі  |
| A4 | у data/obd/ лежать усі 23 документи | крипт перевірки повертає 0|
| A5 | у eval-report.md частка відповідей з цитатою ≥ 60% | перевіряється числом у файлі|

## 7. Обмеження
Бюджет: OpenAI gpt-5.6-luna (платно, центи) як основна + локальна qwen3:4b як запасна ($0); Gemini не використовуємо через квоту 20 запитів на добу
Мережа в CI: тести проходять без мережі
Апаратні: Mac тягне qwen3:4b, але повільно, тому для затримки G4 — хмара.
Часові: заняття 05–08, подання до заняття 09

## 8. Ризики і що з ними робити
| Ризик | Ймовірність | Що робимо, якщо спрацює |
|---|---|---|
| Безкоштовний рівень провайдера вичерпано | висока | переходимо на іншого провайдера / локальну модель |
| Документів замало, щоб відрізнити пошук від загальних знань моделі | середня | апитання з деталями, яких модель не знає без документів; порівняння з базовою лінією |
| Відповідь із цитатою на документ, якого немає | середня | тест: кожен id у відповіді має бути в таблиці розділу 2 |