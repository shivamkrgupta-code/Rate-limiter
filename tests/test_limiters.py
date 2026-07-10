import pytest
from app.limiters.fixed_window import fixed_window
from app.limiters.sliding_window import sliding_window_log
from app.limiters.token_bucket import token_bucket

def test_fixed_window_allows_under_limit():
    for _ in range(5):
        result = fixed_window("test_fw", max_requests=10, window_seconds=60)
    assert result["allowed"] is True

def test_fixed_window_blocks_over_limit():
    for _ in range(11):
        result = fixed_window("test_fw_block", max_requests=10, window_seconds=60)
    assert result["allowed"] is False

def test_sliding_window_allows_under_limit():
    result = sliding_window_log("test_sw", max_requests=10, window_seconds=60)
    assert result["allowed"] is True

def test_token_bucket_allows_initial_requests():
    result = token_bucket("test_tb", capacity=10, refill_rate=1.0)
    assert result["allowed"] is True