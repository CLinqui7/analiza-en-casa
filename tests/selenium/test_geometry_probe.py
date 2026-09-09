"""Focused non-browser tests for the Selenium geometry probe.

The fixture evaluates the exact JavaScript sent to WebDriver against small DOM
models.  It protects the viewport-root exception without relaxing real clipping
or hit-testing checks.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import unittest

from helpers import PROBE_JS


NODE_HARNESS = r'''
const vm = require('vm');
const fixture = JSON.parse(process.argv[1]);
function rect(values) {
  return {left: values.left, top: values.top, right: values.right,
    bottom: values.bottom, width: values.right - values.left,
    height: values.bottom - values.top};
}
const nodes = {};
for (const spec of fixture.nodes) {
  nodes[spec.name] = {
    tagName: spec.tag || 'DIV', id: spec.id || '', className: spec.className || '',
    parentElement: null, isConnected: true, disabled: false,
    scrollHeight: spec.scrollHeight ?? 0, clientHeight: spec.clientHeight ?? 0,
    scrollTop: spec.scrollTop ?? 0, scrollLeft: spec.scrollLeft ?? 0,
    clientWidth: spec.clientWidth ?? fixture.width, clientLeft: spec.clientLeft ?? 0,
    clientTop: spec.clientTop ?? 0,
    getBoundingClientRect: () => rect(spec.rect),
    getAttribute: () => '',
    contains: other => other === nodes[spec.name],
    _style: spec.style || {overflowX: 'visible', overflowY: 'visible',
      scrollBehavior: 'auto', display: 'block', visibility: 'visible'},
  };
}
for (const spec of fixture.nodes) {
  nodes[spec.name].parentElement = spec.parent ? nodes[spec.parent] : null;
}
const context = {
  arguments: [nodes[fixture.target]],
  window: {innerWidth: fixture.width, innerHeight: fixture.height,
    outerWidth: fixture.width, outerHeight: fixture.height, visualViewport: null},
  document: {scrollingElement: nodes[fixture.scrollingElement],
    documentElement: nodes.html, body: nodes.body,
    elementFromPoint: () => nodes[fixture.hit]},
  getComputedStyle: node => node._style,
  Set, Boolean, Math,
};
const probe = new vm.Script('(function() {' + process.argv[2] + '\n}).apply(null, arguments)').runInNewContext(context);
process.stdout.write(JSON.stringify(probe));
'''


class GeometryProbeTests(unittest.TestCase):
    maxDiff = None

    def probe(self, nodes: list[dict], target: str, hit: str = 'target') -> dict:
        node = shutil.which('node.exe') or shutil.which('node')
        self.assertIsNotNone(node, 'Node is required for the isolated geometry-probe test')
        fixture = {
            'width': 390,
            'height': 844,
            'scrollingElement': 'html',
            'target': target,
            'hit': hit,
            'nodes': nodes,
        }
        completed = subprocess.run(
            [node, '-e', NODE_HARNESS, json.dumps(fixture), PROBE_JS],
            capture_output=True, text=True, encoding='utf-8', check=False,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        return json.loads(completed.stdout)

    @staticmethod
    def document_nodes(target_rect: dict) -> list[dict]:
        root_style = {'overflowX': 'auto', 'overflowY': 'auto', 'scrollBehavior': 'auto',
                      'display': 'block', 'visibility': 'visible'}
        return [
            {'name': 'html', 'tag': 'HTML', 'rect': {'left': 0, 'top': -1200, 'right': 390, 'bottom': -356},
             'clientWidth': 390, 'clientHeight': 844, 'scrollHeight': 3000, 'scrollTop': 1200, 'style': root_style},
            {'name': 'body', 'tag': 'BODY', 'parent': 'html',
             'rect': {'left': 0, 'top': -1200, 'right': 390, 'bottom': -356},
             'clientWidth': 390, 'clientHeight': 844, 'scrollHeight': 3000, 'scrollTop': 1200, 'style': root_style},
            {'name': 'target', 'tag': 'BUTTON', 'parent': 'body', 'rect': target_rect,
             'clientWidth': 80, 'clientHeight': 40},
        ]

    def test_document_scroll_keeps_the_layout_viewport_as_the_clip(self) -> None:
        result = self.probe(self.document_nodes({'left': 20, 'top': 300, 'right': 100, 'bottom': 340}), 'target')
        self.assertTrue(result['inViewport'])
        self.assertTrue(result['inClip'])
        self.assertEqual(result['clip'], {'left': 0, 'top': 0, 'right': 390, 'bottom': 844})
        self.assertTrue(all(item['isViewportRoot'] for item in result['ancestors']))

    def test_internal_overflow_clip_is_still_enforced(self) -> None:
        nodes = self.document_nodes({'left': 20, 'top': 300, 'right': 100, 'bottom': 340})
        nodes[-1]['parent'] = 'scroller'
        nodes.insert(-1, {'name': 'scroller', 'parent': 'body',
            'rect': {'left': 0, 'top': 0, 'right': 390, 'bottom': 200},
            'clientWidth': 390, 'clientHeight': 200, 'scrollHeight': 600,
            'style': {'overflowX': 'visible', 'overflowY': 'hidden', 'scrollBehavior': 'auto',
                      'display': 'block', 'visibility': 'visible'}})
        result = self.probe(nodes, 'target')
        self.assertTrue(result['inViewport'])
        self.assertFalse(result['inClip'])
        self.assertEqual(result['clip']['bottom'], 200)

    def test_topmost_overlay_still_blocks_the_target_hit_test(self) -> None:
        nodes = self.document_nodes({'left': 20, 'top': 300, 'right': 100, 'bottom': 340})
        nodes.append({'name': 'overlay', 'tag': 'DIV',
            'rect': {'left': 0, 'top': 0, 'right': 390, 'bottom': 844},
            'clientWidth': 390, 'clientHeight': 844})
        result = self.probe(nodes, 'target', hit='overlay')
        self.assertTrue(result['inClip'])
        self.assertFalse(result['hitIsTarget'])
        self.assertEqual(result['hit']['tag'], 'DIV')


if __name__ == '__main__':
    unittest.main()
