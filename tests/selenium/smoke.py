"""Chrome WebDriver smoke suite for authenticated React flows."""

from __future__ import annotations

import os
import subprocess
import time
import unittest
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.select import Select
from selenium.webdriver.support import expected_conditions as conditions
from selenium.webdriver.support.ui import WebDriverWait


ROOT = Path(__file__).resolve().parents[2]
BASE_URL = os.getenv("SELENIUM_BASE_URL", "http://127.0.0.1:4174")
SERVER: subprocess.Popen[str] | None = None


def server_is_ready() -> bool:
    try:
        with urlopen(BASE_URL, timeout=1) as response:  # nosec B310 -- explicit local URL only
            return response.status < 500
    except URLError:
        return False


def start_local_server() -> subprocess.Popen[str]:
    command = ["npm.cmd", "run", "dev", "--workspace=@analiza/web", "--", "--port", "4174"]
    process = subprocess.Popen(
        command,
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        text=True,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    for _ in range(60):
        if server_is_ready():
            return process
        time.sleep(1)
    process.terminate()
    raise RuntimeError("El servidor React local no inició en 60 segundos.")


class ReactUnauthenticatedSmoke(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        global SERVER
        if not server_is_ready():
            SERVER = start_local_server()
        options = Options()
        options.add_argument("--headless=new")
        options.add_argument("--window-size=1440,1000")
        options.add_argument("--no-first-run")
        cls.driver = webdriver.Chrome(options=options)
        cls.wait = WebDriverWait(cls.driver, 12)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.driver.quit()
        if SERVER is not None:
            SERVER.terminate()
            try:
                SERVER.wait(timeout=10)
            except subprocess.TimeoutExpired:
                SERVER.kill()

    def setUp(self) -> None:
        self.driver.get(f"{BASE_URL}/login")
        self.wait.until(lambda driver: driver.execute_script("return document.readyState") == "complete")
        self.driver.execute_script("localStorage.clear()")
        self.driver.refresh()
        username = self.wait.until(
            conditions.visibility_of_element_located((By.XPATH, "//label[contains(., 'Usuario')]//input"))
        )
        username.clear()
        username.send_keys("admin@demo.local")
        password = self.driver.find_element(By.CSS_SELECTOR, "input[type=password]")
        password.clear()
        password.send_keys("demo-admin")
        self.wait.until(
            conditions.element_to_be_clickable((By.CSS_SELECTOR, '[data-action-id="AUTH-LOGIN"]'))
        ).click()
        self.wait.until(conditions.url_contains("/dashboard"))

    def test_accordion_routes_to_health_report(self) -> None:
        self.driver.get(f"{BASE_URL}/dashboard")
        self.wait.until(conditions.element_to_be_clickable((By.XPATH, "//button[.//span[normalize-space()='Clínico']]"))).click()
        self.wait.until(conditions.element_to_be_clickable((By.XPATH, "//a[normalize-space()='Reporte de salud']"))).click()
        self.wait.until(conditions.url_matches(r".*/clinical/reports$"))
        self.assertTrue(self.driver.find_element(By.XPATH, "//h1[normalize-space()='Reporte de salud']").is_displayed())

    def test_duplicate_document_is_blocked_inline(self) -> None:
        self.driver.get(f"{BASE_URL}/patients")
        self.wait.until(conditions.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Agregar paciente']"))).click()
        self.wait.until(conditions.visibility_of_element_located((By.XPATH, "//label[contains(., 'Nombre completo')]//input"))).send_keys("Paciente Demo Repetido")
        self.driver.find_element(By.CSS_SELECTOR, 'input[aria-label="Número de documento"]').send_keys("123456789")
        self.driver.find_element(By.XPATH, "//label[contains(., 'Fecha de nacimiento')]//input").send_keys("04/20/1985")
        self.driver.find_element(By.XPATH, "//label[contains(., 'Femenino')]//input").click()
        self.driver.find_element(By.XPATH, "//label[contains(., 'Teléfono celular')]//input").send_keys("70009999")
        self.driver.find_element(By.XPATH, "//label[contains(., 'Empresa')]//input").send_keys("Empresa smoke")
        self.driver.find_element(By.XPATH, "//label[contains(., 'Dirección')]//input").send_keys("Dirección smoke")
        self.driver.find_element(By.XPATH, "//label[contains(., 'Comentarios relevantes de la dirección')]//input").send_keys("Referencia smoke")
        self.driver.find_element(By.CSS_SELECTOR, '[data-action-id="PATIENT-SAVE"]').click()
        error = self.wait.until(conditions.visibility_of_element_located((By.XPATH, "//*[contains(text(), 'Ya existe un registro con este documento')]")))
        self.assertIn("Ya existe un registro", error.text)

    def test_help_does_not_invent_whatsapp_contact(self) -> None:
        self.driver.get(f"{BASE_URL}/help")
        self.wait.until(conditions.visibility_of_element_located((By.CSS_SELECTOR, '[data-action-id="HELP-SEARCH"]'))).send_keys("canal externo inexistente")
        text = self.wait.until(conditions.visibility_of_element_located((By.XPATH, "//*[contains(text(), 'No hay un canal de WhatsApp configurado')]"))).text
        self.assertIn("No hay un canal de WhatsApp configurado", text)

    def test_nursing_board_registers_an_operational_resource(self) -> None:
        self.driver.get(f"{BASE_URL}/clinical/nursing")
        self.wait.until(conditions.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Nuevo recurso']"))).click()
        self.wait.until(conditions.visibility_of_element_located((By.XPATH, "//label[contains(., 'Número de Junta')]//input"))).send_keys("REG-SMOKE-001")
        self.wait.until(conditions.visibility_of_element_located((By.XPATH, "//label[contains(., 'Nombre visible')]//input"))).send_keys("Enfermería Demo Sur")
        self.driver.find_element(By.XPATH, "//label[contains(., 'Territorio')]//input").send_keys("Zona demo sur")
        capacity = self.driver.find_element(By.XPATH, "//label[contains(., 'Capacidad disponible')]//input")
        capacity.clear()
        capacity.send_keys("2")
        self.driver.find_element(By.XPATH, "//button[normalize-space()='Guardar recurso']").click()
        self.assertTrue(self.wait.until(conditions.visibility_of_element_located((By.XPATH, "//*[contains(text(), 'Enfermería Demo Sur')]"))).is_displayed())

    def test_kardex_rejects_negative_balance(self) -> None:
        self.driver.get(f"{BASE_URL}/inventory/kardex")
        self.wait.until(conditions.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Registrar movimiento']"))).click()
        Select(self.wait.until(conditions.presence_of_element_located((By.XPATH, "//label[contains(., 'Tipo de movimiento')]//select")))).select_by_value("EXIT")
        quantity = self.driver.find_element(By.XPATH, "//label[contains(., 'Cantidad')]//input")
        quantity.clear()
        quantity.send_keys("11")
        self.driver.find_element(By.XPATH, "//label[contains(., 'Motivo')]//input").send_keys("Prueba de saldo negativo")
        self.driver.find_element(By.XPATH, "//button[normalize-space()='Guardar movimiento']").click()
        error = self.wait.until(conditions.visibility_of_element_located((By.XPATH, "//*[contains(text(), 'dejaría un saldo negativo')]")))
        self.assertIn("saldo negativo", error.text)

    def test_nurse_hours_reports_scheduled_total(self) -> None:
        self.driver.get(f"{BASE_URL}/reports/nurse-hours")
        total = self.wait.until(conditions.visibility_of_element_located((By.XPATH, "//span[normalize-space()='Horas programadas']/following-sibling::strong")))
        self.assertGreaterEqual(float(total.text), 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
