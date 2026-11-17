#!/usr/bin/env python3
"""Rebuilds index.html from the published v4 page plus the parts in this folder.
Run from the repository root:  python3 src/build.py
This folder exists only on the work branch; the finished index.html is self-contained."""
import os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
SECTIONS = [('sleep', 'Sleep'), ('cough', 'Cough'), ('hearing', 'Hearing'), ('vision', 'Vision'), ('movement', 'Movement')]

def read(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return f.read()

def have(name):
    return os.path.exists(os.path.join(SRC, name))

base = subprocess.run(['git', '-C', ROOT, 'show', '9985344:index.html'], capture_output=True, text=True, check=True).stdout
present = [s for s in SECTIONS if have('panel-%s.html' % s[0])]

def swap(text, old, new, count=1):
    if text.count(old) != count:
        sys.exit('build: expected %d match(es) for %r, found %d' % (count, old[:60], text.count(old)))
    return text.replace(old, new)

html = base
html = swap(html, 'Phone sensing · version 4', 'Phone sensing · version 5')
html = swap(html,
    '<p class="lede">Measure your pulse with the camera, your breathing with the motion sensors and a speaker-and-microphone sonar, and keep your posture in check with the front camera of any phone or laptop.</p>',
    '<p class="lede">Check pulse, breathing, posture, sleep, cough, hearing, vision and movement with the camera, microphone, speaker and motion sensors already in a phone. Readings stay on this device unless you share them.</p>')

nav = ''.join('\n    <button type="button" role="tab" id="tab%s" aria-controls="panel%s" aria-selected="false" tabindex="-1">%s</button>' % (lab, lab, lab) for _, lab in present)
html = swap(html, '>Posture</button>\n  </nav>', '>Posture</button>' + nav + '\n  </nav>')

entries = ''.join(",\n    { btn: $('#tab%s'), panel: $('#panel%s'), hash: '%s' }" % (lab, lab, h) for h, lab in present)
html = swap(html, "{ btn: $('#tabPosture'), panel: $('#panelPosture'), hash: 'posture' }\n  ];",
            "{ btn: $('#tabPosture'), panel: $('#panelPosture'), hash: 'posture' }" + entries + "\n  ];")
html = swap(html, "$('#logSection').hidden = i === 2;", "$('#logSection').hidden = i >= 2;")
html = swap(html, "      else if (window.FPLUI.redrawPosture) window.FPLUI.redrawPosture();",
            "      else if (i === 2) { if (window.FPLUI.redrawPosture) window.FPLUI.redrawPosture(); }\n"
            "      else document.dispatchEvent(new CustomEvent('vx:tab', { detail: tabs[i].hash }));")

html = swap(html, '</style>', read('extra.css') + '</style>')
panels = ''.join(read('panel-%s.html' % h) + '\n' for h, _ in present)
html = swap(html, '  <section class="log" id="logSection">', panels + '  <section class="log" id="logSection">')
html = swap(html, '<script>\n// DSP-START', read('overlays.html') + '\n<script>\n// DSP-START')

scripts = '<script>\n// VX-START\n' + read('core.js') + '// VX-END\n</script>\n<script>\n' + read('ui-shared.js') + '</script>\n'
for h, _ in present:
    scripts += '<script>\n' + read('ui-%s.js' % h) + '</script>\n'
html = swap(html, '</body>', scripts + '</body>')

with open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(html)
print('built index.html: %d bytes, sections: %s' % (len(html.encode()), ', '.join(h for h, _ in present) or 'none'))
