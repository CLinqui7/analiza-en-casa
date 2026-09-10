"""Clinical document lifecycle coverage in the React application."""
# test-id: SEL-CLINICAL-DOCUMENT-LIFECYCLE
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


class ClinicalDocuments(unittest.TestCase):
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
        cls.driver = webdriver.Chrome(options=options)
        cls.wait = WebDriverWait(cls.driver, 12)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.driver.quit()
        if SERVER:
            SERVER.terminate()

    def login(self, email: str, password: str, next_path: str) -> None:
        self.driver.get(f'{BASE}/login?next={next_path}')
        self.driver.execute_script('localStorage.clear()')
        self.driver.refresh()
        email_field = self.wait.until(
            conditions.visibility_of_element_located(
                (By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN-EMAIL"]')
            )
        )
        email_field.clear()
        email_field.send_keys(email)
        password_field = self.driver.find_element(
            By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN-PASSWORD"]'
        )
        password_field.clear()
        password_field.send_keys(password)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN"]').click()
        self.wait.until(conditions.url_contains(next_path))

    def test_admin_creates_signs_corrects_and_reloads_without_mutating_signed_version(self) -> None:
        started = time.time()
        self.login('admin@demo.local', 'demo-admin', '/clinical/care-plans')
        self.wait.until(
            conditions.element_to_be_clickable(
                (By.CSS_SELECTOR, '[data-action-id="CARE-PLAN-CREATE"]')
            )
        ).click()
        dialog = self.wait.until(
            conditions.visibility_of_element_located((By.CSS_SELECTOR, '[role="dialog"]'))
        )
        dialog.find_element(By.CSS_SELECTOR, 'input[name="title"]').send_keys(
            'Plan sintético Selenium'
        )
        dialog.find_element(By.CSS_SELECTOR, 'textarea[name="summary"]').send_keys(
            'Versión original sintética Selenium.'
        )
        dialog.find_element(By.CSS_SELECTOR, 'input[name="author"]').send_keys(
            'Profesional QA Selenium'
        )
        dialog.find_element(By.CSS_SELECTOR, 'button[type="submit"]').click()
        self.wait.until(
            conditions.text_to_be_present_in_element((By.CSS_SELECTOR, '[role="status"]'), 'persistido')
        )
        row = self.driver.find_element(
            By.XPATH, "//tr[contains(., 'Plan sintético Selenium')]"
        )
        row.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-DOCUMENT-SIGN"]').click()
        self.wait.until(
            conditions.text_to_be_present_in_element((By.CSS_SELECTOR, '[role="status"]'), 'inmutable')
        )
        original_summary = row.text
        row.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-DOCUMENT-CORRECT"]').click()
        correction = self.wait.until(
            conditions.visibility_of_element_located((By.CSS_SELECTOR, '[role="dialog"]'))
        )
        reason = correction.find_element(By.CSS_SELECTOR, 'textarea[name="reason"]')
        reason.send_keys('Corrección sintética Selenium.')
        summary = correction.find_element(By.CSS_SELECTOR, 'textarea[name="summary"]')
        summary.clear()
        summary.send_keys('Versión corregida sintética Selenium.')
        correction.find_element(By.CSS_SELECTOR, 'button[type="submit"]').click()
        self.wait.until(
            conditions.text_to_be_present_in_element(
                (By.CSS_SELECTOR, '[role="status"]'), 'versión firmada original'
            )
        )
        self.driver.refresh()
        body = self.wait.until(
            conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main'))
        ).text
        self.assertIn('Versión original sintética Selenium.', body)
        self.assertIn('Versión corregida sintética Selenium.', body)
        self.assertIn('Motivo: Corrección sintética Selenium.', body)
        self.assertIn('Firmado e inmutable', original_summary)
        record_pass(
            'CLINICAL-DOCUMENT-LIFECYCLE',
            'SEL-CLINICAL-DOCUMENT-LIFECYCLE',
            started,
            self.driver.current_url,
        )
