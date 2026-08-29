"""Independent, assertion-backed Selenium certification for Cotizaciones."""
# test-id: SEL-QUOTE-NAVIGATION
# test-id: SEL-QUOTE-SEARCH
# test-id: SEL-QUOTE-CREATE
# test-id: SEL-QUOTE-ITEMS
# test-id: SEL-QUOTE-DISCOUNT
# test-id: SEL-QUOTE-DETAIL
# test-id: SEL-QUOTE-EDIT
# test-id: SEL-QUOTE-SEND
# test-id: SEL-QUOTE-REVISION
# test-id: SEL-QUOTE-PRINT
# test-id: SEL-QUOTE-RELATED
# test-id: SEL-QUOTE-MOBILE

from __future__ import annotations

import json
import os
import subprocess
import time
import unittest
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.select import Select
from selenium.webdriver.support.ui import WebDriverWait

from helpers.quote_action_recorder import record_pass, reset


ROOT = Path(__file__).resolve().parents[2]
BASE = os.getenv('SELENIUM_BASE_URL', 'http://127.0.0.1:4174')
SERVER = None


def ready() -> bool:
    try:
        return urlopen(BASE, timeout=1).status < 500  # nosec B310 -- local test server
    except (URLError, TimeoutError, OSError):
        return False


class Quotes(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        global SERVER
        reset()
        if not ready():
            SERVER = subprocess.Popen(
                ['npm.cmd', 'run', 'dev', '--workspace=@analiza/web', '--', '--port', '4174'],
                cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
            )
        for _ in range(60):
            if ready():
                break
            time.sleep(1)
        else:
            raise RuntimeError('El servidor React local no inició en 60 segundos.')
        options = webdriver.ChromeOptions()
        options.add_argument('--headless=new')
        options.add_argument('--window-size=1440,1000')
        options.add_argument('--no-first-run')
        cls.d = webdriver.Chrome(options=options)
        cls.w = WebDriverWait(cls.d, 12)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.d.quit()
        if SERVER is not None:
            SERVER.terminate()
            try:
                SERVER.wait(timeout=10)
            except subprocess.TimeoutExpired:
                SERVER.kill()

    def setUp(self) -> None:
        self.prepare_authenticated_test()

    def reset_mock_state(self) -> None:
        self.d.get(f'{BASE}/login')
        self.w.until(lambda driver: driver.execute_script('return document.readyState') == 'complete')
        self.d.execute_script(
            'localStorage.removeItem("analiza.en.casa.workspace.v2");'
            'localStorage.removeItem("analiza.en.casa.mock-session.v1");',
        )
        self.d.get(f'{BASE}/login')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//label[contains(.,'Correo')]//input")))
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, 'input[type=password]')))

    def login_as(self, email: str, password: str, role: str) -> None:
        email_box = self.w.until(EC.visibility_of_element_located((By.XPATH, "//label[contains(.,'Correo')]//input")))
        email_box.clear(); email_box.send_keys(email)
        password_box = self.d.find_element(By.CSS_SELECTOR, 'input[type=password]')
        password_box.clear(); password_box.send_keys(password)
        self.click('AUTH-LOGIN')
        self.w.until(EC.url_contains('/dashboard'))
        session = self.d.execute_script('return localStorage.getItem("analiza.en.casa.mock-session.v1")')
        self.assertIn(f'"role":"{role}"', session)

    def prepare_authenticated_test(self, email='admin@demo.local', password='demo-admin', role='ADMIN') -> None:
        self.reset_mock_state()
        self.login_as(email, password, role)

    def action(self, action_id: str):
        return self.d.find_element(By.CSS_SELECTOR, f'[data-action-id="{action_id}"]')

    def click(self, action_id: str) -> None:
        self.w.until(EC.element_to_be_clickable((By.CSS_SELECTOR, f'[data-action-id="{action_id}"]'))).click()

    def field(self, label: str):
        dialogs = self.d.find_elements(By.CSS_SELECTOR, '[role="dialog"]')
        scope = dialogs[-1] if dialogs else self.d
        return scope.find_element(By.XPATH, f".//label[contains(normalize-space(.),'{label}')]//*[self::input or self::select or self::textarea]")

    def fill(self, label: str, value: str) -> None:
        control = self.field(label)
        control.clear(); control.send_keys(value)

    def pass_(self, action_id: str, test_id: str, started_at: float) -> None:
        record_pass(action_id, test_id, started_at, self.d.current_url)

    def quotes_ready(self) -> None:
        self.w.until(EC.visibility_of_element_located((By.TAG_NAME, 'h1')))
        self.assertEqual(self.d.find_element(By.TAG_NAME, 'h1').text, 'Cotizaciones')
        self.w.until(EC.presence_of_element_located((By.CSS_SELECTOR, '[data-action-id="QUOTE-SEARCH"]')))

    def snapshot(self) -> dict:
        raw = self.d.execute_script('return localStorage.getItem("analiza.en.casa.workspace.v2")')
        return json.loads(raw)

    def quote_data(self, quote_id: str) -> dict:
        return next(item for item in self.snapshot()['quotes'] if item['id'] == quote_id)

    def open_new_quote(self) -> None:
        self.d.get(f'{BASE}/quotes')
        self.quotes_ready()
        self.click('QUOTE-CREATE')
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="QUOTE-CREATE-SUBMIT"]')))

    def add_line(self, category: str, name: str, quantity='1', price='10', discount='0') -> None:
        self.w.until(EC.element_to_be_clickable((By.XPATH, f"//button[@role='tab' and normalize-space(.)='{category}']"))).click()
        self.fill('Concepto', name); self.fill('Cantidad', quantity)
        self.fill('Precio manual', price); self.fill('Descuento manual', discount)
        self.click('QUOTE-ITEM-ADD')
        self.w.until(EC.visibility_of_element_located((By.XPATH, f"//tbody/tr[contains(.,'{name}')]")))

    def create_fixture(self, marker: str, items=True) -> str:
        """Create through the UI; it is a fixture precondition and never records coverage."""
        self.open_new_quote()
        self.fill('Resumen operativo', marker)
        self.fill('Comentarios', f'Comentario {marker}')
        if items:
            self.add_line('Servicios', f'Servicio {marker}', price='20')
        self.click('QUOTE-CREATE-SUBMIT')
        self.w.until(EC.url_to_be(f'{BASE}/quotes'))
        self.w.until(lambda _: any(q['summary'] == marker for q in self.snapshot()['quotes']))
        return next(q['id'] for q in self.snapshot()['quotes'] if q['summary'] == marker)

    def open_detail(self, quote_id: str) -> None:
        self.d.get(f'{BASE}/quotes')
        self.quotes_ready()
        row = self.w.until(EC.presence_of_element_located((By.XPATH, f"//tbody/tr[td[contains(.,'{quote_id}')]]")))
        row.find_element(By.CSS_SELECTOR, '[data-action-id="QUOTE-DETAIL-NAVIGATE"]').click()
        self.w.until(EC.url_contains(f'/quotes/{quote_id}'))
        self.assertEqual(self.d.find_element(By.TAG_NAME, 'h1').text, quote_id)

    def send_fixture(self, quote_id: str) -> None:
        self.open_detail(quote_id)
        self.click('QUOTE-SEND')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[@role='status' and contains(.,'inmutable')]")))

    def test_navigation_and_roles(self) -> None:
        started = time.time()
        self.click('QUOTE-NAVIGATE')
        self.w.until(EC.url_to_be(f'{BASE}/quotes')); self.quotes_ready()
        self.d.refresh(); self.quotes_ready()
        self.pass_('QUOTE-NAVIGATE', 'SEL-QUOTE-NAVIGATION', started)

        for email, password, role, can_write in [
            ('admin@demo.local', 'demo-admin', 'ADMIN', True),
            ('doctor@demo.local', 'demo-doctor', 'DOCTOR', True),
            ('finance@demo.local', 'demo-finance', 'FINANCE', True),
            ('auditor@demo.local', 'demo-auditor', 'AUDITOR', False),
        ]:
            self.prepare_authenticated_test(email, password, role)
            self.d.get(f'{BASE}/quotes'); self.quotes_ready()
            self.assertEqual(bool(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="QUOTE-CREATE"]')), can_write)
            self.action('QUOTE-DETAIL-NAVIGATE').click()
            self.w.until(EC.url_contains('/quotes/'))
            self.assertEqual(bool(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="QUOTE-EDIT"], [data-action-id="QUOTE-SEND"]')), can_write)
        for email, password, role in [('nurse@demo.local', 'demo-nurse', 'NURSE'), ('inventory@demo.local', 'demo-inventory', 'INVENTORY')]:
            self.prepare_authenticated_test(email, password, role)
            self.d.get(f'{BASE}/quotes')
            denied = self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
            self.assertIn(f'Acceso restringido para el rol {role}', denied.text)

    def test_search_and_clear(self) -> None:
        self.d.get(f'{BASE}/quotes'); self.quotes_ready()
        started = time.time(); search = self.action('QUOTE-SEARCH')
        for query in ('quote demo 001', 'Áurora', 'case demo 001', 'draft'):
            search.clear(); search.send_keys(query)
            self.w.until(EC.visibility_of_element_located((By.XPATH, "//tbody/tr[contains(.,'quote-demo-001')]")))
        search.clear(); search.send_keys('sin resultados quote selenium')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[contains(.,'Sin resultados')]")))
        self.pass_('QUOTE-SEARCH', 'SEL-QUOTE-SEARCH', started)
        clear_started = time.time(); self.click('QUOTE-SEARCH-CLEAR')
        self.assertEqual(self.action('QUOTE-SEARCH').get_attribute('value'), '')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//tbody/tr[contains(.,'quote-demo-001')]")))
        self.pass_('QUOTE-SEARCH-CLEAR', 'SEL-QUOTE-SEARCH', clear_started)

    def test_create_and_validation(self) -> None:
        self.d.get(f'{BASE}/quotes'); self.quotes_ready()
        create_started = time.time(); self.click('QUOTE-CREATE')
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="QUOTE-CREATE-SUBMIT"]')))
        self.pass_('QUOTE-CREATE', 'SEL-QUOTE-CREATE', create_started)
        self.click('QUOTE-CREATE-SUBMIT')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[contains(.,'resumen operativo es obligatorio')]")))
        cancel_started = time.time()
        self.fill('Resumen operativo', 'No persistir Selenium')
        self.click('QUOTE-CREATE-CANCEL')
        self.w.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="QUOTE-CREATE-SUBMIT"]')))
        self.d.refresh(); self.quotes_ready(); self.assertNotIn('No persistir Selenium', self.d.find_element(By.TAG_NAME, 'body').text)
        self.pass_('QUOTE-CREATE-CANCEL', 'SEL-QUOTE-CREATE', cancel_started)
        submit_started = time.time(); marker = 'Crear y validar Selenium'
        self.open_new_quote(); self.fill('Resumen operativo', marker); self.add_line('Servicios', 'Servicio crear Selenium', price='12')
        self.click('QUOTE-CREATE-SUBMIT'); self.w.until(EC.url_to_be(f'{BASE}/quotes'))
        self.w.until(lambda _: any(q['summary'] == marker for q in self.snapshot()['quotes']))
        quote = next(q for q in self.snapshot()['quotes'] if q['summary'] == marker)
        self.assertEqual(quote['status'], 'DRAFT'); self.assertFalse(quote['immutable'])
        self.d.refresh(); self.quotes_ready(); self.assertIn(marker, self.quote_data(quote['id'])['summary'])
        self.pass_('QUOTE-CREATE-SUBMIT', 'SEL-QUOTE-CREATE', submit_started)

    def test_items_and_calculations(self) -> None:
        self.open_new_quote()
        for category in ('Servicios', 'Estudios diagnósticos', 'Medicamentos', 'Insumos', 'Equipos', 'Honorarios', 'Extras'):
            self.add_line(category, f'Concepto {category}', discount='1')
        add_started = time.time(); self.assertEqual(len(self.d.find_elements(By.XPATH, "//tbody/tr[contains(.,'Concepto ')]")), 1)
        self.pass_('QUOTE-ITEM-ADD', 'SEL-QUOTE-ITEMS', add_started)
        self.w.until(EC.element_to_be_clickable((By.XPATH, "//button[@role='tab' and normalize-space(.)='Servicios']"))).click()
        edit_started = time.time(); self.d.find_element(By.XPATH, "//tbody/tr[contains(.,'Concepto Servicios')]//button[normalize-space(.)='Editar']").click()
        self.fill('Cantidad', '2'); self.click('QUOTE-ITEM-EDIT')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//tbody/tr[contains(.,'Concepto Servicios') and contains(.,'2')]")))
        self.pass_('QUOTE-ITEM-EDIT', 'SEL-QUOTE-ITEMS', edit_started)
        self.w.until(EC.element_to_be_clickable((By.XPATH, "//button[@role='tab' and normalize-space(.)='Extras']"))).click()
        remove_started = time.time(); self.click('QUOTE-ITEM-REMOVE')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[contains(.,'No hay conceptos en esta categoría')]")))
        self.pass_('QUOTE-ITEM-REMOVE', 'SEL-QUOTE-ITEMS', remove_started)
        discount_started = time.time(); Select(self.action('QUOTE-DISCOUNT-UPDATE')).select_by_value('PERCENT')
        self.fill('Porcentaje de descuento', '10'); self.fill('Responsabilidad explícita de aseguradora', '5')
        totals = self.d.find_element(By.CSS_SELECTOR, '[aria-label="Totales de cotización"]').text
        self.assertIn('USD 57.60', totals)
        self.pass_('QUOTE-DISCOUNT-UPDATE', 'SEL-QUOTE-DISCOUNT', discount_started)

    def test_detail_navigation_and_back(self) -> None:
        quote_id = self.create_fixture('Detalle Selenium')
        started = time.time(); self.open_detail(quote_id)
        body = self.d.find_element(By.TAG_NAME, 'body').text
        self.assertIn('Detalle Selenium', body); self.assertIn(f'Servicio Detalle Selenium', body)
        self.pass_('QUOTE-DETAIL-NAVIGATE', 'SEL-QUOTE-DETAIL', started)
        back_started = time.time(); self.click('QUOTE-BACK-TO-LIST')
        self.w.until(EC.url_to_be(f'{BASE}/quotes')); self.quotes_ready()
        self.pass_('QUOTE-BACK-TO-LIST', 'SEL-QUOTE-DETAIL', back_started)

    def test_draft_edit_and_cancel(self) -> None:
        quote_id = self.create_fixture('Editar Selenium original')
        self.open_detail(quote_id); edit_started = time.time(); self.click('QUOTE-EDIT')
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="QUOTE-EDIT-SUBMIT"]')))
        self.assertEqual(self.field('Resumen operativo').get_attribute('value'), 'Editar Selenium original')
        self.pass_('QUOTE-EDIT', 'SEL-QUOTE-EDIT', edit_started)
        cancel_started = time.time(); self.fill('Resumen operativo', 'No guardar editar Selenium'); self.click('QUOTE-EDIT-CANCEL')
        self.w.until(EC.url_to_be(f'{BASE}/quotes')); self.open_detail(quote_id)
        self.assertIn('Editar Selenium original', self.d.find_element(By.TAG_NAME, 'body').text)
        self.assertNotIn('No guardar editar Selenium', self.d.find_element(By.TAG_NAME, 'body').text)
        self.pass_('QUOTE-EDIT-CANCEL', 'SEL-QUOTE-EDIT', cancel_started)
        self.click('QUOTE-EDIT'); self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="QUOTE-EDIT-SUBMIT"]')))
        submit_started = time.time(); self.fill('Resumen operativo', 'Editar Selenium persistido')
        self.click('QUOTE-EDIT-SUBMIT'); self.w.until(EC.url_to_be(f'{BASE}/quotes'))
        self.open_detail(quote_id); self.assertIn('Editar Selenium persistido', self.d.find_element(By.TAG_NAME, 'body').text)
        self.d.refresh(); self.assertIn('Editar Selenium persistido', self.d.find_element(By.TAG_NAME, 'body').text)
        self.pass_('QUOTE-EDIT-SUBMIT', 'SEL-QUOTE-EDIT', submit_started)

    def test_send_and_immutability(self) -> None:
        quote_id = self.create_fixture('Enviar Selenium')
        self.open_detail(quote_id); started = time.time(); self.click('QUOTE-SEND')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[@role='status' and contains(.,'No se envió información a un canal externo')]")))
        quote = self.quote_data(quote_id)
        self.assertEqual(quote['status'], 'SENT'); self.assertTrue(quote['immutable']); self.assertTrue(quote['sentAt'])
        actions = [entry['action'] for entry in self.snapshot()['auditEntries'] if entry['subject'] == quote_id]
        self.assertIn('Cotización marcada como enviada e inmutable', actions)
        self.assertTrue(all('enlace seguro' not in action.lower() for action in actions))
        self.d.refresh(); self.assertFalse(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="QUOTE-EDIT"], [data-action-id="QUOTE-SEND"]'))
        self.assertTrue(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="QUOTE-REVISE"]'))
        self.pass_('QUOTE-SEND', 'SEL-QUOTE-SEND', started)

    def test_revision_history_and_cancel(self) -> None:
        quote_id = self.create_fixture('Revisión Selenium'); self.send_fixture(quote_id)
        revise_started = time.time(); self.click('QUOTE-REVISE')
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="QUOTE-REVISE-SUBMIT"]')))
        self.pass_('QUOTE-REVISE', 'SEL-QUOTE-REVISION', revise_started)
        self.click('QUOTE-REVISE-SUBMIT'); self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[contains(.,'motivo de revisión es obligatorio')]")))
        cancel_started = time.time(); self.fill('Motivo de revisión', 'No persistir revisión'); self.click('QUOTE-REVISE-CANCEL')
        self.w.until(EC.url_to_be(f'{BASE}/quotes')); self.assertEqual(len([q for q in self.snapshot()['quotes'] if q.get('rootQuoteId') == quote_id]), 1)
        self.pass_('QUOTE-REVISE-CANCEL', 'SEL-QUOTE-REVISION', cancel_started)
        self.open_detail(quote_id); self.click('QUOTE-REVISE')
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="QUOTE-REVISE-SUBMIT"]')))
        submit_started = time.time()
        self.d.find_elements(By.CSS_SELECTOR, '[role="dialog"]')[-1].find_element(By.XPATH, ".//label[contains(.,'Motivo de')]//textarea").send_keys('Ajuste Selenium documentado')
        self.click('QUOTE-REVISE-SUBMIT'); self.w.until(EC.url_to_be(f'{BASE}/quotes'))
        revisions = [q for q in self.snapshot()['quotes'] if q.get('rootQuoteId') == quote_id]
        self.assertEqual(len(revisions), 2); revised = next(q for q in revisions if q['id'] != quote_id)
        self.assertEqual(revised['version'], 2); self.assertEqual(revised['status'], 'DRAFT'); self.assertEqual(revised['revisionReason'], 'Ajuste Selenium documentado')
        self.open_detail(revised['id']); body = self.d.find_element(By.TAG_NAME, 'body').text
        self.assertIn('v1', body); self.assertIn('v2', body); self.assertIn('Ajuste Selenium documentado', body)
        self.pass_('QUOTE-REVISE-SUBMIT', 'SEL-QUOTE-REVISION', submit_started)

    def test_print(self) -> None:
        quote_id = self.create_fixture('Imprimir Selenium'); self.open_detail(quote_id)
        self.d.execute_script("window.print = () => { document.documentElement.dataset.printCalled = 'true'; };")
        started = time.time(); self.click('QUOTE-PRINT')
        self.assertEqual(self.d.find_element(By.TAG_NAME, 'html').get_attribute('data-print-called'), 'true')
        self.pass_('QUOTE-PRINT', 'SEL-QUOTE-PRINT', started)

    def test_related_actions(self) -> None:
        quote_id = self.create_fixture('Relacionadas Selenium'); self.open_detail(quote_id)
        insurance_started = time.time(); self.click('QUOTE-OPEN-INSURANCE')
        self.w.until(EC.url_contains(f'/insurance?quote={quote_id}')); self.pass_('QUOTE-OPEN-INSURANCE', 'SEL-QUOTE-RELATED', insurance_started)
        self.d.back(); self.w.until(EC.url_contains(f'/quotes/{quote_id}'))
        payment_started = time.time(); self.click('QUOTE-OPEN-PAYMENT')
        self.w.until(EC.url_contains(f'/payments?quote={quote_id}')); self.pass_('QUOTE-OPEN-PAYMENT', 'SEL-QUOTE-RELATED', payment_started)
        self.d.back(); self.w.until(EC.url_contains(f'/quotes/{quote_id}'))
        whatsapp_started = time.time(); url_before = self.d.current_url; self.click('QUOTE-WHATSAPP')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[@role='status' and contains(.,'Proveedor de mensajería no configurado')]")))
        self.assertEqual(self.d.current_url, url_before); self.pass_('QUOTE-WHATSAPP', 'SEL-QUOTE-RELATED', whatsapp_started)
        portal_started = time.time(); self.click('QUOTE-PORTAL')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[@role='status' and contains(.,'Portal seguro no configurado')]")))
        self.assertEqual(self.d.current_url, url_before); self.pass_('QUOTE-PORTAL', 'SEL-QUOTE-RELATED', portal_started)

    def test_mobile(self) -> None:
        self.d.set_window_size(390, 844)
        try:
            self.d.get(f'{BASE}/quotes'); self.quotes_ready(); self.action('QUOTE-SEARCH').send_keys('Aurora')
            self.w.until(EC.visibility_of_element_located((By.XPATH, "//tbody/tr[contains(.,'quote-demo-001')]")))
            self.click('QUOTE-CREATE')
            submit = self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="QUOTE-CREATE-SUBMIT"]')))
            self.d.execute_script('arguments[0].scrollIntoView({block:"center"});', submit); self.assertTrue(submit.is_displayed())
            self.click('QUOTE-CREATE-CANCEL')
            width, viewport = self.d.execute_script('return [document.documentElement.scrollWidth, window.innerWidth]')
            self.assertLessEqual(width, viewport + 8, f'critical horizontal overflow: {width}px > {viewport}px')
        finally:
            self.d.set_window_size(1440, 1000)


if __name__ == '__main__':
    unittest.main(verbosity=2)
