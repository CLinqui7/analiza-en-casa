"""Independent, assertion-backed Selenium certification for Hospitalizaciones."""
# test-id: SEL-HOSP-NAVIGATION
# test-id: SEL-HOSP-SEARCH
# test-id: SEL-HOSP-FILTERS
# test-id: SEL-HOSP-PAGINATION
# test-id: SEL-HOSP-CREATE
# test-id: SEL-HOSP-DETAIL
# test-id: SEL-HOSP-EDIT

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

from helpers.hospitalization_action_recorder import record_pass, reset


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
        self.w.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN"]')))

    def login_as(self, email: str, password: str, role: str) -> None:
        email_box = self.w.until(EC.visibility_of_element_located((By.XPATH, "//label[contains(.,'Correo')]//input")))
        email_box.clear()
        email_box.send_keys(email)
        password_box = self.d.find_element(By.CSS_SELECTOR, 'input[type=password]')
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
        self.assertEqual(self.d.find_element(By.TAG_NAME, 'h1').text, 'Hospitalizaciones')
        self.w.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'table')))

    def case_row(self, marker: str):
        return self.w.until(EC.presence_of_element_located((By.XPATH, f"//tbody/tr[td[contains(.,'{marker}')]]")))

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
        return row.find_elements(By.CSS_SELECTOR, 'td')[1].text

    def open_detail(self, marker: str) -> str:
        row = self.case_row(marker)
        case_id = row.find_elements(By.CSS_SELECTOR, 'td')[1].text
        row.find_element(By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-DETAIL-NAVIGATE"]').click()
        self.w.until(EC.url_contains(f'/hospitalizations/{case_id}'))
        self.assertEqual(self.d.find_element(By.TAG_NAME, 'h1').text, case_id)
        return case_id

    def stored_case(self, case_id: str) -> dict:
        data = json.loads(self.d.execute_script('return localStorage.getItem("analiza.en.casa.workspace.v2")'))
        return next(item for item in data['hospitalizations'] if item['id'] == case_id)

    def test_navigation_and_roles(self) -> None:
        started = time.time()
        self.click('HOSPITALIZATION-NAVIGATE')
        self.w.until(EC.url_to_be(f'{BASE}/hospitalizations'))
        self.list_ready()
        self.d.refresh()
        self.list_ready()
        self.pass_('HOSPITALIZATION-NAVIGATE', 'SEL-HOSP-NAVIGATION', started)

        role_cases = [
            ('doctor@demo.local', 'demo-doctor', 'DOCTOR', True),
            ('nurse@demo.local', 'demo-nurse', 'NURSE', False),
            ('finance@demo.local', 'demo-finance', 'FINANCE', False),
            ('auditor@demo.local', 'demo-auditor', 'AUDITOR', False),
        ]
        for email, password, role, can_write in role_cases:
            self.prepare_authenticated_test(email, password, role)
            self.d.get(f'{BASE}/hospitalizations')
            self.list_ready()
            controls = self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-CREATE"], [data-action-id="HOSPITALIZATION-EDIT"]')
            self.assertEqual(bool(controls), can_write)
            if not can_write:
                before = self.d.execute_script('return localStorage.getItem("analiza.en.casa.workspace.v2")')
                self.assertFalse(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-CREATE-SUBMIT"]'))
                self.assertEqual(self.d.execute_script('return localStorage.getItem("analiza.en.casa.workspace.v2")'), before)
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
        Select(self.action('HOSPITALIZATION-FILTER-STATE')).select_by_value('ACTIVE')
        rows = self.d.find_elements(By.CSS_SELECTOR, 'tbody tr')
        self.assertTrue(rows and all('Activo' in row.text for row in rows))
        self.pass_('HOSPITALIZATION-FILTER-STATE', 'SEL-HOSP-FILTERS', state_started)
        date_started = time.time()
        date_filter = self.action('HOSPITALIZATION-FILTER-START-DATE')
        self.d.execute_script(
            "const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;"
            "set.call(arguments[0], '2026-08-28');"
            "arguments[0].dispatchEvent(new Event('input', {bubbles: true}));"
            "arguments[0].dispatchEvent(new Event('change', {bubbles: true}));",
            date_filter,
        )
        self.assertEqual(date_filter.get_attribute('value'), '2026-08-28')
        self.w.until(lambda _: len(self.d.find_elements(By.CSS_SELECTOR, 'tbody tr')) == 1)
        rows = self.d.find_elements(By.CSS_SELECTOR, 'tbody tr')
        self.assertEqual(len(rows), 1)
        self.assertIn('2026-08-28', rows[0].text)
        self.pass_('HOSPITALIZATION-FILTER-START-DATE', 'SEL-HOSP-FILTERS', date_started)
        account_started = time.time()
        Select(self.action('HOSPITALIZATION-FILTER-ACCOUNT-TYPE')).select_by_value('Referencia sintética')
        rows = self.d.find_elements(By.CSS_SELECTOR, 'tbody tr')
        self.assertEqual(len(rows), 1)
        self.assertIn('Referencia sintética', rows[0].text)
        self.pass_('HOSPITALIZATION-FILTER-ACCOUNT-TYPE', 'SEL-HOSP-FILTERS', account_started)
        reset_started = time.time()
        self.click('HOSPITALIZATION-FILTER-RESET')
        self.assertEqual(Select(self.action('HOSPITALIZATION-FILTER-STATE')).first_selected_option.get_attribute('value'), '')
        self.assertEqual(self.action('HOSPITALIZATION-FILTER-START-DATE').get_attribute('value'), '')
        self.assertEqual(Select(self.action('HOSPITALIZATION-FILTER-ACCOUNT-TYPE')).first_selected_option.get_attribute('value'), '')
        self.assertIn('Página 1', self.d.find_element(By.TAG_NAME, 'body').text)
        self.assertGreaterEqual(len(self.d.find_elements(By.CSS_SELECTOR, 'tbody tr')), 1)
        self.pass_('HOSPITALIZATION-FILTER-RESET', 'SEL-HOSP-FILTERS', reset_started)

    def test_pagination(self) -> None:
        self.create_fixture('Semilla de paginación Selenium')
        snapshot = json.loads(self.d.execute_script('return localStorage.getItem("analiza.en.casa.workspace.v2")'))
        snapshot['hospitalizations'].extend({
            'id': f'HOS-SEL-PAGE-{number:02d}', 'patientId': 'patient-demo-001', 'startDate': f'2026-08-{number + 1:02d}',
            'status': 'ACTIVE', 'accountType': 'EMPRESA', 'nextAction': f'Página Selenium {number}',
        } for number in range(1, 8))
        self.d.execute_script('localStorage.setItem("analiza.en.casa.workspace.v2", arguments[0])', json.dumps(snapshot))
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
        case_id = row.find_elements(By.CSS_SELECTOR, 'td')[1].text
        self.d.refresh()
        self.case_row('Acción Selenium Hospitalización')
        stored = self.stored_case(case_id)
        for key in ('patientId', 'accountType', 'manager', 'priority', 'diagnosisSummary', 'nextAction', 'devices'):
            self.assertIn(key, stored)
        self.assertEqual(stored['manager'], 'Responsable Selenium Hospitalización')
        self.pass_('HOSPITALIZATION-CREATE', 'SEL-HOSP-CREATE', create_started)
        self.pass_('HOSPITALIZATION-CREATE-SUBMIT', 'SEL-HOSP-CREATE', create_started)

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
        self.assertRegex(self.field('Fecha de inicio').get_attribute('value'), r'^20\d{2}-\d{2}-\d{2}$')
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

    def test_mobile(self) -> None:
        self.d.set_window_size(390, 844)
        try:
            self.d.get(f'{BASE}/hospitalizations')
            self.list_ready()
            self.action('HOSPITALIZATION-SEARCH').send_keys('Aurora')
            self.w.until(EC.visibility_of_element_located((By.XPATH, "//tbody/tr[contains(.,'Paciente Demo Aurora')]")))
            Select(self.action('HOSPITALIZATION-FILTER-STATE')).select_by_value('ACTIVE')
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
