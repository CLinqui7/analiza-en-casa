"""Selenium regression for the expensive workspace dialog open path."""
# test-id: SEL-DIALOG-PERFORMANCE

from __future__ import annotations

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
from selenium.webdriver.support.ui import WebDriverWait


ROOT = Path(__file__).resolve().parents[2]
BASE = os.getenv('SELENIUM_BASE_URL', 'http://127.0.0.1:4174')
SERVER = None


def ready() -> bool:
    try:
        return urlopen(BASE, timeout=1).status < 500  # nosec B310 -- local test server
    except (URLError, TimeoutError, OSError):
        return False


class DialogPerformance(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        global SERVER
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
        cls.driver = webdriver.Chrome(options=options)
        cls.wait = WebDriverWait(cls.driver, 12)

    @classmethod
    def tearDownClass(cls) -> None:
        try:
            cls.driver.quit()
        finally:
            if SERVER is not None:
                SERVER.terminate()

    def login(self) -> None:
        self.driver.get(f'{BASE}/login')
        self.driver.execute_script(
            "localStorage.removeItem('analiza.en.casa.workspace.v2');"
            "localStorage.removeItem('analiza.en.casa.mock-session.v1');"
        )
        self.driver.refresh()
        email = self.wait.until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN-EMAIL"]'))
        )
        email.clear()
        email.send_keys('admin@demo.local')
        password = self.driver.find_element(
            By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN-PASSWORD"]'
        )
        password.clear()
        password.send_keys('demo-admin')
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN"]').click()
        self.wait.until(lambda driver: '/login' not in driver.current_url)

    def test_patient_dialog_opens_without_full_screen_blur_or_eager_map(self) -> None:
        self.login()
        self.driver.get(f'{BASE}/patients')
        opener = self.wait.until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-action-id="PATIENT-CREATE"]'))
        )
        started = time.perf_counter()
        opener.click()
        dialog = self.wait.until(EC.visibility_of_element_located((By.ID, 'patient-form')))
        elapsed_ms = (time.perf_counter() - started) * 1000

        self.assertLess(elapsed_ms, 800, f'Patient dialog took {elapsed_ms:.0f} ms to become visible')
        backdrop = dialog.find_element(By.XPATH, './ancestor::*[contains(@class,"dialog-backdrop")]')
        backdrop_filter = self.driver.execute_script(
            'return getComputedStyle(arguments[0]).backdropFilter', backdrop
        )
        self.assertIn(backdrop_filter, {'none', ''})
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '.leaflet-container'))

        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="PATIENT-MAP-TOGGLE"]').click()
        self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '.leaflet-container')))


if __name__ == '__main__':
    unittest.main(verbosity=2)
