"""Explicit connected smoke. Never inject localStorage data or mock authentication."""
import json
import os
import time
import unittest
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


class CoreConnected(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = os.environ['ANALIZA_VERIFY_URL'].rstrip('/')
        cls.email = os.environ['MONGODB_INITIAL_ADMIN_EMAIL']
        cls.password = os.environ['MONGODB_INITIAL_ADMIN_PASSWORD']
        options = webdriver.ChromeOptions()
        options.add_argument('--headless=new')
        options.add_argument('--window-size=1440,1000')
        cls.driver = webdriver.Chrome(options=options)
        cls.addClassCleanup(cls.driver.quit)
        cls.wait = WebDriverWait(cls.driver, 30)
        cls.output = Path('.local/core-selenium')
        cls.output.mkdir(parents=True, exist_ok=True)
        cls.driver.get(cls.base + '/login')
        cls.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN-EMAIL"]'))).send_keys(cls.email)
        cls.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN-PASSWORD"]').send_keys(cls.password)
        cls.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN"]').click()
        cls.wait.until(EC.url_contains('/dashboard'))

    def test_patient_dialog_does_not_change_local_storage(self):
        self.driver.get(self.base + '/patients')
        button = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-action-id="PATIENT-CREATE"]')))
        before = self.driver.execute_script('return JSON.stringify(localStorage)')
        started = time.perf_counter()
        button.click()
        dialog = self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[role="dialog"]')))
        elapsed = round((time.perf_counter() - started) * 1000)
        self.assertTrue(dialog.is_displayed())
        self.assertTrue(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="PATIENT-SAVE"]').is_enabled())
        self.assertEqual(before, self.driver.execute_script('return JSON.stringify(localStorage)'))
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="PATIENT-IMPORT"]'))
        self.driver.save_screenshot(str(self.output / 'patient-dialog.png'))
        (self.output / 'timing.json').write_text(json.dumps({'base': self.base, 'dialogOpenMilliseconds': elapsed}), encoding='utf8')

    def test_core_navigation_and_direct_route_gate(self):
        self.driver.get(self.base + '/dashboard')
        self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, 'h1')))
        for path in ['/quotes', '/payments', '/inventory', '/clinical']:
            self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, f'nav a[href="{path}"]'))
        self.driver.get(self.base + '/quotes')
        self.wait.until(EC.url_contains('/dashboard'))
        self.assertTrue(self.driver.current_url.endswith('/dashboard'))

    def test_mobile_hospitalization_dialog(self):
        self.driver.set_window_size(390, 844)
        try:
            self.driver.get(self.base + '/hospitalizations')
            self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-action-id="HOSPITALIZATION-CREATE"]'))).click()
            self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[role="dialog"]')))
            self.assertFalse(self.driver.execute_script('return document.documentElement.scrollWidth > innerWidth'))
            self.driver.save_screenshot(str(self.output / 'hospitalization-mobile.png'))
        finally:
            self.driver.set_window_size(1440, 1000)


if __name__ == '__main__':
    unittest.main(verbosity=2)
