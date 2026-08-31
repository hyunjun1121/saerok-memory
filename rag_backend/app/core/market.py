from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Any, Mapping


MARKET_LOCALES = {
    "kr": "ko-KR",
    "jp": "ja-JP",
}
DEFAULT_MARKET = "kr"
DEFAULT_LOCALE = MARKET_LOCALES[DEFAULT_MARKET]


class MarketLocaleMismatch(ValueError):
    pass


@dataclass(frozen=True)
class MarketContext:
    market: str
    locale: str


def validate_market_locale(market: str, locale: str) -> MarketContext:
    expected = MARKET_LOCALES.get(market)
    if expected is None or locale != expected:
        raise MarketLocaleMismatch("market_locale_mismatch")
    return MarketContext(market=market, locale=locale)


def context_from_mapping(value: Mapping[str, Any] | None) -> MarketContext:
    source = value or {}
    market = str(source.get("market") or DEFAULT_MARKET)
    locale = str(source.get("locale") or source.get("ui_locale") or DEFAULT_LOCALE)
    return validate_market_locale(market, locale)


def context_from_usage_payload(payload: Mapping[str, Any]) -> MarketContext:
    dataset = payload.get("dataset")
    user = payload.get("user")
    dataset_context = context_from_mapping(dataset if isinstance(dataset, Mapping) else None)
    user_context = context_from_mapping(user if isinstance(user, Mapping) else None)
    if dataset_context != user_context:
        raise MarketLocaleMismatch("market_locale_mismatch")
    return dataset_context


def context_from_user_profile(profile: Mapping[str, Any] | None) -> MarketContext:
    return context_from_mapping(profile)


def assert_matching_context(
    stored_profile: Mapping[str, Any] | None,
    requested_market: str,
    requested_locale: str,
) -> MarketContext:
    requested = validate_market_locale(requested_market, requested_locale)
    if context_from_user_profile(stored_profile) != requested:
        raise MarketLocaleMismatch("market_locale_mismatch")
    return requested


_HANGUL = re.compile(r"[\uac00-\ud7a3]")
_JP_KOREAN_CONTEXT = re.compile(
    r"(?:₩|ウォン|儒城市場|ユソン市場|福祉館|韓国かぼちゃ|ユッノリ|"
    r"テンジャンチゲ|チャプチェ|チヂミ)"
)


def is_auto_question_text_safe(text: str, market: str) -> bool:
    if market != "jp":
        return True
    return _HANGUL.search(text) is None and _JP_KOREAN_CONTEXT.search(text) is None
