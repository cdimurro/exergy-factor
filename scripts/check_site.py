#!/usr/bin/env python3
"""Fail when a static page has broken local links or missing launch metadata."""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
PAGES = sorted(ROOT.glob("*.html"))


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links = []
        self.has_description = False
        self.has_canonical = False
        self.has_title = False

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "a" and values.get("href"):
            self.links.append(values["href"])
        if tag in {"link", "script", "img"}:
            target = values.get("href") or values.get("src")
            if target:
                self.links.append(target)
        if (
            tag == "meta"
            and values.get("name") == "description"
            and values.get("content")
        ):
            self.has_description = True
        if tag == "link" and values.get("rel") == "canonical" and values.get("href"):
            self.has_canonical = True
        if tag == "title":
            self.has_title = True


def local_target(page: Path, href: str):
    parsed = urlsplit(href)
    if parsed.scheme or parsed.netloc or href.startswith(("#", "mailto:")):
        return None
    path = parsed.path
    if not path or path == "/":
        return ROOT / "index.html"
    return (ROOT / path.lstrip("/")) if path.startswith("/") else (page.parent / path)


def main() -> None:
    issues = []
    for page in PAGES:
        parser = PageParser()
        parser.feed(page.read_text(encoding="utf-8"))
        if page.name != "calculate.html":
            for present, label in (
                (parser.has_title, "title"),
                (parser.has_description, "meta description"),
                (parser.has_canonical, "canonical link"),
            ):
                if not present:
                    issues.append(f"{page.name}: missing {label}")
        for href in parser.links:
            target = local_target(page, href)
            if target is not None and not target.exists():
                issues.append(f"{page.name}: broken local link {href}")

    for required in ("robots.txt", "sitemap.xml", "favicon.svg"):
        if not (ROOT / required).exists():
            issues.append(f"missing {required}")

    if issues:
        raise SystemExit("\n".join(issues))
    print(f"checked {len(PAGES)} HTML pages and their local links")


if __name__ == "__main__":
    main()
