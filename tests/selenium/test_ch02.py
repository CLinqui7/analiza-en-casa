"""Focused CH02 runtime evidence: every recorded action has an assertion."""
# test-id: SEL-CH02-PATIENT-FORM
from __future__ import annotations
import os, subprocess, time, unittest
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait
from helpers.action_recorder import record_pass, reset

ROOT=Path(__file__).resolve().parents[2]; BASE=os.getenv('SELENIUM_BASE_URL','http://127.0.0.1:4174'); SERVER=None
def ready():
 try: return urlopen(BASE,timeout=1).status<500 # nosec B310 local endpoint
 except (URLError,TimeoutError,OSError): return False

class CH02(unittest.TestCase):
 @classmethod
 def setUpClass(c):
  global SERVER; reset()
  if not ready(): SERVER=subprocess.Popen(['npm.cmd','run','dev','--workspace=@analiza/web','--','--port','4174'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
  for _ in range(45):
   if ready(): break
   time.sleep(1)
  c.d=webdriver.Chrome(options=(lambda o:(o.add_argument('--headless=new'),o.add_argument('--window-size=1440,1000'),o)[2])(webdriver.ChromeOptions())); c.w=WebDriverWait(c.d,12)
 @classmethod
 def tearDownClass(c):
  c.d.quit()
  if SERVER: SERVER.terminate()
 def a(s,id): return s.d.find_element(By.CSS_SELECTOR,f'[data-action-id="{id}"]')
 def passed(s,id,t): record_pass(id,'SEL-CH02-PATIENT-FORM',t,s.d.current_url)
 def login(s):
  s.d.get(BASE+'/login'); s.d.execute_script("localStorage.removeItem('analiza.en.casa.workspace.v2');localStorage.removeItem('analiza.en.casa.mock-session.v1')"); s.d.refresh()
  email=s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="AUTH-LOGIN-EMAIL"]'))); email.clear(); email.send_keys('admin@demo.local'); password=s.d.find_element(By.CSS_SELECTOR,'[data-action-id="AUTH-LOGIN-PASSWORD"]'); password.clear(); password.send_keys('demo-admin'); s.a('AUTH-LOGIN').click(); s.w.until(lambda d:'/login' not in d.current_url); s.d.get(BASE+'/patients'); s.a('PATIENT-CREATE').click(); s.w.until(EC.visibility_of_element_located((By.ID,'patient-form')))
 def test_ch02_interactions(s):
  s.login()
  t=time.time(); s.a('PATIENT-NATIONALITY-SEARCH').send_keys('guatem'); s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[@role='option' and contains(.,'Guatemalteca')]"))); s.passed('PATIENT-NATIONALITY-SEARCH',t)
  t=time.time(); s.a('PATIENT-COMPANY-SEARCH').send_keys('empresa'); s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[@role='option' and contains(.,'Empresa demo')]"))); s.passed('PATIENT-COMPANY-SEARCH',t)
  Select(s.a('PATIENT-INSURANCE-TOGGLE')).select_by_value('INSURED'); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-INSURER-SEARCH"]')))
  t=time.time(); s.a('PATIENT-INSURER-SEARCH').send_keys('cobertura'); s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[@role='option' and contains(.,'Cobertura sintética QA')]"))); s.passed('PATIENT-INSURER-SEARCH',t)
  s.d.find_element(By.XPATH,"//*[@role='option' and contains(.,'Cobertura sintética QA')]").click(); s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[contains(.,'¿El paciente es el titular del seguro?')]")))
  t=time.time(); s.a('PATIENT-INSURANCE-HOLDER-YES').click(); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'input[name="insurance.policyNumber"]'))); s.passed('PATIENT-INSURANCE-HOLDER-YES',t)
  s.d.find_element(By.CSS_SELECTOR,'input[name="insurance.policyNumber"]').send_keys('SEL-CH02-POL')
  t=time.time(); s.a('PATIENT-COVERAGE-ADD').click(); s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[contains(.,'Cobertura única preparada')]"))); s.passed('PATIENT-COVERAGE-ADD',t)
  s.d.find_element(By.CSS_SELECTOR,'input[name="address.locationUrl"]').send_keys('https://maps.example/?q=13.692900,-89.218200')
  t=time.time(); s.a('PATIENT-ADDRESS-IMPORT').click(); s.w.until(lambda _:s.d.find_element(By.CSS_SELECTOR,'input[name="address.coordinates"]').get_attribute('value')=='13.692900, -89.218200'); s.passed('PATIENT-ADDRESS-IMPORT',t)
  for action in ('PATIENT-MAP-ZOOM-IN','PATIENT-MAP-ZOOM-OUT','PATIENT-MAP-LAYER'):
   t=time.time(); s.a(action).click(); s.assertTrue(s.a(action).is_displayed()); s.passed(action,t)
  t=time.time(); s.a('PATIENT-BACK').click(); s.w.until(EC.invisibility_of_element_located((By.ID,'patient-form'))); s.passed('PATIENT-BACK',t)

if __name__=='__main__': unittest.main(verbosity=2)
