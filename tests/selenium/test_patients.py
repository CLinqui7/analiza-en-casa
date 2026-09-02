"""Isolated Selenium patient groups; action evidence follows assertions, never clicks."""
# test-id: SEL-PAT-NAVIGATION
# test-id: SEL-PAT-DOCUMENT
# test-id: SEL-PAT-CONTACT-DOCUMENT
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
# test-id: SEL-PAT-PERMISSION-INTEGRITY
from __future__ import annotations
import os, subprocess, tempfile, time, unittest
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
  c.temp_dir=tempfile.TemporaryDirectory(prefix='analiza-patients-selenium-')
  c.fixture_dir=Path(c.temp_dir.name)/'fixtures'; c.fixture_dir.mkdir()
  c.download_dir=Path(c.temp_dir.name)/'downloads'; c.download_dir.mkdir()
  options=webdriver.ChromeOptions(); options.add_argument('--headless=new'); options.add_argument('--window-size=1440,1000')
  options.add_experimental_option('prefs',{'download.default_directory':str(c.download_dir),'download.prompt_for_download':False,'download.directory_upgrade':True})
  c.d=webdriver.Chrome(options=options); c.w=WebDriverWait(c.d,12)
 @classmethod
 def tearDownClass(c):
  c.d.quit()
  if SERVER: SERVER.terminate()
  c.temp_dir.cleanup()
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
 def test_permission_integrity_roles(s):
  s.prepare_authenticated_test('nurse@demo.local','demo-nurse','NURSE'); before=s.d.execute_script('return localStorage.getItem("analiza.en.casa.workspace.v2")')
  s.assertTrue(s.a('DASHBOARD-PATIENT-CREATE').is_displayed()); s.click('DASHBOARD-PATIENT-CREATE'); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-CREATE-CANCEL"]')))
  s.click('PATIENT-CREATE-CANCEL'); s.w.until(EC.invisibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-CREATE-CANCEL"]')))
  s.assertTrue(s.a('PATIENT-CREATE').is_displayed()); started=time.time(); s.click('PATIENT-CREATE'); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-CREATE-CANCEL"]')))
  s.click('PATIENT-CREATE-CANCEL'); s.w.until(EC.invisibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-CREATE-CANCEL"]')))
  s.assertEqual(s.d.execute_script('return localStorage.getItem("analiza.en.casa.workspace.v2")'),before); s.pass_('PATIENT-CREATE-CANCEL','SEL-PAT-PERMISSION-INTEGRITY',started)
  s.prepare_authenticated_test('auditor@demo.local','demo-auditor','AUDITOR'); s.d.get(BASE+'/patients'); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'tbody tr')))
  s.assertFalse(s.d.find_elements(By.CSS_SELECTOR,'[data-action-id="PATIENT-CREATE"]')); s.assertFalse(s.d.find_elements(By.CSS_SELECTOR,'[data-action-id="PATIENT-INACTIVATE"]')); s.assertIn('Solo lectura',s.d.find_element(By.TAG_NAME,'body').text)
  s.prepare_authenticated_test('inventory@demo.local','demo-inventory','INVENTORY'); s.d.get(BASE+'/patients'); denied=s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'main[role="alert"]')))
  s.assertIn('acceso',denied.text.lower()); s.assertFalse(s.d.find_elements(By.CSS_SELECTOR,'[data-action-id="PATIENT-CREATE"]'))
 def a(s,x): return s.d.find_element(By.CSS_SELECTOR,f'[data-action-id="{x}"]')
 def click(s,x): s.w.until(EC.element_to_be_clickable((By.CSS_SELECTOR,f'[data-action-id="{x}"]'))).click()
 def field(s,label): return s.d.find_element(By.XPATH,f"//label[contains(.,'{label}')]//*[self::input or self::select or self::textarea]")
 def fill(s,label,value):
  f=s.field(label); f.clear(); f.send_keys(value)
 def pass_(s,x,test,t): record_pass(x,test,t,s.d.current_url)
 def write_fixture(s,name,contents):
  path=s.fixture_dir/name; path.write_text(contents,encoding='utf8'); return path
 def open_import(s):
  s.d.get(BASE+'/patients'); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'tbody tr')))
  s.click('PATIENT-IMPORT'); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-IMPORT-FILE"]')))
 def upload_import(s,path): s.a('PATIENT-IMPORT-FILE').send_keys(str(path.resolve()))
 def clear_downloads(s):
  for path in s.download_dir.iterdir(): path.unlink()
 def wait_download(s,name):
  def complete(_):
   target=s.download_dir/name
   return target if target.exists() and not list(s.download_dir.glob('*.crdownload')) else False
  return WebDriverWait(s.d,12).until(complete)
 def contact_field(s,index,field): return s.d.find_element(By.CSS_SELECTOR,f'input[name="contacts.{index}.{field}"]')
 def fill_contact(s,index,field,value):
  target=s.contact_field(index,field); target.clear(); target.send_keys(value)
 def assert_detail_contains(s,*values):
  detail=s.d.find_element(By.TAG_NAME,'body').text
  for value in values: s.assertIn(value,detail)
 def find_and_open_fixture(s,name='Paciente Fixture Edit Selenium'):
  s.d.get(BASE+'/patients'); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'tbody tr')))
  search=s.a('PATIENT-SEARCH'); search.clear(); search.send_keys('EDIT-FIXTURE-001')
  s.w.until(EC.visibility_of_element_located((By.XPATH,f"//a[contains(.,'{name}')]")))
  s.click('PATIENT-DETAIL-NAVIGATE'); s.w.until(EC.url_contains('/patients/'))
 def create_full_patient_fixture(s):
  """Prepare the edit scenario through the real patient UI without action evidence."""
  s.open_create()
  Select(s.a('PATIENT-DOCUMENT-TYPE')).select_by_value('OTHER')
  s.fill('Número de documento','EDIT-FIXTURE-001')
  s.fill('Nombre completo','Paciente Fixture Edit Selenium')
  s.fill('Fecha de nacimiento','1985-04-20')
  s.field('Femenino').click()
  s.fill('Teléfono celular','70008888')
  s.fill('Empresa','Empresa Fixture Selenium')
  s.fill('Dirección','Dirección Fixture Original')
  s.fill('Comentario o referencia','Referencia Fixture Original')
  Select(s.a('PATIENT-INSURANCE-TOGGLE')).select_by_value('INSURED')
  s.w.until(EC.visibility_of_element_located((By.XPATH,"//label[contains(.,'Aseguradora')]//select")))
  Select(s.field('Aseguradora')).select_by_value('Aseguradora de demostración')
  s.fill('Número de póliza','POL-FIXTURE-001')
  s.fill('Identificación del titular','TIT-FIXTURE-001')
  s.fill('Nombre del titular','Titular Fixture Original')
  s.fill('Fecha de nacimiento del titular','1970-01-02')
  s.click('PATIENT-CONTACT-ADD')
  s.fill_contact(0,'fullName','Contacto Fixture Principal')
  s.fill_contact(0,'phone','70008111')
  s.click('PATIENT-CONTACT-ADD')
  s.fill_contact(1,'fullName','Contacto Fixture Secundario')
  s.fill_contact(1,'phone','70008222')
  s.d.find_elements(By.CSS_SELECTOR,'[data-action-id="PATIENT-CONTACT-PRIMARY"]')[0].click()
  s.click('PATIENT-CREATE-SUBMIT')
  s.w.until(EC.invisibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-CREATE-SUBMIT"]')))
  s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[contains(text(),'Registro sintético agregado')]")))
  s.find_and_open_fixture()
  s.assert_detail_contains('Paciente Fixture Edit Selenium','POL-FIXTURE-001','Titular Fixture Original','Contacto Fixture Principal','Contacto Fixture Secundario','Dirección Fixture Original','Referencia Fixture Original')
  s.d.refresh(); s.w.until(EC.visibility_of_element_located((By.TAG_NAME,'h1')))
  s.assert_detail_contains('Paciente Fixture Edit Selenium','POL-FIXTURE-001','Titular Fixture Original','Contacto Fixture Principal','Contacto Fixture Secundario','Dirección Fixture Original','Referencia Fixture Original')
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
 def test_contact_document_pair_persists_through_reload_and_edit(s):
  s.open_create(); s.fill_required('Paciente Contacto Documento Selenium','CONTACT-DOC-SEL-001','70007666'); s.click('PATIENT-CONTACT-ADD')
  Select(s.d.find_element(By.CSS_SELECTOR,'select[name="contacts.0.documentType"]')).select_by_value('DUI')
  partial_started=time.time(); s.click('PATIENT-CREATE-SUBMIT')
  s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[contains(text(),'Ingrese el número de documento del contacto')]")))
  s.assertIn('Ingrese el número de documento del contacto',s.d.find_element(By.TAG_NAME,'body').text)
  s.pass_('PATIENT-CONTACT-DOCUMENT-TYPE','SEL-PAT-CONTACT-DOCUMENT',partial_started)
  s.fill_contact(0,'documentId','CONTACT-DOC-SEL-001')
  submit_started=time.time(); s.click('PATIENT-CREATE-SUBMIT'); s.w.until(EC.invisibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-CREATE-SUBMIT"]')))
  s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[contains(text(),'Registro sintético agregado')]")))
  s.d.refresh(); s.w.until(EC.visibility_of_element_located((By.TAG_NAME,'h1')))
  search=s.a('PATIENT-SEARCH'); search.clear(); search.send_keys('CONTACT-DOC-SEL-001')
  s.w.until(EC.visibility_of_element_located((By.XPATH,"//a[contains(.,'Paciente Contacto Documento Selenium')]"))); s.click('PATIENT-DETAIL-NAVIGATE'); s.w.until(EC.url_contains('/patients/'))
  s.assert_detail_contains('DUI','CONTACT-DOC-SEL-001')
  s.click('PATIENT-EDIT'); s.w.until(EC.url_contains('edit=')); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-EDIT-SUBMIT"]')))
  s.assertEqual(Select(s.d.find_element(By.CSS_SELECTOR,'select[name="contacts.0.documentType"]')).first_selected_option.get_attribute('value'),'DUI')
  s.assertEqual(s.contact_field(0,'documentId').get_attribute('value'),'CONTACT-DOC-SEL-001')
  s.fill_contact(0,'documentId','CONTACT-DOC-SEL-EDIT')
  s.click('PATIENT-EDIT-SUBMIT'); s.w.until(EC.invisibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-EDIT-SUBMIT"]')))
  s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[contains(text(),'actualizado y persistido')]")))
  s.d.refresh(); s.w.until(EC.visibility_of_element_located((By.TAG_NAME,'h1'))); search=s.a('PATIENT-SEARCH'); search.clear(); search.send_keys('CONTACT-DOC-SEL-001')
  s.w.until(EC.visibility_of_element_located((By.XPATH,"//a[contains(.,'Paciente Contacto Documento Selenium')]"))); s.click('PATIENT-DETAIL-NAVIGATE'); s.w.until(EC.url_contains('/patients/'))
  s.assert_detail_contains('CONTACT-DOC-SEL-EDIT'); s.pass_('PATIENT-CONTACT-DOCUMENT-ID','SEL-PAT-CONTACT-DOCUMENT',submit_started)
 def test_insurance(s):
  s.open_create(); t=time.time(); Select(s.a('PATIENT-INSURANCE-TOGGLE')).select_by_value('INSURED'); s.w.until(EC.visibility_of_element_located((By.XPATH,"//label[contains(.,'Aseguradora')]"))); s.pass_('PATIENT-INSURANCE-TOGGLE','SEL-PAT-INSURANCE',t)
 def test_edit(s):
  s.create_full_patient_fixture()

  s.d.get(BASE+'/patients'); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'tbody tr')))
  search=s.a('PATIENT-SEARCH'); search.clear(); search.send_keys('EDIT-FIXTURE-001')
  detail_started=time.time(); s.click('PATIENT-DETAIL-NAVIGATE'); s.w.until(EC.url_contains('/patients/'))
  s.assertEqual(s.d.find_element(By.TAG_NAME,'h1').text,'Paciente Fixture Edit Selenium')
  s.assert_detail_contains('POL-FIXTURE-001')
  s.pass_('PATIENT-DETAIL-NAVIGATE','SEL-PAT-EDIT',detail_started)

  edit_started=time.time(); s.click('PATIENT-EDIT'); s.w.until(EC.url_contains('edit='))
  s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-EDIT-SUBMIT"]')))
  s.w.until(lambda _:s.field('Nombre completo').get_attribute('value')=='Paciente Fixture Edit Selenium')
  s.assertEqual(s.field('Número de documento').get_attribute('value'),'EDIT-FIXTURE-001')
  s.assertEqual(s.field('Teléfono celular').get_attribute('value'),'70008888')
  s.assertEqual(s.field('Número de póliza').get_attribute('value'),'POL-FIXTURE-001')
  s.assertEqual(s.contact_field(0,'fullName').get_attribute('value'),'Contacto Fixture Principal')
  s.assertEqual(s.field('Dirección').get_attribute('value'),'Dirección Fixture Original')
  s.pass_('PATIENT-EDIT','SEL-PAT-EDIT',edit_started)

  cancel_started=time.time(); s.fill('Nombre completo','NO DEBE GUARDARSE'); s.fill('Teléfono celular','79999999')
  s.click('PATIENT-EDIT-CANCEL'); s.w.until(EC.invisibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-EDIT-SUBMIT"]')))
  s.find_and_open_fixture()
  s.assert_detail_contains('Paciente Fixture Edit Selenium','70008888')
  s.assertNotIn('NO DEBE GUARDARSE',s.d.find_element(By.TAG_NAME,'body').text)
  s.d.refresh(); s.w.until(EC.visibility_of_element_located((By.TAG_NAME,'h1')))
  s.assert_detail_contains('Paciente Fixture Edit Selenium','70008888')
  s.assertNotIn('NO DEBE GUARDARSE',s.d.find_element(By.TAG_NAME,'body').text)
  s.pass_('PATIENT-EDIT-CANCEL','SEL-PAT-EDIT',cancel_started)

  submit_started=time.time(); s.click('PATIENT-EDIT'); s.w.until(EC.url_contains('edit='))
  s.w.until(lambda _:s.field('Nombre completo').get_attribute('value')=='Paciente Fixture Edit Selenium')
  s.fill('Nombre completo','Paciente Selenium Editado')
  s.fill('Teléfono celular','70009999')
  s.fill('Número de póliza','POL-SEL-EDIT')
  s.fill('Nombre del titular','Titular Selenium Editado')
  s.fill_contact(0,'fullName','Contacto Selenium Editado')
  s.fill('Dirección','Dirección Selenium Editada')
  s.fill('Comentario o referencia','Referencia Selenium Editada')
  s.click('PATIENT-EDIT-SUBMIT')
  s.w.until(EC.invisibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-EDIT-SUBMIT"]')))
  s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[contains(text(),'Paciente Paciente Selenium Editado actualizado y persistido')]")))
  s.assertTrue(s.d.current_url.rstrip('/').endswith('/patients'))
  search=s.a('PATIENT-SEARCH'); search.clear(); search.send_keys('Paciente Selenium Editado')
  s.w.until(EC.visibility_of_element_located((By.XPATH,"//a[contains(.,'Paciente Selenium Editado')]")))
  s.click('PATIENT-DETAIL-NAVIGATE'); s.w.until(EC.url_contains('/patients/'))
  s.assert_detail_contains('Paciente Selenium Editado','70009999','POL-SEL-EDIT','Titular Selenium Editado','Contacto Selenium Editado','Dirección Selenium Editada','Referencia Selenium Editada')
  stored=s.d.execute_script('return JSON.parse(localStorage.getItem("analiza.en.casa.workspace.v2"));')
  stored_patient=next(item for item in stored['patients'] if item['documentId']=='EDIT-FIXTURE-001')
  s.assertEqual(stored_patient['fullName'],'Paciente Selenium Editado')
  s.assertEqual(stored_patient['phone'],'70009999')
  s.assertEqual(stored_patient['insurance']['policyNumber'],'POL-SEL-EDIT')
  s.assertEqual(stored_patient['insurance']['holderFullName'],'Titular Selenium Editado')
  s.assertEqual(stored_patient['address']['line'],'Dirección Selenium Editada')
  s.assertEqual(stored_patient['address']['comments'],'Referencia Selenium Editada')
  s.assertEqual(next(contact for contact in stored_patient['contacts'] if contact['isPrimary'])['fullName'],'Contacto Selenium Editado')
  s.d.refresh(); s.w.until(EC.visibility_of_element_located((By.TAG_NAME,'h1')))
  s.assert_detail_contains('Paciente Selenium Editado','70009999','POL-SEL-EDIT','Titular Selenium Editado','Contacto Selenium Editado','Dirección Selenium Editada','Referencia Selenium Editada')
  s.pass_('PATIENT-EDIT-SUBMIT','SEL-PAT-EDIT',submit_started)

  back_started=time.time(); s.click('PATIENT-BACK-TO-LIST'); s.w.until(EC.url_to_be(BASE+'/patients'))
  s.assertEqual(s.d.find_element(By.TAG_NAME,'h1').text,'Pacientes')
  s.assertTrue(s.d.find_element(By.CSS_SELECTOR,'table').is_displayed())
  s.pass_('PATIENT-BACK-TO-LIST','SEL-PAT-EDIT',back_started)
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
 def test_import(s):
  s.prepare_authenticated_test()
  valid=s.write_fixture('patients-valid.csv','document,firstName,lastName,documentType,phone,email,company,status\nIMPORT-SEL-001,Importado,Selenium,OTHER,70001234,importado.selenium@example.test,Empresa Selenium,ACTIVE\n')
  invalid_cases=(
   ('patients-invalid-headers.csv','foo,bar\nuno,dos\n','Encabezados inválidos'),
   ('patients-missing-document.csv','document,firstName,lastName,documentType\n,Paciente,SinDocumento,OTHER\n','Fila 2'),
   ('patients-existing-duplicate.csv','document,firstName,lastName,documentType\nDEMO-003,Duplicado,Demo,OTHER\n','documento duplicado'),
   ('patients-batch-duplicate.csv','document,firstName,lastName,documentType\nIMPORT-DUP-001,Uno,Duplicado,OTHER\nIMPORT-DUP-001,Dos,Duplicado,OTHER\n','documento duplicado'),
   ('patients-not-csv.txt','contenido de texto','Seleccione un archivo CSV.'),
  )
  for name,contents,error in invalid_cases:
   s.open_import(); s.upload_import(s.write_fixture(name,contents)); s.w.until(lambda _:error in s.d.find_element(By.TAG_NAME,'body').text)
   s.assertFalse(s.a('PATIENT-IMPORT-CONFIRM').is_enabled()); s.click('PATIENT-IMPORT-CANCEL')
   s.w.until(EC.invisibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-IMPORT-FILE"]')))

  initial_rows=len(s.d.find_elements(By.CSS_SELECTOR,'tbody tr'))
  import_started=time.time(); s.open_import()
  s.assertTrue(s.a('PATIENT-IMPORT-FILE').is_displayed()); s.pass_('PATIENT-IMPORT','SEL-PAT-IMPORT',import_started)
  s.upload_import(valid); s.w.until(lambda _: 'Archivo cargado: patients-valid.csv' in s.d.find_element(By.TAG_NAME,'body').text)
  s.assertNotIn('Encabezados inválidos',s.d.find_element(By.TAG_NAME,'body').text); s.pass_('PATIENT-IMPORT-FILE','SEL-PAT-IMPORT',import_started)
  s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-IMPORT-PREVIEW"]')))
  s.assert_detail_contains('1 filas válidas de 1.','Importado Selenium','IMPORT-SEL-001')
  s.assertTrue(s.a('PATIENT-IMPORT-CONFIRM').is_enabled()); s.pass_('PATIENT-IMPORT-PREVIEW','SEL-PAT-IMPORT',import_started)
  cancel_started=time.time(); s.click('PATIENT-IMPORT-CANCEL')
  s.w.until(EC.invisibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-IMPORT-FILE"]')))
  s.assertEqual(len(s.d.find_elements(By.CSS_SELECTOR,'tbody tr')),initial_rows)
  s.d.refresh(); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'tbody tr')))
  search=s.a('PATIENT-SEARCH'); search.clear(); search.send_keys('IMPORT-SEL-001')
  s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[contains(text(),'Sin resultados')]")))
  s.pass_('PATIENT-IMPORT-CANCEL','SEL-PAT-IMPORT',cancel_started)

  s.open_import(); s.upload_import(valid)
  s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-IMPORT-PREVIEW"]')))
  confirm_started=time.time(); s.click('PATIENT-IMPORT-CONFIRM')
  s.w.until(EC.invisibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-IMPORT-FILE"]')))
  s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[contains(text(),'1 pacientes sintéticos importados')]")))
  search=s.a('PATIENT-SEARCH'); search.clear(); search.send_keys('IMPORT-SEL-001')
  s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[contains(text(),'Importado Selenium')]")))
  s.d.refresh(); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'tbody tr')))
  search=s.a('PATIENT-SEARCH'); search.clear(); search.send_keys('IMPORT-SEL-001')
  s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[contains(text(),'Importado Selenium')]")))
  stored=s.d.execute_script('return JSON.parse(localStorage.getItem("analiza.en.casa.workspace.v2"));')
  patient=next(item for item in stored['patients'] if item['documentId']=='IMPORT-SEL-001')
  s.assertEqual(patient['fullName'],'Importado Selenium'); s.assertEqual(patient['status'],'ACTIVE')
  s.pass_('PATIENT-IMPORT-CONFIRM','SEL-PAT-IMPORT',confirm_started)
 def test_export(s):
  s.prepare_authenticated_test(); s.clear_downloads(); s.d.get(BASE+'/patients'); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'tbody tr')))
  search=s.a('PATIENT-SEARCH'); search.clear(); search.send_keys('Paciente Demo Aurora')
  s.w.until(lambda _:len(s.d.find_elements(By.CSS_SELECTOR,'tbody tr'))==1)
  exported=time.time(); s.click('PATIENT-EXPORT'); active=s.wait_download('pacientes-activos.csv')
  active_csv=active.read_text(encoding='utf8')
  for header in ('Tipo de documento','Documento','Nombre completo','Teléfono','Correo','Empresa','Estado'): s.assertIn(header,active_csv)
  s.assertIn('Paciente Demo Aurora',active_csv); s.assertIn('12345678-9',active_csv); s.assertNotIn('Paciente Demo Celeste',active_csv)
  s.click('PATIENT-SEARCH-CLEAR'); s.click('PATIENT-TAB-INACTIVE'); s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[contains(text(),'Paciente Demo Brisa')]")))
  s.click('PATIENT-EXPORT'); inactive=s.wait_download('pacientes-inactivos.csv')
  inactive_csv=inactive.read_text(encoding='utf8'); s.assertIn('Paciente Demo Brisa',inactive_csv); s.assertNotIn('Paciente Demo Aurora',inactive_csv)
  s.pass_('PATIENT-EXPORT','SEL-PAT-EXPORT',exported)
 def test_mobile(s):
  s.d.set_window_size(390,844); s.prepare_authenticated_test(); s.d.get(BASE+'/patients')
  try:
   s.w.until(EC.visibility_of_element_located((By.TAG_NAME,'h1'))); s.assertEqual(s.d.find_element(By.TAG_NAME,'h1').text,'Pacientes')
   s.assertTrue(s.a('PATIENT-TAB-ACTIVE').is_enabled()); s.click('PATIENT-TAB-ACTIVE')
   search=s.a('PATIENT-SEARCH'); search.send_keys('Aurora'); s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[contains(text(),'Paciente Demo Aurora')]")))
   search.clear(); s.click('PATIENT-CREATE'); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-CREATE-SUBMIT"]')))
   form=s.d.find_element(By.ID,'patient-form'); s.d.execute_script('arguments[0].scrollTop=arguments[0].scrollHeight;',form)
   submit=s.a('PATIENT-CREATE-SUBMIT'); s.d.execute_script('arguments[0].scrollIntoView({block:"center"});',submit); s.assertTrue(submit.is_displayed())
   s.click('PATIENT-CREATE-CANCEL'); s.w.until(EC.invisibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-CREATE-SUBMIT"]')))
   search=s.a('PATIENT-SEARCH'); search.clear(); search.send_keys('Aurora'); s.w.until(EC.visibility_of_element_located((By.XPATH,"//a[contains(.,'Paciente Demo Aurora')]"))); s.click('PATIENT-DETAIL-NAVIGATE'); s.w.until(EC.url_contains('/patients/'))
   s.assertEqual(s.d.find_element(By.TAG_NAME,'h1').text,'Paciente Demo Aurora')
   scroll_width,viewport=s.d.execute_script('return [document.documentElement.scrollWidth, window.innerWidth];')
   s.assertLessEqual(scroll_width,viewport+8,f'critical horizontal overflow: {scroll_width}px > {viewport}px')
  finally: s.d.set_window_size(1440,1000)
