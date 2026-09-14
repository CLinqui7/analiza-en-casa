"""Medication selectors and fail-closed demo behavior with synthetic data only."""
# test-id: SEL-MEDICATION-SEED-SELECTORS
# test-id: SEL-MEDICATION-DEMO-FAIL-CLOSED

from __future__ import annotations

import os
import unittest

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.select import Select
from selenium.webdriver.support.ui import WebDriverWait


BASE = os.getenv('SELENIUM_BASE_URL', 'http://127.0.0.1:4174')


class MedicationAdministration(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        options = webdriver.ChromeOptions()
        options.add_argument('--headless=new')
        options.add_argument('--window-size=1440,1000')
        cls.driver = webdriver.Chrome(options=options)
        cls.wait = WebDriverWait(cls.driver, 15)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.driver.quit()

    def action(self, action_id: str):
        return self.driver.find_element(By.CSS_SELECTOR, f'[data-action-id="{action_id}"]')

    def test_seeded_selectors_and_demo_failure_are_explicit(self) -> None:
        self.driver.get(f'{BASE}/login')
        self.wait.until(lambda driver: driver.execute_script('return document.readyState') == 'complete')
        self.driver.execute_script('localStorage.clear()')
        self.driver.get(f'{BASE}/login?next=%2Fclinical%2Fadministrations')
        email = self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN-EMAIL"]')))
        email.clear()
        email.send_keys('admin@demo.local')
        password = self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN-PASSWORD"]')
        password.clear()
        password.send_keys('demo-admin')
        self.action('AUTH-LOGIN').click()
        self.wait.until(lambda driver: '/login' not in driver.current_url)
        self.driver.get(f'{BASE}/clinical/administrations')
        self.wait.until(EC.url_contains('/clinical/administrations'))

        self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-action-id="MEDICATION-ADMINISTER"]'))).click()
        medication = Select(self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="MEDICATION-ADMINISTRATION-MEDICATION"]'))))
        dose = Select(self.action('MEDICATION-ADMINISTRATION-DOSE'))
        self.assertIn('Unidad inerte QA (sin uso clínico)', [option.text for option in medication.options])
        self.assertIn('Etiqueta de dosis QA — requiere validación clínica', [option.text for option in dose.options])

        medication.select_by_value('configuration-demo-medication-qa')
        dose.select_by_value('configuration-demo-dose-qa')
        Select(self.action('MEDICATION-ADMINISTRATION-PRESENTATION')).select_by_value('BLISTER')
        self.wait.until(EC.visibility_of_element_located((By.XPATH, "//*[contains(.,'Se descontarán 5 tabletas')]")))
        datetime_control = self.action('MEDICATION-ADMINISTRATION-DATETIME')
        self.driver.execute_script(
            "const input=arguments[0];"
            "const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;"
            "setter.call(input,'2026-09-10T08:30');"
            "input.dispatchEvent(new Event('input',{bubbles:true}));"
            "input.dispatchEvent(new Event('change',{bubbles:true}));",
            datetime_control,
        )
        self.assertEqual(datetime_control.get_attribute('value'), '2026-09-10T08:30')
        self.action('MEDICATION-ADMINISTRATION-CONFIRM').click()

        error = self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[role="alert"]')))
        self.assertIn('conexión MongoDB', error.text)
        self.assertTrue(self.action('MEDICATION-ADMINISTRATION-CONFIRM').is_displayed())
        self.assertNotIn('inventario descontado', self.driver.find_element(By.TAG_NAME, 'body').text)


if __name__ == '__main__':
    unittest.main(verbosity=2)
