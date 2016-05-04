//リモートCoucDBのURLとして、利用する。
var couchurl = window.location.origin;

        
// DBの初期化。SharedWorkerを利用しソケットを再利用させる。
function initialize(cb){
  
    //worker
    worker = new SharedWorker('/_suggest/js/workers/worker.js');
    
    /**
     * SharedWorkerにメッセージを送る
     * 
     * message:
     *          messageType - initialize (今のところ、initializeのみ)
     *          couchurl    - window.location.origin　SharedWorkerからwindow.location.originを呼べないため
     * 
     * worker: 
     *          SharedWorkerのオブジェクトSharedWorker
     * 
     * callback:
     *          メッセージのレスポンス後、呼ばれるCallback関数
     */
    function messageWorker(message, worker, callback) {
        
        function listen(e){
            if (e.data.funcName === message.funcName){
                worker.port.removeEventListener("message". listen);
                callback(e.data);
            }
        }
        
        worker.port.addEventListener("message", listen);
        worker.port.postMessage(message);
    }     
    worker.port.start(); 
    

         
    messageWorker(["initialize",couchurl], worker, function(data){
        if(data)
            cb();
            
        console.log("Loaded  "+data);
    });  


}

//MVCのModel
function Models(url) {

    /**
     * オートコンプリート用DB (Autocomplete DB - history)
     * text:　ブラウザー文章履歴
     *
     */
    // SharedWorkerを使い全て同期させる　（ソケットエラーを防ぐため）
   // initialize();

    this.histories = new PouchDB("history"); //ローカルブラウザ内のDB;
    var remote_history = new PouchDB(couchurl+"/history");
    
    //ヒストリーだけ、サーバーと同期させる。
    //また、何らかの理由でワーカーとして同期できないため、こちらで同期させる
    this.histories.sync(remote_history,{
        live: true,
        retry: true
    });
    // DBインスタンスの定義　Declaration of DB Instances
    
    /** 
    *  キーワードDB (keywords_remote DB)
    *  _id: 
    *  _rev:
    *  keyword: 単語
    */

    // ローカルキーワードDB　下記はMemoryを使った場合
    // ただし、得にレスポンスが早くなった感じはありませんでした。
    // 念のため残しておきます。
    // this.keywords_local = new PouchDB("keywords");
    // this.keywords = new PouchDB("keywords_mem",{adapter:'memory'});
    // this.keywords.replicate.from(this.keywords_local,{live:true});
    this.keywords = new PouchDB("keywords");

    /**
     * 文章DB (sentence DB)
     * _id:
     * _rev:
     * sentence:　文章
     */

    // ローカルキーワードDB 下記はMemoryを使った場合
    // ただし、得にレスポンスが早くなった感じはありませんでした。
    // 念のため残しておきます。
    // this.sentences_local = new PouchDB("sentences");
    // this.sentences = new PouchDB("sentences_mem",{adapter:'memory'});
    // this.sentences.replicate.from(this.sentences_local);
    this.sentences = new PouchDB("sentences");
    
    /**
     * 類義文章DB (similar keywords DB)
     * _id:
     * _rev:
     * keyword_id_a:　キーワードID
     * keyword_id_b:　キーワードID
     */ 

    
    // ローカルキーワードDB 下記はMemoryを使った場合
    // ただし、得にレスポンスが早くなった感じはありませんでした。
    // 念のため残しておきます。   
    // this.similar_keywords_local = new PouchDB("similar_keywords");
    // this.similar_keywords = new PouchDB("similar_keywords_mem",{adapter:"memory"});
    // this.similar_keywords.replicate.from(this.similar_keywords_local);
    this.similar_keywords = new PouchDB("similar_keywords");

    this.initialized = false;
}

