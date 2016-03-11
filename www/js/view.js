 $(function() {
     // DBインスタンスの定義　Declaration of DB Instances

     /** 
      *  キーワードDB (keywords_remote DB)
      *  _id: 
      *  _rev:
      *  keyword: 単語
      */
     var keywords_remote = new PouchDB(couchurl+'/keywords');

     // ローカルキーワードDB
     var keywords = new PouchDB("keywords");

     // リモートと常に同期させる
     keywords.sync(keywords_remote, {
         live: true
     });


     /**
      * 文章DB (sentence DB)
      * _id:
      * _rev:
      * sentence:　文章
      */
     var sentences_remote = new PouchDB(couchurl+'/sentences');

     // ローカルキーワードDB
     var sentences = new PouchDB("sentences");

     // リモートと常に同期させる
     sentences.sync(sentences_remote, {
         live: true
     });


     /**
      * 類義文章DB (similar keywords DB)
      * _id:
      * _rev:
      * keyword_id_a:　キーワードID
      * keyword_id_b:　キーワードID
      */
     var similar_keywords_remote = new PouchDB(couchurl+'/similar_keywords');

     // ローカルキーワードDB    
     var similar_keywords = new PouchDB("similar_keywords");

     // リモート常に同期させる
     similar_keywords.sync(similar_keywords_remote, {
         live: true
     });

     var keywordsList = [],
         sentencesList = [];



     function appendTableData($table, rows) {
         $table.bootstrapTable('removeAll');
         $.each(rows, function(i, row) {
             var doc = row.doc;
             $table.bootstrapTable('insertRow', {
                 index: $table.bootstrapTable('getData').length,
                 row: doc
             });
         });
         return;
     }

     keywords.allDocs({
         include_docs: true
     }).then(function(result) {
         var $table = $("#db-keywords-table");
         keywordsList = result.rows;
         appendTableData($table, result.rows);

         // show all similar keywords
         similar_keywords.allDocs({
             include_docs: true
         }).then(function(result) {
             var $Stable = $("#db-similar-keywords-table");
             // appendTableData($table, result.rows);
             var rows = result.rows;
             $.each(rows, function(i, row) {
                 var doc = row.doc;
                 var dataRow = {
                     keyword_a: getKeywordText(doc.keyword_id_a, keywordsList),
                     keyword_b: getKeywordText(doc.keyword_id_b, keywordsList),
                 };

                 $Stable.bootstrapTable('insertRow', {
                     index: $Stable.bootstrapTable('getData').length,
                     row: dataRow
                 });
             });

         });
     });

     sentences.allDocs({
         include_docs: true
     }).then(function(result) {
         var $table = $("#db-sentences-table");
         sentencesList = result.rows;
         appendTableData($table, result.rows);

     });

     function getKeywordText(keyword_id, lists) {
         var _key = '-';
         $.each(lists, function(i, row) {
             var doc = row.doc;
             if (keyword_id === doc._id) {
                 console.log(doc, 'the docs');
                 _key = (doc.text) ? doc.text : doc.keyword;
                 return _key;
             }
         });
         return _key;
     }

 });