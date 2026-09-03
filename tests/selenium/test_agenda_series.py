"""B3 multi-day agenda evidence; records only after a persisted series is asserted."""
# test-id: SEL-B3-AGENDA-SERIES
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


class AgendaSeries(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        global SERVER
        reset()
        if not ready():
            SERVER = subprocess.Popen(['npm.cmd', 'run', 'dev', '--workspace=@analiza/web', '--', '--port', '4174'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        for _ in range(60):
            if ready(): break
            time.sleep(1)
        else: raise RuntimeError('El servidor React local no inició en 60 segundos.')
        options = webdriver.ChromeOptions(); options.add_argument('--headless=new'); options.add_argument('--window-size=1440,1000')
        cls.driver = webdriver.Chrome(options=options); cls.wait = WebDriverWait(cls.driver, 12)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.driver.quit()
        if SERVER: SERVER.terminate()

    def login_as(self, email: str, password: str, role: str) -> None:
        self.driver.get(f'{BASE}/login?next=%2Fagenda')
        self.driver.execute_script("localStorage.clear()")
        self.driver.refresh()
        email_field = self.wait.until(conditions.visibility_of_element_located((By.XPATH, "//label[contains(., 'Usuario')]//input")))
        email_field.clear()
        email_field.send_keys(email)
        password_field = self.driver.find_element(By.CSS_SELECTOR, 'input[type=password]')
        password_field.clear()
        password_field.send_keys(password)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN"]').click()
        self.wait.until(conditions.url_contains('/agenda'))
        self.assertIn(f'"role":"{role}"', self.driver.execute_script('return localStorage.getItem("analiza.en.casa.mock-session.v1")'))

    def agenda_collections(self) -> list[str | None]:
        return self.driver.execute_script("return ['shifts', 'auditEntries'].map((key) => localStorage.getItem('analiza.en.casa.workspace.v3.' + key))")

    def set_input_value(self, input_element, value: str) -> None:
        self.driver.execute_script(
            "const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;"
            "set.call(arguments[0], arguments[1]);"
            "arguments[0].dispatchEvent(new Event('input', { bubbles: true }));"
            "arguments[0].dispatchEvent(new Event('change', { bubbles: true }));",
            input_element,
            value,
        )

    def test_multi_day_six_hour_series_persists(self) -> None:
        started = time.time()
        self.login_as('admin@demo.local', 'demo-admin', 'ADMIN')
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-CREATE"]').click()
        dates = self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-DATE"]')
        self.set_input_value(dates[0], '2026-09-24')
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-DATE-ADD"]').click()
        dates = self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-DATE"]')
        self.set_input_value(dates[1], '2026-09-25')
        self.assertEqual(len(dates), 2)
        self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-DATE-REMOVE"]')[1].click()
        dates = self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-DATE"]')
        self.assertEqual(len(dates), 1)
        self.assertEqual(dates[0].get_attribute('value'), '2026-09-24')
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-PRESET-6H"]').click()
        self.assertEqual(self.driver.find_element(By.XPATH, "//label[contains(., 'Fin')]//input").get_attribute('value'), '14:00')
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-PRESET-PUNTUAL"]').is_enabled())
        self.driver.find_element(By.XPATH, "//label[contains(., 'Notas')]//input").send_keys('Serie Selenium B3')
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-SAVE"]').click()
        self.wait.until(conditions.visibility_of_element_located((By.XPATH, "//*[contains(text(),'1 turno persistido')]")))
        self.driver.refresh()
        self.assertEqual(len(self.driver.find_elements(By.XPATH, "//td[normalize-space()='Serie Selenium B3']")), 1)
        record_pass('AGENDA-SHIFT-CREATE', 'SEL-B3-AGENDA-SERIES', started, self.driver.current_url)
        record_pass('AGENDA-SHIFT-DATE', 'SEL-B3-AGENDA-SERIES', started, self.driver.current_url)
        record_pass('AGENDA-SHIFT-DATE-ADD', 'SEL-B3-AGENDA-SERIES', started, self.driver.current_url)
        record_pass('AGENDA-SHIFT-DATE-REMOVE', 'SEL-B3-AGENDA-SERIES', started, self.driver.current_url)
        record_pass('AGENDA-SHIFT-PRESET-6H', 'SEL-B3-AGENDA-SERIES', started, self.driver.current_url)
        record_pass('AGENDA-SHIFT-PRESET-PUNTUAL', 'SEL-B3-AGENDA-SERIES', started, self.driver.current_url)
        record_pass('AGENDA-SHIFT-SAVE', 'SEL-B3-AGENDA-SERIES', started, self.driver.current_url)

    def test_nurse_eight_hour_overnight_series_persists(self) -> None:
        self.login_as('nurse@demo.local', 'demo-nurse', 'NURSE')
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-CREATE"]').click()
        date = self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-DATE"]')
        self.set_input_value(date, '2026-08-30')
        start = self.driver.find_element(By.XPATH, "//label[contains(., 'Inicio')]//input")
        self.set_input_value(start, '20:00')
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-PRESET-8H"]').click()
        self.assertEqual(self.driver.find_element(By.XPATH, "//label[contains(., 'Fin')]//input").get_attribute('value'), '04:00')
        self.assertIn('Finaliza el día siguiente', self.driver.find_element(By.TAG_NAME, 'body').text)
        self.driver.find_element(By.XPATH, "//label[contains(., 'Notas')]//input").send_keys('Nurse overnight Selenium B3')
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-SAVE"]').click()
        self.wait.until(conditions.visibility_of_element_located((By.XPATH, "//*[contains(text(),'turno persistido')]")))
        self.driver.refresh()
        row = self.wait.until(conditions.visibility_of_element_located((By.XPATH, "//td[normalize-space()='Nurse overnight Selenium B3']/parent::tr")))
        self.assertIn('8/31/2026', row.text)
        duration = self.driver.execute_script("const shifts = JSON.parse(localStorage.getItem('analiza.en.casa.workspace.v3.shifts') || '[]'); const shift = shifts.find((item) => item.note === 'Nurse overnight Selenium B3'); return new Date(shift.endsAt).getTime() - new Date(shift.startsAt).getTime();")
        self.assertEqual(duration, 8 * 60 * 60 * 1000)
        record_pass('AGENDA-SHIFT-PRESET-8H', 'SEL-B3-AGENDA-SERIES', time.time(), self.driver.current_url)

    def test_doctor_cannot_alter_shifts_or_audit_entries(self) -> None:
        self.login_as('doctor@demo.local', 'demo-doctor', 'DOCTOR')
        before = self.agenda_collections()
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-CREATE"], [data-action-id="AGENDA-SHIFT-SAVE"]'))
        self.driver.refresh()
        self.assertEqual(self.agenda_collections(), before)

    def test_inventory_cannot_alter_shifts_or_audit_entries(self) -> None:
        self.login_as('inventory@demo.local', 'demo-inventory', 'INVENTORY')
        before = self.agenda_collections()
        denied = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('Acceso restringido para el rol INVENTORY', denied.text)
        self.assertEqual(self.agenda_collections(), before)

    def test_finance_cannot_alter_shifts_or_audit_entries(self) -> None:
        self.login_as('finance@demo.local', 'demo-finance', 'FINANCE')
        before = self.agenda_collections()
        denied = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('Acceso restringido para el rol FINANCE', denied.text)
        self.assertEqual(self.agenda_collections(), before)

    def test_auditor_cannot_alter_shifts_or_audit_entries(self) -> None:
        self.login_as('auditor@demo.local', 'demo-auditor', 'AUDITOR')
        before = self.agenda_collections()
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="AGENDA-SHIFT-CREATE"], [data-action-id="AGENDA-SHIFT-SAVE"]'))
        self.driver.refresh()
        self.assertEqual(self.agenda_collections(), before)
