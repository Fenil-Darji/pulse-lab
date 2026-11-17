# Phone Vitals Lab

A single web page that uses the sensors already in a phone (camera, microphone, speaker and motion sensors) to check:

| Tab | What it checks | Phone part used |
|---|---|---|
| Pulse | Heart rate from the fingertip | Camera and flash |
| Breathing | Breathing rate | Motion sensors, speaker-and-microphone sonar |
| Posture | Sitting posture | Front camera |
| Sleep | Overnight snoring and pauses in breathing, STOP-Bang questionnaire | Microphone |
| Cough | Cough counter with day-by-day history, TB symptom check, child breathing count | Microphone, touch |
| Hearing | Quietest beep each ear hears at five pitches, WHO grade against a reference listener | Speaker or earphones |
| Vision | Tumbling E distance and near vision, colour plates, Amsler grid | Screen |
| Movement | Chair stand, balance, walking, Timed Up and Go, hand tremor | Motion sensors |

Open it at https://fenil-darji.github.io/pulse-lab/ . Everything runs on the phone; readings stay there unless you share them.

This is a learning tool, not a medical device. Each tab explains how it works and where it falls short.

## Tests

The signal processing for Sleep, Cough, Hearing, Vision and Movement is checked against made-up recordings:

```
node tests/run.js
```
