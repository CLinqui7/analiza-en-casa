"""Assertion-backed source coverage for the safe CH09 list surface."""
# test-id: SEL-CH09-CLINICAL-HOSPITALIZATION-LIST

from __future__ import annotations

import unittest

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC

import test_hospitalizations as hospitalization_tests

BASE = hospitalization_tests.BASE


class ClinicalHospitalizationList(unittest.TestCase):
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

    def test_ch09_list_exposes_factual_columns_and_blocks_undefined_clinical_filters(self) -> None:
        self.d.get(f'{BASE}/clinical/hospitalizations')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//h1[normalize-space()='Hospitalización Clínica']")))
        self.assertTrue(self.d.find_elements(By.XPATH, "//th[normalize-space()='Paciente']"))
        self.assertTrue(self.d.find_elements(By.XPATH, "//th[normalize-space()='Acciones']"))
        self.assertTrue(self.d.find_elements(By.XPATH, "//th[normalize-space()='DUI/NIT']"))
        self.assertTrue(self.d.find_elements(By.XPATH, "//th[normalize-space()='Hospitalización']"))
        self.assertTrue(self.d.find_elements(By.XPATH, "//th[normalize-space()='Triage']"))
        self.assertTrue(self.d.find_elements(By.XPATH, "//th[normalize-space()='Empresa']"))
        self.assertTrue(self.d.find_elements(By.XPATH, "//th[normalize-space()='Clínico']"))
        self.assertTrue(self.d.find_elements(By.XPATH, "//th[normalize-space()='Inicio']"))
        self.assertTrue(self.d.find_elements(By.XPATH, "//th[normalize-space()='Fin']"))
        self.assertTrue(self.d.find_elements(By.XPATH, "//th[normalize-space()='Duración']"))
        self.assertFalse(self.d.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-STATUS-FILTER"]').is_enabled())
        self.assertFalse(self.d.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-ACTIVES-FILTER"]').is_enabled())
        self.assertFalse(self.d.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-FILTER-APPLY"]').is_enabled())
        self.assertEqual(len(self.d.find_elements(By.CSS_SELECTOR, 'thead tr')), 2)
        self.assertEqual(self.d.find_elements(By.CSS_SELECTOR, 'thead tr')[1].find_elements(By.CSS_SELECTOR, 'th')[0].text, '')
        self.assertFalse(self.d.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-ACTIVATOR-FILTER"]').is_enabled())
        self.assertFalse(self.d.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-SERVICE-FILTER"]').is_enabled())
        self.assertFalse(self.d.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-CARE-FILTER"]').is_enabled())
        self.assertIn('no se aplican como reglas locales', self.d.find_element(By.CSS_SELECTOR, '[role="status"]').text)

        search = self.d.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-SEARCH"]')
        search.send_keys('sin-coincidencia-ch09')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[normalize-space()='Sin hospitalizaciones coincidentes']")))
        search.clear()
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"]')))
        patient_filter = self.d.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-PATIENT-COLUMN-FILTER"]')
        patient_filter.send_keys('Aurora')
        matching_detail = self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"]')))
        self.assertTrue(matching_detail.get_attribute('href').endswith('/hospitalizations/case-demo-001'))
        patient_filter.clear()
        patient_filter.send_keys('sin-coincidencia-columna-ch09')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[normalize-space()='Sin hospitalizaciones coincidentes']")))
        patient_filter.clear()
        document_filter = self.d.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-DOCUMENT-COLUMN-FILTER"]')
        document_filter.send_keys('12345678-9')
        self.assertTrue(self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"]'))))
        document_filter.clear()
        document_filter.send_keys('sin-documento-ch09')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[normalize-space()='Sin hospitalizaciones coincidentes']")))
        document_filter.clear()

        case_filter = self.d.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-CASE-COLUMN-FILTER"]')
        case_filter.send_keys('CASE-DEMO-001')
        self.assertTrue(self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"]'))))
        case_filter.clear()
        case_filter.send_keys('sin-caso-ch09')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[normalize-space()='Sin hospitalizaciones coincidentes']")))
        case_filter.clear()

        triage_filter = self.d.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-TRIAGE-COLUMN-FILTER"]')
        triage_filter.send_keys('No documentado')
        self.assertTrue(self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"]'))))
        triage_filter.clear()
        triage_filter.send_keys('sin-triage-ch09')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[normalize-space()='Sin hospitalizaciones coincidentes']")))
        triage_filter.clear()

        company_filter = self.d.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-COMPANY-COLUMN-FILTER"]')
        company_filter.send_keys('No documentada')
        self.assertTrue(self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"]'))))
        company_filter.clear()
        company_filter.send_keys('sin-empresa-ch09')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[normalize-space()='Sin hospitalizaciones coincidentes']")))
        company_filter.clear()

        clinician_filter = self.d.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-CLINICIAN-COLUMN-FILTER"]')
        clinician_filter.send_keys('No documentado')
        self.assertTrue(self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"]'))))
        clinician_filter.clear()
        clinician_filter.send_keys('sin-clinico-ch09')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[normalize-space()='Sin hospitalizaciones coincidentes']")))
        clinician_filter.clear()

        start_filter = self.d.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-START-COLUMN-FILTER"]')
        start_filter.send_keys('2026-08-28')
        self.assertTrue(self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"]'))))
        start_filter.clear()
        start_filter.send_keys('sin-inicio-ch09')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[normalize-space()='Sin hospitalizaciones coincidentes']")))
        start_filter.clear()

        end_filter = self.d.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-END-COLUMN-FILTER"]')
        end_filter.send_keys('En curso')
        self.assertTrue(self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"]'))))
        end_filter.clear()
        end_filter.send_keys('sin-fin-ch09')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[normalize-space()='Sin hospitalizaciones coincidentes']")))
        end_filter.clear()

        duration_filter = self.d.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-DURATION-COLUMN-FILTER"]')
        duration_filter.send_keys('En curso')
        self.assertTrue(self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"]'))))
        duration_filter.clear()
        duration_filter.send_keys('sin-duracion-ch09')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[normalize-space()='Sin hospitalizaciones coincidentes']")))
        duration_filter.clear()
        search.send_keys('case-demo-001')
        detail = self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"]')))
        self.assertTrue(detail.get_attribute('href').endswith('/hospitalizations/case-demo-001'))

    def test_ch09_doctor_can_open_the_authorized_detail_from_the_clinical_list(self) -> None:
        self.prepare_authenticated_test('doctor@demo.local', 'demo-doctor', 'DOCTOR')
        self.d.get(f'{BASE}/clinical/hospitalizations')
        detail = self.w.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"]')))
        detail.click()
        self.w.until(EC.url_matches(r'.*/hospitalizations/case-demo-001$'))
        self.assertTrue(self.d.find_elements(By.XPATH, "//h1[normalize-space()='case-demo-001']"))

    def test_ch09_row_menu_opens_the_scoped_quote_and_blocks_undefined_clinical_workflows(self) -> None:
        self.d.get(f'{BASE}/clinical/hospitalizations')
        menu = self.w.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-ACTIONS-MENU"]')))
        menu.click()
        self.assertEqual(menu.get_attribute('aria-expanded'), 'true')
        quote = self.w.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-QUOTE-VIEW"]')))
        self.assertTrue(quote.get_attribute('href').endswith('/quotes/quote-demo-001'))
        self.assertFalse(self.d.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-PROFILE-OPEN"]').is_enabled())
        self.assertFalse(self.d.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-RELIEF-DOCUMENT-OPEN"]').is_enabled())
        self.assertFalse(self.d.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-READMISSION-OPEN"]').is_enabled())
        self.assertFalse(self.d.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-REINFECTION-OPEN"]').is_enabled())
        self.assertFalse(self.d.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-ULCERATION-OPEN"]').is_enabled())
        self.assertFalse(self.d.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-NEAR-MISS-OPEN"]').is_enabled())
        self.assertIn('CH09-Q006', self.d.find_element(By.CSS_SELECTOR, '.clinical-row-menu .field-help').text)
        quote.click()
        self.w.until(EC.url_matches(r'.*/quotes/quote-demo-001$'))
        self.assertTrue(self.d.find_elements(By.XPATH, "//h1[normalize-space()='quote-demo-001']"))

    def test_ch09_nurse_cannot_expose_quote_navigation_from_the_clinical_row_menu(self) -> None:
        self.prepare_authenticated_test('nurse@demo.local', 'demo-nurse', 'NURSE')
        self.d.get(f'{BASE}/clinical/hospitalizations')
        menu = self.w.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-ACTIONS-MENU"]')))
        menu.click()
        self.assertEqual(menu.get_attribute('aria-expanded'), 'true')
        self.assertFalse(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-QUOTE-VIEW"]'))
        self.assertFalse(self.d.find_element(By.CSS_SELECTOR, '[data-action-id="CLINICAL-HOSPITALIZATION-PROFILE-OPEN"]').is_enabled())

    def test_ch09_inventory_is_denied_the_clinical_hospitalizations_direct_route(self) -> None:
        self.prepare_authenticated_test('inventory@demo.local', 'demo-inventory', 'INVENTORY')
        self.d.get(f'{BASE}/clinical/hospitalizations')
        denied = self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('Acceso restringido para el rol INVENTORY', denied.text)
        self.assertFalse(self.d.find_elements(By.CSS_SELECTOR, '[data-action-id^="CLINICAL-HOSPITALIZATION-"]'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
