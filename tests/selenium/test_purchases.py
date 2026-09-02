"""CH13 factual purchase-list Selenium source coverage."""
# test-id: SEL-CH13-PURCHASE-LIST
from __future__ import annotations
import os, subprocess, time, unittest
from urllib.error import URLError
from urllib.request import urlopen
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as conditions
from selenium.webdriver.support.ui import WebDriverWait
from helpers.action_recorder import record_pass, reset
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); BASE=os.getenv('SELENIUM_BASE_URL','http://127.0.0.1:4174'); SERVER=None
def ready():
    try: return urlopen(BASE,timeout=1).status<500
    except (URLError,TimeoutError,OSError): return False
class Purchases(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  global SERVER; reset()
  if not ready(): SERVER=subprocess.Popen(['npm.cmd','run','dev','--workspace=@analiza/web','--','--port','4174'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
  for _ in range(60):
   if ready(): break
   time.sleep(1)
  else: raise RuntimeError('El servidor React local no inició en 60 segundos.')
  options=webdriver.ChromeOptions(); options.add_argument('--headless=new'); cls.driver=webdriver.Chrome(options=options); cls.wait=WebDriverWait(cls.driver,12)
 @classmethod
 def tearDownClass(cls):
  cls.driver.quit()
  if SERVER: SERVER.terminate()
 def login(self,email,password):
  self.driver.get(f'{BASE}/login?next=%2Fpurchases'); self.driver.execute_script('localStorage.clear()'); self.driver.refresh()
  self.wait.until(conditions.visibility_of_element_located((By.XPATH,"//label[contains(., 'Usuario')]//input"))).send_keys(email); self.driver.find_element(By.CSS_SELECTOR,'input[type=password]').send_keys(password); self.driver.find_element(By.CSS_SELECTOR,'[data-action-id="AUTH-LOGIN"]').click(); self.wait.until(conditions.url_contains('/purchases'))
 def test_admin_search_and_disabled_excel_do_not_mutate(self):
  started=time.time(); self.login('admin@demo.local','demo-admin'); before=self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')")
  self.driver.find_element(By.CSS_SELECTOR,'[data-action-id="PURCHASE-LIST-SEARCH"]').send_keys('sin-compra-ch13'); empty=self.driver.find_element(By.CSS_SELECTOR,'tbody .empty-state'); self.assertIn('Sin compras documentadas',empty.text); self.assertIn('sin-compra-ch13',empty.text); record_pass('PURCHASE-LIST-SEARCH','SEL-CH13-PURCHASE-LIST',started,self.driver.current_url)
  self.assertFalse(self.driver.find_element(By.CSS_SELECTOR,'[data-action-id="PURCHASE-LIST-EXPORT"]').is_enabled()); record_pass('PURCHASE-LIST-EXPORT','SEL-CH13-PURCHASE-LIST',started,self.driver.current_url)
  self.driver.refresh(); self.assertEqual(before,self.driver.execute_script("return localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')"))
 def test_auditor_can_read_purchases(self):
  self.login('auditor@demo.local','demo-auditor'); self.assertIn('Listado',self.driver.find_element(By.TAG_NAME,'main').text)
 def test_nurse_is_denied_purchases_direct_route(self):
  self.login('nurse@demo.local','demo-nurse'); self.assertIn('Acceso restringido para el rol NURSE',self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR,'main[role="alert"]'))).text)
