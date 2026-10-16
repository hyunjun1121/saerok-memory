"""Read NexQ API credentials from the current Windows user's Credential Manager."""
from __future__ import annotations

import ctypes
import os
import sys
from ctypes import wintypes


class _FileTime(ctypes.Structure):
    _fields_ = [("dwLowDateTime", wintypes.DWORD), ("dwHighDateTime", wintypes.DWORD)]


class _Credential(ctypes.Structure):
    _fields_ = [
        ("Flags", wintypes.DWORD),
        ("Type", wintypes.DWORD),
        ("TargetName", wintypes.LPWSTR),
        ("Comment", wintypes.LPWSTR),
        ("LastWritten", _FileTime),
        ("CredentialBlobSize", wintypes.DWORD),
        ("CredentialBlob", ctypes.POINTER(ctypes.c_ubyte)),
        ("Persist", wintypes.DWORD),
        ("AttributeCount", wintypes.DWORD),
        ("Attributes", ctypes.c_void_p),
        ("TargetAlias", wintypes.LPWSTR),
        ("UserName", wintypes.LPWSTR),
    ]


def read_credential(target: str) -> str | None:
    if os.name != "nt" or sys.platform != "win32":
        return None
    advapi = ctypes.WinDLL("Advapi32.dll", use_last_error=True)
    credential = ctypes.c_void_p()
    read = advapi.CredReadW
    read.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.POINTER(ctypes.c_void_p)]
    read.restype = wintypes.BOOL
    if not read(target, 1, 0, ctypes.byref(credential)):
        error = ctypes.get_last_error()
        if error == 1168:
            return None
        raise OSError(error, "Credential Manager read failed")
    try:
        item = ctypes.cast(credential, ctypes.POINTER(_Credential)).contents
        if not item.CredentialBlob or not item.CredentialBlobSize:
            return None
        raw = bytes(item.CredentialBlob[: item.CredentialBlobSize])
        return raw.decode("utf-8").strip() or None
    finally:
        advapi.CredFree.argtypes = [ctypes.c_void_p]
        advapi.CredFree(credential)


def get_speech_api_key() -> str | None:
    return os.getenv("STT_API_KEY", "").strip() or read_credential("NexQ:azure_speech")
