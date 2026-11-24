"""Read a public listing as static HTML and extract editable JobPosting fields."""
import ipaddress
import json
import re
import socket
import time
from urllib.parse import urljoin, urlsplit, urlunsplit

import certifi
import urllib3
from bs4 import BeautifulSoup

MAX_BYTES = 2_000_000


def listing_url(value):
    parts = urlsplit(value.strip())
    if (parts.scheme.lower() != "https" or not parts.hostname or parts.username is not None
            or parts.password is not None or parts.port not in (None, 443)
            or any(c.isspace() or c == "\\" for c in value)):
        raise ValueError("Enter a public HTTPS listing URL.")
    host = parts.hostname.encode("idna").decode().lower()
    if host.endswith(".localhost") or host == "localhost" or "." not in host or not re.fullmatch(r"[a-z0-9.-]+", host):
        raise ValueError("Enter a public employer hostname.")
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        if not ip.is_global:
            raise ValueError("Enter a public employer hostname.")
    return urlunsplit(("https", host, parts.path or "/", parts.query, ""))


def read_page(url):
    end = time.monotonic() + 12
    for _ in range(4):
        parts = urlsplit(listing_url(url))
        addresses = {item[4][0] for item in socket.getaddrinfo(parts.hostname, 443, type=socket.SOCK_STREAM)}
        if not addresses or any(not ipaddress.ip_address(a).is_global or ipaddress.ip_address(a).is_multicast for a in addresses):
            raise ValueError("Public listings only")
        # Connect to the validated address and authenticate the original hostname with TLS.
        pool = urllib3.HTTPSConnectionPool(sorted(addresses)[0], port=443, server_hostname=parts.hostname,
                                           assert_hostname=parts.hostname, cert_reqs="CERT_REQUIRED", ca_certs=certifi.where())
        response = None
        try:
            response = pool.urlopen("GET", urlunsplit(("", "", parts.path, parts.query, "")),
                                    headers={"Host": parts.hostname, "Accept": "text/html", "Accept-Encoding": "identity"},
                                    timeout=urllib3.Timeout(connect=3, read=4), redirect=False, retries=False, preload_content=False)
            if response.status in (301, 302, 303, 307, 308) and response.headers.get("Location"):
                url = urljoin(url, response.headers["Location"])
                continue
            if response.status != 200 or "html" not in response.headers.get("Content-Type", "").lower():
                raise ValueError("Listing unavailable")
            body = bytearray()
            for chunk in response.stream(65536, decode_content=False):
                body.extend(chunk)
                if len(body) > MAX_BYTES or time.monotonic() > end:
                    raise ValueError("Listing exceeds import limits")
            return bytes(body)
        finally:
            if response is not None:
                response.close()
            pool.close()
    raise ValueError("Too many redirects")


def posting(node):
    if isinstance(node, list):
        return next((found for item in node if (found := posting(item))), None)
    if isinstance(node, dict):
        types = node.get("@type", [])
        if "JobPosting" in (types if isinstance(types, list) else [types]):
            return node
        return posting(node.get("@graph"))
    return None


def plain(value):
    return BeautifulSoup(value, "html.parser").get_text(" ", strip=True) if isinstance(value, str) else ""


def extract(source, pasted=False):
    data = {}
    heading = ""
    title_company = ""
    if pasted:
        text = source
    else:
        soup = BeautifulSoup(source, "html.parser")
        for tag in soup.find_all("script", type="application/ld+json"):
            try:
                data = posting(json.loads(tag.get_text())) or {}
            except (ValueError, RecursionError):
                continue
            if data:
                break
        if soup.title:
            branded = re.fullmatch(r"Job Application for .+ at (.+)", soup.title.get_text(" ", strip=True), re.I)
            if branded:
                title_company = branded[1]
        heading = (soup.h1 or soup.title)
        heading = heading.get_text(" ", strip=True) if heading else ""
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        text = (soup.main or soup).get_text("\n", strip=True)
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    def labelled(pattern):
        for line in lines:
            match = re.match(rf"(?:{pattern})\s*:\s*(.+)", line, re.I)
            if match:
                return match[1].strip()
        return ""

    org = data.get("hiringOrganization")
    company = org.get("name") if isinstance(org, dict) else ""
    description = plain(data.get("description")) or text.strip()
    instructions = plain(data.get("applicationInstructions")) or labelled("how to apply|application instructions|instructions")
    if not instructions:
        for i, line in enumerate(lines + [description]):
            if line.lower().rstrip(":") in ("how to apply", "application instructions") and i + 1 < len(lines):
                instructions = lines[i + 1]
                break
            match = re.search(r"(?:^|(?<=[.!?])\s+)((?:to apply|apply (?:by|via|at)|email (?:your|a)|send (?:your|a) (?:cv|résumé|resume|application))\b[^\n]{1,1000})", line, re.I)
            if match:
                instructions = match[1]
                break
    deadline = str(data.get("validThrough") or labelled("deadline|application deadline|closing date|apply by"))
    if not deadline:
        match = re.search(r"(?:applications? (?:close|due)|applications? deadline|apply by)\s+(?:on\s+)?([^\n.;]{1,64})", text, re.I)
        deadline = match[1].strip() if match else ""
    return {"company": str(company or labelled("company|employer") or title_company)[:200],
            "role": str(data.get("title") or labelled("role|job title|position|title") or heading)[:300],
            "deadline": deadline[:100], "instructions": instructions[:4000], "description": description[:20000]}


def application_email(instructions):
    # Only offer an email route when the directions explicitly mention applying by email.
    if re.search(r"\b(?:do not|don't|no applications|questions only|inquiries only)\b", instructions, re.I):
        return None
    address = r"([A-Z0-9_%+.-]+@[A-Z0-9.-]+\.[A-Z]{2,})"
    action = r"(?:email|send|submit)\s+(?:(?:your|a|the)\s+)?(?:application|résumé|resume|CV|cover letter)"
    prefix = rf"(?:{action}[^.!?;\n]{{0,80}}?\s+(?:to|at)|apply\s+(?:via|by)\s+email(?:\s+(?:to|at))?|to apply[, :]*(?:email|contact))"
    match = re.search(prefix + r"[:\s]+" + address, instructions, re.I)
    return match[1] if match else None


def same_listing(left, right):
    # Query parameters can identify the job (e.g. gh_jid). Ignore only known tracking parameters.
    from urllib.parse import parse_qsl
    def identity(value):
        parts = urlsplit(value)
        query = sorted((k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
                       if k != "gh_src" and not k.startswith("utm_"))
        return parts.scheme, parts.netloc.lower(), parts.path.rstrip("/"), query
    return identity(left) == identity(right)
