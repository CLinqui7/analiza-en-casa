"""Single source of truth for Selenium access to mock workspace storage."""

from __future__ import annotations

import json
from typing import Any


LEGACY_KEY = 'analiza.en.casa.workspace.v2'
SESSION_KEY = 'analiza.en.casa.mock-session.v1'
PREFIX = 'analiza.en.casa.workspace.v3.'


def collection_key(name: str) -> str:
    return f'{PREFIX}{name}'


def clear_workspace(driver, *, clear_session: bool = True) -> None:
    """Clear legacy and segmented workspace values without assuming keys exist."""
    driver.execute_script(
        "localStorage.removeItem(arguments[0]);"
        "Object.keys(localStorage).filter((key) => key.startsWith(arguments[1])).forEach((key) => localStorage.removeItem(key));"
        "if (arguments[2]) localStorage.removeItem(arguments[3]);",
        LEGACY_KEY, PREFIX, clear_session, SESSION_KEY,
    )


def get_collection(driver, name: str) -> Any:
    raw = driver.execute_script('return localStorage.getItem(arguments[0]);', collection_key(name))
    return json.loads(raw) if raw is not None else None


def set_collection(driver, name: str, value: Any) -> None:
    driver.execute_script('localStorage.setItem(arguments[0], arguments[1]);', collection_key(name), json.dumps(value))


def append_collection_items(driver, name: str, items: list[Any]) -> list[Any]:
    collection = get_collection(driver, name)
    if not isinstance(collection, list):
        raise AssertionError(f'Segmented collection {name!r} is unavailable.')
    next_collection = [*collection, *items]
    set_collection(driver, name, next_collection)
    return next_collection


def get_hospitalizations(driver) -> list[dict[str, Any]]:
    collection = get_collection(driver, 'hospitalizations')
    if not isinstance(collection, list):
        raise AssertionError('Segmented hospitalization storage is unavailable.')
    return collection


def set_hospitalizations(driver, hospitalizations: list[dict[str, Any]]) -> None:
    set_collection(driver, 'hospitalizations', hospitalizations)


def get_collections(driver, names: list[str]) -> dict[str, Any]:
    return {name: get_collection(driver, name) for name in names}


def set_legacy_snapshot(driver, snapshot: dict[str, Any]) -> None:
    driver.execute_script('localStorage.setItem(arguments[0], arguments[1]);', LEGACY_KEY, json.dumps(snapshot))


def legacy_snapshot_exists(driver) -> bool:
    return driver.execute_script('return localStorage.getItem(arguments[0]) !== null;', LEGACY_KEY)
