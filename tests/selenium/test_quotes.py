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
# test-id: SEL-B4-DOCTOR-FEE
# test-id: SEL-QUOTE-METADATA
# test-id: SEL-CH04-QUOTE-GENERAL
# test-id: SEL-CH05-QUOTE-CATALOG
# test-id: SEL-CH06-QUOTE-CATALOG

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
        self.d.execute_script('localStorage.clear();')
        self.d.get(f'{BASE}/login')
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN-EMAIL"]')))
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, 'input[type=password]')))

    def login_as(self, email: str, password: str, role: str) -> None:
        email_box = self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN-EMAIL"]')))
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
        nested = scope.find_elements(
            By.XPATH,
            f".//label[contains(normalize-space(.),'{label}')]//*[self::input or self::select or self::textarea]",
        )
        if nested:
            return nested[0]
        label_node = scope.find_element(By.XPATH, f".//label[contains(normalize-space(.),'{label}')]")
        control_id = label_node.get_attribute('for')
        if control_id:
            return self.d.find_element(By.ID, control_id)
        return scope.find_element(By.CSS_SELECTOR, f'[aria-label="{label}"]')

    def fill(self, label: str, value: str) -> None:
        control = self.field(label)
        control.clear(); control.send_keys(value)

    def set_native_date(self, action_id: str, value: str) -> None:
        """Set a controlled date input using the browser's native value setter."""
        control = self.action(action_id)
        self.d.execute_script(
            "const input = arguments[0]; const value = arguments[1];"
            "const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;"
            "setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true }));"
            "input.dispatchEvent(new Event('change', { bubbles: true }));",
            control,
            value,
        )
        self.w.until(lambda _: self.action(action_id).get_attribute('value') == value)

    def pass_(self, action_id: str, test_id: str, started_at: float) -> None:
        record_pass(action_id, test_id, started_at, self.d.current_url)

    def quotes_ready(self) -> None:
        self.w.until(EC.visibility_of_element_located((By.TAG_NAME, 'h1')))
        self.assertEqual(self.d.find_element(By.TAG_NAME, 'h1').text, 'Cotizaciones')
        self.w.until(EC.presence_of_element_located((By.CSS_SELECTOR, '[data-action-id="QUOTE-SEARCH"]')))

    def snapshot(self) -> dict:
        quotes = self.d.execute_script('return localStorage.getItem("analiza.en.casa.workspace.v3.quotes")')
        audit_entries = self.d.execute_script('return localStorage.getItem("analiza.en.casa.workspace.v3.auditEntries")')
        return {'quotes': json.loads(quotes or '[]'), 'auditEntries': json.loads(audit_entries or '[]')}

    def quote_data(self, quote_id: str) -> dict:
        return next(item for item in self.snapshot()['quotes'] if item['id'] == quote_id)

    def open_new_quote(self) -> None:
        self.d.get(f'{BASE}/quotes')
        self.quotes_ready()
        self.click('QUOTE-CREATE')
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="QUOTE-CREATE-SUBMIT"]')))

    def create_doctor_fixture(self) -> None:
        """Creates the synthetic doctor needed only to exercise a fee association."""
        self.d.get(f'{BASE}/doctors')
        self.w.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-action-id="DOCTOR-CREATE"]'))).click()
        self.fill('Nombre completo', 'Médica Selenium Honorarios')
        self.fill('JVPM', 'JVPM-SEL-FEE')
        self.fill('DUI', 'DUI-SEL-FEE')
        specialty = self.d.find_element(By.CSS_SELECTOR, '[data-action-id="DOCTOR-SPECIALTY-SELECT"]')
        specialty.send_keys('Nutri')
        self.w.until(EC.element_to_be_clickable((By.XPATH, "//*[@role='option' and normalize-space()='Nutricionista']"))).click()
        self.fill('Dirección', 'Dirección sintética Selenium')
        self.click('DOCTOR-SAVE')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[contains(.,'Médica Selenium Honorarios registrado')]")))

    def add_line(self, category: str, name: str, quantity='1', price='10', discount='0') -> None:
        self.w.until(EC.element_to_be_clickable((By.XPATH, f"//button[@role='tab' and normalize-space(.)='{category}']"))).click()
        self.fill('Concepto', name)
        if category == 'Honorarios':
            Select(self.action('QUOTE-FEE-DOCTOR-SELECT')).select_by_index(1)
        self.fill('Cantidad', quantity)
        self.fill('Honorario médico (manual)' if category == 'Honorarios' else 'Precio manual', price); self.fill('Descuento manual', discount)
        self.click('QUOTE-ITEM-ADD')
        self.w.until(EC.visibility_of_element_located((By.XPATH, f"//tbody/tr[contains(.,'{name}')]")))

    def select_administrative_referral(self, label='Redes Sociales') -> None:
        self.fill('Referido por', label.split(' ')[0])
        self.w.until(EC.element_to_be_clickable((By.XPATH, f"//*[@role='option' and normalize-space()='{label}']"))).click()

    def create_fixture(self, marker: str, items=True) -> str:
        """Create through the UI; it is a fixture precondition and never records coverage."""
        self.open_new_quote()
        self.fill('Resumen operativo', marker)
        self.fill('Comentarios', f'Comentario {marker}')
        self.select_administrative_referral()
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

    def assert_quote_access(self, email: str, password: str, role: str, can_write: bool) -> None:
        self.prepare_authenticated_test(email, password, role)
        self.d.get(f'{BASE}/quotes'); self.quotes_ready()
        self.assertEqual(bool(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="QUOTE-CREATE"]')), can_write)
        self.action('QUOTE-DETAIL-NAVIGATE').click()
        self.w.until(EC.url_contains('/quotes/'))
        self.assertEqual(bool(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="QUOTE-EDIT"], [data-action-id="QUOTE-SEND"]')), can_write)

    def test_admin_can_navigate_and_write_quotes(self) -> None:
        started = time.time()
        self.click('FINANCIERO-TOGGLE')
        self.click('QUOTE-NAVIGATE')
        self.w.until(EC.url_to_be(f'{BASE}/quotes')); self.quotes_ready()
        self.d.refresh(); self.quotes_ready()
        self.assertTrue(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="QUOTE-CREATE"]'))
        self.pass_('QUOTE-NAVIGATE', 'SEL-QUOTE-NAVIGATION', started)

    def test_doctor_can_write_quotes(self) -> None:
        self.assert_quote_access('doctor@demo.local', 'demo-doctor', 'DOCTOR', True)

    def test_finance_can_write_quotes(self) -> None:
        self.assert_quote_access('finance@demo.local', 'demo-finance', 'FINANCE', True)

    def test_auditor_is_read_only_for_quotes(self) -> None:
        self.assert_quote_access('auditor@demo.local', 'demo-auditor', 'AUDITOR', False)

    def test_nurse_is_denied_quotes_route(self) -> None:
        self.prepare_authenticated_test('nurse@demo.local', 'demo-nurse', 'NURSE')
        self.d.get(f'{BASE}/quotes')
        denied = self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('Acceso restringido para el rol NURSE', denied.text)

    def test_inventory_is_denied_quotes_route(self) -> None:
        self.prepare_authenticated_test('inventory@demo.local', 'demo-inventory', 'INVENTORY')
        self.d.get(f'{BASE}/quotes')
        denied = self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('Acceso restringido para el rol INVENTORY', denied.text)

    def test_search_and_clear(self) -> None:
        self.d.get(f'{BASE}/quotes'); self.quotes_ready()
        started = time.time(); search = self.action('QUOTE-SEARCH')
        for query in ('quote demo 001', 'Áurora', 'case demo 001', 'draft'):
            search.clear(); search.send_keys(query)
            self.w.until(EC.visibility_of_element_located((By.XPATH, "//tbody/tr[contains(.,'quote-demo-001')]")))
        search.clear(); search.send_keys('sin resultados quote selenium')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[normalize-space()='Sin cotizaciones']")))
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
        self.open_new_quote(); self.fill('Resumen operativo', marker); self.select_administrative_referral(); self.add_line('Servicios', 'Servicio crear Selenium', price='12')
        self.click('QUOTE-CREATE-SUBMIT'); self.w.until(EC.url_to_be(f'{BASE}/quotes'))
        self.w.until(lambda _: any(q['summary'] == marker for q in self.snapshot()['quotes']))
        quote = next(q for q in self.snapshot()['quotes'] if q['summary'] == marker)
        self.assertEqual(quote['status'], 'DRAFT'); self.assertFalse(quote['immutable'])
        self.d.refresh(); self.quotes_ready(); self.assertIn(marker, self.quote_data(quote['id'])['summary'])
        self.pass_('QUOTE-CREATE-SUBMIT', 'SEL-QUOTE-CREATE', submit_started)

    def test_items_and_calculations(self) -> None:
        self.create_doctor_fixture()
        self.open_new_quote()
        marker = 'Categorías Selenium persistidas'
        self.fill('Resumen operativo', marker)
        self.select_administrative_referral()
        for category in ('Servicios', 'Estudios Dx', 'Medicamentos', 'Insumos', 'Equipos', 'Honorarios', 'Extras'):
            self.add_line(category, f'Concepto {category}', discount='1')
        add_started = time.time(); self.assertEqual(len(self.d.find_elements(By.XPATH, "//tbody/tr[contains(.,'Concepto ')]")), 1)
        self.w.until(EC.element_to_be_clickable((By.XPATH, "//button[@role='tab' and normalize-space(.)='Servicios']"))).click()
        edit_started = time.time(); self.d.find_element(By.XPATH, "//tbody/tr[contains(.,'Concepto Servicios')]//button[normalize-space(.)='Editar']").click()
        self.fill('Cantidad', '2')
        self.w.until(EC.element_to_be_clickable((By.XPATH, "//button[@data-action-id='QUOTE-ITEM-EDIT' and normalize-space(.)='Actualizar línea']"))).click()
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//tbody/tr[contains(.,'Concepto Servicios') and contains(.,'2')]")))
        discount_started = time.time(); Select(self.action('QUOTE-DISCOUNT-UPDATE')).select_by_value('PERCENT')
        self.fill('Porcentaje de descuento', '10'); self.fill('Responsabilidad explícita de aseguradora', '5')
        totals = self.d.find_element(By.CSS_SELECTOR, '[aria-label="Totales de cotización"]').text
        self.assertIn('USD 65.70', totals)
        self.click('QUOTE-CREATE-SUBMIT'); self.w.until(EC.url_to_be(f'{BASE}/quotes'))
        quote = next(item for item in self.snapshot()['quotes'] if item['summary'] == marker)
        self.d.refresh(); self.open_detail(quote['id'])
        body = self.d.find_element(By.TAG_NAME, 'body').text
        for category in ('Servicios', 'Estudios Dx', 'Medicamentos', 'Insumos', 'Equipos', 'Honorarios', 'Extras'):
            self.assertIn(category, body); self.assertIn(f'Concepto {category}', body)
        self.pass_('QUOTE-ITEM-ADD', 'SEL-QUOTE-ITEMS', add_started)
        self.pass_('QUOTE-ITEM-EDIT', 'SEL-QUOTE-ITEMS', edit_started)
        self.pass_('QUOTE-DISCOUNT-UPDATE', 'SEL-QUOTE-DISCOUNT', discount_started)
        self.click('QUOTE-EDIT'); self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="QUOTE-EDIT-SUBMIT"]')))
        self.w.until(EC.element_to_be_clickable((By.XPATH, "//button[@role='tab' and normalize-space(.)='Extras']"))).click()
        remove_started = time.time(); self.click('QUOTE-ITEM-REMOVE')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[contains(.,'No hay conceptos en esta categoría')]")))
        self.click('QUOTE-EDIT-SUBMIT'); self.w.until(EC.url_to_be(f'{BASE}/quotes'))
        self.d.refresh(); self.open_detail(quote['id'])
        body = self.d.find_element(By.TAG_NAME, 'body').text
        self.assertNotIn('Concepto Extras', body); self.assertIn('Concepto Honorarios', body)
        self.pass_('QUOTE-ITEM-REMOVE', 'SEL-QUOTE-ITEMS', remove_started)

    def test_doctor_fee_persists_after_reload(self) -> None:
        self.create_doctor_fixture()
        self.open_new_quote()
        self.fill('Resumen operativo', 'Honorario médico Selenium B4')
        self.select_administrative_referral()
        self.w.until(EC.element_to_be_clickable((By.XPATH, "//button[@role='tab' and normalize-space(.)='Honorarios']"))).click()
        doctor = Select(self.action('QUOTE-FEE-DOCTOR-SELECT'))
        doctor.select_by_index(1)
        doctor_name = doctor.first_selected_option.text
        self.fill('Concepto', 'Honorario Selenium B4')
        self.fill('Cantidad', '1')
        self.fill('Honorario médico (manual)', '55')
        started = time.time()
        self.click('QUOTE-ITEM-ADD')
        self.w.until(EC.visibility_of_element_located((By.XPATH, f"//tbody/tr[contains(.,'Médico: {doctor_name}')]")))
        self.click('QUOTE-CREATE-SUBMIT')
        self.w.until(EC.url_to_be(f'{BASE}/quotes'))
        quote = next(item for item in self.snapshot()['quotes'] if item['summary'] == 'Honorario médico Selenium B4')
        item = next(item for item in quote['items'] if item['name'] == 'Honorario Selenium B4')
        self.assertEqual(item['doctorName'], doctor_name)
        self.assertEqual(item['unitPrice'], 55)
        self.open_detail(quote['id'])
        self.d.refresh()
        self.assertIn(f'Médico: {doctor_name}', self.d.find_element(By.TAG_NAME, 'body').text)
        self.pass_('QUOTE-FEE-DOCTOR-SELECT', 'SEL-B4-DOCTOR-FEE', started)
        self.pass_('QUOTE-FEE-AMOUNT', 'SEL-B4-DOCTOR-FEE', started)

    def test_quote_metadata_filters_and_pagination_have_persisted_or_visible_effects(self) -> None:
        self.open_new_quote()
        marker = 'Metadatos Selenium B4'
        patient_search_started = time.time()
        self.fill('Buscar paciente', 'Aurora')
        self.assertEqual(self.d.find_element(By.CSS_SELECTOR, '#quote-patient-options option').get_attribute('value'), 'Paciente Demo Aurora')
        self.pass_('QUOTE-PATIENT-SEARCH', 'SEL-QUOTE-METADATA', patient_search_started)
        patient_select_started = time.time()
        Select(self.action('QUOTE-PATIENT-SELECT')).select_by_value('patient-demo-001')
        self.fill('Resumen operativo', marker)
        invoice_date = time.strftime('%Y-%m-%d')
        invoice_date_started = time.time()
        self.set_native_date('QUOTE-INVOICE-DATE', invoice_date)
        discount_group_started = time.time()
        Select(self.action('QUOTE-DISCOUNT-GROUP')).select_by_value('Regular')
        referral_started = time.time()
        self.select_administrative_referral()
        giftcard_started = time.time()
        self.fill('Giftcard', 'GIFT-SEL-B4')
        comments_started = time.time()
        self.fill('Comentarios', 'Comentarios Selenium B4')
        self.add_line('Servicios', 'Servicio metadatos Selenium', price='10')
        self.click('QUOTE-CREATE-SUBMIT'); self.w.until(EC.url_to_be(f'{BASE}/quotes'))
        quote = next(item for item in self.snapshot()['quotes'] if item['summary'] == marker)
        self.assertEqual(quote['patientId'], 'patient-demo-001')
        self.assertEqual(quote['invoiceDate'], invoice_date)
        self.assertEqual(quote['referralSelections'], ['Redes Sociales'])
        self.assertEqual(quote['giftCardCode'], 'GIFT-SEL-B4')
        self.assertEqual(quote['comments'], 'Comentarios Selenium B4')
        self.d.refresh(); self.open_detail(quote['id']); self.click('QUOTE-EDIT')
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="QUOTE-EDIT-SUBMIT"]')))
        self.assertEqual(self.action('QUOTE-PATIENT-SELECT').get_attribute('value'), 'patient-demo-001')
        self.pass_('QUOTE-PATIENT-SELECT', 'SEL-QUOTE-METADATA', patient_select_started)
        self.assertEqual(self.action('QUOTE-INVOICE-DATE').get_attribute('value'), invoice_date)
        self.pass_('QUOTE-INVOICE-DATE', 'SEL-QUOTE-METADATA', invoice_date_started)
        self.assertEqual(self.action('QUOTE-DISCOUNT-GROUP').get_attribute('value'), 'Regular')
        self.pass_('QUOTE-DISCOUNT-GROUP', 'SEL-QUOTE-METADATA', discount_group_started)
        self.assertIn('Redes Sociales', self.d.find_element(By.CSS_SELECTOR, '[aria-label="Referidos seleccionados"]').text)
        self.pass_('QUOTE-REFERRAL', 'SEL-QUOTE-METADATA', referral_started)
        self.assertEqual(self.action('QUOTE-GIFTCARD').get_attribute('value'), 'GIFT-SEL-B4')
        self.pass_('QUOTE-GIFTCARD', 'SEL-QUOTE-METADATA', giftcard_started)
        self.assertEqual(self.action('QUOTE-COMMENTS').get_attribute('value'), 'Comentarios Selenium B4')
        self.pass_('QUOTE-COMMENTS', 'SEL-QUOTE-METADATA', comments_started)
        self.click('QUOTE-EDIT-CANCEL'); self.w.until(EC.url_to_be(f'{BASE}/quotes'))
        sent_quote_id = self.create_fixture('Filtro enviada Selenium')
        self.open_detail(sent_quote_id); self.click('QUOTE-SEND')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[@role='status' and contains(.,'inmutable')]")))
        self.assertEqual(self.quote_data(sent_quote_id)['status'], 'SENT')
        self.d.refresh(); self.assertFalse(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="QUOTE-SEND"]'))
        for index in range(10):
            self.create_fixture(f'Paginación Selenium {index}', items=False)
        self.d.get(f'{BASE}/quotes'); self.quotes_ready()
        status_filter_started = time.time()
        Select(self.action('QUOTE-FILTER-STATUS')).select_by_value('SENT')
        self.click('QUOTE-FILTER-APPLY')
        sent_rows = self.d.find_elements(By.CSS_SELECTOR, 'tbody tr')
        self.assertEqual(len(sent_rows), 1); self.assertIn('Enviada', sent_rows[0].text); self.assertNotIn('Borrador', sent_rows[0].text)
        Select(self.action('QUOTE-FILTER-STATUS')).select_by_value('DRAFT')
        self.click('QUOTE-FILTER-APPLY')
        draft_rows = self.d.find_elements(By.CSS_SELECTOR, 'tbody tr')
        self.assertEqual(len(draft_rows), 10); self.assertTrue(all('Borrador' in row.text and 'Enviada' not in row.text for row in draft_rows))
        self.pass_('QUOTE-FILTER-STATUS', 'SEL-QUOTE-METADATA', status_filter_started)
        date_filter_started = time.time()
        self.action('QUOTE-FILTER-CREATED-DATE').send_keys('12/31/2099')
        filter_apply_started = time.time()
        self.click('QUOTE-FILTER-APPLY')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[normalize-space()='Sin cotizaciones']")))
        self.pass_('QUOTE-FILTER-CREATED-DATE', 'SEL-QUOTE-METADATA', date_filter_started)
        self.pass_('QUOTE-FILTER-APPLY', 'SEL-QUOTE-METADATA', filter_apply_started)
        filter_clear_started = time.time()
        self.click('QUOTE-FILTER-CLEAR')
        self.assertEqual(self.action('QUOTE-FILTER-STATUS').get_attribute('value'), '')
        self.assertEqual(self.action('QUOTE-FILTER-CREATED-DATE').get_attribute('value'), '')
        self.assertTrue(self.d.find_elements(By.XPATH, "//tbody/tr[contains(.,'Enviada')]") and self.d.find_elements(By.XPATH, "//tbody/tr[contains(.,'Borrador')]"))
        self.pass_('QUOTE-FILTER-CLEAR', 'SEL-QUOTE-METADATA', filter_clear_started)
        self.assertTrue(self.action('QUOTE-PAGE-NEXT').is_enabled())
        page_next_started = time.time(); self.click('QUOTE-PAGE-NEXT'); self.assertIn('Página 2 de 2', self.d.find_element(By.TAG_NAME, 'body').text)
        self.pass_('QUOTE-PAGE-NEXT', 'SEL-QUOTE-METADATA', page_next_started)
        page_prev_started = time.time(); self.click('QUOTE-PAGE-PREV'); self.assertIn('Página 1 de 2', self.d.find_element(By.TAG_NAME, 'body').text)
        self.pass_('QUOTE-PAGE-PREV', 'SEL-QUOTE-METADATA', page_prev_started)

    def test_ch04_referral_tags_and_bounded_service_catalog_persist_without_pricing_rules(self) -> None:
        self.open_new_quote()
        Select(self.action('QUOTE-PATIENT-SELECT')).select_by_value('patient-demo-001')
        self.assertNotEqual(self.field('Documento').get_attribute('value'), 'No disponible')
        self.assertNotEqual(self.field('Teléfono').get_attribute('value'), 'No disponible')
        self.assertNotEqual(self.field('Correo').get_attribute('value'), 'No disponible')
        required_marker = 'CH04 referido obligatorio Selenium'
        self.fill('Resumen operativo', required_marker); self.click('QUOTE-CREATE-SUBMIT')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[@role='alert' and normalize-space()='Seleccione al menos un referido.']")))
        self.assertTrue(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="QUOTE-CREATE-SUBMIT"]'))
        self.assertFalse(any(quote['summary'] == required_marker for quote in self.snapshot()['quotes']))
        referral_catalog_started = time.time(); self.click('QUOTE-REFERRAL-CATALOG')
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '#quote-referral-catalog')))
        self.assertEqual(self.action('QUOTE-REFERRAL-CATALOG').get_attribute('aria-expanded'), 'true')
        catalog = self.d.find_element(By.CSS_SELECTOR, '#quote-referral-catalog')
        catalog_metrics = self.d.execute_script('const style = getComputedStyle(arguments[0]); return { overflowY: style.overflowY, scrollHeight: arguments[0].scrollHeight, clientHeight: arguments[0].clientHeight };', catalog)
        self.assertEqual(catalog_metrics['overflowY'], 'auto'); self.assertGreater(catalog_metrics['scrollHeight'], catalog_metrics['clientHeight'])
        self.assertEqual(self.d.execute_script('return getComputedStyle(arguments[0]).backgroundColor;', self.action('QUOTE-REFERRAL-CATALOG')), 'rgb(23, 131, 79)')
        self.pass_('QUOTE-REFERRAL-CATALOG', 'SEL-CH04-QUOTE-GENERAL', referral_catalog_started)
        referral_add_started = time.time(); self.fill('Referido por', 'Redes')
        self.w.until(EC.element_to_be_clickable((By.XPATH, "//*[@role='option' and normalize-space()='Redes Sociales']"))).click()
        self.fill('Referido por', 'Amigos')
        self.w.until(EC.element_to_be_clickable((By.XPATH, "//*[@role='option' and normalize-space()='Amigos & Familia']"))).click()
        self.assertIn('Redes Sociales', self.d.find_element(By.CSS_SELECTOR, '[aria-label="Referidos seleccionados"]').text)
        self.assertFalse(self.d.find_elements(By.CSS_SELECTOR, '#quote-referral-error'))
        referral_remove_started = time.time()
        self.d.find_element(By.XPATH, "//button[@aria-label='Quitar Amigos & Familia']").click()
        self.assertNotIn('Amigos & Familia', self.d.find_element(By.CSS_SELECTOR, '[aria-label="Referidos seleccionados"]').text)
        inventory_started = time.time(); self.click('QUOTE-INVENTORY-ONLY')
        services = Select(self.action('QUOTE-SERVICE-CATALOG'))
        self.assertEqual([option.text for option in services.options], ['Seleccione un servicio', 'Servicio sintético disponible'])
        self.pass_('QUOTE-INVENTORY-ONLY', 'SEL-CH04-QUOTE-GENERAL', inventory_started)
        business_partner_started = time.time(); Select(self.action('QUOTE-BUSINESS-PARTNER')).select_by_visible_text('Socio sintético A')
        service_started = time.time(); services.select_by_visible_text('Servicio sintético disponible')
        self.fill('Cantidad', '1'); self.fill('Precio manual', '10'); self.click('QUOTE-ITEM-ADD')
        marker = 'CH04 Selenium secciones generales'; self.fill('Resumen operativo', marker); self.click('QUOTE-CREATE-SUBMIT')
        self.w.until(EC.url_to_be(f'{BASE}/quotes'))
        quote = next(q for q in self.snapshot()['quotes'] if q['summary'] == marker)
        persisted_item = next(item for item in quote['items'] if item['name'] == 'Servicio sintético disponible')
        self.assertEqual(persisted_item['businessPartnerLabel'], 'Socio sintético A')
        self.assertEqual(persisted_item['unitPrice'], 10)
        self.d.refresh(); self.open_detail(quote['id']); self.click('QUOTE-EDIT')
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="QUOTE-EDIT-SUBMIT"]')))
        selected_referrals = self.d.find_element(By.CSS_SELECTOR, '[aria-label="Referidos seleccionados"]')
        self.assertIn('Redes Sociales', selected_referrals.text)
        self.assertTrue(selected_referrals.find_elements(By.CSS_SELECTOR, '[aria-label="Quitar Redes Sociales"]'))
        self.pass_('QUOTE-REFERRAL-ADD', 'SEL-CH04-QUOTE-GENERAL', referral_add_started)
        self.pass_('QUOTE-REFERRAL-REMOVE', 'SEL-CH04-QUOTE-GENERAL', referral_remove_started)
        self.pass_('QUOTE-BUSINESS-PARTNER', 'SEL-CH04-QUOTE-GENERAL', business_partner_started)
        self.pass_('QUOTE-SERVICE-CATALOG', 'SEL-CH04-QUOTE-GENERAL', service_started)
        self.click('QUOTE-EDIT-CANCEL')

    def test_ch05_service_and_medication_catalogs_search_reset_and_persist_manual_amounts(self) -> None:
        self.open_new_quote()
        marker = 'CH05 catálogos Selenium persistidos'
        self.fill('Resumen operativo', marker); self.select_administrative_referral()
        self.assertEqual([tab.text for tab in self.d.find_elements(By.XPATH, "//*[@role='tab']")], ['Servicios', 'Estudios Dx', 'Medicamentos', 'Insumos', 'Equipos', 'Honorarios', 'Extras'])
        service_search_started = time.time(); self.fill('Buscar servicios', 'disponible')
        service_option = self.w.until(EC.element_to_be_clickable((By.XPATH, "//*[@aria-label='Resultados de servicios']//*[@role='option' and normalize-space()='Servicio sintético disponible']")))
        self.assertTrue(service_option.is_displayed()); self.pass_('QUOTE-SERVICE-SEARCH', 'SEL-CH05-QUOTE-CATALOG', service_search_started)
        service_select_started = time.time(); service_option.click()
        self.assertEqual(self.field('Concepto').get_attribute('value'), 'Servicio sintético disponible')
        Select(self.action('QUOTE-BUSINESS-PARTNER')).select_by_visible_text('Socio sintético A')
        self.assertEqual(self.field('Cantidad').get_attribute('value'), '0')
        self.assertEqual(self.field('Cantidad').get_attribute('aria-required'), 'true')
        self.click('QUOTE-ITEM-ADD')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[@role='alert' and normalize-space()='La cantidad debe ser mayor que cero.']")))
        self.assertFalse(self.d.find_elements(By.XPATH, "//tbody/tr[contains(.,'Servicio sintético disponible')]"))
        self.fill('Cantidad', '2'); self.fill('Precio manual', '12'); self.click('QUOTE-ITEM-ADD')
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '.quote-processing')))
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//tbody/tr[contains(.,'Servicio sintético disponible')]")))
        medication_category_started = time.time(); self.click('QUOTE-MEDICATION-CATEGORY')
        self.assertEqual(self.field('Concepto').get_attribute('value'), '')
        self.assertEqual(self.field('Buscar medicamentos').get_attribute('value'), '')
        self.assertEqual(Select(self.action('QUOTE-MEDICATION-BUSINESS-PARTNER')).first_selected_option.get_attribute('value'), '')
        self.pass_('QUOTE-MEDICATION-CATEGORY', 'SEL-CH05-QUOTE-CATALOG', medication_category_started)
        medication_inventory_started = time.time(); self.click('QUOTE-MEDICATION-INVENTORY-ONLY')
        self.assertTrue(self.action('QUOTE-MEDICATION-INVENTORY-ONLY').is_selected())
        self.pass_('QUOTE-MEDICATION-INVENTORY-ONLY', 'SEL-CH05-QUOTE-CATALOG', medication_inventory_started)
        medication_search_started = time.time(); self.fill('Buscar medicamentos', 'sin coincidencia')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[@role='status' and normalize-space()='No results found']")))
        self.fill('Buscar medicamentos', 'disponible')
        medication_option = self.w.until(EC.element_to_be_clickable((By.XPATH, "//*[@aria-label='Resultados de medicamentos']//*[@role='option' and normalize-space()='Medicamento sintético disponible']")))
        self.assertTrue(medication_option.is_displayed()); self.pass_('QUOTE-MEDICATION-SEARCH', 'SEL-CH05-QUOTE-CATALOG', medication_search_started)
        medication_select_started = time.time(); medication_option.click()
        self.assertEqual(self.field('Concepto').get_attribute('value'), 'Medicamento sintético disponible')
        medication_partner_started = time.time(); Select(self.action('QUOTE-MEDICATION-BUSINESS-PARTNER')).select_by_visible_text('Socio sintético B')
        self.fill('Cantidad', '1'); self.fill('Precio manual', '9'); self.click('QUOTE-ITEM-ADD')
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '.quote-processing')))
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//tbody/tr[contains(.,'Medicamento sintético disponible')]")))
        self.click('QUOTE-CREATE-SUBMIT'); self.w.until(EC.url_to_be(f'{BASE}/quotes'))
        quote = next(item for item in self.snapshot()['quotes'] if item['summary'] == marker)
        self.d.refresh(); self.open_detail(quote['id'])
        body = self.d.find_element(By.TAG_NAME, 'body').text
        self.assertIn('Servicio sintético disponible', body); self.assertIn('Medicamento sintético disponible', body)
        self.assertEqual([(item['name'], item['unitPrice']) for item in self.quote_data(quote['id'])['items']], [('Servicio sintético disponible', 12), ('Medicamento sintético disponible', 9)])
        self.pass_('QUOTE-SERVICE-SELECT', 'SEL-CH05-QUOTE-CATALOG', service_select_started)
        self.pass_('QUOTE-MEDICATION-SELECT', 'SEL-CH05-QUOTE-CATALOG', medication_select_started)
        self.pass_('QUOTE-MEDICATION-BUSINESS-PARTNER', 'SEL-CH05-QUOTE-CATALOG', medication_partner_started)

    def test_ch06_supply_study_and_fee_catalogs_persist_only_manual_amounts(self) -> None:
        self.create_doctor_fixture()
        self.open_new_quote()
        marker = 'CH06 catálogos Selenium persistidos'
        self.fill('Resumen operativo', marker); self.select_administrative_referral()

        self.w.until(EC.element_to_be_clickable((By.XPATH, "//button[@role='tab' and normalize-space(.)='Insumos']"))).click()
        supply_inventory_started = time.time(); self.click('QUOTE-SUPPLY-INVENTORY-ONLY')
        self.assertTrue(self.action('QUOTE-SUPPLY-INVENTORY-ONLY').is_selected())
        self.assertFalse(self.d.find_elements(By.XPATH, "//*[@aria-label='Resultados de insumos']//*[contains(.,'sin disponibilidad configurada')]"))
        supply_partner_started = time.time(); Select(self.action('QUOTE-SUPPLY-BUSINESS-PARTNER')).select_by_visible_text('Socio sintético A')
        self.assertEqual(Select(self.action('QUOTE-SUPPLY-BUSINESS-PARTNER')).first_selected_option.text, 'Socio sintético A')
        supply_search_started = time.time(); self.fill('Buscar insumos', 'sin coincidencia')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[@role='status' and normalize-space()='No results found']")))
        self.fill('Buscar insumos', 'INS-SYN-001')
        supply_option = self.w.until(EC.element_to_be_clickable((By.XPATH, "//*[@aria-label='Resultados de insumos']//*[@role='option' and contains(.,'Insumo sintético disponible')]")))
        self.assertTrue(supply_option.is_displayed())
        supply_select_started = time.time(); supply_option.click()
        self.assertIn('INS-SYN-001', self.field('Concepto').get_attribute('value'))
        self.fill('Cantidad', '2'); self.fill('Precio manual', '12'); self.click('QUOTE-ITEM-ADD')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//tbody/tr[contains(.,'INS-SYN-001')]")))

        self.w.until(EC.element_to_be_clickable((By.XPATH, "//button[@role='tab' and normalize-space(.)='Estudios Dx']"))).click()
        study_inventory_started = time.time()
        if not self.action('QUOTE-STUDY-INVENTORY-ONLY').is_selected():
            self.click('QUOTE-STUDY-INVENTORY-ONLY')
        self.w.until(lambda _: self.action('QUOTE-STUDY-INVENTORY-ONLY').is_selected())
        study_partner_started = time.time(); Select(self.action('QUOTE-STUDY-BUSINESS-PARTNER')).select_by_visible_text('Socio sintético B')
        self.assertEqual(Select(self.action('QUOTE-STUDY-BUSINESS-PARTNER')).first_selected_option.text, 'Socio sintético B')
        study_search_started = time.time(); self.fill('Buscar estudios', 'hemoglobina')
        study_option = self.w.until(EC.element_to_be_clickable((By.XPATH, "//*[@aria-label='Resultados de estudios']//*[@role='option' and normalize-space()='Estudio sintético de hemoglobina disponible']")))
        self.assertTrue(study_option.is_displayed())
        study_select_started = time.time(); study_option.click()
        self.assertEqual(self.field('Concepto').get_attribute('value'), 'Estudio sintético de hemoglobina disponible')
        self.fill('Cantidad', '1'); self.fill('Precio manual', '9'); self.click('QUOTE-ITEM-ADD')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//tbody/tr[contains(.,'Estudio sintético de hemoglobina disponible')]")))

        self.w.until(EC.element_to_be_clickable((By.XPATH, "//button[@role='tab' and normalize-space(.)='Honorarios']"))).click()
        fee_partner_started = time.time(); Select(self.action('QUOTE-FEE-BUSINESS-PARTNER')).select_by_visible_text('Socio sintético A')
        self.assertEqual(Select(self.action('QUOTE-FEE-BUSINESS-PARTNER')).first_selected_option.text, 'Socio sintético A')
        fee_service_started = time.time(); Select(self.action('QUOTE-FEE-SERVICE-CATALOG')).select_by_visible_text('Seguimiento sintético disponible')
        self.assertEqual(self.field('Concepto').get_attribute('value'), 'Seguimiento sintético disponible')
        Select(self.action('QUOTE-FEE-DOCTOR-SELECT')).select_by_index(1)
        self.fill('Cantidad', '1'); self.fill('Honorario médico (manual)', '15'); self.click('QUOTE-ITEM-ADD')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//tbody/tr[contains(.,'Seguimiento sintético disponible')]")))
        self.click('QUOTE-CREATE-SUBMIT'); self.w.until(EC.url_to_be(f'{BASE}/quotes'))
        quote = next(item for item in self.snapshot()['quotes'] if item['summary'] == marker)
        self.d.refresh(); self.open_detail(quote['id'])
        persisted = self.quote_data(quote['id'])['items']
        self.assertEqual([(item['name'], item['unitPrice']) for item in persisted], [
            ('INS-SYN-001 | Insumo sintético disponible — Fabricante sintético (1)', 12),
            ('Estudio sintético de hemoglobina disponible', 9),
            ('Seguimiento sintético disponible', 15),
        ])
        self.pass_('QUOTE-SUPPLY-INVENTORY-ONLY', 'SEL-CH06-QUOTE-CATALOG', supply_inventory_started)
        self.pass_('QUOTE-SUPPLY-BUSINESS-PARTNER', 'SEL-CH06-QUOTE-CATALOG', supply_partner_started)
        self.pass_('QUOTE-SUPPLY-SEARCH', 'SEL-CH06-QUOTE-CATALOG', supply_search_started)
        self.pass_('QUOTE-SUPPLY-SELECT', 'SEL-CH06-QUOTE-CATALOG', supply_select_started)
        self.pass_('QUOTE-STUDY-INVENTORY-ONLY', 'SEL-CH06-QUOTE-CATALOG', study_inventory_started)
        self.pass_('QUOTE-STUDY-BUSINESS-PARTNER', 'SEL-CH06-QUOTE-CATALOG', study_partner_started)
        self.pass_('QUOTE-STUDY-SEARCH', 'SEL-CH06-QUOTE-CATALOG', study_search_started)
        self.pass_('QUOTE-STUDY-SELECT', 'SEL-CH06-QUOTE-CATALOG', study_select_started)
        self.pass_('QUOTE-FEE-BUSINESS-PARTNER', 'SEL-CH06-QUOTE-CATALOG', fee_partner_started)
        self.pass_('QUOTE-FEE-SERVICE-CATALOG', 'SEL-CH06-QUOTE-CATALOG', fee_service_started)

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
