"""Small, bounded public image demo. Lambda supplies boto3; tests use only stdlib.

The transaction reserves an attempt before dispatch. Attempts are never refunded,
and a worker can claim each job only once, including after ambiguous failures.
This caps model attempts, not the total AWS bill or traffic to the HTTP API.
"""

import base64
import binascii
import calendar
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import ipaddress
import json
import logging
import os
import re
import time
import unicodedata
from urllib.parse import urlsplit
import uuid
import zlib


MODEL_ID = "stability.stable-image-core-v1:1"
MODEL_REGION = "us-west-2"
MAX_SEED = 4294967295
MAX_BODY_BYTES = 4096
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_PROVIDER_BYTES = 15 * 1024 * 1024
MAX_PNG_CHUNKS = 4096
JOB_SECONDS = 86400
QUEUE_SECONDS = 300
COMPLETION_SECONDS = 600
URL_SECONDS = 300
SETTINGS = {"aspectRatio": "1:1", "outputFormat": "png", "images": 1}
STATUSES = frozenset(("queued", "running", "succeeded", "failed"))
LOG = logging.getLogger(__name__)


class PublicError(Exception):
    """An intentional response containing only a public error code."""

    def __init__(self, code, status=400):
        self.code = code
        self.status = status
        super().__init__(code)


@dataclass(frozen=True)
class Settings:
    enabled: bool = False
    origin: str = "https://elliottbarnes.ca"
    monthly: int = 75
    daily: int = 5
    ip_daily: int = 3
    model: str = MODEL_ID
    ip_secret: str = ""

    def validate(self):
        parsed = urlsplit(self.origin)
        local = parsed.hostname in ("localhost", "127.0.0.1", "::1")
        if (not parsed.hostname or parsed.username or parsed.password
                or parsed.path or parsed.query or parsed.fragment
                or not (parsed.scheme == "https" or (local and parsed.scheme == "http"))):
            raise ValueError("Invalid allowed origin")
        if self.model != MODEL_ID:
            raise ValueError("Unsupported model")
        if any(type(value) is not int or not 1 <= value <= 10000
               for value in (self.monthly, self.daily, self.ip_daily)):
            raise ValueError("Invalid generation limits")
        if self.enabled and len(self.ip_secret) < 32:
            raise ValueError("IP_HASH_SECRET must contain at least 32 characters")
        return self

    @classmethod
    def from_env(cls):
        return cls(
            enabled=os.environ.get("GENERATION_ENABLED", "false") == "true",
            origin=os.environ.get("ALLOWED_ORIGIN", "https://elliottbarnes.ca"),
            monthly=int(os.environ.get("MONTHLY_IMAGES", "75")),
            daily=int(os.environ.get("DAILY_IMAGES", "5")),
            ip_daily=int(os.environ.get("IP_DAILY_IMAGES", "3")),
            model=os.environ.get("MODEL_ID", MODEL_ID),
            ip_secret=os.environ.get("IP_HASH_SECRET", ""),
        ).validate()


def canonical_uuid(value):
    if not isinstance(value, str):
        raise PublicError("INVALID_REQUEST_ID")
    try:
        parsed = uuid.UUID(value)
    except (ValueError, AttributeError):
        raise PublicError("INVALID_REQUEST_ID") from None
    if parsed.version != 4 or str(parsed) != value:
        raise PublicError("INVALID_REQUEST_ID")
    return value


def validate_request(value):
    if not isinstance(value, dict) or set(value) != {"prompt", "seed", "requestId"}:
        raise PublicError("INVALID_REQUEST")
    prompt = value["prompt"]
    if not isinstance(prompt, str):
        raise PublicError("INVALID_PROMPT")
    prompt = prompt.strip()
    if not 3 <= len(prompt) <= 1000 or any(
        unicodedata.category(char) in ("Cc", "Cs") and char not in "\n\t" for char in prompt
    ):
        raise PublicError("INVALID_PROMPT")
    seed = value["seed"]
    if type(seed) is not int or not 1 <= seed <= MAX_SEED:
        raise PublicError("INVALID_SEED")
    return {"prompt": prompt, "seed": seed, "requestId": canonical_uuid(value["requestId"])}


