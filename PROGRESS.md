# Phone Vitals Lab update: resume checkpoint

Work branch: `claude/vitals-five-sections`. One commit per finished stage, pushed straight away.
If work stops part-way (usage limit, disconnect), resume from the first unticked stage below.
This file is removed when the update is merged to `main`.

- [x] 0. Checkpoint set up (branch, this file, scheduled resume check-ins)
- [x] 1. Shared groundwork: 8-tab navigation, shared helpers
- [x] 2. Sleep section (snoring and breathing-pause screening)
- [x] 3. Cough section (cough counter, TB symptom screen, child fast-breathing counter)
- [x] 4. Hearing section (pure-tone screening per ear)
- [x] 5. Vision section (tumbling E distance and near, colour, Amsler grid)
- [ ] 6. Movement section (tremor, balance, walking, chair-stand fall risk)
- [ ] 7. Whole-page test in headless Chrome, merge to main, remove this file

Notes for whoever resumes:
- index.html is generated: edit the parts in `src/` and run `python3 src/build.py` (base = commit 9985344, the published v4 page).
- Each section = `src/panel-<name>.html` + `src/ui-<name>.js` + a block in `src/core.js` before the `//@@SECTIONS@@` marker. A section appears as a tab once its panel file exists.
- Tests: `node src/test-core.js` (signal processing). `src/` and this file are deleted in the final merge commit.
