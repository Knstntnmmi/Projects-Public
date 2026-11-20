# A sample scorecard from invented events

Generated from the code by `npm run generate`. Do not edit by hand.

Every event below is invented for this example, and none is anyone's life. The chart is the constructed moment `j2000` of `fixtures/moments.ts` (the J2000.0 epoch at Greenwich), which is no person's birth. The events are fixed numbers of days from that moment, and two of them fall before the first freeze, so they are listed as frozen too late.

## How it was made

Two forecasts were frozen for the constructed moment, with the default settings and no sex convention: the years 2026 to 2035 at 2026-01-04, and the years 2026 to 2030 at 2030-02-12. The fourteen invented events were then counted against them. An event is counted against the earliest forecast that was frozen before it and covers its dates, so the second forecast is listed but no event needed it. The command line freezes at the time you run it, so a session of your own cannot be frozen in the past; here the freeze times are set in the generator.

The invented events:

| Event | Dates it covers | Topic | How it went |
| --- | --- | --- | --- |
| e1 | 2025-06-18 | wealth | went well |
| e2 | 2025-10 | career | went badly |
| e3 | 2026-06-03 | wealth | went well |
| e4 | 2027-02-08 | wealth | went badly |
| e5 | 2027-10 | career | went well |
| e6 | 2028-06-22 | wealth | went well |
| e7 | 2029-02-27 | health | went badly |
| e8 | 2029 | wealth | went badly |
| e9 | 2030-07-12 | career | went well |
| e10 | 2031-03-19 | wealth | went well |
| e11 | 2031-11 | relationships | went badly |
| e12 | 2032-07-31 | wealth | went badly |
| e13 | 2033-05-27 | career | went badly |
| e14 | 2034-03-23 | wealth | went well |

## The scorecard

This is what `overlay score --session <file>` prints for that session.

