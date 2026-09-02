"""CH15 factual medication-catalog source coverage; no medication data or rule is created."""
# test-id: SEL-CH15-MEDICATION-CATALOG
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


class MedicationCatalog(unittest.TestCase):
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
        self.driver.get(f'{BASE}/login?next=%2Fcatalogs%2Fmedications')
        self.driver.execute_script('localStorage.clear()')
        self.driver.refresh()
        self.wait.until(conditions.visibility_of_element_located((By.XPATH, "//label[contains(., 'Usuario')]//input"))).send_keys(email)
        self.driver.find_element(By.CSS_SELECTOR, 'input[type=password]').send_keys(password)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN"]').click()

    def test_admin_searches_factual_empty_catalog_without_audit_mutation(self) -> None:
        started = time.time()
        self.login('admin@demo.local', 'demo-admin')
        self.wait.until(conditions.url_contains('/catalogs/medications'))
        before = self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')")
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="CATALOG-MEDICATIONS-SEARCH"]').send_keys('sin-medicamento-ch15')
        empty = self.driver.find_element(By.CSS_SELECTOR, 'tbody .empty-state')
        self.assertIn('Sin medicamentos documentados', empty.text)
        self.assertIn('sin-medicamento-ch15', empty.text)
        record_pass('CATALOG-MEDICATIONS-SEARCH', 'SEL-CH15-MEDICATION-CATALOG', started, self.driver.current_url)
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="CATALOG-MEDICATIONS-EXPORT"]').is_enabled())
        record_pass('CATALOG-MEDICATIONS-EXPORT', 'SEL-CH15-MEDICATION-CATALOG', started, self.driver.current_url)
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="CATALOG-MEDICATIONS-CREATE"]').is_enabled())
        record_pass('CATALOG-MEDICATIONS-CREATE', 'SEL-CH15-MEDICATION-CATALOG', started, self.driver.current_url)
        self.driver.refresh()
        self.assertEqual(before, self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')"))

    def test_inventory_reads_medication_catalog(self) -> None:
        self.login('inventory@demo.local', 'demo-inventory')
        self.wait.until(conditions.visibility_of_element_located((By.XPATH, "//h1[normalize-space()='Items / Medicamentos']")))
        self.assertTrue(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="CATALOG-MEDICATIONS-SEARCH"]'))

    def test_auditor_reads_medication_catalog(self) -> None:
        self.login('auditor@demo.local', 'demo-auditor')
        self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="CATALOG-MEDICATIONS-SEARCH"]')))
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="CATALOG-MEDICATIONS-SEARCH"]').send_keys('sin-medicamento-auditor')
        self.assertIn('sin-medicamento-auditor', self.driver.find_element(By.CSS_SELECTOR, 'tbody .empty-state').text)

    def test_doctor_is_denied_direct_medication_catalog_access(self) -> None:
        self.login('doctor@demo.local', 'demo-doctor')
        denied = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('DOCTOR', denied.text)
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="CATALOG-MEDICATIONS-SEARCH"]'))

    def test_nurse_is_denied_direct_medication_catalog_access(self) -> None:
        self.login('nurse@demo.local', 'demo-nurse')
        denied = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('NURSE', denied.text)
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="CATALOG-MEDICATIONS-SEARCH"]'))

    def test_finance_is_denied_direct_medication_catalog_access(self) -> None:
        self.login('finance@demo.local', 'demo-finance')
        denied = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('FINANCE', denied.text)
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="CATALOG-MEDICATIONS-SEARCH"]'))
