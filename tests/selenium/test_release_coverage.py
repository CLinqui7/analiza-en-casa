"""Release Selenium coverage for implemented cross-module React actions.

The cases exercise user-facing controls and assert their resulting state.  They do not
turn client-approval or clinical-contract placeholders into operational behavior.
"""
# test-id: SEL-RELEASE-DASHBOARD
# test-id: SEL-RELEASE-INSURANCE
# test-id: SEL-RELEASE-PAYMENTS
# test-id: SEL-RELEASE-CLINICAL-DOCUMENTS
# test-id: SEL-RELEASE-OPERATIONS
# test-id: SEL-RELEASE-PORTAL

from __future__ import annotations

import os
import subprocess
import tempfile
import time
import unittest
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlparse
from urllib.request import urlopen

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.select import Select
from selenium.webdriver.support.ui import WebDriverWait


ROOT = Path(__file__).resolve().parents[2]
BASE = os.getenv('SELENIUM_BASE_URL', 'http://127.0.0.1:4174')
SERVER: subprocess.Popen[str] | None = None


def ready() -> bool:
    try:
        return urlopen(BASE, timeout=1).status < 500  # nosec B310 -- explicit local test server
    except (URLError, TimeoutError, OSError):
        return False


class ReleaseCoverage(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        global SERVER
        if not ready():
            port = str(urlparse(BASE).port or 4174)
            SERVER = subprocess.Popen(
                ['npm.cmd', 'run', 'dev', '--workspace=@analiza/web', '--', '--port', port],
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
            raise RuntimeError('El servidor React local no inici\u00f3 en 60 segundos.')
        cls.temp_dir = tempfile.TemporaryDirectory(prefix='analiza-release-selenium-')
        cls.download_dir = Path(cls.temp_dir.name) / 'downloads'
        cls.download_dir.mkdir()
        options = webdriver.ChromeOptions()
        options.add_argument('--headless=new')
        options.add_argument('--window-size=1440,1000')
        options.add_argument('--no-first-run')
        options.add_experimental_option(
            'prefs',
            {
                'download.default_directory': str(cls.download_dir),
                'download.prompt_for_download': False,
                'download.directory_upgrade': True,
            },
        )
        cls.d = webdriver.Chrome(options=options)
        cls.w = WebDriverWait(cls.d, 12)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.d.quit()
        cls.temp_dir.cleanup()
        if SERVER is not None:
            SERVER.terminate()
            try:
                SERVER.wait(timeout=10)
            except subprocess.TimeoutExpired:
                SERVER.kill()

    def setUp(self) -> None:
        self.login_as('admin@demo.local', 'demo-admin', 'ADMIN')

    def action(self, action_id: str):
        return self.d.find_element(By.CSS_SELECTOR, f'[data-action-id="{action_id}"]')

    def click(self, action_id: str) -> None:
        self.w.until(EC.element_to_be_clickable((By.CSS_SELECTOR, f'[data-action-id="{action_id}"]'))).click()

    def login_as(self, email: str, password: str, role: str) -> None:
        self.d.get(f'{BASE}/login')
        self.w.until(lambda driver: driver.execute_script('return document.readyState') == 'complete')
        self.d.execute_script('localStorage.clear()')
        self.d.get(f'{BASE}/login')
        email_box = self.w.until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN-EMAIL"]'))
        )
        email_box.clear()
        email_box.send_keys(email)
        password_box = self.d.find_element(By.CSS_SELECTOR, 'input[type=password]')
        password_box.clear()
        password_box.send_keys(password)
        self.click('AUTH-LOGIN')
        self.w.until(EC.url_contains('/dashboard'))
        session = self.d.execute_script('return localStorage.getItem("analiza.en.casa.mock-session.v1")')
        self.assertIn(f'"role":"{role}"', session)

    def field(self, label: str):
        dialogs = self.d.find_elements(By.CSS_SELECTOR, '[role="dialog"]')
        scope = dialogs[-1] if dialogs else self.d
        nested = scope.find_elements(
            By.XPATH,
            f".//label[contains(normalize-space(.),'{label}')]//*[self::input or self::select or self::textarea]",
        )
        if nested:
            return nested[0]
        return scope.find_element(By.CSS_SELECTOR, f'[aria-label="{label}"]')

    def fill(self, label: str, value: str) -> None:
        control = self.field(label)
        control.clear()
        control.send_keys(value)

    def clear_downloads(self) -> None:
        for path in self.download_dir.iterdir():
            path.unlink()

    def downloaded(self, filename: str) -> Path:
        def complete(_):
            target = self.download_dir / filename
            return target if target.exists() and not list(self.download_dir.glob('*.crdownload')) else False

        return WebDriverWait(self.d, 12).until(complete)

    def create_sent_quote(self) -> None:
        """Create the sent synthetic quote required for the payment precondition through the UI."""
        self.d.get(f'{BASE}/quotes')
        self.click('QUOTE-CREATE')
        patient_select = self.w.until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="QUOTE-PATIENT-SELECT"]'))
        )
        Select(patient_select).select_by_index(1)
        self.fill('Resumen operativo', 'Cotizaci\u00f3n sint\u00e9tica para cobertura Selenium.')
        referral = self.action('QUOTE-REFERRAL')
        referral.clear()
        referral.send_keys('Redes')
        self.w.until(
            EC.element_to_be_clickable((By.XPATH, "//*[@role='option' and normalize-space()='Redes Sociales']"))
        ).click()
        self.click('QUOTE-CREATE-SUBMIT')
        self.w.until(EC.url_to_be(f'{BASE}/quotes'))
        self.w.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-action-id="QUOTE-DETAIL-NAVIGATE"]')))
        self.d.find_elements(By.CSS_SELECTOR, '[data-action-id="QUOTE-DETAIL-NAVIGATE"]')[-1].click()
        self.w.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-action-id="QUOTE-SEND"]'))).click()
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[@role='status' and contains(.,'inmutable')]")))

    def test_dashboard_actions_navigate_to_authorized_existing_workflows(self) -> None:
        self.d.get(f'{BASE}/patients')
        self.click('DASHBOARD-NAVIGATE')
        self.w.until(EC.url_to_be(f'{BASE}/dashboard'))
        self.click('DASHBOARD-PATIENT-CREATE')
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[role="dialog"]')))
        self.assertIn('Agregar paciente', self.d.find_element(By.CSS_SELECTOR, '[role="dialog"]').text)

        self.d.get(f'{BASE}/dashboard')
        self.click('DASHBOARD-QUOTE-CREATE')
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[role="dialog"]')))
        self.assertIn('Nueva cotizaci\u00f3n', self.d.find_element(By.CSS_SELECTOR, '[role="dialog"]').text)

    def test_insurance_actions_preserve_safe_and_append_only_boundaries(self) -> None:
        self.click('FINANCIERO-TOGGLE')
        self.click('INSURANCE-NAVIGATE')
        self.w.until(EC.url_to_be(f'{BASE}/insurance'))
        search = self.action('INSURANCE-SEARCH')
        search.send_keys('Aurora')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[contains(.,'Paciente Demo Aurora')]")))
        self.click('INSURANCE-SEARCH-CLEAR')
        self.assertEqual(search.get_attribute('value'), '')
        Select(self.action('INSURANCE-FILTER-STATUS')).select_by_value('SENT_TO_INSURER')
        self.assertEqual(self.action('INSURANCE-FILTER-STATUS').get_attribute('value'), 'SENT_TO_INSURER')
        self.click('INSURANCE-FILTER-RESET')
        self.assertEqual(self.action('INSURANCE-FILTER-STATUS').get_attribute('value'), '')

        self.click('INSURANCE-UPDATE')
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[role="dialog"]')))
        self.click('INSURANCE-UPDATE-CANCEL')
        self.w.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, '[role="dialog"]')))

        self.click('INSURANCE-UPDATE')
        self.fill('Observaci\u00f3n / respuesta', 'Observaci\u00f3n administrativa sint\u00e9tica Selenium.')
        self.click('INSURANCE-UPDATE-SUBMIT')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[@role='status' and contains(.,'No se modificaron cotizaci\u00f3n')]")))

        self.w.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-action-id="INSURANCE-OPEN-QUOTE"]'))).click()
        self.w.until(EC.url_contains('/quotes/'))
        self.d.get(f'{BASE}/insurance')
        for action_id, label in (
            ('INSURANCE-WHATSAPP', 'WhatsApp'),
            ('INSURANCE-EMAIL', 'Email'),
            ('INSURANCE-SEND', 'Env\u00edo al seguro'),
        ):
            self.click(action_id)
            notice = self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '.notice.success')))
            self.assertIn(label, notice.text)
            self.assertIn('no configurado', notice.text)
        self.click('INSURANCE-CLAIM')
        notice = self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '.notice.success')))
        self.assertIn('CH08-Q002', notice.text)

    def test_payment_and_clinical_document_actions_preserve_auditability(self) -> None:
        self.create_sent_quote()
        self.d.get(f'{BASE}/payments')
        self.click('PAYMENT-APPLY')
        self.fill('Monto ingresado', '125.50')
        self.fill('Referencia', 'REF-RELEASE-SELENIUM')
        self.fill('Clave idempotente', 'release-selenium-payment-key')
        self.d.find_elements(By.XPATH, "//button[normalize-space()='Aplicar pago']")[-1].click()
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[@role='status' and contains(.,'una sola vez')]")))
        self.click('PAYMENT-VOID')
        self.fill('Motivo', 'Correcci\u00f3n sint\u00e9tica de cobertura Selenium.')
        self.d.find_element(By.XPATH, "//button[normalize-space()='Confirmar reversi\u00f3n']").click()
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[@role='status' and contains(.,'reversado con motivo')]")))

        self.d.get(f'{BASE}/clinical/care-plans')
        self.click('CARE-PLAN-CREATE')
        self.fill('T\u00edtulo', 'Plan sint\u00e9tico Selenium')
        self.fill('Resumen sint\u00e9tico', 'Resumen sint\u00e9tico para verificar la inmutabilidad.')
        self.fill('Autor responsable', 'Profesional de QA')
        self.d.find_element(By.XPATH, "//button[normalize-space()='Guardar borrador']").click()
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="CLINICAL-DOCUMENT-SIGN"]')))
        self.click('CLINICAL-DOCUMENT-SIGN')
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="CLINICAL-DOCUMENT-CORRECT"]')))
        self.click('CLINICAL-DOCUMENT-CORRECT')
        self.fill('Motivo de correcci\u00f3n', 'Ajuste sint\u00e9tico de Selenium.')
        self.fill('Nuevo resumen sint\u00e9tico', 'Resumen corregido para Selenium.')
        self.fill('Autor responsable', 'Profesional de QA')
        self.d.find_element(By.XPATH, "//button[normalize-space()='Crear correcci\u00f3n']").click()
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[contains(.,'versi\u00f3n firmada original se conserva')]")))

        self.d.get(f'{BASE}/clinical/evolutions')
        self.click('EVOLUTION-CREATE')
        self.fill('T\u00edtulo', 'Evoluci\u00f3n sint\u00e9tica Selenium')
        self.fill('Resumen sint\u00e9tico', 'Resumen administrativo sint\u00e9tico para cobertura.')
        self.fill('Autor responsable', 'Profesional de QA')
        self.d.find_element(By.XPATH, "//button[normalize-space()='Guardar borrador']").click()
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[@role='status' and contains(.,'persistido como borrador')]")))

    def test_operational_actions_filter_export_and_persist_only_synthetic_records(self) -> None:
        self.d.get(f'{BASE}/reports/nurse-hours')
        Select(self.action('NURSE-HOURS-FILTER-STATUS')).select_by_value('SCHEDULED')
        self.assertEqual(self.action('NURSE-HOURS-FILTER-STATUS').get_attribute('value'), 'SCHEDULED')
        self.clear_downloads()
        self.click('NURSE-HOURS-EXPORT')
        self.assertTrue(self.downloaded('reporte-horas-programadas.csv').read_text(encoding='utf-8'))

        self.d.get(f'{BASE}/inventory/kardex')
        reference = self.action('KARDEX-FILTER-REFERENCE')
        reference.send_keys('referencia inexistente selenium')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[contains(.,'Sin movimientos')]")))
        self.click('KARDEX-FILTER-RESET')
        self.assertEqual(reference.get_attribute('value'), '')

        self.d.get(f'{BASE}/catalogs')
        self.click('CATALOG-CREATE')
        self.fill('SKU', 'REL-SEL-001')
        self.fill('Nombre', '\u00cdtem sint\u00e9tico release Selenium')
        self.d.find_element(By.XPATH, "//button[normalize-space()='Guardar \u00edtem']").click()
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[@role='status' and contains(.,'persistido')]")))

        self.d.get(f'{BASE}/purchases')
        self.click('PURCHASE-CREATE')
        self.fill('Referencia de compra', 'PURCHASE-REL-SEL-001')
        self.fill('Nota (opcional)', 'Borrador sint\u00e9tico release Selenium.')
        self.d.find_element(By.XPATH, "//button[normalize-space()='Guardar borrador']").click()
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[@role='status' and contains(.,'borrador')]")))

        self.login_as('auditor@demo.local', 'demo-auditor', 'AUDITOR')
        self.d.get(f'{BASE}/audit')
        self.clear_downloads()
        self.click('AUDIT-EXPORT')
        self.assertTrue(self.downloaded('auditoria-sintetica.csv').read_text(encoding='utf-8'))

        self.d.get(f'{BASE}/help')
        search = self.action('HELP-SEARCH')
        search.send_keys('movimiento')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[contains(.,'\u00bfC\u00f3mo hago un movimiento?')]")))
        search.clear()
        search.send_keys('consulta inexistente release Selenium')
        self.w.until(EC.visibility_of_element_located((By.XPATH, "//*[normalize-space()='Sin resultados']")))

    def test_portal_actions_keep_responses_generic_when_no_integration_is_configured(self) -> None:
        self.d.get(f'{BASE}/portal/{"x" * 64}')
        self.click('PORTAL-REQUEST-OTP')
        self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="PORTAL-VERIFY-OTP"]')))
        self.action('PORTAL-VERIFY-OTP').send_keys('00000000')
        self.d.find_element(By.XPATH, "//button[normalize-space()='Verificar c\u00f3digo']").click()
        status = self.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[role="status"]')))
        self.assertIn('No fue posible validar el acceso.', status.text)
        self.assertNotIn('x' * 64, status.text)


if __name__ == '__main__':
    unittest.main(verbosity=2)
