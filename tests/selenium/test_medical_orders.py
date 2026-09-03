"""Assertion-backed source coverage for the safe CH10 factual list."""
# test-id: SEL-CH10-MEDICAL-ORDER-LIST

from __future__ import annotations

import unittest

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC

import test_hospitalizations as hospitalization_tests

BASE = hospitalization_tests.BASE


class MedicalOrders(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        hospitalization_tests.Hospitalizations.setUpClass()
        cls.d = hospitalization_tests.Hospitalizations.d
        cls.w = hospitalization_tests.Hospitalizations.w

    @classmethod
    def tearDownClass(cls) -> None:
        hospitalization_tests.Hospitalizations.tearDownClass()

    reset_mock_state = hospitalization_tests.Hospitalizations.reset_mock_state
    login_as = hospitalization_tests.Hospitalizations.login_as
    prepare_authenticated_test = hospitalization_tests.Hospitalizations.prepare_authenticated_test
    action = hospitalization_tests.Hospitalizations.action

    def setUp(self) -> None:
        self.prepare_authenticated_test()

    def test_ch10_factual_list_search_tabs_pagination_and_blocked_controls(self) -> None:
        self.d.get(f'{BASE}/clinical/orders')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//h1[normalize-space()='Orden Médica']")))
        self.assertTrue(self.d.find_elements(By.XPATH, "//th[normalize-space()='Nombre']"))
        self.assertTrue(self.d.find_elements(By.XPATH, "//th[normalize-space()='Cédula']"))
        self.assertTrue(self.d.find_elements(By.XPATH, "//th[normalize-space()='Triage']"))
        self.assertFalse(self.d.find_element(By.CSS_SELECTOR, '[data-action-id="MEDICAL-ORDER-TAB-CHANGES"]').is_enabled())
        self.assertFalse(self.d.find_element(By.CSS_SELECTOR, '[data-action-id="MEDICAL-ORDER-TAB-UPDATES"]').is_enabled())

        search = self.d.find_element(By.CSS_SELECTOR, '[data-action-id="MEDICAL-ORDER-SEARCH"]')
        search.send_keys('Aurora')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[normalize-space()='Paciente Demo Aurora']")))
        search.send_keys(Keys.CONTROL, 'a')
        search.send_keys(Keys.BACKSPACE)
        search.send_keys('sin-coincidencia-ch10')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[normalize-space()='No hay registros disponibles']")))
        search.send_keys(Keys.CONTROL, 'a')
        search.send_keys(Keys.BACKSPACE)

        self.d.find_element(By.CSS_SELECTOR, '[data-action-id="MEDICAL-ORDER-TAB-INACTIVE"]').click()
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[normalize-space()='Paciente Demo Brisa']")))
        self.d.find_element(By.CSS_SELECTOR, '[data-action-id="MEDICAL-ORDER-TAB-ACTIVE"]').click()
        self.d.find_element(By.CSS_SELECTOR, '[data-action-id="MEDICAL-ORDER-PAGE-NEXT"]').click()
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[normalize-space()='Paciente Demo Gloria']")))

    def test_ch10_admin_menu_preserves_clinical_creation_boundary(self) -> None:
        self.d.get(f'{BASE}/clinical/orders')
        menu = self.w.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[aria-label="Acciones para Paciente Demo Aurora"]')))
        menu.click()
        self.assertFalse(self.d.find_element(By.CSS_SELECTOR, '[data-action-id="MEDICAL-ORDER-VIEW"]').is_enabled())
        self.assertFalse(self.d.find_element(By.CSS_SELECTOR, '[data-action-id="MEDICAL-ORDER-XPO"]').is_enabled())
        self.d.find_element(By.CSS_SELECTOR, '[data-action-id="MEDICAL-ORDER-CREATE"]').click()
        dialog = self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[role="dialog"]')))
        self.assertFalse(dialog.find_element(By.XPATH, ".//button[normalize-space()='Orden Médica']").is_enabled())
        self.assertFalse(dialog.find_element(By.XPATH, ".//button[normalize-space()='Tarjeta de medicamentos']").is_enabled())

    def test_ch10_doctor_can_read_the_factual_list(self) -> None:
        self.prepare_authenticated_test('doctor@demo.local', 'demo-doctor', 'DOCTOR')
        self.d.get(f'{BASE}/clinical/orders')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//h1[normalize-space()='Orden Médica']")))
        self.assertTrue(self.d.find_elements(By.XPATH, "//*[normalize-space()='Paciente Demo Aurora']"))

    def test_ch10_nurse_cannot_expose_new_document_action(self) -> None:
        self.prepare_authenticated_test('nurse@demo.local', 'demo-nurse', 'NURSE')
        self.d.get(f'{BASE}/clinical/orders')
        self.w.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[aria-label="Acciones para Paciente Demo Aurora"]'))).click()
        self.assertFalse(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="MEDICAL-ORDER-CREATE"]'))

    def test_ch10_inventory_direct_route_is_denied(self) -> None:
        self.prepare_authenticated_test('inventory@demo.local', 'demo-inventory', 'INVENTORY')
        self.d.get(f'{BASE}/clinical/orders')
        denied = self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[role="alert"]')))
        self.assertIn('Acceso restringido para el rol INVENTORY.', denied.text)

    def test_ch10_finance_direct_route_is_denied(self) -> None:
        self.prepare_authenticated_test('finance@demo.local', 'demo-finance', 'FINANCE')
        self.d.get(f'{BASE}/clinical/orders')
        denied = self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[role="alert"]')))
        self.assertIn('Acceso restringido para el rol FINANCE.', denied.text)
