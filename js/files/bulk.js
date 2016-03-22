// Generated by CoffeeScript 1.4.0
(function() {
  var addkw, adds, keyword_db, rmkw, rms, rmsm, root, say, sentences_db, similar_keywords_db,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  root = typeof exports !== "undefined" && exports !== null ? exports : this;

  say = console.log;

  keyword_db = new PouchDB(couchurl + "/keywords");

  sentences_db = new PouchDB(couchurl + "/sentences");

  (sentences_db.changes({
    since: 0,
    include_docs: true
  })).then = function(changes) {
    return root.show_sentences();
  };

  similar_keywords_db = new PouchDB(couchurl + "/similar_keywords");

  rmkw = function(data) {
    var id;
    id = data[0];
    console.log(id);
    keyword_db.get(id).then(function(result) {
      console.log("Deleteing " + id);
      keyword_db.remove(result);
      return $("#bulk_delete").val("");
    });
  };

  rms = function(data) {
    var id;
    id = data[0];
    console.log(id);
    return sentences_db.get(id).then(function(result) {
      sentences_db.remove(result);
      return $("#bulk_delete_sentences").val("");
    });
  };

  rmsm = function(data) {
    var id;
    id = data[0];
    console.log(id);
    similar_keywords_db.get(id).then(function(result) {
      similar_keywords_db.remove(result);
      return $("#bulk_delete_similar").val("");
    });
  };

  addkw = function(data) {
    console.log(data);
    return keyword_db.post({
      keyword: data
    }, function(err, result) {
      return console.log(result);
    });
  };

  adds = function(data) {
    console.log(data);
    return sentences_db.post({
      keyword_id: data[0],
      sentence: data[1]
    }, function(err, result) {
      return console.log(result);
    });
  };

  root.show = function() {
    var doc;
    $("#data").empty();
    doc = keyword_db.allDocs({
      include_docs: true
    });
    return doc.then(function(result) {
      var row, rows, str, _i, _len;
      rows = result.rows;
      str = "";
      for (_i = 0, _len = rows.length; _i < _len; _i++) {
        row = rows[_i];
        str += row.doc._id + ":" + row.doc.keyword + "<br />";
      }
      $("#data").append(str);
    });
  };

  root.show_sentences = function() {
    var doc;
    $("#sentences").empty();
    doc = sentences_db.allDocs({
      include_docs: true
    });
    return doc.then(function(result) {
      var row, rows, _fn, _i, _len;
      rows = result.rows;
      console.log(rows);
      _fn = function(row) {
        return keyword_db.get(row.doc.keyword_id).then(function(kwa) {
          return $("#sentences").append(row.doc._id + ":[" + kwa.keyword + "] " + row.doc.sentence + "<br />");
        });
      };
      for (_i = 0, _len = rows.length; _i < _len; _i++) {
        row = rows[_i];
        _fn(row);
      }
    });
  };

  root.show_similar = function() {
    var doc;
    $("#similar").empty();
    doc = similar_keywords_db.allDocs({
      include_docs: true
    });
    return doc.then(function(result) {
      var row, rows, _fn, _i, _len;
      rows = result.rows;
      console.log(rows);
      _fn = function(row) {
        return keyword_db.get(row.doc.keyword_id_a).then(function(kwa) {
          return keyword_db.get(row.doc.keyword_id_b).then(function(kwb) {
            return $("#similar").append(row.doc._id + ":[" + kwa.keyword + "] " + kwb.keyword + "<br />");
          });
        });
      };
      for (_i = 0, _len = rows.length; _i < _len; _i++) {
        row = rows[_i];
        _fn(row);
      }
    });
  };

  root.bulk_delete_sentences = function() {
    var line, rm, todelete, _i, _len, _ref, _results;
    todelete = $("#bulk_delete_sentences").val();
    rm = function(line) {
      var a;
      if (__indexOf.call(line, ":") >= 0) {
        a = line.split(":");
      }
      if (a !== void 0) {
        return rms(a);
      }
    };
    _ref = todelete.split("\n");
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      line = _ref[_i];
      _results.push(rm(line));
    }
    return _results;
  };

  root.bulk_delete_similar = function() {
    var line, rm, todelete, _i, _len, _ref, _results;
    todelete = $("#bulk_delete_similar").val();
    rm = function(line) {
      var a;
      if (__indexOf.call(line, ":") >= 0) {
        a = line.split(":");
      }
      if (a !== void 0) {
        return rmsm(a);
      }
    };
    _ref = todelete.split("\n");
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      line = _ref[_i];
      _results.push(rm(line));
    }
    return _results;
  };

  root.link = function() {
    var a, b;
    a = $("#keyword_a").val();
    b = $("#keyword_b").val();
    return similar_keywords_db.post({
      keyword_id_a: a,
      keyword_id_b: b
    }, function(err, result) {
      console.log(err);
      return console.log(result);
    });
  };

  root.bulk_delete = function() {
    var line, rm, todelete, _i, _len, _ref, _results;
    todelete = $("#bulk_delete").val();
    rm = function(line) {
      var a;
      if (__indexOf.call(line, ":") >= 0) {
        a = line.split(":");
      }
      if (a !== void 0) {
        return rmkw(a);
      }
    };
    _ref = todelete.split("\n");
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      line = _ref[_i];
      _results.push(rm(line));
    }
    return _results;
  };

  root.bulk_add = function() {
    var line, rm, toadd, _i, _len, _ref, _results;
    toadd = $("#bulk_add").val();
    $("#bulk_add").val("");
    rm = function(line) {
      return addkw(line);
    };
    _ref = toadd.split("\n");
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      line = _ref[_i];
      _results.push(rm(line));
    }
    return _results;
  };

  root.bulk_add_sentences = function() {
    var line, rm, toadd, _i, _len, _ref, _results;
    toadd = $("#bulk_add_sentences").val();
    $("#bulk_add_sentences").val("");
    rm = function(line) {
      var l;
      if (__indexOf.call(line, ":") >= 0) {
        l = line.split(":");
      }
      if (l !== void 0) {
        return adds(l);
      }
    };
    _ref = toadd.split("\n");
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      line = _ref[_i];
      _results.push(rm(line));
    }
    return _results;
  };

}).call(this);