Models.prototype = {
    showHistory: function() {
        return this.histories.allDocs({include_docs:true, limit: 10});
    },
    queryHistory: function(key) {
        var param = {startkey: key, endkey: key+'\uffff', limit: 10, include_docs: true};
        return this.histories.query(function (doc) {
                if (doc.text) {
                    emit(doc.text.toLowerCase());
                 }
            }, param);
    },
    saveHistory: function(keyValue) {
        return this.histories.put({ _id: new Date().toISOString(),text: keyValue});
    },
    showSentences: function(ids) {
        var param = {keys: ids, limit: 5, include_docs: true};
        return this.sentences.query(function(doc){
                emit(doc.keyword_id);
            }, param);
    },
    showSimilarKeywords: function(ids) {
        var param = {keys: ids, limit: 5, include_docs: true};
        return this.similar_keywords.query(function(doc){
                emit(doc.keyword_id_a);
                emit(doc.keyword_id_b);
            }, param);
    },
    getSearchKeywords: function(keyValue) {
        var param = {startkey: keyValue, endkey: keyValue+'\uffff',include_docs: true};
        return this.keywords.query(function (doc) {
            if (doc.keyword) {
                emit(doc.keyword.toLowerCase());
             }
        }, param);
    },
    ifEmptyData: function(callback){
        _this = this;
        _this.keywords.info().then(function(kw_result){
            _this.similar_keywords.info().then(function(sk_result){
                _this.sentences.info().then(function(s_result){
                    if((kw_result.doc_count+sk_result.doc_count+s_result.doc_count) == 0){
                        callback();
                    }
                });
            });
        });
    },
    start: function(downloadingCb,proceedCb){
        if(this.initialized){
            console.log("Initialized");
            proceedCb();
            return;
        }
        this.ifEmptyData(function(){

            console.log("Empty data");
            downloadingCb();
            initialize(function(){
               proceedCb();
               _this.initialized = true;
            });
                 
        });

    }
}

function View($jquery, $elem, models) {
    this.$ = $jquery;
    this.$elements = $elem;
    this._models = models;
    
    var _this = this;
    
    _this.$elements.tables.history.on('click-row.bs.table', function (e, row, $element) {
        _this.$elements.input.val(row.text);
        _this.$elements.suggestionWrapper.addClass('hidden');
    });
    
    _this.$elements.tables.suggestion.on('click-row.bs.table', function (e, row, $element) {
        _this.$elements.input.val(row.text);
        _this.$elements.suggestionWrapper.addClass('hidden');
    });
}

View.prototype = {
    resizeSuggestionWrapper: function() {
        var _this = this;
        _this.$("#suggestion-box").css('width', _this.$elements.input.width() + $("#keyword-div .input-group-btn").width());  
    },
    init: function () {
        $(".th-inner").addClass('hidden');
    },
    removeTablesData: function() {
        this.$elements.tables.history.bootstrapTable('removeAll');
        this.$elements.tables.suggestion.bootstrapTable('removeAll');
    },
    hideSuggestionWrapper: function() {
        this.$elements.suggestionWrapper.addClass('hidden');
        this.resizeSuggestionWrapper();
    },
    showSuggestionWrapper: function() {
        this.$elements.suggestionWrapper.removeClass('hidden');
        this.resizeSuggestionWrapper();
    },
    appendTableData: function(results, isHistory, isSuggestion) {
        var _this = this;
        if (isHistory) {
            _this.$elements.tables.history.bootstrapTable('removeAll');
            _this.$.each(results, function(index, value) {
                var doc = value.doc;
                _this.$elements.tables.history.bootstrapTable('insertRow', {
                    index: doc._id,
                    row: {
                        id: doc._id,
                        text: doc.text
                    }
                });
            });
        } else if (isSuggestion) {
            var ids = _this.$.map(results, function (doc) {
                return doc.id;
            });
            console.log(ids, 'ids of the keywords to be search on similar_keywords db');
            _this.getSentences(ids).then(function(sentences){
                _this.$elements.tables.suggestion.bootstrapTable('removeAll');
                _this.$.each(sentences.rows, function(index, value) {
                    var doc = value.doc;
                    _this.$elements.tables.suggestion.bootstrapTable('insertRow', {
                        index: doc._id,
                        row: {
                            id: doc._id,
                            text: doc.sentence
                        }
                    });
                    _this.getSimilarKeywords(ids);
                });
            }).catch(function (err) {
                console.error('文章のクエリー時にエラーが発生しました', err);
            });
        }
    },
    getSentences: function(ids) {
        return this._models.showSentences(ids);
    },
    getSimilarKeywords: function(ids) {
        var _this = this;
        _this._models.showSimilarKeywords(ids).then(function(keywordIdB){
            var similarKeywordsResult = keywordIdB.rows;
            var similarKeywordResultId = _this.$.map(similarKeywordsResult, function (doc) {
                var tempDoc = doc.doc, key;
                _this.$.each(ids, function(i, val){
                    if(tempDoc.keyword_id_a === val) {
                        key = doc.doc.keyword_id_b;
                    } else if(tempDoc.keyword_id_b === val) {
                        key = doc.doc.keyword_id_a;
                    }
                });
                
                return key;
            });
            
            _this.getSentences(similarKeywordResultId).then(function(sentences2){
                var suggesstionTableData = _this.$elements.tables.suggestion.bootstrapTable('getData');
                var hasSeparator = false;
                $.each(sentences2.rows, function(index, value) {
                    var doc = value.doc;
                    var hasDuplicate = false; //　入力が早すぎると、同じ文章がサジェスト欄に挿入されていたりすることがあるため、これで防ぐ
                    
                    $.each(suggesstionTableData, function(i, row){
                        if (doc._id === row.id){
                            hasDuplicate = true;
                            return;
                        }
                    });
                    if (!hasDuplicate) {
                        if(!hasSeparator) {
                            hasSeparator = true;
                            _this.$elements.tables.suggestion.bootstrapTable('insertRow', {
                                index: suggesstionTableData.length,
                                row: {
                                    id: doc._id,
                                    text: '<hr style="margin: 0;cursor: pointer;">'
                                }
                            });
                        }
                        _this.$elements.tables.suggestion.bootstrapTable('insertRow', {
                            index: suggesstionTableData.length,
                            row: {
                                id: doc._id,
                                text: doc.sentence
                            }
                        });
                    }
                });
            }).catch(function (err) {
                console.error('エラー', err);
            }); // end for senteces 2
            
        }).catch(function (err) {
            console.error('エラー', err);
        }); // end for similar
            
    },
    showHistory: function() {
        var _this = this;
        this._models.showHistory().then(function(result){
            _this.appendTableData(result.rows, true,false);
            _this.showSuggestionWrapper(); 
        });
    },
    showSearchKeywords: function(filterHistory, isNeedToSaveHistory) {
        var _this = this;
        var key = _this.$elements.input.val().toLowerCase();
        _this._models.getSearchKeywords(key).then(function(result){
            if (key.trim() === ''){
                _this.$elements.tables.suggestion.bootstrapTable('removeAll');
            } else {
                console.log(result.rows);
                _this.appendTableData(result.rows, false, true);
            }
        }).catch(function (err) {
            console.error('エラー発生', err);
        });
        
        if (filterHistory) {
            _this._models.queryHistory(key).then(function(result){
                if (isNeedToSaveHistory && result.rows.length === 0) 
                    _this._models.saveHistory(key);
                _this.appendTableData(result.rows, true, false);
            }).catch(function (err) {
                console.error('オートコンプリートでエラーが発生しました。', err);
            });
        }
    },
    
    
}


