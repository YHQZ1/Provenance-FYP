import argparse
import json
import os
import subprocess
import sys

REGISTRY = "ghcr.io"

SERVICES = {
    "backend": {
        "context": "apps/backend-service",
        "dockerfile": "Dockerfile",
        "image": "provenance-backend",
        "apps": ["backend", "worker"],
    },
    "web": {
        "context": "apps/web-app",
        "dockerfile": "Dockerfile.prod",
        "image": "provenance-web",
        "apps": ["frontend"],
    },
    "ocr": {
        "context": "apps/ocr-service",
        "dockerfile": "Dockerfile",
        "image": "provenance-ocr",
        "apps": ["ocr-service"],
    },
    "rag-classify": {
        "context": "apps/rag-classify",
        "dockerfile": "Dockerfile",
        "image": "provenance-rag-classify",
        "apps": ["rag-classify"],
    },
    "rag-regulatory": {
        "context": "apps/rag-regulatory",
        "dockerfile": "Dockerfile",
        "image": "provenance-rag-regulatory",
        "apps": ["rag-regulatory"],
    },
}

ARCHITECTURES = {"amd64": "ubuntu-latest", "arm64": "ubuntu-24.04-arm"}
TAG_LENGTH = 12


def owner():
    value = os.environ.get("IMAGE_OWNER") or os.environ.get("GITHUB_REPOSITORY_OWNER")
    if not value:
        sys.exit("IMAGE_OWNER or GITHUB_REPOSITORY_OWNER must be set")
    return value.lower()


def image_name(service):
    return f"{REGISTRY}/{owner()}/{SERVICES[service]['image']}"


def tag_of(service):
    tree = subprocess.run(
        ["git", "rev-parse", f"HEAD:{SERVICES[service]['context']}"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    return tree[:TAG_LENGTH]


def published(service):
    reference = f"{image_name(service)}:{tag_of(service)}"
    result = subprocess.run(
        ["docker", "buildx", "imagetools", "inspect", reference],
        capture_output=True,
        text=True,
    )
    return result.returncode == 0


def missing_services():
    return [service for service in SERVICES if not published(service)]


def write_output(name, value):
    line = f"{name}={value}\n"
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as handle:
            handle.write(line)
    print(line, end="")


def plan(_):
    missing = missing_services()
    matrix = [
        {
            "service": service,
            "arch": arch,
            "runner": runner,
            "context": SERVICES[service]["context"],
            "dockerfile": SERVICES[service]["dockerfile"],
            "image": image_name(service),
            "tag": tag_of(service),
        }
        for service in missing
        for arch, runner in ARCHITECTURES.items()
    ]
    write_output("matrix", json.dumps({"include": matrix}))
    write_output("missing", json.dumps(missing))
    write_output("any", "true" if missing else "false")


def manifest(args):
    for service in json.loads(args.services):
        image = image_name(service)
        tag = tag_of(service)
        sources = [f"{image}:{tag}-{arch}" for arch in ARCHITECTURES]
        subprocess.run(
            ["docker", "buildx", "imagetools", "create", "-t", f"{image}:{tag}", *sources],
            check=True,
        )


def values(args):
    lines = ["apps:"]
    for service, spec in SERVICES.items():
        reference = f"{image_name(service)}:{tag_of(service)}"
        for app in spec["apps"]:
            lines.append(f"  {app}:")
            lines.append(f"    image: {reference}")
    content = "\n".join(lines) + "\n"
    if args.output:
        with open(args.output, "w", encoding="utf-8") as handle:
            handle.write(content)
    else:
        print(content, end="")


def main():
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("plan").set_defaults(run=plan)
    manifest_parser = commands.add_parser("manifest")
    manifest_parser.add_argument("--services", required=True)
    manifest_parser.set_defaults(run=manifest)
    values_parser = commands.add_parser("values")
    values_parser.add_argument("--output")
    values_parser.set_defaults(run=values)
    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()