def reject_duplicates(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise PublicError("INVALID_JSON")
        result[key] = value
    return result


def decode_request(event, headers):
    if headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
        raise PublicError("JSON_REQUIRED", 415)
    body = event.get("body", "")
    if not isinstance(body, str) or len(body) > MAX_BODY_BYTES * 2:
        raise PublicError("REQUEST_TOO_LARGE", 413)
    try:
        raw = base64.b64decode(body, validate=True) if event.get("isBase64Encoded") else body.encode("utf-8")
        if len(raw) > MAX_BODY_BYTES:
            raise PublicError("REQUEST_TOO_LARGE", 413)
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=reject_duplicates,
                           parse_constant=lambda _: (_ for _ in ()).throw(PublicError("INVALID_JSON")))
    except (ValueError, UnicodeError, binascii.Error):
        raise PublicError("INVALID_JSON") from None
    return validate_request(value)


def request_fingerprint(request):
    payload = {"prompt": request["prompt"], "seed": request["seed"], "model": MODEL_ID, **SETTINGS}
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()


def counter_reservations(config, source_ip, now):
    try:
        normalized_ip = str(ipaddress.ip_address(source_ip))
    except (ValueError, TypeError):
        raise PublicError("SOURCE_IP_REQUIRED", 400) from None
    instant = datetime.fromtimestamp(now, timezone.utc)
    day = instant.strftime("%Y-%m-%d")
    month = instant.strftime("%Y-%m")
    daily_expiry = int((instant.replace(hour=0, minute=0, second=0, microsecond=0)
                        + timedelta(days=3)).timestamp())
    days_in_month = calendar.monthrange(instant.year, instant.month)[1]
    monthly_expiry = int((instant.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                          + timedelta(days=days_in_month + 2)).timestamp())
    ip_key = hmac.new(config.ip_secret.encode("utf-8"), f"{day}:{normalized_ip}".encode("utf-8"),
                      hashlib.sha256).hexdigest()
    return [
        (f"month#{month}", config.monthly, monthly_expiry),
        (f"day#{day}", config.daily, daily_expiry),
        (f"ip#{day}#{ip_key}", config.ip_daily, daily_expiry),
    ]


def admission_transaction(table_name, job, reservations):
    """Native Python values; the DynamoDB resource client marshals the transaction.

    TransactWriteItems requires expression strings for the nested transaction
    items. All names and values are placeholders; no request text enters syntax.
    """
    writes = [{"Put": {
        "TableName": table_name, "Item": job,
        "ConditionExpression": "attribute_not_exists(#pk)",
        "ExpressionAttributeNames": {"#pk": "pk"},
    }}]
    for key, limit, expiry in reservations:
        writes.append({"Update": {
            "TableName": table_name, "Key": {"pk": key},
            "UpdateExpression": "SET #used = if_not_exists(#used, :zero) + :one, #ttl = :ttl",
            "ConditionExpression": "attribute_not_exists(#used) OR #used < :limit",
            "ExpressionAttributeNames": {"#used": "used", "#ttl": "expiresAt"},
            "ExpressionAttributeValues": {":zero": 0, ":one": 1, ":limit": limit, ":ttl": expiry},
        }})
    return writes


class DynamoStore:
    def __init__(self, table):
        self.table = table
        self.client = table.meta.client

    def get(self, job_id):
        return self.table.get_item(Key={"pk": f"job#{job_id}"}, ConsistentRead=True).get("Item")

    def reserve(self, job, reservations):
        try:
            self.client.transact_write_items(
                TransactItems=admission_transaction(self.table.name, job, reservations))
            return True
        except self.client.exceptions.TransactionCanceledException as error:
            # Only a conditional failure is a budget/idempotency decision.
            # Capacity, transaction conflicts and unknown errors fail closed.
            reasons = error.response.get("CancellationReasons", [])
            codes = [reason.get("Code") for reason in reasons]
            if codes and all(code in ("None", "ConditionalCheckFailed") for code in codes):
                if "ConditionalCheckFailed" in codes:
                    return False
            raise

    def claim(self, job_id, now):
        from boto3.dynamodb.conditions import Attr
        try:
            return self.table.update_item(
                Key={"pk": f"job#{job_id}"},
                UpdateExpression="SET #state = :running, startedAt = :now",
                ExpressionAttributeNames={"#state": "status"},
                ExpressionAttributeValues={":running": "running", ":now": now},
                ConditionExpression=(Attr("status").eq("queued") & Attr("expiresAt").gt(now)
                                     & Attr("createdAt").gt(now - QUEUE_SECONDS)),
                ReturnValues="ALL_NEW",
            )["Attributes"]
        except self.client.exceptions.ConditionalCheckFailedException:
            return None

    def complete(self, job_id, status, now, **fields):
        from boto3.dynamodb.conditions import Attr
        names = {"#state": "status"}
        values = {":state": status, ":now": now}
        updates = ["#state = :state", "completedAt = :now"]
        for index, (key, value) in enumerate(fields.items()):
            names[f"#field{index}"] = key
            values[f":field{index}"] = value
            updates.append(f"#field{index} = :field{index}")
        try:
            self.table.update_item(
                Key={"pk": f"job#{job_id}"}, UpdateExpression="SET " + ", ".join(updates),
                ExpressionAttributeNames=names, ExpressionAttributeValues=values,
                ConditionExpression=Attr("status").eq("running"),
            )
        except self.client.exceptions.ConditionalCheckFailedException:
            return


