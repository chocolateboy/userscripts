#####################################################
# strict mode: https://tech.davis-hansson.com/p/make/

SHELL := bash
MAKEFLAGS += --warn-undefined-variables
MAKEFLAGS += --no-builtin-rules

.DELETE_ON_ERROR:
.ONESHELL:
.SHELLFLAGS := -eu -o pipefail -c

#####################################################

BIN     := ./node_modules/.bin
BUILD   := ./build
BANNER  := $(BUILD)/mk-banner.bash

ESBUILD := esbuild --bundle --charset=utf8 --format=iife --legal-comments=inline --log-level=warning --outdir=./dist
SOURCES := $(wildcard src/*.user.ts)
TARGETS := $(patsubst src/%.ts,dist/%.js,$(SOURCES))

.PHONY: build
build: $(TARGETS)

.PHONY: build-doc
build-doc: README.md
	$(BIN)/toc-md README.md

dist/%.js: src/%.ts $(BANNER)
	@banner=$$($(BANNER) $<)$$'\n'
	command="$(ESBUILD) --banner:js=\"\$$banner\" $<"
	echo $$command
	eval $$command

.PHONY: clean
clean:
	rm -rf ./dist

.PHONY: rebuild
rebuild: clean build

.PHONY: typecheck
typecheck:
	$(BIN)/tsc-files --noEmit --noImplicitAny --noUnusedLocals --noUnusedParameters --strict src/**/*.ts

# http://blog.melski.net/2010/11/30/makefile-hacks-print-the-value-of-any-variable/
print-%:
	@echo '$*=$($*)'
