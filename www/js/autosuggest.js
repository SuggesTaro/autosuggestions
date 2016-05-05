//リモートCoucDBのURLとして、利用する。
var couchurl = window.location.origin;

        
// DBの初期化。SharedWorkerを利用しソケットを再利用させる。
function initialize(cb){
    //worker
    var worker = new SharedWorker('/_suggest/js/workers/worker.js');
    
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
    function messageWorker(message, sWorker, callback) {
        
        function listen(e){
            if (e.data.funcName === message.funcName){
                callback(e.data);
            }
        }
        
        sWorker.port.addEventListener("message", listen);
        sWorker.port.postMessage(message);
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

    this.keywords = new PouchDB("keywords");

    /**
     * 文章DB (sentence DB)
     * _id:
     * _rev:
     * sentence:　文章
     */


    this.sentences = new PouchDB("sentences");
    
    /**
     * 類義文章DB (similar keywords DB)
     * _id:
     * _rev:
     * keyword_id_a:　キーワードID
     * keyword_id_b:　キーワードID
     */ 

    
    this.similar_keywords = new PouchDB("similar_keywords");
    
    
    this.initialized = false;
}

Models.prototype = {
    //Persistentクエリーを初期設定する
    initializePersistentQueries: function(proceedCb) { 
        // Persistentクエリーを利用し、PouchDBのクエリーを高速化ができます。
        // 10から100倍高速化するとのこと
        // https://pouchdb.com/2014/05/01/secondary-indexes-have-landed-in-pouchdb.html
        
        var _this = this;
        
        // FOR HISTORY
        var HistoryDoc = {
          _id: '_design/histories',
          views: {
            by_history: {
              map: function (doc) {
                    emit(doc.text.toLowerCase());
                }.toString()
            }
          }
        };
        
        _this.histories.put(HistoryDoc).then(function () {
            return _this.histories.query('histories/by_history', {stale: 'update_after'});
        }).catch(function (err) {
            // some error (maybe a 409, because it already exists?)
            console.error('History views maybe a 409, because it already exists?', err);
        });
    
        // キーワードのクエリー初期化
        var keywordDoc = {
          _id: '_design/keywords',
          views: {
            by_keyword: {
              map: function (doc) { 
                  if (doc.keyword) {
                    emit(doc.keyword.toLowerCase());
                 }
              }.toString()
            }
          }
        };
        
        
        
        // sentences のクエリー初期化
        var SentenceDoc = {
          _id: '_design/sentences',
          views: {
            by_sentence: {
              map: function (doc) { 
                 emit(doc.keyword_id);
              }.toString()
            }
          }
        };
        
        
        // 類義のクエリー初期化
        var SimilarKeywordDoc = {
          _id: '_design/similarKeywords',
          views: {
            by_similar_keyword: {
              map: function (doc) { 
                 emit(doc.keyword_id_a);
                 emit(doc.keyword_id_b);
              }.toString()
            }
          }
        };
        
        _this.keywords.put(keywordDoc).then(function () {
            _this.keywords.query('keywords/by_keyword', {stale: 'update_after'}).then(function(){
                _this.sentences.put(SentenceDoc).then(function () {
                    _this.sentences.query('sentences/by_sentence', {stale: 'update_after'}).then(function(){
                        _this.similar_keywords.put(SimilarKeywordDoc).then(function () {
                            _this.similar_keywords.query('similarKeywords/by_similar_keyword', {stale: 'update_after'}).then(function(){
                                // proceedCb is a fucntion after the views has been create
                                // this is to eleminate some code after the views of keyword, similar_keywords and sentences created
                                if (proceedCb) 
                                    proceedCb();
                                
                                
                                return;
                            });
                        }).catch(function (err) {
                          // some error (maybe a 409, because it already exists?)
                          console.error('Sentences views maybe a 409, because it already exists?', err);
                        });
                    }); // end of sentence firs query
                }).catch(function (err) {
                  // some error (maybe a 409, because it already exists?)
                  console.error('Sentences views maybe a 409, because it already exists?', err);
                });
            });
        }).catch(function (err) {
            // some error (maybe a 409, because it already exists?)
            console.error('Keywords views maybe a 409, because it already exists?', err);
        });
    },
    showHistory: function() {
        return this.histories.allDocs({include_docs:true, limit: 10});
    },
    queryHistory: function(key) {
        var param = {startkey: key, endkey: key+'\uffff', limit: 10, include_docs: true};
        return this.histories.query('histories/by_history', param);
    },
    saveHistory: function(keyValue) {
        return this.histories.put({ _id: new Date().toISOString(),text: keyValue});
    },
    showSentences: function(ids) {
        var param = {keys: ids, limit: 5, include_docs: true};
        return _this.sentences.query('sentences/by_sentence', param);
    },
    showSimilarKeywords: function(ids) {
        var param = {keys: ids, limit: 5, include_docs: true};
        return this.similar_keywords.query('similarKeywords/by_similar_keyword', param);
    },
    getSearchKeywords: function(keyValue) {
        var param = {startkey: keyValue, endkey: keyValue+'\uffff', include_docs: true};
        return this.keywords.query('keywords/by_keyword',param);
    },
    ifEmptyData: function(callback){
        _this = this;
        _this.keywords.info().then(function(kw_result){
            _this.similar_keywords.info().then(function(sk_result){
                _this.sentences.info().then(function(s_result){
                    console.log(kw_result.doc_count, ' + ', sk_result.doc_count, ' + ', s_result.doc_count, ' = ', kw_result.doc_count+sk_result.doc_count+s_result.doc_count);
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
    this.$elements.remove = {
      histories : function() {
          return $("#history-list li").remove();
      },
      suggestions : function() {
          return $("#suggestion-list li").remove();
      }
    };
    
    var _this = this;
}

View.prototype = {
    listOnClick : function() {
        var _this = this;
        $('#suggestions>#history-list>li').on('click',function(event){
            _this.$elements.input.val($(this).text());
            _this.$elements.suggestionWrapper.addClass('hidden');
            event.stopPropagation();
        });
        
        $('#suggestions>#suggestion-list>li').on('click',function(event){
            _this.$elements.input.val($(this).text());
            _this.$elements.suggestionWrapper.addClass('hidden');
            event.stopPropagation();
        });
    },
    resizeSuggestionWrapper: function() {
        var _this = this;
        _this.$("#suggestion-box").css('width', _this.$elements.input.width() + $("#keyword-div .input-group-btn").width());  
    },
    init: function () {
        // create some initialization process here
        if(this._models.initialized)
            this._models.initializePersistentQueries();
    },
    removeTablesData: function() {
        this.$elements.remove.histories();
        this.$elements.remove.suggestions();
    },
    hideSuggestionWrapper: function() {
        this.$elements.suggestionWrapper.addClass('hidden');
        this.resizeSuggestionWrapper();
    },
    showSuggestionWrapper: function() {
        this.removeTablesData();
        this.$elements.suggestionWrapper.removeClass('hidden');
        this.resizeSuggestionWrapper();
    },
    appendTableData: function(results, isHistory, isSuggestion) {
        var _this = this;
        if (isHistory) {
            _this.$elements.remove.histories();
            if (results.length > 0) { // if query has data
                _this.$.each(results, function(index, value) {
                    var doc = value.doc;
                    var list = "<li id='" + doc._id + "' class='sg-li'>" + doc.text + "</li>";
                    _this.$elements.tables.histories.append(list);
                });
            } else {
                _this.$elements.tables.histories.append('<li class="no-records-found">...</li>');
            }
        } else if (isSuggestion) {
            var ids = _this.$.map(results, function (doc) {
                return doc.id;
            });
            _this.getSentences(ids).then(function(sentences){
                _this.$elements.remove.suggestions();
                if (sentences.rows.length > 0) { // if query has data
                    _this.$.each(sentences.rows, function(index, value) {
                        var doc = value.doc;
                        var list = "<li id='" + doc._id + "' class='sg-li'>" + doc.sentence + "</li>";
                        _this.$elements.tables.suggestions.append(list);
                        _this.getSimilarKeywords(ids);
                    });
                } else {
                    // show no records found
                    _this.$elements.tables.suggestions.append('<li class="no-records-found">...</li>');
                    
                    _this.$elements.suggestionWrapper.removeClass('hidden');
                    _this.resizeSuggestionWrapper();
                    _this.listOnClick();
                }
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
                var hasSeparator = false;
                $.each(sentences2.rows, function(index, value) {
                    var doc = value.doc;
                    var hasDuplicate = false; //　入力が早すぎると、同じ文章がサジェスト欄に挿入されていたりすることがあるため、これで防ぐ
                    
                    $('#suggestion-list li').each(function(i,_thisElem){
                       if (doc._id === $(_thisElem).attr('id')){
                            hasDuplicate = true;
                            return;
                        }
                    });
                    if (!hasDuplicate) {
                        if(!hasSeparator) {
                            hasSeparator = true;
                            var hrList = "<li id='" + doc._id + "' class='sg-li'><hr style='margin: 0;cursor: pointer;'></li>";
                            _this.$elements.tables.suggestions.append(hrList);
                        }
                        
                        var list = "<li id='" + doc._id + "' class='sg-li'>" + doc.sentence + "</li>";
                        _this.$elements.tables.suggestions.append(list);
                    }
                });
                
                _this.$elements.suggestionWrapper.removeClass('hidden');
                _this.resizeSuggestionWrapper();
                _this.listOnClick();
        
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
        });
    },
    showSearchKeywords: function(filterHistory, isNeedToSaveHistory) {
        $('#suggestion-list').append('<li><center>...</center></li>');
        $('#history-list').append('<li><center>...</center></li>');
        var _this = this;
        var key = _this.$elements.input.val().toLowerCase();
        
        // if ($.trim(key) === '') {
            // _this.$elements.remove.suggestions();
        // } else {
            _this.$elements.remove.suggestions();
            _this._models.getSearchKeywords(key).then(function(result){
                _this.appendTableData(result.rows, false, true);
            }).catch(function (err) {
                console.error('エラー発生', err);
            });
        // }
        
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
    this._models = models;
    
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
            var keySearchVal = $("#search-keyword");
            _this._view.removeTablesData();
    
            if(e.keyCode === 40 && keySearchVal.val().trim().length === 0)
                _this.getHistory();
                
            if (keySearchVal.val().trim().length > 0 ) {
                _this.searchKeywords(true);
            } else {
                _this.$elements.suggestionWrapper.addClass('hidden');
            }            
                    
        };
        proceedSearch();
        
        // if model not iniatialized
        if (!models.initialized) {
            _this.$elements.suggestionWrapper.removeClass('hidden');
            _this._view.resizeSuggestionWrapper();
            
            models.start(
                function(){ 
                    // tell the user that db is downloading
                    $('#suggestion-list li').remove();
                    $('#suggestion-list').append('<li class="no-records-found sg-li" >DBをダウンロード中 ... </li>');
                },
                function(){
                    // after db is downloaded
                    $('#suggestion-list li').remove();
                    $('#suggestion-list').append('<li class="no-records-found sg-li">...</li>');
                    models.initializePersistentQueries(proceedSearch);
                }
            );
        }

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
        tables: {histories: $('#history-list'), suggestions: $('#suggestion-list')}
    };
    var models = new Models(couchurl);
    
    var view = new View($, elements, models);
    var controller = new Controller(elements, view, models);
    controller.init();
    $(window).resize(function(){view.resizeSuggestionWrapper();});
    
});