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
 def test_navigation_and_roles(s):
  t=time.time(); s.d.get(BASE+'/patients'); s.w.until(EC.visibility_of_element_located((By.TAG_NAME,'h1'))); s.d.refresh(); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'tbody tr'))); s.pass_('PATIENT-NAVIGATE','SEL-PAT-NAVIGATION',t)
 def test_document_type(s):
  s.open_create(); t=time.time(); Select(s.a('PATIENT-DOCUMENT-TYPE')).select_by_value('PASSPORT'); s.fill('Número de documento','PAS-SEL-001'); s.fill('Nombre completo','Paciente Documento Selenium'); s.fill('Teléfono celular','70007777'); Select(s.a('PATIENT-DOCUMENT-TYPE')).select_by_value('DUI'); s.assertEqual(s.field('Número de documento').get_attribute('value'),''); s.assertEqual(s.field('Nombre completo').get_attribute('value'),'Paciente Documento Selenium'); s.pass_('PATIENT-DOCUMENT-TYPE','SEL-PAT-DOCUMENT',t)
 def test_insurance(s):
  s.open_create(); t=time.time(); Select(s.a('PATIENT-INSURANCE-TOGGLE')).select_by_value('INSURED'); s.w.until(EC.visibility_of_element_located((By.XPATH,"//label[contains(.,'Aseguradora')]"))); s.pass_('PATIENT-INSURANCE-TOGGLE','SEL-PAT-INSURANCE',t)
 def test_edit(s):
  s.d.get(BASE+'/patients'); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'tbody tr'))); t=time.time(); s.click('PATIENT-DETAIL-NAVIGATE'); s.w.until(EC.url_contains('/patients/')); s.pass_('PATIENT-DETAIL-NAVIGATE','SEL-PAT-EDIT',t); original=s.d.find_element(By.TAG_NAME,'h1').text; t=time.time(); s.click('PATIENT-EDIT'); s.w.until(EC.url_contains('edit=')); s.w.until(lambda _:s.field('Nombre completo').get_attribute('value')==original); s.pass_('PATIENT-EDIT','SEL-PAT-EDIT',t); s.fill('Nombre completo','Temporal Selenium'); t=time.time(); s.click('PATIENT-EDIT-CANCEL'); s.w.until(EC.invisibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-EDIT-SUBMIT"]'))); s.d.get(BASE+'/patients'); s.click('PATIENT-DETAIL-NAVIGATE'); s.assertIn(original,s.d.find_element(By.TAG_NAME,'body').text); s.assertNotIn('Temporal Selenium',s.d.find_element(By.TAG_NAME,'body').text); s.d.refresh(); s.assertIn(original,s.d.find_element(By.TAG_NAME,'body').text); s.pass_('PATIENT-EDIT-CANCEL','SEL-PAT-EDIT',t)
 def test_search(s):
  s.d.get(BASE+'/patients'); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'tbody tr'))); box=s.a('PATIENT-SEARCH'); t=time.time()
  for value,expected in (('Aur','Paciente Demo Aurora'),('Paciente Demo Aurora','Paciente Demo Aurora'),('12345678-9','Paciente Demo Aurora'),('0000-0000','Paciente Demo Aurora')):
   box.clear(); box.send_keys(value); s.w.until(EC.visibility_of_element_located((By.XPATH,f"//*[contains(text(),'{expected}')]"))); s.assertEqual(len(s.d.find_elements(By.CSS_SELECTOR,'tbody tr')),1)
  box.clear(); box.send_keys('sin coincidencia selenium'); s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[contains(text(),'Sin resultados')]"))); s.pass_('PATIENT-SEARCH','SEL-PAT-SEARCH',t); t=time.time(); s.click('PATIENT-SEARCH-CLEAR'); s.assertEqual(box.get_attribute('value'),''); s.assertGreater(len(s.d.find_elements(By.CSS_SELECTOR,'tbody tr')),0); s.pass_('PATIENT-SEARCH-CLEAR','SEL-PAT-SEARCH',t)
 def test_tabs_sort_pagination(s):
  s.d.get(BASE+'/patients'); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'tbody tr'))); t=time.time(); s.click('PATIENT-TAB-INACTIVE'); s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[contains(text(),'Paciente Demo Brisa')]"))); s.assertFalse(s.d.find_elements(By.XPATH,"//*[contains(text(),'Paciente Demo Aurora') and self::a]")); s.pass_('PATIENT-TAB-INACTIVE','SEL-PAT-PAGINATION',t); t=time.time(); s.click('PATIENT-TAB-ACTIVE'); s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[contains(text(),'Paciente Demo Aurora')]"))); s.assertFalse(s.d.find_elements(By.XPATH,"//*[contains(text(),'Paciente Demo Brisa') and self::a]")); s.pass_('PATIENT-TAB-ACTIVE','SEL-PAT-PAGINATION',t)
  def names(): return [x.text for x in s.d.find_elements(By.CSS_SELECTOR,'tbody tr td:first-child a')]
  t=time.time(); s.click('PATIENT-SORT-NAME'); after=names(); s.assertEqual(after,sorted(after,reverse=True)); s.click('PATIENT-SORT-NAME'); s.assertEqual(names(),sorted(names())); s.pass_('PATIENT-SORT-NAME','SEL-PAT-PAGINATION',t)
  def docs(): return [x.text.split(': ',1)[-1] for x in s.d.find_elements(By.CSS_SELECTOR,'tbody tr td:nth-child(2)')]
  t=time.time(); s.click('PATIENT-SORT-DOCUMENT'); after=docs(); s.assertEqual(after,sorted(after)); s.click('PATIENT-SORT-DOCUMENT'); s.assertEqual(docs(),sorted(docs(),reverse=True)); s.pass_('PATIENT-SORT-DOCUMENT','SEL-PAT-PAGINATION',t)
  from selenium.webdriver.support.select import Select
  t=time.time(); Select(s.a('PATIENT-PAGE-SIZE')).select_by_value('5'); page1=names(); pages=s.d.find_elements(By.CSS_SELECTOR,'[data-action-id="PATIENT-PAGINATE"]'); s.assertLessEqual(len(page1),5); s.assertGreater(len(pages),1); next_t=time.time(); s.click('PATIENT-PAGE-NEXT'); s.w.until(lambda _:names()!=page1); s.pass_('PATIENT-PAGE-NEXT','SEL-PAT-PAGINATION',next_t); paginate_t=time.time(); pages=s.d.find_elements(By.CSS_SELECTOR,'[data-action-id="PATIENT-PAGINATE"]'); pages[-1].click(); s.assertEqual(pages[-1].get_attribute('aria-current'),'page'); s.pass_('PATIENT-PAGINATE','SEL-PAT-PAGINATION',paginate_t); previous_t=time.time(); s.click('PATIENT-PAGE-PREVIOUS'); s.assertEqual(names(),page1); s.pass_('PATIENT-PAGE-PREVIOUS','SEL-PAT-PAGINATION',previous_t); Select(s.a('PATIENT-PAGE-SIZE')).select_by_value('10'); s.assertEqual(s.d.find_element(By.CSS_SELECTOR,'[data-action-id="PATIENT-PAGINATE"][aria-current="page"]').text,'1'); s.pass_('PATIENT-PAGE-SIZE','SEL-PAT-PAGINATION',t)
 def test_status_transitions(s):
  s.d.get(BASE+'/patients'); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'tbody tr'))); name=s.d.find_element(By.CSS_SELECTOR,'tbody tr td:first-child a').text; t=time.time(); s.click('PATIENT-INACTIVATE'); s.assertNotIn(name,s.d.find_element(By.TAG_NAME,'body').text); s.click('PATIENT-TAB-INACTIVE'); s.w.until(EC.visibility_of_element_located((By.XPATH,f"//*[contains(text(),'{name}')]"))); s.d.refresh(); s.click('PATIENT-TAB-INACTIVE'); s.assertIn(name,s.d.find_element(By.TAG_NAME,'body').text); s.pass_('PATIENT-INACTIVATE','SEL-PAT-STATUS',t); t=time.time(); s.click('PATIENT-REACTIVATE'); s.assertNotIn(name,s.d.find_element(By.TAG_NAME,'body').text); s.click('PATIENT-TAB-ACTIVE'); s.w.until(EC.visibility_of_element_located((By.XPATH,f"//*[contains(text(),'{name}')]"))); s.d.refresh(); s.assertIn(name,s.d.find_element(By.TAG_NAME,'body').text); s.pass_('PATIENT-REACTIVATE','SEL-PAT-STATUS',t)
 @unittest.skip('Known pending: PATIENT-IMPORT-*')
 def test_import(s): pass
 @unittest.skip('Future export group.')
 def test_export(s): pass
 @unittest.skip('Future mobile group.')
 def test_mobile(s): pass
