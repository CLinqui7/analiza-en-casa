"""CH12 factual payables-summary source coverage; no financial operation is executed."""
# test-id: SEL-CH12-PAYABLES-SUMMARY
# test-id: SEL-CH12-PAYABLES-PERMISSIONS
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


class PayablesSummary(unittest.TestCase):
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

    def login(self, email: str, password: str, next_path: str = '/payables') -> None:
        self.driver.get(f'{BASE}/login?next={next_path.replace("/", "%2F", 1)}')
        self.driver.execute_script('localStorage.clear()')
        self.driver.refresh()
        self.wait.until(conditions.visibility_of_element_located((By.XPATH, "//label[contains(., 'Usuario')]//input"))).send_keys(email)
        self.driver.find_element(By.CSS_SELECTOR, 'input[type=password]').send_keys(password)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN"]').click()
        self.wait.until(conditions.url_contains(next_path))

    def test_admin_reads_factual_summary_and_blocked_controls_without_mutation(self) -> None:
        started = time.time()
        self.login('admin@demo.local', 'demo-admin')
        before = self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')")
        summary = self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="PAYABLES-SUMMARY-TAB"]')
        self.assertEqual(summary.get_attribute('aria-selected'), 'true')
        record_pass('PAYABLES-SUMMARY-TAB', 'SEL-CH12-PAYABLES-SUMMARY', started, self.driver.current_url)
        service_payments = self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="PAYABLES-SERVICE-PAYMENTS-TAB"]')
        self.assertFalse(service_payments.is_enabled())
        record_pass('PAYABLES-SERVICE-PAYMENTS-TAB', 'SEL-CH12-PAYABLES-SUMMARY', started, self.driver.current_url)
        statement = self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="PAYABLES-STATEMENT-GENERATE"]')
        self.assertFalse(statement.is_enabled())
        record_pass('PAYABLES-STATEMENT-GENERATE', 'SEL-CH12-PAYABLES-SUMMARY', started, self.driver.current_url)
        restrictions = self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="PAYABLES-RESTRICTIONS"]')
        self.assertFalse(restrictions.is_enabled())
        record_pass('PAYABLES-RESTRICTIONS', 'SEL-CH12-PAYABLES-SUMMARY', started, self.driver.current_url)
        download = self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="PAYABLES-DOWNLOAD"]')
        self.assertFalse(download.is_enabled())
        record_pass('PAYABLES-DOWNLOAD', 'SEL-CH12-PAYABLES-SUMMARY', started, self.driver.current_url)
        clear_table = self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="PAYABLES-CLEAR-TABLE"]')
        self.assertFalse(clear_table.is_enabled())
        record_pass('PAYABLES-CLEAR-TABLE', 'SEL-CH12-PAYABLES-SUMMARY', started, self.driver.current_url)
        search = self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="PAYABLES-INVOICE-SEARCH"]')
        search.send_keys('sin coincidencias')
        invoices_empty_state = self.driver.find_element(By.CSS_SELECTOR, 'tbody .empty-state')
        self.assertIn('Sin facturas documentadas', invoices_empty_state.text)
        self.assertIn('No hay facturas documentadas para', invoices_empty_state.text)
        self.assertIn('sin coincidencias', invoices_empty_state.text)
        record_pass('PAYABLES-INVOICE-SEARCH', 'SEL-CH12-PAYABLES-SUMMARY', started, self.driver.current_url)
        self.driver.refresh()
        self.assertEqual(before, self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')"))

    def test_finance_can_navigate_to_factual_summary(self) -> None:
        started = time.time()
        self.login('finance@demo.local', 'demo-finance', '/receivables')
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="PAYABLES-NAVIGATE"]').click()
        self.wait.until(conditions.url_contains('/payables'))
        self.assertIn('Cuentas por pagar', self.driver.find_element(By.TAG_NAME, 'main').text)
        record_pass('PAYABLES-NAVIGATE', 'SEL-CH12-PAYABLES-PERMISSIONS', started, self.driver.current_url)

    def test_inventory_is_denied_direct_payables_route(self) -> None:
        self.login('inventory@demo.local', 'demo-inventory')
        denied = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('Acceso restringido para el rol INVENTORY', denied.text)
