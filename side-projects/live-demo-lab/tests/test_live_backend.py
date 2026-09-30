"""Cost and privacy invariants for the live demo; no SDK or AWS account needed."""

import base64
from concurrent.futures import ThreadPoolExecutor
import copy
from datetime import datetime, timezone
import importlib.util
import io
import json
from pathlib import Path
import struct
import sys
import threading
import unittest
from unittest.mock import patch
import uuid
import zlib


MODULE_PATH = Path(__file__).resolve().parents[1] / "backend" / "live_demos" / "app.py"
SPEC = importlib.util.spec_from_file_location("live_demo_app", MODULE_PATH)
app = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = app
SPEC.loader.exec_module(app)
NOW = int(datetime(2026, 9, 26, 12, tzinfo=timezone.utc).timestamp())
ORIGIN = "https://elliottbarnes.ca"


def png_chunk(kind, payload):
    return struct.pack("!I", len(payload)) + kind + payload + struct.pack("!I", zlib.crc32(kind + payload))


def png_image(width=1024, height=1024, *, depth=8, color=0, compression=0, filtering=0,
              interlace=0, raw=None, compressed=None, split_at=None):
    # Grayscale scanlines create a small but complete, valid PNG for fixtures.
    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}.get(color, 1)
    if raw is None:
        raw = b"\x00" * (((width * depth * channels + 7) // 8 + 1) * height)
    if compressed is None:
        compressed = zlib.compress(raw)
    idat = (png_chunk(b"IDAT", compressed) if split_at is None else
            png_chunk(b"IDAT", compressed[:split_at]) + png_chunk(b"IDAT", compressed[split_at:]))
    return (b"\x89PNG\r\n\x1a\n"
            + png_chunk(b"IHDR", struct.pack("!IIBBBBB", width, height, depth, color, compression, filtering, interlace))
            + (png_chunk(b"PLTE", b"\x00\x00\x00") if color == 3 else b"")
            + idat + png_chunk(b"IEND", b""))


def request(seed=42, prompt="A lighthouse on a green island"):
    return {"prompt": prompt, "seed": seed, "requestId": str(uuid.uuid4())}


def http_event(method="POST", path="/generations", payload=None, origin=ORIGIN):
    return {"rawPath": path, "headers": {"origin": origin, "content-type": "application/json"},
            "requestContext": {"http": {"method": method, "sourceIp": "192.0.2.3"}},
            "body": json.dumps(payload if payload is not None else request())}


class MemoryStore:
    """An atomic fake reflecting the single transaction's admission conditions."""

    def __init__(self):
        self.jobs, self.counters = {}, {}
        self.lock = threading.Lock()
        self.fail_reserve = False
        self.fail_complete = False

    def get(self, job_id):
        with self.lock:
            return copy.deepcopy(self.jobs.get(job_id))

    def reserve(self, job, reservations):
        if self.fail_reserve:
            raise RuntimeError("Do not leak this exception or IP 192.0.2.3")
        with self.lock:
            if job["jobId"] in self.jobs or any(self.counters.get(key, 0) >= limit for key, limit, _ in reservations):
                return False
            self.jobs[job["jobId"]] = copy.deepcopy(job)
            for key, _, _ in reservations:
                self.counters[key] = self.counters.get(key, 0) + 1
            return True

    def claim(self, job_id, now):
        with self.lock:
            job = self.jobs.get(job_id)
            if (not job or job["status"] != "queued" or job["expiresAt"] <= now
                    or job["createdAt"] <= now - app.QUEUE_SECONDS):
                return None
            job.update(status="running", startedAt=now)
            return copy.deepcopy(job)

    def complete(self, job_id, status, now, **fields):
        if self.fail_complete:
            raise RuntimeError("database unavailable")
        with self.lock:
            job = self.jobs[job_id]
            if job["status"] == "running":
                job.update(status=status, completedAt=now, **fields)


class FakeDispatcher:
    def __init__(self):
        self.jobs = []
        self.fail = False

    def send(self, job_id):
        self.jobs.append(job_id)
        if self.fail:
            raise TimeoutError("Sensitive input must not appear in logs")


class FakeImages:
    def __init__(self):
        self.calls = 0
        self.saved = []
        self.signed = []
        self.error = None

    def generate(self, job):
        self.calls += 1
        if self.error:
            raise self.error
        return b"fixture", 1024, 1024

    def save(self, job_id, image):
        self.saved.append(job_id)
        return f"generated/{job_id}.png"

    def url(self, key, seconds):
        self.signed.append((key, seconds))
        return "https://private-bucket.s3.amazonaws.com/" + key + "?signed=fixture"


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.clock = NOW
        self.store, self.dispatcher, self.images = MemoryStore(), FakeDispatcher(), FakeImages()
        self.config = app.Settings(enabled=True, ip_secret="a" * 64)
        self.service = app.Service(self.config, self.store, self.dispatcher, self.images, lambda: self.clock)

    def submit(self, value=None, ip="192.0.2.3"):
        return self.service.submit(app.validate_request(value or request()), ip)

    def test_disabled_generation_never_reserves_or_dispatches(self):
        self.service.config = app.Settings()
        reply = app.api_handler(http_event(), None, self.service)
        self.assertEqual(reply["statusCode"], 503)
        self.assertIn("GENERATION_DISABLED", reply["body"])
        self.assertFalse(self.store.jobs)
        self.assertFalse(self.dispatcher.jobs)

    def test_health_exposes_only_public_configuration(self):
        reply = app.api_handler(http_event("GET", "/health"), None, self.service)
        body = json.loads(reply["body"])
        self.assertTrue(body["enabled"])
        self.assertEqual(body["limits"], {"monthly": 75, "daily": 5, "perIpDaily": 3,
                                          "promptMaxLength": 1000, "seedMin": 1, "seedMax": app.MAX_SEED})
        self.assertNotIn(self.config.ip_secret, reply["body"])
        self.assertEqual(reply["headers"]["cache-control"], "no-store")

    def test_success_and_bearer_job_status(self):
        value = request()
        reply = app.api_handler(http_event(payload=value), None, self.service)
        self.assertEqual(reply["statusCode"], 202)
        self.assertEqual(json.loads(reply["body"])["status"], "queued")
        app.worker_handler({"jobId": value["requestId"]}, None, self.service)
        status = self.service.status(value["requestId"])
        self.assertEqual(status["status"], "succeeded")
        self.assertEqual(status["seed"], 42)
        self.assertEqual(status["prompt"], value["prompt"])
        self.assertEqual(status["settings"]["width"], 1024)
        self.assertEqual(self.images.signed[0][1], 300)
        self.assertNotIn("fingerprint", status)
        self.assertNotIn("pk", status)

    def test_duplicate_request_does_not_consume_another_attempt_or_dispatch(self):
        value = request()
        first = self.submit(value)
        self.assertEqual(self.submit(value), first)
        self.assertEqual(self.dispatcher.jobs, [value["requestId"]])
        self.assertEqual(set(self.store.counters.values()), {1})
        app.worker_handler({"jobId": first["jobId"]}, None, self.service)
        self.assertEqual(self.submit(value)["status"], "succeeded")
        self.assertEqual(self.images.calls, 1)

    def test_request_id_reuse_with_different_payload_is_conflict(self):
        value = request()
        self.submit(value)
        value["seed"] = 43
        with self.assertRaises(app.PublicError) as raised:
            self.submit(value)
        self.assertEqual(raised.exception.code, "REQUEST_ID_CONFLICT")
        self.assertEqual(len(self.dispatcher.jobs), 1)

    def test_same_job_concurrent_submissions_reserve_only_once(self):
        value = request()
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda _: self.submit(value), range(20)))
        self.assertEqual({result["jobId"] for result in results}, {value["requestId"]})
        self.assertEqual(len(self.dispatcher.jobs), 1)
        self.assertEqual(set(self.store.counters.values()), {1})

    def test_concurrent_visitors_cannot_exceed_global_daily_limit(self):
        def submit(index):
            try:
                self.submit(ip=f"192.0.2.{index + 1}")
                return True
            except app.PublicError as error:
                self.assertEqual(error.code, "GENERATION_LIMIT_REACHED")
                return False
        with ThreadPoolExecutor(max_workers=8) as pool:
            accepted = list(pool.map(submit, range(30)))
        self.assertEqual(sum(accepted), 5)
        self.assertEqual(len(self.dispatcher.jobs), 5)
        self.assertEqual(self.store.counters["month#2026-09"], 5)

    def test_ip_daily_limit_and_next_day_reset(self):
        for _ in range(3):
            self.submit()
        with self.assertRaises(app.PublicError):
            self.submit()
        self.clock += 86400
        self.submit()
        self.assertEqual(len(self.dispatcher.jobs), 4)
        self.assertEqual(self.store.counters["month#2026-09"], 4)

    def test_monthly_limit_survives_daily_reset(self):
        self.service.config = app.Settings(enabled=True, monthly=3, daily=3, ip_daily=3, ip_secret="a" * 64)
        for _ in range(3):
            self.submit()
        self.clock += 86400
        with self.assertRaises(app.PublicError) as raised:
            self.submit()
        self.assertEqual(raised.exception.code, "GENERATION_LIMIT_REACHED")
        self.assertNotIn("day#2026-09-27", self.store.counters)

    def test_attempts_are_not_refunded_after_model_failure(self):
        value = request()
        self.submit(value)
        self.images.error = RuntimeError("private provider detail")
        with self.assertLogs(app.LOG, level="WARNING") as logs:
            app.worker_handler({"jobId": value["requestId"]}, None, self.service)
        self.assertNotIn("private provider detail", str(logs.output))
        self.assertEqual(self.service.status(value["requestId"])["error"], {"code": "GENERATION_FAILED"})
        self.assertEqual(set(self.store.counters.values()), {1})
        self.assertEqual(self.images.calls, 1)

    def test_duplicate_worker_delivery_cannot_invoke_twice(self):
        job_id = self.submit()["jobId"]
        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(lambda _: app.worker_handler({"jobId": job_id}, None, self.service), range(20)))
        self.assertEqual(self.images.calls, 1)
        self.assertEqual(self.images.saved, [job_id])

    def test_database_failure_after_paid_call_does_not_permit_retry(self):
        job_id = self.submit()["jobId"]
        self.store.fail_complete = True
        with self.assertLogs(app.LOG, level="WARNING"):
            app.worker_handler({"jobId": job_id}, None, self.service)
        app.worker_handler({"jobId": job_id}, None, self.service)
        self.assertEqual(self.images.calls, 1)
        self.clock += app.COMPLETION_SECONDS
        self.assertEqual(self.service.status(job_id)["error"], {"code": "GENERATION_TIMED_OUT"})

    def test_ambiguous_dispatch_is_never_retried_but_worker_may_complete(self):
        value = request()
        self.dispatcher.fail = True
        with self.assertLogs(app.LOG, level="WARNING") as logs:
            self.submit(value)
        self.assertNotIn("Sensitive", str(logs.output))
        self.submit(value)
        self.assertEqual(len(self.dispatcher.jobs), 1)
        app.worker_handler({"jobId": value["requestId"]}, None, self.service)
        self.assertEqual(self.service.status(value["requestId"])["status"], "succeeded")

    def test_expired_queue_is_not_invoked_and_eventually_reports_failure(self):
        job_id = self.submit()["jobId"]
        self.clock += app.QUEUE_SECONDS
        app.worker_handler({"jobId": job_id}, None, self.service)
        self.assertEqual(self.images.calls, 0)
        self.clock += app.COMPLETION_SECONDS
        self.assertEqual(self.service.status(job_id)["status"], "failed")

    def test_worker_kill_switch_prevents_paid_invocation(self):
        job_id = self.submit()["jobId"]
        self.service.config = app.Settings(enabled=False)
        with self.assertLogs(app.LOG, level="WARNING"):
            app.worker_handler({"jobId": job_id}, None, self.service)
        self.assertEqual(self.images.calls, 0)
        self.assertEqual(self.service.status(job_id)["error"], {"code": "GENERATION_DISABLED"})

    def test_expired_job_hidden_before_asynchronous_ttl_deletion(self):
        value = request()
        job_id = self.submit(value)["jobId"]
        self.clock += app.JOB_SECONDS
        with self.assertRaises(app.PublicError) as raised:
            self.service.status(job_id)
        self.assertEqual(raised.exception.status, 404)
        with self.assertRaises(app.PublicError) as raised:
            self.submit(value)
        self.assertEqual(raised.exception.code, "REQUEST_EXPIRED")

    def test_download_url_does_not_outlive_job_expiry(self):
        job_id = self.submit()["jobId"]
        app.worker_handler({"jobId": job_id}, None, self.service)
        self.clock += app.JOB_SECONDS - 20
        self.assertEqual(self.service.status(job_id)["urlExpiresIn"], 20)

    def test_unknown_status_and_arbitrary_object_key_fail_closed(self):
        job_id = self.submit()["jobId"]
        self.store.jobs[job_id]["status"] = "unexpected"
        with self.assertRaises(app.PublicError):
            self.service.status(job_id)
        self.store.jobs[job_id].update(status="succeeded", imageKey="someone-elses-object")
        with self.assertRaises(app.PublicError):
            self.service.status(job_id)
        self.assertFalse(self.images.signed)

    def test_storage_error_never_logs_prompt_ip_or_exception(self):
        value = request(prompt="secret-sample-prompt")
        self.store.fail_reserve = True
        with self.assertLogs(app.LOG, level="ERROR") as logs:
            reply = app.api_handler(http_event(payload=value), None, self.service)
        combined = str(logs.output) + reply["body"]
        self.assertEqual(reply["statusCode"], 503)
        for sensitive in (value["prompt"], "192.0.2.3", "Do not leak", self.config.ip_secret):
            self.assertNotIn(sensitive, combined)
        self.assertFalse(self.dispatcher.jobs)

    def test_cors_exact_origin_and_no_credentials(self):
        reply = app.api_handler(http_event("GET", "/health", origin=ORIGIN + ".evil.test"), None, self.service)
        self.assertEqual(reply["statusCode"], 403)
        self.assertNotIn("access-control-allow-origin", reply["headers"])
        reply = app.api_handler(http_event("OPTIONS"), None, self.service)
        self.assertEqual(reply["statusCode"], 204)
        self.assertEqual(reply["headers"]["access-control-allow-origin"], ORIGIN)
        self.assertNotIn("access-control-allow-credentials", reply["headers"])

    def test_untrusted_forwarded_ip_does_not_change_limit(self):
        for index in range(4):
            event = http_event()
            event["headers"]["x-forwarded-for"] = f"198.51.100.{index}"
            reply = app.api_handler(event, None, self.service)
        self.assertEqual(reply["statusCode"], 429)
        self.assertEqual(len(self.dispatcher.jobs), 3)


