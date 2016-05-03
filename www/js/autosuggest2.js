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
    
    
    var _this = this;
    _this.temp_keyword = [];
    _this.temp_sentences = [];
    
    _this.keywords.allDocs({include_docs:true}).then(function(keywords){
        $.each(keywords.rows, function (i, val){
            var keyword = val.doc;
            _this.temp_keyword.push({id:keyword._id,keyword:keyword.keyword, sentences:[], similar_sentences: []}); 
        });
        
        _this.sentences.allDocs({include_docs:true}).then(function(sentences){
            $.each(sentences.rows, function (i, val){
                var sentence = val.doc;
                $.each(_this.temp_keyword, function(i,val){
                    if (val.id === sentence.keyword_id){    
                        var tmpSentence = {id:sentence._id, sentence:sentence.sentence, keyword_id:sentence.keyword_id};
                        _this.temp_sentences.push(tmpSentence);
                        _this.temp_keyword[i].sentences.push(tmpSentence); 
                    }
                });
            });
            
            _this.similar_keywords.allDocs({include_docs:true}).then(function(similar_keyword){
                $.each(similar_keyword.rows, function (i, val){
                    var keyword = val.doc;
                    
                    $.each(_this.temp_keyword, function(i,val){
                        // console.log(val, 'the temp_keyword sentence');
                        $.each(val.sentences, function(k, sentence){
                            // console.log(sentence, 'the sentence info');
                            if(keyword.keyword_id_a === sentence.keyword_id){
                                var s = _this.searchSimilarKeywordForSentences(keyword.keyword_id_a, _this.temp_keyword[i]);
                                _this.temp_keyword[i] = s;
                                // console.log(s, 'the s');
                                // _this.temp_keyword[i].similar_sentences
                                // .push(s);
                            } else if(keyword.keyword_id_b === sentence.keyword_id){
                                var s = _this.searchSimilarKeywordForSentences(keyword.keyword_id_b, _this.temp_keyword[i]);
                                _this.temp_keyword[i] = s;
                                // console.log(s, 'the s');
                                // _this.temp_keyword[i].similar_sentences.push(s);
                            }
                        });
                    });
                });
                
                console.log(_this.temp_keyword, 'summary');
            });
        });
    });
    
    
    
    

    this.initialized = false;
}

Models.prototype = {
    searchSimilarKeywordForSentences : function(s_keyword_id, arr) {
        var _this = this;
        $.each(this.temp_sentences, function(index, tempSentence) {
            var sentenceExist = false;
            
            if (tempSentence.keyword_id === s_keyword_id) { // check if the keyword id 
                
                $.each(arr.sentences, function(index, value) {
                    if (value.sentence === tempSentence.sentence) {
                        console.log('check on sentences -> ', value.sentence, '===', tempSentence.sentence, ' = ', value.sentences === tempSentence.sentence);
                        sentenceExist = true;
                    }
                });
                
                console.log('if sentenceExist is = ', sentenceExist);
                if (!sentenceExist) {
                    $.each(arr.similar_sentences, function(index, value) {
                        console.log('check on similar_sentences -> ', value, '===', tempSentence.sentence, ' = ', tempSentence.sentence === value);
                        if (tempSentence.sentence === value){
                            sentenceExist = true;
                            // console.log(sentenceExist, 'check on similar_sentences');
                        }
                    });    
                }
                
                console.log(tempSentence.sentence, ' is exist ', sentenceExist, 'final result');
                if(!sentenceExist){
                    arr.similar_sentences.push(tempSentence.sentence);
                }
            }
        });
        return arr;
    },
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
        $(".th-inner").addClass('hidden');
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
                    // console.log(sentences.rows, 'the result');
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
            // console.log(result , 'showHistory()');
            // _this.showSuggestionWrapper();
            _this.appendTableData(result.rows, true,false);
        });
    },
    showSearchKeywords: function(filterHistory, isNeedToSaveHistory) {
        $('#suggestion-list').append('<li><center>...</center></li>');
        $('#history-list').append('<li><center>...</center></li>');
        var _this = this;
        var key = _this.$elements.input.val().toLowerCase();
        
        if (key.trim() === ''){
            _this.$elements.remove.suggestions();
        } else {
            _this._models.getSearchKeywords(key).then(function(result){
                // console.log(result.rows , 'query Keywords()');
                _this.appendTableData(result.rows, false, true);
            }).catch(function (err) {
                console.error('エラー発生', err);
            });
            
            if (filterHistory) {
                _this._models.queryHistory(key).then(function(result){
                    if (isNeedToSaveHistory && result.rows.length === 0) 
                        _this._models.saveHistory(key);
                    // console.log(result.rows, ' query History');
                    _this.appendTableData(result.rows, true, false);
                }).catch(function (err) {
                    console.error('オートコンプリートでエラーが発生しました。', err);
                });
            }
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
                    // _this.$elements.suggestionWrapper.removeClass('hidden');
                    // _this._view.showSuggestionWrapper();
                    _this.searchKeywords(true);
                } else {
                    _this.$elements.suggestionWrapper.addClass('hidden');
                }            
                    
            //},500);            
        };
        proceedSearch();
        models.start(
            function(){ 
                $('#suggestion-list li').remove();
                $('#suggestion-list').append('<li class="no-records-found sg-li" >DBをダウンロード中 ... </li>');
            },
            function(){
                $('#suggestion-list li').remove();
                $('#suggestion-list').append('<li class="no-records-found sg-li">...</li>');
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
        tables: {histories: $('#history-list'), suggestions: $('#suggestion-list')}
    };
    var models = new Models(couchurl);
    
    var view = new View($, elements, models);
    var controller = new Controller(elements, view, models);
    controller.init();
    $(window).resize(function(){view.resizeSuggestionWrapper();});
    
});