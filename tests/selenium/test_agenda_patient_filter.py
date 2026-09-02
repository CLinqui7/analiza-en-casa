"""CH11 factual agenda filter source coverage; records only after visible effects."""
# test-id: SEL-CH11-AGENDA-PATIENT-FILTER
# test-id: SEL-CH11-CALENDAR-NAVIGATION-VIEWS
# test-id: SEL-CH11-AGENDA-PATIENT-CONTEXT
# test-id: SEL-CH11-AGENDA-PATIENT-CONTEXT-SAVE
# test-id: SEL-CH11-SYNTHETIC-SHIFT-DETAIL
from __future__ import annotations

import os
import subprocess
import time
import unittest
from urllib.error import URLError
from urllib.request import urlopen

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as conditions
from selenium.webdriver.support.ui import WebDriverWait

from helpers.action_recorder import record_pass, reset

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.getenv('SELENIUM_BASE_URL', 'http://127.0.0.1:4174')
SERVER = None


def ready() -> bool:
    try:
        return urlopen(BASE, timeout=1).status < 500  # nosec B310: local test server only
    except (URLError, TimeoutError, OSError):
        return False


class AgendaPatientFilter(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        global SERVER
        reset()
        if not ready():
            SERVER = subprocess.Popen(['npm.cmd', 'run', 'dev', '--workspace=@analiza/web', '--', '--port', '4174'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        for _ in range(60):
            if ready():
                break
            time.sleep(1)
        else:
            raise RuntimeError('El servidor React local no inició en 60 segundos.')
        options = webdriver.ChromeOptions(); options.add_argument('--headless=new'); options.add_argument('--window-size=1440,1000')
        cls.driver = webdriver.Chrome(options=options); cls.wait = WebDriverWait(cls.driver, 12)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.driver.quit()
        if SERVER:
            SERVER.terminate()

    def login(self, email: str, password: str) -> None:
        self.driver.get(f'{BASE}/login?next=%2Fagenda')
        self.driver.execute_script('localStorage.clear()')
        self.driver.refresh()
        self.wait.until(conditions.visibility_of_element_located((By.XPATH, "//label[contains(., 'Usuario')]//input"))).send_keys(email)
        self.driver.find_element(By.CSS_SELECTOR, 'input[type=password]').send_keys(password)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN"]').click()
        self.wait.until(conditions.url_contains('/agenda'))

    def test_admin_searches_and_filters_visible_patient_events(self) -> None:
        started = time.time()
        self.login('admin@demo.local', 'demo-admin')
        search = self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-PATIENT-SEARCH"]')
        search.send_keys('Aurora')
        self.assertIn('Paciente Demo Aurora', self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-PATIENT-FILTER"]').text)
        record_pass('AGENDA-PATIENT-SEARCH', 'SEL-CH11-AGENDA-PATIENT-FILTER', started, self.driver.current_url)
        selector = self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-PATIENT-FILTER"]')
        from selenium.webdriver.support.ui import Select
        Select(selector).select_by_value('patient-demo-001')
        calendar = self.driver.find_element(By.CSS_SELECTOR, '[aria-label="Calendario de agosto de 2026"]')
        self.assertIn('Paciente Demo Aurora', calendar.text)
        self.assertNotIn('Paciente Demo Brisa', calendar.text)
        record_pass('AGENDA-PATIENT-FILTER', 'SEL-CH11-AGENDA-PATIENT-FILTER', started, self.driver.current_url)

    def test_doctor_can_read_filtered_agenda(self) -> None:
        self.login('doctor@demo.local', 'demo-doctor')
        self.assertTrue(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-PATIENT-FILTER"]').is_enabled())
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-CALENDAR-VIEW-WEEK"]').click()
        self.assertIn('Semana del', self.driver.find_element(By.CSS_SELECTOR, '.agenda-period-label').text)
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-CREATE"]'))

    def test_inventory_is_denied_direct_agenda_route(self) -> None:
        self.login('inventory@demo.local', 'demo-inventory')
        denied = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('Acceso restringido para el rol INVENTORY', denied.text)

    def test_doctor_reads_existing_synthetic_shift_detail_without_mutation(self) -> None:
        started = time.time()
        self.login('doctor@demo.local', 'demo-doctor')
        before = self.driver.execute_script("return ['shifts', 'auditEntries'].map((key) => localStorage.getItem('analiza.en.casa.workspace.v3.' + key))")
        self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-DETAIL-OPEN"]')[0].click()
        dialog = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, '[role="dialog"]')))
        self.assertIn('Detalle del turno sintético', dialog.text)
        self.assertIn('Inicio', dialog.text)
        self.assertIn('Fin', dialog.text)
        self.assertIn('Paciente', dialog.text)
        self.assertIn('Recurso asignado', dialog.text)
        self.assertIn('Estado registrado', dialog.text)
        self.assertFalse(dialog.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-DETAIL-UPDATES"]').is_enabled())
        record_pass('AGENDA-SHIFT-DETAIL-OPEN', 'SEL-CH11-SYNTHETIC-SHIFT-DETAIL', started, self.driver.current_url)
        record_pass('AGENDA-SHIFT-DETAIL-UPDATES', 'SEL-CH11-SYNTHETIC-SHIFT-DETAIL', started, self.driver.current_url)
        dialog.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-DETAIL-CLOSE"]').click()
        self.wait.until(conditions.invisibility_of_element_located((By.CSS_SELECTOR, '[role="dialog"]')))
        self.driver.refresh()
        self.assertEqual(before, self.driver.execute_script("return ['shifts', 'auditEntries'].map((key) => localStorage.getItem('analiza.en.casa.workspace.v3.' + key))"))
        record_pass('AGENDA-SHIFT-DETAIL-CLOSE', 'SEL-CH11-SYNTHETIC-SHIFT-DETAIL', started, self.driver.current_url)

    def test_admin_sees_factual_patient_context_in_shift_form_without_visit_mutation(self) -> None:
        started = time.time()
        self.login('admin@demo.local', 'demo-admin')
        before = self.driver.execute_script("return ['shifts', 'auditEntries'].map((key) => localStorage.getItem('analiza.en.casa.workspace.v3.' + key))")
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-CREATE"]').click()
        dialog = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, '[role="dialog"]')))
        self.assertIn('Crear turno a paciente', dialog.text)
        record_pass('AGENDA-SHIFT-CREATE', 'SEL-CH11-AGENDA-PATIENT-CONTEXT', started, self.driver.current_url)
        from selenium.webdriver.support.ui import Select
        Select(dialog.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-PATIENT-SELECT"]')).select_by_value('patient-demo-001')
        self.assertEqual(dialog.find_element(By.CSS_SELECTOR, '[aria-label="Documento del paciente"]').get_attribute('value'), 'DUI 12345678-9')
        self.assertEqual(dialog.find_element(By.CSS_SELECTOR, '[aria-label="Empresa del paciente"]').get_attribute('value'), 'Sin empresa registrada')
        record_pass('AGENDA-SHIFT-PATIENT-SELECT', 'SEL-CH11-AGENDA-PATIENT-CONTEXT', started, self.driver.current_url)
        dialog.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-CLOSE"]').click()
        self.wait.until(conditions.invisibility_of_element_located((By.CSS_SELECTOR, '[role="dialog"]')))
        self.driver.refresh()
        self.assertEqual(before, self.driver.execute_script("return ['shifts', 'auditEntries'].map((key) => localStorage.getItem('analiza.en.casa.workspace.v3.' + key))"))
        record_pass('AGENDA-SHIFT-CLOSE', 'SEL-CH11-AGENDA-PATIENT-CONTEXT', started, self.driver.current_url)

    def test_admin_persists_selected_patient_on_existing_synthetic_shift_flow(self) -> None:
        started = time.time()
        self.login('admin@demo.local', 'demo-admin')
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-CREATE"]').click()
        dialog = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, '[role="dialog"]')))
        self.assertIn('Crear turno a paciente', dialog.text)
        record_pass('AGENDA-SHIFT-CREATE', 'SEL-CH11-AGENDA-PATIENT-CONTEXT-SAVE', started, self.driver.current_url)
        from selenium.webdriver.support.ui import Select
        Select(dialog.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-PATIENT-SELECT"]')).select_by_value('patient-demo-001')
        self.assertEqual(dialog.find_element(By.CSS_SELECTOR, '[aria-label="Documento del paciente"]').get_attribute('value'), 'DUI 12345678-9')
        self.assertEqual(dialog.find_element(By.CSS_SELECTOR, '[aria-label="Empresa del paciente"]').get_attribute('value'), 'Sin empresa registrada')
        record_pass('AGENDA-SHIFT-PATIENT-SELECT', 'SEL-CH11-AGENDA-PATIENT-CONTEXT-SAVE', started, self.driver.current_url)
        dialog.find_element(By.XPATH, ".//label[contains(., 'Notas')]//input").send_keys('CH11 F03 turno sintético Selenium')
        dialog.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-SAVE"]').click()
        self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, '[role="status"]')))
        self.driver.refresh()
        persisted = self.driver.execute_script("return JSON.parse(localStorage.getItem('analiza.en.casa.workspace.v3.shifts') || '[]').find((shift) => shift.note === 'CH11 F03 turno sintético Selenium')")
        self.assertIsNotNone(persisted)
        self.assertEqual(persisted['patientId'], 'patient-demo-001')
        record_pass('AGENDA-SHIFT-SAVE', 'SEL-CH11-AGENDA-PATIENT-CONTEXT-SAVE', started, self.driver.current_url)

    def test_admin_navigates_existing_calendar_views_without_mutation(self) -> None:
        started = time.time()
        self.login('admin@demo.local', 'demo-admin')
        before = self.driver.execute_script("return ['shifts', 'auditEntries'].map((key) => localStorage.getItem('analiza.en.casa.workspace.v3.' + key))")
        period = self.driver.find_element(By.CSS_SELECTOR, '.agenda-period-label')
        self.assertIn('agosto de 2026', period.text.lower())
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-CALENDAR-PREV"]').click()
        self.assertIn('julio de 2026', self.driver.find_element(By.CSS_SELECTOR, '.agenda-period-label').text.lower())
        record_pass('AGENDA-CALENDAR-PREV', 'SEL-CH11-CALENDAR-NAVIGATION-VIEWS', started, self.driver.current_url)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-CALENDAR-NEXT"]').click()
        self.assertIn('agosto de 2026', self.driver.find_element(By.CSS_SELECTOR, '.agenda-period-label').text.lower())
        record_pass('AGENDA-CALENDAR-NEXT', 'SEL-CH11-CALENDAR-NAVIGATION-VIEWS', started, self.driver.current_url)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-CALENDAR-TODAY"]').click()
        self.assertIn('agosto de 2026', self.driver.find_element(By.CSS_SELECTOR, '.agenda-period-label').text.lower())
        record_pass('AGENDA-CALENDAR-TODAY', 'SEL-CH11-CALENDAR-NAVIGATION-VIEWS', started, self.driver.current_url)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-CALENDAR-VIEW-MONTH"]').click()
        self.assertEqual(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-CALENDAR-VIEW-MONTH"]').get_attribute('aria-pressed'), 'true')
        record_pass('AGENDA-CALENDAR-VIEW-MONTH', 'SEL-CH11-CALENDAR-NAVIGATION-VIEWS', started, self.driver.current_url)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-CALENDAR-VIEW-WEEK"]').click()
        self.assertIn('Semana del', self.driver.find_element(By.CSS_SELECTOR, '.agenda-period-label').text)
        record_pass('AGENDA-CALENDAR-VIEW-WEEK', 'SEL-CH11-CALENDAR-NAVIGATION-VIEWS', started, self.driver.current_url)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-CALENDAR-VIEW-LIST-WEEK"]').click()
        self.assertIn('Lista por semana', self.driver.find_element(By.CSS_SELECTOR, '.agenda-list-view h3').text)
        record_pass('AGENDA-CALENDAR-VIEW-LIST-WEEK', 'SEL-CH11-CALENDAR-NAVIGATION-VIEWS', started, self.driver.current_url)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-CALENDAR-VIEW-LIST-DAY"]').click()
        self.assertIn('Lista por día', self.driver.find_element(By.CSS_SELECTOR, '.agenda-list-view h3').text)
        record_pass('AGENDA-CALENDAR-VIEW-LIST-DAY', 'SEL-CH11-CALENDAR-NAVIGATION-VIEWS', started, self.driver.current_url)
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-VISITS-DELETE"]').is_enabled())
        self.driver.refresh()
        self.assertEqual(before, self.driver.execute_script("return ['shifts', 'auditEntries'].map((key) => localStorage.getItem('analiza.en.casa.workspace.v3.' + key))"))
        record_pass('AGENDA-VISITS-DELETE', 'SEL-CH11-CALENDAR-NAVIGATION-VIEWS', started, self.driver.current_url)
