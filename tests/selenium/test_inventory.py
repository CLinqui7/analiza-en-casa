"""CH14 factual inventory-list source coverage; no inventory commitment is created."""
# test-id: SEL-CH14-INVENTORY-LIST
# test-id: SEL-CH14-INVENTORY-ITEM-HISTORY
# test-id: SEL-CH14-INVENTORY-ACKNOWLEDGEMENTS
# test-id: SEL-CH14-INVENTORY-CLOSURES
# test-id: SEL-CH14-INVENTORY-SUPPLIERS
# test-id: SEL-CH14-INVENTORY-WAREHOUSES
# test-id: SEL-CH14-INVENTORY-KITS
# test-id: SEL-INVENTORY-MOVEMENT-SAFETY
# test-id: SEL-INVENTORY-CLOSURE-BOUNDARY
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


class InventoryList(unittest.TestCase):
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

    def login(self, email: str, password: str) -> None:
        self.driver.get(f'{BASE}/login?next=%2Finventory')
        self.driver.execute_script('localStorage.clear()')
        self.driver.refresh()
        email_field = self.wait.until(
            conditions.visibility_of_element_located((By.XPATH, "//label[contains(., 'Usuario')]//input"))
        )
        email_field.clear()
        email_field.send_keys(email)
        password_field = self.driver.find_element(By.CSS_SELECTOR, 'input[type=password]')
        password_field.clear()
        password_field.send_keys(password)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN"]').click()
        self.wait.until(conditions.url_contains('/inventory'))

    def test_admin_searches_factual_inventory_without_audit_mutation(self) -> None:
        started = time.time()
        self.login('admin@demo.local', 'demo-admin')
        before = self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')")
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-ITEM-SEARCH"]').send_keys('sin-inventario-ch14')
        empty = self.driver.find_element(By.CSS_SELECTOR, 'tbody .empty-state')
        self.assertIn('Sin ítems documentados', empty.text)
        self.assertIn('sin-inventario-ch14', empty.text)
        record_pass('INVENTORY-ITEM-SEARCH', 'SEL-CH14-INVENTORY-LIST', started, self.driver.current_url)
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-ITEM-EXPORT"]').is_enabled())
        record_pass('INVENTORY-ITEM-EXPORT', 'SEL-CH14-INVENTORY-LIST', started, self.driver.current_url)
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-TRANSFERS"]').is_enabled())
        record_pass('INVENTORY-TRANSFERS', 'SEL-CH14-INVENTORY-LIST', started, self.driver.current_url)
        self.driver.refresh()
        self.assertEqual(before, self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')"))

    def test_admin_views_read_only_acknowledgements_without_audit_mutation(self) -> None:
        started = time.time()
        self.login('admin@demo.local', 'demo-admin')
        before = self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')")
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-ACKNOWLEDGEMENTS-OPEN"]').click()
        main = self.wait.until(conditions.visibility_of_element_located((By.TAG_NAME, 'main')))
        self.assertIn('Inventario / Acuses', main.text)
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-ACK-AREA"]').is_enabled())
        record_pass('INVENTORY-ACK-AREA', 'SEL-CH14-INVENTORY-ACKNOWLEDGEMENTS', started, self.driver.current_url)
        self.assertTrue(self.driver.find_elements(By.XPATH, "//th[normalize-space()='Identificación']"))
        record_pass('INVENTORY-ACKNOWLEDGEMENTS-OPEN', 'SEL-CH14-INVENTORY-ACKNOWLEDGEMENTS', started, self.driver.current_url)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-ACK-TAB-PATIENTS"]').click()
        self.assertTrue(self.driver.find_elements(By.XPATH, "//th[normalize-space()='Paciente']"))
        self.assertIn('Sin pacientes documentados', main.text)
        self.assertNotIn('Paciente Demo Aurora', main.text)
        record_pass('INVENTORY-ACK-TAB-PATIENTS', 'SEL-CH14-INVENTORY-ACKNOWLEDGEMENTS', started, self.driver.current_url)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-ACK-TAB-RESOURCES"]').click()
        self.assertIn('Sin recursos documentados', main.text)
        record_pass('INVENTORY-ACK-TAB-RESOURCES', 'SEL-CH14-INVENTORY-ACKNOWLEDGEMENTS', started, self.driver.current_url)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-ACK-TAB-UNAVAILABLE"]').click()
        self.assertIn('Sin registros no disponibles', main.text)
        record_pass('INVENTORY-ACK-TAB-UNAVAILABLE', 'SEL-CH14-INVENTORY-ACKNOWLEDGEMENTS', started, self.driver.current_url)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-ACK-TAB-REQUESTS"]').click()
        self.assertIn('Sin solicitudes documentadas', main.text)
        record_pass('INVENTORY-ACK-TAB-REQUESTS', 'SEL-CH14-INVENTORY-ACKNOWLEDGEMENTS', started, self.driver.current_url)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-ACK-TAB-TASKS"]').click()
        self.assertIn('Sin tareas documentadas', main.text)
        record_pass('INVENTORY-ACK-TAB-TASKS', 'SEL-CH14-INVENTORY-ACKNOWLEDGEMENTS', started, self.driver.current_url)
        self.driver.refresh()
        self.assertEqual(before, self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')"))

    def test_inventory_role_reads_the_same_empty_acknowledgement_patient_surface(self) -> None:
        self.login('inventory@demo.local', 'demo-inventory')
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-ACKNOWLEDGEMENTS-OPEN"]').click()
        main = self.driver.find_element(By.TAG_NAME, 'main')
        self.assertIn('Sin pacientes documentados', main.text)
        self.assertTrue(self.driver.find_elements(By.XPATH, "//th[normalize-space()='Paciente']"))
        self.assertNotIn('Paciente Demo Aurora', main.text)

    def test_nurse_is_denied_inventory_direct_route(self) -> None:
        self.login('nurse@demo.local', 'demo-nurse')
        denied = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('Acceso restringido para el rol NURSE', denied.text)
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="INVENTORY-ITEM-HISTORY-OPEN"]'))
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="INVENTORY-CLOSURES-OPEN"]'))
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="INVENTORY-SUPPLIERS-OPEN"]'))

    def test_movement_creation_persists_and_refuses_negative_stock(self) -> None:
        started = time.time()
        self.login('admin@demo.local', 'demo-admin')
        self.driver.get(f'{BASE}/inventory/kardex')
        self.wait.until(
            conditions.element_to_be_clickable(
                (By.CSS_SELECTOR, '[data-action-id="INVENTORY-MOVEMENT-CREATE"]')
            )
        ).click()
        dialog = self.wait.until(
            conditions.visibility_of_element_located((By.CSS_SELECTOR, '[role="dialog"]'))
        )
        dialog.find_element(By.XPATH, ".//label[contains(., 'Tipo de movimiento')]//select").send_keys('Entrada')
        quantity = dialog.find_element(By.XPATH, ".//label[contains(., 'Cantidad')]//input")
        quantity.clear()
        quantity.send_keys('3')
        dialog.find_element(By.XPATH, ".//label[contains(., 'Referencia')]//input").send_keys('SEL-MOV-001')
        dialog.find_element(By.XPATH, ".//label[contains(., 'Motivo')]//input").send_keys('Entrada sintética Selenium')
        dialog.find_element(By.CSS_SELECTOR, 'button[form="movement-form"]').click()
        self.wait.until(
            conditions.visibility_of_element_located((By.XPATH, "//*[contains(., 'Movimiento persistido')]") )
        )
        self.assertIn('SEL-MOV-001', self.driver.find_element(By.TAG_NAME, 'main').text)
        self.driver.refresh()
        self.wait.until(conditions.visibility_of_element_located((By.TAG_NAME, 'main')))
        self.assertIn('SEL-MOV-001', self.driver.find_element(By.TAG_NAME, 'main').text)

        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-MOVEMENT-CREATE"]').click()
        dialog = self.wait.until(
            conditions.visibility_of_element_located((By.CSS_SELECTOR, '[role="dialog"]'))
        )
        dialog.find_element(By.XPATH, ".//label[contains(., 'Tipo de movimiento')]//select").send_keys('Salida')
        quantity = dialog.find_element(By.XPATH, ".//label[contains(., 'Cantidad')]//input")
        quantity.clear()
        quantity.send_keys('999999')
        dialog.find_element(By.XPATH, ".//label[contains(., 'Motivo')]//input").send_keys('Salida negativa bloqueada')
        dialog.find_element(By.CSS_SELECTOR, 'button[form="movement-form"]').click()
        self.assertIn('saldo negativo', dialog.text)
        self.assertNotIn('999999', self.driver.find_element(By.TAG_NAME, 'main').text)
        record_pass('INVENTORY-MOVEMENT-CREATE', 'SEL-INVENTORY-MOVEMENT-SAFETY', started, self.driver.current_url)

        self.login('auditor@demo.local', 'demo-auditor')
        self.driver.get(f'{BASE}/inventory/kardex')
        self.wait.until(conditions.visibility_of_element_located((By.TAG_NAME, 'main')))
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="INVENTORY-MOVEMENT-CREATE"]'))

    def test_closure_approval_is_an_explicit_non_mutating_boundary(self) -> None:
        started = time.time()
        self.login('admin@demo.local', 'demo-admin')
        before = self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')")
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-CLOSURES-OPEN"]').click()
        main = self.wait.until(conditions.visibility_of_element_located((By.TAG_NAME, 'main')))
        self.assertIn('ni crea, aprueba, cancela, concilia o revierte cierres', main.text.lower())
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="INVENTORY-CLOSURE-APPROVE"]'))
        self.assertFalse(self.driver.find_elements(By.XPATH, "//button[normalize-space()='Aprobar cierre']"))
        self.driver.refresh()
        self.assertEqual(before, self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')"))
        record_pass('INVENTORY-CLOSURE-APPROVE', 'SEL-INVENTORY-CLOSURE-BOUNDARY', started, self.driver.current_url)

    def test_admin_opens_and_filters_item_history_without_audit_mutation(self) -> None:
        started = time.time()
        self.login('admin@demo.local', 'demo-admin')
        before = self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')")
        self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="INVENTORY-ITEM-HISTORY-OPEN"]')[0].click()
        dialog = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, '[role="dialog"]')))
        self.assertIn('Movimientos de item', dialog.text)
        self.assertEqual(dialog.find_element(By.XPATH, ".//label[contains(., 'Código')]//input").get_attribute('value'), 'KIT-DEMO-001')
        record_pass('INVENTORY-ITEM-HISTORY-OPEN', 'SEL-CH14-INVENTORY-ITEM-HISTORY', started, self.driver.current_url)
        from_input = dialog.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-ITEM-HISTORY-FROM"]')
        self.driver.execute_script(
            "const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;"
            "set.call(arguments[0], arguments[1]);"
            "arguments[0].dispatchEvent(new Event('input', { bubbles: true }));"
            "arguments[0].dispatchEvent(new Event('change', { bubbles: true }));",
            from_input,
            '2026-08-28',
        )
        rows = dialog.find_elements(By.CSS_SELECTOR, 'tbody tr')
        self.assertEqual(len(rows), 1)
        self.assertIn('EXIT', rows[0].text)
        record_pass('INVENTORY-ITEM-HISTORY-FROM', 'SEL-CH14-INVENTORY-ITEM-HISTORY', started, self.driver.current_url)
        to_input = dialog.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-ITEM-HISTORY-TO"]')
        self.driver.execute_script(
            "const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;"
            "set.call(arguments[0], arguments[1]);"
            "arguments[0].dispatchEvent(new Event('input', { bubbles: true }));"
            "arguments[0].dispatchEvent(new Event('change', { bubbles: true }));",
            to_input,
            '2026-08-27',
        )
        self.assertIn('Sin movimientos en el rango', dialog.text)
        record_pass('INVENTORY-ITEM-HISTORY-TO', 'SEL-CH14-INVENTORY-ITEM-HISTORY', started, self.driver.current_url)
        self.driver.refresh()
        self.assertEqual(before, self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')"))

    def test_admin_views_read_only_closures_without_audit_mutation(self) -> None:
        started = time.time()
        self.login('admin@demo.local', 'demo-admin')
        before = self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')")
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-CLOSURES-OPEN"]').click()
        main = self.wait.until(conditions.visibility_of_element_located((By.TAG_NAME, 'main')))
        self.assertIn('Inventario / Cierres', main.text)
        self.assertTrue(self.driver.find_elements(By.XPATH, "//h2[normalize-space()='Pacientes activos']"))
        self.assertTrue(self.driver.find_elements(By.XPATH, "//th[normalize-space()='DUI/NIT']"))
        self.assertTrue(self.driver.find_elements(By.XPATH, "//th[normalize-space()='Fecha de inicio']"))
        self.assertIn('Sin cierres documentados', main.text)
        self.assertNotIn('Paciente Demo Aurora', main.text)
        record_pass('INVENTORY-CLOSURES-OPEN', 'SEL-CH14-INVENTORY-CLOSURES', started, self.driver.current_url)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-CLOSURES-TAB-PENDING"]').click()
        self.assertEqual(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-CLOSURES-TAB-PENDING"]').get_attribute('aria-selected'), 'true')
        self.assertIn('Sin cierres documentados', main.text)
        record_pass('INVENTORY-CLOSURES-TAB-PENDING', 'SEL-CH14-INVENTORY-CLOSURES', started, self.driver.current_url)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-CLOSURES-TAB-TOTALS"]').click()
        self.assertIn('Sin cierres totales documentados', main.text)
        record_pass('INVENTORY-CLOSURES-TAB-TOTALS', 'SEL-CH14-INVENTORY-CLOSURES', started, self.driver.current_url)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-CLOSURES-TAB-CLOSED"]').click()
        self.assertIn('Sin cierres cerrados documentados', main.text)
        record_pass('INVENTORY-CLOSURES-TAB-CLOSED', 'SEL-CH14-INVENTORY-CLOSURES', started, self.driver.current_url)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-CLOSURES-TAB-RESOURCES"]').click()
        self.assertIn('Sin recursos de cierre documentados', main.text)
        record_pass('INVENTORY-CLOSURES-TAB-RESOURCES', 'SEL-CH14-INVENTORY-CLOSURES', started, self.driver.current_url)
        self.driver.refresh()
        self.assertEqual(before, self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')"))

    def test_admin_reads_empty_supplier_list_without_audit_mutation(self) -> None:
        started = time.time()
        self.login('admin@demo.local', 'demo-admin')
        before = self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')")
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-SUPPLIERS-OPEN"]').click()
        main = self.wait.until(conditions.visibility_of_element_located((By.TAG_NAME, 'main')))
        self.assertIn('Inventario / Proveedores', main.text)
        self.assertTrue(self.driver.find_elements(By.XPATH, "//th[normalize-space()='Código']"))
        self.assertTrue(self.driver.find_elements(By.XPATH, "//th[normalize-space()='Dirección']"))
        self.assertIn('Sin proveedores documentados', main.text)
        record_pass('INVENTORY-SUPPLIERS-OPEN', 'SEL-CH14-INVENTORY-SUPPLIERS', started, self.driver.current_url)
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-SUPPLIERS-CREATE"]').is_enabled())
        record_pass('INVENTORY-SUPPLIERS-CREATE', 'SEL-CH14-INVENTORY-SUPPLIERS', started, self.driver.current_url)
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-SUPPLIERS-PAGE-SIZE"]').is_enabled())
        record_pass('INVENTORY-SUPPLIERS-PAGE-SIZE', 'SEL-CH14-INVENTORY-SUPPLIERS', started, self.driver.current_url)
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-SUPPLIERS-PAGE-PREV"]').is_enabled())
        record_pass('INVENTORY-SUPPLIERS-PAGE-PREV', 'SEL-CH14-INVENTORY-SUPPLIERS', started, self.driver.current_url)
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-SUPPLIERS-PAGE-NEXT"]').is_enabled())
        record_pass('INVENTORY-SUPPLIERS-PAGE-NEXT', 'SEL-CH14-INVENTORY-SUPPLIERS', started, self.driver.current_url)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-SUPPLIERS-SEARCH"]').send_keys('sin-proveedor-ch14')
        self.assertIn('sin-proveedor-ch14', main.text)
        record_pass('INVENTORY-SUPPLIERS-SEARCH', 'SEL-CH14-INVENTORY-SUPPLIERS', started, self.driver.current_url)
        self.driver.refresh()
        self.assertEqual(before, self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')"))

    def test_inventory_role_reads_empty_supplier_list(self) -> None:
        self.login('inventory@demo.local', 'demo-inventory')
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-SUPPLIERS-OPEN"]').click()
        main = self.driver.find_element(By.TAG_NAME, 'main')
        self.assertIn('Inventario / Proveedores', main.text)
        self.assertIn('Sin proveedores documentados', main.text)

    def test_auditor_searches_empty_supplier_list_without_audit_mutation(self) -> None:
        self.login('auditor@demo.local', 'demo-auditor')
        before = self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')")
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-SUPPLIERS-OPEN"]').click()
        search = self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-SUPPLIERS-SEARCH"]')
        search.send_keys('sin-proveedor-auditor')
        main = self.driver.find_element(By.TAG_NAME, 'main')
        self.assertIn('Inventario / Proveedores', main.text)
        self.assertIn('sin-proveedor-auditor', main.text)
        self.driver.refresh()
        self.assertEqual(before, self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')"))

    def test_doctor_is_denied_inventory_direct_route(self) -> None:
        self.login('doctor@demo.local', 'demo-doctor')
        denied = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('DOCTOR', denied.text)
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="INVENTORY-SUPPLIERS-OPEN"]'))

    def test_finance_is_denied_inventory_direct_route(self) -> None:
        self.login('finance@demo.local', 'demo-finance')
        denied = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('FINANCE', denied.text)
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="INVENTORY-SUPPLIERS-OPEN"]'))

    def test_admin_reads_empty_warehouses_without_audit_mutation(self) -> None:
        started = time.time()
        self.login('admin@demo.local', 'demo-admin')
        before = self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')")
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-WAREHOUSES-OPEN"]').click()
        main = self.wait.until(conditions.visibility_of_element_located((By.TAG_NAME, 'main')))
        self.assertIn('Items / Bodegas', main.text)
        self.assertIn('Sin bodegas documentadas', main.text)
        record_pass('INVENTORY-WAREHOUSES-OPEN', 'SEL-CH14-INVENTORY-WAREHOUSES', started, self.driver.current_url)
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-WAREHOUSES-ACTIVE-FILTER"]').is_enabled())
        record_pass('INVENTORY-WAREHOUSES-ACTIVE-FILTER', 'SEL-CH14-INVENTORY-WAREHOUSES', started, self.driver.current_url)
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-WAREHOUSES-PAGE-SIZE"]').is_enabled())
        record_pass('INVENTORY-WAREHOUSES-PAGE-SIZE', 'SEL-CH14-INVENTORY-WAREHOUSES', started, self.driver.current_url)
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-WAREHOUSES-PAGE-PREV"]').is_enabled())
        record_pass('INVENTORY-WAREHOUSES-PAGE-PREV', 'SEL-CH14-INVENTORY-WAREHOUSES', started, self.driver.current_url)
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-WAREHOUSES-PAGE-NEXT"]').is_enabled())
        record_pass('INVENTORY-WAREHOUSES-PAGE-NEXT', 'SEL-CH14-INVENTORY-WAREHOUSES', started, self.driver.current_url)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-WAREHOUSES-SEARCH"]').send_keys('sin-bodega-ch14')
        self.assertIn('sin-bodega-ch14', main.text)
        record_pass('INVENTORY-WAREHOUSES-SEARCH', 'SEL-CH14-INVENTORY-WAREHOUSES', started, self.driver.current_url)
        self.driver.refresh()
        self.assertEqual(before, self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')"))

    def test_inventory_role_reads_empty_warehouses(self) -> None:
        self.login('inventory@demo.local', 'demo-inventory')
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-WAREHOUSES-OPEN"]').click()
        self.assertIn('Sin bodegas documentadas', self.driver.find_element(By.TAG_NAME, 'main').text)

    def test_auditor_searches_empty_warehouses(self) -> None:
        self.login('auditor@demo.local', 'demo-auditor')
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-WAREHOUSES-OPEN"]').click()
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-WAREHOUSES-SEARCH"]').send_keys('sin-bodega-auditor')
        self.assertIn('sin-bodega-auditor', self.driver.find_element(By.TAG_NAME, 'main').text)

    def test_doctor_is_denied_inventory_warehouse_direct_route(self) -> None:
        self.login('doctor@demo.local', 'demo-doctor')
        denied = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('DOCTOR', denied.text)
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="INVENTORY-WAREHOUSES-OPEN"]'))

    def test_nurse_is_denied_inventory_warehouse_direct_route(self) -> None:
        self.login('nurse@demo.local', 'demo-nurse')
        denied = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('NURSE', denied.text)
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="INVENTORY-WAREHOUSES-OPEN"]'))

    def test_finance_is_denied_inventory_warehouse_direct_route(self) -> None:
        self.login('finance@demo.local', 'demo-finance')
        denied = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('FINANCE', denied.text)
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="INVENTORY-WAREHOUSES-OPEN"]'))

    def test_admin_reads_empty_kits_without_audit_mutation(self) -> None:
        started = time.time()
        self.login('admin@demo.local', 'demo-admin')
        before = self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')")
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-KITS-OPEN"]').click()
        main = self.wait.until(conditions.visibility_of_element_located((By.TAG_NAME, 'main')))
        self.assertIn('Inventario / Kit de insumos', main.text)
        self.assertIn('Sin kits documentados', main.text)
        self.assertTrue(self.driver.find_elements(By.XPATH, "//th[normalize-space()='Actualizado por']"))
        self.assertTrue(self.driver.find_elements(By.XPATH, "//th[normalize-space()='Fecha actualización']"))
        record_pass('INVENTORY-KITS-OPEN', 'SEL-CH14-INVENTORY-KITS', started, self.driver.current_url)
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-KITS-EXPORT"]').is_enabled())
        record_pass('INVENTORY-KITS-EXPORT', 'SEL-CH14-INVENTORY-KITS', started, self.driver.current_url)
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-KITS-CREATE"]').is_enabled())
        record_pass('INVENTORY-KITS-CREATE', 'SEL-CH14-INVENTORY-KITS', started, self.driver.current_url)
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-KITS-PAGE-SIZE"]').is_enabled())
        record_pass('INVENTORY-KITS-PAGE-SIZE', 'SEL-CH14-INVENTORY-KITS', started, self.driver.current_url)
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-KITS-PAGE-PREV"]').is_enabled())
        record_pass('INVENTORY-KITS-PAGE-PREV', 'SEL-CH14-INVENTORY-KITS', started, self.driver.current_url)
        self.assertFalse(self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-KITS-PAGE-NEXT"]').is_enabled())
        record_pass('INVENTORY-KITS-PAGE-NEXT', 'SEL-CH14-INVENTORY-KITS', started, self.driver.current_url)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-KITS-SEARCH"]').send_keys('sin-kit-ch14')
        self.assertIn('sin-kit-ch14', main.text)
        record_pass('INVENTORY-KITS-SEARCH', 'SEL-CH14-INVENTORY-KITS', started, self.driver.current_url)
        self.driver.refresh()
        self.assertEqual(before, self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')"))

    def test_inventory_role_reads_empty_kits(self) -> None:
        self.login('inventory@demo.local', 'demo-inventory')
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-KITS-OPEN"]').click()
        self.assertIn('Sin kits documentados', self.driver.find_element(By.TAG_NAME, 'main').text)

    def test_auditor_searches_empty_kits(self) -> None:
        self.login('auditor@demo.local', 'demo-auditor')
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-KITS-OPEN"]').click()
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="INVENTORY-KITS-SEARCH"]').send_keys('sin-kit-auditor')
        self.assertIn('sin-kit-auditor', self.driver.find_element(By.TAG_NAME, 'main').text)

    def test_doctor_is_denied_inventory_kits_direct_route(self) -> None:
        self.login('doctor@demo.local', 'demo-doctor')
        denied = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('DOCTOR', denied.text)
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="INVENTORY-KITS-OPEN"]'))

    def test_nurse_is_denied_inventory_kits_direct_route(self) -> None:
        self.login('nurse@demo.local', 'demo-nurse')
        denied = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('NURSE', denied.text)
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="INVENTORY-KITS-OPEN"]'))
    def test_finance_is_denied_inventory_kits_direct_route(self) -> None:
        self.login('finance@demo.local', 'demo-finance')
        denied = self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, 'main[role="alert"]')))
        self.assertIn('FINANCE', denied.text)
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '[data-action-id="INVENTORY-KITS-OPEN"]'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
