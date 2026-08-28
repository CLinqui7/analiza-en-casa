"""Authenticated Selenium patient regression with machine-readable action evidence."""
# test-id: SEL-PAT-FULL
# test-id: SEL-PAT-FLOW
from __future__ import annotations
import os, subprocess, time, unittest
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.select import Select
from selenium.webdriver.support.ui import WebDriverWait
from helpers.action_recorder import record_pass, reset

ROOT=Path(__file__).resolve().parents[2]; BASE=os.getenv('SELENIUM_BASE_URL','http://127.0.0.1:4174'); SERVER=None
def ready():
    try: return urlopen(BASE,timeout=1).status<500 # nosec B310 local only
    except (URLError, TimeoutError, OSError): return False

class Patients(unittest.TestCase):
 @classmethod
 def setUpClass(c):
    global SERVER
    reset()
    if not ready(): SERVER=subprocess.Popen(['npm.cmd','run','dev','--workspace=@analiza/web','--','--port','4174'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0));
    for _ in range(60):
      if ready(): break
      time.sleep(1)
    opts=webdriver.ChromeOptions(); opts.add_argument('--headless=new'); opts.add_argument('--window-size=1440,1000'); c.d=webdriver.Chrome(options=opts); c.w=WebDriverWait(c.d,12)
 @classmethod
 def tearDownClass(c):
    c.d.quit()
    if SERVER: SERVER.terminate()
 def setUp(s):
    s.d.get(BASE+'/login'); s.d.execute_script('localStorage.clear()'); s.d.refresh(); email=s.w.until(EC.visibility_of_element_located((By.XPATH,"//label[contains(.,'Correo')]//input"))); email.clear(); email.send_keys('admin@demo.local'); password=s.d.find_element(By.CSS_SELECTOR,'input[type="password"]'); password.clear(); password.send_keys('demo-admin'); s.d.find_element(By.CSS_SELECTOR,'[data-action-id="AUTH-LOGIN"]').click(); s.w.until(EC.url_contains('/dashboard'))
 def click(s,x):
    started=time.time(); s.w.until(EC.element_to_be_clickable((By.CSS_SELECTOR,f'[data-action-id="{x}"]'))).click(); record_pass(x,'SEL-PAT-FLOW',started,s.d.current_url)
 def field(s,label): return s.d.find_element(By.XPATH,f"//label[contains(.,'{label}')]//*[self::input or self::select or self::textarea]")
 def test_patient_actions(s):
    d=s.d; d.get(BASE+'/patients'); s.w.until(EC.visibility_of_element_located((By.TAG_NAME,'h1')))
    for x in ['PATIENT-TAB-ACTIVE','PATIENT-TAB-INACTIVE','PATIENT-TAB-ACTIVE']: s.click(x)
    q=d.find_element(By.CSS_SELECTOR,'[data-action-id="PATIENT-SEARCH"]'); q.send_keys('Aurora'); s.w.until(EC.visibility_of_element_located((By.LINK_TEXT,'Paciente Demo Aurora'))); s.click('PATIENT-SEARCH-CLEAR')
    for x in ['PATIENT-SORT-NAME','PATIENT-SORT-NAME','PATIENT-SORT-DOCUMENT','PATIENT-SORT-DOCUMENT']: s.click(x)
    Select(d.find_element(By.CSS_SELECTOR,'[data-action-id="PATIENT-PAGE-SIZE"]')).select_by_value('5'); s.click('PATIENT-PAGE-NEXT'); s.click('PATIENT-PAGE-PREVIOUS'); s.click('PATIENT-PAGINATE')
    s.click('PATIENT-CREATE'); Select(d.find_element(By.CSS_SELECTOR,'[data-action-id="PATIENT-DOCUMENT-TYPE"]')).select_by_value('OTHER')
    for label,value in [('Número de documento','SEL-001'),('Nombre completo','Paciente Selenium'),('Fecha de nacimiento','04/20/1985'),('Teléfono celular','70009001'),('Empresa','Empresa Selenium'),('Dirección','Dirección Selenium'),('Comentario o referencia','Referencia Selenium')]: s.field(label).send_keys(value)
    s.field('Femenino').click(); Select(d.find_element(By.CSS_SELECTOR,'[data-action-id="PATIENT-INSURANCE-TOGGLE"]')).select_by_value('REGULAR'); s.click('PATIENT-CONTACT-ADD'); s.click('PATIENT-CONTACT-REMOVE'); s.click('PATIENT-ADDRESS-LOOKUP'); s.click('PATIENT-CREATE-SUBMIT')
    s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[contains(text(),'Paciente Selenium')]"))); d.find_element(By.CSS_SELECTOR,'[data-action-id="PATIENT-SEARCH"]').send_keys('Paciente Selenium'); s.click('PATIENT-DETAIL-NAVIGATE'); s.click('PATIENT-EDIT'); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-EDIT-SUBMIT"]'))); s.click('PATIENT-EDIT-CANCEL')
    d.get(BASE+'/patients'); s.click('PATIENT-IMPORT'); s.click('PATIENT-IMPORT-CANCEL'); s.click('PATIENT-EXPORT')

if __name__=='__main__':
 r=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Patients)); raise SystemExit(not r.wasSuccessful())
