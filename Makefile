# Makefile for packaging the GeoFS G-Force Indicator Chrome extension.

# Pull name + version straight from manifest.json so the zip name stays in sync.
NAME    := $(shell sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' manifest.json | tr ' ' '-')
VERSION := $(shell sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' manifest.json)
ZIP     := $(NAME)-$(VERSION).zip

# Files that ship inside the extension package.
FILES := manifest.json content.js injected_ui.js Popup.html README.md \
         icon.png bmc-icon.svg

.PHONY: zip clean

# Build the distributable zip.
zip: $(ZIP)

$(ZIP): $(FILES)
	rm -f $(ZIP)
	zip -r $(ZIP) $(FILES)
	@echo "Packaged $(ZIP)"

# Remove generated zip files.
clean:
	rm -f *.zip