class ValidationTests(unittest.TestCase):
    def test_seed_boundaries_and_types(self):
        for seed in (1, app.MAX_SEED):
            self.assertEqual(app.validate_request(request(seed))["seed"], seed)
        for seed in (0, -1, app.MAX_SEED + 1, True, False, "42", 42.0, None):
            with self.subTest(seed=seed), self.assertRaises(app.PublicError):
                app.validate_request(request(seed))

    def test_prompt_and_body_schema(self):
        for prompt in (None, "", "a", " " * 3, "a" * 1001, "hi\x00there", "hi\ud800there"):
            with self.subTest(prompt=repr(prompt)), self.assertRaises(app.PublicError):
                app.validate_request(request(prompt=prompt))
        self.assertEqual(app.validate_request(request(prompt=" a sky \n"))["prompt"], "a sky")
        invalid = request()
        invalid["quality"] = "expensive"
        with self.assertRaises(app.PublicError):
            app.validate_request(invalid)
        for value in ([], None, "text"):
            with self.assertRaises(app.PublicError):
                app.validate_request(value)

    def test_only_canonical_uuid4_identifiers(self):
        for value in (None, "../../../foo", str(uuid.uuid1()), str(uuid.uuid4()).upper(), "0" * 36):
            with self.assertRaises(app.PublicError):
                app.canonical_uuid(value)

    def test_json_rejects_oversize_duplicate_keys_invalid_base64_and_nan(self):
        bodies = ("{", '{"seed":1,"seed":2}', '{"seed":NaN}', "a" * 4097)
        for body in bodies:
            event = http_event()
            event["body"] = body
            with self.subTest(body=body[:30]), self.assertRaises(app.PublicError):
                app.decode_request(event, event["headers"])
        event = http_event()
        event.update(body="!", isBase64Encoded=True)
        with self.assertRaises(app.PublicError):
            app.decode_request(event, event["headers"])

    def test_base64_requests_and_byte_not_character_limit(self):
        event = http_event()
        original = json.loads(event["body"])
        event.update(body=base64.b64encode(event["body"].encode()).decode(), isBase64Encoded=True)
        self.assertEqual(app.decode_request(event, event["headers"]), original)
        event = http_event(payload=request(prompt="\U0001f600" * 1000))
        event["body"] = json.dumps(json.loads(event["body"]), ensure_ascii=False) + " " * 100
        with self.assertRaises(app.PublicError) as raised:
            app.decode_request(event, event["headers"])
        self.assertEqual(raised.exception.status, 413)

    def test_json_content_type_required(self):
        event = http_event()
        event["headers"]["content-type"] = "text/plain"
        with self.assertRaises(app.PublicError) as raised:
            app.decode_request(event, event["headers"])
        self.assertEqual(raised.exception.status, 415)

    def test_production_settings_fail_closed(self):
        for config in (app.Settings(enabled=True), app.Settings(model="another.model"),
                       app.Settings(monthly=0), app.Settings(daily=True), app.Settings(origin="*"),
                       app.Settings(origin="http://public.example"), app.Settings(origin=ORIGIN + "/path")):
            with self.assertRaises(ValueError):
                config.validate()
        self.assertEqual(app.Settings(origin="http://localhost:4187").validate().origin, "http://localhost:4187")

    def test_ip_hashes_change_by_day_and_never_store_raw_ip(self):
        config = app.Settings(enabled=True, ip_secret="a" * 64)
        today = app.counter_reservations(config, "192.0.2.3", NOW)
        tomorrow = app.counter_reservations(config, "192.0.2.3", NOW + 86400)
        self.assertNotEqual(today[2][0], tomorrow[2][0])
        self.assertNotIn("192.0.2.3", repr(today))
        self.assertEqual(today[0][2], int(datetime(2026, 10, 3, tzinfo=timezone.utc).timestamp()))
        self.assertEqual(today[1][2], int(datetime(2026, 9, 29, tzinfo=timezone.utc).timestamp()))
        for ip in (None, "unknown", "192.0.2.3, 192.0.2.4"):
            with self.assertRaises(app.PublicError):
                app.counter_reservations(config, ip, NOW)

    def test_reservation_transaction_combines_job_and_every_limit(self):
        config = app.Settings(enabled=True, ip_secret="a" * 64)
        reservations = app.counter_reservations(config, "192.0.2.3", NOW)
        writes = app.admission_transaction("demo", {"pk": "job#fixture"}, reservations)
        self.assertEqual(len(writes), 4)
        self.assertEqual(writes[0]["Put"]["ConditionExpression"], "attribute_not_exists(#pk)")
        for write, (key, limit, expiry) in zip(writes[1:], reservations):
            update = write["Update"]
            self.assertEqual(update["TableName"], "demo")
            self.assertEqual(update["Key"], {"pk": key})
            self.assertEqual(update["ConditionExpression"], "attribute_not_exists(#used) OR #used < :limit")
            self.assertEqual(update["ExpressionAttributeValues"][":limit"], limit)
            self.assertEqual(update["ExpressionAttributeValues"][":one"], 1)
            self.assertEqual(update["ExpressionAttributeValues"][":ttl"], expiry)