def validate_png_image(image):
    """Validate bounded, noninterlaced PNG scanlines without decoding pixels.

    Support noninterlaced output and fail closed on Adam7 output rather than
    guessing its pass sizes. All standard PNG color/depth pairs are supported.
    Inflation is capped at the exact IHDR-derived byte count plus one sentinel;
    compressed data can never allocate an unbounded decompression result.
    """
    def invalid():
        raise PublicError("INVALID_MODEL_RESPONSE", 502)

    if len(image) > MAX_IMAGE_BYTES or len(image) < 33 or image[:8] != b"\x89PNG\r\n\x1a\n":
        invalid()
    if image[12:16] != b"IHDR" or image[8:12] != b"\x00\x00\x00\r":
        invalid()
    width, height = int.from_bytes(image[16:20], "big"), int.from_bytes(image[20:24], "big")
    depth, color, compression, filtering, interlace = image[24:29]
    color_depths = {0: (1, 2, 4, 8, 16), 2: (8, 16), 3: (1, 2, 4, 8), 4: (8, 16), 6: (8, 16)}
    if (width != height or not 640 <= width <= 1536
            or depth not in color_depths.get(color, ())
            or compression != 0 or filtering != 0 or interlace != 0):
        invalid()
    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[color]
    stride = (width * depth * channels + 7) // 8 + 1
    expected_bytes = stride * height
    view = memoryview(image)
    cursor, chunk_count, palette_entries = 8, 0, None
    seen_data, data_ended, seen_transparency, ended = False, False, False, False
    data_chunks = []
    while cursor + 12 <= len(image):
        chunk_count += 1
        if chunk_count > MAX_PNG_CHUNKS:
            invalid()
        size = int.from_bytes(image[cursor:cursor + 4], "big")
        end = cursor + size + 12
        if end > len(image):
            invalid()
        kind = image[cursor + 4:cursor + 8]
        if not re.fullmatch(rb"[A-Za-z]{4}", kind) or kind[2] & 0x20:
            invalid()
        checksum = zlib.crc32(view[cursor + 4:end - 4]) & 0xffffffff
        if checksum != int.from_bytes(image[end - 4:end], "big"):
            invalid()
        content = view[cursor + 8:end - 4]
        if kind == b"IHDR":
            if cursor != 8 or size != 13:
                invalid()
        elif kind == b"PLTE":
            if (seen_data or seen_transparency or palette_entries is not None
                    or color in (0, 4) or size == 0 or size % 3 or size > 768):
                invalid()
            palette_entries = size // 3
            if color == 3 and palette_entries > 2 ** depth:
                invalid()
        elif kind == b"tRNS":
            if seen_transparency or seen_data or color in (4, 6):
                invalid()
            if ((color == 0 and size != 2) or (color == 2 and size != 6)
                    or (color == 3 and (palette_entries is None or not 1 <= size <= palette_entries))):
                invalid()
            seen_transparency = True
        elif kind == b"IDAT":
            if data_ended or (color == 3 and palette_entries is None):
                invalid()
            seen_data = True
            data_chunks.append(content)
        elif kind == b"IEND":
            if size != 0 or end != len(image) or not seen_data:
                invalid()
            ended = True
            break
        elif not kind[0] & 0x20:
            # Unknown critical chunks change how pixels must be interpreted.
            invalid()
        if seen_data and kind != b"IDAT":
            data_ended = True
        cursor = end
    if not ended:
        invalid()

    inflater = zlib.decompressobj()
    produced = 0
    try:
        for content in data_chunks:
            decoded = inflater.decompress(content, expected_bytes - produced + 1)
            if len(decoded) > expected_bytes - produced or inflater.unconsumed_tail or inflater.unused_data:
                invalid()
            # Each scanline begins with one PNG filter method, even if that
            # byte is split across different IDAT chunks/inflate calls.
            if any(decoded[index] > 4 for index in range((-produced) % stride, len(decoded), stride)):
                invalid()
            produced += len(decoded)
    except zlib.error:
        invalid()
    if produced != expected_bytes or not inflater.eof:
        invalid()
    return width, height


