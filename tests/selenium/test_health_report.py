"""CH17 health-report empty-surface source coverage; no clinical report data is exposed."""
# test-id: SEL-CH17-HEALTH-REPORT-EMPTY-SURFACE
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
BASE = os.getenv('SELENIUM_BASE_URL', 'http://127.0.0.1:4177')
SERVER = None


def ready() -> bool:
    try:
        return urlopen(BASE, timeout=1).status < 500  # nosec B310: local test server only
    except (URLError, TimeoutError, OSError):
        return False


class Ch17HealthReportEmptySurface(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        global SERVER
        reset()
        if not ready():
            SERVER = subprocess.Popen(
                ['npm.cmd', 'run', 'dev', '--workspace=@analiza/web', '--', '--port', '4177'],
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
        cls.driver = webdriver.Chrome(options=options)
        cls.wait = WebDriverWait(cls.driver, 12)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.driver.quit()
        if SERVER:
            SERVER.terminate()

    def login(self, email: str, password: str) -> None:
        self.driver.get(f'{BASE}/login?next=%2Fclinical%2Freports')
        self.driver.execute_script('localStorage.clear()')
        self.driver.refresh()
        email_field = self.wait.until(conditions.visibility_of_element_located((By.XPATH, "//label[contains(., 'Usuario')]//input")))
        email_field.clear()
        email_field.send_keys(email)
        password_field = self.driver.find_element(By.CSS_SELECTOR, 'input[type=password]')
        password_field.clear()
        password_field.send_keys(password)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN"]').click()

    def test_admin_reads_only_empty_report_anatomy_without_audit_mutation(self) -> None:
        self.login('admin@demo.local', 'demo-admin')
        self.wait.until(conditions.url_contains('/clinical/reports'))
        audit_before = self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')")
        self.assertTrue(self.driver.find_elements(By.XPATH, "//th[normalize-space()='Cédula']"))
        self.assertTrue(self.driver.find_elements(By.XPATH, "//th[normalize-space()='Hospitalización']"))
        self.assertIn('Sin registros autorizados para mostrar', self.driver.find_element(By.CSS_SELECTOR, 'tbody .empty-state').text)
        self.assertIn('CH16-Q008', self.driver.find_element(By.ID, 'health-report-data-boundary').text)

        search_started = time.time()
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="HEALTH-REPORT-SEARCH"]').is_enabled())
        record_pass('HEALTH-REPORT-SEARCH', 'SEL-CH17-HEALTH-REPORT-EMPTY-SURFACE', search_started, self.driver.current_url)

        previous_started = time.time()
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="HEALTH-REPORT-PAGE-PREV"]').is_enabled())
        record_pass('HEALTH-REPORT-PAGE-PREV', 'SEL-CH17-HEALTH-REPORT-EMPTY-SURFACE', previous_started, self.driver.current_url)

        next_started = time.time()
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="HEALTH-REPORT-PAGE-NEXT"]').is_enabled())
        record_pass('HEALTH-REPORT-PAGE-NEXT', 'SEL-CH17-HEALTH-REPORT-EMPTY-SURFACE', next_started, self.driver.current_url)

        self.driver.refresh()
        self.assertIn('Sin registros autorizados para mostrar', self.driver.find_element(By.CSS_SELECTOR, 'tbody .empty-state').text)
        self.assertEqual(audit_before, self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')"))

    def test_inventory_is_denied_the_direct_clinical_report_route(self) -> None:
        self.login('inventory@demo.local', 'demo-inventory')
        denied = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('INVENTORY', denied.text)
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="HEALTH-REPORT-SEARCH"]'))

    # test-id: SEL-CH17-HEALTH-REPORT-ACTIONS-MENU
    def test_admin_opens_observed_actions_without_loading_a_clinical_record(self) -> None:
        self.login('admin@demo.local', 'demo-admin')
        self.wait.until(conditions.url_contains('/clinical/reports'))
        audit_before = self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')")
        actions = self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="HEALTH-REPORT-HOSPITALIZATION-ACTIONS-OPEN"]')
        opened_at = time.time()
        actions.click()
        menu = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, '#health-report-hospitalization-actions[role="menu"]')))
        self.assertEqual('true', actions.get_attribute('aria-expanded'))
        self.assertIn('Historia clínica', menu.text)
        self.assertIn('Reporte Claims', menu.text)
        self.assertIn('Ver visitas', menu.text)
        self.assertIn('Notas de servicio', menu.text)
        self.assertIn('Reporte de salud', menu.text)
        self.assertIn('Auditorías', menu.text)
        self.assertIn('Registro XPO', menu.text)
        self.assertEqual('true', self.driver.find_element(By.XPATH, "//*[@role='menuitem' and normalize-space()='Historia clínica']").get_attribute('aria-disabled'))
        self.assertIn('CH17-Q007', self.driver.find_element(By.ID, 'health-report-actions-boundary').text)
        record_pass('HEALTH-REPORT-HOSPITALIZATION-ACTIONS-OPEN', 'SEL-CH17-HEALTH-REPORT-ACTIONS-MENU', opened_at, self.driver.current_url)

        self.driver.refresh()
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '#health-report-hospitalization-actions'))
        self.assertEqual(audit_before, self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')"))

    def test_doctor_can_open_empty_actions_menu_and_finance_is_denied_direct_route(self) -> None:
        self.login('doctor@demo.local', 'demo-doctor')
        self.wait.until(conditions.url_contains('/clinical/reports'))
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="HEALTH-REPORT-HOSPITALIZATION-ACTIONS-OPEN"]').click()
        self.assertTrue(self.driver.find_elements(By.CSS_SELECTOR, '#health-report-hospitalization-actions[role="menu"]'))

        self.login('finance@demo.local', 'demo-finance')
        denied = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('FINANCE', denied.text)
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="HEALTH-REPORT-HOSPITALIZATION-ACTIONS-OPEN"]'))

    # test-id: SEL-CH17-HEALTH-REPORT-EMPTY-SECTIONS
    def test_admin_switches_each_observed_empty_section_without_audit_mutation(self) -> None:
        self.login('admin@demo.local', 'demo-admin')
        self.wait.until(conditions.url_contains('/clinical/reports'))
        audit_before = self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')")
        information = self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="HEALTH-REPORT-SECTION-INFORMATION"]')
        clinical = self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="HEALTH-REPORT-SECTION-CLINICAL"]')
        medical = self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="HEALTH-REPORT-SECTION-MEDICAL"]')
        treatments = self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="HEALTH-REPORT-SECTION-TREATMENTS"]')
        events = self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="HEALTH-REPORT-SECTION-EVENTS"]')
        evidence = self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="HEALTH-REPORT-SECTION-EVIDENCE"]')
        panel = self.driver.find_element(By.CSS_SELECTOR, '#health-report-active-section[role="tabpanel"]')
        self.assertEqual('health-report-active-section', information.get_attribute('aria-controls'))
        self.assertEqual('health-report-active-section', clinical.get_attribute('aria-controls'))
        self.assertEqual('health-report-active-section', medical.get_attribute('aria-controls'))
        self.assertEqual('health-report-active-section', treatments.get_attribute('aria-controls'))
        self.assertEqual('health-report-active-section', events.get_attribute('aria-controls'))
        self.assertEqual('health-report-active-section', evidence.get_attribute('aria-controls'))
        self.assertTrue(self.driver.find_elements(By.CSS_SELECTOR, '#health-report-active-section[role="tabpanel"]'))
        self.assertEqual('true', information.get_attribute('aria-selected'))
        self.assertIn('Información Principal: sin contenido autorizado', panel.text)

        clinical_started = time.time()
        clinical.click()
        self.assertEqual('true', clinical.get_attribute('aria-selected'))
        self.assertIn('Evaluación Clínica: sin contenido autorizado', panel.text)
        record_pass('HEALTH-REPORT-SECTION-CLINICAL', 'SEL-CH17-HEALTH-REPORT-EMPTY-SECTIONS', clinical_started, self.driver.current_url)

        medical_started = time.time()
        medical.click()
        self.assertEqual('true', medical.get_attribute('aria-selected'))
        self.assertIn('Atención Médica: sin contenido autorizado', panel.text)
        record_pass('HEALTH-REPORT-SECTION-MEDICAL', 'SEL-CH17-HEALTH-REPORT-EMPTY-SECTIONS', medical_started, self.driver.current_url)

        treatments_started = time.time()
        treatments.click()
        self.assertEqual('true', treatments.get_attribute('aria-selected'))
        self.assertIn('Tratamientos y Órdenes: sin contenido autorizado', panel.text)
        record_pass('HEALTH-REPORT-SECTION-TREATMENTS', 'SEL-CH17-HEALTH-REPORT-EMPTY-SECTIONS', treatments_started, self.driver.current_url)

        events_started = time.time()
        events.click()
        self.assertEqual('true', events.get_attribute('aria-selected'))
        self.assertIn('Eventos Clínicos: sin contenido autorizado', panel.text)
        record_pass('HEALTH-REPORT-SECTION-EVENTS', 'SEL-CH17-HEALTH-REPORT-EMPTY-SECTIONS', events_started, self.driver.current_url)

        evidence_started = time.time()
        evidence.click()
        self.assertEqual('true', evidence.get_attribute('aria-selected'))
        self.assertIn('Evidencia y Documentos: sin contenido autorizado', panel.text)
        record_pass('HEALTH-REPORT-SECTION-EVIDENCE', 'SEL-CH17-HEALTH-REPORT-EMPTY-SECTIONS', evidence_started, self.driver.current_url)

        information_started = time.time()
        information.click()
        self.assertEqual('true', information.get_attribute('aria-selected'))
        self.assertIn('Información Principal: sin contenido autorizado', panel.text)
        record_pass('HEALTH-REPORT-SECTION-INFORMATION', 'SEL-CH17-HEALTH-REPORT-EMPTY-SECTIONS', information_started, self.driver.current_url)

        self.driver.refresh()
        self.assertEqual('true', self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="HEALTH-REPORT-SECTION-INFORMATION"]').get_attribute('aria-selected'))
        self.assertEqual(audit_before, self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')"))

    def test_doctor_can_switch_empty_section_and_finance_is_denied_direct_route(self) -> None:
        self.login('doctor@demo.local', 'demo-doctor')
        self.wait.until(conditions.url_contains('/clinical/reports'))
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="HEALTH-REPORT-SECTION-CLINICAL"]').click()
        self.assertIn('Evaluación Clínica: sin contenido autorizado', self.driver.find_element(By.CSS_SELECTOR, '[role="tabpanel"]').text)

        self.login('finance@demo.local', 'demo-finance')
        denied = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('FINANCE', denied.text)
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="HEALTH-REPORT-SECTION-CLINICAL"]'))
