"""Selenium patient regression: each action is recorded only after its assertions pass."""
# test-id: SEL-PAT-NAVIGATION
# test-id: SEL-PAT-DOCUMENT
# test-id: SEL-PAT-INSURANCE
# test-id: SEL-PAT-CONTACTS
# test-id: SEL-PAT-ADDRESS
# test-id: SEL-PAT-EDIT
# test-id: SEL-PAT-IMPORT
# test-id: SEL-PAT-SEARCH
# test-id: SEL-PAT-PAGINATION
# test-id: SEL-PAT-STATUS
from __future__ import annotations

import os, shutil, subprocess, tempfile, time, unittest
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.select import Select
from selenium.webdriver.support.ui import WebDriverWait

from helpers.action_recorder import record_pass, reset

ROOT = Path(__file__).resolve().parents[2]
BASE = os.getenv('SELENIUM_BASE_URL', 'http://127.0.0.1:4174')
SERVER = None

def ready():
    try: return urlopen(BASE, timeout=1).status < 500 # nosec B310 local only
    except (URLError, TimeoutError, OSError): return False

class Patients(unittest.TestCase):
 @classmethod
 def setUpClass(c):
    global SERVER
    reset(); c.download_dir=Path(tempfile.mkdtemp(prefix='analiza-downloads-')); c.fixture_dir=Path(tempfile.mkdtemp(prefix='analiza-patient-csv-'))
    if not ready(): SERVER=subprocess.Popen(['npm.cmd','run','dev','--workspace=@analiza/web','--','--port','4174'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    for _ in range(60):
      if ready(): break
      time.sleep(1)
    else: raise RuntimeError('Local React server did not start')
    opts=webdriver.ChromeOptions(); opts.add_argument('--headless=new'); opts.add_argument('--window-size=1440,1000'); opts.add_experimental_option('prefs', {'download.default_directory':str(c.download_dir),'download.prompt_for_download':False,'download.directory_upgrade':True,'safebrowsing.enabled':True})
    c.d=webdriver.Chrome(options=opts); c.w=WebDriverWait(c.d,12)
 @classmethod
 def tearDownClass(c):
    c.d.quit(); shutil.rmtree(c.download_dir,ignore_errors=True); shutil.rmtree(c.fixture_dir,ignore_errors=True)
    if SERVER: SERVER.terminate()
 def setUp(s): s.login('admin@demo.local','demo-admin',clear=True)
 def login(s,email,password,clear=False):
    s.d.get(BASE+'/login')
    if clear: s.d.execute_script('localStorage.clear()'); s.d.refresh()
    email_box=s.w.until(EC.visibility_of_element_located((By.XPATH,"//label[contains(.,'Correo')]//input"))); email_box.clear(); email_box.send_keys(email)
    password_box=s.d.find_element(By.CSS_SELECTOR,'input[type="password"]'); password_box.clear(); password_box.send_keys(password); s.d.find_element(By.CSS_SELECTOR,'[data-action-id="AUTH-LOGIN"]').click(); s.w.until(EC.url_contains('/dashboard'))
 def click(s,action_id): s.w.until(EC.element_to_be_clickable((By.CSS_SELECTOR,f'[data-action-id="{action_id}"]'))).click()
 def pass_(s,action_id,test_id,started): record_pass(action_id,test_id,started,s.d.current_url)
 def a(s,action_id): return s.d.find_element(By.CSS_SELECTOR,f'[data-action-id="{action_id}"]')
 def field(s,label): return s.d.find_element(By.XPATH,f"//label[contains(.,'{label}')]//*[self::input or self::select or self::textarea]")
 def fill(s,label,value):
    box=s.field(label); box.clear(); box.send_keys(value)
 def text(s,value): s.w.until(EC.visibility_of_element_located((By.XPATH,f"//*[contains(normalize-space(), '{value}')]")))
 def search(s,value):
    box=s.a('PATIENT-SEARCH'); box.send_keys(Keys.CONTROL,'a'); box.send_keys(Keys.BACKSPACE); box.send_keys(value)
 def rows(s): return s.d.find_elements(By.CSS_SELECTOR,'tbody tr')
 def csv(s,name,contents):
    path=s.fixture_dir/name; path.write_text(contents,encoding='utf-8'); return path
 def create(s):
    s.d.get(BASE+'/patients'); s.w.until(EC.visibility_of_element_located((By.TAG_NAME,'h1'))); t=time.time(); s.click('PATIENT-CREATE'); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-CREATE-SUBMIT"]'))); s.pass_('PATIENT-CREATE','SEL-PAT-DOCUMENT',t)
 def fill_patient(s,name,document,phone):
    s.fill('Número de documento',document); s.fill('Nombre completo',name); s.fill('Fecha de nacimiento','1985-04-20'); s.field('Femenino').click(); s.fill('Teléfono celular',phone); s.fill('Empresa','Empresa Selenium'); s.fill('Dirección','Dirección Selenium'); s.fill('Comentario o referencia','Referencia Selenium')

 def test_patient_actions(s):
    d=s.d
    # PATIENT-NAVIGATE: allowed route survives refresh; INVENTORY is denied.
    t=time.time(); s.click('PATIENT-NAVIGATE'); s.w.until(EC.url_contains('/patients')); s.text('Pacientes'); d.refresh(); s.w.until(EC.visibility_of_element_located((By.TAG_NAME,'h1'))); d.execute_script("localStorage.removeItem('analiza.en.casa.mock-session.v1')"); s.login('inventory@demo.local','demo-inventory'); d.get(BASE+'/patients'); alert=s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'main[role="alert"]'))); s.assertIn('Acceso restringido',alert.text); d.execute_script("localStorage.removeItem('analiza.en.casa.mock-session.v1')"); s.login('admin@demo.local','demo-admin'); s.pass_('PATIENT-NAVIGATE','SEL-PAT-NAVIGATION',t)
    s.create()

    # PATIENT-DOCUMENT-TYPE: switch clears only the document input.
    t=time.time(); typ=Select(s.a('PATIENT-DOCUMENT-TYPE')); typ.select_by_value('PASSPORT'); s.fill('Número de documento','PASS-SEL-001'); s.fill('Nombre completo','Paciente Selenium Asegurado'); s.fill('Teléfono celular','70009001'); typ.select_by_value('DUI'); s.assertEqual(s.field('Número de documento').get_attribute('value'),''); s.assertEqual(s.field('Nombre completo').get_attribute('value'),'Paciente Selenium Asegurado'); s.assertEqual(s.field('Teléfono celular').get_attribute('value'),'70009001'); s.fill('Número de documento','12345670-1'); typ.select_by_value('PASSPORT'); s.assertEqual(s.field('Número de documento').get_attribute('value'),''); s.assertEqual(s.field('Nombre completo').get_attribute('value'),'Paciente Selenium Asegurado'); s.assertEqual(s.field('Teléfono celular').get_attribute('value'),'70009001'); s.pass_('PATIENT-DOCUMENT-TYPE','SEL-PAT-DOCUMENT',t)
    s.fill_patient('Paciente Selenium Asegurado','SEL-INS-001','70009001')

    # PATIENT-INSURANCE-TOGGLE: regular hides fields; insured fields persist through detail refresh.
    t=time.time(); insurance=Select(s.a('PATIENT-INSURANCE-TOGGLE')); s.assertEqual(insurance.first_selected_option.get_attribute('value'),'REGULAR'); s.assertFalse(d.find_elements(By.XPATH,"//label[contains(.,'Aseguradora')]")); insurance.select_by_value('INSURED'); s.w.until(EC.visibility_of_element_located((By.XPATH,"//label[contains(.,'Aseguradora')]//select"))); Select(s.field('Aseguradora')).select_by_visible_text('Aseguradora de demostración'); s.assertEqual(Select(s.field('Aseguradora')).first_selected_option.get_attribute('value'),'Aseguradora de demostración'); s.fill('Número de póliza','POL-SEL-001'); s.fill('Identificación del titular','HOLDER-SEL-001'); s.fill('Nombre del titular','Titular Selenium'); s.fill('Fecha de nacimiento del titular','1970-01-02'); s.fill('Fecha efectiva','2026-08-28')

    # Contact add/remove are asserted independently; contact 2 becomes the sole primary contact.
    add_t=time.time(); s.click('PATIENT-CONTACT-ADD'); s.w.until(lambda _:len(d.find_elements(By.CSS_SELECTOR,'[data-action-id="PATIENT-CONTACT-PRIMARY"]'))==1); s.pass_('PATIENT-CONTACT-ADD','SEL-PAT-CONTACTS',add_t); s.click('PATIENT-CONTACT-ADD'); s.w.until(lambda _:len(d.find_elements(By.CSS_SELECTOR,'[data-action-id="PATIENT-CONTACT-PRIMARY"]'))==2); remove_t=time.time(); d.find_elements(By.CSS_SELECTOR,'[data-action-id="PATIENT-CONTACT-REMOVE"]')[1].click(); s.w.until(lambda _:len(d.find_elements(By.CSS_SELECTOR,'[data-action-id="PATIENT-CONTACT-PRIMARY"]'))==1); s.pass_('PATIENT-CONTACT-REMOVE','SEL-PAT-CONTACTS',remove_t); s.click('PATIENT-CONTACT-ADD')
    contacts=[button.find_element(By.XPATH,'ancestor::fieldset[1]') for button in d.find_elements(By.CSS_SELECTOR,'[data-action-id="PATIENT-CONTACT-PRIMARY"]')]; s.assertEqual(len(contacts),2)
    for i,(name,phone) in enumerate((('Contacto Selenium Uno','70009011'),('Contacto Selenium Dos','70009012'))):
      fields=contacts[i].find_elements(By.CSS_SELECTOR,'input'); fields[0].send_keys(name); fields[1].send_keys(phone)
    contact_t=time.time(); d.find_elements(By.CSS_SELECTOR,'[data-action-id="PATIENT-CONTACT-PRIMARY"]')[1].click(); contacts=[button.find_element(By.XPATH,'ancestor::fieldset[1]') for button in d.find_elements(By.CSS_SELECTOR,'[data-action-id="PATIENT-CONTACT-PRIMARY"]')]; s.assertIn('Contacto secundario',contacts[0].text); s.assertIn('Contacto principal',contacts[1].text)

    # PATIENT-ADDRESS-CLEAR: all four address inputs clear while general data remains.
    address_t=time.time(); s.fill('Dirección','Dirección a limpiar'); s.fill('Comentario o referencia','Referencia a limpiar'); s.fill('Coordenadas','13.7000,-89.2000'); s.fill('Enlace de ubicación','https://example.test/ubicacion'); s.click('PATIENT-ADDRESS-CLEAR')
    for label in ('Dirección','Comentario o referencia','Coordenadas','Enlace de ubicación'): s.assertEqual(s.field(label).get_attribute('value'),'')
    s.assertEqual(s.field('Nombre completo').get_attribute('value'),'Paciente Selenium Asegurado'); s.pass_('PATIENT-ADDRESS-CLEAR','SEL-PAT-ADDRESS',address_t)
    s.fill('Dirección','Dirección Selenium Persistida'); s.fill('Comentario o referencia','Referencia Selenium Persistida'); s.fill('Coordenadas','13.7001,-89.2001'); s.fill('Enlace de ubicación','https://example.test/selenium'); lookup_t=time.time(); s.click('PATIENT-ADDRESS-LOOKUP'); s.text('requiere una integración de mapas configurada'); s.pass_('PATIENT-ADDRESS-LOOKUP','SEL-PAT-ADDRESS',lookup_t)

    submit_t=time.time(); s.click('PATIENT-CREATE-SUBMIT'); s.text('Registro sintético agregado'); s.search('Paciente Selenium Asegurado'); detail_t=time.time(); s.click('PATIENT-DETAIL-NAVIGATE'); s.w.until(EC.url_contains('/patients/')); s.text('Paciente Selenium Asegurado'); s.pass_('PATIENT-DETAIL-NAVIGATE','SEL-PAT-INSURANCE',detail_t); d.refresh(); s.w.until(EC.visibility_of_element_located((By.TAG_NAME,'h1'))); s.assertIn('POL-SEL-001',d.find_element(By.TAG_NAME,'body').text); s.assertIn('Titular Selenium',d.find_element(By.TAG_NAME,'body').text); s.assertNotEqual(d.find_element(By.XPATH,"//dt[normalize-space()='Fecha efectiva']/following-sibling::dd[1]").text,'Sin dato'); s.pass_('PATIENT-INSURANCE-TOGGLE','SEL-PAT-INSURANCE',t); contact_table=d.find_element(By.XPATH,"//h2[normalize-space()='Contactos']/following-sibling::*[1]"); s.assertIn('Contacto Selenium Uno',contact_table.text); s.assertIn('Secundario',contact_table.text); s.assertIn('Contacto Selenium Dos',contact_table.text); s.assertIn('Principal',contact_table.text); s.pass_('PATIENT-CONTACT-PRIMARY','SEL-PAT-CONTACTS',contact_t); s.pass_('PATIENT-CREATE-SUBMIT','SEL-PAT-DOCUMENT',submit_t)

    # PATIENT-EDIT-SUBMIT rejects an existing document, then persists all edited administrative data.
    edit_t=time.time(); s.click('PATIENT-EDIT'); s.w.until(EC.url_contains('edit=')); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-EDIT-SUBMIT"]'))); s.w.until(lambda _:s.field('Nombre completo').get_attribute('value')=='Paciente Selenium Asegurado' and s.field('Número de documento').get_attribute('value')=='SEL-INS-001' and s.field('Teléfono celular').get_attribute('value')=='70009001'); s.pass_('PATIENT-EDIT','SEL-PAT-EDIT',edit_t); Select(s.a('PATIENT-DOCUMENT-TYPE')).select_by_value('OTHER'); s.fill('Número de documento','DEMO-003'); s.click('PATIENT-EDIT-SUBMIT'); s.text('Ya existe un registro con este documento'); s.fill('Número de documento','SEL-INS-001'); s.fill('Nombre completo','Paciente Selenium Editado'); s.fill('Teléfono celular','70009999'); Select(s.a('PATIENT-INSURANCE-TOGGLE')).select_by_value('INSURED'); Select(s.field('Aseguradora')).select_by_visible_text('Cobertura sintética QA'); s.fill('Número de póliza','POL-SEL-EDIT'); s.fill('Nombre del titular','Titular Selenium Editado'); contact_input=d.find_elements(By.CSS_SELECTOR,'[data-action-id="PATIENT-CONTACT-PRIMARY"]')[1].find_element(By.XPATH,'ancestor::fieldset[1]').find_elements(By.CSS_SELECTOR,'input')[0]; contact_input.clear(); contact_input.send_keys('Contacto Selenium Editado'); s.fill('Dirección','Dirección Selenium Editada'); s.fill('Comentario o referencia','Referencia Selenium Editada'); s.fill('Coordenadas','13.7002,-89.2002'); s.fill('Enlace de ubicación','https://example.test/editada'); form_values=d.execute_script("return [...document.querySelectorAll('#patient-form input, #patient-form select')].map(x=>[x.name,x.value])"); print('FORM_VALUE:',form_values); t=time.time(); s.click('PATIENT-EDIT-SUBMIT'); s.w.until(EC.invisibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-EDIT-SUBMIT"]'))); persisted=d.execute_script("const s=JSON.parse(localStorage.getItem('analiza.en.casa.workspace.v2')); return s.patients.find(p=>p.fullName==='Paciente Selenium Editado')"); print('PERSISTED_VALUE:',persisted); s.search('Paciente Selenium Editado'); s.click('PATIENT-DETAIL-NAVIGATE'); s.w.until(EC.url_contains('/patients/')); detail=d.find_element(By.TAG_NAME,'body').text; print('CURRENT_URL:',d.current_url); print('DETAIL_VALUE:',detail); expected=['Paciente Selenium Editado','70009999','POL-SEL-EDIT','Titular Selenium Editado','Contacto Selenium Editado','Dirección Selenium Editada','Referencia Selenium Editada'];
    for value in expected: s.assertIn(value,detail,f'FAILING_ASSERTION: detail value; EXPECTED: {value}; ACTUAL: {detail}; CURRENT_URL: {d.current_url}')
    d.refresh(); detail=d.find_element(By.TAG_NAME,'body').text
    for value in expected: s.assertIn(value,detail,f'FAILING_ASSERTION after reload: {value}; ACTUAL: {detail}; CURRENT_URL: {d.current_url}')
    s.pass_('PATIENT-EDIT-SUBMIT','SEL-PAT-EDIT',t); s.click('PATIENT-EDIT'); cancel_t=time.time(); s.click('PATIENT-EDIT-CANCEL'); s.w.until(EC.invisibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-EDIT-SUBMIT"]'))); s.pass_('PATIENT-EDIT-CANCEL','SEL-PAT-EDIT',cancel_t)

    # Real local upload exercises invalid and valid CSV paths before import confirmation.
    d.get(BASE+'/patients'); import_t=time.time(); s.click('PATIENT-IMPORT'); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-IMPORT-FILE"]'))); s.pass_('PATIENT-IMPORT','SEL-PAT-IMPORT',import_t)
    invalid=s.csv('pacientes-invalidos.csv','document,firstName,lastName,documentType\n,Invalido,Paciente,OTHER\n'); valid=s.csv('pacientes-validos.csv','document,firstName,lastName,documentType,phone,email,company,status\nIMPORT-SEL-001,Importado,Selenium,OTHER,70005001,selenium.import@example.test,Empresa Importada,ACTIVE\n')
    t=time.time(); s.a('PATIENT-IMPORT-FILE').send_keys(str(invalid)); s.w.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-IMPORT-PREVIEW"] [role="alert"]'))); s.assertIn('pacientes-invalidos.csv',d.find_element(By.CSS_SELECTOR,'[data-action-id="PATIENT-IMPORT-PREVIEW"]').text); s.assertTrue(s.a('PATIENT-IMPORT-CONFIRM').get_attribute('disabled')); s.a('PATIENT-IMPORT-FILE').send_keys(str(valid)); s.w.until(EC.visibility_of_element_located((By.XPATH,"//*[contains(text(),'IMPORT-SEL-001')]"))); preview=d.find_element(By.CSS_SELECTOR,'[data-action-id="PATIENT-IMPORT-PREVIEW"]'); s.assertIn('pacientes-validos.csv',preview.text); s.assertIn('1 filas válidas de 1.',preview.text); s.assertIn('Importado Selenium',preview.text); s.pass_('PATIENT-IMPORT-FILE','SEL-PAT-IMPORT',t); s.assertFalse(preview.find_elements(By.CSS_SELECTOR,'[role="alert"]')); s.assertTrue(s.a('PATIENT-IMPORT-CONFIRM').is_enabled()); s.pass_('PATIENT-IMPORT-PREVIEW','SEL-PAT-IMPORT',t)
    confirm_t=time.time(); s.click('PATIENT-IMPORT-CONFIRM'); s.text('1 pacientes sintéticos importados'); s.search('IMPORT-SEL-001'); s.text('Importado Selenium'); d.refresh(); s.search('IMPORT-SEL-001'); s.text('Importado Selenium'); s.pass_('PATIENT-IMPORT-CONFIRM','SEL-PAT-IMPORT',confirm_t); cancel_t=time.time(); s.click('PATIENT-IMPORT'); s.click('PATIENT-IMPORT-CANCEL'); s.w.until(EC.invisibility_of_element_located((By.CSS_SELECTOR,'[data-action-id="PATIENT-IMPORT-FILE"]'))); s.pass_('PATIENT-IMPORT-CANCEL','SEL-PAT-IMPORT',cancel_t)
    export_t=time.time(); s.search('IMPORT-SEL-001'); s.click('PATIENT-EXPORT'); s.w.until(lambda _:any(path.suffix=='.csv' for path in s.download_dir.iterdir())); export=next(path for path in s.download_dir.iterdir() if path.suffix=='.csv'); s.assertIn('IMPORT-SEL-001',export.read_text(encoding='utf-8')); s.pass_('PATIENT-EXPORT','SEL-PAT-IMPORT',export_t)

    # PATIENT-SEARCH checks partial/full name, document, phone, and no match.
    t=time.time()
    for query,expected in (('Selenium Actual','Paciente Selenium Actualizado'),('Paciente Selenium Actualizado','Paciente Selenium Actualizado'),('SEL-INS-001','Paciente Selenium Actualizado'),('70009999','Paciente Selenium Actualizado')): s.search(query); s.text(expected); s.assertEqual(len(s.rows()),1)
    s.search('sin resultado selenium'); s.text('Sin resultados'); s.pass_('PATIENT-SEARCH','SEL-PAT-SEARCH',t); clear_t=time.time(); s.click('PATIENT-SEARCH-CLEAR'); s.assertEqual(s.a('PATIENT-SEARCH').get_attribute('value'),''); s.assertGreater(len(s.rows()),0); s.pass_('PATIENT-SEARCH-CLEAR','SEL-PAT-SEARCH',clear_t)
    inactive_tab_t=time.time(); s.click('PATIENT-TAB-INACTIVE'); s.assertEqual(s.a('PATIENT-TAB-INACTIVE').get_attribute('aria-selected'),'true'); s.text('Paciente Demo Brisa'); s.pass_('PATIENT-TAB-INACTIVE','SEL-PAT-SEARCH',inactive_tab_t); active_tab_t=time.time(); s.click('PATIENT-TAB-ACTIVE'); s.assertEqual(s.a('PATIENT-TAB-ACTIVE').get_attribute('aria-selected'),'true'); s.text('Paciente Demo Aurora'); s.pass_('PATIENT-TAB-ACTIVE','SEL-PAT-SEARCH',active_tab_t)
    sort_name_t=time.time(); s.click('PATIENT-SORT-NAME'); s.assertEqual(s.a('PATIENT-SORT-NAME').find_element(By.XPATH,'..').get_attribute('aria-sort'),'descending'); s.pass_('PATIENT-SORT-NAME','SEL-PAT-SEARCH',sort_name_t); sort_doc_t=time.time(); s.click('PATIENT-SORT-DOCUMENT'); s.assertEqual(s.a('PATIENT-SORT-DOCUMENT').find_element(By.XPATH,'..').get_attribute('aria-sort'),'ascending'); s.pass_('PATIENT-SORT-DOCUMENT','SEL-PAT-SEARCH',sort_doc_t)

    # PATIENT-PAGE-SIZE includes multiple pages and verifies reset to page 1.
    t=time.time(); Select(s.a('PATIENT-PAGE-SIZE')).select_by_value('5'); s.w.until(lambda _:len(s.rows())<=5); pages=d.find_elements(By.CSS_SELECTOR,'[data-action-id="PATIENT-PAGINATE"]'); s.assertGreater(len(pages),1); pages[1].click(); s.w.until(lambda _:d.find_element(By.CSS_SELECTOR,'[data-action-id="PATIENT-PAGINATE"][aria-current="page"]').text=='2'); paginate_t=time.time(); s.pass_('PATIENT-PAGINATE','SEL-PAT-PAGINATION',paginate_t); previous_t=time.time(); s.click('PATIENT-PAGE-PREVIOUS'); s.w.until(lambda _:d.find_element(By.CSS_SELECTOR,'[data-action-id="PATIENT-PAGINATE"][aria-current="page"]').text=='1'); s.pass_('PATIENT-PAGE-PREVIOUS','SEL-PAT-PAGINATION',previous_t); next_t=time.time(); s.click('PATIENT-PAGE-NEXT'); s.w.until(lambda _:d.find_element(By.CSS_SELECTOR,'[data-action-id="PATIENT-PAGINATE"][aria-current="page"]').text=='2'); s.pass_('PATIENT-PAGE-NEXT','SEL-PAT-PAGINATION',next_t); Select(s.a('PATIENT-PAGE-SIZE')).select_by_value('10'); s.w.until(lambda _:len(s.rows())<=10); s.assertEqual(d.find_element(By.CSS_SELECTOR,'[data-action-id="PATIENT-PAGINATE"][aria-current="page"]').text,'1'); s.pass_('PATIENT-PAGE-SIZE','SEL-PAT-PAGINATION',t)

    # Status transitions disappear from the current tab, appear in the other, and persist after reload.
    s.search('Paciente Selenium Actualizado'); t=time.time(); s.click('PATIENT-INACTIVATE'); s.text('Sin resultados'); s.click('PATIENT-TAB-INACTIVE'); s.search('Paciente Selenium Actualizado'); s.text('Paciente Selenium Actualizado'); d.refresh(); s.search('Paciente Selenium Actualizado'); s.text('Paciente Selenium Actualizado'); s.pass_('PATIENT-INACTIVATE','SEL-PAT-STATUS',t)
    t=time.time(); s.click('PATIENT-REACTIVATE'); s.text('Sin resultados'); s.click('PATIENT-TAB-ACTIVE'); s.search('Paciente Selenium Actualizado'); s.text('Paciente Selenium Actualizado'); d.refresh(); s.search('Paciente Selenium Actualizado'); s.text('Paciente Selenium Actualizado'); s.pass_('PATIENT-REACTIVATE','SEL-PAT-STATUS',t)

if __name__=='__main__':
 result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Patients)); raise SystemExit(not result.wasSuccessful())
