"""B2 doctor/resource actions; each recorded action follows a real persistence assertion."""
# test-id: SEL-DOCTOR-LIFECYCLE
# test-id: SEL-DOCTOR-ADMIN-ONLY
from __future__ import annotations

import os
import subprocess
import tempfile
import time
import unittest
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as conditions
from selenium.webdriver.support.ui import WebDriverWait

from helpers.action_recorder import record_pass, reset

ROOT = Path(__file__).resolve().parents[2]
BASE = os.getenv('SELENIUM_BASE_URL', 'http://127.0.0.1:4174')
SERVER = None


def ready() -> bool:
    try:
        return urlopen(BASE, timeout=1).status < 500  # nosec B310: local test server only
    except (URLError, TimeoutError, OSError):
        return False


class Doctors(unittest.TestCase):
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
        cls.temp_dir = tempfile.TemporaryDirectory(prefix='analiza-doctors-selenium-')
        cls.attachment = Path(cls.temp_dir.name) / 'credencial-b2.txt'
        cls.attachment.write_text('archivo sintético B2', encoding='utf8')
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
        cls.temp_dir.cleanup()

    def setUp(self) -> None:
        self.authenticate_as('admin@demo.local', 'demo-admin')

    def authenticate_as(self, email: str, password: str) -> None:
        self.driver.get(f'{BASE}/login')
        self.wait.until(lambda driver: driver.execute_script('return document.readyState') == 'complete')
        self.driver.execute_script('localStorage.clear()')
        self.driver.get(f'{BASE}/login?next=%2Fdoctors')
        email_field = self.wait.until(conditions.visibility_of_element_located((By.XPATH, "//label[contains(., 'Usuario')]//input")))
        email_field.clear()
        email_field.send_keys(email)
        password_field = self.driver.find_element(By.CSS_SELECTOR, 'input[type=password]')
        password_field.clear()
        password_field.send_keys(password)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN"]').click()
        self.wait.until(conditions.url_contains('/doctors'))

    def assert_doctor_route_denied(self, role: str, email: str, password: str) -> None:
        self.authenticate_as(email, password)
        denied = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertEqual(denied.text, f'Acceso restringido para el rol {role}.')
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id^="DOCTOR-"]'))
        self.assertFalse(self.driver.find_elements(By.XPATH, "//*[normalize-space()='Médicos y recursos']"))

    def field(self, label: str):
        return self.driver.find_element(By.XPATH, f"//label[contains(., '{label}')]//*[self::input or self::textarea]")

    def test_doctor_resource_lifecycle_persists_and_edits(self) -> None:
        navigation_started = time.time()
        self.assertIn('/doctors', self.driver.current_url)
        self.assertTrue(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="DOCTOR-CREATE"]').is_displayed())
        record_pass('DOCTOR-NAVIGATE', 'SEL-DOCTOR-LIFECYCLE', navigation_started, self.driver.current_url)

        started = time.time()
        self.wait.until(conditions.element_to_be_clickable((By.CSS_SELECTOR, '[data-action-id="DOCTOR-CREATE"]'))).click()
        self.field('Nombre completo').send_keys('Médica Selenium B2')
        self.field('JVPM').send_keys('JVPM-SEL-B2')
        self.field('DUI').send_keys('DUI-SEL-B2')
        specialty = self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="DOCTOR-SPECIALTY-SELECT"]')
        specialty.send_keys('Nutri')
        self.wait.until(conditions.element_to_be_clickable((By.XPATH, "//*[@role='option' and normalize-space()='Nutricionista']"))).click()
        self.field('Dirección').send_keys('Dirección Selenium B2')
        self.driver.find_element(By.CSS_SELECTOR, 'input[type=file]').send_keys(str(self.attachment.resolve()))
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="DOCTOR-SAVE"]').click()
        self.wait.until(conditions.visibility_of_element_located((By.XPATH, "//*[contains(., 'Médica Selenium B2 registrado')]")))
        self.driver.refresh()
        self.wait.until(conditions.visibility_of_element_located((By.XPATH, "//*[normalize-space()='JVPM-SEL-B2']")))
        persisted = self.driver.find_element(By.TAG_NAME, 'body').text
        self.assertIn('Nutricionista', persisted)
        self.assertIn('credencial-b2.txt', persisted)
        record_pass('DOCTOR-CREATE', 'SEL-DOCTOR-LIFECYCLE', started, self.driver.current_url)
        record_pass('DOCTOR-SPECIALTY-SELECT', 'SEL-DOCTOR-LIFECYCLE', started, self.driver.current_url)
        record_pass('DOCTOR-ATTACHMENTS', 'SEL-DOCTOR-LIFECYCLE', started, self.driver.current_url)
        record_pass('DOCTOR-SAVE', 'SEL-DOCTOR-LIFECYCLE', started, self.driver.current_url)

        edit_started = time.time()
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="DOCTOR-EDIT"]').click()
        address = self.field('Dirección')
        address.clear()
        address.send_keys('Dirección Selenium B2 editada')
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="DOCTOR-EDIT-SAVE"]').click()
        self.driver.refresh()
        self.wait.until(conditions.element_to_be_clickable((By.CSS_SELECTOR, '[data-action-id="DOCTOR-EDIT"]'))).click()
        self.assertEqual(self.field('Dirección').get_attribute('value'), 'Dirección Selenium B2 editada')
        self.driver.find_element(By.XPATH, "//button[normalize-space()='Cancelar']").click()
        record_pass('DOCTOR-EDIT', 'SEL-DOCTOR-LIFECYCLE', edit_started, self.driver.current_url)
        record_pass('DOCTOR-EDIT-SAVE', 'SEL-DOCTOR-LIFECYCLE', edit_started, self.driver.current_url)

        resource_started = time.time()
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="DOCTOR-RESOURCE-CREATE"]').click()
        self.wait.until(conditions.url_contains('/clinical/nursing'))
        self.assertTrue(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="NURSING-RESOURCE-CREATE"]').is_displayed())
        record_pass('DOCTOR-RESOURCE-CREATE', 'SEL-DOCTOR-LIFECYCLE', resource_started, self.driver.current_url)

    def test_doctor_role_cannot_open_doctors(self) -> None:
        self.assert_doctor_route_denied('DOCTOR', 'doctor@demo.local', 'demo-doctor')

    def test_nurse_role_cannot_open_doctors(self) -> None:
        self.assert_doctor_route_denied('NURSE', 'nurse@demo.local', 'demo-nurse')

    def test_inventory_role_cannot_open_doctors(self) -> None:
        self.assert_doctor_route_denied('INVENTORY', 'inventory@demo.local', 'demo-inventory')

    def test_finance_role_cannot_open_doctors(self) -> None:
        self.assert_doctor_route_denied('FINANCE', 'finance@demo.local', 'demo-finance')

    def test_auditor_role_cannot_open_doctors(self) -> None:
        self.assert_doctor_route_denied('AUDITOR', 'auditor@demo.local', 'demo-auditor')
