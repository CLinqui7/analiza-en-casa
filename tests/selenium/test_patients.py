"""Isolated Selenium patient groups; action evidence follows assertions, never clicks."""
# test-id: SEL-PAT-NAVIGATION
# test-id: SEL-PAT-DOCUMENT
# test-id: SEL-PAT-INSURANCE
# test-id: SEL-PAT-CONTACTS
# test-id: SEL-PAT-ADDRESS
# test-id: SEL-PAT-CREATE
# test-id: SEL-PAT-EDIT
# test-id: SEL-PAT-SEARCH
# test-id: SEL-PAT-PAGINATION
# test-id: SEL-PAT-STATUS
# test-id: SEL-PAT-IMPORT
# test-id: SEL-PAT-EXPORT
from __future__ import annotations
import os, subprocess, time, unittest
from pathlib import Path
from urllib.request import urlopen
from urllib.error import URLError
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support.select import Select
from helpers.action_recorder import record_pass, reset

ROOT=Path(__file__).resolve().parents[2]; BASE=os.getenv('SELENIUM_BASE_URL','http://127.0.0.1:4174'); SERVER=None
def ready():
 try: return urlopen(BASE,timeout=1).status<500 # nosec B310 local server
 except (URLError,TimeoutError,OSError): return False

class Patients(unittest.TestCase):
 @classmethod
 def setUpClass(c):
  global SERVER
  reset()
  if not ready(): SERVER=subprocess.Popen(['npm.cmd','run','dev','--workspace=@analiza/web','--','--port','4174'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
  for _ in range(60):
   if ready(): break
   time.sleep(1)
  c.d=webdriver.Chrome(options=(lambda o:(o.add_argument('--headless=new'),o.add_argument('--window-size=1440,1000'),o)[2])(webdriver.ChromeOptions())); c.w=WebDriverWait(c.d,12)
 @classmethod
 def tearDownClass(c):
  c.d.quit()
  if SERVER: SERVER.terminate()
 def reset_mock_state(s):
  s.d.get(BASE+'/login'); s.w.until(lambda d:d.execute_script('return document.readyState')=='complete'); s.assertTrue(s.d.current_url.startswith(BASE)); s.d.execute_script('localStorage.removeItem("analiza.en.casa.workspace.v2"); localStorage.removeItem("analiza.en.casa.mock-session.v1");'); s.d.get(BASE+'/login'); s.w.until(lambda d:d.execute_script('return document.readyState')=='complete'); s.w.until(EC.visibility_of_element_located((By.XPATH,"//label[contains(.,'Correo')]//input"))); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'input[type=password]'))); s.w.until(EC.element_to_be_clickable((By.CSS_SELECTOR,'[data-action-id=AUTH-LOGIN]'))); s.assertIn('/login',s.d.current_url)
 def login_as(s,email,password,expected_role):
  email_box=s.w.until(EC.visibility_of_element_located((By.XPATH,"//label[contains(.,'Correo')]//input"))); email_box.clear(); email_box.send_keys(email); password_box=s.d.find_element(By.CSS_SELECTOR,'input[type=password]'); password_box.clear(); password_box.send_keys(password); s.a('AUTH-LOGIN').click(); s.w.until(EC.url_contains('/dashboard')); s.w.until(EC.presence_of_element_located((By.TAG_NAME,'aside'))); s.w.until(lambda d:'Validando sesión' not in d.find_element(By.TAG_NAME,'body').text); s.assertFalse(s.d.find_elements(By.CSS_SELECTOR,'[role="alert"]')); session=s.d.execute_script('return localStorage.getItem("analiza.en.casa.mock-session.v1")'); s.assertIsNotNone(session); s.assertIn(f'"role":"{expected_role}"',session)
 def prepare_authenticated_test(s,email='admin@demo.local',password='demo-admin',expected_role='ADMIN'):
  s.reset_mock_state(); s.login_as(email,password,expected_role)
 def setUp(s): s.prepare_authenticated_test()
 def test_fixture_stability(s):
  for _ in range(3):
   s.prepare_authenticated_test(); s.d.get(BASE+'/patients'); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'tbody tr'))); s.prepare_authenticated_test('inventory@demo.local','demo-inventory','INVENTORY'); s.d.get(BASE+'/patients'); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'main[role="alert"]')))
 def a(s,x): return s.d.find_element(By.CSS_SELECTOR,f'[data-action-id="{x}"]')
 def click(s,x): s.w.until(EC.element_to_be_clickable((By.CSS_SELECTOR,f'[data-action-id="{x}"]'))).click()
 def field(s,label): return s.d.find_element(By.XPATH,f"//label[contains(.,'{label}')]//*[self::input or self::select or self::textarea]")
 def fill(s,label,value):
  f=s.field(label); f.clear(); f.send_keys(value)
 def pass_(s,x,test,t): record_pass(x,test,t,s.d.current_url)
 def open_create(s):
  s.d.get(BASE+'/patients'); s.click('PATIENT-CREATE'); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-CREATE-SUBMIT"]')))
 def fill_required(s,name,document,phone):
  Select(s.a('PATIENT-DOCUMENT-TYPE')).select_by_value('OTHER'); s.fill('Número de documento',document); s.fill('Nombre completo',name); s.fill('Fecha de nacimiento','04/20/1985'); s.field('Femenino').click(); s.fill('Teléfono celular',phone); s.fill('Empresa','Empresa Selenium'); s.fill('Dirección','Calle Selenium 123'); s.fill('Comentario o referencia','Referencia Selenium')
 def test_create_and_validation(s):
  t=time.time(); s.open_create(); s.assertIn('/patients',s.d.current_url); s.assertNotIn('edit=',s.d.current_url); s.assertTrue(s.field('Nombre completo').is_displayed()); s.assertTrue(s.a('PATIENT-CREATE-SUBMIT').is_displayed()); s.fill_required('Paciente Creado Selenium','CREATE-SEL-001','70003333'); s.click('PATIENT-CREATE-SUBMIT'); s.w.until(EC.invisibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-CREATE-SUBMIT"]'))); s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[contains(text(),'Registro sintético agregado')]"))); search=s.a('PATIENT-SEARCH'); search.send_keys('CREATE-SEL-001'); s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[contains(text(),'Paciente Creado Selenium')]"))); s.d.refresh(); s.a('PATIENT-SEARCH').send_keys('CREATE-SEL-001'); s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[contains(text(),'Paciente Creado Selenium')]"))); s.pass_('PATIENT-CREATE','SEL-PAT-CREATE',t); s.pass_('PATIENT-CREATE-SUBMIT','SEL-PAT-CREATE',t)
 def test_contacts(s):
  s.open_create(); t=time.time(); s.click('PATIENT-CONTACT-ADD'); buttons=s.d.find_elements(By.CSS_SELECTOR,'[data-action-id="PATIENT-CONTACT-PRIMARY"]'); s.assertEqual(len(buttons),1); one=buttons[0].find_element(By.XPATH,'ancestor::fieldset[1]'); inputs=one.find_elements(By.CSS_SELECTOR,'input'); s.assertTrue(inputs[0].is_enabled()); inputs[0].send_keys('Contacto Uno'); inputs[1].send_keys('70001111'); s.assertEqual(inputs[0].get_attribute('value'),'Contacto Uno'); s.pass_('PATIENT-CONTACT-ADD','SEL-PAT-CONTACTS',t); s.click('PATIENT-CONTACT-ADD'); buttons=s.d.find_elements(By.CSS_SELECTOR,'[data-action-id="PATIENT-CONTACT-PRIMARY"]'); two=buttons[1].find_element(By.XPATH,'ancestor::fieldset[1]'); inputs=two.find_elements(By.CSS_SELECTOR,'input'); inputs[0].send_keys('Contacto Dos'); inputs[1].send_keys('70002222'); t=time.time(); buttons[0].click(); buttons=s.d.find_elements(By.CSS_SELECTOR,'[data-action-id="PATIENT-CONTACT-PRIMARY"]'); one=buttons[0].find_element(By.XPATH,'ancestor::fieldset[1]'); two=buttons[1].find_element(By.XPATH,'ancestor::fieldset[1]'); s.assertIn('Contacto principal',one.text); s.assertIn('Contacto secundario',two.text); s.pass_('PATIENT-CONTACT-PRIMARY','SEL-PAT-CONTACTS',t); t=time.time(); s.d.find_elements(By.CSS_SELECTOR,'[data-action-id="PATIENT-CONTACT-REMOVE"]')[1].click(); s.w.until(lambda _:len(s.d.find_elements(By.CSS_SELECTOR,'[data-action-id="PATIENT-CONTACT-PRIMARY"]'))==1); remaining=s.d.find_elements(By.CSS_SELECTOR,'[data-action-id="PATIENT-CONTACT-PRIMARY"]')[0].find_element(By.XPATH,'ancestor::fieldset[1]').find_elements(By.CSS_SELECTOR,'input'); s.assertEqual(remaining[0].get_attribute('value'),'Contacto Uno'); s.assertNotIn('Contacto Dos',[item.get_attribute('value') for item in remaining]); s.pass_('PATIENT-CONTACT-REMOVE','SEL-PAT-CONTACTS',t)
 def test_address(s):
  s.open_create(); s.fill('Nombre completo','Paciente Dirección Selenium'); s.fill('Teléfono celular','70005555'); s.fill('Dirección','Calle Selenium 123'); s.fill('Comentario o referencia','Referencia Selenium'); s.fill('Coordenadas','13.7000,-89.2000'); s.fill('Enlace de ubicación','https://example.test/ubicacion'); t=time.time(); s.click('PATIENT-ADDRESS-CLEAR');
  for label in ('Dirección','Comentario o referencia','Coordenadas','Enlace de ubicación'): s.assertEqual(s.field(label).get_attribute('value'),'')
  s.assertEqual(s.field('Nombre completo').get_attribute('value'),'Paciente Dirección Selenium'); s.assertEqual(s.field('Teléfono celular').get_attribute('value'),'70005555'); s.pass_('PATIENT-ADDRESS-CLEAR','SEL-PAT-ADDRESS',t); s.fill('Enlace de ubicación','https://example.test/selenium-map'); t=time.time(); before=s.d.current_url; s.click('PATIENT-ADDRESS-LOOKUP'); s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[contains(text(),'integración de mapas configurada')]"))); s.assertEqual(s.field('Enlace de ubicación').get_attribute('value'),'https://example.test/selenium-map'); s.assertEqual(s.d.current_url,before); s.pass_('PATIENT-ADDRESS-LOOKUP','SEL-PAT-ADDRESS',t)
 @unittest.skip('Certified in Lot A; retained as an independent group placeholder.')
 def test_navigation_and_roles(s): pass
 @unittest.skip('Certified in Lot A.')
 def test_document_type(s): pass
 @unittest.skip('Certified in Lot A.')
 def test_insurance(s): pass
 @unittest.skip('Certified in Lot A.')
 def test_edit(s): pass
 @unittest.skip('Future list group.')
 def test_search(s): pass
 @unittest.skip('Future list group.')
 def test_tabs_sort_pagination(s): pass
 @unittest.skip('Future status group.')
 def test_status_transitions(s): pass
 @unittest.skip('Known pending: PATIENT-IMPORT-*')
 def test_import(s): pass
 @unittest.skip('Future export group.')
 def test_export(s): pass
 @unittest.skip('Future mobile group.')
 def test_mobile(s): pass
