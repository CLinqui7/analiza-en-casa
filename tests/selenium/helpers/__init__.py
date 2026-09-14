"""Geometry-only Selenium adapter, replacing the known V18 adapter.

No DOM click, event dispatch, forced focus, CSS removal or disabled-control bypass.
The existing native clear/send_keys and W3C pointer click remain in use.
"""
from __future__ import annotations

import json
from selenium.common.exceptions import StaleElementReferenceException, TimeoutException
from selenium.webdriver import ActionChains
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support.ui import WebDriverWait

SCROLL_JS = """
const el = arguments[0];
if (!el || !el.isConnected) return false;
el.scrollIntoView({block: 'center', inline: 'center', behavior: 'instant'});
return true;
"""

PROBE_JS = """
const el = arguments[0];
if (!el || !el.isConnected) return {connected: false};
const r = el.getBoundingClientRect();
const rect = {left:r.left, top:r.top, right:r.right, bottom:r.bottom,
              width:r.width, height:r.height};
const x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2;
const vw = window.innerWidth, vh = window.innerHeight;
const inViewport = x >= 0 && y >= 0 && x < vw && y < vh;
const describe = node => node ? {tag:node.tagName, id:node.id || '',
  className:typeof node.className === 'string' ? node.className : '',
  action:node.getAttribute('data-action-id') || ''} : null;
const ancestors = [];
let clipLeft=0, clipTop=0, clipRight=vw, clipBottom=vh;
const viewportRoots = new Set([document.scrollingElement, document.documentElement, document.body]);
for (let node=el.parentElement;node;node=node.parentElement) {
  const s=getComputedStyle(node), a=node.getBoundingClientRect();
  const clipX=/(auto|scroll|hidden|clip)/.test(s.overflowX);
  const clipY=/(auto|scroll|hidden|clip)/.test(s.overflowY);
  const isViewportRoot=viewportRoots.has(node);
  if(clipX || clipY || node.scrollHeight>node.clientHeight+1) {
    ancestors.push({...describe(node), top:a.top, bottom:a.bottom,
      scrollTop:node.scrollTop, scrollLeft:node.scrollLeft,
      clientHeight:node.clientHeight, scrollHeight:node.scrollHeight,
      overflowX:s.overflowX, overflowY:s.overflowY, behavior:s.scrollBehavior,
      isViewportRoot});
  }
  // CSSOM View delegates document scrolling to the viewport.  The geometry of
  // HTML/BODY can move with that scroll and must not shrink the viewport clip.
  // Only non-root ancestors are real element clipping boundaries.
  if (!isViewportRoot && clipX) {clipLeft=Math.max(clipLeft,a.left+node.clientLeft);
                                  clipRight=Math.min(clipRight,a.left+node.clientLeft+node.clientWidth);}
  if (!isViewportRoot && clipY) {clipTop=Math.max(clipTop,a.top+node.clientTop);
                                  clipBottom=Math.min(clipBottom,a.top+node.clientTop+node.clientHeight);}
}
const hit=inViewport?document.elementFromPoint(x,y):null;
const inClip=x>=clipLeft && x<clipRight && y>=clipTop && y<clipBottom;
const style=getComputedStyle(el);
return {connected:true, target:describe(el), rect, x, y,
  viewport:{width:vw,height:vh,outerWidth:window.outerWidth,outerHeight:window.outerHeight},
  visualViewport:window.visualViewport?{width:visualViewport.width,height:visualViewport.height,
    offsetTop:visualViewport.offsetTop,offsetLeft:visualViewport.offsetLeft,scale:visualViewport.scale}:null,
  clip:{left:clipLeft,top:clipTop,right:clipRight,bottom:clipBottom}, inViewport, inClip,
  disabled:Boolean(el.disabled), display:style.display, visibility:style.visibility,
  hit:describe(hit), hitIsTarget:Boolean(hit&&(hit===el||el.contains(hit))), ancestors};
"""


def _install() -> None:
    if getattr(WebElement, '_analiza_geometry_checked', False):
        return
    # Installed in a fresh Python process. Do not wrap a second unknown adapter.
    if getattr(WebElement, '_analiza_nested_scroll_patch', False):
        raise RuntimeError('An older Analiza adapter was loaded in this process; restart the test process.')
    native_click = WebElement.click
    native_clear, native_keys = WebElement.clear, WebElement.send_keys

    def position(element: WebElement) -> dict:
        driver = element._parent
        if not driver.execute_script(SCROLL_JS, element):
            raise StaleElementReferenceException('Target detached before scrolling')
        previous = None
        stable = 0
        scroll_attempts = 1
        last = {}

        def ready(_):
            nonlocal previous, stable, scroll_attempts, last
            last = driver.execute_script(PROBE_JS, element)
            if not last.get('connected'):
                raise StaleElementReferenceException('Target detached during geometry check')
            r=last['rect']
            signature=[r[k] for k in ('left','top','right','bottom')]
            signature += [v for a in last['ancestors'] for v in (a['scrollTop'],a['scrollLeft'])]
            same=previous is not None and len(signature)==len(previous) and all(abs(a-b)<0.5 for a,b in zip(signature,previous))
            stable=stable+1 if same else 0
            previous=signature
            if not last['inViewport'] or not last['inClip']:
                # A tab change may finish after the first scroll. Recenter only
                # after geometry settles, never repeatedly fighting scrolling.
                if stable>=2 and scroll_attempts<3:
                    driver.execute_script(SCROLL_JS,element)
                    scroll_attempts+=1
                    stable=0
                return False
            usable=r['width']>0 and r['height']>0 and last['visibility']=='visible' and last['display']!='none'
            return last if usable and stable>=2 and last['hitIsTarget'] else False
        try:
            return WebDriverWait(driver,12,poll_frequency=0.05).until(ready)
        except TimeoutException as exc:
            # Deliberately preserve failure if a real overlay/clip remains.
            raise TimeoutException('ANALIZA_GEOMETRY_NOT_READY '+json.dumps(last,ensure_ascii=True)) from exc

    def click(element: WebElement) -> None:
        if element.tag_name.lower() == 'option':
            # Native <select> options are not ordinary DOM pointer targets.
            from selenium.webdriver.common.by import By
            parent = element.find_element(By.XPATH, 'ancestor::select[1]')
            position(parent)
            native_click(element)
            return
        state=position(element)
        if state['disabled']:
            raise RuntimeError('Disabled control: no click was issued')
        # Exactly one native pointer click. No retry of potentially mutating operations.
        ActionChains(element._parent).move_to_element(element).click().perform()

    def clear(element: WebElement) -> None:
        position(element)
        native_clear(element)

    def send_keys(element: WebElement, *value: str) -> None:
        if element.tag_name.lower() == 'input' and element.get_attribute('type') == 'file':
            native_keys(element,*value)
            return
        position(element)
        native_keys(element,*value)

    WebElement.click=click
    WebElement.clear=clear
    WebElement.send_keys=send_keys
    WebElement._analiza_geometry_checked=True
    WebElement._analiza_nested_scroll_patch=True


_install()
