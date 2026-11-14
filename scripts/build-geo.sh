#!/usr/bin/env bash
# Regenerates public/geo/ from Natural Earth (public domain, naturalearthdata.com):
# countries at 1:50m -> public/geo/countries.json, states/provinces at 1:10m -> public/geo/admin1/<ADM0_A3>.json.
# Run from anywhere: bash scripts/build-geo.sh
set -euo pipefail
cd "$(dirname "$0")/.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
base=https://naciscdn.org/naturalearth
curl -fsSL "$base/50m/cultural/ne_50m_admin_0_countries.zip" -o "$tmp/countries.zip"
curl -fsSL "$base/10m/cultural/ne_10m_admin_1_states_provinces.zip" -o "$tmp/admin1.zip"
unzip -qo "$tmp/countries.zip" -d "$tmp/countries"
unzip -qo "$tmp/admin1.zip" -d "$tmp/admin1"

# gj2008: clockwise outer rings, the d3-geo convention three-globe uses (RFC 7946 rings render as "whole planet minus the area").
# --ignore-scripts: mapshaper's optional native deps (better-sqlite3) aren't needed for shapefile -> GeoJSON.
mapshaper() { npm exec --yes --ignore-scripts --package=mapshaper@0.7.101 -- mapshaper "$@"; }

rm -rf public/geo
mkdir -p public/geo/admin1
# Simplification is tuned for size: countries.json ~240 KB, largest admin-1 file (RUS) ~165 KB.
mapshaper -i "$tmp/countries/ne_50m_admin_0_countries.shp" \
  -filter-fields ADM0_A3,NAME,LABEL_X,LABEL_Y \
  -simplify 12% keep-shapes \
  -o public/geo/countries.json format=geojson gj2008 precision=0.01
mapshaper -i "$tmp/admin1/ne_10m_admin_1_states_provinces.shp" \
  -filter "Boolean(name)" \
  -filter-fields adm0_a3,name,latitude,longitude \
  -simplify 8% keep-shapes \
  -split adm0_a3 \
  -o public/geo/admin1/ format=geojson gj2008 precision=0.01
