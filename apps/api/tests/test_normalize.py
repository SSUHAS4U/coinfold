"""Unit tests for the dirty-data policy.

These run without Postgres. They cover the boundaries the brief cares about:
first and last element, empty/zero/single, min and max, and the error path.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

import pytest

from coinfold.ingest.normalize import (
    IMPLAUSIBLE_AMOUNT,
    AnomalyKind,
    NormalisationError,
    build_merchant_category_map,
    coins_for,
    normalise_amount,
    normalise_category,
    normalise_method,
    normalise_status,
    normalise_timestamp,
)

UTC = timezone.utc


# --- Timestamps -------------------------------------------------------------


class TestTimestamps:
    def test_iso_utc_is_untouched_and_flags_nothing(self):
        moment, anomaly = normalise_timestamp("2025-10-03T21:03:27Z")
        assert moment == datetime(2025, 10, 3, 21, 3, 27, tzinfo=UTC)
        assert anomaly is None

    def test_iso_with_offset_converts_to_utc(self):
        moment, anomaly = normalise_timestamp("2026-03-25T06:08:03+05:30")
        assert moment == datetime(2026, 3, 25, 0, 38, 3, tzinfo=UTC)
        assert anomaly.kind is AnomalyKind.TIMESTAMP_NON_ISO

    def test_epoch_millis_reads_as_utc(self):
        moment, anomaly = normalise_timestamp(1768265109000)
        assert moment == datetime.fromtimestamp(1768265109, tz=UTC)
        assert anomaly.kind is AnomalyKind.TIMESTAMP_NON_ISO

    def test_slash_format_is_day_first_not_month_first(self):
        # 21/08 can only be 21 August. A month-first reader would raise here,
        # which is exactly the bug this test exists to prevent.
        moment, anomaly = normalise_timestamp("21/08/2025 09:14:08")
        assert (moment.day, moment.month) == (21, 8)
        assert anomaly.kind is AnomalyKind.TIMESTAMP_NON_ISO

    def test_slash_format_ambiguous_case_still_reads_day_first(self):
        # 12/10/2025 is genuinely ambiguous in isolation. The feed-wide evidence
        # says day-first, so this must be 12 October, never 10 December.
        moment, _ = normalise_timestamp("12/10/2025 16:24:49")
        assert (moment.day, moment.month) == (12, 10)

    def test_slash_format_converts_from_ist(self):
        # 00:30 IST on the 2nd is 19:00 UTC on the 1st: the date rolls back.
        moment, _ = normalise_timestamp("02/01/2026 00:30:00")
        assert moment == datetime(2026, 1, 1, 19, 0, 0, tzinfo=UTC)

    def test_date_only_anchors_to_ist_midnight(self):
        moment, anomaly = normalise_timestamp("2025-07-03")
        assert moment == datetime(2025, 7, 2, 18, 30, 0, tzinfo=UTC)
        assert anomaly.kind is AnomalyKind.TIMESTAMP_NON_ISO

    @pytest.mark.parametrize("bad", ["", "   ", None, "not-a-date", "2025-13-45", []])
    def test_unparseable_values_raise_rather_than_guess(self, bad):
        with pytest.raises(NormalisationError):
            normalise_timestamp(bad)

    def test_impossible_calendar_date_raises(self):
        with pytest.raises(NormalisationError):
            normalise_timestamp("31/02/2025 10:00:00")

    def test_booleans_are_not_treated_as_epochs(self):
        # bool is a subclass of int; without a guard True would become 1970.
        with pytest.raises(NormalisationError):
            normalise_timestamp(True)


# --- Amounts ----------------------------------------------------------------


class TestAmounts:
    def test_plain_float_is_exact_not_binary_rounded(self):
        value, anomalies, anomalous = normalise_amount(912.62)
        assert value == Decimal("912.62")
        assert anomalies == []
        assert anomalous is False

    def test_numeric_string_is_parsed_and_flagged(self):
        value, anomalies, anomalous = normalise_amount("5065.00")
        assert value == Decimal("5065.00")
        assert [a.kind for a in anomalies] == [AnomalyKind.AMOUNT_NOT_NUMERIC]
        assert anomalous is False

    def test_negative_is_kept_and_flagged_as_refund(self):
        value, anomalies, anomalous = normalise_amount(-53652.71)
        assert value == Decimal("-53652.71")
        assert [a.kind for a in anomalies] == [AnomalyKind.AMOUNT_NEGATIVE]
        # A refund is real data, so it stays visible in the table.
        assert anomalous is False

    def test_sentinel_is_flagged_out_of_range(self):
        value, anomalies, anomalous = normalise_amount(999999999.0)
        assert value == Decimal("999999999.00")
        assert [a.kind for a in anomalies] == [AnomalyKind.AMOUNT_OUT_OF_RANGE]
        assert anomalous is True

    def test_largest_plausible_value_is_not_flagged(self):
        # 742350 is the largest genuine amount in the feed and must survive.
        _, anomalies, anomalous = normalise_amount(742350.0)
        assert anomalies == []
        assert anomalous is False

    def test_ceiling_is_inclusive(self):
        _, _, at_ceiling = normalise_amount(float(IMPLAUSIBLE_AMOUNT))
        _, _, just_over = normalise_amount(float(IMPLAUSIBLE_AMOUNT) + 0.01)
        assert at_ceiling is False
        assert just_over is True

    def test_zero_is_allowed_and_unflagged(self):
        value, anomalies, anomalous = normalise_amount(0)
        assert value == Decimal("0.00")
        assert anomalies == []
        assert anomalous is False

    @pytest.mark.parametrize("bad", [None, True, "abc", "", {}, []])
    def test_junk_amounts_raise(self, bad):
        with pytest.raises(NormalisationError):
            normalise_amount(bad)


# --- Status and method ------------------------------------------------------


class TestStatusAndMethod:
    def test_canonical_status_flags_nothing(self):
        assert normalise_status("SUCCESS") == ("SUCCESS", None)

    def test_lowercase_success_is_repaired(self):
        status, anomaly = normalise_status("success")
        assert status == "SUCCESS"
        assert anomaly.kind is AnomalyKind.STATUS_CASE_MISMATCH

    @pytest.mark.parametrize("status", ["PENDING", "FAILED"])
    def test_other_statuses_pass_through(self, status):
        assert normalise_status(status) == (status, None)

    @pytest.mark.parametrize("bad", ["", None, "REFUNDED", 1])
    def test_unknown_status_raises(self, bad):
        with pytest.raises(NormalisationError):
            normalise_status(bad)

    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("Credit Card", "CREDIT_CARD"),
            ("Debit Card", "DEBIT_CARD"),
            ("UPI", "UPI"),
            ("Netbanking", "NETBANKING"),
            ("  netbanking  ", "NETBANKING"),
        ],
    )
    def test_methods_map_to_enum(self, raw, expected):
        assert normalise_method(raw) == expected

    @pytest.mark.parametrize("bad", ["Cash", "", None])
    def test_unknown_method_raises(self, bad):
        with pytest.raises(NormalisationError):
            normalise_method(bad)


# --- Category ---------------------------------------------------------------


class TestCategory:
    MAP = {"Domino's": "Food & Dining", "BPCL": "Fuel"}

    def test_present_category_wins_over_imputation(self):
        assert normalise_category("Shopping", "Domino's", self.MAP) == ("Shopping", None)

    @pytest.mark.parametrize("blank", [None, "", "   "])
    def test_blank_category_is_imputed_from_merchant(self, blank):
        category, anomaly = normalise_category(blank, "Domino's", self.MAP)
        assert category == "Food & Dining"
        assert anomaly.kind is AnomalyKind.CATEGORY_MISSING

    def test_unknown_merchant_falls_back_rather_than_guessing(self):
        category, anomaly = normalise_category(None, "Mystery Shop", self.MAP)
        assert category == "Uncategorised"
        assert anomaly.kind is AnomalyKind.CATEGORY_MISSING

    def test_map_excludes_merchants_spanning_two_categories(self):
        rows = [
            {"merchant": "Amazon", "category": "Shopping"},
            {"merchant": "Amazon", "category": "Groceries"},
            {"merchant": "BPCL", "category": "Fuel"},
        ]
        mapping = build_merchant_category_map(rows)
        assert "Amazon" not in mapping
        assert mapping["BPCL"] == "Fuel"

    def test_map_ignores_blank_categories(self):
        rows = [
            {"merchant": "BPCL", "category": None},
            {"merchant": "BPCL", "category": ""},
            {"merchant": "BPCL", "category": "Fuel"},
        ]
        assert build_merchant_category_map(rows) == {"BPCL": "Fuel"}

    def test_empty_feed_yields_empty_map(self):
        assert build_merchant_category_map([]) == {}


# --- Coins ------------------------------------------------------------------


class TestCoins:
    RATE = Decimal("100")
    CAP = 100

    def test_one_coin_per_hundred_rupees(self):
        assert coins_for(Decimal("912.62"), "SUCCESS", False, self.RATE, self.CAP) == 9

    def test_rounds_down_never_up(self):
        assert coins_for(Decimal("199.99"), "SUCCESS", False, self.RATE, self.CAP) == 1

    def test_below_one_hundred_earns_nothing(self):
        assert coins_for(Decimal("99.99"), "SUCCESS", False, self.RATE, self.CAP) == 0

    def test_cap_applies_to_large_payments(self):
        # 54,945 would otherwise mint 549 coins.
        assert coins_for(Decimal("54945.56"), "SUCCESS", False, self.RATE, self.CAP) == 100

    def test_exactly_at_cap_boundary(self):
        assert coins_for(Decimal("10000.00"), "SUCCESS", False, self.RATE, self.CAP) == 100
        assert coins_for(Decimal("9999.99"), "SUCCESS", False, self.RATE, self.CAP) == 99

    @pytest.mark.parametrize("status", ["PENDING", "FAILED"])
    def test_unsuccessful_payments_earn_nothing(self, status):
        assert coins_for(Decimal("5000.00"), status, False, self.RATE, self.CAP) == 0

    def test_refunds_earn_nothing(self):
        assert coins_for(Decimal("-5000.00"), "SUCCESS", False, self.RATE, self.CAP) == 0

    def test_anomalous_amounts_mint_nothing(self):
        # The sentinel row must not create 100 coins out of bad data.
        assert coins_for(Decimal("999999999.00"), "SUCCESS", True, self.RATE, self.CAP) == 0

    def test_zero_earns_nothing(self):
        assert coins_for(Decimal("0.00"), "SUCCESS", False, self.RATE, self.CAP) == 0
