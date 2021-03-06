/* global describe, it */
"use strict";

var assert = require("assert"),
    mona = require("./mona"),
    parse = mona.parse;

describe("mona", function() {
  describe("parse()", function() {
    it("executes a parser on some input and returns the result", function() {
      var result = {};
      assert.equal(parse(mona.value(result), ""), result);
    });
    it("returns an error object on fail if throwOnError is falsy", function() {
      var result = parse(mona.fail("nop"), "", {throwOnError: false});
      assert.equal(result.messages.length, 1);
      assert.equal(result.messages[0], "nop");
    });
    it("returns ParserState on success if throwOnError is falsy", function() {
      var result = parse(mona.token(), "a", {throwOnError: false});
      assert.equal(result.value, "a");
    });
    it("throws a ParserError if throwOnError is truthy", function() {
      assert.throws(function() {
        parse(mona.fail("nop"), "", {throwOnError: true});
      }, /nop/);
    });
    it("defaults to throwing a ParserError if it fails", function() {
      assert.throws(function() {
        parse(mona.fail("nop"), "");
      });
    });
    it("reports a nice error if parser argument isn't a function", function() {
      assert.throws(function() {
        parse(undefined, "parsemeplease");
      }, /Parser needs to be a function, but got undefined instead/);
    });
  });
  describe("parseAsync()", function() {
    it("executes a callback on asynchronous results", function(done) {
      var step = 0;
      var handle = mona.parseAsync(mona.token(), function(err, token) {
        step++;
        assert.equal(token, "a");
        if (step === 2) {
          done();
        }
      });
      handle.data("aa");
      handle.done();
    });
    it("stops if a non-eof error happens", function(done) {
      var step = 0;
      var handle = mona.parseAsync(mona.string("foo"), function(err, data) {
        step++;
        if (step < 4) {
          assert.equal(err, null);
          assert.equal(data, "foo");
        } else {
          if (step > 4) {
            throw new Error("It was never supposed to be like this!");
          }
          assert.equal(err.message,
                       "(line 1, column 10) expected string matching {foo}");
          done();
        }
      });
      handle.data("fo");
      handle.data("ofoo");
      handle.data("foox");
    });
    it("throws an error if anything is done to a closed handle", function() {
      var handle = mona.parseAsync(mona.token(), function() {});
      handle.done();
      assert.throws(handle.done);
      assert.throws(handle.data);
      assert.throws(handle.error);
    });
    it("calls function with an error and closes on .error()", function(done) {
      var testErr = new Error("test");
      var handle = mona.parseAsync(mona.token(), function(err) {
        assert.equal(err, testErr);
        done();
      });
      handle.error(testErr);
    });
    it("includes correct source position info in errors", function(done) {
      var parser = mona.string("foo\n");
      var handle = mona.parseAsync(parser, function(err) {
        if (err) {
          assert.equal(err.message,
                       "(line 5, column 1) expected string matching {foo\n}");
          done();
        }
      });
      handle.data("fo");
      handle.data("o\nfoo");
      handle.data("\nf");
      handle.data("oo\nfoo\nbbbb");
      handle.done();
    });
    describe("#data()", function() {
      it("returns the handle", function() {
        var handle = mona.parseAsync(mona.token(), function(){});
        assert.equal(handle.data("foo"), handle);
      });
    });
    describe("#done()", function() {
      it("returns the handle", function() {
        var handle = mona.parseAsync(mona.token(), function(){});
        assert.equal(handle.done(), handle);
      });
    });
    describe("#error()", function() {
      it("returns the handle", function() {
        var handle = mona.parseAsync(mona.token(), function(){});
        assert.equal(handle.error(new Error("bye")), handle);
      });
    });
  });
  describe("ParserError", function() {
    it("reports the line in which an error happened", function() {
      assert.throws(function() {
        parse(mona.token(), "");
      }, /line 1/);
      assert.throws(function() {
        parse(mona.and(mona.token(), mona.token()), "\n");
      }, /line 2/);
    });
    it("reports the column in which an error happened", function() {
      assert.throws(function() {
        parse(mona.fail(), "");
      }, /(line 1, column 0)/);
      assert.throws(function() {
        parse(mona.and(mona.token(),
                       mona.token(),
                       mona.fail()),
              "aaa");
      }, /(line 1, column 2)/);
      var parser = mona.and(mona.token(), mona.token(), mona.token(),
                            mona.token(), mona.fail());
      assert.throws(function() {
        parse(parser, "\na\nbcde");
      }, /(line 3, column 1)/);
    });
  });
  describe("base parsers", function() {
    describe("value()", function() {
      it("parses to the given value", function() {
        assert.equal(parse(mona.value("foo"), ""), "foo");
      });
      it("does not consume input", function() {
        assert.equal(parse(mona.followedBy(mona.value("foo"), mona.token()),
                           "a"),
                     "foo");
      });
    });
    describe("bind()", function() {
      it("calls a function with the result of a parser", function() {
        parse(mona.bind(mona.value("test"), function(val) {
          assert.equal(val, "test");
          return mona.value(val);
        }), "");
      });
      it("uses a parser returned by its fun as the next parser", function() {
        assert.equal(parse(mona.bind(mona.value("foo"), function(val) {
          return mona.value(val + "bar");
        }), ""), "foobar");
      });
      it("does not call the function if the parser fails", function() {
        assert.throws(function() {
          parse(mona.bind(mona.fail(), function() {
            throw new Error("This can't be happening...");
          }), "");
        }, /parser error/);
      });
      it("throws an error if a parser returns the wrong thing", function() {
        assert.throws(function() {
          parse(mona.bind(function() { return "nope"; }), "");
        }, /Parsers must return a parser state object/);
      });
    });
    describe("fail()", function() {
      it("fails the parse with the given message", function() {
        assert.throws(function() {
          parse(mona.fail("hi"), "abc");
        }, /hi/);
      });
      it("uses 'parser error' as the message if none is given", function() {
        assert.throws(function() {
          parse(mona.fail(), "");
        }, /parser error/);
      });
      it("accepts a type argument used by the ParserError object", function() {
        assert.throws(function() {
          parse(mona.fail("hi", "criticalExplosion"), "abc");
        }, function(err) {
          return err.type === "criticalExplosion";
        });
      });
      it("uses 'failure' as the default error type", function() {
        assert.throws(function() {
          parse(mona.fail(), "");
        }, function(err) {
          return err.type === "failure";
        });
      });
    });
    describe("label()", function() {
      it("replaces any error messages with an expectation", function() {
        assert.throws(function() {
          parse(mona.label(mona.fail(), "wee"), "");
        }, /\(line 1, column 0\) expected wee/);
      });
    });
    describe("token()", function() {
      it("consumes one character from the input and returns it", function() {
        assert.equal(parse(mona.token(), "a"), "a");
        assert.equal(parse(mona.and(mona.token(), mona.token()), "ab"), "b");
      });
      it("optionally accepts a count of items to consume", function() {
        assert.equal(parse(mona.token(5), "abcde"), "abcde");
      });
      it("fails if there is no more input", function() {
        assert.throws(function() {
          parse(mona.token(), "");
        }, /(line 1, column 1)/);
        assert.throws(function() {
          parse(mona.and(mona.token(), mona.token()), "a");
        }, /(line 1, column 2)/);
        assert.throws(function() {
          parse(mona.and(mona.token(5)), "abcd");
        }, /(line 1, column 5)/);
      });
      it("reports the error as 'unexpected eof' if it fails", function() {
        assert.throws(function() {
          parse(mona.token(), "");
        }, /unexpected eof/);
      });
      it("reports the error type as 'eof'", function() {
        assert.throws(function() {
          parse(mona.token(), "");
        }, function(err) {
          return err.type === "eof";
        });
      });
    });
    describe("eof()", function() {
      it("succeeds with true if we're out of input", function() {
        assert.equal(parse(mona.eof(), ""), true);
      });
      it("fails with useful message if there is still input left", function() {
        assert.throws(function() {
          parse(mona.eof(), "a");
        }, /expected end of input/);
      });
    });
    describe("delay()", function() {
      it("delays calling a parser constructor until parse-time", function() {
        var parser = mona.delay(function() {
          throw new Error("Parser explosion");
        });
        assert.throws(function() { parse(parser, ""); });
      });
      it("returns a parser with the arguments applied", function() {
        var parser = mona.delay(mona.value, "foo");
        assert.equal(parse(parser, ""), "foo");
      });
    });
    describe("map()", function() {
      it("transforms a parser's result", function() {
        assert.equal(parse(mona.map(function(txt) {
          return txt.toUpperCase();
        }, mona.text()), "abc"), "ABC");
      });
      it("does not call function if the parser fails", function() {
        var parser = mona.map(function(x) {throw x;}, mona.token());
        assert.throws(function() {
          parse(parser, "");
        }, /unexpected eof/);
      });
    });
    describe("wrap()", function() {
      it("wraps a parser's output with a tagging object", function() {
        assert.deepEqual(parse(mona.tag(mona.text(), "txt"), "foo"),
                         {txt: "foo"});
      });
    });
    describe("lookAhead()", function() {
      it("returns a parser's value without consuming input", function() {
        assert.equal(parse(mona.followedBy(mona.lookAhead(mona.token()),
                                           mona.token()),
                           "a"),
                     "a");
      });
    });
    describe("is()", function() {
      it("parses a token matching a predicate", function() {
        var parser = mona.is(function(t) {
          return t === "\n";
        });
        assert.equal(parse(parser, "\n"), "\n");
        assert.throws(function() {
          parse(parser, "\r");
        });
      });
      it("runs the predicate on the result of an arbitrary parser", function() {
        var parser = mona.is(function(x) {
          return x === "foo";
        }, mona.text());
        assert.equal(parse(parser, "foo"), "foo");
        assert.throws(function() {
          parse(parser, "bar");
        });
      });
    });
    describe("isNot()", function() {
      it("parses a token matching a predicate", function() {
        var parser = mona.isNot(function(t) {
          return t !== "\n";
        });
        assert.equal(parse(parser, "\n"), "\n");
        assert.throws(function() {
          parse(parser, "\r");
        });
      });
      it("run the predicate on the result of an arbitrary paresr", function() {
        var parser = mona.isNot(function(x) {
          return x === "foo";
        }, mona.text());
        assert.equal(parse(parser, "bar"), "bar");
        assert.throws(function() {
          parse(parser, "foo");
        });
      });
    });
  });
  describe("combinators", function() {
    describe("and()", function() {
      it("returns the last result if all previous ones succeed",  function() {
        assert.equal(parse(mona.and(mona.token(), mona.token()), "ab"), "b");
        assert.equal(parse(mona.and(mona.token()), "a"), "a");
        assert.throws(function() {
          parse(mona.and(), "ab");
        }, /requires at least one parser/);
      });
    });
    describe("or()", function() {
      it("returns the result of the first parser that succeeds", function() {
        assert.equal(parse(mona.or(mona.value("foo"), mona.value("bar")), ""),
                     "foo");
        assert.equal(parse(mona.or(mona.fail("nope"), mona.value("yup")), ""),
                     "yup");
      });
      it("reports all the accumulated errors", function() {
        var parser = mona.or(mona.fail("foo"),
                             mona.fail("bar"),
                             mona.fail("baz"),
                             mona.fail("quux"));
        assert.throws(function() {
          parse(parser, "");
        }, /\(line 1, column 0\) foo\nbar\nbaz\nquux/);
      });
      it("accumulates labeled errors without clobbering", function() {
        var parser = mona.or(mona.label(mona.fail(), "foo"),
                             mona.label(mona.fail(), "bar"),
                             mona.label(mona.fail(), "baz"));
        assert.throws(function() {
          parse(parser, "");
        }, /\(line 1, column 0\) expected foo\nexpected bar\nexpected baz/);
      });
      it("accumulates errors with the greatest identical position", function() {
        var parser = mona.or(mona.fail("foo"),
                             mona.string("ad"),
                             mona.string("abc"),
                             mona.string("abcd"));
        assert.throws(function() {
          parse(parser, "abd");
        }, /column 3\) [^\{]+{abc}\n[^\{]+{abcd}/);
      });
      it("labels the parser if the last argument is a string", function() {
        var parser = mona.or(mona.fail("foo"),
                             mona.fail("bar"),
                             mona.fail("baz"),
                             mona.fail("quux"),
                             "one of many things");
        assert.throws(function() {
          parse(parser, "");
        }, /\(line 1, column 0\) expected one of many things/);
      });
    });
    describe("maybe()", function() {
      it("returns the result of the parser, if it succeeds", function() {
        assert.equal(parse(mona.maybe(mona.value("foo")), ""), "foo");
      });
      it("returns undefined without consuming if the parser fails", function() {
        assert.equal(parse(mona.maybe(mona.fail("nope")), ""), undefined);
        assert.equal(parse(mona.and(mona.maybe(mona.fail("nope")),
                                    mona.token()),
                           "a"),
                     "a");
      });
    });
    describe("not()", function() {
      it("returns true if the given parser fails", function() {
        assert.equal(parse(mona.not(mona.token()), ""), true);
      });
      it("fails if the given parser succeeds", function() {
        assert.throws(function() {
          parse(mona.not(mona.value("foo")), "");
        }, /expected parser to fail/);
      });
    });
    describe("unless()", function() {
      it("returns the last result if the first parser fails", function() {
        assert.equal(parse(mona.unless(mona.fail("fail"),
                                       mona.value("success")),
                           ""),
                     "success");
        assert.throws(function() {
          parse(mona.unless(mona.value("success"), mona.value("fail")), "");
        }, /expected parser to fail/);
      });
    });
    describe("sequence()", function() {
      it("simulates do notation", function() {
        var parser = mona.sequence(function(s) {
          var x = s(mona.token());
          assert.equal(x, "a");
          var y = s(mona.token());
          assert.equal(y, "b");
          return mona.value(y+x);
        });
        assert.equal(parse(parser, "ab"), "ba");
      });
      it("errors with the correct message if a parser fails", function() {
        assert.throws(function() {
          var parser = mona.sequence(function(s) {
            var x = s(mona.token());
            assert.equal(x, "a");
            return mona.token();
          });
          parse(parser, "a");
        }, /\(line 1, column 2\) unexpected eof/);
        assert.throws(function() {
          var parser = mona.sequence(function(s) {
            s(mona.token());
            s(mona.token());
            s(mona.token());
            return mona.eof();
          });
          parse(parser, "aa");
        }, /\(line 1, column 3\) unexpected eof/);
      });
      it("throws an error if callback fails to return a parser", function() {
        assert.throws(function() {
          parse(mona.sequence(function() { return "nope"; }), "");
        }, /must return a parser/);
        assert.throws(function() {
          parse(mona.sequence(function() { return function() {}; }), "");
        }, /must return a parser/);
      });
    });
    describe("followedBy()", function() {
      it("returns the first result if the others also succeed", function() {
        var parserSuccess = mona.followedBy(mona.value("pass"),
                                            mona.value("yay"));
        assert.equal(parse(parserSuccess, ""), "pass");
        var parserFail = mona.followedBy(mona.value("pass"),
                                         mona.fail("nope"));
        assert.equal(parse(mona.or(parserFail, mona.value("fail")), ""),
                     "fail");
      });
    });
    describe("split()", function() {
      it("returns an array of values separated by a separator", function() {
        assert.deepEqual(
          parse(mona.split(mona.token(), mona.string(".")), "a.b.c.d"),
          ["a", "b", "c", "d"]);
      });
      it("returns an empty array if it fails", function() {
        assert.deepEqual(parse(mona.split(mona.string("a"), mona.string(".")),
                               ""),
                         []);
      });
      it("accepts a min count", function() {
        var parser = mona.split(mona.token(), mona.string("."), {min: 3});
        assert.deepEqual(parse(parser, "a.b.c"), ["a", "b", "c"]);
        assert.throws(function() {
          parse(parser, "a.b");
        }, /\(line 1, column 4\) expected string matching {.}/);
      });
      it("accepts a max count", function() {
        var parser = mona.split(mona.token(), mona.string("."), {max: 3});
        assert.deepEqual(parse(mona.and(parser, mona.string(".d")), "a.b.c.d"),
                         ".d");
      });
    });
    describe("splitEnd()", function() {
      it("collects matches separated and ended by a parser", function() {
        assert.deepEqual(
          parse(mona.splitEnd(mona.token(), mona.string(".")), "a.b.c.d."),
          ["a", "b", "c", "d"]);
        assert.throws(function() {
          parse(mona.splitEnd(mona.token(), mona.string(".")), "a.b.c.d");
        }, /expected end of input/);
      });
      it("accepts a flag to make the ender optional", function() {
        assert.deepEqual(
          parse(mona.splitEnd(mona.token(), mona.string("."),
                              {enforceEnd: false}),
                "a.b.c.d"),
          ["a", "b", "c", "d"]);
        assert.deepEqual(
          parse(mona.splitEnd(mona.token(), mona.string("."),
                              {enforceEnd: false}),
                "a.b.c.d."),
          ["a", "b", "c", "d"]);
      });
      it("accepts a min count", function() {
        var parser = mona.splitEnd(mona.token(), mona.string("."), {min: 3});
        assert.deepEqual(parse(parser, "a.b.c."), ["a", "b", "c"]);
        assert.throws(function() {
          parse(parser, "a.b.");
        }, /unexpected eof/);

        parser = mona.splitEnd(mona.token(), mona.string("."),
                               {min: 3, enforceEnd: false});
        assert.deepEqual(parse(parser, "a.b.c."), ["a", "b", "c"]);
        assert.deepEqual(parse(parser, "a.b.c"), ["a", "b", "c"]);
      });
      it("accepts a max count", function() {
        var parser = mona.splitEnd(mona.token(), mona.string("."), {max: 3});
        assert.deepEqual(parse(mona.and(parser, mona.string("d.")), "a.b.c.d."),
                         "d.");

        parser = mona.splitEnd(mona.token(), mona.string("."),
                               {max: 3, enforceEnd: false});
        assert.deepEqual(parse(mona.and(parser, mona.string("d.")), "a.b.c.d."),
                         "d.");
        assert.deepEqual(parse(mona.and(parser, mona.string("d.")), "a.b.cd."),
                         "d.");
      });
    });
    describe("collect()", function() {
      it("collects zero or more matches by default", function() {
        var parser = mona.collect(mona.token());
        assert.deepEqual(parse(parser, "abc"), ["a", "b", "c"]);
      });
      it("succeeds even if no matches are found", function() {
        var parser = mona.collect(mona.token());
        assert.deepEqual(parse(parser, ""), []);
      });
      it("accepts a minimum count", function() {
        var parser = mona.collect(mona.token(), {min: 1});
        assert.deepEqual(parse(parser, "a"), ["a"]);
        assert.throws(function() {
          parse(parser, "");
        }, /unexpected eof/);
      });
      it("accepts a maximum count", function() {
        var parser = mona.followedBy(
          mona.collect(mona.token(), {min: 1, max: 4}),
          mona.collect(mona.token()));
        assert.deepEqual(parse(parser, "aaaaa"), ["a", "a", "a", "a"]);
      });
    });
    describe("exactly()", function() {
      it("collects exactly n matches", function() {
        var parser = mona.followedBy(mona.exactly(mona.token(), 3),
                                     mona.collect(mona.token()));
        assert.deepEqual(parse(parser, "aaaaaaa"), ["a", "a", "a"]);
        assert.throws(function() {
          parse(parser, "aa");
        }, /unexpected eof/);
      });
    });
    describe("between()", function() {
      it("returns a value in between two other parsers", function() {
        var parser = mona.between(mona.string("("),
                                  mona.string(")"),
                                  mona.integer());
        assert.equal(parse(parser, "(123)"), 123);
        assert.throws(function() {
          parse(parser, "123)");
        }, /expected string matching \{\(\}/);
        assert.throws(function() {
          parse(parser, "(123");
        }, /expected string matching \{\)\}/);
        assert.throws(function() {
          parse(parser, "()");
        }, /expected digit/);
        var maybeParser = mona.between(mona.string("("),
                                       mona.string(")"),
                                       mona.maybe(mona.integer()));
        assert.equal(parse(maybeParser, "()"), undefined);
      });
    });
    describe("skip()", function() {
      it("skips input until parser stops matching", function() {
        var parser = mona.and(mona.skip(mona.string("a")), mona.token());
        assert.equal(parse(parser, "aaaaaaaaaaab"), "b");
      });
    });
    describe("range()", function() {
      it("succeeds if a parser's value is within range", function() {
        var parser = mona.range("a", "z");
        assert.equal(parse(parser, "m"), "m");
      });
      it("accepts a parser as a third argument", function() {
        assert.equal(parse(mona.range("a", "aaa", mona.text()), "aa"), "aa");
        assert.equal(parse(mona.range(10, 15, mona.integer()), "12"), 12);
      });
      it("fails if the predicate fails", function() {
        assert.throws(function() {
          parse(mona.range("a", "c"), "d");
        }, /value between \{a\} and \{c\}/);
        assert.throws(function() {
          parse(mona.range(1, 4, mona.integer()), "5");
        }, /value between \{1\} and \{4\}/);
      });
    });
  });
  describe("string-related parsers", function() {
    describe("oneOf()", function() {
      it("succeeds if the next token is present in the char bag", function() {
        assert.equal(parse(mona.oneOf("abc"), "b"), "b");
        assert.throws(function() {
          parse(mona.oneOf("abc"), "d");
        }, /expected one of {a,b,c}/);
      });
      it("optionally does a case-insensitive match", function() {
        assert.equal(parse(mona.oneOf("abc", false), "B"), "B");
        assert.throws(function() {
          parse(mona.oneOf("abc", true), "B");
        }, /expected one of {a,b,c}/);
      });
      it("accepts an array of strings as matches", function() {
        assert.equal(parse(mona.oneOf(["foo", "bar"]), "bar"), "bar");
        assert.throws(function() {
          parse(mona.oneOf(["foo", "bar"]), "baz");
        }, /expected one of {foo,bar}/);
      });
      it("defaults to being case-sensitive", function() {
        assert.throws(function() {
          parse(mona.oneOf("abc"), "B");
        }, /expected one of {a,b,c}/);
      });
    });
    describe("noneOf()", function() {
      it("succeeds if the next token is not in the char bag", function() {
        assert.equal(parse(mona.noneOf("abc"), "d"), "d");
        assert.throws(function() {
          parse(mona.noneOf("abc"), "b");
        }, /expected none of {a,b,c}/);
      });
      it("accepts an array of strings as matches", function() {
        assert.equal(parse(mona.noneOf(["foo", "bar"]), "x"), "x");
        assert.throws(function() {
          parse(mona.noneOf(["foo", "bar"]), "foo");
        }, /expected none of {foo,bar}/);
      });
      it("accepts a parser that will run if matches fail", function() {
        assert.equal(parse(mona.noneOf("abc", true, mona.integer()), "25"),
                    25);
        assert.throws(function() {
          parse(mona.noneOf("abc", true, mona.integer()), "a");
        }, /expected none of {a,b,c}/);
      });
      it("optionally does a case-insensitive match", function() {
        assert.equal(parse(mona.noneOf("abc", true), "B"), "B");
        assert.throws(function() {
          parse(mona.noneOf("abc", false), "B");
        }, /expected none of {a,b,c}/);
      });
    });
    describe("string()", function() {
      it("succeeds if the string matches a string in the input", function() {
        assert.equal(parse(mona.string("foo"), "foo"), "foo");
        assert.throws(function() {
          parse(mona.and(mona.string("foo"), mona.string("baz")), "foobarbaz");
        }, /expected string matching {baz}/);
      });
      it("optionally does a case-insensitive match", function() {
        assert.equal(parse(mona.string("abc", false), "AbC"), "AbC");
        assert.throws(function() {
          parse(mona.string("abc", true), "AbC");
        }, /expected string matching {abc}/);
      });
      it("defaults to being case-sensitive", function() {
        assert.throws(function() {
          parse(mona.string("abc"), "AbC");
        }, /expected string matching {abc}/);
      });
      it("reports the location of the first bad character", function() {
        assert.throws(function() {
          parse(mona.string("aaaaaaa"), "aaabaaaa");
        }, /(line 1, column 4)/);
      });
    });
    describe("alphaUpper()", function() {
      it("parses one uppercase alphabetical character", function() {
        var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for (var i = 0; i < alphabet.length; i++) {
          assert.equal(parse(mona.alphaUpper(), alphabet.charAt(i)),
                       alphabet.charAt(i));
          /*jshint loopfunc: true*/
          assert.throws(function() {
            parse(mona.alphaUpper(), alphabet.charAt(i).toLowerCase());
          }, /expected uppercase alphabetical character/);
        }
        assert.throws(function() {
          parse(mona.alphaUpper(), "0");
        }, /expected uppercase alphabetical character/);
      });
    });
    describe("alphaLower()", function() {
      it("parses one lowercase alphabetical character", function() {
        var alphabet = "abcdefghijklmnopqrstuvwxyz";
        for (var i = 0; i < alphabet.length; i++) {
          assert.equal(parse(mona.alphaLower(), alphabet.charAt(i)),
                       alphabet.charAt(i));
          /*jshint loopfunc: true*/
          assert.throws(function() {
            parse(mona.alphaLower(), alphabet.charAt(i).toUpperCase());
          }, /expected lowercase alphabetical character/);
        }
        assert.throws(function() {
          parse(mona.alphaLower(), "0");
        }, /expected lowercase alphabetical character/);
      });
    });
    describe("alpha()", function() {
      it("parses one alphabetical character", function() {
        var alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for (var i = 0; i < alphabet.length; i++) {
          assert.equal(parse(mona.alpha(), alphabet.charAt(i)),
                       alphabet.charAt(i));
        }
        assert.throws(function() {
          parse(mona.alpha(), "0");
        }, /expected alphabetical character/);
      });
    });
    describe("digit()", function() {
      it("succeeds if the next token is a digit character", function() {
        assert.equal(parse(mona.digit(), "1"), "1");
        assert.throws(function() {
          parse(mona.digit(), "z");
        }, /expected digit/);
      });
      it("accepts an optional base/radix argument", function() {
        assert.equal(parse(mona.digit(16), "f"), "f");
      });
      it("defaults to base 10", function() {
        assert.equal(parse(mona.digit(), "0"), "0");
        assert.equal(parse(mona.digit(), "9"), "9");
        assert.throws(function() {
          parse(mona.digit(), "a");
        }, /expected digit/);
      });
    });
    describe("alphanum()", function() {
      it("parses either an alphabetical character or a digit", function() {
        assert.equal(parse(mona.alphanum(), "x"), "x");
        assert.equal(parse(mona.alphanum(), "7"), "7");
        assert.throws(function() {
          parse(mona.alphanum(), "?");
        }, /expected alphanum/);
      });
      it("accepts an optional base/radix argument", function() {
        assert.equal(parse(mona.alphanum(16), "f"), "f");
      });
      it("defaults to base 10", function() {
        assert.equal(parse(mona.alphanum(), "0"), "0");
        assert.equal(parse(mona.alphanum(), "9"), "9");
      });
    });
    describe("space()", function() {
      it("consumes a single whitespace character from input", function() {
        assert.equal(parse(mona.space(), " "), " ");
        assert.equal(parse(mona.space(), "\n"), "\n");
        assert.equal(parse(mona.space(), "\t"), "\t");
        assert.equal(parse(mona.space(), "\r"), "\r");
        assert.throws(function() {
          parse(mona.space(), "");
        }, /expected space/);
        assert.throws(function() {
          parse(mona.space(), "hi");
        }, /expected space/);
      });
    });
    describe("spaces()", function() {
      it("consumes one or more whitespace characters", function() {
        var parser = mona.and(mona.spaces(),
                              mona.token());
        assert.equal(parse(parser, "     a"), "a");
        assert.equal(parse(parser, "   \r  \n\t a"), "a");
      });
      it("returns a single space as its success value", function() {
        assert.equal(parse(mona.spaces(), "\r \n\t   \r\t\t\n"), " ");
      });
    });
    describe("text()", function() {
      it("collects one or more parser results into a string", function() {
        assert.equal(parse(mona.text(mona.string("a")), "aaaab",
                           {allowTrailing: true}),
                     "aaaa");
      });
      it("defaults to token()", function() {
        assert.equal(parse(mona.text(), "abcde"), "abcde");
      });
      it("accepts a minimum and maximum option", function() {
        assert.equal(parse(mona.text(mona.token(), {min: 3}),
                           "aaaa"),
                     "aaaa");
        assert.throws(function() {
          parse(mona.text(mona.token(), {min: 3}), "aa");
        }, /unexpected eof/);
        assert.equal(parse(mona.followedBy(
          mona.text(mona.token(), {max: 3}), mona.token()),
                           "aaaa"),
                     "aaa");
      });
    });
    describe("trim()", function() {
      it("trims leading and trailing whitespace", function() {
        assert.equal(parse(mona.trim(mona.token()), "   a    "), "a");
        assert.equal(parse(mona.trim(mona.token()), "a    "), "a");
        assert.equal(parse(mona.trim(mona.token()), "   a"), "a");
      });
    });
    describe("trimLeft()", function() {
      it("trims leading whitespace only", function() {
        var parser = mona.between(mona.string("|"),
                                  mona.string("|"),
                                  mona.trimLeft(mona.string("a")));
        assert.equal(parse(parser, "|   a|"), "a");
        assert.throws(function() {
          parse(parser, "|   a    |");
        }, /expected string matching \{\|\}/);
      });
    });
    describe("trimRight()", function() {
      it("trims trailing whitespace only", function() {
        var parser = mona.between(mona.string("|"),
                                  mona.string("|"),
                                  mona.trimRight(mona.string("a")));
        assert.equal(parse(parser, "|a     |"), "a");
        assert.throws(function() {
          parse(parser, "|   a    |");
        }, /\(line 1, column 2\) expected string matching \{\a\}/);
      });
    });
  });
  describe("number-related parsers", function() {
    describe("natural()", function() {
      it("matches a natural number without a sign", function() {
        assert.equal(parse(mona.natural(), "1234"), 1234);
        assert.throws(function() {
          parse(mona.natural(), "-123");
        }, /expected digit/);
      });
      it("accepts a base/radix argument", function() {
        assert.equal(parse(mona.natural(2), "101110"),
                     parseInt("101110", 2));
        assert.equal(parse(mona.natural(16), "deadbeef"),
                     0xdeadbeef);
      });
    });
    describe("integer()", function() {
      it("matches a positive or negative possibly-signed integer", function() {
        assert.equal(parse(mona.integer(), "1234"), 1234);
        assert.equal(parse(mona.integer(), "+1234"), 1234);
        assert.equal(parse(mona.integer(), "-1234"), -1234);
      });
      it("accepts a base/radix argument", function() {
        assert.equal(parse(mona.integer(2), "101110"), parseInt("101110", 2));
        assert.equal(parse(mona.integer(16), "deadbeef"), 0xdeadbeef);
        assert.equal(parse(mona.integer(16), "-deadbeef"), -0xdeadbeef);
      });
    });
    describe("float()", function() {
      it("parses a number with decimal points into a JS float", function() {
        assert.equal(parse(mona.float(), "1.2"), 1.2);
        assert.equal(parse(mona.float(), "-1.25"), -1.25);
        assert.equal(parse(mona.float(), "+1.25"), 1.25);
      });
      it("is aliased to 'real'", function() {
        assert.equal(mona.float, mona.real);
      });
      it("supports e-notation", function() {
        assert.equal(parse(mona.float(), "1.25e10"), 1.25e10);
        assert.equal(parse(mona.float(), "1.25e3"), 1.25e3);
        assert.equal(parse(mona.float(), "1.25e-3"), 1.25e-3);
      });
    });
    describe("cardinal()", function() {
      it("parses numbers from 'zero' through 'nineteen'", function() {
        var nums = ["zero", "one", "two", "three", "four", "five", "six",
                    "seven", "eight", "nine", "ten", "eleven", "twelve",
                    "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
                    "eighteen", "nineteen"];
        nums.forEach(function(num, i) {
          assert.equal(parse(mona.cardinal(), num), i);
        });
      });
      it("parses numbers from 'twenty' through 'ninety-nine'", function() {
        var small = ["one", "two", "three", "four", "five", "six", "seven",
                     "eight", "nine"];
        var tens = ["twenty", "thirty", "forty", "fifty", "sixty", "seventy",
                    "eighty", "ninety"];
        tens.forEach(function(ten, i) {
          var tenNum = (i + 2) * 10;
          assert.equal(parse(mona.cardinal(), ten), tenNum);
          small.forEach(function(small, i) {
            assert.equal(parse(mona.cardinal(), ten + "-" + small),
                         tenNum + i + 1);
            assert.equal(parse(mona.cardinal(), ten + " " + small),
                         tenNum + i + 1);
          });
        });
      });
      it("parses 'one-hundred' through 'nine-hundred ninety-nine'", function() {
        assert.equal(parse(mona.cardinal(), "one-hundred"), 100);
        assert.equal(parse(mona.cardinal(), "one-hundred and five"), 105);
        assert.equal(parse(mona.cardinal(), "nine-hundred ninety-nine"), 999);
      });
      it("parses a ridiculous number", function() {
        assert.equal(parse(mona.cardinal(),
                           "forty-eight trillion, "+
                           "twenty-five billion, "+
                           "one-hundred and forty-five million, "+
                           "seven-hundred eighty-six thousand, "+
                           "five-hundred and ninety-five"),
                     48025145786595);
      });
    });
    describe("ordinal()", function() {
      it("parses numbers from 'zeroeth' through 'nineteenth'", function() {
        var nums = ["zeroeth", "first", "second", "third", "fourth", "fifth",
                    "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh",
                    "twelfth", "thirteenth", "fourteenth", "fifteenth",
                    "sixteenth", "seventeenth", "eighteenth", "nineteenth"];
        nums.forEach(function(num, i) {
          assert.equal(parse(mona.ordinal(), num), i);
        });
      });
      it("parses numbers from 'twentieth' through 'ninety-ninth'", function() {
        var small = ["first", "second", "third", "fourth", "fifth", "sixth",
                     "seventh", "eighth", "ninth"];
        var tens = ["twenty", "thirty", "forty", "fifty", "sixty", "seventy",
                    "eighty", "ninety"];
        var ordinalTens = ["twentieth", "thirtieth", "fortieth", "fiftieth",
                           "sixtieth", "seventieth", "eightieth", "ninetieth"];
        tens.forEach(function(ten, i) {
          var tenNum = (i + 2) * 10;
          assert.equal(parse(mona.ordinal(), ordinalTens[i]), tenNum);
          small.forEach(function(small, i) {
            assert.equal(parse(mona.ordinal(), ten + "-" + small),
                         tenNum + i + 1);
            assert.equal(parse(mona.ordinal(), ten + " " + small),
                         tenNum + i + 1);
          });
        });
      });
      it("'one-hundredth' through 'nine-hundred ninety-ninth'", function() {
        assert.equal(parse(mona.ordinal(), "one-hundredth"), 100);
        assert.equal(parse(mona.ordinal(), "one-hundred and fifth"), 105);
        assert.equal(parse(mona.ordinal(), "nine-hundred ninety-ninth"), 999);
      });
      it("parses one-billionth", function() {
        assert.equal(parse(mona.ordinal(), "one billionth"), 1000000000);
      });
      it("parses a ridiculous number", function() {
        assert.equal(parse(mona.ordinal(),
                           "forty-eight trillion, "+
                           "twenty-five billion, "+
                           "one-hundred and forty-five million, "+
                           "seven-hundred eighty-six thousand, "+
                           "five-hundred and ninety-fifth"),
                     48025145786595);
      });
    });
    describe("shortOrdinal()", function() {
      it("parses an integer with an ordinal suffix", function() {
        assert.equal(parse(mona.shortOrdinal(), "1st"), 1);
        assert.equal(parse(mona.shortOrdinal(), "2nd"), 2);
        assert.equal(parse(mona.shortOrdinal(), "3rd"), 3);
        assert.equal(parse(mona.shortOrdinal(), "2d"), 2);
        assert.equal(parse(mona.shortOrdinal(), "3d"), 3);
        assert.equal(parse(mona.shortOrdinal(), "4th"), 4);
      });
      it("allows control over suffix strictness", function() {
        assert.equal(parse(mona.shortOrdinal(false), "1nd"), 1);
        assert.throws(function() {
          parse(mona.shortOrdinal(true), "1nd");
        });
      });
    });
  });
});
