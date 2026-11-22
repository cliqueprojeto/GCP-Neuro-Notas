#!/usr/bin/env bash
# Gera gcp-notas-bin-<versão>-1-x86_64.pkg.tar.zst a partir do .deb oficial,
# dentro de um contêiner archlinux:base-devel (usado pelo GitHub Actions).
set -euo pipefail
: "${VERSION:?defina VERSION}"
pacman -Syu --noconfirm --needed libarchive >/dev/null
useradd -m builder || true
WORK=/tmp/pkg
mkdir -p "$WORK"
cp "/work/dist/gcp-notas_${VERSION}_amd64.deb" "$WORK/"
sed "s/@VERSION@/${VERSION}/" /work/packaging/arch/PKGBUILD > "$WORK/PKGBUILD"
chown -R builder "$WORK"
cd "$WORK"
su builder -c "makepkg --nodeps --skipchecksums --noconfirm"
cp gcp-notas-bin-*.pkg.tar.zst /work/dist/
ls -la /work/dist