```text
14 events recorded. 2 frozen forecasts.
These counts describe this reader's recorded events only.

Scorecard

Events
  e1  2025-06-18  wealth  went well  frozen too late: every forecast was frozen after this event, so it is not counted
  e2  2025-10  career  went badly  frozen too late: every forecast was frozen after this event, so it is not counted
  e3  2026-06-03  wealth  went well  scored
  e4  2027-02-08  wealth  went badly  scored
  e5  2027-10  career  went well  scored
  e6  2028-06-22  wealth  went well  scored
  e7  2029-02-27  health  went badly  scored
  e8  2029  wealth  went badly  scored
  e9  2030-07-12  career  went well  scored
  e10  2031-03-19  wealth  went well  scored
  e11  2031-11  relationships  went badly  scored
  e12  2032-07-31  wealth  went badly  scored
  e13  2033-05-27  career  went badly  scored
  e14  2034-03-23  wealth  went well  scored

12 events were scored against a forecast frozen before them.

Counts
  held 35, did not hold 32, not scored 153, said nothing 42
  Not scored: 15 mixed statement, 90 note without a direction, 48 natal statement without dates.

By technique
                                                 held  did not hold  not scored  said nothing
  natal chart                                    0     0             48          0
  BaZi luck pillar (BaZi)                        0     0             0           12
  BaZi year pillar (BaZi)                        8     5             0           5
  Vedic mahadasha (Vedic astrology)              0     0             10          2
  Vedic antardasha (Vedic astrology)             5     9             2           4
  Saturn from the Moon (Vedic astrology)         3     2             0           7
  Jupiter from the Moon (Vedic astrology)        5     2             0           7
  Western annual profection (Western astrology)  14    14            68          0
  Western solar return (Western astrology)       0     0             25          1
  Western transits (Western astrology)           0     0             0           4

By tradition
                     held  did not hold  not scored  said nothing
  BaZi               8     5             11          17
  Vedic astrology    13    13            22          20
  Western astrology  14    14            120         5

By rule
                                                                     held  did not hold  not scored  said nothing
  bazi.topic-career-promise (natal chart)                            0     0             3           0
  bazi.topic-health (natal chart)                                    0     0             1           0
  bazi.topic-wealth-promise (natal chart)                            0     0             7           0
  bazi.fan-yin-fu-yin (BaZi year pillar)                             1     0             0           0
  bazi.output-in-luck (BaZi year pillar)                             3     3             0           0
  bazi.peer-in-luck (BaZi year pillar)                               3     1             0           0
  bazi.wealth-star-in-luck (BaZi year pillar)                        1     1             0           0
  parashari.yogakaraka-kendra-trikona (natal chart)                  0     0             10          0
  parashari.dasha-lord-placement-natal (Vedic mahadasha)             0     0             10          0
  parashari.antardasha-from-dasha-lord-kendra (Vedic antardasha)     3     5             0           0
  parashari.antardasha-lord-strength (Vedic antardasha)              1     3             2           0
  parashari.wealth-5-9-lord-dasha (Vedic antardasha)                 1     1             0           0
  parashari.saturn-8th-from-moon (Saturn from the Moon)              2     1             0           0
  parashari.saturn-transit-other (Saturn from the Moon)              1     1             0           0
  parashari.jupiter-transit-good (Jupiter from the Moon)             1     0             0           0
  parashari.jupiter-transit-other (Jupiter from the Moon)            4     2             0           0
  lilly.career.honour-angularity (natal chart)                       0     0             3           0
  lilly.career.honour-essential (natal chart)                        0     0             3           0
  lilly.wealth.durability.infortune-weak (natal chart)               0     0             7           0
  lilly.wealth.life-phase (natal chart)                              0     0             7           0
  lilly.wealth.promise-weak.all (natal chart)                        0     0             7           0
  bonatti.profection.topic-significator (Western annual profection)  0     0             24          0
  lilly.profection.fortune-sign-wealth (Western annual profection)   7     8             1           0
  lilly.profection.house-health (Western annual profection)          1     0             0           0
  lilly.profection.house-loss (Western annual profection)            1     1             0           0
  lilly.profection.house-money (Western annual profection)           1     1             2           0
  lilly.profection.lord-condition (Western annual profection)        2     0             0           0
  lilly.profection.mc-career (Western annual profection)             2     4             0           0
  valens.transmission.topic-start (Western annual profection)        0     0             41          0
  lilly.revolution.lord2-fortune-house (Western solar return)        0     0             24          0
  lilly.revolution.seventh-asc (Western solar return)                0     0             1           0

By shared clock
  Techniques that count from the birth moment by fixed arithmetic (the luck pillar, the year pillar, the dashas, the profections, the firdaria and the solar return) share one clock, so they are also shown here once, as one group.
  In the group here: BaZi luck pillar, BaZi year pillar, Vedic mahadasha, Vedic antardasha, Western annual profection, Western solar return.
                           held  did not hold  not scored  said nothing
  The group, counted once  27    28            105         0

Compared with shuffled dates
  With the dates shuffled, the held count was at least as high in 474 of 1000 runs. Here the held count is 35 of 67 scored pairs.
  Each run moves all the events together by one random number of whole days, round the span of the forecast, and counts the held pairs again against the same forecast. 1000 runs, seed 1.

Read this with care
  Events people record are not a random sample.
  The rules were not tuned to your events, but you may have chosen what to enter after seeing forecasts, which is why a forecast counts against an event only if it was frozen before the event's date.
  This is retrodiction unless the forecasts were frozen first.
  A hit rate does not tell you how the next call turns out.
  Lackner describes, in his lecture of 6 June 2017, at 1:01, a diary in which a space was left to check an oracle later. The scorecard is the project's own design.
  Lackner (2021) writes that a forecaster whose forecast fails usually faces no consequence, and that errors are admitted in form while the core claim is rarely questioned.
```

## How to read it

A statement is held when it points the way the event went (supports with "went well", cautions with "went badly") and did not hold when it points the other way. Mixed statements, notes without a direction and natal statements are not scored. A technique with rules for the topic and no statement over the event's dates said nothing. The counts describe these invented events and nothing else.
