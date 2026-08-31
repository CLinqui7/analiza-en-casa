"""Focused, observable Selenium evidence for the CH01 certification surface."""
# test-id: SEL-CH01-RECOVERY
# test-id: SEL-CH01-INSTALL
# test-id: SEL-CH01-USER-MENU
# test-id: SEL-CH01-IMPORT
# test-id: SEL-CH01-XLSX
# test-id: SEL-CH01-BOTMAKER
from __future__ import annotations

import os, subprocess, tempfile, time, unittest
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from helpers.action_recorder import record_pass, reset

ROOT = Path(__file__).resolve().parents[2]
BASE = os.getenv('SELENIUM_BASE_URL', 'http://127.0.0.1:4174')
SERVER = None

def ready():
    try: return urlopen(BASE, timeout=1).status < 500  # nosec B310 local endpoint
    except (URLError, TimeoutError, OSError): return False

class CH01(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        global SERVER
        reset()
        if not ready(): SERVER = subprocess.Popen(['npm.cmd', 'run', 'dev', '--workspace=@analiza/web', '--', '--port', '4174'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        for _ in range(60):
            if ready(): break
            time.sleep(1)
        cls.downloads = tempfile.TemporaryDirectory(prefix='analiza-ch01-downloads-')
        options = webdriver.ChromeOptions(); options.add_argument('--headless=new'); options.add_argument('--window-size=1440,1000')
        options.add_experimental_option('prefs', {'download.default_directory': cls.downloads.name, 'download.prompt_for_download': False})
        cls.driver = webdriver.Chrome(options=options); cls.wait = WebDriverWait(cls.driver, 12)
    @classmethod
    def tearDownClass(cls):
        cls.driver.quit(); cls.downloads.cleanup()
        if SERVER: SERVER.terminate()
    def setUp(self):
        self.driver.get(BASE + '/login')
        self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN"]')))
        self.driver.execute_script("localStorage.removeItem('analiza.en.casa.mock-session.v1'); localStorage.removeItem('analiza.en.casa.workspace.v2');")
        self.driver.refresh(); self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN"]')))
    def action(self, action_id): return self.driver.find_element(By.CSS_SELECTOR, f'[data-action-id="{action_id}"]')
    def pass_(self, action_id, test_id, began): record_pass(action_id, test_id, began, self.driver.current_url)
    def login(self):
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN-EMAIL"]').clear(); self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN-EMAIL"]').send_keys('admin@demo.local')
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN-PASSWORD"]').clear(); self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN-PASSWORD"]').send_keys('demo-admin')
        self.action('AUTH-LOGIN').click(); self.wait.until(EC.url_contains('/dashboard'))
    def test_recovery_and_install_are_honest(self):
        began = time.time(); self.action('AUTH-RECOVER-OPEN').click(); self.wait.until(EC.visibility_of_element_located((By.XPATH, "//*[contains(text(),'no se envió ningún mensaje')]"))); self.pass_('AUTH-RECOVER-OPEN', 'SEL-CH01-RECOVERY', began)
        began = time.time(); self.action('AUTH-RECOVER-CANCEL').click(); self.wait.until(EC.invisibility_of_element_located((By.XPATH, "//*[contains(text(),'no se envió ningún mensaje')]"))); self.pass_('AUTH-RECOVER-CANCEL', 'SEL-CH01-RECOVERY', began)
        began = time.time(); self.action('AUTH-INSTALL').click(); self.wait.until(EC.visibility_of_element_located((By.XPATH, "//*[contains(text(),'instalación no está disponible')]"))); self.pass_('AUTH-INSTALL', 'SEL-CH01-INSTALL', began)
    def test_user_menu_and_profile(self):
        self.login(); began = time.time(); self.action('USER-MENU-OPEN').click(); self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[role="menu"]'))); self.pass_('USER-MENU-OPEN', 'SEL-CH01-USER-MENU', began)
        began = time.time(); self.action('USER-PROFILE-OPEN').click(); self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[role="dialog"]'))); self.assertIn('ADMIN', self.driver.find_element(By.CSS_SELECTOR, '[role="dialog"]').text); self.pass_('USER-PROFILE-OPEN', 'SEL-CH01-USER-MENU', began)
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="USER-PROFILE-CLOSE"]').click(); self.action('USER-MENU-OPEN').click(); began = time.time(); self.action('USER-MENU-CLOSE').click(); self.wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, '[role="menu"]'))); self.pass_('USER-MENU-CLOSE', 'SEL-CH01-USER-MENU', began)
    def test_import_and_xlsx(self):
        self.login(); self.driver.get(BASE + '/patients'); self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, 'tbody tr')))
        began = time.time(); self.action('PATIENT-TAB-IMPORT').click(); self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="PATIENT-IMPORT-FILE"]'))); self.pass_('PATIENT-TAB-IMPORT', 'SEL-CH01-IMPORT', began)
        self.action('PATIENT-IMPORT-CANCEL').click(); self.wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="PATIENT-IMPORT-FILE"]')))
        began = time.time(); self.action('PATIENT-EXPORT-XLSX').click()
        target = Path(self.downloads.name) / 'pacientes-activos.xlsx'
        self.wait.until(lambda _: target.exists() and target.read_bytes()[:2] == b'PK')
        self.assertGreater(target.stat().st_size, 100); self.pass_('PATIENT-EXPORT-XLSX', 'SEL-CH01-XLSX', began)
    def test_botmaker_consent_persists(self):
        self.login(); self.driver.get(BASE + '/patients'); self.action('PATIENT-CREATE').click(); self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="PATIENT-CREATE-SUBMIT"]')))
        fields = {'Número de documento': 'SEL-CH01-CONSENT', 'Nombre completo': 'Paciente Selenium Consentimiento', 'Fecha de nacimiento': '04/20/1985', 'Teléfono celular': '70001234', 'Empresa': 'Empresa Selenium', 'Dirección': 'Calle Selenium', 'Comentario o referencia': 'Referencia Selenium'}
        for label, value in fields.items():
            element = self.driver.find_element(By.XPATH, f"//label[contains(.,'{label}')]//*[self::input or self::textarea]"); element.clear(); element.send_keys(value)
        self.driver.find_element(By.XPATH, "//label[contains(.,'Femenino')]//input").click()
        began = time.time(); self.action('PATIENT-BOTMAKER-CONSENT').click(); self.action('PATIENT-CREATE-SUBMIT').click(); self.wait.until(EC.visibility_of_element_located((By.XPATH, "//*[contains(text(),'Registro sintético agregado')]")))
        self.driver.refresh(); self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, 'tbody tr'))); self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="PATIENT-SEARCH"]').send_keys('SEL-CH01-CONSENT'); self.wait.until(EC.visibility_of_element_located((By.XPATH, "//*[contains(text(),'No')]"))); self.pass_('PATIENT-BOTMAKER-CONSENT', 'SEL-CH01-BOTMAKER', began)

if __name__ == '__main__': unittest.main(verbosity=2)
