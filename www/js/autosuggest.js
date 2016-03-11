var couchurl = 'http://suggest.creativegeek.jp:8081/';
function Models(url) {
    /**
     * オートコンプリート用DB (Autocomplete DB - history)
     * text:　ブラウザー文章履歴
     *
     */
    this.histories = new PouchDB("history"); //ローカルブラウザ内のDB;
    
    // DBインスタンスの定義　Declaration of DB Instances
    
    /** 
    *  キーワードDB (keywords_remote DB)
    *  _id: 
    *  _rev:
    *  keyword: 単語
    */
    var keywords_remote =  new PouchDB(url+'/keywords');
    
    // ローカルキーワードDB
    this.keywords = new PouchDB("keywords");
    
    // リモートと常に同期させる
    this.keywords.sync(keywords_remote, {live:true});
    
    
    /**
     * 文章DB (sentence DB)
     * _id:
     * _rev:
     * sentence:　文章
     */
    var sentences_remote = new PouchDB(url+'/sentences');
    
    // ローカルキーワードDB
    this.sentences = new PouchDB("sentences");
    
    // リモートと常に同期させる
    this.sentences.sync(sentences_remote, {live:true});
    
    
    /**
     * 類義文章DB (similar keywords DB)
     * _id:
     * _rev:
     * keyword_id_a:　キーワードID
     * keyword_id_b:　キーワードID
     */ 
    var similar_keywords_remote = new PouchDB(url+'/similar_keywords');
    
    // ローカルキーワードDB    
    this.similar_keywords = new PouchDB("similar_keywords");
    
    // リモート常に同期させる
    this.similar_keywords.sync(similar_keywords_remote, {live:true});
    
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
        var param = {startkey: keyValue, endkey: keyValue+'\uffff', limit: 5, include_docs: true};
        return this.keywords.query(function (doc) {
            if (doc.keyword) {
                emit(doc.keyword.toLowerCase());
             }
        }, param);
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


function Controller($elem, view) {
    this.$elements = $elem;
    this._view = view;
    
    var _this = this;
    
    _this.$elements.btn.click(function(){
      _this.searchKeywords(true, true);
    });
    
    _this.$elements.input.keyup(function(e){
        var keySearchVal = $("#search-keyword");
        _this._view.removeTablesData();

        if(e.keyCode === 40 && keySearchVal.val().trim().length === 0)
            _this.getHistory();
            
        if (keySearchVal.val().trim().length > 0) {
            _this.$elements.suggestionWrapper.removeClass('hidden');
            _this.searchKeywords(true);
        } else {
            _this.$elements.suggestionWrapper.addClass('hidden');
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
        tables: {history: $('#history-table'), suggestion: $('#suggesstion-table')}
    };
    var view = new View($, elements, new Models(couchurl));
    var controller = new Controller(elements, view);
    controller.init();
    $(window).resize(function(){view.resizeSuggestionWrapper();});
});