function Controller($elem, view, models) {
    this.$elements = $elem;
    this._view = view;
    
    var _this = this;
    
    var timeout = null;
    
    _this.$elements.btn.click(function(){
      _this.searchKeywords(true, true);
    });
    
    _this.$elements.input.keyup(function(e){
        
        // Enterを無視する
        if(e.keyCode==13){
            return;
        }              

        var proceedSearch = function (){
            //if(timeout != null){
            //    clearTimeout(timeout); //　素早く入力したときに、最初に打った文字だけが認識されることがある。対策は２００msのインターバルと、500ms以内にまた入力された場合は、前の入力をキャンセルする。
            //}
            //timeout = setTimeout(function(){
                var keySearchVal = $("#search-keyword");
                _this._view.removeTablesData();
        
                if(e.keyCode === 40 && keySearchVal.val().trim().length === 0)
                    _this.getHistory();
                    
                if (keySearchVal.val().trim().length > 0 ) {
                    _this.$elements.suggestionWrapper.removeClass('hidden');
                    _this._view.showSuggestionWrapper();
                    _this.searchKeywords(true);
                } else {
                    _this.$elements.suggestionWrapper.addClass('hidden');
                }            
                    
            //},500);            
        };
        proceedSearch();
        models.start(
            function(){
                $("#suggesstion-table .no-records-found td").text("DBをダウンロード中 ... ");
                
            },
            function(){
                
                $("#suggesstion-table .no-records-found td").text("...");
                proceedSearch();
            }
            
        );
        

    });
}

Controller.prototype = {
    init: function() {
        this._view.init();
    },
    getHistory: function() {
        this._view.showHistory();
    },
    searchKeywords: function (filterHistory, isNeedToSaveHistory) {
        this._view.showSearchKeywords(filterHistory, isNeedToSaveHistory);
    }
};


$(function () {
    var elements = {
        input : $('#search-keyword'),
        btn : $("#btn-search"),
        suggestionWrapper: $('#suggestion-box'),
        tables: {history: $('#history-table'), suggestion: $('#suggesstion-table')}
    };
    var models = new Models(couchurl);
    
    var view = new View($, elements, models);
    var controller = new Controller(elements, view, models);
    controller.init();
    $(window).resize(function(){view.resizeSuggestionWrapper();});
});