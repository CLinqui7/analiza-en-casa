"""Independent, assertion-backed Selenium certification for Hospitalizaciones."""
# test-id: SEL-HOSP-NAVIGATION
# test-id: SEL-HOSP-SEARCH
# test-id: SEL-HOSP-FILTERS
# test-id: SEL-HOSP-PAGINATION
# test-id: SEL-HOSP-CREATE
# test-id: SEL-HOSP-DETAIL
# test-id: SEL-HOSP-EDIT
# test-id: SEL-B3-HOSPITALIZATION-PERIODS
# test-id: SEL-CH07-HOSPITALIZATION-QUOTES
# test-id: SEL-CH08-ADMINISTRATIVE-PROFILE
# test-id: SEL-CH08-ADMINISTRATIVE-PROFILE-PERMISSIONS
# test-id: SEL-STORAGE-V2-V3-MIGRATION

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

from helpers.hospitalization_action_recorder import complete, record_pass, reset
from helpers.mock_workspace_storage import (
    append_collection_items,
    clear_workspace,
    get_collection,
    get_collections,
    get_hospitalizations,
    legacy_snapshot_exists,
    set_legacy_snapshot,
)


ROOT = Path(__file__).resolve().parents[2]
BASE = os.getenv('SELENIUM_BASE_URL', 'http://127.0.0.1:4174')
SERVER = None


def ready() -> bool:
    try:
        return urlopen(BASE, timeout=1).status < 500  # nosec B310 -- local test server
    except (URLError, TimeoutError, OSError):
        return False