class ProviderTests(unittest.TestCase):
    def setUp(self):
        self.png = png_image()
        self.payload = {"seeds": [42], "finish_reasons": [None],
                        "images": [base64.b64encode(self.png).decode()]}

    def test_valid_single_png_with_integer_or_string_seed(self):
        self.assertEqual(app.parse_provider_image(self.payload, 42), (self.png, 1024, 1024))
        self.payload["seeds"] = ["42"]
        self.assertEqual(app.parse_provider_image(self.payload, 42)[1:], (1024, 1024))

    def test_moderation_hides_all_output(self):
        self.payload["finish_reasons"] = ["Filter reason: output image"]
        with self.assertRaises(app.PublicError) as raised:
            app.parse_provider_image(self.payload, 42)
        self.assertEqual(raised.exception.code, "CONTENT_FILTERED")

    def test_unknown_reason_missing_arrays_extra_images_and_seed_mismatch(self):
        for key, value in (("finish_reasons", []), ("finish_reasons", ["future reason"]),
                           ("finish_reasons", ["Inference error"]), ("seeds", [True]),
                           ("seeds", [43]), ("seeds", [42.0]), ("images", []),
                           ("images", [self.payload["images"][0]] * 2), ("images", ["!invalid!"])):
            payload = {**self.payload, key: value}
            with self.subTest(key=key, value=str(value)[:30]), self.assertRaises(app.PublicError):
                app.parse_provider_image(payload, 42)

    def test_corrupt_non_square_or_out_of_bounds_png_rejected(self):
        for image in (b"not PNG", self.png[:33], self.png[:-1] + b"a", self.png + b"extra",
                      png_image(640, 800), png_image(16, 16), png_image(1600, 1600)):
            payload = {**self.payload, "images": [base64.b64encode(image).decode()]}
            with self.assertRaises(app.PublicError):
                app.parse_provider_image(payload, 42)

    def test_noninterlaced_rgb_rgba_grayscale_and_palette_outputs_are_accepted(self):
        for color, depths in {0: (1, 2, 4, 8, 16), 2: (8, 16), 3: (1, 2, 4, 8),
                              4: (8, 16), 6: (8, 16)}.items():
            for depth in depths:
                with self.subTest(color=color, depth=depth):
                    self.assertEqual(app.validate_png_image(png_image(640, 640, color=color, depth=depth)), (640, 640))

    def test_illegal_header_fields_and_unsupported_interlacing_fail_closed(self):
        for options in ({"depth": 3}, {"color": 1}, {"color": 2, "depth": 4},
                        {"color": 3, "depth": 16}, {"compression": 1},
                        {"filtering": 1}, {"interlace": 1}, {"interlace": 2}):
            with self.subTest(options=options), self.assertRaises(app.PublicError):
                app.validate_png_image(png_image(**options))

    def test_crc_valid_but_invalid_deflate_or_scanlines_are_rejected(self):
        expected = 1025 * 1024
        for options in ({"compressed": b"not a zlib stream"}, {"raw": b"tiny"},
                        {"raw": b"\x00" * (expected - 1)}, {"raw": b"\x00" * (expected + 1)},
                        {"raw": b"\x05" + b"\x00" * (expected - 1)},
                        {"compressed": zlib.compress(b"\x00" * expected)[:-1]},
                        {"compressed": zlib.compress(b"\x00" * expected) + b"trailing"},
                        {"compressed": zlib.compress(b"\x00" * expected) + zlib.compress(b"extra")}):
            with self.subTest(options=list(options)), self.assertRaises(app.PublicError) as raised:
                app.validate_png_image(png_image(**options))
            self.assertEqual(raised.exception.code, "INVALID_MODEL_RESPONSE")

    def test_consecutive_idat_chunks_support_split_streams_and_all_scanline_filters(self):
        raw = b"".join(bytes([row % 5]) + b"\x00" * 640 for row in range(640))
        compressed = zlib.compress(raw)
        for split_at in (0, 1, 10, len(compressed) // 2, len(compressed) - 1, len(compressed)):
            with self.subTest(split_at=split_at):
                self.assertEqual(app.validate_png_image(png_image(640, 640, raw=raw, split_at=split_at)), (640, 640))
        # A nonzero filter in a later scanline must also be checked.
        invalid = bytearray(raw)
        invalid[641 * 313] = 5
        with self.assertRaises(app.PublicError):
            app.validate_png_image(png_image(640, 640, raw=bytes(invalid), split_at=len(compressed) // 2))

    def test_chunk_order_unknown_critical_types_and_palette_requirements_are_checked(self):
        prefix, data, end = self.png[:33], self.png[33:-12], self.png[-12:]
        palette = png_image(640, 640, color=3)
        invalid_images = (
            prefix + self.png[8:33] + data + end,  # duplicate IHDR
            prefix + png_chunk(b"NOPE", b"") + data + end,
            prefix + png_chunk(b"te1t", b"") + data + end,
            prefix + png_chunk(b"text", b"") + data + end,  # reserved type bit
            prefix + data + png_chunk(b"tEXt", b"note\x00test") + png_chunk(b"IDAT", b"") + end,
            prefix + png_chunk(b"PLTE", b"\x00\x00\x00") + data + end,  # grayscale palette
            palette[:33] + palette[48:],  # indexed image missing its palette
            prefix + data + png_chunk(b"tRNS", b"\x00\x00") + end,
            prefix + data + png_chunk(b"IEND", b"x"),
        )
        for index, image in enumerate(invalid_images):
            with self.subTest(index=index), self.assertRaises(app.PublicError):
                app.validate_png_image(image)

    def test_deflate_bomb_output_is_capped_before_allocating_expanded_image(self):
        expected = 641 * 640
        image = png_image(640, 640, raw=b"\x00" * (expected * 20))
        actual_factory = zlib.decompressobj
        bounds, expanded = [], []

        class RecordingInflater:
            def __init__(inner):
                inner.delegate = actual_factory()

            def decompress(inner, data, max_length=0):
                bounds.append(max_length)
                result = inner.delegate.decompress(data, max_length)
                expanded.append(len(result))
                return result

            def __getattr__(inner, name):
                return getattr(inner.delegate, name)

        with patch.object(app.zlib, "decompressobj", RecordingInflater), self.assertRaises(app.PublicError):
            app.validate_png_image(image)
        self.assertEqual(bounds, [expected + 1])
        self.assertEqual(expanded, [expected + 1])

    def test_excessive_chunks_fail_closed_before_unbounded_parser_work(self):
        prefix, data, end = self.png[:33], self.png[33:-12], self.png[-12:]
        image = prefix + png_chunk(b"tEXt", b"a\x00b") * app.MAX_PNG_CHUNKS + data + end
        with self.assertRaises(app.PublicError):
            app.validate_png_image(image)

    def test_bedrock_request_is_fixed_and_response_stream_closes(self):
        class Bedrock:
            def invoke_model(inner, **kwargs):
                inner.kwargs = kwargs
                inner.stream = io.BytesIO(json.dumps(self.payload).encode())
                return {"body": inner.stream}
        bedrock = Bedrock()
        images = app.AwsImages(bedrock, None, "bucket")
        self.assertEqual(images.generate(request())[1:], (1024, 1024))
        self.assertTrue(bedrock.stream.closed)
        self.assertEqual(bedrock.kwargs["modelId"], app.MODEL_ID)
        sent = json.loads(bedrock.kwargs["body"])
        self.assertEqual(set(sent), {"prompt", "seed", "aspect_ratio", "output_format"})
        self.assertEqual(sent["aspect_ratio"], "1:1")
        self.assertEqual(sent["output_format"], "png")

    def test_s3_objects_are_private_encrypted_and_signed_for_short_duration(self):
        class S3:
            def put_object(inner, **kwargs):
                inner.upload = kwargs
            def generate_presigned_url(inner, operation, **kwargs):
                inner.signing = (operation, kwargs)
                return "signed"
        s3 = S3()
        images = app.AwsImages(None, s3, "private")
        key = images.save("uuid", self.png)
        self.assertEqual(key, "generated/uuid.png")
        self.assertNotIn("ACL", s3.upload)
        self.assertEqual(s3.upload["ServerSideEncryption"], "AES256")
        self.assertEqual(s3.upload["ContentType"], "image/png")
        self.assertEqual(images.url(key, 300), "signed")
        self.assertEqual(s3.signing[1]["ExpiresIn"], 300)


if __name__ == "__main__":
    unittest.main()