def parse_provider_image(payload, expected_seed):
    """Fail closed on filtering, unknown finish reasons and malformed responses."""
    if not isinstance(payload, dict):
        raise PublicError("INVALID_MODEL_RESPONSE", 502)
    reasons = payload.get("finish_reasons")
    if isinstance(reasons, list) and any(isinstance(reason, str) and reason.startswith("Filter reason:")
                                         for reason in reasons):
        raise PublicError("CONTENT_FILTERED", 422)
    if reasons != [None]:
        raise PublicError("INVALID_MODEL_RESPONSE", 502)
    seeds, images = payload.get("seeds"), payload.get("images")
    if not isinstance(seeds, list) or len(seeds) != 1 or isinstance(seeds[0], bool):
        raise PublicError("INVALID_MODEL_RESPONSE", 502)
    # AWS documents seeds as strings and its examples return integers.
    if not (type(seeds[0]) is int or (isinstance(seeds[0], str) and re.fullmatch(r"[0-9]{1,10}", seeds[0]))):
        raise PublicError("INVALID_MODEL_RESPONSE", 502)
    if int(seeds[0]) != expected_seed:
        raise PublicError("INVALID_MODEL_RESPONSE", 502)
    if not isinstance(images, list) or len(images) != 1 or not isinstance(images[0], str):
        raise PublicError("INVALID_MODEL_RESPONSE", 502)
    if len(images[0]) > 4 * ((MAX_IMAGE_BYTES + 2) // 3):
        raise PublicError("INVALID_MODEL_RESPONSE", 502)
    try:
        image = base64.b64decode(images[0], validate=True)
    except (ValueError, binascii.Error):
        raise PublicError("INVALID_MODEL_RESPONSE", 502) from None
    width, height = validate_png_image(image)
    return image, width, height


class AwsImages:
    def __init__(self, bedrock, s3, bucket):
        self.bedrock, self.s3, self.bucket = bedrock, s3, bucket

    def generate(self, job):
        response = self.bedrock.invoke_model(
            modelId=MODEL_ID, contentType="application/json", accept="application/json",
            body=json.dumps({"prompt": job["prompt"], "seed": int(job["seed"]),
                             "aspect_ratio": "1:1", "output_format": "png"}),
        )
        body = response["body"]
        try:
            raw = body.read(MAX_PROVIDER_BYTES + 1)
        finally:
            body.close()
        if len(raw) > MAX_PROVIDER_BYTES:
            raise PublicError("INVALID_MODEL_RESPONSE", 502)
        try:
            payload = json.loads(raw)
        except (ValueError, UnicodeError):
            raise PublicError("INVALID_MODEL_RESPONSE", 502) from None
        return parse_provider_image(payload, int(job["seed"]))

    def save(self, job_id, image):
        key = f"generated/{job_id}.png"
        self.s3.put_object(Bucket=self.bucket, Key=key, Body=image, ContentType="image/png",
                           CacheControl="private, max-age=300", ServerSideEncryption="AES256")
        return key

    def url(self, key, seconds):
        return self.s3.generate_presigned_url(
            "get_object", Params={"Bucket": self.bucket, "Key": key}, ExpiresIn=seconds)


class Dispatcher:
    def __init__(self, client, function_name):
        self.client, self.function_name = client, function_name

    def send(self, job_id):
        response = self.client.invoke(FunctionName=self.function_name, InvocationType="Event",
                                      Payload=json.dumps({"jobId": job_id}).encode("utf-8"))
        if response.get("StatusCode") != 202:
            raise PublicError("DISPATCH_UNAVAILABLE", 503)


class Service:
    def __init__(self, config, store=None, dispatcher=None, images=None, clock=time.time):
        self.config = config.validate()
        self.store, self.dispatcher, self.images, self.clock = store, dispatcher, images, clock

    def submit(self, request, source_ip):
        if not self.config.enabled:
            raise PublicError("GENERATION_DISABLED", 503)
        now = int(self.clock())
        fingerprint = request_fingerprint(request)
        job_id = request["requestId"]
        existing = self.store.get(job_id)
        if existing:
            return self.duplicate(existing, fingerprint, now)
        reservations = counter_reservations(self.config, source_ip, now)
        job = {"pk": f"job#{job_id}", "jobId": job_id, "status": "queued",
               "prompt": request["prompt"], "seed": request["seed"], "model": self.config.model,
               "fingerprint": fingerprint, "createdAt": now, "expiresAt": now + JOB_SECONDS}
        if not self.store.reserve(job, reservations):
            existing = self.store.get(job_id)
            if existing:
                return self.duplicate(existing, fingerprint, now)
            raise PublicError("GENERATION_LIMIT_REACHED", 429)
        try:
            self.dispatcher.send(job_id)
        except Exception:
            # A connection failure can happen after Lambda accepted the event.
            # Never resend or mark it failed while that worker may still run.
            # A queued job that never starts becomes a public timed-out status.
            LOG.warning("generation_dispatch_uncertain")
        return {"jobId": job_id, "status": "queued"}

    @staticmethod
    def duplicate(job, fingerprint, now):
        if job.get("fingerprint") != fingerprint:
            raise PublicError("REQUEST_ID_CONFLICT", 409)
        if int(job.get("expiresAt", 0)) <= now:
            raise PublicError("REQUEST_EXPIRED", 409)
        if job.get("status") not in STATUSES:
            raise PublicError("SERVICE_UNAVAILABLE", 503)
        return {"jobId": job["jobId"], "status": job["status"]}

    def status(self, job_id):
        job = self.store.get(job_id)
        now = int(self.clock())
        if not job or int(job.get("expiresAt", 0)) <= now:
            raise PublicError("GENERATION_NOT_FOUND", 404)
        status = job.get("status")
        if status not in STATUSES:
            raise PublicError("SERVICE_UNAVAILABLE", 503)
        result = {"jobId": job_id, "status": status, "seed": int(job["seed"]),
                  "model": job["model"], "prompt": job["prompt"], "settings": dict(SETTINGS)}
        if status in ("queued", "running") and int(job["createdAt"]) + COMPLETION_SECONDS <= now:
            result.update(status="failed", error={"code": "GENERATION_TIMED_OUT"})
        elif status == "failed":
            code = job.get("errorCode")
            allowed = ("CONTENT_FILTERED", "GENERATION_FAILED", "INVALID_MODEL_RESPONSE", "GENERATION_DISABLED")
            result["error"] = {"code": code if code in allowed else "GENERATION_FAILED"}
        elif status == "succeeded":
            expected_key = f"generated/{job_id}.png"
            if job.get("imageKey") != expected_key:
                raise PublicError("SERVICE_UNAVAILABLE", 503)
            seconds = min(URL_SECONDS, int(job["expiresAt"]) - now)
            result.update(imageUrl=self.images.url(expected_key, seconds), urlExpiresIn=seconds)
            result["settings"].update(width=int(job["width"]), height=int(job["height"]))
        return result

    def work(self, job_id):
        now = int(self.clock())
        job = self.store.claim(job_id, now)
        if not job:
            return
        try:
            if not self.config.enabled:
                raise PublicError("GENERATION_DISABLED", 503)
            checked = validate_request({"prompt": job["prompt"], "seed": int(job["seed"]), "requestId": job_id})
            if job["model"] != MODEL_ID or request_fingerprint(checked) != job["fingerprint"]:
                raise PublicError("GENERATION_FAILED", 500)
            image, width, height = self.images.generate(job)
            key = self.images.save(job_id, image)
            self.store.complete(job_id, "succeeded", int(self.clock()), imageKey=key, width=width, height=height)
        except Exception as error:
            allowed = ("CONTENT_FILTERED", "INVALID_MODEL_RESPONSE", "GENERATION_DISABLED")
            code = error.code if isinstance(error, PublicError) and error.code in allowed else "GENERATION_FAILED"
            LOG.warning("generation_failed code=%s", code)
            self.store.complete(job_id, "failed", int(self.clock()), errorCode=code)


_SERVICES = {}


def aws_service(role):
    if role not in _SERVICES:
        import boto3
        from botocore.config import Config
        settings = Settings.from_env()
        # Retry free reads/writes safely, but never retry model generation or an
        # asynchronous dispatch with an uncertain acceptance outcome.
        regular = Config(retries={"total_max_attempts": 2, "mode": "standard"},
                         connect_timeout=3, read_timeout=5)
        once = Config(retries={"total_max_attempts": 1, "mode": "standard"},
                      connect_timeout=3, read_timeout=5)
        model_config = Config(retries={"total_max_attempts": 1, "mode": "standard"},
                              connect_timeout=3, read_timeout=90)
        table = boto3.resource("dynamodb", config=regular).Table(os.environ["TABLE_NAME"])
        s3 = boto3.client("s3", config=regular.merge(Config(signature_version="s3v4")))
        model = boto3.client("bedrock-runtime", region_name=MODEL_REGION, config=model_config) if role == "worker" else None
        dispatcher = (Dispatcher(boto3.client("lambda", config=once), os.environ["WORKER_FUNCTION_NAME"])
                      if role == "api" else None)
        _SERVICES[role] = Service(settings, DynamoStore(table), dispatcher,
                                  AwsImages(model, s3, os.environ["IMAGE_BUCKET"]))
    return _SERVICES[role]


def response(status, payload, origin=None):
    headers = {"content-type": "application/json", "cache-control": "no-store",
               "x-content-type-options": "nosniff", "vary": "Origin"}
    if origin:
        headers.update({"access-control-allow-origin": origin,
                        "access-control-allow-methods": "GET,POST,OPTIONS",
                        "access-control-allow-headers": "content-type"})
    return {"statusCode": status, "headers": headers, "body": json.dumps(payload)}


def api_handler(event, context, service=None):
    allowed_origin = None
    try:
        service = service or aws_service("api")
        headers = {key.lower(): value for key, value in event.get("headers", {}).items()}
        origin = headers.get("origin")
        if origin and origin != service.config.origin:
            raise PublicError("ORIGIN_NOT_ALLOWED", 403)
        allowed_origin = origin
        http = event.get("requestContext", {}).get("http", {})
        method, path = http.get("method"), event.get("rawPath")
        if method == "OPTIONS":
            return response(204, {}, allowed_origin)
        if method == "GET" and path == "/health":
            config = service.config
            return response(200, {"enabled": config.enabled, "model": config.model,
                                  "limits": {"monthly": config.monthly, "daily": config.daily,
                                             "perIpDaily": config.ip_daily, "promptMaxLength": 1000,
                                             "seedMin": 1, "seedMax": MAX_SEED},
                                  "settings": SETTINGS}, allowed_origin)
        if method == "POST" and path == "/generations":
            request = decode_request(event, headers)
            return response(202, service.submit(request, http.get("sourceIp")), allowed_origin)
        if method == "GET" and isinstance(path, str) and path.startswith("/generations/"):
            job_id = canonical_uuid(path.removeprefix("/generations/"))
            return response(200, service.status(job_id), allowed_origin)
        raise PublicError("NOT_FOUND", 404)
    except PublicError as error:
        return response(error.status, {"error": {"code": error.code}}, allowed_origin)
    except Exception:
        # Do not expose or log exception strings, prompts, events or source IPs.
        LOG.error("generation_api_unavailable")
        return response(503, {"error": {"code": "SERVICE_UNAVAILABLE"}}, allowed_origin)


def worker_handler(event, context, service=None):
    try:
        job_id = canonical_uuid(event.get("jobId"))
        (service or aws_service("worker")).work(job_id)
    except Exception:
        # The conditional running claim prevents any subsequent delivery from
        # invoking the model a second time, even if recording failure also fails.
        LOG.error("generation_worker_unavailable")
    return {"ok": True}