class Hospitalizations(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        global SERVER
        reset()
        if not ready():
            SERVER = subprocess.Popen(
                ['npm.cmd', 'run', 'dev', '--workspace=@analiza/web', '--', '--port', '4174'],
                cwd=ROOT,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
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
        try:
            cls.d.quit()
        finally:
            complete()
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
        clear_workspace(self.d)
        self.d.get(f'{BASE}/login')
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN-EMAIL"]')))
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN-PASSWORD"]')))
        self.w.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN"]')))

    def login_as(self, email: str, password: str, role: str) -> None:
        email_box = self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN-EMAIL"]')))
        email_box.clear()
        email_box.send_keys(email)
        password_box = self.d.find_element(By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN-PASSWORD"]')
        password_box.clear()
        password_box.send_keys(password)
        self.action('AUTH-LOGIN').click()
        self.w.until(EC.url_contains('/dashboard'))
        self.w.until(EC.presence_of_element_located((By.TAG_NAME, 'aside')))
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
        if dialogs:
            return dialogs[-1].find_element(By.XPATH, f".//label[contains(normalize-space(.),'{label}')]//*[self::input or self::select or self::textarea]")
        return self.d.find_element(By.XPATH, f"//label[contains(normalize-space(.),'{label}')]//*[self::input or self::select or self::textarea]")

    def fill(self, label: str, value: str) -> None:
        control = self.field(label)
        control.clear()
        control.send_keys(value)

    def pass_(self, action_id: str, test_id: str, started_at: float) -> None:
        record_pass(action_id, test_id, started_at, self.d.current_url)

    def list_ready(self) -> None:
        self.w.until(EC.visibility_of_element_located((By.TAG_NAME, 'h1')))
        self.assertEqual(self.d.find_element(By.TAG_NAME, 'h1').text, 'Hospitalización')
        self.w.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'table')))

    def case_row(self, marker: str):
        hospitalizations = get_collection(self.d, 'hospitalizations')
        matching = [item for item in hospitalizations if item.get('nextAction') == marker] if isinstance(hospitalizations, list) else []
        needle = matching[0]['id'] if matching else marker
        return self.w.until(EC.presence_of_element_located((By.XPATH, f"//tbody/tr[td[contains(.,'{needle}')]]")))

    def create_fixture(self, marker: str, manager='Responsable Fixture Selenium') -> str:
        self.d.get(f'{BASE}/hospitalizations')
        self.list_ready()
        self.click('HOSPITALIZATION-CREATE')
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-CREATE-SUBMIT"]')))
        Select(self.field('Paciente')).select_by_value('patient-demo-001')
        Select(self.field('Tipo de cuenta')).select_by_value('EMPRESA')
        Select(self.field('Aseguradora')).select_by_value('Aseguradora de demostración')
        self.fill('Responsable administrativo', manager)
        Select(self.field('Prioridad')).select_by_value('HIGH')
        self.fill('Resumen diagnóstico', 'Resumen Fixture Selenium')
        self.fill('Próxima acción', marker)
        self.fill('Dispositivos / accesos', 'Acceso Selenium 1, Acceso Selenium 2')
        self.click('HOSPITALIZATION-CREATE-SUBMIT')
        self.w.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-CREATE-SUBMIT"]')))
        row = self.case_row(marker)
        return row.find_elements(By.CSS_SELECTOR, 'td')[1].text.splitlines()[0]

    def open_detail(self, marker: str) -> str:
        row = self.case_row(marker)
        case_id = row.find_elements(By.CSS_SELECTOR, 'td')[1].text.splitlines()[0]
        row.find_element(By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-DETAIL-NAVIGATE"]').click()
        self.w.until(EC.url_contains(f'/hospitalizations/{case_id}'))
        self.assertEqual(self.d.find_element(By.TAG_NAME, 'h1').text, case_id)
        return case_id

    def stored_case(self, case_id: str) -> dict:
        return next(item for item in get_hospitalizations(self.d) if item['id'] == case_id)

    def test_navigation(self) -> None:
        started = time.time()
        financial_toggle = self.action('FINANCIERO-TOGGLE')
        if financial_toggle.get_attribute('aria-expanded') == 'false':
            financial_toggle.click()
        self.click('HOSPITALIZATION-NAVIGATE')
        self.w.until(EC.url_to_be(f'{BASE}/hospitalizations'))
        self.list_ready()
        self.d.refresh()
        self.list_ready()
        self.pass_('HOSPITALIZATION-NAVIGATE', 'SEL-HOSP-NAVIGATION', started)


    def test_doctor_can_open_hospitalization_write_controls(self) -> None:
        self.prepare_authenticated_test('doctor@demo.local', 'demo-doctor', 'DOCTOR')
        self.d.get(f'{BASE}/hospitalizations')
        self.list_ready()
        self.assertTrue(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-CREATE"]'))
        self.assertTrue(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-EDIT"]'))

    def test_nurse_cannot_alter_hospitalizations_or_audit_entries(self) -> None:
        self.prepare_authenticated_test('nurse@demo.local', 'demo-nurse', 'NURSE')
        self.d.get(f'{BASE}/hospitalizations')
        self.list_ready()
        before = get_collections(self.d, ['hospitalizations', 'auditEntries'])
        self.assertFalse(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-CREATE"], [data-action-id="HOSPITALIZATION-EDIT"], [data-action-id="HOSPITALIZATION-CREATE-SUBMIT"]'))
        self.d.refresh()
        self.assertEqual(get_collections(self.d, ['hospitalizations', 'auditEntries']), before)

    def test_finance_cannot_alter_hospitalizations_or_audit_entries(self) -> None:
        self.prepare_authenticated_test('finance@demo.local', 'demo-finance', 'FINANCE')
        self.d.get(f'{BASE}/hospitalizations')
        self.list_ready()
        before = get_collections(self.d, ['hospitalizations', 'auditEntries'])
        self.assertFalse(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-CREATE"], [data-action-id="HOSPITALIZATION-EDIT"], [data-action-id="HOSPITALIZATION-CREATE-SUBMIT"]'))
        self.d.refresh()
        self.assertEqual(get_collections(self.d, ['hospitalizations', 'auditEntries']), before)

    def test_auditor_cannot_alter_hospitalizations_or_audit_entries(self) -> None:
        self.prepare_authenticated_test('auditor@demo.local', 'demo-auditor', 'AUDITOR')
        self.d.get(f'{BASE}/hospitalizations')
        self.list_ready()
        before = get_collections(self.d, ['hospitalizations', 'auditEntries'])
        self.assertFalse(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-CREATE"], [data-action-id="HOSPITALIZATION-EDIT"], [data-action-id="HOSPITALIZATION-CREATE-SUBMIT"]'))
        self.d.refresh()
        self.assertEqual(get_collections(self.d, ['hospitalizations', 'auditEntries']), before)

    def test_inventory_is_denied_hospitalizations_route(self) -> None:
        self.prepare_authenticated_test('inventory@demo.local', 'demo-inventory', 'INVENTORY')
        self.d.get(f'{BASE}/hospitalizations')
        denied = self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('Acceso restringido para el rol INVENTORY', denied.text)

    def test_search(self) -> None:
        self.d.get(f'{BASE}/hospitalizations')
        self.list_ready()
        started = time.time()
        search = self.action('HOSPITALIZATION-SEARCH')
        for query in ('aurora', '1234 56789', 'case demo 001', 'Aur'):
            search.clear()
            search.send_keys(query)
            self.w.until(EC.visibility_of_element_located((By.XPATH, "//tbody/tr[contains(.,'Paciente Demo Aurora')]")))
            self.assertEqual(len(self.d.find_elements(By.CSS_SELECTOR, 'tbody tr')), 1)
        search.clear()
        search.send_keys('no existe selenium hospitalizacion')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[contains(text(),'Sin resultados')]")))
        self.pass_('HOSPITALIZATION-SEARCH', 'SEL-HOSP-SEARCH', started)
        clear_started = time.time()
        self.click('HOSPITALIZATION-SEARCH-CLEAR')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//tbody/tr[contains(.,'Paciente Demo Aurora')]")))
        self.assertEqual(self.action('HOSPITALIZATION-SEARCH').get_attribute('value'), '')
        self.pass_('HOSPITALIZATION-SEARCH-CLEAR', 'SEL-HOSP-SEARCH', clear_started)

    def test_filters(self) -> None:
        self.d.get(f'{BASE}/hospitalizations')
        self.list_ready()
        state_started = time.time()
        Select(self.action('HOSPITALIZATION-FILTER-STATUS')).select_by_value('ACTIVE')
        self.click('HOSPITALIZATION-FILTER-APPLY')
        rows = self.d.find_elements(By.CSS_SELECTOR, 'tbody tr')
        self.assertTrue(rows and all('Activo' in row.text for row in rows))
        self.pass_('HOSPITALIZATION-FILTER-STATUS', 'SEL-HOSP-FILTERS', state_started)
        self.pass_('HOSPITALIZATION-FILTER-APPLY', 'SEL-HOSP-FILTERS', state_started)
        date_started = time.time()
        date_filter = self.action('HOSPITALIZATION-FILTER-DATE')
        self.d.execute_script(
            "const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;"
            "set.call(arguments[0], '2026-08-28');"
            "arguments[0].dispatchEvent(new Event('input', {bubbles: true}));"
            "arguments[0].dispatchEvent(new Event('change', {bubbles: true}));",
            date_filter,
        )
        self.assertEqual(date_filter.get_attribute('value'), '2026-08-28')
        self.click('HOSPITALIZATION-FILTER-APPLY')
        self.w.until(lambda _: len(self.d.find_elements(By.CSS_SELECTOR, 'tbody tr')) == 1)
        rows = self.d.find_elements(By.CSS_SELECTOR, 'tbody tr')
        self.assertEqual(len(rows), 1)
        self.assertIn('case-demo-001', rows[0].text)
        self.pass_('HOSPITALIZATION-FILTER-DATE', 'SEL-HOSP-FILTERS', date_started)
        account_started = time.time()
        Select(self.action('HOSPITALIZATION-FILTER-ACCOUNT-TYPE')).select_by_value('Referencia sintética')
        self.click('HOSPITALIZATION-FILTER-APPLY')
        rows = self.d.find_elements(By.CSS_SELECTOR, 'tbody tr')
        self.assertEqual(len(rows), 1)
        self.assertIn('Referencia sintética', rows[0].text)
        self.pass_('HOSPITALIZATION-FILTER-ACCOUNT-TYPE', 'SEL-HOSP-FILTERS', account_started)
        reset_started = time.time()
        self.click('HOSPITALIZATION-FILTER-CLEAR')
        self.assertEqual(Select(self.action('HOSPITALIZATION-FILTER-STATUS')).first_selected_option.get_attribute('value'), '')
        self.assertEqual(self.action('HOSPITALIZATION-FILTER-DATE').get_attribute('value'), '')
        self.assertEqual(Select(self.action('HOSPITALIZATION-FILTER-ACCOUNT-TYPE')).first_selected_option.get_attribute('value'), '')
        self.assertIn('Página 1', self.d.find_element(By.TAG_NAME, 'body').text)
        self.assertGreaterEqual(len(self.d.find_elements(By.CSS_SELECTOR, 'tbody tr')), 1)
        self.pass_('HOSPITALIZATION-FILTER-CLEAR', 'SEL-HOSP-FILTERS', reset_started)

    def test_pagination(self) -> None:
        self.create_fixture('Semilla de paginación Selenium')
        append_collection_items(self.d, 'hospitalizations', [{
            'id': f'HOS-SEL-PAGE-{number:02d}', 'patientId': 'patient-demo-001', 'startDate': f'2026-08-{number + 1:02d}',
            'status': 'ACTIVE', 'accountType': 'EMPRESA', 'nextAction': f'Página Selenium {number}',
        } for number in range(1, 8)])
        self.d.get(f'{BASE}/hospitalizations')
        self.list_ready()
        size_started = time.time()
        Select(self.action('HOSPITALIZATION-PAGE-SIZE')).select_by_value('5')
        first_page = [row.text for row in self.d.find_elements(By.CSS_SELECTOR, 'tbody tr')]
        self.assertLessEqual(len(first_page), 5)
        self.assertIn('Página 1 de 2', self.d.find_element(By.TAG_NAME, 'body').text)
        self.pass_('HOSPITALIZATION-PAGE-SIZE', 'SEL-HOSP-PAGINATION', size_started)
        next_started = time.time()
        self.click('HOSPITALIZATION-PAGE-NEXT')
        second_page = [row.text for row in self.d.find_elements(By.CSS_SELECTOR, 'tbody tr')]
        self.assertNotEqual(first_page, second_page)
        self.assertIn('Página 2 de 2', self.d.find_element(By.TAG_NAME, 'body').text)
        self.pass_('HOSPITALIZATION-PAGE-NEXT', 'SEL-HOSP-PAGINATION', next_started)
        previous_started = time.time()
        self.click('HOSPITALIZATION-PAGE-PREV')
        self.assertEqual(first_page, [row.text for row in self.d.find_elements(By.CSS_SELECTOR, 'tbody tr')])
        self.pass_('HOSPITALIZATION-PAGE-PREV', 'SEL-HOSP-PAGINATION', previous_started)

    def test_storage_v2_to_v3_migration(self) -> None:
        """A valid legacy snapshot is migrated once, then remains segmented."""
        snapshot = {
            'patients': [{'id': 'patient-demo-001', 'fullName': 'Paciente Demo Aurora', 'documentType': 'DUI', 'documentId': '12345678-9', 'status': 'ACTIVE'}],
            'vitalReadings': [], 'nursingResources': [], 'nurseHours': [], 'inventoryMovements': [],
            'shifts': [],
            'hospitalizations': [{'id': 'HOS-V2-MIGRATION-001', 'patientId': 'patient-demo-001', 'startDate': '2026-08-28', 'status': 'ACTIVE', 'accountType': 'PARTICULAR'}],
            'quotes': [], 'payments': [], 'clinicalDocuments': [], 'catalogItems': [], 'purchases': [],
            'insuranceRequests': [], 'insuranceEvents': [],
            'auditEntries': [{'id': 'audit-v2-migration', 'at': '2026-08-28T00:00:00.000Z', 'action': 'Migración Selenium', 'subject': 'HOS-V2-MIGRATION-001'}],
        }
        clear_workspace(self.d, clear_session=False)
        set_legacy_snapshot(self.d, snapshot)
        self.d.get(f'{BASE}/login')
        self.d.get(f'{BASE}/hospitalizations')
        self.list_ready()
        seeded = snapshot['hospitalizations'][0]
        self.assertIn(seeded['id'], self.d.find_element(By.TAG_NAME, 'body').text)
        self.assertTrue(get_hospitalizations(self.d))
        self.assertFalse(legacy_snapshot_exists(self.d))
        self.d.refresh()
        self.list_ready()
        self.assertIn(seeded['id'], self.d.find_element(By.TAG_NAME, 'body').text)

    def test_create_and_validation(self) -> None:
        self.d.get(f'{BASE}/hospitalizations')
        self.list_ready()
        self.click('HOSPITALIZATION-CREATE')
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-CREATE-SUBMIT"]')))
        Select(self.field('Paciente')).select_by_value('')
        self.click('HOSPITALIZATION-CREATE-SUBMIT')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[contains(text(),'Seleccione un paciente.')]")))
        self.assertTrue(self.action('HOSPITALIZATION-CREATE-SUBMIT').is_displayed())
        cancel_started = time.time()
        self.fill('Próxima acción', 'Temporal Selenium No Persistir')
        self.click('HOSPITALIZATION-CREATE-CANCEL')
        self.w.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-CREATE-SUBMIT"]')))
        self.d.refresh()
        self.assertNotIn('Temporal Selenium No Persistir', self.d.find_element(By.TAG_NAME, 'body').text)
        self.pass_('HOSPITALIZATION-CREATE-CANCEL', 'SEL-HOSP-CREATE', cancel_started)
        create_started = time.time()
        self.click('HOSPITALIZATION-CREATE')
        Select(self.field('Paciente')).select_by_value('patient-demo-001')
        Select(self.field('Tipo de cuenta')).select_by_value('EMPRESA')
        Select(self.field('Aseguradora')).select_by_value('Aseguradora de demostración')
        self.fill('Responsable administrativo', 'Responsable Selenium Hospitalización')
        Select(self.field('Prioridad')).select_by_value('HIGH')
        self.fill('Resumen diagnóstico', 'Resumen Selenium Hospitalización')
        self.fill('Próxima acción', 'Acción Selenium Hospitalización')
        self.fill('Dispositivos / accesos', 'Acceso Selenium 1, Acceso Selenium 2')
        self.click('HOSPITALIZATION-CREATE-SUBMIT')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[contains(text(),'persistida')]")))
        row = self.case_row('Acción Selenium Hospitalización')
        case_id = row.find_elements(By.CSS_SELECTOR, 'td')[1].text.splitlines()[0]
        self.d.refresh()
        self.case_row('Acción Selenium Hospitalización')
        stored = self.stored_case(case_id)
        for key in ('patientId', 'accountType', 'manager', 'priority', 'diagnosisSummary', 'nextAction', 'devices'):
            self.assertIn(key, stored)
        self.assertEqual(stored['manager'], 'Responsable Selenium Hospitalización')
        self.pass_('HOSPITALIZATION-CREATE', 'SEL-HOSP-CREATE', create_started)
        self.pass_('HOSPITALIZATION-CREATE-SUBMIT', 'SEL-HOSP-CREATE', create_started)

    def test_admission_periods_persist_without_attachment_bytes(self) -> None:
        self.d.get(f'{BASE}/hospitalizations')
        self.list_ready()
        started = time.time()
        self.click('HOSPITALIZATION-CREATE')
        Select(self.field('Paciente')).select_by_value('patient-demo-001')
        self.fill('Fecha de ingreso', '2026-09-10')
        self.fill('Fecha de egreso (opcional)', '2026-09-12')
        self.click('HOSPITALIZATION-ADMISSION-PERIOD-ADD')
        self.fill('Ingreso adicional 1', '2026-09-20')
        self.fill('Egreso adicional 1', '2026-09-21')
        self.click('HOSPITALIZATION-ADMISSION-PERIOD-ADD')
        self.fill('Ingreso adicional 2', '2026-09-25')
        self.fill('Egreso adicional 2', '2026-09-26')
        self.d.find_element(By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-ADMISSION-PERIOD-REMOVE"]').click()
        self.assertEqual(self.field('Ingreso adicional 1').get_attribute('value'), '2026-09-25')
        self.assertEqual(self.field('Egreso adicional 1').get_attribute('value'), '2026-09-26')
        self.assertFalse(self.d.find_elements(By.XPATH, "//label[contains(., 'Ingreso adicional 2')]//input"))
        self.assertFalse(self.d.find_elements(By.CSS_SELECTOR, 'input[type="file"]'))
        self.fill('Próxima acción', 'Períodos B3 Selenium')
        self.click('HOSPITALIZATION-CREATE-SUBMIT')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[contains(text(),'persistida')]")))
        self.d.refresh()
        row = self.case_row('Períodos B3 Selenium')
        row.find_element(By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-EDIT"]').click()
        self.assertEqual(self.field('Fecha de ingreso').get_attribute('value'), '2026-09-10')
        self.assertEqual(self.field('Fecha de egreso (opcional)').get_attribute('value'), '2026-09-12')
        self.assertEqual(self.field('Ingreso adicional 1').get_attribute('value'), '2026-09-25')
        self.assertEqual(self.field('Egreso adicional 1').get_attribute('value'), '2026-09-26')
        self.assertFalse(self.d.find_elements(By.XPATH, "//label[contains(., 'Ingreso adicional 2')]//input"))
        self.pass_('HOSPITALIZATION-ADMISSION-DATE', 'SEL-B3-HOSPITALIZATION-PERIODS', started)
        self.pass_('HOSPITALIZATION-DISCHARGE-DATE', 'SEL-B3-HOSPITALIZATION-PERIODS', started)
        self.pass_('HOSPITALIZATION-ADMISSION-PERIOD-ADD', 'SEL-B3-HOSPITALIZATION-PERIODS', started)
        self.pass_('HOSPITALIZATION-ADMISSION-PERIOD-DATE', 'SEL-B3-HOSPITALIZATION-PERIODS', started)
        self.pass_('HOSPITALIZATION-DISCHARGE-PERIOD-DATE', 'SEL-B3-HOSPITALIZATION-PERIODS', started)
        self.pass_('HOSPITALIZATION-ADMISSION-PERIOD-REMOVE', 'SEL-B3-HOSPITALIZATION-PERIODS', started)

    def test_detail_navigation(self) -> None:
        marker = 'Acción detalle Selenium'
        self.create_fixture(marker)
        detail_started = time.time()
        case_id = self.open_detail(marker)
        body = self.d.find_element(By.TAG_NAME, 'body').text
        for value in (case_id, 'Paciente Demo Aurora', '12345678-9', 'EMPRESA', 'Activo', 'Responsable Fixture Selenium', marker, 'Alta', 'Resumen Fixture Selenium', 'Acceso Selenium 1, Acceso Selenium 2'):
            self.assertIn(value, body)
        self.pass_('HOSPITALIZATION-DETAIL-NAVIGATE', 'SEL-HOSP-DETAIL', detail_started)
        back_started = time.time()
        self.click('HOSPITALIZATION-BACK-TO-LIST')
        self.w.until(EC.url_to_be(f'{BASE}/hospitalizations'))
        self.list_ready()
        self.pass_('HOSPITALIZATION-BACK-TO-LIST', 'SEL-HOSP-DETAIL', back_started)

    def test_edit(self) -> None:
        marker = 'Acción edición Selenium Original'
        self.create_fixture(marker)
        case_id = self.open_detail(marker)
        detail_edit_started = time.time()
        self.click('HOSPITALIZATION-DETAIL-EDIT')
        self.w.until(EC.url_contains(f'/hospitalizations?edit={case_id}'))
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-EDIT-SUBMIT"]')))
        self.assertEqual(Select(self.field('Paciente')).first_selected_option.get_attribute('value'), 'patient-demo-001')
        self.assertRegex(self.field('Fecha de ingreso').get_attribute('value'), r'^20\d{2}-\d{2}-\d{2}$')
        self.assertEqual(Select(self.field('Tipo de cuenta')).first_selected_option.get_attribute('value'), 'EMPRESA')
        self.assertEqual(self.field('Responsable administrativo').get_attribute('value'), 'Responsable Fixture Selenium')
        self.assertEqual(Select(self.field('Prioridad')).first_selected_option.get_attribute('value'), 'HIGH')
        self.assertEqual(self.field('Próxima acción').get_attribute('value'), marker)
        self.pass_('HOSPITALIZATION-DETAIL-EDIT', 'SEL-HOSP-EDIT', detail_edit_started)
        self.click('HOSPITALIZATION-EDIT-CANCEL')
        self.w.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-EDIT-SUBMIT"]')))

        row = self.case_row(marker)
        edit_started = time.time()
        row.find_element(By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-EDIT"]').click()
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-EDIT-SUBMIT"]')))
        self.assertEqual(self.field('Responsable administrativo').get_attribute('value'), 'Responsable Fixture Selenium')
        self.assertEqual(self.field('Próxima acción').get_attribute('value'), marker)
        self.pass_('HOSPITALIZATION-EDIT', 'SEL-HOSP-EDIT', edit_started)
        cancel_started = time.time()
        self.fill('Responsable administrativo', 'NO GUARDAR SELENIUM')
        self.fill('Próxima acción', 'NO GUARDAR ACCIÓN')
        self.click('HOSPITALIZATION-EDIT-CANCEL')
        self.w.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-EDIT-SUBMIT"]')))
        self.open_detail(marker)
        body = self.d.find_element(By.TAG_NAME, 'body').text
        self.assertIn('Responsable Fixture Selenium', body)
        self.assertNotIn('NO GUARDAR SELENIUM', body)
        self.d.refresh()
        self.assertNotIn('NO GUARDAR ACCIÓN', self.d.find_element(By.TAG_NAME, 'body').text)
        self.click('HOSPITALIZATION-BACK-TO-LIST')
        self.pass_('HOSPITALIZATION-EDIT-CANCEL', 'SEL-HOSP-EDIT', cancel_started)

        row = self.case_row(marker)
        row.find_element(By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-EDIT"]').click()
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-EDIT-SUBMIT"]')))
        submit_started = time.time()
        self.fill('Responsable administrativo', 'Responsable Selenium Editado')
        Select(self.field('Prioridad')).select_by_value('LOW')
        self.fill('Resumen diagnóstico', 'Resumen Selenium Editado')
        self.fill('Próxima acción', 'Próxima Acción Selenium Editada')
        self.fill('Dispositivos / accesos', 'Dispositivo Selenium A, Dispositivo Selenium B')
        self.click('HOSPITALIZATION-EDIT-SUBMIT')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[contains(text(),'actualizada y persistida')]")))
        self.open_detail('Próxima Acción Selenium Editada')
        body = self.d.find_element(By.TAG_NAME, 'body').text
        for value in ('Responsable Selenium Editado', 'Baja', 'Resumen Selenium Editado', 'Próxima Acción Selenium Editada', 'Dispositivo Selenium A, Dispositivo Selenium B'):
            self.assertIn(value, body)
        stored = self.stored_case(case_id)
        self.assertEqual(stored['manager'], 'Responsable Selenium Editado')
        self.assertEqual(stored['priority'], 'LOW')
        self.assertEqual(stored['diagnosisSummary'], 'Resumen Selenium Editado')
        self.assertEqual(stored['nextAction'], 'Próxima Acción Selenium Editada')
        self.assertEqual(stored['devices'], ['Dispositivo Selenium A', 'Dispositivo Selenium B'])
        self.d.refresh()
        self.assertIn('Próxima Acción Selenium Editada', self.d.find_element(By.TAG_NAME, 'body').text)
        self.pass_('HOSPITALIZATION-EDIT-SUBMIT', 'SEL-HOSP-EDIT', submit_started)

    def test_ch08_administrative_profile_saves_and_cancellation_does_not_persist(self) -> None:
        marker = 'Perfil administrativo CH08 Selenium'
        case_id = self.create_fixture(marker)
        self.open_detail(marker)

        open_started = time.time()
        self.click('HOSPITALIZATION-ADMIN-PROFILE-OPEN')
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-ADMIN-PROFILE-SAVE"]')))
        self.assertEqual(self.field('Fecha de inicio').get_attribute('value')[:10], self.stored_case(case_id)['startDate'])
        self.pass_('HOSPITALIZATION-ADMIN-PROFILE-OPEN', 'SEL-CH08-ADMINISTRATIVE-PROFILE', open_started)

        cancel_started = time.time()
        self.fill('Health manager', 'No persistir CH08 Selenium')
        self.click('HOSPITALIZATION-ADMIN-PROFILE-CANCEL')
        self.w.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-ADMIN-PROFILE-SAVE"]')))
        self.d.refresh()
        self.assertNotIn('No persistir CH08 Selenium', self.d.find_element(By.TAG_NAME, 'body').text)
        self.pass_('HOSPITALIZATION-ADMIN-PROFILE-CANCEL', 'SEL-CH08-ADMINISTRATIVE-PROFILE', cancel_started)

        self.click('HOSPITALIZATION-ADMIN-PROFILE-OPEN')
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-ADMIN-PROFILE-SAVE"]')))
        self.fill('Health manager', 'Coordinación Selenium CH08')
        self.fill('Referido por', 'Referencia Selenium CH08')
        self.fill('Tipo Revenue', 'Recurrente')
        profile_dialog = self.d.find_elements(By.CSS_SELECTOR, '[role="dialog"]')[-1]
        profile_dialog.find_element(By.XPATH, ".//label[normalize-space()='Tipo']/input").send_keys('Normal')
        self.fill('Días de duración', '5')
        self.fill('Forma de pago', 'Aseguradora')
        self.fill('Aseguradora', 'Aseguradora sintética Selenium')
        self.fill('Tipo de solicitud', 'Reclamo')
        self.fill('Categoría mayor', 'Hospitalización')
        self.fill('Subcategoría', 'Aplicación')
        self.fill('Hospital de origen', 'Origen sintético')
        self.fill('Clase de paciente', 'Regular')
        save_started = time.time()
        self.click('HOSPITALIZATION-ADMIN-PROFILE-SAVE')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[contains(text(),'Perfil administrativo de ejecución guardado')]")))
        self.d.refresh()
        body = self.d.find_element(By.TAG_NAME, 'body').text
        for value in ('Coordinación Selenium CH08', 'Referencia Selenium CH08', 'Recurrente', 'Aseguradora sintética Selenium'):
            self.assertIn(value, body)
        self.click('HOSPITALIZATION-ADMIN-PROFILE-OPEN')
        self.assertEqual(self.field('Días de duración').get_attribute('value'), '5')
        self.assertEqual(self.field('Hospital de origen').get_attribute('value'), 'Origen sintético')
        self.pass_('HOSPITALIZATION-ADMIN-PROFILE-SAVE', 'SEL-CH08-ADMINISTRATIVE-PROFILE', save_started)
        self.click('HOSPITALIZATION-ADMIN-PROFILE-CANCEL')

    def test_ch08_admin_can_open_profile_on_direct_detail_route(self) -> None:
        self.prepare_authenticated_test()
        self.d.get(f'{BASE}/hospitalizations/case-demo-001')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//h1[normalize-space()='case-demo-001']")))
        self.click('HOSPITALIZATION-ADMIN-PROFILE-OPEN')
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-ADMIN-PROFILE-SAVE"]')))
        self.assertEqual(self.field('Health manager').tag_name, 'input')
        self.click('HOSPITALIZATION-ADMIN-PROFILE-CANCEL')

    def test_ch08_doctor_can_open_profile_on_direct_detail_route(self) -> None:
        self.prepare_authenticated_test('doctor@demo.local', 'demo-doctor', 'DOCTOR')
        self.d.get(f'{BASE}/hospitalizations/case-demo-001')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//h1[normalize-space()='case-demo-001']")))
        self.click('HOSPITALIZATION-ADMIN-PROFILE-OPEN')
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-ADMIN-PROFILE-SAVE"]')))
        self.assertEqual(self.field('Health manager').tag_name, 'input')
        self.click('HOSPITALIZATION-ADMIN-PROFILE-CANCEL')

    def test_ch08_nurse_direct_detail_has_no_profile_controls_or_mutation(self) -> None:
        self.prepare_authenticated_test('nurse@demo.local', 'demo-nurse', 'NURSE')
        self.d.get(f'{BASE}/hospitalizations/case-demo-001')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//h1[normalize-space()='case-demo-001']")))
        before = get_collections(self.d, ['hospitalizations', 'auditEntries'])
        self.assertFalse(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-ADMIN-PROFILE-OPEN"]'))
        self.assertFalse(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-ADMIN-PROFILE-SAVE"]'))
        self.assertFalse(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-ADMIN-PROFILE-CANCEL"]'))
        self.d.refresh()
        self.assertEqual(get_collections(self.d, ['hospitalizations', 'auditEntries']), before)

    def test_ch08_finance_direct_detail_has_no_profile_controls_or_mutation(self) -> None:
        self.prepare_authenticated_test('finance@demo.local', 'demo-finance', 'FINANCE')
        self.d.get(f'{BASE}/hospitalizations/case-demo-001')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//h1[normalize-space()='case-demo-001']")))
        before = get_collections(self.d, ['hospitalizations', 'auditEntries'])
        self.assertFalse(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-ADMIN-PROFILE-OPEN"]'))
        self.assertFalse(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-ADMIN-PROFILE-SAVE"]'))
        self.assertFalse(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-ADMIN-PROFILE-CANCEL"]'))
        self.d.refresh()
        self.assertEqual(get_collections(self.d, ['hospitalizations', 'auditEntries']), before)

    def test_ch08_auditor_direct_detail_has_no_profile_controls_or_mutation(self) -> None:
        self.prepare_authenticated_test('auditor@demo.local', 'demo-auditor', 'AUDITOR')
        self.d.get(f'{BASE}/hospitalizations/case-demo-001')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//h1[normalize-space()='case-demo-001']")))
        before = get_collections(self.d, ['hospitalizations', 'auditEntries'])
        self.assertFalse(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-ADMIN-PROFILE-OPEN"]'))
        self.assertFalse(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-ADMIN-PROFILE-SAVE"]'))
        self.assertFalse(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-ADMIN-PROFILE-CANCEL"]'))
        self.d.refresh()
        self.assertEqual(get_collections(self.d, ['hospitalizations', 'auditEntries']), before)

    def test_ch08_inventory_is_denied_direct_hospitalization_detail_route(self) -> None:
        self.prepare_authenticated_test('inventory@demo.local', 'demo-inventory', 'INVENTORY')
        self.d.get(f'{BASE}/hospitalizations/case-demo-001')
        alert = self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('Acceso restringido para el rol INVENTORY', alert.text)
        self.assertFalse(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-ADMIN-PROFILE-OPEN"]'))

    def test_ch07_quote_tracking_filters_search_and_pages_without_insurance_mutation(self) -> None:
        self.d.get(f'{BASE}/hospitalizations')
        self.list_ready()
        quotes = get_collection(self.d, 'quotes')
        self.assertTrue(isinstance(quotes, list) and quotes)
        base = quotes[0]
        fixtures = [
            {**base, 'id': 'quote-ch07-sel-1', 'createdAt': '2026-09-01T12:00:00.000Z', 'status': 'DRAFT'},
            {**base, 'id': 'quote-ch07-sel-2', 'createdAt': '2026-09-02T12:00:00.000Z', 'status': 'DRAFT'},
            {**base, 'id': 'quote-ch07-sel-3', 'createdAt': '2026-09-03T12:00:00.000Z', 'status': 'DRAFT'},
            {**base, 'id': 'quote-ch07-sel-4', 'createdAt': '2026-09-04T12:00:00.000Z', 'status': 'DRAFT'},
            {**base, 'id': 'quote-ch07-sel-5', 'createdAt': '2026-09-05T12:00:00.000Z', 'status': 'DRAFT'},
            {**base, 'id': 'quote-ch07-sel-6', 'createdAt': '2026-09-06T12:00:00.000Z', 'status': 'SENT'},
        ]
        append_collection_items(self.d, 'quotes', fixtures)
        self.d.refresh()
        tab_started = time.time()
        self.click('HOSPITALIZATION-TAB-QUOTES')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//h2[normalize-space(.)='Cotizaciones']")))
        self.assertTrue(self.d.find_elements(By.XPATH, "//th[normalize-space(.)='Respuesta seguro']"))
        self.pass_('HOSPITALIZATION-TAB-QUOTES', 'SEL-CH07-HOSPITALIZATION-QUOTES', tab_started)

        status_started = time.time()
        Select(self.action('HOSPITALIZATION-QUOTE-FILTER-STATUS')).select_by_value('SENT')
        self.assertEqual(Select(self.action('HOSPITALIZATION-QUOTE-FILTER-STATUS')).first_selected_option.get_attribute('value'), 'SENT')
        self.pass_('HOSPITALIZATION-QUOTE-FILTER-STATUS', 'SEL-CH07-HOSPITALIZATION-QUOTES', status_started)
        apply_started = time.time()
        self.click('HOSPITALIZATION-QUOTE-FILTER-APPLY')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//tbody/tr[td[contains(.,'quote-ch07-sel-6')]]")))
        self.assertEqual(len(self.d.find_elements(By.CSS_SELECTOR, 'tbody tr')), 1)
        self.pass_('HOSPITALIZATION-QUOTE-FILTER-APPLY', 'SEL-CH07-HOSPITALIZATION-QUOTES', apply_started)

        date_started = time.time()
        date = self.action('HOSPITALIZATION-QUOTE-FILTER-DATE')
        self.d.execute_script("arguments[0].value='2000-01-01'; arguments[0].dispatchEvent(new Event('input', {bubbles:true})); arguments[0].dispatchEvent(new Event('change', {bubbles:true}));", date)
        self.assertEqual(date.get_attribute('value'), '2000-01-01')
        self.pass_('HOSPITALIZATION-QUOTE-FILTER-DATE', 'SEL-CH07-HOSPITALIZATION-QUOTES', date_started)
        self.click('HOSPITALIZATION-QUOTE-FILTER-APPLY')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[normalize-space(.)='Sin cotizaciones']")))

        clear_started = time.time()
        self.click('HOSPITALIZATION-QUOTE-FILTER-CLEAR')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//tbody/tr[td[contains(.,'quote-ch07-sel-1')]]")))
        self.assertEqual(Select(self.action('HOSPITALIZATION-QUOTE-FILTER-STATUS')).first_selected_option.get_attribute('value'), '')
        self.assertEqual(self.action('HOSPITALIZATION-QUOTE-FILTER-DATE').get_attribute('value'), '')
        self.pass_('HOSPITALIZATION-QUOTE-FILTER-CLEAR', 'SEL-CH07-HOSPITALIZATION-QUOTES', clear_started)

        size_started = time.time()
        Select(self.action('HOSPITALIZATION-QUOTE-PAGE-SIZE')).select_by_value('5')
        self.assertEqual(len(self.d.find_elements(By.CSS_SELECTOR, 'tbody tr')), 5)
        self.pass_('HOSPITALIZATION-QUOTE-PAGE-SIZE', 'SEL-CH07-HOSPITALIZATION-QUOTES', size_started)
        next_started = time.time()
        self.click('HOSPITALIZATION-QUOTE-PAGE-NEXT')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//tbody/tr[td[contains(.,'quote-ch07-sel-5')]]")))
        self.pass_('HOSPITALIZATION-QUOTE-PAGE-NEXT', 'SEL-CH07-HOSPITALIZATION-QUOTES', next_started)
        previous_started = time.time()
        self.click('HOSPITALIZATION-QUOTE-PAGE-PREV')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//tbody/tr[td[contains(.,'quote-ch07-sel-1')]]")))
        self.pass_('HOSPITALIZATION-QUOTE-PAGE-PREV', 'SEL-CH07-HOSPITALIZATION-QUOTES', previous_started)
        search_started = time.time()
        search = self.action('HOSPITALIZATION-QUOTE-SEARCH')
        search.send_keys('quote-ch07-sel-6')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//tbody/tr[td[contains(.,'quote-ch07-sel-6')]]")))
        self.assertEqual(len(self.d.find_elements(By.CSS_SELECTOR, 'tbody tr')), 1)
        self.pass_('HOSPITALIZATION-QUOTE-SEARCH', 'SEL-CH07-HOSPITALIZATION-QUOTES', search_started)

    def test_mobile(self) -> None:
        self.d.set_window_size(390, 844)
        try:
            self.d.get(f'{BASE}/hospitalizations')
            self.list_ready()
            self.action('HOSPITALIZATION-SEARCH').send_keys('Aurora')
            self.w.until(EC.visibility_of_element_located((By.XPATH, "//tbody/tr[contains(.,'Paciente Demo Aurora')]")))
            Select(self.action('HOSPITALIZATION-FILTER-STATUS')).select_by_value('ACTIVE')
            self.click('HOSPITALIZATION-FILTER-APPLY')
            self.click('HOSPITALIZATION-CREATE')
            submit = self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-CREATE-SUBMIT"]')))
            self.d.execute_script('arguments[0].scrollIntoView({block:"center"});', submit)
            self.assertTrue(submit.is_displayed())
            self.click('HOSPITALIZATION-CREATE-CANCEL')
            self.action('HOSPITALIZATION-SEARCH').clear()
            self.case_row('Paciente Demo Aurora').find_element(By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-DETAIL-NAVIGATE"]').click()
            self.w.until(EC.url_contains('/hospitalizations/'))
            self.click('HOSPITALIZATION-BACK-TO-LIST')
            width, viewport = self.d.execute_script('return [document.documentElement.scrollWidth, window.innerWidth]')
            self.assertLessEqual(width, viewport + 8, f'critical horizontal overflow: {width}px > {viewport}px')
        finally:
            self.d.set_window_size(1440, 1000)


if __name__ == '__main__':
    unittest.main(verbosity=2)
