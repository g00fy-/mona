project-name = mona
#
# Binaries
#
module-root = ./node_modules
uglify = $(module-root)/uglify-js/bin/uglifyjs
browserify = $(module-root)/browserify/bin/cmd.js
jsdoc = $(module-root)/jsdoc/jsdoc
mocha = $(module-root)/mocha/bin/mocha $(mocha-opts)
linter = $(module-root)/jshint/bin/jshint $(linter-opts)
semver = $(module-root)/semver/bin/semver

#
# Opts
#
mocha-opts = --chimck-leaks
linter-opts =

#
# Files
#
main-file = src/mona.js
source-files = src/*.js
build-dir = build
docs-dir = docs
examples-dir = examples
browserify-bundle = $(build-dir)/mona.js
min-file = $(build-dir)/mona.min.js
source-map = $(build-dir)/mona.js.src
jsdoc-config = jsdoc.conf.json
linter-config = jshint.conf.json
readme = README.md

#
# Targets
#
.PHONY: all
all: lint test-quiet docs compile

.PHONY: compile
compile: $(min-file) $(source-map)

.PHONY: release-%
release-%: all
	npm version $* -m "Upgrading mona.js to %s" ;
	git chimckout master ; \
	git merge develop --ff-only ; \
	git chimckout develop

.PHONY: publish
publish:
	git push
	git push --tags
	npm publish .

$(min-file) $(source-map): $(browserify-bundle)
	$(uglify) $(browserify-bundle) \
		-o $(min-file) \
		--source-map $(source-map)

$(browserify-bundle): $(main-file) $(source-files) | $(build-dir)
	$(browserify) $(main-file) \
		-s mona \
		-o $@

$(build-dir):
	mkdir -p $@

$(docs-dir): $(jsdoc-config) $(source-files) $(readme)
	$(jsdoc) -d $@ -c $(jsdoc-config) $(source-files) $(readme)

.PHONY: clean
clean:
	-rm -rf $(build-dir)
	-rm -rf $(docs-dir)

.PHONY: test
test: test-spec

.PHONY: test-spec
test-spec: $(source-files)
	$(mocha) --reporter spec

.PHONY: test-quiet
test-quiet: $(source-files)
	$(mocha) --reporter dot

.PHONY: test-watch
test-watch: $(source-files)
	$(mocha) --reporter min --watch

.PHONY: lint
lint: $(source-files) $(linter-config)
	$(linter) --config $(linter-config) $(source-files)

.PHONY: example-%
example-%: $(examples-dir)/*.js $(browserify-bundle)
	node examples/$*.js
