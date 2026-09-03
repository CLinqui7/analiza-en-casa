"""CH15 factual discount-matrix source coverage; no discount rule or financial operation is created."""
# test-id: SEL-CH15-DISCOUNTS-CATALOG
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
BASE = os.getenv('SELENIUM_BASE_URL', 'http://127.0.0.1:4175')
SERVER = None


def ready() -> bool:
    try:
        return urlopen(BASE, timeout=1).status < 500  # nosec B310: local test server only
    except (URLError, TimeoutError, OSError):
        return False


class DiscountsCatalog(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        global SERVER
        reset()
        if not ready():
            SERVER = subprocess.Popen(
                ['npm.cmd', 'run', 'dev', '--workspace=@analiza/web', '--', '--port', '4175'],
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
        self.driver.get(f'{BASE}/login?next=%2Fcatalogs%2Fdiscounts')
        self.driver.execute_script('localStorage.clear()')
        self.driver.refresh()
        email_field = self.wait.until(conditions.visibility_of_element_located((By.XPATH, "//label[contains(., 'Usuario')]//input")))
        email_field.clear()
        email_field.send_keys(email)
        password_field = self.driver.find_element(By.CSS_SELECTOR, 'input[type=password]')
        password_field.clear()
        password_field.send_keys(password)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN"]').click()

    def test_admin_searches_factual_empty_matrix_without_audit_mutation(self) -> None:
        self.login('admin@demo.local', 'demo-admin')
        self.wait.until(conditions.url_contains('/catalogs/discounts'))
        audit_before = self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')")

        search_started = time.time()
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="CATALOG-DISCOUNTS-SEARCH"]').send_keys('sin-descuento-ch15')
        empty = self.driver.find_element(By.CSS_SELECTOR, 'tbody .empty-state')
        self.assertIn('Sin perfiles de descuento documentados', empty.text)
        self.assertIn('sin-descuento-ch15', empty.text)
        record_pass('CATALOG-DISCOUNTS-SEARCH', 'SEL-CH15-DISCOUNTS-CATALOG', search_started, self.driver.current_url)

        export_started = time.time()
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="CATALOG-DISCOUNTS-EXPORT"]').is_enabled())
        record_pass('CATALOG-DISCOUNTS-EXPORT', 'SEL-CH15-DISCOUNTS-CATALOG', export_started, self.driver.current_url)

        create_started = time.time()
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="CATALOG-DISCOUNTS-CREATE"]').is_enabled())
        record_pass('CATALOG-DISCOUNTS-CREATE', 'SEL-CH15-DISCOUNTS-CATALOG', create_started, self.driver.current_url)

        page_size_started = time.time()
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="CATALOG-DISCOUNTS-PAGE-SIZE"]').is_enabled())
        record_pass('CATALOG-DISCOUNTS-PAGE-SIZE', 'SEL-CH15-DISCOUNTS-CATALOG', page_size_started, self.driver.current_url)

        previous_started = time.time()
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="CATALOG-DISCOUNTS-PAGE-PREV"]').is_enabled())
        record_pass('CATALOG-DISCOUNTS-PAGE-PREV', 'SEL-CH15-DISCOUNTS-CATALOG', previous_started, self.driver.current_url)

        next_started = time.time()
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="CATALOG-DISCOUNTS-PAGE-NEXT"]').is_enabled())
        record_pass('CATALOG-DISCOUNTS-PAGE-NEXT', 'SEL-CH15-DISCOUNTS-CATALOG', next_started, self.driver.current_url)

        self.driver.refresh()
        self.assertEqual(audit_before, self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')"))

    def test_inventory_reads_discount_matrix(self) -> None:
        self.login('inventory@demo.local', 'demo-inventory')
        self.wait.until(conditions.visibility_of_element_located((By.XPATH, "//h1[normalize-space()='Descuentos']")))
        self.assertTrue(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="CATALOG-DISCOUNTS-SEARCH"]'))

    def test_auditor_reads_discount_matrix(self) -> None:
        self.login('auditor@demo.local', 'demo-auditor')
        self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="CATALOG-DISCOUNTS-SEARCH"]')))
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="CATALOG-DISCOUNTS-SEARCH"]').send_keys('sin-descuento-auditor')
        self.assertIn('sin-descuento-auditor', self.driver.find_element(By.CSS_SELECTOR, 'tbody .empty-state').text)

    def test_doctor_is_denied_direct_discount_matrix_access(self) -> None:
        self.login('doctor@demo.local', 'demo-doctor')
        denied = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('DOCTOR', denied.text)
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="CATALOG-DISCOUNTS-SEARCH"]'))

    def test_nurse_is_denied_direct_discount_matrix_access(self) -> None:
        self.login('nurse@demo.local', 'demo-nurse')
        denied = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('NURSE', denied.text)
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="CATALOG-DISCOUNTS-SEARCH"]'))

    def test_finance_is_denied_direct_discount_matrix_access(self) -> None:
        self.login('finance@demo.local', 'demo-finance')
        denied = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('FINANCE', denied.text)
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="CATALOG-DISCOUNTS-SEARCH"]'))
